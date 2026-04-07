'use client';

import { useEffect, useCallback, useState } from 'react';
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
import { fetchGraph, addRelation } from '@/services/graphService';

const RELATION_COLORS = {
  impacts: '#ef4444',      // red
  depends_on: '#3b82f6',   // blue
  replaces: '#f59e0b',     // amber
  related_to: '#8b5cf6',   // purple
  blocks: '#ec4899',       // pink
};

const RELATION_LABELS = {
  impacts: 'Impacts',
  depends_on: 'Depends On',
  replaces: 'Replaces',
  related_to: 'Related To',
  blocks: 'Blocks',
};

const TYPE_COLORS = {
  architecture: '#818cf8',
  debugging: '#f472b6',
  feature: '#34d399',
  'best-practice': '#fbbf24',
  incident: '#f87171',
  other: '#a78bfa',
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

const edgeTypes = {};

const edgeOptions = {
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed },
};

export default function DecisionGraph() {
  const { activeOrg } = useSelector((state) => state.orgs);
  const { activeProject } = useSelector((state) => state.projects);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterType, setFilterType] = useState('all');
  
  // Create relation mode
  const [isCreatingRelation, setIsCreatingRelation] = useState(false);
  const [sourceNode, setSourceNode] = useState(null);
  const [relationType, setRelationType] = useState('impacts');
  const [isSubmittingRelation, setIsSubmittingRelation] = useState(false);

  useEffect(() => {
    const loadGraph = async () => {
      if (!activeOrg || !activeProject) return;

      try {
        setLoading(true);
        setError(null);
        const data = await fetchGraph(activeOrg, activeProject);

        console.log('Graph data received:', { nodes: data.nodes?.length, edges: data.edges?.length, edges: data.edges });

        // Layout nodes using a simple force-directed algorithm
        const layoutedNodes = layoutNodesForceDirected(data.nodes, data.edges);

        // Style edges by relation type
        const styledEdges = (data.edges || []).map((edge) => {
          const edgeColor = RELATION_COLORS[edge.data?.type] || RELATION_COLORS[edge.type] || '#94a3b8';
          console.log(`Edge ${edge.id}: type=${edge.data?.type}, color=${edgeColor}`);
          return {
            ...edge,
            ...edgeOptions,
            style: {
              stroke: edgeColor,
              strokeWidth: 2,
            },
          };
        });

        console.log('Styled edges:', styledEdges);
        setNodes(layoutedNodes);
        setEdges(styledEdges);
      } catch (err) {
        console.error('Error loading graph:', err);
        setError('Failed to load decision graph');
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [activeOrg, activeProject, setNodes, setEdges]);

  const layoutNodesForceDirected = (nodes, edges) => {
    const width = 1200;
    const height = 600;
    const nodeSpacing = 200;

    // Simple force-directed layout
    const positioned = nodes.map((node, idx) => ({
      ...node,
      position: {
        x: (idx % Math.ceil(Math.sqrt(nodes.length))) * nodeSpacing + 50,
        y: Math.floor(idx / Math.ceil(Math.sqrt(nodes.length))) * nodeSpacing + 50,
      },
    }));

    return positioned;
  };

  const handleNodeClick = useCallback((event, node) => {
    if (isCreatingRelation) {
      if (!sourceNode) {
        // Select source node
        setSourceNode(node);
      } else if (sourceNode.id === node.id) {
        // Deselect if clicking the same node
        setSourceNode(null);
      } else {
        // Create relation from sourceNode to this node
        createNewRelation(sourceNode.id, node.id);
      }
    } else {
      setSelectedNode(node);
    }
  }, [isCreatingRelation, sourceNode]);

  const createNewRelation = async (sourceId, targetId) => {
    try {
      setIsSubmittingRelation(true);
      const orgIdString = typeof activeOrg === 'object' ? activeOrg._id : activeOrg;
      const projectIdString = typeof activeProject === 'object' ? activeProject._id : activeProject;
      
      await addRelation(sourceId, targetId, relationType, activeOrg, activeProject);
      
      // Reload graph
      const data = await fetchGraph(activeOrg, activeProject);
      const layoutedNodes = layoutNodesForceDirected(data.nodes, data.edges);
      const styledEdges = (data.edges || []).map((edge) => {
        const edgeColor = RELATION_COLORS[edge.data?.type] || RELATION_COLORS[edge.type] || '#94a3b8';
        return {
          ...edge,
          ...edgeOptions,
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
          },
        };
      });
      
      setNodes(layoutedNodes);
      setEdges(styledEdges);
      setSourceNode(null);
      setIsCreatingRelation(false);
      console.log('✅ Relation created successfully');
    } catch (err) {
      console.error('❌ Error creating relation:', err);
      alert('Failed to create relation');
    } finally {
      setIsSubmittingRelation(false);
    }
  };

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
      {/* Main Graph Area */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
        >
          <Background className="bg-slate-950" />
          <Controls className="bg-slate-800 border-slate-700" />
          <MiniMap className="bg-slate-800 border-slate-700" />
        </ReactFlow>
      </div>

      {/* Right Sidebar - Node Details & Filters */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Decision Graph</h2>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700 p-4 rounded-lg">
              <div className="text-2xl font-bold text-slate-200">{nodes.length}</div>
              <div className="text-xs text-slate-400 mt-1">Decisions</div>
            </div>
            <div className="bg-slate-700 p-4 rounded-lg">
              <div className="text-2xl font-bold text-slate-200">{edges.length}</div>
              <div className="text-xs text-slate-400 mt-1">Relations</div>
            </div>
          </div>

          {/* Relation Type Filter */}
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

          {/* Create Relation Section */}
          <div className="mb-6 pb-6 border-t border-slate-700 pt-6">
            {!isCreatingRelation ? (
              <button
                onClick={() => setIsCreatingRelation(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold transition-colors"
              >
                ➕ Create Relation
              </button>
            ) : (
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase">
                    Relation Type
                  </label>
                  <select
                    value={relationType}
                    onChange={(e) => setRelationType(e.target.value)}
                    className="w-full bg-slate-600 border border-slate-500 text-slate-100 px-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(RELATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {sourceNode ? (
                  <div className="mb-3 bg-slate-600 p-2 rounded text-sm">
                    <div className="text-xs text-slate-400 mb-1">From:</div>
                    <div className="text-slate-100 font-semibold truncate">{sourceNode.data.label}</div>
                    <div className="text-xs text-slate-400 mt-1">Click another node to connect</div>
                  </div>
                ) : (
                  <div className="mb-3 text-sm text-slate-300">
                    <div className="text-xs text-slate-400 mb-1">Step 1: Click a node to select source</div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsCreatingRelation(false);
                      setSourceNode(null);
                    }}
                    className="flex-1 bg-slate-600 hover:bg-slate-500 text-slate-200 px-3 py-2 rounded text-sm font-semibold transition-colors"
                    disabled={isSubmittingRelation}
                  >
                    Cancel
                  </button>
                  {sourceNode && (
                    <button
                      onClick={() => setSourceNode(null)}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors"
                      disabled={isSubmittingRelation}
                    >
                      Clear Source
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Node Details */}
        {selectedNode ? (
          <div className="p-6">
            <h3 className="font-bold text-slate-100 mb-4">Selected Decision</h3>
            <div className="bg-slate-700 p-4 rounded-lg mb-4">
              <div className="text-xs font-semibold text-slate-400 mb-2 uppercase">Type</div>
              <div className="text-slate-100 text-sm mb-4">{selectedNode.data.type}</div>

              <div className="text-xs font-semibold text-slate-400 mb-2 uppercase">Title</div>
              <div className="text-slate-100 text-sm mb-4">{selectedNode.data.label}</div>

              <Link
                href={`/projects/${activeProject}/entries/${selectedNode.id}`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
              >
                View Full Entry →
              </Link>
            </div>

            {/* Related Entries */}
            <div>
              <h4 className="font-semibold text-slate-100 mb-3">Impact Map</h4>
              <div className="space-y-2">
                {edges
                  .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
                  .map((edge) => {
                    const relatedNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const relatedNode = nodes.find((n) => n.id === relatedNodeId);
                    const isOutgoing = edge.source === selectedNode.id;

                    return (
                      <div key={edge.id} className="bg-slate-700 p-3 rounded text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: RELATION_COLORS[edge.data?.type] }}
                          ></div>
                          <span className="text-xs font-semibold text-slate-400 uppercase">
                            {isOutgoing ? '→' : '←'} {RELATION_LABELS[edge.data?.type]}
                          </span>
                        </div>
                        <div className="text-slate-200">{relatedNode?.data.label}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-slate-400 text-sm">
            <p>Click on a decision node to view details and its impact map.</p>
          </div>
        )}
      </div>
    </div>
  );
}
