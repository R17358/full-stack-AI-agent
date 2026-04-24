import os
import aiofiles
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from services.rag_service import rag_service
import config as cfg

router = APIRouter()
ALLOWED = {".pdf", ".txt", ".md", ".markdown", ".py", ".js", ".ts", ".jsx", ".tsx", ".csv", ".java", ".go", ".rs", ".cpp", ".c"}
MAX_SIZE = 50 * 1024 * 1024


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No filename")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Type '{ext}' not supported. Allowed: {', '.join(sorted(ALLOWED))}")

    os.makedirs(cfg.UPLOAD_DIR, exist_ok=True)
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")

    path = os.path.join(cfg.UPLOAD_DIR, file.filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(content)

    result = await rag_service.ingest_file(path, file.filename)
    if not result["success"]:
        if os.path.exists(path):
            os.remove(path)
        raise HTTPException(500, result["error"])

    return {"success": True, "filename": file.filename,
            "pages": result.get("pages", 0), "chunks": result.get("chunks", 0)}


@router.get("/list")
async def list_docs():
    return {"documents": rag_service.list_documents()}


class DeleteReq(BaseModel):
    filename: str


@router.delete("/delete")
async def delete_doc(req: DeleteReq):
    ok = rag_service.delete_document(req.filename)
    path = os.path.join(cfg.UPLOAD_DIR, req.filename)
    if os.path.exists(path):
        os.remove(path)
    if not ok:
        raise HTTPException(404, "Document not found")
    return {"success": True}


@router.get("/status")
async def status():
    return {"initialized": rag_service.is_ready, "count": len(rag_service.list_documents())}
