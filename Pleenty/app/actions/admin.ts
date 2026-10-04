'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

function checkKey(key: string) {
  if (!process.env.ADMIN_ACCESS_KEY || key !== process.env.ADMIN_ACCESS_KEY) {
    throw new Error('Unauthorized');
  }
}

export async function createProduct(
  key: string,
  input: {
    name: string;
    slug: string;
    description?: string;
    price: number;
    comparePrice?: number;
    unit?: string;
    imageUrl?: string;
    stockQty: number;
    categoryId: string;
  },
) {
  checkKey(key);
  const product = await prisma.product.create({
    data: {
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() || null,
      price: input.price,
      imageUrl: input.imageUrl || null,
      stockQty: input.stockQty,
      inStock: input.stockQty > 0,
      categoryId: input.categoryId,
    },
  });
  revalidatePath('/admin');
  revalidatePath('/');
  return { id: product.id };
}

export async function updateProduct(
  key: string,
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    description: string;
    price: number;
    imageUrl: string;
    stockQty: number;
    inStock: boolean;
  }>,
) {
  checkKey(key);
  const data = { ...input } as typeof input & { stockQty?: number; inStock?: boolean };
  if (data.stockQty !== undefined) data.inStock = data.stockQty > 0;
  await prisma.product.update({ where: { id }, data });
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function deleteProduct(key: string, id: string) {
  checkKey(key);
  await prisma.product.delete({ where: { id } });
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function updateOrderStatus(
  key: string,
  id: string,
  status: 'PENDING' | 'PAID' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED',
) {
  checkKey(key);
  await prisma.order.update({ where: { id }, data: { status: status.toLowerCase() } });
  revalidatePath('/admin');
  revalidatePath('/');
}
