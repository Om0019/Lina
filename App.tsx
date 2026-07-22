import { StatusBar } from 'expo-status-bar';

import { UpdatePrompt } from './src/components/UpdatePrompt';
import { useAppUpdate } from './src/hooks/useAppUpdate';
import { CompanionScreen } from './src/screens/CompanionScreen';

export default function App() {
  const { isVisible, isUpdating, applyUpdate, dismiss } = useAppUpdate();

  return (
    <>
      <CompanionScreen />
      <UpdatePrompt visible={isVisible} isUpdating={isUpdating} onUpdate={applyUpdate} onDismiss={dismiss} />
      <StatusBar style="light" />
    </>
  );
}
