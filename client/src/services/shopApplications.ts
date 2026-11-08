import { apiRequest } from '../lib/api';
import { preparePartnerDraft, type PartnerDraft } from '../features/storefront/utils/partnerRequests';

export async function applyForShop(draft: PartnerDraft, token: string) {
  if (!token.trim()) throw new Error('Sign in before submitting your shop request.');
  if (draft.role !== 'shop') throw new Error('This endpoint accepts shop requests only.');
  const fields = preparePartnerDraft('shop', draft);
  const response = await apiRequest('/api/shops/apply', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: fields.shopName, phone: fields.phone, email: fields.email,
      addressLine: fields.address, location: fields.areas[0].split(',')[0].trim(), categories: fields.categories,
      description: [`Contact: ${fields.fullName}`, fields.note].filter(Boolean).join('\n') }),
  });
  const result = await response.json();
  if (result?.success !== true || !result.data || typeof result.data._id !== 'string') throw new Error(result?.message || 'The submission could not be confirmed. Check with support before submitting again.');
  return { id: result.data._id as string, status: typeof result.data.status === 'string' ? result.data.status : 'Submitted' };
}
