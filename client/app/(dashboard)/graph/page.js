'use client';

import DecisionGraph from '@/components/DecisionGraph';
import { Suspense } from 'react';

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-6rem)] min-h-[26rem] w-full items-center justify-center bg-[#FCFBF7] sm:h-[calc(100dvh-7rem)]">
          <div className="text-[#3F3F46]">Loading graph...</div>
        </div>
      }
    >
      <DecisionGraph />
    </Suspense>
  );
}
