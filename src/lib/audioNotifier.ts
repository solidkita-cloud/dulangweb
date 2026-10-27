// src/lib/audioNotifier.ts
// Synthesized sweet two-tone chime for real-time customer scan alerts (No external MP3 required)

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
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
 * Plays a warm, sweet 2-tone bell chime (D5 -> A5)
 * Perfectly tuned for cashier/kitchen order notifications
 */
export function playNewCustomerChime(): void {
  if (!isAudioEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Tone 2: 880.0 Hz (A5 - higher cheerful note)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.24, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.66);
  } catch (err) {
    console.warn('Audio chime playback skipped:', err);
  }
}
