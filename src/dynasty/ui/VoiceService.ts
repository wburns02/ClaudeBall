/**
 * UI-layer voice service — NOT an ECS system.
 * Subscribes to ConversationTriggered events and renders audio.
 * Architected for provider swap (Browser TTS → ElevenLabs).
 */

export interface VoiceProfile {
  name: string;
  pitch: number;      // 0.5-2.0 (1.0 = normal)
  rate: number;       // 0.5-2.0 (1.0 = normal)
  lang?: string;
}

export interface VoiceProvider {
  readonly name: string;
  speak(text: string, profile: VoiceProfile): Promise<void>;
  stop(): void;
  isAvailable(): boolean;
}

/** Browser Web Speech API provider (free, built-in) */
export class BrowserTTSProvider implements VoiceProvider {
  readonly name = 'Browser TTS';
  private synth: SpeechSynthesis | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
  }

  isAvailable(): boolean {
    return this.synth !== null;
  }

  async speak(text: string, profile: VoiceProfile): Promise<void> {
    if (!this.synth) return;

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;
      if (profile.lang) utterance.lang = profile.lang;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve(); // Don't block on errors
      this.synth!.speak(utterance);
    });
  }

  stop(): void {
    this.synth?.cancel();
  }
}

/** Silent provider — text only, no audio */
export class OffProvider implements VoiceProvider {
  readonly name = 'Off';

  isAvailable(): boolean {
    return true;
  }

  async speak(_text: string, _profile: VoiceProfile): Promise<void> {
    // No-op
  }

  stop(): void {
    // No-op
  }
}

/** Default voice profiles for common NPC roles */
export const DEFAULT_VOICE_PROFILES: Record<string, VoiceProfile> = {
  owner: { name: 'Owner', pitch: 0.9, rate: 0.85 },       // deep, deliberate
  agent: { name: 'Agent', pitch: 1.1, rate: 1.15 },       // fast-talking
  coach: { name: 'Coach', pitch: 0.95, rate: 1.0 },       // steady
  media: { name: 'Reporter', pitch: 1.05, rate: 1.1 },    // broadcast style
  player: { name: 'Player', pitch: 1.0, rate: 1.0 },      // neutral
  commissioner: { name: 'Commissioner', pitch: 0.85, rate: 0.9 }, // authoritative
};

/**
 * Voice service — manages provider and delivers speech.
 * Used by UI components, not by ECS systems.
 */
export class VoiceService {
  private provider: VoiceProvider;
  private enabled: boolean;

  constructor(providerType: 'browser_tts' | 'elevenlabs' | 'off' = 'off') {
    this.enabled = providerType !== 'off';
    switch (providerType) {
      case 'browser_tts':
        this.provider = new BrowserTTSProvider();
        break;
      case 'off':
      default:
        this.provider = new OffProvider();
        break;
      // ElevenLabs provider would be added here when ready
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.provider.isAvailable();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async speak(text: string, role = 'player'): Promise<void> {
    if (!this.enabled) return;
    const profile = DEFAULT_VOICE_PROFILES[role] ?? DEFAULT_VOICE_PROFILES.player;
    await this.provider.speak(text, profile);
  }

  stop(): void {
    this.provider.stop();
  }

  setProvider(providerType: 'browser_tts' | 'elevenlabs' | 'off'): void {
    this.provider.stop();
    this.enabled = providerType !== 'off';
    switch (providerType) {
      case 'browser_tts':
        this.provider = new BrowserTTSProvider();
        break;
      default:
        this.provider = new OffProvider();
        break;
    }
  }
}
