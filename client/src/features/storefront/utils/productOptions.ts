export function galleryImages(images?: string[], fallback?: string): string[] {
  const unique = [...new Set((images ?? []).map(image => image.trim()).filter(Boolean))];
  return (unique.length ? unique : fallback ? [fallback] : []).slice(0, 5);
}

export function availableQuantity(stock: number | undefined, inCart: number): number {
  return stock === undefined ? Infinity : Math.max(0, stock - inCart);
}

export function validatePurchaseQuantity(quantity: number, stock: number | undefined, inCart: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Choose a positive whole-number quantity.');
  if (quantity > availableQuantity(stock, inCart)) throw new Error('Not enough stock is available.');
}
