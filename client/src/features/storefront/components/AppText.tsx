import { Platform, Text } from 'react-native';
import type { TextProps } from 'react-native';

export default function AppText(props: TextProps) {
  const fontFamily = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'Aptos, Segoe UI, sans-serif' });
  return <Text {...props} style={[{ fontFamily }, props.style]} />;
}
