'use client';

import { authClient } from '@/lib/auth/client';

export default function LandingPage() {
  function handleSignIn() {
    authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
  }

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <span className="text-white text-sm font-semibold">K</span>
          </div>
          <span className="text-fg text-xl font-[510]">Kairos</span>
        </div>

        {/* Headline */}
        <h1
          className="text-fg text-[48px] font-[510] leading-none tracking-[-1.056px] mb-4"
          style={{ fontFeatureSettings: '"cv01", "ss03"' }}
        >
          Scheduling that thinks.
        </h1>
        <p className="text-fg-3 text-lg leading-relaxed mb-10">
          AI-native task management that automatically finds the right time for everything on your plate.
        </p>

        {/* CTA */}
        <button
          onClick={handleSignIn}
          className="inline-flex items-center gap-2.5 bg-brand hover:bg-accent-2 text-white text-sm font-[510] px-5 py-2.5 rounded-md transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
