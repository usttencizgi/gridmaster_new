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

  // ─── BUS TABLOSU ───
  const busRows = [
    { id: '154 kV Şebeke', type: 'Güç Şebekesi', kv: '154.000', base: '154.000' },
    { id: '34.5 kV Barası', type: 'Bara (Swing)', kv: '34.500',  base: '34.500'  },
    ...lines.map((l, i) => ({ id: `Hat ${i+1} Sonu`, type: 'Yük Barası', kv: '34.500', base: '34.500' })),
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
  const cableTableRows = (result.lineDetails || []).map(d => `
    <tr>
      <td><b>${d.idx}. Hat</b></td>
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

  // ─── ŞEMA SVG oluştur (zigzag) ───────────────────────────────
  const PER_COL = 5;
  const numCols = Math.ceil(lines.length / PER_COL);
  const perCol  = Math.ceil(lines.length / numCols);
  const SCH_W   = 680, COL_W = Math.min(155, (SCH_W-40)/numCols);
  const ROW_H   = 95, TOP = 190;
  const SCH_H   = TOP + perCol * ROW_H + 50;
  const BARA_X  = 40 + (numCols * COL_W)/2;

  const schPos = lines.map((_, i) => {
    const col = Math.floor(i / perCol);
    const rowInCol = i % perCol;
    const row = col % 2 === 0 ? rowInCol : (perCol - 1 - rowInCol);
    const cx = 40 + col * COL_W + COL_W/2;
    const cy = TOP + row * ROW_H + 35;
    return { col, row, cx, cy };
  });

  const Zb2 = 11.9025, Ib2 = 1673.5;
  let cumZ2 = result.zBaraPu || 0;
  const ik3vals = (result.lineDetails||[]).map(d => {
    cumZ2 += (d.Z_seg_ohm||0)/Zb2;
    return cumZ2 > 0 ? (1.10*Ib2/cumZ2/1000) : 0;
  });

  const schemaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SCH_W}" height="${SCH_H}" viewBox="0 0 ${SCH_W} ${SCH_H}" style="background:white;border:1px solid #e2e8f0;border-radius:6px">
  <circle cx="${BARA_X}" cy="28" r="14" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="2"/>
  <text x="${BARA_X}" y="25" text-anchor="middle" font-size="7" font-weight="bold" fill="#7c3aed">154kV</text>
  <text x="${BARA_X+18}" y="24" font-size="9" font-weight="bold" fill="#1e293b">${sourceName}</text>
  <line x1="${BARA_X}" y1="42" x2="${BARA_X}" y2="80" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2"/>
  <rect x="${BARA_X-20}" y="80" width="40" height="28" rx="4" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.5"/>
  <text x="${BARA_X}" y="91" text-anchor="middle" font-size="7" font-weight="bold" fill="#5b21b6">34.5kV</text>
  <text x="${BARA_X}" y="102" text-anchor="middle" font-size="7" fill="#5b21b6">TRAFO</text>
  <line x1="${BARA_X}" y1="108" x2="${BARA_X}" y2="135" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2"/>
  <line x1="25" y1="138" x2="${SCH_W-25}" y2="138" stroke="#1e293b" stroke-width="5" stroke-linecap="round"/>
  <text x="${BARA_X}" y="128" text-anchor="middle" font-size="8" font-weight="bold" fill="#1e293b">34.5 kV Barası</text>
  <text x="${BARA_X}" y="153" text-anchor="middle" font-size="8" font-weight="bold" fill="#6d28d9">I₃k=${result.busbarCurrent.toFixed(2)}kA${result.Ik1_bara>0?' | I₁k='+result.Ik1_bara.toFixed(2)+'kA':''}</text>
  ${lines.map((line, i) => {
    const p = schPos[i], cab = cables.find(c=>c.id===line.cableTypeId);
    const n = line.circuitCount||1, ik = ik3vals[i]||0;
    let prevX, prevY;
    if (i===0) { prevX=40+schPos[0].col*COL_W+COL_W/2; prevY=138; }
    else { prevX=schPos[i-1].cx; prevY=schPos[i-1].cy; }
    const sameCol = i>0 && schPos[i-1].col===p.col;
    const colChg  = i>0 && schPos[i-1].col!==p.col;
    const lbl = line.name || `Hat ${i+1}`;
    return `
    ${i===0?`<line x1="${40+COL_W/2}" y1="138" x2="${40+COL_W/2}" y2="${p.cy-24}" stroke="#334155" stroke-width="1.5"/>`:''}
    ${sameCol?`<line x1="${prevX}" y1="${prevY}" x2="${p.cx}" y2="${p.cy-24}" stroke="#334155" stroke-width="1.5" ${n>1?'stroke-dasharray="4,2"':''}/>`:``}
    ${colChg?`<path d="M ${prevX} ${prevY} L ${prevX} ${p.cy} L ${p.cx} ${p.cy}" fill="none" stroke="#334155" stroke-width="1.5" stroke-linejoin="round"/>`:``}
    <rect x="${p.cx-30}" y="${p.cy-48}" width="60" height="22" rx="3" fill="#e0f2fe" stroke="#0284c7" stroke-width="1"/>
    <text x="${p.cx}" y="${p.cy-38}" text-anchor="middle" font-size="6" font-weight="bold" fill="#0369a1">${cab?.name||'?'}</text>
    <text x="${p.cx}" y="${p.cy-29}" text-anchor="middle" font-size="6" fill="#0369a1">${line.length}km${n>1?' ×'+n:''}</text>
    <circle cx="${p.cx}" cy="${p.cy}" r="4.5" fill="#475569"/>
    ${p.col%2===0
      ? `<text x="${p.cx+7}" y="${p.cy+4}" font-size="7.5" font-weight="bold" fill="#1e293b">${lbl}</text>`
      : `<text x="${p.cx-7}" y="${p.cy+4}" text-anchor="end" font-size="7.5" font-weight="bold" fill="#1e293b">${lbl}</text>`}
    ${ik>0?`<text x="${p.cx}" y="${p.cy+14}" text-anchor="middle" font-size="7" fill="#7c3aed" font-weight="bold">${ik.toFixed(2)}kA</text>`:''}`;
  }).join('')}
  </svg>`;

  const html = `
    <!-- KAPAK BAŞLIĞI -->
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
    <div style="margin-bottom:12px">${schemaSvg}</div>

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

    <!-- SONUÇ KUTUSU -->
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="background:#eff6ff;border:2px solid #3b82f6;border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#1e40af;margin-bottom:6px;text-transform:uppercase">34.5 kV Barası — Üç-Faz Kısa Devre</div>
        <div style="font-family:monospace">
          <div>I&quot;k = <b style="font-size:16px;color:#1e40af">${fmt(result.busbarCurrent,3)} kA</b></div>
          <div style="margin-top:4px">ip  = ${fmt(result.ip_bara,3)} kA &nbsp;(κ×√2×I&quot;k)</div>
          <div style="margin-top:2px">Z+  = ${fmt(result.Z1_bara_ohm,4)} Ω</div>
          <div style="margin-top:2px">Zb  = ${fmt(Zb,4)} Ω &nbsp;|&nbsp; Ib = ${fmt(Ib,1)} A</div>
        </div>
      </div>
      <div style="background:#faf5ff;border:2px solid #a855f7;border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:6px;text-transform:uppercase">Hat Zinciri Sonu — Üç-Faz Kısa Devre</div>
        <div style="font-family:monospace">
          <div>I&quot;k = <b style="font-size:16px;color:#7c3aed">${fmt(result.lineEndCurrent,3)} kA</b></div>
          <div style="margin-top:4px">ip  = ${fmt(result.ip_end,3)} kA</div>
          <div style="margin-top:2px">Z+  = ${fmt(result.Z1_end_ohm,4)} Ω</div>
          <div style="margin-top:2px">${lines.length} hat, toplam ${lines.reduce((a,l)=>a+l.length,0).toFixed(2)} km</div>
        </div>
      </div>
    </div>
  `;

  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  printWindow.document.write(`
    <!DOCTYPE html><html lang="tr"><head>
    <meta charset="UTF-8">
    <title>OG Kısa Devre Raporu — ${sourceName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1e293b;background:white;padding:18px}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9.5px}
      th{background:#1e3a5f;color:white;padding:5px 7px;text-align:left;font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.4px}
      td{padding:4px 7px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
      tr:nth-child(even) td{background:#f8fafc}
      .mono{font-family:'Consolas','Courier New',monospace}
      .footer{margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between}
      @media print{
        body{padding:8px}
        @page{margin:10mm;size:A4 landscape}
        table{page-break-inside:auto}
        tr{page-break-inside:avoid;page-break-after:auto}
      }
    </style></head><body>
    ${html}
    <div class="footer">
      <span>GridMaster — Elektrik Mühendisliği Hesap Platformu</span>
      <span>IEC 60909 | Sb=100MVA, Ub=34.5kV, c=${result.c||1.10}, κ=${kappa}</span>
      <span>${dateStr} ${timeStr}</span>
    </div>
    <script>window.onload=()=>{window.print();}<\/script>
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

export function buildOgVoltageDropPDF(nodes, results, cables, metrics) {
  const rows = results.map((r, i) => {
    const n = nodes[i];
    const cable = cables.find(c => c.id === n.cableTypeId);
    const ok = r.isSafeDrop && r.isSafeCurrent;
    return `<tr>
      <td>${n.name}</td><td>${cable?.name || ''}</td><td>${n.length}</td><td>${n.loadKVA}</td>
      <td class="mono">${r.segmentCurrent.toFixed(2)}</td>
      <td class="mono">${r.voltageDropPercent.toFixed(3)}</td>
      <td class="mono"><b>${r.totalDropPercent.toFixed(3)}</b></td>
      <td class="mono">${r.powerLoss.toFixed(2)}</td>
      <td><span class="${ok ? 'badge-ok' : 'badge-fail'}">${ok ? 'UYGUN' : 'UYGUN DEĞİL'}</span></td>
    </tr>`;
  }).join('');

  return `
    <h1>OG Gerilim Düşümü Raporu — 34.5 kV</h1>
    <div class="meta">Max Düşüm: <b>${metrics.maxDrop.toFixed(3)}%</b> &nbsp;|&nbsp; Toplam Kayıp: <b>${metrics.totalPowerLoss.toFixed(2)} kW</b></div>
    <h2>Hat Analizi</h2>
    <table>
      <thead><tr><th>Hat</th><th>Kablo</th><th>Mesafe (km)</th><th>Yük (kVA)</th><th>Akım (A)</th><th>Segm. (%)</th><th>Toplam (%)</th><th>Kayıp (kW)</th><th>Durum</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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
export async function exportGesKabloWord(panel, sistem, dc, strings, ac1, ac2, res) {
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

// ─── GES TOPRAKLAMA WORD EXPORT ───────────────────────────────────
export async function exportGesTopraklamaWord(inputs, res) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak
  } = await import('docx');

  const fmt  = (n, d = 3) => (typeof n === 'number' && !isNaN(n) && isFinite(n)) ? n.toFixed(d) : '—';
  const now  = new Date();
  const tarih = now.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' });

  const BD = '1F5C99', WH = 'FFFFFF', GR = 'C6EFCE', GT = '276221',
        RF = 'FFC7CE', RT = '9C0006', GY = 'F2F2F2', BL = 'D6E4F0';

  const sb = (c = 'AAAAAA') => ({ style: BorderStyle.SINGLE, size: 4, color: c });
  const ab = () => ({ top: sb(), bottom: sb(), left: sb(), right: sb() });

  function mc(text, { bold=false, fill=WH, tc='222222', align=AlignmentType.LEFT, colspan=1, w=null }={}) {
    return new TableCell({
      columnSpan: colspan, borders: ab(),
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 55, bottom: 55, left: 100, right: 100 },
      ...(w ? { width: { size: w, type: WidthType.DXA } } : {}),
      children: [new Paragraph({ alignment: align,
        children: [new TextRun({ text: String(text), bold, color: tc, font: 'Arial', size: 19 })] }) ]
    });
  }
  const hRow = (labels, widths) => new TableRow({ tableHeader: true,
    children: labels.map((l, i) => mc(l, { bold: true, fill: BD, tc: WH, w: widths[i] })) });
  const dRow = (...cells) => new TableRow({ children: cells });
  const okC  = ok => mc(ok ? '✓  UYGUN' : '✗  UYGUN DEĞİL', {
    bold: true, align: AlignmentType.CENTER,
    fill: ok ? GR : RF, tc: ok ? GT : RT });

  const hdg = text => new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BD, space: 2 } },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 26, color: BD })] });

  const subh = text => new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 21, color: '2E4057' })] });

  const ln = (text, bold = false) => new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, bold, font: 'Arial', size: 19, color: '222222' })] });

  const fml = text => new Paragraph({
    spacing: { before: 28, after: 28 }, indent: { left: 500 },
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '1F5C99' })] });

  const bl = () => new Paragraph({ spacing: { before: 40, after: 40 }, children: [] });
  const pg = () => new Paragraph({ children: [new PageBreak()] });

  const mod = inputs.mod || res.mod;
  const Ik1_A = (inputs.Ik1 || 0) * 1000;
  const rLabel = ['Sadece havai hat (r=0.6)', 'Karma (havai+yer altı) (r=0.45)', 'Sadece yer altı kablo (r=0.3)'][inputs.rIdx || 2];

  const children = [
    // Başlık
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 },
      children: [new TextRun({ text: 'TOPRAKLAMA VE DOKUNMA GERİLİMİ HESABI', bold: true, font: 'Arial', size: 30, color: BD })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BD, space: 2 } },
      children: [new TextRun({ text: `${mod === 'arazi' ? 'Arazi GES' : 'Çatı GES'}  —  ETT Yönetmeliği · IEC EN 50522  —  ${tarih}`, font: 'Arial', size: 20, color: '555555' })] }),

    // 1. Giriş Verileri
    hdg('1.  GENEL GİRİŞ VERİLERİ'), bl(),
    new Table({ width: { size: 9100, type: WidthType.DXA }, columnWidths: [4000, 2600, 2500],
      rows: [
        hRow(['Parametre', 'Değer', 'Açıklama'], [4000, 2600, 2500]),
        dRow(mc('Faz-Toprak Arıza Akımı I"k1'), mc(`${fmt(inputs.Ik1,3)} kA = ${Ik1_A.toFixed(0)} A`, {bold:true}), mc('OG Kısa Devre Hesaplarından')),
        dRow(mc('Hata Temizleme Süresi t'),      mc(`${inputs.t} s`, {bold:true}),    mc('Arıza süresi')),
        dRow(mc('Toprak Özgül Direnci ρE'),       mc(`${inputs.rhoE} Ω·m`, {bold:true}), mc('Zemin ölçüm/tablodan')),
        dRow(mc('Bölünme Katsayısı r'),           mc(`r = ${[0.6,0.45,0.3][inputs.rIdx||2]}`, {bold:true}), mc(rLabel)),
        dRow(mc('Evirici Sayısı (pano başına)'),  mc(`${inputs.nInv} adet`, {bold:true}), mc('RCD kontrolü için')),
        dRow(mc('Topraktan Geçen Akım It = r × Ik1'), mc(`${fmt(res.It,1)} A`, {bold:true, fill:BL}), mc('')),
      ]
    }),

    bl(), pg(),

    // 2. Topraklama Direnç Hesapları
    hdg('2.  TOPRAKLAMA DİREÇ HESAPLARI'), bl(),

    // Arazi modu
    ...(mod === 'arazi' ? [
      subh('2.1  GES Santral Sahası'), bl(),
      ...(inputs.saha?.seritAktif && res.sahaSon?.Rg != null ? [
        ln('Şerit Topraklayıcı Direnci:', true),
        fml(`A = a × b = ${inputs.saha.a} × ${inputs.saha.b} = ${(inputs.saha.a*inputs.saha.b).toFixed(0)} m²`),
        fml(`D = √(4×A/π) = √(4×${(inputs.saha.a*inputs.saha.b).toFixed(0)}/π) = ${fmt(res.sahaSon.D,2)} m`),
        fml(`Rg = ρ/(2×D) + ρ/L = ${inputs.rhoE}/(2×${fmt(res.sahaSon.D,2)}) + ${inputs.rhoE}/${inputs.saha.L} = ${fmt(res.sahaSon.Rg,3)} Ω`),
        bl(),
      ] : []),
      ...(inputs.saha?.kazikAktif && res.sahaSon?.Rç != null ? [
        ln('Topraklama Kazığı Direnci:', true),
        fml(`Rç_tek = [ρ/(2π×Lç)] × ln(4×Lç/dç) = [${inputs.rhoE}/(2π×${inputs.saha.Lc})] × ln(4×${inputs.saha.Lc}/${inputs.saha.dc}) = ${fmt(res.sahaSon.Rc_tek,3)} Ω`),
        fml(`Rç = Rç_tek / n = ${fmt(res.sahaSon.Rc_tek,3)} / ${inputs.saha.n} = ${fmt(res.sahaSon.Rç,3)} Ω`),
        bl(),
      ] : []),
      ...(inputs.saha?.seritAktif && inputs.saha?.kazikAktif && res.sahaSon?.Rg && res.sahaSon?.Rç ? [
        ln('Saha Eşdeğer Direnci:', true),
        fml(`Reş_ham = Rg×Rç/(Rg+Rç) = ${fmt(res.sahaSon.Rg,3)}×${fmt(res.sahaSon.Rç,3)}/(${fmt(res.sahaSon.Rg,3)}+${fmt(res.sahaSon.Rç,3)}) = ${fmt(res.sahaSon.Rg*res.sahaSon.Rç/(res.sahaSon.Rg+res.sahaSon.Rç),3)} Ω`),
        ln('Topraklama çubuklarıyla ağın birbirinin etkisinin giderme payı %10 alınırsa:'),
        fml(`Reş_saha = Reş_ham × 1,10 = ${fmt(res.sahaSon.Rg*res.sahaSon.Rç/(res.sahaSon.Rg+res.sahaSon.Rç),3)} × 1,10 = ${fmt(res.sahaSon.Res,3)} Ω`),
        bl(),
      ] : []),

      // Köşkler
      ...((inputs.koskler||[]).flatMap((ko, i) => {
        const ks = res.koskSon?.[i];
        if (!ks) return [];
        return [
          subh(`2.${i+2}  ${ko.isim || `Trafo Köşkü ${i+1}`}`), bl(),
          ...(ko.seritAktif && ks.Rg != null ? [
            fml(`D = √(4×${ko.a}×${ko.b}/π) = ${fmt(ks.D,2)} m`),
            fml(`Rg = ${inputs.rhoE}/(2×${fmt(ks.D,2)}) + ${inputs.rhoE}/${ko.L} = ${fmt(ks.Rg,3)} Ω`),
          ] : []),
          ...(ko.kazikAktif && ks.Rç != null ? [
            fml(`Rç_tek = ${fmt(ks.Rc_tek,3)} Ω  →  Rç = ${fmt(ks.Rc_tek,3)}/${ko.n} = ${fmt(ks.Rç,3)} Ω`),
          ] : []),
          ...(ko.seritAktif && ko.kazikAktif && ks.Rg && ks.Rç ? [
            fml(`Reş_ham = ${fmt(ks.Rg,3)}×${fmt(ks.Rç,3)}/(${fmt(ks.Rg,3)}+${fmt(ks.Rç,3)}) × 1,10 = ${fmt(ks.Res,3)} Ω`),
          ] : []),
          bl(),
        ];
      })),

      // Final
      subh(`2.${(inputs.koskler||[]).length+2}  Final Eşdeğer Direnç (Paralel Kombinasyon)`),
      ln('Tüm topraklama sistemleri paralel bağlandığında:'),
      fml(`1/Reş = 1/${fmt(res.sahaSon?.Res,3)} + ${(res.koskSon||[]).map((ks,i)=>`1/${fmt(ks?.Res,3)}`).join(' + ')}`),
      fml(`Reş = ${fmt(res.finalRes,3)} Ω`),

    ] : [
      // Çatı modu
      subh('2.1  Mevcut Bina Topraklaması'), bl(),
      fml(`R_mevcut = ${fmt(inputs.Rmevcut,3)} Ω  (ölçülen/verilen değer)`),
      bl(),
      subh('2.2  Çatı Eşpotansiyel Şeridi'), bl(),
      ln(`${inputs.catiSerit?.L || 0} m ${inputs.catiSerit?.kesit || '30×3.5 mm Galvaniz Şerit'} — gömülü elektrot değildir.`),
      ln('Panel çerçevelerini eşpotansiyele bağlar. Zemine karşı direnci mevcut topraklama üzerinden sağlanır.'),
      bl(),
      ...(inputs.catiKazik?.aktif && res.Rç ? [
        subh('2.3  İlave Topraklama Kazıkları'), bl(),
        fml(`Rç_tek = [${inputs.rhoE}/(2π×${inputs.catiKazik.Lc})] × ln(4×${inputs.catiKazik.Lc}/${inputs.catiKazik.dc}) = ${fmt(inputs.catiKazik.n>0?((inputs.rhoE/(2*Math.PI*inputs.catiKazik.Lc))*Math.log(4*inputs.catiKazik.Lc/inputs.catiKazik.dc)):0,3)} Ω`),
        fml(`Rç = Rç_tek / ${inputs.catiKazik.n} = ${fmt(res.Rç,3)} Ω`),
        bl(),
        fml(`Reş = (R_mevcut × Rç)/(R_mevcut + Rç) × 1,10 = ${fmt(res.finalRes,3)} Ω`),
      ] : [
        bl(),
        fml(`Reş = R_mevcut = ${fmt(res.finalRes,3)} Ω`),
      ]),
    ]),

    bl(), pg(),

    // 3. Dokunma Gerilimi
    hdg('3.  DOKUNMA GERİLİMİ KONTROLÜ'), bl(),
    ln(`Topraktan geçen arıza akımı It = r × Ik1 formülü ile belirlenir.`),
    ln(`Tesiste ${rLabel.toLowerCase()} için bölünme katsayısı r = ${[0.6,0.45,0.3][inputs.rIdx||2]} alınmıştır.`),
    bl(),
    fml(`It = r × Ik1 = ${[0.6,0.45,0.3][inputs.rIdx||2]} × ${Ik1_A.toFixed(0)} = ${fmt(res.It,1)} A`),
    bl(),
    fml(`UE = IT × Reş = ${fmt(res.It,1)} × ${fmt(res.finalRes,3)} = ${fmt(res.UE,3)} V`),
    bl(),
    ln(`${inputs.t} sn için izin verilen en yüksek dokunma gerilimi ${res.Utp} V olduğundan,`),
    bl(),
    new Table({ width: { size: 9100, type: WidthType.DXA }, columnWidths: [2500,1800,1800,3000],
      rows: [
        hRow(['Kontrol', 'UE (V)', '2×UTP (V)', 'Sonuç'], [2500,1800,1800,3000]),
        dRow(
          mc(`Dokunma Gerilimi — t = ${inputs.t} s`),
          mc(fmt(res.UE,2), { bold: true, align: AlignmentType.CENTER }),
          mc(String(res.Utp*2), { align: AlignmentType.CENTER }),
          okC(res.dok_ok)
        ),
      ]
    }),
    bl(),
    ln(`${fmt(res.UE,3)} V (UE) ${res.dok_ok ? '<' : '>'} ${res.Utp*2} V (2×UTP) olduğundan, topraklama sistemi dokunma gerilimi yönünden ${res.dok_ok ? 'UYGUNDUR.' : 'UYGUN DEĞİLDİR.'}`, true),
    bl(),
    ...(res.dok_ok ? [
      ln('* Dokunma gerilimine göre topraklama sistemi uygun olduğu için adım gerilimine bakmaya gerek yoktur.', false),
    ] : []),

    bl(), pg(),

    // 4. İletken Kesit
    hdg('4.  TOPRAKLAMA İLETKENİ MİNİMUM KESİTİ'), bl(),
    subh('4.1  Koruma İletkeni Kesiti (Çıplak Bakır, k=115)'),
    fml(`S = Ik1 × √t / k = ${Ik1_A.toFixed(0)} × √${inputs.t} / 115 = ${fmt(res.q_hesap,2)} mm²`),
    ln(`→ Seçilen: ${res.q_sec} mm² Çıplak Bakır İletken`),
    bl(),
    subh('4.2  Topraklama Şeridi Minimum Kesiti (ETT Yönetmeliği Çizelge-4a)'),
    ln('Topraklamalar yönetmeliği Çizelge-4a\'ya göre galvaniz şerit için belirlenen minimum kesit 50 mm² dir.'),
    fml(`Seçilen: 30×3,5 mm Galvanizli Çelik Şerit  →  A = 30×3,5 = 105 mm² > 50 mm²  ✓`),

    bl(), pg(),

    // 5. Kaçak Akım
    hdg('5.  KAÇAK AKIM RÖLESİ KONTROLÜ (Normal İşletme)'), bl(),
    ln('TT sistemlerde UL = 50 V olacağından:'),
    fml(`Reş × Ia ≤ 50V  →  Reş ≤ 50 / (n_inv × 0,3 A/evirici)`),
    fml(`${fmt(res.finalRes,3)} Ω ≤ 50 / (${inputs.nInv} × 0,3) = ${fmt(50/(inputs.nInv*0.3),2)} Ω`),
    bl(),
    new Table({ width: { size: 9100, type: WidthType.DXA }, columnWidths: [2500,2200,2200,2200],
      rows: [
        hRow(['Kontrol', 'Reş (Ω)', 'Eşik (Ω)', 'Sonuç'], [2500,2200,2200,2200]),
        dRow(
          mc(`RCD Direnci — ${inputs.nInv} evirici`),
          mc(fmt(res.finalRes,3), { bold: true, align: AlignmentType.CENTER }),
          mc(fmt(50/(inputs.nInv*0.3),2), { align: AlignmentType.CENTER }),
          okC(res.rcd_ok)
        ),
      ]
    }),
    bl(),
    ln('Kaçak akım rölesi (RCD) kullanımı zorunludur.'),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 19 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 900, bottom: 1000, left: 900 } } },
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `GES_Topraklama_Hesabi_${new Date().toLocaleDateString('tr-TR').replace(/\./g,'-')}.docx`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
