import { StatusBar } from 'expo-status-bar';

import { CompanionScreen } from './src/screens/CompanionScreen';

export default function App() {
  return (
    <>
      <CompanionScreen />
      <StatusBar style="light" />
    </>
  );
}
