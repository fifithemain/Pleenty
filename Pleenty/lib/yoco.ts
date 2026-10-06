const YOCO_API_URL = 'https://payments.yoco.com/api';

export type YocoCheckout = {
  id: string;
  redirectUrl: string;
  status?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, string>;
};

function requireYocoSecret() {
  const key = process.env.YOCO_SECRET_KEY;
  if (!key) throw new Error('Yoco payments are not configured. Add YOCO_SECRET_KEY to Vercel.');
  return key;
}

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return 'https://' + vercelUrl;
  return 'http://localhost:3000';
}

export async function createYocoCheckout(input: {
  orderId: string;
  amountRands: number;
  customerEmail?: string;
}) {
  const secret = requireYocoSecret();
  const amount = Math.round(input.amountRands * 100);
  const siteUrl = getSiteUrl();
  const response = await fetch(YOCO_API_URL + '/checkouts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      amount, currency: 'ZAR',
      description: 'FreshCart order ' + input.orderId.slice(0, 8).toUpperCase(),
      metadata: { orderId: input.orderId, ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}) },
      successUrl: siteUrl + '/payment/success?order=' + encodeURIComponent(input.orderId),
      cancelUrl: siteUrl + '/payment/cancel?order=' + encodeURIComponent(input.orderId),
      failureUrl: siteUrl + '/payment/failure?order=' + encodeURIComponent(input.orderId),
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error('Yoco checkout creation failed (' + response.status + '): ' + body.slice(0, 500));
  }
  const data = (await response.json()) as YocoCheckout;
  if (!data.id || !data.redirectUrl) throw new Error('Yoco did not return a checkout URL.');
  return data;
}

export async function getYocoCheckout(checkoutId: string) {
  const secret = requireYocoSecret();
  const response = await fetch(YOCO_API_URL + '/checkouts/' + encodeURIComponent(checkoutId), {
    headers: { Authorization: 'Bearer ' + secret }, cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error('Yoco checkout lookup failed (' + response.status + '): ' + body.slice(0, 500));
  }
  return (await response.json()) as YocoCheckout;
}