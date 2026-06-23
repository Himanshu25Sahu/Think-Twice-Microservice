'use client';

export function Skeleton({ className = '', count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-[#F2EEE4] rounded-xl animate-pulse ${className}`}
        />
      ))}
    </>
  );
}
