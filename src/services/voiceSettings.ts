import { File, Paths } from 'expo-file-system';

import { TTS_VOICES, TTS_VOICE_DEFAULT_INDEX } from '../models/registry';

const settingsFile = new File(Paths.document, 'settings.json');

type Settings = { voiceIndex: number };

function readSettings(): Settings {
  if (!settingsFile.exists) return { voiceIndex: TTS_VOICE_DEFAULT_INDEX };
  try {
    const parsed = JSON.parse(settingsFile.textSync());
    const index = parsed.voiceIndex;
    if (typeof index === 'number' && index >= 0 && index < TTS_VOICES.length) return { voiceIndex: index };
  } catch {
    // Corrupt or missing settings file — fall through to the default.
  }
  return { voiceIndex: TTS_VOICE_DEFAULT_INDEX };
}

function writeSettings(settings: Settings): void {
  if (!settingsFile.exists) settingsFile.create();
  settingsFile.write(JSON.stringify(settings));
}

export function getVoiceIndex(): number {
  return readSettings().voiceIndex;
}

export function setVoiceIndex(index: number): void {
  const clamped = ((index % TTS_VOICES.length) + TTS_VOICES.length) % TTS_VOICES.length;
  writeSettings({ voiceIndex: clamped });
}
