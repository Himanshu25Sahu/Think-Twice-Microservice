'use client';

export function Badge({ type = 'other' }) {
  const badges = {
    architecture: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    debugging: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    feature: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'best-practice': 'bg-green-500/10 text-green-400 border-green-500/20',
    incident: 'bg-red-500/10 text-red-400 border-red-500/20',
    other: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };

  const display = type === 'best-practice' ? 'Best Practice' : type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badges[type] || badges.other}`}>
      {display}
    </span>
  );
}
