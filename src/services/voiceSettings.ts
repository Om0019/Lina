import { File, Paths } from 'expo-file-system';

import { TTS_SPEAKER_COUNT, TTS_SPEAKER_ID_DEFAULT } from '../models/registry';

const settingsFile = new File(Paths.document, 'settings.json');

type Settings = { voiceSid: number };

function readSettings(): Settings {
  if (!settingsFile.exists) return { voiceSid: TTS_SPEAKER_ID_DEFAULT };
  try {
    const parsed = JSON.parse(settingsFile.textSync());
    const sid = parsed.voiceSid;
    if (typeof sid === 'number' && sid >= 0 && sid < TTS_SPEAKER_COUNT) return { voiceSid: sid };
  } catch {
    // Corrupt or missing settings file — fall through to the default.
  }
  return { voiceSid: TTS_SPEAKER_ID_DEFAULT };
}

function writeSettings(settings: Settings): void {
  if (!settingsFile.exists) settingsFile.create();
  settingsFile.write(JSON.stringify(settings));
}

export function getVoiceSid(): number {
  return readSettings().voiceSid;
}

export function setVoiceSid(sid: number): void {
  const clamped = ((sid % TTS_SPEAKER_COUNT) + TTS_SPEAKER_COUNT) % TTS_SPEAKER_COUNT;
  writeSettings({ voiceSid: clamped });
}
