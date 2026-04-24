import { exportPvCompatibility, exportToPDF, buildPvPDF } from '../utils/export.js';
import NumInput from '../components/NumInput.jsx';
import { useState } from 'react';

// ─── Hesap Motoru ──────────────────────────────────────────────────────────────
function calcPvCompatibility({ panel, inverter }) {
  const { tmax, tmin, tnom, kVoc, kVmp, seriesCount, parallelCount, Voc, Vmp, Isc, Imp } = panel;
  const { Vdc_max, Vdc_min, Vmppt_max, Vmppt_min, Isc_max, Imppt_max } = inverter;

  // 1. Durum: Soğukta Voc — evirici max DC gerilimini aşmamalı
  const Voc_cold = seriesCount * Voc * (1 + (kVoc / 100) * (tnom - tmin));

  // 2. Durum: Sıcakta Voc — evirici min DC geriliminin altına düşmemeli
  const Voc_hot = seriesCount * Voc * (1 + (kVoc / 100) * (tnom - tmax));

  // 3. Durum: Soğukta Vmp — MPPT max gerilimini aşmamalı
  const Vmp_cold = seriesCount * Vmp * (1 + (kVmp / 100) * (tnom - tmin));

  // 4. Durum: Sıcakta Vmp — MPPT min geriliminin altına düşmemeli
  const Vmp_hot = seriesCount * Vmp * (1 + (kVmp / 100) * (tnom - tmax));

  // 5. Durum: Toplam kısa devre akımı — MPPT kısa devre giriş akımını geçmemeli
  const Isc_total = Isc * parallelCount;

  // 6. Durum: Toplam maksimum akım — MPPT maks giriş akımını geçmemeli
  const Imp_total = Imp * parallelCount;

  return [
    {
      label: '1. Durum',
      desc: `Soğukta Açık Devre Gerilimi (Voc @ ${tmin}°C)`,
      formula: `${seriesCount} × ${Voc} × (1 + ${kVoc}/100 × (${tnom} − ${tmin}))`,
      calc: Voc_cold,
      op: '<',
      limit: Vdc_max,
      limitLabel: 'Inv. Maks. DC Giriş Gerilimi',
      pass: Voc_cold < Vdc_max,
      unit: 'V',
      color: 'blue',
    },
    {
      label: '2. Durum',
      desc: `Sıcakta Açık Devre Gerilimi (Voc @ ${tmax}°C)`,
      formula: `${seriesCount} × ${Voc} × (1 + ${kVoc}/100 × (${tnom} − ${tmax}))`,
      calc: Voc_hot,
      op: '>',
      limit: Vdc_min,
      limitLabel: 'Inv. Min. DC Giriş Gerilimi',
      pass: Voc_hot > Vdc_min,
      unit: 'V',
      color: 'indigo',
    },
    {
      label: '3. Durum',
      desc: `Soğukta MPPT Gerilimi (Vmp @ ${tmin}°C)`,
      formula: `${seriesCount} × ${Vmp} × (1 + ${kVmp}/100 × (${tnom} − ${tmin}))`,
      calc: Vmp_cold,
      op: '<',
      limit: Vmppt_max,
      limitLabel: 'Inv. Maks. MPPT Giriş Gerilimi',
      pass: Vmp_cold < Vmppt_max,
      unit: 'V',
      color: 'violet',
    },
    {
      label: '4. Durum',
      desc: `Sıcakta MPPT Gerilimi (Vmp @ ${tmax}°C)`,
      formula: `${seriesCount} × ${Vmp} × (1 + ${kVmp}/100 × (${tnom} − ${tmax}))`,
      calc: Vmp_hot,
      op: '>',
      limit: Vmppt_min,
      limitLabel: 'Inv. Min. MPPT Giriş Gerilimi',
      pass: Vmp_hot > Vmppt_min,
      unit: 'V',
      color: 'purple',
    },
    {
      label: '5. Durum',
      desc: `Toplam Kısa Devre Akımı (Isc × ${parallelCount} dizi)`,
      formula: `${Isc} × ${parallelCount}`,
      calc: Isc_total,
      op: '<',
      limit: Isc_max,
      limitLabel: 'MPPT Kısa Devre Giriş Akımı',
      pass: Isc_total < Isc_max,
      unit: 'A',
      color: 'orange',
    },
    {
      label: '6. Durum',
      desc: `Toplam Maksimum Akım (Imp × ${parallelCount} dizi)`,
      formula: `${Imp} × ${parallelCount}`,
      calc: Imp_total,
      op: '<',
      limit: Imppt_max,
      limitLabel: 'MPPT Maks. Giriş Akımı',
      pass: Imp_total < Imppt_max,
      unit: 'A',
      color: 'amber',
    },
  ];
}

// ─── Input Grubu ───────────────────────────────────────────────────────────────
function Field({ label, value, onChange, unit, step, min }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
      <NumInput value={value} onChange={onChange} unit={unit} step={step} min={min}/>
    </div>
  );
}

// ─── Sonuç Kartı ───────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue:   { bar: 'bg-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700'   },
  indigo: { bar: 'bg-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  violet: { bar: 'bg-violet-500', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  purple: { bar: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  orange: { bar: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  amber:  { bar: 'bg-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700'  },
};

function ResultCard({ result }) {
  const c = COLOR_MAP[result.color];
  const pct = Math.min(100, (result.calc / result.limit) * 100);
  const barPct = result.op === '<' ? pct : (100 - pct);

  return (
    <div className={`rounded-xl border-2 p-4 ${result.pass ? `${c.bg} ${c.border}` : 'bg-red-50 border-red-300'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-black text-sm ${result.pass ? c.text : 'text-red-700'}`}>{result.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${result.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {result.pass ? '✓ UYGUN' : '✗ UYGUN DEĞİL'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{result.desc}</p>
        </div>
      </div>

      {/* Karşılaştırma */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex-1 text-center rounded-lg px-3 py-2 ${result.pass ? c.bg : 'bg-red-50'} border ${result.pass ? c.border : 'border-red-200'}`}>
          <div className="text-xs text-slate-400 mb-0.5">Hesaplanan</div>
          <div className={`text-xl font-black font-mono ${result.pass ? c.text : 'text-red-600'}`}>
            {result.calc.toFixed(2)} {result.unit}
          </div>
        </div>
        <div className={`text-2xl font-black ${result.pass ? 'text-green-500' : 'text-red-500'}`}>{result.op}</div>
        <div className="flex-1 text-center rounded-lg px-3 py-2 bg-white border border-slate-200">
          <div className="text-xs text-slate-400 mb-0.5">{result.limitLabel}</div>
          <div className="text-xl font-black font-mono text-slate-700">
            {result.limit} {result.unit}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-100">
        <div
          className={`h-full rounded-full transition-all ${result.pass ? c.bar : 'bg-red-400'}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>%{pct.toFixed(1)} kullanım</span>
        <span className="font-mono text-[10px]">{result.formula}</span>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function PvCompatibility() {
  const [panel, setPanel] = useState({
    tmax: 70, tmin: -20.5, tnom: 25,
    kVoc: 0.25, kVmp: 0.29,
    seriesCount: 14, parallelCount: 2,
    Voc: 48.33, Vmp: 40.97,
    Isc: 16.04, Imp: 15.14,
  });

  const [inverter, setInverter] = useState({
    Vdc_max: 1100, Vdc_min: 160,
    Vmppt_max: 1000, Vmppt_min: 160,
    mpptCount: 2, Isc_max: 54, Imppt_max: 36,
  });

  const [results, setResults] = useState(null);

  const setP = (key, val) => setPanel(p => ({ ...p, [key]: val }));
  const setI = (key, val) => setInverter(i => ({ ...i, [key]: val }));

  const handleCalc = () => setResults(calcPvCompatibility({ panel, inverter }));

  const allPass = results?.every(r => r.pass);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6 rounded-xl shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Panel — Evirici Uyumluluk</h2>
            <p className="text-yellow-100 text-sm">PV Dizi Gerilim ve Akım Kontrolü</p>
          </div>
        </div>
        <button onClick={handleCalc}
          className="bg-white text-orange-600 font-black py-2.5 px-8 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm">
          HESAPLA
        </button>
        {results && (<>
          <button onClick={() => exportPvCompatibility(panel, inverter, results)} className="bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-sm hover:bg-emerald-600">📊 Excel</button>
          <button onClick={() => exportToPDF('Panel-Evirici Uyumluluk', buildPvPDF(panel, inverter, results))} className="bg-white/20 text-white font-bold py-2 px-4 rounded-xl text-sm hover:bg-white/30">📄 PDF</button>
        </>)}
      </div>

      {/* Genel Sonuç Banner */}
      {results && (
        <div className={`rounded-xl p-4 flex items-center gap-4 border-2 ${allPass ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <div className={`text-3xl font-black ${allPass ? 'text-green-600' : 'text-red-600'}`}>
            {allPass ? '✓' : '✗'}
          </div>
          <div>
            <div className={`font-black text-lg ${allPass ? 'text-green-700' : 'text-red-700'}`}>
              {allPass ? 'Tüm Kontroller Uygun — Panel ve Evirici Uyumlu!' : 'Uyumsuzluk Tespit Edildi!'}
            </div>
            <div className="text-sm text-slate-500">
              {results.filter(r => r.pass).length}/{results.length} kontrol geçti
              {!allPass && ' — Kırmızı kartları inceleyiniz'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Parametreler Sol */}
        <div className="xl:col-span-2 space-y-4">
          {/* Panel Bilgileri */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Panel Bilgileri</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voc (Açık Devre V)" value={panel.Voc} onChange={v => setP('Voc', v)} unit="V" />
              <Field label="Vmp (Max Güç V)" value={panel.Vmp} onChange={v => setP('Vmp', v)} unit="V" />
              <Field label="Isc (Kısa Devre A)" value={panel.Isc} onChange={v => setP('Isc', v)} unit="A" />
              <Field label="Imp (Max Güç A)" value={panel.Imp} onChange={v => setP('Imp', v)} unit="A" />
              <Field label="k_Voc (Sıcaklık Kat.)" value={panel.kVoc} onChange={v => setP('kVoc', v)} unit="%/°C" step="0.001" />
              <Field label="k_Vmp (Sıcaklık Kat.)" value={panel.kVmp} onChange={v => setP('kVmp', v)} unit="%/°C" step="0.001" />
            </div>
          </div>

          {/* Sıcaklık ve Dizi */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-orange-400"></div>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Sıcaklık & Dizi</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="T maksimum" value={panel.tmax} onChange={v => setP('tmax', v)} unit="°C" step="1" />
              <Field label="T minimum" value={panel.tmin} onChange={v => setP('tmin', v)} unit="°C" step="1" />
              <Field label="T standart (STC)" value={panel.tnom} onChange={v => setP('tnom', v)} unit="°C" step="1" />
              <div /> {/* boşluk */}
              <Field label="Seri Panel Sayısı (a)" value={panel.seriesCount} onChange={v => setP('seriesCount', v)} unit="adet" step="1" min="1" />
              <Field label="Paralel Dizi Sayısı" value={panel.parallelCount} onChange={v => setP('parallelCount', v)} unit="adet" step="1" min="1" />
            </div>
          </div>

          {/* Evirici Bilgileri */}
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">Evirici (İnvertör) Bilgileri</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Maks. DC Giriş Gerilimi" value={inverter.Vdc_max} onChange={v => setI('Vdc_max', v)} unit="V" step="1" />
              <Field label="Min. DC Giriş Gerilimi" value={inverter.Vdc_min} onChange={v => setI('Vdc_min', v)} unit="V" step="1" />
              <Field label="Maks. MPPT Gerilimi" value={inverter.Vmppt_max} onChange={v => setI('Vmppt_max', v)} unit="V" step="1" />
              <Field label="Min. MPPT Gerilimi" value={inverter.Vmppt_min} onChange={v => setI('Vmppt_min', v)} unit="V" step="1" />
              <Field label="MPPT K.D. Giriş Akımı" value={inverter.Isc_max} onChange={v => setI('Isc_max', v)} unit="A" step="1" />
              <Field label="MPPT Maks. Giriş Akımı" value={inverter.Imppt_max} onChange={v => setI('Imppt_max', v)} unit="A" step="1" />
            </div>
          </div>
        </div>

        {/* Sonuçlar Sağ */}
        <div className="xl:col-span-3 space-y-3">
          {results ? (
            results.map((r, i) => <ResultCard key={i} result={r} />)
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center text-slate-400 p-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                </svg>
                <p className="font-bold text-sm">Panel ve evirici bilgilerini girin</p>
                <p className="text-xs mt-1">Hesapla butonuna basarak 6 uyumluluk kontrolü yapın</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
