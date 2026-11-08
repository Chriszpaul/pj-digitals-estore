import { apiRequest } from '../lib/api';
import { preparePartnerDraft, type PartnerDraft } from '../features/storefront/utils/partnerRequests';

export async function applyForDelivery(draft: PartnerDraft, token: string) {
  if (!token.trim()) throw new Error('Sign in before submitting your delivery request.');
  if (draft.role !== 'delivery') throw new Error('This endpoint accepts delivery requests only.');
  const fields = preparePartnerDraft('delivery', draft);
  const response = await apiRequest('/api/delivery/apply', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fullName: fields.fullName, phone: fields.phone,
      vehicleType: fields.vehicle.toLowerCase(), vehicleNumber: fields.vehicleNumber,
      serviceLocations: fields.areas.map(area => area.split(',')[0].trim()) }),
  });
  const result = await response.json();
  if (result?.success !== true || !result.data || typeof result.data._id !== 'string') throw new Error(result?.message || 'The submission could not be confirmed. Check with support before submitting again.');
  return { id: result.data._id as string, status: typeof result.data.status === 'string' ? result.data.status : 'Submitted' };
}
