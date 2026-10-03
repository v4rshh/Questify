'use client';

import { Suspense } from 'react';
import WorldExplorer from '@/components/WorldExplorer';
import { LoadingState } from '@/components/LoadingIndicator';

export default function RoadmapPage() {
  return (
    <Suspense
      fallback={
        <main className="route-loading-page">
          <LoadingState title="Unrolling your world…" detail="Placing levels and progress." />
        </main>
      }
    >
      <WorldExplorer />
    </Suspense>
  );
}
