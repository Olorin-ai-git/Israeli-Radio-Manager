"""File upload router."""

import os
import tempfile
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import Optional
from bson import ObjectId

from app.models.content import ContentType
from app.utils.audio_metadata import extract_metadata, estimate_content_type

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


@router.post("/")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    content_type: Optional[ContentType] = Form(None),
    genre: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    artist: Optional[str] = Form(None),
    auto_categorize: bool = Form(True)
):
    """
    Upload an audio file.

    If auto_categorize is True and the agent is in prompt mode,
    the AI will suggest categorization and wait for confirmation.
    """
    db = request.app.state.db
    drive_service = getattr(request.app.state, 'drive_service', None)

    # Validate file extension
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024} MB"
        )

    # Save to temporary file for processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Extract metadata using mutagen
        metadata = extract_metadata(tmp_path)

        # Use provided values or extracted metadata
        final_title = title or metadata.get("title") or file.filename
        final_artist = artist or metadata.get("artist")
        final_genre = genre or metadata.get("genre")

        # Determine content type
        if content_type:
            final_type = content_type.value
        elif auto_categorize:
            final_type = estimate_content_type(metadata)
        else:
            final_type = "song"  # Default

        # If auto_categorize and no explicit type, create pending upload for AI
        if auto_categorize and content_type is None:
            # Store as pending for AI classification
            pending_doc = {
                "filename": file.filename,
                "temp_path": tmp_path,
                "metadata": metadata,
                "suggested_type": final_type,
                "suggested_genre": final_genre,
                "status": "pending",
                "created_at": datetime.utcnow()
            }
            result = await db.pending_uploads.insert_one(pending_doc)

            return {
                "message": "File uploaded, pending classification",
                "upload_id": str(result.inserted_id),
                "filename": file.filename,
                "size": len(content),
                "metadata": metadata,
                "suggested_type": final_type,
                "suggested_genre": final_genre,
                "pending_classification": True
            }

        # Upload to Google Drive if available
        google_drive_id = None
        google_drive_path = None
        if drive_service:
            # Determine folder based on type
            type_folders = {
                "song": "Songs",
                "commercial": "Commercials",
                "show": "Shows",
                "jingle": "Jingles",
                "sample": "Samples",
                "newsflash": "Newsflashes"
            }
            folder_name = type_folders.get(final_type, "Uploads")
            if final_genre:
                folder_name = f"{folder_name}/{final_genre}"

            uploaded = await drive_service.upload_file(
                tmp_path,
                file.filename,
                folder_path=folder_name
            )
            if uploaded:
                google_drive_id = uploaded.get("id")
                google_drive_path = f"{folder_name}/{file.filename}"

        # Create content record in database
        content_doc = {
            "title": final_title,
            "title_he": final_title if _is_hebrew(final_title) else None,
            "artist": final_artist,
            "genre": final_genre,
            "type": final_type,
            "duration_seconds": metadata.get("duration_seconds", 0),
            "google_drive_id": google_drive_id,
            "google_drive_path": google_drive_path,
            "local_cache_path": tmp_path,
            "metadata": {
                "bitrate": metadata.get("bitrate"),
                "sample_rate": metadata.get("sample_rate"),
                "file_size": metadata.get("file_size"),
                "original_filename": file.filename
            },
            "created_at": datetime.utcnow(),
            "last_played": None,
            "play_count": 0,
            "active": True
        }

        result = await db.content.insert_one(content_doc)

        return {
            "message": "File uploaded successfully",
            "content_id": str(result.inserted_id),
            "filename": file.filename,
            "size": len(content),
            "title": final_title,
            "artist": final_artist,
            "type": final_type,
            "genre": final_genre,
            "duration_seconds": metadata.get("duration_seconds", 0),
            "google_drive_id": google_drive_id
        }

    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def upload_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    auto_categorize: bool = Form(True)
):
    """Upload multiple audio files at once."""
    db = request.app.state.db
    drive_service = getattr(request.app.state, 'drive_service', None)
    results = []

    for file in files:
        _, ext = os.path.splitext(file.filename)
        if ext.lower() not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": "Invalid file type"
            })
            continue

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": "File too large"
            })
            continue

        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            # Extract metadata
            metadata = extract_metadata(tmp_path)
            final_type = estimate_content_type(metadata)
            final_title = metadata.get("title") or file.filename
            final_artist = metadata.get("artist")
            final_genre = metadata.get("genre")

            # Upload to Google Drive
            google_drive_id = None
            if drive_service:
                type_folders = {"song": "Songs", "commercial": "Commercials", "show": "Shows", "jingle": "Jingles", "sample": "Samples", "newsflash": "Newsflashes"}
                folder_name = type_folders.get(final_type, "Uploads")
                uploaded = await drive_service.upload_file(tmp_path, file.filename, folder_path=folder_name)
                if uploaded:
                    google_drive_id = uploaded.get("id")

            # Create content record
            content_doc = {
                "title": final_title,
                "artist": final_artist,
                "genre": final_genre,
                "type": final_type,
                "duration_seconds": metadata.get("duration_seconds", 0),
                "google_drive_id": google_drive_id,
                "local_cache_path": tmp_path,
                "created_at": datetime.utcnow(),
                "active": True
            }
            result = await db.content.insert_one(content_doc)

            results.append({
                "filename": file.filename,
                "status": "success",
                "content_id": str(result.inserted_id),
                "type": final_type,
                "size": len(content)
            })

        except Exception as e:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })

    successful = sum(1 for r in results if r["status"] == "success")
    return {
        "message": f"Uploaded {successful}/{len(files)} files",
        "results": results
    }


@router.get("/pending")
async def get_pending_uploads(request: Request):
    """Get list of uploads pending categorization."""
    db = request.app.state.db

    cursor = db.pending_uploads.find({"status": "pending"}).sort("created_at", -1)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.post("/pending/{upload_id}/confirm")
async def confirm_upload(
    request: Request,
    upload_id: str,
    content_type: ContentType = Form(...),
    genre: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    artist: Optional[str] = Form(None)
):
    """Confirm categorization for a pending upload."""
    db = request.app.state.db
    drive_service = getattr(request.app.state, 'drive_service', None)

    # Get pending upload
    pending = await db.pending_uploads.find_one({"_id": ObjectId(upload_id)})
    if not pending:
        raise HTTPException(status_code=404, detail="Pending upload not found")

    if pending["status"] != "pending":
        raise HTTPException(status_code=400, detail="Upload already processed")

    tmp_path = pending["temp_path"]
    metadata = pending.get("metadata", {})

    # Use provided values or metadata
    final_title = title or metadata.get("title") or pending["filename"]
    final_artist = artist or metadata.get("artist")
    final_genre = genre or pending.get("suggested_genre")
    final_type = content_type.value

    # Upload to Google Drive
    google_drive_id = None
    google_drive_path = None
    if drive_service and os.path.exists(tmp_path):
        type_folders = {"song": "Songs", "commercial": "Commercials", "show": "Shows", "jingle": "Jingles", "sample": "Samples", "newsflash": "Newsflashes"}
        folder_name = type_folders.get(final_type, "Uploads")
        if final_genre:
            folder_name = f"{folder_name}/{final_genre}"

        uploaded = await drive_service.upload_file(
            tmp_path,
            pending["filename"],
            folder_path=folder_name
        )
        if uploaded:
            google_drive_id = uploaded.get("id")
            google_drive_path = f"{folder_name}/{pending['filename']}"

    # Create content record
    content_doc = {
        "title": final_title,
        "artist": final_artist,
        "genre": final_genre,
        "type": final_type,
        "duration_seconds": metadata.get("duration_seconds", 0),
        "google_drive_id": google_drive_id,
        "google_drive_path": google_drive_path,
        "local_cache_path": tmp_path,
        "created_at": datetime.utcnow(),
        "active": True
    }
    result = await db.content.insert_one(content_doc)

    # Update pending status
    await db.pending_uploads.update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {"status": "completed", "content_id": str(result.inserted_id)}}
    )

    return {
        "message": "Upload confirmed",
        "content_id": str(result.inserted_id),
        "upload_id": upload_id,
        "content_type": content_type.value,
        "title": final_title,
        "genre": final_genre
    }


@router.delete("/pending/{upload_id}")
async def cancel_pending_upload(request: Request, upload_id: str):
    """Cancel a pending upload."""
    db = request.app.state.db

    # Get pending upload
    pending = await db.pending_uploads.find_one({"_id": ObjectId(upload_id)})
    if not pending:
        raise HTTPException(status_code=404, detail="Pending upload not found")

    # Remove temp file
    tmp_path = pending.get("temp_path")
    if tmp_path and os.path.exists(tmp_path):
        os.unlink(tmp_path)

    # Delete pending record
    await db.pending_uploads.delete_one({"_id": ObjectId(upload_id)})

    return {"message": "Upload cancelled", "upload_id": upload_id}


def _is_hebrew(text: str) -> bool:
    """Check if text contains Hebrew characters."""
    if not text:
        return False
    for char in text:
        if '\u0590' <= char <= '\u05FF':
            return True
    return False
