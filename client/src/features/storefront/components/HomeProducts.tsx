import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useStoreTheme } from '../ThemeContext';
import { getStore, money } from '../data/catalog';
import type { Product } from '../data/types';
import ProductPhoto from './ProductPhoto';
import Text from './AppText';

export default function HomeProducts({ products, onOpen }: { products: Product[]; onOpen: (product: Product) => void }) {
  const { palette } = useStoreTheme();
  const items = products;
  const pages: Product[][] = [];
  for (let index = 0; index < items.length; index += 2) pages.push(items.slice(index, index + 2));
  const count = pages.length;
  const slides = count > 1 ? [pages[count - 1], ...pages, pages[0]] : pages;
  const [offset] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const [moving, setMoving] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const position = useRef(1);
  const locked = useRef(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; motion.remove(); };
  }, []);
  useEffect(() => {
    const start = count > 1 ? 1 : 0;
    position.current = start;
    locked.current = false;
    offset.setValue(-start * width);
    setActive(0);
    setMoving(false);
    return () => offset.stopAnimation();
  }, [offset, width, count]);

  function move(step: number) {
    if (!width || count < 2 || locked.current) return;
    locked.current = true;
    setMoving(true);
    const next = position.current + step;
    Animated.timing(offset, {
      toValue: -next * width, duration: reduceMotion ? 0 : 550,
      easing: Easing.inOut(Easing.cubic), useNativeDriver: true, isInteraction: false,
    }).start(({ finished }) => {
      if (!finished) return;
      const normalized = next === 0 ? count : next === count + 1 ? 1 : next;
      if (normalized !== next) offset.setValue(-normalized * width);
      position.current = normalized;
      setActive(normalized - 1);
      locked.current = false;
      setMoving(false);
    });
  }

  if (!count) return null;
  return <View style={{ marginTop: 12, marginBottom: 16 }}>
    <View style={s.heading}><View style={{ flex: 1 }}><Text style={[s.title, { color: palette.text }]}>Local finds for you</Text><Text style={[s.subtitle, { color: palette.muted }]}>Use the arrows to discover what’s NearBy.</Text></View></View>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ overflow: 'hidden', borderRadius: 20, backgroundColor: palette.soft }}>
      {width > 0 ? <Animated.View style={{ width: width * slides.length, flexDirection: 'row', transform: [{ translateX: offset }] }}>
        {slides.map((page, index) => <View key={`page-${index}`} style={{ width, padding: 4 }} accessibilityElementsHidden={count > 1 && index !== active + 1} importantForAccessibility={count > 1 && index !== active + 1 ? 'no-hide-descendants' : 'auto'}>
          <View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {page.map(product => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`View ${product.name}, ${money(product.price)}`} onPress={() => onOpen(product)} style={[s.card, { flex: 1, minWidth: 0, backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={{ height: width >= 650 ? 105 : 84, padding: 5 }}><ProductPhoto product={product} /></View>
                <View style={{ paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 }}><Text numberOfLines={1} style={[s.kicker, { color: palette.gold }]}>{product.category.toUpperCase()}</Text><Text numberOfLines={2} style={[s.product, { color: palette.text, minHeight: 34 }]}>{product.name}</Text><Text numberOfLines={1} style={[s.subtitle, { color: palette.muted }]}>{getStore(product.store).name}</Text><View style={s.priceRow}><Text style={[s.price, { color: palette.primaryText }]}>{money(product.price)}</Text><Text style={{ color: palette.muted, fontSize: 10 }}>★ {product.rating}</Text></View><Text style={[s.link, { color: palette.primaryText }]}>{product.stock === 0 ? 'Out of stock · View →' : 'View product →'}</Text></View>
              </Pressable>)}
              {page.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          </View>
        </View>)}
      </Animated.View> : null}
      {count > 1 ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous product pair" disabled={moving} accessibilityState={{ disabled: moving }} onPress={() => move(-1)} style={[s.control, s.edgeArrow, { left: 4, borderColor: palette.border, backgroundColor: palette.surface, opacity: moving ? 0.6 : 0.96 }]}><Text style={{ color: palette.primaryText, fontSize: 20 }}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next product pair" disabled={moving} accessibilityState={{ disabled: moving }} onPress={() => move(1)} style={[s.control, s.edgeArrow, { right: 4, borderColor: palette.border, backgroundColor: palette.surface, opacity: moving ? 0.6 : 0.96 }]}><Text style={{ color: palette.primaryText, fontSize: 20 }}>›</Text></Pressable>
      </> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800' }, subtitle: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  control: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { boxShadow: '0px 3px 8px rgba(64, 35, 94, 0.14)', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  kicker: { fontSize: 8, fontWeight: '800', letterSpacing: 0.6 }, product: { fontSize: 13, lineHeight: 17, fontWeight: '800', marginTop: 3 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 4 }, price: { fontSize: 16, fontWeight: '800' }, link: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  edgeArrow: { position: 'absolute', top: 28, zIndex: 2, width: 44, height: 44, borderRadius: 22, paddingHorizontal: 0 },
});
