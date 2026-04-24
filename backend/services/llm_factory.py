"""
LLM Factory — hot-swappable providers.
FIXED: Removed deprecated convert_system_message_to_human from Gemini.
       It now uses the newer langchain-google-genai which handles system
       messages natively.
"""
import config as cfg
from langchain_core.language_models import BaseChatModel


def get_llm() -> BaseChatModel:
    provider = cfg.LLM_PROVIDER
    model    = cfg.LLM_MODEL
    temp     = cfg.AGENT_TEMPERATURE

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        if not cfg.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY not set. Add it to your .env file.")
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=cfg.GOOGLE_API_KEY,
            temperature=temp,
            # convert_system_message_to_human is DEPRECATED — removed
        )

    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        if not cfg.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set. Add it to your .env file.")
        return ChatOpenAI(
            model=model,
            openai_api_key=cfg.OPENAI_API_KEY,
            temperature=temp,
            streaming=True,
        )

    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        if not cfg.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY not set. Add it to your .env file.")
        return ChatAnthropic(
            model=model,
            anthropic_api_key=cfg.ANTHROPIC_API_KEY,
            temperature=temp,
        )

    elif provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=model,
            base_url=cfg.OLLAMA_BASE_URL,
            temperature=temp,
        )

    else:
        raise ValueError(
            f"Unknown LLM provider: '{provider}'. "
            "Valid: google | openai | anthropic | ollama"
        )


def get_vision_llm() -> BaseChatModel:
    """Returns a vision-capable LLM."""
    provider = cfg.LLM_PROVIDER

    if provider == "google" and cfg.GOOGLE_API_KEY:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=cfg.GOOGLE_API_KEY,
            temperature=0.2,
        )
    elif provider == "openai" and cfg.OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o",
            openai_api_key=cfg.OPENAI_API_KEY,
            temperature=0.2,
        )
    elif cfg.GOOGLE_API_KEY:
        # Fallback to Google vision
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=cfg.GOOGLE_API_KEY,
            temperature=0.2,
        )
    else:
        raise ValueError(
            "No vision model available. Set GOOGLE_API_KEY (Gemini) or OPENAI_API_KEY (GPT-4o)."
        )


def provider_display_name() -> str:
    return f"{cfg.LLM_PROVIDER.upper()} / {cfg.LLM_MODEL}"