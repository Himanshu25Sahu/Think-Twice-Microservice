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
    <nav className="sticky top-0 z-40 h-16 bg-card border-b border-border flex items-center px-8 ml-64 backdrop-blur-sm bg-opacity-95">
      {/* Page Title */}
      <h1 className="text-xl font-bold text-primary tracking-tight">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Section - Flex Container for Alignment */}
      <div className="flex items-center gap-4 sm:gap-6 w-auto">


        {/* New Entry Button */}
        <Link
          href="/entries/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white font-semibold transition-all duration-200 text-sm shadow-sm hover:shadow-md active:scale-95"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </Link>
      </div>
    </nav>
  );
}