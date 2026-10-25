export type AdminRole = 'super_admin' | 'manager' | 'host';

export interface AdminRecord {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  createdAt?: unknown;
}

export type ReservationStatus =
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'no_show';

export interface ReservationRecord {
  id: string;
  referenceCode: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "18:30"
  servicePeriod: string;
  partySize: number;
  tableId: string;
  tableLabel: string;
  zoneId: string;
  zoneName: string;
  guestName: string;
  guestEmail: string;
  whatsapp: string;
  country: string;
  occasion: string;
  dietaryNotes: string;
  specialRequests: string;
  status: ReservationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReservationHoldRecord {
  id: string;
  slotId: string;
  date: string;
  time: string;
  tableId: string;
  sessionId: string;
  expiresAtMs: number;
  createdAt?: unknown;
}

export type SlotLockStatus = 'available' | 'held' | 'reserved' | 'occupied';

export interface AvailabilitySlotRecord {
  id: string; // `${date}_${time}_${tableId}`
  date: string;
  time: string;
  tableId: string;
  status: SlotLockStatus;
  holdExpiresAtMs: number;
  sessionId: string;
  referenceCode: string;
  updatedAt?: unknown;
}

export type TableShape = 'round' | 'square' | 'diamond' | 'rectangle';

export interface CafeTable {
  id: string;
  label: string;
  number: number;
  capacity: number;
  minGuests: number;
  zoneId: string;
  zoneName: string;
  shape: TableShape;
  x: number; // 0-100 percentage on floor plan canvas
  y: number; // 0-100 percentage on floor plan canvas
  isVip: boolean;
  isActive: boolean;
  notes: string;
  updatedAt?: unknown;
}

export interface SeatingZone {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  atmosphere: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: unknown;
}

export interface OpeningHoursConfig {
  id: string;
  dayOfWeek: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  gracePeriodMinutes: number;
  updatedAt?: unknown;
}

export interface BlockedDateRecord {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string;
  isFullDay: boolean;
  blockedSlots: string[];
  createdAt?: unknown;
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  priceLkr: number;
  priceUsd: number;
  imageUrl: string; // Base64 Data URL or editorial key
  dietaryTags: string[];
  isFeatured: boolean;
  isAvailable: boolean;
  updatedAt?: unknown;
}

export type GalleryCategory =
  | 'Architecture'
  | 'Culinary'
  | 'Coffee & Botanicals'
  | 'Evening Sanctuary'
  | 'Sigiriya Surroundings';

export interface GalleryItem {
  id: string;
  title: string;
  category: GalleryCategory;
  caption: string;
  imageUrl: string; // Base64 Data URL or editorial key
  aspectRatio: '16:9' | '4:3' | '3:4' | '1:1';
  isFeatured: boolean;
  sortOrder: number;
  createdAt?: unknown;
}

export interface CafeEvent {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  category: string;
  description: string;
  imageUrl: string; // Base64 Data URL or editorial key
  priceInfo: string;
  isFeatured: boolean;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface SiteContentSection {
  id: string;
  sectionKey: string;
  kicker: string;
  heading: string;
  subheading: string;
  body: string;
  ctaLabel: string;
  ctaLink: string;
  imageUrl: string; // Base64 Data URL or editorial key
  updatedAt?: unknown;
}

export interface CafeSettings {
  id: string;
  cafeName: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  coordinates: string;
  gracePeriodMinutes: number;
  holdDurationMinutes: number;
  maxPartySize: number;
  sameDayCutoffHour: number;
  bookingPolicy: string;
  heroImages?: string[]; // Multiple Base64 or editorial images for hero slideshow
  heroSlideshowSpeedSeconds?: number; // Speed in seconds per slide
  floorPlanImageUrl?: string; // Custom drone shot Base64 image for floor plan
  googleMapsEmbedUrl?: string; // Google Maps embed URL, iframe code, share link, or query
  mapTitle?: string; // Section title for the map
  mapSubtitle?: string; // Section subtitle or location description
  updatedAt?: unknown;
}

export type InquiryStatus = 'new' | 'in_progress' | 'resolved' | 'archived';

export interface InquiryRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogRecord {
  id: string;
  actorEmail: string;
  actorUid: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt?: unknown;
}
