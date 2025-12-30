"""Chatterbox TTS service for generating speech audio."""

import asyncio
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)


class ChatterboxService:
    """
    Text-to-speech service using Chatterbox for generating spoken audio.

    Supports:
    - Multiple voice presets (cloned voices)
    - Hebrew and English languages (using Multilingual model)
    - Aggressive caching for CPU performance
    - GCS sync for cache persistence across Cloud Run restarts
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        model_name: str = "multilingual",
        device: str = "cpu",
        cache_dir: str = "./tts_cache",
        gcs_service=None
    ):
        """
        Initialize Chatterbox service.

        Args:
            db: MongoDB database for voice presets storage
            model_name: Model to use ("turbo" or "multilingual")
            device: Device to run on ("cuda" or "cpu")
            cache_dir: Directory for caching generated audio
            gcs_service: Optional GCS service for cache persistence
        """
        self.db = db
        self.model_name = model_name
        self.device = device
        self.cache_dir = Path(cache_dir)
        self.gcs_service = gcs_service

        self._model = None
        self._voice_presets: Dict[str, Any] = {}
        self._initialized = False
        self._default_voice_embedding = None

        # Ensure cache directories exist
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        (self.cache_dir / "announcements").mkdir(exist_ok=True)
        (self.cache_dir / "time_checks").mkdir(exist_ok=True)
        (self.cache_dir / "jingles").mkdir(exist_ok=True)
        (self.cache_dir / "voices").mkdir(exist_ok=True)

    @property
    def is_available(self) -> bool:
        """Check if TTS service is available."""
        return self._initialized and self._model is not None

    async def initialize(self) -> bool:
        """
        Initialize the Chatterbox model and load voice presets.

        Returns:
            True if initialization successful, False otherwise
        """
        if not settings.chatterbox_enabled:
            logger.info("Chatterbox TTS is disabled in settings")
            return False

        try:
            logger.info(f"Initializing Chatterbox TTS (model={self.model_name}, device={self.device})...")

            # Import Chatterbox (lazy import to avoid startup delay if disabled)
            from chatterbox.tts import ChatterboxTTS

            # Load model
            self._model = ChatterboxTTS.from_pretrained(
                device=self.device
            )

            # Load voice presets from database
            await self._load_voice_presets()

            # Sync cache from GCS if available (for Cloud Run persistence)
            if self.gcs_service and self.gcs_service.is_available:
                await self._sync_cache_from_gcs()

            self._initialized = True
            logger.info(f"Chatterbox TTS initialized successfully with {len(self._voice_presets)} voice presets")
            return True

        except ImportError as e:
            logger.error(f"Chatterbox import failed - ensure chatterbox-tts is installed: {e}")
            return False
        except Exception as e:
            logger.error(f"Chatterbox initialization failed: {e}", exc_info=True)
            return False

    async def _load_voice_presets(self):
        """Load voice presets from database."""
        try:
            cursor = self.db.voice_presets.find({})
            async for preset in cursor:
                name = preset.get("name")
                embedding_path = preset.get("embedding_path")

                if name and embedding_path and Path(embedding_path).exists():
                    try:
                        import torch
                        self._voice_presets[name] = torch.load(embedding_path, map_location=self.device)
                        logger.debug(f"Loaded voice preset: {name}")
                    except Exception as e:
                        logger.warning(f"Failed to load voice preset {name}: {e}")

            logger.info(f"Loaded {len(self._voice_presets)} voice presets")
        except Exception as e:
            logger.warning(f"Failed to load voice presets: {e}")

    def _get_cache_key(
        self,
        text: str,
        voice_preset: str,
        language: str,
        exaggeration: float
    ) -> str:
        """Generate a unique cache key for the given parameters."""
        content = f"{text}|{voice_preset}|{language}|{exaggeration:.2f}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _get_cache_path(
        self,
        cache_key: str,
        category: str = "announcements"
    ) -> Path:
        """Get the cache file path for a given key."""
        return self.cache_dir / category / f"{cache_key}.wav"

    async def generate_speech(
        self,
        text: str,
        voice_preset: str = "default",
        language: str = "he",
        exaggeration: float = 1.0,
        category: str = "announcements",
        cache_only: bool = False
    ) -> Optional[Path]:
        """
        Generate speech audio from text.

        Args:
            text: Text to convert to speech
            voice_preset: Name of voice preset to use
            language: Language code ("he" or "en")
            exaggeration: Expressiveness level (0.5-2.0)
            category: Cache category ("announcements", "time_checks", "jingles")
            cache_only: If True, only cache the result, don't return path

        Returns:
            Path to generated audio file, or None if failed
        """
        if not self.is_available:
            logger.warning("Chatterbox not available - cannot generate speech")
            return None

        if not text.strip():
            logger.warning("Empty text provided for TTS")
            return None

        # Check cache first
        cache_key = self._get_cache_key(text, voice_preset, language, exaggeration)
        cache_path = self._get_cache_path(cache_key, category)

        if cache_path.exists():
            logger.debug(f"Cache hit for TTS: {cache_key}")
            return cache_path if not cache_only else None

        # Generate new audio
        try:
            logger.info(f"Generating TTS: '{text[:50]}...' (voice={voice_preset}, lang={language})")

            # Get voice embedding if using a preset
            speaker_embedding = None
            if voice_preset != "default" and voice_preset in self._voice_presets:
                speaker_embedding = self._voice_presets[voice_preset]

            # Run synthesis in thread pool to not block event loop
            audio_path = await asyncio.get_event_loop().run_in_executor(
                None,
                self._synthesize_sync,
                text,
                speaker_embedding,
                exaggeration,
                cache_path
            )

            if audio_path and audio_path.exists():
                logger.info(f"TTS generated: {cache_path} ({cache_path.stat().st_size / 1024:.1f} KB)")

                # Upload to GCS for persistence
                if self.gcs_service and self.gcs_service.is_available:
                    await self._upload_to_gcs(cache_path, category, cache_key)

                return audio_path if not cache_only else None
            else:
                logger.error("TTS synthesis returned no audio")
                return None

        except Exception as e:
            logger.error(f"TTS generation failed: {e}", exc_info=True)
            return None

    def _synthesize_sync(
        self,
        text: str,
        speaker_embedding,
        exaggeration: float,
        output_path: Path
    ) -> Optional[Path]:
        """Synchronous synthesis (runs in thread pool)."""
        try:
            import torch
            import torchaudio

            # Generate audio
            with torch.no_grad():
                if speaker_embedding is not None:
                    wav = self._model.generate(
                        text,
                        audio_prompt=speaker_embedding,
                        exaggeration=exaggeration
                    )
                else:
                    wav = self._model.generate(
                        text,
                        exaggeration=exaggeration
                    )

            # Save to file
            if wav is not None:
                # Ensure wav is on CPU for saving
                if hasattr(wav, 'cpu'):
                    wav = wav.cpu()

                # Handle different tensor shapes
                if wav.dim() == 1:
                    wav = wav.unsqueeze(0)

                # Get sample rate from model
                sample_rate = getattr(self._model, 'sr', 24000)

                torchaudio.save(str(output_path), wav, sample_rate)
                return output_path

            return None

        except Exception as e:
            logger.error(f"Synthesis error: {e}", exc_info=True)
            return None

    async def clone_voice(
        self,
        name: str,
        display_name: str,
        reference_audio_path: Path,
        language: str = "he"
    ) -> Optional[dict]:
        """
        Clone a voice from reference audio.

        Args:
            name: Unique identifier for the voice
            display_name: Human-readable name
            reference_audio_path: Path to reference audio file (3-10 seconds recommended)
            language: Primary language of the voice

        Returns:
            Voice preset document if successful, None otherwise
        """
        if not self.is_available:
            logger.warning("Chatterbox not available - cannot clone voice")
            return None

        if not reference_audio_path.exists():
            logger.error(f"Reference audio not found: {reference_audio_path}")
            return None

        try:
            import torch
            import torchaudio

            logger.info(f"Cloning voice '{name}' from {reference_audio_path}")

            # Load reference audio
            wav, sr = torchaudio.load(str(reference_audio_path))

            # Resample if needed
            target_sr = getattr(self._model, 'sr', 24000)
            if sr != target_sr:
                resampler = torchaudio.transforms.Resample(sr, target_sr)
                wav = resampler(wav)

            # Extract speaker embedding
            with torch.no_grad():
                speaker_embedding = self._model.get_speaker_embedding(wav.to(self.device))

            # Save embedding
            embedding_path = self.cache_dir / "voices" / f"{name}.pt"
            torch.save(speaker_embedding.cpu(), embedding_path)

            # Store in database
            voice_doc = {
                "name": name,
                "display_name": display_name,
                "display_name_he": display_name,  # Can be updated later
                "reference_audio_path": str(reference_audio_path),
                "embedding_path": str(embedding_path),
                "language": language,
                "created_at": datetime.utcnow(),
                "is_default": False
            }

            # Upsert to database
            await self.db.voice_presets.update_one(
                {"name": name},
                {"$set": voice_doc},
                upsert=True
            )

            # Add to in-memory cache
            self._voice_presets[name] = speaker_embedding

            logger.info(f"Voice '{name}' cloned successfully")
            return voice_doc

        except Exception as e:
            logger.error(f"Voice cloning failed: {e}", exc_info=True)
            return None

    async def delete_voice(self, name: str) -> bool:
        """Delete a voice preset."""
        try:
            # Remove from database
            result = await self.db.voice_presets.delete_one({"name": name})

            # Remove embedding file
            embedding_path = self.cache_dir / "voices" / f"{name}.pt"
            if embedding_path.exists():
                embedding_path.unlink()

            # Remove from memory
            if name in self._voice_presets:
                del self._voice_presets[name]

            logger.info(f"Voice preset '{name}' deleted")
            return result.deleted_count > 0

        except Exception as e:
            logger.error(f"Failed to delete voice preset: {e}")
            return False

    async def get_voice_presets(self) -> List[dict]:
        """Get all available voice presets."""
        try:
            presets = []
            cursor = self.db.voice_presets.find({})
            async for preset in cursor:
                preset["_id"] = str(preset["_id"])
                presets.append(preset)
            return presets
        except Exception as e:
            logger.error(f"Failed to get voice presets: {e}")
            return []

    async def set_default_voice(self, name: str) -> bool:
        """Set a voice preset as the default."""
        try:
            # Unset current default
            await self.db.voice_presets.update_many(
                {"is_default": True},
                {"$set": {"is_default": False}}
            )

            # Set new default
            result = await self.db.voice_presets.update_one(
                {"name": name},
                {"$set": {"is_default": True}}
            )

            return result.modified_count > 0

        except Exception as e:
            logger.error(f"Failed to set default voice: {e}")
            return False

    async def _upload_to_gcs(self, local_path: Path, category: str, cache_key: str):
        """Upload cached audio to GCS for persistence."""
        try:
            gcs_path = f"tts_cache/{category}/{cache_key}.wav"
            await self.gcs_service.upload_file(
                local_path=local_path,
                content_type="tts_cache",
                filename=f"{category}/{cache_key}.wav"
            )
            logger.debug(f"Uploaded TTS cache to GCS: {gcs_path}")
        except Exception as e:
            logger.warning(f"Failed to upload TTS cache to GCS: {e}")

    async def _sync_cache_from_gcs(self):
        """Download cached audio from GCS on startup."""
        try:
            files = await self.gcs_service.list_files(prefix="tts_cache/")
            logger.info(f"Syncing {len(files)} TTS cache files from GCS...")

            for file_info in files[:100]:  # Limit initial sync to 100 files
                gcs_path = file_info.get("gcs_path", "")
                if gcs_path:
                    # Extract local path from GCS path
                    local_rel_path = gcs_path.replace(f"gs://{self.gcs_service.bucket_name}/tts_cache/", "")
                    local_path = self.cache_dir / local_rel_path

                    if not local_path.exists():
                        # Download from GCS
                        local_path.parent.mkdir(parents=True, exist_ok=True)
                        result = self.gcs_service.stream_file(gcs_path)
                        if result:
                            content, _, _ = result
                            local_path.write_bytes(content)

            logger.info("TTS cache sync from GCS completed")
        except Exception as e:
            logger.warning(f"Failed to sync TTS cache from GCS: {e}")

    async def pregenerate_time_checks(self, voice_preset: str = "default") -> int:
        """
        Pre-generate all time check audio files.

        This is useful for CPU-only deployments to avoid synthesis latency.
        Generates 1440 files per format/language combination.

        Returns:
            Number of files generated
        """
        if not self.is_available:
            return 0

        count = 0

        for hour in range(24):
            for minute in range(60):
                for lang in ["he", "en"]:
                    for fmt in ["12h", "24h"]:
                        text = self._format_time_text(hour, minute, lang, fmt)
                        cache_key = self._get_cache_key(text, voice_preset, lang, 1.0)
                        cache_path = self._get_cache_path(cache_key, "time_checks")

                        if not cache_path.exists():
                            await self.generate_speech(
                                text=text,
                                voice_preset=voice_preset,
                                language=lang,
                                category="time_checks"
                            )
                            count += 1

                            # Yield control periodically
                            if count % 10 == 0:
                                await asyncio.sleep(0.1)

        logger.info(f"Pre-generated {count} time check audio files")
        return count

    def _format_time_text(self, hour: int, minute: int, lang: str, fmt: str) -> str:
        """Format time as spoken text."""
        if lang == "he":
            if fmt == "12h":
                period = "בבוקר" if hour < 12 else "אחר הצהריים" if hour < 18 else "בערב"
                display_hour = hour if hour <= 12 else hour - 12
                if display_hour == 0:
                    display_hour = 12
                return f"השעה היא {display_hour}:{minute:02d} {period}"
            else:
                return f"השעה היא {hour}:{minute:02d}"
        else:
            if fmt == "12h":
                period = "AM" if hour < 12 else "PM"
                display_hour = hour if hour <= 12 else hour - 12
                if display_hour == 0:
                    display_hour = 12
                return f"The time is {display_hour}:{minute:02d} {period}"
            else:
                return f"The time is {hour}:{minute:02d}"

    async def cleanup(self):
        """Clean up resources."""
        logger.info("Cleaning up Chatterbox service...")

        # Sync cache to GCS before shutdown
        if self.gcs_service and self.gcs_service.is_available:
            # Upload any new cache files
            for category in ["announcements", "time_checks", "jingles"]:
                category_dir = self.cache_dir / category
                if category_dir.exists():
                    for cache_file in category_dir.glob("*.wav"):
                        cache_key = cache_file.stem
                        await self._upload_to_gcs(cache_file, category, cache_key)

        # Clear model from memory
        self._model = None
        self._voice_presets.clear()
        self._initialized = False

        logger.info("Chatterbox service cleanup completed")


def get_audio_duration(audio_path: Path) -> float:
    """Get the duration of an audio file in seconds."""
    try:
        import torchaudio
        info = torchaudio.info(str(audio_path))
        return info.num_frames / info.sample_rate
    except Exception as e:
        logger.warning(f"Failed to get audio duration: {e}")
        return 0.0
