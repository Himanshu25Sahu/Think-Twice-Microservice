'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { HomeIcon, UserIcon, BookIcon, ChartIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import api from '@/services/api';

export default function AnalyticsPage() {
  const { activeOrg } = useSelector((state) => state.orgs);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/analytics/org/${activeOrg}`);
        setMetrics(response.data);
      } catch (err) {
        setError('Failed to load analytics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (activeOrg) {
      fetchMetrics();
    }
  }, [activeOrg]);

  if (loading) {
    return <Skeleton count={4} />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const stats = [
    {
      icon: BookIcon,
      label: 'Total Entries',
      value: metrics?.totalEntries || 0,
      color: 'indigo',
    },
    {
      icon: UserIcon,
      label: 'Team Members',
      value: metrics?.teamMembers || 0,
      color: 'cyan',
    },
    {
      icon: ChartIcon,
      label: 'Your Entries',
      value: metrics?.yourEntries || 0,
      color: 'amber',
    },
    {
      icon: HomeIcon,
      label: 'This Week',
      value: metrics?.thisWeek || 0,
      color: 'green',
    },
  ];

  const colorMap = {
    indigo: 'bg-indigo-600/10 border-indigo-600/20 text-indigo-400',
    cyan: 'bg-cyan-600/10 border-cyan-600/20 text-cyan-400',
    amber: 'bg-amber-600/10 border-amber-600/20 text-amber-400',
    green: 'bg-green-600/10 border-green-600/20 text-green-400',
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClass = colorMap[stat.color];
          return (
            <div
              key={stat.label}
              className={`card-base border ${colorClass} p-4`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-secondary mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-primary">{stat.value}</p>
                </div>
                <Icon className="w-8 h-8 opacity-50" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Entry Types Breakdown */}
      {metrics?.byType && Object.keys(metrics.byType).length > 0 && (
        <div className="card-base">
          <h3 className="text-lg font-semibold text-primary mb-4">Entries by Type</h3>
          <div className="space-y-3">
            {Object.entries(metrics.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-secondary capitalize">
                  {type.replace('-', ' ')}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-[#1a1a27] rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: `${
                          ((count / (metrics?.totalEntries || 1)) * 100) || 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-primary font-semibold w-12 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Contributors */}
      {metrics?.topContributors && metrics.topContributors.length > 0 && (
        <div className="card-base">
          <h3 className="text-lg font-semibold text-primary mb-4">Top Contributors</h3>
          <div className="space-y-3">
            {metrics.topContributors.map((contributor, idx) => (
              <div
                key={contributor._id}
                className="flex items-center gap-3 p-3 rounded hover:bg-[#1a1a27] transition"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center">
                  <span className="font-semibold text-indigo-400 text-sm">
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-primary font-medium truncate">
                    {contributor.name}
                  </p>
                  <p className="text-xs text-secondary">{contributor.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-accent">
                    {contributor.count}
                  </span>
                  <p className="text-xs text-secondary">entries</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Message */}
      {!metrics || Object.keys(metrics).length === 0 && (
        <div className="card-base text-center py-12">
          <p className="text-secondary">
            No analytics data available yet. Start creating entries to see metrics!
          </p>
        </div>
      )}
    </div>
  );
}
