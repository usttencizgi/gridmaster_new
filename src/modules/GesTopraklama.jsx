import { useState } from 'react';
import NumInput from '../components/NumInput.jsx';

const K_GALVANIZ = 180;
const RCD_BASI   = 0.3;
const UT_LIMIT   = 50;

const LIMITS = {
  0.5: { Ud: 150, Ua: 200 },
  1.0: { Ud:  75, Ua: 130 },
};

const TOPRAK_TIPLERI = [
  { label: 'Bataklık',          r: 30   },
  { label: 'Killi Toprak',      r: 100  },
  { label: 'Rutubetli Kum',     r: 200  },
  { label: 'Rutubetli Çakıl',   r: 500  },
  { label: 'Kuru Kum / Çakıl',  r: 1000 },
  { label: 'Taşlık Zemin',      r: 3000 },
];

const R_SECENEKLER = [
  { label: 'Sadece havai hat',         r: 0.6  },
  { label: 'Karma (havai + yer altı)', r: 0.45 },
  { label: 'Sadece yer altı kablo',    r: 0.3  },
];

function calcTopraklama({ Ik1_kA, rhoE, r, nInv,
  resMevcut, kazikAktif, n, Lc, dc,
  seritAktif, a, b, seritEni, gomDerinligi }) {

  const Ik1_A = Ik1_kA * 1000;
  const R_mevcut = resMevcut > 0 ? resMevcut : Infinity;

  let R_kazik = Infinity, Rc_tek = null, Rc_n = null;
  if (kazikAktif && n > 0 && Lc > 0 && dc > 0) {
    Rc_tek  = (rhoE / (2 * Math.PI * Lc)) * Math.log(4 * Lc / dc);
    Rc_n    = Rc_tek / n;
    R_kazik = Rc_n * 1.10;
  }

  let R_serit = Infinity, Rg_val = null, L_serit = null, A_serit = null;
  if (seritAktif && a > 0 && b > 0 && seritEni > 0) {
    L_serit = 2 * (a + b);
    A_serit = a * b;
    const d_eq = seritEni / Math.PI;
    Rg_val  = (rhoE / (2 * Math.PI * L_serit)) *
              (Math.log(2 * L_serit / d_eq) - 1 + L_serit / Math.sqrt(A_serit));
    R_serit = Rg_val;
  }

  let inv = 0;
  if (isFinite(R_mevcut)) inv += 1 / R_mevcut;
  if (isFinite(R_kazik))  inv += 1 / R_kazik;
  if (isFinite(R_serit))  inv += 1 / R_serit;
  const Res_final = inv > 0 ? 1 / inv : 0;

  const It  = r * Ik1_A;
  const GPR = Res_final * It;

  const transferDetay = {};
  [0.5, 1.0].forEach(t => {
    const Ud = LIMITS[t].Ud;
    transferDetay[t] = { esik: 2 * Ud, ok: GPR <= 2 * Ud };
  });

  const Ua_sinir = (rhoE * It) / (4 * Math.PI);

  const sureler = {};
  [0.5, 1.0].forEach(t => {
    const { Ud, Ua } = LIMITS[t];
    sureler[t] = { Ud, Ua, dokunma_ok: GPR <= Ud, adim_ok: Ua_sinir <= Ua };
  });

  const q_05 = (It * Math.sqrt(0.5)) / K_GALVANIZ;
  const q_10 = (It * Math.sqrt(1.0)) / K_GALVANIZ;
  const q_gerekli = Math.max(q_05, q_10);
  const LAMALAR = [
    { etiket: '25×3 (75 mm²)',    alan: 75  },
    { etiket: '30×3.5 (105 mm²)', alan: 105 },
    { etiket: '40×4 (160 mm²)',   alan: 160 },
    { etiket: '50×5 (250 mm²)',   alan: 250 },
  ];
  const secilen_lama = LAMALAR.find(l => l.alan >= q_gerekli) || LAMALAR[LAMALAR.length - 1];

  const Rcd_esik = UT_LIMIT / (nInv * RCD_BASI);
  const rcd_ok   = Res_final <= Rcd_esik;

  return {
    R_mevcut: isFinite(R_mevcut) ? R_mevcut : null,
    R_kazik:  isFinite(R_kazik)  ? R_kazik  : null,
    R_serit:  isFinite(R_serit)  ? R_serit  : null,
    Rc_tek, Rc_n, Rg_val, L_serit, A_serit,
    Res_final, It, GPR, Ua_sinir,
    transferDetay, sureler,
    q_05, q_10, q_gerekli, secilen_lama,
    Rcd_esik, rcd_ok, Ik1_A,
  };
}

function NInput({ label, value, onChange, unit, step, min }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
      <NumInput value={value} onChange={onChange} unit={unit} step={step ?? 0.01} min={min ?? 0} />
    </div>
  );
}

function Badge({ ok }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? '✓ UYGUN' : '✗ UYGUN DEĞİL'}
    </span>
  );
}

function SonucKart({ ok, label, hesap, op, sinir, unit, sub }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-300'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{sub}</p>}
        </div>
        <Badge ok={ok} />
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 text-center rounded-lg px-3 py-2 border ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-[10px] text-slate-400 mb-0.5">Hesaplanan</div>
          <div className={`text-xl font-black font-mono ${ok ? 'text-green-700' : 'text-red-600'}`}>
            {typeof hesap === 'number' ? hesap.toFixed(2) : hesap} {unit}
          </div>
        </div>
        <div className={`text-xl font-black ${ok ? 'text-green-500' : 'text-red-400'}`}>{op}</div>
        <div className="flex-1 text-center rounded-lg px-3 py-2 bg-white border border-slate-200">
          <div className="text-[10px] text-slate-400 mb-0.5">Sınır</div>
          <div className="text-xl font-black font-mono text-slate-700">{sinir} {unit}</div>
        </div>
      </div>
    </div>
  );
}

function ToggleCard({ active, onToggle, borderColor, dotColor, btnActive, bgActive, label, children }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${active ? borderColor : 'border-slate-200'}`}>
      <div className={`flex items-center justify-between px-5 py-3 ${active ? bgActive : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${active ? dotColor : 'bg-slate-300'}`}/>
          <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">{label}</h3>
        </div>
        <button onClick={onToggle}
          className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${active ? btnActive + ' text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          {active ? 'AKTİF ✓' : 'PASİF'}
        </button>
      </div>
      {active && <div className="px-5 pb-5 pt-3">{children}</div>}
      {!active && <div className="px-5 py-3 text-xs text-slate-400 italic">Aktif etmek için butona tıklayın</div>}
    </div>
  );
}

export default function GesTopraklama({ initialIk1 = 0 }) {
  const [Ik1,   setIk1]   = useState(initialIk1 || 1.574);
  const [rhoE,  setRhoE]  = useState(100);
  const [rIdx,  setRIdx]  = useState(1);
  const [nInv,  setNInv]  = useState(1);
  const [resMevcut, setResMevcut] = useState(2.79);
  const [kazikAktif, setKazikAktif] = useState(false);
  const [n,  setN]  = useState(4);
  const [Lc, setLc] = useState(2);
  const [dc, setDc] = useState(0.02);
  const [seritAktif, setSeritAktif] = useState(false);
  const [a,   setA]   = useState(14);
  const [b,   setB]   = useState(10);
  const [seritEni, setSeritEni]   = useState(0.03);
  const [gomDerinligi, setGom]    = useState(0.5);
  const [res, setRes] = useState(null);

  const r = R_SECENEKLER[rIdx].r;

  const hesapla = () => setRes(calcTopraklama({
    Ik1_kA: Ik1, rhoE, r, nInv, resMevcut,
    kazikAktif, n, Lc, dc,
    seritAktif, a, b, seritEni, gomDerinligi,
  }));

  const allOk = res && Object.values(res.sureler).every(s => s.dokunma_ok && s.adim_ok) && res.rcd_ok;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 rounded-xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/>
              <line x1="6" y1="18" x2="18" y2="18"/><line x1="8" y1="21" x2="16" y2="21"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">GES — Topraklama Hesabı</h2>
            <p className="text-emerald-100 text-sm">Eşpotansiyel · Şerit (opsiyonel) · Kazık (opsiyonel) · IEC EN 50522</p>
          </div>
        </div>
        <button onClick={hesapla} className="bg-white text-emerald-700 font-black py-2.5 px-8 rounded-xl shadow-lg hover:scale-105 transition-all text-sm">HESAPLA</button>
      </div>

      {res && (
        <div className={`rounded-xl p-4 flex items-center gap-4 border-2 ${allOk ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <div className={`text-3xl font-black ${allOk ? 'text-green-600' : 'text-red-600'}`}>{allOk ? '✓' : '✗'}</div>
          <div>
            <div className={`font-black text-base ${allOk ? 'text-green-700' : 'text-red-700'}`}>
              {allOk ? 'Topraklama Sistemi Tüm Kontrolleri Geçti' : 'Uyumsuzluk Var — Kırmızı bölümleri inceleyin'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">
              Reş = {res.Res_final.toFixed(3)} Ω · GPR = {res.GPR.toFixed(1)} V · It = {res.It.toFixed(1)} A
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-2 space-y-4">

          {/* Arıza + Zemin */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-red-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Arıza & Zemin</h3>
              {initialIk1 > 0 && <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">OG modülünden</span>}
            </div>
            <div className="space-y-3">
              <NInput label='Faz-Toprak I"k1 [kA]' value={Ik1} onChange={setIk1} unit="kA" step={0.001} min={0.001} />
              <p className="text-[10px] text-slate-400 font-mono">= {(Ik1*1000).toFixed(0)} A</p>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zemin Tipi</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TOPRAK_TIPLERI.map(t => (
                    <button key={t.r} onClick={() => setRhoE(t.r)}
                      className={`text-left px-2 py-1.5 rounded-lg border text-xs transition-all ${rhoE === t.r ? 'bg-amber-50 border-amber-400 text-amber-700 font-bold' : 'border-slate-200 text-slate-500 hover:border-amber-200'}`}>
                      <span className="font-mono font-bold">{t.r}</span> — {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <NInput label="ρE [Ω·m]" value={rhoE} onChange={setRhoE} unit="Ω·m" step={10} min={10} />
            </div>
          </div>

          {/* Bölünme + Evirici */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-blue-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Bölünme Katsayısı</h3>
            </div>
            <div className="space-y-1.5 mb-3">
              {R_SECENEKLER.map((s, i) => (
                <button key={i} onClick={() => setRIdx(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all flex justify-between ${rIdx === i ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'border-slate-200 text-slate-500 hover:border-blue-200'}`}>
                  <span>{s.label}</span>
                  <span className="font-mono font-black">r = {s.r}</span>
                </button>
              ))}
            </div>
            <NInput label="Evirici Sayısı" value={nInv} onChange={setNInv} unit="adet" step={1} min={1} />
          </div>

          {/* A) Mevcut — her zaman aktif */}
          <div className="bg-white p-5 rounded-xl shadow-sm border-2 border-slate-400">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-slate-500"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Mevcut Eşpotansiyel</h3>
              <span className="ml-auto text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">Her zaman</span>
            </div>
            <NInput label="Ölçülen / Bilinen Reş [Ω]" value={resMevcut} onChange={setResMevcut} unit="Ω" step={0.01} min={0.01} />
            <p className="text-[10px] text-slate-400 mt-2">Mevcut yapının / eşpotansiyelin ölçülen direnci</p>
          </div>

          {/* B) Kazık */}
          <ToggleCard active={kazikAktif} onToggle={() => setKazikAktif(!kazikAktif)}
            borderColor="border-teal-400" dotColor="bg-teal-400" btnActive="bg-teal-600"
            bgActive="bg-teal-50" label="Topraklama Kazıkları (Opsiyonel)">
            <div className="grid grid-cols-2 gap-3">
              <NInput label="Kazık Sayısı n" value={n}  onChange={setN}  unit="adet" step={1} min={1} />
              <NInput label="Uzunluk Lç [m]" value={Lc} onChange={setLc} unit="m" step={0.1} min={0.1} />
              <NInput label="Çap dç [m]"     value={dc} onChange={setDc} unit="m" step={0.001} min={0.001} />
            </div>
            {res && res.Rc_tek && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-teal-600 font-bold">Tek Kazık Rç</div>
                  <div className="font-mono font-black text-teal-700">{res.Rc_tek.toFixed(3)} Ω</div>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-teal-600 font-bold">{n} Kazık (+%10)</div>
                  <div className="font-mono font-black text-teal-700">{res.R_kazik.toFixed(3)} Ω</div>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-2 font-mono">Rç = ρ/(2πLç) × ln(4Lç/dç) / n × 1.10</p>
          </ToggleCard>

          {/* C) Şerit */}
          <ToggleCard active={seritAktif} onToggle={() => setSeritAktif(!seritAktif)}
            borderColor="border-amber-400" dotColor="bg-amber-400" btnActive="bg-amber-600"
            bgActive="bg-amber-50" label="Topraklama Şeridi — a×b (Opsiyonel)">
            <div className="grid grid-cols-2 gap-3">
              <NInput label="Saha Uzunluğu a [m]" value={a}   onChange={setA}   unit="m" step={0.5} min={1} />
              <NInput label="Saha Genişliği b [m]" value={b}   onChange={setB}   unit="m" step={0.5} min={1} />
              <NInput label="Şerit Eni [m]"         value={seritEni} onChange={setSeritEni} unit="m" step={0.005} min={0.01} />
              <NInput label="Gömü Derinliği h [m]" value={gomDerinligi} onChange={setGom} unit="m" step={0.1} min={0.3} />
            </div>
            {res && res.L_serit && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-2 text-center">
                  <div className="text-[10px] text-amber-600 font-bold">L şerit</div>
                  <div className="font-mono font-black text-amber-700">{res.L_serit.toFixed(1)} m</div>
                  <div className="text-[10px] text-amber-400">2(a+b)</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-2 text-center">
                  <div className="text-[10px] text-amber-600 font-bold">Alan</div>
                  <div className="font-mono font-black text-amber-700">{res.A_serit.toFixed(1)} m²</div>
                  <div className="text-[10px] text-amber-400">a × b</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-2 text-center">
                  <div className="text-[10px] text-amber-600 font-bold">Rg</div>
                  <div className="font-mono font-black text-amber-700">{res.Rg_val.toFixed(3)} Ω</div>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-2 font-mono">Rg = ρ/(2πL) × [ln(2L/d) - 1 + L/√A]</p>
          </ToggleCard>
        </div>

        {/* SONUÇLAR */}
        <div className="xl:col-span-3 space-y-4">
          {!res ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center min-h-[400px]">
              <div className="text-center text-slate-400 p-8">
                <p className="font-bold text-sm">Verileri girin ve Hesapla'ya basın</p>
                <p className="text-xs mt-1 text-slate-300">Eşpotansiyel (zorunlu) · Kazık · Şerit (opsiyonel)</p>
              </div>
            </div>
          ) : (<>

            {/* Paralel kombinasyon */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Paralel Kombinasyon → Reş Final</h3>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[
                  { lbl:'Mevcut', val: res.R_mevcut, color:'slate' },
                  { lbl:'Kazık',  val: res.R_kazik,  color:'teal', dim: !kazikAktif },
                  { lbl:'Şerit',  val: res.R_serit,  color:'amber', dim: !seritAktif },
                  { lbl:'Reş Final', val: res.Res_final, color:'emerald', hl: true },
                ].map((m, i) => (
                  <div key={i} className={`rounded-xl px-3 py-3 text-center border ${m.hl ? 'bg-emerald-50 border-2 border-emerald-400' : m.dim ? 'bg-slate-50 border-slate-100 opacity-40' : `bg-${m.color}-50 border-${m.color}-200`}`}>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{m.lbl}</div>
                    <div className={`font-mono font-black ${m.hl ? 'text-emerald-700 text-2xl' : 'text-slate-700 text-lg'}`}>
                      {m.val ? m.val.toFixed(3) : '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">Ω</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                1/Reş = 1/{res.R_mevcut ? res.R_mevcut.toFixed(3) : '∞'}
                {res.R_kazik  ? ` + 1/${res.R_kazik.toFixed(3)}`  : ''}
                {res.R_serit  ? ` + 1/${res.R_serit.toFixed(3)}`  : ''}
                {` = ${(1/res.Res_final).toFixed(4)}  →  Reş = ${res.Res_final.toFixed(3)} Ω`}
              </p>
            </div>

            {/* GPR */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-orange-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">GPR — Toprak Potansiyel Yükselmesi</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1 bg-orange-50 border-2 border-orange-300 rounded-xl px-4 py-4 text-center">
                  <div className="text-[10px] text-orange-500 font-bold uppercase mb-1">GPR = Reş × It</div>
                  <div className="text-4xl font-black font-mono text-orange-600">{res.GPR.toFixed(0)}</div>
                  <div className="text-sm text-orange-400 mt-1">V</div>
                </div>
                <div className="text-xs text-slate-400 space-y-1 font-mono">
                  <div>It = {r} × {(Ik1*1000).toFixed(0)} = {res.It.toFixed(1)} A</div>
                  <div>Reş = {res.Res_final.toFixed(3)} Ω</div>
                </div>
              </div>
              {[0.5, 1.0].map(t => {
                const lim = res.transferDetay[t];
                return (
                  <div key={t} className={`rounded-lg px-4 py-3 flex items-center justify-between mb-2 ${lim.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div>
                      <span className="text-xs font-bold text-slate-700">Transfer — t = {t} s</span>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        GPR {res.GPR.toFixed(0)} V {lim.ok ? '≤' : '>'} 2×Ud = {lim.esik} V
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${lim.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {lim.ok ? '✓ Basit yeterli' : '✗ Detaylı analiz'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* t=0.5 ve t=1.0 kontrolleri */}
            {[0.5, 1.0].map(t => {
              const s = res.sureler[t];
              return (
                <div key={t} className="bg-white p-5 rounded-xl shadow-sm border">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-3 h-3 rounded-full ${t === 0.5 ? 'bg-blue-400' : 'bg-purple-400'}`}/>
                    <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">t = {t} s — Gerilim Kontrolleri</h3>
                    <span className="ml-auto text-[10px] text-slate-400 font-mono">Ud={s.Ud}V · Ua={s.Ua}V</span>
                  </div>
                  <div className="space-y-3">
                    <SonucKart ok={s.dokunma_ok} label="Dokunma Gerilimi (eşpotansiyel sahada)"
                      hesap={res.GPR} op="≤" sinir={s.Ud} unit="V"
                      sub={`GPR = ${res.Res_final.toFixed(3)} × ${res.It.toFixed(1)} = ${res.GPR.toFixed(1)} V`} />
                    <SonucKart ok={s.adim_ok} label="Saha Sınırı Adım Gerilimi (1m uzakta)"
                      hesap={res.Ua_sinir} op="≤" sinir={s.Ua} unit="V"
                      sub={`Ua = ρ×It/(4π) = ${rhoE}×${res.It.toFixed(1)}/(4π) = ${res.Ua_sinir.toFixed(1)} V`} />
                  </div>
                </div>
              );
            })}

            {/* Kesit */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">İletken Kesit Kontrolü</h3>
                <span className="ml-auto text-[10px] text-slate-400">k = {K_GALVANIZ} A/mm²</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[{t:'t=0.5s', q:res.q_05},{t:'t=1.0s', q:res.q_10},{t:'Min. Gerekli', q:res.q_gerekli, hl:true}].map(m => (
                  <div key={m.t} className={`rounded-xl px-3 py-3 text-center ${m.hl ? 'bg-amber-50 border-2 border-amber-300' : 'bg-slate-50 border border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{m.t}</div>
                    <div className={`font-mono font-black text-lg ${m.hl ? 'text-amber-700' : 'text-slate-700'}`}>{m.q.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400">mm²</div>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-700">Seçilen Lama</div>
                  <div className="text-[10px] font-mono text-slate-400">min. {res.q_gerekli.toFixed(2)} mm²</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-amber-700">{res.secilen_lama.etiket}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">✓ UYGUN</span>
                </div>
              </div>
            </div>

            {/* RCD */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-violet-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Kaçak Akım Röle Kontrolü</h3>
              </div>
              <SonucKart ok={res.rcd_ok}
                label={`Reş ≤ 50V / (${nInv} evirici × 0.3 A)`}
                hesap={res.Res_final} op="≤" sinir={res.Rcd_esik.toFixed(2)} unit="Ω"
                sub={`Eşik = 50/(${nInv}×0.3) = ${res.Rcd_esik.toFixed(2)} Ω`} />
            </div>

          </>)}
        </div>
      </div>
    </div>
  );
}
