import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import {
  checkLoginAttempts,
  recordFailedAttempt,
  resetLoginAttempts,
  logSecurityEvent,
  LockoutStatus,
} from '../../lib/security';

interface OwnerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OwnerLoginModal: React.FC<OwnerLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockout, setLockout] = useState<LockoutStatus>(() => checkLoginAttempts());

  // Countdown timer for anti-brute force lockout
  useEffect(() => {
    if (!lockout.isLocked) return;
    const interval = setInterval(() => {
      const current = checkLoginAttempts();
      setLockout(current);
      if (!current.isLocked) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockout.isLocked]);

  if (!isOpen) return null;

  const validEnvCode = import.meta.env?.VITE_OWNER_CODE || '';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockout.isLocked || isSubmitting) return;

    const clean = code.trim();
    if (!clean) return;

    setIsSubmitting(true);

    try {
      // 1. Check if matches environment code or any registered PIN
      const isEnvMatch = Boolean(validEnvCode && clean.toLowerCase() === validEnvCode.toLowerCase());
      const pinResult = await storageService.verifyAnyPin(clean);

      if (isEnvMatch || pinResult.success) {
        const assignedRole: 'owner' | 'cashier' | 'kitchen' = isEnvMatch ? 'owner' : pinResult.role;
        const roleLabel = isEnvMatch ? '👑 Pemilik Usaha (Owner)' : pinResult.label;

        // Reset rate limiter on successful authentication
        resetLoginAttempts();
        logSecurityEvent('LOGIN_SUCCESS', `Staff berhasil login sebagai ${roleLabel}.`, 'INFO');
        storageService.setOwnerAuthenticated(true);
        storageService.setStaffRole(assignedRole);
        setError(null);
        setCode('');
        onSuccess();
      } else {
        // Record failed attempt for rate limiting
        const updatedLock = recordFailedAttempt();
        setLockout(updatedLock);

        if (updatedLock.isLocked) {
          logSecurityEvent(
            'LOCKOUT_TRIGGERED',
            `Batas 5x percobaan salah tercapai. Form login dikunci selama ${Math.floor(
              updatedLock.remainingSeconds / 60
            )} menit.`,
            'ALERT'
          );
          setError(
            `⛔ Terlalu banyak percobaan salah! Form dikunci selama ${Math.floor(
              updatedLock.remainingSeconds / 60
            )} menit ${updatedLock.remainingSeconds % 60} detik demi keamanan dapur.`
          );
        } else {
          logSecurityEvent(
            'LOGIN_FAILED',
            `Percobaan login gagal (${updatedLock.attempts}/5 percobaan).`,
            'WARN'
          );
          setError(
            `PIN tidak cocok! (${updatedLock.attempts}/5 percobaan). Masukkan PIN Owner, Kasir (1234), atau Dapur (0000) 😅`
          );
        }

        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#111111]/70 backdrop-blur-sm grid place-items-center p-4">
      <div
        className={`bg-[#FFF8E7] rounded-[24px] p-6 sm:p-8 w-full max-w-[390px] border-[3px] border-[#111111] shadow-[8px_8px_0_#FFD700] rotate-[-0.5deg] relative ${
          isShaking ? 'shake' : ''
        }`}
      >
        {/* Top Tape */}
        <div className="tape absolute -top-3 left-1/2 -translate-x-1/2 w-[80px] h-[20px] bg-[#FFD700] rotate-[-2deg] rounded-[2px] border border-[#111111]/20" />

        <div className="flex justify-between items-start mt-2">
          <div>
            <h3 className="font-hand font-bold text-[28px] sm:text-[30px] leading-none text-[#111111]">
              Akses Cockpit Dapur
            </h3>
            <p className="font-sans text-[11px] sm:text-[12px] text-[#5C3D2E]/75 mt-1">
              👑 Owner • 🛒 Kasir Stand • 🍳 Kru Dapur (KDS)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#111111] text-[#FFF8E7] grid place-items-center cursor-pointer hover:bg-black font-bold text-xs"
          >
            ✕
          </button>
        </div>

        {/* Lockout Warning Banner */}
        {lockout.isLocked && (
          <div className="mt-4 bg-red-100 border-2 border-red-500 rounded-[14px] p-3 text-red-950 font-sans text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-red-800">
              <span>🔒</span> Akses Dapur Terkunci Sementara
            </div>
            <p>
              Terkunci selama: <strong className="font-mono text-sm text-red-700">{formatCountdown(lockout.remainingSeconds)}</strong>
            </p>
            <p className="text-[11px] text-red-800/80">
              Sistem anti-brute force aktif untuk mencegah percobaan tebak password otomatis.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E]/70 mb-1">
              Kode Akses Dapur
            </label>
            <input
              type="password"
              autoFocus
              disabled={lockout.isLocked || isSubmitting}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder={lockout.isLocked ? 'Form terkunci sementara...' : 'masukkan kode rahasia'}
              className="w-full rounded-full bg-white border-2 border-[#111111] px-5 py-3 font-sans text-[14px] text-[#111111] focus:outline-none focus:border-[#FFD700] shadow-[2px_2px_0_#111111] disabled:bg-gray-100 disabled:opacity-60"
            />
          </div>

          {error && (
            <div className="font-sans text-xs font-bold text-red-600 leading-tight">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={lockout.isLocked || isSubmitting}
            className="w-full cursor-pointer bg-[#111111] text-[#FFD700] rounded-full py-3 font-sans font-bold text-[14px] tracking-wide border-2 border-[#111111] shadow-[3px_3px_0_#FFD700] hover:bg-[#222222] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Memverifikasi...</span>
            ) : lockout.isLocked ? (
              <span>Terkunci ({formatCountdown(lockout.remainingSeconds)})</span>
            ) : (
              <span>Masuk ke Dapur →</span>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-[#111111]/10 space-y-1.5 text-center font-sans text-[11px] text-[#5C3D2E]/70">
          <div className="font-bold text-[#111111]">💡 PIN Default Karyawan:</div>
          <div className="flex flex-wrap justify-center items-center gap-1.5 text-[10px]">
            <span className="bg-white border border-[#111111]/20 px-2 py-0.5 rounded-full">🛒 Kasir: <strong>1234</strong></span>
            <span className="bg-white border border-[#111111]/20 px-2 py-0.5 rounded-full">🍳 Dapur: <strong>0000</strong></span>
            <span className="bg-[#FFD700]/30 border border-[#111111]/20 px-2 py-0.5 rounded-full font-bold">👑 Owner (PIN Khusus)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
