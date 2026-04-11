'use client';

import React, { useEffect, useState } from 'react';
import { XIcon } from '@/components/icons';

export function Toast({ message, type = 'info', duration = 3500, onClose }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterFrame = requestAnimationFrame(() => setVisible(true));

    const leaveTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onClose?.(), 350);
    }, duration);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(leaveTimer);
    };
  }, [duration, onClose]);

  const icons = {
    success: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  };

  const styles = {
    info: 'bg-[#13131f] border-indigo-500/40 text-indigo-300',
    success: 'bg-[#13131f] border-green-500/40 text-green-300',
    error: 'bg-[#13131f] border-red-500/40 text-red-300',
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        transition: 'opacity 350ms ease, transform 350ms ease',
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateY(0)' : 'translateY(12px)',
      }}
      className={`fixed bottom-5 right-5 z-50 border rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-black/40 min-w-[260px] max-w-sm ${styles[type]}`}
    >
      {icons[type]}
      <span className="text-sm font-medium flex-1">{message}</span>
      <button
        onClick={() => { setLeaving(true); setTimeout(() => onClose?.(), 350); }}
        className="opacity-60 hover:opacity-100 transition-opacity ml-1"
        aria-label="Dismiss"
      >
        <XIcon />
      </button>
    </div>
  );
}
