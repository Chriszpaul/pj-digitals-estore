import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import BrandLogo from '@/components/BrandLogo';
import Text from './AppText';
import InterfaceIcon from './InterfaceIcon';
import { useStoreTheme } from '../ThemeContext';
import { categories, getStore, money } from '../data/catalog';
import type { Product, Tab } from '../data/types';
import ProductPhoto from './ProductPhoto';

type Props = { active: Tab; location: string; products: Product[]; onProduct: (product: Product) => void; cartCount: number; favorites: number; customerName?: string; onNavigate: (tab: Tab) => void; onSearch: (query: string) => void; onLocation: () => void; onAccount: () => void; onMenu: () => void };
export default function WebStoreHeader(props: Props) {
  const { palette: p } = useStoreTheme();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);
  const term = query.trim().toLowerCase();
  const matches = term ? props.products.filter(product => `${product.name} ${product.category} ${getStore(product.store).name}`.toLowerCase().includes(term)).sort((a, b) => Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term))).slice(0, 5) : [];
  function selectProduct(product: Product) { setFocused(false); setHighlighted(-1); setQuery(product.name); props.onProduct(product); }
  function submit() {
    if (focused && highlighted >= 0 && matches[highlighted]) { selectProduct(matches[highlighted]); return; }
    setFocused(false); setHighlighted(-1); props.onSearch(query);
  }
  return <View style={{ zIndex: 20, backgroundColor: p.surface, borderBottomWidth: 1, borderColor: p.border }}>
    <View style={s.main}>
      <Pressable accessibilityRole="button" accessibilityLabel="NearBy home" onPress={() => props.onNavigate('Home')} style={s.brand}><BrandLogo size={52} /><View><Text style={[s.brandName, { color: p.text }]}>NearBy</Text><Text style={[s.small, { color: p.muted }]}>Your local marketplace</Text></View></Pressable>
      <View style={s.searchWrapper}>
        <View style={[s.search, { backgroundColor: p.background, borderColor: focused ? p.primary : p.border }]}><TextInput accessibilityLabel="Search all local products" placeholder="Search products, categories or shops…" placeholderTextColor={p.muted} value={query} onChangeText={value => { setQuery(value); setHighlighted(-1); setFocused(true); }} onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setFocused(true); }} onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 160); }} onKeyPress={event => {
          const key = event.nativeEvent.key;
          if (key === 'Escape') { setFocused(false); setHighlighted(-1); }
          if (key === 'ArrowDown' && matches.length) { setFocused(true); setHighlighted(value => (value + 1) % matches.length); }
          if (key === 'ArrowUp' && matches.length) setHighlighted(value => (value <= 0 ? matches.length - 1 : value - 1));
        }} onSubmitEditing={submit} returnKeyType="search" style={[s.input, { color: p.text }]} />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setQuery(''); setHighlighted(-1); }} style={{ padding: 8 }}><Text style={{ color: p.muted }}>×</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => { setFocused(false); props.onSearch(query); }} style={[s.searchButton, { backgroundColor: p.primary }]}><Text style={{ color: p.onPrimary, fontSize: 12, fontWeight: '700' }}>Search</Text></Pressable>
        </View>
        {focused && term ? <View style={[s.suggestions, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Text style={[s.suggestionHeading, { color: p.muted }]}>PRODUCTS NEAR YOU</Text>
          {matches.length ? matches.map((product, index) => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`View ${product.name} from ${getStore(product.store).name}`} onPress={() => selectProduct(product)} style={[s.suggestionRow, { backgroundColor: highlighted === index ? p.soft : p.surface }]}>
            <View style={s.thumbnail}><ProductPhoto product={product} /></View><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={[s.actionText, { color: p.text }]}>{product.name}</Text><Text numberOfLines={1} style={[s.small, { color: p.muted }]}>{getStore(product.store).name} · {product.category}</Text></View><Text style={[s.actionText, { color: p.primaryText }]}>{money(product.price)}</Text>
          </Pressable>) : <Text style={[s.small, { color: p.muted, padding: 12 }]}>No matching products in {props.location}.</Text>}
          <Pressable accessibilityRole="button" onPress={() => { setFocused(false); props.onSearch(query); }} style={[s.allResults, { borderTopColor: p.border }]}><Text style={[s.actionText, { color: p.primaryText }]}>See all results for “{query.trim()}” →</Text></Pressable>
        </View> : null}
      </View>
      <View><Pressable accessibilityRole="button" onPress={props.onAccount} style={s.action}><Text style={[s.small, { color: p.muted }]}>{props.customerName ? 'Welcome back' : 'Welcome to NearBy'}</Text><Text style={[s.actionText, { color: p.primaryText }]}>{props.customerName || 'Sign in / Sign up'}</Text></Pressable></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Wishlist, ${props.favorites} items`} onPress={() => props.onNavigate('Favorites')} style={s.iconAction}><InterfaceIcon name="heart" size={22} color={p.primaryText} /><Text style={[s.small, { color: p.text }]}>Saved {props.favorites || ''}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Cart, ${props.cartCount} items`} onPress={() => props.onNavigate('Cart')} style={[s.cart, { backgroundColor: p.soft }]}><InterfaceIcon name="bag" color={p.primaryText} /><Text style={[s.actionText, { color: p.primaryText }]}>Cart ({props.cartCount})</Text></Pressable>
    </View>
    <View style={[s.navBorder, { borderColor: p.border }]}><View style={s.nav}>
      {([{ label: 'Home', tab: 'Home' }, { label: 'Supermarket', tab: 'Supermarket' }, { label: 'Shop by name', tab: 'Shops' }] as const).map(link => <Pressable key={link.tab} accessibilityRole="button" accessibilityState={{ selected: props.active === link.tab }} onPress={() => props.onNavigate(link.tab)} style={[s.navLink, { borderBottomColor: props.active === link.tab ? p.primary : 'transparent' }]}><Text style={[s.actionText, { color: props.active === link.tab ? p.primaryText : p.text }]}>{link.label}</Text></Pressable>)}
      <View style={[s.separator, { backgroundColor: p.border }]} />
      {categories.map(category => <Pressable key={category} accessibilityRole="button" onPress={() => props.onSearch(category)} style={s.category}><Text style={[s.small, { color: p.muted }]}>{category}</Text></Pressable>)}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Change delivery location, ${props.location}`} onPress={props.onLocation} style={s.category}><Text style={[s.small, { color: p.primaryText }]}>⌖ {props.location} ▾</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="More account options" onPress={props.onMenu} style={s.menu}><InterfaceIcon name="menu" color={p.primaryText} /></Pressable>
    </View></View>
  </View>;
}
const s = StyleSheet.create({
  searchWrapper: { flex: 1, minWidth: 160, position: 'relative', zIndex: 40 },
  suggestions: { position: 'absolute', top: '100%', marginTop: 8, left: 0, right: 0, borderWidth: 1, borderRadius: 14, padding: 8, boxShadow: '0px 10px 28px rgba(45, 25, 70, 0.16)' },
  suggestionHeading: { fontSize: 9, letterSpacing: 1, fontWeight: '700', padding: 10 }, suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, padding: 8 }, thumbnail: { width: 42, height: 42 }, allResults: { borderTopWidth: 1, padding: 13, marginTop: 6 },
  utility: { paddingHorizontal: 28 }, utilityInner: { width: '100%', maxWidth: 1360, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 }, utilityText: { color: '#F6EFFF', fontSize: 11 },
  main: { width: '100%', maxWidth: 1360, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 28, paddingVertical: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandName: { fontSize: 27, fontWeight: '800', letterSpacing: -1 }, small: { fontSize: 11, lineHeight: 17 },
  search: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 5 }, input: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13 }, searchButton: { paddingHorizontal: 18, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  action: { gap: 3, paddingVertical: 8, maxWidth: 140 }, actionText: { fontSize: 12, fontWeight: '700' }, iconAction: { alignItems: 'center', gap: 4, padding: 6 }, cart: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 13 },
  navBorder: { borderTopWidth: 1 }, nav: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }, navLink: { paddingVertical: 17, borderBottomWidth: 2 }, category: { paddingVertical: 14 }, separator: { height: 18, width: 1, marginHorizontal: 2 }, menu: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
});
