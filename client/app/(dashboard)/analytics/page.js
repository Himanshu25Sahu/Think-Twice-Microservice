'use client';

import { useEffect, useState } from 'react';
import { useSelector,useDispatch } from 'react-redux';
import { HomeIcon, UserIcon, BookIcon, ChartIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchOrgDetails } from '@/redux/slices/orgSlice';
import api from '@/services/api';

export default function AnalyticsPage() {
  const { activeOrg } = useSelector((state) => state.orgs);
  const { activeProject } = useSelector((state) => state.projects);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const { orgDetails } = useSelector((state) => state.orgs);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (activeOrg) {
      dispatch(fetchOrgDetails(activeOrg));
    }

  }, [activeOrg, dispatch]);

  const getMemberName = (userId) => {
    if (userId === user?._id) {
      return `${user?.name} (You)`;
    }
    const member = orgDetails?.members.find((m) => m.userId === userId);
    return member?.name || `User ...${userId?.slice(-6)}`;
  };


  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const projectQuery = activeProject ? `?projectId=${activeProject}` : '';
        const response = await api.get(`/analytics/org/${activeOrg}${projectQuery}`);
        setMetrics(response.data.data);
      } catch (err) {
        setError('Failed to load analytics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (activeOrg) {
      fetchMetrics();
    } else {
      setLoading(false);
    }
  }, [activeOrg, activeProject]);

  const getTopCategory = () => {
    if (!metrics?.entriesByType) return '-';
    const entries = Object.entries(metrics.entriesByType);
    const top = entries.sort((a, b) => b[1] - a[1])[0];
    return top && top[1] > 0 ? top[0].replace('-', ' ') : '-';
  };
  
  const getThisWeek = () => metrics?.weeklyActivity?.slice(-1)[0]?.count || 0;

  if (loading) {
    return <Skeleton count={4} />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
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
      value: metrics?.totalMembers || 0,
      color: 'cyan',
    },
    {
      icon: ChartIcon,
      label: 'Top Category',
      value: getTopCategory(),
      color: 'amber',
    },
    {
      icon: HomeIcon,
      label: 'This Week',
      value: getThisWeek(),
      color: 'green',
    },
  ];

  const colorMap = {
    indigo: 'bg-blue-600/10 border-blue-600/20 text-blue-700',
    cyan: 'bg-cyan-600/10 border-cyan-600/20 text-cyan-700',
    amber: 'bg-amber-600/10 border-amber-600/20 text-amber-700',
    green: 'bg-green-600/10 border-green-600/20 text-green-700',
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClass = colorMap[stat.color];
          return (
            <div
              key={stat.label}
              className={`card-base border ${colorClass} p-3 sm:p-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="mb-1 text-xs text-secondary sm:text-sm">{stat.label}</p>
                  <p className="truncate text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
                </div>
                <Icon className="h-6 w-6 shrink-0 opacity-50 sm:h-8 sm:w-8" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Entry Types Breakdown */}
      {metrics?.entriesByType && Object.keys(metrics.entriesByType).length > 0 && (
        <div className="card-base">
          <h3 className="text-lg font-semibold text-primary mb-4">Entries by Type</h3>
          <div className="space-y-3">
            {Object.entries(metrics.entriesByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between gap-3">
                <span className="min-w-0 shrink truncate text-sm capitalize text-secondary sm:text-base">
                  {type.replace('-', ' ')}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <div className="h-2 w-full max-w-[8rem] shrink rounded-full bg-[#F2EEE4]">
                    <div
                      className="h-2 rounded-full bg-[#2563EB]"
                      style={{
                        width: `${
                          ((count / (metrics?.totalEntries || 1)) * 100) || 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-semibold text-primary sm:w-12">
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
                key={contributor.userId}
                className="flex items-center gap-3 rounded p-2 transition hover:bg-[#F2EEE4] sm:p-3"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600/15">
                  <span className="font-semibold text-blue-700 text-sm">
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-primary sm:text-base">
                    {getMemberName(contributor.userId)}{contributor.userId === user?._id ? ' (You)' : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
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
