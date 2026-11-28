import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
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
  BOOTSTRAP_ADMIN_EMAILS,
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
  SiteImageRecord,
  AvailabilitySlotRecord,
  ReservationRecord,
  InquiryRecord,
  AdminRecord,
  AdminRole,
  AuditLogRecord,
} from '../types/cafe';
import {
  DEFAULT_SETTINGS,
  DEFAULT_ZONES,
  DEFAULT_TABLES,
  DEFAULT_OPENING_HOURS,
  DEFAULT_SITE_CONTENT,
  DEFAULT_SITE_IMAGES,
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
  siteImages: SiteImageRecord[];
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
  updateSiteImageSlot: (slotId: string, file: File) => Promise<string>;
  clearSiteImageSlot: (slotId: string) => Promise<void>;
  addAdminEmail: (email: string, name?: string, role?: AdminRole) => Promise<void>;
  removeAdminEmail: (email: string) => Promise<void>;
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

function normalizeAdminEmailList(rawList?: unknown): string[] {
  const merged = new Set<string>(
    BOOTSTRAP_ADMIN_EMAILS.map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  if (Array.isArray(rawList)) {
    rawList.forEach((item) => {
      if (typeof item === 'string' && item.includes('@')) {
        merged.add(item.trim().toLowerCase());
      }
    });
  }
  return Array.from(merged);
}

function generateReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'OL-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function commitFirestoreWrite(
  writePromise: Promise<unknown>,
  opType: OperationType,
  path: string
): Promise<void> {
  try {
    await writePromise;
  } catch (err) {
    handleFirestoreError(err, opType, path);
  }
}

export const CafeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [sessionId] = useState<string>(() => getOrCreateSessionId());

  // Live Firestore state — zero hardcoded images or menu items/categories/gallery/events
  const [settings, setSettings] = useState<CafeSettings>(DEFAULT_SETTINGS);
  const [zones, setZones] = useState<SeatingZone[]>(DEFAULT_ZONES);
  const [tables, setTables] = useState<CafeTable[]>(DEFAULT_TABLES);
  const [openingHours, setOpeningHours] = useState<OpeningHoursConfig[]>(DEFAULT_OPENING_HOURS);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRecord[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [events, setEvents] = useState<CafeEvent[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContentSection[]>(DEFAULT_SITE_CONTENT);
  const [siteImages, setSiteImages] = useState<SiteImageRecord[]>(DEFAULT_SITE_IMAGES);
  const [availability, setAvailability] = useState<AvailabilitySlotRecord[]>([]);
  const [seoGlobal, setSeoGlobal] = useState<GlobalSeoConfig>(DEFAULT_GLOBAL_SEO);
  const [seoPages, setSeoPages] = useState<Record<SeoPageKey, PageSeoConfig>>(DEFAULT_PAGE_SEO);
  const [storageStatus, setStorageStatus] = useState<{
    configured: boolean;
    provider: string;
    bucket?: string | null;
    publicUrl?: string | null;
  } | null>(null);

  // Admin-only collections
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  const bootstrappedRef = useRef<boolean>(false);

  // Raw Firestore snapshot refs for deterministic order-independent reconciliation across all admin browsers
  const rawSettingsRef = useRef<Partial<CafeSettings>>({});
  const rawSiteContentRef = useRef<Map<string, SiteContentSection>>(new Map());
  const rawSiteImagesRef = useRef<Map<string, SiteImageRecord>>(new Map());

  const reconcileSharedSiteState = useCallback(() => {
    const rawSettings = rawSettingsRef.current;
    const rawContentMap = rawSiteContentRef.current;
    const rawImagesMap = rawSiteImagesRef.current;

    // 1. Build merged siteImages map
    const mergedImages = new Map<string, SiteImageRecord>();
    DEFAULT_SITE_IMAGES.forEach((slot) => {
      mergedImages.set(slot.id, { ...slot });
    });
    rawImagesMap.forEach((raw, docId) => {
      const cleanUrl = sanitizeCdnUrl(raw.imageUrl);
      const cleanUrls = Array.isArray(raw.imageUrls)
        ? raw.imageUrls.map((u) => sanitizeCdnUrl(u)).filter(Boolean)
        : cleanUrl
        ? [cleanUrl]
        : [];
      mergedImages.set(docId, {
        ...(mergedImages.get(docId) || {
          id: docId,
          sectionKey: raw.sectionKey || docId,
          label: raw.label || docId,
          imageUrl: '',
        }),
        ...raw,
        id: docId,
        sectionKey: raw.sectionKey || docId,
        imageUrl: cleanUrl,
        imageUrls: cleanUrls,
      });
    });

    // 2. Build merged siteContent map
    const mergedContent = new Map<string, SiteContentSection>();
    DEFAULT_SITE_CONTENT.forEach((sec) => {
      mergedContent.set(sec.sectionKey, { ...sec });
    });
    rawContentMap.forEach((raw, key) => {
      const existing = mergedContent.get(key);
      mergedContent.set(key, {
        ...(existing || {
          id: raw.id || key,
          sectionKey: key,
          kicker: '',
          heading: '',
          subheading: '',
          body: '',
          ctaLabel: '',
          ctaLink: '',
          imageUrl: '',
        }),
        ...raw,
        id: raw.id || key,
        sectionKey: key,
        imageUrl: sanitizeCdnUrl(raw.imageUrl),
      });
    });

    // 3. Cross-sync every section image slot between siteContent and siteImages
    mergedContent.forEach((sec, key) => {
      const imgDoc = mergedImages.get(key) || mergedImages.get(sec.id);
      const bestUrl = sanitizeCdnUrl(imgDoc?.imageUrl) || sanitizeCdnUrl(sec.imageUrl) || '';
      mergedContent.set(key, {
        ...sec,
        imageUrl: bestUrl,
      });
      if (imgDoc) {
        mergedImages.set(imgDoc.id, {
          ...imgDoc,
          imageUrl: bestUrl,
        });
      }
    });

    // 4. Cross-sync Hero Slideshow & Floor Plan Drone Shot between settings and siteImages
    const settingsHeroes = Array.isArray(rawSettings.heroImages)
      ? rawSettings.heroImages.map((u) => sanitizeCdnUrl(u)).filter(Boolean)
      : [];
    const heroImgDoc = mergedImages.get('hero');
    const siteImageHeroes =
      heroImgDoc && Array.isArray(heroImgDoc.imageUrls) && heroImgDoc.imageUrls.length > 0
        ? heroImgDoc.imageUrls.map((u) => sanitizeCdnUrl(u)).filter(Boolean)
        : heroImgDoc?.imageUrl
        ? [sanitizeCdnUrl(heroImgDoc.imageUrl)].filter(Boolean)
        : [];
    const bestHeroes = settingsHeroes.length > 0 ? settingsHeroes : siteImageHeroes;

    const settingsFloorPlan = sanitizeCdnUrl(rawSettings.floorPlanImageUrl);
    const floorImgDoc = mergedImages.get('floorplan');
    const bestFloorPlan = settingsFloorPlan || sanitizeCdnUrl(floorImgDoc?.imageUrl) || '';

    if (heroImgDoc) {
      mergedImages.set('hero', {
        ...heroImgDoc,
        imageUrl: bestHeroes[0] || '',
        imageUrls: bestHeroes,
      });
    }
    if (floorImgDoc) {
      mergedImages.set('floorplan', {
        ...floorImgDoc,
        imageUrl: bestFloorPlan,
      });
    }

    const nextSettings: CafeSettings = {
      ...DEFAULT_SETTINGS,
      ...rawSettings,
      id: 'main',
      heroImages: bestHeroes,
      floorPlanImageUrl: bestFloorPlan,
      adminEmails: normalizeAdminEmailList(rawSettings.adminEmails),
    };

    setSettings(nextSettings);
    setSiteContent(Array.from(mergedContent.values()));
    setSiteImages(Array.from(mergedImages.values()));
  }, []);

  const checkStorageStatus = useCallback(async () => {
    const endpoints = ['/api/storage/status', 'https://onelovecafesigiriya.com/api/storage/status'];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data.configured) {
            setStorageStatus({
              configured: true,
              provider: data.provider || 'cloudflare-r2',
              bucket: data.bucket || 'onelove-assets',
              publicUrl: data.publicUrl || 'https://cdn.onelovecafesigiriya.com',
            });
            return;
          }
        }
      } catch {
        // try next endpoint
      }
    }
    setStorageStatus({ configured: false, provider: 'unreachable' });
  }, []);

  useEffect(() => {
    checkStorageStatus();
  }, [checkStorageStatus]);

  // Direct Admin -> Cloudflare R2 Media Delete
  const deleteMediaFromR2 = useCallback(async (urlOrUrls: string | string[]) => {
    const rawList = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    const urls = rawList
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter((u) => /^https?:\/\//i.test(u));
    if (urls.length === 0) return;

    const endpoints = ['/api/storage/delete', 'https://onelovecafesigiriya.com/api/storage/delete'];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls }),
        });
        if (res.ok) return;
      } catch {
        // try fallback endpoint
      }
    }
  }, []);

  // Periodic sweep: automatically delete passed reservations from Firestore
  useEffect(() => {
    if (!isAdmin || reservations.length === 0) return;

    const purgeExpiredReservations = async () => {
      const nowMs = Date.now();
      for (const r of reservations) {
        if (isReservationDateTimePassed(r.date, r.time, nowMs)) {
          const slotId = `${r.date}_${r.time.replace(':', '')}_${r.tableId}`;
          try {
            await deleteDoc(doc(db, 'reservations', r.id));
            await deleteDoc(doc(db, 'availability', slotId)).catch(() => {});
          } catch (err) {
            console.warn('Auto-purge of expired reservation skipped:', err);
          }
        }
      }
    };

    purgeExpiredReservations();
    const timer = setInterval(purgeExpiredReservations, 60_000);
    return () => clearInterval(timer);
  }, [isAdmin, reservations]);

  // 1. Auth & Multi-Admin Verification Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const primaryEmail = getPrimaryUserEmail(currentUser);
      const isBootstrapped = isAuthorizedAdminUser(currentUser);
      const listedEmails = normalizeAdminEmailList(rawSettingsRef.current.adminEmails);
      const isListedInSettings = Boolean(primaryEmail && listedEmails.includes(primaryEmail));
      let verifiedAdmin = isBootstrapped || isListedInSettings;

      if (verifiedAdmin) {
        setIsAdmin(true);
        setAuthReady(true);
      }

      try {
        const adminRef = doc(db, 'admins', currentUser.uid);
        const snap = await getDoc(adminRef);
        if (snap.exists()) {
          verifiedAdmin = true;
        } else {
          // Also check if primaryEmail was added to settings/main.adminEmails in Firestore
          if (!verifiedAdmin && primaryEmail) {
            const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
            if (settingsSnap.exists()) {
              const dbAdminEmails = normalizeAdminEmailList(settingsSnap.data()?.adminEmails);
              if (dbAdminEmails.includes(primaryEmail)) {
                verifiedAdmin = true;
              }
            }
          }
          if (verifiedAdmin) {
            await setDoc(adminRef, {
              id: currentUser.uid,
              email: primaryEmail || 'merlinfiverr0@gmail.com',
              name: currentUser.displayName || primaryEmail || 'Sanctuary Administrator',
              role: 'super_admin',
              createdAt: serverTimestamp(),
            });
          }
        }
      } catch {
        // Keep verifiedAdmin from token / settings check
      }

      setIsAdmin(verifiedAdmin);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Re-evaluate admin status whenever settings.adminEmails updates in real time
  useEffect(() => {
    if (!user) return;
    const primaryEmail = getPrimaryUserEmail(user);
    const allowedEmails = normalizeAdminEmailList(settings.adminEmails);
    if (isAuthorizedAdminUser(user) || (primaryEmail && allowedEmails.includes(primaryEmail))) {
      if (!isAdmin) {
        setIsAdmin(true);
      }
    }
  }, [user, settings.adminEmails, isAdmin]);

  // 2. Direct Real-Time Firestore Listeners (Single Source of Truth -> Live Site & All Admins)
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // Settings
    unsubs.push(
      onSnapshot(
        collection(db, 'settings'),
        (snap) => {
          const mainDoc = snap.docs.find((d) => d.id === 'main');
          if (mainDoc) {
            rawSettingsRef.current = mainDoc.data() as Partial<CafeSettings>;
            reconcileSharedSiteState();
          }
        },
        (err) => console.warn('Firestore settings listener notice:', err.message)
      )
    );

    // Seating Zones
    unsubs.push(
      onSnapshot(
        collection(db, 'seatingZones'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as SeatingZone), id: d.id }))
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            setZones(list);
          }
        },
        (err) => console.warn('Firestore seatingZones listener notice:', err.message)
      )
    );

    // Tables
    unsubs.push(
      onSnapshot(
        collection(db, 'tables'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as CafeTable), id: d.id }))
              .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
            setTables(list);
          }
        },
        (err) => console.warn('Firestore tables listener notice:', err.message)
      )
    );

    // Opening Hours
    unsubs.push(
      onSnapshot(
        collection(db, 'openingHours'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ ...(d.data() as OpeningHoursConfig), id: d.id }));
            setOpeningHours(list);
          }
        },
        (err) => console.warn('Firestore openingHours listener notice:', err.message)
      )
    );

    // Blocked Dates
    unsubs.push(
      onSnapshot(
        collection(db, 'blockedDates'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as BlockedDateRecord), id: d.id }));
          setBlockedDates(list);
        },
        (err) => console.warn('Firestore blockedDates listener notice:', err.message)
      )
    );

    // Menu Categories — Strictly from Firestore
    unsubs.push(
      onSnapshot(
        collection(db, 'menuCategories'),
        (snap) => {
          const list = snap.docs
            .map((d) => {
              const raw = d.data() as MenuCategory;
              return {
                ...raw,
                id: d.id,
                section: resolveMenuCategorySection({
                  id: d.id,
                  name: raw.name,
                  section: raw.section,
                }),
              };
            })
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          setMenuCategories(list);
        },
        (err) => console.warn('Firestore menuCategories listener notice:', err.message)
      )
    );

    // Menu Items — Strictly from Firestore
    unsubs.push(
      onSnapshot(
        collection(db, 'menuItems'),
        (snap) => {
          const list = snap.docs.map((d) => {
            const raw = d.data() as MenuItem;
            return {
              ...raw,
              id: d.id,
              imageUrl: sanitizeCdnUrl(raw.imageUrl),
            };
          });
          setMenuItems(list);
        },
        (err) => console.warn('Firestore menuItems listener notice:', err.message)
      )
    );

    // Gallery — Strictly from Firestore
    unsubs.push(
      onSnapshot(
        collection(db, 'gallery'),
        (snap) => {
          const list = snap.docs
            .map((d) => {
              const raw = d.data() as GalleryItem;
              return {
                ...raw,
                id: d.id,
                imageUrl: sanitizeCdnUrl(raw.imageUrl),
              };
            })
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          setGallery(list);
        },
        (err) => console.warn('Firestore gallery listener notice:', err.message)
      )
    );

    // Events — Strictly from Firestore
    unsubs.push(
      onSnapshot(
        collection(db, 'events'),
        (snap) => {
          const list = snap.docs.map((d) => {
            const raw = d.data() as CafeEvent;
            return {
              ...raw,
              id: d.id,
              imageUrl: sanitizeCdnUrl(raw.imageUrl),
            };
          });
          setEvents(list);
        },
        (err) => console.warn('Firestore events listener notice:', err.message)
      )
    );

    // Site Content
    unsubs.push(
      onSnapshot(
        collection(db, 'siteContent'),
        (snap) => {
          const nextMap = new Map<string, SiteContentSection>();
          snap.docs.forEach((d) => {
            const raw = d.data() as SiteContentSection;
            const key = raw.sectionKey || d.id;
            nextMap.set(key, {
              ...raw,
              id: d.id,
              sectionKey: key,
            });
          });
          rawSiteContentRef.current = nextMap;
          reconcileSharedSiteState();
        },
        (err) => console.warn('Firestore siteContent listener notice:', err.message)
      )
    );

    // Site Images — Dedicated `siteImages` Firestore collection for every section image on the site
    unsubs.push(
      onSnapshot(
        collection(db, 'siteImages'),
        (snap) => {
          const nextMap = new Map<string, SiteImageRecord>();
          snap.docs.forEach((d) => {
            const raw = d.data() as SiteImageRecord;
            nextMap.set(d.id, {
              ...raw,
              id: d.id,
              sectionKey: raw.sectionKey || d.id,
            });
          });
          rawSiteImagesRef.current = nextMap;
          reconcileSharedSiteState();
        },
        (err) => console.warn('Firestore siteImages listener notice:', err.message)
      )
    );

    // Availability Slots
    unsubs.push(
      onSnapshot(
        collection(db, 'availability'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as AvailabilitySlotRecord),
            id: d.id,
          }));
          setAvailability(list);
        },
        (err) => console.warn('Firestore availability listener notice:', err.message)
      )
    );

    // Global SEO
    unsubs.push(
      onSnapshot(
        collection(db, 'seoGlobal'),
        (snap) => {
          const mainDoc = snap.docs.find((d) => d.id === 'main');
          if (mainDoc) {
            const raw = mainDoc.data() as Partial<GlobalSeoConfig>;
            setSeoGlobal({
              ...DEFAULT_GLOBAL_SEO,
              ...raw,
              id: 'main',
            });
          }
        },
        () => {}
      )
    );

    // Page SEO
    unsubs.push(
      onSnapshot(
        collection(db, 'seoPages'),
        (snap) => {
          if (!snap.empty) {
            const merged: Record<SeoPageKey, PageSeoConfig> = { ...DEFAULT_PAGE_SEO };
            snap.docs.forEach((d) => {
              const key = d.id as SeoPageKey;
              if (merged[key]) {
                const raw = d.data() as Partial<PageSeoConfig>;
                merged[key] = {
                  ...merged[key],
                  ...raw,
                  id: key,
                  canonicalPath: DEFAULT_PAGE_SEO[key].canonicalPath,
                  routePath: DEFAULT_PAGE_SEO[key].routePath,
                };
              }
            });
            setSeoPages(merged);
          }
        },
        () => {}
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [reconcileSharedSiteState]);

  // Non-destructive sync: ensures all structural docs & siteImages slots exist in Firestore while preserving all uploaded R2 images & adminEmails
  const seedDatabaseIfNeeded = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const [settingsSnap, contentSnap, siteImagesSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'main')),
        getDocs(collection(db, 'siteContent')),
        getDocs(collection(db, 'siteImages')),
      ]);

      const existingSettings = settingsSnap.exists()
        ? (settingsSnap.data() as Partial<CafeSettings>)
        : {};
      const existingContentById = new Map<string, SiteContentSection>();
      contentSnap.docs.forEach((d) => {
        const raw = d.data() as SiteContentSection;
        existingContentById.set(d.id, raw);
        if (raw.sectionKey) existingContentById.set(raw.sectionKey, raw);
      });
      const existingImagesById = new Map<string, SiteImageRecord>();
      siteImagesSnap.docs.forEach((d) => {
        const raw = d.data() as SiteImageRecord;
        existingImagesById.set(d.id, raw);
      });

      const preservedHeroes =
        Array.isArray(existingSettings.heroImages) && existingSettings.heroImages.length > 0
          ? existingSettings.heroImages.map((u) => sanitizeCdnUrl(u)).filter(Boolean)
          : Array.isArray(existingImagesById.get('hero')?.imageUrls)
          ? (existingImagesById.get('hero')?.imageUrls || []).map((u) => sanitizeCdnUrl(u)).filter(Boolean)
          : [];
      const preservedFloorPlan =
        sanitizeCdnUrl(existingSettings.floorPlanImageUrl) ||
        sanitizeCdnUrl(existingImagesById.get('floorplan')?.imageUrl) ||
        '';

      await setDoc(doc(db, 'settings', 'main'), {
        ...DEFAULT_SETTINGS,
        ...existingSettings,
        id: 'main',
        heroImages: preservedHeroes,
        floorPlanImageUrl: preservedFloorPlan,
        adminEmails: normalizeAdminEmailList(existingSettings.adminEmails),
        updatedAt: serverTimestamp(),
      });

      for (const z of DEFAULT_ZONES) {
        const zSnap = await getDoc(doc(db, 'seatingZones', z.id));
        if (!zSnap.exists()) {
          await setDoc(doc(db, 'seatingZones', z.id), {
            ...z,
            updatedAt: serverTimestamp(),
          });
        }
      }

      for (const t of DEFAULT_TABLES) {
        const tSnap = await getDoc(doc(db, 'tables', t.id));
        if (!tSnap.exists()) {
          await setDoc(doc(db, 'tables', t.id), {
            ...t,
            updatedAt: serverTimestamp(),
          });
        }
      }

      for (const oh of DEFAULT_OPENING_HOURS) {
        const ohSnap = await getDoc(doc(db, 'openingHours', oh.id));
        if (!ohSnap.exists()) {
          await setDoc(doc(db, 'openingHours', oh.id), {
            ...oh,
            updatedAt: serverTimestamp(),
          });
        }
      }

      for (const sc of DEFAULT_SITE_CONTENT) {
        const existingSec = existingContentById.get(sc.id) || existingContentById.get(sc.sectionKey);
        const existingImg = existingImagesById.get(sc.sectionKey) || existingImagesById.get(sc.id);
        const preservedUrl =
          sanitizeCdnUrl(existingSec?.imageUrl) || sanitizeCdnUrl(existingImg?.imageUrl) || '';
        await setDoc(doc(db, 'siteContent', sc.id), {
          ...sc,
          ...(existingSec || {}),
          id: sc.id,
          sectionKey: sc.sectionKey,
          imageUrl: preservedUrl,
          updatedAt: serverTimestamp(),
        });
      }

      for (const si of DEFAULT_SITE_IMAGES) {
        const existingImg = existingImagesById.get(si.id);
        const existingSec = existingContentById.get(si.id) || existingContentById.get(si.sectionKey);
        const preservedUrl =
          si.id === 'hero'
            ? preservedHeroes[0] || ''
            : si.id === 'floorplan'
            ? preservedFloorPlan
            : sanitizeCdnUrl(existingImg?.imageUrl) || sanitizeCdnUrl(existingSec?.imageUrl) || '';

        const payload =
          si.id === 'hero'
            ? {
                ...si,
                ...(existingImg || {}),
                id: 'hero',
                sectionKey: 'hero',
                imageUrl: preservedHeroes[0] || '',
                imageUrls: preservedHeroes,
                updatedAt: serverTimestamp(),
              }
            : {
                ...si,
                ...(existingImg || {}),
                id: si.id,
                sectionKey: si.sectionKey,
                imageUrl: preservedUrl,
                updatedAt: serverTimestamp(),
              };
        await setDoc(doc(db, 'siteImages', si.id), payload);
      }

      await logAdminAction(
        'SYNC_DATABASE',
        'system',
        'all',
        'Synchronized shared Firestore collections across all administrator consoles'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seedDatabase');
    }
  }, []);

  // Auto-bootstrap and heal missing structural docs in Firestore when any Admin logs in
  useEffect(() => {
    if (!authReady || !isAdmin || !auth.currentUser || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        const [settingsSnap, zonesSnap, tablesSnap, hoursSnap, contentSnap, siteImagesSnap] =
          await Promise.all([
            getDoc(doc(db, 'settings', 'main')),
            getDocs(query(collection(db, 'seatingZones'), limit(1))),
            getDocs(query(collection(db, 'tables'), limit(1))),
            getDocs(query(collection(db, 'openingHours'), limit(1))),
            getDocs(collection(db, 'siteContent')),
            getDocs(collection(db, 'siteImages')),
          ]);

        const existingContentMap = new Map<string, SiteContentSection>();
        contentSnap.docs.forEach((d) => {
          const raw = d.data() as SiteContentSection;
          existingContentMap.set(d.id, raw);
          if (raw.sectionKey) existingContentMap.set(raw.sectionKey, raw);
        });

        const existingImagesMap = new Map<string, SiteImageRecord>();
        siteImagesSnap.docs.forEach((d) => {
          existingImagesMap.set(d.id, d.data() as SiteImageRecord);
        });

        if (!settingsSnap.exists()) {
          await setDoc(doc(db, 'settings', 'main'), {
            ...DEFAULT_SETTINGS,
            heroImages: [],
            floorPlanImageUrl: '',
            adminEmails: normalizeAdminEmailList(DEFAULT_SETTINGS.adminEmails),
            updatedAt: serverTimestamp(),
          });
        } else {
          const raw = settingsSnap.data() as Partial<CafeSettings>;
          const normalizedAdmins = normalizeAdminEmailList(raw.adminEmails);
          if (
            !Array.isArray(raw.adminEmails) ||
            raw.adminEmails.length < normalizedAdmins.length
          ) {
            await setDoc(
              doc(db, 'settings', 'main'),
              {
                ...DEFAULT_SETTINGS,
                ...raw,
                id: 'main',
                adminEmails: normalizedAdmins,
                updatedAt: serverTimestamp(),
              }
            );
          }
        }

        if (zonesSnap.empty) {
          for (const z of DEFAULT_ZONES) {
            await setDoc(doc(db, 'seatingZones', z.id), { ...z, updatedAt: serverTimestamp() });
          }
        }
        if (tablesSnap.empty) {
          for (const t of DEFAULT_TABLES) {
            await setDoc(doc(db, 'tables', t.id), { ...t, updatedAt: serverTimestamp() });
          }
        }
        if (hoursSnap.empty) {
          for (const oh of DEFAULT_OPENING_HOURS) {
            await setDoc(doc(db, 'openingHours', oh.id), { ...oh, updatedAt: serverTimestamp() });
          }
        }

        // Ensure every DEFAULT_SITE_CONTENT slot exists and cross-heals any imageUrl from siteImages
        for (const sc of DEFAULT_SITE_CONTENT) {
          const existingSec = existingContentMap.get(sc.id) || existingContentMap.get(sc.sectionKey);
          const existingImg = existingImagesMap.get(sc.sectionKey) || existingImagesMap.get(sc.id);
          const bestUrl =
            sanitizeCdnUrl(existingSec?.imageUrl) || sanitizeCdnUrl(existingImg?.imageUrl) || '';
          if (!existingSec || (bestUrl && !sanitizeCdnUrl(existingSec.imageUrl))) {
            await setDoc(doc(db, 'siteContent', sc.id), {
              ...sc,
              ...(existingSec || {}),
              id: sc.id,
              sectionKey: sc.sectionKey,
              imageUrl: bestUrl,
              updatedAt: serverTimestamp(),
            });
          }
        }

        // Ensure every DEFAULT_SITE_IMAGES slot exists and cross-heals any imageUrl from siteContent or settings
        const currentHeroImages = settingsSnap.exists()
          ? ((settingsSnap.data()?.heroImages as string[]) || [])
              .map((u) => sanitizeCdnUrl(u))
              .filter(Boolean)
          : [];
        const currentFloorPlan = settingsSnap.exists()
          ? sanitizeCdnUrl(settingsSnap.data()?.floorPlanImageUrl as string)
          : '';

        for (const si of DEFAULT_SITE_IMAGES) {
          const existingImg = existingImagesMap.get(si.id);
          const existingSec = existingContentMap.get(si.id) || existingContentMap.get(si.sectionKey);
          const bestUrl =
            si.id === 'hero'
              ? currentHeroImages[0] || sanitizeCdnUrl(existingImg?.imageUrl) || ''
              : si.id === 'floorplan'
              ? currentFloorPlan || sanitizeCdnUrl(existingImg?.imageUrl) || ''
              : sanitizeCdnUrl(existingImg?.imageUrl) || sanitizeCdnUrl(existingSec?.imageUrl) || '';

          if (!existingImg || (bestUrl && !sanitizeCdnUrl(existingImg.imageUrl))) {
            const payload =
              si.id === 'hero'
                ? {
                    ...si,
                    ...(existingImg || {}),
                    id: 'hero',
                    sectionKey: 'hero',
                    imageUrl: bestUrl,
                    imageUrls: currentHeroImages.length > 0 ? currentHeroImages : bestUrl ? [bestUrl] : [],
                    updatedAt: serverTimestamp(),
                  }
                : {
                    ...si,
                    ...(existingImg || {}),
                    id: si.id,
                    sectionKey: si.sectionKey,
                    imageUrl: bestUrl,
                    updatedAt: serverTimestamp(),
                  };
            await setDoc(doc(db, 'siteImages', si.id), payload);
          }
        }
      } catch (err) {
        console.warn('Initial Firestore collection check notice:', err);
      }
    })();
  }, [authReady, isAdmin]);

  // 3. Admin-Only Real-Time Firestore Listeners
  useEffect(() => {
    if (!authReady || !isAdmin || !user) {
      setReservations([]);
      setInquiries([]);
      setAdmins([]);
      setAuditLogs([]);
      return;
    }

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'reservations'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ ...(d.data() as ReservationRecord), id: d.id }))
            .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
          setReservations(list);
        },
        (err) => console.warn('Firestore reservations listener notice:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'inquiries'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as InquiryRecord), id: d.id }));
          setInquiries(list);
        },
        (err) => console.warn('Firestore inquiries listener notice:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'admins'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as AdminRecord), id: d.id }));
          setAdmins(list);
        },
        (err) => console.warn('Firestore admins listener notice:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'auditLogs'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as AuditLogRecord), id: d.id }));
          setAuditLogs(list);
        },
        (err) => console.warn('Firestore auditLogs listener notice:', err.message)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, isAdmin, user]);

  // Auth Actions
  const signInAdmin = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutAdmin = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  // Direct Firestore Table Hold
  const holdTableSlot = useCallback(
    async (date: string, time: string, tableId: string): Promise<HoldResult> => {
      const cleanDate = date.trim().slice(0, 10);
      const cleanTime = time.trim().slice(0, 12);
      const cleanTableId = sanitizeDocId(tableId, 'T1').slice(0, 80);
      const slotId = `${cleanDate}_${cleanTime.replace(':', '')}_${cleanTableId}`;
      const holdDurationMs = (settings.holdDurationMinutes || 10) * 60 * 1000;
      const expiresAtMs = Date.now() + holdDurationMs;

      const slotRef = doc(db, 'availability', slotId);
      try {
        const snap = await getDoc(slotRef);
        if (snap.exists()) {
          const current = snap.data() as AvailabilitySlotRecord;
          const now = Date.now();
          if (current.status === 'reserved' || current.status === 'occupied') {
            throw new Error(
              'This table was just reserved by another guest. Please select a different table.'
            );
          }
          if (
            current.status === 'held' &&
            current.sessionId !== sessionId &&
            current.holdExpiresAtMs > now
          ) {
            throw new Error(
              'Another guest is currently holding this table. Please choose another table or wait a moment.'
            );
          }
        }

        const payload = {
          id: slotId,
          date: cleanDate,
          time: cleanTime,
          tableId: cleanTableId,
          status: 'held' as const,
          holdExpiresAtMs: expiresAtMs,
          sessionId: sessionId.slice(0, 100),
          referenceCode: 'HOLD',
          updatedAt: serverTimestamp(),
        };

        await commitFirestoreWrite(setDoc(slotRef, payload), OperationType.WRITE, `availability/${slotId}`);
        return { slotId, expiresAtMs };
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('reserved') || error.message.includes('holding'))
        ) {
          throw error;
        }
        handleFirestoreError(error, OperationType.WRITE, `availability/${slotId}`);
        throw error;
      }
    },
    [sessionId, settings.holdDurationMinutes]
  );

  // Direct Firestore Reservation Confirmation
  const confirmReservation = useCallback(
    async (input: ConfirmReservationInput): Promise<ReservationRecord> => {
      const cleanDate = input.date.trim().slice(0, 10);
      const cleanTime = input.time.trim().slice(0, 12);
      const cleanTableId = sanitizeDocId(input.tableId, 'T1').slice(0, 80);
      const slotId = `${cleanDate}_${cleanTime.replace(':', '')}_${cleanTableId}`;
      const resId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const referenceCode = generateReferenceCode();

      const slotRef = doc(db, 'availability', slotId);
      const resRef = doc(db, 'reservations', resId);

      const reservationData: ReservationRecord = {
        id: resId,
        referenceCode,
        date: cleanDate,
        time: cleanTime,
        servicePeriod: (input.servicePeriod || 'All-Day Sanctuary').trim().slice(0, 60),
        partySize: Math.min(30, Math.max(1, Math.round(Number(input.partySize) || 2))),
        tableId: cleanTableId,
        tableLabel: (input.tableLabel || cleanTableId).trim().slice(0, 80),
        zoneId: (input.zoneId || 'zone_verandah').trim().slice(0, 80),
        zoneName: (input.zoneName || 'Sanctuary').trim().slice(0, 120),
        guestName: (input.guestName || 'Guest').trim().slice(0, 120),
        guestEmail: (input.guestEmail || 'guest@example.com').trim().slice(0, 140),
        whatsapp: (input.whatsapp || '+940000000').trim().slice(0, 60),
        country: (input.country || 'Sri Lanka').trim().slice(0, 80),
        occasion: (input.occasion || 'Standard Visit').trim().slice(0, 80),
        dietaryNotes: (input.dietaryNotes || '').trim().slice(0, 500),
        specialRequests: (input.specialRequests || '').trim().slice(0, 1000),
        status: 'confirmed',
      };

      await commitFirestoreWrite(
        setDoc(slotRef, {
          id: slotId,
          date: cleanDate,
          time: cleanTime,
          tableId: cleanTableId,
          status: 'reserved',
          holdExpiresAtMs: 0,
          sessionId: sessionId.slice(0, 100),
          referenceCode,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `availability/${slotId}`
      );

      await commitFirestoreWrite(
        setDoc(resRef, {
          ...reservationData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        OperationType.CREATE,
        `reservations/${resId}`
      );

      return reservationData;
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
      const inqId = `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const payload = {
        id: inqId,
        name: (input.name || 'Guest').trim().slice(0, 120),
        email: (input.email || 'guest@example.com').trim().slice(0, 140),
        phone: (input.phone || '').trim().slice(0, 60),
        subject: (input.subject || 'General Inquiry').trim().slice(0, 160),
        message: (input.message || '').trim().slice(0, 2500),
        status: 'new' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await commitFirestoreWrite(
        setDoc(doc(db, 'inquiries', inqId), payload),
        OperationType.CREATE,
        `inquiries/${inqId}`
      );
    },
    []
  );

  // Admin Operations (Optimistic UI + Direct Firestore & R2 Sync)
  const updateReservationStatus = useCallback(
    async (reservation: ReservationRecord, newStatus: ReservationRecord['status']) => {
      const slotId = `${reservation.date}_${reservation.time.replace(':', '')}_${reservation.tableId}`;
      const resRef = doc(db, 'reservations', reservation.id);
      const slotRef = doc(db, 'availability', slotId);

      setReservations((prev) =>
        prev.map((r) => (r.id === reservation.id ? { ...r, status: newStatus } : r))
      );

      const payload = {
        id: reservation.id,
        referenceCode: reservation.referenceCode,
        date: reservation.date,
        time: reservation.time,
        servicePeriod: reservation.servicePeriod,
        partySize: Math.round(Number(reservation.partySize) || 2),
        tableId: reservation.tableId,
        tableLabel: reservation.tableLabel,
        zoneId: reservation.zoneId,
        zoneName: reservation.zoneName,
        guestName: reservation.guestName.slice(0, 120),
        guestEmail: reservation.guestEmail.slice(0, 140),
        whatsapp: reservation.whatsapp.slice(0, 60),
        country: (reservation.country || '').slice(0, 80),
        occasion: (reservation.occasion || '').slice(0, 80),
        dietaryNotes: (reservation.dietaryNotes || '').slice(0, 500),
        specialRequests: (reservation.specialRequests || '').slice(0, 1000),
        status: newStatus,
        createdAt: reservation.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await commitFirestoreWrite(
        setDoc(resRef, payload),
        OperationType.UPDATE,
        `reservations/${reservation.id}`
      );

      let nextSlotStatus: AvailabilitySlotRecord['status'] = 'reserved';
      if (newStatus === 'cancelled' || newStatus === 'rejected' || newStatus === 'completed') {
        nextSlotStatus = 'available';
      } else if (newStatus === 'seated') {
        nextSlotStatus = 'occupied';
      }

      await commitFirestoreWrite(
        setDoc(slotRef, {
          id: slotId,
          date: reservation.date,
          time: reservation.time,
          tableId: reservation.tableId,
          status: nextSlotStatus,
          holdExpiresAtMs: 0,
          sessionId: 'admin',
          referenceCode: nextSlotStatus === 'available' ? '' : reservation.referenceCode,
          updatedAt: serverTimestamp(),
        }),
        OperationType.UPDATE,
        `availability/${slotId}`
      );

      await logAdminAction(
        'UPDATE_RESERVATION_STATUS',
        'reservations',
        reservation.id,
        `Changed reservation ${reservation.referenceCode} to ${newStatus}`
      );
    },
    []
  );

  const saveTable = useCallback(async (table: CafeTable) => {
    const safeId = sanitizeDocId(table.id, 'T');
    const normalized: CafeTable = {
      id: safeId,
      label: (table.label || safeId).trim().slice(0, 60),
      number: Math.min(200, Math.max(1, Math.round(Number(table.number) || 1))),
      capacity: Math.min(30, Math.max(1, Math.round(Number(table.capacity) || 2))),
      minGuests: Math.min(20, Math.max(1, Math.round(Number(table.minGuests) || 1))),
      zoneId: (table.zoneId || 'zone_verandah').trim().slice(0, 80),
      zoneName: (table.zoneName || 'Sanctuary').trim().slice(0, 120),
      shape:
        table.shape === 'square' || table.shape === 'diamond' || table.shape === 'rectangle'
          ? table.shape
          : 'round',
      x: Math.min(100, Math.max(0, Math.round(Number(table.x) || 50))),
      y: Math.min(100, Math.max(0, Math.round(Number(table.y) || 50))),
      isVip: Boolean(table.isVip),
      isActive: Boolean(table.isActive),
      notes: (table.notes || '').slice(0, 300),
    };

    setTables((prev) => {
      const exists = prev.some((t) => t.id === safeId);
      const next = exists ? prev.map((t) => (t.id === safeId ? normalized : t)) : [...prev, normalized];
      return [...next].sort((a, b) => a.number - b.number);
    });

    await commitFirestoreWrite(
      setDoc(doc(db, 'tables', safeId), {
        ...normalized,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `tables/${safeId}`
    );
    await logAdminAction('SAVE_TABLE', 'tables', safeId, `Saved table ${normalized.label}`);
  }, []);

  const deleteTable = useCallback(async (tableId: string) => {
    const safeId = sanitizeDocId(tableId, 'T');
    setTables((prev) => prev.filter((t) => t.id !== safeId));
    await commitFirestoreWrite(
      deleteDoc(doc(db, 'tables', safeId)),
      OperationType.DELETE,
      `tables/${safeId}`
    );
    await logAdminAction('DELETE_TABLE', 'tables', safeId, `Deleted table ${safeId}`);
  }, []);

  const saveZone = useCallback(async (zone: SeatingZone) => {
    const safeId = sanitizeDocId(zone.id, 'zone');
    const normalized: SeatingZone = {
      id: safeId,
      name: (zone.name || 'Sanctuary Zone').trim().slice(0, 120),
      subtitle: (zone.subtitle || '').slice(0, 200),
      description: (zone.description || '').slice(0, 1000),
      atmosphere: (zone.atmosphere || '').slice(0, 200),
      isActive: Boolean(zone.isActive),
      sortOrder: Math.min(100, Math.max(0, Math.round(Number(zone.sortOrder) || 0))),
    };

    setZones((prev) => {
      const exists = prev.some((z) => z.id === safeId);
      const next = exists ? prev.map((z) => (z.id === safeId ? normalized : z)) : [...prev, normalized];
      return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
    });

    await commitFirestoreWrite(
      setDoc(doc(db, 'seatingZones', safeId), {
        ...normalized,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `seatingZones/${safeId}`
    );
    await logAdminAction('SAVE_ZONE', 'seatingZones', safeId, `Saved zone ${normalized.name}`);
  }, []);

  const deleteZone = useCallback(async (zoneId: string) => {
    const safeId = sanitizeDocId(zoneId, 'zone');
    setZones((prev) => prev.filter((z) => z.id !== safeId));
    await commitFirestoreWrite(
      deleteDoc(doc(db, 'seatingZones', safeId)),
      OperationType.DELETE,
      `seatingZones/${safeId}`
    );
    await logAdminAction('DELETE_ZONE', 'seatingZones', safeId, `Deleted zone ${safeId}`);
  }, []);

  const saveOpeningHours = useCallback(async (config: OpeningHoursConfig) => {
    const safeId = sanitizeDocId(config.id, 'day');
    const normalized: OpeningHoursConfig = {
      id: safeId,
      dayOfWeek: (config.dayOfWeek || 'Monday').trim().slice(0, 30),
      isOpen: Boolean(config.isOpen),
      openTime: (config.openTime || '07:30').slice(0, 20),
      closeTime: (config.closeTime || '22:30').slice(0, 20),
      slotDurationMinutes: Math.min(240, Math.max(15, Math.round(Number(config.slotDurationMinutes) || 30))),
      gracePeriodMinutes: Math.min(120, Math.max(0, Math.round(Number(config.gracePeriodMinutes) || 15))),
    };

    setOpeningHours((prev) => {
      const exists = prev.some((o) => o.id === safeId);
      return exists ? prev.map((o) => (o.id === safeId ? normalized : o)) : [...prev, normalized];
    });

    await commitFirestoreWrite(
      setDoc(doc(db, 'openingHours', safeId), {
        ...normalized,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `openingHours/${safeId}`
    );
    await logAdminAction('SAVE_HOURS', 'openingHours', safeId, `Updated hours for ${normalized.dayOfWeek}`);
  }, []);

  const saveBlockedDate = useCallback(async (blocked: BlockedDateRecord) => {
    const safeId = sanitizeDocId(blocked.id, 'blk');
    const normalized: BlockedDateRecord = {
      id: safeId,
      date: (blocked.date || '').trim().slice(0, 20),
      reason: (blocked.reason || 'Closed').trim().slice(0, 300),
      isFullDay: Boolean(blocked.isFullDay),
      blockedSlots: Array.isArray(blocked.blockedSlots)
        ? blocked.blockedSlots
            .filter((s): s is string => typeof s === 'string')
            .map((s) => s.slice(0, 20))
            .slice(0, 48)
        : [],
    };

    setBlockedDates((prev) => {
      const exists = prev.some((b) => b.id === safeId);
      return exists ? prev.map((b) => (b.id === safeId ? normalized : b)) : [...prev, normalized];
    });

    await commitFirestoreWrite(
      setDoc(doc(db, 'blockedDates', safeId), {
        ...normalized,
        createdAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `blockedDates/${safeId}`
    );
    await logAdminAction('BLOCK_DATE', 'blockedDates', safeId, `Blocked date ${normalized.date}`);
  }, []);

  const deleteBlockedDate = useCallback(async (id: string) => {
    const safeId = sanitizeDocId(id, 'blk');
    setBlockedDates((prev) => prev.filter((b) => b.id !== safeId));
    await commitFirestoreWrite(
      deleteDoc(doc(db, 'blockedDates', safeId)),
      OperationType.DELETE,
      `blockedDates/${safeId}`
    );
    await logAdminAction('UNBLOCK_DATE', 'blockedDates', safeId, `Removed blocked date ${safeId}`);
  }, []);

  const saveMenuCategory = useCallback(async (cat: MenuCategory) => {
    const safeId = sanitizeDocId(cat.id, 'cat');
    const cleanName = (cat.name || 'General Selection').trim().slice(0, 120);
    const cleanSlug =
      (cat.slug || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 120) ||
      cleanName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 120) ||
      safeId;
    const safeSection = resolveMenuCategorySection({
      id: safeId,
      name: cleanName,
      section: cat.section,
    });

    const normalized: MenuCategory = {
      id: safeId,
      name: cleanName,
      slug: cleanSlug,
      subtitle: (cat.subtitle || '').slice(0, 250),
      section: safeSection,
      sortOrder: Math.min(100, Math.max(0, Math.round(Number(cat.sortOrder) || 0))),
      isActive: Boolean(cat.isActive),
    };

    setMenuCategories((prev) => {
      const exists = prev.some((c) => c.id === safeId);
      const next = exists ? prev.map((c) => (c.id === safeId ? normalized : c)) : [...prev, normalized];
      return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
    });

    await commitFirestoreWrite(
      setDoc(doc(db, 'menuCategories', safeId), {
        ...normalized,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `menuCategories/${safeId}`
    );
    await logAdminAction('SAVE_MENU_CATEGORY', 'menuCategories', safeId, `Saved category ${cleanName}`);
  }, []);

  const deleteMenuCategory = useCallback(async (id: string) => {
    const safeId = sanitizeDocId(id, 'cat');
    setMenuCategories((prev) => prev.filter((c) => c.id !== safeId));
    await commitFirestoreWrite(
      deleteDoc(doc(db, 'menuCategories', safeId)),
      OperationType.DELETE,
      `menuCategories/${safeId}`
    );
    await logAdminAction('DELETE_MENU_CATEGORY', 'menuCategories', safeId, `Deleted category ${safeId}`);
  }, []);

  const saveMenuItem = useCallback(
    async (item: MenuItem) => {
      const safeId = sanitizeDocId(item.id, 'item');
      const previous = menuItems.find((m) => m.id === safeId);
      const nextUrl = sanitizeCdnUrl(item.imageUrl);
      if (previous?.imageUrl && previous.imageUrl !== nextUrl) {
        await deleteMediaFromR2(previous.imageUrl);
      }

      const safePriceCurrency =
        item.priceCurrency === 'both' || item.priceCurrency === 'lkr' || item.priceCurrency === 'usd'
          ? item.priceCurrency
          : 'default';

      const normalized: MenuItem = {
        id: safeId,
        name: (item.name || 'Untitled Dish').trim().slice(0, 160),
        categoryId: (item.categoryId || 'cat_general').trim().slice(0, 80),
        categoryName: (item.categoryName || 'Menu').trim().slice(0, 120),
        description: (item.description || '').trim().slice(0, 1500),
        priceLkr: Math.min(500000, Math.max(0, Math.round(Number(item.priceLkr) || 0))),
        priceUsd: Math.min(5000, Math.max(0, Number(item.priceUsd) || 0)),
        priceCurrency: safePriceCurrency,
        imageUrl: nextUrl.slice(0, 1500),
        dietaryTags: Array.isArray(item.dietaryTags)
          ? item.dietaryTags
              .filter((t): t is string => typeof t === 'string')
              .map((t) => t.slice(0, 40))
              .slice(0, 15)
          : [],
        isFeatured: Boolean(item.isFeatured),
        isAvailable: Boolean(item.isAvailable),
      };

      setMenuItems((prev) => {
        const exists = prev.some((m) => m.id === safeId);
        return exists ? prev.map((m) => (m.id === safeId ? normalized : m)) : [...prev, normalized];
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'menuItems', safeId), {
          ...normalized,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `menuItems/${safeId}`
      );

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', `menu_${safeId}`), {
          id: `menu_${safeId}`,
          sectionKey: 'menu',
          label: `Menu Item · ${normalized.name}`,
          imageUrl: normalized.imageUrl,
          targetCollection: 'menuItems',
          targetDocId: safeId,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteImages/menu_${safeId}`
      );

      await logAdminAction('SAVE_MENU_ITEM', 'menuItems', safeId, `Saved menu item ${normalized.name}`);
    },
    [menuItems, deleteMediaFromR2]
  );

  const deleteMenuItem = useCallback(
    async (id: string) => {
      const safeId = sanitizeDocId(id, 'item');
      const existing = menuItems.find((m) => m.id === safeId);
      setMenuItems((prev) => prev.filter((m) => m.id !== safeId));
      if (existing?.imageUrl) {
        await deleteMediaFromR2(existing.imageUrl);
      }
      await commitFirestoreWrite(
        deleteDoc(doc(db, 'menuItems', safeId)),
        OperationType.DELETE,
        `menuItems/${safeId}`
      );
      await deleteDoc(doc(db, 'siteImages', `menu_${safeId}`)).catch(() => {});
      await logAdminAction('DELETE_MENU_ITEM', 'menuItems', safeId, `Deleted menu item ${safeId}`);
    },
    [menuItems, deleteMediaFromR2]
  );

  const saveGalleryItem = useCallback(
    async (item: GalleryItem) => {
      const safeId = sanitizeDocId(item.id, 'gal');
      const previous = gallery.find((g) => g.id === safeId);
      const nextUrl = sanitizeCdnUrl(item.imageUrl);
      if (previous?.imageUrl && previous.imageUrl !== nextUrl) {
        await deleteMediaFromR2(previous.imageUrl);
      }

      const normalized: GalleryItem = {
        id: safeId,
        title: (item.title || 'Sanctuary Moment').trim().slice(0, 160),
        category: item.category || 'Architecture',
        caption: (item.caption || '').trim().slice(0, 800),
        imageUrl: nextUrl.slice(0, 1500),
        aspectRatio:
          item.aspectRatio === '4:3' || item.aspectRatio === '3:4' || item.aspectRatio === '1:1'
            ? item.aspectRatio
            : '16:9',
        isFeatured: Boolean(item.isFeatured),
        sortOrder: Math.min(200, Math.max(0, Math.round(Number(item.sortOrder) || 1))),
      };

      setGallery((prev) => {
        const exists = prev.some((g) => g.id === safeId);
        const next = exists ? prev.map((g) => (g.id === safeId ? normalized : g)) : [...prev, normalized];
        return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'gallery', safeId), {
          ...normalized,
          createdAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `gallery/${safeId}`
      );

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', `gallery_${safeId}`), {
          id: `gallery_${safeId}`,
          sectionKey: 'gallery',
          label: `Gallery · ${normalized.title}`,
          imageUrl: normalized.imageUrl,
          targetCollection: 'gallery',
          targetDocId: safeId,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteImages/gallery_${safeId}`
      );

      await logAdminAction('SAVE_GALLERY', 'gallery', safeId, `Saved gallery item ${normalized.title}`);
    },
    [gallery, deleteMediaFromR2]
  );

  const deleteGalleryItem = useCallback(
    async (id: string) => {
      const safeId = sanitizeDocId(id, 'gal');
      const existing = gallery.find((g) => g.id === safeId);
      setGallery((prev) => prev.filter((g) => g.id !== safeId));
      if (existing?.imageUrl) {
        await deleteMediaFromR2(existing.imageUrl);
      }
      await commitFirestoreWrite(
        deleteDoc(doc(db, 'gallery', safeId)),
        OperationType.DELETE,
        `gallery/${safeId}`
      );
      await deleteDoc(doc(db, 'siteImages', `gallery_${safeId}`)).catch(() => {});
      await logAdminAction('DELETE_GALLERY', 'gallery', safeId, `Deleted gallery item ${safeId}`);
    },
    [gallery, deleteMediaFromR2]
  );

  const saveEvent = useCallback(
    async (evt: CafeEvent) => {
      const safeId = sanitizeDocId(evt.id, 'evt');
      const previous = events.find((e) => e.id === safeId);
      const nextUrl = sanitizeCdnUrl(evt.imageUrl);
      if (previous?.imageUrl && previous.imageUrl !== nextUrl) {
        await deleteMediaFromR2(previous.imageUrl);
      }

      const normalized: CafeEvent = {
        id: safeId,
        title: (evt.title || 'Sanctuary Gathering').trim().slice(0, 180),
        subtitle: (evt.subtitle || '').trim().slice(0, 260),
        date: (evt.date || 'Weekly').trim().slice(0, 80),
        time: (evt.time || '18:00').trim().slice(0, 80),
        category: (evt.category || 'Evening Ritual').trim().slice(0, 80),
        description: (evt.description || '').trim().slice(0, 2500),
        imageUrl: nextUrl.slice(0, 1500),
        priceInfo: (evt.priceInfo || '').slice(0, 160),
        isFeatured: Boolean(evt.isFeatured),
        isActive: Boolean(evt.isActive),
      };

      setEvents((prev) => {
        const exists = prev.some((e) => e.id === safeId);
        return exists ? prev.map((e) => (e.id === safeId ? normalized : e)) : [...prev, normalized];
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'events', safeId), {
          ...normalized,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `events/${safeId}`
      );

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', `event_${safeId}`), {
          id: `event_${safeId}`,
          sectionKey: 'events',
          label: `Event · ${normalized.title}`,
          imageUrl: normalized.imageUrl,
          targetCollection: 'events',
          targetDocId: safeId,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteImages/event_${safeId}`
      );

      await logAdminAction('SAVE_EVENT', 'events', safeId, `Saved event ${normalized.title}`);
    },
    [events, deleteMediaFromR2]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const safeId = sanitizeDocId(id, 'evt');
      const existing = events.find((e) => e.id === safeId);
      setEvents((prev) => prev.filter((e) => e.id !== safeId));
      if (existing?.imageUrl) {
        await deleteMediaFromR2(existing.imageUrl);
      }
      await commitFirestoreWrite(
        deleteDoc(doc(db, 'events', safeId)),
        OperationType.DELETE,
        `events/${safeId}`
      );
      await deleteDoc(doc(db, 'siteImages', `event_${safeId}`)).catch(() => {});
      await logAdminAction('DELETE_EVENT', 'events', safeId, `Deleted event ${safeId}`);
    },
    [events, deleteMediaFromR2]
  );

  const saveSiteContent = useCallback(
    async (section: SiteContentSection) => {
      const rawKey = section.sectionKey || section.id || 'section';
      const safeId = sanitizeDocId(section.id || rawKey, 'sec');
      const previous = siteContent.find(
        (s) => s.id === safeId || s.sectionKey === section.sectionKey
      );
      const nextUrl = sanitizeCdnUrl(section.imageUrl);
      if (previous?.imageUrl && previous.imageUrl !== nextUrl) {
        await deleteMediaFromR2(previous.imageUrl);
      }

      const normalized: SiteContentSection = {
        id: safeId,
        sectionKey: (section.sectionKey || safeId).trim().slice(0, 60),
        kicker: (section.kicker || '').slice(0, 200),
        heading: (section.heading || '').trim().slice(0, 300),
        subheading: (section.subheading || '').slice(0, 500),
        body: (section.body || '').slice(0, 4000),
        ctaLabel: (section.ctaLabel || '').slice(0, 120),
        ctaLink: (section.ctaLink || '').slice(0, 300),
        imageUrl: nextUrl.slice(0, 1500),
      };

      setSiteContent((prev) => {
        const exists = prev.some(
          (s) => s.id === safeId || s.sectionKey === normalized.sectionKey
        );
        if (exists) {
          return prev.map((s) =>
            s.id === safeId || s.sectionKey === normalized.sectionKey ? normalized : s
          );
        }
        return [...prev, normalized];
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteContent', safeId), {
          ...normalized,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteContent/${safeId}`
      );

      // Sync section image into dedicated `siteImages` Firestore collection
      const slotMeta = DEFAULT_SITE_IMAGES.find(
        (si) => si.id === normalized.sectionKey || si.id === safeId
      );
      const imageSlotId = normalized.sectionKey || safeId;
      const imageRecord: SiteImageRecord = {
        id: imageSlotId,
        sectionKey: imageSlotId,
        label: slotMeta?.label || normalized.heading || normalized.sectionKey,
        imageUrl: normalized.imageUrl,
        targetCollection: 'siteContent',
        targetDocId: safeId,
      };
      setSiteImages((prev) => {
        const exists = prev.some((img) => img.id === imageSlotId || img.sectionKey === imageSlotId);
        return exists
          ? prev.map((img) =>
              img.id === imageSlotId || img.sectionKey === imageSlotId ? imageRecord : img
            )
          : [...prev, imageRecord];
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', imageSlotId), {
          ...imageRecord,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteImages/${imageSlotId}`
      );

      await logAdminAction(
        'SAVE_SITE_CONTENT',
        'siteContent',
        safeId,
        `Updated section ${normalized.sectionKey}`
      );
    },
    [siteContent, deleteMediaFromR2]
  );

  const saveSettings = useCallback(
    async (newSettings: CafeSettings) => {
      const nextFloorPlanUrl = sanitizeCdnUrl(newSettings.floorPlanImageUrl);
      if (settings.floorPlanImageUrl && settings.floorPlanImageUrl !== nextFloorPlanUrl) {
        await deleteMediaFromR2(settings.floorPlanImageUrl);
      }

      const prevHeroes = Array.isArray(settings.heroImages) ? settings.heroImages : [];
      const nextHeroes = Array.isArray(newSettings.heroImages)
        ? newSettings.heroImages.map((u) => sanitizeCdnUrl(u)).filter(Boolean)
        : [];
      const removedHeroes = prevHeroes.filter((oldUrl) => oldUrl && !nextHeroes.includes(oldUrl));
      if (removedHeroes.length > 0) {
        await deleteMediaFromR2(removedHeroes);
      }

      const safeCurrencyDisplay =
        newSettings.menuCurrencyDisplay === 'lkr' || newSettings.menuCurrencyDisplay === 'usd'
          ? newSettings.menuCurrencyDisplay
          : 'both';

      const normalized: CafeSettings = {
        id: 'main',
        cafeName: (newSettings.cafeName || 'OneLove Café').trim().slice(0, 120),
        tagline: (newSettings.tagline || '').slice(0, 300),
        address: (newSettings.address || '').slice(0, 300),
        phone: (newSettings.phone || '').slice(0, 60),
        whatsapp: (newSettings.whatsapp || '').slice(0, 60),
        email: (newSettings.email || '').slice(0, 140),
        instagram: (newSettings.instagram || '').slice(0, 120),
        coordinates: (newSettings.coordinates || '').slice(0, 120),
        gracePeriodMinutes: Math.min(120, Math.max(0, Math.round(Number(newSettings.gracePeriodMinutes) || 15))),
        holdDurationMinutes: Math.min(60, Math.max(1, Math.round(Number(newSettings.holdDurationMinutes) || 10))),
        maxPartySize: Math.min(50, Math.max(1, Math.round(Number(newSettings.maxPartySize) || 12))),
        sameDayCutoffHour: Math.min(23, Math.max(0, Math.round(Number(newSettings.sameDayCutoffHour) || 21))),
        bookingPolicy: (newSettings.bookingPolicy || '').slice(0, 2000),
        heroImages: nextHeroes.slice(0, 12),
        heroSlideshowSpeedSeconds: Math.min(
          60,
          Math.max(1, Math.round(Number(newSettings.heroSlideshowSpeedSeconds) || 5))
        ),
        floorPlanImageUrl: nextFloorPlanUrl.slice(0, 1500),
        googleMapsEmbedUrl: (newSettings.googleMapsEmbedUrl || '').slice(0, 2500),
        mapTitle: (newSettings.mapTitle || '').slice(0, 200),
        mapSubtitle: (newSettings.mapSubtitle || '').slice(0, 500),
        menuCurrencyDisplay: safeCurrencyDisplay,
        adminEmails: normalizeAdminEmailList(newSettings.adminEmails ?? settings.adminEmails),
      };

      rawSettingsRef.current = normalized;
      setSettings(normalized);

      await commitFirestoreWrite(
        setDoc(doc(db, 'settings', 'main'), {
          ...normalized,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        'settings/main'
      );

      // Sync Hero Slideshow images & Floor Plan Drone Shot into dedicated `siteImages` Firestore collection
      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', 'hero'), {
          id: 'hero',
          sectionKey: 'hero',
          label: 'Homepage Hero Slideshow Images',
          imageUrl: normalized.heroImages?.[0] || '',
          imageUrls: normalized.heroImages || [],
          targetCollection: 'settings',
          targetDocId: 'main',
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        'siteImages/hero'
      );

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', 'floorplan'), {
          id: 'floorplan',
          sectionKey: 'floorplan',
          label: 'Reserve Page (/reserve) · Interactive Floor Plan Background Drone Shot',
          imageUrl: normalized.floorPlanImageUrl || '',
          targetCollection: 'settings',
          targetDocId: 'main',
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        'siteImages/floorplan'
      );

      await logAdminAction('SAVE_SETTINGS', 'settings', 'main', 'Updated café settings');
    },
    [settings, deleteMediaFromR2]
  );

  const addAdminEmail = useCallback(
    async (email: string, name?: string, role: AdminRole = 'super_admin') => {
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new Error('Please enter a valid administrator email address.');
      }
      const nextAdminEmails = normalizeAdminEmailList([
        ...(settings.adminEmails || []),
        normalizedEmail,
      ]);

      await saveSettings({
        ...settings,
        adminEmails: nextAdminEmails,
      });

      const emailSlugId = sanitizeDocId(`email_${normalizedEmail}`, 'admin');
      const displayName = (name || normalizedEmail.split('@')[0] || 'Administrator')
        .trim()
        .slice(0, 120);
      await commitFirestoreWrite(
        setDoc(doc(db, 'admins', emailSlugId), {
          id: emailSlugId,
          email: normalizedEmail.slice(0, 140),
          name: displayName,
          role,
          createdAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `admins/${emailSlugId}`
      );

      await logAdminAction(
        'ADD_ADMIN',
        'admins',
        emailSlugId,
        `Granted shared Admin Panel access to ${normalizedEmail}`
      );
    },
    [settings, saveSettings]
  );

  const removeAdminEmail = useCallback(
    async (email: string) => {
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail) return;
      const isBootstrap = BOOTSTRAP_ADMIN_EMAILS.some(
        (b) => b.trim().toLowerCase() === normalizedEmail
      );
      if (isBootstrap) {
        throw new Error('Core sanctuary owner accounts cannot be removed.');
      }

      const nextAdminEmails = normalizeAdminEmailList(settings.adminEmails).filter(
        (item) => item !== normalizedEmail
      );
      await saveSettings({
        ...settings,
        adminEmails: nextAdminEmails,
      });

      const emailSlugId = sanitizeDocId(`email_${normalizedEmail}`, 'admin');
      await deleteDoc(doc(db, 'admins', emailSlugId)).catch(() => {});
      const matchingDocs = admins.filter(
        (a) => a.email && a.email.trim().toLowerCase() === normalizedEmail
      );
      for (const rec of matchingDocs) {
        await deleteDoc(doc(db, 'admins', rec.id)).catch(() => {});
      }

      await logAdminAction(
        'REMOVE_ADMIN',
        'admins',
        emailSlugId,
        `Removed Admin Panel access for ${normalizedEmail}`
      );
    },
    [settings, admins, saveSettings]
  );

  const saveSeoGlobal = useCallback(async (config: GlobalSeoConfig) => {
    setSeoGlobal({ ...config, id: 'main' });
    await commitFirestoreWrite(
      setDoc(doc(db, 'seoGlobal', 'main'), {
        ...config,
        id: 'main',
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      'seoGlobal/main'
    );
  }, []);

  const saveSeoPage = useCallback(async (page: PageSeoConfig) => {
    const lockedCanonical = DEFAULT_PAGE_SEO[page.id]?.canonicalPath || page.canonicalPath;
    const lockedRoute = DEFAULT_PAGE_SEO[page.id]?.routePath || page.routePath;
    const normalized: PageSeoConfig = {
      ...page,
      canonicalPath: lockedCanonical,
      routePath: lockedRoute,
    };
    setSeoPages((prev) => ({ ...prev, [page.id]: normalized }));
    await commitFirestoreWrite(
      setDoc(doc(db, 'seoPages', page.id), {
        ...normalized,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      `seoPages/${page.id}`
    );
  }, []);

  const resetSeoToDefaults = useCallback(async () => {
    setSeoGlobal(DEFAULT_GLOBAL_SEO);
    setSeoPages(DEFAULT_PAGE_SEO);
    await commitFirestoreWrite(
      setDoc(doc(db, 'seoGlobal', 'main'), {
        ...DEFAULT_GLOBAL_SEO,
        updatedAt: serverTimestamp(),
      }),
      OperationType.WRITE,
      'seoGlobal/main'
    );
    for (const page of Object.values(DEFAULT_PAGE_SEO)) {
      await commitFirestoreWrite(
        setDoc(doc(db, 'seoPages', page.id), {
          ...page,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `seoPages/${page.id}`
      );
    }
  }, []);

  const updateInquiryStatus = useCallback(
    async (inquiry: InquiryRecord, status: InquiryRecord['status']) => {
      setInquiries((prev) => prev.map((i) => (i.id === inquiry.id ? { ...i, status } : i)));
      await commitFirestoreWrite(
        setDoc(doc(db, 'inquiries', inquiry.id), {
          id: inquiry.id,
          name: inquiry.name.slice(0, 120),
          email: inquiry.email.slice(0, 140),
          phone: (inquiry.phone || '').slice(0, 60),
          subject: (inquiry.subject || '').slice(0, 160),
          message: inquiry.message.slice(0, 2500),
          status,
          createdAt: inquiry.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        OperationType.UPDATE,
        `inquiries/${inquiry.id}`
      );
    },
    []
  );

  // Direct Admin -> Cloudflare R2 Image Upload (returns public R2 CDN URL to save in Firestore)
  const uploadMediaFile = useCallback(
    async (file: File, folder = 'media', previousUrl?: string): Promise<string> => {
      const compressedDataUrl = await fileToCompressedBase64(file, 2400, 1800, 0.88, 6_000_000);
      const payload = JSON.stringify({
        dataUrl: compressedDataUrl,
        filename: file.name,
        folder,
        previousUrl:
          previousUrl && /^https?:\/\//i.test(previousUrl.trim()) ? previousUrl.trim() : undefined,
      });

      const endpoints = ['/api/upload', 'https://onelovecafesigiriya.com/api/upload'];
      let lastError = 'Cloudflare R2 upload failed.';

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok && typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
            return data.url;
          }
          if (data.error) {
            lastError = data.error;
          }
        } catch (err) {
          if (err instanceof Error && err.message) {
            lastError = err.message;
          }
        }
      }

      throw new Error(lastError);
    },
    []
  );

  // Story collage image upload: R2 -> Firestore siteContent
  const updateCollageImageFromDevice = useCallback(
    async (slotIndex: number, file: File) => {
      const sectionKey = `story_collage_${slotIndex}`;
      const existingSection = siteContent.find(
        (s) => s.sectionKey === sectionKey || s.id === sectionKey
      );
      const r2Url = await uploadMediaFile(file, 'story-collage', existingSection?.imageUrl);

      const payload: SiteContentSection = {
        id: sectionKey,
        sectionKey,
        kicker: existingSection?.kicker || `OUR STORY COLLAGE SLOT 0${slotIndex}`,
        heading: existingSection?.heading || `Story Collage Photo ${slotIndex}`,
        subheading: existingSection?.subheading || 'Homepage Our Story Editorial Collage',
        body:
          existingSection?.body ||
          `Displayed in slot ${slotIndex} of the Our Story collage on the homepage.`,
        ctaLabel: existingSection?.ctaLabel || '',
        ctaLink: existingSection?.ctaLink || '/story',
        imageUrl: r2Url.slice(0, 1500),
      };

      setSiteContent((prev) => {
        const exists = prev.some((s) => s.id === sectionKey || s.sectionKey === sectionKey);
        return exists
          ? prev.map((s) => (s.id === sectionKey || s.sectionKey === sectionKey ? payload : s))
          : [...prev, payload];
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteContent', sectionKey), {
          ...payload,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteContent/${sectionKey}`
      );

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', sectionKey), {
          id: sectionKey,
          sectionKey,
          label: `Homepage Our Story Collage Photo (Slot 0${slotIndex})`,
          imageUrl: payload.imageUrl,
          targetCollection: 'siteContent',
          targetDocId: sectionKey,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteImages/${sectionKey}`
      );
    },
    [siteContent, uploadMediaFile]
  );

  const resetCollageImage = useCallback(
    async (slotIndex: number) => {
      const sectionKey = `story_collage_${slotIndex}`;
      const existingSection = siteContent.find(
        (s) => s.sectionKey === sectionKey || s.id === sectionKey
      );
      if (existingSection?.imageUrl) {
        await deleteMediaFromR2(existingSection.imageUrl);
      }

      const payload: SiteContentSection = {
        id: sectionKey,
        sectionKey,
        kicker: existingSection?.kicker || `OUR STORY COLLAGE SLOT 0${slotIndex}`,
        heading: existingSection?.heading || `Story Collage Photo ${slotIndex}`,
        subheading: existingSection?.subheading || 'Homepage Our Story Editorial Collage',
        body:
          existingSection?.body ||
          `Displayed in slot ${slotIndex} of the Our Story collage on the homepage.`,
        ctaLabel: existingSection?.ctaLabel || '',
        ctaLink: existingSection?.ctaLink || '/story',
        imageUrl: '',
      };

      setSiteContent((prev) => {
        const exists = prev.some((s) => s.id === sectionKey || s.sectionKey === sectionKey);
        return exists
          ? prev.map((s) => (s.id === sectionKey || s.sectionKey === sectionKey ? payload : s))
          : [...prev, payload];
      });

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteContent', sectionKey), {
          ...payload,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteContent/${sectionKey}`
      );

      await commitFirestoreWrite(
        setDoc(doc(db, 'siteImages', sectionKey), {
          id: sectionKey,
          sectionKey,
          label: `Homepage Our Story Collage Photo (Slot 0${slotIndex})`,
          imageUrl: '',
          targetCollection: 'siteContent',
          targetDocId: sectionKey,
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        `siteImages/${sectionKey}`
      );
    },
    [siteContent, deleteMediaFromR2]
  );

  const updateSiteImageSlot = useCallback(
    async (slotId: string, file: File): Promise<string> => {
      const cleanId = slotId.trim();
      if (cleanId === 'hero') {
        const prevHero = settings.heroImages?.[0];
        const r2Url = await uploadMediaFile(file, 'hero', prevHero);
        const currentHeroes = Array.isArray(settings.heroImages) ? settings.heroImages.filter(Boolean) : [];
        const nextHeroes = currentHeroes.length > 0 ? [r2Url, ...currentHeroes.slice(1)] : [r2Url];
        await saveSettings({ ...settings, heroImages: nextHeroes });
        return r2Url;
      }
      if (cleanId === 'floorplan') {
        const r2Url = await uploadMediaFile(file, 'floorplan', settings.floorPlanImageUrl);
        await saveSettings({ ...settings, floorPlanImageUrl: r2Url });
        return r2Url;
      }
      if (cleanId === 'story_collage_1') {
        await updateCollageImageFromDevice(1, file);
        const rec = siteImages.find((s) => s.id === 'story_collage_1');
        return rec?.imageUrl || '';
      }
      if (cleanId === 'story_collage_2') {
        await updateCollageImageFromDevice(2, file);
        const rec = siteImages.find((s) => s.id === 'story_collage_2');
        return rec?.imageUrl || '';
      }

      const existingSection =
        siteContent.find((s) => s.sectionKey === cleanId || s.id === cleanId) ||
        DEFAULT_SITE_CONTENT.find((s) => s.sectionKey === cleanId || s.id === cleanId);
      const existingImg = siteImages.find((s) => s.id === cleanId || s.sectionKey === cleanId);
      const prevUrl = existingSection?.imageUrl || existingImg?.imageUrl || '';
      const r2Url = await uploadMediaFile(file, 'content', prevUrl);

      const sectionPayload: SiteContentSection = {
        id: cleanId,
        sectionKey: cleanId,
        kicker: existingSection?.kicker || cleanId.toUpperCase(),
        heading: existingSection?.heading || cleanId,
        subheading: existingSection?.subheading || '',
        body: existingSection?.body || '',
        ctaLabel: existingSection?.ctaLabel || '',
        ctaLink: existingSection?.ctaLink || '',
        imageUrl: r2Url,
      };
      await saveSiteContent(sectionPayload);
      return r2Url;
    },
    [settings, siteContent, siteImages, uploadMediaFile, saveSettings, updateCollageImageFromDevice, saveSiteContent]
  );

  const clearSiteImageSlot = useCallback(
    async (slotId: string): Promise<void> => {
      const cleanId = slotId.trim();
      if (cleanId === 'hero') {
        await saveSettings({ ...settings, heroImages: [] });
        return;
      }
      if (cleanId === 'floorplan') {
        await saveSettings({ ...settings, floorPlanImageUrl: '' });
        return;
      }
      if (cleanId === 'story_collage_1') {
        await resetCollageImage(1);
        return;
      }
      if (cleanId === 'story_collage_2') {
        await resetCollageImage(2);
        return;
      }
      const existingSection =
        siteContent.find((s) => s.sectionKey === cleanId || s.id === cleanId) ||
        DEFAULT_SITE_CONTENT.find((s) => s.sectionKey === cleanId || s.id === cleanId);
      if (existingSection) {
        await saveSiteContent({ ...existingSection, imageUrl: '' });
      }
    },
    [settings, siteContent, saveSettings, resetCollageImage, saveSiteContent]
  );

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
        siteImages,
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
        updateSiteImageSlot,
        clearSiteImageSlot,
        addAdminEmail,
        removeAdminEmail,
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
    throw new Error('useCafe must be used within a CafeProvider');
  }
  return ctx;
}
