import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const instruction = 'Return JSON only in this shape: {"products":[{"name":"string","brand":"string or empty","description":"customer-facing description","cost":number,"unit":"string","catalog":"produce|pantry|bakery|dairy|meat|frozen|beverages|household|other","confidence":number,"image_bbox":[x,y,w,h] or null}]}. Coordinates must be normalized 0..1 relative to the source image. If the source is a PDF, image_bbox may be null. Treat the advertised special price as cost. Never invent a price. For bundle offers, put the full offer in name/description and use the advertised total price. Extract only products actually visible on the flyer. Do not decide whether a product is already featured; the server performs that match.';

function parseOutput(s: string) {
  try { return JSON.parse(s); } catch {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { products: [] };
  }
}
function foodCatalog(c: string) {
  return ['produce','pantry','bakery','dairy','meat','frozen','beverages','other'].includes(String(c));
}
function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(1|2|5|10|12|20|24)\s*(kg|g|l|ml)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function weekStart() {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
  const day = local.getDay();
  local.setDate(local.getDate() + (day === 0 ? -6 : 1 - day));
  return [local.getFullYear(), String(local.getMonth()+1).padStart(2,'0'), String(local.getDate()).padStart(2,'0')].join('-');
}
async function getAutomaticFeatured() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { names: [] as string[], connected: false };
  const { data: specials, error } = await supabase.from('product_specials').select('product_id').eq('week_start', weekStart()).eq('status', 'published');
  const ids = Array.from(new Set((specials || []).map((x:any) => x.product_id).filter(Boolean)));
  if (error || !ids.length) return { names: [] as string[], connected: true };
  const { data: products } = await supabase.from('products').select('id,name').in('id', ids);
  return { names: (products || []).map((p:any) => String(p.name || '')).filter(Boolean), connected: true };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll('files').filter(x => x instanceof File) as File[];
  const manualFeatured = JSON.parse(String(form.get('alreadyFeatured') || '[]'));
  const markup = Number(form.get('markup') || 40);
  const skip = String(form.get('skipFeatured') || 'true') === 'true';
  if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY is not configured. Add it in Vercel Environment Variables.' }, { status: 500 });

  const automatic = await getAutomaticFeatured();
  const already = Array.from(new Set([...manualFeatured.map((x:any)=>String(x)), ...automatic.names]));
  const products:any[] = [];
  let skippedCount = 0;

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const b64 = bytes.toString('base64');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const content:any[] = [{ type:'input_text', text:'You are Freshcart grocery flyer extraction engine. '+instruction+' Existing featured products from Freshcart this week: '+JSON.stringify(already)+' Source filename: '+file.name }];
    if (isPdf) content.push({ type:'input_file', filename:file.name, file_data:'data:application/pdf;base64,'+b64 });
    else content.push({ type:'input_image', image_url:'data:'+(file.type||'image/jpeg')+';base64,'+b64, detail:'high' });

    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
      body:JSON.stringify({ model:process.env.OPENAI_MODEL||'gpt-6-luna', input:[{role:'user',content}], temperature:0 })
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error:'AI extraction failed for '+file.name+': '+t.slice(0,300) }, {status:500});
    }
    const data = await r.json();
    const out = parseOutput(data.output_text || '');
    for (const p of out.products || []) {
      const name = String(p.name || '').trim(), cost = Number(p.cost);
      if (!name || !Number.isFinite(cost)) continue;
      const n = norm(name);
      const featured = already.some((x:string)=>{const a=norm(x);return n===a||n.includes(a)||a.includes(n);});
      if (skip && featured) { skippedCount++; continue; }
      const food = foodCatalog(p.catalog);
      products.push({...p,name,cost,featured,sourceFile:file.name,markup:food?markup:0,sellingPrice:cost*(1+(food?markup:0)/100)});
    }
  }
  return NextResponse.json({products,skippedCount,automaticFeaturedCount:automatic.names.length,databaseConnected:automatic.connected,weekStart:weekStart()});
}
