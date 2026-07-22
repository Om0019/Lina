import type { ExpoConfig } from 'expo/config';

// EAS project id from `eas init` — set once you've linked this app to your EAS project.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'REPLACE_WITH_EAS_PROJECT_ID';
const IOS_BUNDLE_IDENTIFIER = process.env.IOS_BUNDLE_IDENTIFIER ?? 'com.lina.companion';

const config: ExpoConfig = {
  name: 'Lina',
  slug: 'lina',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'lina',
  ios: {
    bundleIdentifier: IOS_BUNDLE_IDENTIFIER,
    supportsTablet: false,
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Lina listens to what you say so she can reply — audio is transcribed entirely on this device and never leaves it.',
      NSSpeechRecognitionUsageDescription:
        'On-device speech recognition turns your voice into text for Lina to respond to.',
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#16181d',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-dev-client',
    'expo-asset',
    'expo-audio',
    [
      'llama.rn',
      {
        enableEntitlements: false,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.4',
        },
      },
    ],
  ],
  // EAS Update (OTA): runtimeVersion tied to the app version means any JS/OTA
  // update is only offered to installed binaries with a matching native version,
  // so JS-only changes ship instantly while native/model changes still require
  // a new store build.
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
};

export default config;
