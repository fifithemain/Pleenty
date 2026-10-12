import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Email delivery is not configured.' }, { status: 503 });
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
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: "People's Market <welcome@peoplesmarket.co.za>",
      to: [email],
      subject: "Welcome to People's Market 🌱",
      template: {
        id: 'ead7dde9-5124-4eb1-b9e9-a3d90c379dde',
        variables: {
          FIRST_NAME: firstName,
          WEBSITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://pleenty.vercel.app',
        },
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Resend welcome email failed:', response.status, detail.slice(0, 500));
    return NextResponse.json({ error: 'Welcome email could not be sent.' }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
