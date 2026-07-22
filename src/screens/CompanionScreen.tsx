import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { CompanionFace } from '../components/CompanionFace';
import { MicButton } from '../components/MicButton';
import { useCompanion } from '../hooks/useCompanion';

export function CompanionScreen() {
  const { state, setup, toggleRecording, cycleVoice } = useCompanion();

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

        <View style={styles.faceFloat}>
          <CompanionFace expression={state.expression} />
        </View>

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

        <View style={styles.voicePicker}>
          <Pressable onPress={() => cycleVoice(-1)} hitSlop={10} style={styles.voiceArrow}>
            <Text style={styles.voiceArrowText}>‹</Text>
          </Pressable>
          <Text style={styles.voiceLabel}>Voice #{state.voiceSid}</Text>
          <Pressable onPress={() => cycleVoice(1)} hitSlop={10} style={styles.voiceArrow}>
            <Text style={styles.voiceArrowText}>›</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  faceFloat: {
    shadowColor: '#5fd0ff',
    shadowOpacity: 0.45,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
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
  voicePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceArrow: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  voiceArrowText: {
    fontSize: 20,
    color: '#7fd1ff',
  },
  voiceLabel: {
    fontSize: 13,
    color: '#8a8f9a',
    minWidth: 84,
    textAlign: 'center',
  },
});
