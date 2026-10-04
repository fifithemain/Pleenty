import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Product data comes from the database at request time. Do not run this query
// during Next.js static generation, where production secrets are not available.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      products.map((product) => ({
        ...product,
        price: Number(product.price),
        comparePrice: product.comparePrice == null ? null : Number(product.comparePrice),
        category: product.category.name,
        categoryId: product.categoryId,
      })),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Failed to load products from the database:', error);
    return NextResponse.json(
      { error: 'Product catalogue is temporarily unavailable. Check the database configuration.' },
      { status: 503 },
    );
  }
}
