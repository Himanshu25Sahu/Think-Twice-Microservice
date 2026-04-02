'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { createOrg, joinOrg, fetchMyOrgs } from '@/redux/slices/orgSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';

export function OrgOnboarding() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { loading } = useSelector((state) => state.orgs);
  const [tab, setTab] = useState('create'); // 'create' or 'join'
  const [toast, setToast] = useState(null);

  // Create form
  const [createData, setCreateData] = useState({ name: '', slug: '' });

  // Join form
  const [joinData, setJoinData] = useState({ inviteCode: '' });

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateData((prev) => ({ ...prev, [name]: value }));
  };

  const handleJoinChange = (e) => {
    const { name, value } = e.target;
    setJoinData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();

    if (!createData.name) {
      setToast({ type: 'error', message: 'Organization name is required' });
      return;
    }

    try {
      const result = await dispatch(createOrg(createData));
      // Check if fulfilled (no error), not if result.payload.success
      if (result.type.endsWith('/fulfilled')) {
        setToast({ type: 'success', message: 'Organization created!' });
        await dispatch(fetchMyOrgs());
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setToast({ type: 'error', message: result.payload || 'Failed to create organization' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  const handleJoinOrg = async (e) => {
    e.preventDefault();

    if (!joinData.inviteCode) {
      setToast({ type: 'error', message: 'Invite code is required' });
      return;
    }

    try {
      const result = await dispatch(joinOrg({ inviteCode: joinData.inviteCode }));
      // Check if fulfilled (no error), not if result.payload.success
      if (result.type.endsWith('/fulfilled')) {
        setToast({ type: 'success', message: 'Joined organization!' });
        await dispatch(fetchMyOrgs());
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setToast({ type: 'error', message: result.payload || 'Failed to join organization' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Set up your organization</h1>
          <p className="text-secondary">Create a new team or join an existing one</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'create'
                ? 'bg-accent text-white'
                : 'bg-[#1a1a27] text-secondary hover:text-primary'
            }`}
          >
            Create New
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'join'
                ? 'bg-accent text-white'
                : 'bg-[#1a1a27] text-secondary hover:text-primary'
            }`}
          >
            Join Existing
          </button>
        </div>

        {/* Create Organization Form */}
        {tab === 'create' && (
          <div className="card-base">
            <h3 className="text-lg font-semibold text-primary mb-4">Create Organization</h3>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <Input
                label="Organization Name"
                type="text"
                name="name"
                value={createData.name}
                onChange={handleCreateChange}
                placeholder="My Team"
                disabled={loading}
              />

              <Input
                label="Organization Slug (optional)"
                type="text"
                name="slug"
                value={createData.slug}
                onChange={handleCreateChange}
                placeholder="my-team"
                disabled={loading}
                description="Used for invite codes and URLs"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={loading}
              >
                Create Organization
              </Button>
            </form>

            <p className="text-xs text-secondary mt-4">
              You'll be the owner and can invite team members later.
            </p>
          </div>
        )}

        {/* Join Organization Form */}
        {tab === 'join' && (
          <div className="card-base">
            <h3 className="text-lg font-semibold text-primary mb-4">Join Organization</h3>

            <form onSubmit={handleJoinOrg} className="space-y-4">
              <Input
                label="Invite Code"
                type="text"
                name="inviteCode"
                value={joinData.inviteCode}
                onChange={handleJoinChange}
                placeholder="INVITE-CODE-HERE"
                disabled={loading}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={loading}
              >
                Join Organization
              </Button>
            </form>

            <p className="text-xs text-secondary mt-4">
              Ask your team owner for the invite code.
            </p>
          </div>
        )}
      </div>

      {/* Toast Notification */}
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
