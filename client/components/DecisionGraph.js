'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fetchGraph, addRelation, removeRelation } from '@/services/graphService';

const RELATION_COLORS = {
  impacts: '#ef4444',
  depends_on: '#3b82f6',
  replaces: '#f59e0b',
  related_to: '#8b5cf6',
  blocks: '#ec4899',
};

const RELATION_LABELS = {
  impacts: 'Impacts',
  depends_on: 'Depends On',
  replaces: 'Replaces',
  related_to: 'Related To',
  blocks: 'Blocks',
};

function Node({ data }) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 bg-white border-[#E7E2D6] shadow-[0_8px_24px_rgba(24,24,27,0.08)]">
      <Handle type="target" position={Position.Top} />
      <div className="text-xs font-bold text-[#71717A] mb-1">{data.type}</div>
      <div className="text-sm text-[#18181B] font-medium truncate max-w-xs">{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = {
  default: Node,
};

const edgeOptions = {
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed },
};

const normalizeProjectId = (project) => (typeof project === 'object' ? project?._id : project);

/**
 * Lay out nodes by connected component rather than by array index.
 *
 * A grid keyed on index ignores the edges entirely, so related entries land
 * arbitrarily far apart and the result reads as a wall of unrelated boxes —
 * which is the opposite of what a decision graph is for. Grouping each
 * connected component into its own cluster keeps edges short and makes the
 * structure legible at a glance.
 */
const layoutNodesClustered = (nodes = [], edges = []) => {
  if (!nodes.length) {
    return [];
  }

  const ids = new Set(nodes.map((n) => n.id));
  const neighbours = new Map(nodes.map((n) => [n.id, []]));
  edges.forEach((edge) => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return;
    neighbours.get(edge.source).push(edge.target);
    neighbours.get(edge.target).push(edge.source);
  });

  // Breadth-first sweep to collect connected components.
  const seen = new Set();
  const components = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const queue = [node.id];
    const group = [];
    seen.add(node.id);
    while (queue.length) {
      const current = queue.shift();
      group.push(current);
      for (const next of neighbours.get(current) || []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    components.push(group);
  }

  // Biggest clusters first: the interesting structure should be what you land
  // on, not something you have to hunt for.
  components.sort((a, b) => b.length - a.length);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const positioned = [];

  // A node box is roughly this wide. The ring has to be big enough that
  // neighbouring boxes do not touch, otherwise they overlap and cover the very
  // edges the graph exists to show.
  const NODE_FOOTPRINT = 270;
  const ringRadius = (count) =>
    count < 2 ? 0 : Math.max(190, (count * NODE_FOOTPRINT) / (2 * Math.PI));

  const largestRadius = components.reduce(
    (max, group) => Math.max(max, ringRadius(group.length)),
    0
  );
  const clusterGap = largestRadius * 2 + 320;
  const perRow = Math.max(1, Math.ceil(Math.sqrt(components.length)));

  components.forEach((group, index) => {
    const originX = 120 + (index % perRow) * clusterGap;
    const originY = 120 + Math.floor(index / perRow) * clusterGap;

    if (group.length === 1) {
      positioned.push({ ...byId.get(group[0]), position: { x: originX, y: originY } });
      return;
    }

    // Ring layout inside a cluster: every member stays equidistant from the
    // centre, so edges within the cluster are short and do not cross the canvas.
    const radius = ringRadius(group.length);
    group.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      positioned.push({
        ...byId.get(id),
        position: {
          x: originX + radius * Math.cos(angle),
          y: originY + radius * Math.sin(angle),
        },
      });
    });
  });

  return positioned;
};

const styleEdges = (edges = []) => {
  return edges.map((edge) => {
    const edgeColor = RELATION_COLORS[edge.data?.type] || '#94a3b8';
    return {
      ...edge,
      ...edgeOptions,
      style: {
        stroke: edgeColor,
        strokeWidth: 2,
      },
    };
  });
};

export default function DecisionGraph() {
  const { activeOrg } = useSelector((state) => state.orgs);
  const { activeProject } = useSelector((state) => state.projects);
  const projectId = normalizeProjectId(activeProject);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const [isCreatingRelation, setIsCreatingRelation] = useState(false);
  const [relationSourceId, setRelationSourceId] = useState('');
  const [relationTargetId, setRelationTargetId] = useState('');
  const [relationType, setRelationType] = useState('impacts');
  const [isSubmittingRelation, setIsSubmittingRelation] = useState(false);
  const [isDeletingRelation, setIsDeletingRelation] = useState(false);
  const [relationError, setRelationError] = useState('');
  const [relationSuccess, setRelationSuccess] = useState('');
  const [selectedEdge, setSelectedEdge] = useState(null);
  // Below `lg` the side panel is an overlay sheet so the canvas keeps the full width.
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const filteredEdges = useMemo(() => {
    if (filterType === 'all') {
      return allEdges;
    }
    return allEdges.filter((edge) => edge.data?.type === filterType);
  }, [allEdges, filterType]);

  const nodeOptions = useMemo(() => {
    return allNodes
      .map((node) => ({ id: node.id, label: node.data?.label || 'Untitled' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allNodes]);

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) {
      return [];
    }
    return filteredEdges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id);
  }, [filteredEdges, selectedNode]);

  const renderedNodes = useMemo(() => {
    return allNodes.map((node) => {
      if (!isCreatingRelation) {
        return node;
      }

      const isSource = node.id === relationSourceId;
      const isTarget = node.id === relationTargetId;

      return {
        ...node,
        style: {
          ...node.style,
          border: isSource ? '2px solid #16A34A' : isTarget ? '2px solid #2563EB' : undefined,
          boxShadow: isSource
            ? '0 0 0 3px rgba(22,163,74,0.20)'
            : isTarget
              ? '0 0 0 3px rgba(37,99,235,0.18)'
              : undefined,
        },
      };
    });
  }, [allNodes, isCreatingRelation, relationSourceId, relationTargetId]);

  const loadGraph = useCallback(async () => {
    if (!activeOrg || !activeProject) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchGraph(activeOrg, activeProject);
      const layoutedNodes = layoutNodesClustered(data.nodes || [], data.edges || []);
      const styledEdges = styleEdges(data.edges || []);

      setAllNodes(layoutedNodes);
      setAllEdges(styledEdges);
    } catch {
      setError('Failed to load decision graph');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, activeProject]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    setNodes(renderedNodes);
  }, [renderedNodes, setNodes]);

  useEffect(() => {
    setEdges(filteredEdges);
  }, [filteredEdges, setEdges]);

  const createNewRelation = useCallback(async (sourceOverride, targetOverride) => {
    const sourceId = sourceOverride || relationSourceId;
    const targetId = targetOverride || relationTargetId;

    if (!sourceId || !targetId) {
      setRelationError('Select both source and target entries.');
      return;
    }

    if (sourceId === targetId) {
      setRelationError('Source and target must be different entries.');
      return;
    }

    const relationAlreadyExists = allEdges.some(
      (edge) => edge.source === sourceId && edge.target === targetId && edge.data?.type === relationType
    );

    if (relationAlreadyExists) {
      setRelationError('This relation already exists.');
      return;
    }

    try {
      setIsSubmittingRelation(true);
      setRelationError('');
      setRelationSuccess('');

      await addRelation(sourceId, targetId, relationType, activeOrg, activeProject);
      await loadGraph();

      // Keep create mode active and chain from last target for faster mapping.
      setRelationSourceId(targetId);
      setRelationTargetId('');
      setRelationSuccess('Relation created.');
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setRelationError(apiMessage || 'Failed to create relation. Please retry.');
    } finally {
      setIsSubmittingRelation(false);
    }
  }, [relationSourceId, relationTargetId, allEdges, relationType, activeOrg, activeProject, loadGraph]);

  const deleteExistingRelation = useCallback(async (edge) => {
    try {
      setIsDeletingRelation(true);
      setRelationError('');
      setRelationSuccess('');

      await removeRelation(edge.source, edge.target, activeOrg, activeProject);
      await loadGraph();
      setSelectedEdge(null);

      setRelationSuccess('Relation deleted.');
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setRelationError(apiMessage || 'Failed to delete relation. Please retry.');
    } finally {
      setIsDeletingRelation(false);
    }
  }, [activeOrg, activeProject, loadGraph]);

  const handleNodeClick = useCallback((event, node) => {
    setSelectedEdge(null);
    setSelectedNode(node);
    setIsPanelOpen(true);

    if (!isCreatingRelation || isSubmittingRelation) {
      return;
    }

    setRelationError('');

    if (!relationSourceId) {
      setRelationSourceId(node.id);
      setRelationTargetId('');
      return;
    }

    if (relationSourceId === node.id) {
      setRelationSourceId('');
      setRelationTargetId('');
      return;
    }

    setRelationTargetId(node.id);
    createNewRelation(relationSourceId, node.id);
  }, [isCreatingRelation, isSubmittingRelation, relationSourceId, createNewRelation]);

  const handleEdgeClick = useCallback((event, edge) => {
    event?.stopPropagation?.();
    setSelectedEdge(edge);
  }, []);

  const clearGraphSelection = useCallback(() => {
    setSelectedEdge(null);
  }, []);

  // Fill the viewport below the sticky navbar, minus the page gutters.
  const shellHeight = 'h-[calc(100dvh-6rem)] min-h-[26rem] sm:h-[calc(100dvh-7rem)]';

  if (loading) {
    return (
      <div className={`w-full ${shellHeight} bg-[#FCFBF7] flex items-center justify-center`}>
        <div className="text-[#3F3F46] text-center">
          <div className="animate-spin text-2xl mb-4">⚙️</div>
          <p>Loading decision graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full ${shellHeight} bg-[#FCFBF7] flex items-center justify-center px-4`}>
        <div className="text-[#71717A] text-center">
          <p className="mb-2">❌ {error}</p>
          <Link href="/login" className="text-[#2563EB] hover:underline text-sm">
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex w-full ${shellHeight} flex-col overflow-hidden rounded-xl border border-[#E7E2D6] bg-[#FCFBF7] lg:flex-row`}>
      <div className="relative min-h-0 min-w-0 flex-1">
        {selectedEdge && (
          <div className="absolute top-3 left-3 right-3 z-20 max-w-xs bg-white/95 border border-[#E7E2D6] rounded-lg px-3 py-2 text-xs text-[#3F3F46] shadow-[0_8px_24px_rgba(24,24,27,0.08)] sm:right-auto">
            <div className="mb-2">
              Selected relation: <span className="font-semibold">{RELATION_LABELS[selectedEdge.data?.type] || selectedEdge.data?.type}</span>
            </div>
            <button
              onClick={() => deleteExistingRelation(selectedEdge)}
              disabled={isDeletingRelation || isSubmittingRelation}
              className="bg-red-600 hover:bg-red-700 text-white rounded px-2.5 py-1 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeletingRelation ? 'Deleting...' : 'Delete relation'}
            </button>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={clearGraphSelection}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          // onlyRenderVisibleElements culls edges whose endpoints sit outside
          // the viewport, which makes connections vanish while panning. The
          // node count is capped server-side, so the culling buys nothing.
          minZoom={0.05}
          maxZoom={1.8}
        >
          <Background className="bg-[#FCFBF7]" color="#E7E2D6" />
          <Controls className="bg-white border-[#E7E2D6]" />
          {/* The minimap eats too much of a phone screen to be useful. */}
          <MiniMap className="hidden bg-white border-[#E7E2D6] sm:block" maskColor="rgba(242,238,228,0.6)" nodeColor="#D0C9BA" />
        </ReactFlow>

        {/* Mobile sheet toggle */}
        <button
          type="button"
          onClick={() => setIsPanelOpen((open) => !open)}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(24,24,27,0.18)] lg:hidden"
        >
          {isPanelOpen ? 'Hide details' : 'Details & filters'}
        </button>
      </div>

      {/* Side panel: bottom sheet under `lg`, permanent column at `lg` and up */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 max-h-[75%] overflow-y-auto overscroll-contain border-t border-[#E7E2D6] bg-white transition-transform duration-300 lg:static lg:h-full lg:max-h-none lg:w-80 lg:flex-shrink-0 lg:translate-y-0 lg:border-l lg:border-t-0 ${
          isPanelOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-4 border-b border-[#E7E2D6] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#18181B] sm:text-xl">Decision Graph</h2>
            <button
              type="button"
              onClick={() => setIsPanelOpen(false)}
              aria-label="Close panel"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7E2D6] text-[#71717A] hover:bg-[#F2EEE4] hover:text-[#18181B] lg:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 sm:gap-4">
            <div className="bg-[#F2EEE4] p-4 rounded-lg">
              <div className="text-2xl font-bold text-[#18181B]">{allNodes.length}</div>
              <div className="text-xs text-[#71717A] mt-1">Decisions</div>
            </div>
            <div className="bg-[#F2EEE4] p-4 rounded-lg">
              <div className="text-2xl font-bold text-[#18181B]">{filteredEdges.length}</div>
              <div className="text-xs text-[#71717A] mt-1">Relations</div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-[#3F3F46] mb-3 uppercase">
              Filter Relations
            </label>
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 p-2 hover:bg-[#F2EEE4] rounded cursor-pointer"
                onClick={() => setFilterType('all')}
              >
                <div className="w-3 h-3 rounded-full bg-[#A1A1AA]"></div>
                <span className={`text-sm ${filterType === 'all' ? 'text-[#18181B] font-semibold' : 'text-[#71717A]'}`}>
                  All Relations
                </span>
              </div>
              {Object.entries(RELATION_COLORS).map(([key, color]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 hover:bg-[#F2EEE4] rounded cursor-pointer"
                  onClick={() => setFilterType(key)}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className={`text-sm ${filterType === key ? 'text-[#18181B] font-semibold' : 'text-[#71717A]'}`}>
                    {RELATION_LABELS[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 pb-6 border-t border-[#E7E2D6] pt-6">
            {!isCreatingRelation ? (
              <button
                onClick={() => {
                  setIsCreatingRelation(true);
                  setRelationSourceId('');
                  setRelationTargetId('');
                  setRelationError('');
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold transition-colors"
              >
                ➕ Create Relation
              </button>
            ) : (
              <div className="bg-[#F2EEE4] p-4 rounded-lg">
                {relationError && (
                  <div className="mb-3 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs rounded p-2">
                    {relationError}
                  </div>
                )}

                {relationSuccess && (
                  <div className="mb-3 bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] text-xs rounded p-2">
                    {relationSuccess}
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-[#3F3F46] mb-2 uppercase">
                    Relation Type
                  </label>
                  <select
                    value={relationType}
                    onChange={(e) => setRelationType(e.target.value)}
                    className="w-full bg-white border border-[#E7E2D6] text-[#18181B] px-3 py-2 rounded text-sm focus:outline-none focus:border-[#2563EB]"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    {Object.entries(RELATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3 text-xs text-[#3F3F46] bg-white border border-[#E7E2D6] rounded p-2">
                  Click source node, then target node on the graph to create instantly.
                  Click the same source again to clear selection.
                </div>

                <div className="mb-3 text-xs text-[#71717A]">
                  Source: <span className="text-[#16A34A]">{nodeOptions.find((n) => n.id === relationSourceId)?.label || 'Not selected'}</span>
                </div>

                <div className="mb-3 text-xs text-[#71717A]">
                  Target: <span className="text-[#2563EB]">{nodeOptions.find((n) => n.id === relationTargetId)?.label || 'Not selected'}</span>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-[#3F3F46] mb-2 uppercase">
                    Source Entry
                  </label>
                  <select
                    value={relationSourceId}
                    onChange={(e) => setRelationSourceId(e.target.value)}
                    className="w-full bg-white border border-[#E7E2D6] text-[#18181B] px-3 py-2 rounded text-sm focus:outline-none focus:border-[#2563EB]"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    <option value="">Select source</option>
                    {nodeOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[#3F3F46] mb-2 uppercase">
                    Target Entry
                  </label>
                  <select
                    value={relationTargetId}
                    onChange={(e) => setRelationTargetId(e.target.value)}
                    className="w-full bg-white border border-[#E7E2D6] text-[#18181B] px-3 py-2 rounded text-sm focus:outline-none focus:border-[#2563EB]"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    <option value="">Select target</option>
                    {nodeOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setIsCreatingRelation(false);
                      setRelationSourceId('');
                      setRelationTargetId('');
                      setRelationError('');
                    }}
                    className="flex-1 bg-[#F2EEE4] hover:bg-[#E7E2D6] text-[#3F3F46] px-3 py-2 rounded text-sm font-semibold transition-colors"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setRelationSourceId('');
                      setRelationTargetId('');
                      setRelationError('');
                    }}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    Clear
                  </button>
                  <button
                    onClick={createNewRelation}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmittingRelation || isDeletingRelation || !relationSourceId || !relationTargetId}
                  >
                    {isSubmittingRelation ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedNode ? (
          <div className="p-4 sm:p-6">
            <h3 className="font-bold text-[#18181B] mb-4">Selected Decision</h3>
            <div className="bg-[#F2EEE4] p-4 rounded-lg mb-4">
              <div className="text-xs font-semibold text-[#71717A] mb-2 uppercase">Type</div>
              <div className="text-[#18181B] text-sm mb-4">{selectedNode.data.type}</div>

              <div className="text-xs font-semibold text-[#71717A] mb-2 uppercase">Title</div>
              <div className="text-[#18181B] text-sm mb-4">{selectedNode.data.label}</div>

              <Link
                href={`/entries/${selectedNode.id}`}
                className="inline-block bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
              >
                View Full Entry →
              </Link>
            </div>

            <div>
              <h4 className="font-semibold text-[#18181B] mb-3">Impact Map</h4>
              <div className="space-y-2">
                {selectedNodeEdges.length > 0 ? (
                  selectedNodeEdges.map((edge) => {
                    const relatedNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const relatedNode = allNodes.find((n) => n.id === relatedNodeId);
                    const isOutgoing = edge.source === selectedNode.id;

                    return (
                      <div key={edge.id} className="bg-[#F2EEE4] p-3 rounded text-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: RELATION_COLORS[edge.data?.type] }}
                            ></div>
                            <span className="text-xs font-semibold text-[#71717A] uppercase">
                              {isOutgoing ? '→' : '←'} {RELATION_LABELS[edge.data?.type]}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteExistingRelation(edge)}
                            disabled={isDeletingRelation || isSubmittingRelation}
                            className="text-[11px] text-[#DC2626] hover:text-[#B91C1C] border border-[#FECACA] hover:border-[#DC2626] rounded px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete relation"
                          >
                            {isDeletingRelation ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                        <div className="text-[#3F3F46]">{relatedNode?.data.label}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-[#F2EEE4] p-3 rounded text-sm text-[#3F3F46]">
                    No related decisions under current filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-[#71717A] text-sm sm:p-6">
            <p>Click on a decision node to view details and its impact map.</p>
            {projectId ? <p className="mt-2 break-all text-xs text-[#A1A1AA]">Project: {projectId}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
