'use client';

export function Input({
  label,
  error,
  className = '',
  type = 'text',
  ...props
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-zinc-200 mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        className={`input-base ${error ? 'border-red-500 focus:ring-red-500/20' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
