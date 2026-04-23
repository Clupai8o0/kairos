'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/schedule',
    label: 'Schedule',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: '/scratchpad',
    label: 'Scratchpad',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
        <path d="M17.5 3.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z" />
      </svg>
    ),
  },
  {
    href: '/collections',
    label: 'Collections',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h4l2-3h6l2 3h4a2 2 0 012 2v9a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    href: '/chat',
    label: 'Chat',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: '/tags',
    label: 'Tags',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    href: '/views',
    label: 'Views',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    href: '/settings/marketplace',
    label: 'Marketplace',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);

  function handleSignOut() {
    authClient.signOut({ fetchOptions: { onSuccess: () => router.push('/') } });
    setOpen(false);
  }

  return (
    <header className="flex md:hidden items-center gap-3 px-4 h-12 border-b border-wire bg-surface shrink-0 z-30">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="p-1.5 -ml-1.5 text-fg-3 hover:text-fg transition-colors rounded-md hover:bg-ghost-2 min-w-[40px] min-h-[40px] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
          <span className="sr-only">Open navigation</span>
        </SheetTrigger>

        <SheetContent
          side="left"
          showCloseButton={false}
          className="bg-surface text-fg border-wire w-72 max-w-[85vw] p-0 gap-0 flex flex-col"
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 h-12 border-b border-wire-2 shrink-0">
            <div className="w-5 h-5 rounded bg-brand flex items-center justify-center">
              <span className="text-white text-[10px] font-semibold tracking-tight">K</span>
            </div>
            <span className="text-fg text-sm font-[510]">Kairos</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-2 overflow-y-auto">
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={[
                        'flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13px] font-[510] transition-colors',
                        active
                          ? 'bg-ghost-3 text-fg'
                          : 'text-fg-3 hover:bg-ghost-2 hover:text-fg-2',
                      ].join(' ')}
                    >
                      <span className={active ? 'text-fg-2' : 'text-fg-4'}>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-wire-2 px-2 py-2 space-y-0.5 shrink-0">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={[
                'flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13px] font-[510] transition-colors',
                pathname.startsWith('/settings')
                  ? 'bg-ghost-3 text-fg'
                  : 'text-fg-3 hover:bg-ghost-2 hover:text-fg-2',
              ].join(' ')}
            >
              <span className="text-fg-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </span>
              Settings
            </Link>

            {session && (
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13px] font-[510] text-fg-4 hover:bg-ghost-2 hover:text-fg-3 transition-colors text-left"
              >
                <span className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-semibold text-fg-3 uppercase shrink-0">
                  {session.user.name?.[0] ?? session.user.email?.[0] ?? '?'}
                </span>
                <span className="truncate">{session.user.name ?? session.user.email}</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* App name */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-brand flex items-center justify-center">
          <span className="text-white text-[10px] font-semibold tracking-tight">K</span>
        </div>
        <span className="text-fg text-sm font-[510]">Kairos</span>
      </div>
    </header>
  );
}
