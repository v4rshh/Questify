import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Questify - AI-Powered Gamified Learning Platform',
<<<<<<< HEAD
  description:
    'Master courses, explore interactive knowledge graphs, complete quests, and study with personalized AI tutors.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
=======
  description: 'Master courses, explore interactive knowledge graphs, complete quests, and study with personalized AI tutors.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
<<<<<<< HEAD
            __html:
              "try { var theme = localStorage.getItem('questify_theme'); if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; } catch (_) {}",
=======
            __html: "try { var theme = localStorage.getItem('questify_theme'); if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; } catch (_) {}",
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f
          }}
        />
        {children}
      </body>
    </html>
  );
}
