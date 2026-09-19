'use client';

import { Suspense } from 'react';
import WorldExplorer from '@/components/WorldExplorer';

export default function RoadmapPage() {
  return <Suspense fallback={<p>Loading world…</p>}><WorldExplorer /></Suspense>;
}
