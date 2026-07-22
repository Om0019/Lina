import { Directory, File, Paths } from 'expo-file-system';
import { extractArchive } from 'react-native-sherpa-onnx/extraction';

import type { ArchiveModelSpec, FileModelSpec } from '../models/registry';
import { toNativePath } from './nativePath';

export type DownloadProgress = { bytesWritten: number; totalBytes: number };
export type ModelProgress = { stage: 'downloading' | 'extracting' | 'done'; fraction: number };

function modelsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'models');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
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

  const file = await File.downloadFileAsync(spec.url, dir, {
    idempotent: true,
    onProgress: (data: DownloadProgress) => {
      const fraction = data.totalBytes > 0 ? data.bytesWritten / data.totalBytes : 0;
      onProgress?.({ stage: 'downloading', fraction });
    },
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
    await File.downloadFileAsync(spec.url, dir, {
      idempotent: true,
      onProgress: (data: DownloadProgress) => {
        const fraction = data.totalBytes > 0 ? data.bytesWritten / data.totalBytes : 0;
        onProgress?.({ stage: 'downloading', fraction });
      },
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
