'use client';

import DecisionGraph from '@/components/DecisionGraph';
import { Suspense } from 'react';

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-slate-300">Loading graph...</div>
        </div>
      }
    >
      <DecisionGraph />
    </Suspense>
  );
}
