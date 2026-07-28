'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import AuthGuard from '@/components/guards/AuthGuard';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // Prevent the page behind the drawer from scrolling while it's open.
  useEffect(() => {
    if (!isSidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isSidebarOpen]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-primary">
        {/* Sidebar — fixed rail on desktop, off-canvas drawer on mobile */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main content area */}
        <div className="flex min-h-screen min-w-0 flex-col lg:ml-60">
          <Navbar onMenuClick={() => setIsSidebarOpen(true)} />

          {/* Page content */}
          <main className="min-w-0 flex-1">
            <div className="p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
