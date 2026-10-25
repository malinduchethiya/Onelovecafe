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
  runTransaction,
  serverTimestamp,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAP_ADMIN_EMAIL,
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
  updateInquiryStatus: (inquiry: InquiryRecord, status: InquiryRecord['status']) => Promise<void>;
  uploadMediaFile: (file: File, folder?: string) => Promise<string>;
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

export const CafeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionId] = useState<string>(getOrCreateSessionId);

  const [settings, setSettings] = useState<CafeSettings>(DEFAULT_SETTINGS);
  const [zones, setZones] = useState<SeatingZone[]>(DEFAULT_ZONES);
  const [tables, setTables] = useState<CafeTable[]>(DEFAULT_TABLES);
  const [openingHours, setOpeningHours] = useState<OpeningHoursConfig[]>(DEFAULT_OPENING_HOURS);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRecord[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(DEFAULT_MENU_CATEGORIES);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DEFAULT_MENU_ITEMS);
  const [gallery, setGallery] = useState<GalleryItem[]>(DEFAULT_GALLERY);
  const [events, setEvents] = useState<CafeEvent[]>(DEFAULT_EVENTS);
  const [siteContent, setSiteContent] = useState<SiteContentSection[]>(DEFAULT_SITE_CONTENT);
  const [availability, setAvailability] = useState<AvailabilitySlotRecord[]>([]);

  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  const autoSeededRef = useRef(false);

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

      if (currentUser.email === BOOTSTRAP_ADMIN_EMAIL) {
        setIsAdmin(true);
        setAuthReady(true);
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

  // 2. Public Real-Time Listeners
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'settings'),
        (snap) => {
          const mainDoc = snap.docs.find((d) => d.id === 'main');
          if (mainDoc) {
            const data = mainDoc.data() as Omit<CafeSettings, 'id'>;
            setSettings({
              ...DEFAULT_SETTINGS,
              id: mainDoc.id,
              ...data,
              heroImages:
                Array.isArray(data.heroImages) && data.heroImages.length > 0
                  ? data.heroImages
                  : DEFAULT_SETTINGS.heroImages,
              heroSlideshowSpeedSeconds:
                typeof data.heroSlideshowSpeedSeconds === 'number'
                  ? data.heroSlideshowSpeedSeconds
                  : DEFAULT_SETTINGS.heroSlideshowSpeedSeconds,
              floorPlanImageUrl:
                typeof data.floorPlanImageUrl === 'string' ? data.floorPlanImageUrl : '',
            });
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
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<MenuItem, 'id'>),
            }));
            const alreadyUpgraded =
              typeof window !== 'undefined' &&
              window.localStorage.getItem('onelove_4x4_grid_seeded') === '1';
            if (list.length < 16 && !alreadyUpgraded) {
              const existingIds = new Set(list.map((i) => i.id));
              const missingDefaults = DEFAULT_MENU_ITEMS.filter((d) => !existingIds.has(d.id));
              setMenuItems([...list, ...missingDefaults]);
            } else {
              setMenuItems(list);
            }
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
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, 'id'>) }))
              .sort((a, b) => a.sortOrder - b.sortOrder);
            setGallery(list);
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
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<CafeEvent, 'id'>),
            }));
            setEvents(list);
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
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SiteContentSection, 'id'>),
            }));
            const existingKeys = new Set(list.map((s) => s.sectionKey));
            const missingSections = DEFAULT_SITE_CONTENT.filter(
              (def) => !existingKeys.has(def.sectionKey)
            );
            setSiteContent([...list, ...missingSections]);
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

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // Seed initial sanctuary data into Firestore when an admin clicks Seed or first initializes
  const seedDatabaseIfNeeded = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { id: settingId, ...settingData } = DEFAULT_SETTINGS;
      await setDoc(doc(db, 'settings', settingId), {
        ...settingData,
        heroImages: settingData.heroImages || ['editorial:hero-sanctuary'],
        heroSlideshowSpeedSeconds: settingData.heroSlideshowSpeedSeconds || 5,
        floorPlanImageUrl: settingData.floorPlanImageUrl || '',
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
        await setDoc(doc(db, 'menuItems', id), { ...data, updatedAt: serverTimestamp() });
      }

      for (const g of DEFAULT_GALLERY) {
        const { id, ...data } = g;
        await setDoc(doc(db, 'gallery', id), { ...data, createdAt: serverTimestamp() });
      }

      for (const evt of DEFAULT_EVENTS) {
        const { id, ...data } = evt;
        await setDoc(doc(db, 'events', id), { ...data, updatedAt: serverTimestamp() });
      }

      for (const sc of DEFAULT_SITE_CONTENT) {
        const { id, ...data } = sc;
        await setDoc(doc(db, 'siteContent', id), { ...data, updatedAt: serverTimestamp() });
      }

      await logAdminAction(
        'SEED_SANCTUARY_DATA',
        'settings',
        'main',
        'Initialized default OneLove Café Sigiriya tables, menu, zones, and content in Firestore'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seedDatabase');
    }
  }, [isAdmin]);

  // 3. Protected Admin Real-Time Listeners & Auto-Bootstrap Seeding
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setReservations([]);
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
        collection(db, 'reservations'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ReservationRecord, 'id'>) }))
            .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
          setReservations(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'reservations')
      )
    );

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
        collection(db, 'auditLogs'),
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
      const normalizedTime = time.replace(/[^a-zA-Z0-9]/g, '-');
      const slotId = `${date}_${normalizedTime}_${tableId}`;
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
              throw new Error('This table has just been reserved by another guest.');
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
            date: date.slice(0, 10),
            time: time.slice(0, 10),
            tableId: tableId.slice(0, 40),
            status: 'held',
            holdExpiresAtMs: expiresAtMs,
            sessionId: sessionId.slice(0, 80),
            referenceCode: 'HOLD',
            updatedAt: serverTimestamp(),
          });

          tx.set(holdRef, {
            slotId: slotId.slice(0, 80),
            date: date.slice(0, 10),
            time: time.slice(0, 10),
            tableId: tableId.slice(0, 40),
            sessionId: sessionId.slice(0, 80),
            expiresAtMs,
            createdAt: serverTimestamp(),
          });
        });

        return { slotId, expiresAtMs };
      } catch (error) {
        if (error instanceof Error && error.message.includes('another guest')) {
          throw error;
        }
        handleFirestoreError(error, OperationType.WRITE, `availability/${slotId}`);
      }
    },
    [sessionId, settings.holdDurationMinutes]
  );

  // Transaction-safe Reservation Confirmation with Backend Pre-Validation
  const confirmReservation = useCallback(
    async (input: ConfirmReservationInput): Promise<ReservationRecord> => {
      const res = await fetch('/api/reservations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const validation = await res.json();
      if (!res.ok || !validation.valid) {
        throw new Error(validation.error || 'Reservation validation failed.');
      }

      const referenceCode: string = validation.referenceCode;
      const normalizedTime = input.time.replace(/[^a-zA-Z0-9]/g, '-');
      const slotId = `${input.date}_${normalizedTime}_${input.tableId}`;
      const reservationId = `res_${referenceCode.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

      const slotRef = doc(db, 'availability', slotId);
      const reservationRef = doc(db, 'reservations', reservationId);
      const nowMs = Date.now();

      try {
        await runTransaction(db, async (tx) => {
          const slotSnap = await tx.get(slotRef);
          if (slotSnap.exists()) {
            const slotData = slotSnap.data() as AvailabilitySlotRecord;
            if (slotData.status === 'reserved' || slotData.status === 'occupied') {
              throw new Error(
                'This table was just confirmed by another party. Please select an alternative table on the floor plan.'
              );
            }
            if (
              slotData.status === 'held' &&
              slotData.sessionId !== sessionId &&
              slotData.holdExpiresAtMs > nowMs
            ) {
              throw new Error(
                'This table is actively held by another guest. Please select another table.'
              );
            }
          }

          tx.set(reservationRef, {
            referenceCode: referenceCode.slice(0, 24),
            date: input.date.slice(0, 10),
            time: input.time.slice(0, 10),
            servicePeriod: input.servicePeriod.slice(0, 40),
            partySize: Math.min(20, Math.max(1, Math.round(input.partySize))),
            tableId: input.tableId.slice(0, 40),
            tableLabel: input.tableLabel.slice(0, 40),
            zoneId: input.zoneId.slice(0, 40),
            zoneName: input.zoneName.slice(0, 60),
            guestName: input.guestName.trim().slice(0, 100),
            guestEmail: input.guestEmail.trim().slice(0, 120),
            whatsapp: input.whatsapp.trim().slice(0, 30),
            country: input.country.trim().slice(0, 80),
            occasion: (input.occasion || 'None').slice(0, 60),
            dietaryNotes: (input.dietaryNotes || '').slice(0, 500),
            specialRequests: (input.specialRequests || '').slice(0, 500),
            status: 'confirmed',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          tx.set(slotRef, {
            date: input.date.slice(0, 10),
            time: input.time.slice(0, 10),
            tableId: input.tableId.slice(0, 40),
            status: 'reserved',
            holdExpiresAtMs: 0,
            sessionId: sessionId.slice(0, 80),
            referenceCode: referenceCode.slice(0, 24),
            updatedAt: serverTimestamp(),
          });
        });

        const confirmedRecord: ReservationRecord = {
          id: reservationId,
          referenceCode,
          ...input,
          status: 'confirmed',
        };

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            `onelove_voucher_${referenceCode}`,
            JSON.stringify(confirmedRecord)
          );
        }

        return confirmedRecord;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Please select')) {
          throw error;
        }
        handleFirestoreError(error, OperationType.WRITE, `reservations/${reservationId}`);
      }
    },
    [sessionId]
  );

  // Public Concierge Inquiry Submission
  const submitInquiry = useCallback(
    async (input: {
      name: string;
      email: string;
      phone: string;
      subject: string;
      message: string;
    }) => {
      const res = await fetch('/api/inquiries/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const validation = await res.json();
      if (!res.ok || !validation.valid) {
        throw new Error(validation.error || 'Invalid inquiry submission.');
      }

      const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      try {
        await setDoc(doc(db, 'inquiries', inquiryId), {
          name: input.name.trim().slice(0, 100),
          email: input.email.trim().slice(0, 120),
          phone: (input.phone || '').trim().slice(0, 40),
          subject: input.subject.trim().slice(0, 120),
          message: input.message.trim().slice(0, 1000),
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

      const snap = await getDocs(collection(db, 'tables'));
      if (snap.empty) {
        for (const t of DEFAULT_TABLES) {
          if (t.id === table.id) continue;
          const { id: tid, ...tdata } = t;
          await setDoc(doc(db, 'tables', tid), { ...tdata, updatedAt: serverTimestamp() });
        }
      }

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
      const snap = await getDocs(collection(db, 'tables'));
      if (snap.empty) {
        for (const t of DEFAULT_TABLES) {
          if (t.id === tableId) continue;
          const { id: tid, ...tdata } = t;
          await setDoc(doc(db, 'tables', tid), { ...tdata, updatedAt: serverTimestamp() });
        }
      } else {
        await deleteDoc(doc(db, 'tables', tableId));
      }
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

      const snap = await getDocs(collection(db, 'seatingZones'));
      if (snap.empty) {
        for (const defZone of DEFAULT_ZONES) {
          if (defZone.id === zone.id) continue;
          const { id: zid, ...zdata } = defZone;
          await setDoc(doc(db, 'seatingZones', zid), {
            ...zdata,
            updatedAt: serverTimestamp(),
          });
        }
      }

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
      const snap = await getDocs(collection(db, 'seatingZones'));
      if (snap.empty) {
        for (const defZone of DEFAULT_ZONES) {
          if (defZone.id === zoneId) continue;
          const { id: zid, ...zdata } = defZone;
          await setDoc(doc(db, 'seatingZones', zid), {
            ...zdata,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await deleteDoc(doc(db, 'seatingZones', zoneId));
      }
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

      const snap = await getDocs(collection(db, 'menuCategories'));
      if (snap.empty) {
        for (const defCat of DEFAULT_MENU_CATEGORIES) {
          if (defCat.id === cat.id) continue;
          const { id: cid, ...cdata } = defCat;
          await setDoc(doc(db, 'menuCategories', cid), {
            ...cdata,
            updatedAt: serverTimestamp(),
          });
        }
      }

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

      const snap = await getDocs(collection(db, 'menuCategories'));
      if (snap.empty) {
        for (const defCat of DEFAULT_MENU_CATEGORIES) {
          if (defCat.id === id) continue;
          const { id: cid, ...cdata } = defCat;
          await setDoc(doc(db, 'menuCategories', cid), {
            ...cdata,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await deleteDoc(doc(db, 'menuCategories', id));
      }
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

  const saveMenuItem = useCallback(async (item: MenuItem) => {
    try {
      // Optimistic local state update so UI reflects immediately
      setMenuItems((prev) => {
        const exists = prev.some((m) => m.id === item.id);
        return exists ? prev.map((m) => (m.id === item.id ? item : m)) : [item, ...prev];
      });

      // Ensure default items are persisted if collection was unseeded
      const snap = await getDocs(collection(db, 'menuItems'));
      if (snap.empty) {
        for (const defItem of DEFAULT_MENU_ITEMS) {
          if (defItem.id === item.id) continue;
          const { id: did, ...ddata } = defItem;
          await setDoc(doc(db, 'menuItems', did), {
            ...ddata,
            updatedAt: serverTimestamp(),
          });
        }
      }

      const { id, ...data } = item;
      await setDoc(doc(db, 'menuItems', id), {
        name: (data.name || 'Untitled Dish').slice(0, 100),
        categoryId: (data.categoryId || 'cat_coffee').slice(0, 60),
        categoryName: (data.categoryName || 'Specialty Coffee & Botanicals').slice(0, 60),
        description: (data.description || 'Crafted fresh in Sigiriya.').slice(0, 400),
        priceLkr: Math.max(0, Number(data.priceLkr) || 0),
        priceUsd: Math.max(0, Number(data.priceUsd) || 0),
        imageUrl: (data.imageUrl || '').slice(0, 900000),
        dietaryTags: (data.dietaryTags || []).slice(0, 10),
        isFeatured: Boolean(data.isFeatured),
        isAvailable: Boolean(data.isAvailable),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('SAVE_MENU_ITEM', 'menuItems', id, `Saved menu item ${data.name}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `menuItems/${item.id}`);
    }
  }, []);

  const deleteMenuItem = useCallback(async (id: string) => {
    try {
      // Optimistic local state update
      setMenuItems((prev) => prev.filter((m) => m.id !== id));

      const snap = await getDocs(collection(db, 'menuItems'));
      if (snap.empty) {
        for (const defItem of DEFAULT_MENU_ITEMS) {
          if (defItem.id === id) continue;
          const { id: did, ...ddata } = defItem;
          await setDoc(doc(db, 'menuItems', did), {
            ...ddata,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await deleteDoc(doc(db, 'menuItems', id));
      }
      await logAdminAction('DELETE_MENU_ITEM', 'menuItems', id, `Deleted menu item ${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `menuItems/${id}`);
    }
  }, []);

  const saveGalleryItem = useCallback(async (item: GalleryItem) => {
    try {
      setGallery((prev) => {
        const exists = prev.some((g) => g.id === item.id);
        const next = exists ? prev.map((g) => (g.id === item.id ? item : g)) : [...prev, item];
        return next.sort((a, b) => a.sortOrder - b.sortOrder);
      });

      const snap = await getDocs(collection(db, 'gallery'));
      if (snap.empty) {
        for (const defG of DEFAULT_GALLERY) {
          if (defG.id === item.id) continue;
          const { id: gid, ...gdata } = defG;
          await setDoc(doc(db, 'gallery', gid), { ...gdata, createdAt: serverTimestamp() });
        }
      }

      const { id, ...data } = item;
      const existingSnap = await getDoc(doc(db, 'gallery', id));
      const createdAtVal = existingSnap.exists()
        ? existingSnap.data().createdAt
        : serverTimestamp();
      await setDoc(doc(db, 'gallery', id), {
        title: (data.title || 'Sanctuary Moment').slice(0, 100),
        category: data.category,
        caption: (data.caption || '').slice(0, 300),
        imageUrl: (data.imageUrl || '').slice(0, 900000),
        aspectRatio: data.aspectRatio || '4:3',
        isFeatured: Boolean(data.isFeatured),
        sortOrder: Number(data.sortOrder) || 1,
        createdAt: createdAtVal,
      });
      await logAdminAction('SAVE_GALLERY_ITEM', 'gallery', id, `Saved gallery photo ${data.title}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `gallery/${item.id}`);
    }
  }, []);

  const deleteGalleryItem = useCallback(async (id: string) => {
    try {
      setGallery((prev) => prev.filter((g) => g.id !== id));
      const snap = await getDocs(collection(db, 'gallery'));
      if (snap.empty) {
        for (const defG of DEFAULT_GALLERY) {
          if (defG.id === id) continue;
          const { id: gid, ...gdata } = defG;
          await setDoc(doc(db, 'gallery', gid), { ...gdata, createdAt: serverTimestamp() });
        }
      } else {
        await deleteDoc(doc(db, 'gallery', id));
      }
      await logAdminAction('DELETE_GALLERY_ITEM', 'gallery', id, `Deleted gallery item ${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gallery/${id}`);
    }
  }, []);

  const saveEvent = useCallback(async (evt: CafeEvent) => {
    try {
      setEvents((prev) => {
        const exists = prev.some((e) => e.id === evt.id);
        return exists ? prev.map((e) => (e.id === evt.id ? evt : e)) : [...prev, evt];
      });

      const snap = await getDocs(collection(db, 'events'));
      if (snap.empty) {
        for (const defEvt of DEFAULT_EVENTS) {
          if (defEvt.id === evt.id) continue;
          const { id: eid, ...edata } = defEvt;
          await setDoc(doc(db, 'events', eid), { ...edata, updatedAt: serverTimestamp() });
        }
      }

      const { id, ...data } = evt;
      await setDoc(doc(db, 'events', id), {
        title: (data.title || 'Sanctuary Gathering').slice(0, 120),
        subtitle: (data.subtitle || '').slice(0, 140),
        date: (data.date || 'Weekly').slice(0, 40),
        time: (data.time || '18:00').slice(0, 40),
        category: (data.category || 'Evening Ritual').slice(0, 60),
        description: (data.description || 'Curated experience at OneLove Café.').slice(0, 600),
        imageUrl: (data.imageUrl || '').slice(0, 900000),
        priceInfo: (data.priceInfo || '').slice(0, 80),
        isFeatured: Boolean(data.isFeatured),
        isActive: Boolean(data.isActive),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('SAVE_EVENT', 'events', id, `Saved event ${data.title}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${evt.id}`);
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    try {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      const snap = await getDocs(collection(db, 'events'));
      if (snap.empty) {
        for (const defEvt of DEFAULT_EVENTS) {
          if (defEvt.id === id) continue;
          const { id: eid, ...edata } = defEvt;
          await setDoc(doc(db, 'events', eid), { ...edata, updatedAt: serverTimestamp() });
        }
      } else {
        await deleteDoc(doc(db, 'events', id));
      }
      await logAdminAction('DELETE_EVENT', 'events', id, `Deleted event ${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  }, []);

  const saveSiteContent = useCallback(async (section: SiteContentSection) => {
    try {
      setSiteContent((prev) => {
        const exists = prev.some((s) => s.id === section.id);
        return exists ? prev.map((s) => (s.id === section.id ? section : s)) : [...prev, section];
      });

      const snap = await getDocs(collection(db, 'siteContent'));
      if (snap.empty) {
        for (const defSec of DEFAULT_SITE_CONTENT) {
          if (defSec.id === section.id) continue;
          const { id: sid, ...sdata } = defSec;
          await setDoc(doc(db, 'siteContent', sid), { ...sdata, updatedAt: serverTimestamp() });
        }
      }

      const { id, ...data } = section;
      await setDoc(doc(db, 'siteContent', id), {
        sectionKey: (data.sectionKey || 'section').slice(0, 60),
        kicker: (data.kicker || '').slice(0, 100),
        heading: (data.heading || 'OneLove Café Sigiriya').slice(0, 160),
        subheading: (data.subheading || '').slice(0, 400),
        body: (data.body || '').slice(0, 1200),
        ctaLabel: (data.ctaLabel || '').slice(0, 60),
        ctaLink: (data.ctaLink || '').slice(0, 120),
        imageUrl: (data.imageUrl || '').slice(0, 900000),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        'SAVE_SITE_CONTENT',
        'siteContent',
        id,
        `Updated website section ${data.sectionKey}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `siteContent/${section.id}`);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: CafeSettings) => {
    try {
      setSettings(newSettings);
      const { id, ...data } = newSettings;
      const cleanedHeroImages = Array.isArray(data.heroImages)
        ? data.heroImages.filter((img) => typeof img === 'string' && img.length > 0).slice(0, 12)
        : DEFAULT_SETTINGS.heroImages || ['editorial:hero-sanctuary'];
      const speedSec = Math.min(
        60,
        Math.max(1, Number(data.heroSlideshowSpeedSeconds) || 5)
      );

      await setDoc(doc(db, 'settings', id || 'main'), {
        cafeName: (data.cafeName || 'OneLove Café').slice(0, 80),
        tagline: (data.tagline || '').slice(0, 160),
        address: (data.address || '').slice(0, 200),
        phone: (data.phone || '').slice(0, 40),
        whatsapp: (data.whatsapp || '').slice(0, 40),
        email: (data.email || '').slice(0, 120),
        instagram: (data.instagram || '').slice(0, 100),
        coordinates: (data.coordinates || '').slice(0, 60),
        gracePeriodMinutes: Math.min(60, Math.max(5, Math.round(Number(data.gracePeriodMinutes) || 15))),
        holdDurationMinutes: Math.min(30, Math.max(3, Math.round(Number(data.holdDurationMinutes) || 10))),
        maxPartySize: Math.min(30, Math.max(2, Math.round(Number(data.maxPartySize) || 12))),
        sameDayCutoffHour: Math.min(23, Math.max(0, Math.round(Number(data.sameDayCutoffHour) || 21))),
        bookingPolicy: (data.bookingPolicy || '').slice(0, 600),
        heroImages: cleanedHeroImages,
        heroSlideshowSpeedSeconds: speedSec,
        floorPlanImageUrl: (data.floorPlanImageUrl || '').slice(0, 900000),
        googleMapsEmbedUrl: (data.googleMapsEmbedUrl || '').slice(0, 2000),
        mapTitle: (data.mapTitle || 'Our Sanctuary Location').slice(0, 120),
        mapSubtitle: (data.mapSubtitle || '').slice(0, 250),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('SAVE_SETTINGS', 'settings', id || 'main', 'Updated global café settings & media');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `settings/${newSettings.id}`);
    }
  }, []);

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

  // Convert uploaded device image directly into compressed Base64 data URL for Firestore storage
  const uploadMediaFile = useCallback(async (file: File, folder = 'menu'): Promise<string> => {
    const isHeroSlideshow = folder === 'hero';
    const isFloorPlan = folder === 'floorplan';
    const maxWidth = isFloorPlan ? 1200 : isHeroSlideshow ? 1100 : 900;
    const maxHeight = isFloorPlan ? 850 : isHeroSlideshow ? 750 : 700;
    const quality = isHeroSlideshow ? 0.68 : 0.75;

    const base64DataUrl = await fileToCompressedBase64(file, maxWidth, maxHeight, quality);
    await logAdminAction(
      'ENCODE_BASE64_IMAGE',
      folder,
      file.name.slice(0, 60),
      `Converted device image (${file.name}) to Base64 for Firestore storage`
    );
    return base64DataUrl;
  }, []);

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
        updateInquiryStatus,
        uploadMediaFile,
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
