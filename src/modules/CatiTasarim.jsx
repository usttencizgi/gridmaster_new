import { useState, useRef, useCallback } from 'react';

// ─── Geometri ────────────────────────────────────────────────────
function ptInPoly(px,py,poly){
  let ins=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))ins=!ins;
  }
  return ins;
}
function dist(ax,ay,bx,by){return Math.sqrt((ax-bx)**2+(ay-by)**2);}
function snapAngle(x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,ang=Math.atan2(dy,dx)*180/Math.PI;
  const near=[0,90,-90,180,-180,45,-45,135,-135].reduce((b,a)=>Math.abs(a-ang)<Math.abs(b-ang)?a:b);
  if(Math.abs(near-ang)<7){const r=near*Math.PI/180,l=Math.sqrt(dx*dx+dy*dy);return[x1+l*Math.cos(r),y1+l*Math.sin(r),true];}
  return[x2,y2,false];
}
function insetPoly(pts,d){
  const n=pts.length;
  return pts.map((_,i)=>{
    const p=pts[(i-1+n)%n],c=pts[i],q=pts[(i+1)%n];
    const d1=[c[0]-p[0],c[1]-p[1]],d2=[q[0]-c[0],q[1]-c[1]];
    const l1=Math.sqrt(d1[0]**2+d1[1]**2)||1,l2=Math.sqrt(d2[0]**2+d2[1]**2)||1;
    const n1=[d1[1]/l1,-d1[0]/l1],n2=[d2[1]/l2,-d2[0]/l2];
    const avg=[(n1[0]+n2[0])/2,(n1[1]+n2[1])/2],al=Math.sqrt(avg[0]**2+avg[1]**2)||1;
    return[c[0]+avg[0]/al*d,c[1]+avg[1]/al*d];
  });
}
function polyArea(poly){
  let a=0;poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length];a+=(p[0]*q[1]-q[0]*p[1]);});
  return Math.abs(a)/2;
}
function maxFillCount(poly,obs,pw,ph,rg,cg,sb,sc){
  if(poly.length<3)return 0;
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pW=pw*sc,pH=ph*sc,rG=rg*sc,cG=cg*sc,sbP=sb*sc;
  const ins=sbP>0?insetPoly(poly,sbP):poly;
  let cnt=0;
  for(let y=minY+sbP;y+pH<=maxY-sbP+1;y+=pH+rG){
    for(let x=minX+sbP;x+pW<=maxX-sbP+1;x+=pW+cG){
      if(![[x,y],[x+pW,y],[x+pW,y+pH],[x,y+pH]].every(([cx,cy])=>ptInPoly(cx,cy,ins)))continue;
      if(obs.some(o=>x<(o.x+o.w)*sc&&x+pW>o.x*sc&&y<(o.y+o.h)*sc&&y+pH>o.y*sc))continue;
      cnt++;
    }
  }
  return cnt;
}

// ─── Numaralama ──────────────────────────────────────────────────
// nInv=1: "1.1", "1.2" ... (inv.str)
// nInv>1: "1.1.1" (inv.mppt.str)
function fmtStr(invIdx,mpptIdx,strIdx,nInv){
  return nInv===1?`${invIdx}.${strIdx}`:`${invIdx}.${mpptIdx}.${strIdx}`;
}

const COLS=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];

export default function CatiTasarim(){
  const SW=780,SH=520;
  const [sc,setSc]=useState(28);   // px/m

  // Çatı çizimi
  const [poly,setPoly]=useState([]);
  const [drawing,setDrawing]=useState(false);
  const [cur,setCur]=useState(null);
  const [dimVal,setDimVal]=useState('');

  // Köşe düzenleme
  const [dragCorner,setDragCorner]=useState(null);

  // String blokları (sürükle-bırak ile yerleştirilen)
  const [strBlocks,setStrBlocks]=useState([]); // {id,x,y,rows,cols,invIdx,strIdx,label}
  const [dragBlock,setDragBlock]=useState(null); // {id,offX,offY} — varolan blok taşıma

  // Paleттe: yeni engel / yeni string blok hazırlama
  const [newObs,setNewObs]=useState({w:1.5,h:1.5});
  const [newStr,setNewStr]=useState({rows:3,cols:4});
  const [draggingPalette,setDraggingPalette]=useState(null); // 'obs'|'str' — paletten sürükleniyor
  const [palettePos,setPalettePos]=useState(null); // {x,y} svg koordinatı

  // Engeller (yerleştirilmiş)
  const [obstacles,setObstacles]=useState([]);
  const [dragObs,setDragObs]=useState(null); // {id,offX,offY}

  // İnverterler
  const [inverters,setInverters]=useState([]);
  const [nMppt,setNMppt]=useState(1);

  // Panel boyutları
  const [pW,setPW]=useState(1.13);
  const [pH,setPH]=useState(2.28);
  const [or,setOr]=useState('portrait');
  const [rg,setRg]=useState(0.05);
  const [cg,setCg]=useState(0.02);
  const [sb,setSb]=useState(0.5);

  // Mod
  const [mod,setMod]=useState('draw');

  // Max dolum tahmini
  const [maxFill,setMaxFill]=useState(null);

  const svgRef=useRef(null);

  // ── DÜZELTİLMİŞ koordinat dönüşümü ──────────────────────────────
  // createSVGPoint kullanır — ölçek fark etmeksizin doğru
  const getSvgPt=useCallback(e=>{
    const svg=svgRef.current;
    if(!svg)return{x:0,y:0};
    const pt=svg.createSVGPoint();
    pt.x=e.clientX;
    pt.y=e.clientY;
    const sp=pt.matrixTransform(svg.getScreenCTM().inverse());
    return{x:sp.x,y:sp.y};
  },[]);

  const getSnap=(rawX,rawY)=>{
    if(!poly.length)return{x:rawX,y:rawY,sn:false};
    const l=poly[poly.length-1];
    const[sx,sy,sn]=snapAngle(l[0],l[1],rawX,rawY);
    return{x:sx,y:sy,sn};
  };

  // Panel boyutu (yönlendirmeye göre)
  const panW=or==='portrait'?pW:pH;
  const panH=or==='portrait'?pH:pW;

  // ── String blok boyutları px ──────────────────────────────────
  const strBlockWpx=(str)=>str.cols*panW*sc+(str.cols-1)*cg*sc;
  const strBlockHpx=(str)=>str.rows*panH*sc+(str.rows-1)*rg*sc;

  // ── Ölçüm aleti ───────────────────────────────────────────────
  // Ruler: iki nokta arası Manhattan mesafe
  const [rulerPts,setRulerPts]=useState([]);  // [{x,y}] max 2
  const [rulerCur,setRulerCur]=useState(null);

  // ── Panel işaretleme (string kablo ölçümü) ────────────────────
  // Kullanıcı canvas üzerinde iki nokta işaretler (ilk/son panel)
  // Toplam kablo = Manhattan(A→inv) + Manhattan(B→inv) + 2×vertOff
  const [markedPts,setMarkedPts]=useState([]); // [{x,y}] max 2
  const [cableResult,setCableResult]=useState(null);

  // ── Mouse Move ────────────────────────────────────────────────
  const onMM=e=>{
    const pt=getSvgPt(e);

    if(mod==='draw'&&drawing&&!dimVal){
      const s=getSnap(pt.x,pt.y);setCur(s);
    }
    if((mod==='ruler'||mod==='cable')&&rulerPts.length===1){
      setRulerCur({x:pt.x,y:pt.y});
    }
    if(mod==='edit'&&dragCorner!==null){
      setPoly(p=>p.map((v,i)=>i===dragCorner?[pt.x,pt.y]:v));
    }
    if(dragObs){
      setObstacles(obs=>obs.map(o=>o.id===dragObs.id
        ?{...o,x:(pt.x-dragObs.offX)/sc,y:(pt.y-dragObs.offY)/sc}:o));
    }
    if(dragBlock){
      setStrBlocks(bs=>bs.map(b=>b.id===dragBlock.id
        ?{...b,x:pt.x-dragBlock.offX,y:pt.y-dragBlock.offY}:b));
    }
    if(draggingPalette){
      setPalettePos({x:pt.x,y:pt.y});
    }
    if(mod==='inverter-drag'&&draggingPalette==='inv'){
      setPalettePos({x:pt.x,y:pt.y});
    }
  };

  // ── Mouse Down ────────────────────────────────────────────────
  const onMD=e=>{
    const pt=getSvgPt(e);
    if(mod==='edit'){
      // Köşe sürükleme
      const near=poly.reduce((b,v,i)=>{const d=dist(pt.x,pt.y,v[0],v[1]);return d<b.d?{i,d}:b},{i:-1,d:Infinity});
      if(near.d<16){setDragCorner(near.i);return;}
      // Kenar orta nokta → yeni köşe
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
        if(dist(pt.x,pt.y,mx,my)<16){
          const np=[...poly];np.splice(i+1,0,[pt.x,pt.y]);setPoly(np);setDragCorner(i+1);return;
        }
      }
    }
    // String blok taşıma
    for(const b of strBlocks){
      if(pt.x>=b.x&&pt.x<=b.x+strBlockWpx(b)&&pt.y>=b.y&&pt.y<=b.y+strBlockHpx(b)){
        if(mod==='edit'||mod==='view'){
          setDragBlock({id:b.id,offX:pt.x-b.x,offY:pt.y-b.y});return;
        }
      }
    }
    // Engel taşıma
    for(const o of obstacles){
      if(pt.x>=o.x*sc&&pt.x<=(o.x+o.w)*sc&&pt.y>=o.y*sc&&pt.y<=(o.y+o.h)*sc){
        if(mod==='edit'||mod==='view'){
          setDragObs({id:o.id,offX:pt.x-o.x*sc,offY:pt.y-o.y*sc});return;
        }
      }
    }
    // İnverter yerleştirme
    if(mod==='inverter'){
      setInverters(ivs=>[...ivs,{id:Date.now(),x:pt.x,y:pt.y,label:`INV${ivs.length+1}`}]);
    }
  };

  // ── Mouse Up ──────────────────────────────────────────────────
  const onMU=e=>{
    const pt=getSvgPt(e);
    setDragCorner(null);setDragObs(null);setDragBlock(null);
    if(draggingPalette==='obs'&&palettePos){
      // Engeli canvas'a bırak
      setObstacles(o=>[...o,{id:Date.now(),x:(pt.x-newObs.w*sc/2)/sc,y:(pt.y-newObs.h*sc/2)/sc,w:newObs.w,h:newObs.h}]);
      setDraggingPalette(null);setPalettePos(null);
    }
    if(draggingPalette==='str'&&palettePos){
      // String bloğu canvas'a bırak
      const strIdx=strBlocks.length+1;
      const invIdx=1;
      setStrBlocks(bs=>[...bs,{
        id:Date.now(),
        x:pt.x-strBlockWpx(newStr)/2,
        y:pt.y-strBlockHpx(newStr)/2,
        rows:newStr.rows,cols:newStr.cols,
        invIdx,mpptIdx:1,strIdx,
      }]);
      setDraggingPalette(null);setPalettePos(null);
    }
  };

  // ── Click (çatı çizimi) ────────────────────────────────────────
  const onClick=e=>{
    if(mod==='ruler'){
      const pt=getSvgPt(e);
      setRulerPts(p=>p.length>=2?[{x:pt.x,y:pt.y}]:[...p,{x:pt.x,y:pt.y}]);
      setRulerCur(null);
      return;
    }
    if(mod==='cable'){
      const pt=getSvgPt(e);
      setMarkedPts(prev=>{
        const next=prev.length>=2?[{x:pt.x,y:pt.y}]:[...prev,{x:pt.x,y:pt.y}];
        // Hesabı sonraki tick'te yap
        if(next.length===2&&inverters.length>0){
          const inv=inverters[0];
          const a=next[0],b=next[1];
          const da=(Math.abs(a.x-inv.x)+Math.abs(a.y-inv.y))/sc;
          const db=(Math.abs(b.x-inv.x)+Math.abs(b.y-inv.y))/sc;
          const total=da+db+2*vOff;
          setTimeout(()=>setCableResult({da:da.toFixed(2),db:db.toFixed(2),vOff,total:total.toFixed(2)}),0);
        } else if(next.length===1){
          setTimeout(()=>setCableResult(null),0);
        }
        return next;
      });
      return;
    }
    if(mod!=='draw')return;
    const pt=getSvgPt(e);
    if(!drawing){setPoly([[pt.x,pt.y]]);setDrawing(true);setCur({x:pt.x,y:pt.y,sn:false});return;}
    if(poly.length>=3&&dist(pt.x,pt.y,poly[0][0],poly[0][1])<18){
      setDrawing(false);setCur(null);setDimVal('');return;
    }
    const s=getSnap(pt.x,pt.y);
    setPoly(p=>[...p,[s.x,s.y]]);
  };
  const onDbl=()=>{if(mod==='draw'&&drawing&&poly.length>=3){setDrawing(false);setCur(null);}};

  const commitDim=()=>{
    const d=parseFloat(dimVal);
    if(isNaN(d)||d<=0||!cur||!poly.length)return;
    const l=poly[poly.length-1],dx=cur.x-l[0],dy=cur.y-l[1],len=Math.sqrt(dx*dx+dy*dy)||1;
    setPoly(p=>[...p,[l[0]+dx/len*d*sc,l[1]+dy/len*d*sc]]);
    setDimVal('');
  };

  const calcMaxFill=()=>{
    const cnt=maxFillCount(poly,obstacles,panW,panH,rg,cg,sb,sc);
    setMaxFill(cnt);
  };

  const resetAll=()=>{
    setPoly([]);setDrawing(false);setCur(null);setDimVal('');
    setObstacles([]);setStrBlocks([]);setInverters([]);setMaxFill(null);
    setRulerPts([]);setRulerCur(null);setMarkedPts([]);setCableResult(null);
  };

  // ── Kenar uzunlukları ─────────────────────────────────────────
  const edges=poly.map((p,i)=>{
    const q=poly[(i+1)%poly.length];
    return{mid:[(p[0]+q[0])/2,(p[1]+q[1])/2],len:dist(p[0],p[1],q[0],q[1])/sc};
  });
  const areaPx2=poly.length>=3?polyArea(poly):0;
  const areaM2=areaPx2/(sc*sc);

  const totalPanels=strBlocks.reduce((s,b)=>s+b.rows*b.cols,0);
  const nInv=Math.max(1,inverters.length);

  const mbtn=(m,ic,lb,c='slate')=>(
    <button onClick={()=>setMod(m)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all
        ${mod===m?`border-${c}-500 bg-${c}-50 text-${c}-700`:'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
      {ic} {lb}
    </button>
  );

  return(
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-5 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl text-2xl">🏠</div>
          <div>
            <h2 className="text-xl font-bold text-white">Çatı GES Tasarım Aracı</h2>
            <p className="text-sky-100 text-sm">Çat çiz · String blok sürükle-bırak · Yürüyüş yolu bırak · Numaralama</p>
          </div>
        </div>
        <div className="text-right text-white">
          <div className="text-2xl font-black">{totalPanels}</div>
          <div className="text-xs text-sky-200">{strBlocks.length} string blok</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* SOL */}
        <div className="space-y-3">

          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Mod</div>
            <div className="flex flex-col gap-1.5">
              {mbtn('draw',    '✏️','Çatı Çiz','blue')}
              {mbtn('edit',    '↗️','Düzenle / Taşı','amber')}
              {mbtn('inverter','⚡','İnverter Ekle','yellow')}
              {mbtn('ruler',   '📏','Mesafe Ölç','emerald')}
              {mbtn('cable',   '🔌','Kablo Ölç','purple')}
              {mbtn('view',    '👁️','İncele','slate')}
            </div>
            <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[10px] text-slate-500 leading-relaxed">
              {mod==='draw'&&<><b>Tıkla</b>→nokta · <b>Dbl/Enter</b>→kapat · <b>Mesafe+Enter</b>→tam kenar · <b>Esc</b>→iptal</>}
              {mod==='edit'&&<><b>Köşe sürükle</b> · <b>Kenar orta</b>→yeni köşe · <b>Blok/Engel sürükle</b>→taşı</>}
              {mod==='inverter'&&'Canvas\'a tıkla → inverter ekle'}
              {mod==='ruler'&&<><b>1. tıkla</b> → başlangıç · <b>2. tıkla</b> → bitiş → Manhattan mesafe gösterir</>}
              {mod==='cable'&&<><b>1. tıkla</b> → ilk panel (A) · <b>2. tıkla</b> → son panel (B) → her ikisinden invertere kablo mesafesi</>}
              {mod==='view'&&'String etiketlerini ve bağlantıları gör'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Panel Boyutu</div>
            <div className="flex gap-2 mb-2">
              {[['portrait','Dikey'],['landscape','Yatay']].map(([v,l])=>(
                <button key={v} onClick={()=>setOr(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${or===v?'bg-sky-50 border-sky-500 text-sky-700':'border-slate-200 text-slate-500'}`}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['En (m)',pW,setPW,0.01],['Boy (m)',pH,setPH,0.01],['Satır Gap',rg,setRg,0.02],['Sütun Gap',cg,setCg,0.01]].map(([l,v,f,s])=>(
                <div key={l}>
                  <label className="text-[10px] text-slate-400 block mb-0.5">{l}</label>
                  <input type="number" value={v} step={s} min={0} onChange={e=>f(+e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/>
                </div>
              ))}
            </div>
          </div>

          {/* Engel paleti */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Engel Ekle</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="text-[10px] text-slate-400 block mb-0.5">En (m)</label>
                <input type="number" value={newObs.w} step={0.1} min={0.1} onChange={e=>setNewObs(o=>({...o,w:+e.target.value}))}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-red-400 outline-none"/></div>
              <div><label className="text-[10px] text-slate-400 block mb-0.5">Boy (m)</label>
                <input type="number" value={newObs.h} step={0.1} min={0.1} onChange={e=>setNewObs(o=>({...o,h:+e.target.value}))}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-red-400 outline-none"/></div>
            </div>
            <div
              className="bg-red-50 border-2 border-dashed border-red-300 rounded-xl p-3 text-center cursor-grab active:cursor-grabbing text-xs text-red-600 font-bold select-none"
              onMouseDown={e=>{e.preventDefault();setDraggingPalette('obs');setPalettePos(getSvgPt(e));}}>
              ⬛ {newObs.w}×{newObs.h}m — Sürükle & Bırak
            </div>
          </div>

          {/* String blok paleti */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">String Blok Ekle</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="text-[10px] text-slate-400 block mb-0.5">Satır (panel)</label>
                <input type="number" value={newStr.rows} step={1} min={1} onChange={e=>setNewStr(s=>({...s,rows:+e.target.value}))}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-400 outline-none"/></div>
              <div><label className="text-[10px] text-slate-400 block mb-0.5">Sütun (panel)</label>
                <input type="number" value={newStr.cols} step={1} min={1} onChange={e=>setNewStr(s=>({...s,cols:+e.target.value}))}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-400 outline-none"/></div>
            </div>
            <div className="text-[10px] text-slate-400 mb-2 font-mono">{newStr.rows*newStr.cols} panel · {(strBlockWpx(newStr)/sc).toFixed(2)}×{(strBlockHpx(newStr)/sc).toFixed(2)} m</div>
            <div
              className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl p-3 text-center cursor-grab active:cursor-grabbing text-xs text-blue-600 font-bold select-none"
              onMouseDown={e=>{e.preventDefault();setDraggingPalette('str');setPalettePos(getSvgPt(e));}}>
              ☀ {newStr.rows}×{newStr.cols} panel — Sürükle & Bırak
            </div>
          </div>

          {/* Max dolum */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Kapasite Analizi</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="text-[10px] text-slate-400 block mb-0.5">Kenar Payı (m)</label>
                <input type="number" value={sb} step={0.1} min={0} onChange={e=>setSb(+e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-emerald-400 outline-none"/></div>
            </div>
            <button onClick={calcMaxFill} disabled={poly.length<3}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs transition-all">
              Max Kapasite Hesapla
            </button>
            {maxFill!==null&&(
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
                <div className="text-xl font-black text-emerald-700">{maxFill}</div>
                <div className="text-[10px] text-emerald-600">panel (teorik maksimum)</div>
              </div>
            )}
          </div>

          {/* Ölçek */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ölçek ({sc} px/m)</div>
            <input type="range" min={8} max={80} step={2} value={sc}
              onChange={e=>setSc(+e.target.value)} className="w-full accent-sky-500"/>
          </div>

          {cableResult&&(
            <div className="bg-indigo-50 border-2 border-indigo-300 p-4 rounded-xl">
              <div className="text-[10px] font-bold text-indigo-500 uppercase mb-2">🔌 DC Kablo Sonucu</div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-indigo-700">A (ilk panel) → İnv</span><span className="font-bold">{cableResult.da} m</span></div>
                <div className="flex justify-between"><span className="text-pink-700">B (son panel) → İnv</span><span className="font-bold">{cableResult.db} m</span></div>
                {cableResult.vOff>0&&<div className="flex justify-between"><span className="text-slate-500">Dikey (×2)</span><span className="font-bold">{(cableResult.vOff*2).toFixed(1)} m</span></div>}
                <div className="border-t border-indigo-200 pt-1 mt-1 flex justify-between">
                  <span className="font-bold text-indigo-800">Toplam</span>
                  <span className="font-black text-indigo-800 text-sm">{cableResult.total} m</span>
                </div>
              </div>
              <button onClick={()=>{setMarkedPts([]);setCableResult(null);}}
                className="w-full mt-2 text-[10px] text-indigo-400 hover:text-indigo-600 font-bold">Temizle</button>
            </div>
          )}

          <button onClick={resetAll} className="w-full border-2 border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-400 font-bold py-2 rounded-xl text-xs">Hepsini Sıfırla</button>
        </div>

        {/* CANVAS */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
              <span className="font-mono text-slate-500">{areaM2.toFixed(1)} m²</span>
              <span className="text-slate-300">|</span>
              <span className="text-blue-600 font-bold">{poly.length} köşe</span>
              <span className="text-slate-300">|</span>
              <span className="text-sky-600 font-bold">{totalPanels} panel yerleştirildi</span>
              {drawing&&<><span className="text-slate-300">|</span><span className="text-blue-500 font-bold animate-pulse">● Çiziliyor</span></>}
            </div>

            {drawing&&mod==='draw'&&(
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-3">
                <span className="text-xs text-blue-700 font-bold">Mesafe (m):</span>
                <input type="text" value={dimVal} placeholder="örn: 8.5"
                  onChange={e=>setDimVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')commitDim();if(e.key==='Escape'){setDimVal('');if(poly.length<3){setDrawing(false);setPoly([]);}}}}
                  className="border-2 border-blue-300 rounded-lg px-3 py-1 text-sm font-mono w-28 focus:border-blue-500 outline-none bg-white"/>
                <button onClick={commitDim} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold">↵ Uygula</button>
                {cur&&poly.length>0&&(()=>{
                  const l=poly[poly.length-1],d=dist(cur.x,cur.y,l[0],l[1])/sc;
                  const ang=Math.atan2(cur.y-l[1],cur.x-l[0])*180/Math.PI;
                  return<span className="text-[10px] text-blue-400">{d.toFixed(2)}m · {ang.toFixed(0)}°{cur.sn?' 🧲':''}</span>;
                })()}
              </div>
            )}

            <svg ref={svgRef} width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`}
              className="w-full select-none"
              style={{background:'#f1f5f9',cursor:mod==='draw'||mod==='inverter'?'crosshair':draggingPalette?'grabbing':'default'}}
              onClick={onClick} onMouseMove={onMM} onMouseDown={onMD} onMouseUp={onMU} onDoubleClick={onDbl}>

              {/* Grid */}
              {Array.from({length:Math.ceil(SW/sc)+1},(_,i)=>i).map(i=>(
                <line key={`v${i}`} x1={i*sc} y1={0} x2={i*sc} y2={SH} stroke="#e2e8f0" strokeWidth={i%5===0?.7:.25}/>
              ))}
              {Array.from({length:Math.ceil(SH/sc)+1},(_,i)=>i).map(i=>(
                <line key={`h${i}`} x1={0} y1={i*sc} x2={SW} y2={i*sc} stroke="#e2e8f0" strokeWidth={i%5===0?.7:.25}/>
              ))}

              {/* String blokları */}
              {strBlocks.map((b,bi)=>{
                const bw=strBlockWpx(b),bh=strBlockHpx(b);
                const col=COLS[bi%COLS.length];
                const label=fmtStr(b.invIdx,b.mpptIdx,b.strIdx,nInv);
                const panels2=[];
                for(let r=0;r<b.rows;r++){
                  for(let c=0;c<b.cols;c++){
                    const px=b.x+c*(panW*sc+cg*sc),py=b.y+r*(panH*sc+rg*sc);
                    panels2.push({px,py,pi:r*b.cols+c});
                  }
                }
                return(
                  <g key={b.id} className={mod==='edit'||mod==='view'?'cursor-grab':''}>
                    {panels2.map(({px,py,pi})=>(
                      <rect key={pi} x={px} y={py} width={panW*sc} height={panH*sc}
                        fill={col} fillOpacity="0.5" stroke={col} strokeWidth="0.7"/>
                    ))}
                    <rect x={b.x-2} y={b.y-2} width={bw+4} height={bh+4}
                      fill="none" stroke={col} strokeWidth="2" strokeDasharray="4,2" rx="3"/>
                    <rect x={b.x+bw/2-18} y={b.y-2-18} width={36} height={16} rx={4}
                      fill={col} opacity="0.9"/>
                    <text x={b.x+bw/2} y={b.y-2-7} textAnchor="middle" fontSize="9"
                      fontWeight="bold" fill="white">{label}</text>
                    {/* Sil butonu */}
                    <g className="cursor-pointer" onClick={e=>{e.stopPropagation();setStrBlocks(bs=>bs.filter(x=>x.id!==b.id));}}>
                      <circle cx={b.x+bw} cy={b.y} r={8} fill={col}/>
                      <text x={b.x+bw} y={b.y+4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text>
                    </g>
                  </g>
                );
              })}

              {/* Çatı polygon */}
              {poly.length>=3&&<polygon points={poly.map(p=>p.join(',')).join(' ')} fill="#3b82f6" fillOpacity="0.06" stroke="#3b82f6" strokeWidth="2"/>}
              {poly.length>=2&&<polyline points={poly.map(p=>p.join(',')).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2"/>}

              {/* Canlı çizgi */}
              {drawing&&cur&&poly.length>0&&!dimVal&&(()=>{
                const l=poly[poly.length-1];
                const d=dist(cur.x,cur.y,l[0],l[1])/sc;
                const mx=(l[0]+cur.x)/2,my=(l[1]+cur.y)/2;
                return(<>
                  <line x1={l[0]} y1={l[1]} x2={cur.x} y2={cur.y}
                    stroke={cur.sn?'#10b981':'#3b82f6'} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.8"/>
                  <rect x={mx-22} y={my-14} width={44} height={16} rx={4} fill={cur.sn?'#10b981':'#3b82f6'} opacity="0.9"/>
                  <text x={mx} y={my-3} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">{d.toFixed(2)}m</text>
                </>);
              })()}

              {/* Kenar uzunlukları */}
              {!drawing&&poly.length>=3&&edges.map((e,i)=>(
                <g key={i}>
                  <rect x={e.mid[0]-22} y={e.mid[1]-11} width={44} height={15} rx={4} fill="white" opacity="0.9"/>
                  <text x={e.mid[0]} y={e.mid[1]+1} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1e40af">{e.len.toFixed(2)}m</text>
                </g>
              ))}

              {/* Köşeler */}
              {poly.map((p,i)=>{
                const isFirst=i===0,isClose=drawing&&isFirst&&poly.length>=3&&cur&&dist(cur.x,cur.y,p[0],p[1])<18;
                return(<g key={i}>
                  <circle cx={p[0]} cy={p[1]} r={isClose?12:mod==='edit'?8:5}
                    fill={isFirst?(drawing?'#10b981':'#3b82f6'):mod==='edit'?'#f59e0b':'#3b82f6'}
                    stroke="white" strokeWidth="2" className={mod==='edit'?'cursor-grab':''}/>
                  {mod==='edit'&&i<poly.length&&(()=>{
                    const q=poly[(i+1)%poly.length];
                    return<circle cx={(p[0]+q[0])/2} cy={(p[1]+q[1])/2} r={4} fill="#94a3b8" stroke="white" strokeWidth="1.5" opacity="0.6" className="cursor-pointer"/>;
                  })()}
                </g>);
              })}

              {/* Engeller */}
              {obstacles.map(o=>(
                <g key={o.id} className={mod==='edit'||mod==='view'?'cursor-grab':''}>
                  <rect x={o.x*sc} y={o.y*sc} width={o.w*sc} height={o.h*sc} fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1.5"/>
                  <line x1={o.x*sc} y1={o.y*sc} x2={(o.x+o.w)*sc} y2={(o.y+o.h)*sc} stroke="#ef4444" strokeWidth="1" opacity="0.3"/>
                  <line x1={(o.x+o.w)*sc} y1={o.y*sc} x2={o.x*sc} y2={(o.y+o.h)*sc} stroke="#ef4444" strokeWidth="1" opacity="0.3"/>
                  <text x={(o.x+o.w/2)*sc} y={(o.y+o.h/2)*sc+3} textAnchor="middle" fontSize="8" fill="#991b1b" fontWeight="bold">{o.w.toFixed(1)}×{o.h.toFixed(1)}m</text>
                  <g className="cursor-pointer" onClick={e=>{e.stopPropagation();setObstacles(a=>a.filter(x=>x.id!==o.id));}}>
                    <circle cx={(o.x+o.w)*sc} cy={o.y*sc} r={7} fill="#ef4444"/>
                    <text x={(o.x+o.w)*sc} y={o.y*sc+4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text>
                  </g>
                </g>
              ))}

              {/* Ruler — ölçüm aleti */}
              {rulerPts.length>=1&&(()=>{
                const a=rulerPts[0];
                const b=rulerPts.length>=2?rulerPts[1]:rulerCur;
                if(!b)return null;
                const dx=Math.abs(b.x-a.x)/sc,dy=Math.abs(b.y-a.y)/sc;
                const manhattan=(dx+dy).toFixed(2);
                const straight=Math.sqrt(dx*dx+dy*dy).toFixed(2);
                const midX=(a.x+b.x)/2,midY=(a.y+b.y)/2;
                return(<g>
                  {/* L şekli çizgi */}
                  <polyline points={`${a.x},${a.y} ${b.x},${a.y} ${b.x},${b.y}`}
                    fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,3"/>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity="0.4"/>
                  <circle cx={a.x} cy={a.y} r={5} fill="#10b981" stroke="white" strokeWidth="2"/>
                  <circle cx={b.x} cy={b.y} r={5} fill="#10b981" stroke="white" strokeWidth="2"/>
                  <rect x={midX-38} y={midY-22} width={76} height={26} rx={5} fill="#10b981" opacity="0.95"/>
                  <text x={midX} y={midY-8} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">📏 {manhattan}m (köşeli)</text>
                  <text x={midX} y={midY+5} textAnchor="middle" fontSize="8" fill="white" opacity="0.85">kuş uçuşu: {straight}m</text>
                </g>);
              })()}

              {/* Kablo ölçüm noktaları */}
              {markedPts.map((p,i)=>(
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={10} fill={i===0?'#7c3aed':'#db2777'} stroke="white" strokeWidth="2.5"/>
                  <text x={p.x} y={p.y+4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">{i===0?'A':'B'}</text>
                  {/* Invertere L çizgisi */}
                  {inverters.length>0&&(()=>{
                    const inv=inverters[0];
                    return(<polyline points={`${p.x},${p.y} ${inv.x},${p.y} ${inv.x},${inv.y}`}
                      fill="none" stroke={i===0?'#7c3aed':'#db2777'} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.7"/>);
                  })()}
                </g>
              ))}

              {/* Kablo ölçüm sonuç kutusu */}
              {cableResult&&markedPts.length===2&&(()=>{
                const cx=(markedPts[0].x+markedPts[1].x)/2;
                const cy=Math.min(markedPts[0].y,markedPts[1].y)-60;
                return(<g>
                  <rect x={cx-70} y={cy} width={140} height={52} rx={8} fill="#4f46e5" opacity="0.95"/>
                  <text x={cx} y={cy+14} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">🔌 DC Kablo Mesafesi</text>
                  <text x={cx} y={cy+27} textAnchor="middle" fontSize="8" fill="white" opacity="0.9">A→İnv: {cableResult.da}m · B→İnv: {cableResult.db}m</text>
                  <text x={cx} y={cy+40} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fbbf24">Toplam: {cableResult.total}m (+{cableResult.vOff}m dikey)</text>
                </g>);
              })()}

              {/* İnverterler */}
              {inverters.map((iv,ii)=>(
                <g key={iv.id} transform={`translate(${iv.x},${iv.y})`}>
                  <circle cx="0" cy="0" r="14" fill="#f59e0b" stroke="white" strokeWidth="2.5"/>
                  <text x="0" y="5" textAnchor="middle" fontSize="13">⚡</text>
                  <text x="18" y="4" fontSize="9" fontWeight="bold" fill="#92400e">{iv.label}</text>
                  <g className="cursor-pointer" onClick={e=>{e.stopPropagation();setInverters(ivs=>ivs.filter(x=>x.id!==iv.id));}}>
                    <circle cx="14" cy="-10" r="6" fill="#ef4444"/>
                    <text x="14" y="-7" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">✕</text>
                  </g>
                </g>
              ))}

              {/* Palette önizlemesi */}
              {draggingPalette==='obs'&&palettePos&&(
                <rect x={palettePos.x-newObs.w*sc/2} y={palettePos.y-newObs.h*sc/2}
                  width={newObs.w*sc} height={newObs.h*sc}
                  fill="#ef4444" fillOpacity="0.3" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" rx="3"/>
              )}
              {draggingPalette==='str'&&palettePos&&(()=>{
                const bw=strBlockWpx(newStr),bh=strBlockHpx(newStr);
                return(
                  <g opacity="0.6">
                    <rect x={palettePos.x-bw/2} y={palettePos.y-bh/2} width={bw} height={bh}
                      fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4,2" rx="3"/>
                    <text x={palettePos.x} y={palettePos.y+4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e40af">
                      {newStr.rows}×{newStr.cols}
                    </text>
                  </g>
                );
              })()}

              {/* Ölçek */}
              <g transform={`translate(${SW-145},${SH-22})`}>
                <line x1="0" y1="7" x2={5*sc} y2="7" stroke="#475569" strokeWidth="2"/>
                <line x1="0" y1="3" x2="0" y2="11" stroke="#475569" strokeWidth="2"/>
                <line x1={5*sc} y1="3" x2={5*sc} y2="11" stroke="#475569" strokeWidth="2"/>
                <text x={5*sc/2} y="20" textAnchor="middle" fontSize="9" fill="#475569">5 m</text>
              </g>
            </svg>
          </div>

          {/* String özet */}
          {strBlocks.length>0&&(
            <div className="bg-white p-4 rounded-xl border mt-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">String Özeti</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {strBlocks.map((b,bi)=>{
                  const col=COLS[bi%COLS.length];
                  const label=fmtStr(b.invIdx,b.mpptIdx,b.strIdx,nInv);
                  return(
                    <div key={b.id} className="rounded-xl border-2 px-3 py-2.5" style={{borderColor:col,background:col+'15'}}>
                      <div className="font-black text-sm" style={{color:col}}>String {label}</div>
                      <div className="font-mono text-xs text-slate-600">{b.rows}×{b.cols} = {b.rows*b.cols} panel</div>
                      <div className="text-[10px] text-slate-400">{(strBlockWpx(b)/sc).toFixed(1)}×{(strBlockHpx(b)/sc).toFixed(1)} m</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                <b>Toplam: {totalPanels} panel</b> · {strBlocks.length} string ·{' '}
                {inverters.length} inverter{inverters.length>1?` (${inverters.length} adet)`:''}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Numaralama: {nInv===1?'INV.String (ör: 1.1, 1.2)':'INV.MPPT.String (ör: 1.1.1, 1.1.2)'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
