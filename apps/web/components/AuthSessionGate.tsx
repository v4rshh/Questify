'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { LoadingState } from './LoadingIndicator';

type SessionState = 'checking' | 'authorized' | 'redirecting';

interface AuthSessionGateProps {
  children: React.ReactNode;
}

/**
 * Prevent protected dashboard pages from fetching learner data before the
 * browser has a valid access token. This also handles sessions that expire
 * while the app is open.
 */
export default function AuthSessionGate({ children }: AuthSessionGateProps) {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>('checking');

  useEffect(() => {
    let cancelled = false;

    const redirectToLogin = () => {
      if (cancelled) return;
      localStorage.removeItem('questify_token');
      localStorage.removeItem('questify_user');
      setSessionState('redirecting');
      router.replace('/');
    };

    const verifySession = async () => {
      if (!localStorage.getItem('questify_token')) {
        redirectToLogin();
        return;
      }

      try {
        await fetchApi('/auth/me');
        if (!cancelled) setSessionState('authorized');
      } catch {
        redirectToLogin();
      }
    };

    window.addEventListener('questify:unauthorized', redirectToLogin);
    void verifySession();

    return () => {
      cancelled = true;
      window.removeEventListener('questify:unauthorized', redirectToLogin);
    };
  }, [router]);

  if (sessionState !== 'authorized') {
    return (
      <main className="session-check">
        <LoadingState
          title={
            sessionState === 'redirecting' ? 'Returning to sign in…' : 'Preparing your dashboard…'
          }
          detail={
            sessionState === 'redirecting'
              ? 'Your session needs to be renewed.'
              : 'Checking your study session and learning progress.'
          }
        />
        <style jsx>{`
          .session-check {
            display: grid;
            min-height: 100vh;
            place-content: center;
            justify-items: center;
            gap: 12px;
            background: var(--background);
            color: var(--muted);
            font-size: 13px;
          }
        `}</style>
      </main>
    );
  }

  return <>{children}</>;
}
