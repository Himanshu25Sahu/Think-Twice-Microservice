'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEntries } from '@/redux/slices/entrySlice';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookIcon, ArrowLeftIcon } from '@/components/icons';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { entries, loading, filters, page, totalPages } = useSelector((state) => state.entries);
  const { activeOrg } = useSelector((state) => state.orgs);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (activeOrg) {
      dispatch(fetchEntries({ orgId: activeOrg, type: filterType !== 'all' ? filterType : undefined, page: 1 }));
    }
  }, [activeOrg, filterType, dispatch]);

  const types = ['all', 'architecture', 'debugging', 'feature', 'best-practice', 'incident'];

  return (
    <div className="space-y-6">
      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filterType === type
                ? 'bg-accent text-white'
                : 'bg-[#1a1a27] text-secondary hover:text-primary'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} count={3} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && (
        <Link href="/entries/new">
          <EmptyState
            icon={BookIcon}
            title="No entries yet"
            description={filterType === 'all' ? 'Start documenting decisions by creating your first entry.' : `No entries found for ${filterType}.`}
            buttonText="Create Entry"
            onButtonClick={() => {}}
          />
        </Link>
      )}

      {/* Entries Grid */}
      {!loading && entries.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => (
              <Link
                key={entry._id}
                href={`/entries/${entry._id}`}
                className="card-base group hover:border-accent transition"
              >
                {/* Type Badge */}
                <div className="flex items-start justify-between mb-3">
                  <Badge type={entry.type} />
                  <span className="text-xs text-secondary opacity-0 group-hover:opacity-100 transition">
                    <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-primary mb-2 line-clamp-2 group-hover:text-accent transition">
                  {entry.title}
                </h3>

                {/* Preview */}
                {entry.what && (
                  <p className="text-sm text-secondary mb-3 line-clamp-2">
                    {entry.what}
                  </p>
                )}

                {/* Tags */}
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {entry.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="tag-base">
                        {tag}
                      </span>
                    ))}
                    {entry.tags.length > 2 && (
                      <span className="tag-base">+{entry.tags.length - 2}</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-secondary border-t border-border pt-3">
                  <span>{entry.author?.name || 'Unknown'}</span>
                  <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                disabled={page === 1}
                onClick={() => dispatch(fetchEntries({ orgId: activeOrg, page: page - 1 }))}
                className="px-3 py-2 rounded border border-border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1a1a27] transition"
              >
                Previous
              </button>
              <span className="text-sm text-secondary">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => dispatch(fetchEntries({ orgId: activeOrg, page: page + 1 }))}
                className="px-3 py-2 rounded border border-border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1a1a27] transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
