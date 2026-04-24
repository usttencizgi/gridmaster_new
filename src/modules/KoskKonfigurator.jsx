import { useState, useMemo, useRef } from 'react';
import { BLOCK_SVG } from '../blockSvgData.js';

// ─── Hücre Kataloğu ───────────────────────────────────────────────────────────
const HUCRE_KATALOGU = [
  { key: 'kplj_kapakli',    ad: 'KPLJ - Kapılı',           grup: 'KPLJ',    renk: '#38bdf8', aciklama: 'Kesici + Yük Ay. + Topaklayıcı, Kapaklı' },
  { key: 'kplj_kirmizi',    ad: 'KPLJ - Kırmızı Kapılı',  grup: 'KPLJ',    renk: '#f87171', aciklama: 'Kesici + Yük Ay., Kırmızı Kapak' },
  { key: 'kplj_korumasiz',  ad: 'KPLJ - Korumasız',        grup: 'KPLJ',    renk: '#38bdf8', aciklama: 'Kesici + Yük Ay., Kapaksız' },
  { key: 'otop_kapakli',    ad: 'OTOP - Kapılı',           grup: 'OTOP',    renk: '#a3e635', aciklama: 'Otomatik Sigortalı, Kapaklı Ön' },
  { key: 'otop_kapaksiz',   ad: 'OTOP - Kapaksız',         grup: 'OTOP',    renk: '#a3e635', aciklama: 'Otomatik Sigortalı, Kapaksız' },
  { key: 'otop_tek',        ad: 'OTOP - Tek Hat',          grup: 'OTOP',    renk: '#a3e635', aciklama: 'OTOP Tek Hat Görünüşü' },
  { key: 'kesici_toroid',   ad: 'Kesicili + Toroid',       grup: 'KESİCİ', renk: '#f97316', aciklama: 'OG Kesici + Toroid CT, Kapaksız' },
  { key: 'kesici_kapaksiz', ad: 'Kesicili - Kapaksız',     grup: 'KESİCİ', renk: '#f97316', aciklama: 'OG Kesici, Kapaksız Ön Görünüş' },
  { key: 'sig_kapakli',     ad: 'SİG - Kapılı',            grup: 'SİGORTA', renk: '#fbbf24', aciklama: 'Sigorta Hücresi, Kapaklı' },
  { key: 'sig_kapaksiz',    ad: 'SİG - Kapaksız',          grup: 'SİGORTA', renk: '#fbbf24', aciklama: 'Sigorta Hücresi, Kapaksız' },
  { key: 'kb_kapakli',      ad: 'KB - Kapılı',             grup: 'KABLO',   renk: '#94a3b8', aciklama: 'Kablo Bölmesi, Kapaklı' },
  { key: 'kb_kapaksiz',     ad: 'KB - Kapaksız',           grup: 'KABLO',   renk: '#94a3b8', aciklama: 'Kablo Bölmesi, Kapaksız' },
  { key: 'kb_tprkli_sag',   ad: 'KB - Topraklıyıcılı Sağ',grup: 'KABLO',   renk: '#4ade80', aciklama: 'Kablo Bölmesi + Topraklayıcı, Sağ' },
  { key: 'kb_tprkli_2',     ad: 'KB - Topraklıyıcılı 2',  grup: 'KABLO',   renk: '#4ade80', aciklama: 'Kablo Bölmesi + Topraklayıcı Tip 2' },
  { key: 'kb_prfdrlu_sag',  ad: 'KB - Profilli Sağ',       grup: 'KABLO',   renk: '#94a3b8', aciklama: 'Kablo Bölmesi + Profil, Sağ' },
  { key: 'kb_prfdrlu_sol',  ad: 'KB - Profilli Sol',       grup: 'KABLO',   renk: '#94a3b8', aciklama: 'Kablo Bölmesi + Profil, Sol' },
  { key: 'ger_olcu',        ad: 'Gerilim Ölçü',            grup: 'ÖLÇÜM',  renk: '#c084fc', aciklama: 'Gerilim Ölçüm Hücresi, Kapaksız' },
  { key: 'akm_sol',         ad: 'AKM Ger. Ölçü Sol',       grup: 'ÖLÇÜM',  renk: '#c084fc', aciklama: 'AKM Gerilim Ölçüm, Sol Kapaksız' },
  { key: 'akm_sag',         ad: 'AKM Ger. Ölçü Sağ',       grup: 'ÖLÇÜM',  renk: '#c084fc', aciklama: 'AKM Gerilim Ölçüm, Sağ Kapılı' },
];

const KOSHK_TIPLERI = [
  { tip: '3100', label: '3100mm Köşk', cati_key: 'cati_3100', max_mm: 3100 },
  { tip: '4250', label: '4250mm Köşk', cati_key: 'cati_4250', max_mm: 4250 },
  { tip: '7300', label: '7300mm Köşk', cati_key: 'cati_7300', max_mm: 7300 },
];

const GRUPLARI = ['KPLJ','OTOP','KESİCİ','SİGORTA','KABLO','ÖLÇÜM'];
const GRUP_RENK = {
  'KPLJ':'#38bdf8', 'OTOP':'#a3e635', 'KESİCİ':'#f97316',
  'SİGORTA':'#fbbf24', 'KABLO':'#94a3b8', 'ÖLÇÜM':'#c084fc'
};

// ─── SVG Render ───────────────────────────────────────────────────────────────
function HucreSvg({ blockKey, width, height, stroke = '#38bdf8', opacity = 1 }) {
  const data = BLOCK_SVG[blockKey];
  if (!data) return null;
  return (
    <svg
      viewBox={`0 0 ${data.w} ${data.h}`}
      width={width} height={height}
      style={{ display: 'block', opacity }}
      xmlns="http://www.w3.org/2000/svg">
      <path d={data.paths} fill="none" stroke={stroke} strokeWidth="0.6" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

// ─── DXF İndir ───────────────────────────────────────────────────────────────
function buildDxfContent(kosk_tip, hucreler) {
  // Basit ASCII DXF R2000 — browser'da üretilebilir
  const lines = [];
  const add = (...args) => lines.push(...args.map(String));

  add('0','SECTION','2','HEADER',
      '9','$ACADVER','1','AC1015',
      '9','$INSUNITS','70','4',  // mm
      '0','ENDSEC');

  add('0','SECTION','2','TABLES');
  add('0','TABLE','2','LAYER','70','10');
  for (const [name, color] of [['HUCRE',2],['KOSHK',4],['YAZILAR',7],['OLCULAR',1]]) {
    add('0','LAYER','2',name,'70','0','62',color,'6','Continuous');
  }
  add('0','ENDTAB','0','ENDSEC');

  add('0','SECTION','2','ENTITIES');

  let curX = 0;
  const HUCRE_Y = 0;
  const CATI_Y = 2252;

  for (const hucre of hucreler) {
    const data = BLOCK_SVG[hucre.key];
    if (!data) continue;
    const scaleX = data.w_mm / data.w;
    const scaleY = data.h_mm / data.h;

    // Label
    if (hucre.label) {
      add('0','TEXT','8','YAZILAR','10', curX + data.w_mm/2, '20', HUCRE_Y - 300,
          '30','0','40','100','1',hucre.label,'72','1');
    }
    // Hücre sınır kutusu (basit temsil)
    const x1=curX, y1=HUCRE_Y, x2=curX+data.w_mm, y2=HUCRE_Y+data.h_mm;
    add('0','LWPOLYLINE','8','HUCRE','90','4','70','1','43','0',
        '10',x1,'20',y1,'10',x1,'20',y2,'10',x2,'20',y2,'10',x2,'20',y1);

    curX += data.w_mm;
  }

  // Çatı
  const koshk = KOSHK_TIPLERI.find(k=>k.tip===kosk_tip);
  if (koshk) {
    const cd = BLOCK_SVG[koshk.cati_key];
    if (cd) {
      add('0','LWPOLYLINE','8','KOSHK','90','5','70','1','43','0',
          '10',0,'20',CATI_Y,
          '10',0,'20',CATI_Y+cd.h_mm,
          '10',cd.w_mm,'20',CATI_Y+cd.h_mm,
          '10',cd.w_mm,'20',CATI_Y,
          '10',0,'20',CATI_Y);
    }
  }

  // Başlık yazısı
  const total = hucreler.reduce((s,h)=>{const d=BLOCK_SVG[h.key];return s+(d?d.w_mm:0);},0);
  add('0','TEXT','8','YAZILAR','10','0','20',CATI_Y+800,'30','0',
      '40','150','1',`EL-KO ${kosk_tip} KOSHK - ${hucreler.length} HUCRE - ${total}mm`);

  add('0','ENDSEC','0','EOF');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function KoskKonfigurator() {
  const [kosk_tip, setKoskTip] = useState('7300');
  const [hucreler, setHucreler] = useState([]);
  const [aktifGrup, setAktifGrup] = useState('KPLJ');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);

  const kosk = KOSHK_TIPLERI.find(k => k.tip === kosk_tip);
  const toplam_mm = hucreler.reduce((s, h) => {
    const d = BLOCK_SVG[h.key];
    return s + (d ? d.w_mm : 0);
  }, 0);
  const doluluk = Math.round((toplam_mm / kosk.max_mm) * 100);

  // ── Hücre ekle ──────────────────────────────────────────────────────────
  const hucreEkle = (key) => {
    const n = hucreler.filter(h => h.key === key).length + 1;
    const kat = HUCRE_KATALOGU.find(h => h.key === key);
    setHucreler(prev => [...prev, {
      id: Date.now() + Math.random(),
      key,
      label: `${kat?.ad || key} ${n}`,
    }]);
  };

  // ── Hücre sil ───────────────────────────────────────────────────────────
  const hucreSil = (id) => setHucreler(prev => prev.filter(h => h.id !== id));

  // ── Label düzenle ───────────────────────────────────────────────────────
  const labelDuzenle = (id, val) =>
    setHucreler(prev => prev.map(h => h.id === id ? { ...h, label: val } : h));

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOver(idx);
  };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOver(null); return; }
    const arr = [...hucreler];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setHucreler(arr);
    setDragIdx(null); setDragOver(null);
  };

  // ── DXF İndir ───────────────────────────────────────────────────────────
  const dxfIndir = () => {
    const content = buildDxfContent(kosk_tip, hucreler);
    const blob = new Blob([content], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ELKO_KOSHK_${kosk_tip}_${Date.now()}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── SVG Önizleme ────────────────────────────────────────────────────────
  const onizleme = useMemo(() => {
    const PREVIEW_H = 160;
    const cells = hucreler.map(h => {
      const data = BLOCK_SVG[h.key];
      if (!data) return null;
      const scale = PREVIEW_H / data.h;
      return { ...h, data, pw: data.w * scale, ph: PREVIEW_H, scale };
    }).filter(Boolean);

    const totalW = cells.reduce((s, c) => s + c.pw, 0);
    const catiData = BLOCK_SVG[kosk.cati_key];
    const catiScale = totalW > 0 && catiData ? totalW / catiData.w : 0;

    return { cells, totalW, catiData, catiScale };
  }, [hucreler, kosk]);

  const katalogGrup = HUCRE_KATALOGU.filter(h => h.grup === aktifGrup);

  return (
    <div className="flex h-full bg-slate-900 text-white overflow-hidden" style={{ minHeight: '600px' }}>

      {/* ── Sol Panel: Katalog ── */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="px-3 py-3 border-b border-slate-800">
          <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">⚡ EL-KO Köşk Konfig.</div>
          <div className="text-[9px] text-slate-500 mt-0.5">ELKO DXF Şablonlarından</div>
        </div>

        {/* Köşk tipi seçimi */}
        <div className="px-3 py-3 border-b border-slate-800">
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Köşk Tipi</div>
          <div className="space-y-1.5">
            {KOSHK_TIPLERI.map(k => (
              <button key={k.tip} onClick={() => setKoskTip(k.tip)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-all ${
                  kosk_tip === k.tip
                    ? 'bg-cyan-900 text-cyan-300 ring-1 ring-cyan-500'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}>
                <span className="font-mono">{k.label}</span>
                <span className="text-[9px] block text-slate-500 font-normal">
                  Maks. {k.max_mm}mm genişlik
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Hücre grupları */}
        <div className="px-2 py-2 border-b border-slate-800">
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">Hücre Tipi</div>
          <div className="flex flex-wrap gap-1">
            {GRUPLARI.map(g => (
              <button key={g} onClick={() => setAktifGrup(g)}
                className={`px-2 py-1 rounded text-[9px] font-black transition-colors ${
                  aktifGrup === g ? 'text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                style={aktifGrup === g ? { background: GRUP_RENK[g] + '30', color: GRUP_RENK[g], border: `1px solid ${GRUP_RENK[g]}60` } : {}}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Katalog listesi */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {katalogGrup.map(hucre => {
            const data = BLOCK_SVG[hucre.key];
            if (!data) return null;
            return (
              <button key={hucre.key} onClick={() => hucreEkle(hucre.key)}
                onMouseEnter={() => setHoverKey(hucre.key)}
                onMouseLeave={() => setHoverKey(null)}
                className="w-full flex items-center gap-2 px-2 py-2.5 rounded-lg mb-1 hover:bg-slate-800 transition-all text-left group">
                {/* Küçük SVG önizleme */}
                <div className="w-10 h-12 flex-shrink-0 flex items-center justify-center bg-slate-900 rounded border border-slate-700 overflow-hidden">
                  <HucreSvg blockKey={hucre.key} width={36} height={46}
                    stroke={hucre.renk} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-300 group-hover:text-white truncate">{hucre.ad}</div>
                  <div className="text-[8px] text-slate-600 font-mono">{data.w_mm}mm genişlik</div>
                  <div className="text-[8px] text-slate-600 truncate">{hucre.aciklama}</div>
                </div>
                <span className="text-cyan-400 text-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">+</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Orta: Kanvas + Önizleme ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Üst toolbar */}
        <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-slate-500">
              Toplam: <span className="text-cyan-400 font-mono font-bold">{toplam_mm} mm</span>
            </span>
            <span className="text-[9px] text-slate-500">
              Köşk: <span className="font-mono">{kosk.max_mm} mm</span>
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${doluluk > 100 ? 'bg-red-500' : doluluk > 85 ? 'bg-yellow-400' : 'bg-green-400'}`}
                  style={{ width: `${Math.min(doluluk, 100)}%` }} />
              </div>
              <span className={`text-[9px] font-mono font-bold ${doluluk > 100 ? 'text-red-400' : doluluk > 85 ? 'text-yellow-400' : 'text-green-400'}`}>
                %{doluluk}
              </span>
            </div>
            {doluluk > 100 && (
              <span className="text-[9px] text-red-400 font-bold">⚠ Köşk kapasitesi aşıldı!</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setHucreler([])}
              className="text-[9px] text-slate-500 hover:text-red-400 px-2 py-1 rounded bg-slate-800 transition-colors">
              ✕ Temizle
            </button>
            <button onClick={dxfIndir} disabled={hucreler.length === 0}
              className={`text-[9px] px-3 py-1.5 rounded font-bold transition-all ${
                hucreler.length > 0
                  ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              ↓ DXF İndir
            </button>
          </div>
        </div>

        {/* SVG Önizleme alanı */}
        <div className="flex-1 overflow-auto p-4 bg-slate-900">

          {hucreler.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-3 opacity-10">🏗</div>
                <div className="text-slate-600 text-sm">Sol panelden hücre ekle</div>
                <div className="text-slate-700 text-xs mt-1">Ekledikten sonra sürükle-bırak ile sırala</div>
              </div>
            </div>
          ) : (
            <div>
              {/* Köşk ön görünüş önizlemesi */}
              <div className="mb-4">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2 font-bold">
                  ÖN GÖRÜNÜŞ — {kosk.label}
                </div>
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-x-auto">
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0' }}>
                    {/* Hücreler */}
                    {onizleme.cells.map((cell, i) => {
                      const kat = HUCRE_KATALOGU.find(h => h.key === cell.key);
                      return (
                        <div key={cell.id} style={{ position: 'relative', flexShrink: 0 }}>
                          <HucreSvg
                            blockKey={cell.key}
                            width={cell.pw}
                            height={cell.ph}
                            stroke={kat?.renk || '#38bdf8'}
                          />
                        </div>
                      );
                    })}
                    {/* Çatı */}
                    {onizleme.catiData && onizleme.totalW > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        pointerEvents: 'none'
                      }}>
                      </div>
                    )}
                  </div>
                  {/* Çatı altına */}
                  {onizleme.catiData && (
                    <div style={{ display: 'flex' }}>
                      <svg
                        viewBox={`0 0 ${onizleme.catiData.w} ${onizleme.catiData.h}`}
                        width={onizleme.totalW}
                        height={12}
                        style={{ display: 'block' }}>
                        <path d={onizleme.catiData.paths} fill="none" stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sağ Panel: Hücre listesi ── */}
      <div className="w-64 bg-slate-950 border-l border-slate-800 flex flex-col flex-shrink-0">
        <div className="px-3 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Hücre Listesi
          </div>
          <span className="text-[9px] font-mono font-bold text-cyan-400">{hucreler.length} adet</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {hucreler.length === 0 ? (
            <div className="text-center py-8 text-[9px] text-slate-700">
              Henüz hücre eklenmedi.<br/>Sol panelden seç.
            </div>
          ) : (
            <div className="space-y-1">
              {hucreler.map((h, i) => {
                const kat = HUCRE_KATALOGU.find(k => k.key === h.key);
                const data = BLOCK_SVG[h.key];
                return (
                  <div key={h.id}
                    draggable
                    onDragStart={e => handleDragStart(e, i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={e => handleDrop(e, i)}
                    onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all cursor-grab ${
                      dragOver === i ? 'border-cyan-400 bg-cyan-950' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}>
                    {/* Sıra no */}
                    <span className="text-[9px] font-mono text-slate-600 flex-shrink-0 w-4 text-center">
                      {i + 1}
                    </span>
                    {/* Renk dot */}
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: kat?.renk || '#64748b' }} />
                    {/* Label */}
                    <input
                      value={h.label}
                      onChange={e => labelDuzenle(h.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-transparent text-[9px] font-mono text-slate-300 outline-none focus:text-white min-w-0 truncate"
                    />
                    {/* Genişlik */}
                    <span className="text-[8px] text-slate-600 font-mono flex-shrink-0">
                      {data?.w_mm}mm
                    </span>
                    {/* Sil */}
                    <button onClick={() => hucreSil(h.id)}
                      className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0 text-xs leading-none">
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Toplam */}
        {hucreler.length > 0 && (
          <div className="border-t border-slate-800 px-3 py-3">
            <div className="space-y-1 text-[9px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Toplam genişlik</span>
                <span className="font-mono font-bold text-white">{toplam_mm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Köşk kapasitesi</span>
                <span className="font-mono text-slate-400">{kosk.max_mm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kalan</span>
                <span className={`font-mono font-bold ${toplam_mm > kosk.max_mm ? 'text-red-400' : 'text-green-400'}`}>
                  {kosk.max_mm - toplam_mm} mm
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-500">Hücre sayısı</span>
                <span className="font-mono font-bold text-cyan-400">{hucreler.length}</span>
              </div>
            </div>

            <button onClick={dxfIndir}
              className="mt-3 w-full py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-[10px] font-bold transition-colors">
              ↓ DXF Dosyası İndir
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
