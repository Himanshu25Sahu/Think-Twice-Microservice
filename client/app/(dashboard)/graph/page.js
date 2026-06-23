'use client';

import DecisionGraph from '@/components/DecisionGraph';
import { Suspense } from 'react';

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#FCFBF7] flex items-center justify-center">
          <div className="text-[#3F3F46]">Loading graph...</div>
        </div>
      }
    >
      <DecisionGraph />
    </Suspense>
  );
}
