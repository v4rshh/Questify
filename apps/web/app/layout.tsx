import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Questify - AI-Powered Gamified Learning Platform',
  description: 'Master courses, explore interactive knowledge graphs, complete quests, and study with personalized AI tutors.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: "try { var theme = localStorage.getItem('questify_theme'); if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; } catch (_) {}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
