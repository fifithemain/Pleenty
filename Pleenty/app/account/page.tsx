'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

type Order = {
  id: string; orderNumber: string; status: string; paymentStatus: string; totalAmount: number;
  subtotal: number; deliveryFee: number; createdAt: string; deliveryAddress: string;
  items: Array<{ name: string; quantity: number; price: number }>;
};
const money = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export default function AccountPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadOrders = useCallback(async (token: string) => {
    const response = await fetch('/api/account/orders', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load order history.');
    setOrders(data.orders || []);
  }, []);

  useEffect(() => {
    try {
      const supabase = createBrowserSupabaseClient();
      supabase.auth.getSession().then(async ({ data }) => {
        const current = data.session;
        if (!current?.user) return;
        setUser({ id: current.user.id, email: current.user.email || '' });
        try { await loadOrders(current.access_token); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load orders.'); }
      });
    } catch (e) { setError(e instanceof Error ? e.message : 'Accounts are not configured.'); }
  }, [loadOrders]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + '/account' },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage('Account created. Check your email to confirm your address, then sign in.');
        } else {
          setUser({ id: data.user!.id, email: data.user!.email || email });
          await loadOrders(data.session.access_token);
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session || !data.user) throw new Error('Sign-in did not return a session.');
        setUser({ id: data.user.id, email: data.user.email || email });
        await loadOrders(data.session.access_token);
        setMessage('You are signed in.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete account request.'); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    try { const supabase = createBrowserSupabaseClient(); await supabase.auth.signOut(); } finally { setUser(null); setOrders([]); setMessage('You have signed out.'); }
  };

  if (!user) return <main className="account-shell">
    <Link href="/" className="account-back">← Back to FreshCart</Link>
    <section className="account-auth-card">
      <span className="account-kicker">YOUR FRESHCART ACCOUNT</span>
      <h1>{mode === 'signup' ? 'Create your account.' : 'Welcome back.'}</h1>
      <p>Keep your orders, payment confirmations and delivery updates in one place.</p>
      <div className="account-mode"><button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create account</button></div>
      <form onSubmit={submit} className="account-form">
        {mode === 'signup' && <label>Full name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>}
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required /></label>
        <button className="account-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
      </form>
      {message && <p className="account-message">{message}</p>}{error && <p className="account-error">{error}</p>}
      <small>Use a valid email address so account confirmation and order updates can reach you.</small>
    </section>
  </main>;

  return <main className="account-shell">
    <header className="account-dashboard-header"><div><span className="account-kicker">FRESHCART ACCOUNT</span><h1>Your orders, at a glance.</h1><p>Signed in as {user.email}</p></div><div><Link href="/" className="account-back">Continue shopping →</Link><button className="account-signout" onClick={() => void signOut()}>Sign out</button></div></header>
    {message && <p className="account-message">{message}</p>}{error && <p className="account-error">{error}</p>}
    <section className="account-summary-grid"><div><small>Total orders</small><strong>{orders.length}</strong></div><div><small>Awaiting payment</small><strong>{orders.filter(o => !['PAID','SUCCEEDED','COMPLETED'].includes(o.paymentStatus)).length}</strong></div><div><small>In progress</small><strong>{orders.filter(o => !['DELIVERED','CANCELLED'].includes(o.status)).length}</strong></div></section>
    <section className="account-orders"><div className="account-orders-heading"><div><h2>Order history</h2><p>Payment and delivery status for your recent orders.</p></div><button onClick={() => { setError(''); createBrowserSupabaseClient().auth.getSession().then(({ data }) => data.session && loadOrders(data.session.access_token).catch(e => setError(e.message))); }}>Refresh</button></div>
      {orders.length ? orders.map(order => <article className="account-order-card" key={order.id}><div className="account-order-top"><div><b>Order #{order.orderNumber}</b><small>{new Date(order.createdAt).toLocaleString('en-ZA')}</small></div><strong>{money(order.totalAmount)}</strong></div><div className="account-status-row"><span>Payment: <b className={'account-status status-' + order.paymentStatus.toLowerCase()}>{pretty(order.paymentStatus)}</b></span><span>Delivery: <b className={'account-status status-' + order.status.toLowerCase()}>{pretty(order.status)}</b></span></div><p className="account-address">Delivery to: {order.deliveryAddress || 'Address saved with order'}</p><ul>{order.items.map((item, i) => <li key={order.id + '-' + i}>{item.quantity} × {item.name} <span>{money(item.price * item.quantity)}</span></li>)}</ul>{!['PAID','SUCCEEDED','COMPLETED'].includes(order.paymentStatus) && <p className="account-payment-note">Payment is not yet confirmed. If you did not finish payment, please contact FreshCart before placing the same order again.</p>}</article>) : <div className="account-empty"><span>🧺</span><h2>Your next order starts here.</h2><p>When you shop while signed in, your orders will appear in this dashboard.</p><Link href="/" className="account-primary">Shop FreshCart</Link></div>}
    </section>
  </main>;
}
