import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  limit,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  getPrimaryUserEmail,
  isAuthorizedAdminUser,
  handleFirestoreError,
  OperationType,
  logAdminAction,
} from '../lib/firebase';
import { fileToCompressedBase64 } from '../lib/imageBase64';
import { resolveMenuCategorySection } from '../lib/menuSections';
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

const SRI_LANKA_UTC_OFFSET_MINUTES = 330; // Asia/Colombo (UTC+05:30, no DST)

function isReservationDateTimePassed(
  dateStr?: string,
  timeStr?: string,
  nowMs = Date.now()
): boolean {
  if (!dateStr || !timeStr) return false;
  const dateMatch = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return false;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!timeMatch) return false;
  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return false;
  }

  const reservationUtcMs =
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0) -
    SRI_LANKA_UTC_OFFSET_MINUTES * 60 * 1000;
  return nowMs > reservationUtcMs;
}

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

/**
 * Only accept valid remote HTTP(S) CDN URLs (e.g. Cloudflare R2).
 * Rejects base64 data URLs, local project file paths, and editorial:* keys.
 */
function sanitizeCdnUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

function sanitizeDocId(rawId: string | undefined | null, prefix: string): string {
  const cleaned = (rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 100);
  return cleaned || `${prefix}_${Date.now()}`;
}

function generateReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'OL-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Commits a Firestore write/delete promise without hanging the UI if server ack is slow
 * while persistentLocalCache() has already applied the mutation locally.
 */
async function commitFirestoreWrite(
  writePromise: Promise<unknown>,
  opType: OperationType,
  path: string
): Promise<void> {
  let settled = false;
  const guarded = writePromise
    .then(() => {
      settled = true;
    })
    .catch((err) => {
      settled = true;
      handleFirestoreError(err, opType, path);
    });

  await Promise.race([
    guarded,
    new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (!settled) resolve();
      }, 2500);
    }),
  ]);
}

const CLEAN_DEFAULT_MENU_ITEMS: MenuItem[] = DEFAULT_MENU_ITEMS.map((m) => ({
  ...m,
  imageUrl: sanitizeCdnUrl(m.imageUrl),
}));

const CLEAN_DEFAULT_GALLERY: GalleryItem[] = DEFAULT_GALLERY.map((g) => ({
  ...g,
  imageUrl: sanitizeCdnUrl(g.imageUrl),
}));

const CLEAN_DEFAULT_EVENTS: CafeEvent[] = DEFAULT_EVENTS.map((e) => ({
  ...e,
  imageUrl: sanitizeCdnUrl(e.imageUrl),
}));

const CLEAN_DEFAULT_SITE_CONTENT: SiteContentSection[] = DEFAULT_SITE_CONTENT.map((s) => ({
  ...s,
  id: s.sectionKey,
  imageUrl: sanitizeCdnUrl(s.imageUrl),
}));

export const CafeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionId] = useState<string>(getOrCreateSessionId);

  // Live Firestore state with clean initial defaults before first Firestore snapshot
  const [settings, setSettings] = useState<CafeSettings>(DEFAULT_SETTINGS);
  const [zones, setZones] = useState<SeatingZone[]>(DEFAULT_ZONES);
  const [tables, setTables] = useState<CafeTable[]>(DEFAULT_TABLES);
  const [openingHours, setOpeningHours] = useState<OpeningHoursConfig[]>(DEFAULT_OPENING_HOURS);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRecord[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(DEFAULT_MENU_CATEGORIES);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(CLEAN_DEFAULT_MENU_ITEMS);
  const [gallery, setGallery] = useState<GalleryItem[]>(CLEAN_DEFAULT_GALLERY);
  const [events, setEvents] = useState<CafeEvent[]>(CLEAN_DEFAULT_EVENTS);
  const [siteContent, setSiteContent] = useState<SiteContentSection[]>(CLEAN_DEFAULT_SITE_CONTENT);
  const [availability, setAvailability] = useState<AvailabilitySlotRecord[]>([]);
  const [seoGlobal, setSeoGlobal] = useState<GlobalSeoConfig>(DEFAULT_GLOBAL_SEO);
  const [seoPages, setSeoPages] = useState<Record<SeoPageKey, PageSeoConfig>>(DEFAULT_PAGE_SEO);

  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  const autoSeededRef = useRef(false);
  const purgingReservationIdsRef = useRef<Set<string>>(new Set());
  const purgingSlotIdsRef = useRef<Set<string>>(new Set());

  // Track which collections have live documents in Firestore vs unseeded defaults
  const hasLiveDocsRef = useRef({
    seatingZones: false,
    tables: false,
    openingHours: false,
    menuCategories: false,
    menuItems: false,
    gallery: false,
    events: false,
    siteContent: false,
  });

  // Track IDs deleted by the admin during the active session so deleted items never flicker back
  const deletedIdsRef = useRef({
    seatingZones: new Set<string>(),
    tables: new Set<string>(),
    blockedDates: new Set<string>(),
    menuCategories: new Set<string>(),
    menuItems: new Set<string>(),
    gallery: new Set<string>(),
    events: new Set<string>(),
  });

  const reservationsRef = useRef<ReservationRecord[]>(reservations);
  const settingsRef = useRef<CafeSettings>(settings);
  const zonesRef = useRef<SeatingZone[]>(zones);
  const tablesRef = useRef<CafeTable[]>(tables);
  const menuCategoriesRef = useRef<MenuCategory[]>(menuCategories);
  const menuItemsRef = useRef<MenuItem[]>(menuItems);
  const galleryRef = useRef<GalleryItem[]>(gallery);
  const eventsRef = useRef<CafeEvent[]>(events);
  const siteContentRef = useRef<SiteContentSection[]>(siteContent);
  const seoGlobalRef = useRef<GlobalSeoConfig>(seoGlobal);
  const seoPagesRef = useRef<Record<SeoPageKey, PageSeoConfig>>(seoPages);

  useEffect(() => {
    reservationsRef.current = reservations;
  }, [reservations]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);
  useEffect(() => {
    menuCategoriesRef.current = menuCategories;
  }, [menuCategories]);
  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);
  useEffect(() => {
    galleryRef.current = gallery;
  }, [gallery]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    siteContentRef.current = siteContent;
  }, [siteContent]);
  useEffect(() => {
    seoGlobalRef.current = seoGlobal;
  }, [seoGlobal]);
  useEffect(() => {
    seoPagesRef.current = seoPages;
  }, [seoPages]);

  const purgeExpiredReservation = useCallback(async (res: ReservationRecord) => {
    if (!res.id || purgingReservationIdsRef.current.has(res.id)) return;
    purgingReservationIdsRef.current.add(res.id);
    try {
      await deleteDoc(doc(db, 'reservations', res.id));
      const normTime = (res.time || '').replace(/[^a-zA-Z0-9]/g, '-');
      if (res.date && normTime && res.tableId) {
        const slotId = `${res.date}_${normTime}_${res.tableId}`;
        await Promise.all([
          deleteDoc(doc(db, 'availability', slotId)).catch(() => {}),
          deleteDoc(doc(db, 'reservationHolds', slotId)).catch(() => {}),
        ]);
      }
    } catch {
      purgingReservationIdsRef.current.delete(res.id);
    }
  }, []);

  // Periodic sweep: automatically delete passed reservations from Firestore
  useEffect(() => {
    const interval = window.setInterval(() => {
      const nowMs = Date.now();
      const expired = reservationsRef.current.filter((r) =>
        isReservationDateTimePassed(r.date, r.time, nowMs)
      );
      if (expired.length === 0) return;

      const expiredIds = new Set(expired.map((r) => r.id));
      setReservations((prev) => prev.filter((r) => !expiredIds.has(r.id)));
      expired.forEach((r) => {
        purgeExpiredReservation(r);
      });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [purgeExpiredReservation]);

  // 1. Auth & Admin Role Listener
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;

      if (currentUser) {
        try {
          await currentUser.getIdToken(true);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes('token-service-api') || errMsg.includes('disabled')) {
            await firebaseSignOut(auth).catch(() => {});
            if (!active) return;
            setUser(null);
            setIsAdmin(false);
            setAuthReady(true);
            return;
          }
        }
      }

      if (!active) return;
      setUser(currentUser);

      if (!currentUser) {
        autoSeededRef.current = false;
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const resolvedEmail = getPrimaryUserEmail(currentUser);
      const isBootstrapAdmin = isAuthorizedAdminUser(currentUser);

      if (!currentUser.emailVerified && !isBootstrapAdmin) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      if (isBootstrapAdmin && currentUser.emailVerified) {
        try {
          const adminDocRef = doc(db, 'admins', currentUser.uid);
          const adminSnap = await getDoc(adminDocRef);
          if (!adminSnap.exists()) {
            await setDoc(adminDocRef, {
              email: resolvedEmail || 'admin@onelovecafesigiriya.com',
              name:
                currentUser.displayName ||
                (resolvedEmail ? resolvedEmail.split('@')[0] : 'Admin'),
              role: 'super_admin',
              createdAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal if offline or already recorded
        }
        if (!active) return;
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        if (!active) return;
        setIsAdmin(adminSnap.exists());
      } catch {
        if (!active) return;
        setIsAdmin(false);
      } finally {
        if (active) setAuthReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Direct Cloudflare R2 object cleanup helper
  const deleteMediaFromR2 = useCallback(async (urlOrUrls: string | string[]) => {
    const rawList = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    const validUrls = rawList
      .map((u) => sanitizeCdnUrl(u))
      .filter((u) => Boolean(u));
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

  // 2. Direct Real-Time Firestore Listeners (Single Source of Truth -> Live Site)
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'settings'),
        (snap) => {
          const mainDoc = snap.docs.find((d) => d.id === 'main');
          if (mainDoc) {
            const data = mainDoc.data() as Omit<CafeSettings, 'id'>;
            const cleanHeroLinks = Array.isArray(data.heroImages)
              ? data.heroImages.map((u) => sanitizeCdnUrl(u)).filter(Boolean)
              : [];
            const nextSettings: CafeSettings = {
              ...DEFAULT_SETTINGS,
              id: mainDoc.id,
              ...data,
              heroImages: cleanHeroLinks,
              heroSlideshowSpeedSeconds:
                typeof data.heroSlideshowSpeedSeconds === 'number'
                  ? data.heroSlideshowSpeedSeconds
                  : DEFAULT_SETTINGS.heroSlideshowSpeedSeconds,
              floorPlanImageUrl: sanitizeCdnUrl(data.floorPlanImageUrl),
              googleMapsEmbedUrl:
                !data.googleMapsEmbedUrl || data.googleMapsEmbedUrl.includes('7.9541,80.7547')
                  ? DEFAULT_SETTINGS.googleMapsEmbedUrl
                  : data.googleMapsEmbedUrl,
            };
            settingsRef.current = nextSettings;
            setSettings(nextSettings);
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
            hasLiveDocsRef.current.seatingZones = true;
            const list = snap.docs
              .filter((d) => !deletedIdsRef.current.seatingZones.has(d.id))
              .map((d) => ({ id: d.id, ...(d.data() as Omit<SeatingZone, 'id'>) }))
              .sort((a, b) => a.sortOrder - b.sortOrder);
            zonesRef.current = list;
            setZones(list);
          } else if (hasLiveDocsRef.current.seatingZones) {
            zonesRef.current = [];
            setZones([]);
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
            hasLiveDocsRef.current.tables = true;
            const list = snap.docs
              .filter((d) => !deletedIdsRef.current.tables.has(d.id))
              .map((d) => ({ id: d.id, ...(d.data() as Omit<CafeTable, 'id'>) }))
              .sort((a, b) => a.number - b.number);
            tablesRef.current = list;
            setTables(list);
          } else if (hasLiveDocsRef.current.tables) {
            tablesRef.current = [];
            setTables([]);
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
            hasLiveDocsRef.current.openingHours = true;
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
          const list = snap.docs
            .filter((d) => !deletedIdsRef.current.blockedDates.has(d.id))
            .map((d) => ({
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
            hasLiveDocsRef.current.menuCategories = true;
            const list = snap.docs
              .filter((d) => !deletedIdsRef.current.menuCategories.has(d.id))
              .map((d) => {
                const raw = d.data() as Omit<MenuCategory, 'id'>;
                return {
                  id: d.id,
                  ...raw,
                  section: resolveMenuCategorySection({ id: d.id, ...raw }),
                };
              })
              .sort((a, b) => a.sortOrder - b.sortOrder);
            menuCategoriesRef.current = list;
            setMenuCategories(list);
          } else if (hasLiveDocsRef.current.menuCategories) {
            menuCategoriesRef.current = [];
            setMenuCategories([]);
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
            hasLiveDocsRef.current.menuItems = true;
            const list = snap.docs
              .filter((d) => !deletedIdsRef.current.menuItems.has(d.id))
              .map((d) => {
                const raw = d.data() as Omit<MenuItem, 'id'>;
                return {
                  id: d.id,
                  ...raw,
                  imageUrl: sanitizeCdnUrl(raw.imageUrl),
                };
              });
            menuItemsRef.current = list;
            setMenuItems(list);
          } else if (hasLiveDocsRef.current.menuItems) {
            menuItemsRef.current = [];
            setMenuItems([]);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'menuItems')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'gallery'),
        (snap) => {
          if (!snap.empty) {
            hasLiveDocsRef.current.gallery = true;
            const list = snap.docs
              .filter((d) => !deletedIdsRef.current.gallery.has(d.id))
              .map((d) => {
                const raw = d.data() as Omit<GalleryItem, 'id'>;
                return {
                  id: d.id,
                  ...raw,
                  imageUrl: sanitizeCdnUrl(raw.imageUrl),
                };
              })
              .sort((a, b) => a.sortOrder - b.sortOrder);
            galleryRef.current = list;
            setGallery(list);
          } else if (hasLiveDocsRef.current.gallery) {
            galleryRef.current = [];
            setGallery([]);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'gallery')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'events'),
        (snap) => {
          if (!snap.empty) {
            hasLiveDocsRef.current.events = true;
            const list = snap.docs
              .filter((d) => !deletedIdsRef.current.events.has(d.id))
              .map((d) => {
                const raw = d.data() as Omit<CafeEvent, 'id'>;
                return {
                  id: d.id,
                  ...raw,
                  imageUrl: sanitizeCdnUrl(raw.imageUrl),
                };
              });
            eventsRef.current = list;
            setEvents(list);
          } else if (hasLiveDocsRef.current.events) {
            eventsRef.current = [];
            setEvents([]);
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
            hasLiveDocsRef.current.siteContent = true;
          }
          const byKey = new Map<string, SiteContentSection>();
          const timestampByKey = new Map<string, { ms: number; isCanonical: boolean }>();

          // Base structure keys exist for sections not yet in Firestore; Firestore docs always override
          CLEAN_DEFAULT_SITE_CONTENT.forEach((def) => {
            byKey.set(def.sectionKey, { ...def, id: def.sectionKey });
            timestampByKey.set(def.sectionKey, { ms: -1, isCanonical: false });
          });

          snap.docs
            .filter((d) => !d.id.startsWith('sec_hero_slide_'))
            .forEach((d) => {
              const raw = d.data() as Omit<SiteContentSection, 'id'> & {
                updatedAt?: { toMillis?: () => number; seconds?: number };
              };
              const key = (raw.sectionKey || d.id.replace(/^sec_/, '')).trim();
              if (!key || key.startsWith('hero_slide_')) return;

              const updatedMs =
                typeof raw.updatedAt?.toMillis === 'function'
                  ? raw.updatedAt.toMillis()
                  : typeof raw.updatedAt?.seconds === 'number'
                  ? raw.updatedAt.seconds * 1000
                  : 0;
              const isCanonical = d.id === key;
              const prevMeta = timestampByKey.get(key);

              const shouldReplace =
                !prevMeta ||
                prevMeta.ms < 0 ||
                updatedMs > prevMeta.ms ||
                (updatedMs === prevMeta.ms && isCanonical && !prevMeta.isCanonical);

              if (shouldReplace) {
                timestampByKey.set(key, { ms: updatedMs, isCanonical });
                byKey.set(key, {
                  id: key,
                  sectionKey: key,
                  kicker: raw.kicker ?? '',
                  heading: raw.heading ?? '',
                  subheading: raw.subheading ?? '',
                  body: raw.body ?? '',
                  ctaLabel: raw.ctaLabel ?? '',
                  ctaLink: raw.ctaLink ?? '',
                  imageUrl: sanitizeCdnUrl(raw.imageUrl),
                });
              }
            });

          const nextContent = Array.from(byKey.values());
          siteContentRef.current = nextContent;
          setSiteContent(nextContent);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'siteContent')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'availability'),
        (snap) => {
          const nowMs = Date.now();
          const allSlots = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AvailabilitySlotRecord, 'id'>),
          }));
          const activeSlots: AvailabilitySlotRecord[] = [];
          allSlots.forEach((slot) => {
            if (isReservationDateTimePassed(slot.date, slot.time, nowMs)) {
              if (!purgingSlotIdsRef.current.has(slot.id)) {
                purgingSlotIdsRef.current.add(slot.id);
                deleteDoc(doc(db, 'availability', slot.id)).catch(() => {
                  purgingSlotIdsRef.current.delete(slot.id);
                });
              }
            } else {
              activeSlots.push(slot);
            }
          });
          setAvailability(activeSlots);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'availability')
      )
    );

    const releasedReservationIds = new Set<string>();
    unsubs.push(
      onSnapshot(
        collection(db, 'reservations'),
        (snap) => {
          const nowMs = Date.now();
          const allList = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ReservationRecord, 'id'>) }))
            .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));

          const activeList: ReservationRecord[] = [];
          const expiredList: ReservationRecord[] = [];
          allList.forEach((res) => {
            if (isReservationDateTimePassed(res.date, res.time, nowMs)) {
              expiredList.push(res);
            } else {
              activeList.push(res);
            }
          });

          setReservations(activeList);

          if (expiredList.length > 0) {
            expiredList.forEach((expiredRes) => {
              purgeExpiredReservation(expiredRes);
            });
          }

          snap.docChanges().forEach((change) => {
            if (change.type === 'removed') return;
            const res = {
              id: change.doc.id,
              ...(change.doc.data() as Omit<ReservationRecord, 'id'>),
            };
            if (isReservationDateTimePassed(res.date, res.time, nowMs)) return;

            if (res.status === 'cancelled' || res.status === 'rejected') {
              const releaseKey = `${res.id}_${res.status}`;
              if (releasedReservationIds.has(releaseKey)) return;
              releasedReservationIds.add(releaseKey);

              const normTime = res.time.replace(/[^a-zA-Z0-9]/g, '-');
              const slotId = `${res.date}_${normTime}_${res.tableId}`;

              const hasOtherActiveReservation = activeList.some(
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

    unsubs.push(
      onSnapshot(
        collection(db, 'seoConfig'),
        (snap) => {
          const mainDoc = snap.docs.find((d) => d.id === 'main');
          if (mainDoc) {
            const data = mainDoc.data() as Omit<GlobalSeoConfig, 'id'>;
            const faviconUrl = sanitizeCdnUrl(data.faviconSourceUrl);
            const nextSeo: GlobalSeoConfig = {
              ...DEFAULT_GLOBAL_SEO,
              ...data,
              id: 'main',
              defaultOgImageUrl: sanitizeCdnUrl(data.defaultOgImageUrl),
              brandLogoUrl: sanitizeCdnUrl(data.brandLogoUrl),
              faviconSourceUrl: faviconUrl,
              favicon48Url: sanitizeCdnUrl(data.favicon48Url) || faviconUrl,
              favicon96Url: sanitizeCdnUrl(data.favicon96Url) || faviconUrl,
              favicon192Url: sanitizeCdnUrl(data.favicon192Url) || faviconUrl,
              appleTouchIconUrl: sanitizeCdnUrl(data.appleTouchIconUrl) || faviconUrl,
            };
            seoGlobalRef.current = nextSeo;
            setSeoGlobal(nextSeo);
          }
        },
        (err) => console.warn('SEO config sync note:', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'seoPages'),
        (snap) => {
          if (!snap.empty) {
            const nextPages: Record<SeoPageKey, PageSeoConfig> = { ...DEFAULT_PAGE_SEO };
            snap.docs.forEach((d) => {
              const key = d.id as SeoPageKey;
              if (key in nextPages) {
                const raw = d.data() as Omit<PageSeoConfig, 'id'>;
                nextPages[key] = {
                  ...nextPages[key],
                  ...raw,
                  id: key,
                  routePath: DEFAULT_PAGE_SEO[key].routePath,
                  canonicalPath: DEFAULT_PAGE_SEO[key].canonicalPath,
                  ogImageUrl: sanitizeCdnUrl(raw.ogImageUrl),
                };
              }
            });
            seoPagesRef.current = nextPages;
            setSeoPages(nextPages);
          }
        },
        (err) => console.warn('SEO pages sync note:', err)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [purgeExpiredReservation]);

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
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStorageStatus({
          configured: Boolean(data.configured),
          provider: data.provider || 'unconfigured',
          bucket: data.bucket || null,
          publicUrl: data.publicUrl || null,
        });
      }
    } catch {
      setStorageStatus({ configured: false, provider: 'unconfigured' });
    }
  }, []);

  useEffect(() => {
    checkStorageStatus();
  }, [checkStorageStatus]);

  // Seed initial sanctuary data directly to Firestore if empty (or when requested by Admin)
  const seedDatabaseIfNeeded = useCallback(async () => {
    if (!isAdmin) return;
    try {
      deletedIdsRef.current.seatingZones.clear();
      deletedIdsRef.current.tables.clear();
      deletedIdsRef.current.menuCategories.clear();
      deletedIdsRef.current.menuItems.clear();
      deletedIdsRef.current.gallery.clear();
      deletedIdsRef.current.events.clear();

      const { id: settingId, ...settingData } = DEFAULT_SETTINGS;
      await setDoc(doc(db, 'settings', settingId), {
        ...settingData,
        heroImages: (settingData.heroImages || []).map((u) => sanitizeCdnUrl(u)).filter(Boolean),
        floorPlanImageUrl: sanitizeCdnUrl(settingData.floorPlanImageUrl),
        updatedAt: serverTimestamp(),
      });

      for (const z of DEFAULT_ZONES) {
        const { id, ...data } = z;
        await setDoc(doc(db, 'seatingZones', id), { ...data, updatedAt: serverTimestamp() });
      }
      hasLiveDocsRef.current.seatingZones = true;

      for (const t of DEFAULT_TABLES) {
        const { id, ...data } = t;
        await setDoc(doc(db, 'tables', id), { ...data, updatedAt: serverTimestamp() });
      }
      hasLiveDocsRef.current.tables = true;

      for (const oh of DEFAULT_OPENING_HOURS) {
        const { id, ...data } = oh;
        await setDoc(doc(db, 'openingHours', id), { ...data, updatedAt: serverTimestamp() });
      }
      hasLiveDocsRef.current.openingHours = true;

      for (const cat of DEFAULT_MENU_CATEGORIES) {
        const { id, ...data } = cat;
        await setDoc(doc(db, 'menuCategories', id), {
          ...data,
          section: resolveMenuCategorySection(cat),
          updatedAt: serverTimestamp(),
        });
      }
      hasLiveDocsRef.current.menuCategories = true;

      for (const item of CLEAN_DEFAULT_MENU_ITEMS) {
        const { id, ...data } = item;
        await setDoc(doc(db, 'menuItems', id), {
          ...data,
          priceCurrency: data.priceCurrency || 'default',
          imageUrl: sanitizeCdnUrl(data.imageUrl),
          updatedAt: serverTimestamp(),
        });
      }
      hasLiveDocsRef.current.menuItems = true;

      for (const gItem of CLEAN_DEFAULT_GALLERY) {
        await setDoc(doc(db, 'gallery', gItem.id), {
          title: gItem.title.slice(0, 160),
          category: gItem.category,
          caption: gItem.caption.slice(0, 600),
          imageUrl: sanitizeCdnUrl(gItem.imageUrl),
          aspectRatio: gItem.aspectRatio,
          isFeatured: Boolean(gItem.isFeatured),
          sortOrder: Number(gItem.sortOrder) || 1,
          createdAt: serverTimestamp(),
        });
      }
      hasLiveDocsRef.current.gallery = true;

      for (const evt of CLEAN_DEFAULT_EVENTS) {
        const { id, ...data } = evt;
        await setDoc(doc(db, 'events', id), {
          ...data,
          imageUrl: sanitizeCdnUrl(data.imageUrl),
          updatedAt: serverTimestamp(),
        });
      }
      hasLiveDocsRef.current.events = true;

      for (const sc of CLEAN_DEFAULT_SITE_CONTENT) {
        const canonicalId = sc.sectionKey;
        await setDoc(doc(db, 'siteContent', canonicalId), {
          sectionKey: sc.sectionKey,
          kicker: sc.kicker,
          heading: sc.heading,
          subheading: sc.subheading,
          body: sc.body,
          ctaLabel: sc.ctaLabel,
          ctaLink: sc.ctaLink,
          imageUrl: sanitizeCdnUrl(sc.imageUrl),
          updatedAt: serverTimestamp(),
        });
      }
      hasLiveDocsRef.current.siteContent = true;

      logAdminAction(
        'SEED_SANCTUARY_DATA',
        'settings',
        'main',
        'Initialized OneLove Café Sigiriya data in Firestore'
      ).catch(() => {});
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seedDatabase');
    }
  }, [isAdmin]);

  // 3. Protected Admin Real-Time Listeners & Per-Collection First-Time Auto-Bootstrap Seeding
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setInquiries([]);
      setAdmins([]);
      setAuditLogs([]);
      return;
    }

    if (!autoSeededRef.current) {
      autoSeededRef.current = true;
      (async () => {
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
          if (!settingsSnap.exists()) {
            const { id: settingId, ...settingData } = DEFAULT_SETTINGS;
            await setDoc(doc(db, 'settings', settingId), {
              ...settingData,
              heroImages: (settingData.heroImages || []).map((u) => sanitizeCdnUrl(u)).filter(Boolean),
              floorPlanImageUrl: sanitizeCdnUrl(settingData.floorPlanImageUrl),
              updatedAt: serverTimestamp(),
            });
          }

          const catsSnap = await getDocs(query(collection(db, 'menuCategories'), limit(1)));
          if (catsSnap.empty && !hasLiveDocsRef.current.menuCategories) {
            hasLiveDocsRef.current.menuCategories = true;
            for (const cat of menuCategoriesRef.current) {
              const { id, ...data } = cat;
              await setDoc(doc(db, 'menuCategories', id), {
                ...data,
                section: resolveMenuCategorySection(cat),
                updatedAt: serverTimestamp(),
              });
            }
          }

          const itemsSnap = await getDocs(query(collection(db, 'menuItems'), limit(1)));
          if (itemsSnap.empty && !hasLiveDocsRef.current.menuItems) {
            hasLiveDocsRef.current.menuItems = true;
            for (const item of menuItemsRef.current) {
              const { id, ...data } = item;
              await setDoc(doc(db, 'menuItems', id), {
                ...data,
                priceCurrency: data.priceCurrency || 'default',
                imageUrl: sanitizeCdnUrl(data.imageUrl),
                updatedAt: serverTimestamp(),
              });
            }
          }

          const galSnap = await getDocs(query(collection(db, 'gallery'), limit(1)));
          if (galSnap.empty && !hasLiveDocsRef.current.gallery) {
            hasLiveDocsRef.current.gallery = true;
            for (const gItem of galleryRef.current) {
              await setDoc(doc(db, 'gallery', gItem.id), {
                title: gItem.title.slice(0, 160),
                category: gItem.category,
                caption: gItem.caption.slice(0, 600),
                imageUrl: sanitizeCdnUrl(gItem.imageUrl),
                aspectRatio: gItem.aspectRatio,
                isFeatured: Boolean(gItem.isFeatured),
                sortOrder: Number(gItem.sortOrder) || 1,
                createdAt: serverTimestamp(),
              });
            }
          }

          const evtSnap = await getDocs(query(collection(db, 'events'), limit(1)));
          if (evtSnap.empty && !hasLiveDocsRef.current.events) {
            hasLiveDocsRef.current.events = true;
            for (const evt of eventsRef.current) {
              const { id, ...data } = evt;
              await setDoc(doc(db, 'events', id), {
                ...data,
                imageUrl: sanitizeCdnUrl(data.imageUrl),
                updatedAt: serverTimestamp(),
              });
            }
          }

          const contentSnap = await getDocs(query(collection(db, 'siteContent'), limit(1)));
          if (contentSnap.empty && !hasLiveDocsRef.current.siteContent) {
            hasLiveDocsRef.current.siteContent = true;
            for (const sc of siteContentRef.current) {
              await setDoc(doc(db, 'siteContent', sc.sectionKey), {
                sectionKey: sc.sectionKey,
                kicker: sc.kicker,
                heading: sc.heading,
                subheading: sc.subheading,
                body: sc.body,
                ctaLabel: sc.ctaLabel,
                ctaLink: sc.ctaLink,
                imageUrl: sanitizeCdnUrl(sc.imageUrl),
                updatedAt: serverTimestamp(),
              });
            }
          }

          const zonesSnap = await getDocs(query(collection(db, 'seatingZones'), limit(1)));
          if (zonesSnap.empty && !hasLiveDocsRef.current.seatingZones) {
            hasLiveDocsRef.current.seatingZones = true;
            for (const z of zonesRef.current) {
              const { id, ...data } = z;
              await setDoc(doc(db, 'seatingZones', id), { ...data, updatedAt: serverTimestamp() });
            }
          }

          const tablesSnap = await getDocs(query(collection(db, 'tables'), limit(1)));
          if (tablesSnap.empty && !hasLiveDocsRef.current.tables) {
            hasLiveDocsRef.current.tables = true;
            for (const t of tablesRef.current) {
              const { id, ...data } = t;
              await setDoc(doc(db, 'tables', id), { ...data, updatedAt: serverTimestamp() });
            }
          }
        } catch (err) {
          console.warn('Background initial collection bootstrap note:', err);
        }
      })();
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
  }, [authReady, isAdmin]);

  const signInAdmin = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutAdmin = useCallback(async () => {
    autoSeededRef.current = false;
    await firebaseSignOut(auth);
  }, []);

  // Direct Firestore Table Hold
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
      const expiresAtMs = Math.round(nowMs + holdDurationMs);

      const hasActiveReservation = reservations.some(
        (r) =>
          r.date === safeDate &&
          r.tableId === safeTableId &&
          (r.time === safeTime || r.time.replace(/[^a-zA-Z0-9]/g, '-') === normalizedTime) &&
          (r.status === 'confirmed' || r.status === 'seated')
      );
      if (hasActiveReservation) {
        throw new Error('This table has just been reserved by another guest.');
      }

      const existingSlot = availability.find(
        (s) =>
          s.id === slotId ||
          (s.date === safeDate && s.time === safeTime && s.tableId === safeTableId)
      );
      if (
        existingSlot &&
        existingSlot.status === 'held' &&
        existingSlot.sessionId !== sessionId &&
        existingSlot.holdExpiresAtMs > nowMs
      ) {
        throw new Error('This table is currently being held by another guest.');
      }

      setAvailability((prev) => {
        const filtered = prev.filter((s) => s.id !== slotId);
        return [
          ...filtered,
          {
            id: slotId,
            date: safeDate,
            time: safeTime,
            tableId: safeTableId,
            status: 'held',
            holdExpiresAtMs: expiresAtMs,
            sessionId: sessionId.slice(0, 80),
            referenceCode: 'HOLD',
          },
        ];
      });

      Promise.all([
        setDoc(slotRef, {
          date: safeDate,
          time: safeTime,
          tableId: safeTableId,
          status: 'held',
          holdExpiresAtMs: expiresAtMs,
          sessionId: sessionId.slice(0, 80),
          referenceCode: 'HOLD',
          updatedAt: serverTimestamp(),
        }),
        setDoc(holdRef, {
          slotId: slotId.slice(0, 80),
          date: safeDate,
          time: safeTime,
          tableId: safeTableId,
          sessionId: sessionId.slice(0, 80),
          expiresAtMs,
          createdAt: serverTimestamp(),
        }),
      ]).catch((err) => {
        console.warn('Background hold sync note:', err);
      });

      return { slotId, expiresAtMs };
    },
    [sessionId, settings.holdDurationMinutes, reservations, availability]
  );

  // Direct Firestore Reservation Confirmation
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

      setReservations((prev) => [confirmedRecord, ...prev]);

      const reservationWritePromise = setDoc(reservationRef, {
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

      const slotWritePromise = setDoc(slotRef, {
        date: safeDate,
        time: safeTime,
        tableId: safeTableId,
        status: 'reserved',
        holdExpiresAtMs: 0,
        sessionId: sessionId.slice(0, 80),
        referenceCode,
        updatedAt: serverTimestamp(),
      }).catch((slotError) => {
        console.warn('Availability slot update skipped:', slotError);
      });

      await commitFirestoreWrite(
        Promise.all([reservationWritePromise, slotWritePromise]),
        OperationType.CREATE,
        `reservations/${reservationId}`
      );

      return confirmedRecord;
    },
    [sessionId]
  );

  // Direct Firestore Concierge Inquiry Submission
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
      await commitFirestoreWrite(
        setDoc(doc(db, 'inquiries', inquiryId), {
          name: safeName,
          email: safeEmail,
          phone: safePhone,
          subject: safeSubject,
          message: safeMessage,
          status: 'new',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        OperationType.CREATE,
        `inquiries/${inquiryId}`
      );
    },
    []
  );

  // Admin Operations (Optimistic UI + Direct Firestore & R2 Sync)
  const updateReservationStatus = useCallback(
    async (reservation: ReservationRecord, newStatus: ReservationRecord['status']) => {
      const normalizedTime = reservation.time.replace(/[^a-zA-Z0-9]/g, '-');
      const slotId = `${reservation.date}_${normalizedTime}_${reservation.tableId}`;

      setReservations((prev) =>
        prev.map((r) => (r.id === reservation.id ? { ...r, status: newStatus } : r))
      );

      const nextSlotStatus =
        newStatus === 'cancelled' || newStatus === 'rejected' || newStatus === 'completed'
          ? 'available'
          : newStatus === 'seated'
          ? 'occupied'
          : 'reserved';

      setAvailability((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, status: nextSlotStatus } : s))
      );

      await commitFirestoreWrite(
        Promise.all([
          setDoc(
            doc(db, 'reservations', reservation.id),
            {
              status: newStatus,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
          setDoc(doc(db, 'availability', slotId), {
            date: reservation.date.slice(0, 10),
            time: reservation.time.slice(0, 10),
            tableId: reservation.tableId.slice(0, 40),
            status: nextSlotStatus,
            holdExpiresAtMs: 0,
            sessionId: 'admin',
            referenceCode: reservation.referenceCode.slice(0, 24),
            updatedAt: serverTimestamp(),
          }),
        ]),
        OperationType.UPDATE,
        `reservations/${reservation.id}`
      );

      logAdminAction(
        `RESERVATION_${newStatus.toUpperCase()}`,
        'reservations',
        reservation.id,
        `Updated reservation ${reservation.referenceCode} (${reservation.guestName}) to ${newStatus}`
      ).catch(() => {});
    },
    []
  );

  const saveTable = useCallback(async (table: CafeTable) => {
    const safeId = sanitizeDocId(table.id, 'T');
    const safeLabel = (table.label || 'Table').trim().slice(0, 60) || 'Table';
    const safeNumber = Math.max(1, Math.round(Number(table.number) || 1));
    const safeCapacity = Math.max(1, Math.round(Number(table.capacity) || 2));
    const safeMinGuests = Math.max(
      1,
      Math.min(safeCapacity, Math.round(Number(table.minGuests) || 1))
    );

    const cleanTable: CafeTable = {
      id: safeId,
      label: safeLabel,
      number: safeNumber,
      capacity: safeCapacity,
      minGuests: safeMinGuests,
      zoneId: (table.zoneId || 'zone_garden').trim().slice(0, 80) || 'zone_garden',
      zoneName: (table.zoneName || 'Garden Sanctuary').trim().slice(0, 100) || 'Garden Sanctuary',
      shape: table.shape || 'round',
      x: Math.max(0, Math.min(100, Number(table.x) || 50)),
      y: Math.max(0, Math.min(100, Number(table.y) || 50)),
      isVip: Boolean(table.isVip),
      isActive: Boolean(table.isActive),
      notes: (table.notes || '').slice(0, 400),
    };

    deletedIdsRef.current.tables.delete(safeId);
    setTables((prev) => {
      const exists = prev.some((t) => t.id === safeId);
      const next = (
        exists ? prev.map((t) => (t.id === safeId ? cleanTable : t)) : [...prev, cleanTable]
      ).sort((a, b) => a.number - b.number);
      tablesRef.current = next;
      return next;
    });

    if (!hasLiveDocsRef.current.tables) {
      hasLiveDocsRef.current.tables = true;
      tablesRef.current
        .filter((t) => t.id !== safeId)
        .forEach((t) => {
          const { id, ...d } = t;
          setDoc(doc(db, 'tables', id), { ...d, updatedAt: serverTimestamp() }).catch(() => {});
        });
    }

    const { id: _id, ...payload } = cleanTable;
    await commitFirestoreWrite(
      setDoc(doc(db, 'tables', safeId), {
        ...payload,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `tables/${safeId}`
    );

    logAdminAction('SAVE_TABLE', 'tables', safeId, `Updated floor plan table ${safeLabel}`).catch(
      () => {}
    );
  }, []);

  const deleteTable = useCallback(async (tableId: string) => {
    deletedIdsRef.current.tables.add(tableId);
    const remaining = tablesRef.current.filter((t) => t.id !== tableId);
    tablesRef.current = remaining;
    setTables(remaining);

    if (!hasLiveDocsRef.current.tables) {
      hasLiveDocsRef.current.tables = true;
      remaining.forEach((t) => {
        const { id, ...d } = t;
        setDoc(doc(db, 'tables', id), { ...d, updatedAt: serverTimestamp() }).catch(() => {});
      });
    }

    await commitFirestoreWrite(
      deleteDoc(doc(db, 'tables', tableId)),
      OperationType.DELETE,
      `tables/${tableId}`
    );
    logAdminAction('DELETE_TABLE', 'tables', tableId, `Deleted table ${tableId}`).catch(() => {});
  }, []);

  const saveZone = useCallback(async (zone: SeatingZone) => {
    const safeId = sanitizeDocId(zone.id, 'zone');
    const safeName = (zone.name || 'Sanctuary Zone').trim().slice(0, 100) || 'Sanctuary Zone';
    const safeSortOrder = Math.max(0, Math.round(Number(zone.sortOrder) || 1));

    const cleanZone: SeatingZone = {
      id: safeId,
      name: safeName,
      subtitle: (zone.subtitle || '').slice(0, 240),
      description: (zone.description || '').slice(0, 600),
      atmosphere: (zone.atmosphere || '').slice(0, 200),
      isActive: Boolean(zone.isActive),
      sortOrder: safeSortOrder,
    };

    deletedIdsRef.current.seatingZones.delete(safeId);
    setZones((prev) => {
      const exists = prev.some((z) => z.id === safeId);
      const next = (
        exists ? prev.map((z) => (z.id === safeId ? cleanZone : z)) : [...prev, cleanZone]
      ).sort((a, b) => a.sortOrder - b.sortOrder);
      zonesRef.current = next;
      return next;
    });

    if (!hasLiveDocsRef.current.seatingZones) {
      hasLiveDocsRef.current.seatingZones = true;
      zonesRef.current
        .filter((z) => z.id !== safeId)
        .forEach((z) => {
          const { id, ...d } = z;
          setDoc(doc(db, 'seatingZones', id), { ...d, updatedAt: serverTimestamp() }).catch(
            () => {}
          );
        });
    }

    const { id: _id, ...payload } = cleanZone;
    await commitFirestoreWrite(
      setDoc(doc(db, 'seatingZones', safeId), {
        ...payload,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `seatingZones/${safeId}`
    );

    logAdminAction('SAVE_ZONE', 'seatingZones', safeId, `Updated seating zone ${safeName}`).catch(
      () => {}
    );
  }, []);

  const deleteZone = useCallback(async (zoneId: string) => {
    deletedIdsRef.current.seatingZones.add(zoneId);
    const remaining = zonesRef.current.filter((z) => z.id !== zoneId);
    zonesRef.current = remaining;
    setZones(remaining);

    if (!hasLiveDocsRef.current.seatingZones) {
      hasLiveDocsRef.current.seatingZones = true;
      remaining.forEach((z) => {
        const { id, ...d } = z;
        setDoc(doc(db, 'seatingZones', id), { ...d, updatedAt: serverTimestamp() }).catch(() => {});
      });
    }

    await commitFirestoreWrite(
      deleteDoc(doc(db, 'seatingZones', zoneId)),
      OperationType.DELETE,
      `seatingZones/${zoneId}`
    );
    logAdminAction('DELETE_ZONE', 'seatingZones', zoneId, `Deleted seating zone ${zoneId}`).catch(
      () => {}
    );
  }, []);

  const saveOpeningHours = useCallback(async (config: OpeningHoursConfig) => {
    const safeId = sanitizeDocId(config.id, 'day');
    const safeSlotDuration = Math.min(
      240,
      Math.max(15, Math.round(Number(config.slotDurationMinutes) || 90))
    );
    const safeGracePeriod = Math.min(
      60,
      Math.max(5, Math.round(Number(config.gracePeriodMinutes) || 15))
    );

    const cleanOh: OpeningHoursConfig = {
      id: safeId,
      dayOfWeek: (config.dayOfWeek || 'Monday').trim().slice(0, 30) || 'Monday',
      isOpen: Boolean(config.isOpen),
      openTime: (config.openTime || '07:30').slice(0, 20),
      closeTime: (config.closeTime || '22:30').slice(0, 20),
      slotDurationMinutes: safeSlotDuration,
      gracePeriodMinutes: safeGracePeriod,
    };

    setOpeningHours((prev) =>
      prev.some((o) => o.id === safeId)
        ? prev.map((o) => (o.id === safeId ? cleanOh : o))
        : [...prev, cleanOh]
    );

    const { id: _id, ...payload } = cleanOh;
    await commitFirestoreWrite(
      setDoc(doc(db, 'openingHours', safeId), {
        ...payload,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `openingHours/${safeId}`
    );

    logAdminAction(
      'SAVE_OPENING_HOURS',
      'openingHours',
      safeId,
      `Updated opening hours for ${cleanOh.dayOfWeek}`
    ).catch(() => {});
  }, []);

  const saveBlockedDate = useCallback(async (blocked: BlockedDateRecord) => {
    const safeId = sanitizeDocId(blocked.id, 'blk');
    const safeReason = (blocked.reason || 'Private Event').trim().slice(0, 300) || 'Private Event';
    const cleanBlocked: BlockedDateRecord = {
      id: safeId,
      date: blocked.date.slice(0, 10),
      reason: safeReason,
      isFullDay: Boolean(blocked.isFullDay),
      blockedSlots: (blocked.blockedSlots || []).slice(0, 30),
    };

    deletedIdsRef.current.blockedDates.delete(safeId);
    setBlockedDates((prev) => {
      const exists = prev.some((b) => b.id === safeId);
      return exists ? prev.map((b) => (b.id === safeId ? cleanBlocked : b)) : [...prev, cleanBlocked];
    });

    await commitFirestoreWrite(
      setDoc(doc(db, 'blockedDates', safeId), {
        date: cleanBlocked.date,
        reason: cleanBlocked.reason,
        isFullDay: cleanBlocked.isFullDay,
        blockedSlots: cleanBlocked.blockedSlots,
        createdAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `blockedDates/${safeId}`
    );

    logAdminAction(
      'ADD_BLOCKED_DATE',
      'blockedDates',
      safeId,
      `Blocked date ${cleanBlocked.date}: ${safeReason}`
    ).catch(() => {});
  }, []);

  const deleteBlockedDate = useCallback(async (id: string) => {
    deletedIdsRef.current.blockedDates.add(id);
    setBlockedDates((prev) => prev.filter((b) => b.id !== id));

    await commitFirestoreWrite(
      deleteDoc(doc(db, 'blockedDates', id)),
      OperationType.DELETE,
      `blockedDates/${id}`
    );
    logAdminAction('REMOVE_BLOCKED_DATE', 'blockedDates', id, `Removed blocked date ${id}`).catch(
      () => {}
    );
  }, []);

  const saveMenuCategory = useCallback(async (cat: MenuCategory) => {
    const safeId = sanitizeDocId(cat.id, 'cat');
    const safeName = (cat.name || 'Untitled Category').trim().slice(0, 100) || 'Untitled Category';
    const safeSlug = (
      (cat.slug || '').trim() ||
      safeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
      'category'
    ).slice(0, 100);
    const safeSortOrder = Math.max(0, Math.round(Number(cat.sortOrder) || 1));
    const resolvedSection = resolveMenuCategorySection({ ...cat, id: safeId, name: safeName });

    const cleanCategory: MenuCategory = {
      id: safeId,
      name: safeName,
      slug: safeSlug,
      subtitle: (cat.subtitle || '').slice(0, 300),
      section: resolvedSection,
      sortOrder: safeSortOrder,
      isActive: Boolean(cat.isActive),
    };

    deletedIdsRef.current.menuCategories.delete(safeId);
    setMenuCategories((prev) => {
      const exists = prev.some((c) => c.id === safeId);
      const next = (
        exists ? prev.map((c) => (c.id === safeId ? cleanCategory : c)) : [...prev, cleanCategory]
      ).sort((a, b) => a.sortOrder - b.sortOrder);
      menuCategoriesRef.current = next;
      return next;
    });

    // Keep categoryName in sync on any menuItems belonging to this category
    setMenuItems((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (m.categoryId === safeId && m.categoryName !== safeName) {
          changed = true;
          return { ...m, categoryName: safeName };
        }
        return m;
      });
      if (changed) menuItemsRef.current = next;
      return changed ? next : prev;
    });

    if (!hasLiveDocsRef.current.menuCategories) {
      hasLiveDocsRef.current.menuCategories = true;
      menuCategoriesRef.current
        .filter((c) => c.id !== safeId)
        .forEach((c) => {
          setDoc(doc(db, 'menuCategories', c.id), {
            name: c.name.slice(0, 100),
            slug: c.slug.slice(0, 100),
            subtitle: (c.subtitle || '').slice(0, 300),
            section: resolveMenuCategorySection(c),
            sortOrder: Math.max(0, Math.round(Number(c.sortOrder) || 1)),
            isActive: Boolean(c.isActive),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        });
    }

    await commitFirestoreWrite(
      setDoc(doc(db, 'menuCategories', safeId), {
        name: cleanCategory.name,
        slug: cleanCategory.slug,
        subtitle: cleanCategory.subtitle,
        section: cleanCategory.section,
        sortOrder: cleanCategory.sortOrder,
        isActive: cleanCategory.isActive,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `menuCategories/${safeId}`
    );

    logAdminAction(
      'SAVE_MENU_CATEGORY',
      'menuCategories',
      safeId,
      `Saved menu category ${safeName}`
    ).catch(() => {});
  }, []);

  const deleteMenuCategory = useCallback(async (id: string) => {
    deletedIdsRef.current.menuCategories.add(id);
    const remaining = menuCategoriesRef.current.filter((c) => c.id !== id);
    menuCategoriesRef.current = remaining;
    setMenuCategories(remaining);

    if (!hasLiveDocsRef.current.menuCategories) {
      hasLiveDocsRef.current.menuCategories = true;
      remaining.forEach((c) => {
        setDoc(doc(db, 'menuCategories', c.id), {
          name: c.name.slice(0, 100),
          slug: c.slug.slice(0, 100),
          subtitle: (c.subtitle || '').slice(0, 300),
          section: resolveMenuCategorySection(c),
          sortOrder: Math.max(0, Math.round(Number(c.sortOrder) || 1)),
          isActive: Boolean(c.isActive),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      });
    }

    await commitFirestoreWrite(
      deleteDoc(doc(db, 'menuCategories', id)),
      OperationType.DELETE,
      `menuCategories/${id}`
    );

    logAdminAction(
      'DELETE_MENU_CATEGORY',
      'menuCategories',
      id,
      `Deleted menu category ${id}`
    ).catch(() => {});
  }, []);

  const saveMenuItem = useCallback(
    async (item: MenuItem) => {
      const safeId = sanitizeDocId(item.id, 'item');
      const cleanImageUrl = sanitizeCdnUrl(item.imageUrl);
      const existing = menuItemsRef.current.find((m) => m.id === safeId);
      const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

      const safeName = (item.name || 'Untitled Dish').trim().slice(0, 160) || 'Untitled Dish';
      const safeCategoryId =
        (item.categoryId || menuCategoriesRef.current[0]?.id || 'cat_coffee')
          .trim()
          .slice(0, 100) || 'cat_coffee';
      const matchedCat = menuCategoriesRef.current.find((c) => c.id === safeCategoryId);
      const safeCategoryName =
        (item.categoryName || matchedCat?.name || 'Specialty Coffee & Botanicals')
          .trim()
          .slice(0, 100) || 'Specialty Coffee & Botanicals';
      const safeDescription = (item.description ?? '').trim().slice(0, 1000);
      const validItemCurrency =
        item.priceCurrency && ['default', 'both', 'lkr', 'usd'].includes(item.priceCurrency)
          ? item.priceCurrency
          : 'default';

      const cleanItem: MenuItem = {
        id: safeId,
        name: safeName,
        categoryId: safeCategoryId,
        categoryName: safeCategoryName,
        description: safeDescription,
        priceLkr: Math.max(0, Number(item.priceLkr) || 0),
        priceUsd: Math.max(0, Number(item.priceUsd) || 0),
        priceCurrency: validItemCurrency,
        imageUrl: cleanImageUrl,
        dietaryTags: (item.dietaryTags || [])
          .filter((t) => typeof t === 'string' && t.trim())
          .map((t) => t.trim())
          .slice(0, 15),
        isFeatured: Boolean(item.isFeatured),
        isAvailable: Boolean(item.isAvailable),
      };

      deletedIdsRef.current.menuItems.delete(safeId);
      setMenuItems((prev) => {
        const exists = prev.some((m) => m.id === safeId);
        const next = exists
          ? prev.map((m) => (m.id === safeId ? cleanItem : m))
          : [cleanItem, ...prev];
        menuItemsRef.current = next;
        return next;
      });

      if (!hasLiveDocsRef.current.menuItems) {
        hasLiveDocsRef.current.menuItems = true;
        menuItemsRef.current
          .filter((m) => m.id !== safeId)
          .forEach((m) => {
            setDoc(doc(db, 'menuItems', m.id), {
              name: m.name.slice(0, 160),
              categoryId: m.categoryId.slice(0, 100),
              categoryName: m.categoryName.slice(0, 100),
              description: (m.description || '').slice(0, 1000),
              priceLkr: Math.max(0, Number(m.priceLkr) || 0),
              priceUsd: Math.max(0, Number(m.priceUsd) || 0),
              priceCurrency: m.priceCurrency || 'default',
              imageUrl: sanitizeCdnUrl(m.imageUrl),
              dietaryTags: (m.dietaryTags || []).slice(0, 15),
              isFeatured: Boolean(m.isFeatured),
              isAvailable: Boolean(m.isAvailable),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          });
      }

      await commitFirestoreWrite(
        setDoc(doc(db, 'menuItems', safeId), {
          name: cleanItem.name,
          categoryId: cleanItem.categoryId,
          categoryName: cleanItem.categoryName,
          description: cleanItem.description,
          priceLkr: cleanItem.priceLkr,
          priceUsd: cleanItem.priceUsd,
          priceCurrency: cleanItem.priceCurrency,
          imageUrl: cleanItem.imageUrl,
          dietaryTags: cleanItem.dietaryTags,
          isFeatured: cleanItem.isFeatured,
          isAvailable: cleanItem.isAvailable,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `menuItems/${safeId}`
      );

      if (prevImageUrl && prevImageUrl !== cleanImageUrl) {
        deleteMediaFromR2(prevImageUrl).catch(() => {});
      }

      logAdminAction('SAVE_MENU_ITEM', 'menuItems', safeId, `Saved menu item ${safeName}`).catch(
        () => {}
      );
    },
    [deleteMediaFromR2]
  );

  const deleteMenuItem = useCallback(
    async (id: string) => {
      const existing = menuItemsRef.current.find((m) => m.id === id);
      const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

      deletedIdsRef.current.menuItems.add(id);
      const remaining = menuItemsRef.current.filter((m) => m.id !== id);
      menuItemsRef.current = remaining;
      setMenuItems(remaining);

      if (!hasLiveDocsRef.current.menuItems) {
        hasLiveDocsRef.current.menuItems = true;
        remaining.forEach((m) => {
          setDoc(doc(db, 'menuItems', m.id), {
            name: m.name.slice(0, 160),
            categoryId: m.categoryId.slice(0, 100),
            categoryName: m.categoryName.slice(0, 100),
            description: (m.description || '').slice(0, 1000),
            priceLkr: Math.max(0, Number(m.priceLkr) || 0),
            priceUsd: Math.max(0, Number(m.priceUsd) || 0),
            priceCurrency: m.priceCurrency || 'default',
            imageUrl: sanitizeCdnUrl(m.imageUrl),
            dietaryTags: (m.dietaryTags || []).slice(0, 15),
            isFeatured: Boolean(m.isFeatured),
            isAvailable: Boolean(m.isAvailable),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        });
      }

      await commitFirestoreWrite(
        deleteDoc(doc(db, 'menuItems', id)),
        OperationType.DELETE,
        `menuItems/${id}`
      );

      if (prevImageUrl) {
        deleteMediaFromR2(prevImageUrl).catch(() => {});
      }

      logAdminAction('DELETE_MENU_ITEM', 'menuItems', id, `Deleted menu item ${id}`).catch(
        () => {}
      );
    },
    [deleteMediaFromR2]
  );

  const saveGalleryItem = useCallback(
    async (item: GalleryItem) => {
      const safeId = sanitizeDocId(item.id, 'gal');
      const existing = galleryRef.current.find((g) => g.id === safeId);
      const prevUrl = sanitizeCdnUrl(existing?.imageUrl);
      const nextUrl = sanitizeCdnUrl(item.imageUrl);

      const validCategories = [
        'Architecture',
        'Culinary',
        'Coffee & Botanicals',
        'Evening Sanctuary',
        'Sigiriya Surroundings',
      ] as const;
      const safeCategory = validCategories.includes(
        item.category as (typeof validCategories)[number]
      )
        ? item.category
        : 'Architecture';

      const validRatios = ['16:9', '4:3', '3:4', '1:1'] as const;
      const safeAspectRatio = validRatios.includes(
        item.aspectRatio as (typeof validRatios)[number]
      )
        ? item.aspectRatio
        : '4:3';

      const safeTitle =
        (item.title || 'Sanctuary Moment').trim().slice(0, 160) || 'Sanctuary Moment';
      const safeSortOrder = Number.isFinite(Number(item.sortOrder))
        ? Math.round(Number(item.sortOrder))
        : 0;

      const cleanGalleryItem: GalleryItem = {
        id: safeId,
        title: safeTitle,
        category: safeCategory,
        caption: (item.caption || '').slice(0, 600),
        imageUrl: nextUrl,
        aspectRatio: safeAspectRatio,
        isFeatured: Boolean(item.isFeatured),
        sortOrder: safeSortOrder,
      };

      deletedIdsRef.current.gallery.delete(safeId);
      setGallery((prev) => {
        const exists = prev.some((g) => g.id === safeId);
        const next = (
          exists
            ? prev.map((g) => (g.id === safeId ? cleanGalleryItem : g))
            : [cleanGalleryItem, ...prev]
        ).sort((a, b) => a.sortOrder - b.sortOrder);
        galleryRef.current = next;
        return next;
      });

      if (!hasLiveDocsRef.current.gallery) {
        hasLiveDocsRef.current.gallery = true;
        galleryRef.current
          .filter((g) => g.id !== safeId)
          .forEach((g) => {
            setDoc(doc(db, 'gallery', g.id), {
              title: g.title.slice(0, 160),
              category: g.category,
              caption: (g.caption || '').slice(0, 600),
              imageUrl: sanitizeCdnUrl(g.imageUrl),
              aspectRatio: g.aspectRatio,
              isFeatured: Boolean(g.isFeatured),
              sortOrder: Number(g.sortOrder) || 1,
              createdAt: serverTimestamp(),
            }).catch(() => {});
          });
      }

      await commitFirestoreWrite(
        setDoc(doc(db, 'gallery', safeId), {
          title: cleanGalleryItem.title,
          category: cleanGalleryItem.category,
          caption: cleanGalleryItem.caption,
          imageUrl: cleanGalleryItem.imageUrl,
          aspectRatio: cleanGalleryItem.aspectRatio,
          isFeatured: cleanGalleryItem.isFeatured,
          sortOrder: cleanGalleryItem.sortOrder,
          createdAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `gallery/${safeId}`
      );

      if (prevUrl && prevUrl !== nextUrl) {
        deleteMediaFromR2(prevUrl).catch(() => {});
      }

      logAdminAction(
        'SAVE_GALLERY_ITEM',
        'gallery',
        safeId,
        `Saved gallery photo "${safeTitle}"`
      ).catch(() => {});
    },
    [deleteMediaFromR2]
  );

  const deleteGalleryItem = useCallback(
    async (id: string) => {
      const existing = galleryRef.current.find((g) => g.id === id);
      const prevUrl = sanitizeCdnUrl(existing?.imageUrl);

      deletedIdsRef.current.gallery.add(id);
      const remaining = galleryRef.current.filter((g) => g.id !== id);
      galleryRef.current = remaining;
      setGallery(remaining);

      if (!hasLiveDocsRef.current.gallery) {
        hasLiveDocsRef.current.gallery = true;
        remaining.forEach((g) => {
          setDoc(doc(db, 'gallery', g.id), {
            title: g.title.slice(0, 160),
            category: g.category,
            caption: (g.caption || '').slice(0, 600),
            imageUrl: sanitizeCdnUrl(g.imageUrl),
            aspectRatio: g.aspectRatio,
            isFeatured: Boolean(g.isFeatured),
            sortOrder: Number(g.sortOrder) || 1,
            createdAt: serverTimestamp(),
          }).catch(() => {});
        });
      }

      await commitFirestoreWrite(
        deleteDoc(doc(db, 'gallery', id)),
        OperationType.DELETE,
        `gallery/${id}`
      );

      if (prevUrl) {
        deleteMediaFromR2(prevUrl).catch(() => {});
      }

      logAdminAction('DELETE_GALLERY_ITEM', 'gallery', id, `Deleted gallery item ${id}`).catch(
        () => {}
      );
    },
    [deleteMediaFromR2]
  );

  const saveEvent = useCallback(
    async (evt: CafeEvent) => {
      const safeId = sanitizeDocId(evt.id, 'evt');
      const cleanImageUrl = sanitizeCdnUrl(evt.imageUrl);
      const existing = eventsRef.current.find((e) => e.id === safeId);
      const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

      const safeTitle =
        (evt.title || 'Sanctuary Event').trim().slice(0, 160) || 'Sanctuary Event';
      const safeDate = (evt.date || 'Weekly').trim().slice(0, 80) || 'Weekly';
      const safeTime = (evt.time || '18:30').trim().slice(0, 80) || '18:30';
      const safeCategory =
        (evt.category || 'Evening Ritual').trim().slice(0, 100) || 'Evening Ritual';
      const safeDescription = (evt.description || '').slice(0, 1200);

      const cleanEvt: CafeEvent = {
        id: safeId,
        title: safeTitle,
        subtitle: (evt.subtitle || '').slice(0, 240),
        date: safeDate,
        time: safeTime,
        category: safeCategory,
        description: safeDescription,
        imageUrl: cleanImageUrl,
        priceInfo: (evt.priceInfo || '').slice(0, 160),
        isFeatured: Boolean(evt.isFeatured),
        isActive: Boolean(evt.isActive),
      };

      deletedIdsRef.current.events.delete(safeId);
      setEvents((prev) => {
        const exists = prev.some((e) => e.id === safeId);
        const next = exists
          ? prev.map((e) => (e.id === safeId ? cleanEvt : e))
          : [cleanEvt, ...prev];
        eventsRef.current = next;
        return next;
      });

      if (!hasLiveDocsRef.current.events) {
        hasLiveDocsRef.current.events = true;
        eventsRef.current
          .filter((e) => e.id !== safeId)
          .forEach((e) => {
            const { id, ...d } = e;
            setDoc(doc(db, 'events', id), {
              ...d,
              imageUrl: sanitizeCdnUrl(d.imageUrl),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          });
      }

      const { id: _id, ...payload } = cleanEvt;
      await commitFirestoreWrite(
        setDoc(doc(db, 'events', safeId), {
          ...payload,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `events/${safeId}`
      );

      if (prevImageUrl && prevImageUrl !== cleanImageUrl) {
        deleteMediaFromR2(prevImageUrl).catch(() => {});
      }

      logAdminAction('SAVE_EVENT', 'events', safeId, `Saved event ${safeTitle}`).catch(() => {});
    },
    [deleteMediaFromR2]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const existing = eventsRef.current.find((e) => e.id === id);
      const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

      deletedIdsRef.current.events.add(id);
      const remaining = eventsRef.current.filter((e) => e.id !== id);
      eventsRef.current = remaining;
      setEvents(remaining);

      if (!hasLiveDocsRef.current.events) {
        hasLiveDocsRef.current.events = true;
        remaining.forEach((e) => {
          const { id: eid, ...d } = e;
          setDoc(doc(db, 'events', eid), {
            ...d,
            imageUrl: sanitizeCdnUrl(d.imageUrl),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        });
      }

      await commitFirestoreWrite(
        deleteDoc(doc(db, 'events', id)),
        OperationType.DELETE,
        `events/${id}`
      );

      if (prevImageUrl) {
        deleteMediaFromR2(prevImageUrl).catch(() => {});
      }

      logAdminAction('DELETE_EVENT', 'events', id, `Deleted event ${id}`).catch(() => {});
    },
    [deleteMediaFromR2]
  );

  const saveSiteContent = useCallback(
    async (section: SiteContentSection) => {
      const rawKey = (section.sectionKey || section.id || 'section')
        .trim()
        .replace(/^sec_/, '');
      const sectionKey = sanitizeDocId(rawKey, 'section').slice(0, 80);
      const canonicalId = sectionKey;
      const cleanImageUrl = sanitizeCdnUrl(section.imageUrl);
      const existing = siteContentRef.current.find(
        (s) => s.sectionKey === sectionKey || s.id === canonicalId
      );
      const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

      const cleanSection: SiteContentSection = {
        id: canonicalId,
        sectionKey,
        kicker: (section.kicker ?? '').slice(0, 200),
        heading: (section.heading ?? '').slice(0, 300),
        subheading: (section.subheading ?? '').slice(0, 800),
        body: (section.body ?? '').slice(0, 3000),
        ctaLabel: (section.ctaLabel ?? '').slice(0, 160),
        ctaLink: (section.ctaLink ?? '').slice(0, 300),
        imageUrl: cleanImageUrl,
      };

      setSiteContent((prev) => {
        const exists = prev.some((s) => s.sectionKey === sectionKey || s.id === canonicalId);
        const next = exists
          ? prev.map((s) =>
              s.sectionKey === sectionKey || s.id === canonicalId ? cleanSection : s
            )
          : [...prev, cleanSection];
        siteContentRef.current = next;
        return next;
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteContent', canonicalId), {
          sectionKey: cleanSection.sectionKey,
          kicker: cleanSection.kicker,
          heading: cleanSection.heading,
          subheading: cleanSection.subheading,
          body: cleanSection.body,
          ctaLabel: cleanSection.ctaLabel,
          ctaLink: cleanSection.ctaLink,
          imageUrl: cleanSection.imageUrl,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteContent/${canonicalId}`
      );

      // Clean up any legacy duplicate doc (e.g. sec_${sectionKey})
      const duplicateIds = new Set<string>();
      if (section.id && section.id !== canonicalId) duplicateIds.add(section.id);
      duplicateIds.add(`sec_${sectionKey}`);
      duplicateIds.delete(canonicalId);
      for (const dupId of duplicateIds) {
        deleteDoc(doc(db, 'siteContent', dupId)).catch(() => {});
      }

      if (prevImageUrl && prevImageUrl !== cleanImageUrl) {
        deleteMediaFromR2(prevImageUrl).catch(() => {});
      }

      logAdminAction(
        'SAVE_SITE_CONTENT',
        'siteContent',
        canonicalId,
        `Updated website section ${sectionKey}`
      ).catch(() => {});
    },
    [deleteMediaFromR2]
  );

  const saveSettings = useCallback(
    async (newSettings: CafeSettings) => {
      const nextHeroImages = Array.isArray(newSettings.heroImages)
        ? newSettings.heroImages
            .map((img) => sanitizeCdnUrl(img))
            .filter(Boolean)
            .slice(0, 12)
        : [];
      const speedSec = Math.min(
        60,
        Math.max(1, Math.round(Number(newSettings.heroSlideshowSpeedSeconds) || 5))
      );
      const nextFloorPlanUrl = sanitizeCdnUrl(newSettings.floorPlanImageUrl);

      const prevHeroImages = (settingsRef.current.heroImages || [])
        .map((u) => sanitizeCdnUrl(u))
        .filter(Boolean);
      const prevFloorPlanUrl = sanitizeCdnUrl(settingsRef.current.floorPlanImageUrl);
      const removedUrls = [
        ...prevHeroImages.filter((oldUrl) => !nextHeroImages.includes(oldUrl)),
        ...(prevFloorPlanUrl && prevFloorPlanUrl !== nextFloorPlanUrl ? [prevFloorPlanUrl] : []),
      ];

      const validMenuCurrency =
        newSettings.menuCurrencyDisplay &&
        ['both', 'lkr', 'usd'].includes(newSettings.menuCurrencyDisplay)
          ? newSettings.menuCurrencyDisplay
          : 'both';
      const safeCafeName =
        (newSettings.cafeName || 'OneLove Café').trim().slice(0, 120) || 'OneLove Café';

      const cleanSettings: CafeSettings = {
        id: 'main',
        cafeName: safeCafeName,
        tagline: (newSettings.tagline || '').slice(0, 300),
        address: (newSettings.address || '').slice(0, 400),
        phone: (newSettings.phone || '').slice(0, 60),
        whatsapp: (newSettings.whatsapp || '').slice(0, 60),
        email: (newSettings.email || '').slice(0, 160),
        instagram: (newSettings.instagram || '').slice(0, 160),
        coordinates: (newSettings.coordinates || '').slice(0, 100),
        gracePeriodMinutes: Math.min(
          60,
          Math.max(5, Math.round(Number(newSettings.gracePeriodMinutes) || 15))
        ),
        holdDurationMinutes: Math.min(
          30,
          Math.max(3, Math.round(Number(newSettings.holdDurationMinutes) || 10))
        ),
        maxPartySize: Math.min(
          30,
          Math.max(2, Math.round(Number(newSettings.maxPartySize) || 12))
        ),
        sameDayCutoffHour: Math.min(
          23,
          Math.max(0, Math.round(Number(newSettings.sameDayCutoffHour) || 21))
        ),
        bookingPolicy: (newSettings.bookingPolicy || '').slice(0, 2000),
        heroImages: nextHeroImages,
        heroSlideshowSpeedSeconds: speedSec,
        floorPlanImageUrl: nextFloorPlanUrl,
        googleMapsEmbedUrl: (newSettings.googleMapsEmbedUrl || '').slice(0, 3000),
        mapTitle: (newSettings.mapTitle || 'Our Sanctuary Location').slice(0, 250),
        mapSubtitle: (newSettings.mapSubtitle || '').slice(0, 500),
        menuCurrencyDisplay: validMenuCurrency,
      };

      settingsRef.current = cleanSettings;
      setSettings(cleanSettings);

      const { id: _id, ...payload } = cleanSettings;
      await commitFirestoreWrite(
        setDoc(doc(db, 'settings', 'main'), {
          ...payload,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        'settings/main'
      );

      if (removedUrls.length > 0) {
        deleteMediaFromR2(removedUrls).catch(() => {});
      }

      logAdminAction(
        'SAVE_SETTINGS',
        'settings',
        'main',
        `Updated global café settings & synced ${nextHeroImages.length} Hero image(s)`
      ).catch(() => {});
    },
    [deleteMediaFromR2]
  );

  const updateInquiryStatus = useCallback(
    async (inquiry: InquiryRecord, status: InquiryRecord['status']) => {
      setInquiries((prev) => prev.map((i) => (i.id === inquiry.id ? { ...i, status } : i)));

      await commitFirestoreWrite(
        setDoc(doc(db, 'inquiries', inquiry.id), {
          name: inquiry.name.slice(0, 100),
          email: inquiry.email.slice(0, 120),
          phone: (inquiry.phone || '').slice(0, 40),
          subject: inquiry.subject.slice(0, 120),
          message: inquiry.message.slice(0, 1000),
          status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        OperationType.UPDATE,
        `inquiries/${inquiry.id}`
      );

      logAdminAction(
        'UPDATE_INQUIRY',
        'inquiries',
        inquiry.id,
        `Marked inquiry from ${inquiry.name} as ${status}`
      ).catch(() => {});
    },
    []
  );

  // Direct Admin -> Cloudflare R2 Image Upload (returns public R2 CDN URL to save in Firestore)
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

      const cleanPrevUrl = sanitizeCdnUrl(previousUrl);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: base64DataUrl,
          filename: file.name,
          folder,
          previousUrl: cleanPrevUrl || undefined,
        }),
      });

      if (!res.ok) {
        let serverError = '';
        try {
          const errPayload = await res.json();
          if (errPayload && typeof errPayload.error === 'string') {
            serverError = errPayload.error;
          }
        } catch {
          // Non-JSON response body
        }
        throw new Error(
          serverError
            ? `Cloudflare R2 upload failed (${res.status}): ${serverError}`
            : `Cloudflare R2 upload failed (${res.status})`
        );
      }

      const data = await res.json();
      const uploadedUrl = sanitizeCdnUrl(data?.url);
      if (!data?.ok || !uploadedUrl) {
        throw new Error('Cloudflare R2 upload did not return a valid R2 CDN URL');
      }

      logAdminAction(
        'R2_OBJECT_UPLOAD',
        folder,
        file.name.slice(0, 60),
        `Uploaded image to Cloudflare R2 bucket (${uploadedUrl})`
      ).catch(() => {});
      return uploadedUrl;
    },
    []
  );

  // Story collage image upload: R2 -> Firestore siteContent
  const updateCollageImageFromDevice = useCallback(
    async (slotIndex: number, file: File) => {
      const sectionKey = `story_collage_${slotIndex}`;
      const existingSec =
        siteContentRef.current.find((s) => s.sectionKey === sectionKey) ||
        CLEAN_DEFAULT_SITE_CONTENT.find((s) => s.sectionKey === sectionKey);
      const prevUrl = sanitizeCdnUrl(existingSec?.imageUrl);
      const uploadedR2Url = await uploadMediaFile(file, 'collage', prevUrl);

      await saveSiteContent({
        id: sectionKey,
        sectionKey,
        kicker: existingSec?.kicker || `Story Collage Frame 0${slotIndex}`,
        heading: existingSec?.heading || `Story Collage Photo ${slotIndex}`,
        subheading: existingSec?.subheading || 'Laterite Earth, Teak & Monsoon Light',
        body: existingSec?.body || '',
        ctaLabel: existingSec?.ctaLabel || '',
        ctaLink: existingSec?.ctaLink || '/story',
        imageUrl: uploadedR2Url,
      });
    },
    [uploadMediaFile, saveSiteContent]
  );

  const resetCollageImage = useCallback(
    async (slotIndex: number) => {
      const sectionKey = `story_collage_${slotIndex}`;
      const existingSec =
        siteContentRef.current.find((s) => s.sectionKey === sectionKey) ||
        CLEAN_DEFAULT_SITE_CONTENT.find((s) => s.sectionKey === sectionKey);

      await saveSiteContent({
        id: sectionKey,
        sectionKey,
        kicker: existingSec?.kicker || `Story Collage Frame 0${slotIndex}`,
        heading: existingSec?.heading || `Story Collage Photo ${slotIndex}`,
        subheading: existingSec?.subheading || 'Laterite Earth, Teak & Monsoon Light',
        body: existingSec?.body || '',
        ctaLabel: existingSec?.ctaLabel || '',
        ctaLink: existingSec?.ctaLink || '/story',
        imageUrl: '',
      });
    },
    [saveSiteContent]
  );

  const saveSeoGlobal = useCallback(
    async (config: GlobalSeoConfig) => {
      const cleanOgUrl = sanitizeCdnUrl(config.defaultOgImageUrl);
      const cleanLogoUrl = sanitizeCdnUrl(config.brandLogoUrl);
      const cleanFaviconUrl = sanitizeCdnUrl(config.faviconSourceUrl);

      const prevOgUrl = sanitizeCdnUrl(seoGlobalRef.current.defaultOgImageUrl);
      const prevLogoUrl = sanitizeCdnUrl(seoGlobalRef.current.brandLogoUrl);
      const prevFaviconUrl = sanitizeCdnUrl(seoGlobalRef.current.faviconSourceUrl);

      const urlsToDelete: string[] = [];
      if (prevOgUrl && prevOgUrl !== cleanOgUrl) urlsToDelete.push(prevOgUrl);
      if (prevLogoUrl && prevLogoUrl !== cleanLogoUrl) urlsToDelete.push(prevLogoUrl);
      if (prevFaviconUrl && prevFaviconUrl !== cleanFaviconUrl) urlsToDelete.push(prevFaviconUrl);

      const cleanSeo: GlobalSeoConfig = {
        ...DEFAULT_GLOBAL_SEO,
        ...config,
        id: 'main',
        defaultOgImageUrl: cleanOgUrl,
        brandLogoUrl: cleanLogoUrl,
        faviconSourceUrl: cleanFaviconUrl,
        favicon48Url: cleanFaviconUrl,
        favicon96Url: cleanFaviconUrl,
        favicon192Url: cleanFaviconUrl,
        appleTouchIconUrl: cleanFaviconUrl,
      };
      seoGlobalRef.current = cleanSeo;
      setSeoGlobal(cleanSeo);

      await commitFirestoreWrite(
        setDoc(doc(db, 'seoConfig', 'main'), {
          siteName: (config.siteName || 'OneLove Café').slice(0, 100),
          alternateNames: (config.alternateNames || []).slice(0, 15),
          defaultTitle: (config.defaultTitle || DEFAULT_GLOBAL_SEO.defaultTitle).slice(0, 160),
          titleTemplate: (config.titleTemplate || '%s | OneLove Café Sigiriya').slice(0, 120),
          defaultDescription: (
            config.defaultDescription || DEFAULT_GLOBAL_SEO.defaultDescription
          ).slice(0, 500),
          canonicalDomain: (config.canonicalDomain || 'https://onelovecafesigiriya.com')
            .replace(/\/+$/, '')
            .slice(0, 200),
          language: (config.language || 'en').slice(0, 16),
          googleVerificationTag: (config.googleVerificationTag || '').slice(0, 200),
          defaultOgImageUrl: cleanOgUrl,
          brandLogoUrl: cleanLogoUrl,
          faviconSourceUrl: cleanFaviconUrl,
          favicon48Url: cleanFaviconUrl,
          favicon96Url: cleanFaviconUrl,
          favicon192Url: cleanFaviconUrl,
          appleTouchIconUrl: cleanFaviconUrl,
          allowIndexing: Boolean(config.allowIndexing),
          noindexPreviewDomains: Boolean(config.noindexPreviewDomains),
          businessType: config.businessType === 'Restaurant' ? 'Restaurant' : 'CafeOrCoffeeShop',
          streetAddress: (config.streetAddress || '').slice(0, 200),
          addressLocality: (config.addressLocality || 'Sigiriya').slice(0, 80),
          addressRegion: (config.addressRegion || 'Central Province').slice(0, 80),
          postalCode: (config.postalCode || '21120').slice(0, 20),
          addressCountry: (config.addressCountry || 'LK').slice(0, 10),
          latitude: Number(config.latitude) || 7.9541,
          longitude: Number(config.longitude) || 80.7547,
          telephone: (config.telephone || '').slice(0, 40),
          whatsapp: (config.whatsapp || '').slice(0, 40),
          email: (config.email || '').slice(0, 120),
          priceRange: (config.priceRange || '$$').slice(0, 16),
          servesCuisine: (config.servesCuisine || []).slice(0, 20),
          openingHoursSpec: (config.openingHoursSpec || 'Mo-Su 07:30-22:30').slice(0, 120),
          socialLinks: (config.socialLinks || []).slice(0, 20),
          customKeywords: (config.customKeywords || []).slice(0, 200),
          imageAltOverrides: config.imageAltOverrides || {},
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        'seoConfig/main'
      );

      if (urlsToDelete.length > 0) {
        deleteMediaFromR2(urlsToDelete).catch(() => {});
      }

      logAdminAction(
        'SAVE_SEO_GLOBAL',
        'seoConfig',
        'main',
        `Updated global SEO configuration (${config.siteName})`
      ).catch(() => {});
    },
    [deleteMediaFromR2]
  );

  const saveSeoPage = useCallback(
    async (page: PageSeoConfig) => {
      const cleanOgUrl = sanitizeCdnUrl(page.ogImageUrl);
      const prevOgUrl = sanitizeCdnUrl(seoPagesRef.current[page.id]?.ogImageUrl);

      const cleanPage: PageSeoConfig = {
        ...page,
        ogImageUrl: cleanOgUrl,
      };
      setSeoPages((prev) => {
        const next = { ...prev, [page.id]: cleanPage };
        seoPagesRef.current = next;
        return next;
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'seoPages', page.id), {
          routePath: (page.routePath || '/').slice(0, 120),
          pageLabel: (page.pageLabel || page.id).slice(0, 120),
          title: (page.title || DEFAULT_GLOBAL_SEO.defaultTitle).slice(0, 160),
          metaDescription: (page.metaDescription || '').slice(0, 500),
          canonicalPath: (page.canonicalPath || page.routePath || '/').slice(0, 120),
          primaryKeyword: (page.primaryKeyword || '').slice(0, 120),
          supportingKeywords: (page.supportingKeywords || []).slice(0, 40),
          ogTitle: (page.ogTitle || page.title || '').slice(0, 160),
          ogDescription: (page.ogDescription || page.metaDescription || '').slice(0, 500),
          ogImageUrl: cleanOgUrl,
          indexable: Boolean(page.indexable),
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `seoPages/${page.id}`
      );

      if (prevOgUrl && prevOgUrl !== cleanOgUrl) {
        deleteMediaFromR2(prevOgUrl).catch(() => {});
      }

      logAdminAction(
        'SAVE_SEO_PAGE',
        'seoPages',
        page.id,
        `Updated page SEO metadata for ${page.routePath}`
      ).catch(() => {});
    },
    [deleteMediaFromR2]
  );

  const resetSeoToDefaults = useCallback(async () => {
    await saveSeoGlobal(DEFAULT_GLOBAL_SEO);
    for (const key of Object.keys(DEFAULT_PAGE_SEO) as SeoPageKey[]) {
      await saveSeoPage(DEFAULT_PAGE_SEO[key]);
    }
  }, [saveSeoGlobal, saveSeoPage]);

  return (
    <CafeContext.Provider
      value={{
        user,
        isAdmin,
        authReady,
        sessionId,
        settings,
        zones,
        tables,
        openingHours,
        blockedDates,
        menuCategories,
        menuItems,
        gallery,
        events,
        siteContent,
        availability,
        seoGlobal,
        seoPages,
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
