/**
 * GridMaster Export Utility
 * Excel: SheetJS (CDN'den değil, npm'den — vite bundle eder)
 * PDF:   window.print() + özel CSS (bağımlılık yok)
 */

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────
// xlsx paketini lazy import et (bundle split için)
async function getXLSX() {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs');
  return XLSX;
}

/**
 * Genel Excel export fonksiyonu
 * @param {Array<{name: string, headers: string[], rows: any[][]}>} sheets
 * @param {string} filename
 */
export async function exportToExcel(sheets, filename = 'GridMaster_Rapor') {
  try {
    const XLSX = await getXLSX();
    const wb = XLSX.utils.book_new();

    sheets.forEach(({ name, headers, rows }) => {
      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Sütun genişlikleri
      ws['!cols'] = headers.map(() => ({ wch: 20 }));

      // Header stili (basit)
      headers.forEach((_, i) => {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
        if (cell) {
          cell.s = { font: { bold: true }, fill: { fgColor: { rgb: '1E3A5F' } } };
        }
      });

      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });

    XLSX.writeFile(wb, `${filename}.xlsx`);
    return true;
  } catch (err) {
    console.error('Excel export hatası:', err);
    return false;
  }
}

// ─── PDF EXPORT (Print-based) ──────────────────────────────────────────────────
/**
 * Belirli bir element ID'sini yazdırmak için print penceresi açar
 * @param {string} title - Rapor başlığı
 * @param {string} htmlContent - Yazdırılacak HTML içeriği
 */
export function exportToPDF(title, htmlContent) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  printWindow.document.write(`
    <!DOCTYPE html><html lang="tr"><head>
    <meta charset="UTF-8"><title>${title} — GridMaster</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1e293b;background:white;padding:20px}
      h1{font-size:18px;font-weight:900;color:#1e3a5f;border-bottom:3px solid #1e3a5f;padding-bottom:8px;margin-bottom:16px}
      h2{font-size:13px;font-weight:700;color:#334155;margin:16px 0 8px;background:#f1f5f9;padding:6px 10px;border-left:4px solid #3b82f6}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px}
      th{background:#1e3a5f;color:white;padding:6px 8px;text-align:left;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.5px}
      td{padding:5px 8px;border-bottom:1px solid #e2e8f0}
      tr:nth-child(even) td{background:#f8fafc}
      .meta{font-size:10px;color:#64748b;margin-bottom:12px}
      .mono{font-family:monospace}
      .footer{margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8}
      @media print{body{padding:10px}@page{margin:15mm;size:A4 landscape}}
    </style></head><body>
    ${htmlContent}
    <div class="footer">GridMaster — Elektrik Mühendisliği Hesap Platformu | ${new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'})}</div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>
  `);
  printWindow.document.close();
}

export function exportOgShortCircuitPDF(sourceName, sourceParams, lines, result, cables) {
  const fmt = (n, d=3) => (typeof n==='number' && !isNaN(n)) ? n.toFixed(d) : '—';
  const now  = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });

  const Zb   = result.Zb   || 11.9025;
  const Ib   = result.Ib   || 1673.5;
  const kappa = result.kappa || 1.02;

  // ─── BUS TABLOSU — düğüm isimleri ───
  const busRows = [
    { id: '154 kV Şebeke',  type: 'Güç Şebekesi', kv: '154.000', base: '154.000' },
    { id: '34.5 kV Barası', type: 'Bara (Swing)',  kv: '34.500',  base: '34.500'  },
    ...lines.map((l, i) => ({
      id: l.name ? l.name : `Hat ${i+1} Sonu`,
      type: 'Yük Barası', kv: '34.500', base: '34.500'
    })),
  ];

  const busTableRows = busRows.map((b, i) => `
    <tr>
      <td>${b.id}</td>
      <td>${b.type}</td>
      <td class="mono">${b.kv}</td>
      <td class="mono">${b.base}</td>
      <td>${i===0?'1':i===1?'1':'1'}</td>
    </tr>`).join('');

  // ─── HAT/KABLO TABLOSU ───
  const cableTableRows = (result.lineDetails || []).map((d, i) => `
    <tr>
      <td><b>${lines[i]?.name || `Hat ${d.idx}`}</b></td>
      <td>${d.cableName}</td>
      <td class="mono">${d.length}</td>
      <td class="mono">${d.circuitCount}</td>
      <td class="mono">${fmt(d.R_seg_ohm/d.length*1000,4)}</td>
      <td class="mono">${fmt(d.X_seg_ohm/d.length*1000,4)}</td>
      <td class="mono">${fmt(d.Z_seg_ohm/d.length*1000,4)}</td>
    </tr>`).join('');

  // ─── DAL BAĞLANTILARI ───
  const branchRows = [
    sourceParams.type === 'power'
      ? `<tr>
          <td><b>AG Trafosu</b></td>
          <td>2-Sargılı Trafo</td>
          <td>154 kV Şebeke</td>
          <td>34.5 kV Barası</td>
          <td class="mono">${fmt(result.Z_grid_pu * 100,4)}</td>
          <td class="mono">—</td>
          <td class="mono">${fmt(result.Z_grid_pu * 100,4)}</td>
        </tr>
        <tr>
          <td><b>OG Dağıtım Trafosu</b></td>
          <td>2-Sargılı Trafo</td>
          <td>Şebeke Barası</td>
          <td>34.5 kV Barası</td>
          <td class="mono">—</td>
          <td class="mono">${fmt(result.Z_trafo_pu * 100,4)}</td>
          <td class="mono">${fmt(result.Z_trafo_pu * 100,4)}</td>
        </tr>`
      : `<tr>
          <td><b>Şebeke Eşdeğeri</b></td>
          <td>Güç Şebekesi</td>
          <td>154 kV Şebeke</td>
          <td>34.5 kV Barası</td>
          <td class="mono">—</td>
          <td class="mono">${fmt(result.zBaraPu * 100,4)}</td>
          <td class="mono">${fmt(result.zBaraPu * 100,4)}</td>
        </tr>`,
    ...(result.lineDetails || []).map(d => `
      <tr>
        <td><b>${d.cableName}</b> (Hat ${d.idx})</td>
        <td>Kablo</td>
        <td>${d.fromBus}</td>
        <td>${d.toBus}</td>
        <td class="mono">${fmt(d.R_seg_ohm/Zb*100,4)}</td>
        <td class="mono">${fmt(d.X_seg_ohm/Zb*100,4)}</td>
        <td class="mono">${fmt(d.Z_seg_ohm/Zb*100,4)}</td>
      </tr>`)
  ].join('');

  // ─── KISA DEVRE ÖZET ───
  const Ib_kA = Ib / 1000;
  const summaryRows = [
    { id: '34.5 kV Barası', kv:'34.500',
      ik3: result.busbarCurrent, ip3: result.ip_bara,
      ik1: result.Ik1_bara || 0, ip1: result.ip1_bara || 0,
      Z_ohm: result.Z1_bara_ohm },
    ...(result.lineDetails||[]).map((d,i) => {
      const Ztot_pu  = result.zBaraPu + (result.lineDetails.slice(0,i+1).reduce((a,x)=>a+x.Z_seg_ohm/Zb,0));
      const ik3      = result.c*Ib/(Ztot_pu*1000);
      const Z0tot_pu = (result.Z0_kaynak_pu||0) + (result.lineDetails.slice(0,i+1).reduce((a,x)=>a+(x.Z_seg_ohm*(x.z0Ratio||3.5))/Zb,0));
      const ik1      = (Ztot_pu > 0 && Z0tot_pu > 0)
        ? (result.c * 3 * Ib / ((2*Ztot_pu + Z0tot_pu) * 1000)) : 0;
      // Düğüm ismi: hat ismi varsa kullan, yoksa "Hat N Sonu"
      const nodeId = d.name ? d.name : `Hat ${d.idx} Sonu`;
      return { id: nodeId, kv:'34.500', ik3, ip3: kappa*Math.sqrt(2)*ik3,
               ik1, ip1: kappa*Math.sqrt(2)*ik1, Z_ohm: Ztot_pu*Zb };
    }),
  ];

  const summaryTableRows = summaryRows.map(r => `
    <tr>
      <td><b>${r.id}</b></td>
      <td class="mono">34.500</td>
      <td class="mono" style="color:#1e40af;font-weight:700">${fmt(r.ik3,3)}</td>
      <td class="mono">${fmt(r.ip3,3)}</td>
      <td class="mono" style="color:#c2410c;font-weight:700">${r.ik1>0?fmt(r.ik1,3):'—'}</td>
      <td class="mono">${r.ip1>0?fmt(r.ip1,3):'—'}</td>
      <td class="mono">${fmt(r.Z_ohm/1.732,4)}</td>
      <td class="mono">${fmt(r.Z_ohm,4)}</td>
    </tr>`).join('');

  // ─── SIRA EMPEDANSLARI ───
  const seqRows = summaryRows.map(r => `
    <tr>
      <td><b>${r.id}</b></td>
      <td class="mono">34.500</td>
      <td class="mono">${fmt(r.Z_ohm*0.1,5)}</td>
      <td class="mono">${fmt(r.Z_ohm*0.99,5)}</td>
      <td class="mono">${fmt(r.Z_ohm,5)}</td>
      <td class="mono">${fmt(r.Z_ohm*0.1,5)}</td>
      <td class="mono">${fmt(r.Z_ohm*0.99,5)}</td>
      <td class="mono">${fmt(r.Z_ohm,5)}</td>
    </tr>`).join('');

  // ─── HAT DETAY HESAP TABLOSU ───
  let cumZpu = result.zBaraPu;
  const detailRows = (result.lineDetails||[]).map(d => {
    cumZpu += d.Z_seg_ohm / Zb;
    const ik_end = result.c * Ib / (cumZpu * 1000);
    const ip_end = kappa * Math.sqrt(2) * ik_end;
    return `
    <tr>
      <td><b>${d.name ? `${d.name}` : ''}</b>${d.name ? `<br><span style="color:#94a3b8;font-weight:400;font-size:8px">Hat ${d.idx}</span>` : `Hat ${d.idx}`}</td>
      <td>${d.cableName}</td>
      <td class="mono">${d.length} km</td>
      <td class="mono">${d.circuitCount}×</td>
      <td class="mono">${fmt(d.Z_seg_ohm,4)}</td>
      <td class="mono">${fmt(d.R_seg_ohm,4)}</td>
      <td class="mono">${fmt(d.X_seg_ohm,4)}</td>
      <td class="mono">${fmt(cumZpu,6)}</td>
      <td class="mono" style="color:#7c3aed;font-weight:700">${fmt(ik_end,3)}</td>
      <td class="mono">${fmt(ip_end,3)}</td>
    </tr>`;
  }).join('');

  // ─── ŞEMA SVG — A4'e sığacak kompakt versiyon ────────────────────
  const PER_COL = 4;
  const numCols = Math.max(1, Math.ceil(lines.length / PER_COL));
  const perCol  = Math.ceil(lines.length / numCols);
  const SCH_W   = 700, COL_W = Math.min(130, (SCH_W-40)/numCols);
  const ROW_H   = 68,  TOP   = 140;
  const SCH_H   = Math.min(430, TOP + perCol * ROW_H + 30);
  const BARA_X  = 40 + COL_W / 2;

  const schPos = lines.map((_, i) => {
    const col = Math.floor(i / perCol);
    const rowInCol = i % perCol;
    const row = col % 2 === 0 ? rowInCol : (perCol - 1 - rowInCol);
    return { col, row, cx: 40 + col*COL_W + COL_W/2, cy: TOP + row*ROW_H + 30 };
  });

  const Zb2 = 11.9025, Ib2 = 1673.5;
  let cumZ2 = result.zBaraPu||0, cumZ02 = result.Z0_kaynak_pu||0;
  const schIk = lines.map((_, i) => {
    const d = result.lineDetails?.[i];
    if (!d) return {ik3:0, ik1:0};
    cumZ2  += (d.Z_seg_ohm||0)/Zb2;
    cumZ02 += ((d.Z_seg_ohm*(d.z0Ratio||3.5))||0)/Zb2;
    const ik3 = cumZ2>0  ? (1.10*Ib2/cumZ2/1000)  : 0;
    const ik1 = (cumZ2>0&&cumZ02>0) ? (1.10*3*Ib2/((2*cumZ2+cumZ02)*1000)) : 0;
    return { ik3, ik1 };
  });

  const schemaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SCH_W}" height="${SCH_H}"
    viewBox="0 0 ${SCH_W} ${SCH_H}" style="background:white;border:1px solid #e2e8f0;border-radius:4px;max-width:100%">
  <circle cx="${BARA_X}" cy="22" r="12" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>
  <text x="${BARA_X}" y="19" text-anchor="middle" font-size="6" font-weight="bold" fill="#7c3aed">154kV</text>
  <text x="${BARA_X+16}" y="18" font-size="8" font-weight="bold" fill="#1e293b">${sourceName}</text>
  <line x1="${BARA_X}" y1="34" x2="${BARA_X}" y2="64" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,2"/>
  <rect x="${BARA_X-18}" y="64" width="36" height="24" rx="3" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.2"/>
  <text x="${BARA_X}" y="74" text-anchor="middle" font-size="6" font-weight="bold" fill="#5b21b6">34.5kV</text>
  <text x="${BARA_X}" y="83" text-anchor="middle" font-size="6" fill="#5b21b6">TRAFO</text>
  <line x1="${BARA_X}" y1="88" x2="${BARA_X}" y2="110" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,2"/>
  <line x1="20" y1="113" x2="${SCH_W-20}" y2="113" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
  <text x="${BARA_X}" y="106" text-anchor="middle" font-size="7" font-weight="bold" fill="#1e293b">34.5 kV Barası</text>
  <text x="${BARA_X}" y="127" text-anchor="middle" font-size="7" font-weight="bold" fill="#6d28d9">
    I₃k=${result.busbarCurrent.toFixed(2)}kA${result.Ik1_bara>0?' | I₁k='+result.Ik1_bara.toFixed(2)+'kA':''}
  </text>
  ${lines.map((line, i) => {
    const p = schPos[i], d = result.lineDetails?.[i];
    const cab = cables.find(c=>c.id===line.cableTypeId);
    const n = line.circuitCount||1;
    const {ik3,ik1} = schIk[i]||{};
    const prevP = i>0 ? schPos[i-1] : null;
    const sameCol = i>0 && prevP.col===p.col;
    const colChg  = i>0 && prevP.col!==p.col;
    const lbl = line.name || `Hat ${i+1}`;
    const nameRight = p.col%2===0;
    return `
    ${i===0?`<line x1="${BARA_X}" y1="113" x2="${BARA_X}" y2="${p.cy}" stroke="#334155" stroke-width="1.5"/>`:''}
    ${sameCol?`<line x1="${prevP.cx}" y1="${prevP.cy}" x2="${p.cx}" y2="${p.cy}" stroke="#334155" stroke-width="1.5" ${n>1?'stroke-dasharray="5,2"':''}/>`:``}
    ${colChg?`<path d="M ${prevP.cx} ${prevP.cy} L ${prevP.cx} ${p.cy} L ${p.cx} ${p.cy}" fill="none" stroke="#334155" stroke-width="1.5" stroke-linejoin="round"/>`:``}
    <rect x="${p.cx-28}" y="${((i===0?113:prevP.cy)+p.cy)/2-10}" width="56" height="20" rx="3" fill="white"/>
    <rect x="${p.cx-28}" y="${((i===0?113:prevP.cy)+p.cy)/2-10}" width="56" height="20" rx="3" fill="#e0f2fe" stroke="#0284c7" stroke-width="0.8"/>
    <text x="${p.cx}" y="${((i===0?113:prevP.cy)+p.cy)/2-2}" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#0369a1">${cab?.name||'?'}</text>
    <text x="${p.cx}" y="${((i===0?113:prevP.cy)+p.cy)/2+8}" text-anchor="middle" font-size="5.5" fill="#0369a1">${d?.length?.toFixed(3)||line.length}km${n>1?' ×'+n:''}</text>
    <circle cx="${p.cx}" cy="${p.cy}" r="5" fill="white" stroke="#334155" stroke-width="1.5"/>
    <circle cx="${p.cx}" cy="${p.cy}" r="3.5" fill="#334155"/>
    ${nameRight
      ? `<text x="${p.cx+8}" y="${p.cy+4}" font-size="7" font-weight="bold" fill="#1e293b">${lbl}</text>`
      : `<text x="${p.cx-8}" y="${p.cy+4}" text-anchor="end" font-size="7" font-weight="bold" fill="#1e293b">${lbl}</text>`}
    ${ik3>0?`<text x="${nameRight?p.cx+8:p.cx-8}" y="${p.cy+14}" ${nameRight?'':'text-anchor="end"'} font-size="6" fill="#7c3aed" font-weight="bold">I₃k=${ik3.toFixed(2)}kA</text>`:''}
    ${ik1>0?`<text x="${nameRight?p.cx+8:p.cx-8}" y="${p.cy+23}" ${nameRight?'':'text-anchor="end"'} font-size="5.5" fill="#ea580c">I₁k=${ik1.toFixed(2)}kA</text>`:''}`;
  }).join('')}
  </svg>`;
  const html = `
    <div style="page-break-inside:avoid;break-inside:avoid"><!-- KAPAK BAŞLIĞI -->
    <table style="margin-bottom:0;font-size:11px">
      <tr>
        <td style="width:60%;vertical-align:top;padding:0">
          <div style="background:#1e3a5f;color:white;padding:10px 14px;border-radius:6px 6px 0 0">
            <div style="font-size:16px;font-weight:900;letter-spacing:.5px">GridMaster</div>
            <div style="font-size:10px;opacity:.8;margin-top:2px">Elektrik Mühendisliği Hesap Platformu</div>
          </div>
          <div style="background:#f1f5f9;padding:8px 14px;border:1px solid #e2e8f0;border-top:none">
            <div style="font-size:14px;font-weight:900;color:#1e3a5f">OG KISA DEVRE ANALİZİ</div>
            <div style="font-size:10px;color:#475569;margin-top:2px">IEC 60909 Standardı — Üç-Faz &amp; Faz-Toprak Arıza</div>
          </div>
        </td>
        <td style="width:40%;vertical-align:top;padding:0;padding-left:10px">
          <table style="width:100%;border:1px solid #e2e8f0;font-size:10px;margin:0">
            <tr><td style="background:#f8fafc;font-weight:700;width:40%;padding:4px 8px">Standart</td><td style="padding:4px 8px;font-family:monospace">IEC 60909</td></tr>
            <tr><td style="background:#f8fafc;font-weight:700;padding:4px 8px">Tarih</td><td style="padding:4px 8px;font-family:monospace">${dateStr} ${timeStr}</td></tr>
            <tr><td style="background:#f8fafc;font-weight:700;padding:4px 8px">Kaynak</td><td style="padding:4px 8px;font-weight:700;color:#1e3a5f">${sourceName}</td></tr>
            <tr><td style="background:#f8fafc;font-weight:700;padding:4px 8px">Sistem (Sb/Ub)</td><td style="padding:4px 8px;font-family:monospace">100 MVA / 34.5 kV</td></tr>
            <tr><td style="background:#f8fafc;font-weight:700;padding:4px 8px">c Faktörü</td><td style="padding:4px 8px;font-family:monospace">${result.c||1.10} (IEC 60909)</td></tr>
            <tr><td style="background:#f8fafc;font-weight:700;padding:4px 8px">κ (Yöntem C)</td><td style="padding:4px 8px;font-family:monospace">${kappa}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin:12px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">
      TEK HAT ŞEMASI
    </div>
    <div style="margin-bottom:10px;page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid">${schemaSvg}</div>
    </div><!-- end kapak wrapper -->

    <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">
      1.  BARA GİRİŞ VERİLERİ
    </div>
    <table>
      <thead><tr>
        <th>Bara ID</th><th>Tip</th><th>Nominal kV</th><th>Baz kV</th><th>Alt Sys.</th>
      </tr></thead>
      <tbody>${busTableRows}</tbody>
    </table>

    <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">
      2.  HAT / KABLO GİRİŞ VERİLERİ
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Kablo Tipi</th><th>Uzunluk (km)</th><th>Devre</th>
        <th>R (Ω/km)</th><th>X (Ω/km)</th><th>Z (Ω/km)</th>
      </tr></thead>
      <tbody>${cableTableRows}</tbody>
    </table>

    <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">
      3.  DAL BAĞLANTILARI VE EMPEDANSLAR
    </div>
    <div style="font-size:9px;color:#64748b;margin-bottom:4px">
      Baz: Sb = ${result.Sb||100} MVA &nbsp;|&nbsp; Ub = ${result.Ub||34.5} kV &nbsp;|&nbsp;
      Zb = ${fmt(Zb,4)} Ω &nbsp;|&nbsp; Ib = ${fmt(Ib,1)} A
    </div>
    <table>
      <thead><tr>
        <th>Eleman ID</th><th>Tip</th><th>Başlangıç Barası</th><th>Bitiş Barası</th>
        <th>R (%)</th><th>X (%)</th><th>Z (%)</th>
      </tr></thead>
      <tbody>${branchRows}</tbody>
    </table>

    <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">
      4.  HAT DETAY HESAP TABLOSU
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Kablo</th><th>L (km)</th><th>Devre</th>
        <th>ΔZ seg. (Ω)</th><th>ΔR seg. (Ω)</th><th>ΔX seg. (Ω)</th>
        <th>Z kümülâtif (pu)</th>
        <th style="background:#3b0764">I&quot;k hat sonu (kA)</th>
        <th>ip hat sonu (kA)</th>
      </tr></thead>
      <tbody>
        <tr style="background:#ede9fe">
          <td colspan="7" style="font-weight:700;color:#4c1d95">34.5 kV Barası (Kaynak)</td>
          <td class="mono" style="font-weight:700">${fmt(result.zBaraPu,6)}</td>
          <td class="mono" style="color:#1e40af;font-weight:700">${fmt(result.busbarCurrent,3)}</td>
          <td class="mono">${fmt(result.ip_bara,3)}</td>
        </tr>
        ${detailRows}
      </tbody>
    </table>

    <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">
      5.  KISA DEVRE ÖZET RAPORU
    </div>
    <div style="font-size:9px;color:#64748b;margin-bottom:4px">
      Tüm arıza akımları etkin değer (rms) kA cinsindendir. ip = κ × √2 × I&quot;k (Yöntem C, κ = ${kappa})
    </div>
    <table>
      <thead><tr>
        <th>Bara ID</th><th>kV</th>
        <th style="background:#1e40af">I"k3 — 3-Faz (kA)</th>
        <th>ip3 tepe (kA)</th>
        <th style="background:#c2410c">I"k1 — Faz-Toprak (kA)</th>
        <th>ip1 tepe (kA)</th>
        <th>Z+ (Ω)</th>
        <th>Z toplam (Ω)</th>
      </tr></thead>
      <tbody>${summaryTableRows}</tbody>
    </table>

    <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">
      6.  SIRA EMPEDANSI ÖZET RAPORU
    </div>
    <table>
      <thead><tr>
        <th>Bara ID</th><th>kV</th>
        <th>R+ (Ω)</th><th>X+ (Ω)</th><th>Z+ (Ω)</th>
        <th>R- (Ω)</th><th>X- (Ω)</th><th>Z- (Ω)</th>
      </tr></thead>
      <tbody>${seqRows}</tbody>
    </table>

    ${(result.Ik1_bara > 0) ? `
    <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#c2410c;border-bottom:2px solid #c2410c;padding-bottom:4px">
      7.  FAZ–TOPRAK KISA DEVRE (I&quot;k1) — IEC 60909
    </div>
    <div style="font-size:9px;color:#64748b;margin-bottom:6px">
      Trafo bağlantı: ${result.trafoTip||'Dyn'} &nbsp;|&nbsp; Z0/Z1 ≈ 3.5 &nbsp;|&nbsp;
      I&quot;k1 = c×3×Ib / (2×Z1+Z0) &nbsp;|&nbsp; κ = ${kappa}
    </div>
    <table>
      <thead><tr>
        <th>Bara / Düğüm</th><th>kV</th>
        <th style="background:#c2410c">I&quot;k1 (kA)</th>
        <th>ip1 tepe (kA)</th>
        <th>Z1 (Ω)</th><th>Z0 (Ω)</th>
      </tr></thead>
      <tbody>
        <tr>
          <td><b>34.5 kV Barası</b></td>
          <td class="mono">34.500</td>
          <td class="mono" style="color:#c2410c;font-weight:700">${fmt(result.Ik1_bara,3)}</td>
          <td class="mono">${fmt(result.ip1_bara,3)}</td>
          <td class="mono">${fmt(result.Z1_bara_ohm,4)}</td>
          <td class="mono">${fmt((result.Z0_bara_pu||0)*Zb,4)}</td>
        </tr>
        ${(() => {
          let cZ1=result.zBaraPu||0, cZ0=result.Z0_kaynak_pu||0;
          return (result.lineDetails||[]).map((d,i)=>{
            cZ1+=(d.Z_seg_ohm||0)/Zb;
            cZ0+=((d.Z_seg_ohm*(d.z0Ratio||3.5))||0)/Zb;
            const ik1=(cZ1>0&&cZ0>0)?fmt(result.c*3*Ib/((2*cZ1+cZ0)*1000),3):'—';
            const ip1=(cZ1>0&&cZ0>0)?fmt(kappa*Math.sqrt(2)*result.c*3*Ib/((2*cZ1+cZ0)*1000),3):'—';
            const nid = lines[i]?.name || `Hat ${d.idx} Sonu`;
            return `<tr>
              <td><b>${nid}</b></td>
              <td class="mono">34.500</td>
              <td class="mono" style="color:#c2410c;font-weight:700">${ik1}</td>
              <td class="mono">${ip1}</td>
              <td class="mono">${fmt(cZ1*Zb,4)}</td>
              <td class="mono">${fmt(cZ0*Zb,4)}</td>
            </tr>`;
          }).join('');
        })()}
      </tbody>
    </table>` : ''}

    <!-- SONUÇ KUTUSU -->
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr ${result.Ik1_bara>0?'1fr':''};gap:12px">
      <div style="background:#eff6ff;border:2px solid #3b82f6;border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#1e40af;margin-bottom:6px;text-transform:uppercase">34.5 kV Barası — Üç-Faz Kısa Devre</div>
        <div style="font-family:monospace">
          <div>I&quot;k3 = <b style="font-size:16px;color:#1e40af">${fmt(result.busbarCurrent,3)} kA</b></div>
          <div style="margin-top:4px">ip  = ${fmt(result.ip_bara,3)} kA &nbsp;(κ×√2×I&quot;k)</div>
          <div style="margin-top:2px">Z+  = ${fmt(result.Z1_bara_ohm,4)} Ω</div>
        </div>
      </div>
      <div style="background:#faf5ff;border:2px solid #a855f7;border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:6px;text-transform:uppercase">Hat Sonu — Üç-Faz Kısa Devre</div>
        <div style="font-family:monospace">
          <div>I&quot;k3 = <b style="font-size:16px;color:#7c3aed">${fmt(result.lineEndCurrent,3)} kA</b></div>
          <div style="margin-top:4px">ip  = ${fmt(result.ip_end,3)} kA</div>
          <div style="margin-top:2px">Z+  = ${fmt(result.Z1_end_ohm,4)} Ω</div>
        </div>
      </div>
      ${result.Ik1_bara>0?`
      <div style="background:#fff7ed;border:2px solid #ea580c;border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:6px;text-transform:uppercase">Faz–Toprak Kısa Devre (${result.trafoTip||'Dyn'})</div>
        <div style="font-family:monospace">
          <div>I&quot;k1 bara = <b style="font-size:14px;color:#c2410c">${fmt(result.Ik1_bara,3)} kA</b></div>
          <div style="margin-top:4px">I&quot;k1 hat sonu = <b style="color:#ea580c">${fmt(result.Ik1_end,3)} kA</b></div>
          <div style="margin-top:2px;font-size:9px;color:#9a3412">Z0/Z1≈3.5 · c=1.10 · Dyn</div>
        </div>
      </div>`:''}
    </div>
  `;

  const printWindow = window.open('', '_blank', 'width=1200,height=850');
  const wordSafeName = sourceName.replace(/\s+/g,'_');
  printWindow.document.write(`
    <!DOCTYPE html><html lang="tr"><head>
    <meta charset="UTF-8">
    <title>OG Kısa Devre Raporu — ${sourceName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;color:#1e293b;background:white;padding:14px}
      table{width:100%;border-collapse:collapse;margin-bottom:9px;font-size:9px}
      th{background:#1e3a5f;color:white;padding:4px 6px;text-align:left;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px}
      td{padding:3px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
      tr:nth-child(even) td{background:#f8fafc}
      .mono{font-family:'Consolas','Courier New',monospace}
      .toolbar{position:fixed;top:10px;right:10px;display:flex;gap:8px;z-index:9999}
      .btn{padding:7px 16px;border:none;border-radius:7px;font-weight:700;cursor:pointer;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.15)}
      .btn-pdf{background:#1e3a5f;color:white}
      .btn-word{background:#166534;color:white}
      .footer{margin-top:10px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between}
      @media print{
        .toolbar{display:none!important}
        body{padding:6px}
        @page{margin:7mm 8mm;size:A4 landscape}
        table{page-break-inside:auto}
        tr{page-break-inside:avoid}
        svg{max-width:100%!important;height:auto!important}
      }
    </style></head><body>
    <div class="toolbar">
      <button class="btn btn-pdf" onclick="window.print()">🖨 PDF Yazdır</button>
      <button class="btn btn-word" onclick="dlWord()">📄 Word İndir</button>
    </div>
    ${html}
    <div class="footer">
      <span>GridMaster — Elektrik Mühendisliği Hesap Platformu</span>
      <span>IEC 60909 | Sb=${result.Sb||100}MVA · Ub=${result.Ub||34.5}kV · c=${result.c||1.10} · κ=${kappa}</span>
      <span>${dateStr} ${timeStr}</span>
    </div>
    <script>
    window._wordReady = false;
    window.onload = function() { window._wordReady = true; };
    function dlWord(){
      var nodes = document.querySelectorAll("table, h1, h2, h3, p, div[style]");
      var wordCSS = "<style>body{font-family:Arial,sans-serif;font-size:10pt;color:#1e293b}"+
        "table{border-collapse:collapse;width:100%;margin-bottom:8pt}"+
        "th{background:#1e3a5f;color:white;padding:3pt 5pt;font-size:8pt;text-align:left;font-weight:bold}"+
        "td{padding:2pt 5pt;border-bottom:1px solid #ddd;font-size:9pt}"+
        "tr:nth-child(even) td{background:#f8fafc}"+
        ".mono{font-family:Courier New,monospace}"+
        "h1,h2,h3{color:#1e3a5f}"+
        "</style>";
      var bodyClone = document.body.cloneNode(true);
      // Remove toolbar
      var tb = bodyClone.querySelector(".toolbar");
      if(tb) tb.remove();
      // Remove SVG elements (schema)  
      var svgs = bodyClone.querySelectorAll("svg");
      svgs.forEach(function(s){
        var p = document.createElement("p");
        p.style.fontStyle = "italic";
        p.style.color = "#64748b";
        p.textContent = "[Tek Hat Semasi - PDF versiyonunda mevcuttur]";
        s.parentNode.replaceChild(p, s);
      });
      var wordHTML = "<!DOCTYPE html><html><head><meta charset='UTF-8'>" + 
        wordCSS + "</head><body>" + bodyClone.innerHTML + "</body></html>";
      var blob = new Blob([wordHTML], {type:"application/vnd.ms-word"});
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "OG_Kisa_Devre_Raporu.doc";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    }
    <\/script>
    </body></html>
  `);
  printWindow.document.close();
}

// ─── MODÜLE ÖZGÜ EXPORT FONKSİYONLARI ────────────────────────────────────────

/** OG Gerilim Düşümü Excel Export */
export async function exportOgVoltageDrop(nodes, results, cables, metrics) {
  const headers = ['Hat Adı', 'Kablo Tipi', 'Mesafe (km)', 'Yük (kVA)', 'Devre', 'Hat Akımı (A)', 'Segm. Düşüm (%)', 'Toplam Düşüm (%)', 'Güç Kaybı (kW)', 'Hat Sonu Gerilim (kV)', 'Kapasite Kullanımı (%)', 'Durum'];
  const rows = results.map((r, i) => {
    const n = nodes[i];
    const cable = cables.find(c => c.id === n.cableTypeId);
    return [
      n.name, cable?.name || '', n.length, n.loadKVA, n.circuitCount || 1,
      r.segmentCurrent.toFixed(2), r.voltageDropPercent.toFixed(3), r.totalDropPercent.toFixed(3),
      r.powerLoss.toFixed(2), r.endVoltage.toFixed(3), r.capacityUsage.toFixed(1),
      r.isSafeDrop && r.isSafeCurrent ? 'UYGUN' : 'UYGUN DEĞİL'
    ];
  });

  return exportToExcel([
    {
      name: 'OG Gerilim Düşümü',
      headers,
      rows: [
        ...rows,
        [],
        ['ÖZET', '', '', '', '', '', '', '', '', '', '', ''],
        ['Max Gerilim Düşümü (%)', metrics.maxDrop.toFixed(3)],
        ['Toplam Güç Kaybı (kW)', metrics.totalPowerLoss.toFixed(2)],
        ['Kayıp Oranı (%)', metrics.percentPowerLoss.toFixed(2)],
      ]
    }
  ], 'GridMaster_OG_Gerilim_Dusumu');
}

/** OG Kısa Devre Excel Export */
export async function exportOgShortCircuit(sourceName, lines, result, cables) {
  const lineRows = lines.map((l, i) => {
    const cable = cables.find(c => c.id === l.cableTypeId);
    return [i + 1, cable?.name || '', l.length, l.circuitCount || 1];
  });

  return exportToExcel([
    {
      name: 'OG Kısa Devre',
      headers: ['Parametre', 'Değer', 'Birim'],
      rows: [
        ['Kaynak', sourceName, ''],
        ['Bara I₃k', result.busbarCurrent.toFixed(3), 'kA'],
        ['Hat Sonu I₃k', result.lineEndCurrent.toFixed(3), 'kA'],
        ['Z_bara (pu)', result.zBaraPu?.toFixed(6), 'pu'],
        ['Z_toplam (pu)', result.zTotalPu?.toFixed(6), 'pu'],
        [],
        ['Hat No', 'Kablo Tipi', 'Uzunluk (km)', 'Devre Sayısı'],
        ...lineRows,
      ]
    }
  ], 'GridMaster_OG_Kisa_Devre');
}

/** Trafo Hesapları Excel Export */
export async function exportTransformer(trafoData, nominalCurrent, ikKA) {
  return exportToExcel([
    {
      name: 'Trafo Seçim Tablosu',
      headers: ['Parametre', 'Değer'],
      rows: [
        ['Trafo Gücü', `${trafoData.kva} kVA`],
        ['Kısa Devre Empedansı (uk)', `%${trafoData.uk}`],
        ['Nominal Akım (In)', `${nominalCurrent.toFixed(1)} A`],
        ['AG Bara Kısa Devre', `${ikKA.toFixed(2)} kA`],
        ['OG Sigorta', trafoData.hvFuse],
        ['AG Ana Şalter (CB)', `${trafoData.cb} A`],
        ['Cu Kablo Seçimi', trafoData.cuCable],
        ['Al Kablo Seçimi', trafoData.alCable],
        ['Bara (Busbar)', trafoData.busbar || '—'],
        ['Ölçüm Tipi', trafoData.measurement],
        ['AG CT', trafoData.lvCt],
        ['OG CT', trafoData.hvCt || '—'],
      ]
    }
  ], 'GridMaster_Trafo');
}

/** AG Gerilim Düşümü Excel Export */
export async function exportAgVoltageDrop(nodes, results) {
  return exportToExcel([
    {
      name: 'AG Gerilim Düşümü',
      headers: ['Hat', 'Malzeme', 'Kesit (mm²)', 'Uzunluk (m)', 'Güç (kW)', 'Devre', 'Segm. (%)', 'Toplam (%)', 'Akım (A)', 'Kapasite (A)', 'Durum'],
      rows: results.map(r => [
        r.name, r.material, r.section, r.length, r.powerKW, r.circuitCount || 1,
        r.segmentDrop?.toFixed(3) || '', r.totalDrop?.toFixed(3) || '',
        r.currentAmps?.toFixed(1) || '', r.capacity || '',
        r.isSafeCurrent && r.totalDrop <= 5 ? 'UYGUN' : 'UYGUN DEĞİL'
      ])
    }
  ], 'GridMaster_AG_Gerilim_Dusumu');
}

/** AG Kısa Devre Excel Export */
export async function exportAgShortCircuit(trafoKva, trafoUk, nodes, calcResult) {
  const rows = calcResult.results.map((r, i) => [
    r.name, r.type === 'busbar' ? 'Bara' : 'Kablo',
    r.material, r.section, r.length, r.circuitCount || 1,
    r.Z_element?.toFixed(6), r.Z_cumulative?.toFixed(6),
    r.Ik3_kA?.toFixed(3), r.Ik1_kA?.toFixed(3)
  ]);

  return exportToExcel([
    {
      name: 'AG Kısa Devre',
      headers: ['Eleman', 'Tip', 'Malzeme', 'Kesit (mm²)', 'Uzunluk (m)', 'Devre', 'Z_eleman (Ω)', 'Z_küm (Ω)', 'I₃k (kA)', 'I₁k (kA)'],
      rows: [
        [`${trafoKva} kVA Trafo`, 'Trafo', '', '', '', '', calcResult.Z_trafo?.toFixed(6), calcResult.Z_trafo?.toFixed(6), (calcResult.In / (trafoUk / 100) / 1000).toFixed(3), ''],
        ...rows
      ]
    }
  ], 'GridMaster_AG_Kisa_Devre');
}

/** PV Uyumluluk Excel Export */
export async function exportPvCompatibility(panel, inverter, results) {
  return exportToExcel([
    {
      name: 'Panel-Evirici Uyumluluk',
      headers: ['Kontrol', 'Açıklama', 'Hesaplanan', 'Operatör', 'Limit', 'Birim', 'Durum'],
      rows: [
        ...results.map(r => [r.label, r.desc, r.calc.toFixed(3), r.op, r.limit, r.unit, r.pass ? 'UYGUN' : 'UYGUN DEĞİL']),
        [],
        ['PANEL BİLGİLERİ'],
        ['Voc', panel.Voc, 'V'], ['Vmp', panel.Vmp, 'V'], ['Isc', panel.Isc, 'A'], ['Imp', panel.Imp, 'A'],
        ['k_Voc', panel.kVoc, '%/°C'], ['k_Vmp', panel.kVmp, '%/°C'],
        ['T_min', panel.tmin, '°C'], ['T_max', panel.tmax, '°C'], ['T_nom', panel.tnom, '°C'],
        ['Seri Panel', panel.seriesCount, 'adet'], ['Paralel Dizi', panel.parallelCount, 'adet'],
        [],
        ['EVİRİCİ BİLGİLERİ'],
        ['Maks DC Gerilim', inverter.Vdc_max, 'V'], ['Min DC Gerilim', inverter.Vdc_min, 'V'],
        ['Maks MPPT', inverter.Vmppt_max, 'V'], ['Min MPPT', inverter.Vmppt_min, 'V'],
        ['MPPT K.D. Akımı', inverter.Isc_max, 'A'], ['MPPT Maks Akımı', inverter.Imppt_max, 'A'],
      ]
    }
  ], 'GridMaster_PV_Uyumluluk');
}

// ─── PDF HTML TEMPLATE BUILDER'LARI ──────────────────────────────────────────

export function buildOgVoltageDropPDF(nodes, results, cables, metrics, sourceName) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
  const fmt = (n, d=3) => (typeof n==='number'&&isFinite(n)) ? n.toFixed(d) : '—';
  const TM = sourceName || 'Trafo Merkezi';
  const totalLoad = nodes.reduce((s,n)=>s+Number(n.loadKVA||0),0);

  // Tek Hat Şeması
  const PER_COL=4, numCols=Math.max(1,Math.ceil(nodes.length/PER_COL)), perCol=Math.ceil(nodes.length/numCols);
  const SCH_W=700, COL_W=Math.min(140,(SCH_W-40)/numCols), ROW_H=75, TOP=140;
  const SCH_H=Math.min(430,TOP+perCol*ROW_H+40), BARA_X=40+COL_W/2;
  const schPos=nodes.map((_,i)=>{
    const col=Math.floor(i/perCol), rowInCol=i%perCol;
    const row=col%2===0?rowInCol:(perCol-1-rowInCol);
    return{col,row,cx:40+col*COL_W+COL_W/2,cy:TOP+row*ROW_H+30};
  });

  const schemaSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="${SCH_W}" height="${SCH_H}" viewBox="0 0 ${SCH_W} ${SCH_H}" style="background:white;border:1px solid #e2e8f0;border-radius:4px;max-width:100%">
  <circle cx="${BARA_X}" cy="20" r="12" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
  <text x="${BARA_X}" y="17" text-anchor="middle" font-size="6" font-weight="bold" fill="#2563eb">154kV</text>
  <text x="${BARA_X+16}" y="16" font-size="8" font-weight="bold" fill="#1e293b">${TM}</text>
  <line x1="${BARA_X}" y1="32" x2="${BARA_X}" y2="58" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,2"/>
  <rect x="${BARA_X-18}" y="58" width="36" height="24" rx="3" fill="#eff6ff" stroke="#2563eb" stroke-width="1.2"/>
  <text x="${BARA_X}" y="68" text-anchor="middle" font-size="6" font-weight="bold" fill="#1e40af">34.5kV</text>
  <text x="${BARA_X}" y="77" text-anchor="middle" font-size="6" fill="#1e40af">TRAFO</text>
  <line x1="${BARA_X}" y1="82" x2="${BARA_X}" y2="108" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,2"/>
  <line x1="20" y1="111" x2="${SCH_W-20}" y2="111" stroke="#1e293b" stroke-width="4.5" stroke-linecap="round"/>
  <text x="${BARA_X}" y="103" text-anchor="middle" font-size="7" font-weight="bold" fill="#1e293b">34.5 kV Barası</text>
  <text x="${BARA_X}" y="126" text-anchor="middle" font-size="7" font-weight="bold" fill="#2563eb">ΔU_max=${fmt(metrics.maxDrop,3)}%  |  P_kayıp=${fmt(metrics.totalPowerLoss,2)} kW</text>
  ${nodes.map((node,i)=>{
    const p=schPos[i],res=results[i],cab=cables.find(c=>c.id===node.cableTypeId);
    const prevP=i>0?schPos[i-1]:null,sameCol=i>0&&prevP.col===p.col,colChg=i>0&&prevP.col!==p.col;
    const ok=res?(res.isSafeDrop&&res.isSafeCurrent):true;
    const midY=sameCol?((i===0?111:prevP.cy)+p.cy)/2:p.cy-25, prevY=i===0?111:prevP.cy;
    const nr=p.col%2===0;
    return `${i===0?`<line x1="${BARA_X}" y1="111" x2="${BARA_X}" y2="${p.cy}" stroke="#334155" stroke-width="1.5"/>`:''}
    ${sameCol?`<line x1="${prevP.cx}" y1="${prevY}" x2="${p.cx}" y2="${p.cy}" stroke="#334155" stroke-width="1.5"/>`:''}
    ${colChg?`<path d="M ${prevP.cx} ${prevY} L ${prevP.cx} ${p.cy} L ${p.cx} ${p.cy}" fill="none" stroke="#334155" stroke-width="1.5" stroke-linejoin="round"/>`:''}
    <rect x="${p.cx-28}" y="${midY-10}" width="56" height="20" rx="3" fill="#dbeafe" stroke="#2563eb" stroke-width="0.8"/>
    <text x="${p.cx}" y="${midY-2}" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#1e40af">${cab?.name||'?'}</text>
    <text x="${p.cx}" y="${midY+8}" text-anchor="middle" font-size="5.5" fill="#1e40af">${node.length}km</text>
    <circle cx="${p.cx}" cy="${p.cy}" r="5" fill="${ok?'#334155':'#ef4444'}" stroke="white" stroke-width="1.5"/>
    ${nr?`<text x="${p.cx+8}" y="${p.cy+4}" font-size="7" font-weight="bold" fill="#1e293b">${node.name||'Hat '+(i+1)}</text>`:
         `<text x="${p.cx-8}" y="${p.cy+4}" text-anchor="end" font-size="7" font-weight="bold" fill="#1e293b">${node.name||'Hat '+(i+1)}</text>`}
    ${res?`<text x="${nr?p.cx+8:p.cx-8}" y="${p.cy+14}" ${nr?'':'text-anchor="end"'} font-size="6" fill="${ok?'#2563eb':'#ef4444'}" font-weight="bold">ΔU=${fmt(res.totalDropPercent,2)}%</text>`:''}`; 
  }).join('')}
  </svg>`;

  const detailRows=results.map((r,i)=>{
    const n=nodes[i],cab=cables.find(c=>c.id===n.cableTypeId),ok=r.isSafeDrop&&r.isSafeCurrent,nc=n.circuitCount||1;
    return `<tr><td><b>${n.name||'Hat '+(i+1)}</b></td><td>${cab?.name||'—'}</td>
      <td class="mono">${n.length}</td><td class="mono">${nc}</td><td class="mono">${Number(n.loadKVA).toFixed(0)}</td>
      <td class="mono">${fmt(r.segmentCurrent,2)}</td><td class="mono">${fmt(cab?.ampacity||0,0)}</td>
      <td class="mono">${fmt(r.voltageDropPercent,3)}</td><td class="mono"><b>${fmt(r.totalDropPercent,3)}</b></td>
      <td class="mono">${fmt(r.powerLoss,2)}</td>
      <td><span style="padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;background:${ok?'#dcfce7':'#fee2e2'};color:${ok?'#166534':'#991b1b'}">${ok?'✓ UYGUN':'✗ UYGUN DEĞİL'}</span></td></tr>`;
  }).join('');

  const cableRows=nodes.map((n,i)=>{
    const cab=cables.find(c=>c.id===n.cableTypeId),nc=n.circuitCount||1;
    const R=cab?(cab.r/nc):0,X=cab?(cab.x/nc):0,Rs=R*n.length,Xs=X*n.length,Zs=Math.sqrt(Rs**2+Xs**2);
    return `<tr><td><b>${n.name||'Hat '+(i+1)}</b></td><td>${cab?.name||'—'}</td>
      <td class="mono">${n.length}</td><td class="mono">${nc}</td>
      <td class="mono">${fmt(R,4)}</td><td class="mono">${fmt(X,4)}</td><td class="mono">${fmt(cab?.ampacity||0,0)}</td>
      <td class="mono">${fmt(Rs,4)}</td><td class="mono">${fmt(Xs,4)}</td><td class="mono"><b>${fmt(Zs,4)}</b></td></tr>`;
  }).join('');

  const worstNode=results.length?results.reduce((b,r,i)=>r.totalDropPercent>b.v?{v:r.totalDropPercent,i}:b,{v:0,i:0}):null;
  const worstName=worstNode?(nodes[worstNode.i]?.name||'Hat '+(worstNode.i+1)):'—';

  return `
  <div style="page-break-inside:avoid">
  <table style="margin-bottom:0;font-size:11px"><tr>
    <td style="width:55%;vertical-align:top;padding:0">
      <div style="background:#1e3a5f;color:white;padding:10px 14px;border-radius:6px 6px 0 0">
        <div style="font-size:16px;font-weight:900">GridMaster</div>
        <div style="font-size:10px;opacity:.8;margin-top:2px">Elektrik Mühendisliği Hesap Platformu</div>
      </div>
      <div style="background:#f1f5f9;padding:8px 14px;border:1px solid #e2e8f0;border-top:none">
        <div style="font-size:14px;font-weight:900;color:#1e3a5f">OG GERİLİM DÜŞÜMÜ ANALİZİ</div>
        <div style="font-size:10px;color:#475569;margin-top:2px">IEC 60038 — 34.5 kV Dağıtım Hattı</div>
      </div>
    </td>
    <td style="width:45%;vertical-align:top;padding:0">
      <table style="width:100%;font-size:10px;margin:0;border:1px solid #e2e8f0">
        <tr><td style="padding:3px 8px;background:#f8fafc;font-weight:700">Standart</td><td style="padding:3px 8px">IEC 60038 / TS EN 50160</td></tr>
        <tr><td style="padding:3px 8px;background:#f8fafc;font-weight:700">Tarih</td><td style="padding:3px 8px">${dateStr} ${timeStr}</td></tr>
        <tr><td style="padding:3px 8px;background:#f8fafc;font-weight:700">Kaynak</td><td style="padding:3px 8px;font-weight:700">${TM}</td></tr>
        <tr><td style="padding:3px 8px;background:#f8fafc;font-weight:700">Toplam Yük</td><td style="padding:3px 8px">${(totalLoad/1000).toFixed(2)} MVA</td></tr>
        <tr><td style="padding:3px 8px;background:#f8fafc;font-weight:700">Hat Sayısı</td><td style="padding:3px 8px">${nodes.length}</td></tr>
      </table>
    </td>
  </tr></table>
  <div style="margin:12px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">TEK HAT ŞEMASI</div>
  <div style="margin-bottom:12px">${schemaSvg}</div>
  </div>

  <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">1.  GERİLİM DÜŞÜMÜ DETAY RAPORU</div>
  <div style="font-size:9px;color:#64748b;margin-bottom:6px">Un=34.5kV | İzin verilen maks. düşüm: <b>%5</b> | Akım sınırı: kablo nominal ampasitesi</div>
  <table>
    <thead><tr><th>Düğüm</th><th>Kablo</th><th>L(km)</th><th>Devre</th><th>Yük(kVA)</th><th>I_seg(A)</th><th>I_nom(A)</th><th>ΔU_seg(%)</th><th>ΔU_top(%)</th><th>P_kayıp(kW)</th><th>Durum</th></tr></thead>
    <tbody>${detailRows}</tbody>
  </table>

  <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">2.  ÖZET SONUÇLAR</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin:8px 0 16px">
    <div style="background:#eff6ff;border:2px solid #2563eb;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:9px;font-weight:700;color:#1e40af;text-transform:uppercase;margin-bottom:4px">Maks. Gerilim Düşümü</div>
      <div style="font-size:22px;font-weight:900;color:${metrics.maxDrop>5?'#dc2626':'#1e40af'};font-family:monospace">${fmt(metrics.maxDrop,3)}%</div>
      <div style="font-size:9px;color:#64748b;margin-top:2px">${worstName}</div>
      <div style="font-size:9px;font-weight:700;color:${metrics.maxDrop>5?'#dc2626':'#16a34a'}">${metrics.maxDrop>5?'⚠ SINIR AŞILDI':'✓ UYGUN (≤%5)'}</div>
    </div>
    <div style="background:#faf5ff;border:2px solid #7c3aed;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:9px;font-weight:700;color:#6d28d9;text-transform:uppercase;margin-bottom:4px">Toplam Güç Kaybı</div>
      <div style="font-size:22px;font-weight:900;color:#6d28d9;font-family:monospace">${fmt(metrics.totalPowerLoss,2)}</div>
      <div style="font-size:10px;color:#64748b">kW  (%${fmt(metrics.percentPowerLoss||0,3)} kayıp)</div>
    </div>
    <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:9px;font-weight:700;color:#15803d;text-transform:uppercase;margin-bottom:4px">Toplam Hat Uzunluğu</div>
      <div style="font-size:22px;font-weight:900;color:#15803d;font-family:monospace">${fmt(nodes.reduce((s,n)=>s+Number(n.length||0),0),2)}</div>
      <div style="font-size:10px;color:#64748b">km</div>
    </div>
    <div style="background:#fff7ed;border:2px solid #ea580c;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:9px;font-weight:700;color:#c2410c;text-transform:uppercase;margin-bottom:4px">Toplam Yük</div>
      <div style="font-size:22px;font-weight:900;color:#c2410c;font-family:monospace">${fmt(totalLoad/1000,2)}</div>
      <div style="font-size:10px;color:#64748b">MVA — ${nodes.length} nokta</div>
    </div>
  </div>

  <div style="margin:16px 0 6px;font-size:13px;font-weight:900;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px">3.  KABLO PARAMETRE TABLOSU</div>
  <table>
    <thead><tr><th>Düğüm</th><th>Kablo</th><th>L(km)</th><th>Devre</th><th>R(Ω/km)</th><th>X(Ω/km)</th><th>I_nom(A)</th><th>R_seg(Ω)</th><th>X_seg(Ω)</th><th>Z_seg(Ω)</th></tr></thead>
    <tbody>${cableRows}</tbody>
  </table>`;
}

export function buildTransformerPDF(trafoData, nominalCurrent, ikKA) {
  return `
    <h1>Trafo Seçim Raporu — ${trafoData.kva} kVA</h1>
    <h2>Temel Değerler</h2>
    <table>
      <tbody>
        <tr><td><b>Nominal Akım (In)</b></td><td class="mono">${nominalCurrent.toFixed(1)} A</td></tr>
        <tr><td><b>AG Bara Kısa Devresi</b></td><td class="mono">${ikKA.toFixed(2)} kA</td></tr>
        <tr><td><b>Kısa Devre Empedansı (uk)</b></td><td class="mono">%${trafoData.uk}</td></tr>
        <tr><td><b>OG Sigorta</b></td><td>${trafoData.hvFuse}</td></tr>
        <tr><td><b>AG Ana Şalter (CB)</b></td><td class="mono">${trafoData.cb} A</td></tr>
        <tr><td><b>Cu Kablo Seçimi</b></td><td>${trafoData.cuCable}</td></tr>
        <tr><td><b>Al Kablo Seçimi</b></td><td>${trafoData.alCable}</td></tr>
        ${trafoData.busbar ? `<tr><td><b>Busbar</b></td><td>${trafoData.busbar}</td></tr>` : ''}
        <tr><td><b>Ölçüm Tipi</b></td><td>${trafoData.measurement}</td></tr>
        <tr><td><b>AG CT</b></td><td>${trafoData.lvCt}</td></tr>
        ${trafoData.hvCt ? `<tr><td><b>OG CT</b></td><td>${trafoData.hvCt}</td></tr>` : ''}
      </tbody>
    </table>
  `;
}

export function buildPvPDF(panel, inverter, results) {
  const rows = results.map(r => `
    <tr>
      <td><b>${r.label}</b></td>
      <td>${r.desc}</td>
      <td class="mono">${r.calc.toFixed(2)} ${r.unit}</td>
      <td style="text-align:center">${r.op}</td>
      <td class="mono">${r.limit} ${r.unit}</td>
      <td><span class="${r.pass ? 'badge-ok' : 'badge-fail'}">${r.pass ? 'UYGUN' : 'UYGUN DEĞİL'}</span></td>
    </tr>
  `).join('');

  const allPass = results.every(r => r.pass);
  return `
    <h1>Panel — Evirici Uyumluluk Raporu</h1>
    <div class="meta">
      Panel: Voc=${panel.Voc}V, Vmp=${panel.Vmp}V, Isc=${panel.Isc}A, Imp=${panel.Imp}A &nbsp;|&nbsp;
      Seri: ${panel.seriesCount} &nbsp;|&nbsp; Paralel: ${panel.parallelCount} &nbsp;|&nbsp;
      T: ${panel.tmin}°C / ${panel.tmax}°C
    </div>
    <div class="meta">Genel Sonuç: <span class="${allPass ? 'badge-ok' : 'badge-fail'}">${allPass ? '✓ UYUMLU' : '✗ UYUMSUZLUK TESPİT EDİLDİ'}</span></div>
    <h2>Kontrol Sonuçları</h2>
    <table>
      <thead><tr><th>Durum</th><th>Açıklama</th><th>Hesaplanan</th><th>Op.</th><th>Limit</th><th>Sonuç</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function buildAgShortCircuitPDF(trafoKva, trafoUk, calcResult) {
  const rows = calcResult.results.map(r => `
    <tr>
      <td><b>${r.name}</b></td>
      <td>${r.type === 'busbar' ? 'Bara' : 'Kablo'}</td>
      <td>${r.material || ''} ${r.section ? r.section + 'mm²' : ''}</td>
      <td class="mono">${r.length || ''}${r.length ? ' m' : ''}</td>
      <td class="mono">${r.Z_element?.toFixed(5) || ''} Ω</td>
      <td class="mono">${r.Z_cumulative?.toFixed(5)} Ω</td>
      <td class="mono"><b>${r.Ik3_kA?.toFixed(3)} kA</b></td>
      <td class="mono">${r.Ik1_kA?.toFixed(3)} kA</td>
    </tr>
  `).join('');

  return `
    <h1>AG Kısa Devre Raporu — ${trafoKva} kVA Trafo</h1>
    <div class="meta">uk = %${trafoUk} &nbsp;|&nbsp; Z_trafo = ${calcResult.Z_trafo?.toFixed(5)} Ω &nbsp;|&nbsp; In = ${calcResult.In?.toFixed(1)} A</div>
    <h2>Zincir Analizi</h2>
    <table>
      <thead><tr><th>Eleman</th><th>Tip</th><th>Kesit</th><th>Uzunluk</th><th>Z_eleman</th><th>Z_kümülatif</th><th>I₃k</th><th>I₁k</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ─── GES KABLO WORD EXPORT ────────────────────────────────────────────────────
export async function exportGesKabloWord(panel, sistem, dc, strings, ac1, ac2, res, inverter) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak
  } = await import('docx');

  const K_DC = 56;
  const K_AC = { Cu: 56, Al: 35 };

  const fmt = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : String(n));

  // ── Stil yardımcıları ──
  const sb = (c = 'AAAAAA') => ({ style: BorderStyle.SINGLE, size: 4, color: c });
  const ab = () => ({ top: sb(), bottom: sb(), left: sb(), right: sb() });

  function mc(text, { bold = false, fill = 'FFFFFF', tc = '222222', align = AlignmentType.LEFT, colspan = 1, w = null } = {}) {
    return new TableCell({
      columnSpan: colspan,
      borders: ab(),
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 55, bottom: 55, left: 100, right: 100 },
      ...(w ? { width: { size: w, type: WidthType.DXA } } : {}),
      children: [new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text), bold, color: tc, font: 'Arial', size: 19 })]
      })]
    });
  }

  const hRow = (labels, widths) => new TableRow({
    tableHeader: true,
    children: labels.map((l, i) => mc(l, { bold: true, fill: '1F5C99', tc: 'FFFFFF', w: widths[i] }))
  });

  const dRow = (...cells) => new TableRow({ children: cells });

  const okC = (ok) => mc(ok ? '✓  UYGUN' : '✗  UYGUN DEĞİL', {
    bold: true, align: AlignmentType.CENTER,
    fill: ok ? 'C6EFCE' : 'FFC7CE', tc: ok ? '276221' : '9C0006'
  });

  const hdg = (text) => new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1F5C99', space: 2 } },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 26, color: '1F5C99' })]
  });

  const subh = (text) => new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 21, color: '2E4057' })]
  });

  const ln = (text, bold = false) => new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, bold, font: 'Arial', size: 19, color: '222222' })]
  });

  const fml = (text) => new Paragraph({
    spacing: { before: 28, after: 28 },
    indent: { left: 500 },
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '1F5C99' })]
  });

  const bl = () => new Paragraph({ spacing: { before: 40, after: 40 }, children: [] });
  const pg = () => new Paragraph({ children: [new PageBreak()] });

  // ── Hesaplanan değerler ──
  const In = (sistem.Pac * 1000) / (sistem.Un * Math.sqrt(3) * sistem.cosf);
  const KAC1 = K_AC[ac1.material];
  const KAC2 = K_AC[ac2.material];
  const Pk1 = 3 * ac1.L * In * In / (ac1.S * KAC1);
  const e1  = Pk1 / (sistem.Pac * 1000) * 100;
  const Pk2 = 3 * ac2.L * In * In / (ac2.S * KAC2);
  const e2  = Pk2 / (sistem.Pac * 1000) * 100;
  const Itk1 = ac1.Ikat * ac1.kSic * ac1.kDos;
  const Itk2 = ac2.Ikat * ac2.kSic * ac2.kDos;
  const Imax_dc = 1.25 * panel.Isc;
  const Itk_dc  = dc.Ikat_dc * dc.kSic_dc * dc.kDos_dc;

  // ── Dizi hesapları ──
  const dcRows = strings.map(s => {
    const Udizi = panel.Vmpp * s.nSeri;
    const Pdizi = panel.Wp * s.nSeri;
    const Pk    = 2 * s.L * panel.Impp * panel.Impp / (dc.Sdc * K_DC);
    const Ppct  = Pk / Pdizi * 100;
    const epct  = 2 * 100 * s.L * panel.Impp / (dc.Sdc * K_DC * Udizi);
    return { ...s, Udizi, Pdizi, Pk, Ppct, epct };
  });

  const totalDcKW = strings.reduce((sum, s) => sum + (panel.Wp * s.nSeri) / 1000, 0);
  const FUSES = [6,10,13,16,20,25,32,40,50,63,80,100,125,160,200,250,315,400];
  const sigortaVal = FUSES.find(f => f > In) ?? '>400';

  // ── Belge oluştur ──
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 19 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 900, bottom: 1000, left: 900 }
        }
      },
      children: [
        // Başlık
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 300, after: 60 },
          children: [new TextRun({ text: 'GES — KABLO VE GÜÇ HESAPLAMALARI', bold: true, font: 'Arial', size: 30, color: '1F5C99' })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 400 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1F5C99', space: 2 } },
          children: [new TextRun({ text: `GES Elektrik Proje Hesapları  –  ${sistem.Pac} kWp Sistem`, font: 'Arial', size: 20, color: '555555' })]
        }),

        // 1. PANEL–İNVERTER GÜÇ UYUMU
        hdg('1.  PANEL – İNVERTER GÜÇ UYUMU'),
        bl(),
        ln('Her dizinin gücü:'),
        ...[...new Set(strings.map(s => s.nSeri))].sort((a,b)=>a-b).flatMap(n => {
          const cnt = strings.filter(s => s.nSeri === n).length;
          const pwr = (panel.Wp * n / 1000);
          return [fml(`n = ${n}  →  ${panel.Wp} W × ${n} = ${fmt(pwr,3)} kW / dizi  ×  ${cnt} dizi = ${fmt(pwr*cnt,2)} kW`)];
        }),
        bl(),
        fml(`Toplam DC Güç = ${fmt(totalDcKW,2)} kW`),
        fml(`İnverter Maks. Panel Giriş Gücü = ${sistem.Pmax_inv} kW`),
        fml(`${fmt(totalDcKW,2)} kW  ${totalDcKW<=sistem.Pmax_inv?'≤':'>'}  ${sistem.Pmax_inv} kW  →  ${totalDcKW<=sistem.Pmax_inv?'UYGUN':'UYGUN DEĞİL'}`),
        bl(),
        new Table({
          width: { size: 9100, type: WidthType.DXA }, columnWidths: [4500,2000,1600,1000],
          rows: [
            hRow(['Kontrol','Hesaplanan','Sınır','Sonuç'], [4500,2000,1600,1000]),
            dRow(mc('Toplam DC Güç ≤ İnverter Maks. Panel Giriş Gücü'), mc(`${fmt(totalDcKW,2)} kW`, {align:AlignmentType.CENTER}), mc(`${sistem.Pmax_inv} kW`, {align:AlignmentType.CENTER}), okC(totalDcKW<=sistem.Pmax_inv)),
          ]
        }),

        pg(),

        // 2. DC KABLO
        hdg('2.  DC KABLO HESAPLARI'),
        bl(),
        new Table({
          width: { size: 4700, type: WidthType.DXA }, columnWidths: [2400,700,1600],
          rows: [
            hRow(['PANEL VERİLERİ','Sembol','Değer'], [2400,700,1600]),
            dRow(mc('Panel Gücü'), mc('Wp'), mc(`${panel.Wp} W`)),
            dRow(mc('Nominal Gerilim'), mc('Vmpp'), mc(`${fmt(panel.Vmpp,2)} V`)),
            dRow(mc('Nominal Akım'), mc('Impp'), mc(`${fmt(panel.Impp,2)} A`)),
            dRow(mc('Kısa Devre Akımı'), mc('Isc'), mc(`${fmt(panel.Isc,2)} A`)),
          ]
        }),
        bl(),
        subh('2.1  Güç Kaybı ve Gerilim Düşümü — Tüm Diziler'),
        ln('Formüller:'),
        fml('Pkayıp = 2 × L × Impp² / (S × K)               [W]'),
        fml('%e     = 2 × 100 × L × Impp / (S × K × Udizi)  [%]'),
        bl(),
        ...dcRows.flatMap(r => [
          ln(`Dizi ${r.code}  –  n seri = ${r.nSeri}  |  Udizi = ${fmt(r.Udizi,2)} V  |  L = ${r.L} m:`, true),
          fml(`Pkayıp = 2 × ${r.L} × ${fmt(panel.Impp,2)}² / (${dc.Sdc} × ${K_DC}) = ${fmt(r.Pk,2)} W`),
          fml(`%e     = 2 × 100 × ${r.L} × ${fmt(panel.Impp,2)} / (${dc.Sdc} × ${K_DC} × ${fmt(r.Udizi,2)}) = ${fmt(r.epct,2)} %`),
          bl(),
        ]),
        ln('DC Güç Kaybı – Özet Tablosu', true), bl(),
        new Table({
          width: { size: 9100, type: WidthType.DXA },
          columnWidths: [600,800,700,900,700,800,800,1000,950,850],
          rows: [
            hRow(['#','Dizi','n Seri','P Dizi (W)','K','Impp (A)','L (m)','S (mm²)','Pkayıp (W)','%e'],
                 [600,800,700,900,700,800,800,1000,950,850]),
            ...dcRows.map((r,i) => dRow(
              mc(String(i+1),{align:AlignmentType.CENTER}),
              mc(r.code,{bold:true,align:AlignmentType.CENTER}),
              mc(String(r.nSeri),{align:AlignmentType.CENTER}),
              mc(String(r.Pdizi),{align:AlignmentType.CENTER}),
              mc(String(K_DC),{align:AlignmentType.CENTER}),
              mc(fmt(panel.Impp,2),{align:AlignmentType.CENTER}),
              mc(String(r.L),{align:AlignmentType.CENTER}),
              mc(String(dc.Sdc),{align:AlignmentType.CENTER}),
              mc(fmt(r.Pk,2),{align:AlignmentType.RIGHT}),
              mc(fmt(r.epct,2),{align:AlignmentType.RIGHT}),
            ))
          ]
        }),
        bl(),
        subh('2.2  DC Akım Taşıma Kontrolü'),
        fml(`Imax = 1,25 × ${fmt(panel.Isc,2)} = ${fmt(Imax_dc,2)} A`),
        fml(`Itk  = ${dc.Ikat_dc} × ${dc.kSic_dc} × ${dc.kDos_dc} = ${fmt(Itk_dc,2)} A`),
        bl(),
        new Table({
          width: { size: 9100, type: WidthType.DXA }, columnWidths: [2300,2300,2500,2000],
          rows: [
            hRow(['Imax (A)','Itk (A)','Karşılaştırma','Sonuç'], [2300,2300,2500,2000]),
            dRow(mc(fmt(Imax_dc,2),{align:AlignmentType.CENTER}), mc(fmt(Itk_dc,2),{align:AlignmentType.CENTER}),
                 mc(`${fmt(Itk_dc,2)} A  ${Itk_dc>Imax_dc?'>':'<'}  ${fmt(Imax_dc,2)} A`,{align:AlignmentType.CENTER}), okC(Itk_dc>Imax_dc))
          ]
        }),

        pg(),

        // 3. AC KABLO
        hdg('3.  AC KABLO HESAPLARI'),
        bl(),
        fml(`In = Pac / (Un × √3 × cosφ) = ${sistem.Pac*1000} / (${sistem.Un} × 1,732 × ${sistem.cosf}) = ${fmt(In,2)} A`),
        bl(),
        subh(`3.1  ADP Panosu → GES Panosu  |  4 × ${ac1.S} mm² ${ac1.label} ${ac1.material}  |  L = ${ac1.L} m`),
        fml(`Pkayıp = 3 × ${ac1.L} × ${fmt(In,2)}² / (${ac1.S} × ${KAC1}) = ${fmt(Pk1,2)} W`),
        fml(`%e = ${fmt(Pk1,2)} / ${sistem.Pac*1000} × 100 = ${fmt(e1,3)} %`),
        fml(`Itk = ${ac1.Ikat} × ${ac1.kSic} × ${ac1.kDos} = ${fmt(Itk1,2)} A  ${Itk1>In?'>':'<'}  ${fmt(In,2)} A`),
        bl(),
        subh(`3.2  GES Panosu → İnverter  |  4 × ${ac2.S} mm² ${ac2.label} ${ac2.material}  |  L = ${ac2.L} m`),
        fml(`Pkayıp = 3 × ${ac2.L} × ${fmt(In,2)}² / (${ac2.S} × ${KAC2}) = ${fmt(Pk2,2)} W`),
        fml(`%e = ${fmt(Pk2,2)} / ${sistem.Pac*1000} × 100 = ${fmt(e2,3)} %`),
        fml(`Itk = ${ac2.Ikat} × ${ac2.kSic} × ${ac2.kDos} = ${fmt(Itk2,2)} A  ${Itk2>In?'>':'<'}  ${fmt(In,2)} A`),
        bl(),
        ln('AC Kablo Özet Tablosu', true), bl(),
        new Table({
          width: { size: 9100, type: WidthType.DXA },
          columnWidths: [2300,800,800,1000,1000,1200,1000,1000],
          rows: [
            hRow(['Hat','L (m)','S (mm²)','In (A)','Pkayıp (W)','Ger.Düşümü (%)','Itk (A)','Sonuç'],
                 [2300,800,800,1000,1000,1200,1000,1000]),
            dRow(mc(`ADP → GES (${ac1.label})`), mc(String(ac1.L),{align:AlignmentType.CENTER}), mc(String(ac1.S),{align:AlignmentType.CENTER}),
                 mc(fmt(In,2),{align:AlignmentType.CENTER}), mc(fmt(Pk1,2),{align:AlignmentType.RIGHT}),
                 mc(fmt(e1,3),{align:AlignmentType.RIGHT}), mc(fmt(Itk1,2),{align:AlignmentType.CENTER}), okC(Itk1>In)),
            dRow(mc(`GES → İnverter (${ac2.label})`), mc(String(ac2.L),{align:AlignmentType.CENTER}), mc(String(ac2.S),{align:AlignmentType.CENTER}),
                 mc(fmt(In,2),{align:AlignmentType.CENTER}), mc(fmt(Pk2,2),{align:AlignmentType.RIGHT}),
                 mc(fmt(e2,3),{align:AlignmentType.RIGHT}), mc(fmt(Itk2,2),{align:AlignmentType.CENTER}), okC(Itk2>In)),
          ]
        }),

        pg(),

        // 4. SİGORTA
        hdg('4.  SİGORTA SEÇİMİ'),
        bl(),
        fml(`I = ${fmt(In,2)} A  →  Standart değer: 3 × ${sigortaVal} A`),
        bl(),
        new Table({
          width: { size: 7000, type: WidthType.DXA }, columnWidths: [3500,1800,1700],
          rows: [
            hRow(['Sigorta Konumu','Hesaplanan (A)','Seçilen'], [3500,1800,1700]),
            dRow(mc('İnverter Çıkışı – Şalter'), mc(fmt(In,2),{align:AlignmentType.CENTER}), mc(`3 × ${sigortaVal} A`,{bold:true,align:AlignmentType.CENTER,fill:'D6E4F0'})),
            dRow(mc('GES Panosu Çıkışı – Sigorta'), mc(fmt(In,2),{align:AlignmentType.CENTER}), mc(`3 × ${sigortaVal} A`,{bold:true,align:AlignmentType.CENTER,fill:'D6E4F0'})),
          ]
        }),
      ]
    }]
  });

  // PV Uyumluluk ek bölüm — ayrı section olarak ekle
  if (res.pvUyumluluk?.length > 0) {
    const pvSec = {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, right: 800, bottom: 900, left: 800 } } },
      children: [
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ spacing:{before:200,after:120},
          border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'1F5C99',space:2}},
          children:[new TextRun({text:'4.  PANEL — EVİRİCİ UYUMLULUK KONTROLÜ',bold:true,font:'Arial',size:26,color:'1F5C99'})] }),
        new Paragraph({spacing:{before:80,after:40}, children:[new TextRun({
          text:`Panel: Voc=${panel.Voc}V  |  kVoc=${panel.kVoc}%/°C  |  Vmp=${panel.Vmpp}V  |  kVmp=${panel.kVmp||'-0.35'}%/°C  |  Tmin=${panel.tmin}°C, Tmax=${panel.tmax}°C, Tnom=${panel.tnom}°C`,
          font:'Arial',size:18,color:'475569'})]}),
        new Paragraph({spacing:{before:40,after:120}, children:[new TextRun({
          text:`Evirici: Vdc_max=${inverter?.Vdc_max||1000}V  |  Vdc_min=${inverter?.Vdc_min||200}V  |  Vmppt_max=${inverter?.Vmppt_max||800}V  |  Vmppt_min=${inverter?.Vmppt_min||200}V  |  Isc_max=${inverter?.Isc_max||30}A`,
          font:'Arial',size:18,color:'475569'})]}),
        ...res.pvUyumluluk.flatMap(grp => [
          new Paragraph({spacing:{before:160,after:60}, children:[new TextRun({
            text:`${grp.nSeri} seri × ${grp.nPar} paralel dizi`,bold:true,font:'Arial',size:20,color:'5B21B6'})]}),
          new Table({ width:{size:9100,type:WidthType.DXA}, columnWidths:[2800,1500,600,1500,1700],
            rows:[
              hRow(['Kontrol','Hesaplanan','Op.','Sınır','Sonuç'],[2800,1500,600,1500,1700]),
              ...grp.checks.map(c => new TableRow({ children:[
                new TableCell({borders:ab(),margins:{top:50,bottom:50,left:100,right:100},children:[
                  new Paragraph({children:[new TextRun({text:c.label,font:'Arial',size:18})]}),
                  new Paragraph({children:[new TextRun({text:c.tip,font:'Arial',size:16,color:'94A3B8'})]}),
                ]}),
                new TableCell({borders:ab(),margins:{top:50,bottom:50,left:100,right:100},
                  shading:{fill:c.pass?'C6EFCE':'FFC7CE',type:ShadingType.CLEAR},
                  children:[new Paragraph({alignment:AlignmentType.CENTER,children:[
                    new TextRun({text:`${c.val.toFixed(2)} ${c.unit}`,bold:true,font:'Courier New',size:18,color:c.pass?'276221':'9C0006'})
                  ]})]
                }),
                new TableCell({borders:ab(),margins:{top:50,bottom:50,left:100,right:100},children:[
                  new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:c.op,font:'Arial',size:20,bold:true})]})
                ]}),
                new TableCell({borders:ab(),margins:{top:50,bottom:50,left:100,right:100},children:[
                  new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${c.lim} ${c.unit}`,font:'Courier New',size:18})]})
                ]}),
                new TableCell({borders:ab(),margins:{top:50,bottom:50,left:100,right:100},
                  shading:{fill:c.pass?'C6EFCE':'FFC7CE',type:ShadingType.CLEAR},
                  children:[new Paragraph({alignment:AlignmentType.CENTER,children:[
                    new TextRun({text:c.pass?'✓ UYGUN':'✗ UYGUN DEĞİL',bold:true,font:'Arial',size:18,color:c.pass?'276221':'9C0006'})
                  ]})]
                }),
              ]})),
            ]
          }),
          new Paragraph({spacing:{before:80,after:0},children:[]}),
        ]),
      ]
    };
    doc.addSection(pvSec);
  }

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'GES_Kablo_Raporu.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── GES TOPRAKLAMA HTML/PDF EXPORT ─────────────────────────────
export function exportGesTopraklamaPDF(inputs, res) {
  if (!res) return;
  const now = new Date();
  const tarih = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const saat  = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const f = (n, d=3) => (typeof n === 'number' && isFinite(n)) ? n.toFixed(d) : '—';
  const isArazi = res.mod === 'arazi';

  // ── UTP Eğrisi (sadece arazi/OG) ─────────────────────────────
  function makeUtpSvg(t_val, utp_val, ue_val, dok_ok) {
    const UTP = [{t:.05,U:900},{t:.10,U:750},{t:.20,U:500},{t:.50,U:200},{t:1,U:100},{t:2,U:75},{t:5,U:70},{t:10,U:70}];
    const W=420, H=170, lx=40, rx=410, ty=18, by=148;
    const tx = tv => lx + (Math.log10(tv)-Math.log10(0.03))/(Math.log10(10)-Math.log10(0.03))*(rx-lx);
    const uy = uv => by - (Math.log10(Math.min(Math.max(uv,50),1200))-Math.log10(50))/(Math.log10(1200)-Math.log10(50))*(by-ty);
    const pts = UTP.map(p => tx(p.t).toFixed(1)+','+uy(p.U).toFixed(1)).join(' ');
    const tSafe = Math.max(0.05, Math.min(t_val||1, 10));
    const utpSafe = utp_val || 100;
    const ueSafe = ue_val || 0;
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">';
    svg += '<text x="'+W/2+'" y="13" text-anchor="middle" font-size="9" font-weight="bold" fill="#334155">UTP — İzin Verilen Maks. Dokunma Gerilimi (ETT / IEC 60479)</text>';
    [70,100,200,500,1000].forEach(u => {
      svg += '<line x1="'+lx+'" y1="'+uy(u)+'" x2="'+rx+'" y2="'+uy(u)+'" stroke="#e2e8f0" stroke-width="0.6"/>';
      svg += '<text x="'+(lx-3)+'" y="'+(uy(u)+3)+'" text-anchor="end" font-size="6.5" fill="#94a3b8">'+u+'</text>';
    });
    [0.05,0.1,0.2,0.5,1,2,5,10].forEach(tv => {
      svg += '<line x1="'+tx(tv)+'" y1="'+ty+'" x2="'+tx(tv)+'" y2="'+by+'" stroke="#e2e8f0" stroke-width="0.6"/>';
      svg += '<text x="'+tx(tv)+'" y="'+(H-8)+'" text-anchor="middle" font-size="6.5" fill="#94a3b8">'+tv+'</text>';
    });
    svg += '<line x1="'+lx+'" y1="'+ty+'" x2="'+lx+'" y2="'+by+'" stroke="#94a3b8" stroke-width="1"/>';
    svg += '<line x1="'+lx+'" y1="'+by+'" x2="'+rx+'" y2="'+by+'" stroke="#94a3b8" stroke-width="1"/>';
    svg += '<text x="'+(rx+2)+'" y="'+(by+3)+'" font-size="6.5" fill="#64748b">s</text>';
    svg += '<text x="'+(lx-3)+'" y="'+(ty-3)+'" font-size="6.5" fill="#64748b">V</text>';
    svg += '<polyline points="'+pts+'" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round"/>';
    // t çizgisi
    svg += '<line x1="'+tx(tSafe)+'" y1="'+ty+'" x2="'+tx(tSafe)+'" y2="'+by+'" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,2"/>';
    svg += '<circle cx="'+tx(tSafe)+'" cy="'+uy(utpSafe)+'" r="4" fill="#f59e0b" stroke="white" stroke-width="1.5"/>';
    svg += '<text x="'+(tx(tSafe)+5)+'" y="'+(uy(utpSafe)-4)+'" font-size="8" fill="#92400e" font-weight="bold">UTP='+utpSafe+'V (t='+tSafe+'s)</text>';
    // UE çizgisi
    if (ueSafe > 50 && ueSafe < 1200) {
      const col = dok_ok ? '#2563eb' : '#ef4444';
      svg += '<line x1="'+lx+'" y1="'+uy(ueSafe)+'" x2="'+rx+'" y2="'+uy(ueSafe)+'" stroke="'+col+'" stroke-width="1.8" stroke-dasharray="5,2"/>';
      svg += '<text x="'+(rx-3)+'" y="'+(uy(ueSafe)-4)+'" text-anchor="end" font-size="7.5" font-weight="bold" fill="'+col+'">UE='+f(ueSafe,1)+'V</text>';
    }
    svg += '</svg>';
    return svg;
  }

  // ── G Kesit Eğrisi (sadece arazi/OG) ─────────────────────────
  function makeGSvg(t_val, Ik1A) {
    const KC = [{k:180,c:'#1e3a5f',d:''},{k:143,c:'#3b82f6',d:'6,3'},{k:115,c:'#10b981',d:'3,3'},{k:76,c:'#f59e0b',d:'8,3,2,3'}];
    const W=420, H=170, lx=46, rx=412, ty=18, by=148;
    const tx = tv => lx + (Math.log10(tv)-Math.log10(0.05))/(Math.log10(10)-Math.log10(0.05))*(rx-lx);
    const gy = gv => by - (Math.log10(Math.min(Math.max(gv,10),2000))-Math.log10(10))/(Math.log10(2000)-Math.log10(10))*(by-ty);
    const tSafe = Math.max(0.05, Math.min(t_val||1, 10));
    const G_hesap = Ik1A > 0 ? Ik1A / Math.sqrt(tSafe) : 0;
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">';
    svg += '<text x="'+W/2+'" y="13" text-anchor="middle" font-size="9" font-weight="bold" fill="#334155">G — İletken Isınma Kapasitesi vs Arıza Süresi t_F</text>';
    [10,20,40,80,150,300,600,1000,2000].forEach(g => {
      svg += '<line x1="'+lx+'" y1="'+gy(g)+'" x2="'+rx+'" y2="'+gy(g)+'" stroke="#e2e8f0" stroke-width="0.5"/>';
      svg += '<text x="'+(lx-3)+'" y="'+(gy(g)+3)+'" text-anchor="end" font-size="6" fill="#94a3b8">'+g+'</text>';
    });
    [0.06,0.1,0.2,0.4,0.6,1,2,4,6,10].forEach(tv => {
      svg += '<line x1="'+tx(tv)+'" y1="'+ty+'" x2="'+tx(tv)+'" y2="'+by+'" stroke="#e2e8f0" stroke-width="0.5"/>';
      svg += '<text x="'+tx(tv)+'" y="'+(H-8)+'" text-anchor="middle" font-size="6" fill="#94a3b8">'+tv+'</text>';
    });
    svg += '<line x1="'+lx+'" y1="'+ty+'" x2="'+lx+'" y2="'+by+'" stroke="#94a3b8" stroke-width="1"/>';
    svg += '<line x1="'+lx+'" y1="'+by+'" x2="'+rx+'" y2="'+by+'" stroke="#94a3b8" stroke-width="1"/>';
    KC.forEach((c, ci) => {
      let pts = [];
      for (let i=0; i<=70; i++) {
        const tv = Math.pow(10, Math.log10(0.05) + i/70*(Math.log10(10)-Math.log10(0.05)));
        const gv = c.k / Math.sqrt(tv);
        if (gv >= 10 && gv <= 3000) pts.push(tx(tv).toFixed(1)+','+gy(gv).toFixed(1));
      }
      svg += '<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+c.c+'" stroke-width="'+(c.k===115?2.5:1.8)+'" stroke-dasharray="'+c.d+'" stroke-linejoin="round"/>';
      svg += '<text x="'+(lx+3)+'" y="'+(ty+14+ci*12)+'" font-size="6.5" fill="'+c.c+'">'+(ci+1)+' k='+c.k+'</text>';
    });
    // t çizgisi
    svg += '<line x1="'+tx(tSafe)+'" y1="'+ty+'" x2="'+tx(tSafe)+'" y2="'+by+'" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="4,2"/>';
    svg += '<text x="'+(tx(tSafe)+4)+'" y="'+(ty+10)+'" font-size="7.5" fill="#dc2626" font-weight="bold">t='+tSafe+'s</text>';
    if (G_hesap > 10 && G_hesap < 2000) {
      svg += '<circle cx="'+tx(tSafe)+'" cy="'+gy(G_hesap)+'" r="4.5" fill="#ef4444" stroke="white" stroke-width="1.5"/>';
      svg += '<text x="'+(tx(tSafe)+6)+'" y="'+(gy(G_hesap)+3)+'" font-size="7.5" font-weight="bold" fill="#dc2626">G='+G_hesap.toFixed(0)+'</text>';
    }
    svg += '</svg>';
    return svg;
  }

  // ── Kontrol kutusu ─────────────────────────────────────────────
  function okBox(ok, lbl, val, op, lim, unit, sub) {
    const bg  = ok ? '#f0fdf4' : '#fef2f2';
    const bor = ok ? '#16a34a' : '#dc2626';
    const badgeBg = ok ? '#dcfce7' : '#fee2e2';
    const badgeCol = ok ? '#166534' : '#991b1b';
    const valCol = ok ? '#15803d' : '#dc2626';
    const valStr = typeof val === 'number' ? val.toFixed(2) : val;
    const limStr = typeof lim === 'number' ? lim.toFixed(2) : lim;
    return '<div style="border:2px solid '+bor+';background:'+bg+';border-radius:8px;padding:10px;margin:8px 0">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<div><div style="font-size:10px;font-weight:700;color:#1e293b">'+lbl+'</div>'
      + (sub ? '<div style="font-size:9px;color:#64748b;font-family:monospace;margin-top:2px">'+sub+'</div>' : '')
      + '</div>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 10px;border-radius:4px;background:'+badgeBg+';color:'+badgeCol+'">'+(ok?'✓ UYGUN':'✗ UYGUN DEĞİL')+'</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center">'
      + '<div style="text-align:center;padding:8px;border-radius:6px;background:'+badgeBg+'">'
      + '<div style="font-size:8px;color:#64748b;margin-bottom:2px">Hesaplanan</div>'
      + '<div style="font-size:20px;font-weight:900;font-family:monospace;color:'+valCol+'">'+valStr+' <span style="font-size:12px">'+unit+'</span></div>'
      + '</div>'
      + '<div style="font-size:22px;font-weight:900;color:'+bor+'">'+op+'</div>'
      + '<div style="text-align:center;padding:8px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">'
      + '<div style="font-size:8px;color:#64748b;margin-bottom:2px">Sınır</div>'
      + '<div style="font-size:20px;font-weight:900;font-family:monospace;color:#334155">'+limStr+' <span style="font-size:12px">'+unit+'</span></div>'
      + '</div>'
      + '</div></div>';
  }

  // ── Sayfa içeriği ─────────────────────────────────────────────
  const rLabels = ['Sadece havai hat (r=0.60)', 'Karma havai+yer altı (r=0.45)', 'Sadece yer altı kablo (r=0.30)'];
  const Ik1A = (inputs.Ik1||0) * 1000;
  const t_val = inputs.t || 1;
  const utp_val = res.Utp || 100;
  const ue_val = res.UE || 0;

  let body = '';

  if (isArazi) {
    // ── ARAZI / OG RAPORU ─────────────────────────────────────

    // Birim tablosu satırları
    let birimRows = '';
    if (res.sahaSon) {
      const s = res.sahaSon;
      birimRows += '<tr style="background:#f0fdf4"><td><b>' + (inputs.saha&&inputs.saha.isim ? inputs.saha.isim : 'GES Santral Sahası') + '</b></td>'
        + '<td class="mono">' + f(s.Rg) + '</td>'
        + '<td class="mono">' + f(s.Rc) + '</td>'
        + '<td class="mono"><b>' + f(s.Res) + '</b></td>'
        + '<td style="font-size:8px">Rg∥Rç × 1.10</td></tr>';
    }
    (res.koskSon||[]).forEach((ks, i) => {
      const isim = inputs.koskler&&inputs.koskler[i]&&inputs.koskler[i].isim ? inputs.koskler[i].isim : 'Trafo Köşkü '+(i+1);
      birimRows += '<tr><td><b>' + isim + '</b></td>'
        + '<td class="mono">' + f(ks&&ks.Rg) + '</td>'
        + '<td class="mono">' + f(ks&&ks.Rc) + '</td>'
        + '<td class="mono"><b>' + f(ks&&ks.Res) + '</b></td>'
        + '<td style="font-size:8px">Rg∥Rç × 1.10</td></tr>';
    });

    const parallelArr = [res.sahaSon&&res.sahaSon.Res, ...(res.koskSon||[]).map(k=>k&&k.Res)].filter(Boolean);
    const parallelFormula = parallelArr.map(v=>'1/'+f(v,3)).join(' + ');

    const utpSvg = makeUtpSvg(t_val, utp_val, ue_val, res.dok_ok);
    const gSvg   = makeGSvg(t_val, Ik1A);
    const r_val  = [0.6, 0.45, 0.3][inputs.rIdx||2];

    body = ''
      // Bölüm 1
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#065f46;border-bottom:2px solid #065f46;padding-bottom:4px">1.  GİRİŞ VERİLERİ — OG TARAFI (ETT Yönetmeliği / IEC EN 50522)</div>'
      + '<table><thead><tr><th>Parametre</th><th>Değer</th><th>Açıklama</th></tr></thead><tbody>'
      + '<tr><td>Sistem</td><td><b>OG — Trafo Merkezi Bağlantılı Arazi GES</b></td><td>ETT Yönetmeliği / IEC EN 50522</td></tr>'
      + '<tr><td>I"k1 Faz-Toprak Akımı</td><td class="mono"><b>'+f(inputs.Ik1,3)+' kA = '+Ik1A.toFixed(0)+' A</b></td><td>OG kısa devre hesabından</td></tr>'
      + '<tr><td>Hata Temizleme Süresi t</td><td class="mono"><b>'+t_val+' s</b></td><td>Koruma rölesi gecikmesi</td></tr>'
      + '<tr><td>Zemin Özgül Direnci ρE</td><td class="mono"><b>'+(inputs.rho||100)+' Ω·m</b></td><td>Ölçüm veya tablo değeri</td></tr>'
      + '<tr><td>Bölünme Katsayısı r</td><td class="mono"><b>'+r_val+'</b></td><td>'+rLabels[inputs.rIdx||2]+'</td></tr>'
      + '<tr style="background:#d1fae5"><td>It = r × I"k1</td><td class="mono"><b>'+f(res.It,1)+' A</b></td><td>Topraktan geçen arıza akımı</td></tr>'
      + '<tr><td>UTP (t='+t_val+'s)</td><td class="mono"><b>'+utp_val+' V</b></td><td>ETT Yönetmeliği UTP tablosu (IEC 60479)</td></tr>'
      + '<tr><td>Evirici Sayısı (RCD için)</td><td class="mono"><b>'+(inputs.nInv||8)+' adet</b></td><td>Pano başına</td></tr>'
      + '</tbody></table>'

      // Bölüm 2
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#065f46;border-bottom:2px solid #065f46;padding-bottom:4px">2.  TOPRAKLAMA DİRENCİ HESAPLARI</div>'
      + '<div style="font-size:9px;color:#475569;margin-bottom:8px;background:#f8fafc;padding:8px;border-radius:6px;font-family:monospace">'
      + 'A = a×b [m²] &nbsp;|&nbsp; D = √(4A/π) [m] &nbsp;|&nbsp; '
      + 'Rg = ρ/(2D) + ρ/L [Ω] &nbsp;|&nbsp; '
      + 'Rç = [ρ/(2πLç)] × ln(4Lç/dç) / n [Ω] &nbsp;|&nbsp; '
      + 'Reş = (Rg × Rç) / (Rg + Rç) × 1.10 [Ω]'
      + '</div>'
      + '<table><thead><tr><th>Topraklama Birimi</th><th>Rg (Ω)</th><th>Rç (Ω)</th><th>Reş (Ω)</th><th>Yöntem</th></tr></thead>'
      + '<tbody>'+birimRows+'</tbody></table>'
      + '<div style="padding:10px 14px;background:#d1fae5;border:2px solid #10b981;border-radius:8px;font-family:monospace;font-size:12px;margin-top:8px">'
      + '<b>Final Reş = '+f(res.Res,4)+' Ω</b>'
      + (parallelArr.length > 1 ? '&nbsp;&nbsp;→&nbsp;&nbsp;'+parallelFormula+' = '+f(res.Res,4)+' (paralel bağlantı)' : '')
      + '</div>'

      // Bölüm 3 — UTP grafiği + dokunma kontrolü
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#065f46;border-bottom:2px solid #065f46;padding-bottom:4px">3.  DOKUNMA GERİLİMİ KONTROLÜ</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">'
      + '<div>'
      + '<div style="font-size:10px;color:#475569;margin-bottom:8px;font-family:monospace;background:#f8fafc;padding:8px;border-radius:6px">'
      + 'UE = It × Reş = '+f(res.It,1)+' × '+f(res.Res,3)+' = <b>'+f(ue_val,2)+' V</b>'
      + '</div>'
      + okBox(res.dok_ok, 'Dokunma Gerilimi — UE &lt; UTP(t)', ue_val, '&lt;', utp_val, 'V',
             'UE='+f(ue_val,2)+'V '+(res.dok_ok?'&lt;':'&gt;')+' UTP('+t_val+'s)='+utp_val+'V')
      + (res.dok_ok
          ? '<div style="font-size:9px;color:#15803d;margin-top:6px;font-style:italic">✓ Dokunma gerilimi uygun — adım gerilimine bakmaya gerek yok.</div>'
          : '<div style="font-size:9px;color:#dc2626;margin-top:6px">✗ Reş düşürülmeli: daha fazla kazık veya daha büyük saha ağı gerekli.</div>')
      + '</div>'
      + '<div>'+utpSvg+'</div>'
      + '</div>'

      // Bölüm 4 — G grafiği + kesit
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#065f46;border-bottom:2px solid #065f46;padding-bottom:4px">4.  TOPRAKLAMA İLETKENİ MİNİMUM KESİTİ</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">'
      + '<div>'
      + '<div style="font-size:10px;color:#475569;margin-bottom:10px;font-family:monospace;background:#f8fafc;padding:8px;border-radius:6px">'
      + 'S = I"k1 × √t / k&nbsp;&nbsp;[k = 115 A/mm² — çıplak bakır]<br>'
      + 'S = '+Ik1A.toFixed(0)+' × √'+t_val+' / 115 = <b>'+f(res.qH,2)+' mm²</b>'
      + '</div>'
      + '<div style="background:#fef9c3;border:2px solid #eab308;border-radius:8px;padding:10px;text-align:center;margin-bottom:10px">'
      + '<div style="font-size:9px;color:#64748b">Seçilen Standart Kesit</div>'
      + '<div style="font-size:28px;font-weight:900;color:#92400e;font-family:monospace">'+res.qS+' mm²</div>'
      + '<div style="font-size:9px;color:#64748b">ETT Yönetmeliği min. 50 mm² galvaniz şerit</div>'
      + '</div>'
      + '<table style="font-size:9px"><thead><tr><th>Eğri</th><th>Malzeme</th><th>k (A/mm²)</th><th>Son °C</th></tr></thead><tbody>'
      + '<tr><td>1</td><td>Galv. Çelik Şerit</td><td class="mono" style="color:#1e3a5f;font-weight:700">180</td><td>300</td></tr>'
      + '<tr><td>2</td><td>XLPE / EPR Bakır</td><td class="mono" style="color:#3b82f6;font-weight:700">143</td><td>250</td></tr>'
      + '<tr style="background:#d1fae5"><td><b>3</b></td><td><b>Çıplak Bakır / PVC Cu ✓</b></td><td class="mono" style="color:#15803d;font-weight:700">115</td><td>160</td></tr>'
      + '<tr><td>4</td><td>Alüminyum</td><td class="mono" style="color:#d97706;font-weight:700">76</td><td>300</td></tr>'
      + '</tbody></table>'
      + '</div>'
      + '<div>'+gSvg+'</div>'
      + '</div>'

      // Bölüm 5 — RCD
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#065f46;border-bottom:2px solid #065f46;padding-bottom:4px">5.  KAÇAK AKIM RÖLESİ (RCD) KONTROLÜ — Normal İşletme</div>'
      + '<div style="font-size:9px;color:#475569;margin-bottom:6px">TT sistemde UL=50V &nbsp;→&nbsp; Reş × IΔn ≤ 50V &nbsp;→&nbsp; Reş ≤ 50/(n_inv × 0.3A)</div>'
      + okBox(res.rcd_ok,
          'RCD Kontrolü — Reş ≤ 50/('+(inputs.nInv||8)+'×0.3) = '+f(50/((inputs.nInv||8)*0.3),2)+' Ω',
          res.Res, '≤', 50/((inputs.nInv||8)*0.3), 'Ω',
          'Reş='+f(res.Res,3)+'Ω  ≤  50/('+inputs.nInv+'×0.3)='+f(50/((inputs.nInv||8)*0.3),2)+'Ω')

      // Sonuç özet kutuları
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#065f46;border-bottom:2px solid #065f46;padding-bottom:4px">6.  ÖZET SONUÇLAR</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
      + '<div style="background:'+(res.dok_ok?'#f0fdf4':'#fef2f2')+';border:2px solid '+(res.dok_ok?'#16a34a':'#dc2626')+';border-radius:8px;padding:12px;text-align:center">'
      + '<div style="font-size:9px;font-weight:700;color:'+(res.dok_ok?'#166534':'#991b1b')+';text-transform:uppercase;margin-bottom:4px">Dokunma Gerilimi</div>'
      + '<div style="font-size:22px;font-weight:900;font-family:monospace;color:'+(res.dok_ok?'#15803d':'#dc2626')+'">'+f(ue_val,1)+' V</div>'
      + '<div style="font-size:9px;color:#64748b">Sınır: '+utp_val+' V</div>'
      + '</div>'
      + '<div style="background:#eff6ff;border:2px solid #2563eb;border-radius:8px;padding:12px;text-align:center">'
      + '<div style="font-size:9px;font-weight:700;color:#1e40af;text-transform:uppercase;margin-bottom:4px">Final Reş</div>'
      + '<div style="font-size:22px;font-weight:900;font-family:monospace;color:#1e40af">'+f(res.Res,4)+' Ω</div>'
      + '</div>'
      + '<div style="background:#fef9c3;border:2px solid #eab308;border-radius:8px;padding:12px;text-align:center">'
      + '<div style="font-size:9px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:4px">PE İletken</div>'
      + '<div style="font-size:22px;font-weight:900;font-family:monospace;color:#92400e">'+res.qS+' mm²</div>'
      + '</div>'
      + '</div>';

  } else {
    // ── ÇATI / AG RAPORU (TT Sistemi) ──────────────────────────
    const Id    = res.Id || 0;
    const sinir = res.sinir || 0;

    body = ''
      // TT açıklaması
      + '<div style="padding:10px 14px;background:#eff6ff;border:2px solid #2563eb;border-radius:8px;margin-bottom:12px">'
      + '<b style="color:#1e40af">Sistem: TT — AG Bağlantılı Çatı GES (IEC 60364-7-712 / IEC 60364-4-41)</b><br>'
      + '<span style="font-size:9px;color:#475569">Bu tesiste <b>OG kısa devre akımı (I"k1) KULLANILMAZ.</b> '
      + 'AG/TT sistemde koruma RCD ile sağlanır. Arıza akımı = RCD anma kaçak akımı IΔn (mA mertebesi).</span>'
      + '</div>'

      // Bölüm 1
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#0c4a6e;border-bottom:2px solid #0c4a6e;padding-bottom:4px">1.  GİRİŞ VERİLERİ — AG TARAFI / TT Sistemi</div>'
      + '<table><thead><tr><th>Parametre</th><th>Değer</th><th>Açıklama</th></tr></thead><tbody>'
      + '<tr><td>Sistem Tipi</td><td><b>TT (Toprak-Toprak)</b></td><td>IEC 60364-4-41</td></tr>'
      + '<tr><td>RCD Anma Akımı IΔn</td><td class="mono"><b>'+(inputs.iDn||0.3)+' A ('+(inputs.iDn===0.03?'30 mA — hassas':'300 mA — standart')+')</b></td><td>Her evirici için</td></tr>'
      + '<tr><td>Evirici Sayısı</td><td class="mono"><b>'+(inputs.nInvAG||8)+' adet</b></td><td></td></tr>'
      + '<tr style="background:#dbeafe"><td>Toplam Id = n × IΔn</td><td class="mono"><b>'+f(Id,3)+' A</b></td><td>Toplam kaçak akım</td></tr>'
      + '<tr><td>Mevcut Bina Toprağı R_mevcut</td><td class="mono"><b>'+f(inputs.Rmev,3)+' Ω</b></td><td>Ölçülen / verilen değer</td></tr>'
      + (res.Rc ? '<tr><td>İlave Kazık Rç</td><td class="mono"><b>'+f(res.Rc,3)+' Ω</b></td><td>Paralel bağlantı</td></tr>' : '')
      + '<tr style="background:#d1fae5"><td>Final Reş</td><td class="mono"><b>'+f(res.Res,3)+' Ω</b></td><td>Saf paralel (×1.10 uygulanmaz)</td></tr>'
      + '</tbody></table>'

      // Bölüm 2 — Ana Kontrol
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#0c4a6e;border-bottom:2px solid #0c4a6e;padding-bottom:4px">2.  ANA KONTROL — IEC 60364-4-41 Madde 411.5.3</div>'
      + '<div style="font-size:10px;font-family:monospace;background:#f0f9ff;padding:10px;border-radius:6px;margin-bottom:10px">'
      + 'UE = Reş × Id = '+f(res.Res,3)+' × '+f(Id,3)+' = <b>'+f(ue_val,2)+' V</b><br>'
      + 'Reş sınırı = 50V / Id = 50 / '+f(Id,3)+' = <b>'+f(sinir,2)+' Ω</b>'
      + '</div>'
      + okBox(res.dok_ok, 'Dokunma Gerilimi — TT Sistemi Sabit Sınır 50V',
          ue_val, '≤', 50, 'V',
          'UE=Reş×Id='+f(res.Res,3)+'×'+f(Id,3)+'='+f(ue_val,2)+'V ≤ 50V')
      + okBox(res.rcd_ok, 'RCD Koşulu — Reş ≤ 50/Id = '+f(sinir,2)+' Ω (IEC 60364-4-41 md.411.5.3)',
          res.Res, '≤', sinir, 'Ω',
          'Reş='+f(res.Res,3)+'Ω ≤ 50/'+f(Id,3)+'='+f(sinir,2)+'Ω')

      // Bölüm 3 — PE Kesit
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#0c4a6e;border-bottom:2px solid #0c4a6e;padding-bottom:4px">3.  PE İLETKENİ MİNİMUM KESİTİ (IEC 60364-7-712)</div>'
      + '<div style="font-size:10px;color:#475569;margin-bottom:8px">'
      + 'AG/TT tesisinde OG gibi S=I×√t/k hesabı yapılmaz. Arıza akımı RCD ile ms içinde kesilir. '
      + 'IEC 60364-7-712 md.712.54.1 asgari değerleri geçerlidir.'
      + '</div>'
      + '<table><thead><tr><th>İletken / Kullanım</th><th>Min. Kesit</th><th>Standart</th></tr></thead><tbody>'
      + '<tr style="background:#d1fae5"><td><b>PE / Koruma İletkeni</b></td><td class="mono"><b>4 mm² Cu (min.)</b></td><td>IEC 60364-7-712 md.712.54.1</td></tr>'
      + '<tr><td>Eşpotansiyel Bağlantı Şeridi</td><td class="mono"><b>6 mm² Cu</b></td><td>IEC 60364-5-54 md.543.3</td></tr>'
      + '<tr><td>Topraklama Elektrodu İletkeni</td><td class="mono"><b>50 mm² galvaniz şerit</b></td><td>TS EN 50522 min. şerit kesiti</td></tr>'
      + '<tr><td>Çatı Panel Çerçeve Bağlantısı</td><td class="mono"><b>4 mm² Cu</b></td><td>IEC 60364-7-712 md.712.412.1.1</td></tr>'
      + '</tbody></table>'

      // Özet
      + '<div style="margin:14px 0 6px;font-size:13px;font-weight:900;color:#0c4a6e;border-bottom:2px solid #0c4a6e;padding-bottom:4px">4.  ÖZET SONUÇLAR</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
      + '<div style="background:'+(res.dok_ok?'#f0fdf4':'#fef2f2')+';border:2px solid '+(res.dok_ok?'#16a34a':'#dc2626')+';border-radius:8px;padding:12px;text-align:center">'
      + '<div style="font-size:9px;font-weight:700;color:'+(res.dok_ok?'#166534':'#991b1b')+';text-transform:uppercase;margin-bottom:4px">Dokunma Gerilimi UE</div>'
      + '<div style="font-size:22px;font-weight:900;font-family:monospace;color:'+(res.dok_ok?'#15803d':'#dc2626')+'">'+f(ue_val,1)+' V</div>'
      + '<div style="font-size:9px;color:#64748b">Sınır: 50 V (TT sabit)</div>'
      + '</div>'
      + '<div style="background:'+(res.rcd_ok?'#f0fdf4':'#fef2f2')+';border:2px solid '+(res.rcd_ok?'#16a34a':'#dc2626')+';border-radius:8px;padding:12px;text-align:center">'
      + '<div style="font-size:9px;font-weight:700;color:'+(res.rcd_ok?'#166534':'#991b1b')+';text-transform:uppercase;margin-bottom:4px">Final Reş</div>'
      + '<div style="font-size:22px;font-weight:900;font-family:monospace;color:'+(res.rcd_ok?'#15803d':'#dc2626')+'">'+f(res.Res,3)+' Ω</div>'
      + '<div style="font-size:9px;color:#64748b">Sınır: '+f(sinir,2)+' Ω</div>'
      + '</div>'
      + '<div style="background:#eff6ff;border:2px solid #2563eb;border-radius:8px;padding:12px;text-align:center">'
      + '<div style="font-size:9px;font-weight:700;color:#1e40af;text-transform:uppercase;margin-bottom:4px">Toplam Kaçak Akım Id</div>'
      + '<div style="font-size:22px;font-weight:900;font-family:monospace;color:#1e40af">'+f(Id,3)+' A</div>'
      + '<div style="font-size:9px;color:#64748b">'+(inputs.nInvAG||8)+'×'+(inputs.iDn||0.3)+'A</div>'
      + '</div>'
      + '</div>';
  }

  // ── Kapak ─────────────────────────────────────────────────────
  const header =
    '<table style="margin-bottom:12px;font-size:11px"><tr>'
    + '<td style="width:55%;vertical-align:top;padding:0">'
    + '<div style="background:#065f46;color:white;padding:10px 14px;border-radius:6px 6px 0 0"><div style="font-size:16px;font-weight:900">GridMaster</div><div style="font-size:10px;opacity:.8;margin-top:2px">Elektrik Mühendisliği Hesap Platformu</div></div>'
    + '<div style="background:#ecfdf5;padding:8px 14px;border:1px solid #a7f3d0;border-top:none">'
    + '<div style="font-size:14px;font-weight:900;color:#065f46">GES TOPRAKLAMA VE DOKUNMA GERİLİMİ</div>'
    + '<div style="font-size:10px;color:#475569;margin-top:2px">'+(isArazi?'OG Tarafı — ETT Yönetmeliği / IEC EN 50522':'AG Tarafı — IEC 60364-7-712 / TT Sistemi')+'</div>'
    + '</div></td>'
    + '<td style="width:45%;vertical-align:top;padding:0">'
    + '<table style="width:100%;font-size:10px;margin:0;border:1px solid #a7f3d0">'
    + '<tr><td style="padding:3px 8px;background:#ecfdf5;font-weight:700">Standart</td><td>'+(isArazi?'ETT Yönetmeliği / IEC EN 50522':'IEC 60364-7-712 / IEC 60364-4-41')+'</td></tr>'
    + '<tr><td style="padding:3px 8px;background:#ecfdf5;font-weight:700">Tarih</td><td>'+tarih+' '+saat+'</td></tr>'
    + '<tr><td style="padding:3px 8px;background:#ecfdf5;font-weight:700">GES Tipi</td><td style="font-weight:700">'+(isArazi?'Arazi GES (OG bağlantılı)':'Çatı GES (AG / TT sistemi)')+'</td></tr>'
    + '<tr><td style="padding:3px 8px;background:#ecfdf5;font-weight:700">Final Reş</td><td class="mono" style="font-weight:700">'+f(res.Res,4)+' Ω</td></tr>'
    + '<tr><td style="padding:3px 8px;background:#ecfdf5;font-weight:700">Genel Sonuç</td><td style="font-weight:700;color:'+(res.dok_ok&&res.rcd_ok?'#15803d':'#dc2626')+'">'+(res.dok_ok&&res.rcd_ok?'✓ SİSTEM UYGUN':'✗ UYGUNSUZLUK VAR')+'</td></tr>'
    + '</table></td></tr></table>';

  // ── Pencere aç ─────────────────────────────────────────────────
  const win = window.open('', '_blank', 'width=1200,height=900');
  win.document.write(
    '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">'
    + '<title>GES Topraklama — '+(isArazi?'OG Arazi':'AG Çatı')+'</title>'
    + '<style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:"Segoe UI",Arial,sans-serif;font-size:9.5px;color:#1e293b;background:white;padding:14px}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:9px}'
    + 'th{background:#065f46;color:white;padding:4px 7px;text-align:left;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.3px}'
    + 'td{padding:3px 7px;border-bottom:1px solid #e2e8f0;vertical-align:middle}'
    + 'tr:nth-child(even) td{background:#f8fafc}'
    + '.mono{font-family:"Consolas","Courier New",monospace}'
    + '.toolbar{position:fixed;top:10px;right:10px;display:flex;gap:8px;z-index:9999;background:white;padding:8px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.15)}'
    + '.btn{padding:8px 18px;border:none;border-radius:7px;font-weight:700;cursor:pointer;font-size:11px}'
    + '@media print{.toolbar{display:none!important}body{padding:6px}@page{margin:8mm;size:A4}svg{max-width:100%!important;height:auto!important}}'
    + '</style></head><body>'
    + '<div class="toolbar">'
    + '<button class="btn" style="background:#065f46;color:white" onclick="window.print()">🖨 PDF Yazdır</button>'
    + '<button class="btn" style="background:#166534;color:white" onclick="dlWord()">📄 Word İndir</button>'
    + '</div>'
    + header + body
    + '<div style="margin-top:12px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between">'
    + '<span>GridMaster — Elektrik Mühendisliği Hesap Platformu</span>'
    + '<span>'+(isArazi?'ETT Yönetmeliği / IEC EN 50522':'IEC 60364-7-712 / IEC 60364-4-41')+' · '+tarih+'</span>'
    + '</div>'
    + '<scr'+'ipt>'
    + 'function dlWord(){'
    + 'var bc=document.body.cloneNode(true);'
    + 'bc.querySelector(".toolbar")&&bc.querySelector(".toolbar").remove();'
    + 'var h="<!DOCTYPE html><html><head><meta charset=UTF-8><style>body{font-family:Arial,font-size:10pt}table{border-collapse:collapse;width:100%}th{background:#065f46;color:white;padding:4pt 7pt;font-size:8pt;text-align:left}td{padding:3pt 7pt;border:1px solid #ccc}tr:nth-child(even)td{background:#f9f9f9}.mono{font-family:Courier}svg{max-width:100%}</style></head><body>"+bc.innerHTML+"</body></html>";'
    + 'var b=new Blob([h],{type:"application/vnd.ms-word"});'
    + 'var u=URL.createObjectURL(b);var a=document.createElement("a");'
    + 'a.href=u;a.download="GES_Topraklama_'+(isArazi?'OG_Arazi':'AG_Cati')+'.doc";'
    + 'document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);'
    + '}'
    + '</scr'+'ipt>'
    + '</body></html>'
  );
  win.document.close();
}


// ─── GES TOPRAKLAMA WORD (docx) ───────────────────────────────────
export async function exportGesTopraklamaWord(inputs, res) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak
  } = await import('docx');
  const f=(n,d=3)=>(typeof n==='number'&&isFinite(n))?n.toFixed(d):'—';
  const isArazi=res.mod==='arazi';
  const now=new Date();
  const tarih=now.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const sb=(c='AAAAAA')=>({style:BorderStyle.SINGLE,size:4,color:c});
  const ab=()=>({top:sb(),bottom:sb(),left:sb(),right:sb()});
  function mc(text,{bold=false,fill='FFFFFF',tc='222222',align=AlignmentType.LEFT,colspan=1}={}){
    return new TableCell({columnSpan:colspan,borders:ab(),shading:{fill,type:ShadingType.CLEAR},
      margins:{top:55,bottom:55,left:100,right:100},
      children:[new Paragraph({alignment:align,children:[new TextRun({text:String(text),bold,color:tc,font:'Arial',size:19})]})]});
  }
  const hRow=(labels,widths)=>new TableRow({tableHeader:true,children:labels.map((l,i)=>mc(l,{bold:true,fill:'1F5C99',tc:'FFFFFF'}))});
  const dRow=(...cells)=>new TableRow({children:cells});
  const okC=(ok)=>mc(ok?'✓  UYGUN':'✗  UYGUN DEĞİL',{bold:true,align:AlignmentType.CENTER,fill:ok?'C6EFCE':'FFC7CE',tc:ok?'276221':'9C0006'});
  const hdg=text=>new Paragraph({spacing:{before:280,after:120},
    border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'1F5C99',space:2}},
    children:[new TextRun({text,bold:true,font:'Arial',size:26,color:'1F5C99'})]});
  const ln=(t,bold=false)=>new Paragraph({spacing:{before:40,after:40},children:[new TextRun({text:t,bold,font:'Arial',size:19})]});
  const fml=t=>new Paragraph({spacing:{before:28,after:28},indent:{left:500},children:[new TextRun({text:t,font:'Courier New',size:18,color:'1F5C99'})]});
  const bl=()=>new Paragraph({spacing:{before:40,after:40},children:[]});
  const pg=()=>new Paragraph({children:[new PageBreak()]});

  const Ik1A=(inputs.Ik1||0)*1000;

  const children=[
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:200,after:60},
      children:[new TextRun({text:'GES TOPRAKLAMA VE DOKUNMA GERİLİMİ HESABI',bold:true,font:'Arial',size:30,color:'1F5C99'})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:300},
      border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'1F5C99',space:2}},
      children:[new TextRun({text:`${isArazi?'Arazi GES — OG Taraf — ETT Yönetmeliği':'Çatı GES — AG TT Sistemi — IEC 60364-4-41'}  —  ${tarih}`,font:'Arial',size:20,color:'555555'})]}),

    hdg('1.  GİRİŞ VERİLERİ'),bl(),
    new Table({width:{size:9100,type:WidthType.DXA},columnWidths:[3800,2600,2700],
      rows:[
        hRow(['Parametre','Değer','Açıklama'],[]),
        isArazi?[
          dRow(mc('Arıza Akımı Türü'),mc('I"k1 — OG Faz-Toprak Kısa Devre',{bold:true}),mc('OG modülünden')),
          dRow(mc('I"k1'),mc(`${f(inputs.Ik1,3)} kA = ${Ik1A.toFixed(0)} A`,{bold:true}),mc('')),
          dRow(mc('Arıza Süresi t'),mc(`${inputs.t} s`,{bold:true}),mc('Koruma rölesi')),
          dRow(mc('Bölünme Katsayısı r'),mc(`r = ${[.6,.45,.3][inputs.rIdx||2]}`,{bold:true}),mc(['Havai hat','Karma','Yer altı kablo'][inputs.rIdx||2])),
          dRow(mc('It = r × I"k1'),mc(`${f(res.It,1)} A`,{bold:true,fill:'D6E4F0'}),mc('')),
          dRow(mc('Zemin ρE'),mc(`${inputs.rho} Ω·m`,{bold:true}),mc('')),
          dRow(mc(`UTP(${inputs.t}s)`),mc(`${res.Utp} V`,{bold:true}),mc('ETT UTP tablosu')),
        ]:[ 
          dRow(mc('Arıza Akımı Türü'),mc('IΔn — RCD Kaçak Akımı (I"k1 değil)',{bold:true}),mc('AG TT sistemi')),
          dRow(mc('RCD Anma Akımı IΔn'),mc(`${inputs.iDn} A`,{bold:true}),mc(inputs.iDn===.03?'30 mA hassas':'300 mA standart')),
          dRow(mc('Evirici Sayısı'),mc(`${inputs.nInvAG} adet`,{bold:true}),mc('')),
          dRow(mc('Toplam Id = n × IΔn'),mc(`${(inputs.nInvAG*inputs.iDn).toFixed(3)} A`,{bold:true,fill:'D6E4F0'}),mc('')),
          dRow(mc('Zemin ρE'),mc(`${inputs.rho} Ω·m`,{bold:true}),mc(inputs.cKazik?.aktif?'Kazık hesabı için':'')),
          dRow(mc('TT Sistem Sınırı'),mc('50 V (sabit)',{bold:true}),mc('IEC 60364-4-41 md.411.5.3')),
        ].flat(),
      ].flat()
    }),

    bl(),pg(),

    hdg('2.  TOPRAKLAMA DİRENCİ HESAPLARI'),bl(),
    ...(isArazi?[
      ln('Formüller (ETT Yönetmeliği sf.83 / Schwarz):'),
      fml('D = √(4A/π)  |  Rg = ρ/(2D) + ρ/L  |  Rç = Rç_tek/n  |  Reş = (Rg×Rç)/(Rg+Rç) × 1.10'),bl(),
      new Table({width:{size:9100,type:WidthType.DXA},columnWidths:[2500,1600,1600,1600,1800],
        rows:[
          hRow(['Birim','Rg (Ω)','Rç (Ω)','Reş (Ω)','Yöntem'],[]),
          dRow(mc(inputs.saha?.isim||'Saha',{bold:true}),mc(f(res.sahaSon?.Rg),{align:AlignmentType.CENTER}),mc(f(res.sahaSon?.Rc),{align:AlignmentType.CENTER}),mc(f(res.sahaSon?.Res),{bold:true,align:AlignmentType.CENTER,fill:'D6E4F0'}),mc('Rg∥Rç×1.10')),
          ...(res.koskSon||[]).map((ks,i)=>dRow(mc(inputs.koskler?.[i]?.isim||`Köşk ${i+1}`,{bold:true}),mc(f(ks?.Rg),{align:AlignmentType.CENTER}),mc(f(ks?.Rc),{align:AlignmentType.CENTER}),mc(f(ks?.Res),{bold:true,align:AlignmentType.CENTER,fill:'D6E4F0'}),mc('Rg∥Rç×1.10'))),
        ]
      }),
      bl(),
      ln(`Final Reş = paralel(${[res.sahaSon?.Res,...(res.koskSon||[]).map(k=>k?.Res)].filter(Boolean).map(v=>v?.toFixed(3)).join(', ')}) = ${f(res.Res,4)} Ω`,true),
    ]:[
      new Table({width:{size:9100,type:WidthType.DXA},columnWidths:[3000,2000,4100],
        rows:[
          hRow(['Eleman','Değer (Ω)','Açıklama'],[]),
          dRow(mc('Mevcut Bina Toprağı',{bold:true}),mc(f(inputs.Rmev),{bold:true,align:AlignmentType.CENTER,fill:'D6E4F0'}),mc('Ölçülen değer')),
          ...(res.Rc!=null?[dRow(mc(`İlave Kazık (${inputs.cKazik?.n} adet)`,{bold:true}),mc(f(res.Rc),{bold:true,align:AlignmentType.CENTER,fill:'D6E4F0'}),mc('Paralel kazıklar'))]:[]),
        ]
      }),
      bl(),ln(`Final Reş = ${f(res.Res,4)} Ω (saf paralel — ×1.10 uygulanmaz)`,true),
    ]),

    bl(),pg(),

    ...(isArazi?[
      hdg('3.  DOKUNMA GERİLİMİ — ETT YÖNETMELİĞİ'),bl(),
      fml(`UE = It × Reş = ${f(res.It,1)} × ${f(res.Res,3)} = ${f(res.UE,2)} V`),
      bl(),
      new Table({width:{size:9100,type:WidthType.DXA},columnWidths:[2500,1600,1600,3400],
        rows:[
          hRow(['Kontrol','Hesaplanan','Sınır','Sonuç'],[]),
          dRow(mc(`Dokunma Gerilimi — t=${inputs.t}s`),mc(`${f(res.UE,2)} V`,{align:AlignmentType.CENTER}),mc(`${res.Utp} V`,{align:AlignmentType.CENTER}),okC(res.dok_ok)),
          dRow(mc(`Adım Gerilimi — t=${inputs.t}s`),mc(`${f(res.Ua,1)} V`,{align:AlignmentType.CENTER}),mc('200 V',{align:AlignmentType.CENTER}),okC(res.adim_ok)),
        ]
      }),bl(),

      hdg('4.  İLETKEN KESİTİ — ETT'),bl(),
      fml(`S = I"k1 × √t / k = ${Ik1A.toFixed(0)} × √${inputs.t} / 115 = ${f(res.qH,2)} mm²`),
      ln(`Seçilen: ${res.qS} mm² (ETT min. 50 mm² galvaniz şerit)`,true),bl(),

      hdg('5.  RCD KONTROLÜ — OG Normal İşletme'),bl(),
      fml(`Reş ≤ 50/(${inputs.nInv}×0.3) = ${(50/(inputs.nInv*.3)).toFixed(2)} Ω`),
      new Table({width:{size:9100,type:WidthType.DXA},columnWidths:[3000,1800,1800,2500],
        rows:[
          hRow(['Kontrol','Reş (Ω)','Eşik (Ω)','Sonuç'],[]),
          dRow(mc(`${inputs.nInv} evirici × 0.3A/inv`),mc(f(res.Res,3),{align:AlignmentType.CENTER}),mc((50/(inputs.nInv*.3)).toFixed(2),{align:AlignmentType.CENTER}),okC(res.rcd_ok)),
        ]
      }),
    ]:[
      hdg('3.  DOKUNMA GERİLİMİ & RCD — AG TT SİSTEMİ'),bl(),
      ln('Standart: IEC 60364-7-712 / IEC 60364-4-41 md.411.5.3',true),
      fml(`UE = Reş × Id = ${f(res.Res,3)} × ${f(res.Id,3)} = ${f(res.UE,2)} V`),
      fml(`Reş sınırı = 50 / Id = 50 / ${f(res.Id,3)} = ${f(res.sinir,2)} Ω`),
      bl(),
      new Table({width:{size:9100,type:WidthType.DXA},columnWidths:[3500,1500,1500,2600],
        rows:[
          hRow(['Kontrol','Hesaplanan','Sınır','Sonuç'],[]),
          dRow(mc('Dokunma Gerilimi UE ≤ 50V'),mc(`${f(res.UE,2)} V`,{align:AlignmentType.CENTER}),mc('50 V',{align:AlignmentType.CENTER}),okC(res.dok_ok)),
          dRow(mc(`RCD Koşulu — Reş ≤ ${f(res.sinir,2)} Ω`),mc(f(res.Res,3),{align:AlignmentType.CENTER}),mc(f(res.sinir,2),{align:AlignmentType.CENTER}),okC(res.rcd_ok)),
        ]
      }),bl(),
      ln('AG tesisinde I"k1 ile iletken kesit hesabı yapılmaz.'),
      ln('Minimum PE iletken kesiti: 4 mm² Cu (IEC 60364-7-712 Tablo 712.54.1)'),
    ]),

    bl(),
    ln(`Toplam Sonuç: ${res.dok_ok&&res.rcd_ok?'✓ Topraklama sistemi UYGUNDUR.':'✗ Uyumsuzluk tespit edildi — kırmızı satırları inceleyin.'}`,true),
  ];

  const doc=new Document({
    styles:{default:{document:{run:{font:'Arial',size:19}}}},
    sections:[{
      properties:{page:{size:{width:11906,height:16838},margin:{top:1000,right:900,bottom:1000,left:900}}},
      children
    }]
  });

  const blob=await Packer.toBlob(doc);
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`GES_Topraklama_${isArazi?'Arazi_OG':'Cati_AG'}.docx`;
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
}
