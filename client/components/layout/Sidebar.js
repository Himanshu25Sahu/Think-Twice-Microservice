'use client';

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/redux/slices/authSlice';
import { switchOrg } from '@/redux/slices/orgSlice';
import api from '@/services/api';
import {
  HomeIcon,
  PlusIcon,
  ChartIcon,
  SettingsIcon,
  LogoutIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@/components/icons';

export default function Sidebar() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { user } = useSelector((state) => state.auth);
  const { orgs, activeOrg } = useSelector((state) => state.orgs);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);

  const currentOrg = orgs.find((o) => o._id === activeOrg);

  const handleSwitchOrg = async (orgId) => {
    await dispatch(switchOrg(orgId));
    setIsOrgDropdownOpen(false);
    router.push('/dashboard');
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
    { href: '/entries/new', label: 'New Entry', icon: PlusIcon },
    { href: '/analytics', label: 'Analytics', icon: ChartIcon },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link href="/dashboard" className="text-xl font-bold text-accent">
          🧠 Think Twice
        </Link>
      </div>

      {/* Organization Switcher */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <button
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            className="w-full flex items-center justify-between p-2 rounded hover:bg-[#1a1a27] transition"
          >
            <div className="text-left">
              <div className="text-xs text-secondary font-semibold uppercase tracking-wide">
                Organization
              </div>
              <div className="text-sm text-primary font-medium truncate">
                {currentOrg?.name || 'Select Org'}
              </div>
            </div>
            <ChevronDownIcon
              className={`w-4 h-4 text-secondary transition-transform ${
                isOrgDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isOrgDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a27] border border-border rounded shadow-lg z-50">
              {orgs.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleSwitchOrg(org._id)}
                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-[#252530] flex items-center justify-between transition first:rounded-t last:rounded-b"
                >
                  <span>{org.name}</span>
                  {org._id === activeOrg && (
                    <CheckIcon className="w-4 h-4 text-accent" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-secondary hover:bg-[#1a1a27] hover:text-primary transition"
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="px-3 py-2 text-xs text-secondary truncate">
          <div className="font-semibold text-primary truncate">{user?.name}</div>
          <div className="truncate text-zinc-500">{user?.email}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded text-sm text-secondary hover:bg-red-600/10 hover:text-red-400 transition"
        >
          <LogoutIcon className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}