'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { authClient } from '@/lib/auth/client';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'AI extracts tasks',
    body: 'Paste anything—emails, meeting notes, brain dumps. The AI pulls out actionable tasks automatically.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Scheduled automatically',
    body: "Kairos finds the right slot for each task based on your calendar, deadlines, and priority. No drag-and-drop required.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    title: 'Conflicts surfaced early',
    body: 'When your calendar fills up, Kairos flags overloaded days and suggests what to defer—before the deadline hits.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
      </svg>
    ),
    title: 'Plugin-first architecture',
    body: 'Connect any source — Instagram reels, Readwise highlights, voice memos. Each becomes a stream of scheduled tasks.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Your AI, your keys',
    body: 'Bring your own OpenAI, Anthropic, or Ollama instance. No vendor lock-in, no data sent to third parties without your key.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
      </svg>
    ),
    title: 'Open source',
    body: 'MIT licensed. Self-host on your own infra with Docker Compose in under 10 minutes, or use the hosted instance.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Connect Google Calendar',
    body: 'One OAuth flow gives Kairos read + write access. It sees your existing events and writes new task blocks.',
  },
  {
    step: '02',
    title: 'Add tasks any way you like',
    body: 'Type them directly, paste raw text into the Scratchpad, or let a plugin pull them from an external source.',
  },
  {
    step: '03',
    title: 'Watch your week fill in',
    body: "Each task gets a home in your calendar automatically. Reprioritise any time—Kairos re-schedules around the change.",
  },
];

function SignInButton({ className }: { className?: string }) {
  function handleSignIn() {
    authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
  }
  return (
    <button
      onClick={handleSignIn}
      className={className}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Sign in with Google
    </button>
  );
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const selfHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.fromTo(
        '.hero-content > *',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out', delay: 0.1 },
      );

      // Feature cards scroll reveal
      gsap.fromTo(
        '.feature-card',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power2.out',
          scrollTrigger: { trigger: featuresRef.current, start: 'top 80%' },
        },
      );

      // Steps scroll reveal
      gsap.fromTo(
        '.step-item',
        { opacity: 0, x: -16 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          stagger: 0.15,
          ease: 'power2.out',
          scrollTrigger: { trigger: stepsRef.current, start: 'top 75%' },
        },
      );

      // Self-host section
      gsap.fromTo(
        '.selfhost-content',
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: selfHostRef.current, start: 'top 80%' },
        },
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-fg" style={{ fontFeatureSettings: '"cv01", "ss03"' }}>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-wire bg-canvas/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-semibold">K</span>
            </div>
            <span className="text-fg text-[15px] font-[510]">Kairos</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/kairos-app/kairos"
              className="text-fg-3 text-sm hover:text-fg-2 transition-colors hidden sm:block"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <SignInButton className="flex items-center gap-2 bg-brand hover:bg-accent text-white text-sm font-[510] px-4 py-2 rounded-md transition-colors" />
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center hero-content">
          <div className="inline-flex items-center gap-2 border border-wire bg-ghost px-3 py-1.5 rounded-full text-fg-3 text-xs font-[510] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Open source · MIT license
          </div>
          <h1
            className="text-fg text-[56px] sm:text-[72px] font-[510] leading-none mb-6"
            style={{ letterSpacing: '-1.584px' }}
          >
            Scheduling<br />that thinks.
          </h1>
          <p className="text-fg-3 text-xl leading-relaxed mb-10 max-w-xl mx-auto">
            AI-native task management that automatically finds the right time for everything on your plate — powered by Google Calendar and your own LLM keys.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <SignInButton className="flex items-center gap-2.5 bg-brand hover:bg-accent text-white text-[15px] font-[510] px-6 py-3 rounded-lg transition-colors" />
            <a
              href="https://github.com/kairos-app/kairos"
              className="flex items-center gap-2 border border-wire text-fg-2 hover:text-fg hover:border-wire-2 text-[15px] font-[510] px-6 py-3 rounded-lg transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────────── */}
      <section ref={featuresRef} className="py-20 px-6 border-t border-wire">
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-fg text-[32px] font-[510] leading-tight mb-3"
            style={{ letterSpacing: '-0.704px' }}
          >
            Everything your to-do list<br />was missing.
          </h2>
          <p className="text-fg-3 text-lg mb-14 max-w-lg">
            Built for people whose calendar is their real truth. Not another inbox.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-wire">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card bg-canvas p-6 flex flex-col gap-3">
                <div className="text-accent">{f.icon}</div>
                <p className="text-fg text-sm font-[510]">{f.title}</p>
                <p className="text-fg-3 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section ref={stepsRef} className="py-20 px-6 border-t border-wire">
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-fg text-[32px] font-[510] leading-tight mb-3"
            style={{ letterSpacing: '-0.704px' }}
          >
            Set up in minutes.
          </h2>
          <p className="text-fg-3 text-lg mb-14">No configuration rabbit holes. Three steps and you&apos;re scheduling.</p>
          <div className="space-y-0">
            {STEPS.map((s, i) => (
              <div
                key={s.step}
                className={`step-item flex gap-8 py-8 ${i < STEPS.length - 1 ? 'border-b border-wire' : ''}`}
              >
                <span className="text-fg-4 text-sm font-mono shrink-0 pt-0.5 w-8">{s.step}</span>
                <div>
                  <p className="text-fg text-base font-[510] mb-1.5">{s.title}</p>
                  <p className="text-fg-3 text-sm leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Self-host ────────────────────────────────────────────────────── */}
      <section ref={selfHostRef} className="py-20 px-6 border-t border-wire">
        <div className="max-w-5xl mx-auto">
          <div className="selfhost-content bg-surface border border-wire rounded-2xl px-8 py-10">
            <div className="flex flex-col lg:flex-row lg:items-center gap-8">
              <div className="flex-1">
                <h2
                  className="text-fg text-[28px] font-[510] leading-tight mb-3"
                  style={{ letterSpacing: '-0.616px' }}
                >
                  Self-host in under 10 minutes.
                </h2>
                <p className="text-fg-3 text-sm leading-relaxed max-w-md">
                  Run Kairos on your own infrastructure with Docker Compose. Your data stays on your servers — never leaves your control. Or use the hosted instance and let us handle the ops.
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <div className="bg-canvas border border-wire rounded-lg px-4 py-3 font-mono text-xs text-fg-2">
                  <span className="text-fg-4 select-none">$ </span>
                  git clone https://github.com/kairos-app/kairos
                </div>
                <div className="bg-canvas border border-wire rounded-lg px-4 py-3 font-mono text-xs text-fg-2">
                  <span className="text-fg-4 select-none">$ </span>
                  docker compose up
                </div>
                <p className="text-fg-4 text-[11px] text-center">
                  Requires Docker + a Google OAuth app
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-wire py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
              <span className="text-white text-[10px] font-semibold">K</span>
            </div>
            <span className="text-fg-4 text-sm">Kairos — MIT license</span>
          </div>
          <div className="flex items-center gap-6 text-fg-4 text-sm">
            <a href="https://github.com/kairos-app/kairos" className="hover:text-fg-2 transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="/docs" className="hover:text-fg-2 transition-colors">Docs</a>
            <SignInButton className="hover:text-fg-2 transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
