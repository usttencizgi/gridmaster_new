import NumInput from '../components/NumInput.jsx';
import { useState } from 'react';
import { ShieldCheck, X, FileText } from '../components/Icons.jsx';
import { calcAgShortCircuitChain } from '../calculators/index.js';
import { exportAgShortCircuit, exportToPDF, buildAgShortCircuitPDF } from '../utils/export.js';
import { LV_TRANSFORMERS } from '../data/transformers.js';
import { AG_CABLES, AG_BUSBARS } from '../data/cables.js';

// Kesit seçenekleri
const BUSBAR_SECTIONS = [24, 30, 40, 50, 60, 75, 90, 100, 120, 125, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000, 2400];

const defaultBusbar = () => ({
  id: Date.now() + Math.random(),
  type: 'busbar',
  name: 'Bara',
  material: 'Cu',
  section: 400,     // mm²
  length: 2,        // m
  circuitCount: 1,
});

const defaultCable = () => ({
  id: Date.now() + Math.random(),
  type: 'cable',
  name: 'Kablo',
  material: 'Cu',
  section: 240,
  length: 30,
  circuitCount: 1,
});

export default function AgShortCircuit() {
  const [trafoKva, setTrafoKva] = useState(630);
  const [nodes, setNodes] = useState([
    { ...defaultBusbar(), name: 'AG Ana Barası', section: 600, length: 3 },
    { ...defaultCable(), name: 'Çıkış Kablosu', length: 50 },
    { ...defaultBusbar(), name: 'Tali Bara', section: 200, length: 2 },
  ]);
  const [calcResult, setCalcResult] = useState(null);
  const [showDiagram, setShowDiagram] = useState(false);

  const selectedTrafo = LV_TRANSFORMERS.find(t => t.kva === trafoKva);
  const trafoUk = selectedTrafo?.uk || 4.5;

  const handleCalc = () => setCalcResult(calcAgShortCircuitChain(trafoKva, trafoUk, nodes));

  const addNode = (type) => setNodes([...nodes, type === 'busbar' ? defaultBusbar() : defaultCable()]);
  const removeNode = (id) => setNodes(nodes.filter(n => n.id !== id));
  const updateNode = (id, field, value) => setNodes(nodes.map(n => n.id === id ? { ...n, [field]: value } : n));

  const cableSections = (material) => material === 'Al' ? AG_CABLES.filter(s => s >= 16) : AG_CABLES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg"><ShieldCheck size={32} /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">AG Kısa Devre Hesabı</h2>
            <p className="text-sm text-slate-500">0.4 kV — Üç Faz I₃k | Trafo → Bara → Kablo Zinciri</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCalc} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors">HESAPLA</button>
          {calcResult && (<>
            <button onClick={() => exportAgShortCircuit(trafoKva, trafoUk, nodes, calcResult)} className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 text-sm">📊 Excel</button>
            <button onClick={() => exportToPDF('AG Kısa Devre', buildAgShortCircuitPDF(trafoKva, trafoUk, calcResult))} className="bg-red-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-800 text-sm">📄 PDF</button>
          </>)}
          <button onClick={() => setShowDiagram(true)} disabled={!calcResult}
            className="bg-white border-2 border-slate-200 font-bold py-2 px-6 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors flex items-center gap-2">
            <FileText size={16} /> ŞEMA
          </button>
        </div>
      </div>

      {/* Bilgi Bandı */}
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 flex items-center gap-2">
        <span className="text-red-400 font-bold text-base">ℹ</span>
        <span>
          <strong>Üç-faz hesap (I₃k):</strong> Z = ρ × L / (S × n) [tek yön, faz iletkeni]. 
          <strong className="ml-2">Bara empedansı</strong> da dahil — malzeme, kesit ve uzunluk girin.
          I₁k ≈ I₃k × 0.85 (faz-nötr, yaklaşık).
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Trafo */}
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Trafo Seçimi</h3>
          <div className="flex flex-wrap gap-2">
            {LV_TRANSFORMERS.map(t => (
              <button key={t.kva} onClick={() => setTrafoKva(t.kva)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs border transition-all ${trafoKva === t.kva ? 'bg-red-600 text-white border-red-600' : 'hover:bg-red-50 border-slate-200'}`}>
                {t.kva}
              </button>
            ))}
          </div>
          {selectedTrafo && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Güç</span><span className="font-bold">{trafoKva} kVA</span></div>
              <div className="flex justify-between"><span className="text-slate-500">uk</span><span className="font-bold text-red-600">%{trafoUk}</span></div>
              <div className="flex justify-between">
                <span className="text-slate-500">In (0.4 kV)</span>
                <span className="font-bold font-mono">{(trafoKva / (1.732 * 0.4)).toFixed(0)} A</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Z_trafo</span>
                <span className="font-bold font-mono text-orange-600">{((trafoUk / 100) * ((0.4 * 0.4 * 1000) / trafoKva)).toFixed(5)} Ω</span>
              </div>
              {calcResult && (
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-slate-500">Bara I₃k</span>
                  <span className="font-bold font-mono text-red-600">
                    {calcResult.results.find(r => r.type === 'busbar')?.Ik3_kA.toFixed(2) || '—'} kA
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Ekle butonları */}
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-400 font-bold uppercase mb-2">Zincire Ekle</p>
            <div className="flex gap-2">
              <button onClick={() => addNode('busbar')}
                className="flex-1 py-2 text-xs font-bold rounded-lg border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-50 transition-all">+ Bara</button>
              <button onClick={() => addNode('cable')}
                className="flex-1 py-2 text-xs font-bold rounded-lg border-2 border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">+ Kablo</button>
            </div>
          </div>
        </div>

        {/* Sağ: Zincir */}
        <div className="lg:col-span-2 space-y-2">
          {/* Trafo Başlangıç */}
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-orange-600">TRF</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800">{trafoKva} kVA Trafo — 34.5/0.4 kV</div>
              <div className="text-xs text-slate-400">uk = %{trafoUk}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Z_trafo</div>
              <div className="font-mono font-bold text-orange-600 text-sm">
                {((trafoUk / 100) * ((0.4 * 0.4 * 1000) / trafoKva)).toFixed(5)} Ω
              </div>
            </div>
          </div>

          <div className="flex justify-center"><div className="w-0.5 h-3 bg-slate-300"></div></div>

          {nodes.map((node, i) => {
            const res = calcResult?.results[i];
            return (
              <div key={node.id}>
                {node.type === 'busbar' ? (
                  <div className="bg-white border-2 border-slate-300 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-black text-slate-600">BARA</div>
                      <input type="text" value={node.name} onChange={e => updateNode(node.id, 'name', e.target.value)}
                        className="flex-1 font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-slate-500 outline-none bg-transparent text-sm" />
                      {res && (
                        <div className="text-right ml-2 flex-shrink-0">
                          <div className="text-xs text-slate-400">I₃k / I₁k</div>
                          <div className="font-mono font-bold text-red-600 text-sm">{res.Ik3_kA.toFixed(2)} / {res.Ik1_kA.toFixed(2)} kA</div>
                        </div>
                      )}
                      <button onClick={() => removeNode(node.id)} className="text-red-300 hover:text-red-500 ml-1 flex-shrink-0"><X size={16} /></button>
                    </div>

                    {/* Bara görsel */}
                    <div className="h-1.5 bg-slate-700 rounded-full mx-4 mb-3"></div>

                    {/* Bara parametreleri */}
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">MALZEME</label>
                        <select value={node.material} onChange={e => updateNode(node.id, 'material', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-sm font-bold focus:outline-none">
                          <option value="Cu">Bakır (Cu)</option>
                          <option value="Al">Alüminyum (Al)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">KESİT (mm²)</label>
                        <select value={node.section} onChange={e => updateNode(node.id, 'section', Number(e.target.value))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-sm font-bold focus:outline-none">
                          {BUSBAR_SECTIONS.map(s => <option key={s} value={s}>{s} mm²</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">UZUNLUK (m)</label>
                        <NumInput value={node.length} onChange={v => updateNode(node.id, 'length', v)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-sm font-mono font-bold focus:outline-none"/>
                      </div>
                    </div>

                    {res && (
                      <div className="mt-2 flex gap-4 text-xs font-mono text-slate-400">
                        <span>Z_bara = {res.Z_element.toFixed(6)} Ω</span>
                        <span>Z_küm = {res.Z_cumulative.toFixed(6)} Ω</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-xs font-black text-blue-600">KBL</div>
                      <input type="text" value={node.name} onChange={e => updateNode(node.id, 'name', e.target.value)}
                        className="flex-1 font-bold text-blue-800 border-b border-transparent hover:border-blue-300 focus:border-blue-500 outline-none bg-transparent text-sm" />
                      {res && (
                        <div className="text-right ml-2 flex-shrink-0">
                          <div className="text-xs text-blue-400">I₃k / I₁k</div>
                          <div className="font-mono font-bold text-red-600 text-sm">{res.Ik3_kA.toFixed(2)} / {res.Ik1_kA.toFixed(2)} kA</div>
                        </div>
                      )}
                      <button onClick={() => removeNode(node.id)} className="text-red-300 hover:text-red-500 ml-1 flex-shrink-0"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-blue-400 font-bold block mb-1">MALZEME</label>
                        <select value={node.material} onChange={e => updateNode(node.id, 'material', e.target.value)}
                          className="w-full border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-sm font-bold focus:outline-none">
                          <option value="Cu">Cu</option>
                          <option value="Al">Al</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-blue-400 font-bold block mb-1">KESİT (mm²)</label>
                        <select value={node.section} onChange={e => updateNode(node.id, 'section', Number(e.target.value))}
                          className="w-full border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-sm font-bold focus:outline-none">
                          {cableSections(node.material).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-blue-400 font-bold block mb-1">UZUNLUK (m)</label>
                        <NumInput value={node.length} onChange={v => updateNode(node.id, 'length', v)} className="w-full border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-sm font-mono font-bold focus:outline-none"/>
                      </div>
                      <div>
                        <label className="text-[10px] text-blue-400 font-bold block mb-1">DEVRE</label>
                        <NumInput value={node.circuitCount} onChange={v => updateNode(node.id, 'circuitCount', v)} min="1" className="w-full border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-sm font-mono font-bold focus:outline-none"/>
                      </div>
                    </div>
                    {res && (
                      <div className="mt-2 flex gap-4 text-xs font-mono text-blue-300">
                        <span>Z_kablo = {res.Z_element.toFixed(6)} Ω</span>
                        <span>Z_küm = {res.Z_cumulative.toFixed(6)} Ω</span>
                      </div>
                    )}
                  </div>
                )}
                {i < nodes.length - 1 && (
                  <div className="flex justify-center my-1"><div className="w-0.5 h-3 bg-slate-300"></div></div>
                )}
              </div>
            );
          })}

          {nodes.length === 0 && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
              <p className="font-bold">Zincire bara veya kablo ekleyin</p>
            </div>
          )}
        </div>
      </div>

      {/* ŞEMA MODAL */}
      {showDiagram && calcResult && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowDiagram(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center rounded-t-2xl flex-shrink-0">
              <h3 className="font-bold flex items-center gap-2"><FileText size={20}/> AG Kısa Devre — Tek Hat Şeması</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold">🖨 Yazdır</button>
                <button onClick={() => setShowDiagram(false)} className="hover:bg-slate-700 p-1 rounded-lg"><X size={22}/></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              {(() => {
                const svgH = 90 + 90 + nodes.length * 100 + 110;
                return (
                  <svg width="400" height={svgH} viewBox={`0 0 400 ${svgH}`} className="w-full bg-white rounded-xl border shadow-sm p-4">
                    <line x1="170" y1="50" x2="170" y2={svgH - 90} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,3"/>
                    <g transform="translate(170,65)">
                      <rect x="-28" y="-20" width="56" height="40" rx="6" fill="#ffedd5" stroke="#ea580c" strokeWidth="2"/>
                      <text x="0" y="-4" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#9a3412">{trafoKva}kVA</text>
                      <text x="0" y="9" textAnchor="middle" fontSize="8" fill="#9a3412">uk=%{trafoUk}</text>
                      <text x="36" y="-5" fontSize="9" fontWeight="bold" fill="#1e293b">In={calcResult.In.toFixed(0)}A</text>
                      <text x="36" y="9" fontSize="9" fill="#64748b">Z={calcResult.Z_trafo.toFixed(5)}Ω</text>
                    </g>
                    {nodes.map((node, i) => {
                      const y = 120 + i * 100;
                      const res = calcResult.results[i];
                      if (node.type === 'busbar') {
                        return (
                          <g key={node.id} transform={`translate(170,${y})`}>
                            <line x1="-60" y1="0" x2="60" y2="0" stroke="#1e293b" strokeWidth="6" strokeLinecap="round"/>
                            <text x="70" y="-8" fontSize="8" fontWeight="bold" fill="#1e293b">{node.name}</text>
                            <text x="70" y="4" fontSize="8" fill="#64748b">{node.material} {node.section}mm² {node.length}m</text>
                            {res && (
                              <>
                                <text x="70" y="16" fontSize="9" fill="#dc2626" fontWeight="bold">I₃k={res.Ik3_kA.toFixed(2)}kA</text>
                                <text x="70" y="28" fontSize="8" fill="#ea580c">I₁k={res.Ik1_kA.toFixed(2)}kA</text>
                              </>
                            )}
                          </g>
                        );
                      } else {
                        return (
                          <g key={node.id} transform={`translate(170,${y})`}>
                            <rect x="-36" y="-16" width="72" height="32" rx="5" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5"/>
                            <text x="0" y="-3" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#0369a1">{node.material} {node.section}mm² ×{node.circuitCount}</text>
                            <text x="0" y="10" textAnchor="middle" fontSize="8" fill="#0369a1">{node.length}m</text>
                            {res && <text x="44" y="4" fontSize="8" fill="#64748b">+{res.Z_element?.toFixed(5)}Ω</text>}
                          </g>
                        );
                      }
                    })}
                    <g transform={`translate(10, ${svgH - 100})`}>
                      <rect x="0" y="0" width="380" height="88" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <text x="12" y="18" fontSize="10" fontWeight="bold" fill="#334155">HESAP METODU (Üç-Faz I₃k):</text>
                      <text x="12" y="34" fontSize="9" fontFamily="monospace" fill="#475569">Z_trafo = (uk%/100) × (Un²/Sn)</text>
                      <text x="12" y="49" fontSize="9" fontFamily="monospace" fill="#475569">Z_bara/kablo = ρ×L / (S×n) [tek yön]</text>
                      <text x="12" y="64" fontSize="9" fontFamily="monospace" fill="#475569">I₃k = Un / (√3 × ΣZ)</text>
                      <text x="12" y="79" fontSize="8" fontFamily="monospace" fill="#94a3b8">I₁k ≈ I₃k × 0.85  (faz-nötr yaklaşımı)</text>
                    </g>
                  </svg>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
