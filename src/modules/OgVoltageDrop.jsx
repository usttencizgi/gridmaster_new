import NumInput from '../components/NumInput.jsx';
import { useState } from 'react';
import { Zap, X, FileText } from '../components/Icons.jsx';
import { calcOgVoltageDrop } from '../calculators/index.js';
import { exportOgVoltageDrop, exportToPDF, buildOgVoltageDropPDF } from '../utils/export.js';
import { parseUedasPdf } from '../utils/uedas-parser.js';

export default function OgVoltageDrop({ cables }) {
  const [nodes, setNodes] = useState([{ id: 1, name: 'Ana Hat', length: 5.45, loadKVA: 5400, cableTypeId: '3x1x240cu', circuitCount: 1 }]);
  const [results, setResults] = useState([]);
  const [metrics, setMetrics] = useState({ maxDrop: 0, totalPowerLoss: 0, percentPowerLoss: 0 });
  const [showDiagram, setShowDiagram] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfInfo, setPdfInfo] = useState(null);

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfParsing(true);
    try {
      const { segments, sourceName } = await parseUedasPdf(file);
      if (segments.length === 0) throw new Error('Segment bulunamadı');
      setNodes(segments.map(s => ({
        id: s.id,
        name: s.name,
        cableTypeId: s.cableTypeId,
        length: parseFloat(s.length.toFixed(4)),
        circuitCount: s.circuitCount,
        loadKVA: 0, // Kullanıcı girecek
      })));
      setPdfInfo({ sourceName: sourceName || file.name, count: segments.length });
    } catch (err) {
      alert('PDF okunamadı: ' + err.message);
    } finally {
      setPdfParsing(false);
      e.target.value = '';
    }
  };

  const handleCalculate = () => {
    const { results: res, totalLossKW } = calcOgVoltageDrop(nodes, cables);
    setResults(res);
    const totalLoad = nodes.reduce((s, n) => s + Number(n.loadKVA), 0);
    setMetrics({
      maxDrop: res.length ? res[res.length - 1].totalDropPercent : 0,
      totalPowerLoss: totalLossKW,
      percentPowerLoss: totalLoad ? (totalLossKW / totalLoad) * 100 : 0,
    });
  };

  const updateNode = (i, f, v) => { const n = [...nodes]; n[i][f] = v; setNodes(n); };
  const handleExcelExport = () => exportOgVoltageDrop(nodes, results, cables, metrics);
  const handlePdfExport = () => exportToPDF('OG Gerilim Düşümü', buildOgVoltageDropPDF(nodes, results, cables, metrics));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Zap size={32} /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">OG Gerilim Düşümü</h2>
            <p className="text-sm text-slate-500">34.5 kV Radyal Hat Analizi</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleCalculate} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg shadow hover:bg-blue-700">HESAPLA</button>
          <button onClick={() => setShowDiagram(true)} className="bg-white border hover:bg-slate-50 text-slate-700 font-bold py-2 px-6 rounded-lg shadow-sm">ŞEMA</button>
          {results.length > 0 && (<>
            <button onClick={handleExcelExport} className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 text-sm">📊 Excel</button>
            <button onClick={handlePdfExport} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 text-sm">📄 PDF</button>
          </>)}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Hat Girişleri */}
        <div className="xl:col-span-8 space-y-4">
          {/* PDF Yükle banner */}
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${pdfParsing ? 'border-blue-200 text-blue-400 animate-pulse' : 'border-blue-300 text-blue-600 hover:bg-blue-50 bg-white'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              {pdfParsing ? 'PDF Okunuyor...' : 'UEDAŞ Tek Hat PDF Yükle'}
              <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={pdfParsing}/>
            </label>
            {pdfInfo && (
              <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700">✓ {pdfInfo.count} segment yüklendi — yük değerlerini (kVA) girin</span>
                <button onClick={() => setPdfInfo(null)} className="text-blue-300 hover:text-blue-500 ml-2">✕</button>
              </div>
            )}
          </div>
          {nodes.map((n, i) => (
            <div key={n.id} className="bg-white p-4 rounded-xl shadow-sm border grid grid-cols-12 gap-3 items-end">
              <div className="col-span-3">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">HAT ADI</label>
                <input type="text" value={n.name} onChange={e => updateNode(i, 'name', e.target.value)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">KABLO</label>
                <select value={n.cableTypeId} onChange={e => updateNode(i, 'cableTypeId', e.target.value)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm">
                  {cables.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">MESAFE (km)</label>
                <NumInput value={n.length} onChange={v => updateNode(i, 'length', v)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm"/>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">YÜK (kVA)</label>
                <NumInput value={n.loadKVA} onChange={v => updateNode(i, 'loadKVA', v)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm"/>
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">DEVRE</label>
                <NumInput value={n.circuitCount || 1} onChange={v => updateNode(i, 'circuitCount', v)} min="1" className="w-full bg-slate-50 border rounded px-2 py-1 text-sm"/>
              </div>
              <button onClick={() => { const d = [...nodes]; d.splice(i, 1); setNodes(d); }} className="col-span-1 text-red-400 hover:text-red-600"><X size={20} /></button>
            </div>
          ))}
          <button onClick={() => setNodes([...nodes, { id: Date.now(), name: 'Yeni Hat', length: 0, loadKVA: 0, cableTypeId: '3x1x95cu', circuitCount: 1 }])}
            className="w-full py-3 border-2 border-dashed rounded-xl text-slate-500 font-bold hover:border-blue-400 hover:text-blue-500 transition-colors">
            + YENİ HAT EKLE
          </button>
        </div>

        {/* Metrikler */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
            <div className="text-xs uppercase font-bold text-slate-400 mb-1">Max Gerilim Düşümü</div>
            <div className={`text-4xl font-mono font-bold ${metrics.maxDrop > 7 ? 'text-red-600' : 'text-slate-800'}`}>
              %{metrics.maxDrop.toFixed(3)}
            </div>
            <div className={`text-xs mt-1 font-bold ${metrics.maxDrop > 7 ? 'text-red-500' : 'text-green-500'}`}>
              {metrics.maxDrop > 7 ? '⚠ Limit Aşıldı (>%7)' : '✓ Limit İçinde (≤%7)'}
            </div>
            <div className="border-t mt-4 pt-4">
              <div className="text-xs uppercase font-bold text-slate-400 mb-1">Toplam Güç Kaybı</div>
              <div className="text-xl font-mono font-bold text-blue-600">
                {metrics.totalPowerLoss.toFixed(1)} kW
                <span className="text-xs text-slate-400 ml-1">(%{metrics.percentPowerLoss.toFixed(2)})</span>
              </div>
            </div>
          </div>

          {results.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="px-3 py-2 text-left">Hat</th>
                    <th className="px-3 py-2 text-right">Düşüm %</th>
                    <th className="px-3 py-2 text-right">Akım (A)</th>
                    <th className="px-3 py-2 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-bold text-xs">{nodes[i]?.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.totalDropPercent.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.segmentCurrent.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center text-xs">
                        {r.isSafeDrop && r.isSafeCurrent ? '✅' : '❌'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Şema Modal */}
      {showDiagram && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowDiagram(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center rounded-t-xl print:hidden">
              <h3 className="font-bold flex items-center gap-2"><FileText size={20} /> Tek Hat Şeması</h3>
              <button onClick={() => setShowDiagram(false)} className="hover:bg-slate-700 p-1 rounded"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-auto p-8">
              <h1 className="text-2xl font-bold mb-4 text-center">OG Gerilim Düşümü Raporu</h1>
              <svg width="600" height={nodes.length * 150 + 300} className="w-full h-auto">
                <line x1="300" y1="50" x2="300" y2={nodes.length * 150 + 50} stroke="#334155" strokeWidth="4" />
                <g transform="translate(300, 50)">
                  <circle cx="0" cy="0" r="20" fill="white" stroke="#334155" strokeWidth="3" />
                  <text x="30" y="5" fontSize="14" fontWeight="bold">TRAFO MERKEZİ (34.5 kV)</text>
                </g>
                {results.map((res, i) => (
                  <g key={i} transform={`translate(300, ${(i + 1) * 150 + 50})`}>
                    <line x1="-40" y1="0" x2="40" y2="0" stroke="#334155" strokeWidth="4" />
                    <circle cx="0" cy="0" r="5" fill="#334155" />
                    <text x="50" y="5" fontSize="12" fontWeight="bold">{nodes[i]?.name} ({nodes[i]?.length} km)</text>
                    <text x="50" y="22" fontSize="12" fill="#2563eb">Kümülatif: %{res.totalDropPercent.toFixed(3)}</text>
                    <text x="50" y="38" fontSize="11" fill="#64748b">{cables.find(c => c.id === nodes[i]?.cableTypeId)?.name} — {res.segmentCurrent.toFixed(1)} A</text>
                  </g>
                ))}
                <g transform={`translate(0, ${nodes.length * 150 + 180})`}>
                  <rect x="0" y="0" width="600" height="80" fill="#f1f5f9" stroke="#94a3b8" rx="4" />
                  <text x="10" y="20" fontFamily="monospace" fontSize="12" fill="#334155" fontWeight="bold">HESAP FORMÜLLERİ:</text>
                  <text x="10" y="40" fontFamily="monospace" fontSize="11" fill="#475569">Gerilim Düşümü (%e) = (k × P × L × 10⁻⁴) / n</text>
                  <text x="10" y="60" fontFamily="monospace" fontSize="11" fill="#475569">Güç Kaybı (ΔP) = (c × P² × L × 10⁻⁶) / n</text>
                </g>
              </svg>
            </div>
            <div className="p-4 border-t flex justify-end gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors">
                🖨️ Yazdır
              </button>
              <button
                onClick={() => setShowDiagram(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-5 rounded-lg text-sm transition-colors">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
