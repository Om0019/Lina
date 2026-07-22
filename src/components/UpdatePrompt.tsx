import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  isUpdating: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
};

export function UpdatePrompt({ visible, isUpdating, onUpdate, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.message}>A new version of Lina is ready. Update now to get the latest improvements.</Text>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onDismiss} disabled={isUpdating} hitSlop={4}>
              <Text style={styles.secondaryText}>Not Now</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={onUpdate} disabled={isUpdating} hitSlop={4}>
              {isUpdating ? (
                <ActivityIndicator color="#00131a" />
              ) : (
                <Text style={styles.primaryText}>Update Now</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#16181d',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#242830',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f4f7',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#8a8f9a',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20242c',
  },
  secondaryText: {
    color: '#c3c8d1',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7fd1ff',
  },
  primaryText: {
    color: '#00131a',
    fontSize: 14,
    fontWeight: '600',
  },
});
