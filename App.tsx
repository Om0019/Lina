import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { CompanionScreen } from './src/screens/CompanionScreen';

function UpdatesDebugBar() {
  const [checkResult, setCheckResult] = useState('checking…');

  useEffect(() => {
    Updates.checkForUpdateAsync()
      .then((result) => setCheckResult(JSON.stringify(result)))
      .catch((err) => setCheckResult(`error: ${err instanceof Error ? err.message : String(err)}`));
  }, []);

  return (
    <View style={styles.debugBar} pointerEvents="none">
      <Text style={styles.debugText}>
        embedded={String(Updates.isEmbeddedLaunch)} id={Updates.updateId ?? 'none'} ch={Updates.channel ?? 'none'}{' '}
        created={Updates.createdAt?.toISOString() ?? 'none'}
      </Text>
      <Text style={styles.debugText}>check={checkResult}</Text>
    </View>
  );
}

export default function App() {
  return (
    <>
      <CompanionScreen />
      <UpdatesDebugBar />
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  debugBar: {
    position: 'absolute',
    top: 50,
    left: 8,
    right: 8,
  },
  debugText: {
    fontSize: 9,
    color: '#4a8a4a',
    fontFamily: 'Courier',
  },
});
