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

export type VoiceModelSpec = ArchiveModelSpec & {
  label: string;
  modelType: 'vits' | 'kokoro';
  // Speaker id within a multi-speaker archive (Kokoro). Several voice entries
  // can share the same id/url/filename/approxSizeMB — ensureArchiveModel
  // dedupes by id, so picking between them never re-downloads the model,
  // and switchVoice reuses the loaded engine and just changes which sid it
  // synthesizes with. Ignored (defaults to 0) for single-speaker Piper voices.
  sid?: number;
};

// Curated single-speaker Piper voices, each individually trained on a clean
// studio-quality corpus (unlike a multi-speaker corpus like libritts_r, whose
// hundreds of speakers range wildly in recording quality). Fast and reliably
// intelligible, but flat/monotone — no prosody or emotion conditioning.
const PIPER_VOICES: VoiceModelSpec[] = [
  {
    kind: 'archive',
    id: 'vits-piper-en_US-lessac-medium',
    label: 'Lessac',
    modelType: 'vits',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2',
    filename: 'vits-piper-en_US-lessac-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
  {
    kind: 'archive',
    id: 'vits-piper-en_US-amy-medium',
    label: 'Amy',
    modelType: 'vits',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-medium.tar.bz2',
    filename: 'vits-piper-en_US-amy-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
  {
    kind: 'archive',
    id: 'vits-piper-en_US-ryan-medium',
    label: 'Ryan',
    modelType: 'vits',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ryan-medium.tar.bz2',
    filename: 'vits-piper-en_US-ryan-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
  {
    kind: 'archive',
    id: 'vits-piper-en_US-hfc_female-medium',
    label: 'Hfc Female',
    modelType: 'vits',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-hfc_female-medium.tar.bz2',
    filename: 'vits-piper-en_US-hfc_female-medium.tar.bz2',
    archiveFormat: 'tar.bz2',
    approxSizeMB: 61,
  },
];

// Kokoro is a heavier neural TTS with real prosody/emotion, sharing one
// archive across the 4 speakers picked out below. It sounds far more human
// than Piper, but its ONNX Runtime mobile path is unproven for us — an
// upstream report (k2-fsa/sherpa-onnx#2374) measured 19-39s per reply on an
// iPhone 15, worse than Piper's near-instant synthesis. These entries exist
// so it can be A/B tested on-device against the Piper voices above before
// deciding whether it's actually usable here.
const KOKORO_EN_ARCHIVE = {
  kind: 'archive' as const,
  id: 'kokoro-int8-en-v0_19',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-en-v0_19.tar.bz2',
  filename: 'kokoro-int8-en-v0_19.tar.bz2',
  archiveFormat: 'tar.bz2' as const,
  approxSizeMB: 103,
};

const KOKORO_VOICES: VoiceModelSpec[] = [
  { ...KOKORO_EN_ARCHIVE, label: 'Bella (Kokoro)', modelType: 'kokoro', sid: 1 }, // af_bella
  { ...KOKORO_EN_ARCHIVE, label: 'Michael (Kokoro)', modelType: 'kokoro', sid: 6 }, // am_michael
  { ...KOKORO_EN_ARCHIVE, label: 'Emma (Kokoro)', modelType: 'kokoro', sid: 7 }, // bf_emma
  { ...KOKORO_EN_ARCHIVE, label: 'George (Kokoro)', modelType: 'kokoro', sid: 9 }, // bm_george
];

export const TTS_VOICES: VoiceModelSpec[] = [...PIPER_VOICES, ...KOKORO_VOICES];

export const TTS_VOICE_DEFAULT_INDEX = 0;

export const ALL_MODELS = [LLM_MODEL, STT_MODEL, TTS_VOICES[TTS_VOICE_DEFAULT_INDEX]];

export const TOTAL_DOWNLOAD_SIZE_MB = ALL_MODELS.reduce((sum, m) => sum + m.approxSizeMB, 0);
