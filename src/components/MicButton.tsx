import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function MicButton({
  isRecording,
  disabled,
  onPress,
}: {
  isRecording: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isRecording && styles.listening,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.icon}>{isRecording ? '■' : '🎤'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#3a6df0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3a6df0',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  listening: {
    backgroundColor: '#ef4b6b',
    shadowColor: '#ef4b6b',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  icon: {
    fontSize: 28,
    color: 'white',
  },
});
