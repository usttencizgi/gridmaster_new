import NumInput from '../components/NumInput.jsx';
import { useState, useMemo } from 'react';

// ─── cos φ Değerleri ──────────────────────────────────────────────────────────
const MEVCUT_COSFI = [
  0.60,0.61,0.62,0.63,0.64,0.65,0.66,0.67,0.68,0.69,
  0.70,0.71,0.72,0.73,0.74,0.75,0.76,0.77,0.78,0.79,
  0.80,0.81,0.82,0.83,0.84,0.85,0.86,0.87,0.88,0.89,
  0.90,0.91,0.92,0.93,0.94,0.95,0.96,0.97,0.98,0.99,
];
const HEDEF_COSFI  = [0.80,0.85,0.90,0.92,0.95,0.97,0.98,0.99,1.00];
const RELAY_STEPS  = [6,8,12,14,16,18];

// ─── k Katsayısı ──────────────────────────────────────────────────────────────
function calcK(fi1, fi2) {
  if (fi1 >= fi2) return 0;
  const phi1 = Math.acos(Math.min(0.9999, Math.max(0.001, fi1)));
  const phi2 = Math.acos(Math.min(1.0,    Math.max(0.001, fi2)));
  const k = Math.tan(phi1) - Math.tan(phi2);
  return k < 0 ? 0 : k;
}

function buildKTable() {
  return MEVCUT_COSFI.map(fi1 => HEDEF_COSFI.map(fi2 => calcK(fi1, fi2)));
}

// ─── Çevrimsel Artan Dizi — Röle Kademe Dağılımı ─────────────────────────────
function buildRelayDistribution(totalKvar) {
  if (totalKvar <= 0) return { steps:[],totalKvar:0,excessKvar:0,relayCount:1,grouped:{},summary:'',recommendedRelay:'',stepCount:0 };

  let pattern;
  if      (totalKvar <= 15) pattern = [1,2,3,5,7.5,10,15];
  else if (totalKvar <= 50) pattern = [2.5,5,7.5,10,15,20];
  else                      pattern = [5,10,20,30,40];

  const steps = [];
  let running = 0, idx = 0;

  while (running < totalKvar - 0.01 && steps.length < 60) {
    const remaining = parseFloat((totalKvar - running).toFixed(4));
    const next      = pattern[idx % pattern.length];

    if (next <= remaining + 0.01) {
      // Normal adım — sığıyor, devam
      steps.push(next);
      running = parseFloat((running + next).toFixed(4));
      idx++;
    } else {
      // Bu adım taşıyor: pattern'den sığan en büyük adımı seç, idx'i ilerletme
      const fits = pattern.filter(s => s <= remaining + 0.01);
      if (fits.length > 0) {
        const best = fits[fits.length - 1];
        steps.push(best);
        running = parseFloat((running + best).toFixed(4));
        // idx'i ilerletmiyoruz — döngü kaldığı yerden devam edecek
      } else {
        // Hiçbir standart adım sığmıyor (çok küçük kesir kaldı) — direkt ekle
        steps.push(parseFloat(remaining.toFixed(1)));
        running = totalKvar;
        break;
      }
    }
  }

  const relayCount = Math.max(1, Math.ceil(steps.length / 18));

  const grouped = {};
  for (const s of steps) grouped[s] = (grouped[s] || 0) + 1;

  const summary = Object.entries(grouped)
    .sort((a,b) => a[0]-b[0])
    .map(([k,v]) => `${v}×${parseFloat(k)%1===0?parseInt(k):k} kVAr`)
    .join(' + ');

  const perRelay = Math.ceil(steps.length / relayCount);
  const model    = RELAY_STEPS.find(r => r >= perRelay) ?? RELAY_STEPS[RELAY_STEPS.length-1];
  const recommendedRelay = relayCount === 1 ? `${model} kademe röle` : `${relayCount} × ${model} kademe röle`;

  return { steps, totalKvar:running, excessKvar:parseFloat((running-totalKvar).toFixed(2)),
    relayCount, grouped, summary, recommendedRelay, stepCount:steps.length };
}

// ─── Ana Hesap ────────────────────────────────────────────────────────────────
function calcKompanzasyon(pKw, cosFi1, cosFi2, withRelay) {
  const k      = calcK(cosFi1, cosFi2);
  const qcKvar = pKw * k;
  const q1     = pKw * Math.tan(Math.acos(Math.min(0.9999, cosFi1)));
  const q2     = Math.max(0, q1 - qcKvar);
  const s2     = Math.sqrt(pKw*pKw + q2*q2);
  const cosFiAchieved = s2 > 0 ? Math.min(1, pKw/s2) : 1;
  const qcRounded = Math.ceil(qcKvar / 5) * 5;
  const relayDist = withRelay && qcKvar > 0 ? buildRelayDistribution(qcRounded) : null;
  return { pKw, cosFi1, cosFi2, k, qcKvar, qcRounded, cosFiAchieved, relayDist };
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
const fKvar  = v => v % 1 === 0 ? String(parseInt(v)) : String(v);
const fAngle = v => (Math.acos(Math.min(1, Math.max(0.001, v))) * 180 / Math.PI).toFixed(1);
const fTan   = v => Math.tan(Math.acos(Math.min(0.9999, Math.max(0.001, v)))).toFixed(4);
const stepOpacity = (kvar, maxKvar) => 0.07 + (kvar / (maxKvar||1)) * 0.21;

// ═══════════════════════════════════════════════════════════════════════════════
export default function Kompanzasyon() {
  const [pKw,       setPKw]       = useState(100);
  const [cosFi1,    setCosFi1]    = useState(0.75);
  const [cosFi2,    setCosFi2]    = useState(0.95);
  const [withRelay, setWithRelay] = useState(false);
  const [result,    setResult]    = useState(null);

  const kTable  = useMemo(() => buildKTable(), []);
  const canCalc = cosFi1 < cosFi2 && pKw > 0;
  const rowIdx  = MEVCUT_COSFI.findIndex(v => Math.abs(v-cosFi1) < 0.001);
  const colIdx  = HEDEF_COSFI.findIndex(v => Math.abs(v-cosFi2) < 0.001);

  const handleCalc = () => {
    if (!canCalc) return;
    setResult(calcKompanzasyon(pKw, cosFi1, cosFi2, withRelay));
  };

  const handleToggleRelay = (v) => {
    setWithRelay(v);
    if (result) setResult(calcKompanzasyon(pKw, cosFi1, cosFi2, v));
  };

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Header ── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/>
              <line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="16" x2="17" y2="16"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Reaktif Güç Kompanzasyonu</h2>
            <p className="text-sm text-slate-500">cos φ Düzeltme — k Katsayısı Yöntemi</p>
          </div>
        </div>
        <button onClick={handleCalc} disabled={!canCalc}
          className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          HESAPLA
        </button>
      </div>

      {/* ── Formül Bandı ── */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-800 flex items-center gap-2">
        <span className="font-bold text-sky-400 text-base">ℹ</span>
        <span className="font-mono text-xs">
          Q<sub>C</sub> = P × k &nbsp;|&nbsp; k = tanφ₁ − tanφ₂ &nbsp;|&nbsp; Q<sub>C</sub> [kVAr] = P [kW] × k
        </span>
      </div>

      {/* ── Uyarı ── */}
      {cosFi1 >= cosFi2 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex items-center gap-2">
          <span className="font-bold">⚠</span>
          Hedef cos φ, mevcut cos φ'den büyük olmalı
        </div>
      )}

      {/* ── Giriş Kartı ── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-5 border-b pb-3">Sistem Parametreleri</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Aktif Güç */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Aktif Güç</label>
            <div className="flex border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-sky-400">
              <NumInput value={pKw} onChange={v => setPKw(v||0)} min="1" className="flex-1 px-3 py-3 font-mono font-black text-2xl outline-none bg-white text-slate-800"/>
              <span className="px-3 text-sm font-bold text-slate-400 border-l bg-slate-50 self-center">kW</span>
            </div>
          </div>

          {/* Mevcut cos φ */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Mevcut cos φ₁</label>
            <div className="flex justify-between items-center px-3 py-2.5 rounded-xl border-2 border-orange-300 bg-orange-50 mb-3">
              <span className="font-mono font-black text-2xl text-orange-500">{cosFi1.toFixed(2)}</span>
              <span className="font-mono text-xs text-orange-400">φ = {fAngle(cosFi1)}°</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {MEVCUT_COSFI.map(v => (
                <button key={v} onClick={() => setCosFi1(v)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                    Math.abs(v-cosFi1)<0.001
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-slate-400 border border-slate-200 hover:border-orange-300'
                  }`}>
                  {v.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* Hedef cos φ */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Hedef cos φ₂</label>
            <div className="flex justify-between items-center px-3 py-2.5 rounded-xl border-2 border-sky-300 bg-sky-50 mb-3">
              <span className="font-mono font-black text-2xl text-sky-600">{cosFi2.toFixed(2)}</span>
              <span className="font-mono text-xs text-sky-400">φ = {fAngle(cosFi2)}°</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {HEDEF_COSFI.map(v => (
                <button key={v} onClick={() => setCosFi2(v)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                    Math.abs(v-cosFi2)<0.001
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-slate-400 border border-slate-200 hover:border-sky-300'
                  }`}>
                  {v.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sonuçlar ── */}
      {result && (
        <div className="space-y-4">

          {/* 3 özet kart */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label:'Hesaplanan Q_C',  value:result.qcKvar.toFixed(1), unit:'kVAr', sub:`k = ${result.k.toFixed(3)}  |  P × k`,         bg:'bg-orange-50', border:'border-orange-200', val:'text-orange-600', lbl:'text-orange-500' },
              { label:'Banka Gücü (↑5)', value:result.qcRounded.toFixed(0), unit:'kVAr', sub:`${result.qcKvar.toFixed(1)} → ${result.qcRounded} kVAr (yukarı yuvarlandı)`, bg:'bg-sky-50',    border:'border-sky-200',    val:'text-sky-600',    lbl:'text-sky-500'    },
              { label:'Ulaşılan cos φ',  value:result.cosFiAchieved.toFixed(3), unit:'', sub:'Kurulum sonrası',                             bg:'bg-green-50',  border:'border-green-200',  val:'text-green-600',  lbl:'text-green-600'  },
            ].map(c => (
              <div key={c.label} className={`${c.bg} border-2 ${c.border} p-5 rounded-xl`}>
                <div className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${c.lbl}`}>{c.label}</div>
                <div className={`font-mono font-black text-3xl ${c.val}`}>{c.value}</div>
                {c.unit && <div className={`text-xs font-bold mt-0.5 ${c.lbl}`}>{c.unit}</div>}
                <div className="text-[10px] text-slate-400 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Röle toggle */}
          <button onClick={() => handleToggleRelay(!withRelay)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              withRelay ? 'bg-sky-50 border-sky-400' : 'bg-white border-slate-200 hover:border-sky-200'
            }`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${withRelay?'bg-sky-600':'bg-slate-100'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={withRelay?'white':'#94a3b8'} strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className={`text-sm font-bold ${withRelay?'text-sky-700':'text-slate-700'}`}>
                Otomatik Kompanzasyon Rölesine Göre Dağıt
              </div>
              <div className="text-xs text-slate-400">Çevrimsel artan dizi — küçükten büyüğe kademe planı</div>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 flex items-center transition-colors flex-shrink-0 ${withRelay?'bg-sky-600':'bg-slate-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${withRelay?'translate-x-4':'translate-x-0'}`}/>
            </div>
          </button>

          {/* Röle Dağılım Kartı */}
          {result.relayDist && <RelayCard dist={result.relayDist} qcKvar={result.qcKvar} qcRounded={result.qcRounded} />}

          {/* Hesap Detayı */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Hesap Detayı</div>
            <div className="space-y-1.5">
              {[
                ['P (Aktif Güç)',       `${result.pKw.toFixed(0)} kW`],
                ['cos φ₁ (Mevcut)',     result.cosFi1.toFixed(2)],
                ['cos φ₂ (Hedef)',      result.cosFi2.toFixed(2)],
                ['tanφ₁',              fTan(result.cosFi1)],
                ['tanφ₂',              fTan(result.cosFi2)],
                ['k = tanφ₁ − tanφ₂',  result.k.toFixed(4)],
                ['Q_C = P × k',         `${result.qcKvar.toFixed(2)} kVAr`],
                ['Ulaşılan cos φ',      result.cosFiAchieved.toFixed(4)],
              ].map(([l,v]) => (
                <div key={l} className="flex justify-between py-1 border-b border-slate-100 last:border-0 text-sm font-mono">
                  <span className="text-slate-500 font-medium">{l}</span>
                  <span className="text-slate-800 font-bold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── k Tablosu ── */}
      <KTable kTable={kTable} rowIdx={rowIdx} colIdx={colIdx}
        onSelectFi1={setCosFi1} onSelectFi2={setCosFi2} />

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Röle Dağılım Kartı
// ═══════════════════════════════════════════════════════════════════════════════
function RelayCard({ dist, qcKvar, qcRounded }) {
  const maxKvar = dist.steps.length ? Math.max(...dist.steps) : 1;

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="bg-sky-50 border-b border-sky-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Kademe Dağılımı</div>
            <div className="text-xs font-bold text-sky-600">{dist.recommendedRelay}</div>
          </div>
        </div>
        <div className="bg-sky-600 text-white font-mono font-black text-sm px-3 py-1.5 rounded-lg">
          {fKvar(dist.totalKvar)} kVAr
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Özet şerit */}
        <div className="bg-sky-50 border border-sky-100 rounded-lg px-4 py-2.5 text-xs text-sky-800 flex items-start gap-2">
          <span className="text-sky-400 mt-0.5">ℹ</span>
          <span>
            Hesaplanan: <strong>{qcKvar.toFixed(1)} kVAr</strong> →
            Banka: <strong>{qcRounded} kVAr</strong> (5'e yuvarlandı)
            &nbsp;| <strong>{dist.stepCount} kademe</strong>
            &nbsp;| {dist.summary}
          </span>
        </div>

        {/* Kademe Grid */}
        <div className="flex flex-wrap gap-1.5">
          {dist.steps.map((s, i) => {
            const op = stepOpacity(s, maxKvar);
            return (
              <div key={i}
                style={{ backgroundColor:`rgba(2,132,199,${op})`, borderColor:`rgba(2,132,199,${op*2.5})` }}
                className="w-14 flex flex-col items-center py-2 rounded-lg border font-mono">
                <span className="text-[8px] font-bold text-sky-800 opacity-60">K{i+1}</span>
                <span className="text-sm font-black text-sky-900">{fKvar(s)}</span>
                <span className="text-[7px] text-sky-700 opacity-60">kVAr</span>
              </div>
            );
          })}
        </div>

        <div className="border-t pt-4 space-y-3">
          {/* Kondansatör bileşenleri */}
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kondansatör Bileşenleri</div>
          {Object.entries(dist.grouped).sort((a,b)=>a[0]-b[0]).map(([kvar, adet]) => (
            <div key={kvar} className="flex items-center gap-2">
              <div className="flex gap-1 flex-wrap">
                {Array.from({length:Math.min(adet,10)}).map((_,i) => (
                  <div key={i} className="w-5 h-5 bg-sky-600 rounded flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/>
                      <line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="16" x2="17" y2="16"/>
                    </svg>
                  </div>
                ))}
                {adet > 10 && <span className="text-xs text-sky-600 font-bold self-center ml-1">+{adet-10}</span>}
              </div>
              <span className="text-sm text-slate-400">{adet} adet ×</span>
              <span className="font-mono font-black text-base text-slate-800">{fKvar(parseFloat(kvar))} kVAr</span>
              <span className="ml-auto font-mono text-xs font-bold text-sky-600">= {fKvar(parseFloat(kvar)*adet)} kVAr</span>
            </div>
          ))}

          {/* Toplam satırı */}
          <div className="bg-slate-50 rounded-lg p-3 flex">
            {[['Hesaplanan',`${qcKvar.toFixed(1)} kVAr`,'text-slate-700'],
              ['Banka (↑5)',`${qcRounded} kVAr`,'text-sky-600'],
              ['Fark',`+${(qcRounded-qcKvar).toFixed(1)} kVAr`,'text-green-600']
            ].map(([l,v,c]) => (
              <div key={l} className="flex-1">
                <div className="text-[9px] text-slate-400 font-semibold">{l}</div>
                <div className={`font-mono font-black text-xs mt-1 ${c}`}>{v}</div>
              </div>
            ))}
          </div>

          {/* Çok röle uyarısı */}
          {dist.relayCount > 1 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-xs text-orange-700 flex items-center gap-2">
              <span className="font-bold flex-shrink-0">⚠</span>
              <span>
                <strong>{dist.stepCount} kademe</strong> için <strong>{dist.relayCount} ayrı röle</strong> gerekiyor.
                Her röle 18 kademe kapasitesine göre gruplandırılmıştır.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// k Tablosu
// ═══════════════════════════════════════════════════════════════════════════════
function KTable({ kTable, rowIdx, colIdx, onSelectFi1, onSelectFi2 }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-sky-50 border-b border-sky-100 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
          <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">k Katsayısı Tablosu</span>
        </div>
        <span className="text-[8px] text-sky-400 hidden sm:block">Satır = mevcut φ | Sütun = hedef φ | Hücreye tıkla → seç</span>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="border-collapse text-center" style={{fontSize:'10px',lineHeight:'1.2'}}>
          <thead>
            <tr>
              <td className="w-14 text-[9px] font-bold text-slate-400 pb-2 pr-1 text-right">cos φ₁ ↓</td>
              {HEDEF_COSFI.map((fi2, ci) => (
                <td key={ci} onClick={() => onSelectFi2(fi2)}
                  className={`w-14 h-8 font-black font-mono cursor-pointer rounded transition-colors ${
                    ci===colIdx
                      ? 'bg-sky-100 text-sky-700 border border-sky-400'
                      : 'text-slate-400 hover:bg-slate-50'
                  }`}>
                  {fi2.toFixed(2)}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEVCUT_COSFI.map((fi1, ri) => (
              <tr key={ri}>
                <td onClick={() => onSelectFi1(fi1)}
                  className={`font-black font-mono text-right pr-2 cursor-pointer transition-colors ${
                    ri===rowIdx
                      ? 'bg-orange-100 text-orange-600 border border-orange-300 px-2 rounded'
                      : 'text-slate-400 hover:text-orange-400'
                  }`}>
                  {fi1.toFixed(2)}
                </td>
                {HEDEF_COSFI.map((fi2, ci) => {
                  const k     = kTable[ri][ci];
                  const isHit = ri===rowIdx && ci===colIdx;
                  const isRow = ri===rowIdx && !isHit;
                  const isCol = ci===colIdx && !isHit;
                  const zero  = k <= 0;

                  let style = 'h-8 w-14 font-mono cursor-pointer transition-all rounded ';
                  if      (isHit) style += 'bg-sky-600 text-white font-black shadow';
                  else if (isRow) style += 'bg-orange-50 text-orange-500 border border-orange-200';
                  else if (isCol) style += 'bg-sky-50 text-sky-600 border border-sky-100';
                  else if (zero)  style += 'bg-slate-50 text-slate-300';
                  else            style += 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700';

                  return (
                    <td key={ci} className={style}
                      onClick={() => { onSelectFi1(fi1); onSelectFi2(fi2); }}>
                      {zero ? '—' : k.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-5 pb-4 flex flex-wrap gap-4">
        {[
          ['bg-sky-600','text-white','Seçili k değeri'],
          ['bg-orange-50','text-orange-500','Mevcut cos φ satırı'],
          ['bg-sky-50','text-sky-600','Hedef cos φ sütunu'],
          ['bg-slate-50','text-slate-300','Geçersiz (φ₁ ≥ φ₂)'],
        ].map(([bg,fg,label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${bg} border border-slate-200`}/>
            <span className="text-[9px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
