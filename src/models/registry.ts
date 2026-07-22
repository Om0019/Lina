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

export type VoiceModelSpec = ArchiveModelSpec & { label: string };

// Curated single-speaker Piper voices, each individually trained on a clean
// studio-quality corpus (unlike a multi-speaker corpus like libritts_r, whose
// hundreds of speakers range wildly in recording quality). Every entry here
// sounds natural and realistic, so any option a user picks is a good one.
export const TTS_VOICES: VoiceModelSpec[] = [
  {
    kind: 'archive',
    id: 'vits-piper-en_US-lessac-medium',
    label: 'Lessac',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2',
    filename: 'vits-piper-en_US-lessac-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
  {
    kind: 'archive',
    id: 'vits-piper-en_US-amy-medium',
    label: 'Amy',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-medium.tar.bz2',
    filename: 'vits-piper-en_US-amy-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
  {
    kind: 'archive',
    id: 'vits-piper-en_US-ryan-medium',
    label: 'Ryan',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ryan-medium.tar.bz2',
    filename: 'vits-piper-en_US-ryan-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
  {
    kind: 'archive',
    id: 'vits-piper-en_US-hfc_female-medium',
    label: 'Hfc Female',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-hfc_female-medium.tar.bz2',
    filename: 'vits-piper-en_US-hfc_female-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
];

export const TTS_VOICE_DEFAULT_INDEX = 0;

export const ALL_MODELS = [LLM_MODEL, STT_MODEL, TTS_VOICES[TTS_VOICE_DEFAULT_INDEX]];

export const TOTAL_DOWNLOAD_SIZE_MB = ALL_MODELS.reduce((sum, m) => sum + m.approxSizeMB, 0);
