// ─── UEDAŞ Tek Hat PDF Parser ─────────────────────────────────────
// Doğru okuma: [Etiket A] → [Kablo] → [Etiket B]
// Kablo adı = VARIŞ noktası (sonraki etiket), kaynak değil

const CABLE_MAP_AL = {
  400:'3x1x400al', 240:'3x1x240al', 185:'3x1x185cu',
  150:'3x1x150al', 120:'3x1x120al', 95:'3x1x95al',
  70:'3x1x70cu',   50:'3x1x50cu',
};
const CABLE_MAP_CU = {
  400:'3x1x400cu', 240:'3x1x240cu', 185:'3x1x185cu',
  150:'3x1x150cu', 120:'3x1x120cu', 95:'3x1x95cu',
  70:'3x1x70cu',   50:'3x1x50cu',
};

function mapCableId(section, mat) {
  const map = mat==='Cu' ? CABLE_MAP_CU : CABLE_MAP_AL;
  const secs = Object.keys(map).map(Number).sort((a,b)=>a-b);
  return map[secs.reduce((p,c) => Math.abs(c-section)<Math.abs(p-section)?c:p)];
}
function mapAerialId(text) {
  const t = text.toUpperCase();
  if (t.includes('HAWK'))      return 'hawk';
  if (t.includes('PARTRIDGE')) return 'partridge';
  if (t.includes('PIGEON')||t.includes('3/0')) return 'pigeon';
  if (t.includes('RAVEN') ||t.includes('1/0')) return 'raven';
  if (t.includes('SWALLOW'))   return 'swallow';
  return 'pigeon';
}

// Bir metin satırından düğüm etiketi çıkar
function extractLabel(line) {
  // "23179 TR-219 DAGITIM..." → "TR-219"
  const trm = line.match(/\b(TR-[\w\/\-]+|DM-[\w\/\-]+)\b/i);
  if (trm) return trm[1].toUpperCase();
  // "56372337 TR-206 KOYUNCU..." → sayı + TR kodu
  const idtrm = line.match(/^\d{4,}\s+(TR-[\w\/\-]+|DM-[\w\/\-]+)/i);
  if (idtrm) return idtrm[1].toUpperCase();
  // Jenerik hücre isimleri filtrele
  if (line.match(/YERALTI|HAVAI|ALUMINYUM|BAKIR|FIDERI|TRAFO|MERKEZI|DAGITIM|GIRIS|CIKIS|HUCRESI|KABINE|kVA|%Uk/i)) return null;
  // Sayı + metin: "23096 TR-220 DAGITIM MERKEZI" → zaten TR-220 yakalandı
  // TM adı: baş satırlarda
  return null;
}

function extractTmName(lines) {
  for (let j=0; j<Math.min(12,lines.length); j++) {
    const l = lines[j].toUpperCase();
    if ((l.includes('TRAFO')&&l.includes('MERKEZ'))||l.includes('INDIRICI')||l.includes('İNDİRİCİ')) {
      const nm = j>0 ? lines[j-1].trim() : lines[j].trim();
      if (nm.length>2&&nm.length<50&&!nm.match(/kVA|%Uk|FIDERI/i)) return nm;
      return lines[j].trim().split(/\s+/).slice(0,4).join(' ');
    }
  }
  return '';
}

// ─── ANA PARSER ──────────────────────────────────────────────────
export function parseUedasText(rawText) {
  const lines = rawText
    .replace(/\r\n/g,'\n').replace(/\r/g,'\n')
    .replace(/(YERALTI|HAVAI|ALUMINYUM|BAKIR)/g,'\n$1\n')
    .split('\n').map(l=>l.trim()).filter(l=>l.length>0);

  let sourceName='', sourceKva=null, sourceUk=null;

  for (let j=0; j<Math.min(15,lines.length); j++) {
    const kvaM = lines[j].match(/([\d]+)\s*kVA/i);
    if (kvaM) sourceKva = parseInt(kvaM[1]);
    const ukM  = lines[j].match(/([\d.]+)\s*%Uk/i);
    if (ukM)  sourceUk  = parseFloat(ukM[1]);
  }
  sourceName = extractTmName(lines);

  // ── Olayları topla: etiket veya kablo ─────────────────────────
  // Yapı: ETIKET → KABLO → ETIKET → KABLO → ...
  // Kabloyu adlandıran bir SONRAKİ etiket (varış noktası)
  const events = []; // {type:'label',text} | {type:'cable',cableTypeId,length,circuitCount}
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === 'YERALTI') {
      let section=null, mat='Al', length=null;
      i++;
      while (i<lines.length) {
        const l=lines[i];
        const lenM = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenM) { length=parseFloat(lenM[1].replace(',','.'))/1000; i++; break; }
        const secM = l.match(/3\s*[\(]?\s*(?:1\s*[xX×]\s*)?(\d+)/);
        if (secM&&!section) section=parseInt(secM[1]);
        if (l==='ALUMINYUM') mat='Al';
        if (l==='BAKIR')     mat='Cu';
        i++;
      }
      if (section&&length>0) {
        events.push({ type:'cable', cableTypeId:mapCableId(section,mat), length, circuitCount:1 });
      }

    } else if (line === 'HAVAI') {
      let cableId=null, length=null;
      i++;
      while (i<lines.length) {
        const l=lines[i];
        const lenM = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenM) { length=parseFloat(lenM[1].replace(',','.'))/1000; i++; break; }
        if (!cableId&&(l.includes('HAWK')||l.includes('PIGEON')||l.includes('RAVEN')||
            l.includes('SWALLOW')||l.includes('PARTRIDGE')||l.includes('AWG')||l.includes('MCM'))) {
          cableId=mapAerialId(l);
        }
        i++;
      }
      if (cableId&&length>0) {
        events.push({ type:'cable', cableTypeId:cableId, length, circuitCount:1 });
      }

    } else {
      const lbl = extractLabel(line);
      if (lbl) events.push({ type:'label', text:lbl });
      i++;
    }
  }

  // ── Etiketleri doğru yere ata ──────────────────────────────────
  // events: [L0, C0, L1, C1, L2, C2, ...]
  // Kablo C0'ın varış noktası = L1 (sonraki etiket)
  // Kablo C1'ın varış noktası = L2
  // Etiket sıralaması: cables[j].name = labels[j+1]

  const labels  = events.filter(e=>e.type==='label').map(e=>e.text);
  const cables  = events.filter(e=>e.type==='cable');

  // cables[j] → TO → labels[j+1]
  // labels[0] = ilk çıkış noktası (TM hücresi) — kabloyu adlandırmaz
  // labels[1] = cables[0]'ın varış noktası
  // labels[j+1] = cables[j]'nin varış noktası
  const segments = cables.map((c, j) => ({
    id: Date.now() + Math.random() + j,
    name: labels[j+1] || '',          // varış noktası adı
    cableTypeId: c.cableTypeId,
    length: parseFloat(c.length.toFixed(4)),
    circuitCount: c.circuitCount,
  }));

  // ── EK node: ardışık farklı kablo tipi, isim yoksa ────────────
  const final = [];
  for (let k=0; k<segments.length; k++) {
    const seg = segments[k];
    if (k>0 && !seg.name && segments[k-1].cableTypeId !== seg.cableTypeId) {
      final.push({
        id: Date.now()+Math.random(),
        name: 'EK', cableTypeId: seg.cableTypeId, length: 0,
        circuitCount: 1, isEk: true,
      });
    }
    final.push(seg);
  }

  return { segments:final, sourceName, sourceKva, sourceUk };
}

export async function parseUedasPdf(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf  = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let fullText = '';

  for (let p=1; p<=pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lineMap = {};
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y]=[];
      lineMap[y].push(item.str.trim());
    }
    Object.keys(lineMap).map(Number).sort((a,b)=>b-a).forEach(y => {
      fullText += lineMap[y].join(' ') + '\n';
    });
  }

  return parseUedasText(fullText);
}
