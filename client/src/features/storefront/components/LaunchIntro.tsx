import { useEffect, useRef, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LaunchIntro({ transition: exit }: { transition: Animated.Value }) {
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const entrance = useRef(new Animated.Value(0)).current;
  const loading = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;
    const finish = () => { if (mounted) { exit.setValue(1); setVisible(false); } };
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted) return;
      if (reduced) { finish(); return; }
      animation = Animated.parallel([
        Animated.timing(loading, { toValue: 1, duration: 3550, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
        Animated.sequence([
        Animated.timing(entrance, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
        Animated.delay(2700),
        Animated.timing(exit, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
        ]),
      ]);
      animation.start(({ finished }) => { if (finished) finish(); });
    }).catch(finish);
    return () => { mounted = false; animation?.stop(); };
  }, [entrance, exit, loading]);

  if (!visible) return null;
  return <Animated.View style={[styles.overlay, { transform: [{ translateX: exit.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }] }]} accessibilityViewIsModal accessibilityLabel="Welcome to NearBy">
    <LinearGradient colors={['#F3EBFF', '#DDC7F5', '#C7A5E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Animated.View style={[styles.center, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <View style={styles.halo}><BrandLogo size={100} /></View>
      <Text style={styles.name}>NearBy</Text>
      <Text style={styles.local}>YOUR LOCAL MARKETPLACE</Text>
      <Text style={styles.tagline}>Your town. Your shops. Your doorstep.</Text>
    </Animated.View>
    <View style={styles.footer}>
      <Text style={styles.loadingLabel}>GETTING YOUR STORE READY</Text>
      <View style={styles.loadingTrack}><Animated.View style={[styles.loadingBar, { transform: [{ translateX: loading.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] }) }] }]} /></View>
      <Text style={styles.footerText}>CLOSER TO WHAT YOU LOVE</Text><Text style={styles.delivery}>Local favourites · Delivered within 12 hours</Text>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: '#EEE5F8', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', paddingHorizontal: 24 }, halo: { borderWidth: 1, borderColor: 'rgba(85,67,15,0.22)', borderRadius: 50, padding: 9 },
  logo: { boxShadow: '0px 6px 20px rgba(77, 43, 112, 0.16)', width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: '#AA85CC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#30243F', fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  name: { color: '#30243F', fontSize: 36, fontWeight: '600', marginTop: 22, letterSpacing: -1 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 17 }, line: { width: 43, height: 1, backgroundColor: '#AA85CC' }, flower: { color: '#7042B8', fontSize: 18 },
  local: { color: '#7042B8', fontSize: 9, fontWeight: '800', letterSpacing: 2.3, marginTop: 18 }, tagline: { color: '#665071', fontSize: 12, marginTop: 10, textAlign: 'center' },
  loadingLabel: { color: '#665071', fontSize: 8, letterSpacing: 1.2, marginBottom: 10 },
  loadingTrack: { width: 220, height: 4, borderRadius: 4, backgroundColor: '#D7C6E9', marginBottom: 25, overflow: 'hidden' }, loadingBar: { width: '100%', height: 4, borderRadius: 4, backgroundColor: '#7042B8' },
  footer: { position: 'absolute', bottom: 45, alignItems: 'center', paddingHorizontal: 20 }, footerText: { color: '#7042B8', fontSize: 8, letterSpacing: 2, fontWeight: '700' }, delivery: { color: '#665071', fontSize: 10, marginTop: 8 },
});
