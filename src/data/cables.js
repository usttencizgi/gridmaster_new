// OG Kablo Veritabanı
// z0Ratio: Sıfır sıra / Pozitif sıra empedans oranı (IEC 60909 / TEİAŞ uygulaması)
//   Havai hat (toprak telli, standart 34.5 kV): 3.5
//   Yeraltı kablosu (tek damarlı, XLPE/EPR 3×1×): 3.5
export const INITIAL_CABLES = [
  // --- Havai Hatlar (toprak telli, z0/z1 = 3.5) ---
  { id: 'swallow',    name: '3xSW (Swallow)',    type: 'Havai',   material: 'Al', kFactor: 0.911, cFactor: 0.902, currentLimit: 125, r: 1.075, x: 0.355, z: 1.15411855543527,  z0Ratio: 3.5 },
  { id: 'raven',      name: '3x1/0 (Raven)',     type: 'Havai',   material: 'Al', kFactor: 0.539, cFactor: 0.450, currentLimit: 230, r: 0.535, x: 0.339, z: 0.66896221118984,  z0Ratio: 3.5 },
  { id: 'pigeon',     name: '3x3/0 (Pigeon)',    type: 'Havai',   material: 'Al', kFactor: 0.397, cFactor: 0.282, currentLimit: 300, r: 0.338, x: 0.325, z: 0.511394720348187, z0Ratio: 3.5 },
  { id: 'partridge',  name: '3x266 (Partridge)', type: 'Havai',   material: 'Al', kFactor: 0.307, cFactor: 0.179, currentLimit: 460, r: 0.213, x: 0.315, z: 0.380,             z0Ratio: 3.5 },
  { id: 'hawk',       name: '3x477 (Hawk)',       type: 'Havai',   material: 'Al', kFactor: 0.234, cFactor: 0.100, currentLimit: 670, r: 0.119, x: 0.298, z: 0.371699287058773, z0Ratio: 3.5 },

  // --- XLPE Cu (Bakır, tek damarlı, z0/z1 = 3.5) ---
  { id: '3x1x50cu',  name: '3(1x50) Cu',   type: 'Yeraltı', material: 'Cu', kFactor: 0.379, cFactor: 0.325, currentLimit: 251, r: 0.387, x: 0.135, z: 0.842183471697231, z0Ratio: 3.5 },
  { id: '3x1x70cu',  name: '3(1x70) Cu',   type: 'Yeraltı', material: 'Cu', kFactor: 0.293, cFactor: 0.225, currentLimit: 306, r: 0.268, x: 0.128, z: 0.764512916830056, z0Ratio: 3.5 },
  { id: '3x1x95cu',  name: '3(1x95) Cu',   type: 'Yeraltı', material: 'Cu', kFactor: 0.239, cFactor: 0.162, currentLimit: 363, r: 0.193, x: 0.123, z: 0.712632443830619, z0Ratio: 3.5 },
  { id: '3x1x120cu', name: '3(1x120) Cu',  type: 'Yeraltı', material: 'Cu', kFactor: 0.207, cFactor: 0.128, currentLimit: 410, r: 0.153, x: 0.118, z: 0.682373797855691, z0Ratio: 3.5 },
  { id: '3x1x150cu', name: '3(1x150) Cu',  type: 'Yeraltı', material: 'Cu', kFactor: 0.185, cFactor: 0.104, currentLimit: 449, r: 0.124, x: 0.113, z: 0.658775379017765, z0Ratio: 3.5 },
  { id: '3x1x185cu', name: '3(1x185) Cu',  type: 'Yeraltı', material: 'Cu', kFactor: 0.166, cFactor: 0.083, currentLimit: 503, r: 0.099, x: 0.109, z: 0.63478327797761,  z0Ratio: 3.5 },
  { id: '3x1x240cu', name: '3(1x240) Cu',  type: 'Yeraltı', material: 'Cu', kFactor: 0.146, cFactor: 0.063, currentLimit: 576, r: 0.075, x: 0.104, z: 0.607695779152694, z0Ratio: 3.5 },
  { id: '3x1x400cu', name: '3(1x400) Cu',  type: 'Yeraltı', material: 'Cu', kFactor: 0.109, cFactor: 0.0394,currentLimit: 686, r: 0.047, x: 0.098, z: 0.495235297611146, z0Ratio: 3.5 },

  // --- XLPE Al (Alüminyum, tek damarlı, z0/z1 = 3.5) ---
  { id: '3x1x95al',  name: '3(1x95) AL',   type: 'Yeraltı', material: 'Al', kFactor: 0.310, cFactor: 0.268, currentLimit: 282, r: 0.320, x: 0.123, z: 0.68,              z0Ratio: 3.5 },
  { id: '3x1x120al', name: '3(1x120) AL',  type: 'Yeraltı', material: 'Al', kFactor: 0.2626,cFactor: 0.2206,currentLimit: 322, r: 0.253, x: 0.118, z: 0.642,             z0Ratio: 3.5 },
  { id: '3x1x150al', name: '3(1x150) AL',  type: 'Yeraltı', material: 'Al', kFactor: 0.228, cFactor: 0.173, currentLimit: 355, r: 0.206, x: 0.113, z: 0.606082502634748, z0Ratio: 3.5 },
  { id: '3x1x240al', name: '3(1x240) AL',  type: 'Yeraltı', material: 'Al', kFactor: 0.174, cFactor: 0.105, currentLimit: 461, r: 0.125, x: 0.104, z: 0.545,             z0Ratio: 3.5 },
  { id: '3x1x400al', name: '3(1x400) AL',  type: 'Yeraltı', material: 'Al', kFactor: 0.1305,cFactor: 0.0662,currentLimit: 572, r: 0.078, x: 0.098, z: 0.496,             z0Ratio: 3.5 },
];

// AG Kablo Kesitleri (mm²)
export const AG_CABLES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];

// AG Akım Kapasitesi (Çok Damarlı, Toprakta, 20°C)
export const AG_CABLE_CURRENT_LIMITS = {
  Cu: {
    1.5: 24, 2.5: 32, 4: 42, 6: 54, 10: 75, 16: 98, 25: 128, 35: 157,
    50: 185, 70: 228, 95: 275, 120: 313, 150: 353, 185: 399, 240: 464, 300: 552, 400: 600
  },
  Al: {
    16: 78, 25: 102, 35: 125, 50: 142, 70: 176, 95: 220,
    120: 247, 150: 278, 185: 317, 240: 374, 300: 423, 400: 480
  }
};

// DC Solar Kablo (Cu, tek damarlı, açık hava / kablo kanalı)
// Kapasite değerleri: IEC 60364-7-712 / EN 50618 referans
export const DC_SOLAR_CABLES = [
  { section: 4,  label: '4 mm²',  Ibase: 55  },
  { section: 6,  label: '6 mm²',  Ibase: 70  },
  { section: 10, label: '10 mm²', Ibase: 95  },
  { section: 16, label: '16 mm²', Ibase: 125 },
];

// AG Bara Listesi
export const AG_BUSBARS = [
  { label: '12x2 mm (24 mm²)',    val: 24 },  { label: '15x2 mm (30 mm²)',    val: 30 },
  { label: '20x2 mm (40 mm²)',    val: 40 },  { label: '25x2 mm (50 mm²)',    val: 50 },
  { label: '30x2 mm (60 mm²)',    val: 60 },  { label: '15x3 mm (45 mm²)',    val: 45 },
  { label: '20x3 mm (60 mm²)',    val: 60 },  { label: '25x3 mm (75 mm²)',    val: 75 },
  { label: '30x3 mm (90 mm²)',    val: 90 },  { label: '40x3 mm (120 mm²)',   val: 120 },
  { label: '50x3 mm (150 mm²)',   val: 150 }, { label: '20x5 mm (100 mm²)',   val: 100 },
  { label: '25x5 mm (125 mm²)',   val: 125 }, { label: '30x5 mm (150 mm²)',   val: 150 },
  { label: '40x5 mm (200 mm²)',   val: 200 }, { label: '50x5 mm (250 mm²)',   val: 250 },
  { label: '60x5 mm (300 mm²)',   val: 300 }, { label: '80x5 mm (400 mm²)',   val: 400 },
  { label: '100x5 mm (500 mm²)',  val: 500 }, { label: '125x5 mm (625 mm²)',  val: 625 },
  { label: '30x10 mm (300 mm²)',  val: 300 }, { label: '40x10 mm (400 mm²)',  val: 400 },
  { label: '50x10 mm (500 mm²)',  val: 500 }, { label: '60x10 mm (600 mm²)',  val: 600 },
  { label: '80x10 mm (800 mm²)',  val: 800 }, { label: '100x10 mm (1000 mm²)', val: 1000 },
  { label: '120x10 mm (1200 mm²)', val: 1200 }, { label: '160x10 mm (1600 mm²)', val: 1600 },
  { label: '200x10 mm (2000 mm²)', val: 2000 }, { label: '2x(100x10) mm (2000 mm²)', val: 2000 },
  { label: '2x(120x10) mm (2400 mm²)', val: 2400 }
];
