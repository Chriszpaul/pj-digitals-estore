import type { DeliveryLocation } from '../data/types';
import { categories as catalogueCategories } from '../data/catalog';

export type PartnerRole = 'shop' | 'delivery';
export const partnerCategories = catalogueCategories;
export const vehicleTypes = ['Bike', 'Scooter'] as const;
export const partnerAreas: DeliveryLocation[] = ['Thodupuzha', 'Muttom'];
export type PartnerFields = {
  fullName: string; phone: string; email: string; shopName: string; address: string;
  categories: (typeof partnerCategories[number])[]; areas: DeliveryLocation[];
  vehicle: typeof vehicleTypes[number]; vehicleNumber: string; note: string;
};
export type PartnerDraft = PartnerFields & { role: PartnerRole };

export function preparePartnerDraft(role: PartnerRole, fields: PartnerFields): PartnerDraft {
  const fullName = fields.fullName.trim();
  let phone = fields.phone.replace(/[\s()+-]/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  const email = fields.email.trim();
  if (fullName.length < 2) throw new Error('Enter your full name.');
  if (!/^\d{10}$/.test(phone)) throw new Error('Enter a valid 10-digit phone number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address or leave it blank.');
  const areas = [...new Set(fields.areas)];
  if (!areas.length || areas.some(area => !partnerAreas.includes(area))) throw new Error('Choose your service area.');
  const categories = [...new Set(fields.categories)];
  if (role === 'shop') {
    if (fields.shopName.trim().length < 2) throw new Error('Enter your shop name.');
    if (fields.address.trim().length < 8) throw new Error('Enter the full shop address.');
    if (areas.length !== 1) throw new Error('Choose one location for your shop.');
    if (!categories.length || categories.some(category => !partnerCategories.includes(category))) throw new Error('Choose at least one shop category.');
  } else if (!vehicleTypes.includes(fields.vehicle)) throw new Error('Choose Bike or Scooter as your vehicle type.');
  return { ...fields, role, fullName, phone, email, shopName: fields.shopName.trim(), address: fields.address.trim(), areas, categories, vehicleNumber: fields.vehicleNumber.trim(), note: fields.note.trim() };
}
