import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Button, Card, Metric, Page, Section, C, S } from '../components/ShopUI';
import { useShop } from '../context/ShopDataContext';
import type { Delivery, Order, Product, ProductUpdate } from '../context/ShopDataContext';

const cash = (n: number): string => '₹' + Math.round(Number(n)).toLocaleString('en-IN');
function deliveryLabel(status?: Delivery['status']) {
 if (!status) return 'Status pending';
 if (status === 'Preparing' || status === 'Ready for pickup') return 'Awaiting pickup';
 if (status === 'Picked up' || status === 'In transit') return 'Picked up';
 return status;
}
function OrderRow({ order }: { order: Order }) {
 const { deliveries } = useShop();
 const status = deliveryLabel(deliveries.find(delivery => delivery.orderId === order.id)?.status);
 return <View style={S.dividerRow}><View style={S.row}><View style={{ flex: 1 }}><Text style={S.orderId}>{order.id} · {order.customer}</Text><Text style={S.small}>{order.items} item{order.items === 1 ? '' : 's'} · {order.time}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={S.price}>{cash(order.total)}</Text><View style={{ marginTop: 6 }}><Badge value={status} /></View></View></View></View>;
}
function ProductRow({ product }: { product: Product }) {
 const symbol = product.category === 'Textiles' ? '▱' : product.category === 'Computer Items' ? '⌘' : product.category === 'Home Appliances' ? '⌂' : '◇';
 return <View style={S.productRow}><View style={S.glyph}><Text style={S.glyphText}>{symbol}</Text></View><View style={{ flex: 1 }}><Text style={S.name}>{product.name}</Text><Text style={S.small}>{product.sku} · {product.category}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={S.price}>{cash(product.price)}</Text><Text style={S.small}>{product.stock} in stock</Text></View></View>;
}
function Filter({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) { return <View style={S.chips}>{items.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[S.chip, item === value && S.chipOn]}><Text style={[S.chipText, item === value && S.chipTextOn]}>{item}</Text></Pressable>)}</View>; }
function ProductModal({ visible, close }: { visible: boolean; close: () => void }) {
 const { addProduct } = useShop(); const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [category, setCategory] = useState(''); const [stock, setStock] = useState('');
 const save = () => { if (!name.trim() || !price || !Number.isFinite(Number(price))) return Alert.alert('Add product', 'Enter a product name and valid price.'); addProduct({ name: name.trim(), price: Number(price), category: category.trim() || 'General', stock: Math.max(0, Number(stock) || 0) }); setName(''); setPrice(''); setCategory(''); setStock(''); close(); };
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}><View style={S.modalShade}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled"><View style={S.modal}><View style={[S.row, { justifyContent: 'space-between' }]}><Text style={S.orderId}>Add a product</Text><Pressable onPress={close}><Text style={{ color: C.muted, fontSize: 22 }}>×</Text></Pressable></View>
  <Text style={S.label}>PRODUCT NAME</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Bluetooth speaker" placeholderTextColor="#697568" style={S.input} />
  <View style={S.row}><View style={{ flex: 1, marginRight: 7 }}><Text style={S.label}>PRICE (₹)</Text><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="2,499" placeholderTextColor="#697568" style={S.input} /></View><View style={{ flex: 1, marginLeft: 7 }}><Text style={S.label}>STARTING STOCK</Text><TextInput value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="0" placeholderTextColor="#697568" style={S.input} /></View></View>
  <Text style={S.label}>CATEGORY</Text><TextInput value={category} onChangeText={setCategory} placeholder="Electronics, textiles..." placeholderTextColor="#697568" style={S.input} />
  <Button label="Save product" onPress={save} /><Text style={[S.small, { marginTop: 9 }]}>Demo only. Your item will be stored in memory.</Text></View></ScrollView></View></Modal>;
}
function TeamModal({ visible, close }: { visible: boolean; close: () => void }) {
 const { addMember } = useShop(); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState('Order staff');
 const save = () => { if (!name.trim() || !email.trim()) return Alert.alert('Invite staff', 'Enter a name and email.'); addMember({ name: name.trim(), email: email.trim(), role }); setName(''); setEmail(''); close(); };
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}><View style={S.modalShade}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled"><View style={S.modal}><View style={[S.row, { justifyContent: 'space-between' }]}><Text style={S.orderId}>Add a team member</Text><Pressable onPress={close}><Text style={{ color: C.muted, fontSize: 22 }}>×</Text></Pressable></View>
 <Text style={S.label}>FULL NAME</Text><TextInput value={name} onChangeText={setName} placeholder="Team member name" placeholderTextColor="#697568" style={S.input} />
 <Text style={S.label}>EMAIL</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor="#697568" style={S.input} />
 <Text style={S.label}>ROLE</Text><Filter items={['Store manager', 'Order staff', 'Inventory staff']} value={role} onChange={setRole} />
 <Button label="Add to team" onPress={save} /><Text style={[S.small, { marginTop: 9 }]}>Demo only. An invitation will not be sent yet.</Text></View></ScrollView></View></Modal>;
}

export function Home() {
 const { orders, products } = useShop();
 const router = useRouter();
 const [addingProduct, setAddingProduct] = useState(false);
 const openOrders = orders.filter((o) => o.status !== 'Completed'); const low = products.filter((p) => p.stock <= 4);
 return <Page title="Good morning" subtitle="Here is what is happening at your shop today.">
  <LinearGradient colors={['#277052', '#174E3C', '#10382A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.banner}><Text style={S.eyebrow}>YOUR STORE AT A GLANCE</Text><Text style={S.bannerTitle}>Your shop, all in one place.</Text><Text style={S.bannerCopy}>View orders, keep products in stock, and help customers find what they need.</Text></LinearGradient>
  <View style={S.metrics}><Metric label="Sales today" value="₹1,24,800" foot="↑ 12% from yesterday" /><Metric label="Active orders" value={String(openOrders.length).padStart(2, '0')} foot="Orders needing attention" /><Metric label="Products listed" value={String(products.length).padStart(2, '0')} foot="In your catalogue" /></View>
  <Section>Quick actions</Section>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    <Pressable accessibilityRole="button" onPress={() => setAddingProduct(true)} style={[S.card, { flex: 1, minWidth: 140, padding: 18, gap: 9 }]}>
      <MaterialCommunityIcons name="plus-box-outline" size={28} color={C.green} />
      <Text style={S.name}>Add Product</Text><Text style={[S.small, { lineHeight: 18 }]}>List a new item in your shop</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.navigate('/inventory')} style={[S.card, { flex: 1, minWidth: 140, padding: 18, gap: 9 }]}>
      <MaterialCommunityIcons name="package-variant-closed" size={28} color={C.amber} />
      <Text style={S.name}>Update Stock</Text><Text style={[S.small, { lineHeight: 18 }]}>Adjust quantities and manage stock</Text>
    </Pressable>
  </View>
  <ProductModal visible={addingProduct} close={() => setAddingProduct(false)} />
  <Section>Active orders</Section><Card>{openOrders.slice(0, 3).map((order) => <OrderRow key={order.id} order={order} />)}</Card>
  <Section>Stock to check · {low.length} items</Section><Card>{low.length ? low.map((product) => <ProductRow key={product.id} product={product} />) : <Text style={S.small}>Everything is well stocked.</Text>}</Card>
  <Text style={[S.small, { textAlign: 'center', marginTop: 18 }]}>Front-end preview · Sample data only</Text>
 </Page>;
}
export function Orders() {
 const { orders, deliveries } = useShop(); const [filter, setFilter] = useState('All');
 const visible = filter === 'All' ? orders : orders.filter(order => deliveryLabel(deliveries.find(delivery => delivery.orderId === order.id)?.status) === filter);
 return <Page title="Orders" subtitle="Track pickup and delivery for your shop’s orders."><Filter items={['All', 'Awaiting pickup', 'Picked up', 'Out for delivery', 'Delivered']} value={filter} onChange={setFilter} /><Card>{visible.length ? visible.map((o) => <OrderRow key={o.id} order={o} />) : <Text style={S.small}>No orders in this group.</Text>}</Card><Text style={[S.small, { marginTop: 12 }]}>View only · Sample pickup and delivery statuses.</Text></Page>;
}
function DeliveryCard({ delivery }: { delivery: Delivery }) {
 const steps = ['Pickup', 'Delivery'];
 const current: Record<Delivery['status'], number> = { Preparing: -1, 'Ready for pickup': -1, 'Picked up': 0, 'In transit': 0, 'Out for delivery': 0, Delivered: 1 };
 const currentStep = current[delivery.status];
 return <Card style={{ marginBottom: 12 }}>
  <View style={[S.row, { justifyContent: 'space-between', gap: 12 }]}><View style={{ flex: 1 }}><Text style={S.orderId}>{delivery.id} · Order {delivery.orderId}</Text><Text style={S.small}>{delivery.customer} · {delivery.items} item{delivery.items === 1 ? '' : 's'}</Text></View><Badge value={deliveryLabel(delivery.status)} /></View>
  <View style={[S.productRow, { marginTop: 9 }]}><View style={{ flex: 1 }}><Text style={S.small}>DELIVERY ADDRESS</Text><Text style={[S.name, { marginTop: 4 }]}>{delivery.address}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={S.small}>ORDER TOTAL</Text><Text style={[S.price, { marginTop: 4 }]}>{cash(delivery.total)}</Text></View></View>
  <View style={[S.row, { justifyContent: 'space-between', paddingVertical: 10 }]}><Text style={S.small}>Driver: {delivery.driver}</Text><Text style={S.small}>{delivery.window}</Text></View>
  <View style={[S.row, { justifyContent: 'space-between', marginTop: 4, marginBottom: 2 }]}>{steps.map((step, index) => <View key={step} style={{ flex: 1, alignItems: index === 0 ? 'flex-start' : index === steps.length - 1 ? 'flex-end' : 'center' }}><Text style={{ color: index <= currentStep ? C.green : C.muted, fontSize: 9, fontWeight: '700' }}>{index <= currentStep ? '●' : '○'} {step}</Text></View>)}</View>
 </Card>;
}

export function Deliveries() {
 const { deliveries } = useShop();
 const [filter, setFilter] = useState('All');
 const shown = deliveries.filter((d) => filter === 'All' || (filter === 'Delivered' ? d.status === 'Delivered' : d.status !== 'Delivered'));
 return <Page title="Deliveries" subtitle="View delivery details and the current progress of each order.">
  <View style={S.metrics}><Metric label="In progress" value={String(deliveries.filter((d) => d.status !== 'Delivered').length)} foot="Deliveries being tracked" /><Metric label="Delivered" value={String(deliveries.filter((d) => d.status === 'Delivered').length)} foot="Completed drop-offs" /></View>
  <Section>Delivery orders</Section>
  <Filter items={['All', 'In progress', 'Delivered']} value={filter} onChange={setFilter} />
  {shown.length ? shown.map((delivery) => <DeliveryCard key={delivery.id} delivery={delivery} />) : <Card><Text style={S.small}>No deliveries in this group.</Text></Card>}
  <Text style={[S.small, { marginTop: 6 }]}>View only · Sample delivery statuses.</Text>
 </Page>;
}
export function Products() {
 const { products } = useShop(); const [query, setQuery] = useState(''); const [show, setShow] = useState(false);
 const list = useMemo(() => products.filter((p) => (p.name + p.sku + p.category).toLowerCase().includes(query.toLowerCase())), [products, query]);
 return <Page title="Products" subtitle="Add items to your store and keep their details up to date."><View style={[S.row, { marginBottom: 13 }]}><TextInput value={query} onChangeText={setQuery} placeholder="Search products or SKU" placeholderTextColor="#697568" style={[S.input, { flex: 1, marginBottom: 0, marginRight: 8 }]} /><Button label="＋ Add" onPress={() => setShow(true)} /></View><Card>{list.length ? list.map((p) => <ProductRow key={p.id} product={p} />) : <Text style={S.small}>No products match your search.</Text>}</Card><ProductModal visible={show} close={() => setShow(false)} /></Page>;
}
type StockFields = { name: string; sku: string; category: string; price: string; stock: string; reorderLevel: string; location: string };
function EditStockModal({ product, visible, close, saveProduct }: { product: Product | null; visible: boolean; close: () => void; saveProduct: (id: string, details: ProductUpdate) => void }) {
 const { products } = useShop();
 const [fields, setFields] = useState(() => product ? { name: product.name, sku: product.sku, category: product.category, price: String(product.price), stock: String(product.stock), reorderLevel: String(product.reorderLevel), location: product.location } : { name: '', sku: '', category: '', price: '', stock: '', reorderLevel: '', location: '' });
 const [error, setError] = useState('');
 const change = (key: keyof StockFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
 const submit = () => {
  if (!product) return;
  const sku = fields.sku.trim().toUpperCase();
  const price = Number(fields.price);
  const stock = Number(fields.stock);
  const reorderLevel = Number(fields.reorderLevel);
  if (!fields.name.trim() || !sku || !fields.category.trim() || !fields.location.trim()) return setError('Fill in the name, SKU, category, and shelf location.');
  if (!fields.price.trim() || !Number.isFinite(price) || price < 0) return setError('Enter a valid price in rupees.');
  if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(reorderLevel) || reorderLevel < 0) return setError('Stock and reorder level must be whole numbers of zero or more.');
  if (products.some((item) => item.id !== product.id && item.sku.toLowerCase() === sku.toLowerCase())) return setError('That SKU is already used by another product.');
  saveProduct(product.id, { name: fields.name.trim(), sku, category: fields.category.trim(), price, stock, reorderLevel, location: fields.location.trim() });
  close();
 };
 if (!product) return null;
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
  <View style={S.modalShade}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
   <View style={S.modal}>
    <View style={[S.row, { justifyContent: 'space-between', marginBottom: 9 }]}><Text style={S.orderId}>Edit stock item</Text><Pressable onPress={close}><Text style={{ color: C.muted, fontSize: 22 }}>×</Text></Pressable></View>
    <Text style={S.label}>PRODUCT NAME</Text><TextInput value={fields.name} onChangeText={(value) => change('name', value)} style={S.input} />
    <View style={S.row}><View style={{ flex: 1, marginRight: 7 }}><Text style={S.label}>SKU</Text><TextInput value={fields.sku} onChangeText={(value) => change('sku', value)} autoCapitalize="characters" style={S.input} /></View><View style={{ flex: 1, marginLeft: 7 }}><Text style={S.label}>CATEGORY</Text><TextInput value={fields.category} onChangeText={(value) => change('category', value)} style={S.input} /></View></View>
    <View style={S.row}><View style={{ flex: 1, marginRight: 7 }}><Text style={S.label}>PRICE (₹)</Text><TextInput value={fields.price} onChangeText={(value) => change('price', value)} keyboardType="decimal-pad" style={S.input} /></View><View style={{ flex: 1, marginLeft: 7 }}><Text style={S.label}>QUANTITY</Text><TextInput value={fields.stock} onChangeText={(value) => change('stock', value)} keyboardType="number-pad" style={S.input} /></View></View>
    <View style={S.row}><View style={{ flex: 1, marginRight: 7 }}><Text style={S.label}>REORDER LEVEL</Text><TextInput value={fields.reorderLevel} onChangeText={(value) => change('reorderLevel', value)} keyboardType="number-pad" style={S.input} /></View><View style={{ flex: 1, marginLeft: 7 }}><Text style={S.label}>SHELF LOCATION</Text><TextInput value={fields.location} onChangeText={(value) => change('location', value)} style={S.input} /></View></View>
    {error ? <Text style={{ color: C.red, fontSize: 12, marginBottom: 11 }}>{error}</Text> : null}
    <View style={S.row}><Button label="Cancel" secondary onPress={close} style={{ flex: 1, marginRight: 6 }} /><Button label="Save changes" onPress={submit} style={{ flex: 1, marginLeft: 6 }} /></View>
   </View>
  </ScrollView></View>
 </Modal>;
}

function DeleteStockModal({ product, visible, cancel, confirm }: { product: Product | null; visible: boolean; cancel: () => void; confirm: () => void }) {
 if (!product) return null;
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
  <View style={S.modalShade}><View style={S.modal}>
   <Text style={S.orderId}>Delete product?</Text>
   <Text style={[S.small, { lineHeight: 19, marginTop: 9, marginBottom: 18 }]}>“{product.name}” will be removed from this store&apos;s inventory. You can add it again later.</Text>
   <View style={S.row}><Button label="Keep product" secondary onPress={cancel} style={{ flex: 1, marginRight: 6 }} /><Button label="Delete product" onPress={confirm} style={{ flex: 1, marginLeft: 6, backgroundColor: '#AF3D52' }} /></View>
  </View></View>
 </Modal>;
}
export function Inventory() {
 const { products, changeStock, updateProduct, deleteProduct } = useShop();
 const [filter, setFilter] = useState('All stock');
 const [editingProduct, setEditingProduct] = useState<Product | null>(null);
 const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
 const stockStatus = (product: Product): string => product.stock === 0 ? 'Out of stock' : product.stock <= product.reorderLevel ? 'Low stock' : 'In stock';
 const counts = {
  all: products.length,
  low: products.filter((p) => stockStatus(p) === 'Low stock').length,
  out: products.filter((p) => stockStatus(p) === 'Out of stock').length,
 };
 const list = products.filter((p) => filter === 'All stock' || stockStatus(p) === filter);
 return <Page title="Stock status" subtitle="See stock levels, product details, and what needs reordering.">
  <View style={S.metrics}><Metric label="Products tracked" value={String(counts.all)} foot="In this store" /><Metric label="Low stock" value={String(counts.low)} foot="At or below reorder level" /><Metric label="Out of stock" value={String(counts.out)} foot="Unavailable to customers" /></View>
  <Section>Inventory details</Section>
  <Filter items={['All stock', 'In stock', 'Low stock', 'Out of stock']} value={filter} onChange={setFilter} />
  <Card>{list.length ? list.map((p, index) => <View key={p.id} style={[S.dividerRow, index === list.length - 1 && { borderBottomWidth: 0 }]}>
   <View style={[S.row, { alignItems: 'flex-start' }]}>
    <View style={{ flex: 1, paddingRight: 8 }}>
     <Text style={S.name}>{p.name}</Text>
     <Text style={S.small}>{p.sku} · {p.category}</Text>
     <Text style={[S.small, { marginTop: 6 }]}>{p.location} · Reorder at {p.reorderLevel}</Text>
     <Text style={[S.small, { color: C.text, marginTop: 5 }]}>{cash(p.price)} each</Text>
     <View style={{ marginTop: 7 }}><Badge value={stockStatus(p)} /></View>
    </View>
    <View style={{ alignItems: 'center' }}>
     <Text style={S.small}>On hand</Text>
     <View style={[S.row, { marginTop: 7 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Decrease stock for ' + p.name} onPress={() => changeStock(p.id, -1)} style={S.adjust}><Text style={S.orderId}>−</Text></Pressable>
      <Text style={S.stockNum}>{p.stock}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={'Increase stock for ' + p.name} onPress={() => changeStock(p.id, 1)} style={S.adjust}><Text style={S.orderId}>＋</Text></Pressable>
     </View>
    </View>
   </View>
   <View style={[S.row, { marginTop: 12 }]}>
    <Button label="Edit details" secondary onPress={() => setEditingProduct(p)} style={{ flex: 1, marginRight: 6 }} />
    <Button label="Delete" secondary onPress={() => setDeletingProduct(p)} style={{ flex: 1, marginLeft: 6, borderColor: '#E2C7CC', backgroundColor: '#F5E6E9' }} />
   </View>
  </View>) : <Text style={S.small}>No products match this stock status.</Text>}</Card>
  <Text style={[S.small, { marginTop: 12 }]}>Inventory changes are temporary until the backend is connected.</Text>
  <EditStockModal key={editingProduct?.id || 'closed'} product={editingProduct} visible={!!editingProduct} close={() => setEditingProduct(null)} saveProduct={updateProduct} />
  <DeleteStockModal product={deletingProduct} visible={!!deletingProduct} cancel={() => setDeletingProduct(null)} confirm={() => { if (deletingProduct) deleteProduct(deletingProduct.id); setDeletingProduct(null); }} />
 </Page>;
}
export function Team() {
 const { team } = useShop(); const [show, setShow] = useState(false);
 return <Page title="Your team" subtitle="Give staff clear roles to help run the store together."><Card><Text style={S.orderId}>Access at a glance</Text><Text style={[S.small, { lineHeight: 19, marginTop: 6 }]}>Owners manage the whole store. Managers oversee daily work. Staff can help with orders or stock.</Text></Card><View style={[S.row, { justifyContent: 'space-between', marginVertical: 13 }]}><Text style={S.orderId}>Team members ({team.length})</Text><Button label="＋ Invite staff" onPress={() => setShow(true)} /></View><Card>{team.map((person, index) => <View key={person.id} style={[S.productRow, index === team.length - 1 && { borderBottomWidth: 0 }]}><View style={S.avatar}><Text style={S.avatarText}>{person.initials}</Text></View><View style={{ flex: 1 }}><Text style={S.name}>{person.name}</Text><Text style={S.small}>{person.email}</Text></View><View style={{ alignItems: 'flex-end' }}><Badge value={person.role} /><Text style={[S.small, { color: C.green }]}>Active</Text></View></View>)}</Card><TeamModal visible={show} close={() => setShow(false)} /></Page>;
}
export function Store() {
 return <Page title="Shop profile" subtitle="Your shop’s details.">
  <Section>Store profile</Section><Card>{[['Store name', 'VV Electricals'], ['Category', 'Electronics & home appliances'], ['Location', 'MG Road, Thodupuzha']].map((row, i) => <View key={row[0]} style={[S.row, { justifyContent: 'space-between', paddingVertical: 14, borderBottomColor: C.line, borderBottomWidth: i === 2 ? 0 : 1 }]}><Text style={S.small}>{row[0]}</Text><Text style={[S.name, { fontSize: 11 }]}>{row[1]}</Text></View>)}</Card>
 </Page>;
}

