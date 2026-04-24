"""
Vision Service — analyze images with vision LLM, store in session memory.
Supports: jpg, jpeg, png, gif, webp, avif, bmp, tiff
"""
import base64
import os
from langchain_core.messages import HumanMessage
from services.llm_factory import get_vision_llm
import config as cfg

_image_memory: dict[str, list[dict]] = {}

MIME_MAP = {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".gif":  "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".bmp":  "image/bmp",
    ".tiff": "image/tiff",
    ".tif":  "image/tiff",
}


def _encode_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


async def analyze_image(image_path: str, session_id: str, context: str = "") -> dict:
    """Analyze an image and store description in session memory."""
    try:
        llm = get_vision_llm()
        b64 = _encode_image(image_path)
        ext = os.path.splitext(image_path)[1].lower()
        mime = MIME_MAP.get(ext, "image/jpeg")

        prompt = context if context else (
            "Describe this image comprehensively. Include: "
            "people, objects, colors, setting, mood, any visible text, "
            "spatial layout, and anything notable or unusual."
        )

        message = HumanMessage(content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ])

        response = await llm.ainvoke([message])
        description = response.content

        filename = os.path.basename(image_path)
        if session_id not in _image_memory:
            _image_memory[session_id] = []
        _image_memory[session_id].append({
            "filename": filename,
            "path": image_path,
            "description": description,
            "mime": mime,
        })

        return {"success": True, "description": description, "image_path": image_path, "filename": filename}

    except Exception as e:
        err = str(e)
        if "api_key" in err.lower() or "401" in err:
            return {"success": False, "error": "Invalid API key. Check GOOGLE_API_KEY in .env"}
        if "not supported" in err.lower() or "image" in err.lower():
            return {"success": False, "error": f"Vision not supported by {cfg.LLM_PROVIDER}/{cfg.LLM_MODEL}. Use gemini-2.5-flash or gpt-4o."}
        return {"success": False, "error": err}


def get_image_context(session_id: str) -> str:
    images = _image_memory.get(session_id, [])
    if not images:
        return ""
    parts = [f"[Image {i}: {img['filename']}]\n{img['description']}"
             for i, img in enumerate(images, 1)]
    return "IMAGES IN THIS SESSION:\n\n" + "\n\n---\n\n".join(parts)


def get_images_for_session(session_id: str) -> list:
    return _image_memory.get(session_id, [])


def clear_image_memory(session_id: str):
    _image_memory.pop(session_id, None)