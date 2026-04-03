'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEntries } from '@/redux/slices/entrySlice';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { entries, loading, page, totalPages } = useSelector((state) => state.entries);
  const { activeOrg } = useSelector((state) => state.orgs);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (activeOrg) {
      dispatch(fetchEntries({ orgId: activeOrg, type: filterType !== 'all' ? filterType : undefined, page: 1 }));
    }
  }, [activeOrg, filterType, dispatch]);

  // Filter entries based on search query
  const filteredEntries = entries.filter((entry) =>
    entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.what?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const types = ['all', 'architecture', 'debugging', 'feature', 'best-practice', 'incident'];

  const handleFilterChange = (type) => {
    setFilterType(type);
  };

  const handlePrevPage = () => {
    dispatch(fetchEntries({ orgId: activeOrg, type: filterType !== 'all' ? filterType : undefined, page: page - 1 }));
  };

  const handleNextPage = () => {
    dispatch(fetchEntries({ orgId: activeOrg, type: filterType !== 'all' ? filterType : undefined, page: page + 1 }));
  };

  return (
    <div className="space-y-8">
      {/* Header Section with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#e4e4e7] mb-2">Entries</h1>
          <p className="text-[#71717a] text-base">Manage and review your decision entries</p>
        </div>
        
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 px-4 py-2 text-sm bg-[#1a1a27] border border-[#1e1e2e] rounded-lg text-[#e4e4e7] placeholder-[#71717a] transition-all focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50 focus:border-[#6366f1]/50 hover:bg-[#12121a]"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pb-6 border-b border-[#1e1e2e]">
        {types.map((type) => {
          const isActive = filterType === type;
          const displayLabel = type === 'all' ? 'All Entries' : type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
          
          return (
            <button
              key={type}
              onClick={() => handleFilterChange(type)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-[#6366f1] text-white shadow-lg shadow-[#6366f1]/30'
                  : 'bg-[#12121a] text-[#71717a] border border-[#1e1e2e] hover:border-[#6366f1]/50 hover:text-[#e4e4e7] hover:bg-[#0a0a0f]'
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 h-48 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-5xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-[#e4e4e7] mb-2">
            {searchQuery ? 'No results found' : 'No entries yet'}
          </h3>
          <p className="text-[#71717a] mb-6">
            {searchQuery
              ? `Try adjusting your search for "${searchQuery}"`
              : filterType === 'all'
              ? 'Start documenting decisions by creating your first entry.'
              : `No entries found for ${filterType}.`}
          </p>
          {!searchQuery && (
            <Link
              href="/entries/new"
              className="px-4 py-2 rounded-lg bg-[#6366f1] text-white font-semibold hover:bg-[#818cf8] transition-all duration-200"
            >
              Create Entry
            </Link>
          )}
        </div>
      )}

      {/* Entries Grid */}
      {!loading && filteredEntries.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEntries.map((entry) => (
              <Link
                key={entry._id}
                href={`/entries/${entry._id}`}
                className="group"
              >
                <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 h-full flex flex-col hover:border-[#6366f1]/50 hover:bg-[#0f0f17] hover:shadow-xl hover:shadow-[#6366f1]/10 transition-all duration-300 cursor-pointer">
                  {/* Header with Badge and Icon */}
                  <div className="flex items-start justify-between mb-4">
                    <Badge type={entry.type} />
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#818cf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-lg text-[#e4e4e7] mb-3 line-clamp-2 group-hover:text-[#818cf8] transition-colors duration-200">
                    {entry.title}
                  </h3>

                  {/* Preview */}
                  {entry.what && (
                    <p className="text-sm text-[#71717a] mb-4 line-clamp-2 group-hover:text-[#a1a1a8] transition-colors duration-200">
                      {entry.what}
                    </p>
                  )}

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 flex-1">
                      {entry.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#0a0a0f] text-[#a1a1a8] border border-[#1e1e2e] group-hover:border-[#6366f1]/30 transition-colors duration-200"
                        >
                          {tag}
                        </span>
                      ))}
                      {entry.tags.length > 2 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#0a0a0f] text-[#a1a1a8] border border-[#1e1e2e]">
                          +{entry.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-[#71717a] border-t border-[#1e1e2e] pt-4 mt-auto group-hover:border-[#6366f1]/30 transition-colors duration-200">
                    <span className="font-semibold text-[#a1a1a8]">{entry.authorName || 'Unknown'}</span>
                    <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-12 pt-6 border-t border-[#1e1e2e]">
              <button
                disabled={page === 1}
                onClick={handlePrevPage}
                className="px-4 py-2.5 rounded-lg border border-[#1e1e2e] text-sm font-semibold text-[#71717a] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:border-[#6366f1]/50 hover:enabled:text-[#e4e4e7] hover:enabled:bg-[#12121a] transition-all duration-200"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#e4e4e7]">{page}</span>
                <span className="text-[#71717a] text-sm">of</span>
                <span className="text-sm font-semibold text-[#e4e4e7]">{totalPages}</span>
              </div>
              <button
                disabled={page === totalPages}
                onClick={handleNextPage}
                className="px-4 py-2.5 rounded-lg border border-[#1e1e2e] text-sm font-semibold text-[#71717a] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:border-[#6366f1]/50 hover:enabled:text-[#e4e4e7] hover:enabled:bg-[#12121a] transition-all duration-200"
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