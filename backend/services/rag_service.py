"""
RAG Service — FAISS + sentence-transformers/all-mpnet-base-v2
Matches the reference implementation:
  - HuggingFaceEmbeddings with all-mpnet-base-v2
  - FAISS IndexFlatL2
  - CharacterTextSplitter (chunk_size=1000, chunk_overlap=100)
  - Supports: PDF, DOCX, TXT, MD, code files
"""
import os
import asyncio
import numpy as np
from pathlib import Path
from typing import List
import config as cfg


class RAGService:
    def __init__(self):
        self.vector_store = None
        self.embeddings = None
        self.text_splitter = None
        self._initialized = False
        self._doc_registry: dict = {}

    def _build_embeddings(self):
        from langchain_community.embeddings import HuggingFaceEmbeddings
        print("📦 Loading sentence-transformers/all-mpnet-base-v2 …")
        return HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-mpnet-base-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": False},
        )

    def _build_faiss_store(self):
        import faiss
        from langchain_community.vectorstores import FAISS
        from langchain_community.docstore.in_memory import InMemoryDocstore
        sample = np.array(self.embeddings.embed_query("sample text"))
        dimension = sample.shape[0]
        index = faiss.IndexFlatL2(dimension)
        return FAISS(
            embedding_function=self.embeddings,
            index=index,
            docstore=InMemoryDocstore(),
            index_to_docstore_id={},
        )

    async def initialize(self):
        try:
            os.makedirs(cfg.UPLOAD_DIR, exist_ok=True)
            from langchain.text_splitter import CharacterTextSplitter
            self.text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            self.embeddings = await asyncio.get_running_loop().run_in_executor(
                None, self._build_embeddings
            )
            self.vector_store = await asyncio.get_running_loop().run_in_executor(
                None, self._build_faiss_store
            )
            self._initialized = True
            print("✅ RAG ready [all-mpnet-base-v2 + FAISS]")
        except Exception as e:
            print(f"❌ RAG init error: {e}")
            self._initialized = False

    def _load_pdf(self, file_path: str) -> str:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        return "".join(p.extract_text() or "" for p in reader.pages)

    def _load_docx(self, file_path: str) -> str:
        from docx import Document
        doc = Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)

    def _load_text(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    async def ingest_file(self, file_path: str, filename: str) -> dict:
        if not self._initialized:
            return {"success": False, "error": "RAG not initialized."}
        try:
            ext = Path(filename).suffix.lower()
            if ext == ".pdf":
                text = await asyncio.get_running_loop().run_in_executor(None, self._load_pdf, file_path)
            elif ext in (".docx", ".doc"):
                text = await asyncio.get_running_loop().run_in_executor(None, self._load_docx, file_path)
            elif ext in (".txt", ".md", ".markdown", ".csv",
                         ".py", ".js", ".ts", ".jsx", ".tsx",
                         ".java", ".go", ".rs", ".cpp", ".c"):
                text = await asyncio.get_running_loop().run_in_executor(None, self._load_text, file_path)
            else:
                return {"success": False, "error": f"Unsupported type: {ext}"}

            if not text.strip():
                return {"success": False, "error": "No text extracted."}

            chunks = self.text_splitter.split_text(text)
            if not chunks:
                return {"success": False, "error": "No chunks produced."}

            tagged = [f"[Source: {filename}]\n{c}" for c in chunks]
            await asyncio.get_running_loop().run_in_executor(
                None, lambda: self.vector_store.add_texts(tagged)
            )
            self._doc_registry[filename] = {"filename": filename, "type": ext, "chunks": len(chunks)}
            return {"success": True, "filename": filename, "chunks": len(chunks), "pages": 1}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def retrieve(self, query: str, k: int = 5) -> str:
        if not self._initialized or not self.vector_store:
            return ""
        try:
            retriever = self.vector_store.as_retriever(search_kwargs={"k": k})
            docs = retriever.invoke(query)
            if not docs:
                return ""
            return "\n\n---\n\n".join(d.page_content for d in docs)
        except Exception as e:
            print(f"RAG retrieve error: {e}")
            return ""

    def list_documents(self) -> List[dict]:
        return list(self._doc_registry.values())

    def delete_document(self, filename: str) -> bool:
        if filename not in self._doc_registry:
            return False
        try:
            all_ids = list(self.vector_store.index_to_docstore_id.values())
            remaining = []
            for doc_id in all_ids:
                doc = self.vector_store.docstore.search(doc_id)
                if doc and not doc.page_content.startswith(f"[Source: {filename}]"):
                    remaining.append(doc.page_content)
            self.vector_store = self._build_faiss_store()
            if remaining:
                self.vector_store.add_texts(remaining)
            del self._doc_registry[filename]
            return True
        except Exception as e:
            print(f"Delete error: {e}")
            return False

    @property
    def is_ready(self) -> bool:
        return self._initialized


rag_service = RAGService()