import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7]">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes flow-line {
          0%   { stroke-dashoffset: 200; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes badge-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
          50%       { box-shadow: 0 0 12px 2px rgba(99,102,241,0.18); }
        }
        .fade-in-up   { animation: fadeInUp 0.55s ease both; }
        .fade-in-up-1 { animation: fadeInUp 0.55s 0.12s ease both; }
        .fade-in-up-2 { animation: fadeInUp 0.55s 0.24s ease both; }
        .fade-in-up-3 { animation: fadeInUp 0.55s 0.38s ease both; }
        .fade-in-up-4 { animation: fadeInUp 0.55s 0.52s ease both; }

        .pulse-ring::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1px solid rgba(239,68,68,0.5);
          animation: pulse-ring 1.6s ease-out infinite;
        }

        .card-hover {
          transition: border-color 220ms, box-shadow 220ms, transform 180ms;
        }
        .card-hover:hover {
          border-color: #2a2a3e;
          box-shadow: 0 10px 40px rgba(99,102,241,0.07);
          transform: translateY(-2px);
        }

        .stat-num {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
        }

        .connector-h {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, #2a2a4a, transparent);
          min-width: 20px;
        }
        .connector-v {
          width: 1px;
          height: 24px;
          background: linear-gradient(180deg, transparent, #2a2a4a, transparent);
          margin: 0 auto;
        }

        .arch-node {
          transition: border-color 200ms, background 200ms, box-shadow 200ms;
        }
        .arch-node:hover {
          box-shadow: 0 0 20px rgba(99,102,241,0.1);
        }

        .tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-family: ui-monospace, monospace;
          font-weight: 500;
          border: 1px solid;
          letter-spacing: 0.01em;
        }

        .flow-step {
          transition: border-color 200ms, box-shadow 200ms;
        }
        .flow-step:hover {
          box-shadow: 0 4px 20px rgba(99,102,241,0.08);
        }

        @media (max-width: 768px) {
          .flow-row { flex-direction: column; align-items: stretch; }
          .flow-arr  { transform: rotate(90deg); }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/85 backdrop-blur-md border-b border-[#1e1e2e] px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold text-xl select-none tracking-tight">
            Think Twice
          </span>
          {/* centre: quick proof points */}
          <div className="hidden md:flex items-center gap-5 text-xs text-zinc-600 font-mono">
            <span>5 microservices</span>
            <span className="text-zinc-800">·</span>
            <span>Event-driven</span>
            <span className="text-zinc-800">·</span>
            <span>Dockerized</span>
            <span className="text-zinc-800">·</span>
            <span>CI/CD</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              Login
            </Link>
            <Link href="/register" className="text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg px-4 py-1.5 font-medium">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative px-6 pt-24 pb-20 overflow-hidden">
        {/* Radial glow */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/4 w-[700px] h-[500px]"
          style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 65%)', filter: 'blur(30px)' }} />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="fade-in-up inline-flex items-center gap-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-full px-4 py-1.5 text-xs font-mono mb-8" style={{ animation: 'badge-glow 3s ease-in-out infinite' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Production-Grade Distributed System
          </div>

          {/* Headline */}
          <h1 className="fade-in-up-1 text-5xl md:text-[3.8rem] font-bold tracking-tight text-white leading-[1.08] mb-5">
            Stop losing your team's decisions<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">in Slack and forgotten docs.</span>
          </h1>

          {/* Sub */}
          <p className="fade-in-up-2 text-[1.05rem] text-zinc-400 max-w-2xl mx-auto mt-5 mb-4 leading-relaxed">
            Think Twice is a structured knowledge base for engineering teams.<br className="hidden sm:block" />
            Log architecture decisions, document incidents, and capture what your team learns — so the next hire doesn't repeat the same mistakes.
          </p>
          <p className="fade-in-up-2 text-sm text-zinc-600 max-w-xl mx-auto mb-1">
            Under the hood: 5 decoupled microservices &bull; circuit breakers &bull; event-driven analytics &bull; distributed rate limiting &bull; Docker &bull; CI/CD
          </p>

          {/* CTA row */}
          <div className="fade-in-up-3 flex flex-col sm:flex-row items-center justify-center gap-3 mt-10 mb-5">
            <Link href="/register" className="w-full sm:w-auto text-center text-white bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg px-7 py-3 font-semibold text-sm">
              Start Building &rarr;
            </Link>
            <a href="#patterns" className="w-full sm:w-auto text-center text-zinc-400 hover:text-zinc-200 transition-colors border border-[#1e1e2e] hover:border-[#2e2e4a] rounded-lg px-7 py-3 text-sm">
              See the Engineering &darr;
            </a>
            <a href="https://github.com/Himanshu25Sahu/Think-Twice-Microservice" target="_blank" rel="noopener noreferrer"
              className="w-full sm:w-auto text-center text-zinc-500 hover:text-zinc-300 transition-colors border border-[#1e1e2e] hover:border-[#2e2e4a] rounded-lg px-7 py-3 text-sm flex items-center justify-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              View Source
            </a>
          </div>
          <p className="fade-in-up-4 text-zinc-700 text-xs">No credit card required &bull; Free to use</p>
        </div>

        {/* ── STAT BAR ── */}
        <div className="relative max-w-4xl mx-auto mt-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1e1e2e] rounded-2xl overflow-hidden border border-[#1e1e2e]">
            {[
              { num: '5',    label: 'Microservices',        sub: 'Independently deployable'    },
              { num: '3',    label: 'Reliability Patterns', sub: 'Circuit breaker · Idempotency · Rate limit' },
              { num: '6',    label: 'Entry Types',            sub: 'Decisions · Incidents · Features · Best Practices · Debug · Architecture' },
              { num: '4',    label: 'User Roles',               sub: 'Owner · Admin · Member · Viewer' },
            ].map((s) => (
              <div key={s.label} className="bg-[#0a0a0f] px-6 py-5 text-center">
                <div className="stat-num text-2xl font-bold text-white mb-1">{s.num}</div>
                <div className="text-xs font-semibold text-zinc-300 mb-0.5">{s.label}</div>
                <div className="text-[10px] text-zinc-600 font-mono leading-tight">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT IT DOES ── */}
      <section className="px-6 py-20 border-t border-[#1e1e2e]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600 text-center mb-3 font-mono">The Product</p>
          <h2 className="text-3xl font-bold text-white text-center mb-4">A smarter way to document what your team knows</h2>
          <p className="text-zinc-500 text-center mb-14 max-w-lg mx-auto text-sm leading-relaxed">
            Every team makes hundreds of decisions. Most of them are never written down.
            Think Twice changes that.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                color: 'bg-indigo-500/10',
                title: 'Log it while it\'s fresh',
                desc: 'Write down what you decided and why in under 2 minutes. Six structured entry types guide you — from architecture calls to incident post-mortems.',
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
                color: 'bg-green-500/10',
                title: 'Find it when you need it',
                desc: 'Full-text search across your entire organization. Filter by decision type, tag, or author. Get the answer in seconds, not hours.',
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
                color: 'bg-amber-500/10',
                title: 'Understand your history',
                desc: 'See how decisions connect to each other. Visualize the chain that led to where you are today. Stop repeating mistakes you already made.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 card-hover">
                <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center mb-4`}>
                  {item.icon}
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE DIAGRAM ── */}
      <section id="architecture" className="px-6 py-24 border-t border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600 text-center mb-3 font-mono">System Design</p>
          <h2 className="text-3xl font-bold text-white text-center mb-3">How the System is Built</h2>
          <p className="text-zinc-500 text-center mb-14 max-w-lg mx-auto text-sm leading-relaxed">
            Every service owns its database, exposes its own API, and fails independently.
            No shared state. No single point of failure.
          </p>

          {/* Diagram */}
          <div className="bg-[#0d0d16] border border-[#1e1e2e] rounded-2xl p-8 overflow-x-auto">

            {/* Row 1: Client */}
            <div className="flex justify-center mb-2">
              <div className="arch-node border border-indigo-500/25 bg-indigo-500/5 rounded-xl px-8 py-3 text-center">
                <div className="text-xs font-mono text-indigo-400 uppercase tracking-wider">Client</div>
                <div className="text-[11px] text-zinc-600 mt-0.5">Next.js 14 · Redux</div>
              </div>
            </div>

            {/* Connector */}
            <div className="connector-v mb-0" />
            <div className="flex justify-center mb-0">
              <div className="text-[10px] font-mono text-zinc-700 bg-[#0d0d16] px-2 relative z-10 -mt-2 -mb-2">HTTPS</div>
            </div>
            <div className="connector-v mb-2" />

            {/* Row 2: Gateway */}
            <div className="flex justify-center mb-2">
              <div className="arch-node border-2 border-indigo-500/40 bg-indigo-500/5 rounded-xl px-10 py-4 text-center min-w-[260px]">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                  <div className="text-sm font-semibold text-indigo-300">API Gateway</div>
                  <div className="text-[10px] font-mono text-zinc-700 bg-indigo-900/20 px-1.5 py-0.5 rounded">:3000</div>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {['Rate Limit', 'Auth Proxy', 'Trace ID', 'Retry'].map(t => (
                    <span key={t} className="text-[10px] font-mono text-indigo-500 border border-indigo-500/15 bg-indigo-500/5 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Fan-out connectors */}
            <div className="flex justify-center mb-2">
              <div className="relative w-full max-w-[640px] h-8">
                <svg width="100%" height="32" viewBox="0 0 640 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="none">
                  <line x1="320" y1="0" x2="80"  y2="32" stroke="#2a2a4a" strokeWidth="1" strokeDasharray="4 3"/>
                  <line x1="320" y1="0" x2="213" y2="32" stroke="#2a2a4a" strokeWidth="1" strokeDasharray="4 3"/>
                  <line x1="320" y1="0" x2="427" y2="32" stroke="#2a2a4a" strokeWidth="1" strokeDasharray="4 3"/>
                  <line x1="320" y1="0" x2="560" y2="32" stroke="#2a2a4a" strokeWidth="1" strokeDasharray="4 3"/>
                </svg>
              </div>
            </div>

            {/* Row 3: Services */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { name: 'Auth Service',      port: ':4001', tags: ['JWT', 'Sessions', 'Bcrypt'],           border: 'border-green-500/30',  bg: 'bg-green-500/5',  text: 'text-green-400',  dot: 'bg-green-400' },
                { name: 'Org Service',       port: ':4002', tags: ['RBAC', 'Tenants', 'Invites'],          border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   text: 'text-blue-400',   dot: 'bg-blue-400'  },
                { name: 'Entry Service',     port: ':4003', tags: ['Circuit Breaker', 'Idempotency', 'Cloudinary'],  border: 'border-purple-500/30', bg: 'bg-purple-500/5', text: 'text-purple-400', dot: 'bg-purple-400'},
                { name: 'Analytics Service', port: ':4004', tags: ['Consumer', 'Aggregation', 'Metrics'],  border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  text: 'text-amber-400',  dot: 'bg-amber-400' },
              ].map((svc) => (
                <div key={svc.name} className={`arch-node border ${svc.border} ${svc.bg} rounded-xl p-3.5 text-center`}>
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${svc.dot}`}></div>
                    <div className={`text-xs font-semibold ${svc.text} leading-tight`}>{svc.name}</div>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-700 mb-2">{svc.port}</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {svc.tags.map(t => (
                      <span key={t} className="text-[9px] font-mono text-zinc-600 border border-zinc-800 px-1 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 4: Data layer */}
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
              <div className="border border-red-500/20 bg-red-500/4 rounded-xl px-6 py-3.5 flex-1 text-center">
                <div className="text-xs font-mono text-red-400 uppercase tracking-wider mb-1">Redis</div>
                <div className="flex flex-wrap justify-center gap-1">
                  {['Streams', 'Sliding-Window Rate Limit', 'Idempotency Cache'].map(t => (
                    <span key={t} className="text-[10px] font-mono text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
              <div className="border border-zinc-700/30 bg-zinc-900/30 rounded-xl px-6 py-3.5 flex-1 text-center">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">MongoDB</div>
                <div className="text-[10px] text-zinc-600">Separate database per service &bull; Replica-ready</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section className="px-6 py-14 border-t border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600 text-center mb-8 font-mono">Stack</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {[
              { label: 'Node.js',             color: '#4ade80' },
              { label: 'Express',             color: '#71717a' },
              { label: 'MongoDB',             color: '#4ade80' },
              { label: 'Redis Streams',       color: '#f87171' },
              { label: 'Next.js 14',          color: '#e4e4e7' },
              { label: 'Docker',              color: '#60a5fa' },
              { label: 'GitHub Actions',      color: '#a78bfa' },
              { label: 'JWT',                 color: '#fbbf24' },
              { label: 'Cloudinary',          color: '#60a5fa' },
              { label: 'Tailwind CSS',        color: '#22d3ee' },
              { label: 'Redux Toolkit',       color: '#a78bfa' },
            ].map((t) => (
              <span key={t.label} className="bg-[#12121a] border border-[#1e1e2e] rounded-lg px-3.5 py-1.5 text-xs font-mono text-zinc-400 flex items-center gap-2 hover:border-[#2a2a3e] transition-colors">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} aria-hidden="true"></span>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── RELIABILITY PATTERNS ── */}
      <section id="patterns" className="px-6 py-24 border-t border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600 text-center mb-3 font-mono">Production Patterns</p>
          <h2 className="text-3xl font-bold text-white text-center mb-3">Enterprise Reliability Patterns</h2>
          <p className="text-zinc-500 text-center mb-4 max-w-xl mx-auto text-sm leading-relaxed">
            These are not academic concepts. They are implemented, tested, and handle real failure scenarios.
          </p>
          <p className="text-center mb-14">
            <a href="https://github.com/Himanshu25Sahu/Think-Twice-Microservice" target="_blank" rel="noopener noreferrer"
               className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 rounded-full">
              Read the source code &rarr;
            </a>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Circuit Breaker */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 card-hover flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
                    <circle cx="6" cy="11" r="2" fill="#818cf820"/>
                    <circle cx="18" cy="7" r="2" fill="#818cf820"/>
                  </svg>
                </div>
                <span className="tag-pill text-indigo-400 border-indigo-500/20 bg-indigo-500/5 font-mono">3-state</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-700 mb-1.5">THE PROBLEM</div>
              <p className="text-xs text-zinc-600 mb-4 leading-relaxed">When Org Service is down, Entry Service should not hammer it with retries and cascade the failure.</p>
              <h3 className="text-base font-semibold text-white mb-2">Circuit Breaker</h3>
              <p className="text-sm text-zinc-400 leading-relaxed flex-1">
                Closed &rarr; Open &rarr; Half-Open state machine. After 5 failures, the circuit opens and returns cached org data instantly. Resets after 30 seconds. Zero additional latency when healthy.
              </p>
              <div className="mt-5 pt-4 border-t border-[#1e1e2e] flex items-center justify-between">
                <span className="text-xs text-indigo-400 font-mono">entry-service/utils/circuitBreaker.js</span>
              </div>
            </div>

            {/* Idempotency Keys */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 card-hover flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                </div>
                <span className="tag-pill text-green-400 border-green-500/20 bg-green-500/5 font-mono">24h TTL</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-700 mb-1.5">THE PROBLEM</div>
              <p className="text-xs text-zinc-600 mb-4 leading-relaxed">Network timeouts cause clients to retry. Without idempotency, one button click creates three duplicate entries.</p>
              <h3 className="text-base font-semibold text-white mb-2">Idempotency Keys</h3>
              <p className="text-sm text-zinc-400 leading-relaxed flex-1">
                Client sends a unique <code className="text-green-400 bg-green-500/10 px-1 rounded text-xs">X-Idempotency-Key</code> header. Response is cached in Redis for 24 hours. Retried requests return the exact same response — no duplicate writes. The same pattern used by Stripe.
              </p>
              <div className="mt-5 pt-4 border-t border-[#1e1e2e]">
                <span className="text-xs text-green-400 font-mono">entry-service/middleware/idempotency.js</span>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 card-hover flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <span className="tag-pill text-amber-400 border-amber-500/20 bg-amber-500/5 font-mono">distributed</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-700 mb-1.5">THE PROBLEM</div>
              <p className="text-xs text-zinc-600 mb-4 leading-relaxed">In-memory rate limiting breaks the moment you scale to 2 gateway instances — each has its own counter.</p>
              <h3 className="text-base font-semibold text-white mb-2">Sliding Window Rate Limit</h3>
              <p className="text-sm text-zinc-400 leading-relaxed flex-1">
                Redis sorted sets store request timestamps per IP. Window slides accurately — no fixed-window burst exploits. Falls back to in-memory if Redis is unreachable. Works identically across any number of gateway replicas.
              </p>
              <div className="mt-5 pt-4 border-t border-[#1e1e2e]">
                <span className="text-xs text-amber-400 font-mono">gateway/middleware/rateLimiter.js</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="px-6 py-24 border-t border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600 text-center mb-3 font-mono">Capabilities</p>
          <h2 className="text-3xl font-bold text-white text-center mb-14">Built for Engineering Teams</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
                color: 'bg-indigo-500/10',
                title: 'Structured Logging',
                desc: 'What · Why · Do\'s & Don\'ts per entry. Enforced schema keeps documentation useful months later.',
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                color: 'bg-blue-500/10',
                title: 'Multi-Tenant Orgs',
                desc: 'Full org isolation. Invite members, switch organizations, every resource scoped to org + project.',
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                color: 'bg-purple-500/10',
                title: 'RBAC Authorization',
                desc: 'Owner · Admin · Member · Viewer — enforced at the gateway and service level with middleware guards.',
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                color: 'bg-amber-500/10',
                title: 'Event-Driven Analytics',
                desc: 'Redis Streams consumer group aggregates entry metrics asynchronously. Dashboard shows live counts without blocking writes.',
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
                color: 'bg-green-500/10',
                title: 'Decision Graph',
                desc: 'Interactive graph visualization of entry relationships. Understand how one architecture decision led to another.',
              },
              {
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
                color: 'bg-red-500/10',
                title: 'Image Attachments',
                desc: 'Upload architecture diagrams per entry. Cloudinary delivery + carousel UI. Multiple images, one entry.',
              },
            ].map((feat) => (
              <div key={feat.title} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 card-hover">
                <div className={`w-8 h-8 rounded-lg ${feat.color} flex items-center justify-center mb-3`}>
                  {feat.icon}
                </div>
                <h3 className="font-semibold text-white text-sm mb-1.5">{feat.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVENT FLOW ── */}
      <section className="px-6 py-24 border-t border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-600 text-center mb-3 font-mono">Async Pipeline</p>
          <h2 className="text-3xl font-bold text-white text-center mb-3">Why This Architecture Matters</h2>
          <p className="text-zinc-500 text-center mb-3 max-w-lg mx-auto text-sm leading-relaxed">
            Most portfolio apps couple every operation synchronously — that does not scale.
          </p>
          <p className="text-zinc-600 text-center mb-14 text-xs font-mono">
            Here is what happens when a user creates an entry:
          </p>

          {/* Flow */}
          <div className="flow-row flex flex-col md:flex-row items-center justify-center gap-2 mb-10">
            {[
              { num: '01', title: 'POST /entries',            detail: 'Request hits gateway,\nauthenticated + rate-checked', border: 'border-indigo-500/35', text: 'text-indigo-300', bg: 'bg-indigo-500/5',  isStream: false },
              { num: '02', title: 'Saved to MongoDB',         detail: 'Entry persisted.\nUser gets 201 response instantly.', border: 'border-blue-500/35',   text: 'text-blue-300',   bg: 'bg-blue-500/5',    isStream: false },
              { num: '03', title: 'event → Redis Stream',     detail: 'entry.created published\nto analytics-stream key',    border: 'border-red-500/35',    text: 'text-red-300',    bg: 'bg-red-500/5',     isStream: true  },
              { num: '04', title: 'Consumer ACKs event',      detail: 'Consumer group reads,\nprocesses once, ACKs msg',     border: 'border-amber-500/35',  text: 'text-amber-300',  bg: 'bg-amber-500/5',   isStream: false },
              { num: '05', title: 'Metrics updated',          detail: 'Analytics DB updated.\nUser dashboard refreshes.',    border: 'border-green-500/35',  text: 'text-green-300',  bg: 'bg-green-500/5',   isStream: false },
            ].map((s, i, arr) => (
              <div key={s.num} className="contents">
                <div className={`flow-step border ${s.border} ${s.bg} rounded-xl px-4 py-4 text-center w-full md:w-auto md:min-w-[148px] flex-shrink-0 relative`}>
                  {s.isStream && (
                    <span className="pulse-ring absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 inline-block" aria-hidden="true" />
                  )}
                  <div className="text-[10px] font-mono text-zinc-700 mb-1">{s.num}</div>
                  <div className={`text-xs font-semibold ${s.text} mb-1.5 leading-snug`}>{s.title}</div>
                  <div className="text-[10px] text-zinc-700 font-mono whitespace-pre-line leading-relaxed">{s.detail}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="flow-arr flex-shrink-0 text-zinc-700 text-base font-mono">&rarr;</div>
                )}
              </div>
            ))}
          </div>

          {/* Callout */}
          <div className="bg-[#0d0d16] border border-[#1e1e2e] rounded-xl p-5 max-w-2xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-1">User is never blocked by analytics</div>
                <div className="text-xs text-zinc-500 leading-relaxed">
                  Step 2 returns the response. Steps 3–5 happen in a separate process. If the analytics service is down, users keep creating entries — events accumulate in Redis and are replayed when the consumer recovers. This is how production systems decouple writes from side effects.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 border-t border-[#1e1e2e]" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0e0e1a 100%)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">See the full picture.</h2>
          <p className="text-zinc-400 mb-3 leading-relaxed">
            Think Twice is open-source. Every pattern described on this page is readable, testable code.
          </p>
          <p className="text-zinc-600 text-sm mb-10">
            Clone it, run it locally with Docker Compose, and step through the circuit breaker yourself.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/Himanshu25Sahu/Think-Twice-Microservice"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg px-7 py-3 font-semibold text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Read the Source Code
            </a>
            <Link
              href="/register"
              className="w-full sm:w-auto text-center text-zinc-400 hover:text-zinc-200 transition-colors border border-[#1e1e2e] hover:border-[#2a2a3e] rounded-lg px-7 py-3 text-sm"
            >
              Try the App &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#1e1e2e] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 text-zinc-600 text-xs font-mono">
          <span>Built by Himanshu Sahu</span>
          <span className="hidden sm:inline text-zinc-800">&bull;</span>
          <a href="https://github.com/Himanshu25Sahu" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
          <span className="hidden sm:inline text-zinc-800">&bull;</span>
          <a href="https://www.linkedin.com/in/himanshu25sahu" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">LinkedIn</a>
          <span className="hidden sm:inline text-zinc-800">&bull;</span>
          <a href="https://himanshu-sahu.dev" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">Portfolio</a>
        </div>
      </footer>
    </div>
  );
}
