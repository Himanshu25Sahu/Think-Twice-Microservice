'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { createEntry } from '@/redux/slices/entrySlice';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { XIcon, PlusIcon } from '@/components/icons';

const TYPES = ['architecture', 'debugging', 'feature', 'best-practice', 'incident'];

const TYPE_META = {
  architecture: { icon: '⬡', color: '#818cf8' },
  debugging:    { icon: '⚡', color: '#f472b6' },
  feature:      { icon: '◈',  color: '#34d399' },
  'best-practice': { icon: '◎', color: '#fbbf24' },
  incident:     { icon: '⚠',  color: '#f87171' },
};

export default function NewEntryPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { loading, error } = useSelector((state) => state.entries);
  const { activeOrg } = useSelector((state) => state.orgs);
  const { activeProject, projects } = useSelector((state) => state.projects);
  const { user } = useSelector((state) => state.auth);
  const { orgs } = useSelector((state) => state.orgs);
  const [toast, setToast] = useState(null);

  const userRole = (() => {
    const org = orgs.find(o => o._id === activeOrg);
    if (!org) return 'viewer';
    const member = org.members.find(m => m.userId === user._id);
    return member?.role || 'viewer';
  })();

  if (userRole === 'viewer') {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-primary mb-4">Create New Entry</h1>
        <p className="text-center text-zinc-400">You don't have permission to create entries. Please contact your administrator.</p>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-primary mb-4">Create New Entry</h1>
        <p className="text-center text-zinc-400">Select or create a project before creating entries.</p>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    title: '',
    type: 'architecture',
    what: '',
    why: '',
    dos: [''],
    donts: [''],
    tags: [],
    context: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionField, setMentionField] = useState(null);
  const [mentionRange, setMentionRange] = useState(null);

  const searchMentionUsers = async (query) => {
    if (!query || query.length < 1) {
      setMentionSuggestions([]);
      return;
    }

    try {
      const response = await api.get(`/entries/search-mentions?q=${encodeURIComponent(query)}`);
      setMentionSuggestions(response.data?.data || []);
    } catch {
      setMentionSuggestions([]);
    }
  };

  const handleMentionSelect = (member) => {
    if (!mentionField || !mentionRange) return;

    const currentValue = formData[mentionField] || '';
    const nextValue = `${currentValue.slice(0, mentionRange.start)}${member.username}${currentValue.slice(mentionRange.end)}`;

    setFormData((prev) => ({ ...prev, [mentionField]: nextValue }));
    setMentionedUserIds((prev) => [...new Set([...prev, member._id])]);
    setMentionSuggestions([]);
    setMentionField(null);
    setMentionRange(null);
  };

  const handleChange = (e) => {
    const { name, value, selectionStart } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name !== 'what' && name !== 'why') {
      return;
    }

    const cursor = typeof selectionStart === 'number' ? selectionStart : value.length;
    const beforeCursor = value.slice(0, cursor);
    const mentionMatch = beforeCursor.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);

    if (!mentionMatch) {
      setMentionSuggestions([]);
      setMentionField(null);
      setMentionRange(null);
      return;
    }

    const mentionQuery = mentionMatch[2] || '';
    const mentionStart = cursor - mentionQuery.length;

    setMentionField(name);
    setMentionRange({ start: mentionStart, end: cursor });
    searchMentionUsers(mentionQuery);
  };

  const handleArrayChange = (field, index, value) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData((prev) => ({ ...prev, [field]: newArray }));
  };

  const addArrayItem = (field) => {
    setFormData((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field, index) => {
    setFormData((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const handleAddTag = (tag) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleAddTagOnKeydown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput.trim());
    }
  };

  const handleAddImage = (files) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 3 - imageFiles.length); // Max 3 total
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setImageFiles((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const newPreviews = prev.filter((_, i) => i !== index);
      // Revoke object URLs to prevent memory leaks
      newPreviews.forEach((_, i) => {
        if (i !== index && prev[i]) URL.revokeObjectURL(prev[i]);
      });
      return newPreviews;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.what.trim()) errors.what = 'Please describe what this is about';
    if (!formData.why.trim()) errors.why = 'Please explain why this matters';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setToast({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    setFieldErrors({});

    try {
      const submitData = new FormData();
      submitData.append('orgId', activeOrg);
      submitData.append('projectId', activeProject);
      submitData.append('title', formData.title);
      submitData.append('type', formData.type);
      submitData.append('what', formData.what);
      submitData.append('why', formData.why);
      submitData.append('context', formData.context || '');
      formData.dos.filter(d => d.trim()).forEach(d => submitData.append('dos[]', d));
      formData.donts.filter(d => d.trim()).forEach(d => submitData.append('donts[]', d));
      formData.tags.forEach(t => submitData.append('tags[]', t));
      mentionedUserIds.forEach((id) => submitData.append('mentionedUserIds[]', id));

      // Add images (prefer new multi-image upload over legacy single image)
      if (imageFiles.length > 0) {
        imageFiles.forEach((file) => submitData.append('images', file));
      } else if (imageFile) {
        submitData.append('image', imageFile);
      }

      const result = await dispatch(createEntry(submitData));
      if (result.meta.requestStatus === 'fulfilled') {
        setToast({ type: 'success', message: `"${formData.title}" published successfully!` });
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setToast({ type: 'error', message: result.payload.message || 'Failed to create entry' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  const selectedTypeMeta = TYPE_META[formData.type];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        .ne-outer {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0 1rem;
        }

        .ne-root {
          font-family: 'DM Sans', sans-serif;
          max-width: 680px;
          width: 100%;
        }

        .ne-page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 2rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid #1a1a2a;
          gap: 1rem;
        }

        .ne-page-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 1.5rem;
          font-weight: 600;
          color: #e4e4f0;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .ne-page-subtitle {
          font-size: 0.8125rem;
          color: #666688;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
          margin-top: 0.25rem;
        }

        .ne-form-card {
          background: #0d0d18;
          border: 1px solid #1a1a2a;
          border-radius: 1rem;
          overflow: hidden;
        }

        .ne-form-inner {
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* Section dividers */
        .ne-section {
          padding: 1.375rem 0;
          border-bottom: 1px solid #13131f;
        }

        .ne-section:first-child {
          padding-top: 0;
        }

        .ne-section:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .ne-label {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #8888aa;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          margin-bottom: 0.625rem;
        }

        .ne-label-required {
          color: #6366f1;
          font-size: 0.625rem;
        }

        .ne-label-optional {
          color: #4a4a6a;
          font-size: 0.6875rem;
          text-transform: none;
          letter-spacing: 0;
          font-family: 'DM Sans', sans-serif;
          font-style: italic;
        }

        /* Input base */
        .ne-input {
          background: #0a0a14;
          border: 1px solid #1e1e30;
          border-radius: 0.5rem;
          padding: 0.6875rem 0.875rem;
          font-size: 0.875rem;
          color: #d4d4e8;
          outline: none;
          width: 100%;
          transition: border-color 160ms, box-shadow 160ms;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.5;
        }

        .ne-input::placeholder {
          color: #52527a;
        }

        .ne-input:focus {
          border-color: #3b3b5c;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
        }

        .ne-input.ne-error {
          border-color: rgba(248, 113, 113, 0.5);
          box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.06);
        }

        .ne-input:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        textarea.ne-input {
          resize: vertical;
          min-height: 88px;
        }

        .ne-mention-wrap {
          position: relative;
        }

        .ne-mention-dropdown {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 0.35rem);
          background: #101022;
          border: 1px solid #26264a;
          border-radius: 0.5rem;
          z-index: 20;
          overflow: hidden;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
        }

        .ne-mention-option {
          width: 100%;
          border: none;
          background: transparent;
          color: #d4d4e8;
          padding: 0.5rem 0.75rem;
          text-align: left;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.8125rem;
          font-family: 'DM Sans', sans-serif;
        }

        .ne-mention-option:hover {
          background: #1b1b33;
        }

        .ne-mention-name {
          color: #cfd0f6;
        }

        .ne-mention-username {
          color: #7c7db0;
          font-family: 'DM Mono', monospace;
          font-size: 0.75rem;
        }

        .ne-error-msg {
          display: flex;
          align-items: center;
          gap: 0.3125rem;
          margin-top: 0.375rem;
          font-size: 0.75rem;
          color: #f87171;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        /* Type selector */
        .ne-type-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .ne-type-btn {
          display: flex;
          align-items: center;
          gap: 0.4375rem;
          padding: 0.4375rem 0.75rem;
          border-radius: 0.4375rem;
          border: 1px solid #1e1e30;
          background: #0a0a14;
          color: #4b4b6a;
          font-size: 0.8125rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          cursor: pointer;
          transition: all 160ms;
          white-space: nowrap;
        }

        .ne-type-btn:hover {
          border-color: #2e2e48;
          color: #8888aa;
          background: #0f0f1c;
        }

        .ne-type-btn.active {
          background: #0f0f20;
          border-color: var(--type-color, #6366f1);
          color: var(--type-color, #6366f1);
          box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.1) inset, 0 0 12px rgba(99, 102, 241, 0.05);
        }

        .ne-type-icon {
          font-size: 0.875rem;
          line-height: 1;
        }

        /* Array fields */
        .ne-array-list {
          display: flex;
          flex-direction: column;
          gap: 0.4375rem;
        }

        .ne-array-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .ne-array-index {
          font-family: 'DM Mono', monospace;
          font-size: 0.6875rem;
          color: #52527a;
          text-align: right;
          flex-shrink: 0;
          user-select: none;
        }

        .ne-remove-btn {
          flex-shrink: 0;
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 0.375rem;
          border: none;
          background: transparent;
          color: #3b3b52;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 140ms, color 140ms;
          padding: 0;
        }

        .ne-remove-btn:hover {
          background: rgba(248, 113, 113, 0.08);
          color: #f87171;
        }

        .ne-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3125rem;
          margin-top: 0.5rem;
          padding: 0.3125rem 0.5rem;
          border-radius: 0.375rem;
          border: none;
          background: transparent;
          color: #3d3d5c;
          font-size: 0.8125rem;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: color 140ms, background 140ms;
        }

        .ne-add-btn:hover {
          color: #6366f1;
          background: rgba(99, 102, 241, 0.06);
        }

        /* Tags */
        .ne-tags-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-top: 0.5rem;
        }

        .ne-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.3125rem;
          padding: 0.25rem 0.4375rem 0.25rem 0.625rem;
          background: #12122a;
          border: 1px solid #22224a;
          border-radius: 9999px;
          font-size: 0.75rem;
          color: #7878aa;
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        .ne-tag-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1rem;
          height: 1rem;
          border-radius: 9999px;
          border: none;
          background: transparent;
          color: #4b4b6a;
          cursor: pointer;
          transition: color 140ms, background 140ms;
          padding: 0;
          flex-shrink: 0;
        }

        .ne-tag-remove:hover {
          color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        /* Image upload - multiple */
        .ne-images-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .ne-image-preview-wrap {
          position: relative;
          display: block;
          border-radius: 0.625rem;
          overflow: hidden;
          aspect-ratio: 4 / 3;
          border: 1px solid #1e1e30;
          background: #0a0a12;
        }

        .ne-image-preview {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 0.625rem;
          object-fit: cover;
        }

        .ne-image-number {
          position: absolute;
          top: 0.375rem;
          right: 0.375rem;
          background: rgba(10, 10, 20, 0.9);
          backdrop-filter: blur(4px);
          color: #a0a0b0;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          font-family: 'DM Mono', monospace;
        }

        .ne-image-remove {
          position: absolute;
          top: 0.35rem;
          left: 0.35rem;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 9999px;
          border: none;
          background: rgba(248, 113, 113, 0.9);
          backdrop-filter: blur(4px);
          color: #fef2f2;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 140ms;
          padding: 0;
        }

        .ne-image-remove:hover {
          background: rgba(220, 38, 38, 1);
          transform: scale(1.1);
        }

        .ne-file-input-label {
          display: block;
          position: relative;
          width: 100%;
          padding: 2rem;
          border: 2px dashed #22223a;
          border-radius: 0.625rem;
          background: rgba(13, 13, 24, 0.5);
          cursor: pointer;
          transition: all 140ms;
          margin-bottom: 0.5rem;
        }

        .ne-file-input-label:hover {
          border-color: #818cf8;
          background: rgba(129, 140, 248, 0.05);
        }

        .ne-file-input {
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          opacity: 0;
        }

        .ne-file-input-text {
          display: block;
          text-align: center;
          color: #4b4b6a;
          font-size: 0.875rem;
          font-family: 'DM Sans', sans-serif;
          text-transform: slightly-small;
        }

        .ne-file-hint {
          font-size: 0.75rem;
          color: #666688;
          font-family: 'DM Mono', monospace;
          margin: 0;
          font-weight: 300;
        }
          background: #12121e;
          color: #8888aa;
          font-size: 0.8125rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
        }

        .ne-file-input::file-selector-button:hover {
          background: #1a1a2e;
          border-color: #3b3b5c;
          color: #a8a8cc;
        }

        /* DOS / DONTS two-col */
        .ne-dos-donts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        .ne-dos-col-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #8888aa;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          margin-bottom: 0.625rem;
        }

        .ne-dos-dot {
          width: 0.4375rem;
          height: 0.4375rem;
          border-radius: 9999px;
          flex-shrink: 0;
        }

        .ne-dos-dot.green { background: #34d399; }
        .ne-dos-dot.red   { background: #f87171; }

        /* Footer */
        .ne-footer {
          display: flex;
          gap: 0.625rem;
          padding-top: 1.375rem;
          border-top: 1px solid #13131f;
          margin-top: 1.375rem;
        }

        .ne-btn-cancel {
          flex: 1;
          padding: 0.6875rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid #1e1e30;
          background: transparent;
          color: #8080a0;
          font-size: 0.875rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 140ms, border-color 140ms, color 140ms;
        }

        .ne-btn-cancel:hover {
          background: #0f0f1c;
          border-color: #2a2a40;
          color: #8888a8;
        }

        .ne-btn-cancel:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ne-btn-submit {
          flex: 1;
          padding: 0.6875rem 1rem;
          border-radius: 0.5rem;
          border: none;
          background: #6366f1;
          color: white;
          font-size: 0.875rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 140ms, opacity 140ms, transform 80ms;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .ne-btn-submit:hover {
          background: #7274f3;
        }

        .ne-btn-submit:active {
          transform: scale(0.985);
        }

        .ne-btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .ne-spinner {
          width: 0.875rem;
          height: 0.875rem;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: white;
          border-radius: 9999px;
          animation: ne-spin 0.65s linear infinite;
        }

        @keyframes ne-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 560px) {
          .ne-dos-donts {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="ne-outer">
      <div className="ne-root">
        {/* Page Header */}
        <div className="ne-page-header">
          <div>
            <h1 className="ne-page-title">New Entry</h1>
            <p className="ne-page-subtitle">document a decision, pattern, or lesson</p>
          </div>
        </div>

        <div className="ne-form-card">
          <form onSubmit={handleSubmit} className="ne-form-inner">

            {/* Title */}
            <div className="ne-section">
              <label className="ne-label">
                Title
                <span className="ne-label-required">required</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Caching Strategy for User Sessions"
                required
                disabled={loading}
                className={`ne-input ${fieldErrors.title ? 'ne-error' : ''}`}
              />
              {fieldErrors.title && (
                <p className="ne-error-msg">⚑ {fieldErrors.title}</p>
              )}
            </div>

            {/* Type */}
            <div className="ne-section">
              <label className="ne-label">Type</label>
              <div className="ne-type-grid">
                {TYPES.map((type) => {
                  const meta = TYPE_META[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, type }))}
                      disabled={loading}
                      className={`ne-type-btn ${formData.type === type ? 'active' : ''}`}
                      style={{ '--type-color': meta.color }}
                    >
                      <span className="ne-type-icon">{meta.icon}</span>
                      {type.replace('-', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What + Why side by side conceptually but stacked */}
            <div className="ne-section">
              <label className="ne-label">
                What happened?
                <span className="ne-label-required">required</span>
              </label>
              <div className="ne-mention-wrap">
                <textarea
                  name="what"
                  value={formData.what}
                  onChange={handleChange}
                  onBlur={() => setTimeout(() => setMentionSuggestions([]), 120)}
                  placeholder="Describe the situation or decision in plain terms..."
                  rows={3}
                  disabled={loading}
                  className={`ne-input ${fieldErrors.what ? 'ne-error' : ''}`}
                />
                {mentionField === 'what' && mentionSuggestions.length > 0 && (
                  <div className="ne-mention-dropdown">
                    {mentionSuggestions.map((member) => (
                      <button
                        key={member._id}
                        type="button"
                        className="ne-mention-option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleMentionSelect(member)}
                      >
                        <span className="ne-mention-name">{member.name}</span>
                        <span className="ne-mention-username">@{member.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fieldErrors.what && <p className="ne-error-msg">⚑ {fieldErrors.what}</p>}
            </div>

            <div className="ne-section">
              <label className="ne-label">
                Why?
                <span className="ne-label-required">required</span>
              </label>
              <div className="ne-mention-wrap">
                <textarea
                  name="why"
                  value={formData.why}
                  onChange={handleChange}
                  onBlur={() => setTimeout(() => setMentionSuggestions([]), 120)}
                  placeholder="Explain the reasoning and trade-offs..."
                  rows={3}
                  disabled={loading}
                  className={`ne-input ${fieldErrors.why ? 'ne-error' : ''}`}
                />
                {mentionField === 'why' && mentionSuggestions.length > 0 && (
                  <div className="ne-mention-dropdown">
                    {mentionSuggestions.map((member) => (
                      <button
                        key={member._id}
                        type="button"
                        className="ne-mention-option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleMentionSelect(member)}
                      >
                        <span className="ne-mention-name">{member.name}</span>
                        <span className="ne-mention-username">@{member.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fieldErrors.why && <p className="ne-error-msg">⚑ {fieldErrors.why}</p>}
            </div>

            {/* Do's & Don'ts — two column */}
            <div className="ne-section">
              <div className="ne-dos-donts">
                {/* Do's */}
                <div>
                  <div className="ne-dos-col-header">
                    <span className="ne-dos-dot green" />
                    Do's
                  </div>
                  <div className="ne-array-list">
                    {formData.dos.map((item, index) => (
                      <div key={index} className="ne-array-row">
                        <span className="ne-array-index">{index + 1}</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleArrayChange('dos', index, e.target.value)}
                          placeholder={`Do #${index + 1}`}
                          disabled={loading}
                          className="ne-input"
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                        />
                        {formData.dos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeArrayItem('dos', index)}
                            className="ne-remove-btn"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addArrayItem('dos')}
                    className="ne-add-btn"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add
                  </button>
                </div>

                {/* Don'ts */}
                <div>
                  <div className="ne-dos-col-header">
                    <span className="ne-dos-dot red" />
                    Don'ts
                  </div>
                  <div className="ne-array-list">
                    {formData.donts.map((item, index) => (
                      <div key={index} className="ne-array-row">
                        <span className="ne-array-index">{index + 1}</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleArrayChange('donts', index, e.target.value)}
                          placeholder={`Don't #${index + 1}`}
                          disabled={loading}
                          className="ne-input"
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                        />
                        {formData.donts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeArrayItem('donts', index)}
                            className="ne-remove-btn"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addArrayItem('donts')}
                    className="ne-add-btn"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="ne-section">
              <label className="ne-label">Tags</label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTagOnKeydown}
                placeholder="Type and press Enter or comma"
                disabled={loading}
                className="ne-input"
              />
              {formData.tags.length > 0 && (
                <div className="ne-tags-wrap">
                  {formData.tags.map((tag) => (
                    <div key={tag} className="ne-tag">
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ne-tag-remove"
                      >
                        <XIcon className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Context */}
            <div className="ne-section">
              <label className="ne-label">
                Context
                <span className="ne-label-optional">optional</span>
              </label>
              <textarea
                name="context"
                value={formData.context}
                onChange={handleChange}
                placeholder="Links, references, or additional notes..."
                rows={2}
                disabled={loading}
                className="ne-input"
              />
            </div>

            {/* Images */}
            <div className="ne-section">
              <label className="ne-label">
                Images
                <span className="ne-label-optional">optional, up to 3</span>
              </label>
              
              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="ne-images-preview-grid">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="ne-image-preview-wrap">
                      <img src={preview} alt={`Preview ${index + 1}`} className="ne-image-preview" />
                      <div className="ne-image-number">{index + 1}</div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="ne-image-remove"
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* File Input (only show if less than 3 images) */}
              {imagePreviews.length < 3 && (
                <label className="ne-file-input-label">
                  <input
                    type="file"
                    multiple
                    accept="image/jpg,image/jpeg,image/png,image/webp"
                    onChange={(e) => handleAddImage(e.target.files)}
                    disabled={loading}
                    className="ne-file-input"
                  />
                  <span className="ne-file-input-text">
                    {imagePreviews.length === 0
                      ? 'Click to upload or drag images here'
                      : `Add up to ${3 - imagePreviews.length} more image${3 - imagePreviews.length === 1 ? '' : 's'}`}
                  </span>
                </label>
              )}
              <p className="ne-file-hint">Supported: JPG, PNG, WebP (max 5MB each)</p>
            </div>

            {/* Actions */}
            <div className="ne-footer">
              <button
                type="button"
                className="ne-btn-cancel"
                onClick={() => router.push('/dashboard')}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ne-btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="ne-spinner" />
                    Publishing…
                  </>
                ) : (
                  'Publish Entry'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}