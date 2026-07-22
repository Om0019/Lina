import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { CompanionFace } from '../components/CompanionFace';
import { MicButton } from '../components/MicButton';
import { useCompanion } from '../hooks/useCompanion';

export function CompanionScreen() {
  const { state, setup, toggleRecording } = useCompanion();

  useEffect(() => {
    void setup();
    // Runs once on mount — models are cached after the first successful download.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isReady = state.setupStage === 'ready';

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.content}>
        {!isReady && (
          <Text style={styles.setupHint}>
            First launch only — Lina downloads her on-device brain, ears, and voice (~1GB) once, then works fully
            offline.
          </Text>
        )}

        <CompanionFace expression={state.expression} />

        {!isReady && (
          <View style={styles.progressRow}>
            <ActivityIndicator color="#7fd1ff" />
            <Text style={styles.progressText}>{Math.round(state.setupFraction * 100)}%</Text>
          </View>
        )}

        {!!state.transcript && <Text style={styles.transcript}>{state.transcript}</Text>}
        {!!state.reply && <Text style={styles.reply}>{state.reply}</Text>}

        <MicButton isRecording={state.isRecording} disabled={!isReady} onPress={toggleRecording} />

        <Text style={styles.status}>{state.statusText}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#16181d',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 14,
  },
  setupHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    maxWidth: 320,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    color: '#8a8f9a',
    fontSize: 13,
  },
  transcript: {
    fontSize: 15,
    color: '#d7dae0',
    textAlign: 'center',
    maxWidth: 340,
  },
  reply: {
    fontSize: 14,
    color: '#7fd1ff',
    textAlign: 'center',
    maxWidth: 340,
  },
  status: {
    fontSize: 13,
    color: '#8a8f9a',
    textAlign: 'center',
    maxWidth: 320,
    minHeight: 18,
  },
});
