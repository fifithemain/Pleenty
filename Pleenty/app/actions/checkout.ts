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

  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.productSlug, (quantities.get(item.productSlug) ?? 0) + item.quantity);
  }
  const productSlugs = [...quantities.keys()];
  const products = await prisma.product.findMany({ where: { slug: { in: productSlugs } } });
  if (products.length !== productSlugs.length) {
    return { success: false as const, error: 'One or more products are no longer available. Please refresh your basket.' };
  }

  const unavailableProduct = productSlugs
    .map((slug) => ({
      product: products.find((candidate) => candidate.slug === slug)!,
      quantity: quantities.get(slug)!,
    }))
    .find(({ product, quantity }) => !product.inStock || product.stockQty < quantity);

  if (unavailableProduct) {
    return {
      success: false as const,
      error: `${unavailableProduct.product.name} is currently out of stock or there is not enough stock available. Please remove it or reduce the quantity in your basket.`,
    };
  }

  const lines = productSlugs.map((slug) => {
    const product = products.find((candidate) => candidate.slug === slug)!;
    const quantity = quantities.get(slug)!;
    const price = Number(product.price);
    return { productId: product.id, productName: product.name, quantity, price, lineTotal: price * quantity };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const deliveryFee = subtotal >= 350 ? 0 : 35;
  const totalAmount = subtotal + deliveryFee;

  const order = await prisma.order.create({
    data: {
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      deliveryAddress: { line1: input.deliveryAddress.trim() },
      deliveryNotes: input.deliveryNotes?.trim() || undefined,
      subtotal,
      deliveryFee,
      totalAmount,
      status: 'pending',
      paymentStatus: 'unpaid',
      items: { create: lines },
    },
  });

  return { success: true as const, orderId: order.id, orderNumber: order.id.slice(0, 8).toUpperCase(), totalAmount };
}
