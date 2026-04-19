"""
LLM Provider Factory — Swappable LLM backend via .env configuration.
Supports OpenAI, Google Gemini, and Groq.
"""
import os
from dotenv import load_dotenv

load_dotenv()


def get_llm(temperature: float = 0.1):
    """
    Create and return an LLM instance based on LLM_PROVIDER env var.
    Defaults to OpenAI gpt-4o-mini.
    """
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            api_key=os.getenv("OPENAI_API_KEY"),
        )
    elif provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=model or "llama-3.1-70b-versatile",
            temperature=temperature,
            api_key=os.getenv("GROQ_API_KEY"),
        )
    elif provider == "google" or provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model or "gemini-1.5-flash",
            temperature=temperature,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    else:
        raise ValueError(f"Unknown LLM provider: {provider}. Use 'openai', 'groq', or 'google'.")
