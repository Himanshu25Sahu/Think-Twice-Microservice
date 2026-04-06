'use client';
import { Skeleton } from './Skeleton';

export function ProfileSkeleton() {
  return (
    <div className="pf-outer">
      <div className="pf-root">
        {/* Profile card skeleton */}
        <div className="pf-card">
          <div className="pf-card-inner">
            <div className="pf-profile-row">
              <Skeleton className="pf-avatar" />
              <div style={{ flex: 1 }}>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="pf-card">
          <div className="pf-card-inner" style={{ paddingBottom: '1.125rem' }}>
            <Skeleton className="h-4 w-16 mb-4" />
          </div>
          <div className="pf-stats-grid">
            {[...Array(4)].map((_, i) => (
              <div className="pf-stat-cell" key={i}>
                <Skeleton className="h-3 w-12 mb-2" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        </div>
        {/* Entries skeleton */}
        <div className="pf-card">
          <div className="pf-card-inner">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="pf-entries-list">
              {[...Array(3)].map((_, i) => (
                <div className="pf-entry-row" key={i} style={{ alignItems: 'center', gap: '0.875rem', display: 'flex' }}>
                  <Skeleton className="pf-entry-type-dot" />
                  <div className="pf-entry-body" style={{ flex: 1, minWidth: 0 }}>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-4 w-8 mr-2" />
                  <Skeleton className="h-4 w-8 mr-2" />
                  <Skeleton className="pf-entry-pill w-16 h-5" />
                  <Skeleton className="pf-entry-arrow w-5 h-5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
