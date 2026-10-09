'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCategory, createProduct, deleteCategory, deleteProduct, getAdminDashboardData,
  renameCategory, updateOrderStatus, updateProduct, saveMusicSettings,
} from '../actions/admin';

type Category = { id: string; name: string; slug: string; description: string; isActive: boolean };
type Product = { id: string; name: string; slug: string; description: string; price: number; imageUrl: string; stockQty: number; inStock: boolean; categoryId: string; categoryName: string };
type OrderItem = { quantity: number; price: number; name: string };
type Order = { id: string; orderNumber: string; customerName: string; customerPhone: string; deliveryAddress: string; totalAmount: number; status: string; createdAt: string; items: OrderItem[] };
type Tab = 'overview' | 'products' | 'categories' | 'music' | 'orders' | 'cancelled';
const money = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
const orderStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const;

export default function Admin() {
  const [key, setKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryDescription, setEditingCategoryDescription] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', description: '', price: '', imageUrl: '', stockQty: '10', categoryId: '' });
  const [musicTracks, setMusicTracks] = useState('');
  const [musicEnabled, setMusicEnabled] = useState(false);

  const load = useCallback(async (adminKey: string) => {
    if (!adminKey) return;
    setBusy(true);
    setError('');
    try {
      const data = await getAdminDashboardData(adminKey);
      setProducts(data.products as Product[]);
      setCategories(data.categories as Category[]);
      setOrders(data.orders as Order[]);
      setMusicTracks(Array.isArray(data.music?.tracks) ? data.music.tracks.join('\n') : '');
      setMusicEnabled(Boolean(data.music?.enabled));
      setUnlocked(true);
      setKey(adminKey);
      if (typeof window !== 'undefined') localStorage.setItem('freshcart-admin-key', adminKey);
      setForm(old => ({ ...old, categoryId: old.categoryId || data.categories[0]?.id || '' }));
    } catch (e: any) {
      const msg = e?.message || 'Could not load the dashboard.';
      setError(msg.includes('Unauthorized') ? 'Admin access key is invalid or ADMIN_ACCESS_KEY is not configured in Vercel.' : msg);
      setUnlocked(false);
      if (typeof window !== 'undefined') localStorage.removeItem('freshcart-admin-key');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('freshcart-admin-key');
    if (saved) { setKey(saved); void load(saved); }
  }, [load]);

  const filteredProducts = useMemo(() => products.filter(p =>
    (productCategory === 'all' || p.categoryId === productCategory) &&
    (p.name + ' ' + p.slug + ' ' + p.categoryName).toLowerCase().includes(productSearch.toLowerCase())
  ), [products, productCategory, productSearch]);
  const cancelledOrders = useMemo(() => orders.filter(o => o.status === 'CANCELLED'), [orders]);
  const filteredOrders = useMemo(() => {
    const source = tab === 'cancelled' ? cancelledOrders : orders;
    return source.filter(o => (orderStatus === 'ALL' || o.status === orderStatus) &&
      (o.orderNumber + ' ' + o.customerName + ' ' + o.customerPhone + ' ' + o.deliveryAddress).toLowerCase().includes(orderSearch.toLowerCase()));
  }, [orders, cancelledOrders, orderStatus, orderSearch, tab]);
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const revenue = orders.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + o.totalAmount, 0);

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await createProduct(key, { ...form, price: Number(form.price), stockQty: Number(form.stockQty), categoryId: form.categoryId });
      setMessage('Product added. It is now in your catalogue.');
      setForm(old => ({ ...old, name: '', slug: '', description: '', price: '', imageUrl: '', stockQty: '10' }));
      await load(key);
    } catch (e: any) { setError(e?.message || 'Could not add product.'); }
    finally { setBusy(false); }
  };

  const saveStock = async (p: Product, value: string) => {
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < 0) { setError('Quantity must be a whole number of 0 or more.'); return; }
    if (qty === p.stockQty && p.inStock === (qty > 0)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await updateProduct(key, p.id, { stockQty: qty, inStock: qty > 0 });
      setMessage(qty === 0 ? p.name + ' marked sold out.' : p.name + ' stock saved.');
      await load(key);
    } catch (e: any) { setError(e?.message || 'Stock update failed.'); }
    finally { setBusy(false); }
  };

  const saveProductCategory = async (p: Product, categoryId: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await updateProduct(key, p.id, { categoryId });
      setMessage(p.name + ' moved to ' + (categories.find(c => c.id === categoryId)?.name || 'the selected category') + '.');
      await load(key);
    } catch (e: any) { setError(e?.message || 'Could not change product category.'); }
    finally { setBusy(false); }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await createCategory(key, categoryName, categoryDescription);
      setCategoryName(''); setCategoryDescription('');
      setMessage('Category created. You can now assign products to it.');
      await load(key);
    } catch (e: any) { setError(e?.message || 'Could not create category.'); }
    finally { setBusy(false); }
  };

  const saveCategory = async (id: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await renameCategory(key, id, editingCategoryName, editingCategoryDescription);
      setEditingCategory(null); setMessage('Category saved.'); await load(key);
    } catch (e: any) { setError(e?.message || 'Could not save category.'); }
    finally { setBusy(false); }
  };

  const changeOrderStatus = async (order: Order, status: string) => {
    if (status === 'CANCELLED' && order.status !== 'CANCELLED' && !window.confirm('Cancel order ' + order.orderNumber + '? This will move it to Cancelled orders.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await updateOrderStatus(key, order.id, status as typeof orderStatuses[number]);
      setMessage('Order ' + order.orderNumber + ' updated to ' + status.replaceAll('_', ' ').toLowerCase() + '.');
      await load(key);
    } catch (e: any) { setError(e?.message || 'Could not update order status.'); }
    finally { setBusy(false); }
  };

  const saveMusic = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const tracks = musicTracks.split(/\\r?\\n/).map(track => track.trim()).filter(Boolean);
      const result = await saveMusicSettings(key, tracks, musicEnabled);
      setMusicTracks(result.tracks.join('\\n')); setMusicEnabled(result.enabled);
      setMessage(result.enabled ? 'Storefront music saved and enabled.' : 'Music settings saved. Storefront playback is disabled.');
    } catch (e: any) { setError(e?.message || 'Could not save music settings.'); }
    finally { setBusy(false); }
  };

  const orderList = (source: Order[]) => source.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer & delivery</th><th>Items</th><th>Total</th><th>Status</th><th>Update status</th></tr></thead><tbody>{source.map(o => <tr key={o.id}><td><b>{o.orderNumber}</b><small>{new Date(o.createdAt).toLocaleString('en-ZA')}</small></td><td><b>{o.customerName}</b><small>{o.customerPhone}</small><small>{o.deliveryAddress}</small></td><td>{o.items.map(i => i.quantity + ' × ' + i.name).join(', ') || 'No item details'}</td><td><b>{money(o.totalAmount)}</b></td><td><span className={'order-status status-' + o.status.toLowerCase()}>{o.status.replaceAll('_', ' ')}</span></td><td><select aria-label={'Status for order ' + o.orderNumber} value={o.status} disabled={busy} onChange={e => void changeOrderStatus(o, e.target.value)}>{orderStatuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></td></tr>)}</tbody></table></div> : <div className="admin-empty"><b>{tab === 'cancelled' ? 'No cancelled orders' : 'No orders found'}</b><p>{tab === 'cancelled' ? 'Orders you cancel will be listed here for easy reference.' : 'New customer orders will appear here.'}</p></div>;

  return <main className="admin-shell">
    <header className="admin-header"><div><b>FreshCart Admin</b><span>Store management · Products, categories & orders</span></div>{unlocked && <button onClick={() => { localStorage.removeItem('freshcart-admin-key'); setKey(''); setUnlocked(false); setProducts([]); setCategories([]); setOrders([]); setMessage(''); setError(''); }}>Sign out</button>}</header>
    {!unlocked ? <section className="admin-login"><h1>Admin access</h1><p>Sign in with your private admin access key to manage the FreshCart catalogue and orders.</p><form onSubmit={e => { e.preventDefault(); void load(key); }}><label>Admin access key<input type="password" autoComplete="current-password" value={key} onChange={e => setKey(e.target.value)} placeholder="Enter your admin access key" required /></label><button type="submit" disabled={busy}>{busy ? 'Loading dashboard…' : 'Open dashboard'}</button></form>{error && <p className="admin-error">{error}</p>}</section> : <>
      <nav className="admin-nav">
        {([['overview','Overview'],['products','Products'],['categories','Categories'],['orders','All orders'],['cancelled','Cancelled orders']] as [Tab,string][]).map(([id,label]) => <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}{id === 'products' ? ' (' + products.length + ')' : id === 'categories' ? ' (' + categories.length + ')' : id === 'orders' ? ' (' + orders.length + ')' : id === 'cancelled' ? ' (' + cancelledOrders.length + ')' : ''}</button>)}
        <button className="admin-refresh" disabled={busy} onClick={() => void load(key)}>{busy ? 'Refreshing…' : '↻ Refresh data'}</button>
      </nav>
      {message && <div className="admin-message" role="status">{message}</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}

      {tab === 'overview' && <section className="admin-dashboard-content">
        <div className="admin-grid">
          <div className="stat"><small>Total products</small><b>{products.length}</b><span>Across {categories.length} categories</span></div>
          <div className="stat"><small>In stock</small><b>{products.filter(p => p.stockQty > 0 && p.inStock).length}</b><span>{products.filter(p => p.stockQty === 0 || !p.inStock).length} sold out</span></div>
          <div className="stat"><small>Orders to process</small><b>{pendingCount}</b><span>{orders.length} orders loaded</span></div>
          <div className="stat"><small>Cancelled orders</small><b>{cancelledOrders.length}</b><span>Kept in a separate dashboard</span></div>
          <div className="stat"><small>Order value (excluding cancelled)</small><b>{money(revenue)}</b><span>All loaded orders, not accounting revenue</span></div>
        </div>
        <div className="panel admin-quick-links"><h2>Quick actions</h2><button onClick={() => setTab('products')}>＋ Add a product</button><button onClick={() => setTab('categories')}>＋ Create a category</button><button onClick={() => { setTab('orders'); setOrderStatus('PENDING'); }}>Review pending orders</button><button onClick={() => setTab('cancelled')}>View cancelled orders</button></div>
        <div className="panel"><h2>Latest orders</h2>{orderList(orders.slice(0, 5))}</div>
      </section>}

      {tab === 'products' && <section className="admin-dashboard-content">
        <div className="panel"><h2>Add a product</h2><p className="panel-intro">Fill in the details below. Choose a category so shoppers can find the product in the right section.</p>
          <form onSubmit={addProduct} className="admin-form">
            <label>Product name<input required placeholder="e.g. Ripe Avocados" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
            <label>Product URL slug<input required placeholder="e.g. ripe-avocados (lowercase, hyphens)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}/></label>
            <label>Product description<textarea placeholder="Short description customers will see" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
            <label>Selling price (R)<input required type="number" min="0" step="0.01" placeholder="e.g. 29.99" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}/></label>
            <label>Product image URL or emoji<input placeholder="Paste a product-only image URL, or enter 🥑" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })}/></label>
            <label>Available stock quantity<input required type="number" min="0" step="1" placeholder="Enter 0 if sold out" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })}/><small>Set to 0 to show SOLD OUT on the live shop.</small></label>
            <label>Product category<select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Choose a category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            {!categories.length && <p className="admin-error">Create a category first in the Categories tab.</p>}
            <button type="submit" disabled={busy || !categories.length}>{busy ? 'Saving…' : 'Add product to catalogue'}</button>
          </form>
        </div>
        <div className="panel"><div className="admin-panel-heading"><div><h2>Product catalogue</h2><p className="panel-intro">{products.length} products loaded directly from the database.</p></div><button className="secondary-admin-button" disabled={busy} onClick={() => void load(key)}>Reload</button></div>
          <div className="admin-filters"><input aria-label="Search products" placeholder="Search products or categories…" value={productSearch} onChange={e => setProductSearch(e.target.value)}/><select aria-label="Filter by category" value={productCategory} onChange={e => setProductCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          {filteredProducts.length ? <div className="admin-product-list">{filteredProducts.map(p => <article className="admin-product-card" key={p.id}><div className="admin-product-details"><b>{p.name}</b><small>{p.slug}</small><span className={'order-status ' + (p.stockQty > 0 && p.inStock ? 'status-delivered' : 'status-cancelled')}>{p.stockQty > 0 && p.inStock ? 'IN STOCK' : 'SOLD OUT'} · {p.stockQty} available</span><strong>{money(p.price)}</strong></div><label>Category<select aria-label={'Category for ' + p.name} value={p.categoryId} disabled={busy} onChange={e => void saveProductCategory(p, e.target.value)}><option value="">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Stock quantity<input aria-label={'Stock quantity for ' + p.name} type="number" min="0" step="1" defaultValue={p.stockQty} key={p.id + ':' + p.stockQty} disabled={busy} onBlur={e => void saveStock(p, e.currentTarget.value)}/><small>0 = sold out</small></label><button className="danger-admin-button" disabled={busy} onClick={async () => { if (!window.confirm('Delete ' + p.name + '? This cannot be undone.')) return; setBusy(true); try { await deleteProduct(key, p.id); setMessage(p.name + ' deleted.'); await load(key); } catch (e: any) { setError(e?.message || 'Could not delete product.'); } finally { setBusy(false); } }}>Delete</button></article>)}</div> : <div className="admin-empty"><b>No products match these filters</b><p>Clear the search or select All categories. If this is unexpected, use Refresh data.</p><button className="secondary-admin-button" onClick={() => { setProductSearch(''); setProductCategory('all'); void load(key); }}>Clear filters and reload</button></div>}
        </div>
      </section>}

      {tab === 'categories' && <section className="admin-dashboard-content">
        <div className="panel"><h2>Create a category</h2><p className="panel-intro">Categories organise the live shop, for example Produce, Pantry, Dairy or Household.</p><form className="admin-form" onSubmit={addCategory}><label>Category name<input required placeholder="e.g. Fruit & Vegetables" value={categoryName} onChange={e => setCategoryName(e.target.value)}/></label><label>Description (optional)<textarea placeholder="What belongs in this category?" value={categoryDescription} onChange={e => setCategoryDescription(e.target.value)}/></label><button disabled={busy} type="submit">{busy ? 'Saving…' : 'Create category'}</button></form></div>
        <div className="panel"><h2>Shop categories</h2><p className="panel-intro">Rename categories or see how many products are assigned to each one.</p>{categories.map(c => <div className="category-admin-row" key={c.id}>{editingCategory === c.id ? <div className="category-edit-fields"><input aria-label="Category name" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} placeholder="Category name"/><input aria-label="Category description" value={editingCategoryDescription} onChange={e => setEditingCategoryDescription(e.target.value)} placeholder="Description (optional)"/><div><button disabled={busy} onClick={() => void saveCategory(c.id)}>Save</button><button className="secondary-admin-button" onClick={() => setEditingCategory(null)}>Cancel</button></div></div> : <><div><b>{c.name}</b><small>/{c.slug} · {products.filter(p => p.categoryId === c.id).length} products</small>{c.description && <p>{c.description}</p>}</div><div className="category-row-actions"><button className="secondary-admin-button" onClick={() => { setEditingCategory(c.id); setEditingCategoryName(c.name); setEditingCategoryDescription(c.description); }}>Edit</button><button className="danger-admin-button" disabled={busy || products.some(p => p.categoryId === c.id)} title={products.some(p => p.categoryId === c.id) ? 'Move products out of this category first' : 'Delete category'} onClick={async () => { if (!window.confirm('Delete category ' + c.name + '?')) return; setBusy(true); try { await deleteCategory(key, c.id); setMessage('Category deleted.'); await load(key); } catch (e: any) { setError(e?.message || 'Could not delete category.'); } finally { setBusy(false); } }}>Delete</button></div></>}</div>)}</div>
      </section>}

      {tab === 'music' && <section className="admin-dashboard-content"><div className="panel"><h2>Storefront music</h2><p className="panel-intro">Add direct HTTPS links to audio files (such as MP3 or OGG), one URL per line. Most streaming-page URLs are not direct audio files. Browsers may block sound autoplay until the visitor presses Play.</p><form className="admin-form" onSubmit={saveMusic}><label>Song URLs<textarea rows={8} placeholder="https://your-domain.com/music/song-one.mp3&#10;https://your-domain.com/music/song-two.mp3" value={musicTracks} onChange={e => setMusicTracks(e.target.value)}/><small>Up to 30 songs. Use audio files you own or are licensed to play.</small></label><label className="admin-checkbox-label"><input type="checkbox" checked={musicEnabled} onChange={e => setMusicEnabled(e.target.checked)}/> Enable music on the storefront</label><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save music settings'}</button></form><div className="admin-music-preview"><b>Current playlist</b><p>{musicTracks.split(/\\r?\\n/).filter(line => line.trim()).length} track(s) · {musicEnabled ? 'Enabled' : 'Disabled'}</p></div></div></section>}

      {(tab === 'orders' || tab === 'cancelled') && <section className="admin-dashboard-content"><div className="panel"><div className="admin-panel-heading"><div><h2>{tab === 'cancelled' ? 'Cancelled orders' : 'Order management'}</h2><p className="panel-intro">{tab === 'cancelled' ? 'A dedicated record of cancelled orders. You can restore an order by changing its status.' : 'Review customer details, delivery addresses, items and update each order status.'}</p></div><button className="secondary-admin-button" disabled={busy} onClick={() => void load(key)}>Refresh</button></div><div className="admin-filters"><input aria-label="Search orders" placeholder="Search order number, customer, phone…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)}/>{tab === 'orders' && <select aria-label="Filter order status" value={orderStatus} onChange={e => setOrderStatus(e.target.value)}><option value="ALL">All statuses</option>{orderStatuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select>}</div>{tab === 'cancelled' ? orderList(filteredOrders.filter(o => o.status === 'CANCELLED')) : orderList(filteredOrders)}</div></section>}
    </>}
  </main>;
}
