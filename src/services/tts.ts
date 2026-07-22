import { Directory, File, Paths } from 'expo-file-system';
import { fileModelPath } from 'react-native-sherpa-onnx';
import { createTTS, saveAudioToFile, type TtsEngine } from 'react-native-sherpa-onnx/tts';

import { TTS_VOICES } from '../models/registry';
import { ensureArchiveModel, type ModelProgress } from './modelManager';
import { toNativePath } from './nativePath';
import { getVoiceIndex } from './voiceSettings';

let engine: TtsEngine | null = null;
let engineVoiceIndex = -1;

async function loadVoice(index: number, onProgress?: (progress: ModelProgress) => void): Promise<void> {
  if (engine && engineVoiceIndex === index) return;
  const modelDir = await ensureArchiveModel(TTS_VOICES[index], onProgress);
  const nextEngine = await createTTS({
    modelPath: fileModelPath(toNativePath(modelDir)),
    modelType: 'vits',
  });
  await engine?.destroy();
  engine = nextEngine;
  engineVoiceIndex = index;
}

export async function loadTts(onProgress?: (progress: ModelProgress) => void): Promise<void> {
  await loadVoice(getVoiceIndex(), onProgress);
}

/** Downloads the voice on demand if needed, then makes it the active engine. */
export async function switchVoice(index: number, onProgress?: (progress: ModelProgress) => void): Promise<void> {
  await loadVoice(index, onProgress);
}

/** Synthesizes speech and returns a local WAV file URI ready for playback. */
export async function synthesizeToFile(text: string): Promise<string> {
  if (!engine) throw new Error('TTS not loaded — call loadTts() first.');

  const audio = await engine.generateSpeech(text, { sid: 0 });

  const outDir = new Directory(Paths.cache, 'tts-output');
  if (!outDir.exists) outDir.create({ intermediates: true });
  const outFile = new File(outDir, `reply-${Date.now()}.wav`);

  await saveAudioToFile(audio, toNativePath(outFile.uri));
  return outFile.uri;
}

export async function unloadTts(): Promise<void> {
  await engine?.destroy();
  engine = null;
  engineVoiceIndex = -1;
}
