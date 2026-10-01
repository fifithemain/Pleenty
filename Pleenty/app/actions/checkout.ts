'use server';
import { prisma } from '@/lib/prisma';
export async function createCheckoutOrder(input:{customerName:string;customerPhone:string;customerEmail?:string;deliveryAddress:string;deliveryNotes?:string;items:Array<{productId:string;quantity:number}>}){
 if(!input.items.length) return {success:false,error:'Your basket is empty.'};
 const ids=input.items.map(i=>i.productId); const products=await prisma.product.findMany({where:{id:{in:ids}}});
 if(products.length!==ids.length) return {success:false,error:'One or more products are no longer available.'};
 const lines=input.items.map(i=>{const p=products.find(x=>x.id===i.productId)!; if(!p.inStock||p.stockQty<i.quantity) throw new Error(`${p.name} is out of stock.`); return {productId:p.id,quantity:i.quantity,price:p.price};});
 const subtotal=lines.reduce((s,x)=>s+Number(x.price)*x.quantity,0); const deliveryFee=subtotal>=350?0:35; const totalAmount=subtotal+deliveryFee;
 const order=await prisma.order.create({data:{customerName:input.customerName,customerPhone:input.customerPhone,customerEmail:input.customerEmail,deliveryAddress:input.deliveryAddress,deliveryNotes:input.deliveryNotes,subtotal,deliveryFee,totalAmount,status:'PENDING',paymentStatus:'UNPAID',items:{create:lines}}});
 return {success:true,orderId:order.id,orderNumber:order.orderNumber,totalAmount};
}
