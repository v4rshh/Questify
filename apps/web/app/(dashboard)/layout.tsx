import AuthSessionGate from '@/components/AuthSessionGate';

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AuthSessionGate>{children}</AuthSessionGate>;
}
