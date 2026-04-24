import NumInput from '../components/NumInput.jsx';
import { useState } from 'react';
import { TrendingDown, X } from '../components/Icons.jsx';
import { calcAgDropSimple, calcAgDropNetwork } from '../calculators/index.js';
import { exportAgVoltageDrop, exportToPDF } from '../utils/export.js';
import { AG_CABLES, AG_CABLE_CURRENT_LIMITS, AG_BUSBARS } from '../data/cables.js';

const DEFAULT_NODE = () => ({
  id: Date.now(),
  name: 'Hat',
  type: 'cable',      // cable | busbar
  material: 'Cu',
  section: 95,
  length: 50,
  powerKW: 50,
  circuitCount: 1,
});

export default function AgVoltageDrop() {
  const [mode, setMode] = useState('simple'); // simple | network
  const [voltageOption, setVoltageOption] = useState('tri');
  const [cosPhi, setCosPhi] = useState(0.9);

  // Basit mod
  const [simpleMaterial, setSimpleMaterial] = useState('Cu');
  const [simplePower, setSimplePower] = useState(50);
  const [simpleLength, setSimpleLength] = useState(50);
  const [simpleSection, setSimpleSection] = useState(95);
  const [simpleResult, setSimpleResult] = useState(null);

  // Ağ modu
  const [nodes, setNodes] = useState([{ ...DEFAULT_NODE(), name: 'Ana Hat', powerKW: 100 }]);
  const [networkResults, setNetworkResults] = useState([]);

  const handleSimpleCalc = () => {
    setSimpleResult(calcAgDropSimple(voltageOption, simpleMaterial, simplePower, simpleLength, simpleSection, cosPhi));
  };

  const handleNetworkCalc = () => {
    setNetworkResults(calcAgDropNetwork(nodes, voltageOption, cosPhi));
  };

  const updateNode = (i, f, v) => { const n = [...nodes]; n[i][f] = v; setNodes(n); };

  const sectionOptions = simpleMaterial === 'Al'
    ? AG_CABLES.filter(s => s >= 16)
    : AG_CABLES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex items-center gap-4">
        <div className="p-3 bg-green-50 text-green-600 rounded-lg"><TrendingDown size={32} /></div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">AG Gerilim Düşümü</h2>
          <p className="text-sm text-slate-500">0.4 kV Kablo Kesit Hesabı</p>
        </div>
      </div>

      {/* Ortak Parametreler */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Sistem Gerilimi</label>
            <select value={voltageOption} onChange={e => setVoltageOption(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-2 text-sm font-bold">
              <option value="tri">3-Faz 380V</option>
              <option value="tri400">3-Faz 400V</option>
              <option value="mono">1-Faz 220V</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cos φ</label>
            <NumInput value={cosPhi} onChange={v => setCosPhi(v)} min="0.5" className="w-full border-2 border-slate-200 rounded-xl p-2 font-mono font-bold"/>
          </div>
          <div className="flex gap-2 items-end col-span-2">
            <button onClick={() => setMode('simple')} className={`flex-1 py-2 font-bold rounded-lg border text-sm transition-all ${mode === 'simple' ? 'bg-green-600 text-white border-green-600' : 'hover:bg-green-50'}`}>Basit Hesap</button>
            <button onClick={() => setMode('network')} className={`flex-1 py-2 font-bold rounded-lg border text-sm transition-all ${mode === 'network' ? 'bg-green-600 text-white border-green-600' : 'hover:bg-green-50'}`}>Ağ Hesabı</button>
          </div>
        </div>
      </div>

      {mode === 'simple' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h3 className="font-bold text-slate-700">Hesap Parametreleri</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Malzeme</label>
                <select value={simpleMaterial} onChange={e => setSimpleMaterial(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-2 font-bold text-sm">
                  <option value="Cu">Bakır (Cu)</option>
                  <option value="Al">Alüminyum (Al)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Kesit (mm²)</label>
                <select value={simpleSection} onChange={e => setSimpleSection(Number(e.target.value))} className="w-full border-2 border-slate-200 rounded-xl p-2 font-bold text-sm">
                  {sectionOptions.map(s => <option key={s} value={s}>{s} mm²</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Güç (kW)</label>
                <NumInput value={simplePower} onChange={v => setSimplePower(v)} className="w-full border-2 border-slate-200 rounded-xl p-3 font-mono font-bold"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Mesafe (m)</label>
                <NumInput value={simpleLength} onChange={v => setSimpleLength(v)} className="w-full border-2 border-slate-200 rounded-xl p-3 font-mono font-bold"/>
              </div>
            </div>
            <button onClick={handleSimpleCalc} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700">HESAPLA</button>
          </div>

          {simpleResult && (
            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
              <h3 className="font-bold text-slate-700">Sonuçlar</h3>
              <div className={`p-4 rounded-xl text-center border-2 ${simpleResult.dropPercent > 5 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                <div className="text-xs font-bold uppercase text-slate-500 mb-1">Gerilim Düşümü</div>
                <div className={`text-4xl font-bold font-mono ${simpleResult.dropPercent > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  %{simpleResult.dropPercent.toFixed(3)}
                </div>
                <div className={`text-xs font-bold mt-1 ${simpleResult.dropPercent > 5 ? 'text-red-500' : 'text-green-500'}`}>
                  {simpleResult.dropPercent > 5 ? '⚠ Limit Aşıldı (>%5)' : '✓ Uygun (≤%5)'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 text-center">
                  <div className="text-xs font-bold uppercase text-slate-400 mb-1">Yük Akımı</div>
                  <div className="text-2xl font-bold font-mono text-slate-700">{simpleResult.currentAmps.toFixed(1)} A</div>
                </div>
                <div className={`p-4 rounded-xl text-center ${simpleResult.isSafeCurrent ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="text-xs font-bold uppercase text-slate-400 mb-1">Kablo Kapasitesi</div>
                  <div className={`text-2xl font-bold font-mono ${simpleResult.isSafeCurrent ? 'text-green-600' : 'text-red-600'}`}>{simpleResult.capacity} A</div>
                  <div className={`text-xs font-bold ${simpleResult.isSafeCurrent ? 'text-green-500' : 'text-red-500'}`}>
                    {simpleResult.isSafeCurrent ? '✓ Yeterli' : '✗ Yetersiz!'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {nodes.map((n, i) => (
            <div key={n.id} className="bg-white p-4 rounded-xl shadow-sm border grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">ADI</label>
                <input type="text" value={n.name} onChange={e => updateNode(i, 'name', e.target.value)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">MALZEME</label>
                <select value={n.material} onChange={e => updateNode(i, 'material', e.target.value)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm">
                  <option value="Cu">Cu</option>
                  <option value="Al">Al</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">KESİT (mm²)</label>
                <select value={n.section} onChange={e => updateNode(i, 'section', Number(e.target.value))} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm">
                  {(n.material === 'Al' ? AG_CABLES.filter(s => s >= 16) : AG_CABLES).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">UZUNLUK (m)</label>
                <NumInput value={n.length} onChange={v => updateNode(i, 'length', v)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm"/>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">GÜÇ (kW)</label>
                <NumInput value={n.powerKW} onChange={v => updateNode(i, 'powerKW', v)} className="w-full bg-slate-50 border rounded px-2 py-1 text-sm"/>
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">DEVRE</label>
                <NumInput value={n.circuitCount} onChange={v => updateNode(i, 'circuitCount', v)} min="1" className="w-full bg-slate-50 border rounded px-2 py-1 text-sm"/>
              </div>
              <button onClick={() => setNodes(nodes.filter((_, j) => j !== i))} className="col-span-1 text-red-400 hover:text-red-600"><X size={20} /></button>
            </div>
          ))}

          {networkResults.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="px-3 py-2 text-left">Hat</th>
                    <th className="px-3 py-2 text-right">Segm. %</th>
                    <th className="px-3 py-2 text-right">Toplam %</th>
                    <th className="px-3 py-2 text-right">Akım (A)</th>
                    <th className="px-3 py-2 text-right">Kapasite (A)</th>
                    <th className="px-3 py-2 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {networkResults.map((r, i) => (
                    <tr key={i} className={`hover:bg-slate-50 ${(!r.isSafeCurrent || r.totalDrop > 5) ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 font-bold text-xs">{r.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.segmentDrop.toFixed(3)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold text-xs ${r.totalDrop > 5 ? 'text-red-600' : 'text-green-600'}`}>{r.totalDrop.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.currentAmps.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.capacity}</td>
                      <td className="px-3 py-2 text-center text-xs">{r.isSafeCurrent && r.totalDrop <= 5 ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setNodes([...nodes, DEFAULT_NODE()])} className="flex-1 py-3 border-2 border-dashed rounded-xl text-slate-500 font-bold hover:border-green-400 hover:text-green-500 transition-colors">+ YENİ HAT EKLE</button>
            <button onClick={handleNetworkCalc} className="bg-green-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-700">HESAPLA</button>
          </div>
        </div>
      )}
    </div>
  );
}
