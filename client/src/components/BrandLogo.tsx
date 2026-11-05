import { Image } from 'react-native';

const logo = require('../../assets/images/Neon Purple Marketplace Delivery Icon.png');

export default function BrandLogo({ size = 40 }: { size?: number }) {
  return <Image source={logo} resizeMode="contain" accessibilityLabel="NearBy logo" style={{ width: size, height: size, flexShrink: 0 }} />;
}
