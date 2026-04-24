import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import { INITIAL_CABLES } from './data/cables.js';
import Dashboard from './modules/Dashboard.jsx';
import OgVoltageDrop from './modules/OgVoltageDrop.jsx';
import OgShortCircuit from './modules/OgShortCircuit.jsx';
import Transformer from './modules/Transformer.jsx';
import AgVoltageDrop from './modules/AgVoltageDrop.jsx';
import AgShortCircuit from './modules/AgShortCircuit.jsx';
import Topraklama from './modules/Topraklama.jsx';
import Yildirim from './modules/Yildirim.jsx';
import PvCompatibility from './modules/PvCompatibility.jsx';
import GesKablo from './modules/GesKablo.jsx';
import GesTopraklama from './modules/GesTopraklama.jsx';
import Kompanzasyon from './modules/Kompanzasyon.jsx';
import EnhEditor from './modules/EnhEditor.jsx';
import KoskKonfigurator from './modules/KoskKonfigurator.jsx';
import Settings from './modules/Settings.jsx';

const TITLES = {
  dashboard:          'Ana Panel',
  'og-voltage-drop':  'OG Gerilim Düşümü',
  'og-short-circuit': 'OG Kısa Devre',
  transformer:        'Trafo Hesapları',
  'ag-voltage-drop':  'AG Gerilim Düşümü',
  'ag-short-circuit': 'AG Kısa Devre',
  topraklama:         'Topraklama Hesabı',
  yildirim:           'Yıldırımdan Korunma',
  'pv-compatibility': 'Panel — Evirici Uyumluluk',
  'ges-kablo':        'GES — Kablo & Güç Hesapları',
  'ges-topraklama':   'GES — Topraklama Hesabı',
  kompanzasyon:       'Reaktif Güç Kompanzasyonu',
  'enh-editor':       'ENH — Tek Hat Şeması Editörü',
  'kosk-konfig':       'Köşk Konfigüratörü',
  settings:           'Ayarlar',
};

export default function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [cables, setCables] = useState(INITIAL_CABLES);
  const [gesIk1, setGesIk1] = useState(0);
  const [teiashData, setTeiashData] = useState({ min:[], summer:[], winter:[] });
  const [teiashLoading, setTeiashLoading] = useState(true);
  const [teiashError, setTeiashError] = useState(null);

  useEffect(()=>{
    fetch('/teiash_data.json')
      .then(r=>{ if(!r.ok) throw new Error('Yüklenemedi'); return r.json(); })
      .then(json=>{ setTeiashData(json.data||json); setTeiashLoading(false); })
      .catch(err=>{ setTeiashError(err.message); setTeiashLoading(false); });
  },[]);

  const renderModule = () => {
    switch(activeModule){
      case 'dashboard':        return <Dashboard setActiveModule={setActiveModule}/>;
      case 'og-voltage-drop':  return <OgVoltageDrop cables={cables}/>;
      case 'og-short-circuit': return <OgShortCircuit cables={cables} teiashData={teiashData} teiashLoading={teiashLoading} onGoTopraklama={(ik1) => { setGesIk1(ik1); setActiveModule('ges-topraklama'); }}/>;
      case 'transformer':      return <Transformer/>;
      case 'ag-voltage-drop':  return <AgVoltageDrop/>;
      case 'ag-short-circuit': return <AgShortCircuit/>;
      case 'topraklama':       return <Topraklama/>;
      case 'yildirim':         return <Yildirim/>;
      case 'pv-compatibility': return <PvCompatibility/>;
      case 'ges-kablo':        return <GesKablo/>;
      case 'ges-topraklama':   return <GesTopraklama initialIk1={gesIk1}/>;
      case 'kompanzasyon':     return <Kompanzasyon/>;
      case 'enh-editor':       return <EnhEditor/>;
      case 'kosk-konfig':    return <KoskKonfigurator/>;
      case 'settings':         return <Settings cables={cables} setCables={setCables}/>;
      default:                 return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}/>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white h-14 border-b flex items-center justify-between px-6 shadow-sm flex-shrink-0 print:hidden">
          <h2 className="font-bold text-slate-700">{TITLES[activeModule]}</h2>
          <div className="flex items-center gap-3">
            {teiashLoading && <span className="text-xs text-blue-500 font-bold animate-pulse">TEİAŞ yükleniyor...</span>}
            {teiashError   && <span className="text-xs text-red-400 font-bold">⚠ TEİAŞ yüklenemedi</span>}
            {!teiashLoading && !teiashError && (
              <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full">
                ✓ TEİAŞ {teiashData.min?.length||0}+ kayıt
              </span>
            )}
            <span className="text-xs text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-full">v1.3</span>
          </div>
        </header>
        <div className={activeModule === 'enh-editor' || activeModule === 'kosk-konfig' ? 'flex-1 overflow-hidden' : 'flex-1 overflow-auto p-6'}>
          {renderModule()}
        </div>
      </main>
    </div>
  );
}
