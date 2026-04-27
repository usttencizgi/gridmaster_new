import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Geometri ─────────────────────────────────────────────────────
function ptInPoly(px, py, poly) {
  let inside = false;
  for (let i=0,j=poly.length-1; i<poly.length; j=i++) {
    const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    if (((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}

function rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh) {
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}

function insetRect(pts, d) {
  // pts: [[x,y],...] — dikdörtgen köşeleri CCW/CW
  // Basit: her noktayı merkeze doğru d kadar çek
  const cx = pts.reduce((s,p)=>s+p[0],0)/pts.length;
  const cy = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  return pts.map(([x,y]) => {
    const dx=cx-x, dy=cy-y, len=Math.sqrt(dx*dx+dy*dy)||1;
    return [x+dx/len*d, y+dy/len*d];
  });
}

function ptDist(ax,ay,bx,by){ return Math.sqrt((ax-bx)**2+(ay-by)**2); }

// Panel yerleşim algoritması
function placePanels(roofPts, obstacles, pw, ph, rowGap, colGap, setback, scale) {
  if (roofPts.length < 3) return [];

  // Bounding box
  const xs = roofPts.map(p=>p[0]), ys = roofPts.map(p=>p[1]);
  const minX=Math.min(...xs), maxX=Math.max(...xs);
  const minY=Math.min(...ys), maxY=Math.max(...ys);

  // Panel boyutları px cinsinden
  const pxW = pw * scale, pxH = ph * scale;
  const rxG  = rowGap * scale, cxG = colGap * scale;
  const sb   = setback * scale;

  // İçe kaydırılmış polygon
  const inset = insetRect(roofPts, sb);

  const panels = [];
  let row = 0;
  for (let y = minY + sb; y + pxH <= maxY - sb + 1; y += pxH + rxG, row++) {
    let col = 0;
    for (let x = minX + sb; x + pxW <= maxX - sb + 1; x += pxW + cxG, col++) {
      // 4 köşenin hepsi polygon içinde mi?
      const corners = [[x,y],[x+pxW,y],[x+pxW,y+pxH],[x,y+pxH]];
      const allIn = corners.every(([cx,cy]) => ptInPoly(cx,cy,inset));
      if (!allIn) continue;

      // Engel çakışması
      const blocked = obstacles.some(o =>
        rectsOverlap(x,y,pxW,pxH, o.x*scale,o.y*scale,o.w*scale,o.h*scale)
      );
      if (blocked) continue;

      panels.push({ x, y, w:pxW, h:pxH, row, col });
    }
  }
  return panels;
}

// String atama: inverter'a uzaklık sıralı
function assignStrings(panels, invPx, pps) {
  if (!panels.length) return [];
  const sorted = [...panels].sort((a,b)=>{
    const da = ptDist(a.x+a.w/2,a.y+a.h/2,invPx.x,invPx.y);
    const db = ptDist(b.x+b.w/2,b.y+b.h/2,invPx.x,invPx.y);
    return da-db;
  });
  return sorted.map((p,i)=>({...p, strIdx:Math.floor(i/pps)+1}));
}

const STR_COLORS=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];

// ─── ANA BİLEŞEN ──────────────────────────────────────────────────
export default function CatiTasarim() {
  const SVG_W=720, SVG_H=500;

  // Çatı boyutları (gerçek metre)
  const [roofW,  setRoofW]  = useState(15);
  const [roofH,  setRoofH]  = useState(10);
  const [margin, setMargin] = useState(30); // SVG kenar boşluğu px

  // Scale: SVG'ye sığacak şekilde otomatik
  const scale = Math.min((SVG_W-margin*2)/roofW, (SVG_H-margin*2)/roofH);

  // Çatı köşeleri — SVG piksel cinsinden
  // Başlangıç: dikdörtgen
  const initRoof = useCallback((w,h,m,s) => [
    [m, m],
    [m+w*s, m],
    [m+w*s, m+h*s],
    [m, m+h*s],
  ],[]);

  const [roofPts, setRoofPts] = useState(()=>initRoof(15,10,30,Math.min((720-60)/15,(500-60)/10)));
  const [dragPt,  setDragPt]  = useState(null); // köşe sürükleme indeksi

  // Engeller (metre cinsinden)
  const [obstacles,  setObstacles]  = useState([]);
  const [drawingObs, setDrawingObs] = useState(null);
  const [startObs,   setStartObs]   = useState(null);

  // İnverter konumu (piksel)
  const [invPos, setInvPos] = useState({x:SVG_W-60,y:SVG_H/2});
  const [vertOff, setVertOff] = useState(0); // m

  // Panel ayarları
  const [panelW,    setPW]  = useState(1.13);
  const [panelH,    setPH]  = useState(2.28);
  const [orient,    setOr]  = useState('portrait');
  const [rowGap,    setRG]  = useState(0.05);
  const [colGap,    setCG]  = useState(0.02);
  const [setback,   setSB]  = useState(0.5);
  const [pps,       setPPS] = useState(12);

  // Paneller
  const [panels, setPanels] = useState([]);

  // Mod: 'view' | 'corner' | 'obstacle' | 'inverter'
  const [mod, setMod] = useState('view');

  const svgRef = useRef(null);

  // SVG koordinatı al
  const getSvgPt = e => {
    const svg = svgRef.current;
    if (!svg) return {x:0,y:0};
    const r = svg.getBoundingClientRect();
    return { x:(e.clientX-r.left)*(SVG_W/r.width), y:(e.clientY-r.top)*(SVG_H/r.height) };
  };

  // Çatı boyutu değişince köşeleri sıfırla
  const applyRoof = () => {
    const s = Math.min((SVG_W-margin*2)/roofW, (SVG_H-margin*2)/roofH);
    setRoofPts(initRoof(roofW, roofH, margin, s));
    setPanels([]);
    setObstacles([]);
  };

  // Panelleri doldur
  const fillPanels = () => {
    const pw = orient==='portrait' ? panelW : panelH;
    const ph = orient==='portrait' ? panelH : panelW;
    const raw = placePanels(roofPts, obstacles, pw, ph, rowGap, colGap, setback, scale);
    const str = assignStrings(raw, invPos, pps);
    setPanels(str);
  };

  // Mouse olayları
  const onMouseDown = e => {
    const pt = getSvgPt(e);
    if (mod==='corner') {
      // En yakın köşeyi bul
      const nearest = roofPts.reduce((best,p,i)=>{
        const d=ptDist(pt.x,pt.y,p[0],p[1]);
        return d<best.d?{i,d}:best;
      },{i:-1,d:Infinity});
      if (nearest.d < 20) setDragPt(nearest.i);
    } else if (mod==='obstacle') {
      setStartObs({x:pt.x,y:pt.y});
      setDrawingObs(null);
    } else if (mod==='inverter') {
      setInvPos({x:pt.x,y:pt.y});
    }
  };

  const onMouseMove = e => {
    const pt = getSvgPt(e);
    if (mod==='corner' && dragPt!==null) {
      setRoofPts(pts=>pts.map((p,i)=>i===dragPt?[pt.x,pt.y]:p));
      setPanels([]);
    } else if (mod==='obstacle' && startObs) {
      const x=Math.min(pt.x,startObs.x), y=Math.min(pt.y,startObs.y);
      const w=Math.abs(pt.x-startObs.x), h=Math.abs(pt.y-startObs.y);
      setDrawingObs({x:x/scale,y:y/scale,w:w/scale,h:h/scale});
    }
  };

  const onMouseUp = e => {
    if (mod==='corner') setDragPt(null);
    if (mod==='obstacle' && drawingObs && drawingObs.w>0.1 && drawingObs.h>0.1) {
      setObstacles(o=>[...o, {...drawingObs, id:Date.now()}]);
      setDrawingObs(null); setStartObs(null);
    }
  };

  // Kenar boylarını metre cinsinden göster
  const edgeLengths = roofPts.map((p,i)=>{
    const q = roofPts[(i+1)%roofPts.length];
    const mid = [(p[0]+q[0])/2, (p[1]+q[1])/2];
    const len  = ptDist(p[0],p[1],q[0],q[1])/scale;
    return { mid, len };
  });

  const totalPanels = panels.length;
  const numStrings  = panels.length ? Math.max(...panels.map(p=>p.strIdx)) : 0;

  const strCables = Array.from({length:numStrings},(_,i)=>i+1).map(si=>{
    const ps = panels.filter(p=>p.strIdx===si);
    const closest = ps.reduce((b,p)=>{
      const d=ptDist(p.x+p.w/2,p.y+p.h/2,invPos.x,invPos.y);
      return d<b.d?{d,x:p.x+p.w/2,y:p.y+p.h/2}:b;
    },{d:Infinity,x:0,y:0});
    const horiz = closest.d/scale;
    const total = Math.sqrt(horiz**2+vertOff**2);
    return {si, count:ps.length, horiz:horiz.toFixed(1), total:total.toFixed(1)};
  });

  const roofArea = (() => {
    let a=0;
    roofPts.forEach((p,i)=>{
      const q=roofPts[(i+1)%roofPts.length];
      a+=(p[0]*q[1]-q[0]*p[1]);
    });
    return (Math.abs(a)/2)/(scale*scale);
  })();

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-5 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl text-2xl">🏠</div>
          <div>
            <h2 className="text-xl font-bold text-white">Çatı GES Tasarım Aracı</h2>
            <p className="text-sky-100 text-sm">Boyut gir → köşe sürükle → engel çiz → panelleri doldur</p>
          </div>
        </div>
        <div className="text-right text-white">
          <div className="text-2xl font-black">{totalPanels}</div>
          <div className="text-xs text-sky-200">{numStrings} string</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* SOL PANEL */}
        <div className="space-y-3">

          {/* Çatı boyutu */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">Çatı Boyutu</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Genişlik (m)</label>
                <input type="number" value={roofW} min="1" step="0.5"
                  onChange={e=>setRoofW(+e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:border-sky-400 outline-none"/>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Derinlik (m)</label>
                <input type="number" value={roofH} min="1" step="0.5"
                  onChange={e=>setRoofH(+e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:border-sky-400 outline-none"/>
              </div>
            </div>
            <button onClick={applyRoof}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-2 rounded-lg text-sm transition-all">
              Çatıyı Oluştur / Sıfırla
            </button>
          </div>

          {/* Mod seçici */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Araç</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['view',     '👁',  'İncele'],
                ['corner',   '↗',  'Köşe Sürükle'],
                ['obstacle', '⬛', 'Engel Çiz'],
                ['inverter', '⚡', 'İnverter Koy'],
              ].map(([m,ic,lb])=>(
                <button key={m} onClick={()=>setMod(m)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${mod===m?'bg-sky-50 border-sky-500 text-sky-700':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <span>{ic}</span>{lb}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              {mod==='corner'   && 'Sarı köşe noktalarını sürükleyerek şekli değiştir'}
              {mod==='obstacle' && 'Çatı üzerinde sürükleyerek engel çiz'}
              {mod==='inverter' && 'İnverter konumuna tıkla'}
              {mod==='view'     && 'Sonuçları incele, string hatlarını gör'}
            </div>
          </div>

          {/* Panel ayarları */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Panel Ayarları</div>
            <div className="flex gap-2 mb-3">
              {[['portrait','Dikey'],['landscape','Yatay']].map(([v,l])=>(
                <button key={v} onClick={()=>setOr(v)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${orient===v?'bg-sky-50 border-sky-500 text-sky-700':'border-slate-200 text-slate-500'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['En (m)',       panelW, setPW,  0.01],
                ['Boy (m)',      panelH, setPH,  0.01],
                ['Satır Aralığı',rowGap, setRG,  0.05],
                ['Sütun Aralığı',colGap, setCG,  0.01],
                ['Kenar Payı',  setback, setSB,  0.1 ],
                ['Panel/String', pps,   setPPS, 1   ],
              ].map(([label,val,fn,step])=>(
                <div key={label}>
                  <label className="text-[10px] text-slate-400 block mb-1">{label}</label>
                  <input type="number" value={val} step={step} min="0"
                    onChange={e=>fn(+e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/>
                </div>
              ))}
            </div>
          </div>

          {/* Dikey mesafe */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">İnverter Dikey Mesafesi</div>
            <input type="number" value={vertOff} step="1" min="0"
              onChange={e=>setVertOff(+e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:border-amber-400 outline-none"/>
            <div className="text-[10px] text-slate-400 mt-1">Kat farkı / dikey kablo mesafesi (m)</div>
          </div>

          {/* Doldur butonu */}
          <button onClick={fillPanels}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm transition-all">
            ☀ Panelleri Yerleştir
          </button>

          {/* Engelleri sil */}
          {obstacles.length > 0 && (
            <button onClick={()=>{setObstacles([]);setPanels([]);}}
              className="w-full border-2 border-red-200 text-red-500 hover:bg-red-50 font-bold py-2 rounded-xl text-xs transition-all">
              Engelleri Temizle
            </button>
          )}
        </div>

        {/* CANVAS */}
        <div className="xl:col-span-3 space-y-3">
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="bg-slate-50 border-b px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
              <span className="font-mono text-slate-500">{roofW}m × {roofH}m</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Alan: {roofArea.toFixed(1)} m²</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-sky-600">{totalPanels} panel</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-emerald-600">{numStrings} string</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">1px = {(1/scale).toFixed(3)} m</span>
            </div>

            <svg ref={svgRef}
              width={SVG_W} height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full select-none"
              style={{background:'#f1f5f9', cursor: mod==='corner'?'crosshair':mod==='obstacle'?'crosshair':mod==='inverter'?'crosshair':'default'}}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
            >
              {/* Grid 5m */}
              {Array.from({length:Math.ceil(SVG_W/scale/5)+2},(_,i)=>i).map(i=>(
                <line key={`vg${i}`} x1={margin+i*5*scale} y1={0} x2={margin+i*5*scale} y2={SVG_H}
                  stroke="#e2e8f0" strokeWidth="0.5"/>
              ))}
              {Array.from({length:Math.ceil(SVG_H/scale/5)+2},(_,i)=>i).map(i=>(
                <line key={`hg${i}`} x1={0} y1={margin+i*5*scale} x2={SVG_W} y2={margin+i*5*scale}
                  stroke="#e2e8f0" strokeWidth="0.5"/>
              ))}

              {/* Paneller */}
              {panels.map((p,i)=>{
                const col=STR_COLORS[(p.strIdx-1)%STR_COLORS.length];
                return (
                  <g key={i}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h}
                      fill={col} fillOpacity="0.5" stroke={col} strokeWidth="0.7"/>
                    {p.w>16&&p.h>10&&(
                      <text x={p.x+p.w/2} y={p.y+p.h/2+3} textAnchor="middle" fontSize="6.5"
                        fontWeight="bold" fill="white">{p.strIdx}</text>
                    )}
                  </g>
                );
              })}

              {/* Çatı polygon */}
              <polygon
                points={roofPts.map(p=>p.join(',')).join(' ')}
                fill="#3b82f6" fillOpacity="0.07"
                stroke="#3b82f6" strokeWidth="2" strokeDasharray="none"/>

              {/* Kenar uzunlukları */}
              {edgeLengths.map((e,i)=>(
                <g key={i}>
                  <text x={e.mid[0]} y={e.mid[1]} textAnchor="middle" fontSize="10"
                    fontWeight="bold" fill="#1e40af"
                    style={{textShadow:'0 0 3px white'}}>
                    {e.len.toFixed(2)}m
                  </text>
                </g>
              ))}

              {/* Köşe noktaları */}
              {roofPts.map((p,i)=>(
                <circle key={i} cx={p[0]} cy={p[1]} r={mod==='corner'?9:6}
                  fill={mod==='corner'?'#f59e0b':'#3b82f6'}
                  stroke="white" strokeWidth="2"
                  className={mod==='corner'?'cursor-grab':''}/>
              ))}

              {/* Engeller */}
              {obstacles.map(o=>(
                <g key={o.id}>
                  <rect x={o.x*scale} y={o.y*scale} width={o.w*scale} height={o.h*scale}
                    fill="#ef4444" fillOpacity="0.25" stroke="#ef4444" strokeWidth="1.5"/>
                  <line x1={o.x*scale} y1={o.y*scale} x2={(o.x+o.w)*scale} y2={(o.y+o.h)*scale}
                    stroke="#ef4444" strokeWidth="1" opacity="0.4"/>
                  <line x1={(o.x+o.w)*scale} y1={o.y*scale} x2={o.x*scale} y2={(o.y+o.h)*scale}
                    stroke="#ef4444" strokeWidth="1" opacity="0.4"/>
                  <text x={(o.x+o.w/2)*scale} y={(o.y+o.h/2)*scale+4}
                    textAnchor="middle" fontSize="8" fill="#991b1b" fontWeight="bold">
                    {o.w.toFixed(1)}×{o.h.toFixed(1)}m
                  </text>
                  <g className="cursor-pointer" onClick={()=>setObstacles(obs=>obs.filter(x=>x.id!==o.id))}>
                    <circle cx={(o.x+o.w)*scale} cy={o.y*scale} r="7" fill="#ef4444"/>
                    <text x={(o.x+o.w)*scale} y={o.y*scale+4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">✕</text>
                  </g>
                </g>
              ))}

              {/* Çizilmekte olan engel */}
              {drawingObs&&(
                <rect x={drawingObs.x*scale} y={drawingObs.y*scale}
                  width={drawingObs.w*scale} height={drawingObs.h*scale}
                  fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2"/>
              )}

              {/* İnverter */}
              <g transform={`translate(${invPos.x},${invPos.y})`}
                className={mod==='inverter'?'cursor-move':''}>
                <circle cx="0" cy="0" r="13" fill="#f59e0b" stroke="white" strokeWidth="2.5"/>
                <text x="0" y="5" textAnchor="middle" fontSize="13">⚡</text>
              </g>

              {/* Ölçek çubuğu */}
              <g transform={`translate(${SVG_W-130},${SVG_H-22})`}>
                <line x1="0" y1="6" x2={5*scale} y2="6" stroke="#475569" strokeWidth="2"/>
                <line x1="0" y1="3" x2="0" y2="9" stroke="#475569" strokeWidth="2"/>
                <line x1={5*scale} y1="3" x2={5*scale} y2="9" stroke="#475569" strokeWidth="2"/>
                <text x={5*scale/2} y="18" textAnchor="middle" fontSize="9" fill="#475569">5 m</text>
              </g>
            </svg>
          </div>

          {/* String tablosu */}
          {totalPanels > 0 && (
            <div className="bg-white p-4 rounded-xl border">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">String Kablo Mesafeleri</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      {['String','Panel','Yatay (m)','Toplam L (m)','Kablo ×2 (m)'].map(h=>(
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {strCables.map(s=>(
                      <tr key={s.si}>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full" style={{background:STR_COLORS[(s.si-1)%STR_COLORS.length]}}/>
                            <span className="font-bold">{s.si}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">{s.count}</td>
                        <td className="px-3 py-2 font-mono">{s.horiz}</td>
                        <td className="px-3 py-2 font-mono font-bold text-sky-700">{s.total}</td>
                        <td className="px-3 py-2 font-mono text-emerald-700 font-bold">{(+s.total*2).toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-3 py-2">Toplam</td>
                      <td className="px-3 py-2 font-mono">{totalPanels}</td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2 font-mono text-emerald-700">
                        {strCables.reduce((s,c)=>s+parseFloat(c.total)*2,0).toFixed(1)} m
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[10px] text-slate-400 mt-2">Dikey kat farkı {vertOff}m dahil</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
