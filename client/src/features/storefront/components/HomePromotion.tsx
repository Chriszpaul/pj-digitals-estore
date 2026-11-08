import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import BrandLogo from '@/components/BrandLogo';
import Text from './AppText';
import InterfaceIcon from './InterfaceIcon';

export const homePromotions = [
  { eyebrow: 'YOUR TOWN. YOUR TIME.', title: 'At your door.\nWithin 12 hours.', copy: 'Your local favourites, delivered home. Discover a closer way to shop with NearBy.', action: 'Start shopping', stamp: '12 hr', caption: 'HOME DELIVERY', note: 'Closer shops. Quicker days.', colors: ['#F0E4FF', '#DCE8FF', '#D8D4FF'], ink: '#39235F', accent: '#6740BB' },
  { eyebrow: 'GOOD FINDS. GREAT VALUE.', title: 'Big on offers.\nClose to home.', copy: 'Discover our best offers from local shops. Make room for more of what you love.', action: 'Explore the catalogue', stamp: 'BEST', caption: 'OFFERS', note: 'A little more joy in every cart.', colors: ['#FFF1DE', '#FCE4E9', '#EADDFB'], ink: '#513056', accent: '#7941A4' },
  { eyebrow: 'LOCAL SHOPS. ONE NEARBY.', title: 'Your favourites.\nAll together.', copy: 'Electronics, textiles, bakery and more. Find your everyday picks in one place.', action: 'Find your favourites', stamp: 'LOCAL', caption: 'FINDS', note: 'Your neighbourhood, in your pocket.', colors: ['#E0F5F4', '#DDEBFF', '#E5DDFB'], ink: '#253B62', accent: '#4758AA' },
  { eyebrow: 'LESS RUNNING AROUND.', title: 'Shop from home.\nWe bring it closer.', copy: 'Browse local finds, enjoy our best offers and get home delivery within 12 hours.', action: 'Shop with NearBy', stamp: '12 hr', caption: 'TO YOUR DOOR', note: 'More time for the things you love.', colors: ['#F6E4F4', '#EDE4FF', '#DCE8FF'], ink: '#402A60', accent: '#7042B8' },
] as const;

type Promotion = typeof homePromotions[number];

export default function HomePromotion({ promotion: ad, desktop, onShop }: { promotion: Promotion; desktop: boolean; onShop: () => void }) {
  return <LinearGradient colors={ad.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, desktop && styles.desktopBanner]}>
    <View pointerEvents="none" style={[styles.orbit, { borderColor: ad.accent + '20' }]} />
    <View pointerEvents="none" style={[styles.orbit, styles.innerOrbit, { borderColor: ad.accent + '20' }]} />
    <View style={[styles.copy, desktop && styles.desktopCopy]}>
      <Text style={[styles.eyebrow, { color: ad.accent }]}>{ad.eyebrow}</Text>
      <Text style={[styles.title, desktop && styles.desktopTitle, { color: ad.ink }]}>{ad.title}</Text>
      <Text style={[styles.description, desktop && styles.desktopDescription, { color: ad.ink }]}>{ad.copy}</Text>
      <Pressable onPress={onShop} accessibilityRole="button" accessibilityLabel={ad.action} style={({ pressed }) => [styles.button, { backgroundColor: ad.accent, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={styles.buttonText}>{ad.action}</Text><Text style={styles.arrow}>→</Text>
      </Pressable>
      {desktop ? <Text style={[styles.note, { color: ad.ink }]}>{ad.note}</Text> : null}
    </View>
    <View pointerEvents="none" style={[styles.stamp, desktop && styles.desktopStamp]}>
      {desktop ? <View style={[styles.bag, { backgroundColor: ad.accent }]}><InterfaceIcon name="bag" size={52} color="#FFFFFF" /></View> : null}
      <Text style={[styles.stampValue, desktop && styles.desktopStampValue, { color: ad.accent }]}>{ad.stamp}</Text>
      <Text style={[styles.stampCaption, desktop && styles.desktopStampCaption, { color: ad.ink }]}>{ad.caption}</Text>
      {desktop ? <View style={styles.brand}><BrandLogo size={32} /><Text style={[styles.brandName, { color: ad.ink }]}>NearBy</Text></View> : null}
    </View>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  banner: { minHeight: 235, borderRadius: 22, overflow: 'hidden', padding: 20, borderWidth: 1, borderColor: '#DDD3F0', justifyContent: 'center' },
  desktopBanner: { minHeight: 320, padding: 36, borderRadius: 24 },
  copy: { zIndex: 1 },
  desktopCopy: { width: '65%', maxWidth: 650 },
  eyebrow: { fontSize: 8, lineHeight: 12, fontWeight: '800', letterSpacing: 1.2, paddingRight: 70 },
  title: { fontSize: 25, lineHeight: 29, fontWeight: '900', letterSpacing: -0.7, marginTop: 12, paddingRight: 56 },
  desktopTitle: { fontSize: 42, lineHeight: 47, marginTop: 14, paddingRight: 0 },
  description: { fontSize: 12, lineHeight: 18, marginTop: 10, maxWidth: 400 },
  desktopDescription: { fontSize: 14, lineHeight: 22, maxWidth: 480 },
  button: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 18, minHeight: 40, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  arrow: { color: '#FFFFFF', fontSize: 18, lineHeight: 20 },
  note: { fontSize: 10, marginTop: 12, opacity: 0.8 },
  orbit: { position: 'absolute', width: 390, height: 390, borderRadius: 195, borderWidth: 1, right: -210, top: -90 },
  innerOrbit: { width: 280, height: 280, borderRadius: 140, right: -155, top: -35 },
  stamp: { position: 'absolute', top: 20, right: 16, width: 66, minHeight: 66, paddingVertical: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: '#FFFFFF', transform: [{ rotate: '5deg' }] },
  desktopStamp: { width: 190, minHeight: 228, right: 65, top: 46, borderRadius: 30, padding: 20 },
  stampValue: { fontSize: 19, fontWeight: '900', letterSpacing: -0.8 },
  desktopStampValue: { fontSize: 40, marginTop: 12 },
  stampCaption: { fontSize: 6, fontWeight: '800', letterSpacing: 0.4, marginTop: 3 },
  desktopStampCaption: { fontSize: 9, letterSpacing: 1 },
  bag: { width: 74, height: 74, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  brandName: { fontSize: 14, fontWeight: '900' },
});
