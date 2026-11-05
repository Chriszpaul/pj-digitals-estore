import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../data/types';
import { productImages } from '../data/product-images';

export default function ProductPhoto({ product }: { product: Product }) {
  const uri = product.images?.[0] || productImages[product.id];
  const [failed, setFailed] = useState<string | undefined>();
  return <View style={styles.frame}>
    {uri && failed !== uri ? <Image source={{ uri }} resizeMode="contain" style={styles.image} accessibilityLabel={product.name} onError={() => setFailed(uri)} /> : <Text style={styles.fallback}>Image unavailable</Text>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: '100%', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10 },
  image: { width: '100%', height: '100%' }, fallback: { fontSize: 10, color: '#806A57', textAlign: 'center' },
});
