import { useState } from 'react';
import NumInput from '../components/NumInput.jsx';
import { X } from '../components/Icons.jsx';
import { exportGesKabloWord } from '../utils/export.js';
import { AG_CABLES, AG_CABLE_CURRENT_LIMITS, DC_SOLAR_CABLES } from '../data/cables.js';

// ─── Sabitler ─────────────────────────────────────────────────────
const K_DC = 56;
const K_AC = { Cu: 56, Al: 35 };
const FUSES = [6,10,13,16,20,25,32,40,50,63,80,100,125,160,200,250,315,400];
const nextFuse = I => FUSES.find(f => f > I) ?? '>400';

// AC kablo seçenekleri (tipik GES kesimleri)
const AC_SECTIONS = AG_CABLES.filter(s => s >= 4 && s <= 240);

const getAcIkat = (section, mat) => AG_CABLE_CURRENT_LIMITS[mat]?.[section] ?? 0;

// ─── Panel-Evirici Uyumluluk Hesabı ──────────────────────────────
function calcPvUyumluluk({ panel, inverter, strings }) {
  const { Voc, Vmp, Isc, Imp, kVoc, kVmp, tmin, tmax, tnom } = panel;
  const { Vdc_max, Vdc_min, Vmppt_max, Vmppt_min, Isc_max } = inverter;

  // Her string grubundaki nSeri değerlerini al (benzersiz)
  const nSeriList = [...new Set(strings.map(s => s.nSeri))];
  const results = [];

  nSeriList.forEach(nSeri => {
    const nPar = strings.filter(s => s.nSeri === nSeri).length;
    const Voc_cold = nSeri * Voc * (1 + (kVoc / 100) * (tnom - tmin));
    const Voc_hot  = nSeri * Voc * (1 + (kVoc / 100) * (tnom - tmax));
    const Vmp_cold = nSeri * Vmp * (1 + (kVmp / 100) * (tnom - tmin));
    const Vmp_hot  = nSeri * Vmp * (1 + (kVmp / 100) * (tnom - tmax));
    const Isc_total = Isc * nPar;
    const Imp_total = Imp * nPar;
    results.push({
      nSeri, nPar,
      checks: [
        { label:`Voc @ ${tmin}°C (soğuk açık devre)`, val:Voc_cold, op:'<', lim:Vdc_max,   pass:Voc_cold < Vdc_max,   unit:'V', tip:'Evirici maks. DC girişini aşmamalı' },
        { label:`Voc @ ${tmax}°C (sıcak açık devre)`, val:Voc_hot,  op:'>', lim:Vdc_min,   pass:Voc_hot  > Vdc_min,   unit:'V', tip:'Evirici min. DC girişinin altına düşmemeli' },
        { label:`Vmp @ ${tmin}°C (soğuk MPPT)`,       val:Vmp_cold, op:'<', lim:Vmppt_max, pass:Vmp_cold < Vmppt_max, unit:'V', tip:'MPPT maks. gerilimini aşmamalı' },
        { label:`Vmp @ ${tmax}°C (sıcak MPPT)`,       val:Vmp_hot,  op:'>', lim:Vmppt_min, pass:Vmp_hot  > Vmppt_min, unit:'V', tip:'MPPT min. geriliminin altına düşmemeli' },
        { label:`Isc toplam (${nPar} dizi paralel)`,   val:Isc_total,op:'<', lim:Isc_max,   pass:Isc_total <= Isc_max,  unit:'A', tip:'Evirici maks. kısa devre giriş akımı' },
        { label:`Imp toplam (${nPar} dizi paralel)`,   val:Imp_total,op:'<', lim:Isc_max,   pass:Imp_total <= Isc_max,  unit:'A', tip:'Evirici maks. MPPT akımı' },
      ],
    });
  });
  return results;
}


function calcGes({ panel, sistem, dc, strings, ac1, ac2 }) {
  const { Wp, Vmpp, Impp, Isc } = panel;
  const { Pac, Pmax_inv, Un, cosf } = sistem;
  const { Sdc, Ikat_dc, kSic_dc, kDos_dc } = dc;

  // Dizi hesapları (her dizinin nSeri farklı olabilir)
  const dcRows = strings.map(s => {
    const Udizi = Vmpp * s.nSeri;
    const Pdizi = Wp * s.nSeri;
    const Pk    = 2 * s.L * Impp * Impp / (Sdc * K_DC);
    const Ppct  = Pk / Pdizi * 100;
    const epct  = 2 * 100 * s.L * Impp / (Sdc * K_DC * Udizi);
    return { ...s, Udizi, Pdizi, Pk, Ppct, epct };
  });

  // DC akım taşıma
  const Imax_dc = 1.25 * Isc;
  const Itk_dc  = Ikat_dc * kSic_dc * kDos_dc;

  // Güç uyumu — benzersiz nSeri gruplarıyla göster
  const totalDcKW = strings.reduce((sum, s) => sum + (Wp * s.nSeri) / 1000, 0);
  const gucOk = totalDcKW <= Pmax_inv;

  // AC
  const In   = (Pac * 1000) / (Un * Math.sqrt(3) * cosf);
  const KAC1 = K_AC[ac1.material];
  const KAC2 = K_AC[ac2.material];
  const Pk1  = 3 * ac1.L * In * In / (ac1.S * KAC1);
  const e1   = Pk1 / (Pac * 1000) * 100;
  const Itk1 = ac1.Ikat * ac1.kSic * ac1.kDos;
  const Pk2  = 3 * ac2.L * In * In / (ac2.S * KAC2);
  const e2   = Pk2 / (Pac * 1000) * 100;
  const Itk2 = ac2.Ikat * ac2.kSic * ac2.kDos;

  return {
    dcRows,
    Imax_dc, Itk_dc, dcAkimOk: Itk_dc > Imax_dc,
    totalDcKW, gucOk,
    In, Pk1, e1, Itk1, ac1Ok: Itk1 > In,
    Pk2, e2, Itk2, ac2Ok: Itk2 > In,
    sigortaVal: nextFuse(In),
  };
}

// ─── Alt Bileşenler ────────────────────────────────────────────────
function Field({ label, value, onChange, unit, step, min }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
      <NumInput value={value} onChange={onChange} unit={unit} step={step} min={min} />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-sm bg-white focus:border-yellow-400 outline-none transition-colors"
      />
    </div>
  );
}

function CardHead({ color, label }) {
  const dot = {
    yellow: 'bg-yellow-400', orange: 'bg-orange-400',
    blue: 'bg-blue-400', green: 'bg-green-400', amber: 'bg-amber-500',
    violet: 'bg-violet-400', teal: 'bg-teal-400',
  }[color] || 'bg-slate-400';
  return (
    <div className="flex items-center gap-2 mb-4 pb-3 border-b">
      <div className={`w-3 h-3 rounded-full ${dot}`} />
      <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">{label}</h3>
    </div>
  );
}

function Badge({ ok }) {
  return ok
    ? <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">✓ UYGUN</span>
    : <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">✗ UYGUN DEĞİL</span>;
}

function CheckCard({ label, calc, op, limit, unit, pass, sub }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-300'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{sub}</p>}
        </div>
        <Badge ok={pass} />
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 text-center rounded-lg px-3 py-2 border ${pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-[10px] text-slate-400 mb-0.5">Hesaplanan</div>
          <div className={`text-lg font-black font-mono ${pass ? 'text-green-700' : 'text-red-600'}`}>
            {typeof calc === 'number' ? calc.toFixed(2) : calc} {unit}
          </div>
        </div>
        <div className={`text-xl font-black ${pass ? 'text-green-500' : 'text-red-500'}`}>{op}</div>
        <div className="flex-1 text-center rounded-lg px-3 py-2 bg-white border border-slate-200">
          <div className="text-[10px] text-slate-400 mb-0.5">Sınır</div>
          <div className="text-lg font-black font-mono text-slate-700">{limit} {unit}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ───────────────────────────────────────────────────
const DEFAULT_STRING = (idx) => ({ id: Date.now() + idx, code: `${idx + 1}.1`, nSeri: 12, L: 20 });

export default function GesKablo() {
  // Panel
  const [panel, setPanel] = useState({
    Wp: 590, Vmpp: 44.14, Impp: 13.37, Isc: 14.16,
    Voc: 52.40, Vmp: 44.14, Imp: 13.37,
    kVoc: -0.27, kVmp: -0.35,
    tmin: -10, tmax: 70, tnom: 25,
  });
  const P = (k, v) => setPanel(p => ({ ...p, [k]: v }));

  const [inverter, setInverter] = useState({
    Vdc_max: 1000, Vdc_min: 200, Vmppt_max: 800, Vmppt_min: 200, Isc_max: 30,
  });
  const IV = (k, v) => setInverter(iv => ({ ...iv, [k]: v }));

  // Sistem
  const [sistem, setSistem] = useState({ Pac: 25, Pmax_inv: 175, Un: 400, cosf: 1.0 });
  const S = (k, v) => setSistem(s => ({ ...s, [k]: v }));

  // DC Kablo
  const [dcSection, setDcSection] = useState(6);
  const [dc, setDc] = useState({ Sdc: 6, Ikat_dc: 70, kSic_dc: 0.76, kDos_dc: 0.70 });
  const D = (k, v) => setDc(d => ({ ...d, [k]: v }));

  const handleDcSection = (section) => {
    const found = DC_SOLAR_CABLES.find(c => c.section === Number(section));
    setDcSection(Number(section));
    setDc(d => ({ ...d, Sdc: Number(section), Ikat_dc: found ? found.Ibase : d.Ikat_dc }));
  };

  // DC Diziler
  const [strings, setStrings] = useState([
    { id: 1, code: '1.1', nSeri: 12, L: 22 },
    { id: 2, code: '1.2', nSeri: 12, L: 26 },
    { id: 3, code: '2.1', nSeri: 16, L: 30 },
    { id: 4, code: '3.1', nSeri: 18, L: 34 },
  ]);
  const addString = () => setStrings(s => [...s, DEFAULT_STRING(s.length)]);
  const rmString  = (id) => setStrings(s => s.filter(r => r.id !== id));
  const updStr    = (id, k, v) => setStrings(s => s.map(r => r.id === id ? { ...r, [k]: v } : r));

  // AC Hat 1 (ADP→GES)
  const [ac1, setAc1] = useState({ L: 5, S: 16, material: 'Cu', label: 'NYY', Ikat: 79, kSic: 0.95, kDos: 1.0 });
  const A1 = (k, v) => setAc1(a => ({ ...a, [k]: v }));
  const handleAc1Cable = (section, material) => {
    const ikat = getAcIkat(Number(section), material);
    setAc1(a => ({ ...a, S: Number(section), material, Ikat: ikat || a.Ikat }));
  };

  // AC Hat 2 (GES→İnverter)
  const [ac2, setAc2] = useState({ L: 2, S: 10, material: 'Cu', label: 'N2XH', Ikat: 59, kSic: 0.95, kDos: 1.0 });
  const A2 = (k, v) => setAc2(a => ({ ...a, [k]: v }));
  const handleAc2Cable = (section, material) => {
    const ikat = getAcIkat(Number(section), material);
    setAc2(a => ({ ...a, S: Number(section), material, Ikat: ikat || a.Ikat }));
  };

  // Hesap
  const [res, setRes] = useState(null);
  const hesapla = () => {
    const r = calcGes({ panel, sistem, dc, strings, ac1, ac2 });
    r.pvUyumluluk = calcPvUyumluluk({ panel, inverter, strings });
    setRes(r);
  };

  const allOk = res && res.dcAkimOk && res.gucOk && res.ac1Ok && res.ac2Ok;

  // ── SELECT stili ──
  const sel = 'w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:border-yellow-400 outline-none transition-colors';

  return (
    <div className="space-y-5">

      {/* ═══ HEADER ═══ */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-5 rounded-xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            {/* Solar + kablo ikonu */}
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>
              <line x1="12" y1="12" x2="12" y2="17"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">GES — Kablo &amp; Güç Hesapları</h2>
            <p className="text-yellow-100 text-sm">DC/AC Kablo · Akım Taşıma · Sigorta · Güç Uyumu</p>
          </div>
        </div>
        <button onClick={hesapla}
          className="bg-white text-orange-600 font-black py-2.5 px-8 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm">
          HESAPLA
        </button>
        {res && (
          <button
            onClick={() => exportGesKabloWord(panel, sistem, dc, strings, ac1, ac2, res, inverter)}
            className="bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all">
            📄 Word
          </button>
        )}
      </div>

      {/* ═══ GENEL SONUÇ BANNER ═══ */}
      {res && (
        <div className={`rounded-xl p-4 flex items-center gap-4 border-2 ${allOk ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <div className={`text-3xl font-black ${allOk ? 'text-green-600' : 'text-red-600'}`}>{allOk ? '✓' : '✗'}</div>
          <div>
            <div className={`font-black text-base ${allOk ? 'text-green-700' : 'text-red-700'}`}>
              {allOk ? 'Tüm Kontroller Uygun' : 'Uyumsuzluk Tespit Edildi — Kırmızı kartları inceleyiniz'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              In = {res.In.toFixed(2)} A · Toplam DC Güç = {res.totalDcKW.toFixed(2)} kW · Sigorta: 3 × {res.sigortaVal} A
            </div>
          </div>
        </div>
      )}

      {/* ═══ 2 + 3 KOLON ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* ── SOL: GİRİŞLER ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Panel */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <CardHead color="yellow" label="Panel Bilgileri" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Panel Gücü (Wp)" value={panel.Wp}   onChange={v=>P('Wp',v)}   unit="W"   />
              <Field label="Vmpp"            value={panel.Vmpp} onChange={v=>P('Vmpp',v)} unit="V" step="0.01" />
              <Field label="Impp"            value={panel.Impp} onChange={v=>P('Impp',v)} unit="A" step="0.01" />
              <Field label="Isc"             value={panel.Isc}  onChange={v=>P('Isc',v)}  unit="A" step="0.01" />
              <Field label="Voc"             value={panel.Voc}  onChange={v=>P('Voc',v)}  unit="V" step="0.01" />
              <Field label="αVoc (%/°C)"     value={panel.kVoc} onChange={v=>P('kVoc',v)} unit="%/°C" step="0.01" />
              <Field label="αVmp (%/°C)"     value={panel.kVmp} onChange={v=>P('kVmp',v)} unit="%/°C" step="0.01" />
              <Field label="T_min (°C)"      value={panel.tmin} onChange={v=>P('tmin',v)} unit="°C" step="1" />
              <Field label="T_max (°C)"      value={panel.tmax} onChange={v=>P('tmax',v)} unit="°C" step="1" />
              <Field label="T_nom (°C)"      value={panel.tnom} onChange={v=>P('tnom',v)} unit="°C" step="1" />
            </div>
          </div>

          {/* Sistem */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <CardHead color="orange" label="Sistem (İnverter / AC)" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="AC Nominal Güç" value={sistem.Pac}      onChange={v=>S('Pac',v)}      unit="kW"  />
              <Field label="Max. Panel Girişi (Pmax)" value={sistem.Pmax_inv} onChange={v=>S('Pmax_inv',v)} unit="kW" />
              <Field label="AC Gerilim (Un)"          value={sistem.Un}       onChange={v=>S('Un',v)}       unit="V"   />
              <Field label="Cosφ"                     value={sistem.cosf}     onChange={v=>S('cosf',v)}     unit=""  step="0.01" />
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-purple-500 uppercase mb-2">Evirici DC Giriş Parametreleri</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Maks. DC Giriş (Vdc_max)" value={inverter.Vdc_max}   onChange={v=>IV('Vdc_max',v)}   unit="V" step="10" />
                <Field label="Min. DC Giriş (Vdc_min)"  value={inverter.Vdc_min}   onChange={v=>IV('Vdc_min',v)}   unit="V" step="10" />
                <Field label="MPPT Maks. (Vmppt_max)"   value={inverter.Vmppt_max} onChange={v=>IV('Vmppt_max',v)} unit="V" step="10" />
                <Field label="MPPT Min. (Vmppt_min)"    value={inverter.Vmppt_min} onChange={v=>IV('Vmppt_min',v)} unit="V" step="10" />
                <Field label="Maks. Isc Girişi"         value={inverter.Isc_max}   onChange={v=>IV('Isc_max',v)}   unit="A" step="1"  />
              </div>
            </div>
          </div>

          {/* DC Kablo */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <CardHead color="amber" label="DC Solar Kablo" />
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kablo Kesiti</label>
                <select value={dcSection} onChange={e => handleDcSection(e.target.value)} className={sel}>
                  {DC_SOLAR_CABLES.map(c => (
                    <option key={c.section} value={c.section}>{c.label}  —  temel {c.Ibase} A</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Baz Ikat (A)" value={dc.Ikat_dc} onChange={v=>D('Ikat_dc',v)} unit="A" />
                <Field label="Sıcaklık Fkt." value={dc.kSic_dc} onChange={v=>D('kSic_dc',v)} unit="" step="0.01" />
                <Field label="Döşeme Fkt."   value={dc.kDos_dc} onChange={v=>D('kDos_dc',v)} unit="" step="0.01" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono text-amber-800">
                Itk = {dc.Ikat_dc} × {dc.kSic_dc} × {dc.kDos_dc} = {(dc.Ikat_dc * dc.kSic_dc * dc.kDos_dc).toFixed(2)} A
              </div>
            </div>
          </div>

          {/* DC Diziler */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between mb-3">
              <CardHead color="yellow" label="DC Dizi Tanımları" />
              <button onClick={()=>{
                try{
                  const data=localStorage.getItem('catiDCLines');
                  if(!data){alert('Çatı tasarım modülünden henüz aktarım yapılmamış.');return;}
                  const lines=JSON.parse(data);
                  setStrings(lines.map(l=>({id:l.id||Date.now()+Math.random(),code:l.code,nSeri:l.nSeri,L:l.L})));
                  localStorage.removeItem('catiDCLines');
                }catch(e){alert('Aktarım verisi okunamadı.');}
              }}
                className="text-xs bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-700 font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5">
                🏠 Çatıdan Yükle
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-[10px] font-bold text-slate-400 uppercase text-left pb-2 pr-2">Kod</th>
                    <th className="text-[10px] font-bold text-slate-400 uppercase text-left pb-2 px-2">n Seri</th>
                    <th className="text-[10px] font-bold text-slate-400 uppercase text-left pb-2 px-2">L (m)</th>
                    <th className="pb-2 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {strings.map(s => (
                    <tr key={s.id}>
                      <td className="py-1 pr-2">
                        <input
                          value={s.code} onChange={e => updStr(s.id, 'code', e.target.value)}
                          className="w-20 border-2 border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:border-yellow-400 outline-none"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <NumInput value={s.nSeri} onChange={v => updStr(s.id, 'nSeri', v)} min="1" step="1"
                          className="w-20" />
                      </td>
                      <td className="py-1 px-2">
                        <NumInput value={s.L} onChange={v => updStr(s.id, 'L', v)} min="0" unit="m"
                          className="w-24" />
                      </td>
                      <td className="py-1 pl-1">
                        <button onClick={() => rmString(s.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors p-1">
                          <X size={14}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={addString}
              className="mt-3 w-full border-2 border-dashed border-slate-200 rounded-lg py-2 text-xs font-bold text-slate-400 hover:border-yellow-400 hover:text-yellow-500 transition-colors">
              + Dizi Ekle
            </button>
          </div>

          {/* AC Hat 1 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <CardHead color="blue" label="AC Hat 1 — ADP → GES Panosu" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kablo Kesiti</label>
                  <select value={ac1.S}
                    onChange={e => handleAc1Cable(e.target.value, ac1.material)}
                    className={sel}>
                    {AC_SECTIONS.map(s => (
                      <option key={s} value={s}>{s} mm²{getAcIkat(s, ac1.material) ? ` (${getAcIkat(s, ac1.material)} A)` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Malzeme</label>
                  <div className="flex gap-2">
                    {['Cu','Al'].map(m => (
                      <button key={m} onClick={() => handleAc1Cable(ac1.S, m)}
                        className={`flex-1 py-2 rounded-xl border-2 text-sm font-black transition-all ${ac1.material===m ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Kablo Tipi" value={ac1.label} onChange={v=>A1('label',v)} placeholder="NYY" />
                <Field label="Uzunluk L1" value={ac1.L}     onChange={v=>A1('L',v)}     unit="m" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Baz Ikat (A)"   value={ac1.Ikat} onChange={v=>A1('Ikat',v)} unit="A" />
                <Field label="Sıcaklık Fkt." value={ac1.kSic} onChange={v=>A1('kSic',v)} unit="" step="0.01" />
                <Field label="Döşeme Fkt."   value={ac1.kDos} onChange={v=>A1('kDos',v)} unit="" step="0.01" />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs font-mono text-blue-800">
                Itk = {ac1.Ikat} × {ac1.kSic} × {ac1.kDos} = {(ac1.Ikat * ac1.kSic * ac1.kDos).toFixed(2)} A
              </div>
            </div>
          </div>

          {/* AC Hat 2 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <CardHead color="green" label="AC Hat 2 — GES Panosu → İnverter" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kablo Kesiti</label>
                  <select value={ac2.S}
                    onChange={e => handleAc2Cable(e.target.value, ac2.material)}
                    className={sel}>
                    {AC_SECTIONS.map(s => (
                      <option key={s} value={s}>{s} mm²{getAcIkat(s, ac2.material) ? ` (${getAcIkat(s, ac2.material)} A)` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Malzeme</label>
                  <div className="flex gap-2">
                    {['Cu','Al'].map(m => (
                      <button key={m} onClick={() => handleAc2Cable(ac2.S, m)}
                        className={`flex-1 py-2 rounded-xl border-2 text-sm font-black transition-all ${ac2.material===m ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-500 hover:border-green-300'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Kablo Tipi" value={ac2.label} onChange={v=>A2('label',v)} placeholder="N2XH" />
                <Field label="Uzunluk L2" value={ac2.L}     onChange={v=>A2('L',v)}     unit="m" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Baz Ikat (A)"   value={ac2.Ikat} onChange={v=>A2('Ikat',v)} unit="A" />
                <Field label="Sıcaklık Fkt." value={ac2.kSic} onChange={v=>A2('kSic',v)} unit="" step="0.01" />
                <Field label="Döşeme Fkt."   value={ac2.kDos} onChange={v=>A2('kDos',v)} unit="" step="0.01" />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs font-mono text-green-800">
                Itk = {ac2.Ikat} × {ac2.kSic} × {ac2.kDos} = {(ac2.Ikat * ac2.kSic * ac2.kDos).toFixed(2)} A
              </div>
            </div>
          </div>
        </div>

        {/* ── SAĞ: SONUÇLAR ── */}
        <div className="xl:col-span-3 space-y-4">
          {!res ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center min-h-[400px]">
              <div className="text-center text-slate-400 p-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
                  <rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>
                  <line x1="12" y1="12" x2="12" y2="17"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <p className="font-bold text-sm">Verileri girin ve Hesapla'ya basın</p>
                <p className="text-xs mt-1">DC kablo · AC kablo · Güç uyumu · Sigorta</p>
              </div>
            </div>
          ) : (<>

            {/* ── 1. PANEL–İNVERTER GÜÇ UYUMU ── */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-orange-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Panel – İnverter Güç Uyumu</h3>
              </div>
              {/* Dizi grupları */}
              <div className="space-y-2 mb-4">
                {[...new Set(strings.map(s => s.nSeri))].sort((a,b)=>a-b).map(n => {
                  const cnt = strings.filter(s => s.nSeri === n).length;
                  const pwr = (panel.Wp * n / 1000).toFixed(3);
                  return (
                    <div key={n} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2 text-sm">
                      <span className="font-mono text-slate-600">n={n} panel: {panel.Wp} W × {n} =</span>
                      <span className="font-black text-amber-700">{pwr} kW / dizi</span>
                      <span className="text-slate-400 text-xs">× {cnt} dizi = {(parseFloat(pwr)*cnt).toFixed(2)} kW</span>
                    </div>
                  );
                })}
              </div>
              <CheckCard
                label={`Toplam DC Güç ≤ İnverter Maks. Panel Giriş Gücü`}
                calc={res.totalDcKW}
                op="≤"
                limit={sistem.Pmax_inv}
                unit="kW"
                pass={res.gucOk}
                sub={`Tüm diziler toplamı: ${res.totalDcKW.toFixed(2)} kW`}
              />
            </div>

            {/* ── 2. DC KABLO ÖZET ── */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-500"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">DC Dizi Kablo Hesapları</h3>
                <span className="ml-auto text-[10px] font-mono text-slate-400">{dc.Sdc} mm² solar kablo  |  K={K_DC} m/Ω·mm²</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-amber-50 text-amber-800">
                      {['Dizi','n Seri','Udizi (V)','P Dizi (W)','L (m)','Pkayıp (W)','%e','Uyum'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {res.dcRows.map((r, i) => (
                      <tr key={i} className={i%2===0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-3 py-2 font-bold text-amber-700">{r.code}</td>
                        <td className="px-3 py-2 font-mono font-bold">{r.nSeri}</td>
                        <td className="px-3 py-2 font-mono">{r.Udizi.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono">{r.Pdizi}</td>
                        <td className="px-3 py-2 font-mono">{r.L}</td>
                        <td className="px-3 py-2 font-mono text-orange-600 font-bold">{r.Pk.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono">{r.epct.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          {r.epct <= 1.5
                            ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">✓</span>
                            : <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold">⚠</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-mono">
                Pkayıp = 2 × L × Impp² / (S × K)  |  %e = 200 × L × Impp / (S × K × Udizi)
              </p>
            </div>

            {/* ── 3. DC AKIM TAŞIMA ── */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-500"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">DC Akım Taşıma Kontrolü</h3>
                <span className="ml-auto text-[10px] font-mono text-slate-400">IEC 60364-7-712</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg px-3 py-3 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Imax = 1.25 × Isc</div>
                  <div className="font-black font-mono text-slate-700 text-lg">{res.Imax_dc.toFixed(2)} A</div>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-3 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Itk (düzeltilmiş)</div>
                  <div className="font-black font-mono text-slate-700 text-lg">{res.Itk_dc.toFixed(2)} A</div>
                </div>
                <div className={`rounded-lg px-3 py-3 text-center ${res.dcAkimOk ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Sonuç</div>
                  <Badge ok={res.dcAkimOk}/>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {res.Itk_dc.toFixed(2)} A {res.dcAkimOk ? '>' : '<'} {res.Imax_dc.toFixed(2)} A
              </p>
            </div>

            {/* ── 4. AC KABLO ÖZET ── */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">AC Kablo Hesapları</h3>
                <span className="ml-auto text-[10px] font-mono text-slate-400">In = {res.In.toFixed(2)} A</span>
              </div>
              <div className="space-y-3">
                <CheckCard
                  label={`ADP → GES Panosu  |  4 × ${ac1.S} mm² ${ac1.label} ${ac1.material}  |  L = ${ac1.L} m`}
                  calc={res.Itk1}
                  op=">"
                  limit={parseFloat(res.In.toFixed(2))}
                  unit="A"
                  pass={res.ac1Ok}
                  sub={`Pkayıp = ${res.Pk1.toFixed(2)} W  |  %e = ${res.e1.toFixed(3)}%  |  Itk = ${ac1.Ikat} × ${ac1.kSic} × ${ac1.kDos}`}
                />
                <CheckCard
                  label={`GES Panosu → İnverter  |  4 × ${ac2.S} mm² ${ac2.label} ${ac2.material}  |  L = ${ac2.L} m`}
                  calc={res.Itk2}
                  op=">"
                  limit={parseFloat(res.In.toFixed(2))}
                  unit="A"
                  pass={res.ac2Ok}
                  sub={`Pkayıp = ${res.Pk2.toFixed(2)} W  |  %e = ${res.e2.toFixed(3)}%  |  Itk = ${ac2.Ikat} × ${ac2.kSic} × ${ac2.kDos}`}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-mono">
                Pkayıp = 3 × L × In² / (S × K)  |  In = Pac / (Un × √3 × cosφ)
              </p>
            </div>

            {/* ── 5. SİGORTA ── */}
            <div className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-violet-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Sigorta Seçimi</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl px-4 py-4 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Hesaplanan Akım</div>
                  <div className="font-black font-mono text-slate-700 text-2xl">{res.In.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">A</div>
                </div>
                <div className="bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-4 text-center">
                  <div className="text-[10px] text-violet-500 uppercase font-bold mb-1">İnverter Çıkışı</div>
                  <div className="font-black font-mono text-violet-700 text-2xl">3 × {res.sigortaVal}</div>
                  <div className="text-xs text-violet-500 mt-0.5">A — Şalter</div>
                </div>
                <div className="bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-4 text-center">
                  <div className="text-[10px] text-violet-500 uppercase font-bold mb-1">GES Panosu Çıkışı</div>
                  <div className="font-black font-mono text-violet-700 text-2xl">3 × {res.sigortaVal}</div>
                  <div className="text-xs text-violet-500 mt-0.5">A — Sigorta</div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-mono">
                I = Pac / (Un × √3 × cosφ) = {(sistem.Pac * 1000).toFixed(0)} / ({sistem.Un} × 1.732 × {sistem.cosf}) = {res.In.toFixed(2)} A
              </p>
            </div>

          </>)}
        </div>
      </div>

      {/* PV UYUMLULUK SONUÇLARI */}
      {res?.pvUyumluluk?.length > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-purple-500"/>
            <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Panel — Evirici Uyumluluk</h3>
            <span className="ml-auto text-[10px] text-slate-400">Voc & Vmp sıcaklık düzeltmeli kontrol</span>
          </div>
          {res.pvUyumluluk.map((grp, gi) => (
            <div key={gi} className="mb-4">
              <div className="text-xs font-bold text-purple-600 mb-2">
                {grp.nSeri} seri × {grp.nPar} paralel dizi
              </div>
              <div className="grid grid-cols-1 gap-2">
                {grp.checks.map((c, ci) => (
                  <div key={ci} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${c.pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-300'}`}>
                    <div>
                      <span className="text-xs font-bold text-slate-700">{c.label}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{c.tip}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className={`font-mono font-black text-sm ${c.pass ? 'text-green-700' : 'text-red-600'}`}>
                        {c.val.toFixed(2)} {c.unit}
                      </span>
                      <span className="text-slate-400 font-mono">{c.op}</span>
                      <span className="font-mono text-sm text-slate-600">{c.lim} {c.unit}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${c.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.pass ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
