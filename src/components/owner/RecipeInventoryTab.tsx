import React, { useState, useEffect } from 'react';
import {
  PantryIngredient,
  MenuRecipe,
  MenuItem,
  IngredientCategory,
} from '../../types';
import { storageService } from '../../services/storageService';
import { calculateRecipeHpp } from '../../lib/defaultRecipes';

interface RecipeInventoryTabProps {
  menus: MenuItem[];
  onShowToast: (msg: string) => void;
  onRefreshExpenses?: () => void;
}

export const RecipeInventoryTab: React.FC<RecipeInventoryTabProps> = ({
  menus,
  onShowToast,
  onRefreshExpenses,
}) => {
  const [subView, setSubView] = useState<'pantry' | 'recipes'>('pantry');
  const [pantry, setPantry] = useState<PantryIngredient[]>(() =>
    storageService.getPantryIngredients()
  );
  const [recipes, setRecipes] = useState<MenuRecipe[]>(() =>
    storageService.getMenuRecipes()
  );
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | IngredientCategory | 'low_stock'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Restock
  const [restockItem, setRestockItem] = useState<PantryIngredient | null>(null);
  const [restockQty, setRestockQty] = useState<number | ''>(5);
  const [restockCost, setRestockCost] = useState<number | ''>('');
  const [restockRecordExpense, setRestockRecordExpense] = useState(true);

  // Modal Tambah Bahan Baru
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] =
    useState<IngredientCategory>('isian');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngStock, setNewIngStock] = useState<number | ''>(5);
  const [newIngMinStock, setNewIngMinStock] = useState<number | ''>(2);
  const [newIngCost, setNewIngCost] = useState<number | ''>(15000);

  // Modal Edit Resep
  const [selectedRecipeForEdit, setSelectedRecipeForEdit] =
    useState<MenuRecipe | null>(null);

  // Listen for storage events
  useEffect(() => {
    const handlePantryUpdate = () => {
      setPantry(storageService.getPantryIngredients());
    };
    const handleRecipesUpdate = () => {
      setRecipes(storageService.getMenuRecipes());
    };
    window.addEventListener('dulang_pantry_updated', handlePantryUpdate);
    window.addEventListener('dulang_recipes_updated', handleRecipesUpdate);
    return () => {
      window.removeEventListener('dulang_pantry_updated', handlePantryUpdate);
      window.removeEventListener('dulang_recipes_updated', handleRecipesUpdate);
    };
  }, []);

  const lowStockItems = pantry.filter((p) => p.currentStock <= p.minStock);

  // Filtered Pantry Items
  const filteredPantry = pantry.filter((item) => {
    if (categoryFilter === 'low_stock') {
      if (item.currentStock > item.minStock) return false;
    } else if (categoryFilter !== 'all') {
      if (item.category !== categoryFilter) return false;
    }
    if (!searchQuery.trim()) return true;
    return (
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Handler: Restock
  const handleOpenRestock = (item: PantryIngredient) => {
    setRestockItem(item);
    setRestockQty(5);
    setRestockCost(item.costPerUnit);
    setRestockRecordExpense(true);
  };

  const handleSaveRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;
    const qty = Number(restockQty);
    const cost = Number(restockCost) || restockItem.costPerUnit;
    if (isNaN(qty) || qty <= 0) {
      onShowToast('Nominal jumlah restock tidak valid');
      return;
    }

    storageService.restockIngredient(
      restockItem.id,
      qty,
      cost,
      restockRecordExpense
    );
    setPantry(storageService.getPantryIngredients());
    setRestockItem(null);
    if (onRefreshExpenses && restockRecordExpense) {
      onRefreshExpenses();
    }
    onShowToast(
      `✓ Restock ${restockItem.name} (+${qty} ${restockItem.unit}) berhasil disimpan! ${
        restockRecordExpense ? 'Tercatat di Buku Kas.' : ''
      }`
    );
  };

  // Handler: Tambah Bahan Baru
  const handleSaveNewIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) return;

    const newItem: PantryIngredient = {
      id: `ing-custom-${Date.now()}`,
      name: newIngName.trim(),
      category: newIngCategory,
      unit: newIngUnit.trim() || 'kg',
      currentStock: Number(newIngStock) || 0,
      minStock: Number(newIngMinStock) || 1,
      costPerUnit: Number(newIngCost) || 0,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...pantry, newItem];
    storageService.savePantryIngredients(updated);
    setPantry(updated);
    setIsAddingIngredient(false);
    setNewIngName('');
    onShowToast(`Bahan baru "${newItem.name}" berhasil ditambahkan ke gudang! ✓`);
  };

  // Handler: Hapus Bahan
  const handleDeleteIngredient = (id: string, name: string) => {
    if (
      !window.confirm(
        `Yakin ingin menghapus "${name}" dari gudang bahan baku dapur?`
      )
    )
      return;
    const updated = pantry.filter((p) => p.id !== id);
    storageService.savePantryIngredients(updated);
    setPantry(updated);
    onShowToast(`Bahan "${name}" telah dihapus.`);
  };

  // Handler: Salin Daftar Belanja Pasar WA
  const handleCopyShoppingListWA = () => {
    const needBuy = pantry.filter((p) => p.currentStock <= p.minStock);
    if (needBuy.length === 0) {
      onShowToast('Semua stok bahan saat ini aman! Belum ada yang menipis. 👍');
      return;
    }

    const todayStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let msg = `🛒 *DAFTAR BELANJA BAHAN PASAR — DAPUR DULANG* 🥬🥩\n`;
    msg += `📅 Tanggal: *${todayStr}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Tolong belikan stok bahan dapur yang sudah menipis/habis berikut:\n\n`;

    let totalEst = 0;
    needBuy.forEach((it, idx) => {
      const suggestBuy = Math.max(1, Math.ceil(it.minStock * 2 - it.currentStock));
      const estCost = suggestBuy * it.costPerUnit;
      totalEst += estCost;
      const statusIcon = it.currentStock <= 0 ? '🔴 [HABIS]' : '🟡 [MENIPIS]';
      msg += `${idx + 1}. *${it.name}* ${statusIcon}\n`;
      msg += `   • Sisa saat ini: ${it.currentStock} ${it.unit} (Min: ${it.minStock} ${it.unit})\n`;
      msg += `   • Rekomendasi beli: *${suggestBuy} ${it.unit}*\n`;
      msg += `   • Estimasi harga: ~Rp ${estCost.toLocaleString('id-ID')}\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Estimasi Total Belanja:* ~Rp ${totalEst.toLocaleString('id-ID')}\n`;
    msg += `💡 _Simpan nota belanja pasar untuk dimasukkan ke Buku Kas Dulang ya. Terima kasih!_ 🙏✨`;

    navigator.clipboard.writeText(msg);
    onShowToast('Daftar belanja pasar berhasil disalin! Siap dikirim ke WA asisten/koki. 📋✓');

    const ownerWa = storageService.getOwnerWa();
    const cleanWa = ownerWa ? ownerWa.replace(/\D/g, '') : '';
    const waUrl = cleanWa
      ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Helper Category Labels
  const categoryMeta: Record<
    IngredientCategory,
    { label: string; icon: string; color: string }
  > = {
    kulit: { label: 'Kulit & Adonan', icon: '🥞', color: 'bg-amber-100 text-amber-900 border-amber-300' },
    isian: { label: 'Bahan Isian', icon: '🥩', color: 'bg-rose-100 text-rose-900 border-rose-300' },
    panir_minyak: { label: 'Panir & Minyak', icon: '🍳', color: 'bg-orange-100 text-orange-900 border-orange-300' },
    kemasan: { label: 'Kemasan & Mika', icon: '📦', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2 border border-[#111111]/20">
            <span>🥩</span> Manajemen Resep & Bahan Baku
          </div>
          <h2 className="font-hand font-bold text-[32px] sm:text-[36px] text-[#111111] leading-none">
            Gudang Dapur & HPP Resep
          </h2>
          <p className="font-sans text-xs text-[#5C3D2E]/80 mt-1">
            Pantau stok bahan mentah, hitung biaya modal (HPP) per butir risoles, dan otomatis potong stok saat ada pesanan.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-full border-2 border-[#111111] shadow-[2px_2px_0_#111111] shrink-0">
          <button
            type="button"
            onClick={() => setSubView('pantry')}
            className={`cursor-pointer px-4 py-2 rounded-full font-sans font-bold text-xs transition flex items-center gap-1.5 ${
              subView === 'pantry'
                ? 'bg-[#111111] text-[#FFD700]'
                : 'text-[#111111] hover:bg-gray-100'
            }`}
          >
            <span>📦</span>
            <span>Gudang Bahan ({pantry.length})</span>
            {lowStockItems.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-sans">
                {lowStockItems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSubView('recipes')}
            className={`cursor-pointer px-4 py-2 rounded-full font-sans font-bold text-xs transition flex items-center gap-1.5 ${
              subView === 'recipes'
                ? 'bg-[#111111] text-[#FFD700]'
                : 'text-[#111111] hover:bg-gray-100'
            }`}
          >
            <span>🥩</span>
            <span>Resep & HPP Margin ({recipes.length})</span>
          </button>
        </div>
      </div>

      {/* SUMMARY KPI BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-[20px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111]">
          <span className="text-[11px] font-sans font-bold text-[#5C3D2E]/80 uppercase block">
            Total Bahan Baku
          </span>
          <div className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] mt-1">
            {pantry.length} Komponen
          </div>
          <span className="text-[10px] text-gray-500 font-sans mt-0.5 block">
            Kulit, isian, panir, & kemasan
          </span>
        </div>

        <div
          className={`rounded-[20px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] cursor-pointer transition ${
            lowStockItems.length > 0 ? 'bg-amber-100' : 'bg-emerald-50'
          }`}
          onClick={() => setCategoryFilter(categoryFilter === 'low_stock' ? 'all' : 'low_stock')}
        >
          <span className="text-[11px] font-sans font-bold text-[#5C3D2E]/80 uppercase block flex items-center gap-1">
            <span>{lowStockItems.length > 0 ? '⚠️' : '✓'}</span>
            <span>Perlu Belanja</span>
          </span>
          <div className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] mt-1">
            {lowStockItems.length} Bahan Menipis
          </div>
          <span className="text-[10px] text-amber-900 font-sans font-semibold mt-0.5 block">
            {lowStockItems.length > 0 ? 'Klik untuk filter belanja pasar' : 'Semua stok aman terkendali'}
          </span>
        </div>

        <div className="bg-white rounded-[20px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111]">
          <span className="text-[11px] font-sans font-bold text-[#5C3D2E]/80 uppercase block">
            Estimasi Nilai Gudang
          </span>
          <div className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] mt-1">
            Rp{' '}
            {pantry
              .reduce((sum, p) => sum + p.currentStock * p.costPerUnit, 0)
              .toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-gray-500 font-sans mt-0.5 block">
            Total aset bahan siap olah
          </span>
        </div>

        <div className="bg-[#111111] text-[#FFF8E7] rounded-[20px] p-4 border-2 border-[#FFD700] shadow-[3px_3px_0_#FFD700]">
          <span className="text-[11px] font-sans font-bold text-[#FFD700] uppercase block">
            Rata-rata Margin Resep
          </span>
          <div className="font-hand font-bold text-2xl sm:text-3xl text-[#FFD700] mt-1">
            ~45% Margin
          </div>
          <span className="text-[10px] text-white/70 font-sans mt-0.5 block">
            Surplus sehat di atas standar F&B
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUBVIEW 1: GUDANG BAHAN BAKU (PANTRY) */}
      {/* ========================================================= */}
      {subView === 'pantry' && (
        <div className="space-y-4">
          {/* Action & Filter Toolbar */}
          <div className="bg-[#FFFDF4] rounded-[20px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-2.5 text-xs text-gray-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari bahan (terigu, mayo, ayam, minyak)..."
                className="w-full bg-white rounded-full border-2 border-[#111111] pl-8 pr-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyShoppingListWA}
                className="cursor-pointer bg-[#25D366] hover:bg-[#20ba59] text-white font-sans font-bold text-xs px-4 py-2 rounded-full border-2 border-[#111111] shadow-[2px_2px_0_#111111] transition flex items-center gap-1.5"
                title="Salin rekap bahan menipis untuk dikirim ke WA asisten belanja"
              >
                <span>🛒</span>
                <span>Daftar Belanja Pasar WA</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddingIngredient(!isAddingIngredient)}
                className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] font-sans font-bold text-xs px-4 py-2 rounded-full border-2 border-[#111111] shadow-[2px_2px_0_#111111] transition flex items-center gap-1.5"
              >
                <span>{isAddingIngredient ? '✕' : '+'}</span>
                <span>{isAddingIngredient ? 'Tutup' : 'Tambah Bahan Baru'}</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`cursor-pointer px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border transition ${
                categoryFilter === 'all'
                  ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                  : 'bg-white text-[#111111] border-[#111111]/30 hover:border-[#111111]'
              }`}
            >
              Semua ({pantry.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('low_stock')}
              className={`cursor-pointer px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border transition flex items-center gap-1 ${
                categoryFilter === 'low_stock'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-red-50 text-red-800 border-red-300 hover:border-red-600'
              }`}
            >
              <span>⚠️ Menipis/Habis</span>
              <span>({lowStockItems.length})</span>
            </button>
            {(['isian', 'kulit', 'panir_minyak', 'kemasan'] as IngredientCategory[]).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`cursor-pointer px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border transition flex items-center gap-1 ${
                    categoryFilter === cat
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                      : 'bg-white text-[#111111] border-[#111111]/30 hover:border-[#111111]'
                  }`}
                >
                  <span>{categoryMeta[cat].icon}</span>
                  <span>{categoryMeta[cat].label}</span>
                  <span className="text-[10px] text-gray-500">
                    ({pantry.filter((p) => p.category === cat).length})
                  </span>
                </button>
              )
            )}
          </div>

          {/* Form Tambah Bahan Baru */}
          {isAddingIngredient && (
            <form
              onSubmit={handleSaveNewIngredient}
              className="bg-white rounded-[22px] p-5 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4 animate-in fade-in duration-200"
            >
              <div className="font-hand font-bold text-2xl text-[#111111]">
                Catat Bahan Baku Baru ke Gudang Dapur
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                    Nama Bahan *
                  </label>
                  <input
                    type="text"
                    required
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    placeholder="misal: Daging Sapi Cincang"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 text-xs font-sans font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                    Kategori Bahan *
                  </label>
                  <select
                    value={newIngCategory}
                    onChange={(e) =>
                      setNewIngCategory(e.target.value as IngredientCategory)
                    }
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 text-xs font-sans font-bold bg-white"
                  >
                    <option value="isian">🥩 Bahan Isian</option>
                    <option value="kulit">🥞 Kulit & Adonan</option>
                    <option value="panir_minyak">🍳 Panir & Minyak</option>
                    <option value="kemasan">📦 Kemasan & Mika</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                    Satuan Takar *
                  </label>
                  <input
                    type="text"
                    required
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value)}
                    placeholder="kg / butir / liter / pack / lembar"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 text-xs font-sans font-bold"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                    Stok Awal Saat Ini *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newIngStock}
                    onChange={(e) =>
                      setNewIngStock(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                    Batas Minimum (Peringatan Habis) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newIngMinStock}
                    onChange={(e) =>
                      setNewIngMinStock(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                    Harga Beli per Satuan (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newIngCost}
                    onChange={(e) =>
                      setNewIngCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="bg-[#111111] text-[#FFD700] hover:brightness-110 px-5 py-2 rounded-full font-sans font-bold text-xs border-2 border-[#111111]"
                >
                  Simpan Bahan ke Gudang ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingIngredient(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-black"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Table of Pantry Ingredients */}
          <div className="bg-white rounded-[22px] border-2 border-[#111111] shadow-[4px_4px_0_#111111] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead className="bg-[#111111] text-[#FFF8E7] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nama Bahan</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-center">Stok Saat Ini</th>
                    <th className="py-3 px-4 text-center">Batas Min.</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Harga Beli / Satuan</th>
                    <th className="py-3 px-4 text-right">Total Nilai</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111111]/10">
                  {filteredPantry.map((item) => {
                    const isOut = item.currentStock <= 0;
                    const isLow = !isOut && item.currentStock <= item.minStock;
                    const totalVal = Math.round(item.currentStock * item.costPerUnit);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-[#FFFDF4] transition ${
                          isOut
                            ? 'bg-red-50/70'
                            : isLow
                            ? 'bg-amber-50/60'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-[#111111]">
                          <div>{item.name}</div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {item.id}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              categoryMeta[item.category].color
                            }`}
                          >
                            <span>{categoryMeta[item.category].icon}</span>
                            <span>{categoryMeta[item.category].label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-sm">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-gray-500">
                          {item.minStock} {item.unit}
                        </td>
                        <td className="py-3 px-4">
                          {isOut ? (
                            <span className="inline-block bg-red-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full animate-pulse">
                              🔴 HABIS
                            </span>
                          ) : isLow ? (
                            <span className="inline-block bg-amber-500 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                              🟡 MENIPIS
                            </span>
                          ) : (
                            <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                              🟢 AMAN
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-gray-700">
                          Rp {item.costPerUnit.toLocaleString('id-ID')} / {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#111111]">
                          Rp {totalVal.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenRestock(item)}
                              className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] font-bold px-2.5 py-1 rounded-full text-[11px] border border-[#111111] shadow-xs flex items-center gap-1"
                              title="Tambah stok belanja"
                            >
                              <span>+</span> Restock
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteIngredient(item.id, item.name)
                              }
                              className="cursor-pointer text-red-500 hover:text-red-700 px-2 py-1 text-[11px] font-bold"
                              title="Hapus bahan ini"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPantry.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-gray-500 font-sans text-xs"
                      >
                        Tidak ada bahan yang cocok dengan pencarian / filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 2: RESEP & KALKULATOR HPP MENU */}
      {/* ========================================================= */}
      {subView === 'recipes' && (
        <div className="space-y-6">
          <div className="bg-[#FFFDF4] rounded-[20px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-sans">
            <div>
              <strong className="block text-[#111111] font-bold">
                💡 Cara Kerja HPP Otomatis Dulang Indonesia:
              </strong>
              <p className="text-[#5C3D2E]/80 mt-0.5">
                Setiap menu terhubung dengan takaran bahan baku riil (kulit, isian, panir, minyak). Jika harga telur atau terigu di pasar naik, HPP dan margin keuntungan di bawah otomatis ter-update secara real-time!
              </p>
            </div>
          </div>

          {/* Grid of Menu Recipes */}
          <div className="grid md:grid-cols-2 gap-4">
            {recipes.map((rc) => {
              const menuObj = menus.find((m) => m.id === rc.menuId);
              const sellPrice = menuObj ? menuObj.harga : 3500;
              const liveHpp = calculateRecipeHpp(rc.components, pantry);
              const profitPerPcs = sellPrice - liveHpp;
              const marginPercent =
                sellPrice > 0 ? Math.round((profitPerPcs / sellPrice) * 100) : 0;

              return (
                <div
                  key={rc.menuId}
                  className="bg-white rounded-[24px] p-5 border-2 border-[#111111] shadow-[4px_4px_0_#111111] flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Top Header of Card */}
                    <div className="flex items-start justify-between gap-3 border-b border-[#111111]/10 pb-3">
                      <div>
                        <div className="font-hand font-bold text-2xl text-[#111111] leading-tight">
                          {rc.menuName}
                        </div>
                        <span className="text-[11px] font-sans text-gray-500">
                          {rc.components.length} takaran bahan racikan
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-sans font-bold text-gray-500 uppercase block">
                          Harga Jual
                        </span>
                        <div className="font-mono font-bold text-base text-[#111111]">
                          Rp {sellPrice.toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    {/* Financial KPI of Recipe */}
                    <div className="grid grid-cols-3 gap-2 my-3 p-3 bg-gray-50 rounded-2xl border border-gray-200 text-center font-sans">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">
                          HPP Bahan
                        </span>
                        <strong className="text-rose-700 font-mono text-sm block mt-0.5">
                          Rp {Math.round(liveHpp).toLocaleString('id-ID')}
                        </strong>
                      </div>
                      <div className="border-x border-gray-200">
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">
                          Laba per Pcs
                        </span>
                        <strong className="text-emerald-700 font-mono text-sm block mt-0.5">
                          +Rp {Math.round(profitPerPcs).toLocaleString('id-ID')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">
                          Margin Profit
                        </span>
                        <span
                          className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-full mt-0.5 ${
                            marginPercent >= 40
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : marginPercent >= 25
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-red-100 text-red-900 border border-red-300'
                          }`}
                        >
                          {marginPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Itemized Ingredients Breakdown */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                        Komposisi Bahan per 1 Butir:
                      </span>
                      <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                        {rc.components.map((comp) => {
                          const pIng = pantry.find(
                            (p) => p.id === comp.ingredientId
                          );
                          const cost = pIng
                            ? Math.round(comp.amountPerPcs * pIng.costPerUnit)
                            : 0;

                          return (
                            <div
                              key={comp.ingredientId}
                              className="flex items-center justify-between text-xs py-1 border-b border-gray-100 font-sans"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-[10px] text-gray-400">•</span>
                                <span className="text-gray-800 truncate">
                                  {comp.ingredientName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                                <span className="text-gray-500">
                                  {comp.amountPerPcs} {comp.unit}
                                </span>
                                <strong className="text-[#111111]">
                                  Rp {cost.toLocaleString('id-ID')}
                                </strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Edit Recipe Button */}
                  <div className="pt-3 border-t border-[#111111]/10 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedRecipeForEdit(rc)}
                      className="cursor-pointer bg-white hover:bg-gray-100 text-[#111111] border-2 border-[#111111] font-sans font-bold text-xs px-4 py-1.5 rounded-full shadow-[2px_2px_0_#111111] flex items-center gap-1.5 transition"
                    >
                      <span>⚙️</span>
                      <span>Atur Takaran Resep</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL RESTOCK BAHAN */}
      {/* ========================================================= */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFDF4] rounded-[24px] max-w-md w-full p-6 border-3 border-[#111111] shadow-[6px_6px_0_#111111] space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b-2 border-[#111111]/15 pb-3">
              <div>
                <span className="text-[10px] font-sans font-bold uppercase bg-[#FFD700] px-2 py-0.5 rounded-full border border-[#111111]">
                  Input Belanja Bahan
                </span>
                <h3 className="font-hand font-bold text-2xl text-[#111111] mt-1">
                  Restock: {restockItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRestockItem(null)}
                className="cursor-pointer w-8 h-8 rounded-full bg-white border border-[#111111] font-bold text-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRestock} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                  Jumlah yang Dibeli ({restockItem.unit}) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    required
                    value={restockQty}
                    onChange={(e) =>
                      setRestockQty(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-mono font-bold text-sm bg-white"
                  />
                  <span className="font-sans font-bold text-xs text-gray-600 shrink-0">
                    {restockItem.unit}
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Stok sebelum restock: {restockItem.currentStock} {restockItem.unit} ➔ Menjadi:{' '}
                  {(restockItem.currentStock + Number(restockQty || 0)).toFixed(2)}{' '}
                  {restockItem.unit}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C3D2E] uppercase mb-1">
                  Harga Beli Pasar per {restockItem.unit} (Rp) *
                </label>
                <input
                  type="number"
                  required
                  value={restockCost}
                  onChange={(e) =>
                    setRestockCost(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-mono font-bold text-sm bg-white"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Total Biaya Belanja:{' '}
                  <strong className="text-[#111111]">
                    Rp{' '}
                    {Math.round(
                      Number(restockQty || 0) * Number(restockCost || 0)
                    ).toLocaleString('id-ID')}
                  </strong>
                </span>
              </div>

              {/* Auto Record Expense in Buku Kas */}
              <div className="p-3 bg-amber-50 rounded-2xl border-2 border-amber-300">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockRecordExpense}
                    onChange={(e) => setRestockRecordExpense(e.target.checked)}
                    className="mt-0.5 rounded border-gray-400 text-[#111111] focus:ring-[#FFD700]"
                  />
                  <div>
                    <strong className="text-xs font-bold text-amber-950 block">
                      Otomatis Catat ke Buku Kas & Laba Bersih
                    </strong>
                    <span className="text-[11px] text-amber-900/80 block">
                      Pengeluaran sebesar Rp{' '}
                      {Math.round(
                        Number(restockQty || 0) * Number(restockCost || 0)
                      ).toLocaleString('id-ID')}{' '}
                      akan langsung masuk ke laporan keuangan dapur hari ini.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-black"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-[#111111] text-[#FFD700] hover:brightness-110 px-6 py-2.5 rounded-full font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700]"
                >
                  Simpan Stok Masuk ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL EDIT TAKARAN RESEP */}
      {/* ========================================================= */}
      {selectedRecipeForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF4] rounded-[24px] max-w-lg w-full p-6 border-3 border-[#111111] shadow-[6px_6px_0_#111111] space-y-4 my-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b-2 border-[#111111]/15 pb-3">
              <div>
                <span className="text-[10px] font-sans font-bold uppercase bg-[#FFD700] px-2 py-0.5 rounded-full border border-[#111111]">
                  Formula Dapur
                </span>
                <h3 className="font-hand font-bold text-2xl text-[#111111] mt-1">
                  Atur Resep: {selectedRecipeForEdit.menuName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipeForEdit(null)}
                className="cursor-pointer w-8 h-8 rounded-full bg-white border border-[#111111] font-bold text-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-[#5C3D2E] block">
                Takaran Komponen Bahan per 1 Butir:
              </span>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selectedRecipeForEdit.components.map((comp, idx) => {
                  return (
                    <div
                      key={comp.ingredientId}
                      className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="font-sans font-bold text-[#111111] truncate">
                        {comp.ingredientName}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={comp.amountPerPcs}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const updatedComps = [...selectedRecipeForEdit.components];
                            updatedComps[idx] = { ...comp, amountPerPcs: val };
                            setSelectedRecipeForEdit({
                              ...selectedRecipeForEdit,
                              components: updatedComps,
                            });
                          }}
                          className="w-20 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 font-mono font-bold text-right"
                        />
                        <span className="text-gray-500 font-sans w-10">
                          {comp.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-center justify-between text-xs font-sans">
                <span className="text-emerald-900 font-bold">
                  HPP Baru Setelah Takaran Diubah:
                </span>
                <strong className="text-emerald-950 font-mono text-sm">
                  Rp{' '}
                  {Math.round(
                    calculateRecipeHpp(selectedRecipeForEdit.components, pantry)
                  ).toLocaleString('id-ID')}
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecipeForEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-black"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    storageService.saveMenuRecipe(selectedRecipeForEdit);
                    setRecipes(storageService.getMenuRecipes());
                    setSelectedRecipeForEdit(null);
                    onShowToast(`Resep "${selectedRecipeForEdit.menuName}" berhasil disimpan! ✓`);
                  }}
                  className="bg-[#111111] text-[#FFD700] hover:brightness-110 px-5 py-2 rounded-full font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700]"
                >
                  Simpan Perubahan Resep ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
