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
    { id:'34.5 kV Barası', kv:'34.500',
      ik:result.busbarCurrent, ip:result.ip_bara,
      Z_ohm: result.Z1_bara_ohm },
    ...(result.lineDetails||[]).map((d,i) => {
      const Ztot_pu = result.zBaraPu + (result.lineDetails.slice(0,i+1).reduce((a,x)=>a+x.Z_seg_ohm/Zb,0));
      const ik = result.c*Ib/(Ztot_pu*1000);
      return { id:`Hat ${d.idx} Sonu`, kv:'34.500', ik, ip: kappa*Math.sqrt(2)*ik, Z_ohm: Ztot_pu*Zb };
    }),
  ];

  const summaryTableRows = summaryRows.map(r => `
    <tr>
      <td><b>${r.id}</b></td>
      <td class="mono">34.500</td>
      <td class="mono" style="color:#1e40af;font-weight:700">${fmt(r.ik,3)}</td>
      <td class="mono">${fmt(r.ip,3)}</td>
      <td class="mono">${fmt(r.ik,3)}</td>
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
      <td><b>Hat ${d.idx}</b></td>
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
            <div style="font-size:10px;color:#475569;margin-top:2px">IEC 60909 Standardı — Üç-Faz Simetrik Arıza</div>
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
        <th style="background:#1e40af">I&quot;k — 3-Faz (kA)</th>
        <th>ip tepe (kA)</th>
        <th>Ik kalıcı (kA)</th>
        <th>Z+ pozitif sıra (Ω)</th>
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
