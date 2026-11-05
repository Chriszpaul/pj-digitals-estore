import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServerConnection } from '../components/ServerConnection';

export default function RootLayout() {
  return <SafeAreaProvider><StatusBar style="dark" /><ServerConnection><Stack screenOptions={{ headerShown: false }} /></ServerConnection></SafeAreaProvider>;
}
