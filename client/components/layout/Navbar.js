'use client';

import { usePathname } from 'next/navigation';
import { SearchIcon, PlusIcon } from '@/components/icons';
import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');

  // Map routes to page titles
  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/entries/new': 'New Entry',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
  };

  const title = pageTitles[pathname] || 'Page';

  // Only show search on dashboard
  const showSearch = pathname === '/dashboard';

  return (
    <nav className="sticky top-0 z-40 h-14 bg-card border-b border-border flex items-center px-6 ml-64">
      {/* Page Title */}
      <h1 className="text-lg font-semibold text-primary">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search Bar (Dashboard only) */}
      {showSearch && (
        <div className="relative mr-6 max-w-xs hidden sm:block">
          <input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 pl-9 text-sm bg-[#1a1a27] border border-border rounded-lg text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-secondary pointer-events-none" />
        </div>
      )}

      {/* New Entry Button (Quick Access) */}
      <Link
        href="/entries/new"
        className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-accent hover:bg-indigo-700 text-white font-medium transition text-sm"
      >
        <PlusIcon className="w-4 h-4" />
        <span className="hidden sm:inline">New</span>
      </Link>
    </nav>
  );
}