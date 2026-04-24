import { useState, useMemo } from 'react';
import { Battery } from '../components/Icons.jsx';
import { exportTransformer, exportToPDF, buildTransformerPDF } from '../utils/export.js';
import { LV_TRANSFORMERS } from '../data/transformers.js';

// CT primer değerini parse et: "50/5 A" → 50
function parseCTPrimary(ctStr) {
  if (!ctStr) return null;
  const match = ctStr.match(/^(\d+(\.\d+)?)\//);
  return match ? parseFloat(match[1]) : null;
}

export default function Transformer() {
  const [selectedKva, setSelectedKva] = useState(630);

  const selectedTrafo = useMemo(() => LV_TRANSFORMERS.find(t => t.kva === selectedKva), [selectedKva]);
  const nomCurrent = selectedTrafo ? selectedTrafo.kva / (1.732 * 0.4) : 0;
  const ikKA = selectedTrafo ? (nomCurrent / (selectedTrafo.uk / 100)) / 1000 : 0;
  const handleExcelExport = () => selectedTrafo && exportTransformer(selectedTrafo, nomCurrent, ikKA);
  const handlePdfExport = () => selectedTrafo && exportToPDF('Trafo Seçim', buildTransformerPDF(selectedTrafo, nomCurrent, ikKA));

  const nominalCurrent = selectedTrafo ? selectedTrafo.kva / (1.732 * 0.4) : 0;
  const shortCircuitCurrentKA = selectedTrafo ? (nominalCurrent / (selectedTrafo.uk / 100)) / 1000 : 0;

  // CT hesapları
  const lvCtPrimary = selectedTrafo ? parseCTPrimary(selectedTrafo.lvCt) : null;
  const hvCtPrimary = selectedTrafo?.hvCt ? parseCTPrimary(selectedTrafo.hvCt) : null;

  const lvCtInMin = lvCtPrimary ? (16000 / lvCtPrimary).toFixed(0) : null;
  const hvCtInMin = hvCtPrimary ? (16000 / hvCtPrimary).toFixed(0) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg"><Battery size={32} /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Trafo Hesapları</h2>
            <p className="text-sm text-slate-500">34.5/0.4 kV AG Kablo, CB ve Akım Trafosu Seçim Tablosu</p>
          </div>
        </div>
        {selectedTrafo && (
          <div className="flex gap-2">
            <button onClick={handleExcelExport} className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 text-sm">📊 Excel</button>
            <button onClick={handlePdfExport} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 text-sm">📄 PDF</button>
          </div>
        )}
      </div>

      {/* Trafo Seçimi */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="font-bold mb-4 text-slate-700 text-sm uppercase tracking-wide">Trafo Gücü Seçin</h3>
        <div className="flex flex-wrap gap-2">
          {LV_TRANSFORMERS.map(t => (
            <button key={t.kva} onClick={() => setSelectedKva(t.kva)}
              className={`px-4 py-2 rounded-lg font-bold text-sm border transition-all ${selectedKva === t.kva ? 'bg-orange-500 text-white border-orange-500 shadow' : 'hover:bg-orange-50 border-slate-200 text-slate-700'}`}
            >
              {t.kva} kVA
            </button>
          ))}
        </div>
      </div>

      {selectedTrafo && (
        <>
          {/* Temel Değerler */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border text-center">
              <div className="text-xs uppercase font-bold text-slate-400 mb-1">Nominal Akım (In)</div>
              <div className="text-3xl font-bold font-mono text-slate-700">{nominalCurrent.toFixed(1)} A</div>
              <div className="text-xs text-slate-400 mt-1">S / (√3 × 0.4 kV)</div>
            </div>
            <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-red-100 text-center">
              <div className="text-xs uppercase font-bold text-red-400 mb-1">AG Bara Kısa Devresi</div>
              <div className="text-3xl font-bold font-mono text-red-600">{shortCircuitCurrentKA.toFixed(2)} kA</div>
              <div className="text-xs text-red-400 mt-1">In / (uk% / 100)</div>
            </div>
            <div className="bg-orange-50 p-5 rounded-xl shadow-sm border border-orange-100 text-center">
              <div className="text-xs uppercase font-bold text-orange-400 mb-1">Kısa Devre Empedansı</div>
              <div className="text-3xl font-bold font-mono text-orange-600">%{selectedTrafo.uk}</div>
              <div className="text-xs text-orange-400 mt-1">uk — Trafo Empedansı</div>
            </div>
          </div>

          {/* Seçim Tablosu */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-white flex items-center gap-3">
              <Battery size={20} className="text-orange-500" />
              <h3 className="font-bold text-slate-700">{selectedTrafo.kva} kVA — Komple Seçim Tablosu</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <Row label="OG Sigorta" value={selectedTrafo.hvFuse} />
                  <Row label="AG Ana Şalter (CB)" value={`${selectedTrafo.cb} A`} highlight="blue" />
                  <Row label="Cu Kablo Seçimi" value={selectedTrafo.cuCable} highlight="blue" />
                  <Row label="Al Kablo Seçimi" value={selectedTrafo.alCable} highlight="green" />
                  {selectedTrafo.busbar && <Row label="Bara (Busbar)" value={selectedTrafo.busbar} highlight="orange" />}
                  <Row label="Ölçüm Tipi" value={selectedTrafo.measurement} />

                  {/* AG CT Satırı */}
                  <tr className="bg-amber-50 hover:bg-amber-100 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-600 w-52">AG Akım Trafosu (CT)</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-slate-800">{selectedTrafo.lvCt}</span>
                        {lvCtInMin && (
                          <div className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-1 text-xs">
                            <span className="text-amber-600 font-bold">CT In Minimum: </span>
                            <span className="font-mono font-black text-amber-800">{lvCtInMin}</span>
                            <span className="text-amber-600 font-bold ml-1">
                              (16000 / {lvCtPrimary})
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* OG CT Satırı */}
                  {selectedTrafo.hvCt && (
                    <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-600">OG Akım Trafosu (CT)</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-bold text-slate-800">{selectedTrafo.hvCt}</span>
                          {hvCtInMin && (
                            <div className="bg-purple-100 border border-purple-300 rounded-lg px-3 py-1 text-xs">
                              <span className="text-purple-600 font-bold">CT In Minimum: </span>
                              <span className="font-mono font-black text-purple-800">{hvCtInMin}</span>
                              <span className="text-purple-600 font-bold ml-1">
                                (16000 / {hvCtPrimary})
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CT Açıklama Kartı */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <div className="text-amber-500 text-lg flex-shrink-0">ℹ</div>
            <div className="text-sm text-amber-800">
              <span className="font-bold">CT In Minimum Değeri Nedir? </span>
              Akım trafosunun primer sargısına göre belirlenen minimum In değeridir.
              Formül: <span className="font-mono font-bold">16000 / CT_Primer</span>.
              Örnek: 50/5 A CT için minimum In = 16000 / 50 = <span className="font-bold">320</span>.
              Bu değer, sayaç veya röle için akım trafosu seçiminde alt sınırı belirler.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, highlight }) {
  const colors = {
    blue:   'font-bold text-blue-700',
    green:  'font-bold text-green-700',
    orange: 'font-bold text-orange-700',
  };
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 font-bold text-slate-500 w-52">{label}</td>
      <td className={`px-4 py-3 ${highlight ? colors[highlight] : 'font-bold text-slate-800'}`}>{value}</td>
    </tr>
  );
}
