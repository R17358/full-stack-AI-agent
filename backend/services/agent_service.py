"""
Agent Service — LangChain ReAct agent.

FIXES:
- Removed convert_system_message_to_human (deprecated in newer langchain-google-genai)
- Increased max_iterations to 8
- Better ReAct prompt that handles Gemini's tendency to skip Action format
- ThreadPoolExecutor for camera/image async work (avoids nested event loop)
- early_stopping_method="generate" so agent gives a Final Answer instead of hitting limit
"""
import os
import asyncio
import concurrent.futures
from datetime import datetime
from typing import Optional
from langchain.agents import AgentExecutor, create_react_agent
from langchain.memory import ConversationBufferWindowMemory
from langchain.prompts import PromptTemplate
from langchain.tools import Tool

import config as cfg
from services.llm_factory import get_llm, provider_display_name
from services.vision_service import get_image_context, clear_image_memory, analyze_image
from services.image_gen_service import generate_image as gen_image_async


# ── Prompt ────────────────────────────────────────────────────────────────────
# Explicit format reminders help Gemini stay in ReAct structure
SYSTEM_PROMPT = """You are NEXUS, an advanced AI agent. Be direct, precise, and helpful.

CURRENT CONFIG: {llm_info}

AVAILABLE TOOLS: {tool_names}

TOOL DECISION RULES:
- Math calculation → use calculator
- Need current web info → use search_web
- Question about uploaded documents → use query_knowledge_base
- Take webcam photo → use capture_and_analyze_photo
- Create AI image → use generate_image (write a vivid detailed prompt)
- Check system config → use system_info
- Writing code, stories, essays, poems, explanations → DIRECTLY answer, NO tools needed
- If image/document context is already provided in the question → DIRECTLY answer using that context, NO tools needed

UPLOADED IMAGE / DOCUMENT CONTEXT (already analyzed — use this to answer directly):
{vision_context}

{tools}

IMPORTANT: You MUST follow this EXACT format for EVERY response:

Question: the input question
Thought: think about what to do
Action: <tool name> (ONLY if a tool is needed)
Action Input: <tool input>
Observation: <tool result>
Thought: I now know the final answer
Final Answer: <your complete answer>

OR if no tool is needed:

Question: the input question
Thought: I can answer this directly from the provided context or my knowledge.
Final Answer: <your complete answer>

NEVER skip the "Final Answer:" line.
NEVER write prose without the format above.

Previous conversation:
{chat_history}

Question: {input}
Thought:{agent_scratchpad}"""


_session_memories: dict[str, ConversationBufferWindowMemory] = {}
_session_specials: dict[str, Optional[dict]] = {}
_thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)


def _run_async_in_thread(coro):
    """Run async coroutine in a fresh event loop in a thread — avoids nested loop errors."""
    def _runner():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()
    return _thread_pool.submit(_runner).result(timeout=60)


def get_memory(session_id: str) -> ConversationBufferWindowMemory:
    if session_id not in _session_memories:
        _session_memories[session_id] = ConversationBufferWindowMemory(
            memory_key="chat_history",
            return_messages=False,
            k=cfg.MEMORY_WINDOW_K,
            output_key="output",
            human_prefix="User",
            ai_prefix="NEXUS",
        )
    return _session_memories[session_id]


def clear_session(session_id: str):
    _session_memories.pop(session_id, None)
    _session_specials.pop(session_id, None)
    clear_image_memory(session_id)


def _make_tools(session_id: str) -> list:
    from services.agent_tools import (
        search_web, query_knowledge_base, calculator,
        multiplication_table, get_datetime, save_note,
        random_fact, system_info,
    )

    # ── Camera capture ────────────────────────────────────────────────────────
    def _capture_sync(context: str = "") -> str:
        async def _do():
            try:
                import cv2
            except ImportError:
                return "❌ OpenCV not installed: pip install opencv-python"
            os.makedirs(cfg.CAPTURES_DIR, exist_ok=True)
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                return "❌ Camera not accessible. Is a webcam connected?"
            for _ in range(5):
                cap.read()
            ret, frame = cap.read()
            cap.release()
            if not ret:
                return "❌ Failed to read frame from camera."
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = os.path.join(cfg.CAPTURES_DIR, f"capture_{ts}.jpg")
            cv2.imwrite(path, frame)
            res = await analyze_image(path, session_id, context)
            if res["success"]:
                _session_specials[session_id] = {
                    "type": "captured_image",
                    "filename": f"capture_{ts}.jpg",
                    "image_path": path,
                    "description": res["description"],
                }
                return (
                    f"📸 Photo captured and analyzed.\n\n"
                    f"**What I see:** {res['description']}\n\n"
                    f"Image stored in session memory."
                )
            else:
                _session_specials[session_id] = {
                    "type": "captured_image",
                    "filename": f"capture_{ts}.jpg",
                    "image_path": path,
                    "description": "Vision analysis failed.",
                }
                return f"📸 Photo saved but vision analysis failed: {res.get('error', 'unknown')}"
        try:
            return _run_async_in_thread(_do())
        except Exception as e:
            return f"❌ Camera error: {e}"

    capture_tool = Tool(
        name="capture_and_analyze_photo",
        func=_capture_sync,
        description=(
            "Capture a webcam photo, analyze with vision AI, store in session memory. "
            "Optionally pass context e.g. 'What objects are on the desk?'."
        ),
    )

    # ── Image generation ──────────────────────────────────────────────────────
    def _gen_sync(prompt: str) -> str:
        async def _do():
            res = await gen_image_async(prompt)
            if res["success"]:
                _session_specials[session_id] = {
                    "type": "generated_image",
                    "filename": res["filename"],
                    "image_path": res["image_path"],
                    "provider": res.get("provider", ""),
                    "prompt": res.get("prompt", prompt),
                }
                return f"🎨 Image generated by {res.get('provider','AI')}. Saved: `{res['image_path']}`"
            return res["error"]
        try:
            return _run_async_in_thread(_do())
        except Exception as e:
            return f"❌ Image generation error: {e}"

    gen_tool = Tool(
        name="generate_image",
        func=_gen_sync,
        description=(
            "Generate an AI image from a detailed text description. "
            "Write a vivid prompt e.g. 'futuristic city at sunset, cyberpunk, neon lights, photorealistic'."
        ),
    )

    return [
        search_web, query_knowledge_base, calculator,
        multiplication_table, get_datetime, save_note,
        capture_tool, gen_tool, random_fact, system_info,
    ]


def _build_executor(session_id: str) -> AgentExecutor:
    llm = get_llm()
    memory = get_memory(session_id)
    vision_ctx = get_image_context(session_id)
    tools = _make_tools(session_id)

    prompt = PromptTemplate.from_template(SYSTEM_PROMPT).partial(
        llm_info=provider_display_name(),
        vision_context=vision_ctx if vision_ctx else "No images captured or uploaded yet.",
    )

    agent = create_react_agent(llm=llm, tools=tools, prompt=prompt)
    return AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        verbose=True,
        handle_parsing_errors=True,   # recovers from bad format
        max_iterations=8,             # increased from 6
        early_stopping_method="generate",  # LLM writes Final Answer instead of hard stop
        return_intermediate_steps=True,
    )


async def run_agent(session_id: str, user_input: str) -> dict:
    _session_specials.pop(session_id, None)
    try:
        executor = _build_executor(session_id)
        result = await executor.ainvoke({"input": user_input})

        output = result.get("output", "") or ""
        tools_used = []
        for step in result.get("intermediate_steps", []):
            if not step:
                continue
            action = step[0]
            tools_used.append({
                "tool": getattr(action, "tool", "unknown"),
                "input": str(getattr(action, "tool_input", ""))[:120],
            })

        special = _session_specials.get(session_id)
        return {
            "success": True,
            "output": output,
            "tools_used": tools_used,
            "special": special,
            "session_id": session_id,
        }

    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower() or "resource_exhausted" in err.lower():
            return {
                "success": False, "error": "rate_limit",
                "output": f"⚡ **Rate Limit** — `{cfg.LLM_PROVIDER}/{cfg.LLM_MODEL}`\n\nWait a moment and retry.",
                "tools_used": [], "special": None, "session_id": session_id,
            }
        elif "api_key" in err.lower() or "401" in err or "invalid" in err.lower():
            return {
                "success": False, "error": "auth_error",
                "output": f"🔐 **Auth Error** — Invalid API key for `{cfg.LLM_PROVIDER}`.\nCheck `.env` or update in **CONFIG**.",
                "tools_used": [], "special": None, "session_id": session_id,
            }
        else:
            return {
                "success": False, "error": "general",
                "output": f"❌ **Error:** {err}",
                "tools_used": [], "special": None, "session_id": session_id,
            }