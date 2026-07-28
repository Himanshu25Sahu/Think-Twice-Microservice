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
    <div className="er-root">
      <style>{`
        .er-root {
          padding: 1.25rem 0;
          border-bottom: 1px solid #E7E2D6;
        }

        .er-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .er-title {
          font-size: 0.6875rem;
          font-weight: 500;
          color: #71717A;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
        }

        .er-add-btn {
          padding: 0.375rem 0.75rem;
          background: #FFFFFF;
          border: 1px solid #E7E2D6;
          border-radius: 0.375rem;
          color: #3F3F46;
          font-size: 0.75rem;
          font-family: inherit;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
        }

        .er-add-btn:hover {
          background: #F2EEE4;
          border-color: #D0C9BA;
          color: #18181B;
        }

        .er-list {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          margin-bottom: 1rem;
        }

        .er-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
        }

        .er-item-body { flex: 1; min-width: 0; }

        .er-item-label {
          font-size: 0.6875rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          font-family: 'DM Mono', monospace;
        }

        .er-item-title {
          font-size: 0.875rem;
          color: #18181B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .er-remove {
          flex-shrink: 0;
          width: 1.875rem;
          height: 1.875rem;
          border-radius: 0.375rem;
          background: transparent;
          border: none;
          color: #DC2626;
          cursor: pointer;
          font-size: 0.8125rem;
          transition: background 140ms;
        }

        .er-remove:hover:not(:disabled) { background: #FEF2F2; }
        .er-remove:disabled { opacity: 0.5; cursor: not-allowed; }

        .er-empty {
          font-size: 0.8125rem;
          color: #71717A;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-bottom: 1rem;
        }

        .er-form {
          padding: 1rem;
          background: #FCFBF7;
          border: 1px solid #E7E2D6;
          border-radius: 0.5rem;
        }

        .er-field { margin-bottom: 0.75rem; }

        .er-label {
          display: block;
          font-size: 0.75rem;
          color: #71717A;
          margin-bottom: 0.375rem;
          font-weight: 500;
        }

        .er-select {
          width: 100%;
          padding: 0.5rem 0.625rem;
          background: #FFFFFF;
          border: 1px solid #E7E2D6;
          border-radius: 0.375rem;
          color: #18181B;
          font-size: 0.875rem;
          font-family: inherit;
          outline: none;
        }

        .er-select:focus { border-color: #2563EB; }

        .er-actions { display: flex; gap: 0.5rem; }

        .er-btn {
          flex: 1;
          padding: 0.5625rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-family: inherit;
          font-weight: 500;
          transition: background 140ms, border-color 140ms;
        }

        .er-btn-cancel {
          background: #FFFFFF;
          border: 1px solid #E7E2D6;
          color: #3F3F46;
        }

        .er-btn-cancel:hover { background: #F2EEE4; border-color: #D0C9BA; }

        .er-btn-submit {
          background: #2563EB;
          border: none;
          color: #FFFFFF;
        }

        .er-btn-submit:hover:not(:disabled) { background: #1D4ED8; }
        .er-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 560px) {
          .er-actions { flex-direction: column-reverse; }
          .er-add-btn { padding: 0.5rem 0.75rem; }
        }
      `}</style>

      <div className="er-header">
        <p className="er-title">Decision Relations</p>
        {!showAddForm && (
          <button type="button" onClick={() => setShowAddForm(true)} className="er-add-btn">
            + Add Relation
          </button>
        )}
      </div>

      {/* Existing Relations */}
      {relations.length > 0 ? (
        <div className="er-list">
          {relations.map((relation) => {
            const config = RELATION_CONFIG[relation.type];
            return (
              <div
                key={relation.targetEntryId}
                className="er-item"
                style={{ background: config.bg, border: `1px solid ${config.color}30` }}
              >
                <div className="er-item-body">
                  <div className="er-item-label" style={{ color: config.color }}>
                    {config.label}
                  </div>
                  <div className="er-item-title">
                    {getEntryTitle(relation.targetEntryId)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRelation(relation.targetEntryId)}
                  disabled={loading}
                  aria-label="Remove relation"
                  className="er-remove"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="er-empty">
          No relations yet. Add one to map decision impacts.
        </p>
      )}

      {/* Add Relation Form */}
      {showAddForm && (
        <div className="er-form">
          <div className="er-field">
            <label className="er-label">Select Entry</label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="er-select"
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

          <div className="er-field">
            <label className="er-label">Relation Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="er-select"
            >
              {Object.entries(RELATION_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="er-actions">
            <button type="button" onClick={() => setShowAddForm(false)} className="er-btn er-btn-cancel">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddRelation}
              disabled={!selectedTargetId || loading}
              className="er-btn er-btn-submit"
            >
              {loading ? 'Adding...' : 'Add Relation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
