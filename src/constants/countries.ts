// src/constants/countries.ts
// Centralized list of ISO 3166-1 alpha-2 country codes with localized names.
// Used throughout the app for sign‑up, vendor onboarding, address selection, shipping, etc.

export const countries: Record<string, { code: string; nameEn: string }> = {
  IQ: { code: 'IQ', nameEn: 'Iraq' },
  SA: { code: 'SA', nameEn: 'Saudi Arabia' },
  AE: { code: 'AE', nameEn: 'United Arab Emirates' },
  JO: { code: 'JO', nameEn: 'Jordan' },
  KW: { code: 'KW', nameEn: 'Kuwait' },
  QA: { code: 'QA', nameEn: 'Qatar' },
  LB: { code: 'LB', nameEn: 'Lebanon' },
  EG: { code: 'EG', nameEn: 'Egypt' },
  US: { code: 'US', nameEn: 'United States' },
  GB: { code: 'GB', nameEn: 'United Kingdom' },
  DE: { code: 'DE', nameEn: 'Germany' },
  FR: { code: 'FR', nameEn: 'France' },
  TR: { code: 'TR', nameEn: 'Turkey' },
  CN: { code: 'CN', nameEn: 'China' },
  IN: { code: 'IN', nameEn: 'India' },
  CA: { code: 'CA', nameEn: 'Canada' },
  AU: { code: 'AU', nameEn: 'Australia' },
  // Add more as needed.
};

export const countryOptions = Object.values(countries).map((c) => ({ value: c.code, label: c.nameEn }));
