"""
LLM configuration for the Coscientist system.

All models are routed through LiteLLM using the `aisci/` provider prefix,
which is registered in litellm's providers.json:

    "aisci": {
        "base_url": "http://yy.dbh.baidu-int.com",
        "api_key_env": "AISCI_API_KEY"
    }

Required environment variable:
    AISCI_API_KEY  — API key for the aisci proxy
"""

from langchain_litellm import ChatLiteLLM

# ---------------------------------------------------------------------------
# Model name constants
# ---------------------------------------------------------------------------

MODEL_O3 = "aisci/o3"
MODEL_GEMINI_PRO = "aisci/gemini-2.5-pro"
MODEL_CLAUDE_SONNET = "aisci/claude-sonnet-4-5-20250929"

MODEL_O4_MINI = "aisci/o4-mini"
MODEL_GEMINI_FLASH = "aisci/gemini-2.5-flash"

# ---------------------------------------------------------------------------
# LLM pools
# ---------------------------------------------------------------------------

SMARTER_LLM_POOL: dict[str, ChatLiteLLM] = {
    MODEL_O3: ChatLiteLLM(model=MODEL_O3, max_tokens=50_000),
    MODEL_GEMINI_PRO: ChatLiteLLM(model=MODEL_GEMINI_PRO, max_tokens=50_000),
    MODEL_CLAUDE_SONNET: ChatLiteLLM(model=MODEL_CLAUDE_SONNET, max_tokens=50_000),
}

CHEAPER_LLM_POOL: dict[str, ChatLiteLLM] = {
    MODEL_O4_MINI: ChatLiteLLM(model=MODEL_O4_MINI, max_tokens=50_000),
    MODEL_GEMINI_FLASH: ChatLiteLLM(model=MODEL_GEMINI_FLASH, max_tokens=50_000),
    MODEL_CLAUDE_SONNET: ChatLiteLLM(model=MODEL_CLAUDE_SONNET, max_tokens=50_000),
}
