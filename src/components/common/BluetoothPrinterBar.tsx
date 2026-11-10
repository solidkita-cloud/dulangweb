import React, { useState, useEffect } from 'react';
import { StoreConfig } from '../../types';
import {
  PRINTER_STATUS_EVENT,
  ThermalPaperWidth,
  isBluetoothSupported,
  isPrinterConnected,
  getConnectedDeviceName,
  getLastConnectedPrinterName,
  switchBluetoothPrinter,
  disconnectBluetoothPrinter,
  printTestPageViaBluetooth,
  formatBluetoothErrorAlert,
} from '../../lib/bluetoothPrinter';

interface BluetoothPrinterBarProps {
  storeConfig: StoreConfig;
  paperWidth?: ThermalPaperWidth;
  onShowToast: (msg: string) => void;
  compact?: boolean;
}

export const BluetoothPrinterBar: React.FC<BluetoothPrinterBarProps> = ({
  storeConfig,
  paperWidth,
  onShowToast,
  compact = false,
}) => {
  const [connectedName, setConnectedName] = useState<string | null>(() =>
    isPrinterConnected() ? getConnectedDeviceName() : null
  );
  const [lastName, setLastName] = useState<string | null>(() => getLastConnectedPrinterName());
  const [isBusy, setIsBusy] = useState<'switch' | 'test' | null>(null);

  const btSupported = isBluetoothSupported();

  const refreshStatus = () => {
    setConnectedName(isPrinterConnected() ? getConnectedDeviceName() : null);
    setLastName(getLastConnectedPrinterName());
  };

  useEffect(() => {
    refreshStatus();
    window.addEventListener(PRINTER_STATUS_EVENT, refreshStatus);
    return () => {
      window.removeEventListener(PRINTER_STATUS_EVENT, refreshStatus);
    };
  }, []);

  const handleSwitchOrConnect = async () => {
    if (!btSupported) {
      alert(
        'Browser ini tidak mendukung Web Bluetooth langsung.\n\n' +
          'Gunakan Google Chrome di HP Android untuk cetak Bluetooth langsung, atau klik "Cetak Biasa / PDF".'
      );
      return;
    }
    setIsBusy('switch');
    try {
      const res = await switchBluetoothPrinter();
      refreshStatus();
      onShowToast(`Terhubung ke printer "${res.deviceName}"! Siap cetak 🖨️✨`);
    } catch (err: any) {
      const info = formatBluetoothErrorAlert(err);
      if (info.isCancelled) {
        onShowToast('Pemilihan printer Bluetooth dibatalkan.');
      } else {
        alert(info.message);
      }
    } finally {
      setIsBusy(null);
    }
  };

  const handleTestPrint = async () => {
    if (!btSupported) {
      alert(
        'Test Print Bluetooth langsung memerlukan Google Chrome di Android.\nGunakan tombol "Cetak Biasa / PDF" jika memakai Safari/PC tanpa BLE.'
      );
      return;
    }
    setIsBusy('test');
    try {
      const res = await printTestPageViaBluetooth(storeConfig, paperWidth);
      refreshStatus();
      onShowToast(`Test print terkirim ke "${res.deviceName}"! 🧾✓`);
    } catch (err: any) {
      const info = formatBluetoothErrorAlert(err);
      if (info.isCancelled) {
        onShowToast('Test print dibatalkan.');
      } else {
        alert(info.message);
      }
    } finally {
      setIsBusy(null);
    }
  };

  const handleDisconnect = () => {
    disconnectBluetoothPrinter();
    refreshStatus();
    onShowToast('Koneksi printer diputus. Anda bisa memilih printer lain kapan saja.');
  };

  if (!btSupported) {
    return (
      <div
        className={`rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-sans ${
          compact ? 'px-3 py-1.5 text-[11px]' : 'p-3 text-xs'
        }`}
      >
        📱 Bluetooth langsung aktif di Chrome Android. Di perangkat/browser ini gunakan tombol{' '}
        <strong>Cetak Biasa / PDF</strong>.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[#111111]/15 bg-[#FFFDF4] font-sans flex flex-wrap items-center justify-between gap-2 ${
        compact ? 'px-3 py-2 text-[11px]' : 'p-3.5 text-xs'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            connectedName ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
          }`}
        />
        <div className="min-w-0">
          {connectedName ? (
            <div className="font-bold text-emerald-900 truncate">
              Tersambung: <span className="text-[#111111]">{connectedName}</span>
            </div>
          ) : (
            <div className="text-[#5C3D2E] truncate">
              Printer: <span className="font-semibold">Belum tersambung</span>
              {lastName && (
                <span className="text-[10px] text-[#5C3D2E]/70 ml-1">(Terakhir: {lastName})</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <button
          type="button"
          disabled={isBusy !== null}
          onClick={handleSwitchOrConnect}
          className="cursor-pointer bg-white hover:bg-[#FFD700] text-[#111111] border border-[#111111]/40 hover:border-[#111111] rounded-full px-2.5 py-1 font-bold text-[11px] transition disabled:opacity-50"
          title="Pilih atau ganti printer thermal Bluetooth lain"
        >
          {isBusy === 'switch'
            ? 'Memilih...'
            : connectedName
            ? '🔄 Ganti Printer'
            : '🔌 Sambung Printer'}
        </button>

        <button
          type="button"
          disabled={isBusy !== null}
          onClick={handleTestPrint}
          className="cursor-pointer bg-[#FFF3C7] hover:bg-[#FFD700] text-[#111111] border border-[#111111]/40 hover:border-[#111111] rounded-full px-2.5 py-1 font-bold text-[11px] transition disabled:opacity-50"
          title="Cetak struk uji pendek untuk memastikan printer baru siap"
        >
          {isBusy === 'test' ? 'Mencetak...' : '🧪 Test Print'}
        </button>

        {connectedName && (
          <button
            type="button"
            disabled={isBusy !== null}
            onClick={handleDisconnect}
            className="cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-1 font-bold text-[11px] transition disabled:opacity-50"
            title="Putuskan koneksi printer saat ini"
          >
            Putus
          </button>
        )}
      </div>
    </div>
  );
};
