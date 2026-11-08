import { useEffect, useMemo, useRef, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { notify } from '@/lib/notifications';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import WebStoreHeader from './components/WebStoreHeader';
import { createWebStyles } from './styles/webStyles';
import Text from './components/AppText';
import HomeShops from './components/HomeShops';
import HomeProducts from './components/HomeProducts';
import InterfaceIcon from './components/InterfaceIcon';
import AnimatedAd from './components/AnimatedAd';
import HomePromotion, { homePromotions } from './components/HomePromotion';
import ProductReviews, { type ProductReview } from './components/ProductReviews';
import ProductPhoto from './components/ProductPhoto';
import ProductGallery from './components/ProductGallery';
import PartnerRequest from './components/PartnerRequest';
import CategoryMenu from './components/CategoryMenu';
import type { PartnerDraft, PartnerRole } from './utils/partnerRequests';
import { availableQuantity } from './utils/productOptions';
import PaymentSection, { type PaymentMethod } from './components/PaymentSection';
import AddressBook, { type DeliveryAddress } from './components/AddressBook';
import SearchSuggestions from './components/SearchSuggestions';
import { useStoreTheme } from './ThemeContext';
import { CategoryPicker, ProductGrid, StorePicker } from './components/ShopComponents';
import { categories, getStore, money, sortOptions, stores } from './data/catalog';
import { createStyles } from './styles/appStyles';
import type { CategoryFilter, DeliveryLocation, Order, Product, StoreId, Tab } from './data/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import AccountSettings from '../auth/AccountSettings';
import { useCatalogue } from './hooks/useCatalogue';
import { useCustomerCart, type BasketLine } from './hooks/useCustomerCart';

export default function StorefrontScreen() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const { customer, signOut } = useCustomerAuth();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const [tab, setTabState] = useState<Tab>('Home');
  function setTab(next: Tab) {
    if (Platform.OS === 'web' && next === 'Account') {
      router.push('/account' as Href);
      return;
    }
    setTabState(next);
  }
  const pageScroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (checkout !== 'payment') return;
    if (customer) { setSelectedProduct(null); setTab('Payment'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }
    router.setParams({ checkout: undefined });
  }, [checkout, customer]);

  function continueToPayment() {
    if (!customer) { router.push({ pathname: '/signup', params: { returnTo: 'payment' } }); return; }
    if (!basket.synced || basket.busy) { notify('Wait for your saved cart to load, and resolve any cart errors before checkout.'); setTab('Cart'); return; }
    setTab('Payment'); pageScroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function logout() {
    try { await signOut(); } catch { notify('Unable to sign out. Please try again.', 'error'); return; }
    basket.discardGuest(); setFavorites([]); setOrders([]); setAddresses([]); setPartnerDrafts({});
    setSelectedAddressId(null); setRecentViews([]);
    setAddressReturnTab('Home'); setSelectedProduct(null); setTab('Home');
    setDrawerOpen(false); drawerProgress.setValue(0);
    router.setParams({ checkout: undefined });
    pageScroll.current?.scrollTo({ y: 0, animated: false });
    notify('You are logged out. You can continue browsing.');
  }
  const catalogue = useCatalogue();
  const { products } = catalogue;
  const basket = useCustomerCart(products);
  const refreshing = catalogue.loading;
  const [refreshVersion, setRefreshVersion] = useState(0);
  async function refreshPage() { await catalogue.reload(); basket.reload(); setRefreshVersion(value => value + 1); }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation>('Thodupuzha, Idukki');
  const [locationOpen, setLocationOpen] = useState(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const { palette, mode, setMode } = useStoreTheme();
  const styles = useMemo(() => {
    const base = createStyles(palette);
    return Platform.OS === 'web' ? createWebStyles(base, width) : base;
  }, [palette, width]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [productReviews, setProductReviews] = useState<Record<string, ProductReview[]>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressReturnTab, setAddressReturnTab] = useState<Tab>('Home');
  function useAddress(id: string) {
    setSelectedAddressId(id);
    if (addressReturnTab === 'Payment') {
      setTab('Payment');
      pageScroll.current?.scrollTo({ y: 0, animated: false });
    }
  }
  const [recentViews, setRecentViews] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<string>('Featured');
  const [storeId, setStoreId] = useState<StoreId>('all');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [storeCategory, setStoreCategory] = useState<(typeof categories)[number]>('Electronics');
  const [search, setSearch] = useState('');
  const [supermarketSearch, setSupermarketSearch] = useState('');
  const [supermarketCategory, setSupermarketCategory] = useState<(typeof categories)[number] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [partnerDrafts, setPartnerDrafts] = useState<Record<string, PartnerDraft>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);
  const locationShops = stores.filter(store => store.location === deliveryLocation && products.some(product => product.store === store.id));
  // Seller and service area are not present in the product API response.
  const locationProducts = products;
  const deliveryAddress = addresses.find((address) => address.id === selectedAddressId && address.location === deliveryLocation);

  function openDrawer(): void {
    setDrawerOpen(true);
    Animated.timing(drawerProgress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  function closeDrawer(): void {
    Animated.timing(drawerProgress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  }

  function chooseTab(nextTab: Tab): void {
    if (nextTab === 'Addresses') setAddressReturnTab(tab === 'Addresses' ? 'Home' : tab);
    setSelectedProduct(null);
    setTab(nextTab);
    closeDrawer();
    pageScroll.current?.scrollTo({ y: 0, animated: false });
  }

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (getStore(product.store).location && getStore(product.store).location !== deliveryLocation) return false;
      const matchesStore = storeId === 'all' || product.store === storeId;
      const matchesCategory = category === 'All' || product.category === category;
      const matchesSearch = (product.name + ' ' + product.category).toLowerCase().includes(search.trim().toLowerCase());
      return matchesStore && matchesCategory && matchesSearch;
    });
    if (sortBy === 'Price: low to high') return filtered.sort((a, b) => a.price - b.price);
    if (sortBy === 'Price: high to low') return filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, storeId, category, search, sortBy, deliveryLocation]);

  const cartItems = basket.lines;
  const cartCount = basket.count;
  const subtotal = basket.subtotal;
  async function addToCart(product: Product, quantity = 1) {
    if (product.sizes?.length && (selectedProduct?.id !== product.id || !selectedSize)) {
      void openProduct(product); notify('Choose a size before adding this item.'); return;
    }
    try {
      await basket.add(product, product.sizes?.length ? selectedSize : undefined, quantity);
      notify(`${quantity} ${quantity === 1 ? 'item' : 'items'} added to your cart.`, 'success');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Unable to add this item.', 'error'); }
  }
  async function changeQuantity(line: BasketLine, difference: number) {
    try { await basket.change(line, difference); notify('Cart updated.', 'success'); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Unable to update your cart.', 'error'); }
  }

  const goToShop = () => { setSelectedProduct(null); setTab('Shop'); };

  function openShop(id: StoreId): void {
    setSelectedProduct(null);
    setStoreId(id);
    setCategory('All');
    setSearch('');
    setSortBy('Price: low to high');
    setTab('Shop');
    pageScroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function openProduct(product: Product): Promise<void> {
    const request = ++detailRequest.current;
    setSelectedProduct(product); setSelectedSize(''); setSelectedQuantity(1); setDetailLoading(true); setDetailError('');
    pageScroll.current?.scrollTo({ y: 0, animated: false });
    try {
      const current = await catalogue.details(product.id);
      if (request !== detailRequest.current) return;
      setSelectedProduct(item => item?.id === current.id ? current : item);
      setRecentViews(items => [current, ...items.filter(item => item.id !== current.id)].slice(0, 8));
    } catch (cause) {
      if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : 'Unable to load product details.');
    } finally { if (request === detailRequest.current) setDetailLoading(false); }
  }
  function toggleFavorite(id: string): void { const saved = favorites.includes(id); setFavorites((items) => items.includes(id) ? items.filter((savedId) => savedId !== id) : [...items, id]); notify(saved ? 'Removed from wishlist.' : 'Added to wishlist.', 'success'); }
  function placeDemoOrder(): void { notify('Ordering and payment APIs are not available yet. Your saved cart has not been changed.'); }

  function renderHome() {
    return <>
      <AnimatedAd key={refreshVersion} count={homePromotions.length}>
        {(adIndex) => <HomePromotion promotion={homePromotions[adIndex]} desktop={desktop} onShop={() => {
          setSupermarketCategory(null);
          setSupermarketSearch('');
          setTab('Supermarket');
          pageScroll.current?.scrollTo({ y: 0, animated: false });
        }} />}
      </AnimatedAd>
      {desktop ? <>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Find your next favourite</Text><Text style={styles.pageIntro}>Explore the latest products in the NearBy catalogue.</Text></View></View>
        <ProductGrid items={locationProducts.slice(0, 4)} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} money={money} />
      </> : <HomeProducts key={`products-${deliveryLocation}-${refreshVersion}`} products={locationProducts} onOpen={openProduct} />}
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Start shopping</Text><Text style={styles.sectionHint}>Choose your path</Text></View>
      <View style={styles.homeStoreGrid}>
        <TouchableOpacity style={styles.homeStoreCard} onPress={() => { setSelectedProduct(null); setTab('Supermarket'); }} accessibilityRole="button" accessibilityLabel="Browse supermarket">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <InterfaceIcon name="grid" size={22} color={palette.primaryText} />
            <Text style={[styles.storeBlockName, { marginTop: 0, textAlign: 'center', flexShrink: 1 }]}>Supermarket</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeStoreCard} onPress={() => { setSelectedProduct(null); setStoreId('all'); setCategory('All'); setSearch(''); setTab('Shops'); }} accessibilityRole="button" accessibilityLabel="Browse shops by name">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <InterfaceIcon name="shop" size={24} color={palette.primaryText} />
            <Text style={[styles.storeBlockName, { marginTop: 0, textAlign: 'center', flexShrink: 1 }]}>Shop by name</Text>
          </View>
        </TouchableOpacity>
      </View>
      {locationShops.length ? <HomeShops key={`${deliveryLocation}-${refreshVersion}`} products={locationProducts} shops={locationShops} onSelect={openShop} /> : <Text style={styles.formNote}>Shop-by-name browsing needs seller and location details from the API.</Text>}
    </>;
  }

  function renderShop() {
    if (storeId !== 'all') return <>
      <TouchableOpacity style={styles.backButton} onPress={() => setTab('Shops')} accessibilityRole="button"><Text style={styles.backButtonText}>← Choose another shop</Text></TouchableOpacity>
      <Text style={styles.pageTitle}>{getStore(storeId).name}</Text>
      <Text style={styles.pageIntro}>{getStore(storeId).area}</Text>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder={`Search in ${getStore(storeId).name}`} placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel={`Search products in ${getStore(storeId).name}`} returnKeyType="search" />{search ? <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.clearSearch}>Clear</Text></TouchableOpacity> : null}</View>
      <SearchSuggestions query={search} products={locationProducts.filter((product) => product.store === storeId && (category === 'All' || product.category === category))} onSelect={setSearch} />
      <CategoryPicker styles={styles} value={sortBy} onChange={setSortBy} options={['Price: low to high', 'Price: high to low']} />
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{visibleProducts.length} {search.trim() ? 'results' : 'products'}</Text></View>
      <ProductGrid items={visibleProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} money={money} />
    </>;
    return <>
      <Text style={styles.pageTitle}>{storeId === 'all' ? 'Shop local' : getStore(storeId).name}</Text><Text style={styles.pageIntro}>Discover products from local shops.</Text>
      <View style={styles.filterPanel}>
        <View style={styles.filterPanelHeading}><Text style={styles.filterPanelTitle}>Search & filters</Text><Text style={styles.sectionHint}>Choose any combination</Text></View>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel="Search products" returnKeyType="search" /><TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.clearSearch}>{search ? 'Clear' : ''}</Text></TouchableOpacity></View>
      <SearchSuggestions query={search} products={locationProducts.filter((product) => (storeId === 'all' || product.store === storeId) && (category === 'All' || product.category === category))} onSelect={setSearch} />
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>STORE</Text><StorePicker styles={styles} stores={[stores[0], ...locationShops]} value={storeId} onChange={setStoreId} /></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>CATEGORY</Text><CategoryPicker styles={styles} value={category} onChange={setCategory} options={categories} /></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>SORT BY</Text><CategoryPicker styles={styles} value={sortBy} onChange={setSortBy} options={sortOptions} /></View>
      </View>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{visibleProducts.length} products</Text><Text style={styles.sectionHint}>{storeId === 'all' ? 'All stores' : getStore(storeId).name}</Text></View>
      <ProductGrid items={visibleProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} money={money} />
    </>;
  }

  function renderSupermarket() {
    const query = supermarketSearch.trim().toLowerCase();
    const categoryProducts = locationProducts.filter(product => supermarketCategory === null || product.category === supermarketCategory);
    const results = categoryProducts.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query));
    return <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedProduct(null); setTab('Home'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity>
      <Text style={styles.pageTitle}>Supermarket</Text><Text style={styles.pageIntro}>Browse the products returned by the NearBy catalogue.</Text>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={supermarketSearch} onChangeText={setSupermarketSearch} placeholder="Search products or categories" placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel="Search supermarket products or categories" returnKeyType="search" autoCapitalize="none" />
        {supermarketSearch ? <TouchableOpacity onPress={() => setSupermarketSearch('')} accessibilityRole="button" accessibilityLabel="Clear supermarket search"><Text style={styles.clearSearch}>Clear</Text></TouchableOpacity> : null}
      </View>
      <SearchSuggestions query={supermarketSearch} products={categoryProducts} onSelect={setSupermarketSearch} includeShopNames={false} />
      <View style={[styles.sectionHeading, { gap: 12 }]}><Text accessibilityRole="header" style={[styles.sectionTitle, { flex: 1 }]}>All products</Text><CategoryMenu options={categories} value={supermarketCategory} onChange={setSupermarketCategory} /></View>
      {results.length ? <ProductGrid columns={desktop ? undefined : 2} items={results} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} money={money} /> : <View style={styles.emptyState}><Text style={styles.emptyTitle}>No matching products</Text><Text style={styles.muted}>Try a different product or category.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => { setSupermarketSearch(''); setSupermarketCategory(null); }} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Clear search and filter</Text></TouchableOpacity></View>}
    </>;
  }

  function renderStores() {
    return <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedProduct(null); setTab('Home'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity>
      <Text style={styles.pageTitle}>Shop by name</Text><Text style={styles.pageIntro}>Choose the local shop you prefer before you add items to your cart.</Text>
      <View style={styles.storeTypePanel}>
        <Text style={styles.storeTypeLabel}>STORE TYPE</Text>
        <View style={styles.storeTypeRow}>
          {categories.map((type) => <TouchableOpacity key={type} onPress={() => setStoreCategory(type)} style={[styles.storeTypeButton, { minWidth: 130 }, storeCategory === type && styles.storeTypeSelected]} accessibilityRole="button" accessibilityState={{ selected: storeCategory === type }}>
            <Text style={[styles.storeTypeIcon, storeCategory === type && styles.storeTypeActiveText]}>{type === 'Bakery' ? '🥐' : type === 'Electronics' ? 'ϟ' : type === 'Computer Items' ? '▣' : type === 'Home Appliances' ? '⌂' : '▤'}</Text>
            <Text style={[styles.storeTypeText, storeCategory === type && styles.storeTypeActiveText]}>{type}</Text>
          </TouchableOpacity>)}
        </View>
      </View>
      {locationShops.filter((store) => products.some((product) => product.store === store.id && product.category === storeCategory)).map((store) => {
        const count = products.filter((product) => product.store === store.id).length;
        return <TouchableOpacity key={store.id} style={[styles.storeCard, storeId === store.id && styles.storeCardSelected]} onPress={() => openShop(store.id)} accessibilityRole="button">
          <Text style={styles.storeIcon}>{store.icon}</Text><View style={styles.storeCopy}><Text style={styles.storeName}>{store.name}</Text><Text style={styles.muted}>{store.area}</Text><Text style={styles.storeCount}>{count} products available  ·  Select store →</Text></View>
        </TouchableOpacity>;
      })}
      {!locationShops.some((store) => products.some((product) => product.store === store.id && product.category === storeCategory)) ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No {storeCategory.toLowerCase()} shops here yet</Text><Text style={styles.muted}>Try another store type or change your location.</Text></View> : null}
    </>;
  }

  function renderCart() {
    return <>
      <Text style={styles.pageTitle}>Your cart</Text>
      {basket.busy ? <Text style={styles.formNote}>Updating your saved cart…</Text> : null}
      {basket.error ? <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.noticeText}>{basket.error}</Text><TouchableOpacity disabled={basket.busy} onPress={basket.reload}><Text style={styles.backButtonText}>Reload saved cart</Text></TouchableOpacity></View> : null}
      <Text style={styles.pageIntro}>{cartCount} {cartCount === 1 ? 'item' : 'items'} in your bag</Text>
      {cartItems.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyEmoji}>🛒</Text><Text style={styles.emptyTitle}>Your cart is waiting</Text><Text style={styles.muted}>Add something you love from the shop.</Text><TouchableOpacity style={styles.heroButton} onPress={goToShop}><Text style={styles.heroButtonText}>Browse products</Text></TouchableOpacity></View> : <>
        {cartItems.map((line) => <View key={line.key} style={styles.cartRow}>
          <View style={styles.cartArt}><ProductPhoto product={line.product} /></View>
          <View style={styles.cartDetails}><Text style={styles.productName}>{line.product.name}</Text><Text style={styles.muted}>{money(line.price)} each{line.size ? ` · ${line.size}` : ''}</Text>
            {line.pending ? <><Text style={styles.formNote}>Not saved — check your saved cart before adding again.</Text><TouchableOpacity onPress={() => basket.removePending(line)}><Text style={styles.backButtonText}>Remove guest copy</Text></TouchableOpacity></> : null}
          </View>
          <View style={styles.qtyBox}><TouchableOpacity disabled={basket.busy || line.pending} onPress={() => changeQuantity(line, -1)} style={styles.qtyButton} accessibilityLabel={`Remove one ${line.product.name}`}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity><Text style={styles.qtyText}>{line.quantity}</Text><TouchableOpacity disabled={basket.busy || line.pending} onPress={() => changeQuantity(line, 1)} style={styles.qtyButton} accessibilityLabel={`Add one ${line.product.name}`}><Text style={styles.qtyButtonText}>+</Text></TouchableOpacity></View>
          <Text style={styles.lineTotal}>{money(line.price * line.quantity)}</Text>
        </View>)}
        <View style={styles.summaryCard}><View style={styles.summaryLine}><Text style={styles.muted}>Subtotal</Text><Text style={styles.summaryValue}>{money(subtotal)}</Text></View><View style={styles.summaryLine}><Text style={styles.muted}>Delivery</Text><Text style={styles.freeText}>{subtotal >= 999 ? 'FREE' : money(99)}</Text></View><View style={styles.divider} /><View style={styles.summaryLine}><Text style={styles.summaryTotalLabel}>Total</Text><Text style={styles.summaryTotal}>{money(subtotal + (subtotal >= 999 ? 0 : 99))}</Text></View><TouchableOpacity style={styles.primaryButton} onPress={continueToPayment}><Text style={styles.primaryButtonText}>Continue to payment</Text></TouchableOpacity><Text style={styles.checkoutNote}>Checkout is a demo. No payment will be taken.</Text></View>
      </>}
    </>;
  }

  function renderFavorites() {
    const items = locationProducts.filter((product) => favorites.includes(product.id));
    return <>
      <Text style={styles.pageTitle}>Wishlist</Text>
      <Text style={styles.pageIntro}>{items.length} saved {items.length === 1 ? 'item' : 'items'} · Your local favourites, ready when you are.</Text>
      {items.length ? <ProductGrid items={items} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} money={money} /> :
        <View style={styles.emptyState}><Text style={styles.emptyEmoji}>♡</Text><Text style={styles.emptyTitle}>Save something you love</Text><Text style={styles.muted}>Tap the heart on any product to add it here.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => setTab('Supermarket')}><Text style={styles.secondaryButtonText}>Explore all products</Text></TouchableOpacity></View>}
    </>;
  }

  function renderOrders() { return <><TouchableOpacity style={styles.backButton} onPress={() => { setTab('Home'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity><Text style={styles.pageTitle}>My orders</Text><Text style={styles.pageIntro}>Demo orders placed from this device.</Text>{orders.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyEmoji}>BOX</Text><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Orders appear here after checkout.</Text></View> : orders.map((order) => <View key={order.id} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{order.id}</Text><Text style={styles.muted}>{order.date} | {order.items.length} items | {money(order.total)} · {order.paymentMethod} · {order.paymentStatus}</Text></View></View>)}</>; }

  function renderHistory() { return <><Text style={styles.pageTitle}>History</Text><Text style={styles.pageIntro}>Purchases and recently viewed products.</Text>{orders.map((order) => <View key={order.id} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{order.id}</Text><Text style={styles.muted}>{order.date}</Text></View></View>)}<View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recently viewed</Text></View><ProductGrid items={recentViews} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} money={money} /></>; }

  function renderAccount() { return Platform.OS === 'web' ? <Redirect href={'/account' as Href} /> : <><Text style={styles.pageTitle}>Account settings</Text><Text style={styles.pageIntro}>Your profile and sign-in preferences.</Text><AccountSettings /></>; }

  function renderCustomerCare() { return <><Text style={styles.pageTitle}>Customer care</Text><Text style={styles.pageIntro}>Help for this demo store.</Text><View style={styles.menuCard}><View><Text style={styles.storeName}>Where is my order?</Text><Text style={styles.muted}>See My Orders after demo checkout.</Text></View></View><View style={styles.menuCard}><View><Text style={styles.storeName}>Can I pay online?</Text><Text style={styles.muted}>Checkout is a demo and takes no payment.</Text></View></View><Text style={styles.formNote}>Add a real support contact before publishing.</Text></>; }

  function renderMore() {
    const sections: Array<{ icon: string; title: string; tab: Tab }> = [
      { icon: 'F', title: 'Favourites', tab: 'Favorites' }, { icon: 'O', title: 'My orders', tab: 'Orders' },
      { icon: 'H', title: 'History', tab: 'History' }, { icon: 'A', title: 'Account settings', tab: 'Account' },
      { icon: 'C', title: 'Customer care', tab: 'Customer Care' },
    ];
    return <><Text style={styles.pageTitle}>More</Text><Text style={styles.pageIntro}>Saved items, orders, account, and help.</Text>{sections.map(section => <TouchableOpacity key={section.tab} style={styles.menuCard} onPress={() => chooseTab(section.tab)} accessibilityRole="button"><Text style={styles.menuIcon}>{section.icon}</Text><View style={styles.menuCopy}><Text style={styles.storeName}>{section.title}</Text></View><Text style={styles.menuArrow}>{'>'}</Text></TouchableOpacity>)}
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>JOB with NearBy</Text></View>
      {partnerDrawerLinks.map(item => <TouchableOpacity key={item.tab} style={styles.menuCard} onPress={() => chooseTab(item.tab)} accessibilityRole="button"><Text style={styles.menuIcon}>{item.icon}</Text><View style={styles.menuCopy}><Text style={styles.storeName}>{item.label}</Text></View><Text style={styles.menuArrow}>{'>'}</Text></TouchableOpacity>)}
    </>;
  }

  function renderPartnerRequest(role: PartnerRole) {
    const draftKey = `${customer?.id ?? 'guest'}:${role}`;
    return <PartnerRequest key={draftKey} role={role} name={customer?.name} email={customer?.email} location={deliveryLocation} draft={partnerDrafts[draftKey]}
      onSave={draft => { setPartnerDrafts(current => ({ ...current, [draftKey]: draft })); notify('Request draft saved for this session. Nothing has been sent.'); }}
      onBack={() => chooseTab('Home')} onScrollTop={() => pageScroll.current?.scrollTo({ y: 0, animated: false })} />;
  }
  function renderDetails() {
    const product = selectedProduct;
    if (!product) return null;
    const inCart = basket.lines.filter(line => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0);
    const remaining = availableQuantity(product.stock, inCart);
    const quantity = Math.min(selectedQuantity, Math.max(1, remaining));
    const unavailable = remaining === 0 || basket.busy || detailLoading || !!detailError;
    if (getStore(product.store).location && getStore(product.store).location !== deliveryLocation) return <>
      <Text style={styles.pageTitle}>{product.name}</Text>
      <View style={styles.emptyState}><Text style={styles.emptyTitle}>Unavailable in {deliveryLocation.split(',')[0]}</Text><Text style={styles.muted}>This item is sold by a shop in {getStore(product.store).location}. Change location to view it again.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedProduct(null)} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Back to browsing</Text></TouchableOpacity></View>
    </>;
    const relatedProducts = locationProducts
      .filter((item) => item.id !== product.id && item.category === product.category)
      .sort((a, b) => {
        const sameName = Number(b.name === product.name) - Number(a.name === product.name);
        return sameName || Math.abs(a.price - product.price) - Math.abs(b.price - product.price);
      })
      .slice(0, 6);
    return <>
      <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.backButton}><Text style={styles.backButtonText}>←  Back to shop</Text></TouchableOpacity>
      <ProductGallery key={`gallery-${product.id}`} product={product} artStyle={styles.detailArt} />
      <Text style={styles.formNote}>Up to 5 product images supplied by the store.</Text>
      {detailLoading ? <Text style={styles.muted}>Loading latest product details…</Text> : null}
      {detailError ? <View style={styles.notice}><Text style={styles.noticeText}>{detailError}</Text><TouchableOpacity onPress={() => openProduct(product)}><Text style={styles.backButtonText}>Retry details</Text></TouchableOpacity></View> : null}
      <Text style={styles.productCategory}>{product.category.toUpperCase()}  ·  ★ {product.rating || 'New'}</Text><Text style={styles.detailTitle}>{product.name}</Text><Text style={styles.detailPrice}>{money(product.price)}</Text>
      <Text style={styles.detailDescription}>{product.description || 'Product details will be added soon.'}</Text>
      <TouchableOpacity style={styles.detailFavorite} onPress={() => toggleFavorite(product.id)} accessibilityRole="button" accessibilityLabel={favorites.includes(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}><Text style={styles.detailFavoriteText}>{favorites.includes(product.id) ? '♥ Saved to wishlist · Remove' : '♡ Add to wishlist'}</Text></TouchableOpacity>
      {product.sizes?.length ? <><Text style={styles.inputLabel}>CHOOSE SIZE</Text><CategoryPicker styles={styles} value={selectedSize} onChange={setSelectedSize} options={product.sizes} /></> : null}
      <View style={{ marginVertical: 18, gap: 10 }}>
        <Text style={styles.inputLabel}>QUANTITY</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <View style={styles.qtyBox}>
            <TouchableOpacity disabled={unavailable || quantity <= 1} onPress={() => setSelectedQuantity(quantity - 1)} accessibilityRole="button" accessibilityLabel="Decrease quantity" style={[styles.qtyButton, { width: 44, height: 44, opacity: unavailable || quantity <= 1 ? 0.4 : 1 }]}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity>
            <Text accessibilityLiveRegion="polite" accessibilityLabel={`Quantity ${quantity}`} style={[styles.qtyText, { minWidth: 28, textAlign: 'center', fontSize: 16 }]}>{quantity}</Text>
            <TouchableOpacity disabled={unavailable || quantity >= remaining} onPress={() => setSelectedQuantity(quantity + 1)} accessibilityRole="button" accessibilityLabel="Increase quantity" style={[styles.qtyButton, { width: 44, height: 44, opacity: unavailable || quantity >= remaining ? 0.4 : 1 }]}><Text style={styles.qtyButtonText}>+</Text></TouchableOpacity>
          </View>
          {Number.isFinite(remaining) ? <Text style={styles.muted}>{remaining === 0 && product.stock !== 0 ? 'Available stock is already in your cart' : `${remaining} available to add`}</Text> : null}
        </View>
      </View>
      <TouchableOpacity disabled={unavailable} style={[styles.primaryButton, unavailable && { opacity: 0.5 }]} onPress={() => addToCart(product, quantity)} accessibilityRole="button" accessibilityState={{ disabled: unavailable }}><Text style={styles.primaryButtonText}>{product.stock === 0 ? 'Sold out' : remaining === 0 ? 'Stock already in cart' : `Add ${quantity} to cart · ${money(product.price * quantity)}`}</Text></TouchableOpacity>
      <ProductReviews key={`reviews-${product.id}`} reviews={productReviews[product.id] ?? []} onSubmit={(review) => setProductReviews((current) => ({ ...current, [product.id]: [review, ...(current[product.id] ?? [])] }))} />
      {relatedProducts.length > 0 ? <>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>You may also like</Text><Text style={styles.sectionHint}>{product.category.toUpperCase()}</Text></View>
        <ProductGrid items={relatedProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} money={money} />
      </> : null}
    </>;
  }

  const pageTitle = selectedProduct ? 'Product details' : tab;
  const primaryDrawerLinks: Array<{ icon: string; label: string; tab: Tab }> = [
    { icon: '⌂', label: 'Home', tab: 'Home' },
    { icon: '▦', label: 'Supermarket', tab: 'Supermarket' },
    { icon: '⌖', label: 'Shop by name', tab: 'Shops' },
    { icon: '▣', label: `Cart${cartCount ? ` (${cartCount})` : ''}`, tab: 'Cart' },
  ];
  const accountDrawerLinks: Array<{ icon: string; label: string; tab: Tab }> = [
    { icon: '⌖', label: 'Addresses', tab: 'Addresses' },
    { icon: '♡', label: `Wishlist (${favorites.length})`, tab: 'Favorites' },
    { icon: '◷', label: 'My orders', tab: 'Orders' },
    { icon: '◌', label: 'Account settings', tab: 'Account' },
    { icon: '?', label: 'Customer care', tab: 'Customer Care' },
  ];
  const partnerDrawerLinks: Array<{ icon: string; label: string; tab: Tab }> = [
    { icon: '▦', label: 'Become a shop owner', tab: 'Shop request' },
    { icon: '↗', label: 'Become a delivery partner', tab: 'Delivery request' },
  ];
  const drawerTranslateX = drawerProgress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });

  return (
    <View style={styles.screen}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {desktop ? <WebStoreHeader products={locationProducts} onProduct={openProduct} location={deliveryLocation} cartCount={cartCount} favorites={favorites.length} customerName={customer?.name} onNavigate={next => { setSelectedProduct(null); setTab(next); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} onSearch={query => { setSelectedProduct(null); setSupermarketCategory(null); setSupermarketSearch(query); setTab('Supermarket'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} onLocation={() => setLocationOpen(true)} onAccount={() => { if (customer) { setSelectedProduct(null); setTab('Account'); } else router.push('/login'); }} onMenu={openDrawer} /> : null}
      <ScrollView ref={pageScroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" alwaysBounceVertical refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPage} tintColor={palette.gold} colors={[palette.primary, palette.gold]} progressBackgroundColor={palette.surface} title="Refreshing your store…" titleColor={palette.primary} />}>
        {!desktop ? <><View style={styles.topBar}>
          <View style={styles.topBarStart}>
            <TouchableOpacity style={styles.brandRow} onPress={() => { setSelectedProduct(null); setTab('Home'); }} accessibilityRole="button" accessibilityLabel="NearBy home">
              <BrandLogo size={39} /><Text style={styles.brand}>Near<Text style={styles.brandAccent}>By</Text></Text>
            </TouchableOpacity>
          </View>
          <View style={styles.topBarEnd}>
            <TouchableOpacity activeOpacity={0.75} style={styles.topCart} onPress={() => { setSelectedProduct(null); setTab('Favorites'); }} accessibilityRole="button" accessibilityLabel={`Open wishlist, ${favorites.length} saved items`}><InterfaceIcon name="heart" color={palette.primaryText} />{favorites.length > 0 ? <Text style={styles.topCartText}>{favorites.length}</Text> : null}</TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} style={styles.topCart} onPress={() => { setSelectedProduct(null); setTab('Cart'); }} accessibilityRole="button" accessibilityLabel={`Open cart, ${cartCount} items`}><InterfaceIcon name="bag" color={palette.primaryText} />{cartCount > 0 ? <Text style={styles.topCartText}>{cartCount}</Text> : null}</TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} style={styles.menuToggle} onPress={openDrawer} accessibilityRole="button" accessibilityLabel="Open navigation menu"><InterfaceIcon name="menu" color={palette.primaryText} /></TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.locationBar} onPress={() => setLocationOpen(true)} accessibilityRole="button" accessibilityLabel={`Delivery location: ${deliveryLocation}. Change location`}>
          <Text style={styles.locationPin}>⌖</Text><View style={styles.locationCopy}><Text style={styles.localSignatureText}>DELIVER TO</Text><Text numberOfLines={1} style={styles.locationName}>{deliveryLocation}</Text></View><Text style={styles.locationChange}>Change ⌄</Text>
        </TouchableOpacity>
        </> : null}
        {catalogue.loading ? <View style={styles.notice}><Text style={styles.noticeText}>Loading catalogue…</Text></View> : null}
        {!catalogue.error && !catalogue.loading && !products.length ? <Text style={styles.formNote}>No products have been published yet.</Text> : null}
        {products.length ? <Text style={styles.formNote}>Shop and delivery coverage have not been supplied for these products.</Text> : null}
        <Text accessibilityLabel={`${pageTitle} page`} style={styles.srOnly}>{pageTitle}</Text>
        {selectedProduct ? renderDetails() : tab === 'Home' ? renderHome() : tab === 'Shop' ? renderShop() : tab === 'Supermarket' ? renderSupermarket() : tab === 'Shops' ? renderStores() : tab === 'Cart' ? renderCart() : tab === 'Addresses' ? <AddressBook addresses={addresses} selectedId={selectedAddressId} location={deliveryLocation} onSave={(address) => { setAddresses((current) => [...current, address]); useAddress(address.id); }} onSelect={useAddress} onRemove={(id) => { setAddresses((current) => current.filter((address) => address.id !== id)); if (selectedAddressId === id) setSelectedAddressId(null); }} onBack={() => setTab(addressReturnTab)} /> : tab === 'Payment' && customer ? <PaymentSection address={deliveryAddress} onManageAddress={() => { setAddressReturnTab('Payment'); setTab('Addresses'); }} subtotal={subtotal} itemCount={cartCount} location={deliveryLocation} method={paymentMethod} onChange={setPaymentMethod} onBack={() => setTab('Cart')} onConfirm={placeDemoOrder} canOrder={false} /> : tab === 'Favorites' ? renderFavorites() : tab === 'Orders' ? renderOrders() : tab === 'History' ? renderHistory() : tab === 'Account' ? renderAccount() : tab === 'Customer Care' ? renderCustomerCare() : tab === 'Shop request' ? renderPartnerRequest('shop') : tab === 'Delivery request' ? renderPartnerRequest('delivery') : renderMore()}
        {desktop ? <View style={{ marginTop: 56, paddingTop: 30, paddingBottom: 12, borderTopWidth: 1, borderColor: palette.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
          <View style={{ maxWidth: 360 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><BrandLogo size={48} /><Text style={styles.brand}>NearBy</Text></View><Text style={[styles.pageIntro, { marginTop: 12 }]}>Your town. Your shops. Your doorstep.</Text><Text style={styles.muted}>Shopping local in {deliveryLocation}.</Text></View>
          <View style={{ gap: 14 }}><Text style={styles.storeName}>Explore</Text>{([{ label: 'Supermarket', target: 'Supermarket' }, { label: 'Shop by name', target: 'Shops' }, { label: 'Wishlist', target: 'Favorites' }] as const).map(link => <TouchableOpacity key={link.target} accessibilityRole="button" onPress={() => { setSelectedProduct(null); setTab(link.target); pageScroll.current?.scrollTo({ y: 0, animated: false }); }}><Text style={styles.changeLink}>{link.label}</Text></TouchableOpacity>)}</View>
          <View style={{ gap: 14 }}><Text style={styles.storeName}>Your account</Text>{([{ label: 'My orders', target: 'Orders' }, { label: 'Addresses', target: 'Addresses' }, { label: 'Customer care', target: 'Customer Care' }] as const).map(link => <TouchableOpacity key={link.target} accessibilityRole="button" onPress={() => { setSelectedProduct(null); setTab(link.target); pageScroll.current?.scrollTo({ y: 0, animated: false }); }}><Text style={styles.changeLink}>{link.label}</Text></TouchableOpacity>)}</View>
        </View> : null}
      </ScrollView>
      <Modal visible={locationOpen} transparent animationType="fade" onRequestClose={() => setLocationOpen(false)}>
        <KeyboardAvoidingView style={styles.locationOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.drawerTapLayer} onPress={() => setLocationOpen(false)} accessibilityRole="button" accessibilityLabel="Close location selector" />
          <View style={styles.locationDialog} accessibilityViewIsModal>
            <View style={styles.drawerHeader}><Text style={styles.drawerBrand}>Delivery location</Text><TouchableOpacity onPress={() => setLocationOpen(false)} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Close location selector"><Text style={styles.drawerCloseText}>×</Text></TouchableOpacity></View>
            <Text style={styles.muted}>Choose your area to see its shops and available products.</Text>
            {(['Thodupuzha, Idukki', 'Muttom, Idukki'] as const).map((location) => <TouchableOpacity key={location} style={[styles.storeCard, deliveryLocation === location && styles.storeCardSelected]} accessibilityRole="button" accessibilityState={{ selected: deliveryLocation === location }} onPress={() => { setDeliveryLocation(location); setLocationOpen(false); }}><Text style={styles.locationPin}>⌖</Text><Text style={styles.storeName}>{location}</Text>{deliveryLocation === location ? <Text style={styles.changeLink}>✓</Text> : null}</TouchableOpacity>)}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {drawerOpen ? <View style={styles.drawerLayer}>
        <Animated.View pointerEvents="none" style={[styles.drawerBackdrop, { opacity: drawerProgress }]} />
        <Pressable style={styles.drawerTapLayer} onPress={closeDrawer} accessibilityRole="button" accessibilityLabel="Close navigation menu" />
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerTranslateX }] }]}>
          <View style={styles.drawerHeader}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><BrandLogo size={38} /><View><Text style={styles.drawerBrand}>NearBy</Text><Text style={styles.drawerSub}>THODUPUZHA · KERALA</Text></View></View><TouchableOpacity onPress={closeDrawer} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Close navigation menu"><Text style={styles.drawerCloseText}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          <View style={styles.drawerDelivery}><Text style={styles.drawerDeliveryIcon}>◷</Text><Text style={styles.drawerDeliveryText}>Delivery within 12 hours</Text></View>
          <TouchableOpacity style={styles.drawerAuth} onPress={() => { closeDrawer(); if (customer) { setSelectedProduct(null); setTab('Account'); } else router.push('/login' as Href); }} accessibilityRole="button"><Text style={styles.drawerAuthKicker}>NearBy ACCOUNT</Text><Text style={styles.drawerAuthText}>{customer ? customer.name : 'Sign in or create account  →'}</Text></TouchableOpacity>
          {primaryDrawerLinks.map((item) => <TouchableOpacity key={item.tab} style={[styles.drawerItem, tab === item.tab && styles.drawerItemActive]} onPress={() => chooseTab(item.tab)} accessibilityRole="button" accessibilityState={{ selected: tab === item.tab }}><Text style={[styles.drawerItemIcon, tab === item.tab && styles.drawerItemTextActive]}>{item.icon}</Text><Text style={[styles.drawerItemText, tab === item.tab && styles.drawerItemTextActive]}>{item.label}</Text></TouchableOpacity>)}
          <View style={styles.drawerDivider} /><Text style={styles.drawerSectionLabel}>YOUR NearBy</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {(['light', 'dark'] as const).map((option) => <TouchableOpacity key={option} onPress={() => setMode(option)} accessibilityRole="button" accessibilityLabel={`${option} mode`} accessibilityState={{ selected: mode === option }} style={[styles.storeTypeButton, mode === option && styles.storeTypeSelected]}><Text style={[styles.storeTypeText, mode === option && styles.storeTypeActiveText]}>{option === 'light' ? '☀ Light' : '☾ Dark'}</Text></TouchableOpacity>)}
          </View>
          {accountDrawerLinks.map((item) => <TouchableOpacity key={item.tab} style={[styles.drawerItem, tab === item.tab && styles.drawerItemActive]} onPress={() => chooseTab(item.tab)} accessibilityRole="button" accessibilityState={{ selected: tab === item.tab }}><Text style={[styles.drawerItemIcon, tab === item.tab && styles.drawerItemTextActive]}>{item.icon}</Text><Text style={[styles.drawerItemText, tab === item.tab && styles.drawerItemTextActive]}>{item.label}</Text></TouchableOpacity>)}
          <View style={styles.drawerDivider} /><Text style={styles.drawerSectionLabel}>JOB with NearBy</Text>
          {partnerDrawerLinks.map(item => <TouchableOpacity key={item.tab} style={[styles.drawerItem, tab === item.tab && styles.drawerItemActive]} onPress={() => chooseTab(item.tab)} accessibilityRole="button" accessibilityState={{ selected: tab === item.tab }}><Text style={[styles.drawerItemIcon, tab === item.tab && styles.drawerItemTextActive]}>{item.icon}</Text><Text style={[styles.drawerItemText, tab === item.tab && styles.drawerItemTextActive]}>{item.label}</Text></TouchableOpacity>)}
          </ScrollView>
          {customer ? <TouchableOpacity accessibilityRole="button" onPress={logout} style={[styles.drawerItem, { flexShrink: 0, marginTop: 8, marginBottom: 12, borderTopWidth: 1, borderTopColor: palette.border, borderRadius: 0 }]}><Text style={[styles.drawerItemText, { color: palette.terracotta }]}>Log out</Text></TouchableOpacity> : null}
        </Animated.View>
      </View> : null}
    </View>
  );
}

