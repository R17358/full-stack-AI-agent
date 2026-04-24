"""
Image Generation Service — Multi-provider image generation.
Providers: stability | openai (DALL-E) | google (Imagen)
Gracefully returns a clear error if no image provider is configured.
"""
import os
import base64
import httpx
from datetime import datetime
from typing import Optional
import config as cfg


async def generate_image(prompt: str) -> dict:
    """
    Generate an image from a text prompt.
    Returns: {success, image_path, filename, provider, prompt} or {success: False, error, reason}
    """
    provider = cfg.IMAGE_PROVIDER

    if not provider:
        return {
            "success": False,
            "reason": "no_provider",
            "error": (
                "🎨 Image generation is not configured.\n\n"
                "To enable it, set in your `.env`:\n"
                "```\n"
                "IMAGE_PROVIDER=stability   # + STABILITY_API_KEY\n"
                "IMAGE_PROVIDER=openai      # + OPENAI_API_KEY\n"
                "```\n"
                "Get a free Stability AI key at: https://platform.stability.ai/"
            )
        }

    os.makedirs(cfg.GENERATED_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    try:
        if provider == "stability":
            return await _generate_stability(prompt, timestamp)
        elif provider == "openai":
            return await _generate_openai(prompt, timestamp)
        elif provider == "google":
            return await _generate_google(prompt, timestamp)
        else:
            return {"success": False, "reason": "unknown_provider",
                    "error": f"Unknown IMAGE_PROVIDER: '{provider}'. Use: stability | openai | google"}
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            return {"success": False, "reason": "rate_limit",
                    "error": "⚡ Image generation API quota exceeded. Try again later."}
        if "401" in err or "unauthorized" in err.lower() or "api key" in err.lower():
            return {"success": False, "reason": "auth_error",
                    "error": f"🔐 Invalid API key for image provider '{provider}'. Check your .env"}
        return {"success": False, "reason": "generation_error", "error": str(e)}


async def _generate_stability(prompt: str, timestamp: str) -> dict:
    if not cfg.STABILITY_API_KEY:
        return {"success": False, "reason": "no_key",
                "error": "STABILITY_API_KEY not set. Add it to your .env"}

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
            headers={
                "Authorization": f"Bearer {cfg.STABILITY_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "text_prompts": [{"text": prompt, "weight": 1}],
                "cfg_scale": 7,
                "height": 1024,
                "width": 1024,
                "samples": 1,
                "steps": 30,
            },
        )
        res.raise_for_status()
        data = res.json()
        img_b64 = data["artifacts"][0]["base64"]
        img_bytes = base64.b64decode(img_b64)
        filename = f"gen_{timestamp}.png"
        path = os.path.join(cfg.GENERATED_DIR, filename)
        with open(path, "wb") as f:
            f.write(img_bytes)
        return {"success": True, "image_path": path, "filename": filename,
                "provider": "Stability AI (SDXL)", "prompt": prompt}


async def _generate_openai(prompt: str, timestamp: str) -> dict:
    if not cfg.OPENAI_API_KEY:
        return {"success": False, "reason": "no_key",
                "error": "OPENAI_API_KEY not set. Add it to your .env"}

    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {cfg.OPENAI_API_KEY}",
                     "Content-Type": "application/json"},
            json={"model": "dall-e-3", "prompt": prompt, "n": 1,
                  "size": "1024x1024", "response_format": "b64_json"},
        )
        res.raise_for_status()
        data = res.json()
        img_b64 = data["data"][0]["b64_json"]
        img_bytes = base64.b64decode(img_b64)
        filename = f"gen_{timestamp}.png"
        path = os.path.join(cfg.GENERATED_DIR, filename)
        with open(path, "wb") as f:
            f.write(img_bytes)
        return {"success": True, "image_path": path, "filename": filename,
                "provider": "OpenAI DALL-E 3", "prompt": prompt}


async def _generate_google(prompt: str, timestamp: str) -> dict:
    """Google Imagen via REST API."""
    if not cfg.GOOGLE_API_KEY:
        return {"success": False, "reason": "no_key",
                "error": "GOOGLE_API_KEY not set."}

    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={cfg.GOOGLE_API_KEY}",
            json={
                "instances": [{"prompt": prompt}],
                "parameters": {"sampleCount": 1, "aspectRatio": "1:1"}
            }
        )
        res.raise_for_status()
        data = res.json()
        img_b64 = data["predictions"][0]["bytesBase64Encoded"]
        img_bytes = base64.b64decode(img_b64)
        filename = f"gen_{timestamp}.png"
        path = os.path.join(cfg.GENERATED_DIR, filename)
        with open(path, "wb") as f:
            f.write(img_bytes)
        return {"success": True, "image_path": path, "filename": filename,
                "provider": "Google Imagen 3", "prompt": prompt}
