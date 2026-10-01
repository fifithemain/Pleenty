'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

function checkKey(key:string){ if(!process.env.ADMIN_ACCESS_KEY || key !== process.env.ADMIN_ACCESS_KEY) throw new Error('Unauthorized'); }
export async function createProduct(key:string, input:{name:string;slug:string;description?:string;price:number;comparePrice?:number;unit:string;imageUrl:string;stockQty:number;categoryId:string}){checkKey(key);const p=await prisma.product.create({data:{...input,price:input.price,comparePrice:input.comparePrice||null}});revalidatePath('/admin');revalidatePath('/');return {id:p.id};}
export async function updateProduct(key:string,id:string,input:Partial<{name:string;slug:string;description:string;price:number;comparePrice:number|null;unit:string;imageUrl:string;stockQty:number;inStock:boolean}>){checkKey(key);await prisma.product.update({where:{id},data:input});revalidatePath('/admin');revalidatePath('/');}
export async function deleteProduct(key:string,id:string){checkKey(key);await prisma.product.delete({where:{id}});revalidatePath('/admin');revalidatePath('/');}
export async function updateOrderStatus(key:string,id:string,status:'PENDING'|'PAID'|'PREPARING'|'OUT_FOR_DELIVERY'|'DELIVERED'|'CANCELLED'){checkKey(key);await prisma.order.update({where:{id},data:{status}});revalidatePath('/admin');revalidatePath('/');}
