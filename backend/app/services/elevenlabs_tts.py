"""ElevenLabs TTS service for generating speech audio."""

import asyncio
import hashlib
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
import aiohttp

from app.config import settings

logger = logging.getLogger(__name__)


class ElevenLabsService:
    """
    Text-to-speech service using ElevenLabs API.

    Supports:
    - Multiple voices
    - Hebrew and English (multilingual model)
    - Caching for efficiency
    """

    BASE_URL = "https://api.elevenlabs.io/v1"

    def __init__(self, cache_dir: str = "./tts_cache/elevenlabs"):
        """Initialize ElevenLabs service."""
        self.api_key = settings.elevenlabs_api_key
        self.default_voice_id = settings.elevenlabs_voice_id
        self.model_id = settings.elevenlabs_model_id
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    @property
    def is_available(self) -> bool:
        """Check if ElevenLabs API is configured."""
        return bool(self.api_key)

    def _get_cache_path(self, text: str, voice_id: str) -> Path:
        """Generate cache file path based on text hash."""
        text_hash = hashlib.md5(f"{text}:{voice_id}".encode()).hexdigest()[:16]
        return self.cache_dir / f"{text_hash}.mp3"

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
        stability: float = 0.5,
        similarity_boost: float = 0.8,
        style: float = 0.5,
        use_speaker_boost: bool = True,
        use_cache: bool = True
    ) -> Optional[bytes]:
        """
        Generate speech audio from text.

        Args:
            text: Text to synthesize
            voice_id: ElevenLabs voice ID (defaults to configured voice)
            model_id: Model ID (defaults to eleven_v3)
            stability: Voice stability (0-1, lower = more expressive)
            similarity_boost: Voice similarity (0-1)
            style: Style exaggeration (0-1, higher = more expressive)
            use_speaker_boost: Enhance speaker clarity
            use_cache: Whether to use cached audio if available

        Returns:
            Audio bytes (MP3 format) or None if failed
        """
        if not self.is_available:
            logger.error("ElevenLabs API key not configured")
            return None

        voice_id = voice_id or self.default_voice_id
        model_id = model_id or self.model_id

        # Check cache
        cache_path = self._get_cache_path(text, voice_id)
        if use_cache and cache_path.exists():
            logger.info(f"Using cached audio: {cache_path}")
            return cache_path.read_bytes()

        # Call ElevenLabs API
        url = f"{self.BASE_URL}/text-to-speech/{voice_id}"

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": use_speaker_boost
            }
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status == 200:
                        audio_data = await response.read()

                        # Cache the audio
                        if use_cache:
                            cache_path.write_bytes(audio_data)
                            logger.info(f"Cached audio: {cache_path}")

                        logger.info(f"Generated {len(audio_data)} bytes of audio")
                        return audio_data
                    else:
                        error_text = await response.text()
                        logger.error(f"ElevenLabs API error {response.status}: {error_text}")
                        return None

        except Exception as e:
            logger.error(f"ElevenLabs synthesis error: {e}")
            return None

    async def get_voices(self) -> List[Dict[str, Any]]:
        """Get available voices from ElevenLabs."""
        if not self.is_available:
            return []

        url = f"{self.BASE_URL}/voices"
        headers = {"xi-api-key": self.api_key}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("voices", [])
                    else:
                        logger.error(f"Failed to get voices: {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Error getting voices: {e}")
            return []

    async def synthesize_to_file(
        self,
        text: str,
        output_path: str,
        voice_id: Optional[str] = None
    ) -> bool:
        """
        Generate speech and save to file.

        Args:
            text: Text to synthesize
            output_path: Path to save audio file
            voice_id: Optional voice ID

        Returns:
            True if successful
        """
        audio_data = await self.synthesize(text, voice_id)
        if audio_data:
            Path(output_path).write_bytes(audio_data)
            return True
        return False
