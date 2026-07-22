import { initWhisper, type WhisperContext } from 'whisper.rn';

import { STT_MODEL } from '../models/registry';
import { ensureFileModel, type ModelProgress } from './modelManager';
import { toNativePath } from './nativePath';

let context: WhisperContext | null = null;

export async function loadStt(onProgress?: (progress: ModelProgress) => void): Promise<void> {
  if (context) return;
  const modelPath = await ensureFileModel(STT_MODEL, onProgress);
  context = await initWhisper({ filePath: toNativePath(modelPath), useGpu: true });
}

/** Transcribes a recorded WAV file (see recording.ts for capture settings). */
export async function transcribeFile(wavFileUri: string): Promise<string> {
  if (!context) throw new Error('STT not loaded — call loadStt() first.');
  const { promise } = context.transcribe(toNativePath(wavFileUri), { language: 'en' });
  const result = await promise;
  return result.result.trim();
}

export async function unloadStt(): Promise<void> {
  await context?.release();
  context = null;
}
