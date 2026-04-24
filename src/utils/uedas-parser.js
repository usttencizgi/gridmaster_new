// ─── UEDAŞ Tek Hat PDF Parser ────────────────────────────────────
// Desteklenen format: UEDAŞ / EDAŞ standart OG tek hat çıktısı
// Çıktı: { segments, sourceName, sourceKva, sourceUk }

// ── Kablo eşleme tablosu ─────────────────────────────────────────
const CABLE_MAP_AL = {
  400: '3x1x400al',
  240: '3x1x240al',
  185: '3x1x185cu', // Al 185 DB'de yok, Cu kullan
  150: '3x1x150al',
  120: '3x1x120al',
  95:  '3x1x95al',
  70:  '3x1x70cu',  // Al 70 DB'de yok
  50:  '3x1x50cu',  // Al 50 DB'de yok
};

const CABLE_MAP_CU = {
  400: '3x1x400cu',
  240: '3x1x240cu',
  185: '3x1x185cu',
  150: '3x1x150cu',
  120: '3x1x120cu',
  95:  '3x1x95cu',
  70:  '3x1x70cu',
  50:  '3x1x50cu',
};

function mapCableId(section, mat) {
  const map = mat === 'Cu' ? CABLE_MAP_CU : CABLE_MAP_AL;
  const sections = Object.keys(map).map(Number).sort((a, b) => a - b);
  // En yakın kesiti bul
  const closest = sections.reduce((prev, curr) =>
    Math.abs(curr - section) < Math.abs(prev - section) ? curr : prev
  );
  return map[closest];
}

function mapAerialId(text) {
  const t = text.toUpperCase();
  if (t.includes('HAWK'))       return 'hawk';
  if (t.includes('PARTRIDGE'))  return 'partridge';
  if (t.includes('PIGEON') || t.includes('3/0')) return 'pigeon';
  if (t.includes('RAVEN')  || t.includes('1/0')) return 'raven';
  if (t.includes('SWALLOW'))    return 'swallow';
  return 'pigeon'; // varsayılan
}

// Hücre/bağlantı noktası etiketleri — segment ismi için kullanılır
function extractNodeLabel(line) {
  // TR-XXX veya DM-XXX içeren satırlar
  const trMatch = line.match(/\b(TR-[\w\/\-]+|DM-[\w\/\-]+)\b/i);
  if (trMatch) return trMatch[1].toUpperCase();
  // "23179 TR-219" gibi formatlar
  const idMatch = line.match(/^\d{3,}\s+(.{3,40})$/);
  if (idMatch) {
    const rest = idMatch[1].trim();
    // "DAGITIM" gibi jenerik kelimeleri filtrele
    if (!rest.match(/^(DAGITIM|FIDERI|TRAFO|MERKEZI|KOYUNCU|BURHANIYE)/i)) {
      return rest.split(/\s+/).slice(0, 3).join(' ');
    }
  }
  return null;
}

// ── Ana metin parser ──────────────────────────────────────────────
export function parseUedasText(rawText) {
  // Metni satırlara böl, boş satırları temizle
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // PDF'ten gelen bitişik büyük harf kelimeleri ayır
    .replace(/(YERALTI|HAVAI|ALUMINYUM|BAKIR)/g, '\n$1\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const segments = [];
  let sourceName  = '';
  let sourceKva   = null;
  let sourceUk    = null;
  let pendingName = '';
  let i = 0;

  // Kaynak bilgisi — ilk 10 satırda ara
  for (let j = 0; j < Math.min(10, lines.length); j++) {
    const kvaMatch = lines[j].match(/([\d]+)\s*kVA/i);
    if (kvaMatch) sourceKva = parseInt(kvaMatch[1]);
    const ukMatch  = lines[j].match(/([\d.]+)\s*%Uk/i);
    if (ukMatch)  sourceUk  = parseFloat(ukMatch[1]);
    if (lines[j].toUpperCase().includes('TRAFO') &&
        lines[j].toUpperCase().includes('MERKEZ')) {
      sourceName = lines[j];
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // ── YERALTI segmenti ──
    if (line === 'YERALTI') {
      let section = null, mat = 'Al', length = null;
      let segName = pendingName;
      i++;

      while (i < lines.length) {
        const l = lines[i];

        // Uzunluk (hem noktalı hem virgüllü format)
        const lenMatch = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenMatch) {
          length = parseFloat(lenMatch[1].replace(',', '.')) / 1000; // km
          i++;
          break;
        }

        // Kesit: "3(1 x 150 / 25)" veya "3 x 150 / 25" veya "3(1x95/16)"
        const secMatch = l.match(/3\s*[\(]?\s*(?:1\s*[xX×]\s*)?(\d+)/);
        if (secMatch && !section) section = parseInt(secMatch[1]);

        // Malzeme
        if (l === 'ALUMINYUM') mat = 'Al';
        if (l === 'BAKIR')     mat = 'Cu';

        i++;
      }

      if (section && length > 0) {
        segments.push({
          id: Date.now() + Math.random(),
          name: segName,
          cableTypeId: mapCableId(section, mat),
          length,
          circuitCount: 1,
          loadKVA: 0, // OgVoltageDrop için
        });
        pendingName = '';
      }

    // ── HAVAI segmenti ──
    } else if (line === 'HAVAI') {
      let cableId = null, length = null;
      let segName = pendingName;
      i++;

      while (i < lines.length) {
        const l = lines[i];

        const lenMatch = l.match(/([\d]+[,.][\d]+|[\d]+)\s*METRE/i);
        if (lenMatch) {
          length = parseFloat(lenMatch[1].replace(',', '.')) / 1000;
          i++;
          break;
        }

        // Havai hat tipi
        if (!cableId && (
          l.includes('HAWK') || l.includes('PIGEON') || l.includes('RAVEN') ||
          l.includes('SWALLOW') || l.includes('PARTRIDGE') || l.includes('AWG') ||
          l.includes('MCM')
        )) {
          cableId = mapAerialId(l);
        }

        i++;
      }

      if (cableId && length > 0) {
        segments.push({
          id: Date.now() + Math.random(),
          name: segName,
          cableTypeId: cableId,
          length,
          circuitCount: 1,
          loadKVA: 0,
        });
        pendingName = '';
      }

    // ── Diğer satırlar: düğüm ismi adayları ──
    } else {
      const label = extractNodeLabel(line);
      if (label) pendingName = label;
      i++;
    }
  }

  return { segments, sourceName, sourceKva, sourceUk };
}

// ── PDF dosyasından metin çıkar → parse et ───────────────────────
export async function parseUedasPdf(file) {
  // pdfjs'i dinamik import ile yükle (build'i şişirmemek için)
  const pdfjsLib = await import('pdfjs-dist');

  // Worker: CDN'den yükle
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page       = await pdf.getPage(pageNum);
    const content    = await page.getTextContent();
    const items      = content.items;

    // Y koordinatına göre gruplama → doğal satır yapısını koru
    const lineMap = {};
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item.str.trim());
    }

    // Y değerlerine göre sırala (büyükten küçüğe = yukarıdan aşağıya)
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      fullText += lineMap[y].join(' ') + '\n';
    }
  }

  return parseUedasText(fullText);
}
