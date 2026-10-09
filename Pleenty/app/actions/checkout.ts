'use server';

import { prisma } from '@/lib/prisma';
import { createYocoCheckout } from '@/lib/yoco';
import { getAuthenticatedUser } from '@/lib/auth-user';

type CheckoutInput = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  items: Array<{ productSlug: string; quantity: number }>;
};

export async function createCheckoutOrder(input: CheckoutInput, accessToken?: string) {
  if (!process.env.YOCO_SECRET_KEY) {
    return { success: false as const, error: 'Online payment is not configured yet. Please contact FreshCart before submitting an order.' };
  }
  if (!input.items?.length) return { success: false as const, error: 'Your basket is empty.' };
  if (!input.customerName?.trim() || !input.customerPhone?.trim() || !input.deliveryAddress?.trim()) {
    return { success: false as const, error: 'Please provide your name, phone number, and delivery address.' };
  }
  if (input.items.some(item => !item.productSlug || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
    return { success: false as const, error: 'Basket quantities must be whole numbers between 1 and 99.' };
  }

  const user = accessToken ? await getAuthenticatedUser(accessToken) : null;
  if (accessToken && !user) return { success: false as const, error: 'Your sign-in session expired. Please sign in again and retry checkout.' };

  const quantities = new Map<string, number>();
  for (const item of input.items) quantities.set(item.productSlug, (quantities.get(item.productSlug) ?? 0) + item.quantity);
  const productSlugs = [...quantities.keys()];
  const products = await prisma.product.findMany({ where: { slug: { in: productSlugs } } });
  if (products.length !== productSlugs.length) {
    return { success: false as const, error: 'One or more products are no longer available. Please refresh your basket.' };
  }
  const unavailable = productSlugs.map(slug => ({
    product: products.find(candidate => candidate.slug === slug)!,
    quantity: quantities.get(slug)!,
  })).find(({ product, quantity }) => !product.inStock || product.stockQty < quantity);
  if (unavailable) {
    return { success: false as const, error: unavailable.product.name + ' is out of stock or there is not enough stock available.' };
  }

  const lines = productSlugs.map(slug => {
    const product = products.find(candidate => candidate.slug === slug)!;
    const quantity = quantities.get(slug)!;
    const price = Number(product.price);
    return { productId: product.id, productName: product.name, quantity, price, lineTotal: price * quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const deliveryFee = subtotal >= 350 ? 0 : 35;
  const totalAmount = subtotal + deliveryFee;
  if (totalAmount < 2) return { success: false as const, error: 'Yoco payments require a minimum payment of R2.00.' };

  const email = user?.email || input.customerEmail?.trim() || undefined;
  const order = await prisma.order.create({
    data: {
      userId: user?.id || null,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      customerEmail: email,
      deliveryAddress: { line1: input.deliveryAddress.trim() },
      deliveryNotes: input.deliveryNotes?.trim() || undefined,
      subtotal, deliveryFee, totalAmount, status: 'pending', paymentStatus: 'unpaid',
      items: { create: lines },
    },
  });

  try {
    const checkout = await createYocoCheckout({ orderId: order.id, amountRands: totalAmount, customerEmail: email });
    await prisma.order.update({ where: { id: order.id }, data: { yocoCheckoutId: checkout.id } });
    return {
      success: true as const,
      orderId: order.id,
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      totalAmount,
      redirectUrl: checkout.redirectUrl,
    };
  } catch (error) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'payment_failed', paymentStatus: 'payment_failed' } }).catch(() => undefined);
    console.error('FreshCart could not start Yoco checkout:', error);
    return { success: false as const, error: 'Your order could not be sent to the secure payment page. No payment has been confirmed. Please try again or contact FreshCart.' };
  }
}
