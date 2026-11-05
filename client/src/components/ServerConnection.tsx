import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { checkServer } from '../lib/api';
import { useStoreTheme } from '../features/storefront/ThemeContext';

type Connection = 'checking' | 'connected' | 'offline';
export function ServerConnection({ children }: PropsWithChildren) {
  const { palette } = useStoreTheme();
  const [status, setStatus] = useState<Connection>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    async function refresh() {
      if (controller || (AppState.currentState && AppState.currentState !== 'active')) return;
      const request = new AbortController();
      controller = request;
      try { await checkServer(request.signal); if (active) setStatus('connected'); }
      catch { if (active) setStatus('offline'); }
      finally { if (controller === request) controller = null; }
    }
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; controller?.abort(); clearInterval(timer); listener.remove(); };
  }, [attempt]);
  const label = status === 'connected' ? 'Server reachable' : status === 'checking' ? 'Connecting to server…' : 'Server unavailable';
  return <View style={[styles.root, { backgroundColor: palette.surface }]}>
    <View style={styles.content}>{children}</View>
    <View style={[styles.bar, { borderTopColor: palette.border }]}>
      <Text accessibilityLiveRegion="polite" style={[styles.label, { color: status === 'offline' ? palette.terracotta : palette.primaryText }]}>{label}</Text>
      {status === 'offline' ? <Pressable accessibilityRole="button" accessibilityLabel="Retry server connection" onPress={() => { setStatus('checking'); setAttempt(value => value + 1); }} style={styles.retry}><Text style={[styles.retryText, { color: palette.primaryText }]}>Retry</Text></Pressable> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFDF7' },
  content: { flex: 1 },
  bar: { minHeight: 32, paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#EFD4A7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' },
  label: { color: '#B9470B', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  offline: { color: '#B73E24' },
  retry: { minHeight: 32, paddingHorizontal: 10, justifyContent: 'center' },
  retryText: { color: '#B9470B', fontSize: 11, fontWeight: '700' },
});
