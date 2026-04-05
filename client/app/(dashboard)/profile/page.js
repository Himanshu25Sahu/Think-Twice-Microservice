'use client'

import { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchEntries } from '@/redux/slices/entrySlice';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

const TYPE_META = {
  architecture:    { icon: '⬡', color: '#818cf8' },
  debugging:       { icon: '⚡', color: '#f472b6' },
  feature:         { icon: '◈',  color: '#34d399' },
  'best-practice': { icon: '◎', color: '#fbbf24' },
  incident:        { icon: '⚠',  color: '#f87171' },
};

export default function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { orgs, activeOrg } = useSelector((state) => state.orgs);
  const { entries, loading } = useSelector((state) => state.entries);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (activeOrg) {
      dispatch(fetchEntries({ orgId: activeOrg, page: 1, limit: 5 }));
    }
  }, [activeOrg, dispatch]);

  const myEntries = useMemo(() => {
    return entries.filter(e => e.authorId === user._id);
  }, [entries, user._id]);

  const stats = useMemo(() => {
    const totalUpvotes = myEntries.reduce((sum, e) => sum + (e.upvotes?.length || 0), 0);
    const totalDownvotes = myEntries.reduce((sum, e) => sum + (e.downvotes?.length || 0), 0);
    const typeCounts = {};
    myEntries.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
    const favoriteType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    return {
      totalEntries: myEntries.length,
      totalUpvotes,
      totalDownvotes,
      favoriteType: favoriteType ? favoriteType[0].replace('-', ' ') : '-',
    };
  }, [myEntries]);

  // Get user initials for avatar
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  // Active org name
  const activeOrgData = orgs?.find(o => o._id === activeOrg);

  if (loading) return <Skeleton count={5} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        .pf-outer {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0 1rem;
          font-family: 'DM Sans', sans-serif;
        }

        .pf-root {
          max-width: 680px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* ── Card base ── */
        .pf-card {
          background: #0d0d18;
          border: 1px solid #1a1a2a;
          border-radius: 1rem;
          overflow: hidden;
        }

        .pf-card-inner {
          padding: 1.5rem 1.75rem;
        }

        .pf-section-label {
          font-size: 0.6875rem;
          font-weight: 500;
          color: #8888aa;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          margin-bottom: 1rem;
        }

        /* ── Profile card ── */
        .pf-profile-row {
          display: flex;
          align-items: center;
          gap: 1.125rem;
        }

        .pf-avatar {
          width: 3rem;
          height: 3rem;
          border-radius: 9999px;
          background: linear-gradient(135deg, #3b3b7a 0%, #6366f1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 600;
          color: #e0e0ff;
          font-family: 'DM Mono', monospace;
          flex-shrink: 0;
          border: 1px solid rgba(99,102,241,0.25);
        }

        .pf-user-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: #e4e4f0;
          letter-spacing: -0.015em;
          line-height: 1.25;
        }

        .pf-user-email {
          font-size: 0.8rem;
          color: #7070988;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-top: 0.125rem;
          color: #7878a0;
        }

        .pf-org-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 0.375rem;
          padding: 0.1875rem 0.5rem;
          background: #12122a;
          border: 1px solid #22224a;
          border-radius: 9999px;
          font-size: 0.6875rem;
          color: #6060808;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          color: #7070a0;
        }

        .pf-org-dot {
          width: 0.3125rem;
          height: 0.3125rem;
          border-radius: 9999px;
          background: #6366f1;
          opacity: 0.7;
        }

        /* ── Stats grid ── */
        .pf-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          border: 1px solid #1a1a2a;
          border-radius: 0.75rem;
          overflow: hidden;
        }

        @media (max-width: 560px) {
          .pf-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .pf-stat-cell {
          padding: 1.125rem 1rem;
          background: #0a0a14;
          border-right: 1px solid #1a1a2a;
          border-bottom: 1px solid #1a1a2a;
          display: flex;
          flex-direction: column;
          gap: 0.3125rem;
        }

        .pf-stat-cell:nth-child(4n) { border-right: none; }
        .pf-stat-cell:nth-child(4n+1):nth-last-child(-n+4),
        .pf-stat-cell:nth-child(4n+1):nth-last-child(-n+4) ~ .pf-stat-cell {
          border-bottom: none;
        }

        @media (max-width: 560px) {
          .pf-stat-cell:nth-child(2n) { border-right: none; }
          .pf-stat-cell:nth-last-child(-n+2) { border-bottom: none; }
          .pf-stat-cell:nth-child(4n) { border-right: 1px solid #1a1a2a; }
        }

        .pf-stat-label {
          font-size: 0.6875rem;
          color: #6060808;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          letter-spacing: 0.04em;
          color: #7070a0;
        }

        .pf-stat-value {
          font-size: 1.625rem;
          font-weight: 600;
          color: #d4d4f0;
          letter-spacing: -0.02em;
          line-height: 1;
          font-family: 'DM Sans', sans-serif;
        }

        .pf-stat-value.accent { color: #818cf8; }
        .pf-stat-value.green  { color: #34d399; }
        .pf-stat-value.red    { color: #f87171; }

        /* ── Entries list ── */
        .pf-entries-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .pf-entry-link {
          text-decoration: none;
          display: block;
        }

        .pf-entry-row {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 0;
          border-bottom: 1px solid #13131f;
          transition: background 140ms;
          cursor: pointer;
        }

        .pf-entry-row:last-child { border-bottom: none; }

        .pf-entry-link:hover .pf-entry-row {
          background: transparent;
        }

        .pf-entry-link:hover .pf-entry-title {
          color: #a8a8f0;
        }

        .pf-entry-type-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 9999px;
          flex-shrink: 0;
        }

        .pf-entry-body {
          flex: 1;
          min-width: 0;
        }

        .pf-entry-title {
          font-size: 0.9rem;
          font-weight: 500;
          color: #c8c8e8;
          transition: color 140ms;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: 'DM Sans', sans-serif;
        }

        .pf-entry-preview {
          font-size: 0.775rem;
          color: #6060808;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 0.125rem;
          color: #6868908;
          color: #686898;
        }

        .pf-entry-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.1875rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid;
          font-size: 0.625rem;
          font-family: 'DM Mono', monospace;
          font-weight: 400;
          letter-spacing: 0.02em;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .pf-entry-arrow {
          color: #2e2e48;
          flex-shrink: 0;
          transition: color 140ms, transform 140ms;
        }

        .pf-entry-link:hover .pf-entry-arrow {
          color: #6366f1;
          transform: translateX(2px);
        }

        /* ── Empty state ── */
        .pf-empty {
          padding: 1.5rem 0 0.5rem;
          text-align: center;
          font-size: 0.8125rem;
          color: #7878a0;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }
      `}</style>

      <div className="pf-outer">
        <div className="pf-root">

          {/* ── Profile card ── */}
          <div className="pf-card">
            <div className="pf-card-inner">
              <div className="pf-profile-row">
                <div className="pf-avatar">{initials}</div>
                <div>
                  <p className="pf-user-name">{user.name}</p>
                  <p className="pf-user-email">{user.email}</p>
                  {activeOrgData && (
                    <div className="pf-org-badge">
                      <span className="pf-org-dot" />
                      {activeOrgData.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="pf-card">
            <div className="pf-card-inner" style={{ paddingBottom: '1.125rem' }}>
              <p className="pf-section-label">Stats</p>
            </div>
            <div className="pf-stats-grid">
              <div className="pf-stat-cell">
                <span className="pf-stat-label">entries</span>
                <span className="pf-stat-value accent">{stats.totalEntries}</span>
              </div>
              <div className="pf-stat-cell">
                <span className="pf-stat-label">upvotes</span>
                <span className="pf-stat-value green">{stats.totalUpvotes}</span>
              </div>
              <div className="pf-stat-cell">
                <span className="pf-stat-label">downvotes</span>
                <span className="pf-stat-value red">{stats.totalDownvotes}</span>
              </div>
              <div className="pf-stat-cell">
                <span className="pf-stat-label">top type</span>
                <span className="pf-stat-value" style={{ fontSize: '1rem', paddingTop: '0.25rem', color: '#a0a0c8' }}>
                  {stats.favoriteType !== '-' && TYPE_META[stats.favoriteType]
                    ? `${TYPE_META[stats.favoriteType].icon} ${stats.favoriteType}`
                    : stats.favoriteType}
                </span>
              </div>
            </div>
          </div>

          {/* ── Recent entries ── */}
          <div className="pf-card">
            <div className="pf-card-inner">
              <p className="pf-section-label">Recent Entries</p>

              {myEntries.length === 0 ? (
                <p className="pf-empty">no entries yet — create your first one</p>
              ) : (
                <div className="pf-entries-list">
                  {myEntries.map((entry) => {
                    const meta = TYPE_META[entry.type];
                    return (
                      <Link key={entry._id} href={`/entries/${entry._id}`} className="pf-entry-link">
                        <div className="pf-entry-row">
                          {/* Type dot */}
                          {meta && (
                            <span
                              className="pf-entry-type-dot"
                              style={{ background: meta.color, opacity: 0.7 }}
                            />
                          )}

                          {/* Body */}
                          <div className="pf-entry-body">
                            <p className="pf-entry-title">{entry.title}</p>
                            {entry.content && (
                              <p className="pf-entry-preview">{entry.content}</p>
                            )}
                          </div>

                          {/* Vote counts */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.725rem', fontFamily: "'DM Mono', monospace", fontWeight: 300, color: '#34d399' }}>
                              ▲ {entry.upvotes?.length || 0}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.725rem', fontFamily: "'DM Mono', monospace", fontWeight: 300, color: '#f87171' }}>
                              ▼ {entry.downvotes?.length || 0}
                            </span>
                          </div>

                          {/* Type pill */}
                          {meta && (
                            <div
                              className="pf-entry-pill"
                              style={{
                                color: meta.color,
                                borderColor: `${meta.color}33`,
                                background: `${meta.color}0f`,
                              }}
                            >
                              <span>{meta.icon}</span>
                              <span>{entry.type.replace('-', ' ')}</span>
                            </div>
                          )}

                          {/* Arrow */}
                          <span className="pf-entry-arrow">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}