"""Voice management router - TTS voice presets for Chatterbox."""

import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[dict])
async def list_voices(request: Request):
    """List all available voice presets."""
    chatterbox = getattr(request.app.state, 'chatterbox_service', None)

    if not chatterbox:
        # Return empty list if TTS not available
        return []

    try:
        voices = await chatterbox.get_voice_presets()
        return voices
    except Exception as e:
        logger.error(f"Failed to list voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{voice_id}")
async def get_voice(request: Request, voice_id: str):
    """Get a specific voice preset by ID."""
    db = request.app.state.db

    try:
        voice = await db.voice_presets.find_one({"_id": ObjectId(voice_id)})
        if not voice:
            raise HTTPException(status_code=404, detail="Voice preset not found")

        voice["_id"] = str(voice["_id"])
        return voice
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clone")
async def clone_voice(
    request: Request,
    name: str = Form(..., description="Unique identifier for the voice"),
    display_name: str = Form(..., description="Human-readable name"),
    language: str = Form(default="he", description="Primary language (he or en)"),
    reference_audio: UploadFile = File(..., description="Reference audio file (3-10 seconds)")
):
    """
    Clone a new voice from reference audio.

    Upload a short audio sample (3-10 seconds) of the voice you want to clone.
    The system will extract voice characteristics for TTS synthesis.
    """
    chatterbox = getattr(request.app.state, 'chatterbox_service', None)

    if not chatterbox or not chatterbox.is_available:
        raise HTTPException(
            status_code=503,
            detail="TTS service not available"
        )

    # Validate file type
    allowed_types = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/ogg"]
    if reference_audio.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    # Check if name already exists
    db = request.app.state.db
    existing = await db.voice_presets.find_one({"name": name})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Voice preset with name '{name}' already exists"
        )

    try:
        # Save uploaded file temporarily
        cache_dir = Path(chatterbox.cache_dir) / "voices"
        cache_dir.mkdir(parents=True, exist_ok=True)

        temp_path = cache_dir / f"temp_{name}{Path(reference_audio.filename).suffix}"
        with open(temp_path, "wb") as f:
            content = await reference_audio.read()
            f.write(content)

        # Clone the voice
        result = await chatterbox.clone_voice(
            name=name,
            display_name=display_name,
            reference_audio_path=temp_path,
            language=language
        )

        if not result:
            raise HTTPException(
                status_code=500,
                detail="Voice cloning failed"
            )

        # Clean up temp file (keep the original reference for future use)
        # temp_path.unlink()  # Uncomment to delete after cloning

        return {
            "success": True,
            "message": f"Voice '{display_name}' cloned successfully",
            "voice": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice cloning failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{voice_id}")
async def delete_voice(request: Request, voice_id: str):
    """Delete a voice preset."""
    chatterbox = getattr(request.app.state, 'chatterbox_service', None)
    db = request.app.state.db

    # Get voice to find the name
    try:
        voice = await db.voice_presets.find_one({"_id": ObjectId(voice_id)})
        if not voice:
            raise HTTPException(status_code=404, detail="Voice preset not found")

        name = voice.get("name")

        # Don't allow deleting the default voice
        if voice.get("is_default"):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the default voice preset"
            )

        # Delete via service (handles files + DB)
        if chatterbox:
            success = await chatterbox.delete_voice(name)
        else:
            # Fallback: just delete from DB
            result = await db.voice_presets.delete_one({"_id": ObjectId(voice_id)})
            success = result.deleted_count > 0

        if success:
            return {"success": True, "message": f"Voice preset '{name}' deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete voice preset")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{voice_id}/set-default")
async def set_default_voice(request: Request, voice_id: str):
    """Set a voice preset as the default."""
    chatterbox = getattr(request.app.state, 'chatterbox_service', None)
    db = request.app.state.db

    try:
        # Verify voice exists
        voice = await db.voice_presets.find_one({"_id": ObjectId(voice_id)})
        if not voice:
            raise HTTPException(status_code=404, detail="Voice preset not found")

        name = voice.get("name")

        if chatterbox:
            success = await chatterbox.set_default_voice(name)
        else:
            # Fallback: update DB directly
            await db.voice_presets.update_many(
                {"is_default": True},
                {"$set": {"is_default": False}}
            )
            result = await db.voice_presets.update_one(
                {"_id": ObjectId(voice_id)},
                {"$set": {"is_default": True}}
            )
            success = result.modified_count > 0

        if success:
            return {"success": True, "message": f"'{name}' is now the default voice"}
        else:
            raise HTTPException(status_code=500, detail="Failed to set default voice")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set default voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{voice_id}/preview")
async def preview_voice(
    request: Request,
    voice_id: str,
    text: str = Form(default="שלום, זה קול הניסיון שלי", description="Text to synthesize")
):
    """
    Generate a preview audio clip with the specified voice.

    Returns the generated audio file for immediate playback.
    """
    chatterbox = getattr(request.app.state, 'chatterbox_service', None)
    db = request.app.state.db

    if not chatterbox or not chatterbox.is_available:
        raise HTTPException(
            status_code=503,
            detail="TTS service not available"
        )

    try:
        # Get voice preset
        voice = await db.voice_presets.find_one({"_id": ObjectId(voice_id)})
        if not voice:
            raise HTTPException(status_code=404, detail="Voice preset not found")

        name = voice.get("name", "default")
        language = voice.get("language", "he")

        # Generate preview audio
        audio_path = await chatterbox.generate_speech(
            text=text,
            voice_preset=name,
            language=language,
            exaggeration=1.0,
            category="announcements"
        )

        if not audio_path or not audio_path.exists():
            raise HTTPException(
                status_code=500,
                detail="Failed to generate preview audio"
            )

        return FileResponse(
            path=str(audio_path),
            media_type="audio/wav",
            filename=f"preview_{name}.wav"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview")
async def preview_text(
    request: Request,
    text: str = Form(..., description="Text to synthesize"),
    voice_preset: str = Form(default="default", description="Voice preset name"),
    language: str = Form(default="he", description="Language code"),
    exaggeration: float = Form(default=1.0, ge=0.5, le=2.0, description="Expressiveness")
):
    """
    Generate a preview audio clip for any text.

    Use this for testing TTS without saving to the library.
    """
    chatterbox = getattr(request.app.state, 'chatterbox_service', None)

    if not chatterbox or not chatterbox.is_available:
        raise HTTPException(
            status_code=503,
            detail="TTS service not available"
        )

    try:
        audio_path = await chatterbox.generate_speech(
            text=text,
            voice_preset=voice_preset,
            language=language,
            exaggeration=exaggeration,
            category="announcements"
        )

        if not audio_path or not audio_path.exists():
            raise HTTPException(
                status_code=500,
                detail="Failed to generate preview audio"
            )

        return FileResponse(
            path=str(audio_path),
            media_type="audio/wav",
            filename="preview.wav"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/elevenlabs/synthesize")
async def elevenlabs_synthesize(
    request: Request,
    text: str = Form(..., description="Text to synthesize"),
    voice_id: str = Form(default=None, description="ElevenLabs voice ID"),
):
    """
    Generate speech audio using ElevenLabs API.

    Returns MP3 audio file.
    """
    from app.services.elevenlabs_tts import ElevenLabsService

    elevenlabs = ElevenLabsService()

    if not elevenlabs.is_available:
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs API key not configured"
        )

    try:
        audio_data = await elevenlabs.synthesize(text=text, voice_id=voice_id)

        if not audio_data:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate audio"
            )

        # Return audio as streaming response
        from fastapi.responses import Response
        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ElevenLabs synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/elevenlabs/voices")
async def get_elevenlabs_voices():
    """Get available ElevenLabs voices."""
    from app.services.elevenlabs_tts import ElevenLabsService

    elevenlabs = ElevenLabsService()

    if not elevenlabs.is_available:
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs API key not configured"
        )

    voices = await elevenlabs.get_voices()
    return {"voices": voices}


@router.get("/status")
async def get_tts_status(request: Request):
    """Get the status of the TTS service."""
    chatterbox = getattr(request.app.state, 'chatterbox_service', None)

    if not chatterbox:
        return {
            "available": False,
            "reason": "TTS service not configured"
        }

    return {
        "available": chatterbox.is_available,
        "model": chatterbox.model_name if chatterbox.is_available else None,
        "device": chatterbox.device if chatterbox.is_available else None,
        "voice_presets_count": len(chatterbox._voice_presets) if chatterbox.is_available else 0
    }
