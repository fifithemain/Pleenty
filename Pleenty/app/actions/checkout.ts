'use server';

import { prisma } from '@/lib/prisma';

type CheckoutInput = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  items: Array<{ productSlug: string; quantity: number }>;
};

export async function createCheckoutOrder(input: CheckoutInput) {
  if (!input.items?.length) {
    return { success: false as const, error: 'Your basket is empty.' };
  }

  if (!input.customerName?.trim() || !input.customerPhone?.trim() || !input.deliveryAddress?.trim()) {
    return { success: false as const, error: 'Please provide your name, phone number, and delivery address.' };
  }

  if (input.items.some((item) => !item.productSlug || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
    return { success: false as const, error: 'Basket quantities must be whole numbers between 1 and 99.' };
  }

  // Merge duplicate slugs so each product is checked and priced exactly once.
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.productSlug, (quantities.get(item.productSlug) ?? 0) + item.quantity);
  }
  const productSlugs = [...quantities.keys()];
  const products = await prisma.product.findMany({ where: { slug: { in: productSlugs } } });
  if (products.length !== productSlugs.length) {
    return { success: false as const, error: 'One or more products are no longer available. Please refresh your basket.' };
  }

  const lines = productSlugs.map((slug) => {
    const product = products.find((candidate) => candidate.slug === slug)!;
    const quantity = quantities.get(slug)!;
    if (!product.inStock || product.stockQty < quantity) {
      throw new Error(`${product.name} is out of stock or has insufficient stock.`);
    }
    return { productId: product.id, quantity, price: product.price };
  });

  const subtotal = lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);
  const deliveryFee = subtotal >= 350 ? 0 : 35;
  const totalAmount = subtotal + deliveryFee;

  const order = await prisma.order.create({
    data: {
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      customerEmail: input.customerEmail?.trim() || undefined,
      deliveryAddress: input.deliveryAddress.trim(),
      deliveryNotes: input.deliveryNotes?.trim() || undefined,
      subtotal,
      deliveryFee,
      totalAmount,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      items: { create: lines },
    },
  });

  return { success: true as const, orderId: order.id, orderNumber: order.orderNumber, totalAmount };
}
