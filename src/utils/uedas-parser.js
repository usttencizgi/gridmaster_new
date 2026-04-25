// ─── UEDAŞ Tek Hat PDF Parser ────────────────────────────────────
const CABLE_MAP_AL = {
  400: '3x1x400al', 240: '3x1x240al', 185: '3x1x185cu',
  150: '3x1x150al', 120: '3x1x120al', 95:  '3x1x95al',
  70:  '3x1x70cu',  50:  '3x1x50cu',
};
const CABLE_MAP_CU = {
  400: '3x1x400cu', 240: '3x1x240cu', 185: '3x1x185cu',
  150: '3x1x150cu', 120: '3x1x120cu', 95:  '3x1x95cu',
  70:  '3x1x70cu',  50:  '3x1x50cu',
};

function mapCableId(section, mat) {
  const map = mat === 'Cu' ? CABLE_MAP_CU : CABLE_MAP_AL;
  const sections = Object.keys(map).map(Number).sort((a,b)=>a-b);
  const closest  = sections.reduce((p,c) => Math.abs(c-section)<Math.abs(p-section)?c:p);
  return map[closest];
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

function extractNodeLabel(line) {
  // "23179 TR-219" veya "56372337 TR-206 KOYUNCU KÖK" formatı
  const idxMatch = line.match(/^\d{3,}\s+(.{3,60})$/);
  if (idxMatch) {
    const rest = idxMatch[1].trim();
    // TR-XXX veya DM-XXX içeriyorsa onları çek
    const trm = rest.match(/\b(TR-[\w\/\-]+|DM-[\w\/\-]+)\b/i);
    if (trm) return trm[1].toUpperCase();
    // Jenerik kelimeler içermiyorsa ilk 3 kelime
    if (!rest.match(/^(DAGITIM|FIDERI|TRAFO|MERKEZI|KOYUNCU|BURHANIYE|GIRIS|CIKIS|HUCRESI)/i)) {
      return rest.split(/\s+/).slice(0,3).join(' ');
    }
  }
  // Doğrudan TR-/DM- içeren satır
  const trMatch = line.match(/\b(TR-[\w\/\-]+|DM-[\w\/\-]+)\b/i);
  if (trMatch) return trMatch[1].toUpperCase();
  return null;
}

function extractTmName(lines) {
  // İlk 12 satırda TM / indirici / trafo merkezi ismini bul
  for (let j = 0; j < Math.min(12, lines.length); j++) {
    const l = lines[j].toUpperCase();
    if ((l.includes('TRAFO') && l.includes('MERKEZ')) ||
        l.includes('INDIRICI') || l.includes('İNDİRİCİ')) {
      // Önceki satır genellikle şehir/yer adıdır
      const nm = j > 0 ? lines[j-1].trim() : lines[j].trim();
      if (nm.length > 2 && nm.length < 40) return nm;
      return lines[j].trim().split(/\s+/).slice(0,4).join(' ');
    }
  }
  return '';
}

export function parseUedasText(rawText) {
  const lines = rawText
    .replace(/\r\n/g,'\n').replace(/\r/g,'\n')
    .replace(/(YERALTI|HAVAI|ALUMINYUM|BAKIR)/g,'\n$1\n')
    .split('\n').map(l=>l.trim()).filter(l=>l.length>0);

  let sourceName = '', sourceKva = null, sourceUk = null;

  // Kaynak bilgisi
  for (let j=0; j<Math.min(15,lines.length); j++) {
    const kvaM = lines[j].match(/([\d]+)\s*kVA/i);
    if (kvaM) sourceKva = parseInt(kvaM[1]);
    const ukM  = lines[j].match(/([\d.]+)\s*%Uk/i);
    if (ukM)  sourceUk  = parseFloat(ukM[1]);
  }
  sourceName = extractTmName(lines);

  const rawSegs = [];
  let pendingName = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === 'YERALTI') {
      let section=null, mat='Al', length=null, segName=pendingName;
      i++;
      while (i<lines.length) {
        const l=lines[i];
        const lenM = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenM) { length=parseFloat(lenM[1].replace(',','.'))/1000; i++; break; }
        const secM = l.match(/3\s*[\(]?\s*(?:1\s*[xX×]\s*)?(\d+)/);
        if (secM && !section) section=parseInt(secM[1]);
        if (l==='ALUMINYUM') mat='Al';
        if (l==='BAKIR')     mat='Cu';
        i++;
      }
      if (section && length>0) {
        rawSegs.push({ name:segName, cableTypeId:mapCableId(section,mat), length, circuitCount:1 });
        pendingName='';
      }

    } else if (line === 'HAVAI') {
      let cableId=null, length=null, segName=pendingName;
      i++;
      while (i<lines.length) {
        const l=lines[i];
        const lenM = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenM) { length=parseFloat(lenM[1].replace(',','.'))/1000; i++; break; }
        if (!cableId && (l.includes('HAWK')||l.includes('PIGEON')||l.includes('RAVEN')||
            l.includes('SWALLOW')||l.includes('PARTRIDGE')||l.includes('AWG')||l.includes('MCM'))) {
          cableId=mapAerialId(l);
        }
        i++;
      }
      if (cableId && length>0) {
        rawSegs.push({ name:segName, cableTypeId:cableId, length, circuitCount:1 });
        pendingName='';
      }

    } else {
      const label = extractNodeLabel(line);
      if (label) pendingName = label;
      i++;
    }
  }

  // ── Post-process: EK node + ilk segment TM adı ─────────────────
  const segments = [];
  for (let k=0; k<rawSegs.length; k++) {
    const seg = rawSegs[k];

    // İlk segmentin adı boşsa TM adını ver
    if (k===0 && !seg.name && sourceName) {
      seg.name = sourceName;
    }

    // EK node: önceki segmentten farklı kablo tipi VE bu segmentin adı yok
    if (k>0 && !seg.name && rawSegs[k-1].cableTypeId !== seg.cableTypeId) {
      segments.push({
        id: Date.now() + Math.random(),
        name: 'EK',
        cableTypeId: seg.cableTypeId,
        length: 0,
        circuitCount: 1,
        isEk: true,
      });
    }

    segments.push({
      id: Date.now() + Math.random() + k,
      name: seg.name || '',
      cableTypeId: seg.cableTypeId,
      length: parseFloat(seg.length.toFixed(4)),
      circuitCount: seg.circuitCount,
    });
  }

  return { segments, sourceName, sourceKva, sourceUk };
}

export async function parseUedasPdf(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let pageNum=1; pageNum<=pdf.numPages; pageNum++) {
    const page    = await pdf.getPage(pageNum);
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

// Desteklenen format: UEDAŞ / EDAŞ standart OG tek hat çıktısı
// Çıktı: { segments, sourceName, sourceKva, sourceUk }

// ── Kablo eşleme tablosu ─────────────────────────────────────────
