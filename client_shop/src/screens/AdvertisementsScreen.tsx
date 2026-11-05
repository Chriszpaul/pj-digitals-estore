import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, C, Card, Page, S, Section } from '../components/ShopUI';
import { useShopAuth } from '../context/ShopAuthContext';

type Advertisement = { id: string; title: string; offer: string; description: string; image: string; enabled: boolean };
const blank = { title: '', offer: '', description: '', image: '' };

export default function AdvertisementsScreen() {
  const { account } = useShopAuth();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  function save() {
    if (!form.title.trim() || !form.offer.trim()) { setError('Enter an advertisement title and offer.'); return; }
    if (form.image.trim()) {
      try { if (new URL(form.image.trim()).protocol !== 'https:') throw new Error(); }
      catch { setError('Use a valid HTTPS image link, or leave it empty.'); return; }
    }
    const details = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as typeof blank;
    setAds(current => editing ? current.map(ad => ad.id === editing ? { ...ad, ...details } : ad) : [{ ...details, id: `ad-${Date.now()}`, enabled: true }, ...current]);
    setOpen(false); setNotice(editing ? 'Advertisement updated in your demo.' : 'Advertisement added to your demo.');
  }
  return <Page title="Advertisements" subtitle="Create promotions that put your shop in the spotlight.">
    <Card><View style={[S.row, { gap: 12 }]}><MaterialCommunityIcons name="bullhorn-outline" size={30} color={C.amber} /><View style={{ flex: 1 }}><Text style={S.name}>A little spotlight for your shop</Text><Text style={[S.small, { lineHeight: 18 }]}>Create a banner, add your offer, and preview the result.</Text></View></View><View style={{ marginTop: 16 }}><Button label="＋ Add advertisement" onPress={() => { setForm(blank); setEditing(null); setError(''); setOpen(true); }} /></View></Card>
    <Text style={[S.small, { lineHeight: 18, marginTop: 12 }]}>Frontend demo · advertisements stay in this session and are not published to the customer app.</Text>
    {notice ? <Text accessibilityLiveRegion="polite" style={[S.small, { color: C.green, marginTop: 12 }]}>{notice}</Text> : null}
    <Section>Your advertisements ({ads.length})</Section>
    {!ads.length ? <Card><Text style={S.name}>Your next promotion starts here</Text><Text style={[S.small, { lineHeight: 18 }]}>Add an advertisement for a new arrival, seasonal sale, or special offer.</Text></Card> : null}
    {ads.map(ad => <View key={ad.id} style={{ marginBottom: 16 }}><Card>
      <Banner title={ad.title} offer={ad.offer} description={ad.description} image={ad.image} shopName={account?.shopName || 'Your shop'} />
      <Text style={[S.small, { marginVertical: 12 }]}>{ad.enabled ? 'Active in preview' : 'Paused'}</Text>
      <View style={[S.row, { flexWrap: 'wrap', gap: 8 }]}>
        <Button secondary label="Edit" onPress={() => { setForm({ title: ad.title, offer: ad.offer, description: ad.description, image: ad.image }); setEditing(ad.id); setError(''); setOpen(true); }} />
        <Button secondary label={ad.enabled ? 'Pause' : 'Activate'} onPress={() => setAds(current => current.map(item => item.id === ad.id ? { ...item, enabled: !item.enabled } : item))} />
        <Button secondary label="Delete" onPress={() => setDeleting(ad.id)} />
      </View>
    </Card></View>)}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 }}>
        <View style={[S.spread, { gap: 12, marginBottom: 20 }]}><Text style={[S.title, { flex: 1 }]}>{editing ? 'Edit advertisement' : 'New advertisement'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close advertisement form" onPress={() => setOpen(false)} style={{ padding: 10 }}><MaterialCommunityIcons name="close" size={24} color={C.text} /></Pressable></View>
        <Text style={S.label}>TITLE *</Text><TextInput accessibilityLabel="Advertisement title" value={form.title} onChangeText={title => setForm({ ...form, title })} maxLength={60} style={S.input} placeholder="e.g. Festive offers are here" placeholderTextColor={C.muted} />
        <Text style={S.label}>OFFER *</Text><TextInput accessibilityLabel="Offer" value={form.offer} onChangeText={offer => setForm({ ...form, offer })} maxLength={40} style={S.input} placeholder="e.g. Up to 20% off" placeholderTextColor={C.muted} />
        <Text style={S.label}>DESCRIPTION</Text><TextInput accessibilityLabel="Advertisement description" value={form.description} onChangeText={description => setForm({ ...form, description })} multiline maxLength={180} style={[S.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Tell customers about your promotion" placeholderTextColor={C.muted} />
        <Text style={S.label}>IMAGE LINK · OPTIONAL</Text><TextInput accessibilityLabel="Advertisement image link" value={form.image} onChangeText={image => setForm({ ...form, image })} autoCapitalize="none" keyboardType="url" style={S.input} placeholder="https://…" placeholderTextColor={C.muted} />
        <Section>Live preview</Section><Banner {...form} shopName={account?.shopName || 'Your shop'} />
        {error ? <Text accessibilityRole="alert" style={{ color: C.red, marginTop: 16 }}>{error}</Text> : null}
        <View style={{ marginTop: 24 }}><Button label={editing ? 'Save changes' : 'Add advertisement'} onPress={save} /></View>
      </ScrollView></SafeAreaView>
    </Modal>
    <Modal visible={deleting !== null} transparent animationType="fade" onRequestClose={() => setDeleting(null)}><View style={S.modalShade}><View style={S.modal}><Text style={S.section}>Delete advertisement?</Text><Text style={S.subtitle}>This removes the promotion from your demo list.</Text><View style={[S.row, { gap: 12 }]}><Button secondary label="Cancel" onPress={() => setDeleting(null)} /><Button label="Delete" onPress={() => { setAds(current => current.filter(ad => ad.id !== deleting)); setDeleting(null); }} /></View></View></View></Modal>
  </Page>;
}

function Banner({ title, offer, description, image, shopName }: typeof blank & { shopName: string }) {
  const [failedImage, setFailedImage] = useState('');
  return <View style={{ backgroundColor: C.blue, borderRadius: 14, overflow: 'hidden', borderBottomWidth: 4, borderColor: '#CFAC65' }}>
    {image.startsWith('https://') && failedImage !== image ? <Image accessibilityLabel="Advertisement image" source={{ uri: image }} style={{ width: '100%', height: 145 }} resizeMode="cover" onError={() => setFailedImage(image)} /> : null}
    <View style={{ padding: 22 }}><Text style={S.eyebrow}>{shopName.toUpperCase()}</Text><Text style={S.bannerTitle}>{title || 'Your promotion title'}</Text><Text style={{ color: '#E1C68A', fontSize: 24, fontWeight: '800', marginTop: 12 }}>{offer || 'Your special offer'}</Text>{description ? <Text style={S.bannerCopy}>{description}</Text> : null}</View>
  </View>;
}
