import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from 'expo-file-system';
import { AppState, type AppStateStatus } from 'react-native';
import { extractArchive } from 'react-native-sherpa-onnx/extraction';

import type { ArchiveModelSpec, FileModelSpec } from '../models/registry';
import { toNativePath } from './nativePath';

export type DownloadProgress = { bytesWritten: number; totalBytes: number };
export type ModelProgress = { stage: 'downloading' | 'extracting' | 'done'; fraction: number };

/** Thrown by downloadWithResume when the app backgrounds mid-download; the
 * transfer is checkpointed to disk rather than lost, and resumes from where
 * it left off the next time this model is requested. */
export class DownloadPausedError extends Error {
  constructor() {
    super('Download paused — will resume next launch.');
    this.name = 'DownloadPausedError';
  }
}

function modelsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'models');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function resumeStateFile(destination: File): File {
  return new File(`${destination.uri}.resume.json`);
}

/** How often to checkpoint an in-progress download to disk, independent of backgrounding. */
const CHECKPOINT_INTERVAL_MS = 20_000;

/**
 * Downloads a file to `destination`, checkpointing resumable state to disk whenever the app
 * backgrounds mid-transfer, and periodically while it's active. `File.downloadFileAsync`'s
 * underlying background URLSession keeps transferring while suspended, but its JS-side task
 * isn't restored if the app process is killed and relaunched — leaving no way to find the
 * (possibly complete) download next time, so the app just restarts it from zero.
 *
 * Pausing on background and persisting the native resume token is meant to avoid that, but the
 * app requests no background execution time (no `beginBackgroundTask` assertion), so there's no
 * guarantee the pause completes — and resume data isn't ready the instant `pause()` is called,
 * it's produced asynchronously on the native side — before iOS suspends or the process is killed.
 * That single opportunity can be lost to the exact race this was meant to fix. Checkpointing
 * periodically during the transfer, not only at the moment of backgrounding, bounds how much
 * progress an untimely kill can actually cost.
 */
async function attemptDownload(
  url: string,
  destination: File,
  stateFile: File,
  resumeState: DownloadPauseState | null,
  onProgress?: (progress: DownloadProgress) => void
): Promise<File> {
  const task = resumeState
    ? DownloadTask.fromSavable(resumeState, { onProgress })
    : File.createDownloadTask(url, destination, { onProgress });

  let backgrounding = false;
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status === 'background' && task.state === 'active') {
      backgrounding = true;
      task.pause();
    }
  });
  const checkpointTimer = setInterval(() => {
    if (!backgrounding && task.state === 'active') task.pause();
  }, CHECKPOINT_INTERVAL_MS);

  // Persists a resume token if one is available. Returns false if the pause happened too early —
  // before iOS transferred enough to produce real resume data, in which case savable() comes back
  // empty and persisting it would leave every future launch retrying an unusable checkpoint forever.
  function persistCheckpoint(): boolean {
    const savable = task.savable();
    if (!savable.resumeData) return false;
    if (!stateFile.exists) stateFile.create();
    stateFile.write(JSON.stringify(savable));
    return true;
  }

  try {
    let file = resumeState ? await task.resumeAsync() : await task.downloadAsync();
    while (!file && !backgrounding) {
      // Paused by our own periodic checkpoint tick above, not by backgrounding — save progress
      // and keep going transparently instead of surfacing a pause to the caller.
      persistCheckpoint();
      file = await task.resumeAsync();
    }
    if (!file) {
      if (!persistCheckpoint() && stateFile.exists) stateFile.delete();
      throw new DownloadPausedError();
    }
    if (stateFile.exists) stateFile.delete();
    return file;
  } finally {
    clearInterval(checkpointTimer);
    subscription.remove();
  }
}

/**
 * Loads any resume checkpoint left on disk from a previous launch and continues the download
 * from there, falling back to a fresh download if the checkpoint turns out to be unusable.
 */
async function downloadWithResume(
  url: string,
  destination: File,
  onProgress?: (progress: DownloadProgress) => void
): Promise<File> {
  const stateFile = resumeStateFile(destination);
  const savedState: DownloadPauseState | null = stateFile.exists
    ? (JSON.parse(stateFile.textSync()) as DownloadPauseState)
    : null;

  try {
    return await attemptDownload(url, destination, stateFile, savedState, onProgress);
  } catch (err) {
    if (err instanceof DownloadPausedError || !savedState) throw err;
    // The saved checkpoint turned out to be unusable (e.g. "no resume data" — a stale
    // or corrupt state file). Discard it and restart fresh instead of getting stuck
    // retrying a broken resume on every future launch.
    if (stateFile.exists) stateFile.delete();
    return attemptDownload(url, destination, stateFile, null, onProgress);
  }
}

// How much smaller than the registry's approxSizeMB a cached file can be
// before it's treated as an interrupted/corrupt download rather than a real
// (if imprecisely-labeled) complete one.
const MIN_VALID_SIZE_FRACTION = 0.9;

function isPlausiblyComplete(file: File, approxSizeMB: number): boolean {
  return file.size >= approxSizeMB * 1024 * 1024 * MIN_VALID_SIZE_FRACTION;
}

/**
 * Downloads a single-file model (LLM gguf, whisper ggml) to the app's
 * document directory if it isn't already there, and returns its local path.
 */
export async function ensureFileModel(
  spec: FileModelSpec,
  onProgress?: (progress: ModelProgress) => void
): Promise<string> {
  const dir = modelsDirectory();
  const destination = new File(dir, spec.filename);
  if (destination.exists) {
    if (isPlausiblyComplete(destination, spec.approxSizeMB)) {
      onProgress?.({ stage: 'done', fraction: 1 });
      return destination.uri;
    }
    // Too small to be the real file — left over from a download that never
    // finished (e.g. the process was killed mid-transfer). Loading this as
    // a model would hand llama.cpp/whisper.cpp a truncated file, which
    // segfaults natively instead of throwing a catchable JS error.
    destination.delete();
  }

  const file = await downloadWithResume(spec.url, destination, (data) => {
    const fraction = data.totalBytes > 0 ? data.bytesWritten / data.totalBytes : 0;
    onProgress?.({ stage: 'downloading', fraction });
  });

  onProgress?.({ stage: 'done', fraction: 1 });
  return file.uri;
}

/**
 * Downloads an archive-based model (Piper/VITS voice bundles ship as
 * tar.bz2: model.onnx + tokens.txt + espeak-ng-data) and extracts it once.
 * Returns the local directory the model files were extracted into.
 */
export async function ensureArchiveModel(
  spec: ArchiveModelSpec,
  onProgress?: (progress: ModelProgress) => void
): Promise<string> {
  const dir = modelsDirectory();
  const extractedDir = new Directory(dir, spec.id);
  const readyMarker = new File(extractedDir, '.ready');
  if (extractedDir.exists && readyMarker.exists) {
    onProgress?.({ stage: 'done', fraction: 1 });
    return extractedDir.uri;
  }

  const archiveFile = new File(dir, spec.filename);
  if (archiveFile.exists && !isPlausiblyComplete(archiveFile, spec.approxSizeMB)) {
    // Same guard as ensureFileModel: don't hand a truncated archive to the
    // native extractor.
    archiveFile.delete();
  }
  if (!archiveFile.exists) {
    await downloadWithResume(spec.url, archiveFile, (data) => {
      const fraction = data.totalBytes > 0 ? data.bytesWritten / data.totalBytes : 0;
      onProgress?.({ stage: 'downloading', fraction });
    });
  }

  const result = await extractArchive(
    { modelId: spec.id, archivePath: toNativePath(archiveFile.uri), format: spec.archiveFormat },
    toNativePath(extractedDir.uri),
    {
      onProgress: (event) => onProgress?.({ stage: 'extracting', fraction: event.percent / 100 }),
      showNotificationsEnabled: false,
    }
  );

  if (!result.success || !result.path) {
    throw new Error(`Failed to extract ${spec.id}: ${result.reason ?? 'unknown error'}`);
  }

  new File(extractedDir, '.ready').create({ overwrite: true });
  archiveFile.delete();

  onProgress?.({ stage: 'done', fraction: 1 });
  return result.path;
}
