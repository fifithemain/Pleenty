import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const suppliedKey = request.headers.get('x-admin-key') || '';
  if (!process.env.ADMIN_ACCESS_KEY || suppliedKey !== process.env.ADMIN_ACCESS_KEY) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Music uploads are not configured. Check the Supabase service-role key in Vercel.' }, { status: 503 });
  }
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an audio file to upload.' }, { status: 400 });
  if (file.size < 1 || file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Each audio file must be smaller than 15 MB.' }, { status: 400 });
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const allowed = new Set(['mp3','ogg','wav','m4a','aac','webm']);
  if (!allowed.has(ext)) return NextResponse.json({ error: 'Use an MP3, OGG, WAV, M4A, AAC, or WEBM audio file.' }, { status: 400 });
  const mime = file.type.startsWith('audio/') ? file.type : ({
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
    aac: 'audio/aac', webm: 'audio/webm',
  } as Record<string, string>)[ext];
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100);
  const path = Date.now() + '-' + crypto.randomUUID() + '-' + safeName;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.storage.from('freshcart-music').upload(path, await file.arrayBuffer(), {
    contentType: mime, cacheControl: '3600', upsert: false,
  });
  if (error) {
    console.error('FreshCart music upload failed:', error.message);
    return NextResponse.json({ error: 'Could not upload this song. Please try again.' }, { status: 500 });
  }
  const { data } = supabase.storage.from('freshcart-music').getPublicUrl(path);
  return NextResponse.json({ success: true, name: file.name, url: data.publicUrl });
}
