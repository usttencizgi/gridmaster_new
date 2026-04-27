import { useState, useRef, useCallback, useEffect } from 'react';
import DxfParser from 'dxf-parser';

// ─── Geo ─────────────────────────────────────────────────────────
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
  const mnX=Math.min(...xs),mxX=Math.max(...xs),mnY=Math.min(...ys),mxY=Math.max(...ys);
  const pW=pw*sc,pH=ph*sc,rG=rg*sc,cG=cg*sc,sbP=sb*sc;
  const ins=sbP>0?insetPoly(poly,sbP):poly;
  let cnt=0;
  for(let y=mnY+sbP;y+pH<=mxY-sbP+1;y+=pH+rG)
    for(let x=mnX+sbP;x+pW<=mxX-sbP+1;x+=pW+cG){
      if(![[x,y],[x+pW,y],[x+pW,y+pH],[x,y+pH]].every(([cx,cy])=>ptInPoly(cx,cy,ins)))continue;
      if(obs.some(o=>x<(o.x+o.w)*sc&&x+pW>o.x*sc&&y<(o.y+o.h)*sc&&y+pH>o.y*sc))continue;
      cnt++;
    }
  return cnt;
}
function fmtStr(invIdx,strIdx,nInv){return nInv===1?`${invIdx}.${strIdx}`:`${invIdx}.1.${strIdx}`;}
const COLS=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];

// ─── Ana bileşen ─────────────────────────────────────────────────
export default function CatiTasarim(){
  const SW=780,SH=520;

  // DXF import
  const [dxfEntities,setDxfEntities]=useState([]); // parse edilmiş polyline'lar
  const [dxfSel,setDxfSel]=useState(null);          // seçili entity index
  const [dxfModal,setDxfModal]=useState(false);
  const dxfRef=useRef(null);

  const parseDxf=async(file)=>{
    const text=await file.text();
    try{
      const parser=new DxfParser();
      const dxf=parser.parseSync(text);
      const ents=[];
      (dxf.entities||[]).forEach(e=>{
        if(e.type==='LWPOLYLINE'||e.type==='POLYLINE'){
          const pts=(e.vertices||[]).map(v=>[v.x,v.y]);
          if(pts.length>=3) ents.push({type:e.type,pts,layer:e.layer||'0'});
        }
        if(e.type==='LINE'){
          // Tekil çizgiler — gruplamıyoruz, skip
        }
      });
      if(!ents.length){alert('DXF dosyasında kapalı polyline bulunamadı.\nLütfen çatı dış hattını LWPOLYLINE veya POLYLINE olarak çizin.');return;}
      setDxfEntities(ents);
      setDxfSel(0);
      setDxfModal(true);
    }catch(err){
      alert('DXF okunamadı: '+err.message);
    }
  };

  const applyDxf=()=>{
    if(dxfSel===null||!dxfEntities[dxfSel])return;
    const ent=dxfEntities[dxfSel];
    const pts=ent.pts;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    const mnX=Math.min(...xs),mxX=Math.max(...xs),mnY=Math.min(...ys),mxY=Math.max(...ys);
    const wM=mxX-mnX,hM=mxY-mnY;
    if(wM===0||hM===0){alert('Geçersiz geometri');return;}
    const margin=40;
    // Ölçeği hesapla — küçük çatılar için yakın, büyük için uzak
    const fitSc=Math.min((780-margin*2)/wM,(520-margin*2)/hM);
    const newSc=Math.max(8,Math.min(Math.round(fitSc),60));
    // DXF Y ekseni ters (AutoCAD ↑, SVG ↓)
    const mapped=pts.map(([x,y])=>[
      margin+(x-mnX)*newSc,
      margin+(mxY-y)*newSc,
    ]);
    // Tek batch'te tüm state güncellemeleri
    setSc(newSc);
    setPoly(mapped);
    setDrawing(false);
    setCur(null);
    setDimVal('');
    setStrBlocks([]);
    setObst([]);
    setInverters([]);
    setMaxFill(null);
    setMarkedPts([]);
    setCableTable([]);
    setDxfModal(false);
    setDxfEntities([]);
    setDxfSel(null);
  };

  // Ölçek
  const [sc,setSc]=useState(28);

  // Çatı
  const [poly,setPoly]=useState([]);
  const [drawing,setDrawing]=useState(false);
  const [cur,setCur]=useState(null);
  const [dimVal,setDimVal]=useState('');

  // Köşe düzenleme
  const [dragCorner,setDragCorner]=useState(null);

  // Engeller
  const [obstacles,setObst]=useState([]);
  const [dragObs,setDragObs]=useState(null);
  const [newObs,setNewObs]=useState({w:1.5,h:1.5});

  // String bloklar
  const [strBlocks,setStrBlocks]=useState([]);
  const [dragBlock,setDragBlock]=useState(null);
  const [newStr,setNewStr]=useState({rows:3,cols:4});

  // Palette sürükleme
  const [dragging,setDragging]=useState(null); // 'obs'|'str'
  const [palPos,setPalPos]=useState(null);

  // İnverterler
  const [inverters,setInverters]=useState([]);

  // Panel ayarları
  const [pW,setPW]=useState(1.13);
  const [pH,setPH]=useState(2.28);
  const [or,setOr]=useState('portrait');
  const [rg,setRg]=useState(0.05);
  const [cg,setCg]=useState(0.02);
  const [sb,setSb]=useState(0.5);

  // Dikey mesafe (inverter kat farkı)
  const [vOff,setVOff]=useState(0);

  // Mod
  const [mod,setMod]=useState('draw');

  // Max kapasite
  const [maxFill,setMaxFill]=useState(null);

  // Ruler
  const [rulerPts,setRulerPts]=useState([]);
  const [rulerCur,setRulerCur]=useState(null);

  // Kablo ölçüm
  const [markedPts,setMarkedPts]=useState([]);
  const [cableResult,setCableResult]=useState(null);

  // Kablo tablosu
  const [cableTable,setCableTable]=useState([]);

  const svgRef=useRef(null);

  // Panel boyutu
  const panW=or==='portrait'?pW:pH;
  const panH=or==='portrait'?pH:pW;

  // Blok px boyutları
  const blkW=s=>s.cols*panW*sc+(s.cols-1)*cg*sc;
  const blkH=s=>s.rows*panH*sc+(s.rows-1)*rg*sc;

  // Waypoint state — her ölçüm için ayrı güzergah noktaları
  const [waypoints,setWaypoints]=useState([]); // [{x,y}] — A ve B arası değil, A→inv ve B→inv güzergahları
  const [wpMode,setWpMode]=useState(null); // null | 'a' | 'b' — hangi kablo güzergahı çiziliyor

  // Kablo hesabı — waypoint varsa waypoint üzerinden, yoksa Manhattan
  useEffect(()=>{
    if(markedPts.length===2){
      const a=markedPts[0],b=markedPts[1];
      let da,db;
      if(inverters.length>0){
        const inv=inverters[0];
        // Waypoint varsa waypoint üzerinden mesafe
        const aWps=waypoints.filter(w=>w.side==='a');
        const bWps=waypoints.filter(w=>w.side==='b');
        if(aWps.length>0){
          const chain=[a,...aWps,inv];
          da=chain.reduce((s,p,i)=>i===0?0:s+dist(chain[i-1].x,chain[i-1].y,p.x,p.y),0)/sc;
        } else {
          da=(Math.abs(a.x-inv.x)+Math.abs(a.y-inv.y))/sc;
        }
        if(bWps.length>0){
          const chain=[b,...bWps,inv];
          db=chain.reduce((s,p,i)=>i===0?0:s+dist(chain[i-1].x,chain[i-1].y,p.x,p.y),0)/sc;
        } else {
          db=(Math.abs(b.x-inv.x)+Math.abs(b.y-inv.y))/sc;
        }
      } else {
        da=0;db=0;
      }
      const total=da+db+2*vOff;
      setCableResult({
        da:da.toFixed(2),
        db:db.toFixed(2),
        vOff,
        total:total.toFixed(2),
        halfL:(total/2).toFixed(2),
      });
    } else {
      setCableResult(null);
    }
  },[markedPts,waypoints,inverters,sc,vOff]);

  // SVG koordinat (doğru — createSVGPoint kullanır)
  const getSpt=useCallback(e=>{
    const svg=svgRef.current;
    if(!svg)return{x:0,y:0};
    const pt=svg.createSVGPoint();
    pt.x=e.clientX; pt.y=e.clientY;
    const sp=pt.matrixTransform(svg.getScreenCTM().inverse());
    return{x:sp.x,y:sp.y};
  },[]);

  const getSnap=(rx,ry)=>{
    if(!poly.length)return{x:rx,y:ry,sn:false};
    const l=poly[poly.length-1];
    const[sx,sy,sn]=snapAngle(l[0],l[1],rx,ry);
    return{x:sx,y:sy,sn};
  };

  // Klavye
  useEffect(()=>{
    const h=e=>{
      if(e.key==='Escape'){setDrawing(false);setPoly([]);setCur(null);setDimVal('');}
      if(e.key==='Enter'&&mod==='draw'&&drawing&&poly.length>=3){setDrawing(false);setCur(null);setDimVal('');}
    };
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[mod,drawing,poly]);

  // Mouse Move
  const onMM=e=>{
    const pt=getSpt(e);
    if(mod==='draw'&&drawing&&!dimVal){setCur(getSnap(pt.x,pt.y));}
    if((mod==='ruler'||mod==='cable')&&(rulerPts.length===1||markedPts.length===1)){setRulerCur({x:pt.x,y:pt.y});}
    if(mod==='edit'&&dragCorner!==null){setPoly(p=>p.map((v,i)=>i===dragCorner?[pt.x,pt.y]:v));}
    if(dragObs){setObst(obs=>obs.map(o=>o.id===dragObs.id?{...o,x:(pt.x-dragObs.ox)/sc,y:(pt.y-dragObs.oy)/sc}:o));}
    if(dragBlock){setStrBlocks(bs=>bs.map(b=>b.id===dragBlock.id?{...b,x:pt.x-dragBlock.ox,y:pt.y-dragBlock.oy}:b));}
    if(dragging){setPalPos({x:pt.x,y:pt.y});}
  };

  // Mouse Down
  const onMD=e=>{
    const pt=getSpt(e);
    if(mod==='edit'){
      // Köşe
      const near=poly.reduce((b,v,i)=>{const d=dist(pt.x,pt.y,v[0],v[1]);return d<b.d?{i,d}:b},{i:-1,d:Infinity});
      if(near.d<16){setDragCorner(near.i);return;}
      // Kenar orta nokta → yeni köşe
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
        if(dist(pt.x,pt.y,mx,my)<16){const np=[...poly];np.splice(i+1,0,[pt.x,pt.y]);setPoly(np);setDragCorner(i+1);return;}
      }
      // Blok taşı
      for(const b of strBlocks){
        if(pt.x>=b.x&&pt.x<=b.x+blkW(b)&&pt.y>=b.y&&pt.y<=b.y+blkH(b)){
          setDragBlock({id:b.id,ox:pt.x-b.x,oy:pt.y-b.y});return;
        }
      }
      // Engel taşı
      for(const o of obstacles){
        if(pt.x>=o.x*sc&&pt.x<=(o.x+o.w)*sc&&pt.y>=o.y*sc&&pt.y<=(o.y+o.h)*sc){
          setDragObs({id:o.id,ox:pt.x-o.x*sc,oy:pt.y-o.y*sc});return;
        }
      }
    }
    if(mod==='inverter'){setInverters(ivs=>[...ivs,{id:Date.now(),x:pt.x,y:pt.y}]);}
  };

  // Mouse Up
  const onMU=e=>{
    const pt=getSpt(e);
    setDragCorner(null);setDragObs(null);setDragBlock(null);
    if(dragging==='obs'&&palPos){
      setObst(o=>[...o,{id:Date.now(),x:(pt.x-newObs.w*sc/2)/sc,y:(pt.y-newObs.h*sc/2)/sc,w:newObs.w,h:newObs.h}]);
    }
    if(dragging==='str'&&palPos){
      const bw=blkW(newStr),bh=blkH(newStr);
      const si=strBlocks.length+1;
      setStrBlocks(bs=>[...bs,{id:Date.now(),x:pt.x-bw/2,y:pt.y-bh/2,rows:newStr.rows,cols:newStr.cols,invIdx:1,strIdx:si}]);
    }
    setDragging(null);setPalPos(null);
  };

  // Click
  const onClick=e=>{
    const pt=getSpt(e);
    if(mod==='ruler'){
      setRulerPts(p=>p.length>=2?[{x:pt.x,y:pt.y}]:[...p,{x:pt.x,y:pt.y}]);
      setRulerCur(null);return;
    }
    if(mod==='cable'){
      const pt=getSpt(e);
      if(wpMode){
        // Güzergah noktası ekle
        setWaypoints(w=>[...w,{x:pt.x,y:pt.y,side:wpMode}]);
        return;
      }
      // A veya B noktası
      setMarkedPts(p=>{
        if(p.length>=2){setWaypoints([]);return[{x:pt.x,y:pt.y}];}
        return[...p,{x:pt.x,y:pt.y}];
      });
      setRulerCur(null);return;
    }
    if(mod!=='draw')return;
    if(!drawing){setPoly([[pt.x,pt.y]]);setDrawing(true);setCur({x:pt.x,y:pt.y,sn:false});return;}
    if(poly.length>=3&&dist(pt.x,pt.y,poly[0][0],poly[0][1])<18){setDrawing(false);setCur(null);setDimVal('');return;}
    const s=getSnap(pt.x,pt.y);setPoly(p=>[...p,[s.x,s.y]]);
  };
  const onDbl=()=>{if(mod==='draw'&&drawing&&poly.length>=3){setDrawing(false);setCur(null);}};

  const commitDim=()=>{
    const d=parseFloat(dimVal);
    if(isNaN(d)||d<=0||!cur||!poly.length)return;
    const l=poly[poly.length-1],dx=cur.x-l[0],dy=cur.y-l[1],len=Math.sqrt(dx*dx+dy*dy)||1;
    setPoly(p=>[...p,[l[0]+dx/len*d*sc,l[1]+dy/len*d*sc]]);
    setDimVal('');
  };

  const saveMeasure=()=>{
    if(!cableResult)return;
    const label=`String ${cableTable.length+1}`;
    setCableTable(t=>[...t,{id:Date.now(),label,da:cableResult.da,db:cableResult.db,vOff:cableResult.vOff,total:cableResult.total,halfL:cableResult.halfL}]);
    setMarkedPts([]);setWaypoints([]);setWpMode(null);
  };

  const exportDC=()=>{
    if(!cableTable.length)return;
    const lines=cableTable.map((r,i)=>{
      const blk=strBlocks[i];
      return{
        id:r.id,
        code:r.label,
        nSeri:blk?blk.rows*blk.cols:12,
        L:parseFloat(r.halfL||r.total/2), // hesap için ÷2
      };
    });
    localStorage.setItem('catiDCLines',JSON.stringify(lines));
    alert(`${lines.length} string DC Dizi Tanımlarına aktarıldı.\nHesap uzunluğu (÷2): ${lines.map(l=>l.L.toFixed(2)+'m').join(', ')}\n\nGES Kablo modülünde "Çatıdan Yükle" butonuna basın.`);
  };

  const resetAll=()=>{
    setPoly([]);setDrawing(false);setCur(null);setDimVal('');
    setObst([]);setStrBlocks([]);setInverters([]);setMaxFill(null);
    setRulerPts([]);setRulerCur(null);setMarkedPts([]);setCableTable([]);
  };

  const edges=poly.map((p,i)=>{const q=poly[(i+1)%poly.length];return{mid:[(p[0]+q[0])/2,(p[1]+q[1])/2],len:dist(p[0],p[1],q[0],q[1])/sc};});
  const areaM2=poly.length>=3?polyArea(poly)/(sc*sc):0;
  const totalPanels=strBlocks.reduce((s,b)=>s+b.rows*b.cols,0);
  const nInv=Math.max(1,inverters.length);

  const MB=(m,ic,lb,c)=>(
    <button onClick={()=>setMod(m)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${mod===m?`border-${c}-500 bg-${c}-50 text-${c}-700`:'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
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
            <p className="text-sky-100 text-sm">Çatı çiz · String blok yerleştir · Kablo ölç · DC'ye aktar</p>
          </div>
        </div>
        <div className="text-right text-white">
          <div className="text-2xl font-black">{totalPanels}</div>
          <div className="text-xs text-sky-200">{strBlocks.length} string · {areaM2.toFixed(1)} m²</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* SOL */}
        <div className="space-y-3">

          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">DXF / DWG İçe Aktar</div>
            <input ref={dxfRef} type="file" accept=".dxf,.DXF" className="hidden"
              onChange={e=>{if(e.target.files[0])parseDxf(e.target.files[0]);e.target.value='';}}/>
            <button onClick={()=>dxfRef.current?.click()}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2">
              📐 DXF Dosyası Yükle
            </button>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              AutoCAD'de <b>File → Save As → DXF</b> ile export edin.
              Çatı hattını <b>LWPOLYLINE</b> olarak çizin.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Mod</div>
            <div className="flex flex-col gap-1.5">
              {MB('draw',    '✏️','Çatı Çiz','blue')}
              {MB('edit',    '↗️','Düzenle / Taşı','amber')}
              {MB('inverter','⚡','İnverter Ekle','yellow')}
              {MB('ruler',   '📏','Mesafe Ölç','emerald')}
              {MB('cable',   '🔌','Kablo Ölç','purple')}
              {MB('view',    '👁️','İncele','slate')}
            </div>
            <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[10px] text-slate-500 leading-relaxed">
              {mod==='draw'   &&<><b>Tıkla</b>→nokta · <b>Dbl/Enter</b>→kapat · <b>Mesafe+Enter</b>→tam kenar</>}
              {mod==='edit'   &&'Köşe sürükle · Kenar ortasına tıkla→yeni köşe · Blok/Engel sürükle→taşı'}
              {mod==='inverter'&&'Canvas\'a tıkla → inverter ekle (✕ ile sil)'}
              {mod==='ruler'  &&'1.tıkla→A · 2.tıkla→B → Manhattan + kuş uçuşu mesafe'}
              {mod==='cable'  &&(wpMode?<><b>{wpMode==='a'?'A':'B'} güzergahı:</b> Canvas'a tıkla → nokta ekle · Tekrar sol panelden güzergah butonuna bas → bitir</>:<>1.tıkla→A (ilk panel) · 2.tıkla→B (son panel) → sonra güzergah ekleyebilirsin</>)}
              {mod==='view'   &&'String bağlantı hatlarını gör'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Panel</div>
            <div className="flex gap-2 mb-2">
              {[['portrait','Dikey'],['landscape','Yatay']].map(([v,l])=>(
                <button key={v} onClick={()=>setOr(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${or===v?'bg-sky-50 border-sky-500 text-sky-700':'border-slate-200 text-slate-500'}`}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['En(m)',pW,setPW,0.01],['Boy(m)',pH,setPH,0.01],['Satır Gap',rg,setRg,0.02],['Sütun Gap',cg,setCg,0.01]].map(([l,v,f,s])=>(
                <div key={l}><label className="text-[10px] text-slate-400 block mb-0.5">{l}</label>
                  <input type="number" value={v} step={s} min={0} onChange={e=>f(+e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
              ))}
            </div>
          </div>

          {/* Engel paleti */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Engel Ekle</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[['En(m)',newObs.w,v=>setNewObs(o=>({...o,w:v}))],['Boy(m)',newObs.h,v=>setNewObs(o=>({...o,h:v}))]].map(([l,v,f])=>(
                <div key={l}><label className="text-[10px] text-slate-400 block mb-0.5">{l}</label>
                  <input type="number" value={v} step={0.1} min={0.1} onChange={e=>f(+e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-red-400 outline-none"/></div>
              ))}
            </div>
            <div className="bg-red-50 border-2 border-dashed border-red-300 rounded-xl p-3 text-center cursor-grab text-xs text-red-600 font-bold select-none"
              onMouseDown={e=>{e.preventDefault();setDragging('obs');setPalPos(getSpt(e));}}>
              ⬛ {newObs.w}×{newObs.h}m — Sürükle & Bırak
            </div>
          </div>

          {/* String blok paleti */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">String Blok</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[['Satır',newStr.rows,v=>setNewStr(s=>({...s,rows:v}))],['Sütun',newStr.cols,v=>setNewStr(s=>({...s,cols:v}))]].map(([l,v,f])=>(
                <div key={l}><label className="text-[10px] text-slate-400 block mb-0.5">{l} (panel)</label>
                  <input type="number" value={v} step={1} min={1} onChange={e=>f(+e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-blue-400 outline-none"/></div>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 mb-2 font-mono">{newStr.rows*newStr.cols} panel · {(blkW(newStr)/sc).toFixed(2)}×{(blkH(newStr)/sc).toFixed(2)} m</div>
            <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl p-3 text-center cursor-grab text-xs text-blue-600 font-bold select-none"
              onMouseDown={e=>{e.preventDefault();setDragging('str');setPalPos(getSpt(e));}}>
              ☀ {newStr.rows}×{newStr.cols} panel — Sürükle & Bırak
            </div>
          </div>

          {/* Max kapasite */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Kapasite</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="text-[10px] text-slate-400 block mb-0.5">Kenar Payı (m)</label>
                <input type="number" value={sb} step={0.1} min={0} onChange={e=>setSb(+e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-emerald-400 outline-none"/></div>
              <div><label className="text-[10px] text-slate-400 block mb-0.5">Dikey Mesafe (m)</label>
                <input type="number" value={vOff} step={1} min={0} onChange={e=>setVOff(+e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-amber-400 outline-none"/></div>
            </div>
            <button onClick={()=>setMaxFill(maxFillCount(poly,obstacles,panW,panH,rg,cg,sb,sc))}
              disabled={poly.length<3}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs">
              Max Kapasite Hesapla
            </button>
            {maxFill!==null&&(
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
                <div className="text-xl font-black text-emerald-700">{maxFill}</div>
                <div className="text-[10px] text-emerald-600">panel (teorik maks.)</div>
              </div>
            )}
          </div>

          {/* Kablo ölçüm sonucu */}
          {cableResult&&(
            <div className="bg-indigo-50 border-2 border-indigo-300 p-4 rounded-xl">
              <div className="text-[10px] font-bold text-indigo-500 uppercase mb-2">🔌 Kablo Ölçümü</div>
              <div className="space-y-1 text-xs font-mono mb-3">
                <div className="flex justify-between"><span className="text-purple-700">A → İnverter</span><span className="font-bold">{cableResult.da} m</span></div>
                <div className="flex justify-between"><span className="text-pink-700">B → İnverter</span><span className="font-bold">{cableResult.db} m</span></div>
                {vOff>0&&<div className="flex justify-between"><span className="text-slate-500">Dikey ×2</span><span className="font-bold">{(vOff*2).toFixed(1)} m</span></div>}
                <div className="border-t border-indigo-200 pt-1 mt-1 flex justify-between">
                  <span className="font-bold text-indigo-800">Keşif Toplamı</span>
                  <span className="font-black text-indigo-800 text-sm">{cableResult.total} m</span>
                </div>
                <div className="flex justify-between bg-amber-50 rounded-lg px-2 py-1">
                  <span className="font-bold text-amber-700">Hesap için (÷2)</span>
                  <span className="font-black text-amber-700 text-sm">{cableResult.halfL} m</span>
                </div>
              </div>
              {/* Güzergah çizimi */}
              {markedPts.length===2&&inverters.length>0&&(
                <div className="mb-3 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Güzergah Ekle (opsiyonel)</div>
                  <div className="flex gap-2">
                    <button onClick={()=>setWpMode(wpMode==='a'?null:'a')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${wpMode==='a'?'bg-purple-100 border-purple-500 text-purple-700':'border-slate-200 text-slate-500'}`}>
                      {wpMode==='a'?'● ':''}A güzergahı
                    </button>
                    <button onClick={()=>setWpMode(wpMode==='b'?null:'b')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${wpMode==='b'?'bg-pink-100 border-pink-500 text-pink-700':'border-slate-200 text-slate-500'}`}>
                      {wpMode==='b'?'● ':''}B güzergahı
                    </button>
                  </div>
                  {waypoints.length>0&&(
                    <button onClick={()=>setWaypoints([])}
                      className="w-full text-[10px] text-red-400 hover:text-red-600 font-bold">
                      Güzergahı Temizle ({waypoints.length} nokta)
                    </button>
                  )}
                </div>
              )}
              <button onClick={saveMeasure}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-2 rounded-lg text-xs">
                + Tabloya Kaydet
              </button>
            </div>
          )}

          {/* Kablo tablosu */}
          {cableTable.length>0&&(
            <div className="bg-white border rounded-xl p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">DC Kablo Tablosu</div>
              <div className="space-y-1 text-xs">
                {cableTable.map(r=>(
                  <div key={r.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                    <input value={r.label}
                      onChange={e=>setCableTable(t=>t.map(x=>x.id===r.id?{...x,label:e.target.value}:x))}
                      className="flex-1 bg-transparent font-bold text-slate-700 outline-none text-xs min-w-0"/>
                    <span className="font-mono text-indigo-700 whitespace-nowrap">{r.total}m</span>
                    <span className="font-mono font-black text-amber-700 whitespace-nowrap">{r.halfL}m</span>
                    <button onClick={()=>setCableTable(t=>t.filter(x=>x.id!==r.id))}
                      className="text-red-400 hover:text-red-600 font-bold flex-shrink-0">✕</button>
                  </div>
                ))}
                <div className="flex justify-between text-[10px] text-slate-400 px-2 pb-1">
                  <span>keşif (toplam)</span><span>hesap (÷2)</span>
                </div>
              </div>
              {/* Toplam */}
              <div className="mt-2 border-t border-slate-200 pt-2 px-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">Keşif Toplamı ({cableTable.length} string)</span>
                  <span className="font-black font-mono text-indigo-700 text-sm">
                    {cableTable.reduce((s,r)=>s+parseFloat(r.total),0).toFixed(2)} m
                  </span>
                </div>
                <div className="flex items-center justify-between bg-amber-50 rounded-lg px-2 py-1.5">
                  <span className="text-xs font-black text-amber-700">Hesap Toplamı (÷2)</span>
                  <span className="font-black font-mono text-amber-700 text-sm">
                    {(cableTable.reduce((s,r)=>s+parseFloat(r.total),0)/2).toFixed(2)} m
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 text-right">
                  ×2 (pos+neg) = {cableTable.reduce((s,r)=>s+parseFloat(r.total),0).toFixed(2)} m fiziksel kablo
                </div>
              </div>
              <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5 mb-2">
                ⚡ Aktarımda <b>hesap uzunluğu (÷2)</b> kullanılır
              </div>
              <button onClick={exportDC}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2 rounded-lg text-xs">
                ⚡ DC Dizi Tanımlarına Aktar
              </button>
            </div>
          )}

          {/* Ölçek + sıfırla */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ölçek ({sc} px/m)</div>
            <input type="range" min={8} max={80} step={2} value={sc}
              onChange={e=>setSc(+e.target.value)} className="w-full accent-sky-500"/>
          </div>
          <button onClick={resetAll}
            className="w-full border-2 border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-400 font-bold py-2 rounded-xl text-xs">
            Hepsini Sıfırla
          </button>
        </div>

        {/* CANVAS */}
        <div className="xl:col-span-3 space-y-3">
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
              <span className="font-mono text-slate-500">{areaM2.toFixed(1)} m²</span>
              <span className="text-slate-300">|</span>
              <span className="text-blue-600 font-bold">{poly.length} köşe</span>
              <span className="text-slate-300">|</span>
              <span className="text-sky-600 font-bold">{totalPanels} panel</span>
              {drawing&&<><span className="text-slate-300">|</span><span className="text-blue-500 font-bold animate-pulse">● Çiziliyor</span></>}
            </div>

            {drawing&&mod==='draw'&&(
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-3">
                <span className="text-xs text-blue-700 font-bold">Mesafe (m):</span>
                <input type="text" value={dimVal} placeholder="örn: 8.5"
                  onChange={e=>setDimVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')commitDim();if(e.key==='Escape')setDimVal('');}}
                  className="border-2 border-blue-300 rounded-lg px-3 py-1 text-sm font-mono w-28 focus:border-blue-500 outline-none bg-white"/>
                <button onClick={commitDim} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold">↵</button>
                {cur&&poly.length>0&&(()=>{
                  const l=poly[poly.length-1],d=dist(cur.x,cur.y,l[0],l[1])/sc;
                  const ang=Math.atan2(cur.y-l[1],cur.x-l[0])*180/Math.PI;
                  return<span className="text-[10px] text-blue-400">{d.toFixed(2)}m · {ang.toFixed(0)}°{cur.sn?' 🧲':''}</span>;
                })()}
              </div>
            )}

            <svg ref={svgRef} width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`}
              className="w-full select-none"
              style={{background:'#f1f5f9',cursor:['draw','ruler','cable','inverter'].includes(mod)?'crosshair':'default'}}
              onClick={onClick} onMouseMove={onMM} onMouseDown={onMD} onMouseUp={onMU} onDoubleClick={onDbl}>

              {/* Grid */}
              {Array.from({length:Math.ceil(SW/sc)+1},(_,i)=>i).map(i=>(
                <line key={`v${i}`} x1={i*sc} y1={0} x2={i*sc} y2={SH} stroke="#e2e8f0" strokeWidth={i%5===0?.7:.25}/>
              ))}
              {Array.from({length:Math.ceil(SH/sc)+1},(_,i)=>i).map(i=>(
                <line key={`h${i}`} x1={0} y1={i*sc} x2={SW} y2={i*sc} stroke="#e2e8f0" strokeWidth={i%5===0?.7:.25}/>
              ))}

              {/* String bloklar */}
              {strBlocks.map((b,bi)=>{
                const bw=blkW(b),bh=blkH(b),col=COLS[bi%COLS.length];
                const label=fmtStr(b.invIdx,b.strIdx,nInv);
                return(<g key={b.id} className={mod==='edit'?'cursor-grab':''}>
                  {Array.from({length:b.rows},(_,r)=>Array.from({length:b.cols},(_,c)=>(
                    <rect key={`${r}-${c}`} x={b.x+c*(panW*sc+cg*sc)} y={b.y+r*(panH*sc+rg*sc)}
                      width={panW*sc} height={panH*sc} fill={col} fillOpacity="0.5" stroke={col} strokeWidth="0.7"/>
                  )))}
                  <rect x={b.x-2} y={b.y-2} width={bw+4} height={bh+4} fill="none" stroke={col} strokeWidth="2" strokeDasharray="4,2" rx="3"/>
                  <rect x={b.x+bw/2-20} y={b.y-20} width={40} height={17} rx={4} fill={col} opacity="0.9"/>
                  <text x={b.x+bw/2} y={b.y-8} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">{label}</text>
                  <g onClick={e=>{e.stopPropagation();setStrBlocks(bs=>bs.filter(x=>x.id!==b.id));}}>
                    <circle cx={b.x+bw} cy={b.y} r={8} fill={col} className="cursor-pointer"/>
                    <text x={b.x+bw} y={b.y+4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text>
                  </g>
                </g>);
              })}

              {/* Çatı */}
              {poly.length>=3&&<polygon points={poly.map(p=>p.join(',')).join(' ')} fill="#3b82f6" fillOpacity="0.06" stroke="#3b82f6" strokeWidth="2"/>}
              {poly.length>=2&&<polyline points={poly.map(p=>p.join(',')).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2"/>}

              {/* Canlı çizgi */}
              {drawing&&cur&&poly.length>0&&!dimVal&&(()=>{
                const l=poly[poly.length-1],d=dist(cur.x,cur.y,l[0],l[1])/sc;
                const mx=(l[0]+cur.x)/2,my=(l[1]+cur.y)/2;
                return(<>
                  <line x1={l[0]} y1={l[1]} x2={cur.x} y2={cur.y} stroke={cur.sn?'#10b981':'#3b82f6'} strokeWidth="1.5" strokeDasharray="6,3"/>
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
                const isFst=i===0,isClose=drawing&&isFst&&poly.length>=3&&cur&&dist(cur.x,cur.y,p[0],p[1])<18;
                return(<g key={i}>
                  <circle cx={p[0]} cy={p[1]} r={isClose?12:mod==='edit'?8:5}
                    fill={isFst?(drawing?'#10b981':'#3b82f6'):mod==='edit'?'#f59e0b':'#3b82f6'}
                    stroke="white" strokeWidth="2" className={mod==='edit'?'cursor-grab':''}/>
                  {mod==='edit'&&(()=>{
                    const q=poly[(i+1)%poly.length];
                    return<circle cx={(p[0]+q[0])/2} cy={(p[1]+q[1])/2} r={4} fill="#94a3b8" stroke="white" strokeWidth="1.5" opacity="0.6" className="cursor-pointer"/>;
                  })()}
                </g>);
              })}

              {/* Engeller */}
              {obstacles.map(o=>(
                <g key={o.id} className={mod==='edit'?'cursor-grab':''}>
                  <rect x={o.x*sc} y={o.y*sc} width={o.w*sc} height={o.h*sc} fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1.5"/>
                  <line x1={o.x*sc} y1={o.y*sc} x2={(o.x+o.w)*sc} y2={(o.y+o.h)*sc} stroke="#ef4444" strokeWidth="1" opacity="0.3"/>
                  <line x1={(o.x+o.w)*sc} y1={o.y*sc} x2={o.x*sc} y2={(o.y+o.h)*sc} stroke="#ef4444" strokeWidth="1" opacity="0.3"/>
                  <text x={(o.x+o.w/2)*sc} y={(o.y+o.h/2)*sc+3} textAnchor="middle" fontSize="8" fill="#991b1b" fontWeight="bold">{o.w.toFixed(1)}×{o.h.toFixed(1)}m</text>
                  <g onClick={e=>{e.stopPropagation();setObst(a=>a.filter(x=>x.id!==o.id));}}>
                    <circle cx={(o.x+o.w)*sc} cy={o.y*sc} r={7} fill="#ef4444" className="cursor-pointer"/>
                    <text x={(o.x+o.w)*sc} y={o.y*sc+4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text>
                  </g>
                </g>
              ))}

              {/* Palette önizleme */}
              {dragging==='obs'&&palPos&&(
                <rect x={palPos.x-newObs.w*sc/2} y={palPos.y-newObs.h*sc/2}
                  width={newObs.w*sc} height={newObs.h*sc}
                  fill="#ef4444" fillOpacity="0.25" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" rx="3"/>
              )}
              {dragging==='str'&&palPos&&(()=>{
                const bw=blkW(newStr),bh=blkH(newStr);
                return(<g opacity="0.65">
                  <rect x={palPos.x-bw/2} y={palPos.y-bh/2} width={bw} height={bh}
                    fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4,2" rx="3"/>
                  <text x={palPos.x} y={palPos.y+4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e40af">{newStr.rows}×{newStr.cols}</text>
                </g>);
              })()}

              {/* Ruler */}
              {rulerPts.length>=1&&(()=>{
                const a=rulerPts[0],b=rulerPts.length>=2?rulerPts[1]:rulerCur;
                if(!b)return null;
                const dx=Math.abs(b.x-a.x)/sc,dy=Math.abs(b.y-a.y)/sc;
                const mn=(dx+dy).toFixed(2),st=Math.sqrt(dx*dx+dy*dy).toFixed(2);
                const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
                return(<g>
                  <polyline points={`${a.x},${a.y} ${b.x},${a.y} ${b.x},${b.y}`} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,3"/>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity="0.35"/>
                  <circle cx={a.x} cy={a.y} r={5} fill="#10b981" stroke="white" strokeWidth="2"/>
                  <circle cx={b.x} cy={b.y} r={5} fill="#10b981" stroke="white" strokeWidth="2"/>
                  <rect x={mx-42} y={my-24} width={84} height={26} rx={5} fill="#10b981" opacity="0.95"/>
                  <text x={mx} y={my-10} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">📏 {mn}m (köşeli)</text>
                  <text x={mx} y={my+3} textAnchor="middle" fontSize="8" fill="white" opacity="0.85">kuş uçuşu: {st}m</text>
                </g>);
              })()}

              {/* Kablo güzergah waypoint'leri */}
              {markedPts.length>=1&&waypoints.length>0&&(()=>{
                const inv=inverters[0];
                const aWps=waypoints.filter(w=>w.side==='a');
                const bWps=waypoints.filter(w=>w.side==='b');
                return(<>
                  {aWps.length>0&&markedPts[0]&&inv&&(()=>{
                    const chain=[markedPts[0],...aWps,inv];
                    const pts=chain.map(p=>`${p.x},${p.y}`).join(' ');
                    return<polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="none" opacity="0.8"/>;
                  })()}
                  {bWps.length>0&&markedPts[1]&&inv&&(()=>{
                    const chain=[markedPts[1],...bWps,inv];
                    const pts=chain.map(p=>`${p.x},${p.y}`).join(' ');
                    return<polyline points={pts} fill="none" stroke="#db2777" strokeWidth="2" strokeDasharray="none" opacity="0.8"/>;
                  })()}
                  {waypoints.map((w,i)=>(
                    <circle key={i} cx={w.x} cy={w.y} r={5}
                      fill={w.side==='a'?'#7c3aed':'#db2777'} stroke="white" strokeWidth="1.5"/>
                  ))}
                </>);
              })()}

              {/* Kablo ölçüm noktaları */}
              {markedPts.map((p,i)=>(
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={10} fill={i===0?'#7c3aed':'#db2777'} stroke="white" strokeWidth="2.5"/>
                  <text x={p.x} y={p.y+4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">{i===0?'A':'B'}</text>
                  {inverters.length>0&&(()=>{
                    const inv=inverters[0];
                    return<polyline points={`${p.x},${p.y} ${inv.x},${p.y} ${inv.x},${inv.y}`}
                      fill="none" stroke={i===0?'#7c3aed':'#db2777'} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.7"/>;
                  })()}
                </g>
              ))}

              {/* Kablo sonuç kutusu */}
              {cableResult&&markedPts.length===2&&(()=>{
                const cx=(markedPts[0].x+markedPts[1].x)/2;
                const cy=Math.min(markedPts[0].y,markedPts[1].y)-65;
                return(<g>
                  <rect x={cx-72} y={cy} width={144} height={54} rx={8} fill="#4f46e5" opacity="0.95"/>
                  <text x={cx} y={cy+15} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">🔌 DC Kablo Mesafesi</text>
                  <text x={cx} y={cy+28} textAnchor="middle" fontSize="8" fill="white" opacity="0.9">A→İnv: {cableResult.da}m · B→İnv: {cableResult.db}m</text>
                  <text x={cx} y={cy+44} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fbbf24">Toplam: {cableResult.total} m</text>
                </g>);
              })()}

              {/* İnverterler */}
              {inverters.map((iv,ii)=>(
                <g key={iv.id} transform={`translate(${iv.x},${iv.y})`}>
                  <circle cx="0" cy="0" r="14" fill="#f59e0b" stroke="white" strokeWidth="2.5"/>
                  <text x="0" y="5" textAnchor="middle" fontSize="13">⚡</text>
                  <text x="18" y="4" fontSize="9" fontWeight="bold" fill="#92400e">İNV{ii+1}</text>
                  <g onClick={e=>{e.stopPropagation();setInverters(ivs=>ivs.filter(x=>x.id!==iv.id));}}>
                    <circle cx="14" cy="-10" r="6" fill="#ef4444" className="cursor-pointer"/>
                    <text x="14" y="-7" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">✕</text>
                  </g>
                </g>
              ))}

              {/* String bağlantı çizgileri (view modu) */}
              {mod==='view'&&inverters.length>0&&strBlocks.map((b,bi)=>{
                const col=COLS[bi%COLS.length];
                return<line key={b.id}
                  x1={b.x+blkW(b)/2} y1={b.y+blkH(b)/2}
                  x2={inverters[0].x} y2={inverters[0].y}
                  stroke={col} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.6"/>;
              })}

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
            <div className="bg-white p-4 rounded-xl border">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">String Özeti</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {strBlocks.map((b,bi)=>{
                  const col=COLS[bi%COLS.length],label=fmtStr(b.invIdx,b.strIdx,nInv);
                  return(<div key={b.id} className="rounded-xl border-2 px-3 py-2" style={{borderColor:col,background:col+'15'}}>
                    <div className="font-black text-sm" style={{color:col}}>String {label}</div>
                    <div className="font-mono text-xs text-slate-600">{b.rows}×{b.cols} = {b.rows*b.cols} panel</div>
                  </div>);
                })}
              </div>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                Toplam: <b>{totalPanels} panel</b> · {strBlocks.length} string · Numaralama: {nInv===1?'INV.Str (1.1, 1.2)':'INV.MPPT.Str (1.1.1, 1.2.1)'}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* DXF Entity Seçim Modalı */}
      {dxfModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-slate-700 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <div className="font-black">DXF Dosyası Okundu</div>
                <div className="text-xs text-slate-300 mt-0.5">{dxfEntities.length} adet kapalı polyline bulundu</div>
              </div>
              <button onClick={()=>{setDxfModal(false);setDxfEntities([]);}}
                className="bg-white/20 hover:bg-white/30 rounded-lg p-1.5 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">Çatı hattı olarak kullanmak istediğiniz polyline'ı seçin:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {dxfEntities.map((e,i)=>{
                  const xs=e.pts.map(p=>p[0]),ys=e.pts.map(p=>p[1]);
                  const w=(Math.max(...xs)-Math.min(...xs)).toFixed(2);
                  const h=(Math.max(...ys)-Math.min(...ys)).toFixed(2);
                  return(
                    <button key={i} onClick={()=>setDxfSel(i)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${dxfSel===i?'bg-blue-50 border-blue-500':'border-slate-200 hover:border-blue-300'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm text-slate-700">{e.type}</span>
                          <span className="ml-2 text-xs text-slate-400">Katman: {e.layer}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs font-bold text-blue-700">{w} × {h} m</div>
                          <div className="text-[10px] text-slate-400">{e.pts.length} köşe</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={()=>{setDxfModal(false);setDxfEntities([]);}}
                  className="flex-1 border-2 border-slate-200 text-slate-500 font-bold py-3 rounded-xl text-sm hover:border-slate-300 transition-all">
                  İptal
                </button>
                <button onClick={applyDxf} disabled={dxfSel===null}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-black py-3 rounded-xl text-sm transition-all">
                  Canvas'a Uygula →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
