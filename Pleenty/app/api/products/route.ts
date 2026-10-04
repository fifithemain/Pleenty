import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  try {
    const products = await prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(products.map((p) => ({ id: p.id, name: p.name, slug: p.slug, description: p.description, price: Number(p.price), comparePrice: null, unit: 'each', imageUrl: p.imageUrl ?? '🛒', stockQty: p.stockQty, inStock: p.inStock, categoryId: p.categoryId, category: p.category?.name ?? 'Uncategorized' })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Product catalogue query failed', error);
    return NextResponse.json({ error: 'Product catalogue is temporarily unavailable.' }, { status: 503 });
  }
}
