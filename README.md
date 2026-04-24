# NEXUS Agent v2

Full-stack AI agent: FastAPI + React + Gemini/OpenAI/Anthropic/Ollama + RAG + Vision + Image Gen.

## Quick Start

```bash
cd backend
cp .env.example .env        # Edit with your API keys
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py              # → http://localhost:8000

cd ../frontend
npm install
npm run dev                 # → http://localhost:5173
```

## Provider Setup

### LLM — pick one

| Provider  | .env setting                        | Free? |
|-----------|-------------------------------------|-------|
| Google    | `LLM_PROVIDER=google` + `GOOGLE_API_KEY` | ✅ Yes |
| OpenAI    | `LLM_PROVIDER=openai` + `OPENAI_API_KEY` | ❌ Paid |
| Anthropic | `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` | ❌ Paid |
| Ollama    | `LLM_PROVIDER=ollama` (local)       | ✅ Free |

### Image Generation — optional

| Provider   | .env setting                                 |
|------------|----------------------------------------------|
| Disabled   | `IMAGE_PROVIDER=` (default)                  |
| Stability  | `IMAGE_PROVIDER=stability` + `STABILITY_API_KEY` |
| DALL-E 3   | `IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`   |
| Imagen 3   | `IMAGE_PROVIDER=google` + `GOOGLE_API_KEY`   |

### Embeddings (RAG)

| Provider | .env setting               | API key? |
|----------|----------------------------|----------|
| Google   | `EMBEDDING_PROVIDER=google` | Yes |
| OpenAI   | `EMBEDDING_PROVIDER=openai` | Yes |
| Local    | `EMBEDDING_PROVIDER=local`  | No — downloads ~90MB model |

## Features

| Feature | Description |
|---|---|
| 🔄 Multi-provider LLM | Gemini, GPT, Claude, Ollama — swap in .env or Settings UI |
| 📸 Vision memory | Camera capture analyzed by vision LLM, remembered for session |
| 🖼️ Inline image upload | Drop an image in chat — agent analyzes and answers questions |
| 📎 Inline file upload | Attach PDF/code/text directly in chat input for instant RAG |
| 🎨 Image generation | Stability AI / DALL-E 3 / Imagen 3 with graceful fallback |
| 📚 RAG | Multi-provider embeddings, ChromaDB, supports PDF/TXT/MD/code |
| 💻 Code rendering | Syntax highlighting, copy button, language label, line numbers |
| ⚙️ Live config | Change provider/model/keys from Settings panel — no restart |
| 🧠 Session memory | 12-turn sliding window conversation memory |
| 🔍 Web search | Tavily real-time search |
| ❌ Error handling | Rate limits, auth errors, no provider — all shown clearly |

## Adding Tools

`backend/services/agent_tools.py`:

```python
@tool
def my_tool(input: str) -> str:
    """What this tool does — the LLM reads this."""
    return "result"

ALL_TOOLS = [..., my_tool]
TOOLS_INFO = [..., {"id":"my_tool","name":"My Tool","icon":"🔧","description":"..."}]
```

## Switching Models at Runtime

Use the **Settings panel** in the UI — changes apply instantly without restarting the server.
To persist changes, update your `.env` file.

## Docker

```bash
docker-compose up --build
```
