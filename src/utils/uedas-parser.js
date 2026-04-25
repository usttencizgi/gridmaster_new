// ─── UEDAŞ Tek Hat PDF Parser ─────────────────────────────────────
// Kural: Etiket (TR-206, TR-208...) → hemen önceki kabloyu adlandırır
// Yani kablo A → kablo B → [TR-206] → kablo C → [TR-208]
// Sonuç: B.name="TR-206", C.name="TR-208", A.name=""

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

// GERÇEK düğüm etiketi: sayısal trafo ID'si olan satırlar
// "56372337 TR-206 KOYUNCU..." → "TR-206"
// "7165853 Nolu kofra TrafoID:... TR-226" → "TR-226"
// "BALIKESIR CADDESI YERALTI HUCRESI" → null (hücre, düğüm değil)
// "TR-212 YE CIKIS HUCRESI" → null (hücre açıklaması, gerçek düğüm değil)
function extractRealNode(line) {
  // Pattern 1: "SAYIID TR-XXX ..."
  const m1 = line.match(/^\d{4,}\s+(TR-[\w\/\-]+|DM-[\w\/\-]+)/i);
  if (m1) return m1[1].toUpperCase();

  // Pattern 2: "TrafoAd :TR-226" gibi kofra formatı
  const m2 = line.match(/TrafoAd\s*:\s*(TR-[\w\/\-]+)/i);
  if (m2) return m2[1].toUpperCase();

  return null; // hücre isimleri, fideri bilgileri vs. → null
}

function extractTmName(lines) {
  for (let j = 0; j < Math.min(12, lines.length); j++) {
    const l = lines[j].toUpperCase();
    if ((l.includes('TRAFO') && l.includes('MERKEZ')) ||
         l.includes('INDIRICI') || l.includes('İNDİRİCİ')) {
      // Önceki satır TM şehir/isim satırıdır
      const nm = j > 0 ? lines[j-1].trim() : lines[j].trim();
      if (nm.length > 2 && nm.length < 50 && !nm.match(/kVA|%Uk|FIDERI/i)) return nm;
      return lines[j].split(/\s+/).slice(0,3).join(' ');
    }
  }
  return '';
}

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

  // ── Olayları topla ─────────────────────────────────────────────
  // events: {type:'cable', cableTypeId, length} | {type:'node', text}
  const events = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === 'YERALTI') {
      let section=null, mat='Al', length=null;
      i++;
      while (i < lines.length) {
        const l = lines[i];
        const lenM = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenM) { length = parseFloat(lenM[1].replace(',','.'))/1000; i++; break; }
        const secM = l.match(/3\s*[\(]?\s*(?:1\s*[xX×]\s*)?(\d+)/);
        if (secM && !section) section = parseInt(secM[1]);
        if (l === 'ALUMINYUM') mat = 'Al';
        if (l === 'BAKIR')     mat = 'Cu';
        i++;
      }
      if (section && length > 0)
        events.push({ type:'cable', cableTypeId:mapCableId(section,mat), length, circuitCount:1 });

    } else if (line === 'HAVAI') {
      let cableId=null, length=null;
      i++;
      while (i < lines.length) {
        const l = lines[i];
        const lenM = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenM) { length = parseFloat(lenM[1].replace(',','.'))/1000; i++; break; }
        if (!cableId && (l.includes('HAWK')||l.includes('PIGEON')||l.includes('RAVEN')||
            l.includes('SWALLOW')||l.includes('PARTRIDGE')||l.includes('AWG')||l.includes('MCM')))
          cableId = mapAerialId(l);
        i++;
      }
      if (cableId && length > 0)
        events.push({ type:'cable', cableTypeId:cableId, length, circuitCount:1 });

    } else {
      // Sadece gerçek düğüm etiketleri (TR-206, TR-208 gibi)
      const node = extractRealNode(line);
      if (node) events.push({ type:'node', text:node });
      i++;
    }
  }

  // ── ANAHTAR KURAL: her düğüm etiketinden hemen önceki kabloyu adlandır ──
  // events: [..., cable, cable, NODE, cable, cable, NODE, ...]
  //                       ^                        ^
  //                       bu adlandırılır         bu adlandırılır
  for (let k = 0; k < events.length; k++) {
    if (events[k].type === 'node') {
      // Geriye giderek son kabloyu bul
      let j = k - 1;
      while (j >= 0 && events[j].type !== 'cable') j--;
      if (j >= 0 && !events[j].name) {
        events[j].name = events[k].text;
      }
    }
  }

  // ── Sadece kablo olaylarını al, segment listesi oluştur ────────
  const rawSegs = events.filter(e => e.type === 'cable');

  // ── EK node: isim varken kablo tipi değişiyorsa ────────────────
  const segments = [];
  for (let k = 0; k < rawSegs.length; k++) {
    const seg = rawSegs[k];
    if (k > 0 && rawSegs[k-1].cableTypeId !== seg.cableTypeId) {
      // Kablo tipi değişti — eğer önceki segmentin ismi varsa EK koy
      // (aynı düğümler arası farklı kablo tipi geçişi)
      if (!seg.name && rawSegs[k-1].name) {
        // EK burada değil, bu kablo bir sonraki düğüme gidiyor
        // sadece tip değişimini işaretle
      } else if (!seg.name && !rawSegs[k-1].name) {
        segments.push({
          id: Date.now() + Math.random(),
          name: 'EK', cableTypeId: seg.cableTypeId,
          length: 0, circuitCount: 1, isEk: true,
        });
      }
    }
    segments.push({
      id: Date.now() + Math.random() + k,
      name: seg.name || '',
      cableTypeId: seg.cableTypeId,
      length: parseFloat(seg.length.toFixed(4)),
      circuitCount: seg.circuitCount || 1,
    });
  }

  return { segments, sourceName, sourceKva, sourceUk };
}

export async function parseUedasPdf(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let fullText = '';

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lineMap = {};
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item.str.trim());
    }
    Object.keys(lineMap).map(Number).sort((a,b)=>b-a).forEach(y => {
      fullText += lineMap[y].join(' ') + '\n';
    });
  }

  return parseUedasText(fullText);
}
