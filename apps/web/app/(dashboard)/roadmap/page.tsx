'use client';

import { Suspense } from 'react';
import WorldExplorer from '@/components/WorldExplorer';

export default function RoadmapPage() {
<<<<<<< HEAD
  return (
    <Suspense fallback={<p>Loading world…</p>}>
      <WorldExplorer />
    </Suspense>
  );
=======
  return <Suspense fallback={<p>Loading world…</p>}><WorldExplorer /></Suspense>;
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f
}
