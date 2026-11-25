import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
// Snapshot estável no servidor; tema do dispositivo após hidratação.
export function useColorScheme() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const scheme = useRNColorScheme();
  return hydrated ? scheme : 'light';
}
