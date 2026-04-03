'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrgDetails, updateMemberRole, removeMember } from '@/redux/slices/orgSlice';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { CopyIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { activeOrg, orgDetails, loading } = useSelector((state) => state.orgs);
  const { user } = useSelector((state) => state.auth);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (activeOrg) {
      dispatch(fetchOrgDetails(activeOrg));
    }
  }, [activeOrg, dispatch]);

  const handleCopyInviteCode = () => {
    if (orgDetails?.inviteCode) {
      navigator.clipboard.writeText(orgDetails.inviteCode);
      setToast({ type: 'success', message: 'Invite code copied!' });
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    const result = await dispatch(updateMemberRole({ orgId: activeOrg, targetUserId, newRole }));
    if (result.meta.requestStatus === 'fulfilled') {
      setToast({ type: 'success', message: `Role updated to ${newRole}` });
    } else {
      setToast({ type: 'error', message: result.payload || 'Failed to update role' });
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!confirm('Remove this member?')) return;
    const result = await dispatch(removeMember({ orgId: activeOrg, targetUserId }));
    if (result.meta.requestStatus === 'fulfilled') {
      setToast({ type: 'success', message: 'Member removed' });
    } else {
      setToast({ type: 'error', message: result.payload || 'Failed to remove member' });
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
        <h3 className="text-lg font-semibold text-primary mb-6">Organization Details</h3>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-secondary uppercase mb-1">Organization Name</p>
            <p className="text-primary font-medium">{orgDetails?.name}</p>
          </div>
          <div>
            <p className="text-xs text-secondary uppercase mb-1">Owner</p>
            <p className="text-primary font-medium">
              {orgDetails?.owner === user?._id ? `${user?.name} (You)` : `User ...${orgDetails?.owner?.slice(-6)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary uppercase mb-1">Created</p>
            <p className="text-primary font-medium">
              {new Date(orgDetails?.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
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
              <div key={member.userId || member._id} className="flex items-center justify-between p-3 rounded hover:bg-[#1a1a27] transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-400">
                      {member.userId === user?._id ? user?.name?.charAt(0) : '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-primary text-sm font-medium">
                      {member.userId === user?._id ? `${user?.name} (You)` : `User ...${member.userId?.slice(-6)}`}
                    </p>
                    <p className="text-xs text-secondary">Joined {new Date(member.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium uppercase px-2 py-1 rounded ${
                    member.role === 'owner' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    member.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    member.role === 'member' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                    'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}>{member.role}</span>
                  
                  {/* Role change — only owner can change, not on self */}
                  {isOwner && member.userId !== user?._id && member.role !== 'owner' && (
                    <select value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      className="bg-[#12121a] border border-[#1e1e2e] rounded text-xs py-1 px-2 text-zinc-300 outline-none">
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  
                  {/* Remove — only owner can remove, not on self */}
                  {isOwner && member.userId !== user?._id && member.role !== 'owner' && (
                    <button onClick={() => handleRemoveMember(member.userId)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-600/10 transition">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
