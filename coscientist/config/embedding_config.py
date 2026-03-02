"""
Embedding configuration for the Coscientist system.

Uses LiteLLM to call the Qianfan (百度千帆) embedding model `qwen3-embedding-4b`.
The `qianfan_emb` provider prefix is registered in litellm's providers.json:

    "qianfan": {
        "base_url": "https://qianfan.baidubce.com/v2",
        "api_key_env": "QIANFAN_API_KEY"
    }

LiteLLM resolves the base_url and API key automatically — no manual
api_base/api_key passing required.

Required environment variable:
    QIANFAN_API_KEY  — Qianfan API Key (bce-v3/... format)
"""

import litellm
from langchain_core.embeddings import Embeddings

EMBEDDING_MODEL = "qianfan/qwen3-embedding-4b"


class LiteLLMEmbeddings(Embeddings):
    """LangChain-compatible Embeddings wrapper backed by LiteLLM."""

    def __init__(self, model: str = EMBEDDING_MODEL):
        self.model = model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        response = litellm.embedding(model=self.model, input=texts)
        return [item["embedding"] for item in response.data]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]


DEFAULT_EMBEDDING = LiteLLMEmbeddings()
