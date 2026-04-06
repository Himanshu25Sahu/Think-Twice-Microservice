'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useParams } from 'next/navigation';
import { fetchEntry, updateEntry, deleteEntry, toggleUpvote, toggleDownvote } from '@/redux/slices/entrySlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { ImageCarousel } from '@/components/ui/ImageCarousel';
import { ArrowLeftIcon, TriangleUpIcon, EditIcon, TrashIcon } from '@/components/icons';
import Link from 'next/link';

const TYPE_META = {
  architecture:    { icon: '⬡', color: '#818cf8' },
  debugging:       { icon: '⚡', color: '#f472b6' },
  feature:         { icon: '◈',  color: '#34d399' },
  'best-practice': { icon: '◎', color: '#fbbf24' },
  incident:        { icon: '⚠',  color: '#f87171' },
};

export default function EntryDetailPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const { currentEntry, loading } = useSelector((state) => state.entries);
  const { user } = useSelector((state) => state.auth);
  const { activeOrg } = useSelector((state) => state.orgs);
  const { activeProject } = useSelector((state) => state.projects);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const [editData, setEditData] = useState(null);
  const [optimisticVotes, setOptimisticVotes] = useState({ upvotes: null, downvotes: null, userUpvoted: null, userDownvoted: null });

  useEffect(() => {
    if (id && activeOrg && activeProject) dispatch(fetchEntry({ id, orgId: activeOrg, projectId: activeProject }));
  }, [id, dispatch, activeOrg, activeProject]);

  useEffect(() => {
    if (currentEntry && !editData) {
      setEditData(currentEntry);
      setOptimisticVotes({ upvotes: null, downvotes: null, userUpvoted: null, userDownvoted: null });
    }
  }, [currentEntry, editData]);

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const result = await dispatch(updateEntry({ id, data: { ...editData, orgId: activeOrg, projectId: activeProject } }));
      if (result.meta.requestStatus === 'fulfilled') {
        setToast({ type: 'success', message: 'Entry updated successfully!' });
        setIsEditing(false);
      } else {
        setToast({ type: 'error', message: 'Failed to update entry' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred while updating' });
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        const result = await dispatch(deleteEntry({ id, orgId: activeOrg, projectId: activeProject }));
        if (result.meta.requestStatus === 'fulfilled') {
          setToast({ type: 'success', message: 'Entry deleted!' });
          setTimeout(() => router.push('/dashboard'), 1000);
        }
      } catch (err) {
        setToast({ type: 'error', message: 'Failed to delete entry' });
      }
    }
  };

  const handleUpvote = async () => {
    const wasUpvoted = optimisticVotes.userUpvoted !== null ? optimisticVotes.userUpvoted : currentEntry.upvotes?.includes(user?._id);
    const upvoteCount = optimisticVotes.upvotes !== null ? optimisticVotes.upvotes : (currentEntry.upvotes?.length || 0);
    const downvoteCount = optimisticVotes.downvotes !== null ? optimisticVotes.downvotes : (currentEntry.downvotes?.length || 0);
    if (wasUpvoted) {
      setOptimisticVotes({ upvotes: upvoteCount - 1, downvotes: downvoteCount, userUpvoted: false, userDownvoted: optimisticVotes.userDownvoted !== null ? optimisticVotes.userDownvoted : false });
    } else {
      setOptimisticVotes({ upvotes: upvoteCount + 1, downvotes: downvoteCount, userUpvoted: true, userDownvoted: false });
    }
    const result = await dispatch(toggleUpvote({ id, orgId: activeOrg, projectId: activeProject }));
    if (result.meta.requestStatus !== 'fulfilled') {
      setOptimisticVotes({ upvotes: null, downvotes: null, userUpvoted: null, userDownvoted: null });
      setToast({ type: 'error', message: 'Failed to update vote' });
    }
  };

  const handleDownvote = async () => {
    const wasDownvoted = optimisticVotes.userDownvoted !== null ? optimisticVotes.userDownvoted : currentEntry.downvotes?.includes(user?._id);
    const upvoteCount = optimisticVotes.upvotes !== null ? optimisticVotes.upvotes : (currentEntry.upvotes?.length || 0);
    const downvoteCount = optimisticVotes.downvotes !== null ? optimisticVotes.downvotes : (currentEntry.downvotes?.length || 0);
    if (wasDownvoted) {
      setOptimisticVotes({ upvotes: upvoteCount, downvotes: downvoteCount - 1, userUpvoted: optimisticVotes.userUpvoted !== null ? optimisticVotes.userUpvoted : false, userDownvoted: false });
    } else {
      setOptimisticVotes({ upvotes: upvoteCount, downvotes: downvoteCount + 1, userUpvoted: false, userDownvoted: true });
    }
    const result = await dispatch(toggleDownvote({ id, orgId: activeOrg, projectId: activeProject }));
    if (result.meta.requestStatus !== 'fulfilled') {
      setOptimisticVotes({ upvotes: null, downvotes: null, userUpvoted: null, userDownvoted: null });
      setToast({ type: 'error', message: 'Failed to update vote' });
    }
  };

  const isOwner = user && currentEntry && user._id === currentEntry.authorId;
  const userUpvoted = optimisticVotes.userUpvoted !== null ? optimisticVotes.userUpvoted : currentEntry?.upvotes?.includes(user?._id);
  const userDownvoted = optimisticVotes.userDownvoted !== null ? optimisticVotes.userDownvoted : currentEntry?.downvotes?.includes(user?._id);
  const upvoteCount = optimisticVotes.upvotes !== null ? optimisticVotes.upvotes : (currentEntry?.upvotes?.length || 0);
  const downvoteCount = optimisticVotes.downvotes !== null ? optimisticVotes.downvotes : (currentEntry?.downvotes?.length || 0);

  const typeMeta = currentEntry ? TYPE_META[currentEntry.type] : null;

  if (loading) return <Skeleton count={5} />;

  if (!currentEntry) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary">Entry not found</p>
        <Link href="/dashboard" className="text-accent hover:underline mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        .ed-outer {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0 1rem;
          font-family: 'DM Sans', sans-serif;
        }

        .ed-root {
          max-width: 680px;
          width: 100%;
        }

        /* ── Page header ── */
        .ed-page-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.75rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid #1a1a2a;
        }

        .ed-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 0.4375rem;
          border: 1px solid #1e1e30;
          background: #0a0a14;
          color: #8080a8;
          cursor: pointer;
          text-decoration: none;
          transition: background 140ms, border-color 140ms, color 140ms;
          flex-shrink: 0;
        }

        .ed-back-btn:hover {
          background: #0f0f1c;
          border-color: #2a2a40;
          color: #c0c0e0;
        }

        .ed-page-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #e4e4f0;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        /* ── Card ── */
        .ed-card {
          background: #0d0d18;
          border: 1px solid #1a1a2a;
          border-radius: 1rem;
          overflow: hidden;
        }

        .ed-card-inner {
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* ── Section ── */
        .ed-section {
          padding: 1.25rem 0;
          border-bottom: 1px solid #13131f;
        }

        .ed-section:first-child { padding-top: 0; }
        .ed-section:last-child  { border-bottom: none; padding-bottom: 0; }

        /* ── Title row ── */
        .ed-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .ed-type-pill {
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
          margin-bottom: 0.625rem;
        }

        .ed-entry-title {
          font-size: 1.375rem;
          font-weight: 600;
          color: #e4e4f0;
          letter-spacing: -0.015em;
          line-height: 1.3;
        }

        /* ── Vote + action buttons ── */
        .ed-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .ed-vote-group {
          display: flex;
          border: 1px solid #1e1e30;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .ed-vote-btn {
          display: flex;
          align-items: center;
          gap: 0.3125rem;
          padding: 0.4375rem 0.6875rem;
          background: #0a0a14;
          border: none;
          color: #7070988;
          font-size: 0.8125rem;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: background 140ms, color 140ms;
          color: #8080a8;
        }

        .ed-vote-btn:first-child {
          border-right: 1px solid #1e1e30;
        }

        .ed-vote-btn:hover {
          background: #0f0f1c;
        }

        .ed-vote-btn.up:hover   { color: #34d399; background: rgba(52,211,153,0.06); }
        .ed-vote-btn.down:hover { color: #f87171; background: rgba(248,113,113,0.06); }

        .ed-vote-btn.up.active   { color: #34d399; background: rgba(52,211,153,0.1); }
        .ed-vote-btn.down.active { color: #f87171; background: rgba(248,113,113,0.1); }

        .ed-vote-icon-flip {
          display: inline-flex;
          transform: rotate(180deg);
        }

        .ed-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 0.4375rem;
          border: 1px solid #1e1e30;
          background: #0a0a14;
          color: #7070988;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
          color: #8080a8;
        }

        .ed-icon-btn.edit:hover  { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.3); color: #818cf8; }
        .ed-icon-btn.trash:hover { background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.3); color: #f87171; }

        /* ── Metadata strip ── */
        .ed-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .ed-meta-item {
          display: flex;
          align-items: center;
          gap: 0.3125rem;
          font-size: 0.75rem;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        .ed-meta-label { color: #4a4a6a; }
        .ed-meta-value { color: #9090b8; }

        /* ── Section label ── */
        .ed-label {
          font-size: 0.6875rem;
          font-weight: 500;
          color: #8888aa;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          margin-bottom: 0.5rem;
        }

        /* ── Body text ── */
        .ed-body {
          font-size: 0.9rem;
          color: #a8a8c8;
          line-height: 1.7;
          white-space: pre-wrap;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Textarea (edit mode) ── */
        .ed-input {
          background: #0a0a14;
          border: 1px solid #1e1e30;
          border-radius: 0.5rem;
          padding: 0.6875rem 0.875rem;
          font-size: 0.875rem;
          color: #d4d4e8;
          outline: none;
          width: 100%;
          transition: border-color 160ms, box-shadow 160ms;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.6;
          resize: vertical;
        }

        .ed-input::placeholder { color: #52527a; }
        .ed-input:focus {
          border-color: #3b3b5c;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
        }

        /* ── Dos / Donts ── */
        .ed-dos-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 520px) {
          .ed-dos-grid { grid-template-columns: 1fr; }
        }

        .ed-col-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.6875rem;
          font-weight: 500;
          color: #8888aa;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          margin-bottom: 0.625rem;
        }

        .ed-dot {
          width: 0.4375rem;
          height: 0.4375rem;
          border-radius: 9999px;
          flex-shrink: 0;
        }

        .ed-dot.green { background: #34d399; }
        .ed-dot.red   { background: #f87171; }

        .ed-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .ed-list-item {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          font-size: 0.875rem;
          color: #a0a0c0;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.55;
        }

        .ed-list-icon {
          font-size: 0.75rem;
          margin-top: 0.175rem;
          flex-shrink: 0;
          font-family: 'DM Mono', monospace;
        }

        .ed-list-icon.green { color: #34d399; }
        .ed-list-icon.red   { color: #f87171; }

        /* ── Tags ── */
        .ed-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .ed-tag {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.625rem;
          background: #12122a;
          border: 1px solid #22224a;
          border-radius: 9999px;
          font-size: 0.6875rem;
          color: #7878aa;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        /* ── Image ── */
        .ed-image {
          border-radius: 0.625rem;
          border: 1px solid #1e1e30;
          max-width: 100%;
          display: block;
        }

        /* ── Edit footer ── */
        .ed-edit-footer {
          display: flex;
          gap: 0.625rem;
          padding-top: 1.25rem;
          border-top: 1px solid #13131f;
          margin-top: 1.25rem;
        }

        .ed-btn-cancel {
          flex: 1;
          padding: 0.6875rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid #1e1e30;
          background: transparent;
          color: #8080a0;
          font-size: 0.875rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
        }

        .ed-btn-cancel:hover {
          background: #0f0f1c;
          border-color: #2a2a40;
          color: #c0c0e0;
        }

        .ed-btn-save {
          flex: 1;
          padding: 0.6875rem 1rem;
          border-radius: 0.5rem;
          border: none;
          background: #6366f1;
          color: white;
          font-size: 0.875rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 140ms, transform 80ms;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .ed-btn-save:hover  { background: #7274f3; }
        .ed-btn-save:active { transform: scale(0.985); }
        .ed-btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .ed-spinner {
          width: 0.875rem;
          height: 0.875rem;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: white;
          border-radius: 9999px;
          animation: ed-spin 0.65s linear infinite;
        }

        @keyframes ed-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="ed-outer">
        <div className="ed-root">

          {/* Page header */}
          <div className="ed-page-header">
            <Link href="/dashboard" className="ed-back-btn">
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
            <h1 className="ed-page-title">
              {isEditing ? 'Edit Entry' : 'Entry Details'}
            </h1>
          </div>

          <div className="ed-card">
            <div className="ed-card-inner">

              {/* Title + actions */}
              <div className="ed-section">
                <div className="ed-title-row">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData?.title || ''}
                        onChange={(e) => handleEditChange('title', e.target.value)}
                        className="ed-input"
                        style={{ fontSize: '1rem', fontWeight: 600 }}
                        placeholder="Entry title"
                      />
                    ) : (
                      <>
                        {typeMeta && (
                          <div
                            className="ed-type-pill"
                            style={{
                              color: typeMeta.color,
                              borderColor: `${typeMeta.color}33`,
                              background: `${typeMeta.color}0f`,
                            }}
                          >
                            <span>{typeMeta.icon}</span>
                            <span>{currentEntry.type?.replace('-', ' ')}</span>
                          </div>
                        )}
                        <h2 className="ed-entry-title">{currentEntry.title}</h2>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="ed-actions">
                      {/* Vote group */}
                      <div className="ed-vote-group">
                        <button
                          onClick={handleUpvote}
                          className={`ed-vote-btn up ${userUpvoted ? 'active' : ''}`}
                        >
                          <TriangleUpIcon className="w-3.5 h-3.5" />
                          <span>{upvoteCount}</span>
                        </button>
                        <button
                          onClick={handleDownvote}
                          className={`ed-vote-btn down ${userDownvoted ? 'active' : ''}`}
                        >
                          <span className="ed-vote-icon-flip">
                            <TriangleUpIcon className="w-3.5 h-3.5" />
                          </span>
                          <span>{downvoteCount}</span>
                        </button>
                      </div>

                      {/* Owner controls */}
                      {isOwner && (
                        <>
                          <button onClick={() => setIsEditing(true)} className="ed-icon-btn edit">
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button onClick={handleDelete} className="ed-icon-btn trash">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="ed-section">
                <div className="ed-meta">
                  <div className="ed-meta-item">
                    <span className="ed-meta-label">by</span>
                    <span className="ed-meta-value">{currentEntry.authorName}</span>
                  </div>
                  <div className="ed-meta-item">
                    <span className="ed-meta-label">created</span>
                    <span className="ed-meta-value">{new Date(currentEntry.createdAt).toLocaleDateString()}</span>
                  </div>
                  {currentEntry.createdAt !== currentEntry.updatedAt && (
                    <div className="ed-meta-item">
                      <span className="ed-meta-label">updated</span>
                      <span className="ed-meta-value">{new Date(currentEntry.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* What */}
              <div className="ed-section">
                <p className="ed-label">What happened?</p>
                {isEditing ? (
                  <textarea
                    value={editData?.what || ''}
                    onChange={(e) => handleEditChange('what', e.target.value)}
                    className="ed-input"
                    rows={4}
                    placeholder="Describe the situation or decision..."
                  />
                ) : (
                  <p className="ed-body">{currentEntry.what}</p>
                )}
              </div>

              {/* Why */}
              <div className="ed-section">
                <p className="ed-label">Why?</p>
                {isEditing ? (
                  <textarea
                    value={editData?.why || ''}
                    onChange={(e) => handleEditChange('why', e.target.value)}
                    className="ed-input"
                    rows={4}
                    placeholder="Explain the reasoning and trade-offs..."
                  />
                ) : (
                  <p className="ed-body">{currentEntry.why}</p>
                )}
              </div>

              {/* Do's & Don'ts */}
              {((currentEntry.dos && currentEntry.dos.length > 0) || (currentEntry.donts && currentEntry.donts.length > 0)) && (
                <div className="ed-section">
                  <div className="ed-dos-grid">
                    <div>
                      <div className="ed-col-header">
                        <span className="ed-dot green" /> Do's
                      </div>
                      <ul className="ed-list">
                        {currentEntry.dos?.map((item, idx) => (
                          <li key={idx} className="ed-list-item">
                            <span className="ed-list-icon green">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="ed-col-header">
                        <span className="ed-dot red" /> Don'ts
                      </div>
                      <ul className="ed-list">
                        {currentEntry.donts?.map((item, idx) => (
                          <li key={idx} className="ed-list-item">
                            <span className="ed-list-icon red">✗</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {currentEntry.tags && currentEntry.tags.length > 0 && (
                <div className="ed-section">
                  <p className="ed-label">Tags</p>
                  <div className="ed-tags">
                    {currentEntry.tags.map((tag) => (
                      <span key={tag} className="ed-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Context */}
              {currentEntry.context && (
                <div className="ed-section">
                  <p className="ed-label">Additional Context</p>
                  <p className="ed-body">{currentEntry.context}</p>
                </div>
              )}

              {/* Images - Carousel or Legacy Single Image */}
              {(currentEntry.images && currentEntry.images.length > 0) ? (
                <div className="ed-section">
                  <p className="ed-label">Images</p>
                  <ImageCarousel images={currentEntry.images} />
                </div>
              ) : currentEntry.image ? (
                <div className="ed-section">
                  <p className="ed-label">Diagram / Image</p>
                  <img
                    src={currentEntry.image}
                    alt={currentEntry.title}
                    className="ed-image"
                  />
                </div>
              ) : null}

              {/* Edit footer */}
              {isEditing && (
                <div className="ed-edit-footer">
                  <button
                    className="ed-btn-cancel"
                    onClick={() => { setIsEditing(false); setEditData(currentEntry); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="ed-btn-save"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? <><span className="ed-spinner" /> Saving…</> : 'Save Changes'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}