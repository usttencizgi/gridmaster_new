import { useState } from 'react';
import NumInput from '../components/NumInput.jsx';

// ─── Limitler (TEDAŞ) ─────────────────────────────────────────────────────────
const LIMIT_ISLETME  = 2.0;
const LIMIT_KORUMA   = 4.0;
const LIMIT_TEMEL    = 5.0;
const LIMIT_DIREK_OG = 10.0;
const LIMIT_DIREK_AG = 30.0;

// ─── Standart iletken kesitleri (mm²) — IEC 60364-5-54 ───────────────────────
const KESITLER = [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300];

// ─── k Grupları — IEC 60364-5-54 ─────────────────────────────────────────────
const GROUP1 = [
  { key:'Cu_cıplak', label:'Bakır (Cu)',     k:159, minMm2:25 },
  { key:'Al_cıplak', label:'Alüminyum (Al)', k:105, minMm2:35 },
  { key:'Fe_cıplak', label:'Çelik (Fe)',     k: 58, minMm2:50 },
];
const GROUP2 = [
  { key:'Cu_PVC',  label:'Bakır',     iso:'PVC (160°C)',       k:143, minMm2:16 },
  { key:'Al_PVC',  label:'Alüminyum', iso:'PVC (160°C)',       k: 95, minMm2:16 },
  { key:'Fe_PVC',  label:'Çelik',     iso:'PVC (160°C)',       k: 52, minMm2:16 },
  { key:'Cu_XLPE', label:'Bakır',     iso:'XLPE/EPR (250°C)',  k:176, minMm2:16 },
  { key:'Al_XLPE', label:'Alüminyum', iso:'XLPE/EPR (250°C)',  k:116, minMm2:16 },
  { key:'Fe_XLPE', label:'Çelik',     iso:'XLPE/EPR (250°C)',  k: 64, minMm2:16 },
  { key:'Cu_IIK',  label:'Bakır',     iso:'Bütilkauçuk (220°C)',k:166,minMm2:16 },
  { key:'Al_IIK',  label:'Alüminyum', iso:'Bütilkauçuk (220°C)',k:110,minMm2:16 },
  { key:'Fe_IIK',  label:'Çelik',     iso:'Bütilkauçuk (220°C)',k: 60,minMm2:16 },
];
const GROUP3 = [
  { key:'Cu_kPVC',  label:'Bakır',     iso:'PVC',        temp:'70→160°C', k:115, minMm2:16 },
  { key:'Al_kPVC',  label:'Alüminyum', iso:'PVC',        temp:'70→160°C', k: 76, minMm2:16 },
  { key:'Cu_kXLPE', label:'Bakır',     iso:'XLPE/EPR',   temp:'90→250°C', k:143, minMm2:16 },
  { key:'Al_kXLPE', label:'Alüminyum', iso:'XLPE/EPR',   temp:'90→250°C', k: 94, minMm2:16 },
  { key:'Cu_kIIK',  label:'Bakır',     iso:'Bütilkauçuk',temp:'85→220°C', k:134, minMm2:16 },
  { key:'Al_kIIK',  label:'Alüminyum', iso:'Bütilkauçuk',temp:'85→220°C', k: 89, minMm2:16 },
];
const ALL_K = Object.fromEntries([...GROUP1,...GROUP2,...GROUP3].map(e=>[e.key,e.k]));
const ALL_MIN = Object.fromEntries([...GROUP1,...GROUP2,...GROUP3].map(e=>[e.key,e.minMm2]));

// ─── Formüller ────────────────────────────────────────────────────────────────
const calcKazikR  = (rho,L,d)  => (L<=0||d<=0) ? 9999 : (rho/(2*Math.PI*L))*Math.log(4*L/d);
const calcSeritR  = (rho,l,dP) => (l<=0||dP<=0)? 9999 : (rho/(Math.PI*l))*Math.log(2*l/dP);
const parallelN   = (rTek,n)   => n>0 ? rTek/n : rTek;
const paralel     = (r1,r2)    => (r1*r2)/(r1+r2);

// ─── Standart kesit seçimi ────────────────────────────────────────────────────
function nextKesit(sGer) {
  return KESITLER.find(s => s >= sGer) ?? KESITLER[KESITLER.length-1];
}

// ─── Toprak özdirenç presets ──────────────────────────────────────────────────
const RHO_PRESETS = [
  { l:'Humuslu\n30',  v:30   },
  { l:'Killi\n50',    v:50   },
  { l:'Nemli kum\n100',v:100 },
  { l:'Kuru kum\n300', v:300 },
  { l:'Kaya\n1000',   v:1000 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ORTAK ALT BİLEŞENLER
// ═══════════════════════════════════════════════════════════════════════════════

function Label({ children }) {
  return <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{children}</div>;
}

function Counter({ value, onChange, min=1, max=20 }) {
  return (
    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
      <button onClick={() => value>min && onChange(value-1)}
        className={`w-9 h-9 flex items-center justify-center font-bold text-lg transition-colors ${value>min?'bg-emerald-50 text-emerald-700 hover:bg-emerald-100':'bg-slate-50 text-slate-300'}`}>−</button>
      <div className="w-12 text-center font-mono font-black text-base text-slate-800 border-x border-slate-200">{value}</div>
      <button onClick={() => value<max && onChange(value+1)}
        className={`w-9 h-9 flex items-center justify-center font-bold text-lg transition-colors ${value<max?'bg-emerald-50 text-emerald-700 hover:bg-emerald-100':'bg-slate-50 text-slate-300'}`}>+</button>
    </div>
  );
}

function RhoBox({ value, onChange }) {
  return (
    <div>
      <Label>Toprak Özdirenç (ρ)</Label>
      <NumInput value={value} onChange={onChange} unit="Ω·m" step={10} min={1} />
      <div className="flex gap-1.5 mt-2 flex-wrap">
        {RHO_PRESETS.map(p => (
          <button key={p.v} onClick={() => onChange(p.v)}
            className={`px-2 py-1 rounded text-[9px] font-bold leading-tight text-center transition-colors ${
              Math.abs(p.v-value)<0.1
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-400'
            }`}>
            {p.l.split('\n').map((line,i) => <span key={i} className="block">{line}</span>)}
          </button>
        ))}
      </div>
    </div>
  );
}

function CalcButton({ onClick }) {
  return (
    <button onClick={onClick}
      className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
      HESAPLA
    </button>
  );
}

function ResultCard({ r, limit, title }) {
  const pass = r <= limit;
  return (
    <div className={`p-5 rounded-xl border-2 ${pass ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
      <div className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${pass?'text-emerald-700':'text-red-600'}`}>{title}</div>
      <div className={`font-mono font-black text-4xl ${pass?'text-emerald-700':'text-red-600'}`}>{r.toFixed(3)} <span className="text-xl font-bold">Ω</span></div>
      <div className={`flex items-center gap-1.5 mt-2 text-sm font-bold ${pass?'text-emerald-700':'text-red-600'}`}>
        <span>{pass ? '✓' : '✗'}</span>
        <span>{pass ? `Uygun (≤ ${limit} Ω)` : `UYGUN DEĞİL (> ${limit} Ω)`}</span>
      </div>
    </div>
  );
}

function MiniCard({ label, r, color='text-blue-600 bg-blue-50 border-blue-200' }) {
  return (
    <div className={`p-3 rounded-xl border ${color}`}>
      <div className="text-[9px] font-bold opacity-70 mb-1">{label}</div>
      <div className="font-mono font-black text-lg">{r.toFixed(3)} Ω</div>
    </div>
  );
}

function FormulaBox({ rows }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Hesap Detayı</div>
      <div className="space-y-1">
        {rows.map(([l,v]) => (
          <div key={l} className="flex justify-between py-1 border-b border-slate-100 last:border-0 text-sm font-mono">
            <span className="text-slate-500 font-medium">{l}</span>
            <span className="text-slate-800 font-bold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoBanner({ text }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 font-mono mb-4 flex items-center gap-2">
      <span className="text-emerald-400 font-bold text-sm">ℹ</span>
      <span>{text}</span>
    </div>
  );
}

function Card({ children }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">{children}</div>;
}

function SectionTitle({ children }) {
  return <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">{children}</h3>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Topraklama() {
  const [tab, setTab] = useState(0);

  const tabs = [
    { label:'İşletme', icon:'⚓' },
    { label:'Koruma',  icon:'🛡' },
    { label:'Temel',   icon:'🏗' },
    { label:'Direk',   icon:'⚡' },
    { label:'İletken', icon:'🔌' },
  ];

  return (
    <div className="space-y-4 max-w-4xl">

      {/* ── Header ── */}
      <div className="bg-white p-5 rounded-xl shadow-sm border flex items-center gap-4">
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 22V12"/><path d="M5 12H19"/><path d="M8 16H16"/><path d="M10 20H14"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Topraklama Hesapları</h2>
          <p className="text-sm text-slate-500">TEDAŞ Yönetmeliği — IEC 60364 / TS EN 50522</p>
        </div>
      </div>

      {/* ── Sekmeler ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex gap-1">
        {tabs.map((t,i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
              tab===i
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}>
            <span className="text-sm">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab İçerikleri ── */}
      {tab === 0 && <IsletmeTab />}
      {tab === 1 && <KorumaTab />}
      {tab === 2 && <TemelTab />}
      {tab === 3 && <DirekTab />}
      {tab === 4 && <IletkenTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — İŞLETME TOPRAKLAMASI  (R ≤ 2 Ω)
// Rç_tek = ρ/(2πL) × ln(4L/d)
// Rç = Rç_tek / n
// ═══════════════════════════════════════════════════════════════════════════════
function IsletmeTab() {
  const [rho, setRho] = useState(50);
  const [L,   setL]   = useState(2.0);
  const [d,   setD]   = useState(0.082);
  const [n,   setN]   = useState(4);
  const [res, setRes] = useState(null);

  const hesapla = () => {
    const rTek = calcKazikR(rho, L, d);
    const rTop = parallelN(rTek, n);
    setRes({ rTek, rTop });
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Trafo İşletme Topraklaması</SectionTitle>
        <InfoBanner text="TEDAŞ — R ≤ 2 Ω  |  Rç = ρ/(2πL) × ln(4L/d)" />
        <div className="space-y-4">
          <RhoBox value={rho} onChange={setRho} />
          <div className="border-t pt-4">
            <Label>Topraklama Kazıkları / Çubukları</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>Boy (L)</Label>
                <NumInput value={L} onChange={setL} unit="m" step={0.5} min={0.5} />
              </div>
              <div>
                <Label>Eşd. Çapı (d)</Label>
                <NumInput value={d} onChange={setD} unit="m" step={0.001} min={0.001} />
                <div className="text-[9px] text-slate-400 mt-1">65×65×7 L-profil → 0.082 m</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Kazık Sayısı (n)</Label>
            <Counter value={n} onChange={setN} />
          </div>
          <CalcButton onClick={hesapla} />
        </div>
      </Card>

      {res && (
        <div className="space-y-3">
          <ResultCard r={res.rTop} limit={LIMIT_ISLETME} title="İşletme Topraklama Direnci" />
          <FormulaBox rows={[
            ['ρ (Ω·m)', rho.toString()],
            ['L (m)', L.toFixed(2)],
            ['d (m)', d.toFixed(4)],
            ['n (adet)', n.toString()],
            ['Rç_tek = ρ/(2πL)×ln(4L/d)', `${res.rTek.toFixed(4)} Ω`],
            ['Rç = Rç_tek / n', `${res.rTop.toFixed(4)} Ω`],
            ['Sınır (TEDAŞ)', `≤ ${LIMIT_ISLETME} Ω`],
          ]} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — KORUMA TOPRAKLAMASI  (R ≤ 4 Ω)
// R_şerit = ρ/(π×l) × ln(2l/d')
// Rç_tek  = ρ/(2πL) × ln(4L/d)
// Rç_n    = Rç_tek / n
// R_top   = paralel(R_şerit, Rç_n)
// ═══════════════════════════════════════════════════════════════════════════════
function KorumaTab() {
  const [rho,    setRho]    = useState(50);
  const [seritL, setSeritL] = useState(10);
  const [seritD, setSeritD] = useState(0.00175);
  const [kazikL, setKazikL] = useState(2.0);
  const [kazikD, setKazikD] = useState(0.082);
  const [kazikN, setKazikN] = useState(1);
  const [res,    setRes]    = useState(null);

  const hesapla = () => {
    const rS  = calcSeritR(rho, seritL, seritD);
    const rK  = calcKazikR(rho, kazikL, kazikD);
    const rKn = parallelN(rK, kazikN);
    const rT  = paralel(rS, rKn);
    setRes({ rS, rK, rKn, rT });
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Trafo Koruma Topraklaması</SectionTitle>
        <InfoBanner text="TEDAŞ — R ≤ 4 Ω  |  1/Re = 1/R_şerit + 1/R_kazık" />
        <div className="space-y-4">
          <RhoBox value={rho} onChange={setRho} />

          <div className="border-t pt-4">
            <Label>Topraklama Şeridi</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>Uzunluk (l)</Label>
                <NumInput value={seritL} onChange={setSeritL} unit="m" step={1} min={1} />
              </div>
              <div>
                <Label>d' (kısa kenar/2)</Label>
                <NumInput value={seritD} onChange={setSeritD} unit="m" step={0.0001} min={0.0001} />
                <div className="text-[9px] text-slate-400 mt-1">30×3.5 → d'=0.00175 m</div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label>Topraklama Kazıkları</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>Boy (L)</Label>
                <NumInput value={kazikL} onChange={setKazikL} unit="m" step={0.5} min={0.5} />
              </div>
              <div>
                <Label>Eşd. Çapı (d)</Label>
                <NumInput value={kazikD} onChange={setKazikD} unit="m" step={0.001} min={0.001} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Label>Kazık Sayısı (n)</Label>
              <Counter value={kazikN} onChange={setKazikN} />
            </div>
          </div>

          <CalcButton onClick={hesapla} />
        </div>
      </Card>

      {res && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MiniCard label={`Şerit (Rᵢ)`} r={res.rS} color="text-blue-700 bg-blue-50 border-blue-200" />
            <MiniCard label={`Kazık ×${kazikN} (Rç)`} r={res.rKn} color="text-orange-600 bg-orange-50 border-orange-200" />
          </div>
          <ResultCard r={res.rT} limit={LIMIT_KORUMA} title="Koruma Topraklama Direnci (Paralel)" />
          <FormulaBox rows={[
            ['ρ (Ω·m)', rho.toString()],
            ["R_şerit = ρ/(πl)×ln(2l/d')", `${res.rS.toFixed(4)} Ω`],
            ['Rç_tek (Ω)', res.rK.toFixed(4)],
            [`Rç / ${kazikN}`, `${res.rKn.toFixed(4)} Ω`],
            ['1/Re = 1/Rᵢ + 1/Rç', `${res.rT.toFixed(4)} Ω`],
            ['Sınır (TEDAŞ)', `≤ ${LIMIT_KORUMA} Ω`],
          ]} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — TEMEL TOPRAKLAMASI  (R ≤ 5 Ω)
// ① A = (a+2) × (b+2)
// ② D = 1.13 × √A
// ③ R_ring = 2ρ / (π × D)
// ④ R₁ = ρ/(2πL) × ln(4L/d)
// ⑤ R_cub = (R₁/n) × η
// ⑥ R_t = paralel(R_ring, R_cub)
// ═══════════════════════════════════════════════════════════════════════════════
function TemelTab() {
  const [rho, setRho] = useState(50);
  const [a,   setA]   = useState(2.5);
  const [b,   setB]   = useState(5.0);
  const [L,   setL]   = useState(2.0);
  const [d,   setD]   = useState(0.082);
  const [n,   setN]   = useState(4);
  const [eta, setEta] = useState(1.15);
  const [res, setRes] = useState(null);

  // Canlı ön hesap
  const aLive = (a+2)*(b+2);
  const dLive = 1.13*Math.sqrt(aLive);

  const hesapla = () => {
    const alan  = (a+2)*(b+2);
    const D     = 1.13*Math.sqrt(alan);
    const rRing = (2*rho)/(Math.PI*D);
    const r1    = calcKazikR(rho,L,d);
    const rCubs = (r1/n)*eta;
    const rTop  = paralel(rRing, rCubs);
    setRes({ alan, D, rRing, r1, rCubs, rTop });
  };

  return (
    <div className="space-y-4">

      {/* Formül adımları */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="text-[9px] font-black text-emerald-800 uppercase tracking-wider mb-3">Hesap Adımları</div>
        <div className="space-y-2">
          {[
            ['①', 'A = (a+2) × (b+2)',              'Ring alanı (1 m dışarıda kanal)'],
            ['②', 'D = 1.13 × √A',                   'Eşdeğer çap'],
            ['③', 'R_ring = 2ρ / (π × D)',            'Ring direnci'],
            ['④', 'R₁ = ρ/(2πL) × ln(4L/d)',          'Tek kazık direnci'],
            ['⑤', 'R_cub = (R₁/n) × η',               'n kazık + etkileşim katsayısı'],
            ['⑥', 'R_t = R_ring ∥ R_cub',             'Toplam paralel'],
          ].map(([num,f,desc]) => (
            <div key={num} className="flex items-start gap-2">
              <div className="w-5 h-5 bg-emerald-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[8px] text-white font-black">{num}</span>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold text-emerald-800">{f}</div>
                <div className="text-[9px] text-slate-500">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <SectionTitle>Beton Köşk Temel Topraklaması</SectionTitle>
        <InfoBanner text="TEDAŞ — R ≤ 5 Ω" />
        <div className="space-y-4">
          <RhoBox value={rho} onChange={setRho} />

          <div className="border-t pt-4">
            <Label>Beton Köşk Boyutları (kendi boyutu)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>Kısa Kenar (a)</Label>
                <NumInput value={a} onChange={setA} unit="m" step={0.5} min={0.5} />
              </div>
              <div>
                <Label>Uzun Kenar (b)</Label>
                <NumInput value={b} onChange={setB} unit="m" step={0.5} min={0.5} />
              </div>
            </div>
            {/* Canlı ring önizleme */}
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-mono text-emerald-700 font-bold">
              A = ({a.toFixed(1)}+2) × ({b.toFixed(1)}+2) = {aLive.toFixed(2)} m²
              &nbsp;→&nbsp; D = 1.13×√{aLive.toFixed(2)} = {dLive.toFixed(3)} m
            </div>
          </div>

          <div className="border-t pt-4">
            <Label>Topraklama Kazıkları (köşelere)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>Boy (L)</Label>
                <NumInput value={L} onChange={setL} unit="m" step={0.5} min={0.5} />
              </div>
              <div>
                <Label>Eşd. Çapı (d)</Label>
                <NumInput value={d} onChange={setD} unit="m" step={0.001} min={0.001} />
                <div className="text-[9px] text-slate-400 mt-1">65×65×7 → 0.082 m | Ø65 → 0.065 m</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Label>Kazık Sayısı (n)</Label>
              <Counter value={n} onChange={setN} />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Etkileşim Katsayısı (η)</Label>
                <NumInput value={eta} onChange={setEta} unit="" step={0.05} min={1.0} />
                <div className="text-[9px] text-slate-400 mt-1">Standart: 1.15</div>
              </div>
            </div>
          </div>

          <CalcButton onClick={hesapla} />
        </div>
      </Card>

      {res && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MiniCard label="R_ring" r={res.rRing} color="text-blue-700 bg-blue-50 border-blue-200" />
            <MiniCard label={`R_cub (×${n}, η=${eta.toFixed(2)})`} r={res.rCubs} color="text-orange-600 bg-orange-50 border-orange-200" />
          </div>
          <ResultCard r={res.rTop} limit={LIMIT_TEMEL} title="Toplam Temel Topraklama Direnci" />
          <FormulaBox rows={[
            ['ρ (Ω·m)',            rho.toString()],
            ['a × b (m)',          `${a.toFixed(1)} × ${b.toFixed(1)}`],
            ['① A = (a+2)×(b+2)', `${res.alan.toFixed(3)} m²`],
            ['② D = 1.13×√A',     `${res.D.toFixed(4)} m`],
            ['③ R_ring = 2ρ/(π×D)',`${res.rRing.toFixed(4)} Ω`],
            ['④ R₁ = ρ/(2πL)×ln(4L/d)', `${res.r1.toFixed(4)} Ω`],
            [`⑤ R_cub = (R₁/${n})×${eta.toFixed(2)}`, `${res.rCubs.toFixed(4)} Ω`],
            ['⑥ R_t = R_ring ∥ R_cub', `${res.rTop.toFixed(4)} Ω`],
            ['Sınır (TEDAŞ)',      `≤ ${LIMIT_TEMEL} Ω`],
          ]} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — DİREK TOPRAKLAMASI
// OG ≤ 10 Ω  |  AG ≤ 30 Ω
// Rç_tek = ρ/(2πL) × ln(4L/d)
// R_top  = Rç_tek / n
// ═══════════════════════════════════════════════════════════════════════════════
function DirekTab() {
  const [tip, setTip] = useState('og');
  const [rho, setRho] = useState(50);
  const [L,   setL]   = useState(2.0);
  const [d,   setD]   = useState(0.082);
  const [n,   setN]   = useState(1);
  const [res, setRes] = useState(null);

  const limit = tip === 'og' ? LIMIT_DIREK_OG : LIMIT_DIREK_AG;

  const hesapla = () => {
    const rTek = calcKazikR(rho, L, d);
    const rTop = parallelN(rTek, n);
    setRes({ rTek, rTop });
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Direk Topraklaması</SectionTitle>
        <InfoBanner text="TEDAŞ — OG Direk ≤ 10 Ω  |  AG Direk ≤ 30 Ω" />
        <div className="space-y-4">

          <div>
            <Label>Direk Tipi</Label>
            <div className="flex gap-2">
              {[
                { v:'og', l:'OG Direk (≤ 10 Ω)' },
                { v:'ag', l:'AG Direk (≤ 30 Ω)' },
              ].map(t => (
                <button key={t.v} onClick={() => { setTip(t.v); setRes(null); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${
                    tip===t.v
                      ? 'bg-emerald-800 text-white'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-400'
                  }`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <RhoBox value={rho} onChange={setRho} />

          <div className="border-t pt-4">
            <Label>Topraklama Kazıkları</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>Boy (L)</Label>
                <NumInput value={L} onChange={setL} unit="m" step={0.5} min={0.5} />
              </div>
              <div>
                <Label>Eşd. Çapı (d)</Label>
                <NumInput value={d} onChange={setD} unit="m" step={0.001} min={0.001} />
                <div className="text-[9px] text-slate-400 mt-1">65×65×7 → 0.082 m</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Label>Kazık Sayısı (n)</Label>
              <Counter value={n} onChange={setN} />
            </div>
          </div>

          <CalcButton onClick={hesapla} />
        </div>
      </Card>

      {res && (
        <div className="space-y-3">
          <ResultCard r={res.rTop} limit={limit}
            title={`${tip==='og'?'OG':'AG'} Direk Topraklama Direnci`} />
          <FormulaBox rows={[
            ['ρ (Ω·m)',    rho.toString()],
            ['L (m)',      L.toFixed(2)],
            ['d (m)',      d.toFixed(4)],
            ['n (adet)',   n.toString()],
            ['Rç_tek (Ω)', res.rTek.toFixed(4)],
            ['R_top (Ω)',  res.rTop.toFixed(4)],
            ['Sınır',      `≤ ${limit} Ω (${tip.toUpperCase()} TEDAŞ)`],
          ]} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — TOPRAKLAMA İLETKEN KESİTİ
// IEC 60364-5-54  |  S = Ik × √t / k
// 3 Grup malzeme seçimi
// ═══════════════════════════════════════════════════════════════════════════════
function IletkenTab() {
  const [matKey, setMatKey] = useState('Cu_cıplak');
  const [ik,     setIk]     = useState(1000);
  const [t,      setT]      = useState(0.5);
  const [res,    setRes]     = useState(null);

  const hesapla = () => {
    const kVal   = ALL_K[matKey] ?? 159;
    const minMm2 = ALL_MIN[matKey] ?? 16;
    const sMin   = (ik * Math.sqrt(t)) / kVal;
    const sGer   = Math.max(sMin, minMm2);
    const sSec   = nextKesit(sGer);
    setRes({ sMin, minMm2, sGer, sSec, kVal });
  };

  const MatRow = ({ item }) => (
    <button onClick={() => { setMatKey(item.key); setRes(null); }}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all mb-1.5 ${
        matKey===item.key
          ? 'bg-emerald-50 border-emerald-500 border-2'
          : 'bg-white border-slate-200 hover:border-emerald-300'
      }`}>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        matKey===item.key ? 'border-emerald-600' : 'border-slate-300'
      }`}>
        {matKey===item.key && <div className="w-2 h-2 bg-emerald-600 rounded-full"/>}
      </div>
      <span className={`text-sm font-bold flex-1 ${matKey===item.key?'text-emerald-800':'text-slate-700'}`}>
        {item.label}
      </span>
      <span className={`font-mono text-xs font-bold ${matKey===item.key?'text-emerald-600':'text-slate-400'}`}>
        k={item.k} | min {item.minMm2} mm²
        {item.iso ? ` | ${item.iso}` : ''}
        {item.temp ? ` ${item.temp}` : ''}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Topraklama İletken Kesiti</SectionTitle>
        <InfoBanner text="IEC 60364-5-54  |  S = Ik × √t / k" />

        {/* Grup 1 */}
        <div className="mb-4">
          <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider mb-1">
            1 — Çıplak (Yalıtımsız) İletkenler
          </div>
          <div className="text-[9px] text-slate-400 mb-2">T_max = 200 °C</div>
          {GROUP1.map(e => <MatRow key={e.key} item={e} />)}
        </div>

        <div className="border-t my-3"/>

        {/* Grup 2 */}
        <div className="mb-4">
          <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider mb-2">
            2 — Ayrı Çekilmiş Yalıtılmış Koruma İletkeni
          </div>
          {[
            { subLabel:'PVC (160 °C)',        filter:(e) => e.key.includes('PVC') && !e.key.includes('k') },
            { subLabel:'XLPE / EPR (250 °C)', filter:(e) => e.key.includes('XLPE') },
            { subLabel:'Bütilkauçuk IIK (220 °C)', filter:(e) => e.key.includes('IIK') && !e.key.includes('k') },
          ].map(({subLabel,filter}) => (
            <div key={subLabel} className="mb-2">
              <div className="text-[9px] font-bold text-slate-500 mb-1.5 mt-2">{subLabel}</div>
              {GROUP2.filter(filter).map(e => <MatRow key={e.key} item={e} />)}
            </div>
          ))}
        </div>

        <div className="border-t my-3"/>

        {/* Grup 3 */}
        <div className="mb-4">
          <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider mb-2">
            3 — Çok Damarlı Kablo İçindeki Yalıtılmış Koruma İletkeni
          </div>
          {GROUP3.map(e => <MatRow key={e.key} item={e} />)}
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kısa Devre Akımı (Ik)</Label>
              <NumInput value={ik} onChange={setIk} unit="A" step={100} min={1} />
              <div className="text-[9px] text-slate-400 mt-1">OG/AG kısa devre hesabından</div>
            </div>
            <div>
              <Label>Koruma Açma Süresi (t)</Label>
              <NumInput value={t} onChange={setT} unit="s" step={0.05} min={0.01} />
              <div className="text-[9px] text-slate-400 mt-1">Koruma rölesi açma süresi</div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <CalcButton onClick={hesapla} />
        </div>
      </Card>

      {res && (
        <div className="space-y-3">
          {/* Seçilen Kesit */}
          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-5">
            <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Seçilen Kesit</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-black text-5xl text-emerald-800">{res.sSec}</span>
              <span className="text-xl font-bold text-emerald-600">mm²</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-sm font-bold text-emerald-700">
              <span>✓</span>
              <span>IEC 60364-5-54 ve TEDAŞ'a uygundur</span>
            </div>
          </div>

          {/* Kesit grid */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-3">Standart Kesitler (mm²)</div>
            <div className="flex flex-wrap gap-1.5">
              {KESITLER.map(s => {
                const isSel  = Math.abs(s-res.sSec)<0.1;
                const insuff = s < res.sGer - 0.01;
                return (
                  <div key={s}
                    className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-bold ${
                      isSel   ? 'bg-emerald-700 text-white' :
                      insuff  ? 'bg-slate-100 text-slate-300' :
                                'bg-white border border-slate-200 text-slate-600'
                    }`}>
                    {s%1===0?s:s}
                  </div>
                );
              })}
            </div>
          </div>

          <FormulaBox rows={[
            ['Ik (A)',           ik.toFixed(0)],
            ['t (s)',            t.toFixed(3)],
            ['k katsayısı',      res.kVal.toFixed(0)],
            ['S = Ik×√t / k',   `${res.sMin.toFixed(2)} mm²`],
            ['TEDAŞ min.',       `${res.minMm2.toFixed(0)} mm²`],
            ['Gerekli (max)',    `${res.sGer.toFixed(2)} mm²`],
            ['Seçilen standart', `${res.sSec.toFixed(0)} mm²`],
          ]} />
        </div>
      )}
    </div>
  );
}
