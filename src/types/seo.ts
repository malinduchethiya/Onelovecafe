export type SeoKeywordCategoryKey =
  | 'brand'
  | 'local_cafe'
  | 'breakfast_brunch'
  | 'coffee_beverages'
  | 'dining_cuisine'
  | 'tourism_destination'
  | 'reservations_experiences'
  | 'alternative_spellings'
  | 'sinhala'
  | 'tamil';

export interface SeoKeywordCategory {
  key: SeoKeywordCategoryKey;
  label: string;
  description: string;
  keywords: string[];
}

export type SeoPageKey =
  | 'home'
  | 'menu'
  | 'reserve'
  | 'story'
  | 'gallery'
  | 'contact'
  | 'events';

export interface PageSeoConfig {
  id: SeoPageKey;
  routePath: string;
  pageLabel: string;
  title: string;
  metaDescription: string;
  canonicalPath: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  indexable: boolean;
  updatedAt?: unknown;
}

export interface GlobalSeoConfig {
  id: string; // 'main'
  siteName: string;
  alternateNames: string[];
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  canonicalDomain: string;
  language: string;
  googleVerificationTag: string;
  defaultOgImageUrl: string;
  brandLogoUrl: string;
  faviconSourceUrl: string;
  favicon48Url: string;
  favicon96Url: string;
  favicon192Url: string;
  appleTouchIconUrl: string;
  allowIndexing: boolean;
  noindexPreviewDomains: boolean;
  businessType: 'CafeOrCoffeeShop' | 'Restaurant';
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  latitude: number;
  longitude: number;
  telephone: string;
  whatsapp: string;
  email: string;
  priceRange: string;
  servesCuisine: string[];
  openingHoursSpec: string;
  socialLinks: string[];
  customKeywords: string[];
  imageAltOverrides: Record<string, string>;
  updatedAt?: unknown;
}
