import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  getDoc,
  query,
  limit,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_EMAILS,
  isAuthorizedAdminEmail,
  handleFirestoreError,
  OperationType,
  logAdminAction,
} from '../lib/firebase';
import { fileToCompressedBase64 } from '../lib/imageBase64';
import {
  CafeSettings,
  SeatingZone,
  CafeTable,
  OpeningHoursConfig,
  BlockedDateRecord,
  MenuCategory,
  MenuItem,
  GalleryItem,
  CafeEvent,
  SiteContentSection,
  AvailabilitySlotRecord,
  ReservationRecord,
  InquiryRecord,
  AdminRecord,
  AuditLogRecord,
  R2MediaManifest,
} from '../types/cafe';
import {
  DEFAULT_SETTINGS,
  DEFAULT_ZONES,
  DEFAULT_TABLES,
  DEFAULT_OPENING_HOURS,
  DEFAULT_MENU_CATEGORIES,
  DEFAULT_MENU_ITEMS,
  DEFAULT_GALLERY,
  DEFAULT_EVENTS,
  DEFAULT_SITE_CONTENT,
} from '../data/seedData';
import { GlobalSeoConfig, PageSeoConfig, SeoPageKey } from '../types/seo';
import { DEFAULT_GLOBAL_SEO, DEFAULT_PAGE_SEO } from '../data/seoDefaults';

interface HoldResult {
  slotId: string;
  expiresAtMs: number;
}

export interface ConfirmReservationInput {
  date: string;
  time: string;
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
}

interface CafeContextValue {
  user: User | null;
  isAdmin: boolean;
  authReady: boolean;
  sessionId: string;
  settings: CafeSettings;
  zones: SeatingZone[];
  tables: CafeTable[];
  openingHours: OpeningHoursConfig[];
  blockedDates: BlockedDateRecord[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  gallery: GalleryItem[];
  events: CafeEvent[];
  siteContent: SiteContentSection[];
  availability: AvailabilitySlotRecord[];
  seoGlobal: GlobalSeoConfig;
  seoPages: Record<SeoPageKey, PageSeoConfig>;
  r2Manifest: R2MediaManifest;
  // Admin-only collections
  reservations: ReservationRecord[];
  inquiries: InquiryRecord[];
  admins: AdminRecord[];
  auditLogs: AuditLogRecord[];
  // Auth actions
  signInAdmin: () => Promise<void>;
  signOutAdmin: () => Promise<void>;
  // Reservation & Public actions
  holdTableSlot: (date: string, time: string, tableId: string) => Promise<HoldResult>;
  confirmReservation: (input: ConfirmReservationInput) => Promise<ReservationRecord>;
  submitInquiry: (input: {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
  }) => Promise<void>;
  // Admin actions
  seedDatabaseIfNeeded: () => Promise<void>;
  updateReservationStatus: (
    reservation: ReservationRecord,
    newStatus: ReservationRecord['status']
  ) => Promise<void>;
  saveTable: (table: CafeTable) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  saveZone: (zone: SeatingZone) => Promise<void>;
  deleteZone: (zoneId: string) => Promise<void>;
  saveOpeningHours: (config: OpeningHoursConfig) => Promise<void>;
  saveBlockedDate: (blocked: BlockedDateRecord) => Promise<void>;
  deleteBlockedDate: (id: string) => Promise<void>;
  saveMenuCategory: (cat: MenuCategory) => Promise<void>;
  deleteMenuCategory: (id: string) => Promise<void>;
  saveMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  saveGalleryItem: (item: GalleryItem) => Promise<void>;
  deleteGalleryItem: (id: string) => Promise<void>;
  saveEvent: (evt: CafeEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  saveSiteContent: (section: SiteContentSection) => Promise<void>;
  saveSettings: (settings: CafeSettings) => Promise<void>;
  saveSeoGlobal: (config: GlobalSeoConfig) => Promise<void>;
  saveSeoPage: (page: PageSeoConfig) => Promise<void>;
  resetSeoToDefaults: () => Promise<void>;
  updateInquiryStatus: (inquiry: InquiryRecord, status: InquiryRecord['status']) => Promise<void>;
  uploadMediaFile: (file: File, folder?: string, previousUrl?: string) => Promise<string>;
  deleteMediaFromR2: (urlOrUrls: string | string[]) => Promise<void>;
  updateCollageImageFromDevice: (slotIndex: number, file: File) => Promise<void>;
  resetCollageImage: (slotIndex: number) => Promise<void>;
  storageStatus: {
    configured: boolean;
    provider: string;
    bucket?: string | null;
    publicUrl?: string | null;
    manifestUrl?: string | null;
  } | null;
  checkStorageStatus: () => Promise<void>;
}

const CafeContext = createContext<CafeContextValue | null>(null);

function getOrCreateSessionId(): string {
  const key = 'onelove_session_id';
  const existing = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  if (existing && /^[a-zA-Z0-9_-]{6,60}$/.test(existing)) return existing;
  const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, created);
  }
  return created;
}

function readLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(value);
    // Always remove old entry first so a QuotaExceededError never leaves stale old images in localStorage
    window.localStorage.removeItem(key);
    window.localStorage.setItem(key, serialized);
  } catch {
    // If localStorage is full, ensure the stale key remains cleared so fresh state/IndexedDB is used
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

const INITIAL_SETTINGS: CafeSettings = {
  ...DEFAULT_SETTINGS,
  heroImages: [],
};

const INITIAL_R2_MANIFEST: R2MediaManifest = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  heroImages: DEFAULT_SETTINGS.heroImages || ['editorial:hero-sanctuary'],
  heroSlideshowSpeedSeconds: DEFAULT_SETTINGS.heroSlideshowSpeedSeconds || 5,
  floorPlanImageUrl: '',
  menuImages: {},
  galleryItems: DEFAULT_GALLERY.map((g) => ({ ...g })),
  eventImages: {},
  sectionImages: {},
  seoImages: {},
};

const INITIAL_MENU_ITEMS: MenuItem[] = DEFAULT_MENU_ITEMS.map((item) => ({
  ...item,
  imageUrl: '',
}));

const INITIAL_GALLERY: GalleryItem[] = DEFAULT_GALLERY.map((g) => ({
  ...g,
  imageUrl: '',
}));

const INITIAL_EVENTS: CafeEvent[] = DEFAULT_EVENTS.map((e) => ({
  ...e,
  imageUrl: '',
}));

const INITIAL_SITE_CONTENT: SiteContentSection[] = DEFAULT_SITE_CONTENT.map((s) => ({
  ...s,
  imageUrl: s.sectionKey.startsWith('story_collage_') ? s.imageUrl : '',
}));

function mergeSiteContentWithDefaults(cached: SiteContentSection[]): SiteContentSection[] {
  const map = new Map<string, SiteContentSection>();
  cached.forEach((sec) => map.set(sec.sectionKey, sec));
  DEFAULT_SITE_CONTENT.forEach((def) => {
    const existing = map.get(def.sectionKey);
    if (!existing) {
      map.set(def.sectionKey, {
        ...def,
        imageUrl: def.sectionKey.startsWith('story_collage_') ? def.imageUrl : '',
      });
    } else if (def.sectionKey.startsWith('story_collage_') && !existing.imageUrl) {
      map.set(def.sectionKey, {
        ...existing,
        imageUrl: def.imageUrl,
      });
    }
  });
  return Array.from(map.values());
}

function generateReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'OL-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const CafeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionId] = useState<string>(getOrCreateSessionId);

  const [r2Manifest, setR2Manifest] = useState<R2MediaManifest>(() =>
    readLocalCache('onelove_cache_r2Manifest', INITIAL_R2_MANIFEST)
  );

  const [settings, setSettings] = useState<CafeSettings>(() => {
    const cached = readLocalCache('onelove_cache_settings', INITIAL_SETTINGS);
    if (!cached.googleMapsEmbedUrl || cached.googleMapsEmbedUrl.includes('7.9541,80.7547')) {
      return { ...cached, googleMapsEmbedUrl: DEFAULT_SETTINGS.googleMapsEmbedUrl };
    }
    return cached;
  });
  const [zones, setZones] = useState<SeatingZone[]>(() =>
    readLocalCache('onelove_cache_zones', DEFAULT_ZONES)
  );
  const [tables, setTables] = useState<CafeTable[]>(() =>
    readLocalCache('onelove_cache_tables', DEFAULT_TABLES)
  );
  const [openingHours, setOpeningHours] = useState<OpeningHoursConfig[]>(DEFAULT_OPENING_HOURS);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRecord[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(() =>
    readLocalCache('onelove_cache_categories', DEFAULT_MENU_CATEGORIES)
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    readLocalCache('onelove_cache_menuItems', INITIAL_MENU_ITEMS)
  );
  const [gallery, setGallery] = useState<GalleryItem[]>(() =>
    readLocalCache('onelove_cache_gallery', INITIAL_GALLERY)
  );
  const [events, setEvents] = useState<CafeEvent[]>(() =>
    readLocalCache('onelove_cache_events', INITIAL_EVENTS)
  );
  const [siteContent, setSiteContent] = useState<SiteContentSection[]>(() =>
    mergeSiteContentWithDefaults(readLocalCache('onelove_cache_siteContent', INITIAL_SITE_CONTENT))
  );
  const [availability, setAvailability] = useState<AvailabilitySlotRecord[]>([]);
  const [seoGlobal, setSeoGlobal] = useState<GlobalSeoConfig>(() => {
    const cached = readLocalCache('onelove_cache_seoGlobal', DEFAULT_GLOBAL_SEO);
    return {
      ...DEFAULT_GLOBAL_SEO,
      ...cached,
      defaultTitle:
        !cached.defaultTitle || cached.defaultTitle.includes('Breakfast, Brunch & Coffee')
          ? DEFAULT_GLOBAL_SEO.defaultTitle
          : cached.defaultTitle,
      defaultDescription:
        !cached.defaultDescription ||
        cached.defaultDescription.includes('Enjoy specialty coffee, fresh smoothie bowls')
          ? DEFAULT_GLOBAL_SEO.defaultDescription
          : cached.defaultDescription,
      telephone:
        !cached.telephone || cached.telephone === '+94 66 228 6410'
          ? DEFAULT_GLOBAL_SEO.telephone
          : cached.telephone,
      alternateNames: Array.from(
        new Set([
          ...(DEFAULT_GLOBAL_SEO.alternateNames || []),
          ...(cached.alternateNames || []),
        ])
      ),
    };
  });
  const [seoPages, setSeoPages] = useState<Record<SeoPageKey, PageSeoConfig>>(() => {
    const cached = readLocalCache('onelove_cache_seoPages', DEFAULT_PAGE_SEO);
    const homePage = cached.home || DEFAULT_PAGE_SEO.home;
    return {
      ...DEFAULT_PAGE_SEO,
      ...cached,
      home: {
        ...DEFAULT_PAGE_SEO.home,
        ...homePage,
        title:
          !homePage.title || homePage.title.includes('Breakfast, Brunch & Coffee')
            ? DEFAULT_PAGE_SEO.home.title
            : homePage.title,
        ogTitle:
          !homePage.ogTitle ||
          homePage.ogTitle.includes('Breakfast, Brunch & Specialty Coffee') ||
          homePage.ogTitle.includes('Breakfast, Brunch & Coffee')
            ? DEFAULT_PAGE_SEO.home.ogTitle
            : homePage.ogTitle,
        metaDescription:
          !homePage.metaDescription ||
          homePage.metaDescription.includes('Enjoy specialty coffee, fresh smoothie bowls')
            ? DEFAULT_PAGE_SEO.home.metaDescription
            : homePage.metaDescription,
        ogDescription:
          !homePage.ogDescription ||
          homePage.ogDescription.includes('Tropical garden café, specialty Ceylon coffee roastery')
            ? DEFAULT_PAGE_SEO.home.ogDescription
            : homePage.ogDescription,
      },
    };
  });

  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  const autoSeededRef = useRef(false);
  const autoMigratedLegacyRef = useRef(false);

  // 1. Auth & Admin Role Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          await currentUser.getIdToken();
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes('token-service-api') || errMsg.includes('disabled')) {
            console.warn('Stale auth token detected. Resetting auth session:', errMsg);
            await firebaseSignOut(auth).catch(() => {});
            setUser(null);
            setIsAdmin(false);
            setAuthReady(true);
            return;
          }
        }
      }

      setUser(currentUser);
      if (!currentUser || !currentUser.emailVerified) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      if (isAuthorizedAdminEmail(currentUser.email)) {
        setIsAdmin(true);
        setAuthReady(true);
        // Ensure admin document exists in `/admins/${currentUser.uid}`
        try {
          const adminDocRef = doc(db, 'admins', currentUser.uid);
          const adminSnap = await getDoc(adminDocRef);
          if (!adminSnap.exists()) {
            await setDoc(adminDocRef, {
              email: (currentUser.email || '').toLowerCase().trim(),
              name: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin'),
              role: 'super_admin',
              createdAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal if offline or already recorded
        }
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdmin(adminSnap.exists());
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Cloudflare R2 Media Manifest Sync (100% R2 Image Reading & Writing — Zero Firestore Image Access)
  const r2ManifestRef = useRef<R2MediaManifest>(r2Manifest);
  useEffect(() => {
    r2ManifestRef.current = r2Manifest;
  }, [r2Manifest]);

  const fetchR2Manifest = useCallback(async () => {
    try {
      const res = await fetch('/api/storage/manifest?refresh=1');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.manifest) {
          const m = data.manifest as R2MediaManifest;
          const normalized: R2MediaManifest = {
            version: typeof m.version === 'number' ? m.version : 1,
            updatedAt: m.updatedAt || new Date().toISOString(),
            heroImages: Array.isArray(m.heroImages) ? m.heroImages : [],
            heroSlideshowSpeedSeconds:
              typeof m.heroSlideshowSpeedSeconds === 'number' ? m.heroSlideshowSpeedSeconds : 5,
            floorPlanImageUrl: typeof m.floorPlanImageUrl === 'string' ? m.floorPlanImageUrl : '',
            menuImages: m.menuImages && typeof m.menuImages === 'object' ? m.menuImages : {},
            galleryItems: Array.isArray(m.galleryItems) ? m.galleryItems : [],
            eventImages: m.eventImages && typeof m.eventImages === 'object' ? m.eventImages : {},
            sectionImages: m.sectionImages && typeof m.sectionImages === 'object' ? m.sectionImages : {},
            seoImages:
              m.seoImages && typeof m.seoImages === 'object'
                ? {
                    defaultOgImageUrl: m.seoImages.defaultOgImageUrl || '',
                    brandLogoUrl: m.seoImages.brandLogoUrl || '',
                    pageOgImages: m.seoImages.pageOgImages || {},
                  }
                : { defaultOgImageUrl: '', brandLogoUrl: '', pageOgImages: {} },
          };
          r2ManifestRef.current = normalized;
          setR2Manifest(normalized);
          writeLocalCache('onelove_cache_r2Manifest', normalized);
          if (normalized.galleryItems.length > 0) {
            setGallery(normalized.galleryItems);
            writeLocalCache('onelove_cache_gallery', normalized.galleryItems);
          }
          return;
        }
      }
      // Direct R2 CDN fallback if /api/storage/manifest is unavailable on static host
      const cdnRes = await fetch(
        `https://cdn.onelovecafesigiriya.com/manifest/site-media.json?t=${Date.now()}`
      );
      if (cdnRes.ok) {
        const m = (await cdnRes.json()) as R2MediaManifest;
        if (m && typeof m === 'object') {
          r2ManifestRef.current = m;
          setR2Manifest(m);
          writeLocalCache('onelove_cache_r2Manifest', m);
          if (Array.isArray(m.galleryItems) && m.galleryItems.length > 0) {
            setGallery(m.galleryItems);
            writeLocalCache('onelove_cache_gallery', m.galleryItems);
          }
        }
      }
    } catch (err) {
      console.warn('R2 manifest fetch warning:', err);
    }
  }, []);

  const updateR2Manifest = useCallback(
    async (
      updater: (prev: R2MediaManifest) => R2MediaManifest,
      deleteUrls: string[] = []
    ): Promise<R2MediaManifest> => {
      const next = updater(r2ManifestRef.current);
      next.updatedAt = new Date().toISOString();
      r2ManifestRef.current = next;
      setR2Manifest(next);
      writeLocalCache('onelove_cache_r2Manifest', next);
      if (Array.isArray(next.galleryItems)) {
        setGallery(next.galleryItems);
        writeLocalCache('onelove_cache_gallery', next.galleryItems);
      }

      try {
        const res = await fetch('/api/storage/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manifest: next,
            deleteUrls: deleteUrls.filter(
              (u) => typeof u === 'string' && u.startsWith('http') && !u.startsWith('editorial:')
            ),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.manifest) {
            r2ManifestRef.current = data.manifest;
            setR2Manifest(data.manifest);
            writeLocalCache('onelove_cache_r2Manifest', data.manifest);
          }
        }
      } catch (err) {
        console.error('Failed to persist R2 manifest to Cloudflare R2:', err);
      }
      return next;
    },
    []
  );

  const deleteMediaFromR2 = useCallback(async (urlOrUrls: string | string[]) => {
    const rawList = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    const validUrls = rawList.filter(
      (u) => typeof u === 'string' && u.startsWith('http') && !u.startsWith('editorial:')
    );
    if (validUrls.length === 0) return;
    try {
      await fetch('/api/storage/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls }),
      });
    } catch (err) {
      console.warn('Failed to delete media object from R2:', err);
    }
  }, []);

  useEffect(() => {
    fetchR2Manifest();
  }, [fetchR2Manifest]);

  // 2b. Non-Image Real-Time Listeners (Text, Pricing, Tables, Hours & Reservations only — ZERO Image Reads from Firestore)
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'settings'),
        (snap) => {
          const mainDoc = snap.docs.find((d) => d.id === 'main');
          if (mainDoc) {
            const data = mainDoc.data() as Omit<CafeSettings, 'id'>;
            const nextSettings: CafeSettings = {
              ...DEFAULT_SETTINGS,
              id: mainDoc.id,
              ...data,
              // Images are NEVER read from Firestore; they come exclusively from Cloudflare R2 (r2Manifest)
              heroImages: [],
              heroSlideshowSpeedSeconds:
                typeof data.heroSlideshowSpeedSeconds === 'number'
                  ? data.heroSlideshowSpeedSeconds
                  : DEFAULT_SETTINGS.heroSlideshowSpeedSeconds,
              floorPlanImageUrl: '',
              googleMapsEmbedUrl:
                !data.googleMapsEmbedUrl || data.googleMapsEmbedUrl.includes('7.9541,80.7547')
                  ? DEFAULT_SETTINGS.googleMapsEmbedUrl
                  : data.googleMapsEmbedUrl,
            };
            setSettings(nextSettings);
            writeLocalCache('onelove_cache_settings', nextSettings);
          } else if (!snap.metadata.fromCache) {
            setSettings(INITIAL_SETTINGS);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'settings')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'seatingZones'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<SeatingZone, 'id'>) }))
              .sort((a, b) => a.sortOrder - b.sortOrder);
            setZones(list);
            writeLocalCache('onelove_cache_zones', list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'seatingZones')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'tables'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<CafeTable, 'id'>) }))
              .sort((a, b) => a.number - b.number);
            setTables(list);
            writeLocalCache('onelove_cache_tables', list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'tables')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'openingHours'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<OpeningHoursConfig, 'id'>),
            }));
            setOpeningHours(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'openingHours')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'blockedDates'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BlockedDateRecord, 'id'>),
          }));
          setBlockedDates(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'blockedDates')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'menuCategories'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<MenuCategory, 'id'>) }))
              .sort((a, b) => a.sortOrder - b.sortOrder);
            setMenuCategories(list);
            writeLocalCache('onelove_cache_categories', list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'menuCategories')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'menuItems'),
        (snap) => {
          if (!snap.empty) {
            const deletedIds = new Set<string>(
              readLocalCache<string[]>('onelove_deleted_menu_ids', [])
            );
            // Strip imageUrl when reading from Firestore — menu item images load 100% from Cloudflare R2
            const list = snap.docs
              .filter((d) => !deletedIds.has(d.id))
              .map((d) => {
                const raw = d.data() as Omit<MenuItem, 'id'>;
                return {
                  id: d.id,
                  ...raw,
                  imageUrl: '',
                };
              });
            const existingIds = new Set(list.map((m) => m.id));
            const missingDefaults = INITIAL_MENU_ITEMS.filter(
              (def) => !existingIds.has(def.id) && !deletedIds.has(def.id)
            );
            const merged = [...list, ...missingDefaults];
            setMenuItems(merged);
            writeLocalCache('onelove_cache_menuItems', merged);
          } else if (!snap.metadata.fromCache) {
            setMenuItems(INITIAL_MENU_ITEMS);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'menuItems')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'events'),
        (snap) => {
          if (!snap.empty) {
            const deletedIds = new Set<string>(
              readLocalCache<string[]>('onelove_deleted_event_ids', [])
            );
            // Strip imageUrl when reading from Firestore — event images load 100% from Cloudflare R2
            const list = snap.docs
              .filter((d) => !deletedIds.has(d.id))
              .map((d) => {
                const raw = d.data() as Omit<CafeEvent, 'id'>;
                return {
                  id: d.id,
                  ...raw,
                  imageUrl: '',
                };
              });
            const existingIds = new Set(list.map((e) => e.id));
            const missingDefaults = INITIAL_EVENTS.filter(
              (def) => !existingIds.has(def.id) && !deletedIds.has(def.id)
            );
            const merged = [...list, ...missingDefaults];
            setEvents(merged);
            writeLocalCache('onelove_cache_events', merged);
          } else if (!snap.metadata.fromCache) {
            setEvents(INITIAL_EVENTS);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'events')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'siteContent'),
        (snap) => {
          if (!snap.empty) {
            // Ignore legacy hero_slide_* chunks, deduplicate by sectionKey, and strip imageUrl from Firestore siteContent
            const byKey = new Map<string, SiteContentSection>();
            INITIAL_SITE_CONTENT.forEach((def) => {
              byKey.set(def.sectionKey, { ...def, imageUrl: '' });
            });
            snap.docs
              .filter((d) => !d.id.startsWith('sec_hero_slide_'))
              .forEach((d) => {
                const raw = d.data() as Omit<SiteContentSection, 'id'>;
                const key = raw.sectionKey || d.id;
                if (key.startsWith('hero_slide_')) return;
                byKey.set(key, {
                  id: d.id,
                  ...raw,
                  sectionKey: key,
                  imageUrl: '',
                });
              });
            const merged = Array.from(byKey.values());
            setSiteContent(merged);
            writeLocalCache('onelove_cache_siteContent', merged);
          } else if (!snap.metadata.fromCache) {
            setSiteContent(INITIAL_SITE_CONTENT);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'siteContent')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'availability'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AvailabilitySlotRecord, 'id'>),
          }));
          setAvailability(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'availability')
      )
    );

    // Real-time Reservations Sync: Automatically frees tables when reservations are cancelled or rejected
    const releasedReservationIds = new Set<string>();
    unsubs.push(
      onSnapshot(
        collection(db, 'reservations'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ReservationRecord, 'id'>) }))
            .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
          setReservations(list);

          snap.docChanges().forEach((change) => {
            if (change.type === 'removed') return;
            const res = {
              id: change.doc.id,
              ...(change.doc.data() as Omit<ReservationRecord, 'id'>),
            };
            if (res.status === 'cancelled' || res.status === 'rejected') {
              const releaseKey = `${res.id}_${res.status}`;
              if (releasedReservationIds.has(releaseKey)) return;
              releasedReservationIds.add(releaseKey);

              const normTime = res.time.replace(/[^a-zA-Z0-9]/g, '-');
              const slotId = `${res.date}_${normTime}_${res.tableId}`;

              const hasOtherActiveReservation = list.some(
                (other) =>
                  other.id !== res.id &&
                  other.date === res.date &&
                  other.tableId === res.tableId &&
                  (other.time === res.time ||
                    other.time.replace(/[^a-zA-Z0-9]/g, '-') === normTime) &&
                  (other.status === 'confirmed' || other.status === 'seated')
              );

              if (!hasOtherActiveReservation && change.type === 'modified') {
                setDoc(
                  doc(db, 'availability', slotId),
                  {
                    date: res.date.slice(0, 10),
                    time: res.time.slice(0, 10),
                    tableId: res.tableId.slice(0, 40),
                    status: 'available',
                    holdExpiresAtMs: 0,
                    sessionId: '',
                    referenceCode: '',
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true }
                ).catch(() => {});
              }
            }
          });
        },
        (err) => console.warn('Reservation sync note:', err)
      )
    );

    // 11. Global SEO Configuration Real-Time Listener (Text only — SEO images come from Cloudflare R2)
    unsubs.push(
      onSnapshot(
        collection(db, 'seoConfig'),
        (snap) => {
          const mainDoc = snap.docs.find((d) => d.id === 'main');
          if (mainDoc) {
            const data = mainDoc.data() as Omit<GlobalSeoConfig, 'id'>;
            const mergedGlobal: GlobalSeoConfig = {
              ...DEFAULT_GLOBAL_SEO,
              ...data,
              id: 'main',
              defaultOgImageUrl: DEFAULT_GLOBAL_SEO.defaultOgImageUrl,
              brandLogoUrl: DEFAULT_GLOBAL_SEO.brandLogoUrl,
              defaultTitle:
                !data.defaultTitle || data.defaultTitle.includes('Breakfast, Brunch & Coffee')
                  ? DEFAULT_GLOBAL_SEO.defaultTitle
                  : data.defaultTitle,
              defaultDescription:
                !data.defaultDescription ||
                data.defaultDescription.includes('Enjoy specialty coffee, fresh smoothie bowls')
                  ? DEFAULT_GLOBAL_SEO.defaultDescription
                  : data.defaultDescription,
              telephone:
                !data.telephone || data.telephone === '+94 66 228 6410'
                  ? DEFAULT_GLOBAL_SEO.telephone
                  : data.telephone,
              alternateNames: Array.from(
                new Set([
                  ...(DEFAULT_GLOBAL_SEO.alternateNames || []),
                  ...(data.alternateNames || []),
                ])
              ),
            };
            setSeoGlobal(mergedGlobal);
            writeLocalCache('onelove_cache_seoGlobal', mergedGlobal);
          } else if (!snap.metadata.fromCache) {
            setSeoGlobal(DEFAULT_GLOBAL_SEO);
          }
        },
        (err) => console.warn('SEO config sync note:', err)
      )
    );

    // 12. Per-Page SEO Configuration Real-Time Listener (Text only — Page OG images come from Cloudflare R2)
    unsubs.push(
      onSnapshot(
        collection(db, 'seoPages'),
        (snap) => {
          if (!snap.empty) {
            const nextMap: Record<SeoPageKey, PageSeoConfig> = { ...DEFAULT_PAGE_SEO };
            snap.docs.forEach((d) => {
              const key = d.id as SeoPageKey;
              if (key in nextMap) {
                const rawPage = d.data() as Omit<PageSeoConfig, 'id'>;
                const mergedPage: PageSeoConfig = {
                  ...DEFAULT_PAGE_SEO[key],
                  ...rawPage,
                  id: key,
                  ogImageUrl: DEFAULT_PAGE_SEO[key].ogImageUrl,
                };
                if (key === 'home') {
                  if (
                    !mergedPage.title ||
                    mergedPage.title.includes('Breakfast, Brunch & Coffee')
                  ) {
                    mergedPage.title = DEFAULT_PAGE_SEO.home.title;
                  }
                  if (
                    !mergedPage.ogTitle ||
                    mergedPage.ogTitle.includes('Breakfast, Brunch & Specialty Coffee') ||
                    mergedPage.ogTitle.includes('Breakfast, Brunch & Coffee')
                  ) {
                    mergedPage.ogTitle = DEFAULT_PAGE_SEO.home.ogTitle;
                  }
                  if (
                    !mergedPage.metaDescription ||
                    mergedPage.metaDescription.includes(
                      'Enjoy specialty coffee, fresh smoothie bowls'
                    )
                  ) {
                    mergedPage.metaDescription = DEFAULT_PAGE_SEO.home.metaDescription;
                  }
                  if (
                    !mergedPage.ogDescription ||
                    mergedPage.ogDescription.includes(
                      'Tropical garden café, specialty Ceylon coffee roastery'
                    )
                  ) {
                    mergedPage.ogDescription = DEFAULT_PAGE_SEO.home.ogDescription;
                  }
                }
                nextMap[key] = mergedPage;
              }
            });
            setSeoPages(nextMap);
            writeLocalCache('onelove_cache_seoPages', nextMap);
          } else if (!snap.metadata.fromCache) {
            setSeoPages(DEFAULT_PAGE_SEO);
          }
        },
        (err) => console.warn('SEO pages sync note:', err)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // Cloudflare R2 Storage Status
  const [storageStatus, setStorageStatus] = useState<{
    configured: boolean;
    provider: string;
    bucket?: string | null;
    publicUrl?: string | null;
  } | null>(null);

  const checkStorageStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/storage/status');
      if (res.ok) {
        const data = await res.json();
        setStorageStatus({
          configured: Boolean(data.configured),
          provider: data.provider || 'inline',
          bucket: data.bucket || null,
          publicUrl: data.publicUrl || null,
        });
      }
    } catch {
      setStorageStatus({ configured: false, provider: 'inline' });
    }
  }, []);

  useEffect(() => {
    checkStorageStatus();
  }, [checkStorageStatus]);

  // Seed initial sanctuary data (non-image records in Firestore, gallery in Cloudflare R2)
  const seedDatabaseIfNeeded = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { id: settingId, ...settingData } = DEFAULT_SETTINGS;
      await setDoc(doc(db, 'settings', settingId), {
        ...settingData,
        heroImages: [],
        heroSlideshowSpeedSeconds: settingData.heroSlideshowSpeedSeconds || 5,
        floorPlanImageUrl: '',
        updatedAt: serverTimestamp(),
      });

      for (const z of DEFAULT_ZONES) {
        const { id, ...data } = z;
        await setDoc(doc(db, 'seatingZones', id), { ...data, updatedAt: serverTimestamp() });
      }

      for (const t of DEFAULT_TABLES) {
        const { id, ...data } = t;
        await setDoc(doc(db, 'tables', id), { ...data, updatedAt: serverTimestamp() });
      }

      for (const oh of DEFAULT_OPENING_HOURS) {
        const { id, ...data } = oh;
        await setDoc(doc(db, 'openingHours', id), { ...data, updatedAt: serverTimestamp() });
      }

      for (const cat of DEFAULT_MENU_CATEGORIES) {
        const { id, ...data } = cat;
        await setDoc(doc(db, 'menuCategories', id), { ...data, updatedAt: serverTimestamp() });
      }

      for (const item of DEFAULT_MENU_ITEMS) {
        const { id, ...data } = item;
        await setDoc(doc(db, 'menuItems', id), {
          ...data,
          imageUrl: '',
          updatedAt: serverTimestamp(),
        });
      }

      for (const evt of DEFAULT_EVENTS) {
        const { id, ...data } = evt;
        await setDoc(doc(db, 'events', id), {
          ...data,
          imageUrl: '',
          updatedAt: serverTimestamp(),
        });
      }

      for (const sc of DEFAULT_SITE_CONTENT) {
        const { id, ...data } = sc;
        await setDoc(doc(db, 'siteContent', id), {
          ...data,
          imageUrl: '',
          updatedAt: serverTimestamp(),
        });
      }

      await logAdminAction(
        'SEED_SANCTUARY_DATA',
        'settings',
        'main',
        'Initialized default OneLove Café Sigiriya text, tables, menu, and zones (zero images in Firestore)'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seedDatabase');
    }
  }, [isAdmin]);

  // 3. Protected Admin Real-Time Listeners & Auto-Bootstrap Seeding
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setInquiries([]);
      setAdmins([]);
      setAuditLogs([]);
      return;
    }

    // Automatically seed initial collections if Firestore is completely empty on first admin login,
    // and ensure the 4 new default dishes for the 4x4 grid are added once if upgrading from 12 items.
    if (!autoSeededRef.current) {
      autoSeededRef.current = true;
      getDoc(doc(db, 'settings', 'main'))
        .then(async (snap) => {
          if (!snap.exists()) {
            await seedDatabaseIfNeeded().catch(() => {});
          } else {
            const newFourIds = [
              'item_haputale_coldbrew',
              'item_pol_roti_brunch',
              'item_seared_modha_fish',
              'item_passionfruit_curd_tart',
            ];
            const checkDoc = await getDoc(doc(db, 'menuItems', newFourIds[0]));
            const upgradedFlag =
              typeof window !== 'undefined'
                ? window.localStorage.getItem('onelove_4x4_grid_seeded')
                : '1';
            if (!checkDoc.exists() && !upgradedFlag) {
              for (const defItem of DEFAULT_MENU_ITEMS) {
                if (newFourIds.includes(defItem.id)) {
                  const { id: did, ...ddata } = defItem;
                  await setDoc(doc(db, 'menuItems', did), {
                    ...ddata,
                    imageUrl: '',
                    updatedAt: serverTimestamp(),
                  }).catch(() => {});
                }
              }
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('onelove_4x4_grid_seeded', '1');
              }
            }
          }
        })
        .catch(() => {});
    }

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'inquiries'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<InquiryRecord, 'id'>),
          }));
          setInquiries(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'inquiries')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'admins'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AdminRecord, 'id'>),
          }));
          setAdmins(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'auditLogs'), limit(25)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditLogRecord, 'id'>),
          }));
          setAuditLogs(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, isAdmin, seedDatabaseIfNeeded]);

  const signInAdmin = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutAdmin = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  // Transaction-safe 10-minute table hold
  const holdTableSlot = useCallback(
    async (date: string, time: string, tableId: string): Promise<HoldResult> => {
      const safeDate = (date || '').trim().slice(0, 10);
      const safeTime = (time || '').trim().slice(0, 10);
      const safeTableId = (tableId || 'T1').trim().slice(0, 40);
      const normalizedTime = safeTime.replace(/[^a-zA-Z0-9]/g, '-');
      const slotId = `${safeDate}_${normalizedTime}_${safeTableId}`;
      const slotRef = doc(db, 'availability', slotId);
      const holdRef = doc(db, 'reservationHolds', slotId);
      const nowMs = Date.now();
      const holdDurationMs = (settings.holdDurationMinutes || 10) * 60 * 1000;
      const expiresAtMs = nowMs + holdDurationMs;

      try {
        await runTransaction(db, async (tx) => {
          const slotSnap = await tx.get(slotRef);
          if (slotSnap.exists()) {
            const data = slotSnap.data() as AvailabilitySlotRecord;
            if (data.status === 'reserved' || data.status === 'occupied') {
              // Check if any active reservation (status == 'confirmed' or 'seated') still occupies this slot
              const hasActiveReservation = reservations.some(
                (r) =>
                  r.date === safeDate &&
                  r.tableId === safeTableId &&
                  (r.time === safeTime ||
                    r.time.replace(/[^a-zA-Z0-9]/g, '-') === normalizedTime) &&
                  (r.status === 'confirmed' || r.status === 'seated')
              );
              if (hasActiveReservation) {
                throw new Error('This table has just been reserved by another guest.');
              }
              // If the reservation was cancelled or rejected, this table is free for a new reservation!
            }
            if (
              data.status === 'held' &&
              data.sessionId !== sessionId &&
              data.holdExpiresAtMs > nowMs
            ) {
              throw new Error('This table is currently being held by another guest.');
            }
          }

          tx.set(slotRef, {
            date: safeDate,
            time: safeTime,
            tableId: safeTableId,
            status: 'held',
            holdExpiresAtMs: Math.round(expiresAtMs),
            sessionId: sessionId.slice(0, 80),
            referenceCode: 'HOLD',
            updatedAt: serverTimestamp(),
          });

          tx.set(holdRef, {
            slotId: slotId.slice(0, 80),
            date: safeDate,
            time: safeTime,
            tableId: safeTableId,
            sessionId: sessionId.slice(0, 80),
            expiresAtMs: Math.round(expiresAtMs),
            createdAt: serverTimestamp(),
          });
        });

        return { slotId, expiresAtMs };
      } catch (error) {
        if (error instanceof Error && error.message.includes('another guest')) {
          throw error;
        }
        console.warn('Non-blocking hold fallback:', error);
        return { slotId, expiresAtMs };
      }
    },
    [sessionId, settings.holdDurationMinutes, reservations]
  );

  // Direct Firestore Reservation Confirmation (Synced with Android Admin Companion App)
  const confirmReservation = useCallback(
    async (input: ConfirmReservationInput): Promise<ReservationRecord> => {
      const safeDate = (input.date || '').trim().slice(0, 10);
      const safeTime = (input.time || '18:30').trim().slice(0, 10);
      const safeServicePeriod = (input.servicePeriod || 'Evening Sanctuary').trim().slice(0, 40);
      const safePartySize = Math.min(20, Math.max(1, Math.round(Number(input.partySize) || 2)));
      const safeTableId = (input.tableId || 'T1').trim().slice(0, 40);
      const safeTableLabel = (input.tableLabel || 'Table 01').trim().slice(0, 40);
      const safeZoneId = (input.zoneId || 'zone_verandah').trim().slice(0, 40);
      const safeZoneName = (input.zoneName || 'Jungle Canopy Verandah').trim().slice(0, 60);
      const safeGuestName = (input.guestName || '').trim().slice(0, 100);
      const safeGuestEmail = (input.guestEmail || '').trim().slice(0, 120);
      const safeWhatsapp = (input.whatsapp || '').trim().slice(0, 30);
      const safeCountry = (input.country || 'Sri Lanka').trim().slice(0, 80);
      const safeOccasion = (input.occasion || '').trim().slice(0, 60);
      const safeDietaryNotes = (input.dietaryNotes || '').trim().slice(0, 500);
      const safeSpecialRequests = (input.specialRequests || '').trim().slice(0, 500);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate)) {
        throw new Error('Please select a valid reservation date (YYYY-MM-DD).');
      }
      if (safeGuestName.length < 2) {
        throw new Error('Please enter a valid guest name (at least 2 characters).');
      }
      if (safeGuestEmail.length < 3 || !safeGuestEmail.includes('@')) {
        throw new Error('Please enter a valid confirmation email address.');
      }
      if (safeWhatsapp.length < 5) {
        throw new Error('Please enter a valid WhatsApp phone number.');
      }

      const referenceCode = generateReferenceCode().slice(0, 24);
      const normalizedTime = safeTime.replace(/[^a-zA-Z0-9]/g, '-');
      const slotId = `${safeDate}_${normalizedTime}_${safeTableId}`;
      const reservationId = `res_${referenceCode.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

      const slotRef = doc(db, 'availability', slotId);
      const reservationRef = doc(db, 'reservations', reservationId);

      // 1. Save Directly to Firestore `reservations` collection FIRST
      try {
        await setDoc(reservationRef, {
          referenceCode,
          date: safeDate,
          time: safeTime,
          servicePeriod: safeServicePeriod,
          partySize: safePartySize,
          tableId: safeTableId,
          tableLabel: safeTableLabel,
          zoneId: safeZoneId,
          zoneName: safeZoneName,
          guestName: safeGuestName,
          guestEmail: safeGuestEmail,
          whatsapp: safeWhatsapp,
          country: safeCountry,
          occasion: safeOccasion,
          dietaryNotes: safeDietaryNotes,
          specialRequests: safeSpecialRequests,
          status: 'confirmed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `reservations/${reservationId}`);
      }

      // 2. Update Floor Plan Availability Slot (non-blocking if slot doc has a stale lock)
      try {
        await setDoc(slotRef, {
          date: safeDate,
          time: safeTime,
          tableId: safeTableId,
          status: 'reserved',
          holdExpiresAtMs: 0,
          sessionId: sessionId.slice(0, 80),
          referenceCode,
          updatedAt: serverTimestamp(),
        });
      } catch (slotError) {
        console.warn('Availability slot update skipped:', slotError);
      }

      // 3. Optional Backend API / Notification Call (non-blocking, safe text parsing)
      try {
        const response = await fetch('/api/reservations/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: safeDate,
            time: safeTime,
            servicePeriod: safeServicePeriod,
            partySize: safePartySize,
            tableId: safeTableId,
            tableLabel: safeTableLabel,
            zoneId: safeZoneId,
            zoneName: safeZoneName,
            guestName: safeGuestName,
            guestEmail: safeGuestEmail,
            whatsapp: safeWhatsapp,
            country: safeCountry,
            occasion: safeOccasion || 'None',
            dietaryNotes: safeDietaryNotes,
            specialRequests: safeSpecialRequests,
          }),
        });
        const rawText = await response.text();
        const data = rawText ? JSON.parse(rawText) : {};
        void data;
      } catch (e) {
        console.warn('Optional API call skipped:', e);
      }

      const confirmedRecord: ReservationRecord = {
        id: reservationId,
        referenceCode,
        date: safeDate,
        time: safeTime,
        servicePeriod: safeServicePeriod,
        partySize: safePartySize,
        tableId: safeTableId,
        tableLabel: safeTableLabel,
        zoneId: safeZoneId,
        zoneName: safeZoneName,
        guestName: safeGuestName,
        guestEmail: safeGuestEmail,
        whatsapp: safeWhatsapp,
        country: safeCountry,
        occasion: safeOccasion,
        dietaryNotes: safeDietaryNotes,
        specialRequests: safeSpecialRequests,
        status: 'confirmed',
      };

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            `onelove_voucher_${referenceCode}`,
            JSON.stringify(confirmedRecord)
          );
        } catch {
          // ignore localStorage quota errors
        }
      }

      return confirmedRecord;
    },
    [sessionId]
  );

  // Public Concierge Inquiry Submission (Direct Firestore Write First + Safe Optional API)
  const submitInquiry = useCallback(
    async (input: {
      name: string;
      email: string;
      phone: string;
      subject: string;
      message: string;
    }) => {
      const safeName = (input.name || '').trim().slice(0, 100);
      const safeEmail = (input.email || '').trim().slice(0, 120);
      const safePhone = (input.phone || '').trim().slice(0, 40);
      const safeSubject = (input.subject || 'General Concierge Inquiry').trim().slice(0, 120);
      const safeMessage = (input.message || '').trim().slice(0, 1000);

      if (safeName.length < 2) {
        throw new Error('Please enter your name (at least 2 characters).');
      }
      if (safeEmail.length < 3 || !safeEmail.includes('@')) {
        throw new Error('Please enter a valid email address.');
      }
      if (safeMessage.length < 5) {
        throw new Error('Please enter a message (at least 5 characters).');
      }

      const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      try {
        await setDoc(doc(db, 'inquiries', inquiryId), {
          name: safeName,
          email: safeEmail,
          phone: safePhone,
          subject: safeSubject,
          message: safeMessage,
          status: 'new',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `inquiries/${inquiryId}`);
      }

      // Optional non-blocking API validation/notification call with safe text parsing
      try {
        const response = await fetch('/api/inquiries/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: safeName,
            email: safeEmail,
            phone: safePhone,
            subject: safeSubject,
            message: safeMessage,
          }),
        });
        const rawText = await response.text();
        const data = rawText ? JSON.parse(rawText) : {};
        void data;
      } catch (e) {
        console.warn('Optional API call skipped:', e);
      }
    },
    []
  );

  // Admin Operations
  const updateReservationStatus = useCallback(
    async (reservation: ReservationRecord, newStatus: ReservationRecord['status']) => {
      const normalizedTime = reservation.time.replace(/[^a-zA-Z0-9]/g, '-');
      const slotId = `${reservation.date}_${normalizedTime}_${reservation.tableId}`;
      try {
        setReservations((prev) =>
          prev.map((r) => (r.id === reservation.id ? { ...r, status: newStatus } : r))
        );

        const existingSnap = await getDoc(doc(db, 'reservations', reservation.id));
        const createdAtVal = existingSnap.exists()
          ? existingSnap.data().createdAt
          : serverTimestamp();

        await setDoc(doc(db, 'reservations', reservation.id), {
          referenceCode: reservation.referenceCode.slice(0, 24),
          date: reservation.date.slice(0, 10),
          time: reservation.time.slice(0, 10),
          servicePeriod: (reservation.servicePeriod || 'Sanctuary Dining').slice(0, 40),
          partySize: reservation.partySize,
          tableId: reservation.tableId.slice(0, 40),
          tableLabel: reservation.tableLabel.slice(0, 40),
          zoneId: reservation.zoneId.slice(0, 40),
          zoneName: reservation.zoneName.slice(0, 60),
          guestName: reservation.guestName.slice(0, 100),
          guestEmail: reservation.guestEmail.slice(0, 120),
          whatsapp: reservation.whatsapp.slice(0, 30),
          country: reservation.country.slice(0, 80),
          occasion: (reservation.occasion || 'None').slice(0, 60),
          dietaryNotes: (reservation.dietaryNotes || '').slice(0, 500),
          specialRequests: (reservation.specialRequests || '').slice(0, 500),
          status: newStatus,
          createdAt: createdAtVal,
          updatedAt: serverTimestamp(),
        });

        const nextSlotStatus =
          newStatus === 'cancelled' || newStatus === 'rejected' || newStatus === 'completed'
            ? 'available'
            : newStatus === 'seated'
            ? 'occupied'
            : 'reserved';

        await setDoc(doc(db, 'availability', slotId), {
          date: reservation.date.slice(0, 10),
          time: reservation.time.slice(0, 10),
          tableId: reservation.tableId.slice(0, 40),
          status: nextSlotStatus,
          holdExpiresAtMs: 0,
          sessionId: 'admin',
          referenceCode: reservation.referenceCode.slice(0, 24),
          updatedAt: serverTimestamp(),
        });

        await logAdminAction(
          `RESERVATION_${newStatus.toUpperCase()}`,
          'reservations',
          reservation.id,
          `Updated reservation ${reservation.referenceCode} (${reservation.guestName}) to ${newStatus}`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `reservations/${reservation.id}`);
      }
    },
    []
  );

  const saveTable = useCallback(async (table: CafeTable) => {
    try {
      setTables((prev) => {
        const exists = prev.some((t) => t.id === table.id);
        const updated = exists
          ? prev.map((t) => (t.id === table.id ? table : t))
          : [...prev, table];
        return updated.sort((a, b) => a.number - b.number);
      });

      const { id, ...data } = table;
      await setDoc(doc(db, 'tables', id), {
        label: data.label.slice(0, 30),
        number: Number(data.number),
        capacity: Number(data.capacity),
        minGuests: Number(data.minGuests),
        zoneId: data.zoneId.slice(0, 40),
        zoneName: data.zoneName.slice(0, 60),
        shape: data.shape,
        x: Math.max(0, Math.min(100, Number(data.x))),
        y: Math.max(0, Math.min(100, Number(data.y))),
        isVip: Boolean(data.isVip),
        isActive: Boolean(data.isActive),
        notes: (data.notes || '').slice(0, 200),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('SAVE_TABLE', 'tables', id, `Updated floor plan table ${data.label}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tables/${table.id}`);
    }
  }, []);

  const deleteTable = useCallback(async (tableId: string) => {
    try {
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      await deleteDoc(doc(db, 'tables', tableId));
      await logAdminAction('DELETE_TABLE', 'tables', tableId, `Deleted table ${tableId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tables/${tableId}`);
    }
  }, []);

  const saveZone = useCallback(async (zone: SeatingZone) => {
    try {
      setZones((prev) => {
        const exists = prev.some((z) => z.id === zone.id);
        const updated = exists ? prev.map((z) => (z.id === zone.id ? zone : z)) : [...prev, zone];
        return updated.sort((a, b) => a.sortOrder - b.sortOrder);
      });

      const { id, ...data } = zone;
      await setDoc(doc(db, 'seatingZones', id), {
        name: (data.name || 'Sanctuary Zone').slice(0, 60),
        subtitle: (data.subtitle || '').slice(0, 120),
        description: (data.description || '').slice(0, 300),
        atmosphere: (data.atmosphere || '').slice(0, 100),
        isActive: Boolean(data.isActive),
        sortOrder: Number(data.sortOrder) || 1,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('SAVE_ZONE', 'seatingZones', id, `Updated seating zone ${data.name}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seatingZones/${zone.id}`);
    }
  }, []);

  const deleteZone = useCallback(async (zoneId: string) => {
    try {
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      await deleteDoc(doc(db, 'seatingZones', zoneId));
      await logAdminAction('DELETE_ZONE', 'seatingZones', zoneId, `Deleted seating zone ${zoneId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `seatingZones/${zoneId}`);
    }
  }, []);

  const saveOpeningHours = useCallback(async (config: OpeningHoursConfig) => {
    try {
      setOpeningHours((prev) => prev.map((oh) => (oh.id === config.id ? config : oh)));
      const { id, ...data } = config;
      await setDoc(doc(db, 'openingHours', id), {
        dayOfWeek: data.dayOfWeek.slice(0, 20),
        isOpen: Boolean(data.isOpen),
        openTime: data.openTime.slice(0, 10),
        closeTime: data.closeTime.slice(0, 10),
        slotDurationMinutes: Number(data.slotDurationMinutes),
        gracePeriodMinutes: Number(data.gracePeriodMinutes),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'SAVE_OPENING_HOURS',
        'openingHours',
        id,
        `Updated opening hours for ${data.dayOfWeek}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `openingHours/${config.id}`);
    }
  }, []);

  const saveBlockedDate = useCallback(async (blocked: BlockedDateRecord) => {
    try {
      setBlockedDates((prev) => [
        ...prev.filter((b) => b.id !== blocked.id),
        blocked,
      ]);
      const { id, ...data } = blocked;
      await setDoc(doc(db, 'blockedDates', id), {
        date: data.date.slice(0, 10),
        reason: data.reason.slice(0, 160),
        isFullDay: Boolean(data.isFullDay),
        blockedSlots: (data.blockedSlots || []).slice(0, 30),
        createdAt: serverTimestamp(),
      });
      await logAdminAction(
        'ADD_BLOCKED_DATE',
        'blockedDates',
        id,
        `Blocked date ${data.date}: ${data.reason}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `blockedDates/${blocked.id}`);
    }
  }, []);

  const deleteBlockedDate = useCallback(async (id: string) => {
    try {
      setBlockedDates((prev) => prev.filter((b) => b.id !== id));
      await deleteDoc(doc(db, 'blockedDates', id));
      await logAdminAction('REMOVE_BLOCKED_DATE', 'blockedDates', id, `Removed blocked date ${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `blockedDates/${id}`);
    }
  }, []);

  const saveMenuCategory = useCallback(async (cat: MenuCategory) => {
    try {
      setMenuCategories((prev) => {
        const exists = prev.some((c) => c.id === cat.id);
        const updated = exists ? prev.map((c) => (c.id === cat.id ? cat : c)) : [...prev, cat];
        return updated.sort((a, b) => a.sortOrder - b.sortOrder);
      });

      // Keep menuItems' categoryName in sync if category name changed
      setMenuItems((prev) =>
        prev.map((m) => (m.categoryId === cat.id ? { ...m, categoryName: cat.name } : m))
      );

      const { id, ...data } = cat;
      const safeSlug = (
        data.slug ||
        data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') ||
        'category'
      ).slice(0, 60);

      await setDoc(doc(db, 'menuCategories', id), {
        name: (data.name || 'Untitled Category').slice(0, 60),
        slug: safeSlug,
        subtitle: (data.subtitle || '').slice(0, 140),
        sortOrder: Number(data.sortOrder) || 1,
        isActive: Boolean(data.isActive),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'SAVE_MENU_CATEGORY',
        'menuCategories',
        id,
        `Saved menu category ${data.name}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `menuCategories/${cat.id}`);
    }
  }, []);

  const deleteMenuCategory = useCallback(async (id: string) => {
    try {
      setMenuCategories((prev) => prev.filter((c) => c.id !== id));
      await deleteDoc(doc(db, 'menuCategories', id));
      await logAdminAction(
        'DELETE_MENU_CATEGORY',
        'menuCategories',
        id,
        `Deleted menu category ${id}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `menuCategories/${id}`);
    }
  }, []);

  const saveMenuItem = useCallback(
    async (item: MenuItem) => {
      try {
        const { id, ...data } = item;
        const rawImageUrl = (data.imageUrl || '').trim();
        const cleanImageUrl = rawImageUrl.startsWith('editorial:') ? '' : rawImageUrl;
        const prevImageUrl = r2ManifestRef.current.menuImages?.[id] || '';
        const urlsToDelete =
          prevImageUrl && prevImageUrl !== cleanImageUrl ? [prevImageUrl] : [];

        // 1. Save image URL in Cloudflare R2 manifest (and delete replaced image from R2 bucket)
        await updateR2Manifest((prev) => {
          const nextMenuImages = { ...(prev.menuImages || {}) };
          if (cleanImageUrl) {
            nextMenuImages[id] = cleanImageUrl;
          } else {
            delete nextMenuImages[id];
          }
          return {
            ...prev,
            menuImages: nextMenuImages,
          };
        }, urlsToDelete);

        // 2. Save text/price metadata only in local state & Firestore (imageUrl is ALWAYS empty in Firestore)
        const firestoreItem: MenuItem = { ...item, imageUrl: '' };
        setMenuItems((prev) => {
          const exists = prev.some((m) => m.id === item.id);
          const next = exists
            ? prev.map((m) => (m.id === item.id ? firestoreItem : m))
            : [firestoreItem, ...prev];
          writeLocalCache('onelove_cache_menuItems', next);
          return next;
        });

        const validItemCurrency =
          data.priceCurrency && ['default', 'both', 'lkr', 'usd'].includes(data.priceCurrency)
            ? data.priceCurrency
            : 'default';
        await setDoc(doc(db, 'menuItems', id), {
          name: (data.name || 'Untitled Dish').slice(0, 100),
          categoryId: (data.categoryId || 'cat_coffee').slice(0, 60),
          categoryName: (data.categoryName || 'Specialty Coffee & Botanicals').slice(0, 60),
          description: (data.description || 'Crafted fresh in Sigiriya.').slice(0, 400),
          priceLkr: Math.max(0, Number(data.priceLkr) || 0),
          priceUsd: Math.max(0, Number(data.priceUsd) || 0),
          priceCurrency: validItemCurrency,
          imageUrl: '',
          dietaryTags: (data.dietaryTags || []).slice(0, 10),
          isFeatured: Boolean(data.isFeatured),
          isAvailable: Boolean(data.isAvailable),
          updatedAt: serverTimestamp(),
        });
        await logAdminAction(
          'SAVE_MENU_ITEM',
          'menuItems',
          id,
          `Saved menu item ${data.name} (image synced to Cloudflare R2)`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `menuItems/${item.id}`);
      }
    },
    [updateR2Manifest]
  );

  const deleteMenuItem = useCallback(
    async (id: string) => {
      try {
        const prevImageUrl = r2ManifestRef.current.menuImages?.[id] || '';
        await updateR2Manifest(
          (prev) => {
            const nextMenuImages = { ...(prev.menuImages || {}) };
            delete nextMenuImages[id];
            return {
              ...prev,
              menuImages: nextMenuImages,
            };
          },
          prevImageUrl ? [prevImageUrl] : []
        );

        const prevDeleted = readLocalCache<string[]>('onelove_deleted_menu_ids', []);
        if (!prevDeleted.includes(id)) {
          writeLocalCache('onelove_deleted_menu_ids', [...prevDeleted, id]);
        }

        setMenuItems((prev) => {
          const next = prev.filter((m) => m.id !== id);
          writeLocalCache('onelove_cache_menuItems', next);
          return next;
        });
        await deleteDoc(doc(db, 'menuItems', id));
        await logAdminAction(
          'DELETE_MENU_ITEM',
          'menuItems',
          id,
          `Deleted menu item ${id} and removed image from Cloudflare R2`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `menuItems/${id}`);
      }
    },
    [updateR2Manifest]
  );

  // Gallery items & images live 100% in Cloudflare R2 (Zero Firestore reads or writes)
  const saveGalleryItem = useCallback(
    async (item: GalleryItem) => {
      try {
        const existing = r2ManifestRef.current.galleryItems.find((g) => g.id === item.id);
        const prevUrl = existing?.imageUrl || '';
        const nextUrl = (item.imageUrl || '').trim();
        const urlsToDelete = prevUrl && prevUrl !== nextUrl ? [prevUrl] : [];

        const normalizedItem: GalleryItem = {
          id: item.id,
          title: (item.title || 'Sanctuary Moment').slice(0, 100),
          category: item.category || 'Garden',
          caption: (item.caption || '').slice(0, 300),
          imageUrl: nextUrl,
          aspectRatio: item.aspectRatio || '4:3',
          isFeatured: Boolean(item.isFeatured),
          sortOrder: Number(item.sortOrder) || 1,
        };

        await updateR2Manifest((prev) => {
          const list = Array.isArray(prev.galleryItems) ? prev.galleryItems : [];
          const exists = list.some((g) => g.id === normalizedItem.id);
          const nextList = (
            exists
              ? list.map((g) => (g.id === normalizedItem.id ? normalizedItem : g))
              : [...list, normalizedItem]
          ).sort((a, b) => a.sortOrder - b.sortOrder);
          return {
            ...prev,
            galleryItems: nextList,
          };
        }, urlsToDelete);

        // Clean up any legacy Firestore document if one existed previously
        await deleteDoc(doc(db, 'gallery', item.id)).catch(() => {});

        await logAdminAction(
          'SAVE_GALLERY_ITEM_R2',
          'r2_gallery',
          item.id,
          `Saved gallery photo "${normalizedItem.title}" directly to Cloudflare R2`
        );
      } catch (error) {
        console.error('Failed to save gallery item to R2:', error);
      }
    },
    [updateR2Manifest]
  );

  const deleteGalleryItem = useCallback(
    async (id: string) => {
      try {
        const existing = r2ManifestRef.current.galleryItems.find((g) => g.id === id);
        const prevUrl = existing?.imageUrl || '';

        await updateR2Manifest(
          (prev) => ({
            ...prev,
            galleryItems: (prev.galleryItems || []).filter((g) => g.id !== id),
          }),
          prevUrl ? [prevUrl] : []
        );

        // Clean up any legacy Firestore document if one existed previously
        await deleteDoc(doc(db, 'gallery', id)).catch(() => {});

        await logAdminAction(
          'DELETE_GALLERY_ITEM_R2',
          'r2_gallery',
          id,
          `Deleted gallery item ${id} and removed object from Cloudflare R2`
        );
      } catch (error) {
        console.error('Failed to delete gallery item from R2:', error);
      }
    },
    [updateR2Manifest]
  );

  const saveEvent = useCallback(
    async (evt: CafeEvent) => {
      try {
        const { id, ...data } = evt;
        const rawImageUrl = (data.imageUrl || '').trim();
        const cleanImageUrl = rawImageUrl.startsWith('editorial:') ? '' : rawImageUrl;
        const prevImageUrl = r2ManifestRef.current.eventImages?.[id] || '';
        const urlsToDelete =
          prevImageUrl && prevImageUrl !== cleanImageUrl ? [prevImageUrl] : [];

        // 1. Save event image URL in Cloudflare R2 manifest (and delete replaced image from R2)
        await updateR2Manifest((prev) => {
          const nextEventImages = { ...(prev.eventImages || {}) };
          if (cleanImageUrl) {
            nextEventImages[id] = cleanImageUrl;
          } else {
            delete nextEventImages[id];
          }
          return {
            ...prev,
            eventImages: nextEventImages,
          };
        }, urlsToDelete);

        // 2. Save text metadata only in local state & Firestore (imageUrl is ALWAYS empty in Firestore)
        const firestoreEvt: CafeEvent = { ...evt, imageUrl: '' };
        setEvents((prev) => {
          const exists = prev.some((e) => e.id === evt.id);
          const next = exists
            ? prev.map((e) => (e.id === evt.id ? firestoreEvt : e))
            : [...prev, firestoreEvt];
          writeLocalCache('onelove_cache_events', next);
          return next;
        });

        await setDoc(doc(db, 'events', id), {
          title: (data.title || 'Sanctuary Gathering').slice(0, 120),
          subtitle: (data.subtitle || '').slice(0, 140),
          date: (data.date || 'Weekly').slice(0, 40),
          time: (data.time || '18:00').slice(0, 40),
          category: (data.category || 'Evening Ritual').slice(0, 60),
          description: (data.description || 'Curated experience at OneLove Café.').slice(0, 600),
          imageUrl: '',
          priceInfo: (data.priceInfo || '').slice(0, 80),
          isFeatured: Boolean(data.isFeatured),
          isActive: Boolean(data.isActive),
          updatedAt: serverTimestamp(),
        });
        await logAdminAction(
          'SAVE_EVENT',
          'events',
          id,
          `Saved event ${data.title} (image synced to Cloudflare R2)`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `events/${evt.id}`);
      }
    },
    [updateR2Manifest]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        const prevImageUrl = r2ManifestRef.current.eventImages?.[id] || '';
        await updateR2Manifest(
          (prev) => {
            const nextEventImages = { ...(prev.eventImages || {}) };
            delete nextEventImages[id];
            return {
              ...prev,
              eventImages: nextEventImages,
            };
          },
          prevImageUrl ? [prevImageUrl] : []
        );

        const prevDeleted = readLocalCache<string[]>('onelove_deleted_event_ids', []);
        if (!prevDeleted.includes(id)) {
          writeLocalCache('onelove_deleted_event_ids', [...prevDeleted, id]);
        }

        setEvents((prev) => {
          const next = prev.filter((e) => e.id !== id);
          writeLocalCache('onelove_cache_events', next);
          return next;
        });
        await deleteDoc(doc(db, 'events', id));
        await logAdminAction(
          'DELETE_EVENT',
          'events',
          id,
          `Deleted event ${id} and removed image from Cloudflare R2`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
      }
    },
    [updateR2Manifest]
  );

  const saveSiteContent = useCallback(
    async (section: SiteContentSection) => {
      try {
        const { id, ...data } = section;
        const sectionKey = (data.sectionKey || 'section').slice(0, 60);
        const rawImageUrl = (data.imageUrl || '').trim();
        const cleanImageUrl = rawImageUrl.startsWith('editorial:') ? '' : rawImageUrl;
        const prevImageUrl = r2ManifestRef.current.sectionImages?.[sectionKey] || '';
        const urlsToDelete =
          prevImageUrl && prevImageUrl !== cleanImageUrl ? [prevImageUrl] : [];

        // 1. Save section image URL in Cloudflare R2 manifest (and delete replaced image from R2)
        await updateR2Manifest((prev) => {
          const nextSectionImages = { ...(prev.sectionImages || {}) };
          if (cleanImageUrl) {
            nextSectionImages[sectionKey] = cleanImageUrl;
          } else {
            delete nextSectionImages[sectionKey];
          }
          return {
            ...prev,
            sectionImages: nextSectionImages,
          };
        }, urlsToDelete);

        // 2. Save text metadata only in local state & Firestore (imageUrl is ALWAYS empty in Firestore)
        const firestoreSection: SiteContentSection = { ...section, sectionKey, imageUrl: '' };
        setSiteContent((prev) => {
          const exists = prev.some((s) => s.id === section.id || s.sectionKey === sectionKey);
          const next = exists
            ? prev.map((s) =>
                s.id === section.id || s.sectionKey === sectionKey ? firestoreSection : s
              )
            : [...prev, firestoreSection];
          writeLocalCache('onelove_cache_siteContent', next);
          return next;
        });

        await setDoc(doc(db, 'siteContent', id), {
          sectionKey,
          kicker: (data.kicker || '').slice(0, 100),
          heading: (data.heading || 'OneLove Café Sigiriya').slice(0, 160),
          subheading: (data.subheading || '').slice(0, 400),
          body: (data.body || '').slice(0, 1200),
          ctaLabel: (data.ctaLabel || '').slice(0, 60),
          ctaLink: (data.ctaLink || '').slice(0, 120),
          imageUrl: '',
          updatedAt: serverTimestamp(),
        });
        await logAdminAction(
          'SAVE_SITE_CONTENT',
          'siteContent',
          id,
          `Updated website section ${sectionKey} (image synced to Cloudflare R2)`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `siteContent/${section.id}`);
      }
    },
    [updateR2Manifest]
  );

  const saveSettings = useCallback(
    async (newSettings: CafeSettings) => {
      try {
        const { id, ...data } = newSettings;
        const nextHeroImages = Array.isArray(data.heroImages)
          ? data.heroImages
              .filter(
                (img) =>
                  typeof img === 'string' &&
                  img.trim().length > 0 &&
                  !img.startsWith('siteContent:')
              )
              .slice(0, 12)
          : [];
        const speedSec = Math.min(
          60,
          Math.max(1, Number(data.heroSlideshowSpeedSeconds) || 5)
        );
        const nextFloorPlanUrl = (data.floorPlanImageUrl || '').trim();

        // Determine any removed Hero slides or replaced Floor Plan URL so they are physically deleted from R2
        const prevHeroImages = r2ManifestRef.current.heroImages || [];
        const prevFloorPlanUrl = r2ManifestRef.current.floorPlanImageUrl || '';
        const removedHeroUrls = prevHeroImages.filter(
          (oldUrl) => oldUrl && !nextHeroImages.includes(oldUrl)
        );
        const removedFloorPlanUrls =
          prevFloorPlanUrl && prevFloorPlanUrl !== nextFloorPlanUrl ? [prevFloorPlanUrl] : [];
        const urlsToDelete = [...removedHeroUrls, ...removedFloorPlanUrls];

        // 1. Persist Hero Slideshow images & Floor Plan image 100% to Cloudflare R2 manifest
        await updateR2Manifest(
          (prev) => ({
            ...prev,
            heroImages: nextHeroImages,
            heroSlideshowSpeedSeconds: speedSec,
            floorPlanImageUrl: nextFloorPlanUrl,
          }),
          urlsToDelete
        );

        const validMenuCurrency =
          data.menuCurrencyDisplay && ['both', 'lkr', 'usd'].includes(data.menuCurrencyDisplay)
            ? data.menuCurrencyDisplay
            : 'both';

        // 2. Save text/operational settings to local state & Firestore (ZERO images in Firestore)
        const textOnlySettings: CafeSettings = {
          ...newSettings,
          heroImages: [],
          heroSlideshowSpeedSeconds: speedSec,
          floorPlanImageUrl: '',
        };
        setSettings(textOnlySettings);
        writeLocalCache('onelove_cache_settings', textOnlySettings);

        await setDoc(doc(db, 'settings', id || 'main'), {
          cafeName: (data.cafeName || 'OneLove Café').slice(0, 80),
          tagline: (data.tagline || '').slice(0, 160),
          address: (data.address || '').slice(0, 200),
          phone: (data.phone || '').slice(0, 40),
          whatsapp: (data.whatsapp || '').slice(0, 40),
          email: (data.email || '').slice(0, 120),
          instagram: (data.instagram || '').slice(0, 100),
          coordinates: (data.coordinates || '').slice(0, 60),
          gracePeriodMinutes: Math.min(
            60,
            Math.max(5, Math.round(Number(data.gracePeriodMinutes) || 15))
          ),
          holdDurationMinutes: Math.min(
            30,
            Math.max(3, Math.round(Number(data.holdDurationMinutes) || 10))
          ),
          maxPartySize: Math.min(30, Math.max(2, Math.round(Number(data.maxPartySize) || 12))),
          sameDayCutoffHour: Math.min(
            23,
            Math.max(0, Math.round(Number(data.sameDayCutoffHour) || 21))
          ),
          bookingPolicy: (data.bookingPolicy || '').slice(0, 600),
          heroImages: [],
          heroSlideshowSpeedSeconds: speedSec,
          floorPlanImageUrl: '',
          googleMapsEmbedUrl: (data.googleMapsEmbedUrl || '').slice(0, 2000),
          mapTitle: (data.mapTitle || 'Our Sanctuary Location').slice(0, 120),
          mapSubtitle: (data.mapSubtitle || '').slice(0, 250),
          menuCurrencyDisplay: validMenuCurrency,
          updatedAt: serverTimestamp(),
        });
        await logAdminAction(
          'SAVE_SETTINGS',
          'settings',
          id || 'main',
          `Updated global café settings & synced ${nextHeroImages.length} Hero image(s) to Cloudflare R2`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/${newSettings.id}`);
      }
    },
    [updateR2Manifest]
  );

  const updateInquiryStatus = useCallback(
    async (inquiry: InquiryRecord, status: InquiryRecord['status']) => {
      try {
        setInquiries((prev) =>
          prev.map((i) => (i.id === inquiry.id ? { ...i, status } : i))
        );
        const existingSnap = await getDoc(doc(db, 'inquiries', inquiry.id));
        const createdAtVal = existingSnap.exists()
          ? existingSnap.data().createdAt
          : serverTimestamp();
        await setDoc(doc(db, 'inquiries', inquiry.id), {
          name: inquiry.name.slice(0, 100),
          email: inquiry.email.slice(0, 120),
          phone: (inquiry.phone || '').slice(0, 40),
          subject: inquiry.subject.slice(0, 120),
          message: inquiry.message.slice(0, 1000),
          status,
          createdAt: createdAtVal,
          updatedAt: serverTimestamp(),
        });
        await logAdminAction(
          'UPDATE_INQUIRY',
          'inquiries',
          inquiry.id,
          `Marked inquiry from ${inquiry.name} as ${status}`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `inquiries/${inquiry.id}`);
      }
    },
    []
  );

  // Upload image directly to Cloudflare R2 bucket (and automatically delete previousUrl if replacing)
  const uploadMediaFile = useCallback(
    async (file: File, folder = 'menu', previousUrl?: string): Promise<string> => {
      const isHeroSlideshow = folder === 'hero';
      const isLargeBackdrop = folder === 'floorplan' || folder === 'menu_gallery_bg';
      const maxWidth = isHeroSlideshow ? 2880 : isLargeBackdrop ? 2560 : 1920;
      const maxHeight = isHeroSlideshow ? 1620 : isLargeBackdrop ? 1440 : 1280;
      const quality = isHeroSlideshow ? 0.9 : isLargeBackdrop ? 0.88 : 0.86;
      const maxBase64Length = isHeroSlideshow ? 1_800_000 : 1_200_000;

      const base64DataUrl = await fileToCompressedBase64(
        file,
        maxWidth,
        maxHeight,
        quality,
        maxBase64Length
      );

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: base64DataUrl,
          filename: file.name,
          folder,
          previousUrl:
            previousUrl && previousUrl.startsWith('http') && !previousUrl.startsWith('editorial:')
              ? previousUrl
              : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Cloudflare R2 upload failed (${res.status})`);
      }

      const data = await res.json();
      if (!data.ok || !data.url) {
        throw new Error('Cloudflare R2 upload did not return a valid URL');
      }

      await logAdminAction(
        'R2_OBJECT_UPLOAD',
        folder,
        file.name.slice(0, 60),
        `Uploaded image to Cloudflare R2 bucket (${data.url})`
      );
      return data.url;
    },
    []
  );

  // Update any of the 5 Laterite Earth, Teak & Monsoon Light collage frames directly in Cloudflare R2
  const updateCollageImageFromDevice = useCallback(
    async (slotIndex: number, file: File) => {
      const sectionKey = `story_collage_${slotIndex}`;
      const prevUrl = r2ManifestRef.current.sectionImages?.[sectionKey] || '';
      const uploadedR2Url = await uploadMediaFile(file, 'collage', prevUrl);

      await updateR2Manifest((prev) => ({
        ...prev,
        sectionImages: {
          ...(prev.sectionImages || {}),
          [sectionKey]: uploadedR2Url,
        },
      }));
    },
    [uploadMediaFile, updateR2Manifest]
  );

  const resetCollageImage = useCallback(
    async (slotIndex: number) => {
      const sectionKey = `story_collage_${slotIndex}`;
      const prevUrl = r2ManifestRef.current.sectionImages?.[sectionKey] || '';

      await updateR2Manifest(
        (prev) => {
          const nextSectionImages = { ...(prev.sectionImages || {}) };
          delete nextSectionImages[sectionKey];
          return {
            ...prev,
            sectionImages: nextSectionImages,
          };
        },
        prevUrl ? [prevUrl] : []
      );
    },
    [updateR2Manifest]
  );

  const saveSeoGlobal = useCallback(
    async (config: GlobalSeoConfig) => {
      try {
        const cleanOgUrl = (config.defaultOgImageUrl || '').trim();
        const cleanLogoUrl = (config.brandLogoUrl || '').trim();
        const prevOgUrl = r2ManifestRef.current.seoImages?.defaultOgImageUrl || '';
        const prevLogoUrl = r2ManifestRef.current.seoImages?.brandLogoUrl || '';

        const urlsToDelete: string[] = [];
        if (prevOgUrl && prevOgUrl !== cleanOgUrl && !prevOgUrl.startsWith('/assets/')) {
          urlsToDelete.push(prevOgUrl);
        }
        if (prevLogoUrl && prevLogoUrl !== cleanLogoUrl && !prevLogoUrl.startsWith('/assets/')) {
          urlsToDelete.push(prevLogoUrl);
        }

        // 1. Save SEO images to Cloudflare R2 manifest
        await updateR2Manifest(
          (prev) => ({
            ...prev,
            seoImages: {
              defaultOgImageUrl: cleanOgUrl,
              brandLogoUrl: cleanLogoUrl,
              pageOgImages: prev.seoImages?.pageOgImages || {},
            },
          }),
          urlsToDelete
        );

        // 2. Save text SEO configuration to Firestore (with empty image fields in Firestore)
        const merged: GlobalSeoConfig = {
          ...DEFAULT_GLOBAL_SEO,
          ...config,
          id: 'main',
          defaultOgImageUrl: '',
          brandLogoUrl: '',
        };
        setSeoGlobal(merged);
        writeLocalCache('onelove_cache_seoGlobal', merged);

        const { id, ...data } = merged;
        await setDoc(doc(db, 'seoConfig', id || 'main'), {
          siteName: (data.siteName || 'OneLove Café').slice(0, 100),
          alternateNames: (data.alternateNames || []).slice(0, 15),
          defaultTitle: (data.defaultTitle || DEFAULT_GLOBAL_SEO.defaultTitle).slice(0, 160),
          titleTemplate: (data.titleTemplate || '%s | OneLove Café Sigiriya').slice(0, 120),
          defaultDescription: (
            data.defaultDescription || DEFAULT_GLOBAL_SEO.defaultDescription
          ).slice(0, 500),
          canonicalDomain: (data.canonicalDomain || 'https://onelovecafesigiriya.com')
            .replace(/\/+$/, '')
            .slice(0, 200),
          language: (data.language || 'en').slice(0, 16),
          googleVerificationTag: (data.googleVerificationTag || '').slice(0, 200),
          defaultOgImageUrl: '',
          brandLogoUrl: '',
          faviconSourceUrl: '',
          favicon48Url: '',
          favicon96Url: '',
          favicon192Url: '',
          appleTouchIconUrl: '',
          allowIndexing: Boolean(data.allowIndexing),
          noindexPreviewDomains: Boolean(data.noindexPreviewDomains),
          businessType: data.businessType === 'Restaurant' ? 'Restaurant' : 'CafeOrCoffeeShop',
          streetAddress: (data.streetAddress || '').slice(0, 200),
          addressLocality: (data.addressLocality || 'Sigiriya').slice(0, 80),
          addressRegion: (data.addressRegion || 'Central Province').slice(0, 80),
          postalCode: (data.postalCode || '21120').slice(0, 20),
          addressCountry: (data.addressCountry || 'LK').slice(0, 10),
          latitude: Number(data.latitude) || 7.9541,
          longitude: Number(data.longitude) || 80.7547,
          telephone: (data.telephone || '').slice(0, 40),
          whatsapp: (data.whatsapp || '').slice(0, 40),
          email: (data.email || '').slice(0, 120),
          priceRange: (data.priceRange || '$$').slice(0, 16),
          servesCuisine: (data.servesCuisine || []).slice(0, 20),
          openingHoursSpec: (data.openingHoursSpec || 'Mo-Su 07:30-22:30').slice(0, 120),
          socialLinks: (data.socialLinks || []).slice(0, 20),
          customKeywords: (data.customKeywords || []).slice(0, 200),
          imageAltOverrides: data.imageAltOverrides || {},
          updatedAt: serverTimestamp(),
        });

        await logAdminAction(
          'SAVE_SEO_GLOBAL',
          'seoConfig',
          'main',
          `Updated global SEO configuration (${data.siteName} · SEO images synced to Cloudflare R2)`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'seoConfig/main');
      }
    },
    [updateR2Manifest]
  );

  const saveSeoPage = useCallback(
    async (page: PageSeoConfig) => {
      try {
        const cleanOgUrl = (page.ogImageUrl || '').trim();
        const prevOgUrl = r2ManifestRef.current.seoImages?.pageOgImages?.[page.id] || '';
        const urlsToDelete =
          prevOgUrl && prevOgUrl !== cleanOgUrl && !prevOgUrl.startsWith('/assets/')
            ? [prevOgUrl]
            : [];

        await updateR2Manifest(
          (prev) => ({
            ...prev,
            seoImages: {
              defaultOgImageUrl: prev.seoImages?.defaultOgImageUrl || '',
              brandLogoUrl: prev.seoImages?.brandLogoUrl || '',
              pageOgImages: {
                ...(prev.seoImages?.pageOgImages || {}),
                [page.id]: cleanOgUrl,
              },
            },
          }),
          urlsToDelete
        );

        const textOnlyPage: PageSeoConfig = { ...page, ogImageUrl: '' };
        setSeoPages((prev) => {
          const next = { ...prev, [page.id]: textOnlyPage };
          writeLocalCache('onelove_cache_seoPages', next);
          return next;
        });

        const { id, ...data } = textOnlyPage;
        await setDoc(doc(db, 'seoPages', id), {
          routePath: (data.routePath || '/').slice(0, 120),
          pageLabel: (data.pageLabel || id).slice(0, 120),
          title: (data.title || DEFAULT_GLOBAL_SEO.defaultTitle).slice(0, 160),
          metaDescription: (data.metaDescription || '').slice(0, 500),
          canonicalPath: (data.canonicalPath || data.routePath || '/').slice(0, 120),
          primaryKeyword: (data.primaryKeyword || '').slice(0, 120),
          supportingKeywords: (data.supportingKeywords || []).slice(0, 40),
          ogTitle: (data.ogTitle || data.title || '').slice(0, 160),
          ogDescription: (data.ogDescription || data.metaDescription || '').slice(0, 500),
          ogImageUrl: '',
          indexable: Boolean(data.indexable),
          updatedAt: serverTimestamp(),
        });

        await logAdminAction(
          'SAVE_SEO_PAGE',
          'seoPages',
          id,
          `Updated page SEO metadata for ${data.routePath} (OG image synced to Cloudflare R2)`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `seoPages/${page.id}`);
      }
    },
    [updateR2Manifest]
  );

  const resetSeoToDefaults = useCallback(async () => {
    await saveSeoGlobal(DEFAULT_GLOBAL_SEO);
    for (const key of Object.keys(DEFAULT_PAGE_SEO) as SeoPageKey[]) {
      await saveSeoPage(DEFAULT_PAGE_SEO[key]);
    }
  }, [saveSeoGlobal, saveSeoPage]);

  // 100% Cloudflare R2 Resolved State (All images across the entire site come exclusively from r2Manifest)
  const resolvedSettings = useMemo<CafeSettings>(() => {
    const r2Hero = Array.isArray(r2Manifest.heroImages)
      ? r2Manifest.heroImages.filter((u) => typeof u === 'string' && u.trim().length > 0)
      : [];
    return {
      ...settings,
      heroImages:
        r2Hero.length > 0
          ? r2Hero
          : DEFAULT_SETTINGS.heroImages || ['editorial:hero-sanctuary'],
      heroSlideshowSpeedSeconds:
        typeof r2Manifest.heroSlideshowSpeedSeconds === 'number'
          ? r2Manifest.heroSlideshowSpeedSeconds
          : settings.heroSlideshowSpeedSeconds || 5,
      floorPlanImageUrl: r2Manifest.floorPlanImageUrl || '',
    };
  }, [settings, r2Manifest]);

  const resolvedMenuItems = useMemo<MenuItem[]>(() => {
    const map = r2Manifest.menuImages || {};
    return menuItems.map((item) => {
      const r2Url = map[item.id];
      const defaultUrl =
        DEFAULT_MENU_ITEMS.find((d) => d.id === item.id)?.imageUrl || 'editorial:hopper-bowl';
      return {
        ...item,
        imageUrl: r2Url && r2Url.trim().length > 0 ? r2Url : defaultUrl,
      };
    });
  }, [menuItems, r2Manifest.menuImages]);

  const resolvedGallery = useMemo<GalleryItem[]>(() => {
    return Array.isArray(r2Manifest.galleryItems) ? r2Manifest.galleryItems : [];
  }, [r2Manifest.galleryItems]);

  const resolvedEvents = useMemo<CafeEvent[]>(() => {
    const map = r2Manifest.eventImages || {};
    return events.map((evt) => {
      const r2Url = map[evt.id];
      const defaultUrl =
        DEFAULT_EVENTS.find((d) => d.id === evt.id)?.imageUrl || 'editorial:evening-hearth';
      return {
        ...evt,
        imageUrl: r2Url && r2Url.trim().length > 0 ? r2Url : defaultUrl,
      };
    });
  }, [events, r2Manifest.eventImages]);

  const resolvedSiteContent = useMemo<SiteContentSection[]>(() => {
    const map = r2Manifest.sectionImages || {};
    const byKey = new Map<string, SiteContentSection>();

    DEFAULT_SITE_CONTENT.forEach((def) => {
      byKey.set(def.sectionKey, { ...def });
    });

    siteContent.forEach((sec) => {
      if (!sec.sectionKey || sec.sectionKey.startsWith('hero_slide_')) return;
      byKey.set(sec.sectionKey, { ...sec });
    });

    Object.keys(map).forEach((sectionKey) => {
      if (!byKey.has(sectionKey)) {
        const def = DEFAULT_SITE_CONTENT.find((d) => d.sectionKey === sectionKey);
        byKey.set(
          sectionKey,
          def || {
            id: `sec_${sectionKey}`,
            sectionKey,
            kicker: sectionKey,
            heading: sectionKey,
            subheading: '',
            body: '',
            ctaLabel: '',
            ctaLink: '',
            imageUrl: '',
          }
        );
      }
    });

    return Array.from(byKey.values()).map((sec) => {
      const r2Img = map[sec.sectionKey] || '';
      const defaultSecImg =
        DEFAULT_SITE_CONTENT.find((d) => d.sectionKey === sec.sectionKey)?.imageUrl || '';
      return {
        ...sec,
        imageUrl: r2Img && r2Img.trim().length > 0 ? r2Img : defaultSecImg,
      };
    });
  }, [siteContent, r2Manifest.sectionImages]);

  const resolvedSeoGlobal = useMemo<GlobalSeoConfig>(() => {
    return {
      ...seoGlobal,
      defaultOgImageUrl:
        r2Manifest.seoImages?.defaultOgImageUrl || DEFAULT_GLOBAL_SEO.defaultOgImageUrl,
      brandLogoUrl: r2Manifest.seoImages?.brandLogoUrl || DEFAULT_GLOBAL_SEO.brandLogoUrl,
    };
  }, [seoGlobal, r2Manifest.seoImages]);

  const resolvedSeoPages = useMemo<Record<SeoPageKey, PageSeoConfig>>(() => {
    const pageOgMap = r2Manifest.seoImages?.pageOgImages || {};
    const next = { ...seoPages };
    (Object.keys(next) as SeoPageKey[]).forEach((key) => {
      next[key] = {
        ...next[key],
        ogImageUrl:
          pageOgMap[key] ||
          r2Manifest.seoImages?.defaultOgImageUrl ||
          DEFAULT_PAGE_SEO[key].ogImageUrl,
      };
    });
    return next;
  }, [seoPages, r2Manifest.seoImages]);

  // Sync live SEO configuration (with R2-resolved OG/brand images) to the Express server
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      fetch('/api/seo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global: resolvedSeoGlobal,
          pages: resolvedSeoPages,
        }),
      }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
  }, [resolvedSeoGlobal, resolvedSeoPages]);

  return (
    <CafeContext.Provider
      value={{
        user,
        isAdmin,
        authReady,
        sessionId,
        settings: resolvedSettings,
        zones,
        tables,
        openingHours,
        blockedDates,
        menuCategories,
        menuItems: resolvedMenuItems,
        gallery: resolvedGallery,
        events: resolvedEvents,
        siteContent: resolvedSiteContent,
        availability,
        seoGlobal: resolvedSeoGlobal,
        seoPages: resolvedSeoPages,
        r2Manifest,
        reservations,
        inquiries,
        admins,
        auditLogs,
        signInAdmin,
        signOutAdmin,
        holdTableSlot,
        confirmReservation,
        submitInquiry,
        seedDatabaseIfNeeded,
        updateReservationStatus,
        saveTable,
        deleteTable,
        saveZone,
        deleteZone,
        saveOpeningHours,
        saveBlockedDate,
        deleteBlockedDate,
        saveMenuCategory,
        deleteMenuCategory,
        saveMenuItem,
        deleteMenuItem,
        saveGalleryItem,
        deleteGalleryItem,
        saveEvent,
        deleteEvent,
        saveSiteContent,
        saveSettings,
        saveSeoGlobal,
        saveSeoPage,
        resetSeoToDefaults,
        updateInquiryStatus,
        uploadMediaFile,
        deleteMediaFromR2,
        updateCollageImageFromDevice,
        resetCollageImage,
        storageStatus,
        checkStorageStatus,
      }}
    >
      {children}
    </CafeContext.Provider>
  );
};

export function useCafe(): CafeContextValue {
  const ctx = useContext(CafeContext);
  if (!ctx) {
    throw new Error('useCafe must be used inside CafeProvider');
  }
  return ctx;
}
