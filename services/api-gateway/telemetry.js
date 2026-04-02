import { NodeSDK } from "@opentelemetry/sdk-node";
import { trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";

const jaegerEndpoint = process.env.JAEGER_ENDPOINT || "localhost:14250";
const serviceName = process.env.OTEL_SERVICE_NAME || "api-gateway";

console.log(`🔍 Initializing OpenTelemetry for ${serviceName}`);
console.log(`   Jaeger endpoint: ${jaegerEndpoint}`);

const jaegerExporter = new JaegerExporter({
  endpoint: jaegerEndpoint,
});

const sdk = new NodeSDK({
  serviceName,
  traceExporter: jaegerExporter,
  spanProcessor: new BatchSpanProcessor(jaegerExporter),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log(`✅ OpenTelemetry tracing initialized for ${serviceName}`);

export const tracer = trace.getTracer("default");
