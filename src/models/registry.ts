/**
 * Registry of on-device models Lina downloads on first launch and caches
 * locally. Nothing here is bundled into the app binary — keeping them out of
 * the IPA means the app stays small and a model can be swapped via an OTA
 * JS update without a new App Store build (the model URL/filename are just
 * data). Swap these entries for different sizes/languages/voices as needed.
 */

export type FileModelSpec = {
  kind: 'file';
  id: string;
  url: string;
  filename: string;
  approxSizeMB: number;
};

export type ArchiveModelSpec = {
  kind: 'archive';
  id: string;
  url: string;
  filename: string;
  archiveFormat: 'tar.bz2' | 'tar.zst';
  approxSizeMB: number;
};

export const LLM_MODEL: FileModelSpec = {
  kind: 'file',
  id: 'llama-3.2-1b-instruct-q4_k_m',
  url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  filename: 'llama-3.2-1b-instruct-q4_k_m.gguf',
  approxSizeMB: 770,
};

export const STT_MODEL: FileModelSpec = {
  kind: 'file',
  id: 'whisper-base-en',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  filename: 'ggml-base.en.bin',
  approxSizeMB: 148,
};

export const TTS_MODEL: ArchiveModelSpec = {
  kind: 'archive',
  id: 'vits-piper-en_US-amy-medium',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-medium.tar.bz2',
  filename: 'vits-piper-en_US-amy-medium.tar.bz2',
  archiveFormat: 'tar.bz2',
  approxSizeMB: 65,
};

export const ALL_MODELS = [LLM_MODEL, STT_MODEL, TTS_MODEL];

export const TOTAL_DOWNLOAD_SIZE_MB = ALL_MODELS.reduce((sum, m) => sum + m.approxSizeMB, 0);
