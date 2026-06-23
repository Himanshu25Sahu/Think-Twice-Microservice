'use client'

import { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchEntries, deleteEntry } from '@/redux/slices/entrySlice';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProfileSkeleton } from '@/components/ui/ProfileSkeleton';
import { Badge } from '@/components/ui/Badge';

const TYPE_META = {
  architecture:    { icon: '⬡', color: '#2563EB' },
  debugging:       { icon: '⚡', color: '#DB2777' },
  feature:         { icon: '◈',  color: '#16A34A' },
  'best-practice': { icon: '◎', color: '#D97706' },
  incident:        { icon: '⚠',  color: '#DC2626' },
};

export default function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { orgs, activeOrg } = useSelector((state) => state.orgs);
  const { activeProject } = useSelector((state) => state.projects);
  const { entries, loading } = useSelector((state) => state.entries);
  const [toast, setToast] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (activeOrg && activeProject) {
      dispatch(fetchEntries({ orgId: activeOrg, projectId: activeProject, page: 1, limit: 5 }));
    }
  }, [activeOrg, activeProject, dispatch]);

  const myEntries = useMemo(() => {
    return entries.filter(e => e.authorId === user._id);
  }, [entries, user._id]);

  const mentionedInEntries = useMemo(() => {
    return entries.filter(e => e.mentions && e.mentions.includes(user._id));
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

  const handleDelete = async (entryId) => {
    setDeleting(true);
    try {
      await dispatch(deleteEntry({ id: entryId, orgId: activeOrg, projectId: activeProject })).unwrap();
      setToast({ type: 'success', msg: 'Entry deleted' });
    } catch (err) {
      setToast({ type: 'error', msg: err || 'Failed to delete entry' });
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Active org name
  const activeOrgData = orgs?.find(o => o._id === activeOrg);

  if (loading) return <ProfileSkeleton />;

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
          background: #FFFFFF;
          border: 1px solid #E7E2D6;
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(24,24,27,0.06);
        }

        .pf-card-inner {
          padding: 1.5rem 1.75rem;
        }

        .pf-section-label {
          font-size: 0.6875rem;
          font-weight: 500;
          color: #71717A;
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
          background: #2563EB;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 600;
          color: #FFFFFF;
          font-family: 'DM Mono', monospace;
          flex-shrink: 0;
          border: 1px solid rgba(37,99,235,0.25);
        }

        .pf-user-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: #18181B;
          letter-spacing: -0.015em;
          line-height: 1.25;
        }

        .pf-user-email {
          font-size: 0.8rem;
          color: #71717A;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-top: 0.125rem;
          color: #71717A;
        }

        .pf-org-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 0.375rem;
          padding: 0.1875rem 0.5rem;
          background: rgba(37,99,235,0.08);
          border: 1px solid rgba(37,99,235,0.20);
          border-radius: 9999px;
          font-size: 0.6875rem;
          color: #2563EB;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          color: #2563EB;
        }

        .pf-org-dot {
          width: 0.3125rem;
          height: 0.3125rem;
          border-radius: 9999px;
          background: #2563EB;
          opacity: 0.7;
        }

        /* ── Stats grid ── */
        .pf-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          border: 1px solid #E7E2D6;
          border-radius: 0.75rem;
          overflow: hidden;
        }

        @media (max-width: 560px) {
          .pf-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .pf-stat-cell {
          padding: 1.125rem 1rem;
          background: #FCFBF7;
          border-right: 1px solid #E7E2D6;
          border-bottom: 1px solid #E7E2D6;
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
          .pf-stat-cell:nth-child(4n) { border-right: 1px solid #E7E2D6; }
        }

        .pf-stat-label {
          font-size: 0.6875rem;
          color: #71717A;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          letter-spacing: 0.04em;
          color: #71717A;
        }

        .pf-stat-value {
          font-size: 1.625rem;
          font-weight: 600;
          color: #18181B;
          letter-spacing: -0.02em;
          line-height: 1;
          font-family: 'DM Sans', sans-serif;
        }

        .pf-stat-value.accent { color: #2563EB; }
        .pf-stat-value.green  { color: #16A34A; }
        .pf-stat-value.red    { color: #DC2626; }

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
          border-bottom: 1px solid #E7E2D6;
          transition: background 140ms;
          cursor: pointer;
        }

        .pf-entry-row:last-child { border-bottom: none; }

        .pf-entry-link:hover .pf-entry-row {
          background: transparent;
        }

        .pf-entry-link:hover .pf-entry-title {
          color: #2563EB;
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
          color: #18181B;
          transition: color 140ms;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: 'DM Sans', sans-serif;
        }

        .pf-entry-preview {
          font-size: 0.775rem;
          color: #71717A;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 0.125rem;
          color: #71717A;
          color: #71717A;
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
          color: #A1A1AA;
          flex-shrink: 0;
          transition: color 140ms, transform 140ms;
        }

        .pf-entry-link:hover .pf-entry-arrow {
          color: #2563EB;
          transform: translateX(2px);
        }

        /* ── Empty state ── */
        .pf-empty {
          padding: 1.5rem 0 0.5rem;
          text-align: center;
          font-size: 0.8125rem;
          color: #71717A;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        /* ── Delete button ── */
        .pf-delete-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 0.375rem;
          border: 1px solid transparent;
          background: transparent;
          color: #A1A1AA;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 140ms, color 140ms, border-color 140ms;
        }

        .pf-delete-btn:hover {
          background: #FEF2F2;
          border-color: #FECACA;
          color: #DC2626;
        }

        /* ── Confirm inline ── */
        .pf-confirm-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0;
          border-bottom: 1px solid #E7E2D6;
        }

        .pf-confirm-row:last-child { border-bottom: none; }

        .pf-confirm-text {
          flex: 1;
          font-size: 0.775rem;
          font-family: 'DM Mono', monospace;
          color: #DC2626;
          font-weight: 300;
        }

        .pf-confirm-yes {
          padding: 0.25rem 0.625rem;
          border-radius: 0.375rem;
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: #DC2626;
          font-size: 0.7rem;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: background 140ms;
        }

        .pf-confirm-yes:disabled { opacity: 0.5; cursor: not-allowed; }
        .pf-confirm-yes:not(:disabled):hover { background: #FDE3E3; }

        .pf-confirm-no {
          padding: 0.25rem 0.625rem;
          border-radius: 0.375rem;
          border: 1px solid #E7E2D6;
          background: transparent;
          color: #71717A;
          font-size: 0.7rem;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: background 140ms;
        }

        .pf-confirm-no:hover { background: #F2EEE4; }

        /* ── Toast ── */
        .pf-toast {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          font-family: 'DM Mono', monospace;
          font-weight: 400;
          z-index: 999;
          pointer-events: none;
        }

        .pf-toast.success {
          background: #FFFFFF;
          border: 1px solid rgba(22,163,74,0.35);
          color: #16A34A;
          box-shadow: 0 8px 24px rgba(24,24,27,0.06);
        }

        .pf-toast.error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          box-shadow: 0 8px 24px rgba(24,24,27,0.06);
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
                <span className="pf-stat-value" style={{ fontSize: '1rem', paddingTop: '0.25rem', color: '#3F3F46' }}>
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

                    if (confirmDeleteId === entry._id) {
                      return (
                        <div key={entry._id} className="pf-confirm-row">
                          <span className="pf-confirm-text">delete &quot;{entry.title}&quot;?</span>
                          <button
                            className="pf-confirm-yes"
                            disabled={deleting}
                            onClick={() => handleDelete(entry._id)}
                          >
                            {deleting ? '...' : 'delete'}
                          </button>
                          <button
                            className="pf-confirm-no"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            cancel
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div key={entry._id} className="pf-entry-row" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <Link href={`/entries/${entry._id}`} className="pf-entry-link" style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
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
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.725rem', fontFamily: "'DM Mono', monospace", fontWeight: 300, color: '#16A34A' }}>
                                ▲ {entry.upvotes?.length || 0}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.725rem', fontFamily: "'DM Mono', monospace", fontWeight: 300, color: '#DC2626' }}>
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

                        {/* Delete button */}
                        <button
                          className="pf-delete-btn"
                          title="Delete entry"
                          onClick={() => setConfirmDeleteId(entry._id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Mentioned in entries ── */}
          <div className="pf-card">
            <div className="pf-card-inner">
              <p className="pf-section-label">Mentioned In</p>

              {mentionedInEntries.length === 0 ? (
                <p className="pf-empty">no mentions yet — collaborate with your team</p>
              ) : (
                <div className="pf-entries-list">
                  {mentionedInEntries.map((entry) => {
                    const meta = TYPE_META[entry.type];

                    return (
                      <div key={entry._id} className="pf-entry-row" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <Link href={`/entries/${entry._id}`} className="pf-entry-link" style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
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

                            {/* Author name */}
                            {entry.authorName && (
                              <span style={{ fontSize: '0.725rem', fontFamily: "'DM Mono', monospace", fontWeight: 300, color: '#71717A', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                by {entry.authorName}
                              </span>
                            )}

                            {/* Vote counts */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.725rem', fontFamily: "'DM Mono', monospace", fontWeight: 300, color: '#16A34A' }}>
                                ▲ {entry.upvotes?.length || 0}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.725rem', fontFamily: "'DM Mono', monospace", fontWeight: 300, color: '#DC2626' }}>
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`pf-toast ${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}