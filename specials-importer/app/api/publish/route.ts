import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { importerAuthorized } from '../../../lib/importer-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const catalogSlugs = new Set(['produce','pantry','bakery','dairy','meat','frozen','beverages','household','other']);
function norm(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(1|2|5|10|12|20|24)\s*(kg|g|l|ml)\b/g,' ').replace(/\s+/g,' ').trim();}
function slugify(s:string){return norm(s).replace(/\s+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)||'freshcart-product';}
function safeNumber(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}

async function uploadImage(supabase:any,dataUrl:string,productSlug:string){
  const match=dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if(!match) return null;
  const contentType=match[1], ext=contentType.includes('png')?'png':contentType.includes('webp')?'webp':'jpg';
  const bytes=Buffer.from(match[2],'base64');
  const path='products/'+productSlug+'-'+Date.now()+'.'+ext;
  const {error}=await supabase.storage.from('product-images').upload(path,bytes,{contentType,cacheControl:'31536000',upsert:false});
  if(error) throw error;
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

export async function POST(req:Request){
  if(!importerAuthorized(req)) return NextResponse.json({error:'Importer access is not configured or the access key is invalid.'},{status:401});
  const supabase=getSupabaseAdmin();
  if(!supabase) return NextResponse.json({error:'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) in Vercel.'},{status:500});
  const body=await req.json();
  const retailerName=String(body.retailerName||'').trim();
  const weekStart=String(body.weekStart||'').trim();
  const markupPercent=safeNumber(body.markupPercent,40);
  const sourceFiles=Array.isArray(body.sourceFiles)?body.sourceFiles:[];
  const incoming=Array.isArray(body.products)?body.products:[];
  const selected=incoming.filter((p:any)=>p&&p.selected!==false&&!p.featured);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return NextResponse.json({error:'Invalid weekStart.'},{status:400});
  if(!selected.length) return NextResponse.json({error:'Select at least one new product before publishing.'},{status:400});
  if(selected.length>250) return NextResponse.json({error:'Too many products in one publish batch.'},{status:400});

  const {data:importRow,error:importError}=await supabase.from('special_imports').insert({retailer_name:retailerName,week_start:weekStart,markup_percent:markupPercent,status:'draft',source_files:sourceFiles}).select('id').single();
  if(importError||!importRow) return NextResponse.json({error:'Could not create import record: '+(importError?.message||'unknown error')},{status:500});
  const importId=importRow.id;

  const {data:categories,error:categoryError}=await supabase.from('categories').select('id,slug').eq('is_active',true);
  if(categoryError) return NextResponse.json({error:'Could not load categories: '+categoryError.message},{status:500});
  const categoryMap=new Map((categories||[]).map((c:any)=>[c.slug,c.id]));
  const {data:existingProducts,error:productError}=await supabase.from('products').select('id,name,slug,description,image_url,price,category_id').limit(5000);
  if(productError) return NextResponse.json({error:'Could not load products: '+productError.message},{status:500});
  const existing:any[]=existingProducts||[], published:any[]=[];

  try {
    for(const p of selected){
      const name=String(p.name||'').trim(), catalog=catalogSlugs.has(String(p.catalog))?String(p.catalog):'other';
      const categoryId=categoryMap.get(catalog)||categoryMap.get('other')||null;
      const cost=Math.max(0,safeNumber(p.cost));
      const sellingPrice=Math.max(0,safeNumber(p.sellingPrice,cost*(1+markupPercent/100)));
      const normalized=norm(name);
      let product=existing.find((x:any)=>norm(String(x.name||''))===normalized);
      let imageUrl=product?.image_url||null;
      if(!imageUrl&&typeof p.imageData==='string'&&p.imageData.startsWith('data:')) imageUrl=await uploadImage(supabase,p.imageData,slugify(name));

      if(product){
        const {data:updated,error}=await supabase.from('products').update({category_id:categoryId,description:String(p.description||product.description||''),price:sellingPrice,image_url:imageUrl}).eq('id',product.id).select('id,name,slug,image_url').single();
        if(error||!updated) throw new Error('Could not update product '+name+': '+(error?.message||'unknown error'));
        product=updated;
      } else {
        let slug=slugify(name);
        if(existing.some((x:any)=>x.slug===slug)) slug=slug+'-'+Date.now().toString(36);
        const {data:created,error}=await supabase.from('products').insert({category_id:categoryId,name,slug,description:String(p.description||''),image_url:imageUrl,price:sellingPrice,currency:'ZAR',stock_quantity:0,is_active:true}).select('id,name,slug,image_url').single();
        if(error||!created) throw new Error('Could not create product '+name+': '+(error?.message||'unknown error'));
        product=created; existing.push(product);
      }

      const {data:item,error:itemError}=await supabase.from('special_import_items').insert({import_id:importId,product_id:product.id,name,brand:String(p.brand||''),description:String(p.description||''),unit:String(p.unit||''),catalog,cost,selling_price:sellingPrice,confidence:safeNumber(p.confidence,0),source_file:String(p.sourceFile||''),image_bbox:p.image_bbox||null,image_url:imageUrl,status:'published',featured_match:false}).select('id').single();
      if(itemError||!item) throw new Error('Could not create import item for '+name+': '+(itemError?.message||'unknown error'));

      const {error:specialError}=await supabase.from('product_specials').upsert({product_id:product.id,import_item_id:item.id,week_start:weekStart,cost,special_price:sellingPrice,unit:String(p.unit||''),retailer_name:retailerName,status:'published'},{onConflict:'product_id,week_start,retailer_name'});
      if(specialError) throw new Error('Could not publish special for '+name+': '+specialError.message);
      published.push({id:product.id,name,sellingPrice,imageUrl});
    }

    const {error:finalizeError}=await supabase.from('special_imports').update({status:'published',updated_at:new Date().toISOString()}).eq('id',importId);
    if(finalizeError) throw finalizeError;
    return NextResponse.json({ok:true,importId,publishedCount:published.length,products:published});
  } catch(error) {
    await supabase.from('special_imports').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',importId);
    return NextResponse.json({error:error instanceof Error?error.message:'Publish failed.'},{status:500});
  }
}
