import { NextRequest, NextResponse } from 'next/server';
import { verifyBetaCookie, COOKIE_NAME } from '@/lib/beta-gate';

const PUBLIC_PREFIXES = ['/beta-gate', '/api/beta-gate', '/docs', '/_next'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && (await verifyBetaCookie(token))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/beta-gate';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)',
  ],
};
