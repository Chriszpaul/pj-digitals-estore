import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

export default function AnimatedAd({ children, count = 3 }: { children: (index: number) => ReactNode; count?: number }) {
  const [index, setIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<-1 | 1>(-1);
  const [width, setWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const slide = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReducedMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useLayoutEffect(() => {
    slide.setValue(0);
    lift.setValue(0);
  }, [index, width, reducedMotion, slideDirection, slide, lift]);

  useEffect(() => {
    if (reducedMotion || !width || count < 2) return;
    const animation = Animated.sequence([
      Animated.delay(300),
      Animated.timing(lift, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
      Animated.delay(900),
      Animated.timing(lift, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
      Animated.delay(300),
      Animated.timing(slide, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true, isInteraction: false }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        setIndex((current) => (current + 1) % count);
        setSlideDirection((current) => current === -1 ? 1 : -1);
      }
    });
    return () => animation.stop();
  }, [count, index, width, reducedMotion, slideDirection, slide, lift]);

  const previous = (index - 1 + count) % count;
  const next = (index + 1) % count;
  const slides = slideDirection === -1 ? [previous, index, next] : [next, index, previous];
  return <View>
    <View style={styles.viewport} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View style={[styles.track, {
        width: width * 3,
        transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-width, slideDirection === -1 ? -width * 2 : 0] }) }],
      }]}>
        {slides.map((adIndex, position) => <View key={position} style={{ width, paddingHorizontal: 4 }} accessibilityElementsHidden={position !== 1} importantForAccessibility={position === 1 ? 'auto' : 'no-hide-descendants'}>
          <Animated.View style={{
            transform: [{ translateY: position === 1 ? lift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) : 0 }],
          }}>
            {children(adIndex)}
          </Animated.View>
        </View>)}
      </Animated.View> : null}
    </View>
    <View style={styles.dots}>{Array.from({ length: count }, (_, dot) => <Pressable key={dot} onPress={() => setIndex(dot)} accessibilityRole="button" accessibilityLabel={`Show advertisement ${dot + 1} of ${count}`} accessibilityState={{ selected: dot === index }} style={styles.dotButton}><View style={[styles.dot, dot === index && styles.activeDot]} /></Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden', paddingTop: 12, paddingBottom: 3 },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dotButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#DED2E9' },
  activeDot: { width: 21, backgroundColor: '#7042B8' },
});
