from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import config as cfg
from services.rag_service import rag_service
from routers import chat, documents
from routers import config as config_router

# this is start


@asynccontextmanager
async def lifespan(app: FastAPI):
    warnings = cfg.validate()
    print("🚀 NEXUS v2 starting...")
    for w in warnings:
        print(f"   ⚠️  {w}")
    await rag_service.initialize()
    yield
    print("🛑 NEXUS shutting down.")


app = FastAPI(title="NEXUS Agent API v2", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router,          prefix="/api/chat",      tags=["Chat"])
app.include_router(documents.router,     prefix="/api/documents", tags=["Documents"])
app.include_router(config_router.router, prefix="/api/config",    tags=["Config"])


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "provider": cfg.LLM_PROVIDER,
        "model": cfg.LLM_MODEL,
        "rag_ready": rag_service.is_ready,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

