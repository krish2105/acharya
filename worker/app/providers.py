"""
Provider abstraction for the AI gateway (Section 2.3 rule 16: provider-agnostic,
swapping providers is one config value, never a feature-code change).

Fixed fallback order per the pinned stack: gemini -> groq -> ollama, with the
`AI_PROVIDER` setting's provider tried first. A provider with no credentials
configured is skipped (not attempted); a configured provider that errors
(network failure, non-2xx, timeout) is caught and the chain moves on. Ollama
never requires credentials, so it is always a usable last resort -- this is
what lets local dev run fully offline (Section 4).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from .config import Settings


class ProviderError(Exception):
    """A configured provider was attempted and failed."""


@dataclass(frozen=True)
class ProviderResult:
    provider: str
    model: str
    text: str
    input_tokens: int | None
    output_tokens: int | None


class Provider(ABC):
    name: str

    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    def complete(self, system_prompt: str, user_prompt: str) -> ProviderResult: ...


class OllamaProvider(Provider):
    name = "ollama"

    def __init__(self, settings: Settings):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model

    def is_configured(self) -> bool:
        return True  # local, no credentials required

    def complete(self, system_prompt: str, user_prompt: str) -> ProviderResult:
        try:
            resp = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": False,
                    "format": "json",
                },
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise ProviderError(f"ollama: {e}") from e

        return ProviderResult(
            provider=self.name,
            model=self.model,
            text=data["message"]["content"],
            input_tokens=data.get("prompt_eval_count"),
            output_tokens=data.get("eval_count"),
        )


class GeminiProvider(Provider):
    name = "gemini"

    def __init__(self, settings: Settings):
        self.base_url = settings.gemini_base_url
        self.model = settings.gemini_model
        self.api_key = settings.gemini_api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def complete(self, system_prompt: str, user_prompt: str) -> ProviderResult:
        try:
            resp = httpx.post(
                f"{self.base_url}/models/{self.model}:generateContent",
                params={"key": self.api_key},
                json={
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json"},
                },
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise ProviderError(f"gemini: {e}") from e

        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise ProviderError(f"gemini: unexpected response shape: {data}") from e

        usage = data.get("usageMetadata", {})
        return ProviderResult(
            provider=self.name,
            model=self.model,
            text=text,
            input_tokens=usage.get("promptTokenCount"),
            output_tokens=usage.get("candidatesTokenCount"),
        )


class GroqProvider(Provider):
    name = "groq"

    def __init__(self, settings: Settings):
        self.base_url = settings.groq_base_url
        self.model = settings.groq_model
        self.api_key = settings.groq_api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def complete(self, system_prompt: str, user_prompt: str) -> ProviderResult:
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                },
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise ProviderError(f"groq: {e}") from e

        usage = data.get("usage", {})
        return ProviderResult(
            provider=self.name,
            model=self.model,
            text=data["choices"][0]["message"]["content"],
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
        )


def build_chain(settings: Settings) -> list[Provider]:
    """Fixed fallback order gemini -> groq -> ollama, with `AI_PROVIDER`
    moved to the front."""
    all_providers: dict[str, Provider] = {
        "gemini": GeminiProvider(settings),
        "groq": GroqProvider(settings),
        "ollama": OllamaProvider(settings),
    }
    order = ["gemini", "groq", "ollama"]
    if settings.ai_provider in all_providers:
        order.remove(settings.ai_provider)
        order.insert(0, settings.ai_provider)
    return [all_providers[name] for name in order]
