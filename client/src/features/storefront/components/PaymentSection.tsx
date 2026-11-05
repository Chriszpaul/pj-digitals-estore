import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useStoreTheme } from '../ThemeContext';
import { money, type Palette } from '../data/catalog';
import type { DeliveryAddress } from './AddressBook';

export type PaymentMethod = 'UPI' | 'Card';
const methods: { name: PaymentMethod; icon: string; description: string }[] = [
  { name: 'UPI', icon: '↗', description: 'Google Pay, PhonePe or another UPI app' },
  { name: 'Card', icon: '▣', description: 'Credit or debit card' },
];

export default function PaymentSection({ subtotal, itemCount, location, address, onManageAddress, method, onChange, onBack, onConfirm, canOrder }: { subtotal: number; itemCount: number; location: string; address?: DeliveryAddress; onManageAddress: () => void; method: PaymentMethod; onChange: (method: PaymentMethod) => void; onBack: () => void; onConfirm: () => void; canOrder: boolean }) {
  const { palette } = useStoreTheme();
  const styles = createStyles(palette);
  const delivery = subtotal >= 999 ? 0 : 99;
  return <View>
    <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}><Text style={styles.backText}>← Back to cart</Text></Pressable>
    <Text style={styles.title}>Payment</Text><Text style={styles.subtitle}>Choose how you would like to pay.</Text>
    <View style={styles.demo}><Text style={styles.demoTitle}>DEMO CHECKOUT</Text><Text style={styles.copy}>No money will be charged. Online payment options are previews.</Text></View>
    <Text style={styles.label}>DELIVERING TO</Text><Text style={styles.location}>{location}</Text>

    {address ? <><Text style={styles.methodName}>{address.name}</Text><Text style={styles.copy}>{address.address} · {address.pincode}</Text><Text style={styles.copy}>{address.phone}</Text></> : <Text style={styles.copy}>Add a delivery address to continue.</Text>}
    <Pressable onPress={onManageAddress} accessibilityRole="button" style={styles.back}><Text style={styles.backText}>{address ? 'Change address →' : 'Add address →'}</Text></Pressable>
    <Text style={styles.label}>PAYMENT METHOD</Text>
    {methods.map((option) => <Pressable key={option.name} onPress={() => onChange(option.name)} style={[styles.method, method === option.name && styles.selected]} accessibilityRole="radio" accessibilityState={{ checked: method === option.name }}>
      <View style={styles.icon}><Text style={styles.iconText}>{option.icon}</Text></View>
      <View style={styles.methodCopy}><Text style={styles.methodName}>{option.name}</Text><Text style={styles.copy}>{option.description}</Text></View>
      <Text style={styles.radio}>{method === option.name ? '●' : '○'}</Text>
    </Pressable>)}
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>Order summary · {itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
      <View style={styles.row}><Text style={styles.copy}>Subtotal</Text><Text style={styles.value}>{money(subtotal)}</Text></View>
      <View style={styles.row}><Text style={styles.copy}>Delivery</Text><Text style={styles.value}>{delivery ? money(delivery) : 'FREE'}</Text></View>
      <View style={styles.totalRow}><Text style={styles.total}>Total</Text><Text style={styles.total}>{money(subtotal + delivery)}</Text></View>
      {!canOrder ? <Text style={styles.error}>Online ordering and payment are not connected yet. Your saved cart will remain available.</Text> : null}
      <Pressable disabled={!canOrder || itemCount === 0 || !address} onPress={onConfirm} accessibilityRole="button" accessibilityState={{ disabled: !canOrder || itemCount === 0 || !address }} style={[styles.button, (!canOrder || itemCount === 0 || !address) && { opacity: 0.5 }]}><Text style={styles.buttonText}>Confirm demo order · {money(subtotal + delivery)}</Text></Pressable>
      <Text style={styles.note}>Demo payment only. No card details or UPI authorisation are collected.</Text>
    </View>
  </View>;
}

const createStyles = (p: Palette) => StyleSheet.create({
  back: { paddingVertical: 12, alignSelf: 'flex-start' }, backText: { color: p.primaryText, fontSize: 12, fontWeight: '800' }, title: { color: p.text, fontSize: 28, fontWeight: '800' }, subtitle: { color: p.muted, fontSize: 12, marginTop: 6 },
  demo: { backgroundColor: p.soft, borderRadius: 14, padding: 14, marginTop: 18 }, demoTitle: { color: p.gold, fontSize: 9, letterSpacing: 1, fontWeight: '800' }, copy: { color: p.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }, label: { color: p.gold, fontSize: 9, letterSpacing: 1, fontWeight: '800', marginTop: 22, marginBottom: 9 }, location: { color: p.text, fontSize: 14, fontWeight: '700' },
  method: { borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 14, backgroundColor: p.surface, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }, selected: { borderColor: p.gold, backgroundColor: p.soft }, icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: p.background, alignItems: 'center', justifyContent: 'center' }, iconText: { color: p.primaryText, fontSize: 22 }, methodCopy: { flex: 1 }, methodName: { color: p.text, fontSize: 13, fontWeight: '800' }, radio: { color: p.gold, fontSize: 21 },
  summary: { marginTop: 12, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, borderRadius: 16, padding: 18 }, summaryTitle: { color: p.text, fontSize: 15, fontWeight: '800', marginBottom: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }, value: { color: p.text, fontSize: 13, fontWeight: '700' }, totalRow: { borderTopWidth: 1, borderColor: p.border, paddingTop: 14, marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }, total: { color: p.text, fontSize: 18, fontWeight: '800' },
  button: { backgroundColor: p.primary, borderRadius: 11, padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 20 }, buttonText: { color: p.onPrimary, fontSize: 12, fontWeight: '800', textAlign: 'center' }, note: { color: p.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12 }, error: { color: p.terracotta, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
