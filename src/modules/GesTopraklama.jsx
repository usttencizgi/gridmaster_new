import { useState } from 'react';
import NumInput from '../components/NumInput.jsx';

// ─── Sabitler ──────────────────────────────────────────────────────
const K_GALVANIZ = 180; // A/mm² — galvanizli çerit, t=1sn, 300°C
const RCD_BASI   = 0.3; // A/evirici — kaçak akım koruma röle eşiği
const UT_LIMIT   = 50;  // V — normal işletme max dokunma gerilimi

// İzin verilen değerler — Dalziel + TS EN 50522 Ek A
const LIMITS = {
  0.5: { Ud: 150, Ua: 200 },  // t = 0.5 s
  1.0: { Ud:  75, Ua: 130 },  // t = 1.0 s
};

// Toprak özgül direnci referans tablosu
const TOPRAK_TIPLERI = [
  { label: 'Bataklık',           r: 30   },
  { label: 'Killi Toprak',       r: 100  },
  { label: 'Rutubetli Kum',      r: 200  },
  { label: 'Rutubetli Çakıl',    r: 500  },
  { label: 'Kuru Kum / Çakıl',   r: 1000 },
  { label: 'Taşlık Zemin',       r: 3000 },
];

// Bölünme katsayısı seçenekleri
const R_SECENEKLER = [
  { label: 'Sadece havai hat',         r: 0.6  },
  { label: 'Karma (havai + yer altı)', r: 0.45 },
  { label: 'Sadece yer altı kablo',    r: 0.3  },
];

// ─── Hesap Motoru ─────────────────────────────────────────────────
function calcTopraklama({ Ik1_kA, n, Lc, dc, rhoE, r, nInv }) {
  const Ik1_A = Ik1_kA * 1000; // kA → A

  // 1. Tek çubuk direnci
  const Rc_tek = (rhoE / (2 * Math.PI * Lc)) * Math.log(4 * Lc / dc);

  // 2. n paralel çubuk
  const Rc_n = Rc_tek / n;

  // 3. Eşdeğer direnç (%10 müşterek etki düzeltmesi)
  const Res = Rc_n * 1.10;

  // 4. Topraktan geçen arıza akımı
  const It = r * Ik1_A; // A

  // 5. GPR — Toprak Potansiyel Yükselmesi
  const GPR = Res * It; // V

  // 6. Transfer gerilimi kontrolü
  const transferDetay = {};
  [0.5, 1.0].forEach(t => {
    const Ud = LIMITS[t].Ud;
    transferDetay[t] = {
      esik: 2 * Ud,
      ok: GPR <= 2 * Ud,
    };
  });

  // 7. Saha sınırı adım gerilimi (1m uzaklıkta, tek çubuk yaklaşımı)
  //    Ua = ρ × It / (4π × d²) × (1 - 1/(1+2)) — basitleştirilmiş
  //    Pratik yaklaşım: Ua_sinir = ρE × It / (2π) × (1/1 - 1/2) = ρE×It/(4π)
  const Ua_sinir = (rhoE * It) / (4 * Math.PI); // V

  // 8. Her iki süre için karşılaştırma
  const sureler = {};
  [0.5, 1.0].forEach(t => {
    const { Ud, Ua } = LIMITS[t];
    sureler[t] = {
      Ud, Ua,
      gpr_ok:      GPR   <= 2 * Ud,
      adim_ok:     Ua_sinir <= Ua,
      dokunma_ok:  GPR   <= Ud,      // eşpotansiyel sahada GPR = max dokunma
    };
  });

  // 9. İletken kesit kontrolü (TS EN 50522)
  //    q = It × √t / k
  const q_05 = (It * Math.sqrt(0.5)) / K_GALVANIZ; // mm²
  const q_10 = (It * Math.sqrt(1.0)) / K_GALVANIZ; // mm²
  const q_gerekli = Math.max(q_05, q_10);
  const LAMA_SECENEKLERI = [
    { etiket: '25×3 (75 mm²)',   alan: 75  },
    { etiket: '30×3.5 (105 mm²)', alan: 105 },
    { etiket: '40×4 (160 mm²)',  alan: 160 },
    { etiket: '50×5 (250 mm²)',  alan: 250 },
  ];
  const secilen_lama = LAMA_SECENEKLERI.find(l => l.alan >= q_gerekli) || LAMA_SECENEKLERI[LAMA_SECENEKLERI.length - 1];

  // 10. RCD / kaçak akım röle kontrolü
  const Rcd_esik = UT_LIMIT / (nInv * RCD_BASI);
  const rcd_ok   = Res <= Rcd_esik;

  return {
    Rc_tek, Rc_n, Res,
    It, GPR,
    Ua_sinir,
    sureler, transferDetay,
    q_05, q_10, q_gerekli, secilen_lama,
    Rcd_esik, rcd_ok,
    Ik1_A,
  };
}

// ─── UI Bileşenleri ───────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
      {children}
    </div>
  );
}

function NInput({ label, value, onChange, unit, step, min }) {
  return (
    <Field label={label}>
      <NumInput value={value} onChange={onChange} unit={unit} step={step ?? 0.01} min={min ?? 0} />
    </Field>
  );
}

function SonucKart({ ok, label, hesap, sinir, unit, sub }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-300'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{sub}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {ok ? '✓ UYGUN' : '✗ UYGUN DEĞİL'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 text-center rounded-lg px-3 py-2 border ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-[10px] text-slate-400 mb-0.5">Hesaplanan</div>
          <div className={`text-xl font-black font-mono ${ok ? 'text-green-700' : 'text-red-600'}`}>
            {typeof hesap === 'number' ? hesap.toFixed(2) : hesap} {unit}
          </div>
        </div>
        <div className={`text-xl font-black ${ok ? 'text-green-500' : 'text-red-400'}`}>{ok ? '<' : '>'}</div>
        <div className="flex-1 text-center rounded-lg px-3 py-2 bg-white border border-slate-200">
          <div className="text-[10px] text-slate-400 mb-0.5">Sınır</div>
          <div className="text-xl font-black font-mono text-slate-700">{sinir} {unit}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────
export default function GesTopraklama({ initialIk1 = 0 }) {
  const [Ik1, setIk1]     = useState(initialIk1 || 1.574);
  const [n, setN]         = useState(4);
  const [Lc, setLc]       = useState(2);
  const [dc, setDc]       = useState(0.02);
  const [rhoE, setRhoE]   = useState(100);
  const [rIdx, setRIdx]   = useState(1);         // karma = 0.45
  const [nInv, setNInv]   = useState(1);
  const [res, setRes]     = useState(null);

  const r = R_SECENEKLER[rIdx].r;

  const hesapla = () => {
    setRes(calcTopraklama({ Ik1_kA: Ik1, n, Lc, dc, rhoE, r, nInv }));
  };

  const allOk = res && Object.values(res.sureler).every(s => s.gpr_ok && s.adim_ok) && res.rcd_ok;

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 rounded-xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/><line x1="6" y1="12" x2="6" y2="16"/><line x1="18" y1="12" x2="18" y2="16"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">GES — Topraklama Hesabı</h2>
            <p className="text-emerald-100 text-sm">Eşpotansiyel Bağlantılı Saha · IEC EN 50522 · ETT Yönetmeliği</p>
          </div>
        </div>
        <button onClick={hesapla}
          className="bg-white text-emerald-700 font-black py-2.5 px-8 rounded-xl shadow-lg hover:scale-105 transition-all text-sm">
          HESAPLA
        </button>
      </div>

      {/* GENEL SONUÇ */}
      {res && (
        <div className={`rounded-xl p-4 flex items-center gap-4 border-2 ${allOk ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <div className={`text-3xl font-black ${allOk ? 'text-green-600' : 'text-red-600'}`}>{allOk ? '✓' : '✗'}</div>
          <div>
            <div className={`font-black text-base ${allOk ? 'text-green-700' : 'text-red-700'}`}>
              {allOk ? 'Topraklama Sistemi Tüm Kontrolleri Geçti' : 'Uyumsuzluk Var — Kırmızı bölümleri inceleyin'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">
              Reş = {res.Res.toFixed(3)} Ω · GPR = {res.GPR.toFixed(1)} V · It = {res.It.toFixed(1)} A
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* ── GİRİŞLER ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Arıza Akımı */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-red-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Arıza Akımı</h3>
              {initialIk1 > 0 && (
                <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                  OG modülünden aktarıldı
                </span>
              )}
            </div>
            <NInput label='Faz-Toprak Arıza Akımı I"k1 [kA]' value={Ik1} onChange={setIk1} unit="kA" step={0.001} min={0.001} />
            <p className="text-[10px] text-slate-400 mt-2 font-mono">= {(Ik1 * 1000).toFixed(0)} A</p>
          </div>

          {/* Topraklama Çubukları */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-teal-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Topraklama Çubukları</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NInput label="Çubuk Sayısı n [adet]"    value={n}   onChange={setN}   unit="adet" step={1} min={1} />
              <NInput label="Çubuk Uzunluğu Lç [m]"    value={Lc}  onChange={setLc}  unit="m"    step={0.1} min={0.5} />
              <NInput label="Çubuk Çapı dç [m]"         value={dc}  onChange={setDc}  unit="m"    step={0.001} min={0.001} />
            </div>
            {res && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-teal-600 font-bold">Tek Çubuk Rç</div>
                  <div className="font-mono font-black text-teal-700">{res.Rc_tek.toFixed(3)} Ω</div>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-teal-600 font-bold">{n} Çubuk Paralel</div>
                  <div className="font-mono font-black text-teal-700">{res.Rc_n.toFixed(3)} Ω</div>
                </div>
              </div>
            )}
          </div>

          {/* Toprak */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-amber-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Zemin Özgül Direnci</h3>
            </div>
            <div className="mb-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zemin Tipi (Referans)</label>
              <div className="grid grid-cols-2 gap-1.5">
                {TOPRAK_TIPLERI.map(t => (
                  <button key={t.r} onClick={() => setRhoE(t.r)}
                    className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${rhoE === t.r ? 'bg-amber-50 border-amber-400 text-amber-700 font-bold' : 'border-slate-200 text-slate-500 hover:border-amber-200'}`}>
                    <span className="font-mono font-bold">{t.r}</span> Ω·m — {t.label}
                  </button>
                ))}
              </div>
            </div>
            <NInput label="ρE — Özgül Toprak Direnci [Ω·m]" value={rhoE} onChange={setRhoE} unit="Ω·m" step={10} min={10} />
          </div>

          {/* Bölünme Katsayısı */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-blue-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Bölünme Katsayısı r</h3>
            </div>
            <div className="space-y-2">
              {R_SECENEKLER.map((s, i) => (
                <button key={i} onClick={() => setRIdx(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${rIdx === i ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{s.label}</span>
                    <span className={`font-mono font-black text-lg ${rIdx === i ? 'text-blue-600' : 'text-slate-400'}`}>r = {s.r}</span>
                  </div>
                </button>
              ))}
            </div>
            {res && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 font-mono text-xs text-blue-800">
                It = {r} × {(Ik1*1000).toFixed(0)} A = <b>{res.It.toFixed(1)} A</b>
              </div>
            )}
          </div>

          {/* Evirici / RCD */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-violet-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Kaçak Akım Kontrolü</h3>
            </div>
            <NInput label="Evirici Sayısı" value={nInv} onChange={setNInv} unit="adet" step={1} min={1} />
            <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-xs font-mono text-violet-800">
              Rcd_eşik = 50 V / ({nInv} × 0.3 A) = {(50 / (nInv * 0.3)).toFixed(2)} Ω
            </div>
          </div>
        </div>

        {/* ── SONUÇLAR ── */}
        <div className="xl:col-span-3 space-y-4">
          {!res ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center min-h-[500px]">
              <div className="text-center text-slate-400 p-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
                  <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/>
                </svg>
                <p className="font-bold text-sm">Verileri girin ve Hesapla'ya basın</p>
                <p className="text-xs mt-1 text-slate-300">GPR · Adım Gerilimi · Transfer · Kesit Kontrolü</p>
              </div>
            </div>
          ) : (<>

            {/* 1. Direnç Özet */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-teal-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Topraklama Direnci</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: 'Tek Çubuk Rç', v: res.Rc_tek, u: 'Ω' },
                  { l: `${n} Çubuk ∥`, v: res.Rc_n,   u: 'Ω' },
                  { l: 'Reş (+%10)',    v: res.Res,    u: 'Ω', hl: true },
                  { l: 'It Toprak',    v: res.It,     u: 'A' },
                ].map((m, i) => (
                  <div key={i} className={`rounded-xl px-3 py-3 text-center ${m.hl ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-slate-50 border border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">{m.l}</div>
                    <div className={`text-xl font-black font-mono ${m.hl ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {m.v.toFixed(m.u === 'A' ? 1 : 3)}
                    </div>
                    <div className="text-[10px] text-slate-400">{m.u}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-slate-400 font-mono space-y-0.5">
                <div>Rç_tek = ρE/(2π·Lç) × ln(4Lç/dç) = {rhoE}/(2π·{Lc}) × ln({(4*Lc/dc).toFixed(0)}) = {res.Rc_tek.toFixed(3)} Ω</div>
                <div>Reş = (Rç_tek/n) × 1.10 = ({res.Rc_tek.toFixed(3)}/{n}) × 1.10 = {res.Res.toFixed(3)} Ω</div>
              </div>
            </div>

            {/* 2. GPR */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-orange-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">GPR — Toprak Potansiyel Yükselmesi</h3>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 bg-orange-50 border-2 border-orange-300 rounded-xl px-4 py-4 text-center">
                  <div className="text-[10px] text-orange-500 font-bold uppercase mb-1">GPR = Reş × It</div>
                  <div className="text-4xl font-black font-mono text-orange-600">{res.GPR.toFixed(0)}</div>
                  <div className="text-sm text-orange-400 mt-1">V</div>
                </div>
                <div className="text-slate-400 text-sm space-y-1">
                  <div className="font-mono text-xs">{res.Res.toFixed(3)} Ω × {res.It.toFixed(1)} A</div>
                  <div className="text-[10px] text-slate-300">Eşpotansiyel sahada</div>
                  <div className="text-[10px] text-slate-300">tüm saha bu gerilime yükselir</div>
                </div>
              </div>

              {/* Transfer kontrolü her iki süre için */}
              <div className="space-y-2">
                {[0.5, 1.0].map(t => {
                  const lim = res.transferDetay[t];
                  return (
                    <div key={t} className={`rounded-lg px-4 py-3 flex items-center justify-between ${lim.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div>
                        <span className="text-xs font-bold text-slate-700">Transfer Gerilimi — t = {t} s</span>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          GPR = {res.GPR.toFixed(0)} V {lim.ok ? '≤' : '>'} 2×Ud = {lim.esik} V
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {lim.ok ? 'Basit kontrol yeterli' : 'Detaylı transfer analizi gerekli'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${lim.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {lim.ok ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Adım + Dokunma — Her iki süre */}
            {[0.5, 1.0].map(t => {
              const s = res.sureler[t];
              return (
                <div key={t} className="bg-white p-5 rounded-xl shadow-sm border">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-3 h-3 rounded-full ${t === 0.5 ? 'bg-blue-400' : 'bg-purple-400'}`}/>
                    <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">
                      t = {t} s — İzin Verilen Gerilimler
                    </h3>
                    <span className="ml-auto text-[10px] text-slate-400 font-mono">
                      Ud = {s.Ud} V · Ua = {s.Ua} V
                    </span>
                  </div>
                  <div className="space-y-3">
                    <SonucKart
                      ok={s.dokunma_ok}
                      label="Dokunma Gerilimi (GPR — eşpotansiyel sahada)"
                      hesap={res.GPR}
                      sinir={s.Ud}
                      unit="V"
                      sub={`GPR = Reş × It = ${res.Res.toFixed(3)} × ${res.It.toFixed(1)} = ${res.GPR.toFixed(1)} V`}
                    />
                    <SonucKart
                      ok={s.adim_ok}
                      label="Saha Sınırı Adım Gerilimi (1 m uzaklıkta)"
                      hesap={res.Ua_sinir}
                      sinir={s.Ua}
                      unit="V"
                      sub={`Ua = ρE×It/(4π) = ${rhoE}×${res.It.toFixed(1)}/(4π) = ${res.Ua_sinir.toFixed(1)} V`}
                    />
                  </div>
                </div>
              );
            })}

            {/* 4. İletken Kesit */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Topraklama İletken Kesiti</h3>
                <span className="ml-auto text-[10px] text-slate-400">k = {K_GALVANIZ} A/mm² (galvanizli çerit)</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-slate-50 rounded-lg px-3 py-3 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">t=0.5s için</div>
                  <div className="font-mono font-black text-slate-700 text-lg">{res.q_05.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400">mm²</div>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-3 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">t=1.0s için</div>
                  <div className="font-mono font-black text-slate-700 text-lg">{res.q_10.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400">mm²</div>
                </div>
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg px-3 py-3 text-center">
                  <div className="text-[10px] text-amber-600 font-bold uppercase mb-1">Gerekli Min.</div>
                  <div className="font-mono font-black text-amber-700 text-lg">{res.q_gerekli.toFixed(2)}</div>
                  <div className="text-[10px] text-amber-500">mm²</div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-700">Seçilen Lama</div>
                  <div className="text-[10px] text-slate-400 font-mono">q gerekli = {res.q_gerekli.toFixed(2)} mm²</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-amber-700 text-lg">{res.secilen_lama.etiket}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">✓ UYGUN</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-mono">
                q = It × √t / k = {res.It.toFixed(1)} × √t / {K_GALVANIZ}
              </p>
            </div>

            {/* 5. RCD Kontrolü */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-violet-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Kaçak Akım Röle Kontrolü (Normal İşletme)</h3>
              </div>
              <SonucKart
                ok={res.rcd_ok}
                label={`Topraklama Direnci ≤ 50V / (${nInv} evirici × 0.3 A)`}
                hesap={res.Res}
                sinir={res.Rcd_esik.toFixed(2)}
                unit="Ω"
                sub={`Reş = ${res.Res.toFixed(3)} Ω · Eşik = 50 / (${nInv}×0.3) = ${res.Rcd_esik.toFixed(2)} Ω`}
              />
            </div>

          </>)}
        </div>
      </div>
    </div>
  );
}
