"""OpenTelemetry setup.

The rest of the stack already exports to the Jaeger instance in docker-compose.
Tracing the retrieval pipeline stage by stage puts embed / dense / lexical /
fuse / rerank / generate on the same timeline as the gateway and entry-service
spans, which is what makes "where did the time actually go" answerable rather
than guessed.

Everything degrades to a no-op when OTEL_ENABLED is false, so the import is
safe regardless of configuration.
"""

import logging
from contextlib import contextmanager

from .config import settings

log = logging.getLogger("ai.tracing")

_tracer = None


def setup() -> None:
    global _tracer
    if not settings.otel_enabled:
        log.info("otel disabled")
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        provider = TracerProvider(
            resource=Resource.create({"service.name": settings.otel_service_name})
        )
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_endpoint))
        )
        trace.set_tracer_provider(provider)
        _tracer = trace.get_tracer("ai-service")
        log.info("otel exporting to %s", settings.otel_endpoint)
    except Exception:
        # Telemetry must never take the service down with it.
        log.exception("otel setup failed; continuing without tracing")


def instrument_app(app) -> None:
    if not settings.otel_enabled:
        return
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
    except Exception:
        log.exception("fastapi instrumentation failed")


@contextmanager
def span(name: str, **attributes):
    if _tracer is None:
        yield None
        return
    with _tracer.start_as_current_span(name) as current:
        for key, value in attributes.items():
            current.set_attribute(key, value)
        yield current
