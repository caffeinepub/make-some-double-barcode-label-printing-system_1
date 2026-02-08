import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SoundSettings {
  successSound: string;
  errorSound: string;
  printCompleteSound: string;
  volume: number;
}

interface SoundState extends SoundSettings {
  updateSettings: (settings: Partial<SoundSettings>) => void;
}

const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      successSound: 'beep1',
      errorSound: 'error1',
      printCompleteSound: 'success1',
      volume: 70,
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'sound-settings',
    }
  )
);

export function useSoundSettings() {
  const settings = useSoundStore();
  return {
    settings: {
      successSound: settings.successSound,
      errorSound: settings.errorSound,
      printCompleteSound: settings.printCompleteSound,
      volume: settings.volume,
    },
    updateSettings: settings.updateSettings,
  };
}

// Simple beep generation using Web Audio API
function playBeep(frequency: number, duration: number, volume: number) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.value = volume / 100;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (error) {
    console.warn('Audio playback failed:', error);
  }
}

// Play a sequence of beeps
function playBeepSequence(sequence: Array<{ frequency: number; duration: number; delay: number }>, volume: number) {
  sequence.forEach(({ frequency, duration, delay }) => {
    setTimeout(() => playBeep(frequency, duration, volume), delay);
  });
}

export function playSound(type: 'success' | 'error' | 'printComplete') {
  const { volume, successSound, errorSound, printCompleteSound } = useSoundStore.getState();
  
  if (volume === 0) return;

  switch (type) {
    case 'success':
      switch (successSound) {
        case 'beep1':
          playBeep(800, 100, volume);
          break;
        case 'beep2':
          playBeep(1000, 80, volume);
          break;
        case 'chime':
          playBeepSequence([
            { frequency: 600, duration: 80, delay: 0 },
            { frequency: 800, duration: 80, delay: 100 },
          ], volume);
          break;
        case 'ding':
          playBeep(1200, 120, volume);
          break;
        case 'none':
          break;
      }
      break;

    case 'error':
      switch (errorSound) {
        case 'error1':
          playBeepSequence([
            { frequency: 400, duration: 200, delay: 0 },
            { frequency: 300, duration: 200, delay: 250 },
          ], volume);
          break;
        case 'error2':
          playBeepSequence([
            { frequency: 300, duration: 150, delay: 0 },
            { frequency: 250, duration: 150, delay: 200 },
            { frequency: 200, duration: 150, delay: 400 },
          ], volume);
          break;
        case 'buzz':
          playBeep(200, 300, volume);
          break;
        case 'alert':
          playBeepSequence([
            { frequency: 500, duration: 100, delay: 0 },
            { frequency: 400, duration: 100, delay: 150 },
            { frequency: 500, duration: 100, delay: 300 },
          ], volume);
          break;
        case 'none':
          break;
      }
      break;

    case 'printComplete':
      switch (printCompleteSound) {
        case 'success1':
          playBeepSequence([
            { frequency: 600, duration: 100, delay: 0 },
            { frequency: 800, duration: 100, delay: 150 },
          ], volume);
          break;
        case 'success2':
          playBeepSequence([
            { frequency: 700, duration: 80, delay: 0 },
            { frequency: 900, duration: 80, delay: 100 },
            { frequency: 1100, duration: 120, delay: 200 },
          ], volume);
          break;
        case 'done':
          playBeep(900, 200, volume);
          break;
        case 'fanfare':
          playBeepSequence([
            { frequency: 500, duration: 100, delay: 0 },
            { frequency: 700, duration: 100, delay: 120 },
            { frequency: 900, duration: 150, delay: 240 },
          ], volume);
          break;
        case 'none':
          break;
      }
      break;
  }
}

export function playTestSound(type: 'success' | 'error' | 'printComplete') {
  playSound(type);
}
