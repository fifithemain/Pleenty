import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!process.env.ADMIN_ACCESS_KEY || body.key !== process.env.ADMIN_ACCESS_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.id.slice(0, 8).toUpperCase(),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null
          ? Object.values(order.deliveryAddress).filter((value): value is string => typeof value === 'string').join(', ')
          : String(order.deliveryAddress),
        totalAmount: Number(order.totalAmount),
        status: order.status.toUpperCase(),
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          quantity: item.quantity,
          price: Number(item.price),
          product: { name: item.productName },
        })),
      })),
    });
  } catch (error) {
    console.error('Failed to load admin orders:', error);
    return NextResponse.json({ error: 'Could not load orders.' }, { status: 500 });
  }
}
