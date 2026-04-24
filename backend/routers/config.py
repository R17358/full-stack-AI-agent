from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import config as cfg
from services.agent_tools import TOOLS_INFO

router = APIRouter()


@router.get("/info")
async def get_config():
    """Return safe config info to the frontend."""
    return cfg.to_dict()


class UpdateConfigRequest(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    embedding_provider: Optional[str] = None
    google_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    tavily_api_key: Optional[str] = None
    stability_api_key: Optional[str] = None
    image_provider: Optional[str] = None
    temperature: Optional[float] = None


@router.post("/update")
async def update_config(req: UpdateConfigRequest):
    """Hot-update config at runtime (in-memory only; edit .env to persist)."""
    if req.llm_provider:
        cfg.LLM_PROVIDER = req.llm_provider
    if req.llm_model:
        cfg.LLM_MODEL = req.llm_model
    if req.embedding_provider:
        cfg.EMBEDDING_PROVIDER = req.embedding_provider
    if req.google_api_key:
        cfg.GOOGLE_API_KEY = req.google_api_key
    if req.openai_api_key:
        cfg.OPENAI_API_KEY = req.openai_api_key
    if req.anthropic_api_key:
        cfg.ANTHROPIC_API_KEY = req.anthropic_api_key
    if req.tavily_api_key:
        cfg.TAVILY_API_KEY = req.tavily_api_key
    if req.stability_api_key:
        cfg.STABILITY_API_KEY = req.stability_api_key
    if req.image_provider is not None:
        cfg.IMAGE_PROVIDER = req.image_provider or None
    if req.temperature is not None:
        cfg.AGENT_TEMPERATURE = req.temperature

    return {"success": True, "config": cfg.to_dict()}


@router.get("/tools")
async def list_tools():
    return {"tools": TOOLS_INFO}
