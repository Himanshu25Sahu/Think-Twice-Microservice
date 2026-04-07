'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import api from '@/services/api';

const RELATION_CONFIG = {
  impacts: { label: 'Impacts', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  depends_on: { label: 'Depends On', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  replaces: { label: 'Replaces', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  related_to: { label: 'Related To', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  blocks: { label: 'Blocks', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
};

export default function EntryRelations({ entryId, entries = [] }) {
  const { currentEntry } = useSelector((state) => state.entries);
  const { activeOrg } = useSelector((state) => state.orgs);
  const { activeProject } = useSelector((state) => state.projects);
  const [relations, setRelations] = useState(currentEntry?.relations || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedType, setSelectedType] = useState('impacts');
  const [loading, setLoading] = useState(false);

  const handleAddRelation = async () => {
    if (!selectedTargetId || !selectedType) return;

    setLoading(true);
    try {
      const response = await api.post(`/entries/${entryId}/relations`, {
        targetEntryId: selectedTargetId,
        type: selectedType,
      });

      if (response.data.success) {
        setRelations([...relations, response.data.data.relation]);
        setSelectedTargetId('');
        setSelectedType('impacts');
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Failed to add relation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRelation = async (targetId) => {
    setLoading(true);
    try {
      const response = await api.delete(`/entries/${entryId}/relations/${targetId}`);

      if (response.data.success) {
        setRelations(relations.filter((r) => r.targetEntryId !== targetId));
      }
    } catch (error) {
      console.error('Failed to remove relation:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEntryTitle = (entryId) => {
    return entries.find((e) => e._id === entryId)?.title || 'Unknown Entry';
  };

  return (
    <div style={{ padding: '1.25rem 0', borderBottom: '1px solid #13131f' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7878aa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Decision Relations
        </p>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '0.35rem 0.75rem',
              background: '#1f1f3a',
              border: '1px solid #2a2a45',
              borderRadius: '0.375rem',
              color: '#8080a0',
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 200ms',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#2a2a45';
              e.target.style.color = '#c0c0e0';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#1f1f3a';
              e.target.style.color = '#8080a0';
            }}
          >
            + Add Relation
          </button>
        )}
      </div>

      {/* Existing Relations */}
      {relations.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {relations.map((relation) => {
            const config = RELATION_CONFIG[relation.type];
            return (
              <div
                key={relation.targetEntryId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: config.bg,
                  border: `1px solid ${config.color}30`,
                  borderRadius: '0.5rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.6875rem', color: config.color, fontWeight: 600, marginBottom: '0.25rem' }}>
                    {config.label}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#d0d0e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getEntryTitle(relation.targetEntryId)}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveRelation(relation.targetEntryId)}
                  disabled={loading}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.35rem 0.5rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: '0.875rem', color: '#5858780', marginBottom: '1rem' }}>
          No relations yet. Add one to map decision impacts.
        </p>
      )}

      {/* Add Relation Form */}
      {showAddForm && (
        <div
          style={{
            padding: '1rem',
            background: '#0f0f22',
            border: '1px solid #1e1e35',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#7878aa', marginBottom: '0.375rem', fontWeight: 600 }}>
              Select Entry
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#0a0a16',
                border: '1px solid #1e1e30',
                borderRadius: '0.375rem',
                color: '#d0d0e8',
                fontSize: '0.875rem',
              }}
            >
              <option value="">Choose an entry...</option>
              {entries
                .filter((e) => e._id !== entryId)
                .map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.title}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#7878aa', marginBottom: '0.375rem', fontWeight: 600 }}>
              Relation Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#0a0a16',
                border: '1px solid #1e1e30',
                borderRadius: '0.375rem',
                color: '#d0d0e8',
                fontSize: '0.875rem',
              }}
            >
              {Object.entries(RELATION_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowAddForm(false)}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: 'transparent',
                border: '1px solid #1e1e30',
                borderRadius: '0.375rem',
                color: '#8080a0',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddRelation}
              disabled={!selectedTargetId || loading}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: '#6366f1',
                border: 'none',
                borderRadius: '0.375rem',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                opacity: !selectedTargetId || loading ? 0.5 : 1,
              }}
            >
              {loading ? 'Adding...' : 'Add Relation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
