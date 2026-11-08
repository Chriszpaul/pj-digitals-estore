import { useEffect, useRef, useState } from 'react';
import { router, type Href } from 'expo-router';
import { useCustomerAuth } from '@/features/auth/CustomerAuthContext';
import { applyForShop } from '@/services/shopApplications';
import { applyForDelivery } from '@/services/deliveryApplications';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { useStoreTheme } from '../ThemeContext';
import type { DeliveryLocation } from '../data/types';
import { partnerAreas, partnerCategories, preparePartnerDraft, vehicleTypes, type PartnerDraft, type PartnerFields, type PartnerRole } from '../utils/partnerRequests';

type Props = { role: PartnerRole; name?: string; email?: string; location: DeliveryLocation; draft?: PartnerDraft; onSave: (draft: PartnerDraft) => void; onBack: () => void; onScrollTop: () => void };

export default function PartnerRequest({ role, name, email, location, draft, onSave, onBack, onScrollTop }: Props) {
  const { palette: c } = useStoreTheme();
  const shop = role === 'shop';
  const { customer, getToken } = useCustomerAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string; status: string } | null>(null);
  const submissionLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit() {
    if (!review || !customer || submissionLock.current || submitted) return;
    submissionLock.current = true; setSubmitting(true); setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again before submitting.');
      const result = await (shop ? applyForShop(review, token) : applyForDelivery(review, token));
      if (mounted.current) setSubmitted(result);
    } catch (cause) {
      if (mounted.current) setError(`${cause instanceof Error ? cause.message : 'Unable to submit request.'} If the connection failed, check whether your application was received before trying again.`);
    } finally { submissionLock.current = false; if (mounted.current) setSubmitting(false); }
  }
  const [fields, setFields] = useState<PartnerFields>(() => draft ?? { fullName: name === 'Customer' ? '' : name ?? '', phone: '', email: email ?? '', shopName: '', address: '', categories: [], areas: [location], vehicle: 'Bike', vehicleNumber: '', note: '' });
  const [review, setReview] = useState<PartnerDraft | null>(null);
  const [saved, setSaved] = useState(!!draft);
  const [error, setError] = useState('');
  function update<K extends keyof PartnerFields>(key: K, value: PartnerFields[K]) { setFields(previous => ({ ...previous, [key]: value })); setSaved(false); setError(''); }
  const card = [s.card, { backgroundColor: c.surface, borderColor: c.border }];
  const copy = { color: c.muted, fontSize: 13, lineHeight: 21 };
  function input(label: string, key: 'fullName' | 'phone' | 'email' | 'shopName' | 'address' | 'vehicleNumber' | 'note', placeholder: string, optional = false) {
    const multiline = key === 'address' || key === 'note';
    return <View style={s.field}><Text style={[s.label, { color: c.text }]}>{label}{optional ? <Text style={{ color: c.muted }}> · Optional</Text> : ''}</Text>
      <TextInput accessibilityLabel={label} value={fields[key]} onChangeText={value => update(key, value)} placeholder={placeholder} placeholderTextColor={c.muted} keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : key === 'vehicleNumber' ? 'characters' : 'sentences'} autoCorrect={key !== 'email' && key !== 'vehicleNumber'} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} maxLength={key === 'note' ? 500 : key === 'phone' ? 18 : key === 'address' ? 300 : 150} style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.background, minHeight: multiline ? 100 : 50 }]} />
    </View>;
  }
  function option(label: string, selected: boolean, onPress: () => void, multiple = false) {
    return <Pressable key={label} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected }} onPress={onPress} style={[s.option, { backgroundColor: selected ? c.primary : c.background, borderColor: selected ? c.primary : c.border }]}><Text style={{ color: selected ? c.onPrimary : c.text, fontSize: 12, fontWeight: '700' }}>{selected ? '✓  ' : ''}{label}</Text></Pressable>;
  }
  function row(label: string, value: string) { return <View style={s.summaryRow}><Text style={[copy, { minWidth: 90 }]}>{label}</Text><Text style={{ flex: 1, color: c.text, fontSize: 13, lineHeight: 21, fontWeight: '600' }}>{value || 'Not provided'}</Text></View>; }
  function preview() {
    try { setReview(preparePartnerDraft(role, fields)); setError(''); onScrollTop(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check your request details.'); }
  }
  return <View style={s.page}>
    <Pressable accessibilityRole="button" onPress={onBack} disabled={submitting} style={{ paddingVertical: 12, alignSelf: 'flex-start' }}><Text style={{ color: c.primaryText, fontSize: 13, fontWeight: '700' }}>← Back to store</Text></Pressable>
    <View style={[card, { backgroundColor: c.soft, gap: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={[s.symbol, { backgroundColor: c.surface }]}><Text style={{ color: c.primaryText, fontSize: 25 }}>{shop ? '▦' : '↗'}</Text></View><View style={{ flex: 1 }}><Text style={{ color: c.primaryText, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }}>JOB with NearBy</Text><Text style={{ color: c.text, fontSize: 25, fontWeight: '800', marginTop: 6 }}>{shop ? 'Become a shop owner' : 'Become a delivery partner'}</Text></View></View>
      <Text style={copy}>{shop ? 'Introduce your shop and the products you want to sell on NearBy.' : 'Tell us a little about yourself and where you would like to deliver.'}</Text>
      <Text style={{ color: c.primaryText, fontSize: 12, lineHeight: 19, fontWeight: '700' }}>{shop ? 'Submit your shop for review. Shop access requires approval.' : 'Submit your delivery application for review. Partner access requires approval.'}</Text>
    </View>
    {review ? <View style={card}>
      <Text style={[s.heading, { color: c.text }]}>{submitted ? (shop ? 'Shop request submitted' : 'Delivery request submitted') : saved ? 'Draft saved for this session' : 'Review your request'}</Text>
      <Text style={copy}>{submitted ? `Application status: ${submitted.status}. Partner access still requires approval.` : 'Check your details, then submit your application for review.'}</Text>
      {row('Request', shop ? 'Shop owner' : 'Delivery partner')}{row('Name', review.fullName)}{row('Phone', review.phone)}{shop ? row('Email', review.email) : null}
      {shop ? <>{row('Shop', review.shopName)}{row('Categories', review.categories.join(', '))}{row('Address', review.address)}</> : <>{row('Vehicle', review.vehicle)}{row('Registration', review.vehicleNumber)}</>}
      {row('Area', review.areas.join(' · '))}{shop && review.note ? row('Message', review.note) : null}
      <View style={s.actions}>
        <Pressable accessibilityRole="button" disabled={submitting || !!submitted} onPress={() => { setReview(null); onScrollTop(); }} style={[s.button, { backgroundColor: c.soft }]}><Text style={{ color: c.primaryText, fontWeight: '700' }}>Edit details</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saved || submitting || !!submitted }} disabled={saved || submitting || !!submitted} onPress={() => { onSave(review); setSaved(true); }} style={[s.button, { backgroundColor: c.primary, opacity: saved ? 0.6 : 1 }]}><Text style={{ color: c.onPrimary, fontWeight: '700' }}>{saved ? 'Draft saved' : 'Save draft'}</Text></Pressable>
        {!submitted ? customer ? <Pressable accessibilityRole="button" disabled={submitting} accessibilityState={{ disabled: submitting, busy: submitting }} onPress={() => void submit()} style={[s.button, { backgroundColor: c.primary, opacity: submitting ? 0.6 : 1 }]}><Text style={{ color: c.onPrimary, fontWeight: '700' }}>{submitting ? 'Submitting…' : shop ? 'Submit shop request' : 'Submit delivery request'}</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => { onSave(review); router.push('/login' as Href); }} style={[s.button, { backgroundColor: c.primary }]}><Text style={{ color: c.onPrimary, fontWeight: '700' }}>Sign in to submit</Text></Pressable> : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: c.terracotta, fontSize: 13, lineHeight: 21 }}>{error}</Text> : null}
    </View> : <>
      {saved ? <View style={card}><Text style={{ color: c.primaryText, fontWeight: '700' }}>Your saved draft is ready to edit.</Text><Text style={copy}>It stays available while this app session is open. It has not been submitted.</Text></View> : null}
      <View style={card}><Text style={[s.heading, { color: c.text }]}>Your contact details</Text>{input('Full name', 'fullName', 'Your full name')}{input('Phone number', 'phone', '10-digit mobile number')}{shop ? input('Email address', 'email', 'you@example.com', true) : null}</View>
      <View style={card}><Text style={[s.heading, { color: c.text }]}>{shop ? 'About your shop' : 'Delivery preferences'}</Text>
        {shop ? <>{input('Shop name', 'shopName', 'e.g. VV Electronics')}{input('Shop address', 'address', 'Building, street and nearby landmark')}<Text style={[s.label, { color: c.text }]}>What do you sell?</Text><View style={s.options}>{partnerCategories.map(category => option(category, fields.categories.includes(category), () => update('categories', fields.categories.includes(category) ? fields.categories.filter(value => value !== category) : [...fields.categories, category]), true))}</View></> : <><Text style={[s.label, { color: c.text }]}>Vehicle type</Text><View style={s.options}>{vehicleTypes.map(vehicle => option(vehicle, fields.vehicle === vehicle, () => update('vehicle', vehicle)))}</View>{input('Vehicle registration', 'vehicleNumber', 'e.g. KL 38 AB 1234', true)}</>}
        <Text style={[s.label, { color: c.text }]}>{shop ? 'Shop location' : 'Preferred service areas'}</Text><View style={s.options}>{partnerAreas.map(area => option(area, fields.areas.includes(area), () => update('areas', shop ? [area] : fields.areas.includes(area) ? fields.areas.filter(value => value !== area) : [...fields.areas, area]), !shop))}</View>
        {shop ? input('Your message', 'note', 'Tell us about your shop…', true) : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: c.terracotta, fontSize: 13, lineHeight: 21, marginBottom: 14 }}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={preview} style={[s.button, { backgroundColor: c.primary }]}><Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: '800' }}>Preview request →</Text></Pressable>
      <Text style={[copy, { textAlign: 'center', marginTop: 12 }]}>{shop ? 'Your request is sent only when you select Submit shop request.' : 'Your request is sent only when you select Submit delivery request.'}</Text>
    </>}
  </View>;
}

const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 780, alignSelf: 'center', marginBottom: 24 },
  card: { padding: 20, borderRadius: 18, borderWidth: 1, marginBottom: 16, gap: 14, boxShadow: '0px 5px 18px rgba(64, 35, 94, 0.08)' },
  symbol: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '800' }, label: { fontSize: 12, fontWeight: '700' },
  field: { gap: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderRadius: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }, button: { minHeight: 50, paddingHorizontal: 20, paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
