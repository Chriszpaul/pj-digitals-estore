import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Product } from '../data/types';
import { productImages } from '../data/product-images';
import { useStoreTheme } from '../ThemeContext';
import { galleryImages } from '../utils/productOptions';
import ProductPhoto from './ProductPhoto';

export default function ProductGallery({ product, artStyle }: { product: Product; artStyle: StyleProp<ViewStyle> }) {
  const { palette: c } = useStoreTheme();
  const images = galleryImages(product.images, productImages[product.id]);
  const [selected, setSelected] = useState<string>();
  const index = Math.max(0, images.indexOf(selected ?? ''));
  return <View style={styles.gallery}>
    <View style={artStyle}><ProductPhoto product={product} imageUri={images[index]} /></View>
    {images.length ? <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous product image" disabled={index === 0} onPress={() => setSelected(images[index - 1])} style={[styles.arrow, { backgroundColor: c.soft, opacity: index === 0 ? 0.4 : 1 }]}><Text style={{ color: c.primaryText, fontSize: 22 }}>‹</Text></Pressable>
      <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 12 }}>Image {index + 1} of {images.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next product image" disabled={index === images.length - 1} onPress={() => setSelected(images[index + 1])} style={[styles.arrow, { backgroundColor: c.soft, opacity: index === images.length - 1 ? 0.4 : 1 }]}><Text style={{ color: c.primaryText, fontSize: 22 }}>›</Text></Pressable>
    </View> : null}
    {images.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
      {images.map((uri, imageIndex) => <Pressable key={uri} accessibilityRole="button" accessibilityLabel={`View image ${imageIndex + 1} of ${images.length} for ${product.name}`} accessibilityState={{ selected: imageIndex === index }} onPress={() => setSelected(uri)} style={[styles.thumbnail, { borderColor: imageIndex === index ? c.primary : c.border, backgroundColor: c.surface }]}>
        <ProductPhoto product={product} imageUri={uri} />
      </Pressable>)}
    </ScrollView> : null}
  </View>;
}

const styles = StyleSheet.create({
  gallery: { width: '100%', marginBottom: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10 },
  arrow: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thumbnails: { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  thumbnail: { width: 64, height: 64, borderWidth: 2, borderRadius: 12, padding: 3 },
});
