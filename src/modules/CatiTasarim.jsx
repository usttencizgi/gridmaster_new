import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Geometri yardımcıları ─────────────────────────────────────────
function ptInPoly(pt, poly) {
  let inside = false;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
    const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
    if (((yi>pt.y)!==(yj>pt.y)) && (pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi))
      inside = !inside;
  }
  return inside;
}

function rectInPoly(rx, ry, rw, rh, poly) {
  const corners = [
    {x:rx,    y:ry},
    {x:rx+rw, y:ry},
    {x:rx+rw, y:ry+rh},
    {x:rx,    y:ry+rh},
  ];
  return corners.every(c => ptInPoly(c, poly));
}

function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

function insetPolygon(poly, d) {
  // Basit içe kaydırma: her kenar d kadar içe alınır
  const n = poly.length;
  const result = [];
  for (let i=0; i<n; i++) {
    const prev = poly[(i-1+n)%n], curr = poly[i], next = poly[(i+1)%n];
    // Kenar vektörleri
    const d1 = {x:curr.x-prev.x, y:curr.y-prev.y};
    const d2 = {x:next.x-curr.x, y:next.y-curr.y};
    // Normallar (içe doğru — CCW polygon için sol normal)
    const len1 = Math.sqrt(d1.x*d1.x+d1.y*d1.y)||1;
    const len2 = Math.sqrt(d2.x*d2.x+d2.y*d2.y)||1;
    const n1 = {x: d1.y/len1, y:-d1.x/len1};
    const n2 = {x: d2.y/len2, y:-d2.x/len2};
    // Ortalama normal
    const avg = {x:(n1.x+n2.x)/2, y:(n1.y+n2.y)/2};
    const avgLen = Math.sqrt(avg.x*avg.x+avg.y*avg.y)||1;
    result.push({x: curr.x + avg.x/avgLen*d, y: curr.y + avg.y/avgLen*d});
  }
  return result;
}

function polyArea(poly) {
  let area = 0;
  for (let i=0,j=poly.length-1; i<poly.length; j=i++) {
    area += (poly[j].x+poly[i].x)*(poly[j].y-poly[i].y);
  }
  return area/2; // pozitif = CW, negatif = CCW
}

function ensureCCW(poly) {
  return polyArea(poly) > 0 ? [...poly].reverse() : poly;
}

function bbox(poly) {
  const xs = poly.map(p=>p.x), ys = poly.map(p=>p.y);
  return { minX:Math.min(...xs), minY:Math.min(...ys), maxX:Math.max(...xs), maxY:Math.max(...ys) };
}

function dist(a, b) {
  return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);
}

// ─── Panel yerleşim algoritması ────────────────────────────────────
function computePanels(roof, obstacles, settings, scale) {
  const { panelW, panelH, orientation, rowSpacing, colSpacing, setback } = settings;
  const pw = orientation === 'portrait'  ? panelW * scale : panelH * scale;
  const ph = orientation === 'portrait'  ? panelH * scale : panelW * scale;
  const rs = rowSpacing * scale;
  const cs = colSpacing * scale;
  const sb = setback * scale;

  const poly = ensureCCW(roof.vertices);
  const inset = sb > 0 ? insetPolygon(poly, sb) : poly;
  if (inset.length < 3) return [];

  const bb = bbox(inset);
  const panels = [];

  for (let y = bb.minY; y + ph <= bb.maxY + 0.5; y += ph + rs) {
    for (let x = bb.minX; x + pw <= bb.maxX + 0.5; x += pw + cs) {
      // Engel çakışması
      const blocked = obstacles
        .filter(o => o.roofId === roof.id)
        .some(o => rectsOverlap(x, y, pw, ph, o.x*scale, o.y*scale, o.w*scale, o.h*scale));
      if (!blocked && rectInPoly(x, y, pw, ph, inset)) {
        panels.push({ x, y, w: pw, h: ph, roofId: roof.id });
      }
    }
  }
  return panels;
}

// ─── String atama ──────────────────────────────────────────────────
function assignStrings(panels, panelsPerString, inverterPos, scale) {
  if (!panels.length) return [];
  // Inverter'a uzaklığa göre sırala
  const sorted = [...panels].sort((a,b) => {
    const da = dist({x:(a.x+a.w/2), y:(a.y+a.h/2)}, {x:inverterPos.x*scale, y:inverterPos.y*scale});
    const db = dist({x:(b.x+b.w/2), y:(b.y+b.h/2)}, {x:inverterPos.x*scale, y:inverterPos.y*scale});
    return da - db;
  });
  return sorted.map((p,i) => ({ ...p, stringIdx: Math.floor(i/panelsPerString)+1, posInString: (i%panelsPerString)+1 }));
}

// ─── String kablo mesafesi ─────────────────────────────────────────
function calcStringCables(panels, inverterPos, verticalOffset, scale) {
  const strings = {};
  panels.forEach(p => {
    if (!strings[p.stringIdx]) strings[p.stringIdx] = [];
    strings[p.stringIdx].push(p);
  });
  return Object.entries(strings).map(([idx, ps]) => {
    // String'in inverter'a en yakın ucu
    const closest = ps.reduce((best, p) => {
      const cx = (p.x+p.w/2)/scale, cy = (p.y+p.h/2)/scale;
      const d = Math.sqrt((cx-inverterPos.x)**2+(cy-inverterPos.y)**2);
      return d < best.d ? {d, cx, cy} : best;
    }, {d:Infinity, cx:0, cy:0});
    const horizontal = closest.d;
    const total = Math.sqrt(horizontal**2 + verticalOffset**2);
    return { idx: Number(idx), count: ps.length, horizontal: horizontal.toFixed(1), total: total.toFixed(1) };
  });
}

// ─── Renk paleti (string'ler için) ────────────────────────────────
const STRING_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
];

// ─── Mod tanımları ────────────────────────────────────────────────
const MODES = [
  { id:'draw',     label:'Çatı Çiz',      icon:'⬡', color:'bg-blue-500'   },
  { id:'obstacle', label:'Engel Ekle',    icon:'⬛', color:'bg-red-500'    },
  { id:'inverter', label:'İnverter Koy',  icon:'⚡', color:'bg-amber-500'  },
  { id:'view',     label:'Sonuçlar',      icon:'📊', color:'bg-emerald-500' },
];

// ─── ANA BİLEŞEN ──────────────────────────────────────────────────
export default function CatiTasarim({ onSendToGesKablo }) {
  const SVG_W = 760, SVG_H = 520;

  // Scale: realWidth metre → SVG piksel
  const [realWidth,  setRealWidth]  = useState(20);   // m
  const [realHeight, setRealHeight] = useState(15);   // m
  const scale = SVG_W / realWidth;                    // px/m

  // State
  const [mode,      setMode]     = useState('draw');
  const [roofs,     setRoofs]    = useState([]);
  const [curRoof,   setCurRoof]  = useState(null);   // çizilmekte olan
  const [drawVerts, setDrawVerts]= useState([]);
  const [selRoof,   setSelRoof]  = useState(null);   // seçili çatı id
  const [obstacles, setObstacles]= useState([]);
  const [dragObs,   setDragObs]  = useState(null);   // {startX,startY}
  const [curObs,    setCurObs]   = useState(null);
  const [inverterPos, setInvPos] = useState({x:realWidth/2, y:realHeight/2});
  const [vertOffset,  setVOff]   = useState(0);     // dikey mesafe (m)
  const [hoverPt,    setHoverPt] = useState(null);

  // Panel & string ayarları
  const [panelW,    setPW]  = useState(1.13); // m
  const [panelH,    setPH]  = useState(2.28); // m
  const [orient,    setOr]  = useState('portrait');
  const [rowSp,     setRS]  = useState(0.1);  // m
  const [colSp,     setCS]  = useState(0.02); // m
  const [setback,   setSB]  = useState(0.5);  // m
  const [pPerStr,   setPPS] = useState(12);   // panel/string

  const svgRef = useRef(null);

  // SVG koordinat dönüşümü
  const svgPt = useCallback(e => {
    const svg = svgRef.current;
    if (!svg) return {x:0,y:0};
    const rect = svg.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*(SVG_W/rect.width), y:(e.clientY-rect.top)*(SVG_H/rect.height) };
  },[]);

  // Gerçek koordinata çevir
  const toReal = pt => ({ x: pt.x/scale, y: pt.y/scale });
  const toPx   = pt => ({ x: pt.x*scale, y: pt.y*scale });

  // Mevcut çatı için çizilmiş paneller
  const allPanels = roofs.flatMap(roof =>
    computePanels(roof, obstacles, {
      panelW, panelH, orientation:orient, rowSpacing:rowSp, colSpacing:colSp, setback
    }, scale)
  );
  const panelsWithStr = assignStrings(allPanels, pPerStr, inverterPos, scale);
  const stringCables  = calcStringCables(panelsWithStr, inverterPos, vertOffset, scale);
  const totalPanels   = panelsWithStr.length;
  const numStrings    = Math.ceil(totalPanels / pPerStr);

  // ── SVG Olay İşleyicileri ────────────────────────────────────────
  const handleMouseMove = e => {
    const pt = svgPt(e);
    setHoverPt(pt);
    if (mode==='obstacle' && dragObs) {
      const x = Math.min(pt.x, dragObs.startX)/scale;
      const y = Math.min(pt.y, dragObs.startY)/scale;
      const w = Math.abs(pt.x-dragObs.startX)/scale;
      const h = Math.abs(pt.y-dragObs.startY)/scale;
      setCurObs({ roofId:selRoof||roofs[0]?.id, x, y, w, h });
    }
  };

  const handleClick = e => {
    const pt = svgPt(e);
    const real = toReal(pt);

    if (mode==='draw') {
      // Kapatma: ilk noktaya yakın tıkla (en az 3 nokta varsa)
      if (drawVerts.length >= 3) {
        const fp = toPx(drawVerts[0]);
        if (dist(pt, fp) < 14) {
          // Çatıyı kapat
          const newRoof = {
            id: Date.now(),
            vertices: drawVerts,
            tilt: 10, azimuth: 180,
            color: `hsl(${Math.random()*360},60%,65%)`,
          };
          setRoofs(r => [...r, newRoof]);
          setSelRoof(newRoof.id);
          setDrawVerts([]);
          return;
        }
      }
      setDrawVerts(v => [...v, real]);

    } else if (mode==='inverter') {
      setInvPos(real);

    } else if (mode==='view') {
      // Çatı seçimi
      const clicked = roofs.find(r => ptInPoly(pt, r.vertices.map(v=>toPx(v))));
      if (clicked) setSelRoof(clicked.id);
    }
  };

  const handleMouseDown = e => {
    if (mode==='obstacle') {
      const pt = svgPt(e);
      setDragObs({ startX:pt.x, startY:pt.y });
    }
  };

  const handleMouseUp = e => {
    if (mode==='obstacle' && dragObs && curObs && curObs.w > 0.2 && curObs.h > 0.2) {
      setObstacles(o => [...o, { ...curObs, id: Date.now() }]);
      setDragObs(null); setCurObs(null);
    }
    setDragObs(null);
  };

  const handleDblClick = e => {
    // Çatıyı çift tıkla kapat
    if (mode==='draw' && drawVerts.length >= 3) {
      const newRoof = { id: Date.now(), vertices: drawVerts, tilt:10, azimuth:180, color:`hsl(${Math.random()*360},60%,65%)` };
      setRoofs(r => [...r, newRoof]);
      setSelRoof(newRoof.id);
      setDrawVerts([]);
    }
  };

  const deleteRoof = id => {
    setRoofs(r => r.filter(x=>x.id!==id));
    setObstacles(o => o.filter(x=>x.roofId!==id));
    if (selRoof===id) setSelRoof(null);
  };

  const sendToGesKablo = () => {
    if (!onSendToGesKablo) return;
    const strings = {};
    panelsWithStr.forEach(p => {
      if (!strings[p.stringIdx]) strings[p.stringIdx] = [];
      strings[p.stringIdx].push(p);
    });
    const lineData = Object.entries(strings).map(([idx,ps]) => {
      const cable = stringCables.find(c=>c.idx===Number(idx));
      return { id: Date.now()+Number(idx), code: `Dizi ${idx}`, nSeri: pPerStr, L: parseFloat(cable?.total||0) };
    });
    onSendToGesKablo(lineData);
  };

  // ── UI ────────────────────────────────────────────────────────────
  const selRoofObj = roofs.find(r=>r.id===selRoof);

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-5 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Çatı GES Tasarım Aracı</h2>
            <p className="text-sky-100 text-sm">Poligon çatı · Otomatik panel dizimi · String hesabı · DC kablo</p>
          </div>
        </div>
        <div className="text-right text-white">
          <div className="text-2xl font-black">{totalPanels}</div>
          <div className="text-xs text-sky-200">Panel · {numStrings} String</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* ── SOL: KONTROLLER ── */}
        <div className="xl:col-span-1 space-y-3">

          {/* Mod seçici */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Araç Seçimi</div>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map(m => (
                <button key={m.id} onClick={()=>setMode(m.id)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${mode===m.id?`${m.color} text-white border-transparent`:'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
            {mode==='draw' && (
              <p className="text-[10px] text-slate-400 mt-2">
                Tıklayarak köşe ekle. İlk noktaya tıkla veya çift tıkla ile kapat.
              </p>
            )}
            {mode==='obstacle' && (
              <p className="text-[10px] text-slate-400 mt-2">
                Çatı üzerinde sürükleyerek engel çiz (baca, klima vb.)
              </p>
            )}
            {mode==='inverter' && (
              <p className="text-[10px] text-slate-400 mt-2">
                İnverter konumuna tıkla. Çatı dışında da olabilir.
              </p>
            )}
          </div>

          {/* Canvas boyutu */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Çatı Alanı (m)</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Genişlik</label>
                <input type="number" value={realWidth} onChange={e=>{setRealWidth(+e.target.value||20);setRoofs([]);setObstacles([]);setDrawVerts([]);}}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:border-sky-400 outline-none"/>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Yükseklik</label>
                <input type="number" value={realHeight} onChange={e=>setRealHeight(+e.target.value||15)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:border-sky-400 outline-none"/>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">1 piksel = {(1/scale).toFixed(3)} m</div>
          </div>

          {/* Panel ayarları */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Panel Ayarları</div>
            <div className="space-y-2">
              <div className="flex gap-2">
                {[['portrait','Dikey'],['landscape','Yatay']].map(([v,l])=>(
                  <button key={v} onClick={()=>setOr(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${orient===v?'bg-sky-50 border-sky-500 text-sky-700':'border-slate-200 text-slate-500'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><label className="text-[10px] text-slate-400 block mb-1">En (m)</label>
                  <input type="number" value={panelW} onChange={e=>setPW(+e.target.value)} step="0.01"
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
                <div><label className="text-[10px] text-slate-400 block mb-1">Boy (m)</label>
                  <input type="number" value={panelH} onChange={e=>setPH(+e.target.value)} step="0.01"
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
                <div><label className="text-[10px] text-slate-400 block mb-1">Satır Aralığı (m)</label>
                  <input type="number" value={rowSp} onChange={e=>setRS(+e.target.value)} step="0.05"
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
                <div><label className="text-[10px] text-slate-400 block mb-1">Sütun Aralığı (m)</label>
                  <input type="number" value={colSp} onChange={e=>setCS(+e.target.value)} step="0.01"
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
                <div><label className="text-[10px] text-slate-400 block mb-1">Kenar Boşluğu (m)</label>
                  <input type="number" value={setback} onChange={e=>setSB(+e.target.value)} step="0.1"
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
                <div><label className="text-[10px] text-slate-400 block mb-1">Panel/String</label>
                  <input type="number" value={pPerStr} onChange={e=>setPPS(+e.target.value)} step="1" min="1"
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
              </div>
            </div>
          </div>

          {/* İnverter */}
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">İnverter Konumu</div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div><label className="text-[10px] text-slate-400 block mb-1">X (m)</label>
                <input type="number" value={inverterPos.x.toFixed(1)} onChange={e=>setInvPos(p=>({...p,x:+e.target.value}))} step="0.5"
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-amber-400 outline-none"/></div>
              <div><label className="text-[10px] text-slate-400 block mb-1">Y (m)</label>
                <input type="number" value={inverterPos.y.toFixed(1)} onChange={e=>setInvPos(p=>({...p,y:+e.target.value}))} step="0.5"
                  className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-amber-400 outline-none"/></div>
            </div>
            <div><label className="text-[10px] text-slate-400 block mb-1">Dikey Mesafe — kat farkı (m)</label>
              <input type="number" value={vertOffset} onChange={e=>setVOff(+e.target.value)} step="1" min="0"
                className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-amber-400 outline-none"/>
            </div>
          </div>

          {/* Seçili çatı özellikleri */}
          {selRoofObj && (
            <div className="bg-white p-4 rounded-xl border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Seçili Çatı</div>
                <button onClick={()=>deleteRoof(selRoofObj.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-bold">Sil</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-slate-400 block mb-1">Eğim (°)</label>
                  <input type="number" value={selRoofObj.tilt} step="5" min="0" max="90"
                    onChange={e=>setRoofs(rs=>rs.map(r=>r.id===selRoofObj.id?{...r,tilt:+e.target.value}:r))}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
                <div><label className="text-[10px] text-slate-400 block mb-1">Azimut (°)</label>
                  <input type="number" value={selRoofObj.azimuth} step="5" min="0" max="360"
                    onChange={e=>setRoofs(rs=>rs.map(r=>r.id===selRoofObj.id?{...r,azimuth:+e.target.value}:r))}
                    className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-sky-400 outline-none"/></div>
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5">
                {panelsWithStr.filter(p=>p.roofId===selRoofObj.id).length} panel bu çatıda
              </div>
            </div>
          )}

          {/* GES Kablo gönder */}
          {totalPanels > 0 && onSendToGesKablo && (
            <button onClick={sendToGesKablo}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              ⚡ GES Kablo Modülüne Gönder
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-mono">{numStrings} string</span>
            </button>
          )}
        </div>

        {/* ── SAĞ: SVG CANVAS ── */}
        <div className="xl:col-span-3 space-y-3">
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            {/* Canvas toolbar */}
            <div className="bg-slate-50 border-b px-4 py-2 flex items-center gap-3 text-xs">
              <span className="text-slate-500 font-mono">{realWidth}m × {realHeight}m</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{roofs.length} çatı yüzeyi</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-sky-600">{totalPanels} panel</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-emerald-600">{numStrings} string</span>
              {drawVerts.length > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-blue-500">{drawVerts.length} köşe — çift tıkla kapat</span>
                  <button onClick={()=>setDrawVerts([])} className="text-red-400 hover:text-red-600 font-bold ml-auto">İptal</button>
                </>
              )}
            </div>

            <svg
              ref={svgRef}
              width={SVG_W} height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full cursor-crosshair select-none"
              style={{background:'#f1f5f9'}}
              onClick={handleClick}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDblClick}
            >
              {/* Grid */}
              <defs>
                <pattern id="grid1" width={scale} height={scale} patternUnits="userSpaceOnUse">
                  <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.5"/>
                </pattern>
                <pattern id="grid5" width={scale*5} height={scale*5} patternUnits="userSpaceOnUse">
                  <rect width={scale*5} height={scale*5} fill="url(#grid1)"/>
                  <path d={`M ${scale*5} 0 L 0 0 0 ${scale*5}`} fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5"/>
                </pattern>
              </defs>
              <rect width={SVG_W} height={SVG_H} fill="url(#grid5)"/>

              {/* Ölçek çubuğu */}
              <g transform={`translate(${SVG_W-120},${SVG_H-28})`}>
                <line x1="0" y1="8" x2={scale*5} y2="8" stroke="#475569" strokeWidth="2"/>
                <line x1="0" y1="4" x2="0" y2="12" stroke="#475569" strokeWidth="2"/>
                <line x1={scale*5} y1="4" x2={scale*5} y2="12" stroke="#475569" strokeWidth="2"/>
                <text x={scale*5/2} y="20" textAnchor="middle" fontSize="9" fill="#475569" fontFamily="monospace">5 m</text>
              </g>

              {/* Paneller */}
              {panelsWithStr.map((p, i) => {
                const col = STRING_COLORS[(p.stringIdx-1) % STRING_COLORS.length];
                return (
                  <g key={i}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h}
                      fill={col} fillOpacity="0.55" stroke={col} strokeWidth="0.8" strokeOpacity="0.9"/>
                    {p.w > 18 && p.h > 10 && (
                      <text x={p.x+p.w/2} y={p.y+p.h/2+3} textAnchor="middle" fontSize="7"
                        fontWeight="bold" fill="white" style={{textShadow:'0 0 2px rgba(0,0,0,.5)'}}>
                        {p.stringIdx}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Çatı poligonları */}
              {roofs.map(roof => {
                const pts = roof.vertices.map(v=>toPx(v));
                const ptStr = pts.map(p=>`${p.x},${p.y}`).join(' ');
                const selected = roof.id === selRoof;
                return (
                  <g key={roof.id} onClick={e=>{e.stopPropagation();setSelRoof(roof.id);}}>
                    <polygon points={ptStr} fill={roof.color} fillOpacity="0.12"
                      stroke={selected?'#3b82f6':'#64748b'} strokeWidth={selected?2.5:1.5}
                      strokeDasharray={selected?'none':'5,3'} className="cursor-pointer"/>
                    {/* Köşe noktaları */}
                    {pts.map((p,i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={selected?4:3}
                        fill={selected?'#3b82f6':'#64748b'} stroke="white" strokeWidth="1.5"/>
                    ))}
                    {/* Etiket */}
                    {pts.length > 0 && (
                      <text x={pts.reduce((s,p)=>s+p.x,0)/pts.length}
                            y={pts.reduce((s,p)=>s+p.y,0)/pts.length}
                        textAnchor="middle" fontSize="9" fontWeight="bold"
                        fill={selected?'#1e40af':'#334155'}>
                        {`${roof.tilt}° / ${roof.azimuth}°`}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Çizilmekte olan çatı */}
              {drawVerts.length > 0 && (
                <>
                  {drawVerts.length > 1 && (
                    <polyline points={drawVerts.map(v=>toPx(v)).map(p=>`${p.x},${p.y}`).join(' ')}
                      fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6,3"/>
                  )}
                  {hoverPt && (
                    <line x1={toPx(drawVerts[drawVerts.length-1]).x} y1={toPx(drawVerts[drawVerts.length-1]).y}
                      x2={hoverPt.x} y2={hoverPt.y} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6"/>
                  )}
                  {drawVerts.map((v,i) => {
                    const p = toPx(v);
                    const isFirst = i===0;
                    return (
                      <circle key={i} cx={p.x} cy={p.y} r={isFirst&&drawVerts.length>=3?7:4}
                        fill={isFirst?'#10b981':'#3b82f6'} stroke="white" strokeWidth="1.5"/>
                    );
                  })}
                </>
              )}

              {/* Engeller */}
              {obstacles.map(o => (
                <g key={o.id}>
                  <rect x={o.x*scale} y={o.y*scale} width={o.w*scale} height={o.h*scale}
                    fill="#ef4444" fillOpacity="0.3" stroke="#ef4444" strokeWidth="1.5"/>
                  <line x1={o.x*scale} y1={o.y*scale} x2={(o.x+o.w)*scale} y2={(o.y+o.h)*scale} stroke="#ef4444" strokeWidth="1" opacity="0.5"/>
                  <line x1={(o.x+o.w)*scale} y1={o.y*scale} x2={o.x*scale} y2={(o.y+o.h)*scale} stroke="#ef4444" strokeWidth="1" opacity="0.5"/>
                  <rect x={o.x*scale} y={o.y*scale} width={o.w*scale} height={o.h*scale}
                    fill="none" stroke="white" strokeWidth="0.5" opacity="0.4"/>
                </g>
              ))}
              {/* Çizilmekte olan engel */}
              {curObs && (
                <rect x={curObs.x*scale} y={curObs.y*scale} width={curObs.w*scale} height={curObs.h*scale}
                  fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2"/>
              )}

              {/* İnverter */}
              <g transform={`translate(${inverterPos.x*scale},${inverterPos.y*scale})`}
                className={mode==='inverter'?'cursor-move':''}>
                <circle cx="0" cy="0" r="12" fill="#f59e0b" stroke="white" strokeWidth="2"/>
                <text x="0" y="4" textAnchor="middle" fontSize="12">⚡</text>
                <text x="16" y="4" fontSize="9" fontWeight="bold" fill="#92400e">İNV</text>
              </g>

              {/* String → inverter çizgileri (yalnızca view modunda) */}
              {mode==='view' && (() => {
                const drawn = new Set();
                return panelsWithStr.map((p,i) => {
                  if (drawn.has(p.stringIdx)) return null;
                  drawn.add(p.stringIdx);
                  const col = STRING_COLORS[(p.stringIdx-1)%STRING_COLORS.length];
                  // String'deki en yakın panel merkezi
                  const strPanels = panelsWithStr.filter(x=>x.stringIdx===p.stringIdx);
                  const closest = strPanels.reduce((best,px) => {
                    const d = dist({x:px.x+px.w/2,y:px.y+px.h/2},{x:inverterPos.x*scale,y:inverterPos.y*scale});
                    return d < best.d ? {d,x:px.x+px.w/2,y:px.y+px.h/2} : best;
                  },{d:Infinity,x:0,y:0});
                  return (
                    <line key={i} x1={closest.x} y1={closest.y}
                      x2={inverterPos.x*scale} y2={inverterPos.y*scale}
                      stroke={col} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7"/>
                  );
                });
              })()}
            </svg>
          </div>

          {/* String özet tablosu */}
          {totalPanels > 0 && (
            <div className="bg-white p-4 rounded-xl border">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">String Kablo Mesafeleri</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      {['String','Panel Sayısı','Yatay Mesafe (m)','Toplam L (m)','Kablo (×2)'].map(h=>(
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stringCables.map(s => (
                      <tr key={s.idx}>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full" style={{background:STRING_COLORS[(s.idx-1)%STRING_COLORS.length]}}/>
                            <span className="font-bold">{s.idx}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">{s.count}</td>
                        <td className="px-3 py-2 font-mono">{s.horizontal}</td>
                        <td className="px-3 py-2 font-mono font-bold text-sky-700">{s.total}</td>
                        <td className="px-3 py-2 font-mono text-emerald-700 font-bold">{(parseFloat(s.total)*2).toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-3 py-2">Toplam</td>
                      <td className="px-3 py-2 font-mono">{totalPanels}</td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2 font-mono text-emerald-700">
                        {stringCables.reduce((s,c)=>s+parseFloat(c.total)*2,0).toFixed(1)} m
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Kablo ×2 = pozitif + negatif hat · Dikey kat farkı: {vertOffset} m dahil
              </p>
            </div>
          )}

          {/* Boş durum */}
          {roofs.length === 0 && (
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400">
              <div className="text-4xl mb-2">⬡</div>
              <p className="font-bold text-sm">Çatı Çiz modunda çatı köşelerini tıkla</p>
              <p className="text-xs mt-1">Yamuk, L, U — her poligon şekil desteklenir</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
