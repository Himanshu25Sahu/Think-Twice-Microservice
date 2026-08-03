import asyncio
import logging
import time

import httpx

from .config import settings

log = logging.getLogger("ai.llm")


class CircuitOpen(Exception):
    """Raised when the breaker is open and the call was not attempted."""


class CircuitBreaker:
    """Stops hammering a dependency that is already failing.

    Without this, an LLM that is down turns every chat request into a full
    timeout: the user waits the timeout, the worker is occupied for it, and the
    failing service gets no room to recover. After `threshold` consecutive
    failures the circuit opens and calls fail instantly. After `cooldown` one
    trial request is allowed through (half-open); success closes it again.
    """

    def __init__(self, threshold: int, cooldown: float) -> None:
        self.threshold = threshold
        self.cooldown = cooldown
        self.failures = 0
        self.opened_at: float | None = None
        self.trips = 0

    @property
    def state(self) -> str:
        if self.opened_at is None:
            return "closed"
        if time.time() - self.opened_at >= self.cooldown:
            return "half-open"
        return "open"

    def check(self) -> None:
        if self.state == "open":
            raise CircuitOpen(
                f"circuit open, retrying in "
                f"{self.cooldown - (time.time() - self.opened_at):.0f}s"
            )

    def record_success(self) -> None:
        if self.opened_at is not None:
            log.info("circuit closed after successful trial call")
        self.failures = 0
        self.opened_at = None

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold and self.opened_at is None:
            self.opened_at = time.time()
            self.trips += 1
            log.warning("circuit opened after %d consecutive failures", self.failures)
        elif self.state == "half-open":
            # Trial call failed; restart the cooldown rather than flapping.
            self.opened_at = time.time()

    def status(self) -> dict:
        return {
            "state": self.state,
            "consecutive_failures": self.failures,
            "trips": self.trips,
        }


class OllamaProvider:
    """Local model over Ollama's HTTP API.

    Local keeps inference free and quota-free. The provider is deliberately
    behind an interface so swapping in a hosted API is a config change, not a
    rewrite -- and so the chat endpoint can degrade when no provider is usable.
    """

    name = "ollama"

    def __init__(self) -> None:
        self.breaker = CircuitBreaker(settings.breaker_threshold, settings.breaker_cooldown_s)

    async def available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(f"{settings.ollama_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    async def generate(self, prompt: str, system: str) -> str:
        self.breaker.check()
        try:
            async with httpx.AsyncClient(timeout=settings.llm_timeout_s) as client:
                response = await client.post(
                    f"{settings.ollama_url}/api/generate",
                    json={
                        "model": settings.ollama_model,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        # Low temperature: this is grounded summarization of
                        # retrieved text, not creative writing.
                        "options": {"temperature": 0.2},
                    },
                )
                response.raise_for_status()
                answer = response.json().get("response", "").strip()
            self.breaker.record_success()
            return answer
        except Exception as exc:
            self.breaker.record_failure()
            raise RuntimeError(f"ollama generation failed: {exc}") from exc


class GroqProvider:
    """Hosted inference via Groq's OpenAI-compatible API.

    Exists because no free host can run a local model, and because a laptop
    running Docker cannot always spare the ~1GB of host RAM Ollama needs to
    stage weights. Swapping providers is a config change: the circuit breaker,
    degradation path, and semantic cache are all provider-agnostic.
    """

    name = "groq"

    def __init__(self) -> None:
        self.breaker = CircuitBreaker(settings.breaker_threshold, settings.breaker_cooldown_s)

    async def available(self) -> bool:
        return bool(settings.groq_api_key)

    async def generate(self, prompt: str, system: str) -> str:
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not set")

        self.breaker.check()
        try:
            async with httpx.AsyncClient(timeout=settings.llm_timeout_s) as client:
                response = await client.post(
                    settings.groq_url,
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.groq_model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": prompt},
                        ],
                        # Grounded summarization of retrieved text, not creative
                        # writing -- keep it close to deterministic.
                        "temperature": 0.2,
                        "max_tokens": 700,
                    },
                )
                # A 429 is a rate limit, not a broken dependency. It still counts
                # as a failure so the breaker backs off rather than hammering a
                # quota that is already exhausted.
                response.raise_for_status()
                data = response.json()
                answer = data["choices"][0]["message"]["content"].strip()
            self.breaker.record_success()
            return answer
        except Exception as exc:
            self.breaker.record_failure()
            raise RuntimeError(f"groq generation failed: {exc}") from exc


class NullProvider:
    """No generation configured. Chat falls back to extractive answers."""

    name = "none"

    def __init__(self) -> None:
        self.breaker = CircuitBreaker(settings.breaker_threshold, settings.breaker_cooldown_s)

    async def available(self) -> bool:
        return False

    async def generate(self, prompt: str, system: str) -> str:
        raise RuntimeError("no llm provider configured")


def build_provider():
    if settings.llm_provider == "groq":
        return GroqProvider()
    if settings.llm_provider == "ollama":
        return OllamaProvider()
    return NullProvider()


provider = build_provider()
