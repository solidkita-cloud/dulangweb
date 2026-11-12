import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { MenuItem, CartItem, StoreConfig, StaffRole } from './types';
import { storageService } from './services/storageService';
import { Header, NavMode } from './components/common/Header';
import { StickyCart } from './components/common/StickyCart';
import { Toast } from './components/common/Toast';
import { StoreClosedModal } from './components/common/StoreClosedModal';
import { PwaInstallBanner } from './components/common/PwaInstallBanner';
import { LandingView } from './views/LandingView';
import { getSupabaseClient } from './lib/supabase';
import { LOCKED_COPY } from './lib/constants';
import { playNewCustomerChime } from './lib/audioNotifier';

const SmartScanView = lazy(() =>
  import('./views/SmartScanView').then((m) => ({ default: m.SmartScanView }))
);
const OwnerDashboardView = lazy(() =>
  import('./views/OwnerDashboardView').then((m) => ({ default: m.OwnerDashboardView }))
);
const KitchenDisplaySystem = lazy(() =>
  import('./components/kitchen/KitchenDisplaySystem').then((m) => ({ default: m.KitchenDisplaySystem }))
);
const OrderTrackingView = lazy(() =>
  import('./views/OrderTrackingView').then((m) => ({ default: m.OrderTrackingView }))
);
const OwnerLoginModal = lazy(() =>
  import('./components/common/OwnerLoginModal').then((m) => ({ default: m.OwnerLoginModal }))
);

function LazyViewFallback() {
  return (
    <div className="py-16 text-center font-sans text-sm font-semibold text-[#5C3D2E] animate-pulse">
      🍳 Memuat modul Dapur Dulang...
    </div>
  );
}

export function App() {
  const [currentMode, setCurrentMode] = useState<NavMode>('pembeli');
  const [menus, setMenus] = useState<MenuItem[]>(() => {
    storageService.purgeDemoDataOnce();
    return storageService.getMenus();
  });
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() => storageService.getStoreConfig());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeScanId, setActiveScanId] = useState<string>('DULANG-042');
  const [trackingOrderId, setTrackingOrderId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOwnerLoggedIn, setIsOwnerLoggedIn] = useState<boolean>(() => storageService.isOwnerAuthenticated());
  const [staffRole, setStaffRole] = useState<StaffRole>(() => storageService.getStaffRole());
  const [isOwnerLoginOpen, setIsOwnerLoginOpen] = useState<boolean>(false);
  const [pendingMode, setPendingMode] = useState<NavMode | null>(null);
  const [isClosedModalOpen, setIsClosedModalOpen] = useState<boolean>(() => !!storageService.getStoreConfig().isStoreClosed);
  const hasDismissedClosedModalRef = useRef<boolean>(false);
  const prevIsClosedRef = useRef<boolean>(!!storageService.getStoreConfig().isStoreClosed);

  useEffect(() => {
    const nowClosed = !!storeConfig.isStoreClosed;
    if (nowClosed && !prevIsClosedRef.current) {
      hasDismissedClosedModalRef.current = false;
      setIsClosedModalOpen(true);
    } else if (!nowClosed) {
      hasDismissedClosedModalRef.current = false;
      setIsClosedModalOpen(false);
    } else if (nowClosed && !hasDismissedClosedModalRef.current) {
      setIsClosedModalOpen(true);
    }
    prevIsClosedRef.current = nowClosed;
  }, [storeConfig.isStoreClosed]);

  // Initialize public storefront data and check URL params (?scan=, ?track=, ?dapur, etc.)
  useEffect(() => {
    storageService.purgeDemoDataOnce();
    setMenus(storageService.getMenus());
    setStoreConfig(storageService.getStoreConfig());
    setIsOwnerLoggedIn(storageService.isOwnerAuthenticated());
    setStaffRole(storageService.getStaffRole());

    const syncPublicFromCloud = async () => {
      const cfg = await storageService.syncStoreConfigFromSupabase().catch(() => null);
      if (cfg) setStoreConfig(cfg);
      const syncedMenus = await storageService.syncMenusFromSupabase().catch(() => []);
      if (syncedMenus && syncedMenus.length > 0) setMenus(syncedMenus);
      await storageService.syncTestimonialsFromSupabase().catch(() => {});
    };
    void syncPublicFromCloud();

    const params = new URLSearchParams(window.location.search);
    const scanParam = params.get('scan') || params.get('qr') || params.get('c') || params.get('id');
    if (scanParam) {
      const cleanQr = scanParam.toUpperCase().trim();
      setActiveScanId(cleanQr);
      storageService.setActiveCustomerQR(cleanQr);

      void storageService.fetchCustomerByQRPublic(cleanQr).then((recognized) => {
        if (recognized) {
          showToast(`Halo Kak ${recognized.name}! Seneng ketemu lagi 😊`);
        } else {
          showToast(`Stiker ${cleanQr} berhasil dibaca! 📱`);
        }
      });

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
      } else if (storageService.getStaffRole() === 'kitchen') {
        setCurrentMode('kds');
      } else {
        setCurrentMode('cetak');
      }
    } else if (params.has('track') || params.has('order')) {
      const trk = params.get('track') || params.get('order') || '';
      setTrackingOrderId(trk.trim());
      setCurrentMode('track');
    } else if (params.has('kds') || params.get('mode') === 'kds') {
      if (!storageService.isOwnerAuthenticated()) {
        setPendingMode('kds');
        setIsOwnerLoginOpen(true);
      } else {
        setCurrentMode('kds');
      }
    }

    const handleConfigUpdate = () => {
      setStoreConfig(storageService.getStoreConfig());
    };
    const handleMenusUpdate = () => {
      setMenus(storageService.getMenus());
    };
    const handleRoleUpdate = () => {
      const role = storageService.getStaffRole();
      setStaffRole(role);
      setIsOwnerLoggedIn(storageService.isOwnerAuthenticated());
    };
    const handlePublicVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncPublicFromCloud();
      }
    };

    window.addEventListener('dulang_store_config_updated', handleConfigUpdate);
    window.addEventListener('dulang_menus_updated', handleMenusUpdate);
    window.addEventListener('dulang_staff_role_updated', handleRoleUpdate);
    document.addEventListener('visibilitychange', handlePublicVisibility);

    const periodicPublicSync = setInterval(() => {
      void syncPublicFromCloud();
    }, 30000);

    // Supabase Realtime untuk data katalog & toko publik saja
    const client = getSupabaseClient();
    let menuChannel: any = null;
    if (client) {
      try {
        menuChannel = client
          .channel('public:menus_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, (payload: any) => {
            const changedId = payload?.new?.id || payload?.old?.id || '';
            if (changedId === 'sys_auth_meta') {
              return;
            } else if (changedId === 'sys_store_config') {
              storageService.syncStoreConfigFromSupabase().then((cfg) => {
                if (cfg) setStoreConfig(cfg);
              });
            } else if (changedId === 'sys_public_testimonials') {
              storageService.syncTestimonialsFromSupabase().catch(() => {});
            } else {
              storageService.syncMenusFromSupabase().then((synced) => {
                if (synced && synced.length > 0) setMenus(synced);
              });
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Supabase public realtime listener error:', err);
      }
    }

    return () => {
      clearInterval(periodicPublicSync);
      window.removeEventListener('dulang_store_config_updated', handleConfigUpdate);
      window.removeEventListener('dulang_menus_updated', handleMenusUpdate);
      window.removeEventListener('dulang_staff_role_updated', handleRoleUpdate);
      document.removeEventListener('visibilitychange', handlePublicVisibility);
      if (client && menuChannel) {
        client.removeChannel(menuChannel);
      }
    };
  }, []);

  // Sync data sensitif (orders, customers, auth meta) & realtime pesanan HANYA aktif saat staf sudah login
  useEffect(() => {
    if (!isOwnerLoggedIn) return;

    const syncStaffFromCloud = async () => {
      await storageService.syncAuthMetaFromSupabase().catch(() => {});
      const cfg = await storageService.syncStoreConfigFromSupabase().catch(() => null);
      if (cfg) setStoreConfig(cfg);
      await storageService.syncOrdersFromSupabase().catch(() => {});
      await storageService.fetchCustomersFromCloud().catch(() => {});
    };

    void syncStaffFromCloud();

    const handleStaffVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncStaffFromCloud();
      }
    };
    document.addEventListener('visibilitychange', handleStaffVisibility);

    const staffInterval = setInterval(() => {
      void syncStaffFromCloud();
    }, 15000);

    const client = getSupabaseClient();
    let orderChannel: any = null;
    if (client) {
      try {
        orderChannel = client
          .channel('staff:orders_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
            storageService.syncOrdersFromSupabase().then(() => {
              const newStatus = payload?.new?.status;
              const newId = payload?.new?.id || '';
              let isDeleted = false;
              try {
                const deletedRaw = localStorage.getItem('dulang_deleted_order_ids') || '[]';
                isDeleted = JSON.parse(deletedRaw).includes(newId);
              } catch {}

              if (
                payload?.eventType === 'INSERT' &&
                newStatus !== 'dihapus' &&
                newStatus !== 'batal' &&
                !isDeleted
              ) {
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
        console.warn('Supabase staff realtime listener error:', err);
      }
    }

    return () => {
      clearInterval(staffInterval);
      document.removeEventListener('visibilitychange', handleStaffVisibility);
      if (client && orderChannel) {
        client.removeChannel(orderChannel);
      }
    };
  }, [isOwnerLoggedIn]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleAddToCart = (
    item: MenuItem,
    pilihanOpsi?: string,
    variantType: 'matang' | 'frozen' = 'matang',
    qty: number = 1
  ) => {
    const addQty = Math.max(1, qty);

    // Ambil menu live terkini untuk memeriksa batasan stok porsi
    const liveMenu = menus.find((m) => m.id === item.id) || item;
    const hasLimit = liveMenu.sisaStok !== null && liveMenu.sisaStok !== undefined;

    if (hasLimit) {
      if ((liveMenu.sisaStok as number) <= 0) {
        showToast(`Maaf, "${liveMenu.nama}" sudah habis! 🙏`);
        return;
      }
      const existingInCart = cart.find(
        (c) =>
          c.item.id === item.id &&
          (c.pilihanOpsi || '') === (pilihanOpsi || '') &&
          (c.variantType || 'matang') === variantType
      );
      const currentQty = existingInCart ? existingInCart.qty : 0;
      if (currentQty + addQty > (liveMenu.sisaStok as number)) {
        showToast(`Stok "${liveMenu.nama}" tersisa ${liveMenu.sisaStok} porsi.`);
        return;
      }
    }

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
            ? { ...c, qty: c.qty + addQty }
            : c
        );
      }
      return [...prev, { item: liveMenu, qty: addQty, pilihanOpsi, variantType }];
    });
    const opsiText = pilihanOpsi ? ` (${pilihanOpsi})` : '';
    const variantText = variantType === 'frozen' ? ' [Frozen ❄️]' : ' [Goreng 🍳]';
    showToast(`${addQty} porsi ${item.nama}${opsiText}${variantText} masuk ke dulang 🥟`);
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
            const liveMenu = menus.find((m) => m.id === itemId) || c.item;
            const hasLimit = liveMenu.sisaStok !== null && liveMenu.sisaStok !== undefined;

            let targetQty = c.qty + safeDelta;
            if (safeDelta > 0 && hasLimit && targetQty > (liveMenu.sisaStok as number)) {
              showToast(`Maksimal pesanan sesuai sisa stok (${liveMenu.sisaStok} porsi).`);
              targetQty = liveMenu.sisaStok as number;
            }

            const newQty = Math.min(999, Math.max(0, targetQty));
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

  const handleStaffLogout = () => {
    storageService.setOwnerAuthenticated(false);
    storageService.clearSensitiveStaffCacheOnLogout();
    setIsOwnerLoggedIn(false);
    setStaffRole('cashier');
    setStoreConfig(storageService.getStoreConfig());
    setCurrentMode('pembeli');
    showToast('Sampai jumpa di dapur besok yaa! 👋');
  };

  const renderLockedAccess = (title: string, desc: string, targetMode: NavMode, buttonText: string) => (
    <div className="py-20 text-center space-y-4">
      <div className="text-4xl">🔒</div>
      <h2 className="font-hand font-bold text-3xl">{title}</h2>
      <p className="font-sans text-sm text-[#5C3D2E]/70 max-w-md mx-auto">{desc}</p>
      <button
        type="button"
        onClick={() => {
          setPendingMode(targetMode);
          setIsOwnerLoginOpen(true);
        }}
        className="bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-sm border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] cursor-pointer"
      >
        {buttonText}
      </button>
    </div>
  );

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
          storeConfig={storeConfig}
          onLogout={handleStaffLogout}
        />

        <main className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          {currentMode === 'pembeli' && (
            <LandingView
              menus={menus}
              storeConfig={storeConfig}
              onAddToCart={handleAddToCart}
              getCartQty={getCartQty}
              onNavigateToScan={handleNavigateToScan}
              onOpenClosedNotice={() => {
                hasDismissedClosedModalRef.current = false;
                setIsClosedModalOpen(true);
              }}
              onOpenOwnerLogin={() => {
                setPendingMode('pemilik');
                setIsOwnerLoginOpen(true);
              }}
              onShowToast={showToast}
            />
          )}

          {currentMode === 'scan' && (
            <Suspense fallback={<LazyViewFallback />}>
              <SmartScanView
                initialQrId={activeScanId}
                menus={menus}
                onOrderSuccess={(msg) => showToast(msg)}
              />
            </Suspense>
          )}

          {currentMode === 'pemilik' && (
            isOwnerLoggedIn ? (
              <Suspense fallback={<LazyViewFallback />}>
                <OwnerDashboardView
                  menus={menus}
                  onUpdateMenus={setMenus}
                  storeConfig={storeConfig}
                  onUpdateStoreConfig={setStoreConfig}
                  onLogout={handleStaffLogout}
                  onShowToast={showToast}
                />
              </Suspense>
            ) : (
              renderLockedAccess(
                'Area Dapur Terkunci',
                'Halaman ini hanya dapat diakses oleh pemilik atau staf dengan memasukkan kode akses rahasia.',
                'pemilik',
                'Buka Kunci Dapur 🔑'
              )
            )
          )}

          {currentMode === 'cetak' && (
            isOwnerLoggedIn && staffRole !== 'kitchen' ? (
              <Suspense fallback={<LazyViewFallback />}>
                <OwnerDashboardView
                  menus={menus}
                  onUpdateMenus={setMenus}
                  storeConfig={storeConfig}
                  onUpdateStoreConfig={setStoreConfig}
                  onLogout={handleStaffLogout}
                  onShowToast={showToast}
                  initialTab="stickers"
                />
              </Suspense>
            ) : (
              renderLockedAccess(
                'Area Cetak Stiker Terkunci',
                'Khusus pemilik atau kasir untuk mencetak batch stiker QR kardus risoles.',
                'cetak',
                'Buka Kunci Pemilik / Kasir 🔑'
              )
            )
          )}

          {currentMode === 'kds' && (
            isOwnerLoggedIn ? (
              <Suspense fallback={<LazyViewFallback />}>
                <KitchenDisplaySystem
                  isStandalone
                  onShowToast={showToast}
                  onCloseStandalone={() => setCurrentMode(isOwnerLoggedIn ? 'pemilik' : 'pembeli')}
                />
              </Suspense>
            ) : (
              renderLockedAccess(
                'Layar Dapur (KDS) Terkunci',
                'Khusus kru dapur, kasir, atau pemilik dengan PIN akses dapur.',
                'kds',
                'Buka Layar Dapur 🍳'
              )
            )
          )}

          {currentMode === 'track' && (
            <Suspense fallback={<LazyViewFallback />}>
              <OrderTrackingView
                orderId={trackingOrderId}
                onBackToMenu={() => setCurrentMode('pembeli')}
              />
            </Suspense>
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

        {/* PWA Install Banner */}
        <PwaInstallBanner onShowToast={showToast} />

        {/* Floating Notification Toast */}
        <Toast message={toastMessage} />

        {/* Owner Authentication Modal */}
        {isOwnerLoginOpen && (
          <Suspense fallback={null}>
            <OwnerLoginModal
              isOpen={isOwnerLoginOpen}
              onClose={() => {
                setIsOwnerLoginOpen(false);
                setPendingMode(null);
              }}
              onSuccess={() => {
                const role = storageService.getStaffRole();
                setIsOwnerLoggedIn(storageService.isOwnerAuthenticated());
                setStaffRole(role);
                setIsOwnerLoginOpen(false);
                if (role === 'kitchen') {
                  setCurrentMode('kds');
                } else if (pendingMode === 'kds') {
                  setCurrentMode('kds');
                } else if (pendingMode === 'cetak') {
                  setCurrentMode('cetak');
                } else {
                  setCurrentMode('pemilik');
                }
                setPendingMode(null);
                showToast('Selamat datang di Dapur Dulang! 🍳');
              }}
            />
          </Suspense>
        )}

        {/* Store Closed Modal Notice */}
        <StoreClosedModal
          isOpen={isClosedModalOpen}
          config={storeConfig}
          onClose={() => {
            hasDismissedClosedModalRef.current = true;
            setIsClosedModalOpen(false);
          }}
        />


      </div>
    </div>
  );
}

export default App;
