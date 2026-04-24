import { modules } from '../components/Sidebar.jsx';

const stats = [
  { label: 'Toplam Modül', value: '8', sub: '2 OG + 4 AG + Trafo + PV' },
  { label: 'Kablo Tipi',   value: '19', sub: 'OG kablo kütüphanesi' },
  { label: 'Trafo Gücü',   value: '13', sub: '25 kVA → 2500 kVA' },
  { label: 'TEİAŞ Kaydı',  value: '16+', sub: 'Min / Yaz / Kış senaryo' },
];

const GROUP_STYLES = {
  og: { label: '⚡ Orta Gerilim',    accent: 'border-blue-200   hover:border-blue-400   group-hover:bg-blue-50' },
  ag: { label: '🔌 Alçak Gerilim',   accent: 'border-green-200  hover:border-green-400  group-hover:bg-green-50' },
  pv: { label: '☀️ Yenilenebilir',    accent: 'border-yellow-200 hover:border-yellow-400 group-hover:bg-yellow-50' },
};

export default function Dashboard({ setActiveModule }) {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 rounded-2xl shadow-lg">
        <div className="flex items-center gap-4 mb-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
              fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">GridMaster</h1>
            <p className="text-slate-400 text-sm">Elektrik Mühendisliği Hesap Platformu</p>
          </div>
        </div>
        <p className="text-slate-300 text-sm max-w-xl mt-3 leading-relaxed">
          OG/AG gerilim düşümü, kısa devre akımı, trafo seçimi ve güneş enerjisi
          panel-evirici uyumluluk hesaplarını tek platformda yapın.
        </p>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-xl shadow-sm border text-center">
            <div className="text-3xl font-black text-blue-600 mb-1">{s.value}</div>
            <div className="text-sm font-bold text-slate-700">{s.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Modül Kartları */}
      <div>
        <h2 className="text-base font-bold text-slate-600 mb-4 uppercase tracking-wide">Hesap Modülleri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(m => {
            const g = GROUP_STYLES[m.group] || GROUP_STYLES.og;
            return (
              <div key={m.id} onClick={() => setActiveModule(m.id)}
                className={`bg-white p-5 rounded-2xl shadow-sm border-2 cursor-pointer group transition-all duration-200 ${g.accent}`}>
                <div className={`p-3 rounded-xl w-fit mb-3 ${m.bg} ${m.color} group-hover:scale-110 transition-transform duration-200`}>
                  <m.icon size={26} />
                </div>
                <h3 className="font-bold text-base text-slate-800">{m.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{m.desc}</p>
                <div className="mt-3 text-[10px] font-bold uppercase text-slate-400 tracking-wide">{g.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
