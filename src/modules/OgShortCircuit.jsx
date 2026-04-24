import NumInput from '../components/NumInput.jsx';
import { useState, useMemo } from 'react';
import { Activity, X, Upload, Search, CheckCircle, Database, FileText } from '../components/Icons.jsx';
import { calcOgShortCircuit } from '../calculators/index.js';
import { exportOgShortCircuit, exportOgShortCircuitPDF } from '../utils/export.js';

export default function OgShortCircuit({ cables, teiashData, teiashLoading, onGoTopraklama }) {
  const [selectedScenario, setSelectedScenario] = useState('min');
  const [selectedTrafo, setSelectedTrafo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedData, setUploadedData] = useState(null);
  const [lines, setLines] = useState([{ id: 1, name: 'DM Kök', cableTypeId: '3x1x95cu', length: 0.5, circuitCount: 1 }]);
  const [result, setResult] = useState({ busbarCurrent: 0, lineEndCurrent: 0, zBaraPu: 0, zTotalPu: 0 });
  const [showDiagram, setShowDiagram] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualName, setManualName] = useState('Manuel Kaynak');
  const [manualIk154, setManualIk154] = useState(15467);
  const [manualTrafoPower, setManualTrafoPower] = useState(100);
  const [manualTrafoUk, setManualTrafoUk] = useState(12.5);
  const [exporting, setExporting] = useState(false);
  const [trafoTip, setTrafoTip] = useState('Dyn');

  // Aktif liste: yüklenen CSV > TEİAŞ JSON > boş
  const activeList = useMemo(() => {
    if (uploadedData) return uploadedData;
    return teiashData?.[selectedScenario] || [];
  }, [selectedScenario, uploadedData, teiashData]);

  const filteredList = useMemo(() =>
    activeList.filter(i => i.name?.toLowerCase().includes(searchTerm.toLowerCase())),
    [activeList, searchTerm]
  );

  const handleFileUpload = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawLines = e.target.result.split('\n'); const parsed = [];
      rawLines.forEach(line => {
        const cols = line.split(',');
        if (cols.length > 5 && !isNaN(parseFloat(cols[4])))
          parsed.push({ name: cols[1]?.trim(), current: parseFloat(cols[4]) });
      });
      setUploadedData(parsed); setSelectedTrafo(null);
    };
    reader.readAsText(file);
  };

  const calculateShortCircuit = () => {
    let sourceParams = {};
    if (isManualMode) {
      const sk154_MVA = 1.732 * 154 * manualIk154 / 1000;
      sourceParams = { type: 'power', sk154: sk154_MVA, trafoPower: manualTrafoPower, trafoUk: manualTrafoUk, trafoTip };
    } else {
      if (!selectedTrafo) return;
      sourceParams = { type: 'current', current: selectedTrafo.current, trafoTip };
    }
    setResult(calcOgShortCircuit(sourceParams, lines, cables));
  };

  const handleExcelExport = async () => {
    setExporting(true);
    const name = isManualMode ? manualName : (selectedTrafo?.name || '—');
    await exportOgShortCircuit(name, lines, result, cables);
    setExporting(false);
  };

  const handlePdfExport = () => {
    const name = isManualMode ? manualName : (selectedTrafo?.name || '—');
    const srcParams = isManualMode
      ? { type: 'power', sk154: result.Sk154_MVA, trafoPower: result.trafoPower, trafoUk: result.trafoUk }
      : { type: 'current', current: selectedTrafo?.current || 0 };
    exportOgShortCircuitPDF(name, srcParams, lines, result, cables);
  };

  const updateLine = (i, field, value) => { const n = [...lines]; n[i][field] = value; setLines(n); };
  const sourceName = isManualMode ? manualName : (selectedTrafo?.name || '—');
  const svgHeight = 200 + lines.length * 130 + 130;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl shadow-sm border flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Activity size={28} /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">OG Kısa Devre</h2>
            <p className="text-sm text-slate-500">34.5 kV — Üç Faz I₃k (IEC 60909)</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={calculateShortCircuit} className="bg-purple-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-700 text-sm">HESAPLA</button>
          <button onClick={() => setShowDiagram(true)} disabled={!result.lineEndCurrent}
            className="bg-white border-2 border-slate-200 font-bold py-2 px-4 rounded-lg disabled:opacity-40 hover:bg-slate-50 text-sm flex items-center gap-1.5">
            <FileText size={15} /> Şema
          </button>
          {result.lineEndCurrent > 0 && (<>
            <button onClick={handleExcelExport} disabled={exporting}
              className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 text-sm flex items-center gap-1.5 disabled:opacity-50">
              📊 {exporting ? '...' : 'Excel'}
            </button>
            <button onClick={handlePdfExport}
              className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 text-sm flex items-center gap-1.5">
              📄 PDF
            </button>
          </>)}
        </div>
      </div>

      {/* Bilgi Bandı */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 text-sm text-purple-800 flex items-center gap-2">
        <span className="text-purple-400 font-bold">ℹ</span>
        <span><strong>Üç-faz hesap (I₃k)</strong> — IEC 60909 pu yöntemi. Çift devre → empedans ÷ n.</span>
        {!teiashLoading && activeList.length > 0 && (
          <span className="ml-auto text-xs bg-purple-100 px-2 py-0.5 rounded-full font-bold">
            {activeList.length} TEİAŞ kaydı yüklü
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Panel */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setIsManualMode(false)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${!isManualMode ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>TEİAŞ Listesi</button>
            <button onClick={() => setIsManualMode(true)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${isManualMode ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Manuel Giriş</button>
          </div>

          {/* Trafo Bağlantı Tipi — her iki modda da göster */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Trafo Bağlantı Tipi (Faz–Toprak I"k1)</div>
            <div className="flex gap-2">
              {[
                { val: 'Dyn', label: 'Dyn', sub: 'Standart TR (delta primer)' },
                { val: 'Yyn', label: 'Yyn', sub: 'Muhafazakâr (yıldız primer)' },
              ].map(opt => (
                <button key={opt.val} onClick={() => setTrafoTip(opt.val)}
                  className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all text-left ${trafoTip === opt.val ? 'bg-purple-50 border-purple-500 text-purple-700' : 'border-slate-200 text-slate-500 hover:border-purple-200'}`}>
                  <div>{opt.label}</div>
                  <div className={`text-[10px] font-normal mt-0.5 ${trafoTip === opt.val ? 'text-purple-500' : 'text-slate-400'}`}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {!isManualMode ? (
            <>
              {/* CSV ek yükleme */}
              <div className="bg-purple-50 border border-dashed border-purple-200 rounded-xl p-3 text-center cursor-pointer relative hover:bg-purple-100 transition-colors">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="flex items-center justify-center gap-2 text-purple-700 text-xs">
                  <Upload size={16} />
                  <span className="font-bold">Farklı CSV yükle</span>
                  {uploadedData && <span className="text-green-600">({uploadedData.length} kayıt)</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {['min', 'summer', 'winter'].map(s => (
                  <button key={s} onClick={() => { setSelectedScenario(s); setUploadedData(null); setSelectedTrafo(null); }}
                    className={`p-2 rounded-lg border text-[11px] font-bold transition-all ${selectedScenario === s && !uploadedData ? 'bg-purple-50 border-purple-500 text-purple-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                    {s === 'min' ? '📉 Min' : s === 'summer' ? '☀️ Yaz' : '❄️ Kış'}
                  </button>
                ))}
              </div>

              {/* Liste */}
              <div className="h-[260px] flex flex-col border rounded-xl overflow-hidden">
                <div className="p-2 border-b relative bg-slate-50">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder={`${filteredList.length} kayıt içinde ara...`}
                    className="w-full pl-7 pr-2 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:border-purple-300"
                    onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar text-xs">
                  {teiashLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <span className="animate-pulse">Yükleniyor...</span>
                    </div>
                  ) : filteredList.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">Kayıt bulunamadı</div>
                  ) : filteredList.map((item, i) => (
                    <button key={i} onClick={() => setSelectedTrafo(item)}
                      className={`w-full text-left px-3 py-2 border-b border-slate-50 hover:bg-slate-50 flex justify-between items-center ${selectedTrafo?.name === item.name && selectedTrafo?.busbar === item.busbar ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700'}`}>
                      <div>
                        <div>{item.name}</div>
                        {item.busbar && <div className="text-[10px] text-slate-400">{item.busbar}</div>}
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="font-mono text-[11px]">{item.current.toFixed(0)} A</div>
                        {item.ik1 && <div className="font-mono text-[10px] text-slate-400">{item.ik1.toFixed(0)}</div>}
                        {selectedTrafo?.name === item.name && <CheckCircle size={12} className="ml-auto mt-0.5 text-purple-600" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTrafo && (
                <div className="bg-purple-50 rounded-xl p-3 text-xs border border-purple-100">
                  <div className="font-bold text-purple-800 truncate">{selectedTrafo.name}</div>
                  <div className="text-slate-500 mt-1">{selectedTrafo.busbar}</div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">I₃k:</span>
                    <span className="font-mono font-bold text-purple-700">{selectedTrafo.current.toFixed(2)} A</span>
                  </div>
                  {selectedTrafo.ik1 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">I₁k:</span>
                      <span className="font-mono text-slate-600">{selectedTrafo.ik1.toFixed(2)} A</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Kaynak Adı</label>
                <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-2.5 font-bold text-sm" />
              </div>              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">154 kV K.D. (A)</label>
                  <NumInput value={manualIk154} onChange={v => setManualIk154(v)} className="w-full border-2 border-slate-200 rounded-xl p-2.5 font-mono font-bold text-sm text-purple-600"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Trafo (MVA)</label>
                  <NumInput value={manualTrafoPower} onChange={v => setManualTrafoPower(v)} className="w-full border-2 border-slate-200 rounded-xl p-2.5 font-mono font-bold text-sm"/>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Trafo Uk (%)</label>
                <NumInput value={manualTrafoUk} onChange={v => setManualTrafoUk(v)} className="w-full border-2 border-slate-200 rounded-xl p-2.5 font-mono font-bold text-sm"/>
              </div>
            </div>
          )}
        </div>

        {/* Sağ Panel */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700 text-sm">Hat Tanımları</h3>
            <span className="text-xs text-slate-400">Çift devre → empedans ÷ n</span>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={l.id} className="bg-slate-50 p-2.5 rounded-xl border space-y-2">
                {/* İsim satırı */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 font-bold w-5 text-center">{i+1}</span>
                  <input
                    type="text"
                    value={l.name || ''}
                    onChange={e => updateLine(i, 'name', e.target.value)}
                    placeholder={`Düğüm ${i+1} adı (örn: DM Kök, Trafo)`}
                    className="flex-1 border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:border-purple-400 outline-none bg-white"
                  />
                  <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1"><X size={16} /></button>
                </div>
                {/* Kablo + uzunluk + devre */}
                <div className="flex gap-2 items-center pl-7">
                  <select className="border rounded-lg p-1.5 flex-1 text-sm bg-white" value={l.cableTypeId} onChange={e => updateLine(i, 'cableTypeId', e.target.value)}>
                    {cables.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="flex items-center gap-1 bg-white border rounded-lg px-2">
                    <NumInput value={l.length} onChange={v => updateLine(i, 'length', v)} className="p-1.5 w-16 text-sm font-mono bg-transparent outline-none"/>
                    <span className="text-xs text-slate-400">km</span>
                  </div>
                  <select className="border rounded-lg p-1.5 text-sm font-bold text-purple-700 bg-white" value={l.circuitCount || 1} onChange={e => updateLine(i, 'circuitCount', Number(e.target.value))}>
                    <option value={1}>1× Devre</option>
                    <option value={2}>2× Paralel</option>
                    <option value={3}>3× Paralel</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setLines([...lines, { id: Date.now(), name: '', cableTypeId: '3x1x95cu', length: 0.5, circuitCount: 1 }])}
            className="text-sm font-bold text-purple-600 hover:text-purple-800 mt-3">+ Hat Ekle</button>

          {result.busbarCurrent > 0 && (
            <div className="mt-4 space-y-3">
              {/* Üç-Faz */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Bara I"k3 — Üç Faz</div>
                  <div className="text-3xl font-bold font-mono text-blue-600">{result.busbarCurrent.toFixed(2)} kA</div>
                  <div className="text-xs text-slate-400 mt-1">ip = {result.ip_bara?.toFixed(2)} kA</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Hat Sonu I"k3 — Üç Faz</div>
                  <div className="text-3xl font-bold font-mono text-purple-600">{result.lineEndCurrent.toFixed(2)} kA</div>
                  <div className="text-xs text-slate-400 mt-1">ip = {result.ip_end?.toFixed(2)} kA</div>
                </div>
              </div>
              {/* Faz–Toprak */}
              {result.Ik1_bara > 0 && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                  <div className="text-center">
                    <div className="text-[10px] text-orange-600 font-bold uppercase mb-1">Bara I"k1 — Faz–Toprak</div>
                    <div className="text-3xl font-bold font-mono text-orange-600">{result.Ik1_bara.toFixed(2)} kA</div>
                    <div className="text-xs text-slate-400 mt-1">ip = {result.ip1_bara?.toFixed(2)} kA</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-orange-600 font-bold uppercase mb-1">Hat Sonu I"k1 — Faz–Toprak</div>
                    <div className="text-3xl font-bold font-mono text-amber-600">{result.Ik1_end.toFixed(2)} kA</div>
                    <div className="text-xs text-slate-400 mt-1">ip = {result.ip1_end?.toFixed(2)} kA</div>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-[10px] font-mono text-slate-400">
                      Z0/Z1 = 3.5 (kablo)  |  Trafo: {result.trafoTip}  |  I"k1 = c×3×Ib / (2×Z1+Z0)
                    </span>
                  </div>
                </div>
              )}
              {/* Topraklama yönlendirme butonu */}
              {result.Ik1_bara > 0 && onGoTopraklama && (
                <button
                  onClick={() => onGoTopraklama(result.Ik1_bara)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/>
                  </svg>
                  Topraklama Hesabını Yap
                  <span className="bg-white/20 px-2 py-0.5 rounded-lg font-mono text-xs">
                    I"k1 = {result.Ik1_bara.toFixed(3)} kA
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ŞEMA MODAL */}
      {showDiagram && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowDiagram(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center rounded-t-2xl flex-shrink-0">
              <h3 className="font-bold flex items-center gap-2"><FileText size={18} /> OG Kısa Devre — Tek Hat Şeması</h3>
              <div className="flex gap-2">
                <button onClick={() => {
                  const svg = document.getElementById('og-schema-svg');
                  if (!svg) return;
                  const serializer = new XMLSerializer();
                  const svgStr = serializer.serializeToString(svg);
                  const canvas = document.createElement('canvas');
                  const scale = 3;
                  canvas.width  = 500 * scale;
                  canvas.height = svgHeight * scale;
                  const ctx = canvas.getContext('2d');
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  const img = new Image();
                  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                  const url  = URL.createObjectURL(blob);
                  img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    const a = document.createElement('a');
                    a.href = canvas.toDataURL('image/png', 1.0);
                    a.download = `OG_KisaDevre_Semasi_${sourceName.replace(/\s/g,'_')}.png`;
                    a.click();
                  };
                  img.src = url;
                }} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-sm font-bold">
                  ⬇ PNG İndir
                </button>
                <button onClick={() => setShowDiagram(false)} className="hover:bg-slate-700 p-1 rounded-lg"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              <svg id="og-schema-svg" width="500" height={svgHeight} viewBox={`0 0 500 ${svgHeight}`} className="w-full bg-white rounded-xl border shadow-sm p-4">
                <line x1="250" y1="55" x2="250" y2={svgHeight-115} stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,4"/>
                <g transform="translate(250,60)">
                  <circle cx="0" cy="0" r="20" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="2.5"/>
                  <text x="0" y="-3" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#7c3aed">154kV</text>
                  <text x="28" y="-5" fontSize="11" fontWeight="bold" fill="#1e293b">{sourceName}</text>
                  <text x="28" y="9" fontSize="9" fill="#64748b">Güç Sistemi</text>
                </g>
                <g transform="translate(250,145)">
                  <rect x="-26" y="-20" width="52" height="40" rx="6" fill="#ede9fe" stroke="#7c3aed" strokeWidth="2"/>
                  <text x="0" y="-4" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#5b21b6">34.5kV</text>
                  <text x="0" y="9" textAnchor="middle" fontSize="8" fill="#5b21b6">TRAFO</text>
                </g>
                <g transform="translate(250,210)">
                  <line x1="-55" y1="0" x2="55" y2="0" stroke="#1e293b" strokeWidth="6" strokeLinecap="round"/>
                  <text x="65" y="4" fontSize="10" fontWeight="bold" fill="#1e293b">34.5 kV Barası</text>
                  {result.busbarCurrent > 0 && (
                    <g transform="translate(0,12)">
                      <rect x="-60" y="0" width="120" height="22" rx="4" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1.5"/>
                      <text x="0" y="15" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#6d28d9">I₃k = {result.busbarCurrent.toFixed(2)} kA</text>
                    </g>
                  )}
                </g>
                {lines.map((line, i) => {
                  const yBase=255, yTop=yBase+i*130, yBot=yTop+130;
                  const cable=cables.find(c=>c.id===line.cableTypeId), n=line.circuitCount||1;
                  return (
                    <g key={line.id}>
                      {n>1 ? (<><line x1="247" y1={yTop} x2="247" y2={yBot} stroke="#334155" strokeWidth="2.5"/><line x1="253" y1={yTop} x2="253" y2={yBot} stroke="#334155" strokeWidth="2.5"/></>) : (<line x1="250" y1={yTop} x2="250" y2={yBot} stroke="#334155" strokeWidth="3"/>)}
                      <g transform={`translate(250,${yTop+55})`}>
                        <rect x="-42" y="-16" width="84" height="32" rx="5" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5"/>
                        <text x="0" y="-3" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0369a1">{cable?.name||'?'}</text>
                        <text x="0" y="10" textAnchor="middle" fontSize="9" fill="#0369a1">{line.length} km</text>
                        {n>1 && <text x="0" y="22" textAnchor="middle" fontSize="8" fill="#7c3aed" fontWeight="bold">{n}× paralel</text>}
                      </g>
                      <g transform={`translate(250,${yBot})`}>
                        <circle cx="0" cy="0" r="7" fill="#475569"/>
                        <line x1="7" y1="0" x2="55" y2="0" stroke="#475569" strokeWidth="2.5"/>
                        <text x="62" y="-4" fontSize="10" fontWeight="bold" fill="#1e293b">
                          {line.name ? line.name : `Hat ${i+1} Sonu`}
                        </text>
                        <text x="62" y="9" fontSize="8" fill="#94a3b8">Hat {i+1}</text>
                        {i===lines.length-1 && result.lineEndCurrent>0 && (
                          <g transform="translate(0,14)">
                            <rect x="-80" y="0" width="160" height="24" rx="5" fill="#fdf4ff" stroke="#a21caf" strokeWidth="1.5"/>
                            <text x="0" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#86198f">I₃k = {result.lineEndCurrent.toFixed(2)} kA</text>
                          </g>
                        )}
                      </g>
                    </g>
                  );
                })}
                <g transform={`translate(10,${svgHeight-110})`}>
                  <rect x="0" y="0" width="480" height="95" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
                  <text x="12" y="20" fontSize="11" fontWeight="bold" fill="#334155">HESAP DETAYI:</text>
                  <text x="12" y="38" fontSize="10" fontFamily="monospace" fill="#475569">Zb={( 34.5*34.5/100).toFixed(4)}Ω  |  Ib={(100*1000/(1.732*34.5)).toFixed(2)}A</text>
                  <text x="12" y="54" fontSize="10" fontFamily="monospace" fill="#475569">Z_bara(pu)={result.zBaraPu?.toFixed(5)}  →  I₃k_bara={result.busbarCurrent.toFixed(3)}kA</text>
                  <text x="12" y="70" fontSize="10" fontFamily="monospace" fill="#475569">Z_top(pu)={result.zTotalPu?.toFixed(5)}  →  I₃k_hat={result.lineEndCurrent.toFixed(3)}kA</text>
                  <text x="12" y="86" fontSize="9" fontFamily="monospace" fill="#94a3b8">Çift devre: Z_hat=Z_kablo/n  |  IEC 60909</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
