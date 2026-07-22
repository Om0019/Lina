import { Directory, File, Paths } from 'expo-file-system';
import { fileModelPath } from 'react-native-sherpa-onnx';
import { createTTS, saveAudioToFile, type TtsEngine } from 'react-native-sherpa-onnx/tts';

import { TTS_MODEL } from '../models/registry';
import { ensureArchiveModel, type ModelProgress } from './modelManager';
import { toNativePath } from './nativePath';

let engine: TtsEngine | null = null;

export async function loadTts(onProgress?: (progress: ModelProgress) => void): Promise<void> {
  if (engine) return;
  const modelDir = await ensureArchiveModel(TTS_MODEL, onProgress);
  engine = await createTTS({
    modelPath: fileModelPath(toNativePath(modelDir)),
    modelType: 'vits',
  });
}

/** Synthesizes speech and returns a local WAV file URI ready for playback. */
export async function synthesizeToFile(text: string): Promise<string> {
  if (!engine) throw new Error('TTS not loaded — call loadTts() first.');

  const audio = await engine.generateSpeech(text);

  const outDir = new Directory(Paths.cache, 'tts-output');
  if (!outDir.exists) outDir.create({ intermediates: true });
  const outFile = new File(outDir, `reply-${Date.now()}.wav`);

  await saveAudioToFile(audio, toNativePath(outFile.uri));
  return outFile.uri;
}

export async function unloadTts(): Promise<void> {
  await engine?.destroy();
  engine = null;
}
