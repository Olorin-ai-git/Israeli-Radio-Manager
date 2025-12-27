"""File upload router."""

import os
import tempfile
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import Optional

from app.models.content import ContentType

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
        # TODO: Extract metadata using mutagen
        # TODO: If auto_categorize, send to AI agent for classification
        # TODO: Upload to Google Drive
        # TODO: Create content record in database

        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "size": len(content),
            "temp_path": tmp_path,
            "auto_categorize": auto_categorize,
            "pending_classification": auto_categorize and content_type is None
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

        # TODO: Process each file
        results.append({
            "filename": file.filename,
            "status": "pending",
            "size": len(content)
        })

    return {
        "message": f"Uploaded {len(results)} files",
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
    # TODO: Complete the upload process with provided categorization
    return {
        "message": "Upload confirmed",
        "upload_id": upload_id,
        "content_type": content_type,
        "genre": genre
    }


@router.delete("/pending/{upload_id}")
async def cancel_pending_upload(request: Request, upload_id: str):
    """Cancel a pending upload."""
    # TODO: Remove temp file and pending record
    return {"message": "Upload cancelled"}
