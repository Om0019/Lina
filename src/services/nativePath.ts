/**
 * expo-file-system (SDK 54+) hands back `file://` URIs everywhere, but
 * llama.rn / whisper.rn / react-native-sherpa-onnx come from the
 * react-native-fs convention of plain absolute paths with no scheme.
 * Strip it at the native-module boundary so path resolution doesn't fail.
 */
export function toNativePath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}
