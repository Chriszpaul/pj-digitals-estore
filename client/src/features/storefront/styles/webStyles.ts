import type { createStyles } from './appStyles';

export function createWebStyles(base: ReturnType<typeof createStyles>, width: number) {
  if (width < 900) return base;
  const columns = 4;
  const cardWidth = `${(100 - (columns - 1) * 2) / columns}%` as `${number}%`;
  return {
    ...base,
    page: { ...base.page, maxWidth: 1360, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 52 },
    hero: { ...base.hero, minHeight: 320, padding: 36, borderRadius: 24 },
    featuredShopAd: { ...base.featuredShopAd, minHeight: 320 },
    adContent: { ...base.adContent, minHeight: 246 },
    adTitle: { ...base.adTitle, fontSize: 44, lineHeight: 50, maxWidth: 650, minHeight: 100 },
    adDescription: { ...base.adDescription, fontSize: 14, lineHeight: 22, maxWidth: 570 },
    adBadge: { ...base.adBadge, width: 140, height: 140, borderRadius: 36, right: 70, top: 60 },
    adBadgeText: { ...base.adBadgeText, fontSize: 10, marginTop: 6 },
    adGlow: { ...base.adGlow, width: 420, height: 420, borderRadius: 210, right: -40, top: -40 },
    productGrid: { ...base.productGrid, gap: undefined, columnGap: '2%' as `${number}%`, rowGap: 24 },
    productCard: { ...base.productCard, width: cardWidth, flexBasis: cardWidth, flexGrow: 0, maxWidth: undefined },
    productArt: { ...base.productArt, height: width >= 1280 ? 205 : 180 },
    productInfo: { ...base.productInfo, padding: 18 },
    productCategory: { ...base.productCategory, fontSize: 10 },
    productName: { ...base.productName, fontSize: 15, marginTop: 9 },
    productPrice: { ...base.productPrice, fontSize: 20, marginTop: 10 },
    stockLine: { ...base.stockLine, fontSize: 11 },
    addButton: { ...base.addButton, minHeight: 42, marginTop: 16 },
    addButtonText: { ...base.addButtonText, fontSize: 12 },
    sectionTitle: { ...base.sectionTitle, fontSize: 26 },
    sectionHeading: { ...base.sectionHeading, marginTop: 32, marginBottom: 20 },
    sectionHint: { ...base.sectionHint, fontSize: 11 },
    homeStoreCard: { ...base.homeStoreCard, minHeight: 100 },
    storeBlockName: { ...base.storeBlockName, fontSize: 18 },
    pageTitle: { ...base.pageTitle, fontSize: 32 },
    pageIntro: { ...base.pageIntro, fontSize: 14, lineHeight: 22 },
    detailArt: { ...base.detailArt, height: 380, maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const },
    filterPanel: { ...base.filterPanel, padding: 22 },
    cartRow: { ...base.cartRow, padding: 20, gap: 20 },
    cartArt: { ...base.cartArt, width: 90, height: 90 },
    drawer: { ...base.drawer, paddingTop: 26, maxWidth: 360 },
  };
}
