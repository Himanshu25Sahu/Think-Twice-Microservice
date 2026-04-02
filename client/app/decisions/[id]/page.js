"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { decisionService } from "../../../services/decisionService";
import { format } from "date-fns";
import { useSelector } from "react-redux";

export default function DecisionDetailPage() {
  const params = useParams();
  const id = params.id;
  const [decision, setDecision] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Poll state
  const [voteCounts, setVoteCounts] = useState({});
  const [userVote, setUserVote] = useState(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);

  const { userData } = useSelector((state) => state.user);

  useEffect(() => {
    const fetchDecision = async () => {
      try {
        setLoading(true);
        if (id) {
          const response = await decisionService.getDecision(id);
          if (response.success) {
            const dec = response.data.decision;
            setDecision(dec);
            setComments(dec.comments || []);

            // Build initial vote counts
            const counts = {};
            dec.options?.forEach((opt) => {
              counts[opt._id.toString()] = 0;
            });
            dec.poll?.votes?.forEach((vote) => {
              const key = vote.optionId?.toString();
              if (key && counts[key] !== undefined) counts[key]++;
            });
            setVoteCounts(counts);

            // Check if current user already voted
            if (userData?._id) {
              const existing = dec.poll?.votes?.find(
                (v) =>
                  v.user?._id?.toString() === userData._id ||
                  v.user?.toString() === userData._id
              );
              if (existing) {
                setUserVote(existing.optionId?.toString());
                setHasVoted(true);
              }
            }
          }
        }
      } catch (err) {
        setError(err.message || "Failed to load decision");
      } finally {
        setLoading(false);
      }
    };

    fetchDecision();
  }, [id, userData?._id]);

  const handleVote = async (optionId) => {
    if (voting) return;
    setVoteError(null);

    console.log("Voting for option:", optionId);
    console.log("Decision ID:", decision._id);
    console.log("User:", userData?._id);

    // Optimistic update
    const prevCounts = { ...voteCounts };
    const prevVote = userVote;

    const newCounts = { ...voteCounts };
    if (prevVote && prevVote !== optionId) {
      newCounts[prevVote] = Math.max(0, (newCounts[prevVote] || 0) - 1);
    }
    if (prevVote !== optionId) {
      newCounts[optionId] = (newCounts[optionId] || 0) + 1;
    }

    setVoteCounts(newCounts);
    setUserVote(optionId);
    setHasVoted(true);
    setVoting(true);

    try {
      const response = await decisionService.votePoll(decision._id, optionId);
      console.log("Vote response:", response);

      if (response.success) {
        setVoteCounts(response.data.voteCounts);
        setUserVote(response.data.userVote);
      } else {
        throw new Error(response.message || "Vote failed");
      }
    } catch (err) {
      console.error("Vote error:", err);
      // Rollback
      setVoteCounts(prevCounts);
      setUserVote(prevVote);
      setHasVoted(!!prevVote);
      setVoteError(err.response?.data?.message || err.message || "Failed to vote. Try again.");
    } finally {
      setVoting(false);
    }
  };

  const confidenceColor = {
    low: "text-red-400",
    medium: "text-yellow-400",
    high: "text-green-400",
  };

  const getConfidenceLevel = (confidence) => {
    if (confidence >= 70) return "high";
    if (confidence >= 40) return "medium";
    return "low";
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (error)
    return <div className="p-8 text-center text-red-400">Error: {error}</div>;
  if (!decision)
    return <div className="p-8 text-center text-gray-400">Decision not found.</div>;

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const pollEnabled = decision.poll?.enabled === true;

  return (
    <div className="min-h-screen bg-[#0d0d0d] p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {decision.title}
              </h1>
              <div className="flex items-center space-x-4 text-gray-400 text-sm">
                <span>{format(new Date(decision.createdAt), "MMM dd, yyyy")}</span>
                <span className={`font-semibold ${confidenceColor[getConfidenceLevel(decision.confidenceLevel)]}`}>
                  {getConfidenceLevel(decision.confidenceLevel)} confidence
                </span>
                <span className="bg-gray-800 px-3 py-1 rounded-full">
                  {decision.category}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold">
              {decision.user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">

            {/* Description */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 mb-8 border border-gray-800">
              <h2 className="text-xl font-semibold text-white mb-2">Decision</h2>
              <p className="text-gray-400">{decision.description}</p>
            </div>

            {/* Options */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 mb-8 border border-gray-800">
              <h2 className="text-xl font-semibold text-white mb-4">Options Considered</h2>
              <div className="space-y-3">
                {decision.options?.map((option, idx) => (
                  <div key={idx} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{option.title}</h3>
                        {option.pros && option.pros.length > 0 && (
                          <div className="mt-2">
                            <p className="text-green-400 text-sm font-medium">Pros:</p>
                            <ul className="text-gray-400 text-sm list-disc list-inside">
                              {option.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                            </ul>
                          </div>
                        )}
                        {option.cons && option.cons.length > 0 && (
                          <div className="mt-2">
                            <p className="text-red-400 text-sm font-medium">Cons:</p>
                            <ul className="text-gray-400 text-sm list-disc list-inside">
                              {option.cons.map((con, i) => <li key={i}>{con}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── POLL SECTION ── */}
            {pollEnabled ? (
              <div className="bg-[#1a1a1a] rounded-lg p-6 mb-8 border border-gray-800">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-semibold text-white">Community Poll</h2>
                  <span className="text-gray-500 text-sm">
                    {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                  </span>
                </div>

                {voteError && (
                  <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
                    {voteError}
                  </div>
                )}

                <div className="space-y-3">
                  {decision.options?.map((option) => {
                    const optId = option._id.toString();
                    const count = voteCounts[optId] ?? 0;
                    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const isSelected = userVote === optId;

                    return (
                      <button
                        key={optId}
                        type="button"
                        onClick={() => handleVote(optId)}
                        disabled={voting}
                        style={{ cursor: voting ? "not-allowed" : "pointer" }}
                        className={[
                          "w-full text-left rounded-lg border transition-all duration-200 block",
                          voting ? "opacity-60" : "hover:border-gray-500",
                          isSelected
                            ? "border-blue-500 bg-blue-900/20"
                            : "border-gray-700 bg-gray-800/40",
                        ].join(" ")}
                      >
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {/* Radio circle */}
                              <div
                                className={[
                                  "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                  isSelected ? "border-blue-500 bg-blue-500" : "border-gray-500",
                                ].join(" ")}
                              >
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                              <span className={`text-sm font-medium ${isSelected ? "text-blue-300" : "text-white"}`}>
                                {option.title}
                              </span>
                            </div>
                            {hasVoted && (
                              <span className="text-gray-400 text-xs ml-2 flex-shrink-0">
                                {percentage}%
                              </span>
                            )}
                          </div>

                          {/* Progress bar — only after voting */}
                          {hasVoted && (
                            <div className="w-full bg-gray-700/60 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full transition-all duration-500 ${
                                  isSelected ? "bg-blue-500" : "bg-gray-500"
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

                <p className="text-gray-600 text-xs mt-4">
                  {hasVoted
                    ? "You can change your vote by selecting another option."
                    : "Vote to see results."}
                </p>
              </div>
            ) : (
              // Debug: show why poll isn't rendering
              <div className="bg-[#1a1a1a] rounded-lg p-4 mb-8 border border-gray-800">
                <p className="text-gray-500 text-sm">
                  Poll not enabled for this decision.{" "}
                  <span className="text-gray-600">
                    (poll.enabled = {String(decision.poll?.enabled)})
                  </span>
                </p>
              </div>
            )}

            {/* Comments Section */}
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
              <h2 className="text-xl font-semibold text-white mb-4">
                Comments ({comments.length})
              </h2>
              {comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment, idx) => (
                    <div key={idx} className="border-l-2 border-gray-700 pl-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs">
                          {comment.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <span className="text-white font-medium text-sm">
                          {comment.user?.name || "Anonymous"}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {format(new Date(comment.createdAt), "MMM dd, yyyy")}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-2">{comment.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No comments yet.</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-2">Expected Outcome</h3>
              <p className="text-gray-400 text-sm">
                {decision.expectedOutcome || "Not specified"}
              </p>
            </div>

            <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-2">Review Date</h3>
              <p className="text-gray-400 text-sm">
                {format(new Date(decision.reviewDate), "MMM dd, yyyy")}
              </p>
            </div>

            {decision.tags && decision.tags.length > 0 && (
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {decision.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}