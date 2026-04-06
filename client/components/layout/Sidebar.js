'use client';

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { logout } from '@/redux/slices/authSlice';
import { switchOrg } from '@/redux/slices/orgSlice';
import { createProject, initializeProjects, switchProject } from '@/redux/slices/projectSlice';
import api from '@/services/api';
import {
  HomeIcon,
  PlusIcon,
  ChartIcon,
  SettingsIcon,
  LogoutIcon,
  ChevronDownIcon,
  CheckIcon,
  UserIcon
} from '@/components/icons';

export default function Sidebar() {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSelector((state) => state.auth);
  const { orgs, activeOrg } = useSelector((state) => state.orgs);
  const { projects, activeProject } = useSelector((state) => state.projects);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const currentOrg = orgs.find((o) => o._id === activeOrg);
  const currentProject = projects.find((project) => project._id === activeProject);

  const userRole = (() => {
    if (!currentOrg) return 'viewer';
    const member = currentOrg.members.find(m => m.userId === user._id);
    return member?.role || 'viewer';
  })();

  const handleSwitchOrg = async (orgId) => {
    await dispatch(switchOrg(orgId));
    await dispatch(initializeProjects(orgId));
    setIsOrgDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    router.push('/dashboard');
  };

  const handleSwitchProject = async (projectId) => {
    await dispatch(switchProject(projectId));
    setIsProjectDropdownOpen(false);
    router.push('/dashboard');
  };

  const handleCreateProject = async () => {
    if (userRole !== 'owner' || !activeOrg) {
      return;
    }

    const name = window.prompt('Project name');
    if (!name?.trim()) {
      return;
    }

    const description = window.prompt('Project description (optional)') || '';
    const result = await dispatch(createProject({ orgId: activeOrg, name: name.trim(), description }));

    if (result.type.endsWith('/fulfilled')) {
      await dispatch(initializeProjects(activeOrg));
      await dispatch(switchProject(result.payload._id));
      setIsProjectDropdownOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    dispatch(logout());
    router.push('/login');
  };

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: HomeIcon },
    ...(userRole !== 'viewer' ? [{ href: '/entries/new', label: 'New Entry', icon: PlusIcon }] : []),
    { href: '/analytics', label: 'Analytics', icon: ChartIcon },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500&family=DM+Sans:wght@300;400;500;600&display=swap');

        .sb-root {
          position: fixed;
          left: 0; top: 0;
          height: 100vh;
          width: 15rem;
          background: #09090f;
          border-right: 1px solid #13131e;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', sans-serif;
          z-index: 40;
        }

        /* ── Logo ── */
        .sb-logo {
          padding: 1.25rem 1.25rem 1rem;
          border-bottom: 1px solid #13131e;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sb-logo-mark {
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 0.4rem;
          background: linear-gradient(135deg, #3b3b7a 0%, #6366f1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        .sb-logo-text {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #d4d4f0;
          letter-spacing: -0.02em;
        }

        /* ── Org switcher ── */
        .sb-org-section {
          padding: 0.75rem 0.875rem;
          border-bottom: 1px solid #13131e;
        }

        .sb-org-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5rem 0.625rem;
          border-radius: 0.5rem;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: background 140ms, border-color 140ms;
          text-align: left;
        }

        .sb-org-btn:hover {
          background: #121220;
          border-color: #1e1e30;
        }

        .sb-org-icon {
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 0.375rem;
          background: #1a1a2e;
          border: 1px solid #252540;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 0.625rem;
          font-family: 'DM Mono', monospace;
          font-weight: 500;
          color: #6366f1;
          letter-spacing: 0;
        }

        .sb-org-name {
          flex: 1;
          min-width: 0;
        }

        .sb-org-label {
          font-size: 0.6rem;
          font-family: 'DM Mono', monospace;
          color: #505070;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          line-height: 1;
        }

        .sb-org-value {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #c0c0e0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 0.125rem;
        }

        .sb-org-chevron {
          color: #404060;
          flex-shrink: 0;
          transition: transform 200ms, color 140ms;
        }

        .sb-org-btn:hover .sb-org-chevron { color: #6060a0; }
        .sb-org-chevron.open { transform: rotate(180deg); }

        .sb-org-dropdown {
          margin-top: 0.25rem;
          background: #0f0f1a;
          border: 1px solid #1e1e30;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .sb-org-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5625rem 0.75rem;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 0.8125rem;
          font-family: 'DM Sans', sans-serif;
          color: #a0a0c0;
          transition: background 120ms, color 120ms;
          text-align: left;
        }

        .sb-org-item:hover { background: #161626; color: #d0d0f0; }
        .sb-org-item.active { color: #8080f0; }

        /* ── Nav ── */
        .sb-nav {
          flex: 1;
          padding: 0.75rem 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          overflow-y: auto;
        }

        .sb-nav-link {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5625rem 0.75rem;
          border-radius: 0.5rem;
          text-decoration: none;
          font-size: 0.8375rem;
          font-weight: 400;
          color: #666688;
          transition: background 130ms, color 130ms;
          position: relative;
        }

        .sb-nav-link:hover {
          background: #111120;
          color: #b0b0d8;
        }

        .sb-nav-link.active {
          background: #13132a;
          color: #a0a0f0;
        }

        .sb-nav-link.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 20%;
          height: 60%;
          width: 2px;
          background: #6366f1;
          border-radius: 0 2px 2px 0;
        }

        .sb-nav-icon {
          flex-shrink: 0;
          opacity: 0.9;
        }

        /* ── Bottom user area ── */
        .sb-bottom {
          border-top: 1px solid #13131e;
          padding: 0.75rem 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .sb-user-card {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5625rem 0.75rem;
          border-radius: 0.5rem;
          text-decoration: none;
          border: 1px solid transparent;
          transition: background 140ms, border-color 140ms;
          cursor: pointer;
        }

        .sb-user-card:hover {
          background: #111120;
          border-color: #1e1e30;
        }

        .sb-user-avatar {
          width: 1.875rem;
          height: 1.875rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b3b7a 0%, #6366f1 100%);
          border: 1px solid rgba(99,102,241,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #e0e0ff;
          font-family: 'DM Mono', monospace;
          flex-shrink: 0;
        }

        .sb-user-info {
          flex: 1;
          min-width: 0;
        }

        .sb-user-name {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #c0c0e0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }

        .sb-user-email {
          font-size: 0.6875rem;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          color: #484868;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 0.0625rem;
        }

        .sb-user-arrow {
          color: #303050;
          flex-shrink: 0;
          transition: color 140ms, transform 140ms;
        }

        .sb-user-card:hover .sb-user-arrow {
          color: #6366f1;
          transform: translateX(2px);
        }

        .sb-logout-btn {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.8375rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          color: #555570;
          transition: background 130ms, color 130ms;
          width: 100%;
          text-align: left;
        }

        .sb-logout-btn:hover {
          background: #1f0e0e;
          color: #f87171;
        }
      `}</style>

      <div className="sb-root">
        {/* Logo */}
        <Link href="/dashboard" className="sb-logo">
          <div className="sb-logo-mark">🧠</div>
          <span className="sb-logo-text">Think Twice</span>
        </Link>

        {/* Org switcher */}
        <div className="sb-org-section">
          <button
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            className="sb-org-btn"
          >
            <div className="sb-org-icon">
              {currentOrg?.name?.slice(0, 2).toUpperCase() || 'ORG'}
            </div>
            <div className="sb-org-name">
              <p className="sb-org-label">workspace</p>
              <p className="sb-org-value">{currentOrg?.name || 'Select Org'}</p>
            </div>
            <ChevronDownIcon className={`sb-org-chevron ${isOrgDropdownOpen ? 'open' : ''}`} />
          </button>

          {isOrgDropdownOpen && (
            <div className="sb-org-dropdown">
              {orgs.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleSwitchOrg(org._id)}
                  className={`sb-org-item ${org._id === activeOrg ? 'active' : ''}`}
                >
                  <span>{org.name}</span>
                  {org._id === activeOrg && <CheckIcon style={{ width: 14, height: 14 }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sb-org-section">
          <button
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="sb-org-btn"
          >
            <div className="sb-org-icon">
              {currentProject?.name?.slice(0, 2).toUpperCase() || 'PR'}
            </div>
            <div className="sb-org-name">
              <p className="sb-org-label">project</p>
              <p className="sb-org-value">{currentProject?.name || 'Select Project'}</p>
            </div>
            <ChevronDownIcon className={`sb-org-chevron ${isProjectDropdownOpen ? 'open' : ''}`} />
          </button>

          {isProjectDropdownOpen && (
            <div className="sb-org-dropdown">
              {projects.map((project) => (
                <button
                  key={project._id}
                  onClick={() => handleSwitchProject(project._id)}
                  className={`sb-org-item ${project._id === activeProject ? 'active' : ''}`}
                >
                  <span>{project.name}</span>
                  {project._id === activeProject && <CheckIcon style={{ width: 14, height: 14 }} />}
                </button>
              ))}
              {userRole === 'owner' && (
                <button onClick={handleCreateProject} className="sb-org-item">
                  <span>+ Create Project</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sb-nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="sb-nav-icon" style={{ width: 17, height: 17 }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="sb-bottom">
          <Link href="/profile" className="sb-user-card">
            <div className="sb-user-avatar">{initials}</div>
            <div className="sb-user-info">
              <p className="sb-user-name">{user?.name}</p>
              <p className="sb-user-email">{user?.email}</p>
            </div>
            <svg className="sb-user-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>

          <button onClick={handleLogout} className="sb-logout-btn">
            <LogoutIcon style={{ width: 16, height: 16 }} />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </>
  );
}