// app/api/plugins/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listPlugins, getPluginWithConfig } from '@/lib/plugins/host';

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const plugins = listPlugins();
  const withConfigs = await Promise.all(plugins.map((p) => getPluginWithConfig(userId, p.name)));
  return NextResponse.json(withConfigs.filter(Boolean));
}
