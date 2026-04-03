'use client';

import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import AuthGuard from '@/components/guards/AuthGuard';

export default function DashboardLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-primary">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-col flex-1 ml-64">
          {/* Navbar */}
          <Navbar />

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
