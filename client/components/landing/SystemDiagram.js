'use client';

/**
 * SystemDiagram — a clean, lightly-animated architecture diagram for the (light) landing page.
 * Pure SVG (responsive via viewBox), no dependencies.
 *
 * Three readable "planes", each with its own line style:
 *   • solid grey  → request path (client → gateway → services → MongoDB)
 *   • amber dash  → async event stream (Entry → Redis → Analytics)  [the only animated bit]
 *   • cyan dotted → OpenTelemetry traces exported to Jaeger
 * A dashed boundary marks the Kubernetes namespace (the browser/client sits outside it).
 *
 * Light theme: white nodes, ink labels, cobalt focus on the gateway, small per-service
 * accent dots for legibility (colour only where it means something).
 */

const NODES = [
  { id: 'client',    x: 340, y: 24,  w: 220, h: 52, dot: '#a1a1aa', title: 'Client',      meta: 'Next.js · Redux',                          big: false },
  { id: 'gateway',   x: 290, y: 150, w: 320, h: 74, dot: '#2563EB', title: 'API Gateway', meta: 'rate-limit · auth · trace · retry',          port: ':5000', big: true },
  { id: 'auth',      x: 32,  y: 320, w: 188, h: 86, dot: '#16a34a', title: 'Auth',        meta: 'JWT · sessions',          port: ':5001' },
  { id: 'org',       x: 248, y: 320, w: 188, h: 86, dot: '#0284c7', title: 'Org',         meta: 'RBAC · tenants',          port: ':5003' },
  { id: 'entry',     x: 464, y: 320, w: 188, h: 86, dot: '#7c3aed', title: 'Entry',       meta: 'circuit breaker · idem',  port: ':5002' },
  { id: 'analytics', x: 680, y: 320, w: 188, h: 86, dot: '#d97706', title: 'Analytics',   meta: 'stream consumer',         port: ':5004' },
  { id: 'mongo',     x: 48,  y: 470, w: 360, h: 66, dot: '#52525b', title: 'MongoDB',     meta: 'separate database per service', port: ':27017' },
  { id: 'redis',     x: 492, y: 470, w: 360, h: 66, dot: '#dc2626', title: 'Redis',       meta: 'streams · cache · rate-limit',  port: ':6379' },
  { id: 'jaeger',    x: 170, y: 590, w: 560, h: 58, dot: '#0891b2', title: 'Jaeger',      meta: 'distributed traces · OpenTelemetry auto-instrumentation', port: ':16686' },
];

// Solid structural edges (client → gateway → services → mongo)
const STATIC_EDGES = [
  'M450,76 L450,150',                              // client → gateway
  'M450,224 C450,275 126,270 126,320',             // gateway → auth
  'M450,224 C450,275 342,278 342,320',             // gateway → org
  'M450,224 C450,275 558,278 558,320',             // gateway → entry
  'M450,224 C450,275 774,270 774,320',             // gateway → analytics
  'M126,406 C126,448 228,442 228,470',             // auth → mongo
  'M342,406 C342,452 228,448 228,470',             // org → mongo
  'M558,406 C558,455 228,452 228,470',             // entry → mongo
  'M774,406 C774,458 228,455 228,470',             // analytics → mongo
];

// Animated async pipeline (the event-driven story)
const FLOW_EDGES = [
  { d: 'M558,406 C575,448 672,442 672,470', label: 'publish entry.created', lx: 624, ly: 436 }, // entry → redis
  { d: 'M672,470 C715,448 774,448 774,406', label: 'consume',               lx: 742, ly: 436 }, // redis → analytics
];

// OpenTelemetry trace export (cluster → Jaeger), dotted
const TRACE_EDGES = ['M300,540 L300,590', 'M450,540 L450,590', 'M600,540 L600,590'];

export default function SystemDiagram() {
  return (
    <div className="sd-wrap">
      <style dangerouslySetInnerHTML={{ __html: `
        .sd-wrap { width: 100%; overflow-x: auto; }
        .sd-svg { width: 100%; min-width: 680px; height: auto; display: block; font-family: ui-monospace, 'DM Mono', monospace; }

        .sd-node rect { transition: filter 200ms, stroke 200ms; }
        .sd-node:hover rect.sd-box { filter: drop-shadow(0 3px 7px rgba(24,24,27,0.13)); }

        .sd-flow {
          stroke-dasharray: 5 7;
          animation: sd-dash 1.1s linear infinite;
        }
        @keyframes sd-dash { to { stroke-dashoffset: -24; } }

        @media (prefers-reduced-motion: reduce) {
          .sd-flow { animation: none; }
        }
      ` }} />

      <svg className="sd-svg" viewBox="0 0 900 680" role="img"
        aria-label="Architecture: the browser client calls an API gateway that fans out to four microservices, each with its own MongoDB database. An async Redis event pipeline runs from the Entry service to the Analytics service. All services run in a Kubernetes namespace and export OpenTelemetry traces to Jaeger.">

        {/* ── Kubernetes namespace boundary (services + data run in the cluster) ── */}
        <rect x="16" y="120" width="868" height="420" rx="18"
          fill="#2563EB" fillOpacity="0.03" stroke="#2563EB" strokeOpacity="0.35"
          strokeWidth="1.25" strokeDasharray="7 6" />
        <rect x="28" y="107" width="290" height="20" rx="5" fill="#FFFFFF" />
        <text x="40" y="121" fill="#1D4ED8" fontSize="10.5"
          style={{ letterSpacing: '0.04em' }}>KUBERNETES · namespace: think-twice</text>

        {/* ── Solid structural connectors ── */}
        <g fill="none" stroke="#cfc8b8" strokeWidth="1.25">
          {STATIC_EDGES.map((d, i) => <path key={i} d={d} />)}
        </g>

        {/* ── OpenTelemetry trace export (dotted) ── */}
        <g fill="none" stroke="#0891b2" strokeOpacity="0.6" strokeWidth="1.4" strokeDasharray="1.5 4" strokeLinecap="round">
          {TRACE_EDGES.map((d, i) => <path key={i} d={d} />)}
        </g>
        <text x="640" y="568" fill="#0e7490" fontSize="9.5" textAnchor="middle">OpenTelemetry traces</text>

        {/* ── Animated async pipeline ── */}
        <g fill="none" stroke="#d97706" strokeOpacity="0.85" strokeWidth="1.7">
          {FLOW_EDGES.map((e, i) => <path key={i} className="sd-flow" d={e.d} />)}
        </g>
        {FLOW_EDGES.map((e, i) => (
          <text key={`l${i}`} x={e.lx} y={e.ly} fill="#b45309"
            fontSize="9.5" textAnchor="middle">{e.label}</text>
        ))}

        {/* ── Nodes ── */}
        {NODES.map((n) => {
          const cx = n.x + n.w / 2;
          const small = n.h <= 60;
          const focus = n.big; // gateway is the focal node
          return (
            <g key={n.id} className="sd-node">
              <rect className="sd-box" x={n.x} y={n.y} width={n.w} height={n.h} rx={focus ? 14 : 12}
                fill="#FFFFFF" stroke={focus ? '#2563EB' : '#E0DBCF'}
                strokeOpacity={focus ? 0.6 : 1} strokeWidth={focus ? 1.7 : 1.2} />
              <circle cx={n.x + 14} cy={n.y + 16} r="2.5" fill={n.dot} />
              <text x={cx} y={n.y + (small ? 26 : 32)} textAnchor="middle"
                fill={focus ? '#1D4ED8' : '#18181B'} fontSize={focus ? 14 : 12.5} fontWeight="600"
                style={{ letterSpacing: '0.02em' }}>
                {n.title}
                {n.port && <tspan fill="#a1a1aa" fontSize="9.5" fontWeight="400"> {n.port}</tspan>}
              </text>
              <text x={cx} y={n.y + (small ? 42 : 54)} textAnchor="middle"
                fill="#71717a" fontSize="9.5">{n.meta}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-[10px] font-mono text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-px bg-[#cfc8b8]" /> request path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-px" style={{ background: 'repeating-linear-gradient(90deg,#d97706 0 3px,transparent 3px 6px)' }} />
          async event stream
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-px" style={{ background: 'repeating-linear-gradient(90deg,#0891b2 0 1.5px,transparent 1.5px 4px)' }} />
          OpenTelemetry traces
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-px border-t border-dashed" style={{ borderColor: 'rgba(37,99,235,0.45)' }} />
          Kubernetes namespace
        </span>
      </div>
    </div>
  );
}
