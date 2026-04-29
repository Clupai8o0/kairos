import type { Metadata, Viewport } from 'next';
import { Inter, Geist } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers';
import { SwRegister } from '@/components/sw-register';
import { auth } from '@/lib/auth';
import { resolveUserTheme } from '@/lib/themes/runtime';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#0f1011',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Kairos',
  description: 'AI-native scheduling and task management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kairos',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve theme server-side so data-theme is in the initial HTML — no FOUC.
  let themeId = 'obsidian-linear';
  let marketplaceCssUrl: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const resolved = await resolveUserTheme(session.user.id);
      if (resolved.kind === 'builtin') {
        themeId = resolved.id;
      } else {
        themeId = resolved.id;
        marketplaceCssUrl = resolved.cssUrl;
      }
    }
  } catch {
    // Auth/DB failure — fall back to default theme
  }

  return (
    <html lang="en" className={cn("font-sans", geist.variable)} data-theme={themeId}>
      <head>
        {marketplaceCssUrl && (
          <link rel="stylesheet" href={marketplaceCssUrl} />
        )}
      </head>
      <body>
        <SwRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
