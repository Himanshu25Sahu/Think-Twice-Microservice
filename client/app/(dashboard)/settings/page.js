'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrgDetails, updateOrg } from '@/redux/slices/orgSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { CopyIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { activeOrg, orgDetails, loading } = useSelector((state) => state.orgs);
  const { user } = useSelector((state) => state.auth);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (activeOrg) {
      dispatch(fetchOrgDetails(activeOrg));
    }
  }, [activeOrg, dispatch]);

  useEffect(() => {
    if (orgDetails) {
      setFormData({ name: orgDetails.name || '', slug: orgDetails.slug || '' });
    }
  }, [orgDetails]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const result = await dispatch(updateOrg({ id: activeOrg, ...formData }));
      if (result.payload.success) {
        setToast({ type: 'success', message: 'Organization updated!' });
        setIsEditing(false);
        await dispatch(fetchOrgDetails(activeOrg));
      } else {
        setToast({ type: 'error', message: 'Failed to update organization' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred' });
    }
  };

  const handleCopyInviteCode = () => {
    if (orgDetails?.inviteCode) {
      navigator.clipboard.writeText(orgDetails.inviteCode);
      setToast({ type: 'success', message: 'Invite code copied!' });
    }
  };

  if (loading) {
    return <Skeleton count={4} />;
  }

  const isOwner = orgDetails && user && orgDetails.owner === user._id;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Organization Details */}
      <div className="card-base">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-primary">Organization Settings</h3>
          {isOwner && !isEditing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <Input
              label="Organization Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />

            <Input
              label="Slug"
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              description="Used for invite codes"
            />

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({ name: orgDetails.name, slug: orgDetails.slug });
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
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-secondary uppercase mb-1">Organization Name</p>
              <p className="text-primary font-medium">{orgDetails?.name}</p>
            </div>
            <div>
              <p className="text-xs text-secondary uppercase mb-1">Slug</p>
              <p className="text-primary font-medium">{orgDetails?.slug}</p>
            </div>
            <div>
              <p className="text-xs text-secondary uppercase mb-1">Owner</p>
              <p className="text-primary font-medium">{orgDetails?.owner?.name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-secondary uppercase mb-1">Created</p>
              <p className="text-primary font-medium">
                {new Date(orgDetails?.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Invite Code */}
      <div className="card-base">
        <h3 className="text-lg font-semibold text-primary mb-4">Invite Team Members</h3>

        <div className="space-y-3">
          <p className="text-sm text-secondary">
            Share this code with team members so they can join your organization.
          </p>

          <div className="flex gap-2">
            <div className="flex-1 p-3 rounded bg-[#1a1a27] border border-border flex items-center justify-between">
              <code className="font-mono text-sm text-primary">
                {orgDetails?.inviteCode || '—'}
              </code>
              <button
                onClick={handleCopyInviteCode}
                className="p-1 hover:bg-[#252530] rounded transition"
                disabled={!orgDetails?.inviteCode}
              >
                <CopyIcon className="w-4 h-4 text-secondary" />
              </button>
            </div>
          </div>

          <p className="text-xs text-secondary">
            Anyone with this code can join your organization.
          </p>
        </div>
      </div>

      {/* Team Members */}
      {orgDetails?.members && orgDetails.members.length > 0 && (
        <div className="card-base">
          <h3 className="text-lg font-semibold text-primary mb-4">Team Members</h3>

          <div className="space-y-2">
            {orgDetails.members.map((member) => (
              <div
                key={member._id}
                className="flex items-center justify-between p-3 rounded hover:bg-[#1a1a27] transition"
              >
                <div>
                  <p className="text-primary font-medium">{member.name}</p>
                  <p className="text-xs text-secondary">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-accent uppercase px-2 py-1 rounded bg-accent/10">
                    {member._id === orgDetails.owner ? 'Owner' : 'Member'}
                  </span>
                  <span className="text-xs text-secondary">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      {isOwner && (
        <div className="card-base border border-red-600/20 bg-red-600/5">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>

          <p className="text-sm text-secondary mb-4">
            Deleting an organization is permanent and cannot be undone.
          </p>

          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Are you sure? This cannot be undone.')) {
                // TODO: Implement delete organization
                setToast({ type: 'error', message: 'Delete not yet implemented' });
              }
            }}
          >
            Delete Organization
          </Button>
        </div>
      )}

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
