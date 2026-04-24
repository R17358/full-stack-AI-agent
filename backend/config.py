"""
NEXUS Config — Single source of truth.
Change your AI provider, model, and API keys here OR via environment variables.
Everything flows from this file.
"""
import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

# ─── LLM PROVIDER ────────────────────────────────────────────────────────────
# Options: "google", "openai", "anthropic", "ollama"
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "google")

# Model name per provider:
#   google:    "gemini-2.5-flash" | "gemini-1.5-pro" | "gemini-1.5-flash"
#   openai:    "gpt-4o" | "gpt-4o-mini" | "gpt-3.5-turbo"
#   anthropic: "claude-sonnet-4-5" | "claude-3-5-haiku-20241022"
#   ollama:    "llama3" | "mistral" | "phi3" (runs locally)
LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")

# ─── API KEYS ─────────────────────────────────────────────────────────────────
GOOGLE_API_KEY:    Optional[str] = os.getenv("GOOGLE_API_KEY")
OPENAI_API_KEY:    Optional[str] = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
TAVILY_API_KEY:    Optional[str] = os.getenv("TAVILY_API_KEY")

# Ollama base URL (local)
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# ─── IMAGE GENERATION ─────────────────────────────────────────────────────────
# Options: "stability" | "openai" | "google" | None (disables image gen)
IMAGE_PROVIDER: Optional[str] = os.getenv("IMAGE_PROVIDER")  # e.g. "stability"
STABILITY_API_KEY: Optional[str] = os.getenv("STABILITY_API_KEY")
# OpenAI DALL-E uses OPENAI_API_KEY above

# ─── EMBEDDING MODEL ──────────────────────────────────────────────────────────
# Used for RAG vector embeddings
# Options: "google" | "openai" | "local" (sentence-transformers, no API needed)
EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "google" if os.getenv("GOOGLE_API_KEY") else "local")

# ─── PATHS ────────────────────────────────────────────────────────────────────
CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
UPLOAD_DIR:         str = os.getenv("UPLOAD_DIR", "./uploads")
NOTES_DIR:          str = os.getenv("NOTES_DIR", "./notes")
CAPTURES_DIR:       str = os.getenv("CAPTURES_DIR", "./captures")
GENERATED_DIR:      str = os.getenv("GENERATED_DIR", "./generated")

# ─── AGENT ────────────────────────────────────────────────────────────────────
AGENT_TEMPERATURE:    float = float(os.getenv("AGENT_TEMPERATURE", "0.7"))
AGENT_MAX_ITERATIONS: int   = int(os.getenv("AGENT_MAX_ITERATIONS", "6"))
MEMORY_WINDOW_K:      int   = int(os.getenv("MEMORY_WINDOW_K", "12"))

# ─── HELPERS ──────────────────────────────────────────────────────────────────
def _g(name: str):
    """Read a module-level variable by name — picks up runtime hot-updates."""
    import sys
    return getattr(sys.modules[__name__], name, None)

def get_active_api_key() -> Optional[str]:
    """Return the API key for the currently active LLM provider."""
    return {
        "google":    _g("GOOGLE_API_KEY"),
        "openai":    _g("OPENAI_API_KEY"),
        "anthropic": _g("ANTHROPIC_API_KEY"),
        "ollama":    "not-required",
    }.get(_g("LLM_PROVIDER") or "")

def validate() -> list[str]:
    """Return list of config warnings (always reads current runtime values)."""
    warnings = []
    provider = _g("LLM_PROVIDER")
    key = get_active_api_key()
    if provider != "ollama" and not key:
        warnings.append(f"No API key for LLM provider '{provider}'. Set {(provider or '').upper()}_API_KEY.")
    if not _g("TAVILY_API_KEY"):
        warnings.append("No TAVILY_API_KEY — web search tool is disabled.")
    if _g("EMBEDDING_PROVIDER") == "google" and not _g("GOOGLE_API_KEY"):
        warnings.append("EMBEDDING_PROVIDER=google but no GOOGLE_API_KEY — RAG will use local embeddings.")
    if _g("IMAGE_PROVIDER") == "stability" and not _g("STABILITY_API_KEY"):
        warnings.append("IMAGE_PROVIDER=stability but no STABILITY_API_KEY.")
    if _g("IMAGE_PROVIDER") == "openai" and not _g("OPENAI_API_KEY"):
        warnings.append("IMAGE_PROVIDER=openai but no OPENAI_API_KEY.")
    return warnings

def to_dict() -> dict:
    """Expose safe config info to frontend (no secret keys). Always current."""
    return {
        "llm_provider":            _g("LLM_PROVIDER"),
        "llm_model":               _g("LLM_MODEL"),
        "embedding_provider":      _g("EMBEDDING_PROVIDER"),
        "image_provider":          _g("IMAGE_PROVIDER"),
        "has_google_key":          bool(_g("GOOGLE_API_KEY")),
        "has_openai_key":          bool(_g("OPENAI_API_KEY")),
        "has_anthropic_key":       bool(_g("ANTHROPIC_API_KEY")),
        "has_tavily_key":          bool(_g("TAVILY_API_KEY")),
        "has_stability_key":       bool(_g("STABILITY_API_KEY")),
        "image_generation_enabled": bool(_g("IMAGE_PROVIDER")),
        "initialized":             True,
        "warnings":                validate(),
    }
