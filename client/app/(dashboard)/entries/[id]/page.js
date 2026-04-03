'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useParams } from 'next/navigation';
import { fetchEntry, updateEntry, deleteEntry, toggleUpvote } from '@/redux/slices/entrySlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArrowLeftIcon, TriangleUpIcon, EditIcon, TrashIcon } from '@/components/icons';
import Link from 'next/link';

export default function EntryDetailPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const { currentEntry, loading } = useSelector((state) => state.entries);
  const { user } = useSelector((state) => state.auth);
  const { activeOrg } = useSelector((state) => state.orgs);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    if (id) {
      dispatch(fetchEntry({ id, orgId: activeOrg }));
    }
  }, [id, dispatch, activeOrg]);

  useEffect(() => {
    if (currentEntry && !editData) {
      setEditData(currentEntry);
    }
  }, [currentEntry, editData]);

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const result = await dispatch(updateEntry({ id, data: { ...editData, orgId: activeOrg } }));
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
        const result = await dispatch(deleteEntry({ id, orgId: activeOrg }));
        if (result.meta.requestStatus === 'fulfilled') {
          setToast({ type: 'success', message: 'Entry deleted!' });
          setTimeout(() => router.push('/dashboard'), 1000);
        }
      } catch (err) {
        setToast({ type: 'error', message: 'Failed to delete entry' });
      }
    }
  };

  const handleUpvote = () => {
    dispatch(toggleUpvote({ id, orgId: activeOrg }));
  };

  const isOwner = user && currentEntry && user._id === currentEntry.authorId;

  if (loading) {
    return <Skeleton count={5} />;
  }

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
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard" className="p-2 hover:bg-[#1a1a27] rounded transition">
          <ArrowLeftIcon className="w-5 h-5 text-secondary" />
        </Link>
        <h1 className="text-2xl font-bold text-primary flex-1">
          {isEditing ? 'Edit Entry' : 'Entry Details'}
        </h1>
      </div>

      <div className="card-base space-y-6">
        {/* Title & Type */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <Input
                label="Title"
                type="text"
                value={editData?.title || ''}
                onChange={(e) => handleEditChange('title', e.target.value)}
              />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge type={currentEntry.type} />
                </div>
                <h2 className="text-3xl font-bold text-primary">{currentEntry.title}</h2>
              </>
            )}
          </div>

          {/* Action Buttons */}
          {!isEditing && (
            <div className="flex gap-2">
              <button
                onClick={handleUpvote}
                className="flex items-center gap-1 px-3 py-2 rounded bg-[#1a1a27] hover:bg-indigo-600/10 hover:text-accent transition"
              >
                <TriangleUpIcon className="w-4 h-4" />
                <span className="text-sm">{currentEntry.upvotes?.length || 0}</span>
              </button>

              {isOwner && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded bg-[#1a1a27] hover:bg-indigo-600/10 hover:text-accent transition"
                  >
                    <EditIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 rounded bg-[#1a1a27] hover:bg-red-600/10 hover:text-red-400 transition"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-secondary border-b border-border pb-4">
          <div>
            <span className="text-secondary opacity-75">By</span> <span className="text-primary">{currentEntry.authorName}</span>
          </div>
          <div>
            <span className="text-secondary opacity-75">Created</span> <span className="text-primary">{new Date(currentEntry.createdAt).toLocaleDateString()}</span>
          </div>
          {currentEntry.createdAt !== currentEntry.updatedAt && (
            <div>
              <span className="text-secondary opacity-75">Updated</span> <span className="text-primary">{new Date(currentEntry.updatedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* What */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-2">What happened?</h3>
          {isEditing ? (
            <textarea
              value={editData?.what || ''}
              onChange={(e) => handleEditChange('what', e.target.value)}
              className="input-base"
              rows={4}
            />
          ) : (
            <p className="text-secondary whitespace-pre-wrap">{currentEntry.what}</p>
          )}
        </div>

        {/* Why */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-2">Why?</h3>
          {isEditing ? (
            <textarea
              value={editData?.why || ''}
              onChange={(e) => handleEditChange('why', e.target.value)}
              className="input-base"
              rows={4}
            />
          ) : (
            <p className="text-secondary whitespace-pre-wrap">{currentEntry.why}</p>
          )}
        </div>

        {/* Do's & Don'ts */}
        <div className="grid grid-cols-2 gap-4">
          {/* Do's */}
          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">Do's</h3>
            <ul className="space-y-2">
              {currentEntry.dos?.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-secondary">
                  <span className="text-green-400">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Don'ts */}
          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">Don'ts</h3>
            <ul className="space-y-2">
              {currentEntry.donts?.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-secondary">
                  <span className="text-red-400">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tags */}
        {currentEntry.tags && currentEntry.tags.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {currentEntry.tags.map((tag) => (
                <span key={tag} className="tag-base">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Context */}
        {currentEntry.context && (
          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">Additional Context</h3>
            <p className="text-secondary whitespace-pre-wrap">{currentEntry.context}</p>
          </div>
        )}

        {/* Image */}
        {currentEntry.image && (
          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">Diagram / Image</h3>
            <img
              src={currentEntry.image}
              alt={currentEntry.title}
              className="rounded-lg border border-[#1e1e2e] max-w-full"
            />
          </div>
        )}

        {/* Edit Buttons */}
        {isEditing && (
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditing(false);
                setEditData(currentEntry);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={loading}
              className="flex-1"
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
