import { SubuhPrepIngredient, SubuhPrepPlan } from '../types';

export interface ProductionTarget {
  name: string;
  targetPcs: number;
}

export function calculateSubuhIngredients(targets: ProductionTarget[]): SubuhPrepIngredient[] {
  let totalMayoPcs = 0;
  let totalRagoutPcs = 0;
  let totalOtherPcs = 0;

  targets.forEach((t) => {
    const lower = t.name.toLowerCase();
    if (lower.includes('mayo') || lower.includes('smoke') || lower.includes('keju')) {
      totalMayoPcs += t.targetPcs;
    } else if (lower.includes('ragout') || lower.includes('ayam') || lower.includes('sayur')) {
      totalRagoutPcs += t.targetPcs;
    } else {
      totalOtherPcs += t.targetPcs;
    }
  });

  const totalRisoles = totalMayoPcs + totalRagoutPcs + totalOtherPcs;
  if (totalRisoles <= 0) return [];

  const ingredients: SubuhPrepIngredient[] = [];

  // --- 1. BAHAN ISIAN ---
  if (totalMayoPcs > 0) {
    // Telur rebus: 1 butir per 4 potong risol mayo
    const boiledEggs = Math.ceil(totalMayoPcs / 4);
    const eggKg = Number((boiledEggs / 16).toFixed(1)); // ~16 butir per kg
    ingredients.push({
      id: 'ing-telur-rebus',
      name: `Telur Ayam Rebus (Isian Mayo)`,
      amount: boiledEggs,
      unit: `butir (~${eggKg} kg)`,
      category: 'isian',
      estPrice: Math.ceil(eggKg * 28000),
      checked: false,
    });

    // Smoked beef: 1 lembar dipotong 4
    const beefSheets = Math.ceil(totalMayoPcs / 4);
    const beefPacks = Math.ceil(beefSheets / 25); // 25 sheets/pack
    ingredients.push({
      id: 'ing-smoke-beef',
      name: `Daging Asap / Smoked Beef (${beefSheets} lembar)`,
      amount: beefPacks,
      unit: `pack (${beefPacks * 25} lbr)`,
      category: 'isian',
      estPrice: beefPacks * 45000,
      checked: false,
    });

    // Mayones spesial: 10g per pcs
    const mayoGrams = totalMayoPcs * 10;
    const mayoPacks = Number((mayoGrams / 1000).toFixed(1));
    ingredients.push({
      id: 'ing-mayones',
      name: `Mayones MamaSuka / Racik Gurih`,
      amount: Math.max(0.5, mayoPacks),
      unit: `kg (~${mayoGrams} g)`,
      category: 'isian',
      estPrice: Math.ceil(Math.max(0.5, mayoPacks) * 32000),
      checked: false,
    });

    // Keju cheddar parut: 5g per pcs
    const cheeseGrams = totalMayoPcs * 5;
    const cheeseBlocks = Math.ceil(cheeseGrams / 160);
    ingredients.push({
      id: 'ing-keju-cheddar',
      name: `Keju Cheddar Olahan`,
      amount: cheeseBlocks,
      unit: `kotak 160g (${cheeseBlocks * 160} g)`,
      category: 'isian',
      estPrice: cheeseBlocks * 14000,
      checked: false,
    });
  }

  if (totalRagoutPcs > 0) {
    // Daging ayam cincang rebus: 15g per pcs
    const chickenKg = Number(((totalRagoutPcs * 15) / 1000).toFixed(1));
    ingredients.push({
      id: 'ing-ayam-fillet',
      name: `Daging Ayam Fillet Cincang Segar`,
      amount: Math.max(0.25, chickenKg),
      unit: `kg`,
      category: 'isian',
      estPrice: Math.ceil(Math.max(0.25, chickenKg) * 38000),
      checked: false,
    });

    // Wortel segar dadu: 15g per pcs
    const carrotKg = Number(((totalRagoutPcs * 15) / 1000).toFixed(1));
    ingredients.push({
      id: 'ing-wortel',
      name: `Wortel Manis Pasar (Potong Dadu)`,
      amount: Math.max(0.5, carrotKg),
      unit: `kg`,
      category: 'isian',
      estPrice: Math.ceil(Math.max(0.5, carrotKg) * 12000),
      checked: false,
    });

    // Kentang segar dadu: 15g per pcs
    const potatoKg = Number(((totalRagoutPcs * 15) / 1000).toFixed(1));
    ingredients.push({
      id: 'ing-kentang',
      name: `Kentang Dieng Segar (Potong Dadu)`,
      amount: Math.max(0.5, potatoKg),
      unit: `kg`,
      category: 'isian',
      estPrice: Math.ceil(Math.max(0.5, potatoKg) * 16000),
      checked: false,
    });

    // Seledri & Daun Bawang
    ingredients.push({
      id: 'ing-daun-bawang',
      name: `Daun Bawang & Seledri Aromatik`,
      amount: 1,
      unit: `ikat segar`,
      category: 'isian',
      estPrice: 6000,
      checked: false,
    });
  }

  // --- 2. ADONAN KULIT RISOLES ---
  // Tepung terigu segitiga biru: ~20g per pcs kulit
  const flourKg = Number(((totalRisoles * 20) / 1000).toFixed(1));
  ingredients.push({
    id: 'ing-tepung-terigu',
    name: `Tepung Terigu Segitiga Biru (Kulit & Celup)`,
    amount: Math.max(1, flourKg),
    unit: `kg`,
    category: 'kulit',
    estPrice: Math.max(1, Math.ceil(flourKg)) * 12000,
    checked: false,
  });

  // Telur untuk adonan kulit: 1 butir per 25 pcs
  const batterEggs = Math.ceil(totalRisoles / 25);
  ingredients.push({
    id: 'ing-telur-kulit',
    name: `Telur Ayam (Adonan Kulit Lembut)`,
    amount: batterEggs,
    unit: `butir`,
    category: 'kulit',
    estPrice: Math.ceil((batterEggs / 16) * 28000),
    checked: false,
  });

  // Margarin cair: 1 sachet per 40 pcs
  const margarinPacks = Math.ceil(totalRisoles / 40);
  ingredients.push({
    id: 'ing-margarin',
    name: `Margarin Blueband 200g (Pelezat Kulit)`,
    amount: margarinPacks,
    unit: `sachet 200g`,
    category: 'kulit',
    estPrice: margarinPacks * 10000,
    checked: false,
  });

  // --- 3. PANIR & MINYAK GORENG ---
  // Tepung roti / panir: 15g per pcs
  const panirKg = Number(((totalRisoles * 15) / 1000).toFixed(1));
  ingredients.push({
    id: 'ing-tepung-panir',
    name: `Tepung Panir / Breadcrumb Kasar`,
    amount: Math.max(0.5, panirKg),
    unit: `kg`,
    category: 'panir_minyak',
    estPrice: Math.ceil(Math.max(0.5, panirKg) * 22000),
    checked: false,
  });

  // Minyak goreng deep fry: ~2 liter per 60 pcs
  const oilPouches = Math.max(1, Math.ceil(totalRisoles / 60));
  ingredients.push({
    id: 'ing-minyak-goreng',
    name: `Minyak Goreng Sawit Kemasan 2L`,
    amount: oilPouches,
    unit: `pouch 2L (${oilPouches * 2} Liter)`,
    category: 'panir_minyak',
    estPrice: oilPouches * 38000,
    checked: false,
  });

  // --- 4. PELENGKAP & KEMASAN ---
  // Cabe rawit hijau: ~1.5 butir per risoles
  const chiliGrams = Math.ceil(totalRisoles * 4); // ~4 gram per biji rawit
  const chiliOns = Math.max(2, Math.ceil(chiliGrams / 100));
  ingredients.push({
    id: 'ing-cabe-rawit',
    name: `Cabe Rawit Hijau Segar (Ceplusan)`,
    amount: chiliOns,
    unit: `ons (${chiliOns * 100} gram)`,
    category: 'kemasan',
    estPrice: Math.ceil((chiliOns / 10) * 36000),
    checked: false,
  });

  // Dus Kotak Dulang: rata-rata 4 risoles per box
  const boxes = Math.ceil(totalRisoles / 4);
  ingredients.push({
    id: 'ing-dus-box',
    name: `Dus Box Dulang Cetak + Renda Kertas`,
    amount: boxes,
    unit: `pcs`,
    category: 'kemasan',
    estPrice: boxes * 800,
    checked: false,
  });

  return ingredients;
}

export function formatSubuhShoppingWhatsApp(plan: SubuhPrepPlan): string {
  const dateFormatted = plan.targetDate
    ? new Date(plan.targetDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Besok Subuh';

  const totalPcs = plan.items.reduce((sum, item) => sum + item.targetPcs, 0);

  let msg = `🛒 *CHECKLIST BELANJA PASAR SUBUH — DAPUR DULANG* 🌅\n`;
  msg += `📅 Jadwal Masak: *${dateFormatted}*\n`;
  msg += `🥟 Target Produksi: *${totalPcs} Pcs Risoles*\n`;
  plan.items.forEach((it) => {
    if (it.targetPcs > 0) {
      msg += `  • ${it.name}: ${it.targetPcs} pcs\n`;
    }
  });
  msg += `\n================================\n`;

  const categories = [
    { key: 'isian', label: '🥩 BAHAN ISIAN UTAMA' },
    { key: 'kulit', label: '🥞 BAHAN KULIT & ADONAN' },
    { key: 'panir_minyak', label: '🔥 PANIR & MINYAK GORENG' },
    { key: 'kemasan', label: '📦 PELENGKAP & KEMASAN' },
  ] as const;

  categories.forEach((cat) => {
    const list = plan.ingredients.filter((i) => i.category === cat.key);
    if (list.length > 0) {
      msg += `\n*${cat.label}:*\n`;
      list.forEach((item) => {
        const checkMark = item.checked ? '✅' : '◻️';
        msg += `${checkMark} ${item.name}: *${item.amount} ${item.unit}* (~Rp ${item.estPrice.toLocaleString('id-ID')})\n`;
      });
    }
  });

  msg += `\n================================\n`;
  msg += `💰 *ESTIMASI ANGGARAN PASAR: Rp ${plan.totalEstBudget.toLocaleString('id-ID')}*\n`;
  if (plan.notes?.trim()) {
    msg += `📝 Catatan: ${plan.notes.trim()}\n`;
  }
  msg += `\nSemangat belanja subuh di pasar ya! Semoga berkah dan gorengan lumer laris manis hari ini 🙏✨🥟`;

  return msg;
}
