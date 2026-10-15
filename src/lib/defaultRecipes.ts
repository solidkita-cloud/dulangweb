import { PantryIngredient, MenuRecipe, RecipeItemComponent } from '../types';

export const DEFAULT_PANTRY_INGREDIENTS: PantryIngredient[] = [
  // --- KULIT & ADONAN ---
  {
    id: 'ing-terigu',
    name: 'Tepung Terigu Segitiga Biru',
    category: 'kulit',
    unit: 'kg',
    currentStock: 12,
    minStock: 4,
    costPerUnit: 12000,
  },
  {
    id: 'ing-telur-adonan',
    name: 'Telur Ayam (Adonan Kulit & Celupan)',
    category: 'kulit',
    unit: 'butir',
    currentStock: 80,
    minStock: 25,
    costPerUnit: 1750,
  },
  {
    id: 'ing-susu-cair',
    name: 'Susu Cair UHT / Santan Adonan',
    category: 'kulit',
    unit: 'liter',
    currentStock: 6,
    minStock: 2,
    costPerUnit: 18000,
  },
  {
    id: 'ing-mentega',
    name: 'Margarin / Mentega Leleh',
    category: 'kulit',
    unit: 'kg',
    currentStock: 4,
    minStock: 1.5,
    costPerUnit: 24000,
  },
  {
    id: 'ing-tortilla',
    name: 'Kulit Tortilla Kebab',
    category: 'kulit',
    unit: 'lembar',
    currentStock: 40,
    minStock: 15,
    costPerUnit: 1800,
  },
  {
    id: 'ing-bun-burger',
    name: 'Roti Bun Burger Wijen',
    category: 'kulit',
    unit: 'pcs',
    currentStock: 30,
    minStock: 10,
    costPerUnit: 2500,
  },

  // --- ISIAN RISOLES & SNACK ---
  {
    id: 'ing-smoked-beef',
    name: 'Smoked Beef Slices (Daging Asap)',
    category: 'isian',
    unit: 'lembar',
    currentStock: 120,
    minStock: 30,
    costPerUnit: 1800,
  },
  {
    id: 'ing-telur-rebus',
    name: 'Telur Ayam Rebus (Isian Mayo)',
    category: 'isian',
    unit: 'butir',
    currentStock: 60,
    minStock: 20,
    costPerUnit: 1750,
  },
  {
    id: 'ing-mayones',
    name: 'Mayones Gurih Racik Dulang',
    category: 'isian',
    unit: 'kg',
    currentStock: 6,
    minStock: 2,
    costPerUnit: 32000,
  },
  {
    id: 'ing-keju-cheddar',
    name: 'Keju Cheddar Olahan Balok',
    category: 'isian',
    unit: 'kotak',
    currentStock: 8,
    minStock: 2,
    costPerUnit: 14000,
  },
  {
    id: 'ing-ayam-fillet',
    name: 'Daging Ayam Fillet Cincang Segar',
    category: 'isian',
    unit: 'kg',
    currentStock: 5,
    minStock: 1.5,
    costPerUnit: 38000,
  },
  {
    id: 'ing-wortel',
    name: 'Wortel Segar Dadu Manis',
    category: 'isian',
    unit: 'kg',
    currentStock: 6,
    minStock: 2,
    costPerUnit: 14000,
  },
  {
    id: 'ing-kentang',
    name: 'Kentang Dieng Dadu',
    category: 'isian',
    unit: 'kg',
    currentStock: 5,
    minStock: 1.5,
    costPerUnit: 18000,
  },
  {
    id: 'ing-susu-skm',
    name: 'Susu Kental Manis / Bumbu Ragout',
    category: 'isian',
    unit: 'kaleng',
    currentStock: 5,
    minStock: 1,
    costPerUnit: 12000,
  },
  {
    id: 'ing-pisang',
    name: 'Pisang Raja / Candi Manis',
    category: 'isian',
    unit: 'sisir',
    currentStock: 6,
    minStock: 2,
    costPerUnit: 15000,
  },
  {
    id: 'ing-coklat',
    name: 'Cokelat Meises / Lumer',
    category: 'isian',
    unit: 'kg',
    currentStock: 3,
    minStock: 1,
    costPerUnit: 28000,
  },
  {
    id: 'ing-daging-kebab',
    name: 'Daging Kebab Panggang Slices',
    category: 'isian',
    unit: 'pack',
    currentStock: 6,
    minStock: 2,
    costPerUnit: 42000,
  },
  {
    id: 'ing-patty-burger',
    name: 'Patty Daging Burger Premium',
    category: 'isian',
    unit: 'pcs',
    currentStock: 30,
    minStock: 10,
    costPerUnit: 4500,
  },

  // --- PANIR & MINYAK GORENG ---
  {
    id: 'ing-tepung-panir',
    name: 'Tepung Panir / Breadcrumbs Halus',
    category: 'panir_minyak',
    unit: 'kg',
    currentStock: 10,
    minStock: 3,
    costPerUnit: 18000,
  },
  {
    id: 'ing-minyak-goreng',
    name: 'Minyak Goreng Sawit Kualitas Baik',
    category: 'panir_minyak',
    unit: 'liter',
    currentStock: 15,
    minStock: 5,
    costPerUnit: 17000,
  },

  // --- KEMASAN & PELENGKAP ---
  {
    id: 'ing-dus-box',
    name: 'Dus Box Dulang Indonesia Sablon Resmi',
    category: 'kemasan',
    unit: 'pcs',
    currentStock: 200,
    minStock: 40,
    costPerUnit: 1200,
  },
  {
    id: 'ing-mika-plastik',
    name: 'Mika Plastik Klip Bersih (Pack Frozen/Snack)',
    category: 'kemasan',
    unit: 'pcs',
    currentStock: 250,
    minStock: 50,
    costPerUnit: 350,
  },
  {
    id: 'ing-cabe-rawit',
    name: 'Cabe Rawit Hijau Segar & Saos Sachet',
    category: 'kemasan',
    unit: 'kg',
    currentStock: 3,
    minStock: 0.5,
    costPerUnit: 35000,
  },
];

export function calculateRecipeHpp(components: RecipeItemComponent[], pantry: PantryIngredient[]): number {
  return components.reduce((sum, comp) => {
    const ing = pantry.find((p) => p.id === comp.ingredientId);
    if (!ing) return sum;
    return sum + (comp.amountPerPcs * ing.costPerUnit);
  }, 0);
}

export const DEFAULT_MENU_RECIPES: MenuRecipe[] = [
  // 1. Risol Mayo (Harga Rp 3.500)
  {
    menuId: 'menu-1',
    menuName: 'Risol Mayo',
    components: [
      { ingredientId: 'ing-terigu', ingredientName: 'Tepung Terigu', amountPerPcs: 0.018, unit: 'kg' },
      { ingredientId: 'ing-telur-adonan', ingredientName: 'Telur Adonan', amountPerPcs: 0.08, unit: 'butir' },
      { ingredientId: 'ing-susu-cair', ingredientName: 'Susu Cair UHT', amountPerPcs: 0.01, unit: 'liter' },
      { ingredientId: 'ing-smoked-beef', ingredientName: 'Smoked Beef', amountPerPcs: 0.25, unit: 'lembar' },
      { ingredientId: 'ing-telur-rebus', ingredientName: 'Telur Rebus', amountPerPcs: 0.25, unit: 'butir' },
      { ingredientId: 'ing-mayones', ingredientName: 'Mayones Dulang', amountPerPcs: 0.01, unit: 'kg' },
      { ingredientId: 'ing-tepung-panir', ingredientName: 'Tepung Panir', amountPerPcs: 0.012, unit: 'kg' },
      { ingredientId: 'ing-minyak-goreng', ingredientName: 'Minyak Goreng', amountPerPcs: 0.012, unit: 'liter' },
    ],
    calculatedHpp: 2211,
  },
  // 2. Risol Rogut (Harga Rp 3.500)
  {
    menuId: 'menu-2',
    menuName: 'Risol Rogut',
    components: [
      { ingredientId: 'ing-terigu', ingredientName: 'Tepung Terigu', amountPerPcs: 0.018, unit: 'kg' },
      { ingredientId: 'ing-telur-adonan', ingredientName: 'Telur Adonan', amountPerPcs: 0.08, unit: 'butir' },
      { ingredientId: 'ing-ayam-fillet', ingredientName: 'Ayam Fillet Cincang', amountPerPcs: 0.012, unit: 'kg' },
      { ingredientId: 'ing-wortel', ingredientName: 'Wortel Dadu', amountPerPcs: 0.015, unit: 'kg' },
      { ingredientId: 'ing-kentang', ingredientName: 'Kentang Dadu', amountPerPcs: 0.01, unit: 'kg' },
      { ingredientId: 'ing-susu-skm', ingredientName: 'Susu SKM & Bumbu', amountPerPcs: 0.015, unit: 'kaleng' },
      { ingredientId: 'ing-tepung-panir', ingredientName: 'Tepung Panir', amountPerPcs: 0.012, unit: 'kg' },
      { ingredientId: 'ing-minyak-goreng', ingredientName: 'Minyak Goreng', amountPerPcs: 0.012, unit: 'liter' },
    ],
    calculatedHpp: 1802,
  },
  // 3. Lumpia Sayur (Harga Rp 2.500)
  {
    menuId: 'menu-3',
    menuName: 'Lumpia Sayur',
    components: [
      { ingredientId: 'ing-terigu', ingredientName: 'Tepung Terigu Kulit', amountPerPcs: 0.015, unit: 'kg' },
      { ingredientId: 'ing-wortel', ingredientName: 'Wortel & Rebung Sayur', amountPerPcs: 0.03, unit: 'kg' },
      { ingredientId: 'ing-minyak-goreng', ingredientName: 'Minyak Goreng', amountPerPcs: 0.015, unit: 'liter' },
    ],
    calculatedHpp: 1100,
  },
  // 4. Pisang Coklat (Harga Rp 2.500)
  {
    menuId: 'menu-4',
    menuName: 'Pisang Coklat',
    components: [
      { ingredientId: 'ing-terigu', ingredientName: 'Kulit Renyah', amountPerPcs: 0.015, unit: 'kg' },
      { ingredientId: 'ing-pisang', ingredientName: 'Pisang Manis', amountPerPcs: 0.05, unit: 'sisir' },
      { ingredientId: 'ing-coklat', ingredientName: 'Cokelat Meises/Lumer', amountPerPcs: 0.015, unit: 'kg' },
      { ingredientId: 'ing-minyak-goreng', ingredientName: 'Minyak Goreng', amountPerPcs: 0.015, unit: 'liter' },
    ],
    calculatedHpp: 1220,
  },
  // 5. Tahu Isi Pedas (Harga Rp 3.000)
  {
    menuId: 'menu-5',
    menuName: 'Tahu Isi Pedas',
    components: [
      { ingredientId: 'ing-wortel', ingredientName: 'Isian Sayur Pedas', amountPerPcs: 0.025, unit: 'kg' },
      { ingredientId: 'ing-cabe-rawit', ingredientName: 'Cabe Rawit Uleg', amountPerPcs: 0.005, unit: 'kg' },
      { ingredientId: 'ing-terigu', ingredientName: 'Baluran Tepung Renyah', amountPerPcs: 0.015, unit: 'kg' },
      { ingredientId: 'ing-minyak-goreng', ingredientName: 'Minyak Goreng', amountPerPcs: 0.018, unit: 'liter' },
    ],
    calculatedHpp: 1450,
  },
  // 6. Ote-Ote (Harga Rp 2.000)
  {
    menuId: 'menu-6',
    menuName: 'Ote-Ote',
    components: [
      { ingredientId: 'ing-terigu', ingredientName: 'Adonan Terigu Gurih', amountPerPcs: 0.02, unit: 'kg' },
      { ingredientId: 'ing-wortel', ingredientName: 'Sayur Campur Segar', amountPerPcs: 0.02, unit: 'kg' },
      { ingredientId: 'ing-minyak-goreng', ingredientName: 'Minyak Goreng', amountPerPcs: 0.015, unit: 'liter' },
    ],
    calculatedHpp: 850,
  },
  // 7. Kebab (Harga Rp 10.000)
  {
    menuId: 'menu-7',
    menuName: 'Kebab',
    components: [
      { ingredientId: 'ing-tortilla', ingredientName: 'Kulit Tortilla Kebab', amountPerPcs: 1, unit: 'lembar' },
      { ingredientId: 'ing-daging-kebab', ingredientName: 'Daging Kebab Slices', amountPerPcs: 0.08, unit: 'pack' },
      { ingredientId: 'ing-mayones', ingredientName: 'Mayones & Saos', amountPerPcs: 0.015, unit: 'kg' },
    ],
    calculatedHpp: 5450,
  },
  // 8. Burger (Harga Rp 13.000)
  {
    menuId: 'menu-8',
    menuName: 'Burger',
    components: [
      { ingredientId: 'ing-bun-burger', ingredientName: 'Roti Bun Wijen', amountPerPcs: 1, unit: 'pcs' },
      { ingredientId: 'ing-patty-burger', ingredientName: 'Patty Daging Burger', amountPerPcs: 1, unit: 'pcs' },
      { ingredientId: 'ing-mayones', ingredientName: 'Mayones & Saos', amountPerPcs: 0.015, unit: 'kg' },
      { ingredientId: 'ing-keju-cheddar', ingredientName: 'Keju Slice', amountPerPcs: 0.02, unit: 'kotak' },
    ],
    calculatedHpp: 7760,
  },
  // 9. Risol Mayo Frozen Isi 5 (Harga Rp 17.000)
  {
    menuId: 'menu-9',
    menuName: 'Risol Mayo Frozen (Isi 5)',
    components: [
      { ingredientId: 'ing-terigu', ingredientName: 'Tepung Terigu (5 pcs)', amountPerPcs: 0.09, unit: 'kg' },
      { ingredientId: 'ing-telur-adonan', ingredientName: 'Telur Adonan (5 pcs)', amountPerPcs: 0.4, unit: 'butir' },
      { ingredientId: 'ing-susu-cair', ingredientName: 'Susu Cair UHT (5 pcs)', amountPerPcs: 0.05, unit: 'liter' },
      { ingredientId: 'ing-smoked-beef', ingredientName: 'Smoked Beef (5 pcs)', amountPerPcs: 1.25, unit: 'lembar' },
      { ingredientId: 'ing-telur-rebus', ingredientName: 'Telur Rebus (5 pcs)', amountPerPcs: 1.25, unit: 'butir' },
      { ingredientId: 'ing-mayones', ingredientName: 'Mayones Dulang (5 pcs)', amountPerPcs: 0.05, unit: 'kg' },
      { ingredientId: 'ing-tepung-panir', ingredientName: 'Tepung Panir (5 pcs)', amountPerPcs: 0.06, unit: 'kg' },
      { ingredientId: 'ing-mika-plastik', ingredientName: 'Mika Klip Frozen', amountPerPcs: 1, unit: 'pcs' },
    ],
    calculatedHpp: 9800,
  },
  // 10. Risol Rogut Frozen Isi 5 (Harga Rp 17.000)
  {
    menuId: 'menu-10',
    menuName: 'Risol Rogut Frozen (Isi 5)',
    components: [
      { ingredientId: 'ing-terigu', ingredientName: 'Tepung Terigu (5 pcs)', amountPerPcs: 0.09, unit: 'kg' },
      { ingredientId: 'ing-telur-adonan', ingredientName: 'Telur Adonan (5 pcs)', amountPerPcs: 0.4, unit: 'butir' },
      { ingredientId: 'ing-ayam-fillet', ingredientName: 'Ayam Fillet Cincang (5 pcs)', amountPerPcs: 0.06, unit: 'kg' },
      { ingredientId: 'ing-wortel', ingredientName: 'Wortel Dadu (5 pcs)', amountPerPcs: 0.075, unit: 'kg' },
      { ingredientId: 'ing-kentang', ingredientName: 'Kentang Dadu (5 pcs)', amountPerPcs: 0.05, unit: 'kg' },
      { ingredientId: 'ing-susu-skm', ingredientName: 'Susu SKM & Bumbu (5 pcs)', amountPerPcs: 0.075, unit: 'kaleng' },
      { ingredientId: 'ing-tepung-panir', ingredientName: 'Tepung Panir (5 pcs)', amountPerPcs: 0.06, unit: 'kg' },
      { ingredientId: 'ing-mika-plastik', ingredientName: 'Mika Klip Frozen', amountPerPcs: 1, unit: 'pcs' },
    ],
    calculatedHpp: 8350,
  },
];
