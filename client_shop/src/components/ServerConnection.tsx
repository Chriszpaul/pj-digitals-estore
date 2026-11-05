import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { checkServer } from '../lib/api';

type Connection = 'checking' | 'connected' | 'offline';
export function ServerConnection({ children }: PropsWithChildren) {
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
  const label = status === 'connected' ? 'Server connected · Preview data' : status === 'checking' ? 'Connecting to server…' : 'Server unavailable · Preview data';
  return <View style={styles.root}>
    <View style={styles.content}>{children}</View>
    <View style={styles.bar}>
      <Text accessibilityLiveRegion="polite" style={[styles.label, status === 'offline' && styles.offline]}>{label}</Text>
      {status === 'offline' ? <Pressable accessibilityRole="button" accessibilityLabel="Retry server connection" onPress={() => { setStatus('checking'); setAttempt(value => value + 1); }} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFCF4' },
  content: { flex: 1 },
  bar: { minHeight: 32, paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#DBCEAD', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' },
  label: { color: '#174E3C', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  offline: { color: '#A95237' },
  retry: { minHeight: 32, paddingHorizontal: 10, justifyContent: 'center' },
  retryText: { color: '#174E3C', fontSize: 11, fontWeight: '700' },
});
