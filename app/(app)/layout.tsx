import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/app/sidebar';
import { MobileNav } from '@/components/app/mobile-nav';
import { CommandPalette } from '@/components/app/command-palette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/sign-in');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MobileNav />
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}
