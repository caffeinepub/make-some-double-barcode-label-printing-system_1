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

export function playSound(type: 'success' | 'error' | 'printComplete') {
  const { volume } = useSoundStore.getState();
  
  switch (type) {
    case 'success':
      playBeep(800, 100, volume);
      break;
    case 'error':
      playBeep(400, 200, volume);
      setTimeout(() => playBeep(300, 200, volume), 250);
      break;
    case 'printComplete':
      playBeep(600, 100, volume);
      setTimeout(() => playBeep(800, 100, volume), 150);
      break;
  }
}

export function playTestSound(type: 'success' | 'error' | 'printComplete') {
  playSound(type);
}
