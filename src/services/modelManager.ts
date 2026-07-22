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

function resumeStateFile(dir: Directory, filename: string): File {
  return new File(dir, `${filename}.resume.json`);
}

/**
 * Downloads a file to `dir`, checkpointing resumable state whenever the app
 * backgrounds mid-transfer. `File.downloadFileAsync`'s underlying background
 * URLSession keeps transferring while suspended, but its JS-side task isn't
 * restored if the app process is killed and relaunched — leaving no way to
 * find the (possibly complete) download next time, so the app just restarts
 * it from zero. Explicitly pausing on background and persisting the native
 * resume token avoids that: the next launch resumes instead of restarting.
 */
async function downloadWithResume(
  url: string,
  dir: Directory,
  filename: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<File> {
  const stateFile = resumeStateFile(dir, filename);
  const savedState: DownloadPauseState | null = stateFile.exists
    ? (JSON.parse(stateFile.textSync()) as DownloadPauseState)
    : null;

  const task = savedState
    ? DownloadTask.fromSavable(savedState, { onProgress })
    : File.createDownloadTask(url, dir, { onProgress });

  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status === 'background') task.pause();
  });

  try {
    const file = savedState ? await task.resumeAsync() : await task.downloadAsync();
    if (!file) {
      if (!stateFile.exists) stateFile.create();
      stateFile.write(JSON.stringify(task.savable()));
      throw new DownloadPausedError();
    }
    if (stateFile.exists) stateFile.delete();
    return file;
  } finally {
    subscription.remove();
  }
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
    onProgress?.({ stage: 'done', fraction: 1 });
    return destination.uri;
  }

  const file = await downloadWithResume(spec.url, dir, spec.filename, (data) => {
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
  if (!archiveFile.exists) {
    await downloadWithResume(spec.url, dir, spec.filename, (data) => {
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
