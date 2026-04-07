'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEntries, setFilters, resetCache } from '@/redux/slices/entrySlice';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';

const TYPE_META = {
  architecture:    { icon: '⬡', color: '#818cf8' },
  debugging:       { icon: '⚡', color: '#f472b6' },
  feature:         { icon: '◈',  color: '#34d399' },
  'best-practice': { icon: '◎', color: '#fbbf24' },
  incident:        { icon: '⚠',  color: '#f87171' },
};

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { entries, loading, page, totalPages, hasMore, total, filters } = useSelector((state) => state.entries);
  const { activeOrg } = useSelector((state) => state.orgs);
  const { activeProject } = useSelector((state) => state.projects);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const endOfListRef = useRef(null);
  
  // Debounce search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch entries when org/project changes or filters change
  useEffect(() => {
    if (activeOrg && activeProject) {
      dispatch(resetCache());
      dispatch(fetchEntries({
        orgId: activeOrg,
        projectId: activeProject,
        type: filters.type !== 'all' ? filters.type : undefined,
        query: debouncedQuery || undefined,
        tag: filters.tag || undefined,
        page: 1,
        limit: 12,
      }));
    }
  }, [activeOrg, activeProject, filters.type, debouncedQuery, filters.tag, dispatch]);

  // Infinite scroll: fetch next page when user scrolls to bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && page < totalPages) {
          dispatch(fetchEntries({
            orgId: activeOrg,
            projectId: activeProject,
            type: filters.type !== 'all' ? filters.type : undefined,
            query: debouncedQuery || undefined,
            tag: filters.tag || undefined,
            page: page + 1,
            limit: 12,
          }));
        }
      },
      { threshold: 0.1 }
    );

    if (endOfListRef.current) {
      observer.observe(endOfListRef.current);
    }

    return () => {
      if (endOfListRef.current) {
        observer.unobserve(endOfListRef.current);
      }
    };
  }, [dispatch, activeOrg, activeProject, page, totalPages, hasMore, loading, filters, debouncedQuery]);

  const handleFilterChange = (type) => {
    dispatch(setFilters({ type, query: '', tag: '' }));
  };

  const types = ['all', 'architecture', 'debugging', 'feature', 'best-practice', 'incident'];

  // Client-side filtering for search within current entries (local preview)
  const filteredEntries = entries.filter((entry) =>
    entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.what?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .db-root {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* ── Header ── */
        .db-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1.25rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #1a1a2a;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .db-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 1.5rem;
          font-weight: 600;
          color: #e4e4f0;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .db-subtitle {
          font-size: 0.8125rem;
          color: #666688;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-top: 0.25rem;
        }

        /* Search */
        .db-search-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .db-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #4a4a6a;
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .db-search {
          background: #0a0a14;
          border: 1px solid #1e1e30;
          border-radius: 0.5rem;
          padding: 0.6rem 0.875rem 0.6rem 2.25rem;
          font-size: 0.8125rem;
          color: #d4d4e8;
          outline: none;
          width: 260px;
          transition: border-color 160ms, box-shadow 160ms;
          font-family: 'DM Sans', sans-serif;
        }

        .db-search::placeholder {
          color: #52527a;
        }

        .db-search:focus {
          border-color: #3b3b5c;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
        }

        @media (max-width: 580px) {
          .db-search { width: 100%; }
          .db-search-wrap { width: 100%; }
          .db-header { align-items: flex-start; }
        }

        /* ── Filter pills ── */
        .db-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4375rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #13131f;
          margin-bottom: 1.75rem;
        }

        .db-filter-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          border-radius: 0.4375rem;
          border: 1px solid #1e1e30;
          background: #0a0a14;
          color: #6666888;
          font-size: 0.8rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          cursor: pointer;
          transition: all 150ms;
          white-space: nowrap;
          color: #8888aa;
        }

        .db-filter-btn:hover {
          border-color: #2e2e48;
          color: #aaaacc;
          background: #0f0f1c;
        }

        .db-filter-btn.active {
          background: #0f0f20;
          border-color: #6366f1;
          color: #818cf8;
          box-shadow: 0 0 0 1px rgba(99,102,241,0.1) inset, 0 0 12px rgba(99,102,241,0.05);
        }

        .db-filter-icon {
          font-size: 0.75rem;
          line-height: 1;
        }

        /* ── Grid ── */
        .db-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        @media (max-width: 1024px) {
          .db-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 600px) {
          .db-grid { grid-template-columns: 1fr; }
        }

        /* ── Card ── */
        .db-card-link {
          text-decoration: none;
          display: block;
        }

        .db-card {
          background: #0d0d18;
          border: 1px solid #1a1a2a;
          border-radius: 0.875rem;
          padding: 1.125rem;
          height: 100%;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: border-color 180ms, background 180ms, box-shadow 180ms, transform 120ms;
          position: relative;
          overflow: hidden;
        }

        .db-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 0.875rem;
          opacity: 0;
          transition: opacity 200ms;
          background: radial-gradient(ellipse at top left, rgba(99,102,241,0.04) 0%, transparent 70%);
          pointer-events: none;
        }

        .db-card:hover {
          border-color: #2e2e4a;
          background: #0f0f1e;
          box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(99,102,241,0.06);
          transform: translateY(-1px);
        }

        .db-card:hover::before {
          opacity: 1;
        }

        /* Card top row */
        .db-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.875rem;
        }

        .db-type-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.3125rem;
          padding: 0.25rem 0.5625rem;
          border-radius: 9999px;
          border: 1px solid;
          font-size: 0.6875rem;
          font-family: 'DM Mono', monospace;
          font-weight: 400;
          letter-spacing: 0.02em;
        }

        .db-card-arrow {
          width: 1.625rem;
          height: 1.625rem;
          border-radius: 9999px;
          background: rgba(99,102,241,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 180ms, background 180ms;
          flex-shrink: 0;
        }

        .db-card:hover .db-card-arrow {
          opacity: 1;
        }

        .db-card-arrow svg {
          color: #818cf8;
        }

        /* Card title */
        .db-card-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #d4d4e8;
          line-height: 1.4;
          margin-bottom: 0.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 160ms;
        }

        .db-card:hover .db-card-title {
          color: #a8a8f0;
        }

        /* Card preview */
        .db-card-preview {
          font-size: 0.8125rem;
          color: #6060808;
          line-height: 1.55;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 0.875rem;
          color: #7878a0;
          flex-grow: 1;
          transition: color 160ms;
        }

        .db-card:hover .db-card-preview {
          color: #9090b8;
        }

        /* Tags */
        .db-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3125rem;
          margin-bottom: 0.875rem;
        }

        .db-tag {
          display: inline-flex;
          align-items: center;
          padding: 0.1875rem 0.5rem;
          background: #12122a;
          border: 1px solid #22224a;
          border-radius: 9999px;
          font-size: 0.6875rem;
          color: #7878aa;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          transition: border-color 160ms;
        }

        .db-card:hover .db-tag {
          border-color: rgba(99,102,241,0.25);
        }

        .db-tag-more {
          background: transparent;
          border-color: #1a1a30;
          color: #4a4a6a;
        }

        /* Card footer */
        .db-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.75rem;
          border-top: 1px solid #13131f;
          margin-top: auto;
          transition: border-color 160ms;
        }

        .db-card:hover .db-card-footer {
          border-color: rgba(99,102,241,0.12);
        }

        .db-card-author {
          font-size: 0.75rem;
          color: #8888aa;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        .db-card-date {
          font-size: 0.6875rem;
          color: #4a4a6a;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        /* ── Skeleton ── */
        .db-skeleton {
          background: #0d0d18;
          border: 1px solid #1a1a2a;
          border-radius: 0.875rem;
          height: 180px;
          position: relative;
          overflow: hidden;
        }

        .db-skeleton::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%);
          animation: db-shimmer 1.4s infinite;
        }

        @keyframes db-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* ── Empty state ── */
        .db-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1rem;
          text-align: center;
        }

        .db-empty-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          opacity: 0.6;
        }

        .db-empty-title {
          font-size: 1.0625rem;
          font-weight: 600;
          color: #c4c4e0;
          margin-bottom: 0.375rem;
          font-family: 'DM Sans', sans-serif;
        }

        .db-empty-msg {
          font-size: 0.8125rem;
          color: #6666888;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-bottom: 1.5rem;
          max-width: 320px;
          line-height: 1.6;
          color: #7878a0;
        }

        .db-empty-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5625rem 1.125rem;
          border-radius: 0.5rem;
          background: #6366f1;
          color: white;
          font-size: 0.875rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          text-decoration: none;
          transition: background 140ms, transform 80ms;
        }

        .db-empty-cta:hover {
          background: #7274f3;
        }

        .db-empty-cta:active {
          transform: scale(0.985);
        }

        /* ── Pagination ── */
        .db-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #13131f;
        }

        .db-page-btn {
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid #1e1e30;
          background: transparent;
          color: #8080a8;
          font-size: 0.8125rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
        }

        .db-page-btn:hover:not(:disabled) {
          background: #0f0f1c;
          border-color: #2a2a40;
          color: #c0c0e0;
        }

        .db-page-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .db-page-info {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          font-family: 'DM Mono', monospace;
        }

        .db-page-current {
          color: #c0c0e0;
          font-weight: 400;
        }

        .db-page-sep {
          color: #2e2e45;
        }

        .db-page-total {
          color: #5050708;
          color: #606080;
        }
      `}</style>

      <div className="db-root">

        {/* Header */}
        <div className="db-header">
          <div>
            <h1 className="db-title">Entries</h1>
            <p className="db-subtitle">manage and review your decision entries</p>
          </div>

          <div className="db-search-wrap">
            <span className="db-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search entries…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="db-search"
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="db-filters">
          {types.map((type) => {
            const isActive = filters.type === type;
            const meta = TYPE_META[type];
            const label = type === 'all' ? 'All' : type.replace('-', ' ');
            return (
              <button
                key={type}
                onClick={() => handleFilterChange(type)}
                className={`db-filter-btn ${isActive ? 'active' : ''}`}
                style={isActive && meta ? { '--type-color': meta.color, borderColor: meta.color, color: meta.color } : {}}
              >
                {meta && <span className="db-filter-icon">{meta.icon}</span>}
                {label}
              </button>
            );
          })}
        </div>

        {/* Loading skeletons (first page only) */}
        {loading && page === 1 && (
          <div className="db-grid">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="db-skeleton" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && page === 1 && filteredEntries.length === 0 && (
          <div className="db-empty">
            <div className="db-empty-icon">📚</div>
            <h3 className="db-empty-title">
              {searchQuery ? 'No results found' : 'No entries yet'}
            </h3>
            <p className="db-empty-msg">
              {searchQuery
                ? `Nothing matched "${searchQuery}" — try a different term`
                : filters.type === 'all'
                ? 'Start documenting decisions by creating your first entry.'
                : `No ${filters.type} entries found.`}
            </p>
            {!searchQuery && (
              <Link href="/entries/new" className="db-empty-cta">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Create Entry
              </Link>
            )}
          </div>
        )}

        {/* Entries grid */}
        {!loading && filteredEntries.length > 0 && (
          <>
            <div className="db-grid">
              {filteredEntries.map((entry) => {
                const meta = TYPE_META[entry.type];
                return (
                  <Link key={entry._id} href={`/entries/${entry._id}`} className="db-card-link">
                    <div className="db-card">
                      {/* Top row: badge + arrow */}
                      <div className="db-card-top">
                        <div
                          className="db-type-pill"
                          style={meta ? {
                            color: meta.color,
                            borderColor: `${meta.color}33`,
                            background: `${meta.color}0f`,
                          } : {}}
                        >
                          {meta && <span>{meta.icon}</span>}
                          <span>{entry.type?.replace('-', ' ') || 'entry'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {(entry.images && entry.images.length > 0) && (
                            <div style={{
                              fontSize: '0.6875rem',
                              color: '#9999bb',
                              background: 'rgba(153, 153, 187, 0.1)',
                              border: '1px solid rgba(153, 153, 187, 0.3)',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '9999px',
                              fontFamily: "'DM Mono', monospace",
                            }}>
                              🖼️ {entry.images.length}
                            </div>
                          )}
                          <div className="db-card-arrow">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="db-card-title">{entry.title}</h3>

                      {/* Preview */}
                      {entry.what && (
                        <p className="db-card-preview">{entry.what}</p>
                      )}

                      {/* Tags */}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="db-tags">
                          {entry.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="db-tag">{tag}</span>
                          ))}
                          {entry.tags.length > 2 && (
                            <span className="db-tag db-tag-more">+{entry.tags.length - 2}</span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="db-card-footer">
                        <span className="db-card-author">{entry.authorName || 'unknown'}</span>
                        <span className="db-card-date">{new Date(entry.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination controls */}
            {!loading && entries.length > 0 && (
              <div className="db-pagination">
                <div className="db-page-info">
                  <span className="db-page-current">{entries.length}</span>
                  <span className="db-page-sep">/</span>
                  <span className="db-page-total">{total}</span>
                </div>
                {hasMore ? (
                  <p style={{ fontSize: '0.8125rem', color: '#7878a0', marginLeft: '1rem' }}>
                    Scroll to load more...
                  </p>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: '#5050708', marginLeft: '1rem' }}>
                    No more entries
                  </p>
                )}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={endOfListRef} style={{ height: '20px', marginTop: '2rem' }} />

            {/* Loading indicator for infinite scroll */}
            {loading && page > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '2rem',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#818cf8',
                  animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  animationDelay: '0ms'
                }} />
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#818cf8',
                  animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  animationDelay: '200ms'
                }} />
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#818cf8',
                  animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  animationDelay: '400ms'
                }} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}