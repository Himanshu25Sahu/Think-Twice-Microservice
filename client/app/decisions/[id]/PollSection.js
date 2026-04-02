'use client';

import React, { useState, useEffect } from 'react';
import { decisionService } from '../../../services/decisionService';

export default function PollSection({ decision, currentUserId }) {
  const [voteCounts, setVoteCounts]   = useState({});
  const [userVote, setUserVote]       = useState(null);
  const [voting, setVoting]           = useState(false);
  const [error, setError]             = useState(null);
  const [hasVoted, setHasVoted]       = useState(false);

  // On mount: calculate vote counts from model's pollVoteCounts virtual
  // and check if current user has already voted
  useEffect(() => {
    if (!decision?.poll?.enabled) return;

    // Build vote counts from existing votes array
    const counts = {};
    decision.options.forEach(opt => {
      counts[opt._id.toString()] = 0;
    });
    decision.poll.votes?.forEach(vote => {
      const key = vote.optionId.toString();
      if (counts[key] !== undefined) counts[key]++;
    });
    setVoteCounts(counts);

    // Check if current user already voted
    const existingVote = decision.poll.votes?.find(
      v => v.user?._id?.toString() === currentUserId ||
           v.user?.toString()      === currentUserId
    );
    if (existingVote) {
      setUserVote(existingVote.optionId.toString());
      setHasVoted(true);
    }
  }, [decision, currentUserId]);

  if (!decision?.poll?.enabled) return null;

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  const handleVote = async (optionId) => {
    if (voting) return;
    setError(null);

    // Optimistic update
    const previousCounts = { ...voteCounts };
    const previousVote   = userVote;

    const newCounts = { ...voteCounts };

    // Remove previous vote count if changing vote
    if (previousVote && previousVote !== optionId) {
      newCounts[previousVote] = Math.max(0, (newCounts[previousVote] || 0) - 1);
    }
    // Add new vote count only if it's a new vote (not same option again)
    if (previousVote !== optionId) {
      newCounts[optionId] = (newCounts[optionId] || 0) + 1;
    }

    setVoteCounts(newCounts);
    setUserVote(optionId);
    setHasVoted(true);

    try {
      setVoting(true);
      const response = await decisionService.votePoll(decision._id, optionId);

      if (response.success) {
        // Use server-confirmed counts
        setVoteCounts(response.data.voteCounts);
        setUserVote(response.data.userVote);
      } else {
        throw new Error(response.message || 'Vote failed');
      }
    } catch (err) {
      // Rollback optimistic update on failure
      setVoteCounts(previousCounts);
      setUserVote(previousVote);
      setHasVoted(!!previousVote);
      setError(err.message || 'Failed to record vote. Try again.');
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-6 mb-8 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-white">Community Poll</h2>
        <span className="text-gray-500 text-sm">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Poll options */}
      <div className="space-y-3">
        {decision.options.map((option) => {
          const optId      = option._id.toString();
          const count      = voteCounts[optId] ?? 0;
          const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isSelected = userVote === optId;

          return (
            <button
              key={optId}
              onClick={() => handleVote(optId)}
              disabled={voting}
              className={`
                w-full text-left rounded-lg border transition-all duration-200
                ${voting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-700 bg-gray-800/40 hover:border-gray-500 hover:bg-gray-800/70'
                }
              `}
            >
              <div className="px-4 py-3">
                {/* Option title row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Selected indicator */}
                    <div className={`
                      w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}
                    `}>
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className={`font-medium text-sm ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                      {option.title}
                    </span>
                  </div>

                  {/* Show percentage only after voting */}
                  {hasVoted && (
                    <span className="text-gray-400 text-xs font-medium ml-2 flex-shrink-0">
                      {percentage}%
                    </span>
                  )}
                </div>

                {/* Progress bar — only visible after voting */}
                {hasVoted && (
                  <div className="w-full bg-gray-700/60 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-500 ${
                        isSelected ? 'bg-blue-500' : 'bg-gray-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-gray-600 text-xs mt-4">
        {hasVoted
          ? 'You can change your vote by selecting another option.'
          : 'Vote to see results.'}
      </p>
    </div>
  );
}