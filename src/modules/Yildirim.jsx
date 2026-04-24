import NumInput from '../components/NumInput.jsx';
import { useState, useMemo } from 'react';

// ─── İl / Td Verisi ───────────────────────────────────────────────────────────
const ILLER_TD = [
  {il:'Edirne',bolge:'Marmara',td:20},{il:'Kırklareli',bolge:'Marmara',td:20},
  {il:'Tekirdağ',bolge:'Marmara',td:18},{il:'İstanbul',bolge:'Marmara',td:18},
  {il:'Kocaeli',bolge:'Marmara',td:18},{il:'Sakarya',bolge:'Marmara',td:19},
  {il:'Bursa',bolge:'Marmara',td:17},{il:'Yalova',bolge:'Marmara',td:18},
  {il:'Bilecik',bolge:'Marmara',td:19},{il:'Balıkesir',bolge:'Marmara',td:18},
  {il:'Çanakkale',bolge:'Marmara',td:18},
  {il:'İzmir',bolge:'Ege',td:16},{il:'Manisa',bolge:'Ege',td:17},
  {il:'Aydın',bolge:'Ege',td:16},{il:'Denizli',bolge:'Ege',td:16},
  {il:'Muğla',bolge:'Ege',td:14},{il:'Uşak',bolge:'Ege',td:17},
  {il:'Afyonkarahisar',bolge:'Ege',td:16},{il:'Kütahya',bolge:'Ege',td:18},
  {il:'Antalya',bolge:'Akdeniz',td:12},{il:'Isparta',bolge:'Akdeniz',td:16},
  {il:'Burdur',bolge:'Akdeniz',td:14},{il:'Mersin',bolge:'Akdeniz',td:12},
  {il:'Adana',bolge:'Akdeniz',td:14},{il:'Hatay',bolge:'Akdeniz',td:12},
  {il:'Osmaniye',bolge:'Akdeniz',td:14},{il:'Kahramanmaraş',bolge:'Akdeniz',td:16},
  {il:'Düzce',bolge:'Karadeniz',td:20},{il:'Bolu',bolge:'Karadeniz',td:20},
  {il:'Zonguldak',bolge:'Karadeniz',td:22},{il:'Bartın',bolge:'Karadeniz',td:22},
  {il:'Karabük',bolge:'Karadeniz',td:22},{il:'Kastamonu',bolge:'Karadeniz',td:22},
  {il:'Sinop',bolge:'Karadeniz',td:20},{il:'Samsun',bolge:'Karadeniz',td:18},
  {il:'Ordu',bolge:'Karadeniz',td:20},{il:'Giresun',bolge:'Karadeniz',td:22},
  {il:'Trabzon',bolge:'Karadeniz',td:20},{il:'Rize',bolge:'Karadeniz',td:16},
  {il:'Artvin',bolge:'Karadeniz',td:14},
  {il:'Ankara',bolge:'İç Anadolu',td:17},{il:'Eskişehir',bolge:'İç Anadolu',td:18},
  {il:'Konya',bolge:'İç Anadolu',td:14},{il:'Kayseri',bolge:'İç Anadolu',td:16},
  {il:'Sivas',bolge:'İç Anadolu',td:18},{il:'Yozgat',bolge:'İç Anadolu',td:18},
  {il:'Kırıkkale',bolge:'İç Anadolu',td:18},{il:'Kırşehir',bolge:'İç Anadolu',td:17},
  {il:'Nevşehir',bolge:'İç Anadolu',td:15},{il:'Aksaray',bolge:'İç Anadolu',td:15},
  {il:'Niğde',bolge:'İç Anadolu',td:14},{il:'Karaman',bolge:'İç Anadolu',td:14},
  {il:'Çorum',bolge:'İç Anadolu',td:18},{il:'Amasya',bolge:'İç Anadolu',td:19},
  {il:'Tokat',bolge:'İç Anadolu',td:20},{il:'Çankırı',bolge:'İç Anadolu',td:18},
  {il:'Erzurum',bolge:'Doğu Anadolu',td:16},{il:'Erzincan',bolge:'Doğu Anadolu',td:15},
  {il:'Bayburt',bolge:'Doğu Anadolu',td:16},{il:'Gümüşhane',bolge:'Doğu Anadolu',td:18},
  {il:'Ardahan',bolge:'Doğu Anadolu',td:15},{il:'Kars',bolge:'Doğu Anadolu',td:12},
  {il:'Ağrı',bolge:'Doğu Anadolu',td:10},{il:'Iğdır',bolge:'Doğu Anadolu',td:8},
  {il:'Van',bolge:'Doğu Anadolu',td:8},{il:'Muş',bolge:'Doğu Anadolu',td:12},
  {il:'Bingöl',bolge:'Doğu Anadolu',td:16},{il:'Tunceli',bolge:'Doğu Anadolu',td:16},
  {il:'Elazığ',bolge:'Doğu Anadolu',td:16},{il:'Malatya',bolge:'Doğu Anadolu',td:14},
  {il:'Bitlis',bolge:'Doğu Anadolu',td:10},
  {il:'Gaziantep',bolge:'Güneydoğu',td:12},{il:'Kilis',bolge:'Güneydoğu',td:12},
  {il:'Adıyaman',bolge:'Güneydoğu',td:12},{il:'Şanlıurfa',bolge:'Güneydoğu',td:8},
  {il:'Diyarbakır',bolge:'Güneydoğu',td:12},{il:'Batman',bolge:'Güneydoğu',td:10},
  {il:'Siirt',bolge:'Güneydoğu',td:10},{il:'Mardin',bolge:'Güneydoğu',td:10},
  {il:'Şırnak',bolge:'Güneydoğu',td:8},{il:'Hakkari',bolge:'Güneydoğu',td:6},
];

const BOLGELER = [...new Set(ILLER_TD.map(i => i.bolge))];

// ─── C Faktörleri ─────────────────────────────────────────────────────────────
const C1 = [
  {label:'Aynı/daha yüksek yapı veya ağaçla çevrili', value:0.25},
  {label:'Yüksekliği daha az yapılarla çevrili',       value:0.5},
  {label:'En yakın yapı 3H uzakta',                    value:1.0},
  {label:'Bölgedeki en yüksek yapı',                   value:2.0},
];
const C2_TABLE = [[0.5,1.0,2.0],[1.0,1.0,2.5],[2.0,2.5,3.0]];
const CATI_LABELS = ['Metal','Kremit','Tutuşabilir'];
const YAPI_LABELS = ['Metal','Tuğla/Beton','Tutuşabilir'];
const C3 = [
  {label:'Değersiz, yanıcı olmayan', value:0.5},
  {label:'Normal değer, yanıcı',     value:1.0},
  {label:'Değerli, alev alıcı',      value:2.0},
  {label:'Çok değerli, patlayıcı',   value:3.0},
];
const C4 = [
  {label:'Personelsiz bina',              value:0.5},
  {label:'Normal kalabalık',              value:1.0},
  {label:'Panik riski, tahliye zorluğu',  value:3.0},
];
const C5 = [
  {label:'Sürekli kullanım yok, çevrede değersiz', value:1.0},
  {label:'Sürekli kullanım, çevrede değersiz',     value:5.0},
  {label:'Çevrede değerli',                        value:10.0},
];

// ─── Seviye → D (m) ───────────────────────────────────────────────────────────
const SEV_D = {I:20, II:30, III:45, IV:60};

// ─── Faraday Kafes ────────────────────────────────────────────────────────────
const FARADAY = {
  'SEVİYE I + Ek Önlem': {inis:10, kure:20, kafes:'5×5 m'},
  'SEVİYE I':            {inis:10, kure:20, kafes:'5×5 m'},
  'SEVİYE II':           {inis:10, kure:30, kafes:'10×10 m'},
  'SEVİYE III':          {inis:15, kure:45, kafes:'15×15 m'},
  'SEVİYE IV':           {inis:20, kure:60, kafes:'20×20 m'},
};

// ─── ESE Tipler ───────────────────────────────────────────────────────────────
const ESE_TIPLER = [
  {kod:'ESE T1', aciklama:'Küçük - orta alan (ΔT=25μs)',  min:25,  max:59},
  {kod:'ESE T2', aciklama:'Orta - büyük alan (ΔT=60μs)',  min:60,  max:109},
  {kod:'ESE T3', aciklama:'Geniş alan (ΔT=110μs)',        min:110, max:999},
];

// ─── Td Renk ─────────────────────────────────────────────────────────────────
function tdColor(td) {
  if (td <= 8)  return {bg:'bg-blue-100',   text:'text-blue-700',   border:'border-blue-300'};
  if (td <= 12) return {bg:'bg-green-100',  text:'text-green-700',  border:'border-green-300'};
  if (td <= 16) return {bg:'bg-yellow-100', text:'text-yellow-800', border:'border-yellow-300'};
  if (td <= 20) return {bg:'bg-orange-100', text:'text-orange-700', border:'border-orange-300'};
  return              {bg:'bg-red-100',    text:'text-red-700',    border:'border-red-300'};
}
function tdYogunluk(td) {
  if (td <= 8)  return 'Çok az';
  if (td <= 12) return 'Az';
  if (td <= 16) return 'Orta';
  if (td <= 20) return 'Fazla';
  return 'Çok fazla';
}

// ─── ESE Tip Belirle ─────────────────────────────────────────────────────────
function getEseTip(deltaT) {
  return ESE_TIPLER.find(t => deltaT >= t.min && deltaT <= t.max) ?? ESE_TIPLER[ESE_TIPLER.length-1];
}

// ─── ADIM 1: Risk Analizi ─────────────────────────────────────────────────────
function calcRisk({td, l, w, h, c1idx, catiTip, yapiTip, c3idx, c4idx, c5idx}) {
  const ae   = l*w + 6*h*(l+w) + 9*Math.PI*h*h;
  const ng   = 0.04 * Math.pow(td, 1.25);
  const c1v  = C1[c1idx].value;
  const c2v  = C2_TABLE[catiTip][yapiTip];
  const c3v  = C3[c3idx].value;
  const c4v  = C4[c4idx].value;
  const c5v  = C5[c5idx].value;
  const cval = c2v * c3v * c4v * c5v;
  const nd   = ng * ae * c1v * 1e-6;
  const nc   = 5.5e-3 / cval;
  const gerekli = nd > nc;
  const e    = gerekli ? 1 - nc/nd : 0;

  let sev = '', sevKod = 'III';
  if (gerekli) {
    if      (e > 0.98) { sev = 'SEVİYE I + Ek Önlem'; sevKod = 'I'; }
    else if (e > 0.95) { sev = 'SEVİYE I';             sevKod = 'I'; }
    else if (e > 0.90) { sev = 'SEVİYE II';            sevKod = 'II'; }
    else if (e > 0.80) { sev = 'SEVİYE III';           sevKod = 'III'; }
    else               { sev = 'SEVİYE IV';             sevKod = 'IV'; }
  }
  return {ng, ae, nd, nc, e, c1v, c2v, c3v, c4v, c5v, cval, gerekli, sev, sevKod};
}

// ─── ADIM 2: Paratoner Rp — NF C 17-102 ──────────────────────────────────────
function calcParatonerRp({hPara, deltaT, sevKod, binaL, binaW}) {
  const D  = SEV_D[sevKod] ?? 45;
  const dL = deltaT;

  const rp5 = Math.sqrt(5*(2*D-5) + dL*(2*D+dL));
  let rp;
  if (hPara >= 5) {
    const hEff = Math.min(hPara, D);
    rp = Math.sqrt(hEff*(2*D-hEff) + dL*(2*D+dL));
  } else if (hPara >= 2) {
    rp = (hPara / 5) * rp5;
  } else {
    rp = 0;
  }

  const binaDiagonal = Math.sqrt(Math.pow(binaL/2,2) + Math.pow(binaW/2,2));
  const tekYeter     = rp >= binaDiagonal;
  const onerilen_n   = tekYeter ? 1 : Math.ceil(binaDiagonal / (rp > 0 ? rp : 1)) + 1;
  const eseTip       = getEseTip(deltaT);

  let oneri;
  if (rp === 0) {
    oneri = 'Paratoner yüksekliği yetersiz (h < 2 m). Minimum 2 m montaj yüksekliği gereklidir.';
  } else if (tekYeter) {
    oneri = `✓ ${eseTip.kod} tipi aktif paratoner, Seviye ${sevKod} için yeterlidir.\nRp = ${rp.toFixed(1)} m  ≥  bina köşegeninin yarısı = ${binaDiagonal.toFixed(1)} m\nTek ${eseTip.kod} paratoner binayı tamamen kapsamaktadır.`;
  } else {
    // Faraday kafes büyüklüğünü bul
    const sevFull = ['I','II','III','IV'].reduce((acc,k) => {
      if (Object.keys(FARADAY).find(f => f.includes(k) && !f.includes('Ek') && sevKod===k)) return Object.keys(FARADAY).find(f => f.includes(k) && !f.includes('Ek'));
      return acc;
    }, 'SEVİYE III');
    const kafes = FARADAY[`SEVİYE ${sevKod}`]?.kafes ?? '—';
    oneri = `⚠ Tek paratoner yetersiz!\nRp = ${rp.toFixed(1)} m  <  bina köşegeninin yarısı = ${binaDiagonal.toFixed(1)} m\nÖneri: En az ${onerilen_n} adet ${eseTip.kod} paratoner veya Faraday kafes sistemi (${kafes} örgü).`;
  }

  return {rp, d:D, dL, hPara, deltaT, binaDiagonal, tekYeter, onerilen_n,
    eseTipKod:eseTip.kod, eseTipAciklamasi:eseTip.aciklama, oneri};
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function fExp(v) {
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / Math.pow(10, exp);
  return `${mant.toFixed(2)}×10⁻${Math.abs(exp) < 10 ? Math.abs(exp) : Math.abs(exp)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Yildirim() {
  // Bina
  const [l, setL] = useState(20);
  const [w, setW] = useState(15);
  const [h, setH] = useState(8);
  // Td
  const [seciliIl,    setSeciliIl]    = useState(null);
  const [manuelTd,    setManuelTd]    = useState(20);
  const [bolgeFilter, setBolgeFilter] = useState('');
  const [arama,       setArama]       = useState('');
  // C faktörleri
  const [c1idx,   setC1idx]   = useState(2);
  const [catiTip, setCatiTip] = useState(1);
  const [yapiTip, setYapiTip] = useState(1);
  const [c3idx,   setC3idx]   = useState(1);
  const [c4idx,   setC4idx]   = useState(1);
  const [c5idx,   setC5idx]   = useState(1);
  // Adım 2
  const [hPara,   setHPara]   = useState(3);
  const [deltaT,  setDeltaT]  = useState(60);
  const [sevOverride, setSevOverride] = useState('');
  // Sonuçlar
  const [riskRes,  setRiskRes]  = useState(null);
  const [paraRes,  setParaRes]  = useState(null);

  const td = seciliIl ? seciliIl.td : manuelTd;
  const aktifSevKod = sevOverride || (riskRes?.sevKod ?? 'III');
  const aktifSevLabel = sevOverride
    ? `SEVİYE ${sevOverride} (Manuel)`
    : (riskRes?.sev || 'SEVİYE III');

  const hesaplaRisk = () => {
    const res = calcRisk({td, l, w, h, c1idx, catiTip, yapiTip, c3idx, c4idx, c5idx});
    setRiskRes(res);
    setParaRes(null);
  };

  const hesaplaPara = () => {
    const res = calcParatonerRp({
      hPara, deltaT, sevKod: aktifSevKod,
      binaL: l, binaW: w,
    });
    setParaRes(res);
  };

  const filteredIller = useMemo(() =>
    ILLER_TD.filter(i =>
      (!bolgeFilter || i.bolge === bolgeFilter) &&
      (!arama || i.il.toLowerCase().includes(arama.toLowerCase()))
    ), [bolgeFilter, arama]);

  const c2val = C2_TABLE[catiTip][yapiTip];
  const eseTipLive = getEseTip(deltaT);

  return (
    <div className="space-y-4 max-w-6xl">

      {/* ── Header ── */}
      <div className="bg-white p-5 rounded-xl shadow-sm border flex items-center gap-4">
        <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Yıldırımdan Korunma</h2>
          <p className="text-sm text-slate-500">TS EN 62305 / NF C 17-102 — 2 Adımlı Analiz</p>
        </div>
      </div>

      {/* ── Adım Göstergesi ── */}
      <div className="flex items-center gap-3 px-1">
        <StepDot no="1" label="Risk Analizi" done={!!riskRes} active={!riskRes} />
        <div className={`flex-1 h-1 rounded ${riskRes ? 'bg-yellow-400' : 'bg-slate-200'}`}/>
        <StepDot no="2" label="Paratoner Önerisi" done={!!paraRes} active={!!riskRes && !paraRes} />
      </div>

      {/* ── Formül Bandı ── */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-900 font-mono flex items-center gap-2">
        <span className="text-yellow-500 font-bold text-sm">ℹ</span>
        <span>Nd = Ng×Ae×C₁×10⁻⁶ | Nc = 5.5×10⁻³/C | E = 1−Nc/Nd | Rp = √(h(2D−h)+ΔL(2D+ΔL))</span>
      </div>

      {/* ── Giriş: Bina + Td + C faktörleri ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sol: Bina boyutları + İl seçimi */}
        <div className="space-y-4">

          {/* Bina */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-4">Bina Boyutları</div>
            <div className="grid grid-cols-3 gap-3">
              {[['L (m)', l, setL],['W (m)', w, setW],['H (m)', h, setH]].map(([lbl,val,setter]) => (
                <div key={lbl}>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lbl}</div>
                  <NumInput value={val} onChange={v => { if(v>0) setter(v); }} min="1" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold text-base outline-none focus:border-yellow-400 text-slate-800"/>
                </div>
              ))}
            </div>
          </div>

          {/* İl / Td */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Orajlı Gün (Td)</div>
              {seciliIl ? (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${tdColor(seciliIl.td).bg} ${tdColor(seciliIl.td).text} border ${tdColor(seciliIl.td).border}`}>
                  <span className="text-xs font-bold">{seciliIl.il}</span>
                  <span className="font-mono font-black text-xs">Td={seciliIl.td}</span>
                  <button onClick={() => setSeciliIl(null)} className="ml-1 opacity-60 hover:opacity-100 text-sm leading-none">×</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <NumInput value={manuelTd} onChange={v => { if(v>0) setManuelTd(v); }} min="1" className="w-20 border border-slate-200 rounded-lg px-2 py-1 font-mono font-black text-yellow-500 text-sm outline-none focus:border-yellow-400"/>
                  <span className="text-xs text-slate-400">gün</span>
                </div>
              )}
            </div>

            {/* Bölge filtreleri */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={() => setBolgeFilter('')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${!bolgeFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                Tümü
              </button>
              {BOLGELER.map(b => (
                <button key={b} onClick={() => setBolgeFilter(bolgeFilter===b ? '' : b)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${bolgeFilter===b ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {b.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Arama */}
            <input type="text" placeholder="İl ara..." value={arama} onChange={e => setArama(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400 mb-3 bg-slate-50"
            />

            {/* İl grid */}
            <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
              {filteredIller.map(il => {
                const c = tdColor(il.td);
                const sel = seciliIl?.il === il.il;
                return (
                  <button key={il.il} onClick={() => setSeciliIl(il)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      sel ? 'bg-slate-800 text-white' : `${c.bg} ${c.text} hover:opacity-80`
                    }`}>
                    <span className="text-[10px] font-bold truncate">{il.il}</span>
                    <span className="font-mono font-black text-xs ml-1 flex-shrink-0">{il.td}</span>
                  </button>
                );
              })}
            </div>

            {/* Legant */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[['≤8','bg-blue-100 text-blue-700','Çok az'],['≤12','bg-green-100 text-green-700','Az'],
                ['≤16','bg-yellow-100 text-yellow-800','Orta'],['≤20','bg-orange-100 text-orange-700','Fazla'],
                ['22+','bg-red-100 text-red-700','Çok fazla']].map(([r,c,l]) => (
                <span key={r} className={`px-2 py-0.5 rounded text-[9px] font-bold ${c}`}>{l} ({r})</span>
              ))}
            </div>

            {/* Seçili Td özet */}
            <div className={`mt-3 p-2 rounded-lg text-center font-mono font-black text-sm ${tdColor(td).bg} ${tdColor(td).text}`}>
              Td = {td} gün/yıl — {tdYogunluk(td)}
            </div>
          </div>
        </div>

        {/* Sağ: C Faktörleri */}
        <div className="bg-white border rounded-xl p-5 shadow-sm space-y-5">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">C Faktörleri</div>

          <SelGrp label="C₁ — Konum (Çevre Yapılar)" options={C1} selected={c1idx} onChanged={setC1idx} color="blue" />

          {/* C2 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500">C₂ — Çatı & Yapı Tipi</span>
              <span className="bg-orange-100 text-orange-600 font-mono font-black text-xs px-2 py-0.5 rounded">C₂ = {c2val}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-slate-400 mb-1.5">Çatı</div>
                {CATI_LABELS.map((l,i) => (
                  <RadioRow key={i} label={l} active={catiTip===i} onTap={() => setCatiTip(i)} color="orange" />
                ))}
              </div>
              <div>
                <div className="text-[9px] text-slate-400 mb-1.5">Yapı</div>
                {YAPI_LABELS.map((l,i) => (
                  <RadioRow key={i} label={l} active={yapiTip===i} onTap={() => setYapiTip(i)} color="orange" />
                ))}
              </div>
            </div>
          </div>

          <SelGrp label="C₃ — İçerik Değeri"  options={C3} selected={c3idx} onChanged={setC3idx} color="violet" />
          <SelGrp label="C₄ — İnsan Faktörü"  options={C4} selected={c4idx} onChanged={setC4idx} color="red" />
          <SelGrp label="C₅ — Çevre Etkisi"   options={C5} selected={c5idx} onChanged={setC5idx} color="green" />
        </div>
      </div>

      {/* ── Adım 1 Butonu ── */}
      <button onClick={hesaplaRisk}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 20h20M7 20V8l5-5 5 5v12"/><rect x="10" y="14" width="4" height="6"/></svg>
        ADIM 1 — KORUMA SINIFINI BELİRLE
      </button>

      {/* ── Risk Sonucu ── */}
      {riskRes && (
        <div className="space-y-4">
          {/* Karar Banner */}
          <div className={`p-5 rounded-xl border-2 flex items-center gap-4 ${
            riskRes.gerekli ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400'
          }`}>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
              riskRes.gerekli ? 'bg-red-500' : 'bg-green-500'
            }`}>
              {riskRes.gerekli ? '⚡' : '✓'}
            </div>
            <div className="flex-1">
              <div className={`text-lg font-black ${riskRes.gerekli ? 'text-red-700' : 'text-green-700'}`}>
                {riskRes.gerekli ? 'YILDIRIM KORUMASI GEREKLİ!' : 'Koruma Gerekmiyor'}
              </div>
              <div className={`text-sm font-bold mt-1 ${riskRes.gerekli ? 'text-red-600' : 'text-green-600'}`}>
                {riskRes.gerekli
                  ? `Gerekli Seviye: ${riskRes.sev}  |  E = ${(riskRes.e*100).toFixed(1)}%`
                  : 'Nd ≤ Nc — Aktif koruma sistemi gerekmez.'}
              </div>
            </div>
            {riskRes.gerekli && riskRes.sevKod && (
              <div className="bg-red-600 text-white font-mono font-black text-2xl px-4 py-3 rounded-xl flex-shrink-0">
                {riskRes.sevKod}
              </div>
            )}
          </div>

          {/* 3 Metrik Kart */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Beklenen Darbe (Nd)" value={riskRes.nd.toExponential(3)} sub="darbe/yıl" color="orange" />
            <MetricCard label="Kabul Edilebilir (Nc)" value={riskRes.nc.toExponential(3)} sub="darbe/yıl" color="blue" />
            <MetricCard label="Ng (km²/yıl)" value={riskRes.ng.toFixed(2)} sub="darbe/km²/yıl" color="violet" />
          </div>

          {/* Hesap Detayı */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Hesap Detayı</div>
            <div className="space-y-1.5 font-mono text-sm">
              {[
                ['Td (Orajlı Gün)',      `${td} gün/yıl`],
                ['Ng = 0.04×Td¹·²⁵',    `${riskRes.ng.toFixed(2)} darbe/km²/yıl`],
                ['Ae (Eşdeğer Alan)',    `${riskRes.ae.toFixed(0)} m²`],
                ['C₁',                  `${riskRes.c1v}`],
                ['C₂×C₃×C₄×C₅ = C',   `${riskRes.c2v}×${riskRes.c3v}×${riskRes.c4v}×${riskRes.c5v} = ${riskRes.cval.toFixed(2)}`],
                ['Nd = Ng×Ae×C₁×10⁻⁶', `${riskRes.nd.toExponential(3)} darbe/yıl`],
                ['Nc = 5.5×10⁻³ / C',  `${riskRes.nc.toExponential(3)} darbe/yıl`],
                ['Nd > Nc ?',           riskRes.gerekli ? 'EVET → Koruma Gerekli' : 'HAYIR → Gerekmez'],
                ...(riskRes.gerekli ? [['E = 1 − Nc/Nd', `${(riskRes.e*100).toFixed(2)}%  →  ${riskRes.sev}`]] : []),
              ].map(([l,v]) => (
                <div key={l} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500 font-medium w-52">{l}</span>
                  <span className="text-slate-800 font-bold">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Adım 2: Paratoner Parametreleri ── */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-5 space-y-4">
            <div className="text-[10px] font-black text-yellow-800 uppercase tracking-wider">Adım 2 — Aktif Paratoner Parametreleri</div>

            {/* Seviye göstergesi + override */}
            <div className="bg-white rounded-xl border border-yellow-200 p-3 flex items-center gap-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <div className="flex-1">
                <div className="text-xs font-bold text-yellow-700">Koruma Seviyesi: {aktifSevLabel}</div>
                <div className="text-[9px] text-slate-400 font-mono">
                  D = {SEV_D[aktifSevKod]} m  |  {sevOverride ? 'Manuel seçim' : 'Risk analizinden otomatik'}
                </div>
              </div>
              <div className="flex gap-1">
                {['I','II','III','IV'].map(s => (
                  <button key={s} onClick={() => setSevOverride(sevOverride===s ? '' : s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors ${
                      aktifSevKod===s ? 'bg-yellow-400 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-yellow-400'
                    }`}>{s}</button>
                ))}
              </div>
            </div>

            {/* h ve ΔT */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Paratoner Montaj Yüksekliği (h)</div>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden focus-within:border-yellow-400 bg-white">
                  <NumInput value={hPara} onChange={v => { if(v>=0) setHPara(v); }} min="0" className="flex-1 px-2.5 py-2 font-mono font-bold text-base outline-none bg-white text-slate-800 w-0"/>
                  <span className="px-2 text-xs font-bold text-slate-400 border-l bg-slate-50 self-center">m</span>
                </div>
                <div className="text-[9px] text-slate-400 mt-1">Bina çatısından itibaren</div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Erken İyonlama Süresi (ΔT)</div>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden focus-within:border-yellow-400 bg-white">
                  <NumInput value={deltaT} onChange={v => { if(v>=0) setDeltaT(v); }} min="0" className="flex-1 px-2.5 py-2 font-mono font-bold text-base outline-none bg-white text-slate-800 w-0"/>
                  <span className="px-2 text-xs font-bold text-slate-400 border-l bg-slate-50 self-center">μs</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[[25,'ESE T1'],[60,'ESE T2'],[110,'ESE T3']].map(([v,lbl]) => (
                    <button key={v} onClick={() => setDeltaT(v)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${
                        Math.abs(deltaT-v)<5 ? 'bg-yellow-400 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:border-yellow-400'
                      }`}>{lbl} ({v}μs)</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Canlı ESE Tip */}
            <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center gap-2 text-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span className="text-slate-500">Seçilen ΔT için önerilen tip:</span>
              <span className="font-bold text-slate-800">{eseTipLive.kod} — {eseTipLive.aciklama}</span>
            </div>
          </div>

          {/* ── Adım 2 Butonu ── */}
          <button onClick={hesaplaPara}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
            ADIM 2 — PARATONER HESAPLA VE ÖNERİ AL
          </button>
        </div>
      )}

      {/* ── Paratoner Sonucu ── */}
      {paraRes && (
        <div className="space-y-4">

          {/* Rp Ana Kartı */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-5">
            <div className="text-[10px] font-black text-yellow-800 uppercase tracking-wider mb-4">Koruma Yarıçapı (Rp)</div>
            <div className="flex flex-wrap gap-6 items-start">
              <div>
                <div className="font-mono font-black text-5xl text-yellow-500">
                  {paraRes.rp.toFixed(2)} <span className="text-2xl font-bold">m</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  h={paraRes.hPara.toFixed(1)} m | ΔT={paraRes.deltaT.toFixed(0)} μs | D={paraRes.d} m ({aktifSevLabel})
                </div>
              </div>
              <div className="bg-white border border-yellow-200 rounded-xl p-3 text-xs">
                <div className="text-[9px] text-slate-400 font-bold mb-1">NF C 17-102 Formülü:</div>
                <div className="font-mono font-bold text-yellow-600 mb-0.5">
                  {paraRes.hPara >= 5 ? 'Rp = √(h(2D−h)+ΔL(2D+ΔL))' : 'Rp = (h/5)×Rp₅  (h<5m)'}
                </div>
                <div className="font-mono text-slate-400">ΔL = ΔT × 1 m/μs = {paraRes.dL.toFixed(0)} m</div>
              </div>
            </div>

            {/* Bina Kaplama Analizi */}
            <div className={`mt-4 p-4 rounded-xl border-2 flex items-center gap-3 ${
              paraRes.tekYeter ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
            }`}>
              <span className="text-2xl">{paraRes.tekYeter ? '✓' : '⚠'}</span>
              <div>
                <div className={`font-bold text-sm ${paraRes.tekYeter ? 'text-green-700' : 'text-red-700'}`}>
                  {paraRes.tekYeter ? 'Tek paratoner yeterli' : `${paraRes.onerilen_n} adet paratoner veya kafes sistemi gerekli`}
                </div>
                <div className={`text-xs mt-0.5 ${paraRes.tekYeter ? 'text-green-600' : 'text-red-600'}`}>
                  Rp = {paraRes.rp.toFixed(1)} m {paraRes.tekYeter ? '≥' : '<'} Bina köşegeni/2 = {paraRes.binaDiagonal.toFixed(1)} m
                </div>
              </div>
            </div>
          </div>

          {/* ESE Öneri Kartı */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="text-[11px] font-black text-yellow-400 uppercase tracking-wider">Paratoner Önerisi</span>
            </div>
            <div className="bg-yellow-400/15 border border-yellow-400/40 rounded-xl p-3 inline-flex items-center gap-3 mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fbbf24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <div>
                <div className="font-mono font-black text-yellow-400 text-lg">{paraRes.eseTipKod}</div>
                <div className="text-xs text-white/70">{paraRes.eseTipAciklamasi}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {paraRes.oneri.split('\n').map((line, i) => (
                <div key={i} className="text-sm text-white/90 font-medium">{line}</div>
              ))}
            </div>
          </div>

          {/* Faraday Kafes */}
          {riskRes?.gerekli && riskRes.sev && FARADAY[riskRes.sev] && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-4">
                Faraday Kafes Kriterleri — {riskRes.sev}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'İniş İletkeni', value:`${FARADAY[riskRes.sev].inis} m`, sub:'maks. aralık', color:'text-blue-700 bg-blue-50 border-blue-200'},
                  {label:'Koruma Küresi', value:`${FARADAY[riskRes.sev].kure} m`, sub:'yuvarlanma r', color:'text-violet-700 bg-violet-50 border-violet-200'},
                  {label:'Kafes Boyutu', value:FARADAY[riskRes.sev].kafes, sub:'örgü aralığı', color:'text-green-700 bg-green-50 border-green-200'},
                ].map(f => (
                  <div key={f.label} className={`p-4 rounded-xl border text-center ${f.color}`}>
                    <div className="text-[9px] font-bold opacity-70 mb-2">{f.label}</div>
                    <div className="font-mono font-black text-xl">{f.value}</div>
                    <div className="text-[9px] text-slate-400 mt-1">{f.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Alt Bileşenler ───────────────────────────────────────────────────────────
function StepDot({ no, label, done, active }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white transition-colors ${
        done ? 'bg-yellow-400' : active ? 'bg-orange-500' : 'bg-slate-200'
      }`}>
        {done ? '✓' : no}
      </div>
      <span className={`text-[9px] font-bold whitespace-nowrap ${done||active ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  const cls = {
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    blue:   'bg-blue-50 border-blue-200 text-blue-600',
    violet: 'bg-violet-50 border-violet-200 text-violet-600',
  }[color];
  return (
    <div className={`p-4 rounded-xl border-2 ${cls}`}>
      <div className="text-[8px] font-bold opacity-70 uppercase tracking-wider mb-2">{label}</div>
      <div className="font-mono font-black text-lg">{value}</div>
      <div className="text-[9px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

function SelGrp({ label, options, selected, onChanged, color }) {
  const cls = {
    blue:   {active:'border-blue-500 bg-blue-50',   dot:'bg-blue-500',   text:'text-blue-700'},
    violet: {active:'border-violet-500 bg-violet-50',dot:'bg-violet-500', text:'text-violet-700'},
    red:    {active:'border-red-500 bg-red-50',      dot:'bg-red-500',    text:'text-red-700'},
    green:  {active:'border-green-500 bg-green-50',  dot:'bg-green-500',  text:'text-green-700'},
  }[color];
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 mb-2">{label}</div>
      {options.map((opt, i) => (
        <button key={i} onClick={() => onChanged(i)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border mb-1.5 text-left transition-all ${
            selected===i ? `${cls.active} border-2` : 'bg-white border-slate-200 hover:border-slate-300'
          }`}>
          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected===i ? `border-transparent ${cls.dot}` : 'border-slate-300'
          }`}>
            {selected===i && <div className="w-1.5 h-1.5 bg-white rounded-full"/>}
          </div>
          <span className={`text-xs font-medium ${selected===i ? cls.text : 'text-slate-600'}`}>{opt.label}</span>
          <span className="ml-auto font-mono text-[10px] font-bold text-slate-400">×{opt.value}</span>
        </button>
      ))}
    </div>
  );
}

function RadioRow({ label, active, onTap, color }) {
  const cls = {
    orange: {active:'border-orange-500 bg-orange-50 text-orange-700', dot:'bg-orange-500'},
  }[color] ?? {active:'border-slate-500 bg-slate-50 text-slate-700', dot:'bg-slate-500'};
  return (
    <button onClick={onTap}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border mb-1 text-left transition-all ${
        active ? `${cls.active} border` : 'bg-white border-slate-200'
      }`}>
      <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${active ? `border-transparent ${cls.dot}` : 'border-slate-300'}`}/>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
