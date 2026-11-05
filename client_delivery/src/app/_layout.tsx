import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeliveryAuthProvider, useDeliveryAuth } from '../context/DeliveryAuthContext';
import DeliveryLoginScreen from '../screens/DeliveryLoginScreen';
import { DeliveryLoadingScreen } from '../components/DeliveryLoadingScreen';
import { ServerConnection } from '../components/ServerConnection';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);
  return <SafeAreaProvider><DeliveryAuthProvider><StatusBar style={loading ? 'light' : 'dark'} /><View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} pointerEvents={loading ? 'none' : 'auto'} accessibilityElementsHidden={loading} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}><ServerConnection><DeliveryGate /></ServerConnection></View>
    {loading ? <DeliveryLoadingScreen onFinish={finishLoading} /> : null}
  </View></DeliveryAuthProvider></SafeAreaProvider>;
}

function DeliveryGate() {
  const { partner } = useDeliveryAuth();
  return partner ? <Stack screenOptions={{ headerShown: false }} /> : <DeliveryLoginScreen />;
}
