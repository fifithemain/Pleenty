'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
export default function PaymentCancel() {
  const params = useSearchParams();
  const order = params.get('order');
  return <main className="payment-result"><div className="payment-result-card"><span>PAYMENT NOT COMPLETED</span><h1>Your order is waiting for payment.</h1><p>No payment confirmation was received. You can return to FreshCart and try again, or sign in to check your order status.</p>{order && <p>Order reference: <b>{order.slice(0, 8).toUpperCase()}</b></p>}<Link href="/account">View my account</Link><Link href="/">Back to shopping</Link></div></main>;
}
