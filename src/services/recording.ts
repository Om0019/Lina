import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type RecordingOptions,
} from 'expo-audio';

// whisper.cpp wants 16kHz mono 16-bit PCM WAV — ask the recorder for that
// directly so no client-side resampling/transcoding is needed before STT.
export const WHISPER_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    outputFormat: 'default',
    audioEncoder: 'default',
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export async function ensureMicPermission(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  if (granted) {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  }
  return granted;
}
