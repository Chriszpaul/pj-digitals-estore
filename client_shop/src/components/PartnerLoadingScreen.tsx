import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export function PartnerLoadingScreen({ onFinish }: { onFinish: () => void }) {
  const { height } = useWindowDimensions();
  const compact = height < 620;
  const [entrance] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      if (reduced) { onFinish(); return; }
      animation = Animated.parallel([
        Animated.timing(entrance, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
        Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 3550, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
        Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true, isInteraction: false }),
        ]),
      ]);
      animation.start(({ finished }) => { if (active && finished) onFinish(); });
    }).catch(() => { if (active) onFinish(); });
    return () => { active = false; animation?.stop(); };
  }, [entrance, fade, onFinish, progress]);
  return <Animated.View style={[s.screen, { opacity: fade }]} accessibilityViewIsModal>
    <View style={[s.trim, { top: 20 }]} />
    <View style={s.circle} />
    <Animated.View style={[s.brand, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      <View style={[s.mark, compact && { width: 64, height: 64, marginBottom: 14 }]}><Text style={s.monogram}>TDP</Text></View>
      <Text style={[s.title, compact && { fontSize: 30 }]}>TDP Store</Text>
      <Text style={s.partner}>PARTNER</Text>
      <View style={[s.divider, compact && { marginVertical: 14 }]} />
      <Text style={s.tagline}>Local roots. New possibilities.</Text>
      <Text style={s.subtitle}>Your shop, ready for the neighbourhood.</Text>
    </Animated.View>
    <View style={[s.footer, compact && { bottom: 38 }]}>
      <Text style={s.label}>OPENING YOUR PARTNER PORTAL</Text>
      <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel="Loading partner portal">
        <Animated.View style={[s.fill, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] }) }] }]} />
      </View>
      <Text style={s.location}>THODUPUZHA · MUTTOM · KERALA</Text>
    </View>
    <View style={[s.trim, { bottom: 20 }]} />
  </Animated.View>;
}

const s = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: '#123D31', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  trim: { position: 'absolute', left: 20, right: 20, height: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#CFAC65' },
  circle: { position: 'absolute', width: 330, height: 330, borderRadius: 165, borderWidth: 1, borderColor: '#285344' },
  brand: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 60 },
  mark: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#F8F0DE', borderWidth: 3, borderColor: '#CFAC65', alignItems: 'center', justifyContent: 'center', marginBottom: 23 },
  monogram: { color: '#174E3C', fontSize: 25, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFF9EB', fontFamily: 'serif', fontSize: 38 },
  partner: { color: '#E1C68A', fontSize: 11, fontWeight: '700', letterSpacing: 5, marginTop: 10 },
  divider: { height: 1, width: 42, backgroundColor: '#CFAC65', marginVertical: 25 },
  tagline: { color: '#FFF9EB', fontSize: 16, textAlign: 'center' },
  subtitle: { color: '#BACBBE', fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  footer: { position: 'absolute', bottom: '10%', alignItems: 'center' },
  label: { color: '#E1C68A', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 15 },
  track: { width: 220, height: 3, backgroundColor: '#34594A', borderRadius: 3, overflow: 'hidden' },
  fill: { width: 220, height: 3, backgroundColor: '#E1C68A' },
  location: { color: '#A4BAAB', fontSize: 8, letterSpacing: 1.5, marginTop: 20 },
});
