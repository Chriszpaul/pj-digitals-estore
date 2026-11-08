import { useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './AppText';
import InterfaceIcon from './InterfaceIcon';
import { useStoreTheme } from '../ThemeContext';

export default function CategoryMenu<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T | null; onChange: (category: T | null) => void }) {
  const { palette: c } = useStoreTheme();
  const viewport = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const button = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const menuWidth = Math.min(240, viewport.width - 32);
  const menuHeight = Math.min(52 + (options.length + 1) * 44, viewport.height - insets.top - insets.bottom - 24);
  const left = Math.max(16, Math.min(anchor.x + anchor.width - menuWidth, viewport.width - menuWidth - 16));
  const top = Math.max(insets.top + 8, Math.min(anchor.y + anchor.height + 6, viewport.height - insets.bottom - menuHeight - 12));
  function showMenu() {
    Keyboard.dismiss();
    button.current?.measureInWindow((x, y, width, height) => { setAnchor({ x, y, width, height }); setOpen(true); });
  }
  return <>
    <Pressable ref={button} accessibilityRole="button" accessibilityLabel={value ? `Category: ${value}. Change category` : 'Choose a product category'} accessibilityState={{ expanded: open }} onPress={showMenu} style={[s.trigger, { backgroundColor: c.surface, borderColor: value ? c.primary : c.border }]}>
      <InterfaceIcon name="grid" size={14} color={c.primaryText} /><Text numberOfLines={1} style={{ color: c.primaryText, fontSize: 12, fontWeight: '700', flexShrink: 1 }}>{value ?? 'Categories'}</Text><Text style={{ color: c.muted, fontSize: 13 }}>⌄</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close category menu" onPress={() => setOpen(false)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(24,18,35,0.12)' }]} />
        <View accessibilityViewIsModal style={[s.menu, { left, top, width: menuWidth, maxHeight: menuHeight, backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={s.heading}><Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>Categories</Text><Pressable accessibilityRole="button" accessibilityLabel="Close categories" onPress={() => setOpen(false)} style={s.close}><Text style={{ color: c.muted, fontSize: 22 }}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.max(44, menuHeight - 48), flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {options.map(category => <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected: value === category }} onPress={() => { onChange(category); setOpen(false); }} style={[s.option, { backgroundColor: value === category ? c.soft : c.surface }]}><Text style={{ flex: 1, color: value === category ? c.primaryText : c.text, fontSize: 12 }}>{category}</Text>{value === category ? <Text style={{ color: c.primaryText }}>✓</Text> : null}</Pressable>)}
            {value !== null ? <Pressable accessibilityRole="button" onPress={() => { onChange(null); setOpen(false); }} style={[s.option, { borderTopWidth: 1, borderColor: c.border }]}><Text style={{ color: c.muted, fontSize: 12 }}>Clear category</Text></Pressable> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  trigger: { minHeight: 44, maxWidth: 205, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 11 },
  menu: { position: 'absolute', borderWidth: 1, borderRadius: 14, padding: 4, boxShadow: '0px 8px 26px rgba(35,24,58,0.18)' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  option: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8 },
});
