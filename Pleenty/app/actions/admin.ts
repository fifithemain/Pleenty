'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

function checkKey(key: string) {
  if (!process.env.ADMIN_ACCESS_KEY || key !== process.env.ADMIN_ACCESS_KEY) {
    throw new Error('Unauthorized. Check the admin access key in Vercel.');
  }
}

export async function getAdminDashboardData(key: string) {
  checkKey(key);
  const [products, categories, orders] = await Promise.all([
    prisma.product.findMany({ include: { category: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, take: 250 }),
  ]);
  return {
    products: products.map(p => ({
      id: p.id, name: p.name, slug: p.slug, description: p.description || '',
      price: Number(p.price), imageUrl: p.imageUrl || '', stockQty: p.stockQty,
      inStock: p.inStock && p.stockQty > 0, categoryId: p.categoryId || '',
      categoryName: p.category?.name || 'Uncategorized',
    })),
    categories: categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description || '', isActive: c.isActive })),
    orders: orders.map(o => ({
      id: o.id, orderNumber: o.id.slice(0, 8).toUpperCase(), customerName: o.customerName,
      customerPhone: o.customerPhone, deliveryAddress: typeof o.deliveryAddress === 'object' && o.deliveryAddress !== null
        ? Object.values(o.deliveryAddress).filter((v): v is string => typeof v === 'string').join(', ')
        : String(o.deliveryAddress),
      totalAmount: Number(o.totalAmount), status: o.status.toUpperCase(), createdAt: o.createdAt.toISOString(),
      items: o.items.map(i => ({ quantity: i.quantity, price: Number(i.price), name: i.productName })),
    })),
  };
}

export async function createProduct(
  key: string,
  input: { name: string; slug: string; description?: string; price: number; comparePrice?: number; unit?: string; imageUrl?: string; stockQty: number; categoryId: string },
) {
  checkKey(key);
  if (!input.categoryId) throw new Error('Choose a category before adding this product.');
  const product = await prisma.product.create({
    data: {
      name: input.name.trim(), slug: input.slug.trim(), description: input.description?.trim() || null,
      price: input.price, imageUrl: input.imageUrl || null, stockQty: input.stockQty,
      inStock: input.stockQty > 0, categoryId: input.categoryId,
    },
  });
  revalidatePath('/admin'); revalidatePath('/');
  return { id: product.id };
}

export async function updateProduct(
  key: string, id: string,
  input: Partial<{ name: string; slug: string; description: string; price: number; imageUrl: string; stockQty: number; inStock: boolean; categoryId: string | null }>,
) {
  checkKey(key);
  const data = { ...input } as typeof input & { stockQty?: number; inStock?: boolean };
  if (data.stockQty !== undefined) data.inStock = data.stockQty > 0;
  await prisma.product.update({ where: { id }, data });
  revalidatePath('/admin'); revalidatePath('/');
}

export async function deleteProduct(key: string, id: string) {
  checkKey(key);
  await prisma.product.delete({ where: { id } });
  revalidatePath('/admin'); revalidatePath('/');
}

export async function createCategory(key: string, name: string, description = '') {
  checkKey(key);
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Enter a category name.');
  const slug = cleanName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('Enter a valid category name.');
  const category = await prisma.category.create({ data: { name: cleanName, slug, description: description.trim() || null, isActive: true } });
  revalidatePath('/admin'); revalidatePath('/');
  return { id: category.id };
}

export async function renameCategory(key: string, id: string, name: string, description = '') {
  checkKey(key);
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Category name cannot be empty.');
  const slug = cleanName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await prisma.category.update({ where: { id }, data: { name: cleanName, slug, description: description.trim() || null } });
  revalidatePath('/admin'); revalidatePath('/');
}

export async function deleteCategory(key: string, id: string) {
  checkKey(key);
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) throw new Error('Move this category’s products to another category before deleting it.');
  await prisma.category.delete({ where: { id } });
  revalidatePath('/admin'); revalidatePath('/');
}

export async function updateOrderStatus(
  key: string, id: string,
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED',
) {
  checkKey(key);
  await prisma.order.update({ where: { id }, data: { status: status.toLowerCase() } });
  revalidatePath('/admin'); revalidatePath('/');
}
