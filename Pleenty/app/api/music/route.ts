import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'storefront_music' } });
  const value = setting?.value as { enabled?: boolean; tracks?: string[] } | undefined;
  return NextResponse.json({
    enabled: Boolean(value?.enabled),
    tracks: Array.isArray(value?.tracks) ? value!.tracks.filter((track): track is string => typeof track === 'string') : [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const suppliedKey = request.headers.get('x-admin-key') || '';
  if (!process.env.ADMIN_ACCESS_KEY || suppliedKey !== process.env.ADMIN_ACCESS_KEY) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { enabled?: boolean; tracks?: unknown } | null;
  if (!body || !Array.isArray(body.tracks)) {
    return NextResponse.json({ error: 'Provide a list of audio URLs.' }, { status: 400 });
  }
  const tracks = body.tracks.map(value => String(value).trim()).filter(Boolean);
  if (tracks.length > 30) return NextResponse.json({ error: 'Please add no more than 30 tracks.' }, { status: 400 });
  if (tracks.some(track => {
    try { const url = new URL(track); return url.protocol !== 'https:'; } catch { return true; }
  })) {
    return NextResponse.json({ error: 'Each track must be a valid HTTPS URL to an audio file.' }, { status: 400 });
  }
  const value = { enabled: Boolean(body.enabled) && tracks.length > 0, tracks };
  await prisma.appSetting.upsert({
    where: { key: 'storefront_music' },
    create: { key: 'storefront_music', value },
    update: { value },
  });
  return NextResponse.json({ success: true, ...value });
}
