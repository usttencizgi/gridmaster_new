import { AG_CABLES, AG_CABLE_CURRENT_LIMITS } from '../data/cables.js';

// =========================================================
// OG GERİLİM DÜŞÜMÜ
// =========================================================
export function calcOgVoltageDrop(nodes, cablesDB) {
  let cumulativeDropPercent = 0;
  let totalLossKW = 0;
  const results = [];

  let accumulatedLoad = 0;
  const processedNodes = [...nodes].reverse().map(node => {
    accumulatedLoad += Number(node.loadKVA || 0);
    return { ...node, linePowerKVA: accumulatedLoad };
  }).reverse();

  processedNodes.forEach(node => {
    const cable = cablesDB.find(c => c.id === node.cableTypeId);
    if (!cable) return;
    const n = node.circuitCount || 1;
    const powerN = node.linePowerKVA;
    const currentAmps = powerN > 0 ? powerN / (1.732 * 34.5) : 0;
    const dropPercent = (cable.kFactor * powerN * node.length * Math.pow(10, -4)) / n;
    cumulativeDropPercent += dropPercent;
    const powerLossKW = (cable.cFactor * Math.pow(powerN, 2) * node.length * Math.pow(10, -6)) / n;
    totalLossKW += powerLossKW;
    const endVoltage = 34.5 * (1 - (cumulativeDropPercent / 100));
    const capacityUsage = currentAmps > 0 ? (currentAmps / (cable.currentLimit * n)) * 100 : 0;
    results.push({
      nodeId: node.id, linePowerKVA: powerN, segmentCurrent: currentAmps,
      voltageDropPercent: dropPercent, totalDropPercent: cumulativeDropPercent,
      powerLoss: powerLossKW, endVoltage, capacityUsage,
      isSafeDrop: cumulativeDropPercent <= 7,
      isSafeCurrent: capacityUsage <= 100,
    });
  });

  return { results, processedNodes, totalLossKW };
}

// =========================================================
// OG KISA DEVRE (Üç Faz — IEC 60909)
// NOT: Çift devre → paralel iki hat empedansı yarıya düşer
// =========================================================
export function calcOgShortCircuit(sourceParams, lines, cablesDB) {
  const Sb = 100;       // MVA baz güç
  const Ub = 34.5;      // kV baz gerilim
  const Zb = (Ub * Ub) / Sb;            // 11.9025 Ω
  const Ib = (Sb * 1000) / (1.732 * Ub); // 1673.5 A
  const c  = 1.10;                        // IEC 60909 gerilim faktörü
  const kappa = 1.02;                     // Yöntem C

  // ── 1. Kaynak empedansı (pozitif sıra) ──────────────────────────
  let Z_bara_pu = 0, Z_grid_pu = 0, Z_trafo_pu = 0;
  let Sk154_MVA = 0, trafoPower = 0, trafoUk = 0;

  if (sourceParams.type === 'power') {
    Sk154_MVA  = sourceParams.sk154     || 0;
    trafoPower = sourceParams.trafoPower || 0;
    trafoUk    = sourceParams.trafoUk   || 0;
    Z_grid_pu  = Sk154_MVA > 0 ? Sb / Sk154_MVA : 0;
    if (trafoPower > 0) {
      const Z_trafo_ohm = (trafoUk / 100) * ((Ub * Ub) / trafoPower);
      Z_trafo_pu = Z_trafo_ohm / Zb;
    }
    Z_bara_pu = Z_grid_pu + Z_trafo_pu;
  } else {
    const Ik_source_kA = (sourceParams.current || 0) / 1000;
    if (Ik_source_kA <= 0) return { busbarCurrent: 0, lineEndCurrent: 0, Ik1_bara: 0, Ik1_end: 0 };
    const Z_sys_ohm = (c * Ub) / (1.732 * Ik_source_kA);
    Z_bara_pu = Z_sys_ohm / Zb;
  }

  // ── 2. Bara kısa devre akımı (üç faz) ───────────────────────────
  const busbarCurrent_kA = Z_bara_pu > 0 ? (c * Ib / Z_bara_pu) / 1000 : 0;
  const ip_bara_kA = kappa * Math.sqrt(2) * busbarCurrent_kA;

  // ── 3. Hat detayları (sıralı hesap) ─────────────────────────────
  let Z_lines_total_ohm = 0;
  const lineDetails = lines.map((line, idx) => {
    const cable     = cablesDB.find(c => c.id === line.cableTypeId);
    const n         = line.circuitCount || 1;
    const Z_seg_ohm = cable ? (line.length * cable.z) / n : 0;
    const R_seg_ohm = cable ? (line.length * (cable.r || cable.z * 0.6)) / n : 0;
    const X_seg_ohm = cable ? (line.length * (cable.x || cable.z * 0.8)) / n : 0;
    Z_lines_total_ohm += Z_seg_ohm;
    return {
      idx: idx + 1, cableTypeId: line.cableTypeId,
      cableName: cable?.name || '—', section: cable?.section || '—',
      length: line.length, circuitCount: n,
      z0Ratio: cable?.z0Ratio ?? 3.5,
      Z_seg_ohm, R_seg_ohm, X_seg_ohm,
      fromBus: idx === 0 ? '34.5 kV Barası' : `Hat ${idx} Sonu`,
      toBus: `Hat ${idx + 1} Sonu`,
    };
  });

  const Z_lines_pu = Z_lines_total_ohm / Zb;
  const Z_total_pu = Z_bara_pu + Z_lines_pu;
  const Ik3_end_kA = Z_total_pu > 0 ? (c * Ib / Z_total_pu) / 1000 : 0;
  const ip_end_kA  = kappa * Math.sqrt(2) * Ik3_end_kA;

  // ── 4. Sıfır sıra empedansı (faz–toprak için) ───────────────────
  const trafoTip = sourceParams.trafoTip || 'Dyn';
  // Dyn: delta primer şebeke Z0'ını bloklar → Z0_kaynak = yalnızca trafo
  // type='current' modunda Z_trafo_pu = 0 olabilir → Z_bara_pu kullan
  const Z0_kaynak_pu = trafoTip === 'Dyn'
    ? (Z_trafo_pu > 0 ? Z_trafo_pu : Z_bara_pu * 0.8) // tip=current: bara'nın %80'i trafo payı
    : Z_bara_pu;

  let Z0_lines_pu = 0;
  lineDetails.forEach(d => { Z0_lines_pu += (d.Z_seg_ohm * d.z0Ratio) / Zb; });

  const Z0_bara_pu  = Z0_kaynak_pu;
  const Z0_total_pu = Z0_kaynak_pu + Z0_lines_pu;

  // I"k1 = c × 3 × Ib / (2×Z1 + Z0)  — IEC 60909
  const Ik1_bara_kA = (Z_bara_pu > 0 && Z0_bara_pu > 0)
    ? (c * 3 * Ib / ((2 * Z_bara_pu  + Z0_bara_pu)  * 1000)) : 0;
  const Ik1_end_kA  = (Z_total_pu > 0 && Z0_total_pu > 0)
    ? (c * 3 * Ib / ((2 * Z_total_pu + Z0_total_pu) * 1000)) : 0;
  const ip1_bara_kA = kappa * Math.sqrt(2) * Ik1_bara_kA;
  const ip1_end_kA  = kappa * Math.sqrt(2) * Ik1_end_kA;

  // ── 5. Sıra empedansları ─────────────────────────────────────────
  const Z1_bara_ohm = Z_bara_pu * Zb;
  const Z1_end_ohm  = Z_total_pu * Zb;

  return {
    busbarCurrent:  busbarCurrent_kA,
    lineEndCurrent: Ik3_end_kA,
    ip_bara:        ip_bara_kA,
    ip_end:         ip_end_kA,
    Ik1_bara:  Ik1_bara_kA,  Ik1_end:  Ik1_end_kA,
    ip1_bara:  ip1_bara_kA,  ip1_end:  ip1_end_kA,
    Z0_bara_pu, Z0_total_pu, Z0_lines_pu, Z0_kaynak_pu, trafoTip,
    zBaraPu: Z_bara_pu,  zTotalPu: Z_total_pu,
    Z_grid_pu, Z_trafo_pu, Z_lines_pu, Z_lines_total_ohm,
    Z1_bara_ohm, Z1_end_ohm, lineDetails,
    Zb, Ib, Sb, Ub, c, kappa,
    Sk154_MVA, trafoPower, trafoUk,
  };
}

// =========================================================
// AG GERİLİM DÜŞÜMÜ - BASİT
// =========================================================
export function calcAgDropSimple(phase, material, powerKW, lengthM, sectionMM2, cosPhi = 0.98) {
  let k = 0, u = 380, isMono = false;
  if (phase === 'tri')      { k = material === 'Cu' ? 0.0124 : 0.02;  u = 380; }
  else if (phase === 'tri400') { k = material === 'Cu' ? 0.0112 : 0.018; u = 400; }
  else                      { k = material === 'Cu' ? 0.074  : 0.12;  u = 220; isMono = true; }

  const dropPercent = (k * lengthM * powerKW) / sectionMM2;
  const currentAmps = isMono
    ? (powerKW * 1000) / (u * cosPhi)
    : (powerKW * 1000) / (1.732 * u * cosPhi);

  let capacity = 9999, isSafeCurrent = true;
  const limits = AG_CABLE_CURRENT_LIMITS[material];
  if (limits && limits[sectionMM2]) { capacity = limits[sectionMM2]; isSafeCurrent = currentAmps <= capacity; }

  return { dropPercent, currentAmps, capacity, isSafeCurrent };
}

// =========================================================
// AG GERİLİM DÜŞÜMÜ - AĞ (forward-sweep)
// =========================================================
export function calcAgDropNetwork(nodes, voltageOption, cosPhi) {
  let cumulativeDrop = 0;
  return nodes.map(node => {
    const voltage = voltageOption === 'tri400' ? 400 : 380;
    const k = voltageOption === 'tri400'
      ? (node.material === 'Cu' ? 0.0112 : 0.018)
      : (node.material === 'Cu' ? 0.0124 : 0.02);
    const s = node.section, n = node.circuitCount || 1;
    const currentLoadKW = Number(node.powerKW || 0);
    const drop = (k * node.length * currentLoadKW) / (s * n);
    cumulativeDrop += drop;
    const currentAmps = (currentLoadKW * 1000) / (1.732 * voltage * cosPhi);
    const ampsPerCircuit = currentAmps / n;
    let capacity = 9999, isSafeCurrent = true;
    if (AG_CABLES.includes(s)) {
      const limits = AG_CABLE_CURRENT_LIMITS[node.material];
      if (limits && limits[s]) { capacity = limits[s] * n; isSafeCurrent = currentAmps <= capacity; }
    }
    return { ...node, segmentDrop: drop, totalDrop: cumulativeDrop, currentAmps, ampsPerCircuit, capacity, isSafeCurrent, currentLoadKW };
  });
}

// =========================================================
// AG KISA DEVRE — Zincir Hesap Motoru
//
// Üç-faz için tek yön (faz iletkeni) empedansı kullanılır:
//   Z_eleman = ρ × L / (S × n)           [Ω]
//   I₃k = c × Un / (√3 × ΣZ)             [A]  (c=1.0 min, 1.1 max — IEC 60909)
//
// Tek-faz (faz-nötr) için gidiş+dönüş:
//   Z_tek_faz = 2 × ρ × L / (S × n)
//   I₁k ≈ I₃k × 0.85  (nötr kesiti = faz kesiti varsayımıyla yaklaşık)
// =========================================================
const RHO = { Cu: 0.01786, Al: 0.02941 }; // Ω·mm²/m

export function calcAgShortCircuitChain(trafoKva, trafoUk, nodes) {
  const Un = 0.4; // kV
  const In  = trafoKva / (1.732 * Un);                           // A
  const Z_trafo = (trafoUk / 100) * ((Un * Un * 1000) / trafoKva); // Ω

  const results = [];
  let Z_cumulative = Z_trafo;

  nodes.forEach((node) => {
    if (node.type === 'busbar') {
      // Bara empedansı: Z = ρ × L / (S × n)
      const rho = RHO[node.material] || RHO['Cu'];
      const n   = node.circuitCount || 1;
      const Z_bar = (node.length > 0 && node.section > 0)
        ? (rho * node.length) / (node.section * n)
        : 0;
      Z_cumulative += Z_bar;

      const Ik3 = (Un * 1000) / (1.732 * Z_cumulative);
      results.push({ ...node, Z_element: Z_bar, Z_cumulative, Ik3_kA: Ik3 / 1000, Ik1_kA: (Ik3 * 0.85) / 1000 });

    } else if (node.type === 'cable') {
      // Kablo empedansı: Z = ρ × L / (S × n)  (üç-faz, tek yön)
      const rho = RHO[node.material] || RHO['Cu'];
      const n   = node.circuitCount || 1;
      const Z_hat = (rho * node.length) / (node.section * n);
      Z_cumulative += Z_hat;

      const Ik3 = (Un * 1000) / (1.732 * Z_cumulative);
      results.push({ ...node, Z_element: Z_hat, Z_cumulative, Ik3_kA: Ik3 / 1000, Ik1_kA: (Ik3 * 0.85) / 1000 });
    }
  });

  return { In, Z_trafo, results };
}
