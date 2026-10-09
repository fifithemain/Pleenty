import Link from 'next/link';

export default function PaymentFailure({ searchParams }: { searchParams: { order?: string } }) {
  const order = searchParams.order || '';
  return <main className="payment-result"><div className="payment-result-card"><span>PAYMENT FAILED</span><h1>Your payment did not go through.</h1><p>Your order has not been confirmed as paid. You can check your account for the latest payment status or contact FreshCart for help.</p>{order && <p>Order reference: <b>{order.slice(0, 8).toUpperCase()}</b></p>}<Link href="/account">View my account</Link><Link href="/">Back to shopping</Link></div></main>;
}
