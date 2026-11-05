import { Tabs, usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerLoadingScreen } from '../components/PartnerLoadingScreen';
import { ShopDataProvider } from '../context/ShopDataContext';
import { ShopAuthProvider, useShopAuth } from '../context/ShopAuthContext';
import { ShopLoginScreen } from '../screens/ShopLoginScreen';
import { ServerConnection } from '../components/ServerConnection';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const tabs: Array<{ route: string; title: string; icon: IconName }> = [
  { route: 'index', title: 'Home', icon: 'view-dashboard-outline' },
  { route: 'orders', title: 'Orders', icon: 'receipt-text-outline' },
  { route: 'deliveries', title: 'Deliveries', icon: 'truck-delivery-outline' },
  { route: 'products', title: 'Products', icon: 'tag-multiple-outline' },
  { route: 'advertisements', title: 'Advertisements', icon: 'bullhorn-outline' },
  { route: 'inventory', title: 'Stock status', icon: 'cube-outline' },
  { route: 'store', title: 'Profile', icon: 'storefront-outline' },
];

export default function ShopLayout() {
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);
  return <ShopAuthProvider><View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} pointerEvents={loading ? 'none' : 'auto'} accessibilityElementsHidden={loading} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}><ServerConnection><ShopNavigation /></ServerConnection></View>
    {loading ? <PartnerLoadingScreen onFinish={finishLoading} /> : null}
  </View></ShopAuthProvider>;
}

function ShopNavigation() {
  const { account, logout } = useShopAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  if (!account) return <ShopLoginScreen />;
  return <ShopDataProvider><Tabs screenOptions={{ headerShown: true, tabBarStyle: { display: 'none' }, header: () => <SafeAreaView edges={['top', 'left', 'right']} style={menuStyles.topBar}>
    <View style={menuStyles.topContent}>
      <View style={menuStyles.logo}><Text style={menuStyles.logoText}>T</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={menuStyles.eyebrow} numberOfLines={1}>TDP STORE · PARTNER</Text><Text style={menuStyles.topShop} numberOfLines={1}>{account.shopName}</Text></View>
      <Pressable accessibilityLabel="Open navigation menu" accessibilityRole="button" onPress={() => setMenuOpen(true)} style={menuStyles.menuButton}><MaterialCommunityIcons name="menu" size={25} color="#174E3C" /></Pressable>
    </View>
  </SafeAreaView> }}>
    {tabs.map(({ route, title, icon }) => <Tabs.Screen key={route} name={route} options={{ title, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={icon} color={color} size={size} /> }} />)}
  </Tabs><RightMenu open={menuOpen} close={() => setMenuOpen(false)} shopName={account.shopName} active={pathname.split('/').pop() || 'index'} navigate={(route) => { setMenuOpen(false); router.navigate((route === 'index' ? '/' : `/${route}`) as Href); }} logout={() => { setMenuOpen(false); logout(); }} /></ShopDataProvider>;
}

function RightMenu({ open, close, shopName, active, navigate, logout }: { open: boolean; close: () => void; shopName: string; active: string; navigate: (route: string) => void; logout: () => void }) {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(350, width * 0.88);
  const [slide] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!open) { slide.setValue(1); return; }
    const animation = Animated.timing(slide, { toValue: 0, duration: 240, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [open, slide]);
  return <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
    <View style={menuStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close navigation menu" accessibilityRole="button" />
      <Animated.View style={[menuStyles.panel, { width: panelWidth, transform: [{ translateX: Animated.multiply(slide, panelWidth) }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={menuStyles.heading}><View style={{ flex: 1 }}><Text style={menuStyles.eyebrow}>TDP STORE · PARTNER</Text><Text style={menuStyles.shop}>{shopName}</Text></View><Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={close} style={{ padding: 10 }}><MaterialCommunityIcons name="close" size={24} color="#173D32" /></Pressable></View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {tabs.map(tab => <Pressable key={tab.route} accessibilityRole="button" accessibilityState={{ selected: active === tab.route }} onPress={() => navigate(tab.route)} style={[menuStyles.item, active === tab.route && menuStyles.selected]}>
              <MaterialCommunityIcons name={tab.icon} size={22} color={active === tab.route ? '#FFFCF4' : '#174E3C'} />
              <Text style={[menuStyles.label, active === tab.route && { color: '#FFFCF4' }]}>{tab.title}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={active === tab.route ? '#E1C68A' : '#9A702A'} />
            </Pressable>)}
          </ScrollView>
          <View style={menuStyles.footer}><Pressable accessibilityRole="button" onPress={logout} style={menuStyles.item}><MaterialCommunityIcons name="logout" color="#A95237" size={22} /><Text style={[menuStyles.label, { color: '#A95237' }]}>Log out</Text></Pressable><Text style={menuStyles.location}>LOCAL ROOTS. NEW POSSIBILITIES.</Text></View>
        </SafeAreaView>
      </Animated.View>
    </View>
  </Modal>;
}

const menuStyles = StyleSheet.create({
  topBar: { backgroundColor: '#FFFCF4', borderBottomWidth: 1, borderBottomColor: '#DBCEAD' },
  topContent: { width: '100%', maxWidth: 1120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 72 },
  logo: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#E5E9DC', borderWidth: 1, borderColor: '#DBCEAD', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#174E3C', fontWeight: '800', fontSize: 22 },
  topShop: { color: '#173D32', fontSize: 14, fontWeight: '600', marginTop: 5 },
  menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F5F0E4' },
  overlay: { flex: 1, backgroundColor: 'rgba(12,30,24,0.4)', alignItems: 'flex-end' },
  panel: { height: '100%', backgroundColor: '#FFFCF4', borderLeftWidth: 3, borderLeftColor: '#CFAC65' },
  heading: { flexDirection: 'row', alignItems: 'center', padding: 22, borderBottomWidth: 1, borderBottomColor: '#DBCEAD' },
  eyebrow: { fontSize: 10, letterSpacing: 1.3, color: '#9A702A', fontWeight: '800' },
  shop: { color: '#173D32', fontSize: 20, fontWeight: '700', marginTop: 9 },
  item: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center', borderRadius: 12 },
  selected: { backgroundColor: '#174E3C' },
  label: { flex: 1, fontSize: 14, color: '#173D32', fontWeight: '600' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#DBCEAD' },
  location: { color: '#697568', fontSize: 9, letterSpacing: 1, textAlign: 'center', marginTop: 15, marginBottom: 10 },
});
