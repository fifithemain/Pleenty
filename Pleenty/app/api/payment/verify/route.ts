import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getYocoCheckout } from '@/lib/yoco';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order');
  if (!orderId) return NextResponse.json({ error: 'Missing order reference.' }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (['paid', 'succeeded', 'completed'].includes(order.paymentStatus.toLowerCase())) {
    return NextResponse.json({ paid: true, orderNumber: order.id.slice(0, 8).toUpperCase(), status: order.status });
  }
  if (!order.yocoCheckoutId) return NextResponse.json({ paid: false, status: order.status, paymentStatus: order.paymentStatus });
  try {
    const checkout = await getYocoCheckout(order.yocoCheckoutId);
    const state = String(checkout.status || '').toLowerCase();
    const paid = ['completed', 'succeeded', 'paid'].includes(state);
    if (paid) {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'paid', status: 'confirmed' } });
      return NextResponse.json({ paid: true, orderNumber: order.id.slice(0, 8).toUpperCase(), status: 'confirmed' });
    }
    return NextResponse.json({ paid: false, status: order.status, paymentStatus: order.paymentStatus, providerStatus: state });
  } catch {
    return NextResponse.json({ paid: false, status: order.status, paymentStatus: order.paymentStatus, message: 'Payment verification is temporarily unavailable.' });
  }
}
