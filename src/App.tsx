import { useState, useEffect } from 'react';
import { MenuItem, CartItem, StoreConfig } from './types';
import { storageService } from './services/storageService';
import { Header, NavMode } from './components/common/Header';
import { StickyCart } from './components/common/StickyCart';
import { Toast } from './components/common/Toast';
import { OwnerLoginModal } from './components/common/OwnerLoginModal';
import { StoreClosedModal } from './components/common/StoreClosedModal';
import { LandingView } from './views/LandingView';
import { SmartScanView } from './views/SmartScanView';
import { OwnerDashboardView } from './views/OwnerDashboardView';
import { getSupabaseClient } from './lib/supabase';
import { LOCKED_COPY } from './lib/constants';
import { playNewCustomerChime } from './lib/audioNotifier';

export function App() {
  const [currentMode, setCurrentMode] = useState<NavMode>('pembeli');
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() => storageService.getStoreConfig());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeScanId, setActiveScanId] = useState<string>('DULANG-042');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOwnerLoggedIn, setIsOwnerLoggedIn] = useState<boolean>(false);
  const [isOwnerLoginOpen, setIsOwnerLoginOpen] = useState<boolean>(false);
  const [pendingMode, setPendingMode] = useState<NavMode | null>(null);
  const [isClosedModalOpen, setIsClosedModalOpen] = useState<boolean>(() => !!storageService.getStoreConfig().isStoreClosed);

  // Initialize data and check URL params for ?scan=...
  useEffect(() => {
    storageService.purgeDemoDataOnce();
    setMenus(storageService.getMenus());
    storageService.syncMenusFromSupabase().then((synced) => {
      if (synced && synced.length > 0) setMenus(synced);
    });
    storageService.syncOrdersFromSupabase().catch(() => {});
    setStoreConfig(storageService.getStoreConfig());
    setIsOwnerLoggedIn(storageService.isOwnerAuthenticated());


    const params = new URLSearchParams(window.location.search);
    const scanParam = params.get('scan') || params.get('qr') || params.get('c') || params.get('id');
    if (scanParam) {
      const cleanQr = scanParam.toUpperCase().trim();
      setActiveScanId(cleanQr);
      storageService.setActiveCustomerQR(cleanQr);

      const recognized = storageService.getCustomerByQR(cleanQr);
      if (recognized) {
        showToast(`Halo Kak ${recognized.name}! Seneng ketemu lagi 😊`);
      } else {
        showToast(`Stiker ${cleanQr} berhasil dibaca! 📱`);
      }

      // If user came specifically via ?scan= or ?id=, take them straight to smart scan view
      if (params.has('scan') || params.has('id')) {
        setCurrentMode('scan');
      }
    } else if (params.has('dapur') || params.has('pemilik') || params.has('admin')) {
      if (!storageService.isOwnerAuthenticated()) {
        setPendingMode('pemilik');
        setIsOwnerLoginOpen(true);
      } else {
        setCurrentMode('pemilik');
      }
    } else if (params.has('cetak')) {
      if (!storageService.isOwnerAuthenticated()) {
        setPendingMode('cetak');
        setIsOwnerLoginOpen(true);
      } else {
        setCurrentMode('cetak');
      }
    }

    const handleConfigUpdate = () => {
      const fresh = storageService.getStoreConfig();
      setStoreConfig(fresh);
    };
    const handleMenusUpdate = () => {
      const fresh = storageService.getMenus();
      setMenus(fresh);
    };

    window.addEventListener('dulang_store_config_updated', handleConfigUpdate);
    window.addEventListener('dulang_menus_updated', handleMenusUpdate);

    // Supabase Realtime Sync antar-perangkat
    const client = getSupabaseClient();
    let menuChannel: any = null;
    let orderChannel: any = null;
    if (client) {
      try {
        menuChannel = client
          .channel('public:menus_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, () => {
            storageService.syncMenusFromSupabase().then((synced) => {
              if (synced && synced.length > 0) setMenus(synced);
            });
          })
          .subscribe();

        orderChannel = client
          .channel('public:orders_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
            storageService.syncOrdersFromSupabase().then(() => {
              if (payload?.eventType === 'INSERT') {
                playNewCustomerChime();
                const custName = payload?.new?.customer_name || 'Pelanggan Baru';
                const total = Number(payload?.new?.total_price || 0).toLocaleString('id-ID');
                showToast(`🔔 Pesanan Baru Masuk! Kak ${custName} (Rp ${total}) 🥟✨`);

                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification('🥟 Pesanan Baru Masuk!', {
                      body: `Kak ${custName} - Rp ${total}`,
                      icon: '/favicon.ico',
                    });
                  } catch (e) {
                    console.warn('Native notification error:', e);
                  }
                }
              }
            });
          })
          .subscribe();
      } catch (err) {
        console.warn('Supabase realtime listener error:', err);
      }
    }

    return () => {
      window.removeEventListener('dulang_store_config_updated', handleConfigUpdate);
      window.removeEventListener('dulang_menus_updated', handleMenusUpdate);
      if (client) {
        if (menuChannel) client.removeChannel(menuChannel);
        if (orderChannel) client.removeChannel(orderChannel);
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleAddToCart = (item: MenuItem, pilihanOpsi?: string, variantType: 'matang' | 'frozen' = 'matang') => {
    setCart((prev) => {
      const existing = prev.find(
        (c) =>
          c.item.id === item.id &&
          (c.pilihanOpsi || '') === (pilihanOpsi || '') &&
          (c.variantType || 'matang') === variantType
      );
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id &&
          (c.pilihanOpsi || '') === (pilihanOpsi || '') &&
          (c.variantType || 'matang') === variantType
            ? { ...c, qty: c.qty + 1 }
            : c
        );
      }
      return [...prev, { item, qty: 1, pilihanOpsi, variantType }];
    });
    const opsiText = pilihanOpsi ? ` (${pilihanOpsi})` : '';
    const variantText = variantType === 'frozen' ? ' [Frozen ❄️]' : ' [Goreng 🍳]';
    showToast(`1 porsi ${item.nama}${opsiText}${variantText} masuk ke dulang 🥟`);
  };

  const handleUpdateCartQty = (
    itemId: string,
    delta: number,
    pilihanOpsi?: string,
    variantType: 'matang' | 'frozen' = 'matang'
  ) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (
            c.item.id === itemId &&
            (c.pilihanOpsi || '') === (pilihanOpsi || '') &&
            (c.variantType || 'matang') === variantType
          ) {
            const safeDelta = Number.isFinite(delta) ? Math.floor(delta) : 0;
            const newQty = Math.min(999, Math.max(0, c.qty + safeDelta));
            return newQty > 0 ? { ...c, qty: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const getCartQty = (itemId: string): number => {
    return cart.filter((c) => c.item.id === itemId).reduce((acc, c) => acc + c.qty, 0);
  };

  const handleNavigateToScan = (qrId: string) => {
    setActiveScanId(qrId);
    setCurrentMode('scan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FFF8E7] text-[#111111] relative selection:bg-[#FFD700] selection:text-[#111111] overflow-x-hidden w-full max-w-full">
      {/* Background Dot Texture - Brand Book Locked */}
      <div className="fixed inset-0 dot-bg pointer-events-none z-0" />

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-full overflow-x-hidden">
        <Header
          currentMode={currentMode}
          onSelectMode={setCurrentMode}
          onOpenOwnerLogin={(target) => {
            setPendingMode(target || 'pemilik');
            setIsOwnerLoginOpen(true);
          }}
          isOwnerLoggedIn={isOwnerLoggedIn}
          onLogout={() => {
            storageService.setOwnerAuthenticated(false);
            setIsOwnerLoggedIn(false);
            setCurrentMode('pembeli');
            showToast('Sampai jumpa di dapur besok yaa! 👋');
          }}
        />

        <main className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          {currentMode === 'pembeli' && (
            <LandingView
              menus={menus}
              storeConfig={storeConfig}
              onAddToCart={handleAddToCart}
              getCartQty={getCartQty}
              onNavigateToScan={handleNavigateToScan}
              onOpenClosedNotice={() => setIsClosedModalOpen(true)}
              onOpenOwnerLogin={() => {
                setPendingMode('pemilik');
                setIsOwnerLoginOpen(true);
              }}
            />
          )}

          {currentMode === 'scan' && (
            <SmartScanView
              initialQrId={activeScanId}
              menus={menus}
              onOrderSuccess={(msg) => showToast(msg)}
            />
          )}

          {currentMode === 'pemilik' && (
            isOwnerLoggedIn ? (
              <OwnerDashboardView
                menus={menus}
                onUpdateMenus={setMenus}
                storeConfig={storeConfig}
                onUpdateStoreConfig={setStoreConfig}
                onLogout={() => {
                  storageService.setOwnerAuthenticated(false);
                  setIsOwnerLoggedIn(false);
                  setCurrentMode('pembeli');
                  showToast('Sampai jumpa di dapur besok yaa! 👋');
                }}
                onShowToast={showToast}
              />
            ) : (
              <div className="py-20 text-center space-y-4">
                <div className="text-4xl">🔒</div>
                <h2 className="font-hand font-bold text-3xl">Area Dapur Terkunci</h2>
                <p className="font-sans text-sm text-[#5C3D2E]/70 max-w-md mx-auto">
                  Halaman ini hanya dapat diakses oleh pemilik dengan memasukkan kode akses rahasia.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPendingMode('pemilik');
                    setIsOwnerLoginOpen(true);
                  }}
                  className="bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-sm border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] cursor-pointer"
                >
                  Buka Kunci Dapur 🔑
                </button>
              </div>
            )
          )}

          {currentMode === 'cetak' && (
            isOwnerLoggedIn ? (
              <OwnerDashboardView
                menus={menus}
                onUpdateMenus={setMenus}
                storeConfig={storeConfig}
                onUpdateStoreConfig={setStoreConfig}
                onLogout={() => {
                  storageService.setOwnerAuthenticated(false);
                  setIsOwnerLoggedIn(false);
                  setCurrentMode('pembeli');
                  showToast('Sampai jumpa di dapur besok yaa! 👋');
                }}
                onShowToast={showToast}
                initialTab="stickers"
              />
            ) : (
              <div className="py-20 text-center space-y-4">
                <div className="text-4xl">🔒</div>
                <h2 className="font-hand font-bold text-3xl">Area Cetak Stiker Terkunci</h2>
                <p className="font-sans text-sm text-[#5C3D2E]/70 max-w-md mx-auto">
                  Khusus pemilik untuk mencetak batch stiker QR kardus risoles.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPendingMode('cetak');
                    setIsOwnerLoginOpen(true);
                  }}
                  className="bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-sm border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] cursor-pointer"
                >
                  Buka Kunci Pemilik 🔑
                </button>
              </div>
            )
          )}
        </main>

        {/* Sticky WhatsApp Cart for Buyer Mode */}
        {currentMode === 'pembeli' && (
          <StickyCart
            cart={cart}
            onUpdateQty={handleUpdateCartQty}
            onClearCart={() => setCart([])}
            onOrderSuccess={() => {
              showToast(LOCKED_COPY.toastSuccess);
            }}
          />
        )}

        {/* Floating Notification Toast */}
        <Toast message={toastMessage} />

        {/* Owner Authentication Modal */}
        <OwnerLoginModal
          isOpen={isOwnerLoginOpen}
          onClose={() => {
            setIsOwnerLoginOpen(false);
            setPendingMode(null);
          }}
          onSuccess={() => {
            setIsOwnerLoggedIn(true);
            setIsOwnerLoginOpen(false);
            setCurrentMode(pendingMode || 'pemilik');
            setPendingMode(null);
            showToast('Selamat datang di Dapur Dulang! 🍳');
          }}
        />

        {/* Store Closed Modal Notice */}
        <StoreClosedModal
          isOpen={isClosedModalOpen}
          config={storeConfig}
          onClose={() => setIsClosedModalOpen(false)}
        />


      </div>
    </div>
  );
}

export default App;
