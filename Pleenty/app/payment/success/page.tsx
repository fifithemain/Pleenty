'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function PaymentSuccess() {
  const params = useSearchParams();
  const order = params.get('order') || '';
  const [state, setState] = useState<'checking' | 'paid' | 'unconfirmed'>('checking');
  const [number, setNumber] = useState(order.slice(0, 8).toUpperCase());
  useEffect(() => {
    let active = true;
    if (!order) { setState('unconfirmed'); return; }
    fetch('/api/payment/verify?order=' + encodeURIComponent(order), { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (!active) return;
        if (data.paid) { setState('paid'); setNumber(data.orderNumber || number); }
        else setState('unconfirmed');
      })
      .catch(() => { if (active) setState('unconfirmed'); });
    return () => { active = false; };
  }, [order]);
  return <main className="payment-result"><div className="payment-result-card">
    <span>{state === 'paid' ? 'PAYMENT VERIFIED' : state === 'checking' ? 'CHECKING PAYMENT' : 'PAYMENT NOT YET CONFIRMED'}</span>
    <h1>{state === 'paid' ? 'You’re all set.' : state === 'checking' ? 'Verifying your payment…' : 'We have not confirmed your payment yet.'}</h1>
    <p>{state === 'paid' ? 'Your payment has been verified with Yoco. Your order is now confirmed and will appear in your account dashboard.' : state === 'checking' ? 'Please wait while we check the payment status directly with the payment provider.' : 'Returning to this page does not prove payment succeeded. Please allow a moment and check your account for the latest payment status.'}</p>
    {order && <p>Order reference: <b>{number}</b></p>}
    {state === 'unconfirmed' && <button onClick={() => { setState('checking'); fetch('/api/payment/verify?order=' + encodeURIComponent(order), { cache: 'no-store' }).then(r => r.json()).then(data => { if (data.paid) { setState('paid'); setNumber(data.orderNumber || number); } else setState('unconfirmed'); }).catch(() => setState('unconfirmed')); }}>Check payment again</button>}
    <Link href="/account">View my account</Link><Link href="/">Continue shopping</Link>
  </div></main>;
}
