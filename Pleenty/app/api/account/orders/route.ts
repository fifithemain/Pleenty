import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth-user';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ error: 'Please sign in to view your orders.' }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({
    orders: orders.map(order => ({
      id: order.id,
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      status: order.status.toUpperCase(),
      paymentStatus: order.paymentStatus.toUpperCase(),
      totalAmount: Number(order.totalAmount),
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      createdAt: order.createdAt.toISOString(),
      deliveryAddress: typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null
        ? Object.values(order.deliveryAddress).filter((v): v is string => typeof v === 'string').join(', ')
        : String(order.deliveryAddress),
      items: order.items.map(item => ({ name: item.productName, quantity: item.quantity, price: Number(item.price) })),
    })),
  });
}
