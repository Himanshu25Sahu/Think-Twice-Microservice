'use client';

export function Badge({ type = 'other' }) {
  const badges = {
    architecture: 'bg-blue-600/10 text-blue-700 border-blue-600/20',
    debugging: 'bg-pink-600/10 text-pink-700 border-pink-600/20',
    feature: 'bg-green-600/10 text-green-700 border-green-600/20',
    'best-practice': 'bg-amber-600/10 text-amber-700 border-amber-600/20',
    incident: 'bg-red-600/10 text-red-700 border-red-600/20',
    other: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20',
  };

  const display = type === 'best-practice' ? 'Best Practice' : type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badges[type] || badges.other}`}>
      {display}
    </span>
  );
}
