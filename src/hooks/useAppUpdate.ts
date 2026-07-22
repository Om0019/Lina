import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type AppUpdateStatus = 'idle' | 'checking' | 'available' | 'updating' | 'error';

export function useAppUpdate() {
  const [status, setStatus] = useState<AppUpdateStatus>('idle');
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || checkingRef.current) return;

    checkingRef.current = true;
    setStatus('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      setStatus(result.isAvailable ? 'available' : 'idle');
    } catch {
      setStatus('idle');
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void checkForUpdate();

    const onAppStateChange = (next: AppStateStatus) => {
      // Re-check on resume — an OTA update may have been published while backgrounded.
      // A "Not Now" dismissal still holds for the rest of this session.
      if (next === 'active') void checkForUpdate();
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [checkForUpdate]);

  const applyUpdate = useCallback(async () => {
    setStatus('updating');
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setStatus('error');
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    isVisible: status === 'available' && !dismissed,
    isUpdating: status === 'updating',
    applyUpdate,
    dismiss,
  };
}
