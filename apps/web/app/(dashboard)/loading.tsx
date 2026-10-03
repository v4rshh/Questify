import { LoadingState } from '@/components/LoadingIndicator';

export default function DashboardLoading() {
  return (
    <main className="route-loading-page">
      <LoadingState
        title="Preparing your workspace…"
        detail="Questify is loading your study tools."
      />
    </main>
  );
}
