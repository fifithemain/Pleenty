import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

export const revalidate = 60;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ products: [], source: 'demo', error: 'Supabase public environment variables are not configured.' }, { status: 200 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from('current_published_specials')
    .select('id,product_id,name,slug,description,image_url,special_price,unit,catalog')
    .order('name');

  if (error) {
    console.error('Could not load Freshcart specials:', error.message);
    return NextResponse.json({ products: [], source: 'demo', error: 'Published specials could not be loaded.' }, { status: 200 });
  }

  const inventory = await prisma.product.findMany({ select: { id: true, slug: true, stockQty: true, inStock: true } });
  const products = (data || []).map((p: any) => {
    const productId = String(p.product_id || '');
    const slug = String(p.slug || p.product_id || p.id);
    const stock = inventory.find((item) => item.id === productId || item.slug === slug);
    const stockQty = stock?.stockQty ?? 0;
    return {
      id: productId || String(p.id),
      slug,
      name: String(p.name || ''),
      unit: String(p.unit || 'each'),
      price: Number(p.special_price || 0),
      category: categoryLabel(String(p.catalog || 'other')),
      emoji: categoryEmoji(String(p.catalog || 'other')),
      color: '#f4f7f0',
      desc: String(p.description || 'Fresh-picked value for your everyday shop.'),
      imageUrl: cleanProductImage(p.image_url),
      isSpecial: true,
      stockQty,
      inStock: Boolean(stock?.inStock) && stockQty > 0,
    };
  }).filter((p: any) => p.name && Number.isFinite(p.price));

  return NextResponse.json({ products, source: 'supabase' }, { headers: { 'Cache-Control': 'no-store' } });
}

function categoryLabel(catalog: string) {
  const map: Record<string, string> = {
    produce: 'Fruit & Veg', dairy: 'Dairy & Eggs', bakery: 'Bakery', pantry: 'Pantry',
    meat: 'Meat', frozen: 'Frozen', beverages: 'Drinks', household: 'Household', other: 'Everyday essentials',
  };
  return map[catalog] || 'Everyday essentials';
}
function categoryEmoji(catalog: string) {
  const map: Record<string, string> = {
    produce: '🥑', dairy: '🥛', bakery: '🍞', pantry: '🫙', meat: '🥩',
    frozen: '🧊', beverages: '🧃', household: '🧼', other: '🛒',
  };
  return map[catalog] || '🛒';
}
function cleanProductImage(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('https://')) return null;
  // Only use stored cropped product images, never a flyer/source-file URL.
  if (/flyer|catalogue|catalog|source-file|original/i.test(value)) return null;
  return value;
}
