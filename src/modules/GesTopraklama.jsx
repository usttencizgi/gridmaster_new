import { useState } from 'react';
import NumInput from '../components/NumInput.jsx';

// ─── UTP Tablosu ─────────────────────────────────────────────────
const UTP_TABLE = [
  { t: 0.05, Utp: 900 }, { t: 0.10, Utp: 750 }, { t: 0.20, Utp: 500 },
  { t: 0.50, Utp: 200 }, { t: 1.00, Utp: 100 }, { t: 2.00, Utp: 75  },
  { t: 5.00, Utp: 70  }, { t: 10.0, Utp: 70  },
];
function getUtp(t) {
  if (t <= UTP_TABLE[0].t) return UTP_TABLE[0].Utp;
  if (t >= UTP_TABLE[UTP_TABLE.length-1].t) return UTP_TABLE[UTP_TABLE.length-1].Utp;
  for (let i = 0; i < UTP_TABLE.length-1; i++) {
    const a = UTP_TABLE[i], b = UTP_TABLE[i+1];
    if (t >= a.t && t <= b.t) {
      const ratio = (Math.log(t)-Math.log(a.t))/(Math.log(b.t)-Math.log(a.t));
      return Math.round(a.Utp + ratio*(b.Utp-a.Utp));
    }
  }
  return 100;
}

const R_SEL = [
  { label: 'Sadece havai hat',          r: 0.6  },
  { label: 'Karma (havai + yer altı)',  r: 0.45 },
  { label: 'Sadece yer altı kablo',     r: 0.3  },
];
const TOPRAK = [
  { label: 'Bataklık',        r: 30   },
  { label: 'Killi Toprak',    r: 100  },
  { label: 'Rutubetli Kum',   r: 200  },
  { label: 'Rutubetli Çakıl', r: 500  },
  { label: 'Kuru Kum/Çakıl', r: 1000 },
  { label: 'Taşlık Zemin',   r: 3000 },
];

// ─── Formüller (ETT Yönetmeliği sf.83) ───────────────────────────
function calcRg(rhoE, a, b, L) {
  const A = a * b;
  const D = Math.sqrt(4 * A / Math.PI);
  const Rg = (rhoE / (2 * D)) + (rhoE / L);
  return { Rg, D, A };
}
function calcRc(rhoE, n, Lc, dc) {
  const Rc_tek = (rhoE / (2 * Math.PI * Lc)) * Math.log(4 * Lc / dc);
  const Rç = Rc_tek / n;
  return { Rc_tek, Rç };
}
function paralelAll(Rs) {
  const inv = Rs.filter(r => r && isFinite(r) && r > 0).reduce((s, r) => s + 1/r, 0);
  return inv > 0 ? 1/inv : Infinity;
}
function calcBirim({ rhoE, seritAktif, a, b, L, kazikAktif, n, Lc, dc }) {
  let Rg = null, D = null, Rc_tek = null, Rç = null, Res = null;
  if (seritAktif && a > 0 && b > 0 && L > 0) {
    const g = calcRg(rhoE, a, b, L);
    Rg = g.Rg; D = g.D;
  }
  if (kazikAktif && n > 0 && Lc > 0 && dc > 0) {
    const c = calcRc(rhoE, n, Lc, dc);
    Rc_tek = c.Rc_tek; Rç = c.Rç;
  }
  // ETT Yönetmeliği sf.83:
  // Reş = (Rg×Rç)/(Rg+Rç) → sonra ×1.10 (müşterek etki)
  // Tek eleman varsa ×1.10 uygulanmaz
  if (Rg !== null && Rç !== null) {
    const ham = (Rg * Rç) / (Rg + Rç);
    Res = ham * 1.10;
  } else if (Rg !== null) {
    Res = Rg;
  } else if (Rç !== null) {
    Res = Rç;
  }
  return { Rg, D, Rc_tek, Rç, Res };
}

// ─── UI Bileşenleri ───────────────────────────────────────────────
function NI({ label, value, onChange, unit, step, min }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
      <NumInput value={value} onChange={onChange} unit={unit} step={step ?? 0.1} min={min ?? 0}/>
    </div>
  );
}

function Badge({ ok }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? '✓ UYGUN' : '✗ UYGUN DEĞİL'}
    </span>
  );
}

function SCard({ ok, label, val, op, lim, unit, sub }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-300'}`}>
      <div className="flex justify-between mb-2">
        <div>
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sub}</p>}
        </div>
        <Badge ok={ok}/>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 text-center rounded-lg px-3 py-2 border ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-[10px] text-slate-400 mb-0.5">Hesaplanan</div>
          <div className={`text-xl font-black font-mono ${ok ? 'text-green-700' : 'text-red-600'}`}>
            {typeof val === 'number' ? val.toFixed(2) : val} {unit}
          </div>
        </div>
        <div className={`text-xl font-black ${ok ? 'text-green-500' : 'text-red-400'}`}>{op}</div>
        <div className="flex-1 text-center rounded-lg px-3 py-2 bg-white border border-slate-200">
          <div className="text-[10px] text-slate-400 mb-0.5">Sınır</div>
          <div className="text-xl font-black font-mono text-slate-700">{lim} {unit}</div>
        </div>
      </div>
    </div>
  );
}

// G kesit eğrisi — G = k/√t, 4 farklı malzeme
// Kaynak: ETT Yönetmeliği / IEC 60364-5-54 Çizelge
const K_CURVES = [
  { k: 180, label: '1 — Galv. Çelik Şerit (k=180)', color: '#1e3a5f', dash: '' },
  { k: 143, label: '2 — XLPE Cu (k=143)',            color: '#3b82f6', dash: '6,3' },
  { k: 115, label: '3 — Çıplak Cu, PVC (k=115)',     color: '#10b981', dash: '3,3' },
  { k:  76, label: '4 — Al İletken (k=76)',           color: '#f59e0b', dash: '8,3,2,3' },
];

function GKesitGraph({ t, q_hesap, Ik1_A }) {
  const W=360, H=180, lx=55, rx=W-15, ty=12, by=H-28;
  const tMin=0.05, tMax=10, GMin=10, GMax=2000;

  const tx = tv => lx + (Math.log10(tv)-Math.log10(tMin))/(Math.log10(tMax)-Math.log10(tMin))*(rx-lx);
  const gy  = gv => by - (Math.log10(Math.max(gv,GMin))-Math.log10(GMin))/(Math.log10(GMax)-Math.log10(GMin))*(by-ty);

  const tGrid = [0.06,0.08,0.1,0.2,0.4,0.6,0.8,1,2,4,6,8,10];
  const gGrid = [10,20,40,60,80,100,150,200,300,400,600,800,1000,2000];

  const curvePoints = (k) => {
    const pts = [];
    for (let i=0; i<=80; i++) {
      const tv = Math.pow(10, Math.log10(tMin) + i/80*(Math.log10(tMax)-Math.log10(tMin)));
      const gv = k / Math.sqrt(tv);
      if (gv >= GMin && gv <= GMax*2) pts.push(`${tx(tv).toFixed(1)},${gy(gv).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  // Mevcut t noktası
  const G_seçili = 115 / Math.sqrt(t); // k=115 eğrisinde
  const G_hesap  = Ik1_A > 0 ? Ik1_A / Math.sqrt(t) : null; // gerekli G

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect width={W} height={H} fill="#f8fafc" rx="6"/>
      <text x={W/2} y={10} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#334155">
        G — İletken Isınma Kapasitesi (A/mm²) vs Arıza Süresi t_F (s)
      </text>
      {/* Grid */}
      {tGrid.map(tv=>(
        <g key={tv}>
          <line x1={tx(tv)} y1={ty} x2={tx(tv)} y2={by} stroke="#e2e8f0" strokeWidth="0.5"/>
          <text x={tx(tv)} y={H-16} textAnchor="middle" fontSize="6" fill="#94a3b8">{tv}</text>
        </g>
      ))}
      {gGrid.map(gv=>(
        <g key={gv}>
          <line x1={lx} y1={gy(gv)} x2={rx} y2={gy(gv)} stroke="#e2e8f0" strokeWidth="0.5"/>
          <text x={lx-3} y={gy(gv)+2.5} textAnchor="end" fontSize="6" fill="#94a3b8">{gv}</text>
        </g>
      ))}
      <line x1={lx} y1={ty} x2={lx} y2={by} stroke="#64748b" strokeWidth="1"/>
      <line x1={lx} y1={by} x2={rx} y2={by} stroke="#64748b" strokeWidth="1"/>
      <text x={rx+2}  y={by}    fontSize="6" fill="#64748b">s</text>
      <text x={lx-2}  y={ty-1}  fontSize="6" fill="#64748b" textAnchor="end">A/mm²</text>
      {/* Eğriler */}
      {K_CURVES.map(c=>(
        <polyline key={c.k} points={curvePoints(c.k)} fill="none"
          stroke={c.color} strokeWidth="1.8" strokeDasharray={c.dash} strokeLinejoin="round"/>
      ))}
      {/* Seçili t noktası */}
      {t >= tMin && t <= tMax && (
        <>
          <line x1={tx(t)} y1={ty} x2={tx(t)} y2={by} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3,2"/>
          <text x={tx(t)+3} y={ty+10} fontSize="7" fill="#ef4444" fontWeight="bold">t={t}s</text>
          {G_hesap && G_hesap <= GMax && (
            <circle cx={tx(t)} cy={gy(G_hesap)} r="3.5" fill="#ef4444" stroke="white" strokeWidth="1"/>
          )}
        </>
      )}
      {/* Lejant */}
      {K_CURVES.map((c,i)=>(
        <g key={i} transform={`translate(${lx+4},${by-60+i*12})`}>
          <line x1="0" y1="4" x2="14" y2="4" stroke={c.color} strokeWidth="1.8" strokeDasharray={c.dash}/>
          <text x="17" y="7" fontSize="6" fill="#334155">{c.label}</text>
        </g>
      ))}
      <text x={lx-50} y={(ty+by)/2} fontSize="7" fill="#475569" fontWeight="bold"
        transform={`rotate(-90,${lx-50},${(ty+by)/2})`} textAnchor="middle">G (A/mm²)</text>
      <text x={(lx+rx)/2} y={H-5} fontSize="7" fill="#475569">t_F (s)</text>
    </svg>
  );
}

function UtpGraph({ t, Utp, UE }) {
  const W=360, H=150, lx=38, rx=W-10, ty_=18, by=H-20;
  const tx = tv => lx + (Math.log10(tv)-Math.log10(0.03))/(Math.log10(10)-Math.log10(0.03))*(rx-lx);
  const uy  = uv => by - (Math.log10(Math.min(Math.max(uv, 50), 1200))-Math.log10(50))/(Math.log10(1200)-Math.log10(50))*(by-ty_);
  const pts = UTP_TABLE.map(p => `${tx(p.t).toFixed(1)},${uy(p.Utp).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect width={W} height={H} fill="#f8fafc" rx="6"/>
      <text x={W/2} y={12} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#334155">
        İzin Verilen Maks. Dokunma Gerilimleri (UTP) — ETT Yönetmeliği
      </text>
      {[70,100,200,500,1000].map(u => (
        <g key={u}>
          <line x1={lx} y1={uy(u)} x2={rx} y2={uy(u)} stroke="#e2e8f0" strokeWidth="0.5"/>
          <text x={lx-3} y={uy(u)+3} textAnchor="end" fontSize="6.5" fill="#94a3b8">{u}</text>
        </g>
      ))}
      {[0.05,0.1,0.2,0.5,1,2,5,10].map(tv => (
        <g key={tv}>
          <line x1={tx(tv)} y1={ty_} x2={tx(tv)} y2={by} stroke="#e2e8f0" strokeWidth="0.5"/>
          <text x={tx(tv)} y={H-8} textAnchor="middle" fontSize="6.5" fill="#94a3b8">{tv}</text>
        </g>
      ))}
      <line x1={lx} y1={ty_} x2={lx} y2={by} stroke="#94a3b8" strokeWidth="1"/>
      <line x1={lx} y1={by}  x2={rx} y2={by} stroke="#94a3b8" strokeWidth="1"/>
      <text x={rx+2}  y={by+2}   fontSize="6.5" fill="#64748b">s</text>
      <text x={lx-2}  y={ty_-3}  fontSize="6.5" fill="#64748b">V</text>
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round"/>
      <line x1={tx(t)} y1={ty_} x2={tx(t)} y2={by} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
      <circle cx={tx(t)} cy={uy(Utp)} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1"/>
      <text x={tx(t)+4} y={uy(Utp)-3} fontSize="7" fill="#92400e" fontWeight="bold">UTP={Utp}V</text>
      {UE > 0 && UE < 1500 && (
        <line x1={lx} y1={uy(UE)} x2={rx} y2={uy(UE)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2"/>
      )}
      {Utp*2 < 1200 && (
        <line x1={lx} y1={uy(Utp*2)} x2={rx} y2={uy(Utp*2)} stroke="#10b981" strokeWidth="1" strokeDasharray="3,2" opacity="0.5"/>
      )}
    </svg>
  );
}

// Topraklama Birimi (Saha veya Köşk)
const KOSK_COLORS = ['blue','violet','orange','rose','cyan'];
const COLOR_MAP = {
  emerald: { hd: 'bg-emerald-600 text-white', bd: 'border-emerald-200 bg-emerald-50/30' },
  blue:    { hd: 'bg-blue-600 text-white',    bd: 'border-blue-200 bg-blue-50/30'       },
  violet:  { hd: 'bg-violet-600 text-white',  bd: 'border-violet-200 bg-violet-50/30'   },
  orange:  { hd: 'bg-orange-500 text-white',  bd: 'border-orange-200 bg-orange-50/30'   },
  rose:    { hd: 'bg-rose-500 text-white',    bd: 'border-rose-200 bg-rose-50/30'       },
  cyan:    { hd: 'bg-cyan-600 text-white',    bd: 'border-cyan-200 bg-cyan-50/30'       },
};

function BirimPanel({ label, color, data, onChange, rhoE, sonuc, removable, onRemove }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`border-2 rounded-xl overflow-hidden ${c.bd}`}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${c.hd}`}>
        <input
          type="text"
          value={data.isim || label}
          onChange={e => onChange('isim', e.target.value)}
          className="bg-transparent outline-none font-black text-sm placeholder-white/60 w-full"
          placeholder={label}
        />
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {sonuc?.Res != null && isFinite(sonuc.Res) && (
            <span className="bg-white/20 px-3 py-0.5 rounded-lg font-mono font-bold text-sm whitespace-nowrap">
              Reş = {sonuc.Res.toFixed(3)} Ω
            </span>
          )}
          {removable && (
            <button onClick={onRemove} className="bg-white/20 hover:bg-white/40 rounded-lg p-1 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {/* Şerit toggle */}
        <button onClick={() => onChange('seritAktif', !data.seritAktif)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${data.seritAktif ? 'bg-teal-50 border-teal-400 text-teal-700' : 'border-slate-200 text-slate-400 bg-white'}`}>
          Topraklama Şeridi {data.seritAktif ? '✓' : '○'}
        </button>
        {data.seritAktif && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <NI label="a [m]" value={data.a}  onChange={v => onChange('a', v)}  unit="m" step={0.5} min={0.1}/>
              <NI label="b [m]" value={data.b}  onChange={v => onChange('b', v)}  unit="m" step={0.5} min={0.1}/>
              <NI label="L şerit [m]" value={data.L} onChange={v => onChange('L', v)} unit="m" step={1}   min={1}/>
            </div>
            {sonuc?.Rg != null && (
              <div className="bg-white/80 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-500">
                D=√(4×{(data.a*data.b).toFixed(0)}/π)={sonuc.D?.toFixed(2)}m &nbsp;|&nbsp;
                Rg=ρ/(2D)+ρ/L={sonuc.Rg?.toFixed(3)} Ω
              </div>
            )}
          </>
        )}

        {/* Kazık toggle */}
        <button onClick={() => onChange('kazikAktif', !data.kazikAktif)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${data.kazikAktif ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-slate-200 text-slate-400 bg-white'}`}>
          Topraklama Kazığı {data.kazikAktif ? '✓' : '○'}
        </button>
        {data.kazikAktif && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <NI label="n [adet]" value={data.n}  onChange={v => onChange('n', v)}  unit="adet" step={1}     min={1}/>
              <NI label="Lç [m]"   value={data.Lc} onChange={v => onChange('Lc', v)} unit="m"    step={0.5}   min={0.5}/>
              <NI label="dç [m]"   value={data.dc} onChange={v => onChange('dc', v)} unit="m"    step={0.005} min={0.01}/>
            </div>
            {sonuc?.Rç != null && (
              <div className="bg-white/80 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-500">
                Rç_tek={sonuc.Rc_tek?.toFixed(3)} Ω &nbsp;|&nbsp; Rç={sonuc.Rc_tek?.toFixed(3)}/{data.n}={sonuc.Rç?.toFixed(3)} Ω
              </div>
            )}
          </>
        )}

        {/* Reş formülü */}
        {sonuc?.Res != null && data.seritAktif && data.kazikAktif && sonuc.Rg && sonuc.Rç && (
          <div className="bg-white/80 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-500">
            Reş = (Rg×Rç)/(Rg+Rç)×1.10 = ({sonuc.Rg?.toFixed(3)}×{sonuc.Rç?.toFixed(3)})/({sonuc.Rg?.toFixed(3)}+{sonuc.Rç?.toFixed(3)})×1.10 = <b>{sonuc.Res?.toFixed(3)} Ω</b>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────
const BIRIM_EMPTY = (isim) => ({ isim, seritAktif: true, a: 7.3, b: 2.5, L: 19.6, kazikAktif: true, n: 4, Lc: 1.5, dc: 0.05 });

export default function GesTopraklama({ initialIk1 = 0 }) {
  const [mod,  setMod]  = useState('arazi');
  const [Ik1,  setIk1]  = useState(initialIk1 || 0.659);
  const [rhoE, setRhoE] = useState(100);
  const [rIdx, setRIdx] = useState(2);
  const [t,    setT]    = useState(1.0);
  const [nInv, setNInv] = useState(8);

  // Arazi
  const [saha,    setSaha]    = useState({ isim: 'GES Santral Sahası', seritAktif: true, a: 250, b: 119, L: 1040, kazikAktif: true, n: 12, Lc: 1.5, dc: 0.05 });
  const [koskler, setKoskler] = useState([{ ...BIRIM_EMPTY('Trafo Köşkü 1'), id: 1 }]);
  const updSaha = (k, v) => setSaha(p => ({ ...p, [k]: v }));
  const addKosk = () => setKoskler(ks => [...ks, { ...BIRIM_EMPTY(`Trafo Köşkü ${ks.length+1}`), id: Date.now() }]);
  const rmKosk  = i  => setKoskler(ks => ks.filter((_, j) => j !== i));
  const updKosk = (i, k, v) => setKoskler(ks => ks.map((ko, j) => j === i ? { ...ko, [k]: v } : ko));

  // Çatı
  const [Rmevcut,   setRmevcut]   = useState(5.0);
  const [catiSerit, setCatiSerit] = useState({ L: 120, kesit: '30×3.5 mm Galvaniz Şerit' });
  const [catiKazik, setCatiKazik] = useState({ aktif: false, n: 4, Lc: 1.5, dc: 0.05 });

  const [res, setRes] = useState(null);
  const r = R_SEL[rIdx].r;

  const hesapla = () => {
    const Ik1_A = Ik1 * 1000;
    const Utp   = getUtp(t);
    const q_hesap = (Ik1_A * Math.sqrt(t)) / 115;
    const STD = [10,16,25,35,50,70,95,120,150,185];
    const q_sec = STD.find(s => s >= q_hesap) || 185;

    if (mod === 'arazi') {
      const sahaSon = calcBirim({ rhoE, ...saha });
      const koskSon = koskler.map(k => calcBirim({ rhoE, ...k }));
      const tumRes  = [sahaSon.Res, ...koskSon.map(k => k.Res)].filter(r => r && isFinite(r));
      const finalRes = paralelAll(tumRes);
      const It = r * Ik1_A;
      const UE = finalRes * It;

      // Arazi adım gerilimi: saha sınırında, mesh eşdeğer yarıçapı kullanılarak
      // Ua = ρ×It/(2π) × (1/r_mesh - 1/(r_mesh+1))  [TS EN 50522]
      const A_saha = saha.a * saha.b;
      const r_mesh = Math.sqrt(A_saha / Math.PI); // eşdeğer daire yarıçapı
      const Ua_sinir = r_mesh > 0
        ? (rhoE * It / (2 * Math.PI)) * (1/r_mesh - 1/(r_mesh+1))
        : (rhoE * It) / (4 * Math.PI);

      setRes({ mod: 'arazi', sahaSon, koskSon, finalRes, It, UE, Utp,
               dok_ok: UE < 2*Utp,
               adim_ok: Ua_sinir <= LIMITS[t]?.Ua,
               Ua_sinir, r_mesh,
               rcd_ok: finalRes <= 50/(nInv*0.3),
               q_hesap, q_sec, Ik1_A });
    } else {
      // ÇATI: ×1.10 UYGULANMAZ
      // Rmevcut bina toprağı + kazık → saf paralel bağlantı
      // ×1.10 sadece TASARLANMIŞ mesh + kazık sistemlerinde geçerlidir (ETT sf.83)
      const { Rç } = catiKazik.aktif && catiKazik.n > 0
        ? calcRc(rhoE, catiKazik.n, catiKazik.Lc, catiKazik.dc)
        : { Rç: null };
      const aktifler = [Rmevcut, Rç].filter(x => x && isFinite(x));
      const finalRes = paralelAll(aktifler); // ×1.10 YOK — çatı modu
      const It = r * Ik1_A;
      const UE = finalRes * It;
      // Çatı: adım gerilimi uygulanamaz (yüzey eşpotansiyel)
      setRes({ mod: 'cati', finalRes, Rç, It, UE, Utp,
               dok_ok: UE < 2*Utp,
               adim_ok: null,    // N/A — çatı eşpotansiyel yüzey
               Ua_sinir: null,
               rcd_ok: finalRes <= 50/(nInv*0.3),
               q_hesap, q_sec, Ik1_A });
    }
  };

  const allOk = res && res.dok_ok && res.rcd_ok;

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/>
              <line x1="6" y1="18" x2="18" y2="18"/><line x1="8" y1="21" x2="16" y2="21"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">GES — Topraklama Hesabı</h2>
            <p className="text-emerald-100 text-sm">ETT Yönetmeliği · IEC EN 50522 · Dokunma Gerilimi Kontrolü</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={hesapla}
            className="bg-white text-emerald-700 font-black py-2.5 px-8 rounded-xl shadow-lg hover:scale-105 transition-all text-sm">
            HESAPLA
          </button>
          {res && (
            <div className="flex gap-2">
              <button onClick={async () => {
                const { exportGesTopraklamaPDF } = await import('../utils/export.js');
                exportGesTopraklamaPDF(
                  { mod, Ik1, rIdx, rhoE, t, nInv, saha, koskler, Rmevcut, catiSerit, catiKazik },
                  res
                );
              }}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all">
                🖨 PDF
              </button>
              <button onClick={async () => {
                const { exportGesTopraklamaWord } = await import('../utils/export.js');
                exportGesTopraklamaWord(
                  { mod, Ik1, rIdx, rhoE, t, nInv, saha, koskler, Rmevcut, catiSerit, catiKazik },
                  res
                );
              }}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all">
                📄 Word
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOD SEÇİMİ */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        {[
          ['arazi','🌄  Arazi GES','Gömülü şerit · Kazık · Birden fazla köşk'],
          ['cati', '🏢  Çatı GES', 'Mevcut R · Çatı şeridi · Opsiyonel kazık'],
        ].map(([m, lbl, sub]) => (
          <button key={m} onClick={() => { setMod(m); setRes(null); }}
            className={`flex-1 py-3 px-4 rounded-lg transition-all text-left ${mod===m ? 'bg-white shadow-sm' : ''}`}>
            <div className={`text-sm font-bold ${mod===m ? 'text-emerald-700' : 'text-slate-500'}`}>{lbl}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
          </button>
        ))}
      </div>

      {/* GENEL SONUÇ */}
      {res && (
        <div className={`rounded-xl p-4 flex items-center gap-4 border-2 ${allOk ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <div className={`text-3xl font-black ${allOk ? 'text-green-600' : 'text-red-600'}`}>{allOk ? '✓' : '✗'}</div>
          <div>
            <div className={`font-black ${allOk ? 'text-green-700' : 'text-red-700'}`}>
              {allOk ? 'Topraklama Sistemi Uygun' : 'Uyumsuzluk Var'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">
              Reş = {res.finalRes?.toFixed(3)} Ω · It = {res.It?.toFixed(1)} A · UE = {res.UE?.toFixed(1)} V · 2×UTP({t}s) = {res.Utp*2} V
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* ── SOL ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Arıza akımı */}
          <div className="bg-white p-5 rounded-xl border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <div className="w-3 h-3 rounded-full bg-red-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase">Arıza Akımı</h3>
              {initialIk1 > 0 && <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">OG modülünden</span>}
            </div>
            <NI label='Faz-Toprak I"k1 [kA]' value={Ik1} onChange={setIk1} unit="kA" step={0.001} min={0.001}/>
            <p className="text-[10px] text-slate-400 mt-1.5 font-mono">= {(Ik1*1000).toFixed(0)} A</p>
          </div>

          {/* Zemin */}
          <div className="bg-white p-5 rounded-xl border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <div className="w-3 h-3 rounded-full bg-amber-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase">Zemin Özgül Direnci ρ</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {TOPRAK.map(tp => (
                <button key={tp.r} onClick={() => setRhoE(tp.r)}
                  className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${rhoE===tp.r ? 'bg-amber-50 border-amber-400 text-amber-700 font-bold' : 'border-slate-200 text-slate-500 hover:border-amber-200'}`}>
                  <span className="font-mono font-bold">{tp.r}</span> — {tp.label}
                </button>
              ))}
            </div>
            <NI label="ρE [Ω·m]" value={rhoE} onChange={setRhoE} unit="Ω·m" step={10} min={10}/>
          </div>

          {/* Bölünme */}
          <div className="bg-white p-5 rounded-xl border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <div className="w-3 h-3 rounded-full bg-blue-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase">Bölünme Katsayısı r</h3>
            </div>
            {R_SEL.map((s, i) => (
              <button key={i} onClick={() => setRIdx(i)}
                className={`w-full text-left px-4 py-2.5 rounded-xl border-2 mb-2 transition-all ${rIdx===i ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                <div className="flex justify-between">
                  <span className="text-xs font-bold">{s.label}</span>
                  <span className={`font-mono font-black ${rIdx===i ? 'text-blue-600' : 'text-slate-400'}`}>r = {s.r}</span>
                </div>
              </button>
            ))}
            {res && <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-[10px] font-mono text-blue-700">It = {r}×{(Ik1*1000).toFixed(0)} = <b>{res.It?.toFixed(1)} A</b></div>}
          </div>

          {/* Arıza süresi + RCD */}
          <div className="bg-white p-5 rounded-xl border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <div className="w-3 h-3 rounded-full bg-violet-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase">Arıza Süresi & RCD</h3>
            </div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Hata Temizleme Süresi</label>
            <div className="flex gap-2 mb-3">
              {[0.5, 1.0].map(tv => (
                <button key={tv} onClick={() => setT(tv)}
                  className={`flex-1 py-2.5 rounded-xl border-2 font-black text-sm transition-all ${t===tv ? 'bg-violet-50 border-violet-500 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-200'}`}>
                  {tv} s
                </button>
              ))}
            </div>
            <NI label="Evirici Sayısı (pano başına)" value={nInv} onChange={setNInv} unit="adet" step={1} min={1}/>
            <div className="mt-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5 text-[10px] font-mono text-violet-700">
              RCD eşik = 50 / ({nInv}×0.3) = {(50/(nInv*0.3)).toFixed(2)} Ω
            </div>
          </div>

          {/* ÇATI: mevcut + çatı şeridi + kazık */}
          {mod === 'cati' && (
            <div className="bg-white p-5 rounded-xl border space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="w-3 h-3 rounded-full bg-emerald-500"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">Çatı GES Elemanları</h3>
              </div>

              <NI label="Mevcut Bina Topraklaması R_mevcut [Ω]" value={Rmevcut} onChange={setRmevcut} unit="Ω" step={0.5} min={0.01}/>

              <hr className="border-slate-100"/>

              <div>
                <div className="text-xs font-bold text-teal-700 mb-1">Çatı Eşpotansiyel Şeridi</div>
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-[10px] text-teal-700 mb-2">
                  Gömülü elektrot değil — panel çerçevelerini eşpotansiyele bağlar, zemine karşı direnci R_mevcut üzerinden sağlanır.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NI label="Toplam Şerit L [m]" value={catiSerit.L} onChange={v => setCatiSerit(p=>({...p,L:v}))} unit="m" step={5} min={1}/>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lama Tipi</label>
                    <input type="text" value={catiSerit.kesit}
                      onChange={e => setCatiSerit(p=>({...p,kesit:e.target.value}))}
                      className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:border-teal-400 outline-none"/>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100"/>

              <div>
                <button onClick={() => setCatiKazik(p=>({...p,aktif:!p.aktif}))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 mb-2 transition-all ${catiKazik.aktif ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-slate-200 text-slate-400 bg-white'}`}>
                  İlave Topraklama Kazığı {catiKazik.aktif ? '✓' : '○'}
                </button>
                {catiKazik.aktif && (
                  <div className="grid grid-cols-3 gap-2">
                    <NI label="n [adet]" value={catiKazik.n}  onChange={v=>setCatiKazik(p=>({...p,n:v}))}  unit="adet" step={1}     min={1}/>
                    <NI label="Lç [m]"   value={catiKazik.Lc} onChange={v=>setCatiKazik(p=>({...p,Lc:v}))} unit="m"    step={0.5}   min={0.5}/>
                    <NI label="dç [m]"   value={catiKazik.dc} onChange={v=>setCatiKazik(p=>({...p,dc:v}))} unit="m"    step={0.005} min={0.01}/>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── SAĞ ── */}
        <div className="xl:col-span-3 space-y-4">

          {/* ARAZİ: birim paneller */}
          {mod === 'arazi' && (
            <>
              <BirimPanel
                label="GES Santral Sahası"
                color="emerald"
                data={saha}
                onChange={updSaha}
                rhoE={rhoE}
                sonuc={res?.mod==='arazi' ? res.sahaSon : null}
              />
              {koskler.map((ko, i) => (
                <BirimPanel
                  key={ko.id || i}
                  label={`Trafo Köşkü ${i+1}`}
                  color={KOSK_COLORS[i % KOSK_COLORS.length]}
                  data={ko}
                  onChange={(k, v) => updKosk(i, k, v)}
                  rhoE={rhoE}
                  sonuc={res?.mod==='arazi' ? res.koskSon?.[i] : null}
                  removable={true}
                  onRemove={() => rmKosk(i)}
                />
              ))}
              <button onClick={addKosk}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl py-3 text-sm font-bold text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-all">
                + Trafo Köşkü Ekle
              </button>
            </>
          )}

          {/* ÇATI: özet */}
          {mod === 'cati' && !res && (
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center min-h-80">
              <div className="text-center text-slate-400 p-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
                  <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
                </svg>
                <p className="font-bold text-sm">Sol paneli doldurup Hesapla'ya basın</p>
              </div>
            </div>
          )}

          {/* SONUÇLAR */}
          {res && (
            <>
              {/* Final Reş */}
              <div className="bg-white p-5 rounded-xl border">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"/>
                  <h3 className="font-black text-slate-700 text-sm uppercase">Eşdeğer Topraklama Direnci</h3>
                </div>

                {res.mod === 'arazi' && (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between bg-emerald-50 rounded-lg px-4 py-2 text-xs">
                      <span className="font-bold text-emerald-700">{saha.isim}</span>
                      <span className="font-mono font-black text-emerald-700">{res.sahaSon?.Res?.toFixed(3)} Ω</span>
                    </div>
                    {res.koskSon?.map((ks, i) => (
                      <div key={i} className="flex justify-between bg-blue-50 rounded-lg px-4 py-2 text-xs">
                        <span className="font-bold text-blue-700">{koskler[i]?.isim || `Köşk ${i+1}`}</span>
                        <span className="font-mono font-black text-blue-700">{ks?.Res?.toFixed(3)} Ω</span>
                      </div>
                    ))}
                    <div className="text-[10px] font-mono text-slate-400 px-1">
                      1/Reş = {[res.sahaSon?.Res, ...(res.koskSon||[]).map(k=>k?.Res)].filter(Boolean).map(v=>`1/${v?.toFixed(3)}`).join(' + ')} → Reş = <b>{res.finalRes?.toFixed(3)} Ω</b>
                    </div>
                  </div>
                )}

                {res.mod === 'cati' && (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between bg-emerald-50 rounded-lg px-4 py-2 text-xs">
                      <span className="font-bold text-emerald-700">Mevcut Bina Toprağı</span>
                      <span className="font-mono font-black text-emerald-700">{Rmevcut.toFixed(3)} Ω</span>
                    </div>
                    <div className="bg-teal-50 rounded-lg px-4 py-2 text-xs text-teal-700">
                      Çatı Şeridi ({catiSerit.L}m {catiSerit.kesit}) — eşpotansiyel bağlantı
                    </div>
                    {catiKazik.aktif && res.Rç && (
                      <div className="flex justify-between bg-amber-50 rounded-lg px-4 py-2 text-xs">
                        <span className="font-bold text-amber-700">İlave Kazık ({catiKazik.n} adet)</span>
                        <span className="font-mono font-black text-amber-700">{res.Rç?.toFixed(3)} Ω</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border rounded-xl px-3 py-3 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">It = r × Ik1</div>
                    <div className="font-black font-mono text-slate-700 text-lg">{res.It?.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-400">A</div>
                  </div>
                  <div className="col-span-2 bg-emerald-50 border-2 border-emerald-400 rounded-xl px-4 py-3 text-center">
                    <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Final Reş</div>
                    <div className="font-black font-mono text-emerald-700 text-3xl">{res.finalRes?.toFixed(3)}</div>
                    <div className="text-xs text-emerald-500">Ω</div>
                  </div>
                </div>
              </div>

              {/* GPR + Dokunma Gerilimi */}
              <div className="bg-white p-5 rounded-xl border">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-orange-400"/>
                  <h3 className="font-black text-slate-700 text-sm uppercase">Dokunma Gerilimi Kontrolü</h3>
                </div>
                <UtpGraph t={t} Utp={res.Utp} UE={res.UE}/>
                <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-500">
                  UE = It × Reş = {res.It?.toFixed(1)} × {res.finalRes?.toFixed(3)} = <b>{res.UE?.toFixed(2)} V</b>
                  &nbsp;|&nbsp; UTP({t}s) = {res.Utp} V &nbsp;|&nbsp; 2×UTP = {res.Utp*2} V
                </div>
                <div className="mt-3">
                  <SCard
                    ok={res.dok_ok}
                    label={`${t} sn için izin verilen en yüksek dokunma gerilimi ${res.Utp} V`}
                    val={res.UE}
                    op="<"
                    lim={res.Utp*2}
                    unit="V"
                    sub={`UE = ${res.UE?.toFixed(2)} V  ${res.dok_ok?'<':'>'} 2×UTP(${t}s) = ${res.Utp*2} V`}
                  />
                </div>
                {res.dok_ok && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700">
                    ✓ Dokunma gerilimine göre topraklama sistemi uygun olduğu için adım gerilimine bakmaya gerek yoktur.
                  </div>
                )}
                {!res.dok_ok && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
                    ✗ Dokunma gerilimi aşılıyor. Reş düşürülmeli (daha fazla kazık / daha büyük saha ağı).
                  </div>
                )}
              </div>

              {/* Adım Gerilimi — arazi için göster, çatı için N/A */}
              <div className="bg-white p-5 rounded-xl border">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-400"/>
                  <h3 className="font-black text-slate-700 text-sm uppercase">Adım Gerilimi Kontrolü</h3>
                </div>
                {res.adim_ok === null ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-center">
                    <div className="text-sm font-bold text-slate-500">Uygulanamaz — Çatı Tesisi</div>
                    <div className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
                      Çatı yüzeyi eşpotansiyel bağlantı ile tek potansiyelde tutulduğundan
                      adım gerilimi oluşmaz. IEC 60364-7-712 kapsamında kontrol gerekmez.
                    </div>
                  </div>
                ) : (
                  <SCard
                    ok={res.adim_ok}
                    label={`Saha Sınırı Adım Gerilimi — t = ${t} s   (r_mesh = ${res.r_mesh?.toFixed(1)} m)`}
                    val={res.Ua_sinir}
                    op="<"
                    lim={LIMITS[t]?.Ua}
                    unit="V"
                    sub={`Ua = ρ×It/(2π) × (1/r − 1/(r+1)) = ${rhoE}×${res.It?.toFixed(1)}/(2π) × (1/${res.r_mesh?.toFixed(1)} − 1/${(res.r_mesh+1)?.toFixed(1)}) = ${res.Ua_sinir?.toFixed(1)} V`}
                  />
                )}
              </div>

              {/* İletken Kesit */}
              <div className="bg-white p-5 rounded-xl border">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-amber-400"/>
                  <h3 className="font-black text-slate-700 text-sm uppercase">Topraklama İletkeni Minimum Kesiti</h3>
                  <span className="ml-auto text-[10px] text-slate-400">k = 115 A/mm² (çıplak Cu)</span>
                </div>
                <GKesitGraph t={t} q_hesap={res.q_hesap} Ik1_A={res.Ik1_A}/>
                <div className="mt-3 bg-slate-50 rounded-lg px-4 py-3 font-mono text-sm mb-3">
                  S = Ik1 × √t / k = {(Ik1*1000).toFixed(0)} × √{t} / 115 = <b>{res.q_hesap?.toFixed(2)} mm²</b>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-700">Seçilen Kesit</div>
                    <div className="text-[10px] text-slate-400 font-mono">Yönetmelik min. 50 mm² galvaniz şerit</div>
                  </div>
                  <div className="font-black text-amber-700 text-2xl font-mono">{res.q_sec} mm²</div>
                </div>
              </div>

              {/* RCD */}
              <div className="bg-white p-5 rounded-xl border">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-violet-400"/>
                  <h3 className="font-black text-slate-700 text-sm uppercase">Kaçak Akım Röle Kontrolü</h3>
                </div>
                <SCard
                  ok={res.rcd_ok}
                  label={`TT sistemi — UL = 50V, ${nInv} evirici × 0.3A/evirici`}
                  val={res.finalRes}
                  op="≤"
                  lim={(50/(nInv*0.3)).toFixed(2)}
                  unit="Ω"
                  sub={`Reş × Ia ≤ 50V  →  Reş ≤ 50/(${nInv}×0.3) = ${(50/(nInv*0.3)).toFixed(2)} Ω`}
                />
                <p className="text-xs text-slate-400 mt-2">Kaçak akım rölesi (RCD) kullanımı zorunludur.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
