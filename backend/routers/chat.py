"""
Chat Router — stream, upload-and-chat, clear, serve images.

KEY FIX: upload-and-chat now:
  1. Saves the file
  2. Runs vision/RAG analysis to build context_note
  3. Calls run_agent with BOTH the augmented message AND pre-built image context
     so the agent sees the image description even on first upload.
"""
import json
import asyncio
import uuid
import os
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Optional

from services.agent_service import run_agent, clear_session
from services.rag_service import rag_service
from services.vision_service import analyze_image
import config as cfg

router = APIRouter()

# All supported image extensions including avif, bmp, tiff
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".tiff", ".tif"}

# All supported document extensions
DOC_EXTS = {
    ".pdf", ".txt", ".md", ".markdown", ".csv",
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".java", ".go", ".rs", ".cpp", ".c",
    ".docx", ".doc",
}


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ClearRequest(BaseModel):
    session_id: str


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Stream agent response via SSE."""
    session_id = request.session_id or str(uuid.uuid4())

    async def generate():
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
        yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

        result = await run_agent(session_id, request.message)

        for t in result.get("tools_used", []):
            yield f"data: {json.dumps({'type': 'tool_use', 'tool': t['tool'], 'input': t['input']})}\n\n"
            await asyncio.sleep(0.02)

        if result.get("special"):
            sp = result["special"]
            payload = {"type": sp["type"]}
            if sp["type"] == "captured_image":
                payload.update({"filename": sp["filename"], "description": sp.get("description", "")})
            elif sp["type"] == "generated_image":
                payload.update({"filename": sp["filename"], "provider": sp.get("provider", ""), "prompt": sp.get("prompt", "")})
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.02)

        text = result.get("output", "") or ""
        words = text.split(" ")
        buf = []
        for i, w in enumerate(words):
            buf.append(w)
            if len(buf) >= 8 or i == len(words) - 1:
                chunk = " ".join(buf) + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                buf = []
                await asyncio.sleep(0.015)

        yield f"data: {json.dumps({'type': 'done', 'success': result.get('success', True), 'error': result.get('error'), 'tools_used': result.get('tools_used', [])})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/upload-and-chat")
async def upload_and_chat(
    message: str = Form(...),
    session_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Upload a file, analyze/ingest it, then run the agent with full context injected.
    Supports: images (incl. avif), PDFs, docs, code files.
    """
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    # Read and save file
    content = await file.read()
    os.makedirs(cfg.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(cfg.UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    context_note = ""
    is_image = False
    special_result = None

    if ext in IMAGE_EXTS:
        is_image = True
        # For avif and other formats, convert mime type gracefully
        mime_map = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif",
            ".webp": "image/webp", ".avif": "image/avif",
            ".bmp": "image/bmp", ".tiff": "image/tiff", ".tif": "image/tiff",
        }
        # analyze_image stores description in session memory
        vision_result = await analyze_image(file_path, session_id)
        if vision_result["success"]:
            desc = vision_result["description"]
            context_note = (
                f"\n\n[USER UPLOADED IMAGE: {filename}]\n"
                f"Vision Analysis:\n{desc}\n"
                f"[END IMAGE ANALYSIS]\n\n"
                f"The image has been stored in your session memory. "
                f"Answer the user's question about this image."
            )
            special_result = {
                "type": "captured_image",
                "filename": filename,
                "image_path": file_path,
                "description": desc,
            }
        else:
            err = vision_result.get("error", "unknown")
            context_note = (
                f"\n\n[USER UPLOADED IMAGE: {filename}]\n"
                f"Vision analysis failed: {err}\n"
                f"Tell the user the image was received but could not be analyzed, "
                f"and suggest they check that GOOGLE_API_KEY supports vision (Gemini) "
                f"or set LLM_PROVIDER=google."
            )

    elif ext in DOC_EXTS:
        ingest = await rag_service.ingest_file(file_path, filename)
        if ingest["success"]:
            chunks = ingest.get("chunks", 0)
            context_note = (
                f"\n\n[DOCUMENT UPLOADED: {filename} — {chunks} chunks indexed in knowledge base]\n"
                f"The document is now searchable. Use query_knowledge_base tool to answer "
                f"questions about its content."
            )
        else:
            context_note = (
                f"\n\n[DOCUMENT UPLOAD FAILED: {filename} — {ingest.get('error', 'unknown error')}]\n"
                f"Tell the user the upload failed and why."
            )
    else:
        context_note = (
            f"\n\n[FILE RECEIVED: {filename} (type {ext} not supported for analysis)]\n"
            f"Tell the user this file type is not supported. "
            f"Supported: images (jpg/png/webp/avif), PDFs, txt, md, py, js, ts, csv, docx."
        )

    augmented_message = message + context_note
    result = await run_agent(session_id, augmented_message)

    # Attach special result (image card) if we analyzed an image
    if special_result and not result.get("special"):
        result["special"] = special_result

    return {
        "session_id": session_id,
        "filename": filename,
        "ingested": ext in DOC_EXTS,
        "analyzed_as_image": is_image,
        "response": result.get("output", "") or "",
        "tools_used": result.get("tools_used", []),
        "special": result.get("special"),
        "success": result.get("success", True),
        "error": result.get("error"),
    }


@router.post("/clear")
async def clear_memory(req: ClearRequest):
    clear_session(req.session_id)
    return {"success": True}


@router.get("/image/{filename}")
async def serve_image(filename: str):
    """Serve captured/generated images to the frontend."""
    # Also check UPLOAD_DIR for user-uploaded images
    for directory in [cfg.CAPTURES_DIR, cfg.GENERATED_DIR, cfg.UPLOAD_DIR]:
        path = os.path.join(directory, filename)
        if os.path.exists(path):
            return FileResponse(path)
    raise HTTPException(status_code=404, detail=f"Image '{filename}' not found")