'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { createEntry } from '@/redux/slices/entrySlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { XIcon, PlusIcon } from '@/components/icons';

const TYPES = ['architecture', 'debugging', 'feature', 'best-practice', 'incident'];

export default function NewEntryPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { loading, error } = useSelector((state) => state.entries);
  const { activeOrg } = useSelector((state) => state.orgs);
  const { user } = useSelector((state) => state.auth);
  const { orgs } = useSelector((state) => state.orgs);
  const [toast, setToast] = useState(null);

  const userRole = (()=>{
    const org=orgs.find(o => o._id === activeOrg);
    if(!org) return 'viewer';
    const member = org.members.find(m => m.userId === user._id);
    return member?.role || 'viewer';
   })();

  if(userRole === 'viewer') {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-primary mb-4">Create New Entry</h1>
        <p className="text-center text-zinc-400">You don't have permission to create entries. Please contact your administrator.</p>
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
  const [tagInput, setTagInput] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArrayChange = (field, index, value) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData((prev) => ({ ...prev, [field]: newArray }));
  };

  const addArrayItem = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const removeArrayItem = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleAddTag = (tag) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleAddTagOnKeydown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput.trim());
    }
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
      submitData.append('title', formData.title);
      submitData.append('type', formData.type);
      submitData.append('what', formData.what);
      submitData.append('why', formData.why);
      submitData.append('context', formData.context || '');
      formData.dos.filter(d => d.trim()).forEach(d => submitData.append('dos[]', d));
      formData.donts.filter(d => d.trim()).forEach(d => submitData.append('donts[]', d));
      formData.tags.forEach(t => submitData.append('tags[]', t));
      if (imageFile) submitData.append('image', imageFile);

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

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Create New Entry</h1>
      </div>

      <div className="card-base">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Title <span className="text-red-400">*</span></label>
            <Input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Caching Strategy for User Sessions"
              required
              disabled={loading}
              className={fieldErrors.title ? 'border-red-500 focus:border-red-500' : ''}
            />
            {fieldErrors.title && <p className="text-red-400 text-xs mt-1">{fieldErrors.title}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              disabled={loading}
              className="input-base"
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* What */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">What happened? <span className="text-red-400">*</span></label>
            <textarea
              name="what"
              value={formData.what}
              onChange={handleChange}
              placeholder="Describe the situation or decision..."
              rows={3}
              disabled={loading}
              className={`input-base ${fieldErrors.what ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {fieldErrors.what && <p className="text-red-400 text-xs mt-1">{fieldErrors.what}</p>}
          </div>

          {/* Why */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Why? <span className="text-red-400">*</span></label>
            <textarea
              name="why"
              value={formData.why}
              onChange={handleChange}
              placeholder="Explain the reasoning and context..."
              rows={3}
              disabled={loading}
              className={`input-base ${fieldErrors.why ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {fieldErrors.why && <p className="text-red-400 text-xs mt-1">{fieldErrors.why}</p>}
          </div>

          {/* Do's */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Do's</label>
            <div className="space-y-2">
              {formData.dos.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleArrayChange('dos', index, e.target.value)}
                    placeholder={`Do #${index + 1}`}
                    disabled={loading}
                    className="input-base flex-1"
                  />
                  {formData.dos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('dos', index)}
                      className="p-2 rounded hover:bg-red-600/10 transition"
                    >
                      <XIcon className="w-5 h-5 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addArrayItem('dos')}
                className="text-sm text-accent hover:text-indigo-400 flex items-center gap-1 mt-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add do
              </button>
            </div>
          </div>

          {/* Don'ts */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Don'ts</label>
            <div className="space-y-2">
              {formData.donts.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleArrayChange('donts', index, e.target.value)}
                    placeholder={`Don't #${index + 1}`}
                    disabled={loading}
                    className="input-base flex-1"
                  />
                  {formData.donts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('donts', index)}
                      className="p-2 rounded hover:bg-red-600/10 transition"
                    >
                      <XIcon className="w-5 h-5 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addArrayItem('donts')}
                className="text-sm text-accent hover:text-indigo-400 flex items-center gap-1 mt-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add don't
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Tags</label>
            <div className="space-y-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTagOnKeydown}
                placeholder="Type and press Enter or comma"
                disabled={loading}
                className="input-base"
              />
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <div
                      key={tag}
                      className="tag-base flex items-center gap-1 pr-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:opacity-70"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Context */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Additional Context (optional)</label>
            <textarea
              name="context"
              value={formData.context}
              onChange={handleChange}
              placeholder="Links, references, or additional notes..."
              rows={2}
              disabled={loading}
              className="input-base"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Image (optional)</label>
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="Preview" className="rounded-lg border border-[#1e1e2e] max-h-48 object-cover" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-1 right-1 p-1 bg-red-600 rounded-full hover:bg-red-500">
                  <XIcon className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            <input type="file" accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setImageFile(file);
                  setImagePreview(URL.createObjectURL(file));
                }
              }}
              disabled={loading}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/dashboard')}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="flex-1"
            >
              Create Entry
            </Button>
          </div>
        </form>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
