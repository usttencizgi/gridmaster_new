// AG Trafo Veritabanı - Kablo ve CB Seçim Tablosu
export const LV_TRANSFORMERS = [
  { kva: 25,   uk: 4.5, cb: 40,   hvFuse: '6 A',    cuCable: '3x10+6 mm² NYY',          alCable: '3x25+16 mm² NAYY',            measurement: 'Direk Sayaç (Akım Trafosuz)', lvCt: '40/5 A' },
  { kva: 50,   uk: 4.5, cb: 80,   hvFuse: '6 A',    cuCable: '3x25+16 mm² NYY',          alCable: '3x35+16 mm² NAYY',            measurement: 'Direk Sayaç (Akım Trafosuz)', lvCt: '75/5 A' },
  { kva: 100,  uk: 4.5, cb: 160,  hvFuse: '6 A',    cuCable: '3x50+25 mm² NYY',          alCable: '3x95+50 mm² NAYY',            measurement: 'Sekonder Ölçüm',              lvCt: '150/5 A' },
  { kva: 160,  uk: 4.5, cb: 250,  hvFuse: '10 A',   cuCable: '3x95+50 mm² NYY',          alCable: '3x185+95 mm² NAYY',           measurement: 'Sekonder Ölçüm',              lvCt: '250/5 A' },
  { kva: 250,  uk: 4.5, cb: 400,  hvFuse: '10 A',   cuCable: '1x (3x240+120 mm²)',        alCable: '2x (3x120+70 mm² NAYY)',      measurement: 'Sekonder Ölçüm',              lvCt: '400/5 A' },
  { kva: 400,  uk: 4.5, cb: 630,  hvFuse: '16 A',   cuCable: '2x (3x185+95 mm²)',         alCable: '2x (3x240+120 mm² NAYY)',     measurement: 'Sekonder Ölçüm',              lvCt: '600/5 A' },
  { kva: 630,  uk: 4.5, cb: 1000, hvFuse: '25 A',   cuCable: '3x (3x185+95 mm²)',         alCable: '3x (3x300+150 mm²)',          measurement: 'OG (Primer) Ölçüm',           hvCt: '15/5 A',  lvCt: '1000/5 A' },
  { kva: 800,  uk: 6.0, cb: 1250, hvFuse: '31.5 A', cuCable: '3x (3x185+95 mm²)',         alCable: '3x (3x300+150 mm²)',          measurement: 'OG (Primer) Ölçüm',           hvCt: '15/5 A',  lvCt: '1250/5 A' },
  { kva: 1000, uk: 6.0, cb: 1600, hvFuse: '40 A',   cuCable: '4x (3x185+95 mm²)',         alCable: '4x (3x300+150 mm²)',          busbar: '(100x10) mm Cu', measurement: 'OG (Primer) Ölçüm', hvCt: '20/5 A', lvCt: '1600/5 A' },
  { kva: 1250, uk: 6.0, cb: 2000, hvFuse: '50 A',   cuCable: '4x (3x240+120 mm²)',        alCable: '5x (3x300+150 mm²)',          busbar: '(120x10) mm Cu', measurement: 'OG (Primer) Ölçüm', hvCt: '25/5 A', lvCt: '2000/5 A' },
  { kva: 1600, uk: 6.0, cb: 2500, hvFuse: '63 A',   cuCable: '6x (3x240+120 mm²)',        alCable: '9x (3x240+120 mm²)',          busbar: '2x (100x10) mm Cu', measurement: 'OG (Primer) Ölçüm', hvCt: '30/5 A', lvCt: '2500/5 A' },
  { kva: 2000, uk: 6.0, cb: 3200, hvFuse: '63 A',   cuCable: '-',                          alCable: '-',                           busbar: '2x (120x10) mm Cu', measurement: 'OG (Primer) Ölçüm', hvCt: '40/5 A', lvCt: '3000/5 A' },
  { kva: 2500, uk: 6.0, cb: 4000, hvFuse: '80 A',   cuCable: '-',                          alCable: '-',                           busbar: '3x (120x10) mm Cu', measurement: 'OG (Primer) Ölçüm', hvCt: '50/5 A', lvCt: '4000/5 A' },
];
