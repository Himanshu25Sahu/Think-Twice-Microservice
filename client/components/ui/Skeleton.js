'use client';

export function Skeleton({ className = '', count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-[#1a1a27] rounded-xl animate-pulse ${className}`}
        />
      ))}
    </>
  );
}
