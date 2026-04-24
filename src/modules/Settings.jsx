import { useState } from 'react';
import { Database, Save, RotateCcw } from '../components/Icons.jsx';
import { INITIAL_CABLES } from '../data/cables.js';

export default function Settings({ cables, setCables }) {
  const [localCables, setLocalCables] = useState(cables);
  const [hasChanges, setHasChanges] = useState(false);

  const handleUpdate = (id, field, value) => {
    setLocalCables(prev => prev.map(c => c.id === id ? { ...c, [field]: parseFloat(value) || 0 } : c));
    setHasChanges(true);
  };

  const handleSave = () => { setCables(localCables); setHasChanges(false); alert('Değişiklikler kaydedildi!'); };
  const handleReset = () => {
    if (confirm('Kablo verilerini varsayılana sıfırlamak istiyor musun?')) {
      setLocalCables(INITIAL_CABLES);
      setCables(INITIAL_CABLES);
      setHasChanges(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Database size={28} className="text-slate-600" />
          <div>
            <h2 className="text-xl font-bold text-slate-800">Kablo Kütüphanesi</h2>
            <p className="text-sm text-slate-500">OG kablo parametrelerini düzenle</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleReset} className="text-red-600 px-4 py-2 font-bold text-sm flex items-center gap-2 hover:bg-red-50 rounded-lg">
            <RotateCcw size={16} /> SIFIRLA
          </button>
          <button onClick={handleSave} disabled={!hasChanges} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow flex items-center gap-2 disabled:opacity-50 hover:bg-blue-700">
            <Save size={18} /> KAYDET
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b">
            <tr>
              <th className="px-4 py-3">Kablo Adı</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-2 py-3 text-center">Z (Ω/km)</th>
              <th className="px-2 py-3 text-center">K Faktör</th>
              <th className="px-2 py-3 text-center">C Faktör</th>
              <th className="px-2 py-3 text-center">I Max (A)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {localCables.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-bold text-xs">{c.name}</td>
                <td className="px-4 py-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.type === 'Havai' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{c.type}</span>
                </td>
                <td className="px-2 py-2">
                  <input type="text" inputMode="decimal" onFocus={e => e.target.select()} step="0.0001" value={c.z} onChange={e => handleUpdate(c.id, 'z', e.target.value)} className="w-24 text-center border rounded px-1 py-0.5 text-xs font-mono bg-transparent" />
                </td>
                <td className="px-2 py-2">
                  <input type="text" inputMode="decimal" onFocus={e => e.target.select()} step="0.0001" value={c.kFactor} onChange={e => handleUpdate(c.id, 'kFactor', e.target.value)} className="w-24 text-center border rounded px-1 py-0.5 text-xs font-mono bg-transparent" />
                </td>
                <td className="px-2 py-2">
                  <input type="text" inputMode="decimal" onFocus={e => e.target.select()} step="0.0001" value={c.cFactor} onChange={e => handleUpdate(c.id, 'cFactor', e.target.value)} className="w-24 text-center border rounded px-1 py-0.5 text-xs font-mono bg-transparent" />
                </td>
                <td className="px-2 py-2">
                  <input type="text" inputMode="decimal" onFocus={e => e.target.select()} step="1" value={c.currentLimit} onChange={e => handleUpdate(c.id, 'currentLimit', e.target.value)} className="w-20 text-center border rounded px-1 py-0.5 text-xs font-mono bg-transparent" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
