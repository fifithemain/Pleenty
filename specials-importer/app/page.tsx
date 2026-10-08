'use client';

import { useMemo, useState } from 'react';

type Product = {
  name: string;
  brand?: string;
  description: string;
  cost: number;
  unit: string;
  catalog: string;
  featured?: boolean;
  confidence?: number;
  imageData?: string | null;
  sourceFile?: string;
  image_bbox?: [number, number, number, number] | null;
  sellingPrice?: number;
  selected?: boolean;
};

function money(n:number){return 'R'+n.toFixed(2);}
function norm(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(1|2|5|10|12|20|24)\s*(kg|g|l|ml)\b/g,'').replace(/\s+/g,' ').trim();}
function sellPrice(cost:number,markup:number){return cost*(1+markup/100);}
const foodCatalogs=new Set(['produce','pantry','bakery','dairy','meat','frozen','beverages','other']);

async function cropImage(file:File,bbox:Product['image_bbox']){
  if(!bbox||file.type==='application/pdf')return null;
  return new Promise<string|null>(resolve=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const [x,y,w,h]=bbox;
        const sx=Math.max(0,Math.round(x*img.width)),sy=Math.max(0,Math.round(y*img.height));
        const sw=Math.min(img.width-sx,Math.round(w*img.width)),sh=Math.min(img.height-sy,Math.round(h*img.height));
        if(sw<2||sh<2)return resolve(null);
        const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
        const ctx=canvas.getContext('2d');if(!ctx)return resolve(null);
        ctx.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);resolve(canvas.toDataURL('image/jpeg',.88));
      };
      img.src=String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Home(){
  const [files,setFiles]=useState<File[]>([]);
  const [drag,setDrag]=useState(false);
  const [items,setItems]=useState<Product[]>([]);
  const [busy,setBusy]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [markup,setMarkup]=useState(40);
  const [skip,setSkip]=useState(true);
  const [featuredText,setFeaturedText]=useState('');
  const [retailerName,setRetailerName]=useState('');
  const [accessKey,setAccessKey]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [dbConnected,setDbConnected]=useState(false);
  const [weekStart,setWeekStart]=useState('');

  const add=(list:FileList|File[])=>setFiles(prev=>[...prev,...Array.from(list).filter(f=>/\.(png|jpe?g|webp|pdf)$/i.test(f.name))]);
  const remove=(i:number)=>setFiles(f=>f.filter((_,n)=>n!==i));
  const already=useMemo(()=>featuredText.split(/[\n,]+/).map(norm).filter(Boolean),[featuredText]);

  const extract=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      if(!files.length)return;
      const form=new FormData();
      files.forEach(f=>form.append('files',f));
      form.append('markup',String(markup));
      form.append('alreadyFeatured',JSON.stringify(already));
      form.append('skipFeatured',String(skip));
      const r=await fetch('/api/extract',{method:'POST',headers:{'x-freshcart-importer-key':accessKey},body:form});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Extraction failed');
      const enriched=await Promise.all((data.products||[]).map(async(p:Product)=>{
        const source=files.find(f=>f.name===p.sourceFile);
        return {...p,selected:true,imageData:source?await cropImage(source,p.image_bbox):null};
      }));
      setItems(enriched);setDbConnected(Boolean(data.databaseConnected));setWeekStart(String(data.weekStart||''));
      if(data.automaticFeaturedCount)setNotice(data.automaticFeaturedCount+' products were checked against this week\'s published specials automatically.');
    }catch(e){setError(e instanceof Error?e.message:'Something went wrong');}
    finally{setBusy(false);}
  };

  const toggle=(index:number)=>setItems(prev=>prev.map((p,i)=>i===index?{...p,selected:!p.selected}:p));

  const publish=async()=>{
    setPublishing(true);setError('');setNotice('');
    try{
      const selected=items.filter(p=>p.selected&&!p.featured);
      if(!selected.length)throw new Error('Select at least one new special to publish.');
      if(!weekStart)throw new Error('Run an extraction first.');
      const r=await fetch('/api/publish',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-freshcart-importer-key':accessKey},
        body:JSON.stringify({retailerName,weekStart,markupPercent:markup,sourceFiles:files.map(f=>f.name),products:selected})
      });
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Publish failed');
      setNotice('Published '+data.publishedCount+' specials to Freshcart.');
      setItems(prev=>prev.map(p=>p.selected&&!p.featured?{...p,featured:true,selected:false}:p));
    }catch(e){setError(e instanceof Error?e.message:'Publish failed');}
    finally{setPublishing(false);}
  };

  const catalogCount=new Set(items.map(x=>x.catalog)).size;
  const newCount=items.filter(x=>!x.featured).length;
  const selectedCount=items.filter(x=>x.selected&&!x.featured).length;

  return <div className="shell">
    <header className="top">
      <div className="brand"><span className="dot">F</span>Freshcart <span className="pill">SPECIALS IMPORTER</span></div>
      <div className="nav"><span className="pill">40% food markup</span><span className="pill">Review before publish</span></div>
    </header>
    <main className="main">
      <section className="hero">
        <div className="eyebrow">Internal catalogue tool</div>
        <h1>Turn store flyers into Freshcart specials.</h1>
        <p>Upload weekly specials as images or PDFs. AI reads the flyer, extracts products and promotions, enriches descriptions, routes products into the right catalogues, checks this week’s published specials and calculates Freshcart selling prices.</p>
      </section>

      <div className="grid">
        <section className="card">
          <div className={'drop '+(drag?'drag':'')} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);add(e.dataTransfer.files)}}>
            <div className="uploadIcon">↑</div><h3>Drop flyer images here</h3><p>JPG, PNG or WEBP. Upload several stores/flyers together.</p>
            <button className="button primary" onClick={()=>document.getElementById('file')?.click()}>Choose files</button>
            <input id="file" hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>e.target.files&&add(e.target.files)}/>
          </div>
          {files.length>0&&<div className="filelist">{files.map((f,i)=><div className="file" key={i}><span>{f.name}</span><button className="button secondary" onClick={()=>remove(i)}>Remove</button></div>)}</div>}
          <div className="settings">
            <div className="field"><label>Importer access key</label><input type="password" value={accessKey} onChange={e=>setAccessKey(e.target.value)} placeholder="Set IMPORTER_ADMIN_KEY in Vercel"/></div>
            <div className="field"><label>Retailer / store (optional)</label><input value={retailerName} onChange={e=>setRetailerName(e.target.value)} placeholder="e.g. People's Market"/></div>
            <div className="field"><label>Food markup</label><input type="number" min="0" max="200" value={markup} onChange={e=>setMarkup(Number(e.target.value)||0)}/></div>
            <label className="check"><input type="checkbox" checked={skip} onChange={e=>setSkip(e.target.checked)}/> Skip products already featured this week</label>
            <div className="field"><label>Additional already-featured products (optional)</label><textarea value={featuredText} onChange={e=>setFeaturedText(e.target.value)} placeholder={'One product per line, e.g. Carrots\nCoke 2L\nSpekko Rice 10kg'}/></div>
          </div>
          <button className="button primary" style={{width:'100%'}} disabled={!files.length||!accessKey||busy} onClick={extract}>{busy?'Reading flyers…':'Extract & preview specials'}</button>
          {error&&<div className="error">{error}</div>}{notice&&<div className="notice">{notice}</div>}
        </section>

        <aside className="card">
          <div className="status"><strong>Recommended import flow</strong><span className="pill">{dbConnected?'Supabase connected':'Extraction mode'}</span></div>
          <div className="steps">
            <div className="step"><div className="num">1</div><div><b>Read image / PDF</b><span>Vision extraction reads product names, pack sizes, prices and promotion groups.</span></div></div>
            <div className="step"><div className="num">2</div><div><b>Normalise & de-duplicate</b><span>Published specials for the current week are checked automatically.</span></div></div>
            <div className="step"><div className="num">3</div><div><b>Enrich</b><span>Generate clean customer descriptions and catalogue assignments.</span></div></div>
            <div className="step"><div className="num">4</div><div><b>Apply 40% markup</b><span>Food selling price = extracted cost × 1.40. Household is left unmarked by default.</span></div></div>
            <div className="step"><div className="num">5</div><div><b>Review, then publish</b><span>Only selected new products are written into the Freshcart catalogue.</span></div></div>
          </div>
          <div className="note">Image flyers can return normalized product image boxes, which this UI crops for the preview. Publishing stores the cropped product image in Supabase Storage and writes the special to the current week.</div>
        </aside>
      </div>

      <section className="preview">
        <div className="previewHeader">
          <div><div className="eyebrow">Preview</div><h2>{items.length?items.length+' products detected':'Your extracted catalogue will appear here'}</h2></div>
          {items.length>0&&<div style={{display:'flex',gap:8}}><button className="button secondary" onClick={()=>setItems([])}>Clear</button><button className="button primary" disabled={!selectedCount||!accessKey||publishing} onClick={publish}>{publishing?'Publishing…':'Approve & publish '+selectedCount}</button></div>}
        </div>

        {items.length===0?<div className="empty">Upload a flyer and click <b>Extract & preview specials</b>. Review costs, selling prices, duplicates and catalogue assignments before publishing.</div>:
          <>
            <div className="summary"><span className="pill">{newCount} new</span><span className="pill">{selectedCount} selected</span><span className="pill">{items.filter(x=>x.featured).length} already featured</span><span className="pill">{catalogCount} catalogues</span><span className="pill">Markup {markup}%</span></div>
            <div className="products">{items.map((p,i)=>{
              const sell=p.sellingPrice??sellPrice(p.cost,foodCatalogs.has(p.catalog)?markup:0);
              return <article className={'product '+((!p.selected||p.featured)?'muted':'')} key={i}>
                <div className="productImg">{p.imageData?<img src={p.imageData} alt={p.name}/>: 'Product image'}</div>
                <div className="productBody">
                  <div style={{display:'flex',justifyContent:'space-between',gap:12}}><h3>{p.name}</h3>{!p.featured&&<input type="checkbox" checked={Boolean(p.selected)} onChange={()=>toggle(i)} aria-label={'Select '+p.name}/>}</div>
                  <p>{p.description}</p>
                  <div className="prices"><span className="cost">Cost {money(p.cost)}</span><span className="sell">{money(sell)}</span></div>
                  <span className="catalog">{p.catalog}</span>
                  <span className={'status '+(p.featured?'duplicate':p.selected?'new':'duplicate')}>{p.featured?'Already featured':p.selected?'Ready to publish':'Not selected'}</span>
                </div>
              </article>;
            })}</div>
          </>
        }
      </section>
    </main>
  </div>;
}
