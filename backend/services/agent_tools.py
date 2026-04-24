"""
Agent Tools — Stateless tools (no session context needed).
Camera capture and image generation are defined in agent_service.py
as session-aware Tool() wrappers so they can write to session state.
"""
import os
import random
from datetime import datetime
from langchain.tools import tool
import config as cfg


# ─── WEB SEARCH ───────────────────────────────────────────────────────────────
@tool
def search_web(query: str) -> str:
    """Search the internet for current news, facts, or any topic using Tavily."""
    if not cfg.TAVILY_API_KEY:
        return "⚠️ Web search is disabled — TAVILY_API_KEY not set in your .env"
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=cfg.TAVILY_API_KEY)
        results = client.search(query, max_results=4)
        if not results or not results.get("results"):
            return "No results found."
        out = f"🔍 **Web Results for '{query}':**\n\n"
        for i, r in enumerate(results["results"], 1):
            content = r.get("content", "")[:400]
            out += f"**{i}. {r.get('title', '')}**\n{content}\n🔗 {r.get('url', '')}\n\n"
        return out
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            return "⚠️ Tavily quota exceeded. Try again later."
        return f"❌ Search error: {err}"


# ─── RAG ──────────────────────────────────────────────────────────────────────
@tool
def query_knowledge_base(question: str) -> str:
    """Search through uploaded documents to answer questions about their content."""
    from services.rag_service import rag_service
    if not rag_service.is_ready:
        return "📚 RAG not ready. Check your embedding provider config."
    ctx = rag_service.retrieve(question, k=5)
    if not ctx:
        return "📂 No relevant content found in uploaded documents. Have you uploaded any files?"
    return f"📚 **From your documents:**\n\n{ctx}"


# ─── CALCULATOR ───────────────────────────────────────────────────────────────
@tool
def calculator(expression: str) -> str:
    """Evaluate math expressions: arithmetic, powers (**), trig, log, sqrt, pi, e, factorial."""
    import math
    try:
        safe = expression.replace("^", "**")
        result = eval(safe, {"__builtins__": {}}, {
            "abs": abs, "round": round, "min": min, "max": max, "pow": pow,
            "sqrt": math.sqrt, "pi": math.pi, "e": math.e, "sin": math.sin,
            "cos": math.cos, "tan": math.tan, "log": math.log,
            "log10": math.log10, "log2": math.log2, "floor": math.floor,
            "ceil": math.ceil, "factorial": math.factorial,
        })
        return f"🧮 **{expression} = {result}**"
    except ZeroDivisionError:
        return "⚠️ Division by zero!"
    except Exception as e:
        return f"❌ Calculation error: {str(e)}"


# ─── MULTIPLICATION TABLE ─────────────────────────────────────────────────────
@tool
def multiplication_table(n: int) -> str:
    """Generate a multiplication table for any number."""
    try:
        n = int(n)
        rows = "\n".join(f"  {n} × {i:2d} = {n*i}" for i in range(1, 13))
        return f"✖️ **Multiplication Table for {n}:**\n```\n{rows}\n```"
    except Exception as e:
        return f"❌ {e}"


# ─── DATE / TIME ──────────────────────────────────────────────────────────────
@tool
def get_datetime() -> str:
    """Get the current date, time, weekday, and week number."""
    now = datetime.now()
    return (
        f"🕐 **{now.strftime('%A, %B %d, %Y')}**\n"
        f"Time: `{now.strftime('%I:%M:%S %p')}` ({now.strftime('%H:%M:%S')} 24h)\n"
        f"Week {now.strftime('%U')} of {now.year}"
    )


# ─── SAVE NOTE ────────────────────────────────────────────────────────────────
@tool
def save_note(content: str) -> str:
    """Save a note or piece of information to a timestamped file on the server."""
    try:
        os.makedirs(cfg.NOTES_DIR, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(cfg.NOTES_DIR, f"note_{ts}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"NEXUS Note — {datetime.now().strftime('%d %B %Y, %H:%M:%S')}\n")
            f.write("=" * 50 + "\n\n")
            f.write(content)
        return f"✅ **Note saved:** `{path}` ({len(content)} chars)"
    except Exception as e:
        return f"❌ Save failed: {e}"


# ─── RANDOM FACT ──────────────────────────────────────────────────────────────
@tool
def random_fact() -> str:
    """Get an interesting random science, space, or tech fact."""
    facts = [
        "🌌 A neutron star teaspoon weighs ~10 million tons.",
        "🧠 Your brain has ~86 billion neurons, each with up to 10,000 connections.",
        "⚡ Lightning strikes Earth ~100 times per second.",
        "💻 The first computer bug was a literal moth — found in Harvard's Mark II in 1947.",
        "🌊 Sound travels 4.3× faster through water than air.",
        "🧬 If uncoiled, your DNA would stretch ~67 billion miles.",
        "🪐 Saturn's rings are only ~10m thick but 282,000 km wide.",
        "🤖 'Robot' comes from Czech 'robota' meaning forced labor.",
        "🔭 The observable universe is ~93 billion light-years across.",
        "🦠 Some bacteria survive from −20°C to 120°C.",
        "🌍 Earth's core is roughly as hot as the surface of the Sun (~5,500°C).",
        "🐙 Octopuses have three hearts and blue blood.",
    ]
    return random.choice(facts)


# ─── SYSTEM INFO ──────────────────────────────────────────────────────────────
@tool
def system_info() -> str:
    """Show current NEXUS system configuration — active LLM, embeddings, image gen status."""
    info = cfg.to_dict()
    lines = [
        f"🤖 **LLM:** `{info['llm_provider'].upper()}` / `{info['llm_model']}`",
        f"📚 **Embeddings:** `{info['embedding_provider']}`",
        f"🎨 **Image Gen:** `{info['image_provider'] or 'disabled'}`",
        f"🔍 **Web Search:** {'✅ enabled' if info['has_tavily_key'] else '❌ no TAVILY_API_KEY'}",
    ]
    if info["warnings"]:
        lines.append("\n⚠️ **Warnings:**")
        lines += [f"- {w}" for w in info["warnings"]]
    return "\n".join(lines)


# ─── REGISTRY (for TOOLS_INFO endpoint only; actual tool list built in agent_service) ─
TOOLS_INFO = [
    {"id": "search_web",               "name": "Web Search",       "icon": "🔍", "description": "Live internet search via Tavily"},
    {"id": "query_knowledge_base",     "name": "Knowledge Base",   "icon": "📚", "description": "Search uploaded documents (RAG)"},
    {"id": "calculator",               "name": "Calculator",       "icon": "🧮", "description": "Math expressions + trig/log/factorial"},
    {"id": "multiplication_table",     "name": "Times Table",      "icon": "✖️", "description": "Multiplication tables 1–12"},
    {"id": "get_datetime",             "name": "Date & Time",      "icon": "🕐", "description": "Current date/time/weekday"},
    {"id": "save_note",                "name": "Save Note",        "icon": "📝", "description": "Save to server disk"},
    {"id": "capture_and_analyze_photo","name": "Camera + Vision",  "icon": "📸", "description": "Capture, analyze & remember webcam photo"},
    {"id": "generate_image",           "name": "Image Generation", "icon": "🎨", "description": "AI image from text prompt"},
    {"id": "random_fact",              "name": "Random Fact",      "icon": "💡", "description": "Science/tech/space facts"},
    {"id": "system_info",              "name": "System Info",      "icon": "⚙️", "description": "Show active config"},
]
