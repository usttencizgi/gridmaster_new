import { useState, useRef, useEffect } from 'react';

function ptInPoly(px,py,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}
function dist(ax,ay,bx,by){return Math.sqrt((ax-bx)**2+(ay-by)**2);}
function snapAngle(x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,ang=Math.atan2(dy,dx)*180/Math.PI;
  const snaps=[0,90,-90,180,-180,45,-45,135,-135];
  const near=snaps.reduce((b,a)=>Math.abs(a-ang)<Math.abs(b-ang)?a:b);
  if(Math.abs(near-ang)<8){const r=near*Math.PI/180,l=Math.sqrt(dx*dx+dy*dy);return[x1+l*Math.cos(r),y1+l*Math.sin(r),true];}
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
function placePanels(poly,obs,pw,ph,rg,cg,sb,sc){
  if(poly.length<3)return[];
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pW=pw*sc,pH=ph*sc,rG=rg*sc,cG=cg*sc,sbP=sb*sc;
  const ins=sbP>0?insetPoly(poly,sbP):poly;
  const out=[];
  for(let y=minY+sbP;y+pH<=maxY-sbP+1;y+=pH+rG){
    for(let x=minX+sbP;x+pW<=maxX-sbP+1;x+=pW+cG){
      if(![[x,y],[x+pW,y],[x+pW,y+pH],[x,y+pH]].every(([cx,cy])=>ptInPoly(cx,cy,ins)))continue;
      if(obs.some(o=>rectsOverlap(x,y,pW,pH,o.x*sc,o.y*sc,o.w*sc,o.h*sc)))continue;
      out.push({x,y,w:pW,h:pH});
    }
  }
  return out;
}
function assignStr(panels,inv,pps){
  if(!panels.length)return[];
  return[...panels].sort((a,b)=>dist(a.x+a.w/2,a.y+a.h/2,inv.x,inv.y)-dist(b.x+b.w/2,b.y+b.h/2,inv.x,inv.y))
    .map((p,i)=>({...p,si:Math.floor(i/pps)+1}));
}
const COLS=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];

export default function CatiTasarim(){
  const SW=760,SH=520;
  const [sc,setSc]=useState(25);
  const [poly,setPoly]=useState([]);
  const [drawing,setDrawing]=useState(false);
  const [cur,setCur]=useState(null);
  const [dimVal,setDimVal]=useState('');
  const [obs,setObs]=useState([]);
  const [obsS,setObsS]=useState(null);
  const [obsC,setObsC]=useState(null);
  const [dragI,setDragI]=useState(null);
  const [inv,setInv]=useState(null);
  const [vOff,setVOff]=useState(0);
  const [pW,setPW]=useState(1.13);
  const [pH,setPH]=useState(2.28);
  const [or,setOr]=useState('portrait');
  const [rg,setRg]=useState(0.05);
  const [cg,setCg]=useState(0.02);
  const [sb,setSb]=useState(0.5);
  const [pps,setPps]=useState(12);
  const [panels,setPanels]=useState([]);
  const [mod,setMod]=useState('draw');
  const svgRef=useRef(null);
  const dimRef=useRef(null);

  const getSpt=e=>{
    const r=svgRef.current?.getBoundingClientRect();
    if(!r)return{x:0,y:0};
    return{x:(e.clientX-r.left)*(SW/r.width),y:(e.clientY-r.top)*(SH/r.height)};
  };
  const getSnap=(rawX,rawY)=>{
    if(!poly.length)return{x:rawX,y:rawY,sn:false};
    const l=poly[poly.length-1];
    const[sx,sy,sn]=snapAngle(l[0],l[1],rawX,rawY);
    return{x:sx,y:sy,sn};
  };

  useEffect(()=>{
    const h=e=>{
      if(e.key==='Escape'){setDrawing(false);setPoly([]);setCur(null);setDimVal('');}
      if(e.key==='Enter'&&mod==='draw'&&drawing&&poly.length>=3){setDrawing(false);setCur(null);setDimVal('');setPanels([]);}
    };
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[mod,drawing,poly]);

  const onMM=e=>{
    const pt=getSpt(e);
    if(mod==='draw'&&drawing&&!dimVal){const s=getSnap(pt.x,pt.y);setCur(s);}
    if(mod==='edit'&&dragI!==null){setPoly(p=>p.map((v,i)=>i===dragI?[pt.x,pt.y]:v));setPanels([]);}
    if(mod==='obstacle'&&obsS){
      const x=Math.min(pt.x,obsS.x),y=Math.min(pt.y,obsS.y);
      setObsC({x:x/sc,y:y/sc,w:Math.abs(pt.x-obsS.x)/sc,h:Math.abs(pt.y-obsS.y)/sc});
    }
  };
  const onMD=e=>{
    const pt=getSpt(e);
    if(mod==='edit'){
      const near=poly.reduce((b,v,i)=>{const d=dist(pt.x,pt.y,v[0],v[1]);return d<b.d?{i,d}:b},{i:-1,d:Infinity});
      if(near.d<16){setDragI(near.i);return;}
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
        if(dist(pt.x,pt.y,mx,my)<16){const np=[...poly];np.splice(i+1,0,[pt.x,pt.y]);setPoly(np);setPanels([]);setDragI(i+1);return;}
      }
    }
    if(mod==='obstacle')setObsS({x:pt.x,y:pt.y});
    if(mod==='inverter')setInv({x:pt.x,y:pt.y});
  };
  const onMU=()=>{
    if(mod==='edit')setDragI(null);
    if(mod==='obstacle'&&obsC&&obsC.w>0.1&&obsC.h>0.1){setObs(o=>[...o,{...obsC,id:Date.now()}]);}
    setObsS(null);setObsC(null);
  };
  const onClick=e=>{
    if(mod!=='draw')return;
    const pt=getSpt(e);
    if(!drawing){setPoly([[pt.x,pt.y]]);setDrawing(true);setCur({x:pt.x,y:pt.y,sn:false});setPanels([]);return;}
    if(poly.length>=3&&dist(pt.x,pt.y,poly[0][0],poly[0][1])<18){setDrawing(false);setCur(null);setDimVal('');setPanels([]);return;}
    const s=getSnap(pt.x,pt.y);
    setPoly(p=>[...p,[s.x,s.y]]);
  };
  const onDbl=()=>{if(mod==='draw'&&drawing&&poly.length>=3){setDrawing(false);setCur(null);setPanels([]);}};

  const commitDim=()=>{
    const d=parseFloat(dimVal);
    if(isNaN(d)||d<=0||!cur||!poly.length)return;
    const l=poly[poly.length-1],dx=cur.x-l[0],dy=cur.y-l[1],len=Math.sqrt(dx*dx+dy*dy)||1;
    setPoly(p=>[...p,[l[0]+dx/len*d*sc,l[1]+dy/len*d*sc]]);
    setDimVal('');
  };

  const fill=()=>{
    if(poly.length<3)return;
    const pw=or==='portrait'?pW:pH,ph=or==='portrait'?pH:pW;
    const raw=placePanels(poly,obs,pw,ph,rg,cg,sb,sc);
    setPanels(inv?assignStr(raw,inv,pps):raw.map((p,i)=>({...p,si:Math.floor(i/pps)+1})));
  };
  const reset=()=>{setPoly([]);setDrawing(false);setCur(null);setDimVal('');setObs([]);setObsS(null);setObsC(null);setInv(null);setPanels([]);};

  const edges=poly.map((p,i)=>{const q=poly[(i+1)%poly.length];return{mid:[(p[0]+q[0])/2,(p[1]+q[1])/2],len:dist(p[0],p[1],q[0],q[1])/sc};});
  const area=poly.length>=3?(()=>{let a=0;poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length];a+=(p[0]*q[1]-q[0]*p[1]);});return Math.abs(a)/2/(sc*sc);})():0;
  const total=panels.length,nStr=panels.length?Math.max(...panels.map(p=>p.si)):0;
  const cables=Array.from({length:nStr},(_,i)=>i+1).map(si=>{
    const ps=panels.filter(p=>p.si===si);
    const cl=ps.reduce((b,p)=>{if(!inv)return{d:0,x:0,y:0};const d=dist(p.x+p.w/2,p.y+p.h/2,inv.x,inv.y);return d<b.d?{d,x:p.x+p.w/2,y:p.y+p.h/2}:b},{d:Infinity,x:0,y:0});
    const h=inv?cl.d/sc:0,t=Math.sqrt(h**2+vOff**2);
    return{si,cnt:ps.length,h:h.toFixed(1),t:t.toFixed(1)};
  });

  const mbtn=(m,ic,lb,c='slate')=>(
    <button onClick={()=>setMod(m)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all whitespace-nowrap
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
            <p className="text-sky-100 text-sm">Poligon çiz · Köşe ekle/düzenle · Engel çiz · Panelleri doldur</p>
          </div>
        </div>
        <div className="text-right text-white">
          <div className="text-2xl font-black">{total}</div>
          <div className="text-xs text-sky-200">{nStr} string · {area.toFixed(1)} m²</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Araç</div>
            <div className="flex flex-col gap-1.5">
              {mbtn('draw',    '✏️','Çatı Çiz (tıkla)','blue')}
              {mbtn('edit',    '↗️','Köşe Düzenle / Ekle','amber')}
              {mbtn('obstacle','⬛','Engel Çiz','red')}
              {mbtn('inverter','⚡','İnverter Ekle','yellow')}
              {mbtn('view',    '👁️','İncele','slate')}
            </div>
            <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-[10px] text-slate-500 leading-relaxed">
              {mod==='draw'&&<><b>Tıkla</b> → nokta · <b>Çift tıkla/Enter</b> → kapat · <b>Esc</b> → iptal<br/><b>Mesafe yaz + Enter</b> → tam uzunluklu kenar</>}
              {mod==='edit'&&<><b>Köşe sürükle</b> → şekli değiştir<br/><b>Kenar ortasına tıkla</b> → yeni köşe ekle</>}
              {mod==='obstacle'&&'Çatı üzerinde sürükleyerek engel çiz'}
              {mod==='inverter'&&(inv?'Yeni konuma tıkla':'İnverter konumuna tıkla')}
              {mod==='view'&&'String bağlantı hatlarını gör'}
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
              {[['En (m)',pW,setPW,0.01],['Boy (m)',pH,setPH,0.01],['Satır Aralığı',rg,setRg,0.05],['Sütun Aralığı',cg,setCg,0.01],['Kenar Payı',sb,setSb,0.1],['Panel/String',pps,setPps,1]].map(([l,v,f,s])=>(
                <div key={l}>
                  <label className="text-[10px] text-slate-400 block mb-0.5">{l}</label>
                  <input type="number" value={v} step={s} min={0} onChange={e=>f(+e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Dikey Mesafe (m)</div>
            <input type="number" value={vOff} step={1} min={0} onChange={e=>setVOff(+e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:border-amber-400 outline-none"/>
            <div className="text-[10px] font-bold text-slate-400 uppercase mt-2 mb-1.5">Ölçek ({sc} px/m)</div>
            <input type="range" min={8} max={80} step={2} value={sc}
              onChange={e=>{setSc(+e.target.value);setPanels([]);}} className="w-full accent-sky-500"/>
          </div>

          <div className="space-y-2">
            <button onClick={fill} disabled={poly.length<3}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-black py-3 rounded-xl text-sm transition-all">
              ☀ Panelleri Yerleştir
            </button>
            {obs.length>0&&<button onClick={()=>{setObs([]);setPanels([]);}}
              className="w-full border-2 border-red-200 text-red-400 hover:bg-red-50 font-bold py-2 rounded-xl text-xs">Engelleri Temizle</button>}
            <button onClick={reset}
              className="w-full border-2 border-slate-200 text-slate-400 hover:border-slate-400 font-bold py-2 rounded-xl text-xs">Hepsini Sıfırla</button>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-3">
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
              <span className="font-mono text-slate-500">{area.toFixed(1)} m²</span>
              <span className="text-slate-300">|</span>
              <span className="text-blue-600 font-bold">{poly.length} köşe</span>
              <span className="text-slate-300">|</span>
              <span className="text-sky-600 font-bold">{total} panel</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-600 font-bold">{nStr} string</span>
              {drawing&&<><span className="text-slate-300">|</span><span className="text-blue-500 font-bold animate-pulse">● Çiziliyor</span></>}
            </div>

            {drawing&&mod==='draw'&&(
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-3">
                <span className="text-xs text-blue-700 font-bold">Mesafe (m):</span>
                <input ref={dimRef} type="text" value={dimVal} placeholder="5.5"
                  onChange={e=>setDimVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')commitDim();if(e.key==='Escape')setDimVal('');}}
                  className="border-2 border-blue-300 rounded-lg px-3 py-1 text-sm font-mono w-28 focus:border-blue-500 outline-none bg-white"/>
                <button onClick={commitDim} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold">↵</button>
                {cur&&poly.length>0&&(()=>{
                  const l=poly[poly.length-1];
                  const d=dist(cur.x,cur.y,l[0],l[1])/sc;
                  const ang=Math.atan2(cur.y-l[1],cur.x-l[0])*180/Math.PI;
                  return<span className="text-[10px] text-blue-500">{d.toFixed(2)}m · {ang.toFixed(0)}°{cur.sn?' 🧲':''}</span>;
                })()}
              </div>
            )}

            <svg ref={svgRef} width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`}
              className="w-full select-none"
              style={{background:'#f1f5f9',cursor:mod==='draw'||mod==='obstacle'||mod==='inverter'?'crosshair':'default'}}
              onClick={onClick} onMouseMove={onMM} onMouseDown={onMD} onMouseUp={onMU} onDoubleClick={onDbl}>

              {Array.from({length:Math.ceil(SW/sc)+1},(_,i)=>i).map(i=>(
                <line key={`v${i}`} x1={i*sc} y1={0} x2={i*sc} y2={SH} stroke="#e2e8f0" strokeWidth={i%5===0?0.7:0.3}/>
              ))}
              {Array.from({length:Math.ceil(SH/sc)+1},(_,i)=>i).map(i=>(
                <line key={`h${i}`} x1={0} y1={i*sc} x2={SW} y2={i*sc} stroke="#e2e8f0" strokeWidth={i%5===0?0.7:0.3}/>
              ))}

              {panels.map((p,i)=>{
                const col=COLS[(p.si-1)%COLS.length];
                return(<g key={i}>
                  <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={col} fillOpacity="0.5" stroke={col} strokeWidth="0.6"/>
                  {p.w>14&&p.h>9&&<text x={p.x+p.w/2} y={p.y+p.h/2+3} textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">{p.si}</text>}
                </g>);
              })}

              {poly.length>=3&&<polygon points={poly.map(p=>p.join(',')).join(' ')} fill="#3b82f6" fillOpacity="0.07" stroke="#3b82f6" strokeWidth="2"/>}
              {poly.length>=2&&<polyline points={poly.map(p=>p.join(',')).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2"/>}

              {drawing&&cur&&poly.length>0&&!dimVal&&(()=>{
                const l=poly[poly.length-1];
                const d=dist(cur.x,cur.y,l[0],l[1])/sc;
                const mx=(l[0]+cur.x)/2,my=(l[1]+cur.y)/2;
                return(<>
                  <line x1={l[0]} y1={l[1]} x2={cur.x} y2={cur.y}
                    stroke={cur.sn?'#10b981':'#3b82f6'} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.7"/>
                  <rect x={mx-20} y={my-14} width={40} height={16} rx={4}
                    fill={cur.sn?'#10b981':'#3b82f6'} opacity="0.85"/>
                  <text x={mx} y={my-3} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">{d.toFixed(2)}m</text>
                </>);
              })()}

              {!drawing&&poly.length>=3&&edges.map((e,i)=>(
                <g key={i}>
                  <rect x={e.mid[0]-22} y={e.mid[1]-11} width={44} height={15} rx={4} fill="white" opacity="0.9"/>
                  <text x={e.mid[0]} y={e.mid[1]+1} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1e40af">{e.len.toFixed(2)}m</text>
                </g>
              ))}

              {poly.map((p,i)=>{
                const isFirst=i===0;
                const isClose=drawing&&isFirst&&poly.length>=3&&cur&&dist(cur.x,cur.y,p[0],p[1])<18;
                return(<g key={i}>
                  <circle cx={p[0]} cy={p[1]} r={isClose?12:mod==='edit'?8:5}
                    fill={isFirst?(drawing?'#10b981':'#3b82f6'):mod==='edit'?'#f59e0b':'#3b82f6'}
                    stroke="white" strokeWidth="2" className={mod==='edit'?'cursor-grab':''}/>
                  {mod==='edit'&&(()=>{
                    const q=poly[(i+1)%poly.length];
                    return<circle cx={(p[0]+q[0])/2} cy={(p[1]+q[1])/2} r={5}
                      fill="#94a3b8" stroke="white" strokeWidth="1.5" opacity="0.7" className="cursor-pointer"/>;
                  })()}
                </g>);
              })}

              {obs.map(o=>(
                <g key={o.id}>
                  <rect x={o.x*sc} y={o.y*sc} width={o.w*sc} height={o.h*sc} fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1.5"/>
                  <line x1={o.x*sc} y1={o.y*sc} x2={(o.x+o.w)*sc} y2={(o.y+o.h)*sc} stroke="#ef4444" strokeWidth="1" opacity="0.3"/>
                  <line x1={(o.x+o.w)*sc} y1={o.y*sc} x2={o.x*sc} y2={(o.y+o.h)*sc} stroke="#ef4444" strokeWidth="1" opacity="0.3"/>
                  <text x={(o.x+o.w/2)*sc} y={(o.y+o.h/2)*sc+3} textAnchor="middle" fontSize="8" fill="#991b1b" fontWeight="bold">{o.w.toFixed(1)}×{o.h.toFixed(1)}m</text>
                  <g onClick={e=>{e.stopPropagation();setObs(a=>a.filter(x=>x.id!==o.id));setPanels([]);}}>
                    <circle cx={(o.x+o.w)*sc} cy={o.y*sc} r={8} fill="#ef4444" className="cursor-pointer"/>
                    <text x={(o.x+o.w)*sc} y={o.y*sc+4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text>
                  </g>
                </g>
              ))}
              {obsC&&<rect x={obsC.x*sc} y={obsC.y*sc} width={obsC.w*sc} height={obsC.h*sc} fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2"/>}

              {inv&&<g transform={`translate(${inv.x},${inv.y})`}>
                <circle cx="0" cy="0" r="14" fill="#f59e0b" stroke="white" strokeWidth="2.5"/>
                <text x="0" y="5" textAnchor="middle" fontSize="14">⚡</text>
              </g>}

              {mod==='view'&&inv&&(()=>{
                const seen=new Set();
                return panels.map((p,i)=>{
                  if(seen.has(p.si))return null;seen.add(p.si);
                  const col=COLS[(p.si-1)%COLS.length];
                  const ps=panels.filter(x=>x.si===p.si);
                  const cl=ps.reduce((b,x)=>{const d=dist(x.x+x.w/2,x.y+x.h/2,inv.x,inv.y);return d<b.d?{d,x:x.x+x.w/2,y:x.y+x.h/2}:b},{d:Infinity,x:0,y:0});
                  return<line key={i} x1={cl.x} y1={cl.y} x2={inv.x} y2={inv.y} stroke={col} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.6"/>;
                });
              })()}

              <g transform={`translate(${SW-140},${SH-22})`}>
                <line x1="0" y1="7" x2={5*sc} y2="7" stroke="#475569" strokeWidth="2"/>
                <line x1="0" y1="3" x2="0" y2="11" stroke="#475569" strokeWidth="2"/>
                <line x1={5*sc} y1="3" x2={5*sc} y2="11" stroke="#475569" strokeWidth="2"/>
                <text x={5*sc/2} y="20" textAnchor="middle" fontSize="9" fill="#475569">5 m</text>
              </g>
            </svg>
          </div>

          {total>0&&(
            <div className="bg-white p-4 rounded-xl border">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">String Kablo Mesafeleri</div>
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50">
                  {['String','Panel','Yatay (m)','Toplam (m)','Kablo ×2 (m)'].map(h=>(
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {cables.map(s=>(
                    <tr key={s.si}>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{background:COLS[(s.si-1)%COLS.length]}}/><b>{s.si}</b>
                      </span></td>
                      <td className="px-3 py-2 font-mono">{s.cnt}</td>
                      <td className="px-3 py-2 font-mono">{s.h}</td>
                      <td className="px-3 py-2 font-mono font-bold text-sky-700">{s.t}</td>
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700">{(+s.t*2).toFixed(1)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-3 py-2">Toplam</td><td className="px-3 py-2 font-mono">{total}</td>
                    <td className="px-3 py-2">—</td><td className="px-3 py-2">—</td>
                    <td className="px-3 py-2 font-mono text-emerald-700">{cables.reduce((s,c)=>s+parseFloat(c.t)*2,0).toFixed(1)} m</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-1.5">Dikey {vOff}m dahil</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
