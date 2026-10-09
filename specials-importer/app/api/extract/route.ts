import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { importerAuthorized } from '../../../lib/importer-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
const OPENAI_MODEL = 'gpt-6-luna';

const instruction = 'Return JSON only in this shape: {"products":[{"name":"string","brand":"string or empty","description":"customer-facing description","cost":number,"unit":"string","catalog":"produce|pantry|bakery|dairy|meat|frozen|beverages|household|other","confidence":number,"image_bbox":[x,y,w,h] or null}]}. Coordinates must be normalized 0..1 relative to the source image. image_bbox must tightly enclose ONLY the actual product/package photo, not its text label, price, discount badge, border, or other flyer content. Leave a small margin around the product itself. If a clean product photo cannot be isolated confidently, set image_bbox to null rather than include any advertised price or flyer text. If the source is a PDF, image_bbox may be null. Treat the advertised special price as cost. Never invent a price. For bundle offers, put the full offer in name/description and use the advertised total price. Extract only products actually visible on the flyer. Do not decide whether a product is already featured; the server performs that match.';

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
  if (!supabase) return { names: [] as string[], connected: false, error: 'Supabase is not configured.' };
  const { data: specials, error } = await supabase.from('product_specials').select('product_id').eq('week_start', weekStart()).eq('status', 'published');
  if (error) return { names: [] as string[], connected: true, error: error.message };
  const ids = Array.from(new Set((specials || []).map((x:any) => x.product_id).filter(Boolean)));
  if (!ids.length) return { names: [] as string[], connected: true, error: null };
  const { data: products, error: productError } = await supabase.from('products').select('id,name').in('id', ids);
  if (productError) return { names: [] as string[], connected: true, error: productError.message };
  return { names: (products || []).map((p:any) => String(p.name || '')).filter(Boolean), connected: true, error: null };
}

async function extractWithOpenAI(content: any[], fileName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: String(content[0]?.text || '') },
          { type: 'input_image', image_url: String(content[1]?.image_url?.url || ''), detail: 'high' }
        ]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'freshcart_flyer_products',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    brand: { type: 'string' },
                    description: { type: 'string' },
                    cost: { type: 'number' },
                    unit: { type: 'string' },
                    catalog: { type: 'string', enum: ['produce','pantry','bakery','dairy','meat','frozen','beverages','household','other'] },
                    confidence: { type: 'number' },
                    image_bbox: {
                      anyOf: [
                        { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
                        { type: 'null' }
                      ]
                    }
                  },
                  required: ['name','brand','description','cost','unit','catalog','confidence','image_bbox'],
                  additionalProperties: false
                }
              }
            },
            required: ['products'],
            additionalProperties: false
          }
        }
      },
      max_output_tokens: 4096
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error('OpenAI extraction failed for '+fileName+': '+response.status+' '+body.slice(0,800));
  }

  const data = await response.json();
  const raw = data.output_text || data.output?.flatMap((x:any) => x.content || []).find((x:any) => x.type === 'output_text')?.text || '';
  const parsed = parseOutput(raw);
  if (!Array.isArray(parsed.products)) throw new Error('OpenAI returned an invalid products response for '+fileName+'.');
  return parsed;
}

export async function POST(req: Request) {
  if (!importerAuthorized(req)) return NextResponse.json({ error: 'Importer access is not configured or the access key is invalid.' }, { status: 401 });
  const form = await req.formData();
  const files = form.getAll('files').filter(x => x instanceof File) as File[];
  const manualFeatured = JSON.parse(String(form.get('alreadyFeatured') || '[]'));
  const markup = Number(form.get('markup') || 40);
  const skip = String(form.get('skipFeatured') || 'true') === 'true';
  if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY is not configured. Add it in Vercel Environment Variables.' }, { status: 500 });

  const automatic = await getAutomaticFeatured();
  if (skip && automatic.error) {
    return NextResponse.json({ error:'Could not safely check this week\'s featured products in Supabase: '+automatic.error }, {status:500});
  }
  const already = Array.from(new Set([...manualFeatured.map((x:any)=>String(x)), ...automatic.names]));
  const products:any[] = [];
  let skippedCount = 0;

  for (const file of files) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) return NextResponse.json({ error:'PDF extraction is temporarily disabled. Please upload the flyer as JPG, PNG, or WEBP.' }, {status:400});
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type || '')) return NextResponse.json({ error:'Unsupported file type for '+file.name+'. Please use JPG, PNG, or WEBP.' }, {status:400});
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error:'Flyer '+file.name+' is too large. Please upload an image under 8 MB.' }, {status:400});
    const bytes = Buffer.from(await file.arrayBuffer());
    const b64 = bytes.toString('base64');
    const promptText = 'You are Freshcart grocery flyer extraction engine. '+instruction+' Existing featured products from Freshcart this week: '+JSON.stringify(already)+' Source filename: '+file.name;
    const content:any[] = [{ type:'text', text:promptText }, { type:'image_url', image_url:{ url:'data:'+(file.type||'image/jpeg')+';base64,'+b64 } }];

    let out:any;
    try {
      out = await extractWithOpenAI(content, file.name);
    } catch (e:any) {
      return NextResponse.json({ error:'AI extraction failed for '+file.name+': '+String(e.message || e).slice(0,1200) }, {status:503});
    }
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
