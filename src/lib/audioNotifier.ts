// src/lib/audioNotifier.ts
// Synthesized audio notifications & volume controls for real-time order alerts (Zero external MP3 required)

export type NotificationSoundType =
  | 'classic_bell'   // 🔔 Dulang Bell (D5 -> A5)
  | 'desk_bell'      // 🛎️ Bel Meja Resto (Ding! 1046Hz C6)
  | 'cash_register'  // 💰 Kasir Cha-Ching (E6 -> G#6 -> B6)
  | 'kitchen_trio'   // 🍳 Melodi Dapur (C5 -> E5 -> G5)
  | 'quick_beep';    // ⚡ Bip Cepat Dapur (Double beep 880Hz)

export interface NotificationSoundOption {
  id: NotificationSoundType;
  label: string;
  icon: string;
  desc: string;
}

export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  {
    id: 'classic_bell',
    label: 'Dulang Bell Klasik',
    icon: '🔔',
    desc: 'Ting-dong ceria dua nada (D5 -> A5)',
  },
  {
    id: 'desk_bell',
    label: 'Bel Meja Resto',
    icon: '🛎️',
    desc: 'Ding! nyaring & tembus suara wajan dapur',
  },
  {
    id: 'cash_register',
    label: 'Kasir Cha-Ching',
    icon: '💰',
    desc: 'Arpeggio koin masuk rezeki laci kasir',
  },
  {
    id: 'kitchen_trio',
    label: 'Melodi Dapur Hangat',
    icon: '🍳',
    desc: 'Tiga nada harmonis santai (C5-E5-G5)',
  },
  {
    id: 'quick_beep',
    label: 'Bip Antrean Cepat',
    icon: '⚡',
    desc: 'Dua bip tegas khas dapur resto siap saji',
  },
];

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

export function isAudioEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('dulang_audio_notification_enabled');
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return soundEnabled;
}

export function setAudioEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('dulang_audio_notification_enabled', enabled ? 'true' : 'false');
  }
}

export function getAudioVolume(): number {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('dulang_audio_volume');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
  }
  return 0.8; // default 80%
}

export function setAudioVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  if (typeof window !== 'undefined') {
    localStorage.setItem('dulang_audio_volume', clamped.toString());
  }
}

export function getAudioSoundType(): NotificationSoundType {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('dulang_audio_sound_type') as NotificationSoundType;
    if (saved && NOTIFICATION_SOUND_OPTIONS.some((opt) => opt.id === saved)) {
      return saved;
    }
  }
  return 'classic_bell';
}

export function setAudioSoundType(type: NotificationSoundType): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('dulang_audio_sound_type', type);
  }
}

export function isVibrationEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('dulang_audio_vibrate_enabled');
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return true; // default enabled
}

export function setVibrationEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('dulang_audio_vibrate_enabled', enabled ? 'true' : 'false');
  }
}

export function isAudioContextUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return !!audioCtx && audioCtx.state === 'running';
}

/**
 * Explicit user interaction trigger to bypass browser autoplay restrictions.
 * Resumes suspended AudioContext and plays a gentle activation chime.
 */
export async function unlockAudioContext(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    playNewCustomerChime();
    return ctx.state === 'running';
  } catch (err) {
    console.warn('Unlock audio context error:', err);
    return false;
  }
}

/**
 * Triggers haptic feedback / vibration on mobile & tablet devices for new orders
 */
export function triggerKitchenVibration(): void {
  if (!isVibrationEnabled()) return;
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([250, 100, 250]);
    } catch {
      // Ignored if device does not permit vibration
    }
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a synthesized notification chime with configurable tone and volume.
 * Supports on-the-fly custom soundType & volume for testing/previewing in settings.
 */
export function playNewCustomerChime(
  customSoundType?: NotificationSoundType,
  customVolume?: number
): void {
  if (!isAudioEnabled() && customSoundType === undefined) return;

  // Trigger haptic vibration on phones
  triggerKitchenVibration();

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const soundType = customSoundType || getAudioSoundType();
    const volume = customVolume !== undefined ? customVolume : getAudioVolume();
    const now = ctx.currentTime;

    if (soundType === 'classic_bell') {
      // 🔔 TONE 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.4 * volume, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.36);

      // TONE 2: 880.0 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.12);
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.001, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.48 * volume, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.71);
    } else if (soundType === 'desk_bell') {
      // 🛎️ BEL MEJA RESTO (Ding tajam & nyaring C6)
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      const gainOver = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now); // C6

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(2093.0, now); // C7 harmonic shimmer

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.55 * volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      gainOver.gain.setValueAtTime(0.001, now);
      gainOver.gain.linearRampToValueAtTime(0.25 * volume, now + 0.008);
      gainOver.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      overtone.connect(gainOver);
      gain.connect(ctx.destination);
      gainOver.connect(ctx.destination);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 0.76);
      overtone.stop(now + 0.36);
    } else if (soundType === 'cash_register') {
      // 💰 KASIR CHA-CHING (Arpeggio rezeki 3 nada cepat E6 -> G#6 -> B6)
      const freqs = [1318.51, 1661.22, 1975.53];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.08;
        const duration = idx === 2 ? 0.45 : 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.4 * volume, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      });
    } else if (soundType === 'kitchen_trio') {
      // 🍳 MELODI DAPUR HANGAT (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.1;
        const duration = idx === 2 ? 0.5 : 0.22;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.38 * volume, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      });
    } else if (soundType === 'quick_beep') {
      // ⚡ BIP CEPAT (Double Beep 880Hz tegas)
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + offset;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880.0, startTime);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.45 * volume, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.1);
      });
    }
  } catch (err) {
    console.warn('Audio chime playback skipped:', err);
  }
}
