import AuthSessionGate from '@/components/AuthSessionGate';
import QuestifyDotBackground from '@/components/QuestifyDotBackground';

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthSessionGate>
      <div className="questify-dashboard-surface">
        <QuestifyDotBackground />
        <div className="questify-dashboard-routes">{children}</div>
      </div>
    </AuthSessionGate>
  );
}
