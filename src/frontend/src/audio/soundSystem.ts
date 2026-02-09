import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SoundType = 'success' | 'error' | 'printComplete';

interface CustomSound {
  name: string;
  dataUrl: string;
}

interface SoundSettings {
  successSound: string;
  errorSound: string;
  printCompleteSound: string;
  volume: number;
  customSounds: Record<string, CustomSound>;
}

interface SoundState extends SoundSettings {
  updateSettings: (settings: Partial<SoundSettings>) => void;
  addCustomSound: (type: SoundType, name: string, dataUrl: string) => void;
  removeCustomSound: (type: SoundType, name: string) => void;
}

const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      successSound: 'beep1',
      errorSound: 'error1',
      printCompleteSound: 'success1',
      volume: 70,
      customSounds: {},
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
      addCustomSound: (type, name, dataUrl) =>
        set((state) => ({
          customSounds: {
            ...state.customSounds,
            [`${type}:${name}`]: { name, dataUrl },
          },
        })),
      removeCustomSound: (type, name) =>
        set((state) => {
          const newCustomSounds = { ...state.customSounds };
          delete newCustomSounds[`${type}:${name}`];
          return { customSounds: newCustomSounds };
        }),
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
      customSounds: settings.customSounds,
    },
    updateSettings: settings.updateSettings,
    addCustomSound: settings.addCustomSound,
    removeCustomSound: settings.removeCustomSound,
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

// Play custom audio file
async function playCustomAudio(dataUrl: string, volume: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(dataUrl);
      audio.volume = volume / 100;
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(new Error('Failed to play custom audio'));
      audio.play().catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

export function playSound(type: 'success' | 'error' | 'printComplete') {
  const { volume, successSound, errorSound, printCompleteSound, customSounds } = useSoundStore.getState();
  
  if (volume === 0) return;

  let selectedSound = '';
  switch (type) {
    case 'success':
      selectedSound = successSound;
      break;
    case 'error':
      selectedSound = errorSound;
      break;
    case 'printComplete':
      selectedSound = printCompleteSound;
      break;
  }

  // Check if it's a custom sound
  const customSoundKey = `${type}:${selectedSound}`;
  if (customSounds[customSoundKey]) {
    playCustomAudio(customSounds[customSoundKey].dataUrl, volume).catch((error) => {
      console.warn('Custom audio playback failed:', error);
    });
    return;
  }

  // Built-in sounds
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

export async function playTestSound(type: 'success' | 'error' | 'printComplete'): Promise<{ success: boolean; error?: string }> {
  try {
    const { volume, successSound, errorSound, printCompleteSound, customSounds } = useSoundStore.getState();
    
    if (volume === 0) {
      return { success: false, error: 'Volume is set to 0' };
    }

    let selectedSound = '';
    switch (type) {
      case 'success':
        selectedSound = successSound;
        break;
      case 'error':
        selectedSound = errorSound;
        break;
      case 'printComplete':
        selectedSound = printCompleteSound;
        break;
    }

    // Check if it's a custom sound
    const customSoundKey = `${type}:${selectedSound}`;
    if (customSounds[customSoundKey]) {
      await playCustomAudio(customSounds[customSoundKey].dataUrl, volume);
      return { success: true };
    }

    // Play built-in sound
    playSound(type);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to play sound' };
  }
}

export function getBuiltInSounds(type: SoundType): string[] {
  switch (type) {
    case 'success':
      return ['none', 'beep1', 'beep2', 'chime', 'ding'];
    case 'error':
      return ['none', 'error1', 'error2', 'buzz', 'alert'];
    case 'printComplete':
      return ['none', 'success1', 'success2', 'done', 'fanfare'];
  }
}

export function getCustomSounds(type: SoundType): CustomSound[] {
  const { customSounds } = useSoundStore.getState();
  const prefix = `${type}:`;
  return Object.entries(customSounds)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, sound]) => sound);
}
