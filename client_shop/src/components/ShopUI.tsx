import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = { bg: '#F5F0E4', panel: '#FFFCF4', raised: '#E5E9DC', soft: '#E5E9DC', tint: '#F1E2BB', line: '#DBCEAD', text: '#173D32', muted: '#697568', blue: '#174E3C', cyan: '#9A702A', green: '#174E3C', amber: '#9A702A', red: '#A95237' };
export const S = StyleSheet.create({
 page: { flex: 1, backgroundColor: C.bg }, content: { padding: 16, paddingBottom: 24, width: '100%', maxWidth: 1120, alignSelf: 'center' },
 brand: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, mark: { width: 36, height: 36, borderRadius: 9, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
 markText: { color: C.blue, fontSize: 17, fontWeight: '800' }, brandTitle: { color: C.text, fontSize: 12, fontWeight: '800', letterSpacing: .5 }, brandSub: { color: C.muted, fontSize: 11, marginTop: 4 },
 online: { marginLeft: 'auto', backgroundColor: C.soft, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 }, onlineText: { color: C.green, fontSize: 10, fontWeight: '800' },
 title: { color: C.text, fontSize: 23, fontWeight: '800', letterSpacing: -.5 }, subtitle: { color: C.muted, fontSize: 12, marginTop: 6, marginBottom: 15, lineHeight: 18 },
 section: { color: C.text, fontWeight: '800', fontSize: 16, marginTop: 18, marginBottom: 12 }, card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12 },
 row: { flexDirection: 'row', alignItems: 'center' }, spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
 metric: { flexGrow: 1, flexBasis: 145, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 92 },
 metricLabel: { color: C.muted, fontSize: 11, fontWeight: '700' }, metricValue: { color: C.text, fontSize: 22, fontWeight: '800', marginTop: 8 }, metricFoot: { color: C.green, fontSize: 10, marginTop: 4 },
 banner: { borderRadius: 14, padding: 16, marginBottom: 13 }, eyebrow: { color: '#E1C68A', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, bannerTitle: { color: '#FFFCF4', fontSize: 22, fontWeight: '800', marginTop: 8 }, bannerCopy: { color: '#E5E9DC', fontSize: 12, lineHeight: 18, marginTop: 6 },
 btn: { backgroundColor: C.blue, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, btnText: { color: '#FFF', fontSize: 12, fontWeight: '800' }, secondary: { backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, padding: 9, borderRadius: 8, alignItems: 'center' }, secondaryText: { color: C.text, fontWeight: '700', fontSize: 12 },
 dividerRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line }, orderId: { color: C.text, fontSize: 12, fontWeight: '800' }, small: { color: C.muted, fontSize: 11, marginTop: 4 }, price: { color: C.text, fontWeight: '800', fontSize: 12 },
 badge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10, alignSelf: 'flex-start' }, badgeText: { fontSize: 10, fontWeight: '800' },
 chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }, chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line }, chipOn: { backgroundColor: C.blue, borderColor: C.blue }, chipText: { color: C.muted, fontSize: 11, fontWeight: '700' }, chipTextOn: { color: '#FFF' },
 input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, color: C.text, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, fontSize: 12, marginTop: 6, marginBottom: 13 }, label: { color: C.muted, fontSize: 10, fontWeight: '800', marginTop: 3 },
 productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10 }, glyph: { width: 36, height: 36, borderRadius: 7, backgroundColor: '#E4E8ED', alignItems: 'center', justifyContent: 'center' }, glyphText: { color: C.cyan, fontWeight: '800', fontSize: 17 }, name: { color: C.text, fontSize: 12, fontWeight: '800' }, stockNum: { color: C.text, fontSize: 15, minWidth: 25, textAlign: 'center', fontWeight: '800' }, adjust: { backgroundColor: C.raised, width: 29, height: 29, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
 avatar: { width: 34, height: 34, borderRadius: 7, backgroundColor: '#DCE3EB', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#285B91', fontWeight: '800', fontSize: 11 },
 modalShade: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(16,56,42,.45)' }, modal: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
});

export function Page({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
 const [refreshing, setRefreshing] = useState(false);
 const [refreshed, setRefreshed] = useState(false);
 const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
 const refresh = useCallback(() => {
  if (timer.current) return;
  setRefreshing(true); setRefreshed(false);
  // Local preview: preserve current products, stock, ads and filters.
  timer.current = setTimeout(() => {
   setRefreshing(false); setRefreshed(true); timer.current = null;
  }, 650);
 }, []);
 return <SafeAreaView style={S.page} edges={['left', 'right', 'bottom']}><ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never" alwaysBounceVertical refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.green} colors={[C.green]} progressBackgroundColor={C.panel} />}>
  <View style={[S.spread, { gap: 12 }]}>
    <Text style={[S.title, { flex: 1 }]}>{title}</Text>
  </View>
  {refreshed ? <Text accessibilityLiveRegion="polite" style={[S.small, { marginTop: 8 }]}>Demo refreshed · your changes are kept. No live data connected.</Text> : null}
  <Text style={S.subtitle}>{subtitle}</Text>{children}
 </ScrollView></SafeAreaView>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) { return <View style={[S.card, style]}>{children}</View>; }
export function Section({ children }: PropsWithChildren) { return <Text style={S.section}>{children}</Text>; }
export function Button({ label, onPress, secondary = false, style }: { label: string; onPress: () => void; secondary?: boolean; style?: StyleProp<ViewStyle> }) { return <Pressable onPress={onPress} style={[secondary ? S.secondary : S.btn, style]}><Text style={secondary ? S.secondaryText : S.btnText}>{label}</Text></Pressable>; }
const badgeTones: Record<string, [string, string]> = {
  'Awaiting pickup': [C.amber, C.tint], 'Status pending': [C.muted, C.soft],
  New: [C.blue, C.tint], Preparing: [C.amber, C.tint], Ready: [C.cyan, C.soft], Completed: [C.green, C.soft],
  'Low stock': [C.red, '#F4E3D8'], 'Out of stock': [C.red, '#F4E3D8'], 'In stock': [C.green, C.soft], Owner: [C.blue, C.soft],
  'Ready for pickup': [C.cyan, C.soft], 'Picked up': [C.blue, C.tint], 'In transit': [C.amber, C.tint], 'Out for delivery': [C.cyan, C.soft], Delivered: [C.green, C.soft],
 };
export function Badge({ value }: { value: string }) {
 const tone = badgeTones[value] ?? [C.muted, C.raised];
 return <View style={[S.badge, { backgroundColor: tone[1] }]}><Text style={[S.badgeText, { color: tone[0] }]}>{value}</Text></View>;
}
export function Metric({ label, value, foot }: { label: string; value: string; foot: string }) { return <View style={S.metric}><Text style={S.metricLabel}>{label}</Text><Text style={S.metricValue}>{value}</Text><Text style={S.metricFoot}>{foot}</Text></View>; }

