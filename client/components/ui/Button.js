'use client';

import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) {
  const baseClasses = 'rounded-lg font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary: 'bg-[#1a1a27] border border-[#1e1e2e] text-zinc-300 hover:bg-[#252535]',
    ghost: 'text-zinc-400 hover:bg-[#1a1a27]',
    danger: 'bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
}
