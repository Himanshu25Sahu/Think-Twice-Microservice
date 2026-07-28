'use client';

import { usePathname } from 'next/navigation';
import { PlusIcon } from '@/components/icons';
import Link from 'next/link';

export default function Navbar({ onMenuClick = () => {} }) {
  const pathname = usePathname();

  // Map routes to page titles
  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/entries/new': 'New Entry',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
    '/profile': 'Profile',
    '/graph': 'Decision Graph',
  };

  const title = pageTitles[pathname] || 'Page';

  return (
    <nav className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card px-4 sm:gap-3 sm:px-6 lg:px-8">
      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:bg-hover hover:text-primary lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Page Title */}
      <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-primary sm:text-xl">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* New Entry Button */}
      <Link
        href="/entries/new"
        aria-label="New entry"
        className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-accent/90 hover:shadow-md active:scale-95 sm:px-4"
      >
        <PlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">New</span>
      </Link>
    </nav>
  );
}
