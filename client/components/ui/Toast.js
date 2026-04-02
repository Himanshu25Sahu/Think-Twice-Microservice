'use client';

import React, { useEffect, useState } from 'react';
import { XIcon } from '@/components/icons';

export function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const colors = {
    info: 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300',
    success: 'bg-green-600/20 border-green-500/30 text-green-300',
    error: 'bg-red-600/20 border-red-500/30 text-red-300',
  };

  return (
    <div className={`fixed bottom-4 right-4 border rounded-lg px-4 py-3 flex items-center gap-3 ${colors[type]}`}>
      <span className="text-sm">{message}</span>
      <button onClick={() => {
        setIsVisible(false);
        onClose?.();
      }}>
        <XIcon />
      </button>
    </div>
  );
}
