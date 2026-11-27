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

  // Live Firestore state (single source of truth; no localStorage shadow caches)
  const [settings, setSettings] = useState<CafeSettings>(DEFAULT_SETTINGS);
  const [zones, setZones] = useState<SeatingZone[]>(DEFAULT_ZONES);
  const [tables, setTables] = useState<CafeTable[]>(DEFAULT_TABLES);
  const [openingHours, setOpeningHours] = useState<OpeningHoursConfig[]>(DEFAULT_OPENING_HOURS);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRecord[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(DEFAULT_MENU_CATEGORIES);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [events, setEvents] = useState<CafeEvent[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContentSection[]>(DEFAULT_SITE_CONTENT);
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
  const reservationsRef = useRef<ReservationRecord[]>([]);
  const settingsRef = useRef<CafeSettings>(settings);
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
            setSettings({
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
            });
          } else if (!snap.metadata.fromCache) {
            setSettings(DEFAULT_SETTINGS);
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
          } else if (!snap.metadata.fromCache) {
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
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<CafeTable, 'id'>) }))
              .sort((a, b) => a.number - b.number);
            setTables(list);
          } else if (!snap.metadata.fromCache) {
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
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<OpeningHoursConfig, 'id'>),
            }));
            setOpeningHours(list);
          } else if (!snap.metadata.fromCache) {
            setOpeningHours(DEFAULT_OPENING_HOURS);
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
              .map((d) => {
                const raw = d.data() as Omit<MenuCategory, 'id'>;
                return {
                  id: d.id,
                  ...raw,
                  section: resolveMenuCategorySection({ id: d.id, ...raw }),
                };
              })
              .sort((a, b) => a.sortOrder - b.sortOrder);
            setMenuCategories(list);
          } else if (!snap.metadata.fromCache) {
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
          const list = snap.docs.map((d) => {
            const raw = d.data() as Omit<MenuItem, 'id'>;
            return {
              id: d.id,
              ...raw,
              imageUrl: sanitizeCdnUrl(raw.imageUrl),
            };
          });
          setMenuItems(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'menuItems')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'gallery'),
        (snap) => {
          const list = snap.docs
            .map((d) => {
              const raw = d.data() as Omit<GalleryItem, 'id'>;
              return {
                id: d.id,
                ...raw,
                imageUrl: sanitizeCdnUrl(raw.imageUrl),
              };
            })
            .sort((a, b) => a.sortOrder - b.sortOrder);
          setGallery(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'gallery')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'events'),
        (snap) => {
          const list = snap.docs.map((d) => {
            const raw = d.data() as Omit<CafeEvent, 'id'>;
            return {
              id: d.id,
              ...raw,
              imageUrl: sanitizeCdnUrl(raw.imageUrl),
            };
          });
          setEvents(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'events')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'siteContent'),
        (snap) => {
          const byKey = new Map<string, SiteContentSection>();
          const timestampByKey = new Map<string, { ms: number; isCanonical: boolean }>();

          // Base structure keys exist for sections not yet edited; Firestore docs always override
          DEFAULT_SITE_CONTENT.forEach((def) => {
            byKey.set(def.sectionKey, { ...def, imageUrl: sanitizeCdnUrl(def.imageUrl) });
            timestampByKey.set(def.sectionKey, { ms: -1, isCanonical: false });
          });

          snap.docs
            .filter((d) => !d.id.startsWith('sec_hero_slide_'))
            .forEach((d) => {
              const raw = d.data() as Omit<SiteContentSection, 'id'> & {
                updatedAt?: { toMillis?: () => number; seconds?: number };
              };
              const key = raw.sectionKey || d.id.replace(/^sec_/, '');
              if (key.startsWith('hero_slide_')) return;

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
                  id: d.id,
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

          setSiteContent(Array.from(byKey.values()));
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
            setSeoGlobal({
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
            });
          } else if (!snap.metadata.fromCache) {
            setSeoGlobal(DEFAULT_GLOBAL_SEO);
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
            setSeoPages(nextPages);
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

  // Seed initial sanctuary data directly to Firestore if empty
  const seedDatabaseIfNeeded = useCallback(async () => {
    if (!isAdmin) return;
    try {
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
          imageUrl: sanitizeCdnUrl(data.imageUrl),
          updatedAt: serverTimestamp(),
        });
      }

      for (const gItem of DEFAULT_GALLERY) {
        await setDoc(doc(db, 'gallery', gItem.id), {
          title: gItem.title.slice(0, 100),
          category: gItem.category,
          caption: gItem.caption.slice(0, 300),
          imageUrl: sanitizeCdnUrl(gItem.imageUrl),
          aspectRatio: gItem.aspectRatio,
          isFeatured: Boolean(gItem.isFeatured),
          sortOrder: Number(gItem.sortOrder) || 1,
          createdAt: serverTimestamp(),
        });
      }

      for (const evt of DEFAULT_EVENTS) {
        const { id, ...data } = evt;
        await setDoc(doc(db, 'events', id), {
          ...data,
          imageUrl: sanitizeCdnUrl(data.imageUrl),
          updatedAt: serverTimestamp(),
        });
      }

      for (const sc of DEFAULT_SITE_CONTENT) {
        const { id, ...data } = sc;
        await setDoc(doc(db, 'siteContent', id), {
          ...data,
          imageUrl: sanitizeCdnUrl(data.imageUrl),
          updatedAt: serverTimestamp(),
        });
      }

      await logAdminAction(
        'SEED_SANCTUARY_DATA',
        'settings',
        'main',
        'Initialized OneLove Café Sigiriya data in Firestore'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seedDatabase');
    }
  }, [isAdmin]);

  // 3. Protected Admin Real-Time Listeners & First-Time Auto-Bootstrap Seeding
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setInquiries([]);
      setAdmins([]);
      setAuditLogs([]);
      return;
    }

    if (!autoSeededRef.current) {
      autoSeededRef.current = true;
      getDoc(doc(db, 'settings', 'main'))
        .then(async (snap) => {
          if (!snap.exists()) {
            await seedDatabaseIfNeeded().catch(() => {});
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

      try {
        await Promise.all([reservationWritePromise, slotWritePromise]);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `reservations/${reservationId}`);
      }

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
    },
    []
  );

  // Admin Operations (Direct Admin Panel -> Firestore & R2 -> Live Site)
  const updateReservationStatus = useCallback(
    async (reservation: ReservationRecord, newStatus: ReservationRecord['status']) => {
      const normalizedTime = reservation.time.replace(/[^a-zA-Z0-9]/g, '-');
      const slotId = `${reservation.date}_${normalizedTime}_${reservation.tableId}`;
      try {
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
      const { id, ...data } = table;
      const safeLabel = (data.label || 'Table').trim().slice(0, 30) || 'Table';
      const safeNumber = Math.max(1, Math.round(Number(data.number) || 1));
      const safeCapacity = Math.max(1, Math.round(Number(data.capacity) || 2));
      const safeMinGuests = Math.max(
        1,
        Math.min(safeCapacity, Math.round(Number(data.minGuests) || 1))
      );

      await setDoc(doc(db, 'tables', id), {
        label: safeLabel,
        number: safeNumber,
        capacity: safeCapacity,
        minGuests: safeMinGuests,
        zoneId: (data.zoneId || 'zone_garden').trim().slice(0, 40) || 'zone_garden',
        zoneName: (data.zoneName || 'Garden Sanctuary').trim().slice(0, 60) || 'Garden Sanctuary',
        shape: data.shape,
        x: Math.max(0, Math.min(100, Number(data.x) || 50)),
        y: Math.max(0, Math.min(100, Number(data.y) || 50)),
        isVip: Boolean(data.isVip),
        isActive: Boolean(data.isActive),
        notes: (data.notes || '').slice(0, 200),
        updatedAt: serverTimestamp(),
      });

      await logAdminAction('SAVE_TABLE', 'tables', id, `Updated floor plan table ${safeLabel}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tables/${table.id}`);
    }
  }, []);

  const deleteTable = useCallback(async (tableId: string) => {
    try {
      await deleteDoc(doc(db, 'tables', tableId));
      await logAdminAction('DELETE_TABLE', 'tables', tableId, `Deleted table ${tableId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tables/${tableId}`);
    }
  }, []);

  const saveZone = useCallback(async (zone: SeatingZone) => {
    try {
      const { id, ...data } = zone;
      const safeName = (data.name || 'Sanctuary Zone').trim().slice(0, 60) || 'Sanctuary Zone';
      const safeSortOrder = Math.max(0, Math.round(Number(data.sortOrder) || 1));

      await setDoc(doc(db, 'seatingZones', id), {
        name: safeName,
        subtitle: (data.subtitle || '').slice(0, 120),
        description: (data.description || '').slice(0, 300),
        atmosphere: (data.atmosphere || '').slice(0, 100),
        isActive: Boolean(data.isActive),
        sortOrder: safeSortOrder,
        updatedAt: serverTimestamp(),
      });

      await logAdminAction('SAVE_ZONE', 'seatingZones', id, `Updated seating zone ${safeName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seatingZones/${zone.id}`);
    }
  }, []);

  const deleteZone = useCallback(async (zoneId: string) => {
    try {
      await deleteDoc(doc(db, 'seatingZones', zoneId));
      await logAdminAction('DELETE_ZONE', 'seatingZones', zoneId, `Deleted seating zone ${zoneId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `seatingZones/${zoneId}`);
    }
  }, []);

  const saveOpeningHours = useCallback(async (config: OpeningHoursConfig) => {
    try {
      const { id, ...data } = config;
      const safeSlotDuration = Math.min(
        240,
        Math.max(15, Math.round(Number(data.slotDurationMinutes) || 90))
      );
      const safeGracePeriod = Math.min(
        60,
        Math.max(5, Math.round(Number(data.gracePeriodMinutes) || 15))
      );

      await setDoc(doc(db, 'openingHours', id), {
        dayOfWeek: (data.dayOfWeek || 'Monday').trim().slice(0, 20) || 'Monday',
        isOpen: Boolean(data.isOpen),
        openTime: (data.openTime || '07:30').slice(0, 10),
        closeTime: (data.closeTime || '22:30').slice(0, 10),
        slotDurationMinutes: safeSlotDuration,
        gracePeriodMinutes: safeGracePeriod,
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
      const { id, ...data } = blocked;
      const safeReason = (data.reason || 'Private Event').trim().slice(0, 160) || 'Private Event';
      await setDoc(doc(db, 'blockedDates', id), {
        date: data.date.slice(0, 10),
        reason: safeReason,
        isFullDay: Boolean(data.isFullDay),
        blockedSlots: (data.blockedSlots || []).slice(0, 30),
        createdAt: serverTimestamp(),
      });
      await logAdminAction(
        'ADD_BLOCKED_DATE',
        'blockedDates',
        id,
        `Blocked date ${data.date}: ${safeReason}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `blockedDates/${blocked.id}`);
    }
  }, []);

  const deleteBlockedDate = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'blockedDates', id));
      await logAdminAction('REMOVE_BLOCKED_DATE', 'blockedDates', id, `Removed blocked date ${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `blockedDates/${id}`);
    }
  }, []);

  const saveMenuCategory = useCallback(async (cat: MenuCategory) => {
    try {
      const { id, ...data } = cat;
      const safeName = (data.name || 'Untitled Category').trim().slice(0, 60) || 'Untitled Category';
      const safeSlug = (
        (data.slug || '').trim() ||
        safeName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') ||
        'category'
      ).slice(0, 60);
      const safeSortOrder = Math.max(0, Math.round(Number(data.sortOrder) || 1));
      const resolvedSection = resolveMenuCategorySection({ id, ...data, name: safeName });

      await setDoc(doc(db, 'menuCategories', id), {
        name: safeName,
        slug: safeSlug,
        subtitle: (data.subtitle || '').slice(0, 140),
        section: resolvedSection,
        sortOrder: safeSortOrder,
        isActive: Boolean(data.isActive),
        updatedAt: serverTimestamp(),
      });

      await logAdminAction(
        'SAVE_MENU_CATEGORY',
        'menuCategories',
        id,
        `Saved menu category ${safeName}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `menuCategories/${cat.id}`);
    }
  }, []);

  const deleteMenuCategory = useCallback(async (id: string) => {
    try {
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
        const cleanImageUrl = sanitizeCdnUrl(data.imageUrl);
        const existing = menuItemsRef.current.find((m) => m.id === id);
        const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

        const safeName = (data.name || 'Untitled Dish').trim().slice(0, 100) || 'Untitled Dish';
        const safeCategoryId = (data.categoryId || 'cat_coffee').trim().slice(0, 60) || 'cat_coffee';
        const safeCategoryName =
          (data.categoryName || 'Specialty Coffee & Botanicals').trim().slice(0, 60) ||
          'Specialty Coffee & Botanicals';
        const safeDescription =
          (data.description || 'Crafted fresh in Sigiriya.').trim().slice(0, 400) ||
          'Crafted fresh in Sigiriya.';
        const validItemCurrency =
          data.priceCurrency && ['default', 'both', 'lkr', 'usd'].includes(data.priceCurrency)
            ? data.priceCurrency
            : 'default';

        await setDoc(doc(db, 'menuItems', id), {
          name: safeName,
          categoryId: safeCategoryId,
          categoryName: safeCategoryName,
          description: safeDescription,
          priceLkr: Math.max(0, Number(data.priceLkr) || 0),
          priceUsd: Math.max(0, Number(data.priceUsd) || 0),
          priceCurrency: validItemCurrency,
          imageUrl: cleanImageUrl,
          dietaryTags: (data.dietaryTags || [])
            .filter((t) => typeof t === 'string' && t.trim())
            .slice(0, 10),
          isFeatured: Boolean(data.isFeatured),
          isAvailable: Boolean(data.isAvailable),
          updatedAt: serverTimestamp(),
        });

        if (prevImageUrl && prevImageUrl !== cleanImageUrl) {
          deleteMediaFromR2(prevImageUrl).catch(() => {});
        }

        await logAdminAction('SAVE_MENU_ITEM', 'menuItems', id, `Saved menu item ${safeName}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `menuItems/${item.id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const deleteMenuItem = useCallback(
    async (id: string) => {
      try {
        const existing = menuItemsRef.current.find((m) => m.id === id);
        const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

        await deleteDoc(doc(db, 'menuItems', id));

        if (prevImageUrl) {
          deleteMediaFromR2(prevImageUrl).catch(() => {});
        }

        await logAdminAction('DELETE_MENU_ITEM', 'menuItems', id, `Deleted menu item ${id}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `menuItems/${id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const saveGalleryItem = useCallback(
    async (item: GalleryItem) => {
      try {
        const existing = galleryRef.current.find((g) => g.id === item.id);
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
          (item.title || 'Sanctuary Moment').trim().slice(0, 100) || 'Sanctuary Moment';
        const safeSortOrder = Number.isFinite(Number(item.sortOrder))
          ? Math.round(Number(item.sortOrder))
          : 1;

        const existingSnap = await getDoc(doc(db, 'gallery', item.id));
        const createdAtVal =
          existingSnap.exists() && existingSnap.data()?.createdAt
            ? existingSnap.data().createdAt
            : serverTimestamp();

        await setDoc(doc(db, 'gallery', item.id), {
          title: safeTitle,
          category: safeCategory,
          caption: (item.caption || '').slice(0, 300),
          imageUrl: nextUrl,
          aspectRatio: safeAspectRatio,
          isFeatured: Boolean(item.isFeatured),
          sortOrder: safeSortOrder,
          createdAt: createdAtVal,
        });

        if (prevUrl && prevUrl !== nextUrl) {
          deleteMediaFromR2(prevUrl).catch(() => {});
        }

        await logAdminAction(
          'SAVE_GALLERY_ITEM',
          'gallery',
          item.id,
          `Saved gallery photo "${safeTitle}"`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `gallery/${item.id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const deleteGalleryItem = useCallback(
    async (id: string) => {
      try {
        const existing = galleryRef.current.find((g) => g.id === id);
        const prevUrl = sanitizeCdnUrl(existing?.imageUrl);

        await deleteDoc(doc(db, 'gallery', id));

        if (prevUrl) {
          deleteMediaFromR2(prevUrl).catch(() => {});
        }

        await logAdminAction('DELETE_GALLERY_ITEM', 'gallery', id, `Deleted gallery item ${id}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `gallery/${id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const saveEvent = useCallback(
    async (evt: CafeEvent) => {
      try {
        const { id, ...data } = evt;
        const cleanImageUrl = sanitizeCdnUrl(data.imageUrl);
        const existing = eventsRef.current.find((e) => e.id === id);
        const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

        const safeTitle = (data.title || 'Sanctuary Event').trim().slice(0, 120) || 'Sanctuary Event';
        const safeDate = (data.date || 'Weekly').trim().slice(0, 60) || 'Weekly';
        const safeTime = (data.time || '18:30').trim().slice(0, 40) || '18:30';
        const safeCategory = (data.category || 'Evening Ritual').trim().slice(0, 60) || 'Evening Ritual';
        const safeDescription = (data.description || '').slice(0, 600);

        await setDoc(doc(db, 'events', id), {
          title: safeTitle,
          subtitle: (data.subtitle || '').slice(0, 140),
          date: safeDate,
          time: safeTime,
          category: safeCategory,
          description: safeDescription,
          imageUrl: cleanImageUrl,
          priceInfo: (data.priceInfo || '').slice(0, 80),
          isFeatured: Boolean(data.isFeatured),
          isActive: Boolean(data.isActive),
          updatedAt: serverTimestamp(),
        });

        if (prevImageUrl && prevImageUrl !== cleanImageUrl) {
          deleteMediaFromR2(prevImageUrl).catch(() => {});
        }

        await logAdminAction('SAVE_EVENT', 'events', id, `Saved event ${safeTitle}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `events/${evt.id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        const existing = eventsRef.current.find((e) => e.id === id);
        const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

        await deleteDoc(doc(db, 'events', id));

        if (prevImageUrl) {
          deleteMediaFromR2(prevImageUrl).catch(() => {});
        }

        await logAdminAction('DELETE_EVENT', 'events', id, `Deleted event ${id}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const saveSiteContent = useCallback(
    async (section: SiteContentSection) => {
      try {
        const { id, ...data } = section;
        const sectionKey = (data.sectionKey || id || 'section').trim().slice(0, 60) || 'section';
        const canonicalId = sectionKey;
        const cleanImageUrl = sanitizeCdnUrl(data.imageUrl);
        const existing = siteContentRef.current.find((s) => s.sectionKey === sectionKey);
        const prevImageUrl = sanitizeCdnUrl(existing?.imageUrl);

        const safeHeading =
          (data.heading || 'OneLove Café Sigiriya').trim().slice(0, 160) ||
          'OneLove Café Sigiriya';

        await setDoc(doc(db, 'siteContent', canonicalId), {
          sectionKey,
          kicker: (data.kicker || '').slice(0, 100),
          heading: safeHeading,
          subheading: (data.subheading || '').slice(0, 400),
          body: (data.body || '').slice(0, 1200),
          ctaLabel: (data.ctaLabel || '').slice(0, 60),
          ctaLink: (data.ctaLink || '').slice(0, 120),
          imageUrl: cleanImageUrl,
          updatedAt: serverTimestamp(),
        });

        // Clean up any legacy duplicate doc (e.g. sec_${sectionKey})
        const duplicateIds = new Set<string>();
        if (id && id !== canonicalId) duplicateIds.add(id);
        duplicateIds.add(`sec_${sectionKey}`);
        duplicateIds.delete(canonicalId);
        for (const dupId of duplicateIds) {
          deleteDoc(doc(db, 'siteContent', dupId)).catch(() => {});
        }

        if (prevImageUrl && prevImageUrl !== cleanImageUrl) {
          deleteMediaFromR2(prevImageUrl).catch(() => {});
        }

        await logAdminAction(
          'SAVE_SITE_CONTENT',
          'siteContent',
          canonicalId,
          `Updated website section ${sectionKey}`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `siteContent/${section.id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const saveSettings = useCallback(
    async (newSettings: CafeSettings) => {
      try {
        const { id, ...data } = newSettings;
        const nextHeroImages = Array.isArray(data.heroImages)
          ? data.heroImages
              .map((img) => sanitizeCdnUrl(img))
              .filter(Boolean)
              .slice(0, 12)
          : [];
        const speedSec = Math.min(
          60,
          Math.max(1, Math.round(Number(data.heroSlideshowSpeedSeconds) || 5))
        );
        const nextFloorPlanUrl = sanitizeCdnUrl(data.floorPlanImageUrl);

        const prevHeroImages = (settingsRef.current.heroImages || [])
          .map((u) => sanitizeCdnUrl(u))
          .filter(Boolean);
        const prevFloorPlanUrl = sanitizeCdnUrl(settingsRef.current.floorPlanImageUrl);
        const removedUrls = [
          ...prevHeroImages.filter((oldUrl) => !nextHeroImages.includes(oldUrl)),
          ...(prevFloorPlanUrl && prevFloorPlanUrl !== nextFloorPlanUrl ? [prevFloorPlanUrl] : []),
        ];

        const validMenuCurrency =
          data.menuCurrencyDisplay && ['both', 'lkr', 'usd'].includes(data.menuCurrencyDisplay)
            ? data.menuCurrencyDisplay
            : 'both';
        const safeCafeName = (data.cafeName || 'OneLove Café').trim().slice(0, 80) || 'OneLove Café';

        await setDoc(doc(db, 'settings', id || 'main'), {
          cafeName: safeCafeName,
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
          heroImages: nextHeroImages,
          heroSlideshowSpeedSeconds: speedSec,
          floorPlanImageUrl: nextFloorPlanUrl,
          googleMapsEmbedUrl: (data.googleMapsEmbedUrl || '').slice(0, 2000),
          mapTitle: (data.mapTitle || 'Our Sanctuary Location').slice(0, 120),
          mapSubtitle: (data.mapSubtitle || '').slice(0, 250),
          menuCurrencyDisplay: validMenuCurrency,
          updatedAt: serverTimestamp(),
        });

        if (removedUrls.length > 0) {
          deleteMediaFromR2(removedUrls).catch(() => {});
        }

        await logAdminAction(
          'SAVE_SETTINGS',
          'settings',
          id || 'main',
          `Updated global café settings & synced ${nextHeroImages.length} Hero image(s)`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/${newSettings.id}`);
      }
    },
    [deleteMediaFromR2]
  );

  const updateInquiryStatus = useCallback(
    async (inquiry: InquiryRecord, status: InquiryRecord['status']) => {
      try {
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

      await logAdminAction(
        'R2_OBJECT_UPLOAD',
        folder,
        file.name.slice(0, 60),
        `Uploaded image to Cloudflare R2 bucket (${uploadedUrl})`
      );
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
        DEFAULT_SITE_CONTENT.find((s) => s.sectionKey === sectionKey);
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
        DEFAULT_SITE_CONTENT.find((s) => s.sectionKey === sectionKey);

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
      try {
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

        await setDoc(doc(db, 'seoConfig', config.id || 'main'), {
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
        });

        if (urlsToDelete.length > 0) {
          deleteMediaFromR2(urlsToDelete).catch(() => {});
        }

        await logAdminAction(
          'SAVE_SEO_GLOBAL',
          'seoConfig',
          'main',
          `Updated global SEO configuration (${config.siteName})`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'seoConfig/main');
      }
    },
    [deleteMediaFromR2]
  );

  const saveSeoPage = useCallback(
    async (page: PageSeoConfig) => {
      try {
        const cleanOgUrl = sanitizeCdnUrl(page.ogImageUrl);
        const prevOgUrl = sanitizeCdnUrl(seoPagesRef.current[page.id]?.ogImageUrl);

        await setDoc(doc(db, 'seoPages', page.id), {
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
        });

        if (prevOgUrl && prevOgUrl !== cleanOgUrl) {
          deleteMediaFromR2(prevOgUrl).catch(() => {});
        }

        await logAdminAction(
          'SAVE_SEO_PAGE',
          'seoPages',
          page.id,
          `Updated page SEO metadata for ${page.routePath}`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `seoPages/${page.id}`);
      }
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
