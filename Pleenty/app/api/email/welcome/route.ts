import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Email automation is not configured.' }, { status: 503 });
  }

  let body: { email?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const firstName = name.split(/\s+/)[0] || 'there';
  const response = await fetch('https://api.resend.com/events/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'user.created',
      email,
      payload: {
        firstName,
        websiteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://peoplesmarket.co.za',
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Resend signup automation trigger failed:', response.status, detail.slice(0, 500));
    return NextResponse.json({ error: 'The welcome automation could not be triggered.' }, { status: 502 });
  }

  return NextResponse.json({ triggered: true });
}
