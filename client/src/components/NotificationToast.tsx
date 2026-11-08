import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';
import { useStoreTheme } from '../features/storefront/ThemeContext';

function NotificationCard({ text1, text2, type, hide }: ToastConfigParams<unknown>) {
  const { palette: c } = useStoreTheme();
  const accent = type === 'error' ? c.terracotta : c.primary;
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: accent }]}>
    <View style={[styles.icon, { backgroundColor: c.soft }]}><Text style={{ color: accent, fontSize: 18, fontWeight: '800' }}>{type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</Text></View>
    <View accessible accessibilityRole="alert" accessibilityLiveRegion={type === 'error' ? 'assertive' : 'polite'} accessibilityLabel={`${text1 ?? ''}. ${text2 ?? ''}`} style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: c.text, fontSize: 14, fontWeight: '800' }}>{text1}</Text>
      {text2 ? <Text numberOfLines={5} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{text2}</Text> : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={() => hide()} style={styles.close}><Text style={{ color: c.muted, fontSize: 23 }}>×</Text></Pressable>
  </View>;
}

const config: ToastConfig = {
  success: props => <NotificationCard {...props} />,
  error: props => <NotificationCard {...props} />,
  info: props => <NotificationCard {...props} />,
};

export default function NotificationToast() {
  const insets = useSafeAreaInsets();
  return <Toast config={config} position="top" topOffset={insets.top + 12} swipeable autoHide />;
}

const styles = StyleSheet.create({
  card: { width: '92%', maxWidth: 480, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderLeftWidth: 4, borderRadius: 16, boxShadow: '0px 6px 22px rgba(35, 24, 58, 0.18)' },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
