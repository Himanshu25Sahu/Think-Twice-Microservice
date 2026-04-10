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
    <div className="px-4 py-3 rounded-lg border-2 bg-slate-800 border-slate-600 shadow-lg">
      <Handle type="target" position={Position.Top} />
      <div className="text-xs font-bold text-slate-300 mb-1">{data.type}</div>
      <div className="text-sm text-slate-100 font-medium truncate max-w-xs">{data.label}</div>
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

const layoutNodesGrid = (nodes = []) => {
  if (!nodes.length) {
    return [];
  }

  const columns = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
  const xGap = 260;
  const yGap = 190;

  return nodes.map((node, idx) => ({
    ...node,
    position: {
      x: 80 + (idx % columns) * xGap,
      y: 80 + Math.floor(idx / columns) * yGap,
    },
  }));
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
          border: isSource ? '2px solid #22c55e' : isTarget ? '2px solid #60a5fa' : undefined,
          boxShadow: isSource
            ? '0 0 0 3px rgba(34,197,94,0.25)'
            : isTarget
              ? '0 0 0 3px rgba(96,165,250,0.22)'
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
      const layoutedNodes = layoutNodesGrid(data.nodes || []);
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

  if (loading) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-300">
          <div className="animate-spin text-2xl mb-4">⚙️</div>
          <p>Loading decision graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">
          <p className="mb-2">❌ {error}</p>
          <Link href="/login" className="text-blue-400 hover:underline text-sm">
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-900 flex">
      <div className="flex-1 relative">
        {selectedEdge && (
          <div className="absolute top-4 left-4 z-20 bg-slate-800/95 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-lg">
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
          onlyRenderVisibleElements
          minZoom={0.2}
          maxZoom={1.8}
        >
          <Background className="bg-slate-950" />
          <Controls className="bg-slate-800 border-slate-700" />
          <MiniMap className="bg-slate-800 border-slate-700" />
        </ReactFlow>
      </div>

      <div className="w-80 bg-slate-800 border-l border-slate-700 overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Decision Graph</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700 p-4 rounded-lg">
              <div className="text-2xl font-bold text-slate-200">{allNodes.length}</div>
              <div className="text-xs text-slate-400 mt-1">Decisions</div>
            </div>
            <div className="bg-slate-700 p-4 rounded-lg">
              <div className="text-2xl font-bold text-slate-200">{filteredEdges.length}</div>
              <div className="text-xs text-slate-400 mt-1">Relations</div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-300 mb-3 uppercase">
              Filter Relations
            </label>
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer"
                onClick={() => setFilterType('all')}
              >
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <span className={`text-sm ${filterType === 'all' ? 'text-slate-100 font-semibold' : 'text-slate-400'}`}>
                  All Relations
                </span>
              </div>
              {Object.entries(RELATION_COLORS).map(([key, color]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer"
                  onClick={() => setFilterType(key)}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className={`text-sm ${filterType === key ? 'text-slate-100 font-semibold' : 'text-slate-400'}`}>
                    {RELATION_LABELS[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 pb-6 border-t border-slate-700 pt-6">
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
              <div className="bg-slate-700 p-4 rounded-lg">
                {relationError && (
                  <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded p-2">
                    {relationError}
                  </div>
                )}

                {relationSuccess && (
                  <div className="mb-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded p-2">
                    {relationSuccess}
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">
                    Relation Type
                  </label>
                  <select
                    value={relationType}
                    onChange={(e) => setRelationType(e.target.value)}
                    className="w-full bg-slate-600 border border-slate-500 text-slate-100 px-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    {Object.entries(RELATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3 text-xs text-slate-300 bg-slate-800 border border-slate-600 rounded p-2">
                  Click source node, then target node on the graph to create instantly.
                  Click the same source again to clear selection.
                </div>

                <div className="mb-3 text-xs text-slate-400">
                  Source: <span className="text-green-300">{nodeOptions.find((n) => n.id === relationSourceId)?.label || 'Not selected'}</span>
                </div>

                <div className="mb-3 text-xs text-slate-400">
                  Target: <span className="text-blue-300">{nodeOptions.find((n) => n.id === relationTargetId)?.label || 'Not selected'}</span>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">
                    Source Entry
                  </label>
                  <select
                    value={relationSourceId}
                    onChange={(e) => setRelationSourceId(e.target.value)}
                    className="w-full bg-slate-600 border border-slate-500 text-slate-100 px-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    <option value="">Select source</option>
                    {nodeOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">
                    Target Entry
                  </label>
                  <select
                    value={relationTargetId}
                    onChange={(e) => setRelationTargetId(e.target.value)}
                    className="w-full bg-slate-600 border border-slate-500 text-slate-100 px-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500"
                    disabled={isSubmittingRelation || isDeletingRelation}
                  >
                    <option value="">Select target</option>
                    {nodeOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsCreatingRelation(false);
                      setRelationSourceId('');
                      setRelationTargetId('');
                      setRelationError('');
                    }}
                    className="flex-1 bg-slate-600 hover:bg-slate-500 text-slate-200 px-3 py-2 rounded text-sm font-semibold transition-colors"
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
          <div className="p-6">
            <h3 className="font-bold text-slate-100 mb-4">Selected Decision</h3>
            <div className="bg-slate-700 p-4 rounded-lg mb-4">
              <div className="text-xs font-semibold text-slate-400 mb-2 uppercase">Type</div>
              <div className="text-slate-100 text-sm mb-4">{selectedNode.data.type}</div>

              <div className="text-xs font-semibold text-slate-400 mb-2 uppercase">Title</div>
              <div className="text-slate-100 text-sm mb-4">{selectedNode.data.label}</div>

              <Link
                href={`/entries/${selectedNode.id}`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
              >
                View Full Entry →
              </Link>
            </div>

            <div>
              <h4 className="font-semibold text-slate-100 mb-3">Impact Map</h4>
              <div className="space-y-2">
                {selectedNodeEdges.length > 0 ? (
                  selectedNodeEdges.map((edge) => {
                    const relatedNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const relatedNode = allNodes.find((n) => n.id === relatedNodeId);
                    const isOutgoing = edge.source === selectedNode.id;

                    return (
                      <div key={edge.id} className="bg-slate-700 p-3 rounded text-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: RELATION_COLORS[edge.data?.type] }}
                            ></div>
                            <span className="text-xs font-semibold text-slate-400 uppercase">
                              {isOutgoing ? '→' : '←'} {RELATION_LABELS[edge.data?.type]}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteExistingRelation(edge)}
                            disabled={isDeletingRelation || isSubmittingRelation}
                            className="text-[11px] text-red-300 hover:text-red-200 border border-red-500/30 hover:border-red-400/40 rounded px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete relation"
                          >
                            {isDeletingRelation ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                        <div className="text-slate-200">{relatedNode?.data.label}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-slate-700 p-3 rounded text-sm text-slate-300">
                    No related decisions under current filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-slate-400 text-sm">
            <p>Click on a decision node to view details and its impact map.</p>
            {projectId ? <p className="mt-2 text-xs text-slate-500">Project: {projectId}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
