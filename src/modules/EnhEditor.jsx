import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const GRID    = 40;
const PORT_R  = 6;
const SNAP    = v => Math.round(v / GRID) * GRID;

// ─── Sembol Tanımları ─────────────────────────────────────────────────────────
// Her sembolün: etiket, grup, boyut (w/h), portlar ve SVG render fonksiyonu

const SYMBOLS = {

  kaynak: {
    label: 'Hat Kaynağı', group: 'Bağlantı', color: '#38bdf8',
    w: 40, h: 80,
    ports: [{ id: 'out', dx: 0, dy: 40, label: 'Çıkış' }],
    render: () => (
      <g stroke="currentColor" fill="currentColor">
        <line x1="0" y1="-40" x2="0" y2="28" strokeWidth="2"/>
        <polygon points="0,40 -9,18 9,18" />
        <line x1="-20" y1="-40" x2="20" y2="-40" strokeWidth="3"/>
        <line x1="-14" y1="-50" x2="14" y2="-50" strokeWidth="2"/>
        <line x1="-7"  y1="-60" x2="7"  y2="-60" strokeWidth="1.5"/>
      </g>
    ),
    defaultProps: { voltage: '34.5 kV', isc: '—' }
  },

  bara: {
    label: 'OG Barası', group: 'Bağlantı', color: '#38bdf8',
    w: 200, h: 20,
    ports: [
      { id: 'l',  dx: -100, dy:  0, label: 'Sol' },
      { id: 'r',  dx:  100, dy:  0, label: 'Sağ' },
      { id: 'p1', dx:  -60, dy: 10, label: 'P1' },
      { id: 'p2', dx:  -20, dy: 10, label: 'P2' },
      { id: 'p3', dx:   20, dy: 10, label: 'P3' },
      { id: 'p4', dx:   60, dy: 10, label: 'P4' },
    ],
    render: (props) => (
      <g>
        <rect x="-100" y="-6" width="200" height="12" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="2" rx="3"/>
        <text x="0" y="4" textAnchor="middle" fontSize="9" fill="#38bdf8" fontWeight="700"
          fontFamily="JetBrains Mono, monospace">{props?.label || 'BARA'}</text>
      </g>
    ),
    defaultProps: { voltage: '34.5 kV' }
  },

  at: {
    label: 'Ayırıcı (AT)', group: 'Şalter', color: '#a3e635',
    w: 40, h: 80,
    ports: [
      { id: 'in',  dx: 0, dy: -40, label: 'Giriş' },
      { id: 'out', dx: 0, dy:  40, label: 'Çıkış' },
    ],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-40" x2="0" y2="-15" strokeWidth="2"/>
        <line x1="0" y1=" 15" x2="0" y2=" 40" strokeWidth="2"/>
        {/* Açık bıçak */}
        <line x1="0" y1="-15" x2="22" y2=" 8" strokeWidth="2.5"/>
        {/* Sabit kontak */}
        <circle cx="0" cy=" 15" r="4" fill="currentColor"/>
        <circle cx="0" cy="-15" r="4" fill="currentColor"/>
        <line x1="-10" y1=" 15" x2="10" y2=" 15" strokeWidth="2.5"/>
      </g>
    ),
    defaultProps: { type: 'AT-36', current: '630 A', status: 'Açık' }
  },

  yuk_ayirici: {
    label: 'Yük Ayırıcısı', group: 'Şalter', color: '#a3e635',
    w: 40, h: 80,
    ports: [
      { id: 'in',  dx: 0, dy: -40, label: 'Giriş' },
      { id: 'out', dx: 0, dy:  40, label: 'Çıkış' },
    ],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-40" x2="0" y2="-18" strokeWidth="2"/>
        <line x1="0" y1=" 18" x2="0" y2=" 40" strokeWidth="2"/>
        {/* Dikdörtgen gövde */}
        <rect x="-12" y="-18" width="24" height="36" rx="3" strokeWidth="2"/>
        {/* T çizgisi (yük sembolü) */}
        <line x1="-8"  y1="0" x2="8"  y2="0" strokeWidth="2"/>
        <line x1="-12" y1="-6" x2="12" y2="-6" strokeWidth="1.5" strokeDasharray="3,2"/>
      </g>
    ),
    defaultProps: { type: 'YA-36', current: '630 A', status: 'Kapalı' }
  },

  kesici: {
    label: 'Kesici (CB)', group: 'Şalter', color: '#f97316',
    w: 40, h: 80,
    ports: [
      { id: 'in',  dx: 0, dy: -40, label: 'Giriş' },
      { id: 'out', dx: 0, dy:  40, label: 'Çıkış' },
    ],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-40" x2="0" y2="-20" strokeWidth="2"/>
        <line x1="0" y1=" 20" x2="0" y2=" 40" strokeWidth="2"/>
        {/* Kare gövde */}
        <rect x="-16" y="-20" width="32" height="40" rx="4" strokeWidth="2.5"/>
        {/* X içinde — kesici sembolü */}
        <line x1="-10" y1="-12" x2="10" y2=" 12" strokeWidth="2"/>
        <line x1=" 10" y1="-12" x2="-10" y2=" 12" strokeWidth="2"/>
      </g>
    ),
    defaultProps: { type: 'VCB', rating: '630 A / 36 kV', isc: '25 kA', status: 'Kapalı' }
  },

  sigorta: {
    label: 'NH/HH Sigorta', group: 'Koruma', color: '#f97316',
    w: 40, h: 80,
    ports: [
      { id: 'in',  dx: 0, dy: -40, label: 'Giriş' },
      { id: 'out', dx: 0, dy:  40, label: 'Çıkış' },
    ],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-40" x2="0" y2="-18" strokeWidth="2"/>
        <line x1="0" y1=" 18" x2="0" y2=" 40" strokeWidth="2"/>
        {/* Uzun dikdörtgen sigorta gövdesi */}
        <rect x="-9" y="-18" width="18" height="36" rx="2" strokeWidth="2"/>
        {/* Eriyen tel çizgisi */}
        <path d="M0,-14 Q6,-7 0,0 Q-6,7 0,14" strokeWidth="1.5" fill="none"/>
      </g>
    ),
    defaultProps: { type: 'HH 36kV', rating: '50 A', breaking: '31.5 kA' }
  },

  ct: {
    label: 'Akım Trafosu (CT)', group: 'Ölçüm', color: '#c084fc',
    w: 40, h: 60,
    ports: [
      { id: 'in',  dx: 0, dy: -30, label: 'Giriş' },
      { id: 'out', dx: 0, dy:  30, label: 'Çıkış' },
    ],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-30" x2="0" y2="-16" strokeWidth="2"/>
        <line x1="0" y1=" 16" x2="0" y2=" 30" strokeWidth="2"/>
        {/* İki halka — CT sembolü */}
        <ellipse cx="0" cy="-8"  rx="14" ry="8" strokeWidth="2"/>
        <ellipse cx="0" cy=" 8" rx="14" ry="8" strokeWidth="2"/>
        <text x="0" y="3" textAnchor="middle" fontSize="8"
          fill="currentColor" fontFamily="monospace" stroke="none">CT</text>
      </g>
    ),
    defaultProps: { ratio: '100/5 A', class: '5P20', burden: '15 VA' }
  },

  parafudr: {
    label: 'Parafudr (LA)', group: 'Koruma', color: '#fb923c',
    w: 40, h: 80,
    ports: [
      { id: 'in',   dx: 0, dy: -40, label: 'Hat' },
      { id: 'topk', dx: 0, dy:  40, label: 'Toprak' },
    ],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-40" x2="0" y2="-18" strokeWidth="2"/>
        {/* Ok başı — yıldırım oku */}
        <path d="M-6,-18 L6,-18 L3,-2 L8,-2 L-3,18 L0,4 L-5,4 Z"
          fill="currentColor" stroke="none" opacity="0.8"/>
        {/* Topraklama */}
        <line x1="0" y1="18" x2="0" y2="28" strokeWidth="2"/>
        <line x1="-14" y1="28" x2="14" y2="28" strokeWidth="2.5"/>
        <line x1="-9"  y1="34" x2="9"  y2="34" strokeWidth="2"/>
        <line x1="-4"  y1="40" x2="4"  y2="40" strokeWidth="1.5"/>
      </g>
    ),
    defaultProps: { voltage: '30 kV', energy: '5 kJ', type: 'ZnO' }
  },

  topraklama: {
    label: 'Topraklama', group: 'Koruma', color: '#4ade80',
    w: 40, h: 50,
    ports: [{ id: 'in', dx: 0, dy: -25, label: 'Hat' }],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-25" x2="0" y2="-8" strokeWidth="2"/>
        <line x1="-16" y1="-8" x2="16" y2="-8" strokeWidth="2.5"/>
        <line x1="-10" y1="0"  x2="10" y2="0"  strokeWidth="2"/>
        <line x1="-5"  y1="8"  x2="5"  y2="8"  strokeWidth="1.5"/>
      </g>
    ),
    defaultProps: { resistance: '≤ 2 Ω', type: 'İşletme' }
  },

  trafo: {
    label: 'Güç Trafosu', group: 'Trafo', color: '#fbbf24',
    w: 60, h: 120,
    ports: [
      { id: 'og',  dx: 0, dy: -60, label: 'OG (34.5kV)' },
      { id: 'ag',  dx: 0, dy:  60, label: 'AG (0.4kV)'  },
    ],
    render: () => (
      <g stroke="currentColor" fill="none">
        <line x1="0" y1="-60" x2="0" y2="-28" strokeWidth="2"/>
        <line x1="0" y1=" 28" x2="0" y2=" 60" strokeWidth="2"/>
        {/* OG sargı */}
        <circle cx="0" cy="-14" r="16" strokeWidth="2.5"/>
        <text x="0" y="-10" textAnchor="middle" fontSize="7"
          fill="currentColor" stroke="none" fontFamily="monospace">34.5</text>
        {/* AG sargı */}
        <circle cx="0" cy=" 14" r="16" strokeWidth="2.5"/>
        <text x="0" y="18" textAnchor="middle" fontSize="7"
          fill="currentColor" stroke="none" fontFamily="monospace">0.4</text>
      </g>
    ),
    defaultProps: { power: '630 kVA', voltage: '34.5/0.4 kV', uk: '4.5%', connection: 'Dyn11' }
  },

  kosk: {
    label: 'Beton Köşk', group: 'Yapı', color: '#94a3b8',
    w: 160, h: 100,
    ports: [
      { id: 't1', dx: -40, dy: -50, label: 'OG-1' },
      { id: 't2', dx:  40, dy: -50, label: 'OG-2' },
      { id: 'b1', dx: -40, dy:  50, label: 'AG-1' },
      { id: 'b2', dx:  40, dy:  50, label: 'AG-2' },
    ],
    render: (props) => (
      <g>
        <rect x="-80" y="-50" width="160" height="100" rx="6"
          fill="#1e293b" stroke="currentColor" strokeWidth="2"/>
        {/* Çatı */}
        <path d="M-80,-50 L0,-70 L80,-50" stroke="currentColor" strokeWidth="1.5" fill="#0f172a"/>
        {/* İç bölmeler */}
        <line x1="0" y1="-50" x2="0" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="4,3" opacity="0.4"/>
        <line x1="-80" y1="0"  x2="80" y2="0"  stroke="currentColor" strokeWidth="1" opacity="0.3"/>
        {/* Etiket */}
        <text x="0" y="6" textAnchor="middle" fontSize="10"
          fill="currentColor" stroke="none" fontWeight="700"
          fontFamily="JetBrains Mono, monospace">
          {props?.label || 'BK'}
        </text>
        <text x="0" y="20" textAnchor="middle" fontSize="8"
          fill="currentColor" stroke="none" opacity="0.6"
          fontFamily="monospace">Beton Köşk</text>
      </g>
    ),
    defaultProps: { type: 'BK-1', cells: '4 Hücre', voltage: '34.5 kV' }
  },
};

// ─── Araçlar ──────────────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'select', label: 'Seç',    icon: '↖', color: '#64748b' },
  { id: 'wire',   label: 'Kablo',  icon: '⌇', color: '#38bdf8' },
  { id: 'delete', label: 'Sil',    icon: '✕', color: '#f87171' },
];

const GROUPS = ['Bağlantı', 'Şalter', 'Koruma', 'Ölçüm', 'Trafo', 'Yapı'];

// ─── Yardımcı: port mutlak pozisyonu ─────────────────────────────────────────
const getPortPos = (elem, portId) => {
  const def  = SYMBOLS[elem.type];
  const port = def?.ports.find(p => p.id === portId);
  if (!port) return { x: elem.x, y: elem.y };
  return { x: elem.x + port.dx, y: elem.y + port.dy };
};

// ─── Yardımcı: ortogonal wire path ───────────────────────────────────────────
const wirePoints = (x1, y1, x2, y2) => {
  const my = (y1 + y2) / 2;
  if (Math.abs(x1 - x2) < 4) return `M${x1},${y1} L${x2},${y2}`;
  return `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;
};

// ─── Benzersiz ID ─────────────────────────────────────────────────────────────
let UID = 1;
const uid = () => `e${UID++}`;

// ═══════════════════════════════════════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function EnhEditor() {
  // State
  const [elements,  setElements]  = useState([]);
  const [wires,     setWires]     = useState([]);
  const [selected,  setSelected]  = useState(null);   // elem id
  const [tool,      setTool]      = useState('select');
  const [pan,       setPan]       = useState({ x: 100, y: 100 });
  const [zoom,      setZoom]      = useState(1);
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelValue,   setLabelValue]   = useState('');

  // Wire çizimi state
  const [wireStart, setWireStart] = useState(null); // { elemId, portId, x, y }
  const [mousePos,  setMousePos]  = useState({ x: 0, y: 0 });

  const svgRef     = useRef(null);
  const isPanning  = useRef(false);
  const panStart   = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ── Koordinat dönüşümleri ──────────────────────────────────────────────────
  const toCanvas = useCallback((sx, sy) => ({
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom,
  }), [pan, zoom]);

  const svgPoint = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return toCanvas(e.clientX - rect.left, e.clientY - rect.top);
  }, [toCanvas]);

  // ── Klavye kısayolları ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected) {
          setElements(prev => prev.filter(el => el.id !== selected));
          setWires(prev => prev.filter(w => w.from.elemId !== selected && w.to.elemId !== selected));
          setSelected(null);
        }
      }
      if (e.key === 's') setTool('select');
      if (e.key === 'w') setTool('wire');
      if (e.key === 'Escape') { setTool('select'); setWireStart(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected]);

  // ── Sembol yerleştirme ───────────────────────────────────────────────────
  const placeSymbol = (type, cx, cy) => {
    const def = SYMBOLS[type];
    if (!def) return;
    const id = uid();
    const newElem = {
      id, type,
      x: SNAP(cx), y: SNAP(cy),
      label: `${def.label} ${elements.filter(e=>e.type===type).length + 1}`,
      props: { ...def.defaultProps },
    };
    setElements(prev => [...prev, newElem]);
    setSelected(id);
    setTool('select');
  };

  // ── Canvas mouse events ─────────────────────────────────────────────────
  const handleSvgMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Orta tık / Alt+tık → pan
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      e.preventDefault();
      return;
    }
    if (e.button === 0 && e.target === svgRef.current) {
      const { x, y } = svgPoint(e);
      // Sembol araç seçiliyse → yerleştir
      if (SYMBOLS[tool]) {
        placeSymbol(tool, x, y);
        return;
      }
      // Wire modunda boş alana tık → iptal
      if (tool === 'wire') { setWireStart(null); return; }
      // Select modunda boş alana tık → deselect
      setSelected(null);
    }
  };

  const handleSvgMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
      return;
    }

    const { x, y } = toCanvas(e.clientX - rect.left, e.clientY - rect.top);
    setMousePos({ x, y });
  };

  const handleSvgMouseUp = () => {
    isPanning.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1/1.15;
    const nz = Math.max(0.3, Math.min(3, zoom * factor));
    setPan(prev => ({
      x: mx - (mx - prev.x) * (nz / zoom),
      y: my - (my - prev.y) * (nz / zoom),
    }));
    setZoom(nz);
  };

  // ── Element events ────────────────────────────────────────────────────────
  const handleElemMouseDown = (e, id) => {
    e.stopPropagation();
    if (tool === 'delete') {
      setElements(prev => prev.filter(el => el.id !== id));
      setWires(prev => prev.filter(w => w.from.elemId !== id && w.to.elemId !== id));
      setSelected(null);
      return;
    }
    if (tool !== 'select') return;
    setSelected(id);
    const elem = elements.find(el => el.id === id);
    const { x, y } = svgPoint(e);
    isDragging.current = true;
    dragOffset.current = { x: x - elem.x, y: y - elem.y };
  };

  const handleElemMouseMove = (e) => {
    if (!isDragging.current || tool !== 'select') return;
    if (!selected) return;
    const { x, y } = svgPoint(e);
    setElements(prev => prev.map(el =>
      el.id === selected
        ? { ...el, x: SNAP(x - dragOffset.current.x), y: SNAP(y - dragOffset.current.y) }
        : el
    ));
  };

  const handleElemMouseUp = () => {
    isDragging.current = false;
  };

  // ── Port tıklama ──────────────────────────────────────────────────────────
  const handlePortClick = (e, elemId, portId) => {
    e.stopPropagation();
    if (tool !== 'wire') return;

    const elem = elements.find(el => el.id === elemId);
    const pos  = getPortPos(elem, portId);

    if (!wireStart) {
      setWireStart({ elemId, portId, x: pos.x, y: pos.y });
    } else {
      if (wireStart.elemId === elemId && wireStart.portId === portId) {
        setWireStart(null);
        return;
      }
      // Wire oluştur
      const newWire = {
        id: uid(),
        from: { elemId: wireStart.elemId, portId: wireStart.portId },
        to:   { elemId, portId },
        label: '', type: 'og',
        props: { kesit: '3×1×240 mm² Al', uzunluk: '—' }
      };
      setWires(prev => [...prev, newWire]);
      setWireStart(null);
    }
  };

  // ── Label düzenleme ───────────────────────────────────────────────────────
  const startEditLabel = (e, id) => {
    e.stopPropagation();
    const elem = elements.find(el => el.id === id);
    setEditingLabel(id);
    setLabelValue(elem.label);
  };

  const commitLabel = () => {
    if (!editingLabel) return;
    setElements(prev => prev.map(el =>
      el.id === editingLabel ? { ...el, label: labelValue } : el
    ));
    setEditingLabel(null);
  };

  // ── Seçili eleman ────────────────────────────────────────────────────────
  const selectedElem = elements.find(el => el.id === selected);

  // ── PNG Export ───────────────────────────────────────────────────────────
  const exportPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = svg.clientWidth  * 2;
      canvas.height = svg.clientHeight * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'ENH_TekHat.png';
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // ── SVG Export ───────────────────────────────────────────────────────────
  const exportSVG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'ENH_TekHat.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const cursorStyle = {
    select: 'default',
    wire:   'crosshair',
    delete: 'not-allowed',
    ...Object.fromEntries(Object.keys(SYMBOLS).map(k => [k, 'cell'])),
  }[tool] || 'default';

  return (
    <div className="flex h-screen bg-slate-900 font-sans overflow-hidden select-none" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Sol Araç Çubuğu ── */}
      <div className="w-52 bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden">
        {/* Logo / Başlık */}
        <div className="px-3 py-3 border-b border-slate-800">
          <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">⚡ ENH Editörü</div>
          <div className="text-[9px] text-slate-500 mt-0.5">OG Tek Hat Şeması</div>
        </div>

        {/* Araçlar */}
        <div className="px-2 py-2 border-b border-slate-800">
          <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1.5 px-1">Araçlar</div>
          <div className="flex gap-1">
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => { setTool(t.id); setWireStart(null); }}
                title={`${t.label} (${t.id[0]})`}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                  tool === t.id
                    ? 'bg-slate-700 text-white ring-1 ring-cyan-400'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
                style={{ color: tool === t.id ? t.color : undefined }}>
                <div className="text-base leading-none">{t.icon}</div>
                <div className="text-[8px] mt-0.5">{t.label}</div>
              </button>
            ))}
          </div>
          <div className="text-[8px] text-slate-600 mt-1.5 px-1">
            S=Seç · W=Kablo · Del=Sil · Esc=İptal
          </div>
        </div>

        {/* Semboller */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {GROUPS.map(group => {
            const syms = Object.entries(SYMBOLS).filter(([,s]) => s.group === group);
            if (!syms.length) return null;
            return (
              <div key={group}>
                <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1 px-1">{group}</div>
                <div className="space-y-0.5">
                  {syms.map(([type, sym]) => (
                    <button key={type}
                      onClick={() => { setTool(type); setWireStart(null); }}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all ${
                        tool === type
                          ? 'bg-slate-700 ring-1 ring-cyan-400'
                          : 'hover:bg-slate-800'
                      }`}>
                      {/* Mini sembol önizleme */}
                      <svg width="28" height="28" viewBox="-14 -14 28 28"
                        style={{ color: sym.color, flexShrink: 0 }}>
                        <sym.render />
                      </svg>
                      <div>
                        <div className={`text-[10px] font-bold ${tool===type?'text-cyan-300':'text-slate-300'}`}>
                          {sym.label}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Export */}
        <div className="px-2 py-2 border-t border-slate-800 space-y-1">
          <button onClick={exportPNG}
            className="w-full py-2 bg-cyan-900 hover:bg-cyan-800 text-cyan-300 rounded-lg text-[10px] font-bold transition-colors">
            ↓ PNG Export
          </button>
          <button onClick={exportSVG}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[10px] font-bold transition-colors">
            ↓ SVG Export
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Üst bar */}
        <div className="h-9 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-slate-500">
              Zoom: <span className="text-cyan-400 font-mono">{(zoom*100).toFixed(0)}%</span>
            </span>
            <span className="text-[9px] text-slate-500">
              Sembol: <span className="text-slate-300 font-mono">{elements.length}</span>
            </span>
            <span className="text-[9px] text-slate-500">
              Bağlantı: <span className="text-slate-300 font-mono">{wires.length}</span>
            </span>
            {wireStart && (
              <span className="text-[9px] text-yellow-400 font-bold animate-pulse">
                ⌇ Bağlantı noktasına tıkla...
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-[9px] text-slate-600">Fare tekerleği = zoom · Alt+sürükle = pan</span>
            <button onClick={() => { setPan({ x: 100, y: 100 }); setZoom(1); }}
              className="text-[9px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors">
              ⊞ Reset
            </button>
            <button onClick={() => { setElements([]); setWires([]); setSelected(null); }}
              className="text-[9px] text-red-500 hover:text-red-400 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors">
              ✕ Temizle
            </button>
          </div>
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          className="flex-1 w-full"
          style={{ cursor: cursorStyle, background: '#0f172a' }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={(e) => { handleSvgMouseMove(e); handleElemMouseMove(e); }}
          onMouseUp={() => { handleSvgMouseUp(); handleElemMouseUp(); }}
          onWheel={handleWheel}
        >
          {/* Grid */}
          <defs>
            <pattern id="smallGrid" width={GRID*zoom} height={GRID*zoom} patternUnits="userSpaceOnUse"
              x={pan.x % (GRID*zoom)} y={pan.y % (GRID*zoom)}>
              <path d={`M ${GRID*zoom} 0 L 0 0 0 ${GRID*zoom}`}
                fill="none" stroke="#1e293b" strokeWidth="0.5"/>
            </pattern>
            <pattern id="grid" width={GRID*4*zoom} height={GRID*4*zoom} patternUnits="userSpaceOnUse"
              x={pan.x % (GRID*4*zoom)} y={pan.y % (GRID*4*zoom)}>
              <rect width={GRID*4*zoom} height={GRID*4*zoom} fill="url(#smallGrid)"/>
              <path d={`M ${GRID*4*zoom} 0 L 0 0 0 ${GRID*4*zoom}`}
                fill="none" stroke="#293548" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>

          {/* Ana transform grubu */}
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

            {/* Kablolar */}
            {wires.map(wire => {
              const fe = elements.find(e => e.id === wire.from.elemId);
              const te = elements.find(e => e.id === wire.to.elemId);
              if (!fe || !te) return null;
              const fp = getPortPos(fe, wire.from.portId);
              const tp = getPortPos(te, wire.to.portId);
              const isSel = selected === wire.id;
              return (
                <g key={wire.id} onClick={() => setSelected(wire.id)} style={{ cursor: 'pointer' }}>
                  {/* Hit area */}
                  <path d={wirePoints(fp.x,fp.y,tp.x,tp.y)}
                    fill="none" stroke="transparent" strokeWidth="12"/>
                  {/* Görünür hat */}
                  <path d={wirePoints(fp.x,fp.y,tp.x,tp.y)}
                    fill="none"
                    stroke={isSel ? '#fbbf24' : '#38bdf8'}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    strokeDasharray={wire.type==='havai' ? '8,4' : undefined}/>
                  {/* Label */}
                  {wire.label && (
                    <text
                      x={(fp.x+tp.x)/2} y={(fp.y+tp.y)/2 - 6}
                      textAnchor="middle" fontSize="9" fill="#64748b"
                      fontFamily="JetBrains Mono, monospace">
                      {wire.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Geçici wire çizgisi */}
            {wireStart && (
              <path
                d={wirePoints(wireStart.x, wireStart.y, mousePos.x, mousePos.y)}
                fill="none" stroke="#fbbf24" strokeWidth="1.5"
                strokeDasharray="6,3" pointerEvents="none"/>
            )}

            {/* Elemanlar */}
            {elements.map(elem => {
              const def = SYMBOLS[elem.type];
              if (!def) return null;
              const isSel = selected === elem.id;
              const color = isSel ? '#fbbf24' : def.color;
              const isEditing = editingLabel === elem.id;

              return (
                <g key={elem.id}
                  transform={`translate(${elem.x},${elem.y})`}
                  style={{ cursor: tool==='delete'?'not-allowed': tool==='select'?'move':'default' }}
                  onMouseDown={e => handleElemMouseDown(e, elem.id)}
                  onDoubleClick={e => startEditLabel(e, elem.id)}>

                  {/* Seçim highlight */}
                  {isSel && (
                    <rect
                      x={-def.w/2 - 10} y={-def.h/2 - 10}
                      width={def.w + 20} height={def.h + 20}
                      fill="none" rx="8"
                      stroke="#fbbf24" strokeWidth="1.5"
                      strokeDasharray="6,3" opacity="0.7"/>
                  )}

                  {/* Sembol render */}
                  <g style={{ color }}>
                    <def.render props={elem.props} label={elem.label} />
                  </g>

                  {/* Portlar */}
                  {def.ports.map(port => {
                    const isWireStart = wireStart?.elemId === elem.id && wireStart?.portId === port.id;
                    return (
                      <circle key={port.id}
                        cx={port.dx} cy={port.dy} r={PORT_R}
                        fill={isWireStart ? '#fbbf24' : '#0f172a'}
                        stroke={isWireStart ? '#fbbf24' : (tool==='wire' ? '#38bdf8' : color)}
                        strokeWidth="2"
                        style={{ cursor: tool==='wire' ? 'crosshair' : 'default', opacity: tool==='wire' ? 1 : 0.5 }}
                        onClick={e => handlePortClick(e, elem.id, port.id)}
                        onMouseEnter={e => {
                          e.target.setAttribute('r', PORT_R + 3);
                          e.target.setAttribute('opacity', '1');
                        }}
                        onMouseLeave={e => {
                          e.target.setAttribute('r', PORT_R);
                          e.target.setAttribute('opacity', tool==='wire'?'1':'0.5');
                        }}
                      />
                    );
                  })}

                  {/* Label */}
                  {!isEditing && (
                    <text
                      x="0" y={def.h/2 + 18}
                      textAnchor="middle" fontSize="9"
                      fill={isSel ? '#fbbf24' : '#94a3b8'}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={isSel ? '700' : '400'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {elem.label}
                    </text>
                  )}
                </g>
              );
            })}

          </g>

          {/* Koordinat göstergesi */}
          <text x="10" y="20" fontSize="9" fill="#334155" fontFamily="monospace">
            {SNAP(mousePos.x)}, {SNAP(mousePos.y)}
          </text>
        </svg>

        {/* Label düzenleme input (SVG dışında) */}
        {editingLabel && (() => {
          const elem = elements.find(e => e.id === editingLabel);
          if (!elem) return null;
          const def = SYMBOLS[elem.type];
          const sx = elem.x * zoom + pan.x;
          const sy = (elem.y + def.h/2 + 14) * zoom + pan.y;
          return (
            <div className="absolute z-50" style={{ left: sx - 60, top: sy - 2 }}>
              <input
                autoFocus value={labelValue}
                onChange={e => setLabelValue(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={e => { if (e.key==='Enter') commitLabel(); if (e.key==='Escape') setEditingLabel(null); }}
                className="w-32 px-2 py-1 bg-slate-800 border border-cyan-400 text-cyan-300 text-xs font-mono rounded outline-none text-center"
              />
            </div>
          );
        })()}
      </div>

      {/* ── Sağ Properties Panel ── */}
      <div className="w-56 bg-slate-950 border-l border-slate-800 flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-slate-800">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {selectedElem ? 'Özellikler' : 'Seçim Yok'}
          </div>
        </div>

        {selectedElem ? (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {/* Tür */}
            <div>
              <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Tür</div>
              <div className="text-xs font-bold px-2 py-1.5 rounded-lg"
                style={{ background: `${SYMBOLS[selectedElem.type]?.color}15`, color: SYMBOLS[selectedElem.type]?.color }}>
                {SYMBOLS[selectedElem.type]?.label}
              </div>
            </div>

            {/* Etiket */}
            <div>
              <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Etiket</div>
              <input
                value={selectedElem.label}
                onChange={e => setElements(prev => prev.map(el =>
                  el.id === selectedElem.id ? { ...el, label: e.target.value } : el
                ))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded-lg outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Koordinat */}
            <div>
              <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Pozisyon</div>
              <div className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-1.5 rounded-lg">
                X: {selectedElem.x} · Y: {selectedElem.y}
              </div>
            </div>

            {/* Props */}
            {selectedElem.props && Object.entries(selectedElem.props).length > 0 && (
              <div>
                <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-2">Parametreler</div>
                <div className="space-y-1.5">
                  {Object.entries(selectedElem.props).map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[8px] text-slate-600 capitalize mb-0.5">{k}</div>
                      <input
                        value={v}
                        onChange={e => setElements(prev => prev.map(el =>
                          el.id === selectedElem.id
                            ? { ...el, props: { ...el.props, [k]: e.target.value } }
                            : el
                        ))}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sil butonu */}
            <button
              onClick={() => {
                setElements(prev => prev.filter(el => el.id !== selectedElem.id));
                setWires(prev => prev.filter(w => w.from.elemId !== selectedElem.id && w.to.elemId !== selectedElem.id));
                setSelected(null);
              }}
              className="w-full py-2 bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-300 rounded-lg text-[10px] font-bold transition-colors mt-2">
              ✕ Sil
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="text-3xl mb-2 opacity-20">⚡</div>
              <div className="text-[9px] text-slate-600 leading-relaxed">
                Sol panelden sembol seç ve canvas'a tıkla.<br/><br/>
                Bağlantı için W tuşu veya Kablo aracını kullan.
              </div>
            </div>
          </div>
        )}

        {/* Bağlantı özellikleri */}
        {selected && wires.find(w => w.id === selected) && (() => {
          const wire = wires.find(w => w.id === selected);
          return (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              <div>
                <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Etiket</div>
                <input value={wire.label}
                  onChange={e => setWires(prev => prev.map(w => w.id===wire.id ? {...w,label:e.target.value} : w))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded-lg outline-none focus:border-cyan-500 font-mono"
                  placeholder="Hat adı"/>
              </div>
              <div>
                <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Hat Tipi</div>
                <div className="flex gap-1">
                  {[['og','Kablo'],['havai','Havai']].map(([t,l]) => (
                    <button key={t} onClick={() => setWires(prev => prev.map(w => w.id===wire.id?{...w,type:t}:w))}
                      className={`flex-1 py-1 rounded text-[9px] font-bold transition-colors ${wire.type===t?'bg-cyan-900 text-cyan-300':'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {Object.entries(wire.props||{}).map(([k,v]) => (
                <div key={k}>
                  <div className="text-[8px] text-slate-600 capitalize mb-0.5">{k}</div>
                  <input value={v}
                    onChange={e => setWires(prev => prev.map(w => w.id===wire.id?{...w,props:{...w.props,[k]:e.target.value}}:w))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded outline-none focus:border-cyan-500 font-mono"/>
                </div>
              ))}
              <button onClick={() => { setWires(prev => prev.filter(w => w.id !== wire.id)); setSelected(null); }}
                className="w-full py-1.5 bg-red-950 hover:bg-red-900 text-red-400 rounded text-[9px] font-bold transition-colors">
                ✕ Bağlantıyı Sil
              </button>
            </div>
          );
        })()}

        {/* Keşif özeti */}
        <div className="border-t border-slate-800 px-3 py-3">
          <div className="text-[8px] text-slate-600 uppercase tracking-widest mb-2">Keşif Özeti</div>
          <div className="space-y-0.5">
            {Object.entries(SYMBOLS).map(([type]) => {
              const count = elements.filter(e => e.type === type).length;
              if (!count) return null;
              return (
                <div key={type} className="flex justify-between">
                  <span className="text-[9px] text-slate-500 truncate">{SYMBOLS[type].label}</span>
                  <span className="text-[9px] font-mono font-bold"
                    style={{ color: SYMBOLS[type].color }}>{count}</span>
                </div>
              );
            })}
            {wires.length > 0 && (
              <div className="flex justify-between">
                <span className="text-[9px] text-slate-500">Hat Bağlantısı</span>
                <span className="text-[9px] font-mono font-bold text-cyan-400">{wires.length}</span>
              </div>
            )}
            {elements.length === 0 && (
              <div className="text-[9px] text-slate-700 italic">Henüz sembol eklenmedi</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
