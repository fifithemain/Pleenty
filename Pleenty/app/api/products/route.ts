import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export async function GET(){const products=await prisma.product.findMany({include:{category:true},orderBy:{createdAt:'desc'}});return NextResponse.json(products.map(p=>({...p,price:Number(p.price),comparePrice:p.comparePrice?Number(p.comparePrice):undefined,category:p.category.name,categoryId:p.categoryId})));}
