'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import {
  askQuestion,
  listConversations,
  getConversation,
  deleteConversation,
  friendlyError,
} from '@/services/aiService';

const TYPE_COLOR = {
  architecture: '#2563EB',
  debugging: '#DB2777',
  feature: '#16A34A',
  'best-practice': '#D97706',
  incident: '#DC2626',
};

const SUGGESTIONS = [
  'How do we handle database migrations safely?',
  'What should I do when a queue keeps backing up?',
  'What is our on-call escalation process?',
  'Where should credentials live?',
];

/** Group conversations the way people remember them, not by raw timestamp. */
function groupByDate(items) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 86_400_000;
  const groups = new Map();

  for (const item of items) {
    const updated = new Date(item.updated_at || item.created_at);
    const diffDays = Math.floor((startOfToday - updated) / dayMs);

    let label;
    if (updated >= startOfToday) label = 'Today';
    else if (diffDays < 1) label = 'Yesterday';
    else if (diffDays < 7) label = 'Previous 7 days';
    else if (diffDays < 30) label = 'Previous 30 days';
    else label = updated.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  return [...groups.entries()];
}

/**
 * Render [1] / [2, 3] citations as links to the entries they refer to.
 * Citations that do not map to a real source stay as plain text rather than
 * becoming dead links.
 */
function renderAnswer(text, sources) {
  const byNumber = new Map((sources || []).map((s) => [s.number, s]));
  const parts = [];
  let lastIndex = 0;

  for (const match of String(text).matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    const resolved = match[1]
      .split(',')
      .map((n) => byNumber.get(parseInt(n.trim(), 10)))
      .filter(Boolean);
    if (!resolved.length) continue;

    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={match.index} className="ck-cite-group">
        {resolved.map((s) => (
          <Link key={s.number} href={`/entries/${s.entry_id}`} className="ck-cite" title={s.title}>
            {s.number}
          </Link>
        ))}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

export default function AskPage() {
  const { activeOrg } = useSelector((state) => state.orgs);

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState(null);
  const [slow, setSlow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const controllerRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const refreshList = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setConversations(await listConversations());
    } catch {
      // The history list is secondary; failing to load it should never block
      // the user from asking a question.
    }
  }, [activeOrg]);

  useEffect(() => { refreshList(); }, [refreshList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const openConversation = async (id) => {
    if (id === activeId) return;
    setSidebarOpen(false);
    setError(null);
    setLoadingThread(true);
    try {
      const conv = await getConversation({ id });
      setActiveId(id);
      setMessages(conv.messages || []);
    } catch (err) {
      setError(friendlyError(err));
      // A conversation that cannot be opened is usually one that no longer
      // exists; drop it from the list rather than leaving a dead row.
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setLoadingThread(false);
    }
  };

  const startNew = () => {
    controllerRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setError(null);
    setQuestion('');
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const removeConversation = async (id, e) => {
    e.stopPropagation();
    const previous = conversations;
    // Optimistic: the row disappears immediately and comes back if the delete
    // fails, which feels better than a spinner on a destructive action.
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) startNew();
    try {
      await deleteConversation({ id });
    } catch {
      setConversations(previous);
    }
  };

  const send = async (text) => {
    const q = (text ?? question).trim();
    if (!q || sending || !activeOrg) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setQuestion('');
    setError(null);
    setSending(true);
    setSlow(false);
    setMessages((prev) => [...prev, { role: 'user', content: q }]);

    // Reassure rather than fail: a cold model can take a while, and silence
    // reads as broken.
    const slowTimer = setTimeout(() => setSlow(true), 8000);

    try {
      const data = await askQuestion({
        question: q,
        conversationId: activeId || undefined,
        limit: 5,
        // Deliberately org-wide rather than scoped to the active project.
        // Team conventions live in whichever project they were written in, so
        // scoping the assistant hides exactly the entries most questions are
        // about. Search stays project-scoped; the assistant does not.
        signal: controller.signal,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          generated: data.generated,
          degraded: data.degraded,
          cached: data.cached,
          took_ms: data.took_ms,
        },
      ]);
      if (!activeId && data.conversation_id) setActiveId(data.conversation_id);
      refreshList();
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setError(friendlyError(err));
      // Put the question back so the user does not have to retype it.
      setMessages((prev) => prev.slice(0, -1));
      setQuestion(q);
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setSending(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const grouped = groupByDate(conversations);
  const isEmpty = messages.length === 0 && !sending && !loadingThread;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

        @keyframes ckPulse { 0%,100% { opacity:.3 } 50% { opacity:1 } }
        @keyframes ckDot { 0%,80%,100% { transform: translateY(0); opacity:.4 } 40% { transform: translateY(-3px); opacity:1 } }

        .ck { font-family:'DM Sans',sans-serif; display:flex; gap:0; height:calc(100vh - 8.5rem); min-height:460px; }

        /* ── history sidebar ── */
        .ck-side {
          width:250px; flex-shrink:0; border-right:1px solid #E7E2D6; padding-right:1rem;
          display:flex; flex-direction:column; gap:.75rem; overflow:hidden;
        }
        .ck-new {
          display:flex; align-items:center; justify-content:center; gap:.4rem;
          background:#2563EB; color:#fff; border:0; border-radius:.5rem;
          padding:.5625rem .75rem; font-size:.8125rem; font-weight:500; cursor:pointer;
          font-family:'DM Sans',sans-serif; transition:background .15s; flex-shrink:0;
        }
        .ck-new:hover { background:#1D4ED8; }

        .ck-list { overflow-y:auto; display:flex; flex-direction:column; gap:1rem; padding-right:2px; }
        .ck-group-label {
          font-family:'DM Mono',monospace; font-size:.625rem; color:#A1A1AA;
          letter-spacing:.07em; text-transform:uppercase; margin-bottom:.375rem; padding-left:.125rem;
        }
        .ck-item {
          display:flex; align-items:center; gap:.5rem; width:100%;
          padding:.5rem .5625rem; border-radius:.4375rem; border:0; background:transparent;
          cursor:pointer; text-align:left; transition:background .13s; color:#52525B;
        }
        .ck-item:hover { background:#F2EEE4; }
        .ck-item.active { background:rgba(37,99,235,.08); color:#2563EB; }
        .ck-item-title {
          flex:1; min-width:0; font-size:.8125rem; line-height:1.35;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .ck-del {
          flex-shrink:0; opacity:0; border:0; background:transparent; cursor:pointer;
          color:#A1A1AA; font-size:1rem; line-height:1; padding:0 2px; transition:color .13s;
        }
        .ck-item:hover .ck-del { opacity:1; }
        .ck-del:hover { color:#DC2626; }

        .ck-empty-hist {
          font-size:.75rem; color:#A1A1AA; font-family:'DM Mono',monospace;
          padding:.5rem .125rem; line-height:1.5;
        }

        /* ── thread ── */
        .ck-main { flex:1; min-width:0; display:flex; flex-direction:column; padding-left:1.5rem; }
        .ck-thread { flex:1; overflow-y:auto; padding-right:.5rem; }

        .ck-msg { margin-bottom:1.5rem; }
        .ck-role {
          font-family:'DM Mono',monospace; font-size:.625rem; color:#A1A1AA;
          letter-spacing:.07em; text-transform:uppercase; margin-bottom:.375rem;
        }
        .ck-user-text {
          background:#F2EEE4; border-radius:.625rem; padding:.6875rem .875rem;
          font-size:.9375rem; color:#27272A; line-height:1.55; display:inline-block; max-width:100%;
        }
        .ck-answer { font-size:.9375rem; line-height:1.72; color:#27272A; white-space:pre-wrap; }

        .ck-cite-group { display:inline-flex; gap:2px; margin:0 1px; }
        .ck-cite {
          display:inline-flex; align-items:center; justify-content:center;
          min-width:17px; height:17px; padding:0 4px; background:rgba(37,99,235,.1);
          color:#2563EB; border-radius:4px; font-size:.6875rem; font-weight:600;
          font-family:'DM Mono',monospace; text-decoration:none; transition:background .15s;
        }
        .ck-cite:hover { background:#2563EB; color:#fff; }

        .ck-meta {
          display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; margin-top:.6875rem;
          font-family:'DM Mono',monospace; font-size:.625rem; color:#A1A1AA;
        }
        .ck-badge { padding:2px 6px; border-radius:4px; background:#F3F4F6; }
        .ck-badge.warn { background:#FFFBEB; color:#B45309; }

        .ck-sources { margin-top:.875rem; display:flex; flex-direction:column; gap:.375rem; }
        .ck-source {
          display:flex; align-items:flex-start; gap:.5rem; background:#fff;
          border:1px solid #E7E2D6; border-radius:.4375rem; padding:.5rem .625rem;
          text-decoration:none; transition:border-color .15s;
        }
        .ck-source:hover { border-color:#2563EB; }
        .ck-source-num {
          flex-shrink:0; width:17px; height:17px; border-radius:4px; background:rgba(37,99,235,.1);
          color:#2563EB; font-family:'DM Mono',monospace; font-size:.625rem; font-weight:600;
          display:flex; align-items:center; justify-content:center; margin-top:1px;
        }
        .ck-source-title { font-size:.8125rem; color:#27272A; line-height:1.4; }
        .ck-source-type { font-family:'DM Mono',monospace; font-size:.625rem; margin-top:1px; display:block; }

        .ck-typing { display:flex; gap:4px; padding:.25rem 0; }
        .ck-typing span {
          width:5px; height:5px; border-radius:50%; background:#A1A1AA;
          animation:ckDot 1.2s infinite;
        }
        .ck-typing span:nth-child(2){ animation-delay:.15s }
        .ck-typing span:nth-child(3){ animation-delay:.3s }
        .ck-slow { font-family:'DM Mono',monospace; font-size:.6875rem; color:#A1A1AA; margin-top:.4rem; }

        .ck-note {
          background:#FFFBEB; border:1px solid #FDE68A; border-radius:.4375rem;
          padding:.5rem .75rem; font-size:.75rem; color:#92400E; margin-bottom:.6875rem;
        }
        .ck-error {
          background:#FEF2F2; border:1px solid #FECACA; border-radius:.5rem;
          padding:.6875rem .875rem; font-size:.8125rem; color:#B91C1C; margin-bottom:.75rem;
        }

        /* ── empty state ── */
        .ck-welcome { display:flex; flex-direction:column; justify-content:center; height:100%; max-width:560px; }
        .ck-welcome-title { font-size:1.375rem; font-weight:600; color:#18181B; letter-spacing:-.02em; }
        .ck-welcome-sub { font-size:.8125rem; color:#71717A; font-family:'DM Mono',monospace; margin-top:.3rem; margin-bottom:1.25rem; }
        .ck-chips { display:flex; flex-direction:column; gap:.4375rem; }
        .ck-chip {
          background:#fff; border:1px solid #E7E2D6; border-radius:.4375rem;
          padding:.5625rem .75rem; font-size:.8125rem; color:#52525B; cursor:pointer;
          font-family:'DM Sans',sans-serif; transition:all .15s; text-align:left;
        }
        .ck-chip:hover { border-color:#2563EB; color:#2563EB; background:rgba(37,99,235,.04); }

        /* ── composer ── */
        .ck-composer { display:flex; gap:.5rem; padding-top:1rem; border-top:1px solid #E7E2D6; margin-top:.5rem; }
        .ck-input {
          flex:1; background:#fff; border:1px solid #E7E2D6; border-radius:.5rem;
          padding:.6875rem .875rem; font-size:.875rem; color:#3F3F46; outline:none;
          font-family:'DM Sans',sans-serif; resize:none; max-height:120px; line-height:1.5;
          transition:border-color .16s, box-shadow .16s;
        }
        .ck-input:focus { border-color:#2563EB; box-shadow:0 0 0 3px rgba(37,99,235,.08); }
        .ck-input::placeholder { color:#A1A1AA; }
        .ck-send {
          background:#2563EB; color:#fff; border:0; border-radius:.5rem; padding:0 1.125rem;
          font-size:.875rem; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif;
          transition:background .15s; flex-shrink:0;
        }
        .ck-send:hover:not(:disabled) { background:#1D4ED8; }
        .ck-send:disabled { background:#D4D4D8; cursor:not-allowed; }

        .ck-hist-toggle { display:none; }

        @media (max-width:860px) {
          .ck { height:calc(100vh - 7.5rem); }
          .ck-side {
            position:fixed; left:0; top:0; bottom:0; z-index:60; width:264px;
            background:#FAF7F0; border-right:1px solid #E7E2D6; padding:1rem;
            transform:translateX(-100%); transition:transform .2s;
          }
          .ck-side.open { transform:translateX(0); box-shadow:0 0 40px rgba(0,0,0,.12); }
          .ck-main { padding-left:0; }
          .ck-hist-toggle {
            display:inline-flex; align-items:center; gap:.375rem; align-self:flex-start;
            background:#fff; border:1px solid #E7E2D6; border-radius:.4375rem;
            padding:.4rem .625rem; font-size:.75rem; color:#52525B; cursor:pointer;
            font-family:'DM Sans',sans-serif; margin-bottom:.75rem;
          }
        }
      `}</style>

      <div className="ck">
        <aside className={`ck-side ${sidebarOpen ? 'open' : ''}`}>
          <button className="ck-new" onClick={startNew} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>

          <div className="ck-list">
            {grouped.length === 0 && (
              <p className="ck-empty-hist">No conversations yet. Ask something to start one.</p>
            )}
            {grouped.map(([label, items]) => (
              <div key={label}>
                <p className="ck-group-label">{label}</p>
                {items.map((c) => (
                  <div
                    key={c.id}
                    className={`ck-item ${c.id === activeId ? 'active' : ''}`}
                    onClick={() => openConversation(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openConversation(c.id)}
                  >
                    <span className="ck-item-title">{c.title}</span>
                    <button
                      className="ck-del"
                      onClick={(e) => removeConversation(c.id, e)}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <main className="ck-main">
          <button
            className="ck-hist-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            type="button"
          >
            ☰ History
          </button>

          <div className="ck-thread">
            {isEmpty && (
              <div className="ck-welcome">
                <h2 className="ck-welcome-title">Ask your team&rsquo;s knowledge</h2>
                <p className="ck-welcome-sub">answers come only from your entries, with sources</p>
                <div className="ck-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="ck-chip" onClick={() => send(s)} type="button">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingThread && <p className="ck-empty-hist">Loading conversation…</p>}

            {messages.map((m, i) => (
              <div className="ck-msg" key={i}>
                <p className="ck-role">{m.role === 'user' ? 'You' : 'Assistant'}</p>

                {m.role === 'user' ? (
                  <div className="ck-user-text">{m.content}</div>
                ) : (
                  <>
                    {m.degraded && (
                      <div className="ck-note">
                        The assistant is temporarily unavailable, so these are the
                        most relevant entries instead of a written answer.
                      </div>
                    )}
                    <div className="ck-answer">{renderAnswer(m.content, m.sources)}</div>

                    {(m.took_ms || m.cached) && (
                      <div className="ck-meta">
                        {m.degraded && <span className="ck-badge warn">retrieval only</span>}
                        {m.cached && <span className="ck-badge">cached</span>}
                        {m.took_ms ? <span>{Math.round(m.took_ms)}ms</span> : null}
                      </div>
                    )}

                    {m.sources?.length > 0 && (
                      <div className="ck-sources">
                        {m.sources.map((s) => (
                          <Link key={s.entry_id} href={`/entries/${s.entry_id}`} className="ck-source">
                            <span className="ck-source-num">{s.number}</span>
                            <span>
                              <span className="ck-source-title">{s.title}</span>
                              <span
                                className="ck-source-type"
                                style={{ color: TYPE_COLOR[s.type] || '#A1A1AA' }}
                              >
                                {s.type?.replace('-', ' ')}
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {sending && (
              <div className="ck-msg">
                <p className="ck-role">Assistant</p>
                <div className="ck-typing"><span /><span /><span /></div>
                {slow && <p className="ck-slow">still working — the model may be waking up</p>}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {error && <div className="ck-error">{error}</div>}

          <form className="ck-composer" onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              className="ck-input"
              rows={1}
              placeholder="Ask anything about your team's decisions…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
            />
            <button className="ck-send" type="submit" disabled={sending || !question.trim()}>
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </main>
      </div>
    </>
  );
}
