import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useStoreTheme } from '../ThemeContext';
import { getStore, money, type Palette } from '../data/catalog';
import type { Product } from '../data/types';

export default function SearchSuggestions({ query, products, onSelect }: { query: string; products: Product[]; onSelect: (name: string) => void }) {
  const { palette } = useStoreTheme();
  const styles = createStyles(palette);
  const value = query.trim().toLowerCase();
  if (!value || products.some((product) => product.name.toLowerCase() === value)) return null;
  const suggestions = products.filter((product) => `${product.name} ${product.category} ${getStore(product.store).name}`.toLowerCase().includes(value))
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(value)) - Number(a.name.toLowerCase().startsWith(value)))
    .filter((product, index, matches) => matches.findIndex((item) => item.name === product.name) === index).slice(0, 5);
  if (!suggestions.length) return null;
  return <View style={styles.panel}>
    <Text style={styles.label}>SUGGESTED PRODUCTS</Text>
    {suggestions.map((product) => {
      const match = product.name.toLowerCase().indexOf(value);
      return <Pressable key={product.id} onPress={() => { onSelect(product.name); Keyboard.dismiss(); }} accessibilityRole="button" accessibilityLabel={`Search for ${product.name}`} style={styles.row}>
        <Text style={styles.icon}>⌕</Text><View style={styles.copy}><Text style={styles.name}>{match >= 0 ? <>{product.name.slice(0, match)}<Text style={styles.highlight}>{product.name.slice(match, match + value.length)}</Text>{product.name.slice(match + value.length)}</> : product.name}</Text><Text style={styles.meta}>{product.category} · {money(product.price)}</Text></View><Text style={styles.arrow}>↗</Text>
      </Pressable>;
    })}
  </View>;
}

const createStyles = (p: Palette) => StyleSheet.create({
  panel: { borderWidth: 1, borderColor: p.border, borderRadius: 13, backgroundColor: p.surface, padding: 12, marginBottom: 12 }, label: { color: p.gold, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 5 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 8 }, copy: { flex: 1 }, icon: { color: p.muted, fontSize: 21 }, name: { color: p.text, fontSize: 12 }, highlight: { color: p.primaryText, fontWeight: '900' }, meta: { color: p.muted, fontSize: 10, marginTop: 3 }, arrow: { color: p.gold, fontSize: 18 },
});
