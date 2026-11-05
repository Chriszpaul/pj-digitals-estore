import { View } from 'react-native';
import Text from './AppText';

export default function InterfaceIcon({ name, color, size = 18 }: { name: 'bag' | 'menu' | 'heart' | 'grid' | 'shop'; color: string; size?: number }) {
  return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {name === 'menu' ? <View style={{ gap: 4 }}>{[0, 1, 2].map(line => <View key={line} style={{ width: size * 0.8, height: 1.5, borderRadius: 1, backgroundColor: color }} />)}</View> : null}
    {name === 'bag' ? <><View style={{ position: 'absolute', top: 0, width: size * 0.4, height: size * 0.4, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.18 }} /><View style={{ position: 'absolute', bottom: 0, width: size * 0.8, height: size * 0.72, borderWidth: 1.5, borderColor: color, borderRadius: 3 }} /></> : null}
    {name === 'heart' ? <Text style={{ color, fontSize: size * 1.35, lineHeight: size * 1.4, marginTop: -2 }}>♡</Text> : null}
    {name === 'grid' ? <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: size * 0.12 }}>{[0, 1, 2, 3].map(tile => <View key={tile} style={{ width: size * 0.43, height: size * 0.43, borderWidth: 1.5, borderColor: color, borderRadius: 3 }} />)}</View> : null}
    {name === 'shop' ? <><View style={{ position: 'absolute', top: size * 0.1, width: size * 0.9, height: size * 0.3, borderWidth: 1.5, borderColor: color, borderRadius: 3 }} /><View style={{ position: 'absolute', bottom: size * 0.05, width: size * 0.7, height: size * 0.55, borderWidth: 1.5, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} /><View style={{ position: 'absolute', bottom: size * 0.05, width: size * 0.2, height: size * 0.35, borderWidth: 1.5, borderBottomWidth: 0, borderColor: color }} /></> : null}
  </View>;
}
