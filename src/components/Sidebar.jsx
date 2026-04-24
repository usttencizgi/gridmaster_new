import { Zap, Home, Settings, Menu, X, Activity, Battery, TrendingDown, ShieldCheck } from './Icons.jsx';

const ToprakIcon = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M12 22V12"/>
    <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
    <path d="M8 6l4-4 4 4"/>
    <line x1="6" y1="18" x2="18" y2="18"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
  </svg>
);

const GesIcon = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <rect x="2" y="7" width="20" height="15" rx="2"/>
    <polyline points="17 2 12 7 7 2"/>
    <line x1="12" y1="11" x2="12" y2="16"/>
    <line x1="9.5" y1="14" x2="14.5" y2="14"/>
  </svg>
);

const Sun = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const Ground = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <line x1="12" y1="2" x2="12" y2="12"/>
    <path d="M5 12h14"/><path d="M8 16h8"/><path d="M11 20h2"/>
  </svg>
);

const Lightning = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const Kapasitor = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <line x1="12" y1="2" x2="12" y2="8"/>
    <line x1="12" y1="16" x2="12" y2="22"/>
    <line x1="6" y1="8" x2="18" y2="8"/>
    <line x1="6" y1="16" x2="18" y2="16"/>
  </svg>
);

const SchematicIcon = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <rect x="9" y="2" width="6" height="6" rx="1"/>
    <rect x="9" y="16" width="6" height="6" rx="1"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="3" y1="12" x2="9" y2="12"/>
    <line x1="15" y1="12" x2="21" y2="12"/>
    <circle cx="3" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="21" cy="12" r="1.5" fill="currentColor"/>
  </svg>
);

const KioskIcon = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||20} height={p.size||20} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <rect x="3" y="4" width="18" height="14" rx="2"/>
    <line x1="8" y1="4" x2="8" y2="18"/>
    <line x1="16" y1="4" x2="16" y2="18"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="7" y1="21" x2="17" y2="21"/>
    <line x1="12" y1="18" x2="12" y2="21"/>
  </svg>
);

export const modules = [
  { id:'og-voltage-drop',  title:'OG Gerilim Düşümü',     icon:Zap,           group:'og' },
  { id:'og-short-circuit', title:'OG Kısa Devre',          icon:Activity,      group:'og' },
  { id:'transformer',      title:'Trafo Hesapları',         icon:Battery,       group:'og' },
  { id:'ag-voltage-drop',  title:'AG Gerilim Düşümü',      icon:TrendingDown,  group:'ag' },
  { id:'ag-short-circuit', title:'AG Kısa Devre',           icon:ShieldCheck,   group:'ag' },
  { id:'topraklama',       title:'Topraklama',              icon:Ground,        group:'ag' },
  { id:'yildirim',         title:'Yıldırımdan Korunma',    icon:Lightning,     group:'ag' },
  { id:'pv-compatibility', title:'Panel–Evirici Uyumluluk',icon:Sun,           group:'pv' },
  { id:'ges-kablo',        title:'GES Kablo & Güç',        icon:GesIcon,        group:'pv' },
  { id:'ges-topraklama',   title:'GES Topraklama',          icon:ToprakIcon,     group:'pv' },
  { id:'kompanzasyon',     title:'Reaktif Güç Komp.',      icon:Kapasitor,     group:'ag' },
  { id:'enh-editor',       title:'ENH Tek Hat Şeması',     icon:SchematicIcon, group:'hidden'},
  { id:'kosk-konfig',      title:'Köşk Konfigüratörü',     icon:KioskIcon,     group:'hidden'},
];

const GROUP_BORDER = { og:'border-blue-500', ag:'border-green-500', pv:'border-yellow-500', enh:'border-cyan-400' };

export default function Sidebar({ activeModule, setActiveModule, isOpen, setIsOpen }) {
  const og  = modules.filter(m=>m.group==='og');
  const ag  = modules.filter(m=>m.group==='ag');
  const pv  = modules.filter(m=>m.group==='pv');
  const enh = modules.filter(m=>m.group==='enh');

  const NavBtn = ({ id, icon: Icon, title, group }) => {
    const isActive = activeModule === id;
    const border = isActive ? GROUP_BORDER[group]||'border-slate-400' : 'border-transparent';
    return (
      <button onClick={() => setActiveModule(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border-l-4 ${
          isActive ? `bg-slate-800 text-white ${border}` : `text-slate-400 hover:bg-slate-800 hover:text-slate-200 ${border}`
        }`}>
        <Icon size={18} className="flex-shrink-0"/>
        {isOpen && <span className="text-sm font-semibold truncate">{title}</span>}
      </button>
    );
  };

  const GroupLabel = ({ label }) => isOpen
    ? <div className="text-[10px] font-bold text-slate-500 mt-5 mb-1 px-3 uppercase tracking-widest">{label}</div>
    : <div className="border-t border-slate-800 my-2"/>;

  return (
    <aside className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ${isOpen?'w-64':'w-16'} print:hidden z-50 shadow-xl flex-shrink-0`}>
      {/* Logo */}
      <div className={`flex items-center border-b border-slate-800 ${isOpen?'justify-between px-3 py-2':'justify-center py-3'}`}>
        <div className={`flex items-center gap-2 ${!isOpen&&'justify-center'}`}>
          <div className="rounded-lg overflow-hidden flex-shrink-0 w-10 h-10" style={{background:'#0f172a'}}>
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain"/>
          </div>
          {isOpen && (
            <div>
              <div className="font-black text-base tracking-tight text-white leading-tight">GridMaster</div>
              <div className="text-[10px] text-slate-400 font-medium leading-tight">v1.3 — Elektrik Hesap</div>
            </div>
          )}
        </div>
        {isOpen && (
          <button onClick={()=>setIsOpen(false)} className="text-slate-500 hover:text-white p-1 rounded ml-auto">
            <X size={16}/>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <NavBtn id="dashboard" icon={Home} title="Ana Panel" group="og"/>
        <GroupLabel label="OG Modülleri"/>
        {og.map(m=><NavBtn key={m.id} {...m}/>)}
        <GroupLabel label="AG / Topraklama"/>
        {ag.map(m=><NavBtn key={m.id} {...m}/>)}
        <GroupLabel label="YEK Modülleri"/>
        {pv.map(m=><NavBtn key={m.id} {...m}/>)}

        <div className="border-t border-slate-800 mt-4 pt-2">
          <NavBtn id="settings" icon={Settings} title="Ayarlar" group="og"/>
        </div>
      </nav>

      {!isOpen && (
        <button onClick={()=>setIsOpen(true)} className="p-4 flex justify-center text-slate-500 hover:text-white border-t border-slate-800">
          <Menu size={20}/>
        </button>
      )}
    </aside>
  );
}
