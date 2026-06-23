'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrgDetails, updateMemberRole, removeMember } from '@/redux/slices/orgSlice';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { CopyIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/Skeleton';

const ROLE_META = {
  owner:  { color: '#D97706', bg: 'rgba(217,119,6,0.10)',  border: 'rgba(217,119,6,0.25)'  },
  admin:  { color: '#16A34A', bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.25)' },
  member: { color: '#2563EB', bg: 'rgba(37,99,235,0.10)', border: 'rgba(37,99,235,0.25)' },
  viewer: { color: '#71717A', bg: 'rgba(113,113,122,0.10)', border: 'rgba(113,113,122,0.25)' },
};

function MemberAvatar({ name, isSelf }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <div style={{
      width: '2.25rem', height: '2.25rem', borderRadius: '9999px', flexShrink: 0,
      background: isSelf
        ? '#2563EB'
        : '#F2EEE4',
      border: isSelf ? '1px solid rgba(37,99,235,0.3)' : '1px solid #E7E2D6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.75rem', fontWeight: 600,
      color: isSelf ? '#FFFFFF' : '#71717A',
      fontFamily: "'DM Mono', monospace",
    }}>
      {initial}
    </div>
  );
}

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { activeOrg, orgDetails, loading } = useSelector((state) => state.orgs);
  const { user } = useSelector((state) => state.auth);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeOrg) dispatch(fetchOrgDetails(activeOrg));
  }, [activeOrg, dispatch]);

  const handleCopyInviteCode = () => {
    if (orgDetails?.inviteCode) {
      navigator.clipboard.writeText(orgDetails.inviteCode);
      setCopied(true);
      setToast({ type: 'success', message: 'Invite code copied!' });
      setTimeout(() => setCopied(false), 2000);
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

  if (loading) return <Skeleton count={4} />;

  const isOwner = orgDetails && user && orgDetails.owner === user._id;
  const ownerMember = orgDetails?.members?.find((member) => member.userId === orgDetails?.owner);
  const ownerDisplay = orgDetails?.owner === user?._id
    ? `${user?.name} (you)`
    : ownerMember?.name || ownerMember?.email || `···${orgDetails?.owner?.slice(-6)}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        .st-outer {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0 1rem;
          font-family: 'DM Sans', sans-serif;
        }

        .st-root {
          max-width: 680px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* ── Page header ── */
        .st-page-header {
          padding-bottom: 1.25rem;
          border-bottom: 1px solid #E7E2D6;
          margin-bottom: 0.25rem;
        }

        .st-page-subtitle {
          font-size: 0.8125rem;
          color: #71717A;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-top: 0.25rem;
        }

        /* ── Card ── */
        .st-card {
          background: #FFFFFF;
          border: 1px solid #E7E2D6;
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(24,24,27,0.06);
        }

        .st-card-header {
          padding: 1.25rem 1.75rem 0;
        }

        .st-card-body {
          padding: 1rem 1.75rem 1.5rem;
        }

        .st-card-title {
          font-size: 0.6875rem;
          font-weight: 500;
          color: #71717A;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          padding-bottom: 1rem;
          border-bottom: 1px solid #E7E2D6;
          margin-bottom: 1.125rem;
        }

        /* ── Info rows ── */
        .st-info-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .st-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #E7E2D6;
        }

        .st-info-row:last-child { border-bottom: none; }

        .st-info-label {
          font-size: 0.75rem;
          color: #71717A;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          color: #71717A;
        }

        .st-info-value {
          font-size: 0.875rem;
          color: #18181B;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          text-align: right;
        }

        /* ── Invite code ── */
        .st-invite-desc {
          font-size: 0.8125rem;
          color: #3F3F46;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          line-height: 1.6;
          margin-bottom: 0.875rem;
        }

        .st-invite-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          background: #F2EEE4;
          border: 1px solid #E7E2D6;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
        }

        .st-invite-code {
          font-family: 'DM Mono', monospace;
          font-size: 0.9375rem;
          font-weight: 400;
          color: #2563EB;
          letter-spacing: 0.08em;
          word-break: break-all;
        }

        .st-copy-btn {
          display: flex;
          align-items: center;
          gap: 0.3125rem;
          padding: 0.375rem 0.625rem;
          border-radius: 0.375rem;
          border: 1px solid #E7E2D6;
          background: #FFFFFF;
          color: #71717A;
          font-size: 0.6875rem;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .st-copy-btn:hover {
          background: #F2EEE4;
          border-color: #D0C9BA;
          color: #18181B;
        }

        .st-copy-btn.copied {
          color: #16A34A;
          border-color: rgba(22,163,74,0.3);
          background: rgba(22,163,74,0.08);
        }

        .st-invite-note {
          font-size: 0.725rem;
          color: #A1A1AA;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-top: 0.625rem;
        }

        /* ── Members list ── */
        .st-members-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .st-member-row {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 0;
          border-bottom: 1px solid #E7E2D6;
          transition: background 140ms;
        }

        .st-member-row:last-child { border-bottom: none; }

        .st-member-info {
          flex: 1;
          min-width: 0;
        }

        .st-member-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #18181B;
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .st-member-joined {
          font-size: 0.6875rem;
          color: #A1A1AA;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-top: 0.125rem;
          color: #71717A;
        }

        .st-member-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .st-role-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.2rem 0.5625rem;
          border-radius: 9999px;
          border: 1px solid;
          font-size: 0.625rem;
          font-family: 'DM Mono', monospace;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .st-role-select {
          background: #FFFFFF;
          border: 1px solid #E7E2D6;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          padding: 0.3125rem 0.5rem;
          color: #3F3F46;
          font-family: 'DM Mono', monospace;
          outline: none;
          cursor: pointer;
          transition: border-color 140ms;
        }

        .st-role-select:focus {
          border-color: #2563EB;
        }

        .st-remove-btn {
          padding: 0.3125rem 0.5rem;
          border-radius: 0.375rem;
          border: 1px solid transparent;
          background: transparent;
          color: #A1A1AA;
          font-size: 0.6875rem;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
        }

        .st-remove-btn:hover {
          background: #FEF2F2;
          border-color: #FECACA;
          color: #DC2626;
        }
      `}</style>

      <div className="st-outer">
        <div className="st-root">

          {/* Page header */}
          <div className="st-page-header">
            <p className="st-page-subtitle">Manage your organization and team</p>
          </div>

          {/* Org details */}
          <div className="st-card">
            <div className="st-card-header">
              <p className="st-card-title">Organization Details</p>
            </div>
            <div className="st-card-body" style={{ paddingTop: 0 }}>
              <div className="st-info-list">
                <div className="st-info-row">
                  <span className="st-info-label">name</span>
                  <span className="st-info-value">{orgDetails?.name}</span>
                </div>
                <div className="st-info-row">
                  <span className="st-info-label">owner</span>
                  <span className="st-info-value">{ownerDisplay}</span>
                </div>
                <div className="st-info-row">
                  <span className="st-info-label">created</span>
                  <span className="st-info-value">
                    {new Date(orgDetails?.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="st-info-row">
                  <span className="st-info-label">members</span>
                  <span className="st-info-value">{orgDetails?.members?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invite code */}
          <div className="st-card">
            <div className="st-card-header">
              <p className="st-card-title">Invite Team Members</p>
            </div>
            <div className="st-card-body" style={{ paddingTop: 0 }}>
              <p className="st-invite-desc">
                Share this code with teammates so they can join your organization.
              </p>
              <div className="st-invite-box">
                <code className="st-invite-code">
                  {orgDetails?.inviteCode || '—'}
                </code>
                <button
                  onClick={handleCopyInviteCode}
                  disabled={!orgDetails?.inviteCode}
                  className={`st-copy-btn ${copied ? 'copied' : ''}`}
                >
                  <CopyIcon className="w-3 h-3" />
                  {copied ? 'copied!' : 'copy'}
                </button>
              </div>
              <p className="st-invite-note">anyone with this code can join your organization</p>
            </div>
          </div>

          {/* Team members */}
          {orgDetails?.members && orgDetails.members.length > 0 && (
            <div className="st-card">
              <div className="st-card-header">
                <p className="st-card-title">Team Members</p>
              </div>
              <div className="st-card-body" style={{ paddingTop: 0 }}>
                <div className="st-members-list">
                  {orgDetails.members.map((member) => {
                    const isSelf = member.userId === user?._id;
                    const displayName = isSelf
                      ? `${user?.name} (you)`
                      : (member.name || `···${member.userId?.slice(-6)}`);
                    const roleMeta = ROLE_META[member.role] || ROLE_META.viewer;
                    const initial = isSelf
                      ? user?.name?.charAt(0)
                      : (member.name?.charAt(0) || '?');

                    return (
                      <div key={member.userId || member._id} className="st-member-row">
                        <MemberAvatar name={isSelf ? user?.name : member.name} isSelf={isSelf} />

                        <div className="st-member-info">
                          <p className="st-member-name">{displayName}</p>
                          <p className="st-member-joined">
                            joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="st-member-actions">
                          {/* Role pill */}
                          <span
                            className="st-role-pill"
                            style={{
                              color: roleMeta.color,
                              background: roleMeta.bg,
                              borderColor: roleMeta.border,
                            }}
                          >
                            {member.role}
                          </span>

                          {/* Role change select */}
                          {isOwner && !isSelf && member.role !== 'owner' && (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                              className="st-role-select"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}

                          {/* Remove button */}
                          {isOwner && !isSelf && member.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              className="st-remove-btn"
                            >
                              remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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