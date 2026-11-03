import { useState, useEffect } from 'react';

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (onSuccess?: () => void) => {
    if (isInstalled) {
      alert('Aplikasi Dulang sudah aktif terpasang di HP Anda! 🎉');
      return;
    }

    if (installPrompt) {
      try {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          if (onSuccess) onSuccess();
        }
        setInstallPrompt(null);
      } catch (err) {
        console.warn('Error triggering install prompt:', err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      alert(
        'Untuk memasang di HP Android:\n1. Buka menu titik tiga (⋮) di pojok kanan atas browser Chrome.\n2. Pilih "Tambahkan ke Layar Utama" atau "Instal Aplikasi".'
      );
    }
  };

  return {
    isInstalled,
    installPrompt,
    isIOS,
    showIOSModal,
    setShowIOSModal,
    triggerInstall,
  };
}
