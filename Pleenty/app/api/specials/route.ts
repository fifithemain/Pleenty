import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  return NextResponse.json({
    products: (data || []).map((p: any) => ({
      id: String(p.product_id || p.id),
      slug: String(p.slug || p.product_id || p.id),
      name: String(p.name || ''),
      unit: String(p.unit || 'each'),
      price: Number(p.special_price || 0),
      category: categoryLabel(String(p.catalog || 'other')),
      emoji: categoryEmoji(String(p.catalog || 'other')),
      color: '#f4f7f0',
      desc: String(p.description || 'Fresh-picked value for your everyday shop.'),
      imageUrl: cleanProductImage(p.image_url),
      isSpecial: true,
    })).filter((p: any) => p.name && Number.isFinite(p.price)),
    source: 'supabase',
  });
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
