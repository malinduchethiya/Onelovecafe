import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Map,
  Clock,
  UtensilsCrossed,
  Image as ImageIcon,
  Sparkles,
  FileText,
  MessageSquare,
  Settings,
  ShieldCheck,
  LogOut,
  Plus,
  Trash2,
  Upload,
  Search,
  Database,
  ArrowLeft,
  Edit3,
  RefreshCw,
  Sliders,
  Globe,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useCafe } from '../context/CafeContext';
import { getPrimaryUserEmail } from '../lib/firebase';
import { InteractiveFloorPlan } from './InteractiveFloorPlan';
import { EditorialVisual } from './EditorialVisual';
import { AdminSeoPanel } from './AdminSeoPanel';
import { resolveGoogleMapsEmbedUrl } from '../lib/mapUtils';
import {
  COMMON_DIETARY_TAGS,
  resolveMenuCategorySection,
  resolveMenuItemSection,
} from '../lib/menuSections';
import {
  CafeTable,
  SeatingZone,
  MenuCategory,
  MenuItem,
  MenuSection,
  MenuCurrencyDisplay,
  MenuItemCurrencyOption,
  GalleryItem,
  CafeEvent,
  ReservationRecord,
  SiteContentSection,
} from '../types/cafe';

export type AdminTab =
  | 'overview'
  | 'reservations'
  | 'floor-plan'
  | 'schedule'
  | 'menu'
  | 'gallery'
  | 'events'
  | 'content'
  | 'inquiries'
  | 'seo'
  | 'settings'
  | 'audit';

interface AdminDashboardProps {
  initialTab?: AdminTab;
  onNavigatePublic: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialTab = 'overview',
  onNavigatePublic,
}) => {
  const {
    user,
    isAdmin,
    authReady,
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
    auditLogs,
    sessionId,
    signInAdmin,
    signOutAdmin,
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
    updateCollageImageFromDevice,
    resetCollageImage,
    storageStatus,
    checkStorageStatus,
  } = useCafe();
  const [uploadingCollageSlot, setUploadingCollageSlot] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [seeding, setSeeding] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const lastAdminUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Reservations filter state
  const [resSearch, setResSearch] = useState('');
  const [resStatusFilter, setResStatusFilter] = useState<string>('all');
  const [resDateFilter, setResDateFilter] = useState<string>('');

  // Floor Plan editor state
  const [selectedEditTable, setSelectedEditTable] = useState<CafeTable | null>(tables[0] || null);
  const [uploadingDroneShot, setUploadingDroneShot] = useState(false);

  // Blocked Date form state
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');

  // Menu Category & Item editor state
  const [menuSectionFilter, setMenuSectionFilter] = useState<'all' | MenuSection>('all');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  const [menuItemSearch, setMenuItemSearch] = useState<string>('');
  const [customDietaryTag, setCustomDietaryTag] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const menuEditorRef = useRef<HTMLDivElement | null>(null);

  const foodCategories = useMemo(
    () => menuCategories.filter((c) => resolveMenuCategorySection(c) === 'food'),
    [menuCategories]
  );
  const drinkCategories = useMemo(
    () => menuCategories.filter((c) => resolveMenuCategorySection(c) === 'drinks'),
    [menuCategories]
  );
  const visibleAdminCategories = useMemo(() => {
    if (menuSectionFilter === 'all') return menuCategories;
    return menuCategories.filter((c) => resolveMenuCategorySection(c) === menuSectionFilter);
  }, [menuCategories, menuSectionFilter]);

  const foodItemsCount = useMemo(
    () => menuItems.filter((item) => resolveMenuItemSection(item, menuCategories) === 'food').length,
    [menuItems, menuCategories]
  );
  const drinkItemsCount = useMemo(
    () =>
      menuItems.filter((item) => resolveMenuItemSection(item, menuCategories) === 'drinks').length,
    [menuItems, menuCategories]
  );

  const visibleAdminMenuItems = useMemo(() => {
    const q = menuItemSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      const itemSection = resolveMenuItemSection(item, menuCategories);
      if (menuSectionFilter !== 'all' && itemSection !== menuSectionFilter) return false;
      if (menuCategoryFilter !== 'all' && item.categoryId !== menuCategoryFilter) return false;
      if (q) {
        const matches =
          item.name.toLowerCase().includes(q) ||
          item.categoryName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.dietaryTags || []).some((t) => t.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [menuItems, menuCategories, menuSectionFilter, menuCategoryFilter, menuItemSearch]);

  // Gallery Item editor state (supports both creating & editing existing items)
  const [editingGalleryItem, setEditingGalleryItem] = useState<GalleryItem | null>(null);
  const [uploadingGalleryImg, setUploadingGalleryImg] = useState(false);
  const [uploadingGalleryRowId, setUploadingGalleryRowId] = useState<string | null>(null);
  const [uploadingBatchGallery, setUploadingBatchGallery] = useState(false);
  const galleryEditorRef = useRef<HTMLDivElement | null>(null);

  // Event editor state
  const [editingEvent, setEditingEvent] = useState<CafeEvent | null>(null);
  const [uploadingEventImg, setUploadingEventImg] = useState(false);
  const [uploadingEventRowId, setUploadingEventRowId] = useState<string | null>(null);
  const eventEditorRef = useRef<HTMLDivElement | null>(null);

  // Hero Slideshow upload state
  const [uploadingHeroSlides, setUploadingHeroSlides] = useState(false);

  // Content section drafts & Master Image Audit state
  const [contentDrafts, setContentDrafts] = useState<Record<string, SiteContentSection>>({});
  const [migratingImages, setMigratingImages] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  // Count base64 images stored in Firestore eligible for R2 migration
  const base64Count = useMemo(() => {
    let count = 0;
    menuItems.forEach((m) => {
      if (m.imageUrl && m.imageUrl.startsWith('data:image/')) count++;
    });
    gallery.forEach((g) => {
      if (g.imageUrl && g.imageUrl.startsWith('data:image/')) count++;
    });
    events.forEach((e) => {
      if (e.imageUrl && e.imageUrl.startsWith('data:image/')) count++;
    });
    if (settings.floorPlanImageUrl && settings.floorPlanImageUrl.startsWith('data:image/')) count++;
    (settings.heroImages || []).forEach((h) => {
      if (typeof h === 'string' && h.startsWith('data:image/')) count++;
    });
    return count;
  }, [menuItems, gallery, events, settings]);

  const handleMigrateAllImages = async () => {
    if (!storageStatus?.configured) {
      showToast('Please verify Cloudflare R2 bucket credentials before migrating.');
      return;
    }
    setMigratingImages(true);
    setMigrationStatus('Initializing image migration to Cloudflare R2...');
    let migrated = 0;
    try {
      // 1. Menu items
      for (const item of menuItems) {
        if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
          setMigrationStatus(`Migrating menu photo for "${item.name}"...`);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl: item.imageUrl,
              filename: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg`,
              folder: 'menu',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.url) {
              await saveMenuItem({ ...item, imageUrl: data.url });
              migrated++;
            }
          }
        }
      }

      // 2. Gallery items
      for (const item of gallery) {
        if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
          setMigrationStatus(`Migrating gallery photo "${item.title}"...`);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl: item.imageUrl,
              filename: `${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg`,
              folder: 'gallery',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.url) {
              await saveGalleryItem({ ...item, imageUrl: data.url });
              migrated++;
            }
          }
        }
      }

      // 3. Events
      for (const item of events) {
        if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
          setMigrationStatus(`Migrating event cover "${item.title}"...`);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl: item.imageUrl,
              filename: `${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg`,
              folder: 'events',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.url) {
              await saveEvent({ ...item, imageUrl: data.url });
              migrated++;
            }
          }
        }
      }

      // 4. Hero Slides
      let heroChanged = false;
      const nextHeroImages: string[] = [];
      const currentHeroImages = settings.heroImages || [];
      for (let i = 0; i < currentHeroImages.length; i++) {
        const h = currentHeroImages[i];
        if (typeof h === 'string' && h.startsWith('data:image/')) {
          setMigrationStatus(`Migrating hero slide 0${i + 1}...`);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl: h,
              filename: `hero-slide-${i + 1}.jpg`,
              folder: 'hero',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.url) {
              nextHeroImages.push(data.url);
              migrated++;
              heroChanged = true;
            } else {
              nextHeroImages.push(h);
            }
          } else {
            nextHeroImages.push(h);
          }
        } else {
          nextHeroImages.push(h);
        }
      }

      if (heroChanged) {
        await saveSettings({ ...settings, heroImages: nextHeroImages });
      }

      setMigrationStatus(null);
      showToast(`Migration complete! Successfully moved ${migrated} images to cdn.onelovecafesigiriya.com.`);
    } catch (err) {
      console.error('Migration error:', err);
      showToast('An error occurred during image migration.');
      setMigrationStatus(null);
    } finally {
      setMigratingImages(false);
    }
  };
  const [uploadingSectionId, setUploadingSectionId] = useState<string | null>(null);
  const [uploadingAuditKey, setUploadingAuditKey] = useState<string | null>(null);

  // Seating Zone editor state (used in Footer, Floor Plan & Story page)
  const [editingZone, setEditingZone] = useState<SeatingZone | null>(null);

  // SEO Domain state for Google Search Console Sitemap & Robots generator
  const [seoDomain, setSeoDomain] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.origin : 'https://onelovecafe.lk'
  );

  // Settings local form state
  const [settingsForm, setSettingsForm] = useState(settings);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  useEffect(() => {
    const map: Record<string, SiteContentSection> = {};
    siteContent.forEach((s) => {
      map[s.id] = s;
      map[s.sectionKey] = s;
    });
    setContentDrafts(map);
  }, [siteContent]);

  useEffect(() => {
    if (selectedEditTable) {
      const updated = tables.find((t) => t.id === selectedEditTable.id);
      if (updated) setSelectedEditTable(updated);
    } else if (tables.length > 0) {
      setSelectedEditTable(tables[0]);
    }
  }, [tables]);

  // Reset dashboard tab & open drafts whenever signing out or switching administrator accounts
  useEffect(() => {
    const nextUid = user?.uid ?? null;
    if (lastAdminUidRef.current !== nextUid) {
      lastAdminUidRef.current = nextUid;
      setActiveTab(initialTab || 'overview');
      setEditingCategory(null);
      setEditingMenuItem(null);
      setEditingGalleryItem(null);
      setEditingEvent(null);
      setEditingZone(null);
      setStatusBanner(null);
      if (
        !nextUid &&
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/admin/')
      ) {
        window.history.replaceState({}, '', '/admin');
      }
    }
  }, [user?.uid, initialTab]);

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const urlPath = tab === 'overview' ? '/admin' : `/admin/${tab}`;
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', urlPath);
    }
  };

  // Hero Slideshow Helper Handlers
  const rawAdminHeroImages = Array.isArray(settings.heroImages)
    ? settings.heroImages.filter((img) => typeof img === 'string' && /^https?:\/\//i.test(img.trim()))
    : [];
  const currentHeroImages = rawAdminHeroImages;
  const currentSlideshowSpeed = settings.heroSlideshowSpeedSeconds || 5;

  const handleUploadMultipleHeroImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingHeroSlides(true);
    try {
      const uploadedR2Urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const r2Url = await uploadMediaFile(files[i], 'hero');
        uploadedR2Urls.push(r2Url);
      }
      const nextHeroImages = [...currentHeroImages, ...uploadedR2Urls].slice(0, 12);
      const updatedSettings = {
        ...settings,
        heroImages: nextHeroImages,
      };
      await saveSettings(updatedSettings);
      showToast(
        `Uploaded ${uploadedR2Urls.length} hero background image(s) directly to Cloudflare R2 (cdn.onelovecafesigiriya.com).`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to upload hero slideshow image to Cloudflare R2.'
      );
    } finally {
      setUploadingHeroSlides(false);
    }
  };

  const handleReplaceHeroSlide = async (index: number, file: File | undefined) => {
    if (!file) return;
    setUploadingHeroSlides(true);
    try {
      const prevUrl = currentHeroImages[index];
      const r2Url = await uploadMediaFile(file, 'hero', prevUrl);
      const nextHeroImages = [...currentHeroImages];
      nextHeroImages[index] = r2Url;
      await saveSettings({
        ...settings,
        heroImages: nextHeroImages,
      });
      showToast(`Replaced Slide #${index + 1} in Cloudflare R2 (and deleted old object).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to replace hero slideshow image in R2.'
      );
    } finally {
      setUploadingHeroSlides(false);
    }
  };

  const handleRemoveHeroSlide = async (index: number) => {
    const nextHeroImages = currentHeroImages.filter((_, idx) => idx !== index);
    await saveSettings({
      ...settings,
      heroImages: nextHeroImages,
    });
    showToast(`Removed Slide #${index + 1} from Hero Slideshow & deleted object from Cloudflare R2.`);
  };

  const handleUpdateSlideshowSpeed = async (newSpeedSec: number) => {
    const clamped = Math.min(60, Math.max(1, Number(newSpeedSec) || 5));
    await saveSettings({
      ...settings,
      heroSlideshowSpeedSeconds: clamped,
    });
    showToast(`Hero slideshow transition speed set to ${clamped}s per slide in Cloudflare R2.`);
  };

  const renderHeroSlideshowManager = () => (
    <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7DED3] pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
            Homepage Hero Background Slideshow · 100% Cloudflare R2 Object Storage (cdn.onelovecafesigiriya.com)
          </div>
          <h2 className="text-xl font-editorial font-semibold mt-0.5">
            Hero Background Slideshow &amp; Transition Speed (Direct R2 Bucket Storage)
          </h2>
          <p className="text-xs text-[#171513]/65 mt-0.5">
            Upload high-resolution 4K (3840×2160) photographs directly to your Cloudflare R2 bucket,
            replace or delete individual slides in R2, and adjust the transition speed. Zero Firestore image reads or writes.
          </p>
        </div>

        <label className="px-4 py-2.5 bg-[#C65B2B] text-white text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-[#B04E22] inline-flex items-center gap-2 shrink-0">
          <Upload className="w-3.5 h-3.5" />
          <span>
            {uploadingHeroSlides
              ? 'Uploading to Cloudflare R2 Bucket...'
              : '+ Upload 4K Slideshow Images to R2'}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUploadMultipleHeroImages(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Slideshow Speed Controls */}
      <div className="bg-[#F8F4EE] border border-[#E7DED3] p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-4 h-4 text-[#C65B2B]" />
          <div>
            <div className="font-semibold text-[#171513]">
              Slideshow Transition Speed: {currentSlideshowSpeed} seconds per slide
            </div>
            <div className="text-[#171513]/60">
              Controls how fast the homepage hero cycles through your uploaded background photos
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={20}
            step={1}
            value={currentSlideshowSpeed}
            onChange={(e) => handleUpdateSlideshowSpeed(Number(e.target.value))}
            className="w-36 accent-[#C65B2B] cursor-pointer"
          />
          <input
            type="number"
            min={1}
            max={60}
            value={currentSlideshowSpeed}
            onChange={(e) => handleUpdateSlideshowSpeed(Number(e.target.value))}
            className="w-16 px-2.5 py-1.5 bg-white border border-[#E7DED3] font-mono-tabular text-center"
          />
          <span className="text-[#171513]/60 font-mono-tabular">sec</span>
        </div>
      </div>

      {/* Slides Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentHeroImages.map((imgSrc, idx) => (
          <div
            key={`${idx}-${imgSrc.slice(0, 24)}`}
            className="border border-[#E7DED3] bg-[#F8F4EE] flex flex-col justify-between"
          >
            <div className="relative aspect-[16/9] bg-[#171513] overflow-hidden border-b border-[#E7DED3]">
              <EditorialVisual src={imgSrc} alt={`Hero slide ${idx + 1}`} />
              <div className="absolute top-2 left-2 px-2.5 py-1 bg-[#171513]/85 text-[#F8F4EE] text-[10px] font-mono-tabular uppercase tracking-wider">
                Slide 0{idx + 1} {imgSrc.startsWith('http') ? '· Cloudflare R2' : '· Default'}
              </div>
            </div>

            <div className="p-3 flex items-center justify-between gap-2 text-xs">
              <label className="px-2.5 py-1.5 bg-white border border-[#E7DED3] hover:border-[#171513] cursor-pointer inline-flex items-center gap-1.5 font-medium">
                <RefreshCw className="w-3 h-3 text-[#C65B2B]" />
                <span>Replace Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleReplaceHeroSlide(idx, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => handleRemoveHeroSlide(idx)}
                className="px-2.5 py-1.5 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center p-8">
        <div className="text-sm font-mono-tabular text-[#171513]/60">
          Verifying administrator session...
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E7DED3] p-8 sm:p-10 space-y-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
              OneLove Café Sigiriya · Hospitality Console
            </div>
            <h1 className="text-3xl font-editorial font-semibold text-[#171513]">
              Administrator Sign In
            </h1>
            <p className="text-xs text-[#171513]/65 leading-relaxed">
              Protected administrative interface backed by Firebase Authentication and role-verified
              Firestore security rules.
            </p>
          </div>

          {user && !isAdmin && (
            <div className="p-4 bg-[#FDF3EF] border border-[#C65B2B] text-xs text-[#9E3F16] space-y-1">
              <div className="font-semibold">Access Restricted</div>
              <div>
                Signed in as{' '}
                <span className="font-mono-tabular">
                  {getPrimaryUserEmail(user) || user.email || 'Unknown account'}
                </span>
                {!user.emailVerified
                  ? ', whose email address is not yet verified by Google.'
                  : ', which is not registered in the `/admins` collection.'}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={signInAdmin}
              className="w-full py-3 px-4 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-widest font-medium hover:bg-[#C65B2B] transition-colors"
            >
              Sign In with Google
            </button>
            {user && (
              <button
                type="button"
                onClick={signOutAdmin}
                className="w-full py-2.5 px-4 border border-[#E7DED3] text-xs uppercase tracking-wider text-[#171513]/70 hover:text-[#171513]"
              >
                Sign Out Current Account
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigatePublic('/')}
              className="w-full py-2 text-xs text-[#171513]/60 hover:text-[#171513] inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Public Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredReservations = reservations.filter((r) => {
    const matchesSearch =
      !resSearch ||
      r.guestName.toLowerCase().includes(resSearch.toLowerCase()) ||
      r.guestEmail.toLowerCase().includes(resSearch.toLowerCase()) ||
      r.referenceCode.toLowerCase().includes(resSearch.toLowerCase());
    const matchesStatus = resStatusFilter === 'all' || r.status === resStatusFilter;
    const matchesDate = !resDateFilter || r.date === resDateFilter;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const confirmedCount = reservations.filter(
    (r) => r.status === 'confirmed' || r.status === 'seated'
  ).length;
  const totalGuestsBooked = reservations
    .filter((r) => r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed')
    .reduce((acc, r) => acc + r.partySize, 0);
  const newInquiriesCount = inquiries.filter((i) => i.status === 'new').length;

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview & Analytics', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'reservations', label: 'Reservations', icon: <CalendarCheck className="w-4 h-4" /> },
    { id: 'floor-plan', label: 'Floor Plan & Tables', icon: <Map className="w-4 h-4" /> },
    { id: 'schedule', label: 'Hours & Closures', icon: <Clock className="w-4 h-4" /> },
    { id: 'menu', label: 'Menu & Categories', icon: <UtensilsCrossed className="w-4 h-4" /> },
    { id: 'gallery', label: 'Editorial Gallery', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'events', label: 'Events & Rituals', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'content', label: 'Hero & Site Content', icon: <FileText className="w-4 h-4" /> },
    { id: 'inquiries', label: 'Guest Inquiries', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'seo', label: 'SEO & Search (/admin/seo)', icon: <Globe className="w-4 h-4" /> },
    { id: 'settings', label: 'Café Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Trail', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8F4EE] text-[#171513] flex flex-col lg:flex-row">
      {/* Sidebar Navigation (260px on desktop, horizontal bar on mobile) */}
      <aside className="w-full lg:w-64 bg-[#171513] text-[#F8F4EE] shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#2C2622]">
        <div>
          <div className="px-4 py-3.5 lg:p-5 border-b border-[#2C2622] flex items-center justify-between gap-3">
            <div>
              <div className="font-editorial text-lg sm:text-xl tracking-wide font-semibold">
                ONELOVE CAFÉ
              </div>
              <div className="text-[11px] text-[#F8F4EE]/50 font-mono-tabular">
                Sigiriya Admin Console
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigatePublic('/')}
                className="text-xs text-[#C65B2B] hover:underline whitespace-nowrap"
              >
                View Site →
              </button>
              <button
                type="button"
                onClick={signOutAdmin}
                className="lg:hidden px-2.5 py-1.5 border border-[#3A322C] text-[11px] text-[#F8F4EE]/80 hover:bg-white/5 inline-flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" /> Sign Out
              </button>
            </div>
          </div>

          <nav className="p-2.5 lg:p-3 flex lg:flex-col gap-1.5 lg:gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`w-auto lg:w-full flex items-center gap-2.5 lg:gap-3 px-3 sm:px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-[#C65B2B] text-white'
                    : 'text-[#F8F4EE]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="hidden lg:block p-4 border-t border-[#2C2622] space-y-3">
          <div className="text-xs truncate text-[#F8F4EE]/70 font-mono-tabular">
            {getPrimaryUserEmail(user) || user.email}
          </div>
          <button
            type="button"
            onClick={signOutAdmin}
            className="w-full py-2 px-3 border border-[#3A322C] text-xs text-[#F8F4EE]/80 hover:bg-white/5 inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract for Dashboard */}
        <header className="bg-white border-b border-[#E7DED3] px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="text-xs font-medium text-[#171513]/60">
            Admin Console <span className="mx-1.5">/</span>{' '}
            <span className="text-[#171513] font-semibold uppercase tracking-wider">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={seeding}
              onClick={async () => {
                setSeeding(true);
                await seedDatabaseIfNeeded();
                setSeeding(false);
                showToast('Synced default Sigiriya sanctuary data to Firestore.');
              }}
              className="px-3.5 py-2 bg-[#F8F4EE] border border-[#E7DED3] text-xs font-medium hover:border-[#171513] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5 text-[#C65B2B]" />
              {seeding ? 'Syncing Firestore...' : 'Reset / Sync Default Data'}
            </button>
          </div>
        </header>

        {statusBanner && (
          <div className="sticky top-0 z-30 bg-[#58644E] text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between shadow-sm">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-white/80 hover:text-white text-[11px] uppercase tracking-wider"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="p-6 sm:p-8 space-y-8 max-w-7xl">
          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E7DED3] p-5">
                  <div className="text-xs uppercase tracking-wider text-[#171513]/55">
                    Active Reservations
                  </div>
                  <div className="text-3xl font-editorial font-semibold font-mono-tabular mt-2">
                    {confirmedCount}
                  </div>
                  <div className="text-xs text-[#58644E] mt-1">
                    {reservations.length} total all-time records
                  </div>
                </div>

                <div className="bg-white border border-[#E7DED3] p-5">
                  <div className="text-xs uppercase tracking-wider text-[#171513]/55">
                    Covers / Guests Booked
                  </div>
                  <div className="text-3xl font-editorial font-semibold font-mono-tabular mt-2">
                    {totalGuestsBooked}
                  </div>
                  <div className="text-xs text-[#171513]/60 mt-1">
                    Across {zones.length} sanctuary zones
                  </div>
                </div>

                <div className="bg-white border border-[#E7DED3] p-5">
                  <div className="text-xs uppercase tracking-wider text-[#171513]/55">
                    Configured Tables
                  </div>
                  <div className="text-3xl font-editorial font-semibold font-mono-tabular mt-2">
                    {tables.filter((t) => t.isActive).length} / {tables.length}
                  </div>
                  <div className="text-xs text-[#171513]/60 mt-1 font-mono-tabular">
                    Total capacity: {tables.reduce((s, t) => s + t.capacity, 0)} seats
                  </div>
                </div>

                <div className="bg-white border border-[#E7DED3] p-5">
                  <div className="text-xs uppercase tracking-wider text-[#171513]/55">
                    Unread Concierge Inquiries
                  </div>
                  <div className="text-3xl font-editorial font-semibold font-mono-tabular mt-2">
                    {newInquiriesCount}
                  </div>
                  <div className="text-xs text-[#C65B2B] mt-1">
                    {inquiries.length} total messages
                  </div>
                </div>
              </div>

              {/* Quick Media & Layout Shortcuts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E7DED3] p-5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#C65B2B] font-semibold">
                      Hero Background Slideshow
                    </div>
                    <div className="text-base font-editorial font-semibold mt-0.5">
                      {currentHeroImages.length} Slides · {currentSlideshowSpeed}s Interval
                    </div>
                    <p className="text-xs text-[#171513]/60 mt-1">
                      Upload high-resolution hero photos directly to Cloudflare R2 and adjust slideshow transition speed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange('content')}
                    className="px-4 py-2 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-wider font-medium self-start"
                  >
                    Manage Hero Slideshow →
                  </button>
                </div>

                <div className="bg-white border border-[#E7DED3] p-5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#C65B2B] font-semibold">
                      Drone Shot Floor Plan
                    </div>
                    <div className="text-base font-editorial font-semibold mt-0.5">
                      {settings.floorPlanImageUrl
                        ? 'Custom Drone Shot Active'
                        : 'Architectural Blueprint Active'}
                    </div>
                    <p className="text-xs text-[#171513]/60 mt-1">
                      Upload an aerial drone shot of the café and drag or click to position tables directly over it.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange('floor-plan')}
                    className="px-4 py-2 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-wider font-medium self-start"
                  >
                    Open Floor Plan Editor →
                  </button>
                </div>

                <div className="bg-white border border-[#E7DED3] p-5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#C65B2B] font-semibold">
                      Culinary &amp; Roastery Menu
                    </div>
                    <div className="text-base font-editorial font-semibold mt-0.5">
                      {foodItemsCount} Food · {drinkItemsCount} Drinks
                    </div>
                    <p className="text-xs text-[#171513]/60 mt-1">
                      Manage Food Selections &amp; Drinks categories, LKR/USD pricing, dietary tags, and Home Page featured items.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange('menu')}
                    className="px-4 py-2 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-wider font-medium self-start"
                  >
                    Manage Menu Items →
                  </button>
                </div>
              </div>

              {/* Recent Reservations Table */}
              <div className="bg-white border border-[#E7DED3]">
                <div className="px-6 py-4 border-b border-[#E7DED3] flex items-center justify-between">
                  <h2 className="text-lg font-editorial font-semibold">
                    Latest Sanctuary Reservations
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleTabChange('reservations')}
                    className="text-xs text-[#C65B2B] font-medium hover:underline"
                  >
                    Manage All →
                  </button>
                </div>
                {reservations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#171513]/60">
                    No reservations recorded yet. Book a table on the `/reserve` page to see real-time
                    Firestore updates here.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E7DED3] bg-[#F8F4EE] text-[#171513]/60 uppercase tracking-wider">
                          <th className="py-3 px-4">Reference</th>
                          <th className="py-3 px-4">Date &amp; Time</th>
                          <th className="py-3 px-4">Guest</th>
                          <th className="py-3 px-4">Table &amp; Zone</th>
                          <th className="py-3 px-4 text-right">Party</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7DED3]">
                        {reservations.slice(0, 8).map((r) => (
                          <tr key={r.id} className="hover:bg-[#F8F4EE]/50">
                            <td className="py-3 px-4 font-mono-tabular font-semibold">
                              #{r.referenceCode}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular">
                              {r.date} · {r.time}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{r.guestName}</div>
                              <div className="text-[#171513]/55">{r.guestEmail}</div>
                            </td>
                            <td className="py-3 px-4">
                              {r.tableLabel} · <span className="text-[#171513]/60">{r.zoneName}</span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular">
                              {r.partySize}
                            </td>
                            <td className="py-3 px-4 uppercase tracking-wider font-medium text-[#58644E]">
                              {r.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RESERVATIONS MANAGEMENT */}
          {activeTab === 'reservations' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E7DED3] p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-[#171513]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by guest name, email, or #OL reference..."
                    value={resSearch}
                    onChange={(e) => setResSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#F8F4EE] border border-[#E7DED3] text-xs focus:outline-none focus:border-[#C65B2B]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={resDateFilter}
                    onChange={(e) => setResDateFilter(e.target.value)}
                    className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] text-xs font-mono-tabular"
                  />
                  {resDateFilter && (
                    <button
                      type="button"
                      onClick={() => setResDateFilter('')}
                      className="text-xs text-[#C65B2B] px-2"
                    >
                      Clear Date
                    </button>
                  )}
                  <select
                    value={resStatusFilter}
                    onChange={(e) => setResStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="seated">Seated</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rejected">Rejected</option>
                    <option value="no_show">No Show</option>
                  </select>
                </div>
              </div>

              <div className="bg-white border border-[#E7DED3] overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E7DED3] bg-[#F8F4EE] text-[#171513]/60 uppercase tracking-wider">
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Date &amp; Sitting</th>
                      <th className="py-3 px-4">Guest &amp; Contact</th>
                      <th className="py-3 px-4">Table</th>
                      <th className="py-3 px-4">Requests / Notes</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7DED3]">
                    {filteredReservations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#171513]/50">
                          No matching reservations found.
                        </td>
                      </tr>
                    ) : (
                      filteredReservations.map((r) => (
                        <tr key={r.id} className="hover:bg-[#F8F4EE]/50">
                          <td className="py-3.5 px-4 font-mono-tabular font-semibold">
                            #{r.referenceCode}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular">
                            <div>{r.date}</div>
                            <div className="text-[#171513]/55">
                              {r.time} · {r.partySize}p
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold">
                              {r.guestName} ({r.country})
                            </div>
                            <div className="text-[#171513]/60 font-mono-tabular">
                              {r.whatsapp} · {r.guestEmail}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#C65B2B]">{r.tableLabel}</div>
                            <div className="text-[#171513]/55">{r.zoneName}</div>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            {r.occasion !== 'No special occasion' && (
                              <div className="font-medium">{r.occasion}</div>
                            )}
                            <div className="text-[#171513]/65 truncate">
                              {r.specialRequests || r.dietaryNotes || '—'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular uppercase">{r.status}</td>
                          <td className="py-3.5 px-4 text-right">
                            <select
                              value={r.status}
                              onChange={async (e) => {
                                const next = e.target.value as ReservationRecord['status'];
                                await updateReservationStatus(r, next);
                                showToast(`Reservation #${r.referenceCode} updated to ${next}`);
                              }}
                              className="px-2.5 py-1.5 bg-[#F8F4EE] border border-[#E7DED3] text-xs"
                            >
                              <option value="confirmed">Confirmed</option>
                              <option value="seated">Seated</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="rejected">Rejected</option>
                              <option value="no_show">No Show</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INTERACTIVE FLOOR PLAN & DRONE SHOT TABLE EDITOR */}
          {activeTab === 'floor-plan' && (
            <div className="space-y-6">
              {/* Drone Shot Upload & Management Panel */}
              <div className="bg-white border border-[#E7DED3] p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {settings.floorPlanImageUrl ? (
                    <img
                      src={settings.floorPlanImageUrl}
                      alt="Uploaded floor plan drone shot preview"
                      className="w-24 h-16 object-cover border border-[#E7DED3] shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-16 bg-[#141210] border border-[#2C2622] flex items-center justify-center text-[10px] font-mono-tabular text-[#E7DED3]/70 shrink-0">
                      Blueprint SVG
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Aerial Drone Shot Floor Plan Background · 100% Cloudflare R2 Object Storage
                    </div>
                    <h3 className="text-lg font-editorial font-semibold">
                      {settings.floorPlanImageUrl
                        ? 'Custom Drone Shot Background Active'
                        : 'Upload a Café Drone Shot to Position Tables Over'}
                    </h3>
                    <p className="text-xs text-[#171513]/65">
                      Upload a top-down drone photograph of OneLove Café from your device, then drag
                      or click on the image to place tables in their exact real-world locations.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="px-4 py-2 bg-[#C65B2B] text-white text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-[#B04E22] inline-flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {uploadingDroneShot
                        ? 'Uploading to Cloudflare R2...'
                        : settings.floorPlanImageUrl
                        ? 'Replace Drone Shot Image'
                        : 'Upload Drone Shot from Device'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingDroneShot(true);
                        try {
                          const r2Url = await uploadMediaFile(
                            file,
                            'floorplan',
                            settings.floorPlanImageUrl
                          );
                          await saveSettings({
                            ...settings,
                            floorPlanImageUrl: r2Url,
                          });
                          showToast(
                            'Drone shot floor plan saved directly to Cloudflare R2! Drag tables to adjust positions.'
                          );
                        } finally {
                          setUploadingDroneShot(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>

                  {settings.floorPlanImageUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        await saveSettings({
                          ...settings,
                          floorPlanImageUrl: '',
                        });
                        showToast('Removed custom drone shot; reverted to architectural blueprint.');
                      }}
                      className="px-3.5 py-2 border border-[#E7DED3] bg-[#F8F4EE] text-[#9E3F16] text-xs font-medium hover:bg-[#FDF3EF] inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Drone Shot
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white border border-[#E7DED3] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-editorial font-semibold">
                        Interactive Floor Plan &amp; Table Placement Editor
                      </h2>
                      <p className="text-xs text-[#171513]/60">
                        Drag any table node (or enable Click-to-Place) to adjust table positions on
                        the drone shot. Positions auto-save to Firestore.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0);
                        const nextNum = maxNum + 1;
                        const newT: CafeTable = {
                          id: `T${nextNum}_${Date.now().toString().slice(-4)}`,
                          label: `Table ${nextNum < 10 ? '0' : ''}${nextNum}`,
                          number: nextNum,
                          capacity: 4,
                          minGuests: 2,
                          zoneId: zones[0]?.id || 'zone_verandah',
                          zoneName: zones[0]?.name || 'Jungle Canopy Verandah',
                          shape: 'round',
                          x: 50,
                          y: 50,
                          isVip: false,
                          isActive: true,
                          notes: 'Newly added sanctuary table',
                        };
                        await saveTable(newT);
                        setSelectedEditTable(newT);
                        showToast(
                          `Added ${newT.label} at center of floor plan. Drag it to position on your drone shot!`
                        );
                      }}
                      className="px-3.5 py-2 bg-[#171513] text-[#F8F4EE] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#C65B2B] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add New Table
                    </button>
                  </div>

                  <InteractiveFloorPlan
                    tables={tables}
                    zones={zones}
                    availability={availability}
                    reservations={reservations}
                    selectedDate={new Date().toISOString().split('T')[0]}
                    selectedTime="19:00"
                    partySize={2}
                    selectedTableId={selectedEditTable?.id || null}
                    sessionId={sessionId}
                    editable={true}
                    floorPlanImageUrl={settings.floorPlanImageUrl}
                    onSelectTable={(t) => setSelectedEditTable(t)}
                    onMoveTable={(tableId, newX, newY) => {
                      const target = tables.find((t) => t.id === tableId) || selectedEditTable;
                      if (target && target.id === tableId) {
                        setSelectedEditTable({ ...target, x: newX, y: newY });
                      }
                    }}
                    onCommitTablePosition={async (tableId, finalX, finalY) => {
                      const target = tables.find((t) => t.id === tableId) || selectedEditTable;
                      if (target && target.id === tableId) {
                        const updated = { ...target, x: finalX, y: finalY };
                        setSelectedEditTable(updated);
                        await saveTable(updated);
                        showToast(
                          `Saved ${updated.label} position (X: ${finalX}%, Y: ${finalY}%) to Firestore.`
                        );
                      }
                    }}
                  />
                </div>

                {/* Table Properties Inspector */}
                <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
                  <h3 className="text-lg font-editorial font-semibold border-b border-[#E7DED3] pb-3">
                    {selectedEditTable ? `Edit ${selectedEditTable.label}` : 'Select a Table Node'}
                  </h3>

                  {selectedEditTable && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await saveTable(selectedEditTable);
                        showToast(`Saved ${selectedEditTable.label} to Firestore.`);
                      }}
                      className="space-y-4 text-xs"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#171513]/60 mb-1">Table Label</label>
                          <input
                            type="text"
                            value={selectedEditTable.label}
                            onChange={(e) =>
                              setSelectedEditTable({ ...selectedEditTable, label: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                          />
                        </div>
                        <div>
                          <label className="block text-[#171513]/60 mb-1">Table Number</label>
                          <input
                            type="number"
                            value={selectedEditTable.number}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                number: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#171513]/60 mb-1">Max Capacity</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={selectedEditTable.capacity}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                capacity: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-[#171513]/60 mb-1">Min Guests</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={selectedEditTable.minGuests}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                minGuests: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#171513]/60 mb-1">Seating Zone</label>
                        <select
                          value={selectedEditTable.zoneId}
                          onChange={(e) => {
                            const z = zones.find((zn) => zn.id === e.target.value);
                            if (z) {
                              setSelectedEditTable({
                                ...selectedEditTable,
                                zoneId: z.id,
                                zoneName: z.name,
                              });
                            }
                          }}
                          className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                        >
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[#171513]/60 mb-1">Shape</label>
                          <select
                            value={selectedEditTable.shape}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                shape: e.target.value as CafeTable['shape'],
                              })
                            }
                            className="w-full px-2 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                          >
                            <option value="round">Round</option>
                            <option value="square">Square</option>
                            <option value="diamond">Diamond</option>
                            <option value="rectangle">Rectangle</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[#171513]/60 mb-1">X Pos (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedEditTable.x}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                x: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-[#171513]/60 mb-1">Y Pos (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedEditTable.y}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                y: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#171513]/60 mb-1">Host Notes</label>
                        <input
                          type="text"
                          value={selectedEditTable.notes}
                          onChange={(e) =>
                            setSelectedEditTable({ ...selectedEditTable, notes: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                      </div>

                      <div className="flex items-center gap-6 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEditTable.isVip}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                isVip: e.target.checked,
                              })
                            }
                          />
                          <span>VIP Table</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEditTable.isActive}
                            onChange={(e) =>
                              setSelectedEditTable({
                                ...selectedEditTable,
                                isActive: e.target.checked,
                              })
                            }
                          />
                          <span>Active for Booking</span>
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E7DED3]">
                        <button
                          type="button"
                          onClick={async () => {
                            const removedLabel = selectedEditTable.label;
                            await deleteTable(selectedEditTable.id);
                            setSelectedEditTable(null);
                            showToast(`Deleted ${removedLabel} from floor plan.`);
                          }}
                          className="px-3 py-2 border border-[#E7DED3] text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-[#C65B2B] text-white font-medium uppercase tracking-wider"
                        >
                          Save Table Changes
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPENING HOURS & BLOCKED DATES */}
          {activeTab === 'schedule' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
                <h2 className="text-xl font-editorial font-semibold">
                  Weekly Opening Hours &amp; Slot Durations
                </h2>
                <div className="divide-y divide-[#E7DED3]">
                  {openingHours.map((oh) => (
                    <div
                      key={oh.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="w-28 font-semibold">{oh.dayOfWeek}</div>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={oh.isOpen}
                          onChange={async (e) => {
                            await saveOpeningHours({ ...oh, isOpen: e.target.checked });
                            showToast(`Updated ${oh.dayOfWeek}`);
                          }}
                        />
                        <span>Open</span>
                      </label>
                      <div className="flex items-center gap-2 font-mono-tabular">
                        <input
                          type="time"
                          value={oh.openTime}
                          onChange={async (e) => {
                            await saveOpeningHours({ ...oh, openTime: e.target.value });
                          }}
                          className="px-2 py-1 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                        <span>to</span>
                        <input
                          type="time"
                          value={oh.closeTime}
                          onChange={async (e) => {
                            await saveOpeningHours({ ...oh, closeTime: e.target.value });
                          }}
                          className="px-2 py-1 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
                <h2 className="text-xl font-editorial font-semibold">
                  Special Closures &amp; Private Sanctuary Buyouts
                </h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newBlockedDate || !newBlockedReason) return;
                    await saveBlockedDate({
                      id: `blk_${newBlockedDate}`,
                      date: newBlockedDate,
                      reason: newBlockedReason,
                      isFullDay: true,
                      blockedSlots: [],
                    });
                    setNewBlockedDate('');
                    setNewBlockedReason('');
                    showToast('Blocked date saved to Firestore.');
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      required
                      value={newBlockedDate}
                      onChange={(e) => setNewBlockedDate(e.target.value)}
                      className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Reason (e.g. Private Wedding Buyout)"
                      value={newBlockedReason}
                      onChange={(e) => setNewBlockedReason(e.target.value)}
                      className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider font-medium"
                  >
                    Block Date
                  </button>
                </form>

                <div className="divide-y divide-[#E7DED3] text-xs">
                  {blockedDates.length === 0 ? (
                    <div className="py-4 text-[#171513]/50">No blocked dates configured.</div>
                  ) : (
                    blockedDates.map((b) => (
                      <div key={b.id} className="py-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono-tabular font-semibold">{b.date}</span> ·{' '}
                          <span>{b.reason}</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteBlockedDate(b.id);
                            showToast(`Removed blocked date ${b.date}.`);
                          }}
                          className="text-[#9E3F16] hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MENU & CATEGORY MANAGER */}
          {activeTab === 'menu' && (
            <div className="space-y-8">
              {/* Menu Price Currency Display Control (Global + Per-Item Sync) */}
              <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Menu Pricing &amp; Currency Display · Live Website Control
                    </div>
                    <h2 className="text-xl font-editorial font-semibold text-[#171513]">
                      Menu Price Currency Format (LKR / USD)
                    </h2>
                    <p className="text-xs text-[#171513]/65">
                      Choose whether menu item prices across the homepage and `/menu` page display in{' '}
                      <strong>Sri Lankan Rupees (LKR)</strong>, <strong>US Dollars (USD)</strong>, or{' '}
                      <strong>Both Currencies</strong>. You can also override the currency or edit
                      exact LKR &amp; USD prices for any individual dish below.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 bg-[#F8F4EE] p-1.5 border border-[#E7DED3]">
                    {(
                      [
                        { id: 'both', label: 'Show Both (LKR & USD)' },
                        { id: 'lkr', label: 'LKR Only (Rs.)' },
                        { id: 'usd', label: 'USD Only ($)' },
                      ] as { id: MenuCurrencyDisplay; label: string }[]
                    ).map((opt) => {
                      const currentGlobal = settings.menuCurrencyDisplay || 'both';
                      const isActive = currentGlobal === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={async () => {
                            await saveSettings({
                              ...settings,
                              menuCurrencyDisplay: opt.id,
                            });
                            // If any items had a custom override, reset them to follow the new global choice
                            const itemsWithOverride = menuItems.filter(
                              (m) => m.priceCurrency && m.priceCurrency !== 'default'
                            );
                            for (const itm of itemsWithOverride) {
                              await saveMenuItem({ ...itm, priceCurrency: 'default' });
                            }
                            if (editingMenuItem) {
                              setEditingMenuItem({ ...editingMenuItem, priceCurrency: 'default' });
                            }
                            showToast(
                              `Menu prices updated to display ${
                                opt.id === 'both'
                                  ? 'Both LKR & USD'
                                  : opt.id === 'lkr'
                                  ? 'LKR Only'
                                  : 'USD Only'
                              } across the website.`
                            );
                          }}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#C65B2B] text-white shadow-xs'
                              : 'bg-white text-[#171513]/75 hover:text-[#171513] border border-[#E7DED3]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Menu Section Switcher (Food Selections vs Drinks & Coffee) */}
              <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Menu Structure · Food &amp; Drinks Sections
                    </div>
                    <h2 className="text-xl font-editorial font-semibold text-[#171513]">
                      Food Selections &amp; Drinks Manager
                    </h2>
                    <p className="text-xs text-[#171513]/65">
                      Assign each category to <strong>Food Selections</strong> or{' '}
                      <strong>Drinks &amp; Coffee</strong> to control how chapters appear on the
                      public `/menu` page.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 bg-[#F8F4EE] p-1 border border-[#E7DED3]">
                    {(
                      [
                        {
                          id: 'all',
                          label: `All (${menuItems.length})`,
                        },
                        {
                          id: 'food',
                          label: `Food Selections (${foodItemsCount})`,
                        },
                        {
                          id: 'drinks',
                          label: `Drinks & Coffee (${drinkItemsCount})`,
                        },
                      ] as { id: 'all' | MenuSection; label: string }[]
                    ).map((tab) => {
                      const isActive = menuSectionFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setMenuSectionFilter(tab.id);
                            setMenuCategoryFilter('all');
                          }}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#171513] text-[#F8F4EE]'
                              : 'bg-white text-[#171513]/75 hover:text-[#171513] border border-[#E7DED3]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Menu Categories Manager (Add, Edit, Delete, Assign Food/Drinks) */}
              <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED3] pb-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Category Architecture · {foodCategories.length} Food · {drinkCategories.length}{' '}
                      Drinks
                    </div>
                    <h2 className="text-xl font-editorial font-semibold">
                      Menu Categories ({visibleAdminCategories.length}
                      {menuSectionFilter !== 'all' ? ` of ${menuCategories.length}` : ''})
                    </h2>
                    <p className="text-xs text-[#171513]/60">
                      Each category appears as a chapter under either Food Selections or Drinks
                      &amp; Coffee on `/menu`.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCategory({
                          id: `cat_${Date.now()}`,
                          name: '',
                          slug: '',
                          subtitle: '',
                          section: 'food',
                          sortOrder: menuCategories.length + 1,
                          isActive: true,
                        })
                      }
                      className="px-4 py-2 bg-[#C65B2B] text-white text-xs font-medium uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Food Category
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCategory({
                          id: `cat_${Date.now()}`,
                          name: '',
                          slug: '',
                          subtitle: '',
                          section: 'drinks',
                          sortOrder: menuCategories.length + 1,
                          isActive: true,
                        })
                      }
                      className="px-4 py-2 bg-[#171513] text-[#F8F4EE] hover:bg-[#2F2A26] text-xs font-medium uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Drinks Category
                    </button>
                  </div>
                </div>

                {editingCategory && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!editingCategory.name.trim()) return;
                      try {
                        const generatedSlug =
                          editingCategory.slug.trim() ||
                          editingCategory.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '') ||
                          'category';
                        const section: MenuSection = resolveMenuCategorySection(editingCategory);
                        await saveMenuCategory({
                          ...editingCategory,
                          slug: generatedSlug,
                          section,
                        });
                        showToast(
                          `Saved ${section === 'drinks' ? 'Drinks' : 'Food'} category "${
                            editingCategory.name
                          }" to Firestore.`
                        );
                        setEditingCategory(null);
                      } catch (err) {
                        console.error('Save category failed:', err);
                        showToast('Could not save category to Firestore. Please verify your admin sign-in and try again.');
                      }
                    }}
                    className="bg-[#F8F4EE] border border-[#C65B2B] p-5 space-y-4 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-[#E7DED3] pb-2">
                      <div className="font-semibold text-sm text-[#171513]">
                        {editingCategory.name
                          ? `Editing Category: ${editingCategory.name}`
                          : 'Create New Menu Category'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="text-[#171513]/60 hover:text-[#171513]"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[#171513]/60 mb-1">Category Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Wood-Fired Mains or Cold Brews"
                          value={editingCategory.name}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, name: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-[#E7DED3]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[#171513]/60 mb-1">Menu Section *</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: 'food', label: 'Food Selections' },
                              { id: 'drinks', label: 'Drinks & Coffee' },
                            ] as { id: MenuSection; label: string }[]
                          ).map((opt) => {
                            const currentSec = resolveMenuCategorySection(editingCategory);
                            const active = currentSec === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setEditingCategory({ ...editingCategory, section: opt.id })
                                }
                                className={`px-3 py-2 text-xs font-medium border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#171513] text-[#F8F4EE] border-[#171513]'
                                    : 'bg-white text-[#171513]/75 border-[#E7DED3] hover:border-[#171513]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[#171513]/60 mb-1">Display Order</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={editingCategory.sortOrder}
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,
                              sortOrder: Number(e.target.value) || 1,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-[#E7DED3] font-mono-tabular"
                        />
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={editingCategory.isActive}
                            onChange={(e) =>
                              setEditingCategory({
                                ...editingCategory,
                                isActive: e.target.checked,
                              })
                            }
                          />
                          <span>Active on Menu</span>
                        </label>
                      </div>
                      <div className="sm:col-span-6">
                        <label className="block text-[#171513]/60 mb-1">
                          Editorial Subtitle / Chapter Note
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Small-batch tropical coolers & single-estate highland pour-overs"
                          value={editingCategory.subtitle}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, subtitle: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-[#E7DED3]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider font-medium hover:bg-[#C65B2B] cursor-pointer"
                      >
                        Save Category to Firestore
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="px-4 py-2 border border-[#E7DED3] bg-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  {visibleAdminCategories.map((cat) => {
                    const itemCount = menuItems.filter((m) => m.categoryId === cat.id).length;
                    const catSection = resolveMenuCategorySection(cat);
                    return (
                      <div
                        key={cat.id}
                        className="border border-[#E7DED3] bg-[#F8F4EE]/60 p-4 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-tabular text-[11px] text-[#C65B2B] font-semibold">
                              Order #{cat.sortOrder} · {itemCount} items
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border font-semibold ${
                                  catSection === 'drinks'
                                    ? 'border-[#171513]/30 text-[#171513] bg-white'
                                    : 'border-[#C65B2B]/40 text-[#C65B2B] bg-white'
                                }`}
                              >
                                {catSection === 'drinks' ? 'Drinks' : 'Food'}
                              </span>
                              <span
                                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                                  cat.isActive
                                    ? 'border-[#58644E] text-[#58644E] bg-white'
                                    : 'border-[#E7DED3] text-[#171513]/40 bg-white'
                                }`}
                              >
                                {cat.isActive ? 'Active' : 'Hidden'}
                              </span>
                            </div>
                          </div>
                          <div className="font-editorial text-base font-semibold text-[#171513]">
                            {cat.name}
                          </div>
                          {cat.subtitle && (
                            <p className="text-[#171513]/60 line-clamp-2">{cat.subtitle}</p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#E7DED3] flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingCategory({ ...cat, section: catSection })
                              }
                              className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const nextSection: MenuSection =
                                  catSection === 'food' ? 'drinks' : 'food';
                                await saveMenuCategory({ ...cat, section: nextSection });
                                showToast(
                                  `Moved "${cat.name}" to ${
                                    nextSection === 'drinks'
                                      ? 'Drinks & Coffee'
                                      : 'Food Selections'
                                  }.`
                                );
                              }}
                              className="px-2.5 py-1.5 border border-[#E7DED3] bg-white text-[#171513]/80 hover:border-[#171513] font-medium cursor-pointer"
                            >
                              Move to {catSection === 'food' ? 'Drinks' : 'Food'}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (editingCategory?.id === cat.id) {
                                setEditingCategory(null);
                              }
                              await deleteMenuCategory(cat.id);
                              showToast(`Deleted category "${cat.name}".`);
                            }}
                            className="px-2.5 py-1.5 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white border border-[#E7DED3] p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-editorial font-semibold">
                        {menuSectionFilter === 'food'
                          ? `Food Items (${visibleAdminMenuItems.length})`
                          : menuSectionFilter === 'drinks'
                          ? `Drinks & Coffee Items (${visibleAdminMenuItems.length})`
                          : `All Menu Items (${visibleAdminMenuItems.length})`}
                      </h2>
                      <p className="text-xs text-[#171513]/60">
                        Up to 8 featured Food items and 8 featured Drinks items appear in 4-in-a-row
                        square cards on the Home Page. Menu items display clean text-only cards
                        across Home and /menu.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const defaultFoodCat = foodCategories[0] || menuCategories[0];
                          setEditingMenuItem({
                            id: `item_${Date.now()}`,
                            name: '',
                            categoryId: defaultFoodCat?.id || 'cat_mains',
                            categoryName: defaultFoodCat?.name || 'Hearth & Earth Plates',
                            description: '',
                            priceLkr: 2400,
                            priceUsd: 8.0,
                            imageUrl: '',
                            dietaryTags: ['Signature'],
                            isFeatured: true,
                            isAvailable: true,
                          });
                          menuEditorRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                          });
                        }}
                        className="px-3.5 py-2 bg-[#C65B2B] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> New Food Dish
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const defaultDrinkCat = drinkCategories[0] || menuCategories[0];
                          setEditingMenuItem({
                            id: `item_${Date.now()}`,
                            name: '',
                            categoryId: defaultDrinkCat?.id || 'cat_coffee',
                            categoryName:
                              defaultDrinkCat?.name || 'Specialty Coffee & Botanicals',
                            description: '',
                            priceLkr: 1450,
                            priceUsd: 4.8,
                            imageUrl: '',
                            dietaryTags: ['Signature'],
                            isFeatured: true,
                            isAvailable: true,
                          });
                          menuEditorRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                          });
                        }}
                        className="px-3.5 py-2 bg-[#171513] text-[#F8F4EE] hover:bg-[#2F2A26] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> New Drink
                      </button>
                    </div>
                  </div>

                  {/* Category & Search Filter Controls for Items */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1 pb-2 border-b border-[#E7DED3]">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-[#171513]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search dishes, drinks, or dietary tags..."
                        value={menuItemSearch}
                        onChange={(e) => setMenuItemSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#F8F4EE] border border-[#E7DED3] text-xs focus:outline-none focus:border-[#C65B2B]"
                      />
                    </div>
                    <select
                      aria-label="Filter items by category"
                      value={menuCategoryFilter}
                      onChange={(e) => setMenuCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 bg-[#F8F4EE] border border-[#E7DED3] text-xs focus:outline-none focus:border-[#C65B2B]"
                    >
                      <option value="all">
                        All{' '}
                        {menuSectionFilter === 'food'
                          ? 'Food'
                          : menuSectionFilter === 'drinks'
                          ? 'Drinks'
                          : ''}{' '}
                        Categories
                      </option>
                      {visibleAdminCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="divide-y divide-[#E7DED3] text-xs">
                    {visibleAdminMenuItems.length === 0 ? (
                      <div className="py-10 text-center text-[#171513]/60">
                        No menu items match the active section or search filter.
                      </div>
                    ) : (
                      visibleAdminMenuItems.map((item) => {
                        const isCurrentlyEditing = editingMenuItem?.id === item.id;
                        const itemSection = resolveMenuItemSection(item, menuCategories);
                        const effectiveCurrency: MenuCurrencyDisplay =
                          item.priceCurrency && item.priceCurrency !== 'default'
                            ? item.priceCurrency
                            : settings.menuCurrencyDisplay || 'both';
                        return (
                          <div
                            key={item.id}
                            className={`py-3.5 px-2 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                              isCurrentlyEditing
                                ? 'bg-[#FDF3EF] border-l-4 border-[#C65B2B]'
                                : ''
                            }`}
                          >
                            <div className="flex items-start gap-3.5 max-w-md">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-sm text-[#171513]">
                                    {item.name}
                                  </span>
                                  <span
                                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border font-semibold ${
                                      itemSection === 'drinks'
                                        ? 'border-[#171513]/30 text-[#171513] bg-[#F8F4EE]'
                                        : 'border-[#C65B2B]/40 text-[#C65B2B] bg-[#FDF3EF]'
                                    }`}
                                  >
                                    {itemSection === 'drinks' ? 'Drinks' : 'Food'}
                                  </span>
                                </div>
                                <div className="text-[#171513]/60 flex flex-wrap items-center gap-1.5">
                                  <span>{item.categoryName}</span>
                                  <span>·</span>
                                  <span className="font-mono-tabular text-[#171513]">
                                    LKR {item.priceLkr.toLocaleString()}
                                  </span>
                                  <span>/</span>
                                  <span className="font-mono-tabular text-[#171513]">
                                    USD ${item.priceUsd.toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#C65B2B] font-semibold">
                                  Showing on Menu:{' '}
                                  {effectiveCurrency === 'lkr'
                                    ? `LKR ${item.priceLkr.toLocaleString()} Only`
                                    : effectiveCurrency === 'usd'
                                    ? `USD $${item.priceUsd.toFixed(2)} Only`
                                    : `LKR ${item.priceLkr.toLocaleString()} & USD $${item.priceUsd.toFixed(2)}`}
                                </div>
                                {item.dietaryTags.length > 0 && (
                                  <div className="text-[10px] text-[#58644E]">
                                    {item.dietaryTags.join(' · ')}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* Per-Item Currency Selector right on row */}
                              <select
                                aria-label={`Price currency display for ${item.name}`}
                                value={item.priceCurrency || 'default'}
                                onChange={async (e) => {
                                  const nextCurrency = e.target.value as MenuItemCurrencyOption;
                                  const updated = { ...item, priceCurrency: nextCurrency };
                                  await saveMenuItem(updated);
                                  if (editingMenuItem?.id === item.id) {
                                    setEditingMenuItem(updated);
                                  }
                                  showToast(
                                    `Updated "${item.name}" price display to ${
                                      nextCurrency === 'default'
                                        ? `Global Default (${(
                                            settings.menuCurrencyDisplay || 'both'
                                          ).toUpperCase()})`
                                        : nextCurrency.toUpperCase()
                                    }.`
                                  );
                                }}
                                className="px-2.5 py-1.5 border border-[#E7DED3] bg-[#F8F4EE] text-[#171513] font-medium text-xs focus:outline-none focus:border-[#C65B2B]"
                              >
                                <option value="default">
                                  Currency: Global (
                                  {(settings.menuCurrencyDisplay || 'both').toUpperCase()})
                                </option>
                                <option value="both">Show Both (LKR &amp; USD)</option>
                                <option value="lkr">Show LKR Only</option>
                                <option value="usd">Show USD Only</option>
                              </select>

                              {/* 1-Click Featured on Home Toggle */}
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextFeatured = !item.isFeatured;
                                  await saveMenuItem({ ...item, isFeatured: nextFeatured });
                                  if (editingMenuItem?.id === item.id) {
                                    setEditingMenuItem({
                                      ...editingMenuItem,
                                      isFeatured: nextFeatured,
                                    });
                                  }
                                  showToast(
                                    `${nextFeatured ? 'Featured' : 'Unfeatured'} "${item.name}" on Home Page.`
                                  );
                                }}
                                className={`px-2.5 py-1.5 border font-medium cursor-pointer ${
                                  item.isFeatured
                                    ? 'border-[#C65B2B] text-[#C65B2B] bg-[#FDF3EF]'
                                    : 'border-[#E7DED3] text-[#171513]/60 bg-white hover:border-[#171513]'
                                }`}
                              >
                                {item.isFeatured ? '★ Featured' : 'Standard'}
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  const nextAvail = !item.isAvailable;
                                  await saveMenuItem({ ...item, isAvailable: nextAvail });
                                  if (editingMenuItem?.id === item.id) {
                                    setEditingMenuItem({
                                      ...editingMenuItem,
                                      isAvailable: nextAvail,
                                    });
                                  }
                                  showToast(
                                    `Marked "${item.name}" as ${
                                      nextAvail ? 'Available' : 'Sold Out'
                                    }.`
                                  );
                                }}
                                className={`px-2.5 py-1.5 border font-medium cursor-pointer ${
                                  item.isAvailable
                                    ? 'border-[#58644E] text-[#58644E] bg-[#F8F4EE]'
                                    : 'border-[#E7DED3] text-[#171513]/40 bg-white'
                                }`}
                              >
                                {item.isAvailable ? 'Available' : 'Sold Out'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMenuItem({ ...item });
                                  menuEditorRef.current?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest',
                                  });
                                  showToast(`Editing "${item.name}" in the editor panel.`);
                                }}
                                className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" /> Edit Price &amp; Details
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  const removedName = item.name;
                                  if (editingMenuItem?.id === item.id) {
                                    setEditingMenuItem(null);
                                  }
                                  await deleteMenuItem(item.id);
                                  showToast(`Deleted "${removedName}" from menu.`);
                                }}
                                className="px-3 py-1.5 border border-[#E7DED3] text-[#9E3F16] hover:bg-[#FDF3EF] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Menu Item Form */}
                <div
                  ref={menuEditorRef}
                  className="bg-white border border-[#E7DED3] p-6 space-y-4 self-start sticky top-6"
                >
                  <div className="flex items-center justify-between border-b border-[#E7DED3] pb-2">
                    <h3 className="text-lg font-editorial font-semibold">
                      {editingMenuItem
                        ? editingMenuItem.name
                          ? `Edit: ${editingMenuItem.name}`
                          : 'New Dish / Drink'
                        : 'Dish / Drink Editor'}
                    </h3>
                    {editingMenuItem && (
                      <button
                        type="button"
                        onClick={() => setEditingMenuItem(null)}
                        className="text-xs text-[#171513]/50 hover:text-[#171513] cursor-pointer"
                      >
                        Close
                      </button>
                    )}
                  </div>

                  {!editingMenuItem ? (
                    <div className="py-6 text-xs text-[#171513]/60 space-y-3">
                      <p>
                        Select <strong>Edit Price &amp; Details</strong> next to any food or drink
                        item on the left to modify its details, category, dietary tags, or price, or
                        create a new item below.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const defaultFoodCat = foodCategories[0] || menuCategories[0];
                            setEditingMenuItem({
                              id: `item_${Date.now()}`,
                              name: '',
                              categoryId: defaultFoodCat?.id || 'cat_mains',
                              categoryName: defaultFoodCat?.name || 'Hearth & Earth Plates',
                              description: '',
                              priceLkr: 2400,
                              priceUsd: 8.0,
                              imageUrl: '',
                              dietaryTags: ['Signature'],
                              isFeatured: true,
                              isAvailable: true,
                            });
                          }}
                          className="px-4 py-2 bg-[#C65B2B] text-white uppercase tracking-wider font-medium inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> New Food Dish
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const defaultDrinkCat = drinkCategories[0] || menuCategories[0];
                            setEditingMenuItem({
                              id: `item_${Date.now()}`,
                              name: '',
                              categoryId: defaultDrinkCat?.id || 'cat_coffee',
                              categoryName:
                                defaultDrinkCat?.name || 'Specialty Coffee & Botanicals',
                              description: '',
                              priceLkr: 1450,
                              priceUsd: 4.8,
                              imageUrl: '',
                              dietaryTags: ['Signature'],
                              isFeatured: true,
                              isAvailable: true,
                            });
                          }}
                          className="px-4 py-2 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider font-medium inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> New Drink
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          await saveMenuItem(editingMenuItem);
                          showToast(`Saved "${editingMenuItem.name}" to live site.`);
                          setEditingMenuItem(null);
                        } catch (err) {
                          console.error('Save menu item failed:', err);
                          showToast('Could not save menu item to Firestore. Please verify your admin sign-in and try again.');
                        }
                      }}
                      className="space-y-3.5 text-xs"
                    >
                      <div>
                        <label className="block text-[#171513]/60 mb-1">Dish / Drink Name *</label>
                        <input
                          type="text"
                          required
                          value={editingMenuItem.name}
                          onChange={(e) =>
                            setEditingMenuItem({ ...editingMenuItem, name: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                      </div>

                      <div>
                        <label className="block text-[#171513]/60 mb-1">
                          Section &amp; Category
                        </label>
                        <select
                          value={editingMenuItem.categoryId}
                          onChange={(e) => {
                            const cat = menuCategories.find((c) => c.id === e.target.value);
                            if (cat) {
                              setEditingMenuItem({
                                ...editingMenuItem,
                                categoryId: cat.id,
                                categoryName: cat.name,
                              });
                            }
                          }}
                          className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                        >
                          {foodCategories.length > 0 && (
                            <optgroup label="Food Selections">
                              {foodCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {drinkCategories.length > 0 && (
                            <optgroup label="Drinks & Coffee">
                              {drinkCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      <div className="p-3 bg-[#F8F4EE] border border-[#E7DED3] space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block font-semibold text-[#171513]">
                            Price &amp; Currency Display
                          </label>
                          <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#C65B2B]">
                            USD / LKR
                          </span>
                        </div>

                        <div>
                          <label className="block text-[#171513]/60 mb-1">
                            Show Price On Menu In
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(
                              [
                                {
                                  id: 'default',
                                  label: `Global (${(
                                    settings.menuCurrencyDisplay || 'both'
                                  ).toUpperCase()})`,
                                },
                                { id: 'both', label: 'Both LKR & USD' },
                                { id: 'lkr', label: 'LKR Only (Rs.)' },
                                { id: 'usd', label: 'USD Only ($)' },
                              ] as { id: MenuItemCurrencyOption; label: string }[]
                            ).map((opt) => {
                              const activeOpt = editingMenuItem.priceCurrency || 'default';
                              const isSelected = activeOpt === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    setEditingMenuItem({
                                      ...editingMenuItem,
                                      priceCurrency: opt.id,
                                    })
                                  }
                                  className={`px-2.5 py-1.5 text-[11px] font-medium border transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#171513] text-[#F8F4EE] border-[#171513]'
                                      : 'bg-white text-[#171513]/75 border-[#E7DED3] hover:border-[#171513]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[#171513]/60 mb-1">Price (LKR)</label>
                            <input
                              type="number"
                              min={0}
                              step="10"
                              required
                              value={editingMenuItem.priceLkr}
                              onChange={(e) =>
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  priceLkr: Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-[#E7DED3] font-mono-tabular"
                            />
                          </div>
                          <div>
                            <label className="block text-[#171513]/60 mb-1">Price (USD $)</label>
                            <input
                              type="number"
                              min={0}
                              step="0.05"
                              required
                              value={editingMenuItem.priceUsd}
                              onChange={(e) =>
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  priceUsd: Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-[#E7DED3] font-mono-tabular"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#171513]/60 mb-1">
                          Editorial Description
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Describe ingredients, origin, and preparation..."
                          value={editingMenuItem.description}
                          onChange={(e) =>
                            setEditingMenuItem({
                              ...editingMenuItem,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                      </div>

                      {/* Dietary & Filter Tags Editor */}
                      <div className="p-3 bg-[#F8F4EE] border border-[#E7DED3] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block font-semibold text-[#171513]">
                            Dietary &amp; Menu Filter Tags
                          </label>
                          <span className="text-[10px] text-[#171513]/55">
                            Powers [V] [VG] [GF] [SF] &amp; Filters
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_DIETARY_TAGS.map((tag) => {
                            const selected = (editingMenuItem.dietaryTags || []).some(
                              (t) => t.toLowerCase() === tag.toLowerCase()
                            );
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const existing = editingMenuItem.dietaryTags || [];
                                  const nextTags = selected
                                    ? existing.filter(
                                        (t) => t.toLowerCase() !== tag.toLowerCase()
                                      )
                                    : [...existing, tag].slice(0, 10);
                                  setEditingMenuItem({
                                    ...editingMenuItem,
                                    dietaryTags: nextTags,
                                  });
                                }}
                                className={`px-2 py-1 text-[11px] border transition-colors cursor-pointer ${
                                  selected
                                    ? 'bg-[#171513] text-[#F8F4EE] border-[#171513]'
                                    : 'bg-white text-[#171513]/75 border-[#E7DED3] hover:border-[#171513]'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            placeholder="Add custom tag (e.g. Organic)..."
                            value={customDietaryTag}
                            onChange={(e) => setCustomDietaryTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = customDietaryTag.trim();
                                if (!trimmed) return;
                                const existing = editingMenuItem.dietaryTags || [];
                                if (
                                  !existing.some(
                                    (t) => t.toLowerCase() === trimmed.toLowerCase()
                                  )
                                ) {
                                  setEditingMenuItem({
                                    ...editingMenuItem,
                                    dietaryTags: [...existing, trimmed].slice(0, 10),
                                  });
                                }
                                setCustomDietaryTag('');
                              }
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-[#E7DED3] text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = customDietaryTag.trim();
                              if (!trimmed) return;
                              const existing = editingMenuItem.dietaryTags || [];
                              if (
                                !existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())
                              ) {
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  dietaryTags: [...existing, trimmed].slice(0, 10),
                                });
                              }
                              setCustomDietaryTag('');
                            }}
                            className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] text-xs font-medium cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                        {(editingMenuItem.dietaryTags || []).length > 0 && (
                          <div className="text-[11px] text-[#58644E] pt-0.5">
                            Active: {(editingMenuItem.dietaryTags || []).join(' · ')}
                          </div>
                        )}
                      </div>

                      {/* Optional Dish / Drink Photo Upload (Cloudflare R2) */}
                      <div className="p-3 bg-[#F8F4EE] border border-[#E7DED3] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block font-semibold text-[#171513]">
                            Optional Dish / Drink Photo (Cloudflare R2)
                          </label>
                          {editingMenuItem.imageUrl && (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = { ...editingMenuItem, imageUrl: '' };
                                setEditingMenuItem(updated);
                                if (menuItems.some((m) => m.id === updated.id)) {
                                  await saveMenuItem(updated);
                                  showToast(`Removed photo from "${updated.name}".`);
                                }
                              }}
                              className="text-[11px] text-[#9E3F16] hover:underline cursor-pointer"
                            >
                              Remove Photo
                            </button>
                          )}
                        </div>
                        {editingMenuItem.imageUrl && (
                          <div className="aspect-[16/10] w-full bg-white border border-[#E7DED3] overflow-hidden">
                            <EditorialVisual
                              src={editingMenuItem.imageUrl}
                              alt={editingMenuItem.name || 'Dish preview'}
                            />
                          </div>
                        )}
                        <label className="w-full py-2 px-3 bg-white border border-[#E7DED3] hover:border-[#171513] text-[#171513] text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-[#C65B2B]" />
                          <span>
                            {editingMenuItem.imageUrl ? 'Replace Photo in R2' : 'Upload Photo to R2'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              try {
                                showToast('Uploading menu photo to Cloudflare R2...');
                                const r2Url = await uploadMediaFile(
                                  file,
                                  'menu',
                                  editingMenuItem.imageUrl
                                );
                                const updated = { ...editingMenuItem, imageUrl: r2Url };
                                setEditingMenuItem(updated);
                                if (
                                  menuItems.some((m) => m.id === updated.id) &&
                                  updated.name.trim()
                                ) {
                                  await saveMenuItem(updated);
                                  showToast(`Uploaded & saved photo for "${updated.name}".`);
                                } else {
                                  showToast('Photo uploaded to R2. Click Save Item to finish.');
                                }
                              } catch (err) {
                                showToast(
                                  err instanceof Error
                                    ? err.message
                                    : 'Could not upload menu photo to R2.'
                                );
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-5 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingMenuItem.isFeatured}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                isFeatured: e.target.checked,
                              })
                            }
                          />
                          <span>Featured Highlight</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingMenuItem.isAvailable}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                isAvailable: e.target.checked,
                              })
                            }
                          />
                          <span>Available</span>
                        </label>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-[#C65B2B] text-white uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors cursor-pointer"
                        >
                          Save Item to Firestore
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: GALLERY MANAGER */}
          {activeTab === 'gallery' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-[#E7DED3] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-editorial font-semibold">
                      Gallery Curations ({gallery.length})
                    </h2>
                    <p className="text-xs text-[#171513]/60">
                      First 6 featured photos populate the Home Page “Life Beneath the Rock” 3×2
                      gallery grid; all photos appear on /gallery. Stored directly in Cloudflare R2
                      (cdn.onelovecafesigiriya.com).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3.5 py-2 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingBatchGallery
                          ? 'Uploading Photos to R2...'
                          : '+ Upload Photos to R2'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          setUploadingBatchGallery(true);
                          try {
                            let addedCount = 0;
                            for (let i = 0; i < files.length; i++) {
                              const f = files[i];
                              const r2Url = await uploadMediaFile(f, 'gallery');
                              const cleanTitle = f.name
                                .replace(/\.[^.]+$/, '')
                                .replace(/[-_]+/g, ' ')
                                .trim();
                              await saveGalleryItem({
                                id: `gal_${Date.now()}_${i}`,
                                title: cleanTitle || `Sanctuary Moment ${gallery.length + i + 1}`,
                                category: 'Architecture',
                                caption: 'OneLove Café Sigiriya sanctuary archive.',
                                imageUrl: r2Url,
                                aspectRatio: '4:3',
                                isFeatured: true,
                                sortOrder: 0,
                              });
                              addedCount++;
                            }
                            showToast(
                              `Uploaded & added ${addedCount} gallery photo(s) to live site.`
                            );
                          } catch (err) {
                            console.error('Batch gallery upload failed:', err);
                            showToast('Could not upload gallery photos. Please verify your admin sign-in and try again.');
                          } finally {
                            setUploadingBatchGallery(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGalleryItem({
                          id: `gal_${Date.now()}`,
                          title: '',
                          category: 'Architecture',
                          caption: '',
                          imageUrl: '',
                          aspectRatio: '4:3',
                          isFeatured: true,
                          sortOrder: 0,
                        });
                        galleryEditorRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'nearest',
                        });
                      }}
                      className="px-3.5 py-2 bg-[#C65B2B] text-white text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Gallery Form
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-[#E7DED3] text-xs">
                  {gallery.map((g) => (
                    <div
                      key={g.id}
                      className={`py-3.5 px-2 flex flex-wrap items-center justify-between gap-4 ${
                        editingGalleryItem?.id === g.id
                          ? 'bg-[#FDF3EF] border-l-4 border-[#C65B2B]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5 max-w-md">
                        <div className="w-16 h-12 border border-[#E7DED3] overflow-hidden shrink-0 bg-[#F8F4EE]">
                          <EditorialVisual src={g.imageUrl} alt={g.title} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{g.title}</div>
                          <div className="text-[#171513]/60">
                            {g.category} · {g.caption}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <label className="px-2.5 py-1.5 border border-[#E7DED3] bg-[#F8F4EE] hover:border-[#171513] cursor-pointer inline-flex items-center gap-1 font-medium">
                          <Upload className="w-3 h-3 text-[#C65B2B]" />
                          <span>
                            {uploadingGalleryRowId === g.id ? 'Uploading...' : 'Replace Photo'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingGalleryRowId(g.id);
                              try {
                                const r2Url = await uploadMediaFile(file, 'gallery', g.imageUrl);
                                const updated = { ...g, imageUrl: r2Url };
                                await saveGalleryItem(updated);
                                if (editingGalleryItem?.id === g.id) {
                                  setEditingGalleryItem(updated);
                                }
                                showToast(
                                  `Uploaded & replaced photo for "${g.title}" in Cloudflare R2.`
                                );
                              } finally {
                                setUploadingGalleryRowId(null);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGalleryItem({ ...g });
                            galleryEditorRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }}
                          className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] inline-flex items-center gap-1 font-medium"
                        >
                          <Edit3 className="w-3 h-3" /> Edit Details
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (editingGalleryItem?.id === g.id) {
                              setEditingGalleryItem(null);
                            }
                            await deleteGalleryItem(g.id);
                            showToast(`Removed "${g.title}" from gallery & Cloudflare R2.`);
                          }}
                          className="px-3 py-1.5 border border-[#E7DED3] text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                ref={galleryEditorRef}
                className="bg-white border border-[#E7DED3] p-6 space-y-4 self-start sticky top-6"
              >
                <div className="flex items-center justify-between border-b border-[#E7DED3] pb-2">
                  <h3 className="text-lg font-editorial font-semibold">
                    {editingGalleryItem
                      ? editingGalleryItem.title
                        ? `Edit: ${editingGalleryItem.title}`
                        : 'Add Gallery Photograph'
                      : 'Gallery Photo Editor'}
                  </h3>
                  {editingGalleryItem && (
                    <button
                      type="button"
                      onClick={() => setEditingGalleryItem(null)}
                      className="text-xs text-[#171513]/50 hover:text-[#171513]"
                    >
                      Close
                    </button>
                  )}
                </div>

                {!editingGalleryItem ? (
                  <div className="py-4 text-xs text-[#171513]/60 space-y-3">
                    <p>
                      Click <strong>Edit / Replace Photo</strong> on any gallery item or click below
                      to upload a new photograph from your device.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingGalleryItem({
                          id: `gal_${Date.now()}`,
                          title: '',
                          category: 'Architecture',
                          caption: '',
                          imageUrl: '',
                          aspectRatio: '4:3',
                          isFeatured: true,
                          sortOrder: 0,
                        })
                      }
                      className="px-4 py-2 bg-[#C65B2B] text-white uppercase tracking-wider font-medium inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Gallery Photo
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await saveGalleryItem(editingGalleryItem);
                        showToast(`Saved "${editingGalleryItem.title}" to live site.`);
                        setEditingGalleryItem(null);
                      } catch (err) {
                        console.error('Save gallery item failed:', err);
                        showToast('Could not save gallery photo to Firestore. Please verify your admin sign-in and try again.');
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block text-[#171513]/60 mb-1">Photograph Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="Photograph Title"
                        value={editingGalleryItem.title}
                        onChange={(e) =>
                          setEditingGalleryItem({ ...editingGalleryItem, title: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#171513]/60 mb-1">Category</label>
                      <select
                        value={editingGalleryItem.category}
                        onChange={(e) =>
                          setEditingGalleryItem({
                            ...editingGalleryItem,
                            category: e.target.value as GalleryItem['category'],
                          })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      >
                        <option value="Architecture">Architecture</option>
                        <option value="Culinary">Culinary</option>
                        <option value="Coffee & Botanicals">Coffee &amp; Botanicals</option>
                        <option value="Evening Sanctuary">Evening Sanctuary</option>
                        <option value="Sigiriya Surroundings">Sigiriya Surroundings</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#171513]/60 mb-1">Editorial Caption (Optional)</label>
                      <textarea
                        rows={2}
                        placeholder="Editorial caption..."
                        value={editingGalleryItem.caption}
                        onChange={(e) =>
                          setEditingGalleryItem({ ...editingGalleryItem, caption: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>

                    {/* Image Upload / Replace / Remove */}
                    <div className="space-y-2 border border-[#E7DED3] p-3 bg-[#F8F4EE]/60">
                      <label className="block font-semibold text-[#171513]">
                        Photograph Image (Stored in Cloudflare R2)
                      </label>
                      <div className="aspect-[4/3] w-full border border-[#E7DED3] overflow-hidden bg-white">
                        <EditorialVisual
                          src={editingGalleryItem.imageUrl}
                          alt={editingGalleryItem.title || 'Gallery preview'}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#171513] text-[#F8F4EE] cursor-pointer hover:bg-[#C65B2B] font-medium">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {uploadingGalleryImg
                              ? 'Uploading to R2...'
                              : 'Upload / Replace in R2'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingGalleryImg(true);
                              try {
                                const r2Url = await uploadMediaFile(
                                  file,
                                  'gallery',
                                  editingGalleryItem.imageUrl
                                );
                                const updatedGallery = {
                                  ...editingGalleryItem,
                                  imageUrl: r2Url,
                                };
                                setEditingGalleryItem(updatedGallery);
                                if (
                                  gallery.some((g) => g.id === updatedGallery.id) ||
                                  updatedGallery.title.trim().length > 0
                                ) {
                                  await saveGalleryItem(updatedGallery);
                                  showToast(
                                    `Uploaded & saved gallery photo "${
                                      updatedGallery.title || 'Sanctuary Moment'
                                    }" directly to Cloudflare R2.`
                                  );
                                } else {
                                  showToast(
                                    'Gallery image uploaded to Cloudflare R2. Enter title and click Save.'
                                  );
                                }
                              } finally {
                                setUploadingGalleryImg(false);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            const updatedGallery = { ...editingGalleryItem, imageUrl: '' };
                            setEditingGalleryItem(updatedGallery);
                            if (gallery.some((g) => g.id === updatedGallery.id)) {
                              await saveGalleryItem(updatedGallery);
                              showToast('Removed gallery photo from Cloudflare R2.');
                            }
                          }}
                          className="px-3 py-2 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#C65B2B] text-white uppercase tracking-wider font-medium"
                    >
                      Save Gallery Photo to Cloudflare R2
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: EVENTS & EXPERIENCES MANAGER */}
          {activeTab === 'events' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-[#E7DED3] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-editorial font-semibold">
                    Sanctuary Events &amp; Gatherings ({events.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEvent({
                        id: `evt_${Date.now()}`,
                        title: '',
                        subtitle: '',
                        date: 'Every Friday',
                        time: '18:30 – 21:30',
                        category: 'Evening Ritual',
                        description: '',
                        imageUrl: '',
                        priceInfo: 'Complimentary with Table Reservation',
                        isFeatured: true,
                        isActive: true,
                      });
                      eventEditorRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      });
                    }}
                    className="px-3.5 py-2 bg-[#C65B2B] text-white text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Event
                  </button>
                </div>
                <div className="divide-y divide-[#E7DED3] text-xs">
                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className={`py-3.5 px-2 flex flex-wrap items-center justify-between gap-4 ${
                        editingEvent?.id === evt.id
                          ? 'bg-[#FDF3EF] border-l-4 border-[#C65B2B]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5 max-w-md">
                        <div className="w-16 h-12 border border-[#E7DED3] overflow-hidden shrink-0 bg-[#F8F4EE]">
                          <EditorialVisual src={evt.imageUrl} alt={evt.title} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{evt.title}</div>
                          <div className="text-[#171513]/60">
                            {evt.date} · {evt.time} · {evt.priceInfo}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <label className="px-2.5 py-1.5 border border-[#E7DED3] bg-[#F8F4EE] hover:border-[#171513] cursor-pointer inline-flex items-center gap-1 font-medium">
                          <Upload className="w-3 h-3 text-[#C65B2B]" />
                          <span>
                            {uploadingEventRowId === evt.id ? 'Uploading...' : 'Replace Photo'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingEventRowId(evt.id);
                              try {
                                const r2Url = await uploadMediaFile(file, 'events', evt.imageUrl);
                                const updated = { ...evt, imageUrl: r2Url };
                                await saveEvent(updated);
                                if (editingEvent?.id === evt.id) {
                                  setEditingEvent(updated);
                                }
                                showToast(
                                  `Uploaded & saved photo for "${evt.title}" in Cloudflare R2.`
                                );
                              } finally {
                                setUploadingEventRowId(null);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                        {evt.imageUrl && evt.imageUrl.startsWith('http') && (
                          <button
                            type="button"
                            onClick={async () => {
                              const updated = { ...evt, imageUrl: '' };
                              await saveEvent(updated);
                              if (editingEvent?.id === evt.id) {
                                setEditingEvent(updated);
                              }
                              showToast(`Reset photo for "${evt.title}" in Cloudflare R2.`);
                            }}
                            className="px-2.5 py-1.5 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1 font-medium"
                          >
                            <RefreshCw className="w-3 h-3" /> Reset Photo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEvent({ ...evt });
                            eventEditorRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }}
                          className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] inline-flex items-center gap-1 font-medium"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (editingEvent?.id === evt.id) {
                              setEditingEvent(null);
                            }
                            await deleteEvent(evt.id);
                            showToast(`Deleted event "${evt.title}".`);
                          }}
                          className="px-3 py-1.5 border border-[#E7DED3] text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                ref={eventEditorRef}
                className="bg-white border border-[#E7DED3] p-6 space-y-4 self-start sticky top-6"
              >
                <div className="flex items-center justify-between border-b border-[#E7DED3] pb-2">
                  <h3 className="text-lg font-editorial font-semibold">
                    {editingEvent ? 'Edit Event & Image' : 'Select or Create an Event'}
                  </h3>
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={() => setEditingEvent(null)}
                      className="text-xs text-[#171513]/50 hover:text-[#171513]"
                    >
                      Close
                    </button>
                  )}
                </div>
                {editingEvent && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await saveEvent(editingEvent);
                        setEditingEvent(null);
                        showToast('Event saved to live site.');
                      } catch (err) {
                        console.error('Save event failed:', err);
                        showToast('Could not save event to Firestore. Please verify your admin sign-in and try again.');
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Event Title"
                      value={editingEvent.title}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, title: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                    />
                    <input
                      type="text"
                      placeholder="Subtitle (Optional)"
                      value={editingEvent.subtitle}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, subtitle: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Date / Cadence"
                        value={editingEvent.date}
                        onChange={(e) =>
                          setEditingEvent({ ...editingEvent, date: e.target.value })
                        }
                        className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Time"
                        value={editingEvent.time}
                        onChange={(e) =>
                          setEditingEvent({ ...editingEvent, time: e.target.value })
                        }
                        className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Description (Optional)..."
                      value={editingEvent.description}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, description: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                    />
                    <input
                      type="text"
                      placeholder="Price Info"
                      value={editingEvent.priceInfo}
                      onChange={(e) =>
                        setEditingEvent({ ...editingEvent, priceInfo: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                    />

                    {/* Event Image Upload / Replace / Remove */}
                    <div className="space-y-2 border border-[#E7DED3] p-3 bg-[#F8F4EE]/60">
                      <label className="block font-semibold text-[#171513]">
                        Event Image (Stored in Cloudflare R2)
                      </label>
                      <div className="aspect-[16/9] w-full border border-[#E7DED3] overflow-hidden bg-white">
                        <EditorialVisual
                          src={editingEvent.imageUrl}
                          alt={editingEvent.title || 'Event preview'}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#171513] text-[#F8F4EE] cursor-pointer hover:bg-[#C65B2B] font-medium">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {uploadingEventImg
                              ? 'Uploading to R2...'
                              : 'Upload / Replace in R2'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingEventImg(true);
                              try {
                                const r2Url = await uploadMediaFile(
                                  file,
                                  'events',
                                  editingEvent.imageUrl
                                );
                                const updatedEvent = { ...editingEvent, imageUrl: r2Url };
                                setEditingEvent(updatedEvent);
                                if (
                                  events.some((ev) => ev.id === updatedEvent.id) ||
                                  updatedEvent.title.trim().length > 0
                                ) {
                                  await saveEvent(updatedEvent);
                                  showToast(
                                    `Uploaded & saved event photo for "${
                                      updatedEvent.title || 'Sanctuary Gathering'
                                    }" directly to Cloudflare R2.`
                                  );
                                } else {
                                  showToast(
                                    'Event image uploaded to Cloudflare R2. Enter title and click Save.'
                                  );
                                }
                              } finally {
                                setUploadingEventImg(false);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            const updatedEvent = { ...editingEvent, imageUrl: '' };
                            setEditingEvent(updatedEvent);
                            if (events.some((ev) => ev.id === updatedEvent.id)) {
                              await saveEvent(updatedEvent);
                              showToast('Removed event photo from Cloudflare R2.');
                            }
                          }}
                          className="px-3 py-2 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#C65B2B] text-white uppercase tracking-wider font-medium"
                    >
                      Save Event &amp; Sync R2 Media
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: HERO SLIDESHOW, SITE CONTENT & MASTER IMAGE AUDIT */}
          {activeTab === 'content' && (
            <div className="space-y-8">
              {/* Hero Background Slideshow Manager */}
              {renderHeroSlideshowManager()}

              {/* Our Story Section — 2 Overlapping Rounded Photos Manager */}
              <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED3] pb-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Our Story Section · 2 Overlapping Rounded Photos
                    </div>
                    <h2 className="text-xl font-editorial font-semibold text-[#171513] mt-0.5">
                      Our Story Photography (Home Page &amp; /story)
                    </h2>
                    <p className="text-xs text-[#171513]/65">
                      Upload custom photographs for the primary right-side vertical frame and the
                      overlapping bottom-left inset photo in the Our Story section.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
                  {[
                    {
                      index: 1,
                      key: 'story_collage_1',
                      label: '01 · Main Right Feature Photo (4:5 Vertical)',
                      title: 'Open-Air Pavilion & Teak Dining Sanctuary',
                      defaultSrc:
                        'https://cdn.onelovecafesigiriya.com/collage/1793182269079-wp11877848-cozy-rain-wallpapers.webp',
                    },
                    {
                      index: 2,
                      key: 'story_collage_2',
                      label: '02 · Overlapping Inset Photo (1:1 Square)',
                      title: 'Sanctuary Interior & Natural Light',
                      defaultSrc:
                        'https://cdn.onelovecafesigiriya.com/collage/1793182271989-wp2352856-coffee-shop-wallpapers.webp',
                    },
                  ].map((slot) => {
                    const sec = siteContent.find((s) => s.sectionKey === slot.key);
                    const currentSrc =
                      sec?.imageUrl && /^https?:\/\//i.test(sec.imageUrl.trim())
                        ? sec.imageUrl.trim()
                        : '';
                    const isCustom = Boolean(currentSrc);
                    const isBusy = uploadingCollageSlot === slot.index;

                    return (
                      <div
                        key={slot.index}
                        className="bg-[#F8F4EE] border border-[#E7DED3] p-4 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#C65B2B] font-semibold">
                            {slot.label}
                          </div>
                          <div className="text-xs font-semibold text-[#171513] truncate">
                            {slot.title}
                          </div>
                          <div className="aspect-[4/3] bg-white border border-[#E7DED3] overflow-hidden">
                            <EditorialVisual src={currentSrc} alt={slot.title} />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <label className="flex-1 py-2 px-2.5 bg-[#171513] hover:bg-[#C65B2B] text-[#F8F4EE] text-[11px] font-medium uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <span>{isBusy ? 'Saving...' : 'Upload Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                setUploadingCollageSlot(slot.index);
                                try {
                                  await updateCollageImageFromDevice(slot.index, file);
                                  showToast(`Updated Our Story photo #${slot.index} (${slot.title}).`);
                                } finally {
                                  setUploadingCollageSlot(null);
                                }
                              }}
                            />
                          </label>

                          {isCustom && (
                            <button
                              type="button"
                              title="Reset to default artwork"
                              onClick={async () => {
                                await resetCollageImage(slot.index);
                                showToast(`Reset Our Story photo #${slot.index} to default.`);
                              }}
                              className="px-2.5 py-2 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Editorial Website Content Sections (Hero, Story, Golden Hour, Atmosphere, Reservation, Find Us, Concierge, Footer) */}
              <div className="space-y-6">
                <h2 className="text-xl font-editorial font-semibold">
                  Home Page &amp; Editorial Section Copy, Footer Copy &amp; Section Photography
                </h2>
                {siteContent
                  .filter(
                    (sec) =>
                      !sec.sectionKey.startsWith('hero_slide_') &&
                      !sec.sectionKey.startsWith('story_collage_') &&
                      sec.sectionKey !== 'menu_gallery_bg'
                  )
                  .map((sec) => {
                  const draft = contentDrafts[sec.id] || contentDrafts[sec.sectionKey] || sec;
                  const isFooterSec = sec.sectionKey === 'footer';
                  const isHeroSec = sec.sectionKey === 'hero';
                  const hasImageUpload =
                    sec.sectionKey === 'story' ||
                    sec.sectionKey === 'golden_hour' ||
                    sec.sectionKey === 'atmosphere' ||
                    sec.sectionKey === 'concierge';

                  return (
                    <div key={sec.id} className="bg-white border border-[#E7DED3] p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7DED3] pb-3">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-semibold">
                            Section Key: {sec.sectionKey}
                          </div>
                          <div className="text-[11px] text-[#171513]/60">
                            {isHeroSec &&
                              'Controls Homepage Hero headline, subheading & body copy. (Hero background photos are managed in the Hero Slideshow above.)'}
                            {sec.sectionKey === 'story' &&
                              'Controls Homepage Our Story heading & narrative + /story Page primary photograph'}
                            {sec.sectionKey === 'golden_hour' &&
                              'Controls Homepage dark "The Golden Hour" culinary feature section copy & left-side photograph'}
                            {sec.sectionKey === 'atmosphere' &&
                              'Controls Homepage warm sand "Atmosphere & Spaces" section copy & right-side framed photograph'}
                            {sec.sectionKey === 'home_reserve' &&
                              'Controls Homepage dark Reservation concierge headline, description & quick-booking card title'}
                            {sec.sectionKey === 'find_us' &&
                              'Controls Homepage "Find Us in Sigiriya" two-card header, trail proximity title & Lion Rock distance'}
                            {sec.sectionKey === 'concierge' &&
                              'Controls /story Page secondary hospitality showcase photograph & copy'}
                            {isFooterSec &&
                              'Controls Footer banner headline, CTA button labels, copyright notice & bottom links'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await saveSiteContent(draft);
                              setContentDrafts((prev) => ({
                                ...prev,
                                [sec.id]: draft,
                                [sec.sectionKey]: draft,
                              }));
                              showToast(`Saved "${sec.sectionKey}" section changes to live site.`);
                            } catch (err) {
                              console.error('Save site content failed:', err);
                              showToast('Could not save section changes to Firestore. Please verify your admin sign-in and try again.');
                            }
                          }}
                          className="px-4 py-2 bg-[#C65B2B] text-white text-xs uppercase tracking-wider font-medium"
                        >
                          Save Section Changes
                        </button>
                      </div>

                      <div
                        className={`text-xs ${
                          hasImageUpload
                            ? 'grid grid-cols-1 lg:grid-cols-3 gap-6'
                            : 'w-full'
                        }`}
                      >
                        <div
                          className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                            hasImageUpload ? 'lg:col-span-2' : 'w-full'
                          }`}
                        >
                          <div>
                            <label className="block text-[#171513]/60 mb-1">
                              {isFooterSec ? 'Primary Footer Button Label' : 'Kicker Line'}
                            </label>
                            <input
                              type="text"
                              value={draft.kicker}
                              onChange={(e) => {
                                const nextDraft = { ...draft, kicker: e.target.value };
                                setContentDrafts({
                                  ...contentDrafts,
                                  [sec.id]: nextDraft,
                                  [sec.sectionKey]: nextDraft,
                                });
                              }}
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#171513]/60 mb-1">
                              {isFooterSec ? 'Footer Banner Headline' : 'Headline'}
                            </label>
                            <input
                              type="text"
                              value={draft.heading}
                              onChange={(e) => {
                                const nextDraft = { ...draft, heading: e.target.value };
                                setContentDrafts({
                                  ...contentDrafts,
                                  [sec.id]: nextDraft,
                                  [sec.sectionKey]: nextDraft,
                                });
                              }}
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[#171513]/60 mb-1">
                              {isFooterSec ? 'Secondary Footer Button Label' : 'Subheading'}
                            </label>
                            <input
                              type="text"
                              value={draft.subheading}
                              onChange={(e) => {
                                const nextDraft = { ...draft, subheading: e.target.value };
                                setContentDrafts({
                                  ...contentDrafts,
                                  [sec.id]: nextDraft,
                                  [sec.sectionKey]: nextDraft,
                                });
                              }}
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[#171513]/60 mb-1">
                              {isFooterSec ? 'Footer Copyright Line' : 'Body Copy'}
                            </label>
                            <textarea
                              rows={isFooterSec ? 2 : 4}
                              value={draft.body}
                              onChange={(e) => {
                                const nextDraft = { ...draft, body: e.target.value };
                                setContentDrafts({
                                  ...contentDrafts,
                                  [sec.id]: nextDraft,
                                  [sec.sectionKey]: nextDraft,
                                });
                              }}
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          {isFooterSec ? (
                            <>
                              <div>
                                <label className="block text-[#171513]/60 mb-1">
                                  Footer Link 1 Label (Directions)
                                </label>
                                <input
                                  type="text"
                                  value={draft.ctaLabel}
                                  onChange={(e) => {
                                    const nextDraft = { ...draft, ctaLabel: e.target.value };
                                    setContentDrafts({
                                      ...contentDrafts,
                                      [sec.id]: nextDraft,
                                      [sec.sectionKey]: nextDraft,
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#171513]/60 mb-1">
                                  Footer Link 2 Label (Admin Console)
                                </label>
                                <input
                                  type="text"
                                  value={draft.ctaLink}
                                  onChange={(e) => {
                                    const nextDraft = { ...draft, ctaLink: e.target.value };
                                    setContentDrafts({
                                      ...contentDrafts,
                                      [sec.id]: nextDraft,
                                      [sec.sectionKey]: nextDraft,
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="sm:col-span-2">
                              <label className="block text-[#171513]/60 mb-1">
                                {sec.sectionKey === 'find_us'
                                  ? 'Distance Highlight Badge (e.g. 1.5 Kilometers)'
                                  : 'Primary Button / CTA Label'}
                              </label>
                              <input
                                type="text"
                                value={draft.ctaLabel}
                                onChange={(e) => {
                                  const nextDraft = { ...draft, ctaLabel: e.target.value };
                                  setContentDrafts({
                                    ...contentDrafts,
                                    [sec.id]: nextDraft,
                                    [sec.sectionKey]: nextDraft,
                                  });
                                }}
                                className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                              />
                            </div>
                          )}
                        </div>

                        {/* Section Image Upload / Replace / Remove for Story, Golden Hour, Atmosphere & Concierge */}
                        {hasImageUpload && (
                          <div className="bg-[#F8F4EE] border border-[#E7DED3] p-4 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="font-semibold text-[#171513]">
                                Section Image (Stored in Cloudflare R2)
                              </div>
                              <div className="aspect-[16/10] w-full bg-white border border-[#E7DED3] overflow-hidden">
                                <EditorialVisual
                                  src={draft.imageUrl}
                                  alt={draft.heading || sec.sectionKey}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#171513] text-[#F8F4EE] cursor-pointer hover:bg-[#C65B2B] font-medium">
                                <Upload className="w-3.5 h-3.5" />
                                <span>
                                  {uploadingSectionId === sec.id
                                    ? 'Uploading to R2...'
                                    : 'Upload / Replace Photo'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingSectionId(sec.id);
                                    try {
                                      const r2Url = await uploadMediaFile(
                                        file,
                                        'content',
                                        draft.imageUrl
                                      );
                                      const updatedSection = { ...draft, imageUrl: r2Url };
                                      setContentDrafts((prev) => ({
                                        ...prev,
                                        [sec.id]: updatedSection,
                                        [sec.sectionKey]: updatedSection,
                                      }));
                                      await saveSiteContent(updatedSection);
                                      showToast(
                                        `Uploaded & saved new image for "${sec.sectionKey}" directly to Cloudflare R2.`
                                      );
                                    } finally {
                                      setUploadingSectionId(null);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={async () => {
                                  const cleared = { ...draft, imageUrl: '' };
                                  setContentDrafts((prev) => ({
                                    ...prev,
                                    [sec.id]: cleared,
                                    [sec.sectionKey]: cleared,
                                  }));
                                  await saveSiteContent(cleared);
                                  showToast(`Removed custom image from "${sec.sectionKey}" in Cloudflare R2.`);
                                }}
                                className="px-3 py-2 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MASTER WEBSITE IMAGE AUDIT & 1-CLICK REPLACER */}
              <div className="bg-white border border-[#E7DED3] p-6 space-y-6">
                <div className="border-b border-[#E7DED3] pb-4">
                  <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                    Complete Site-Wide Visual Audit · 100% Cloudflare R2 Object Storage (cdn.onelovecafesigiriya.com)
                  </div>
                  <h2 className="text-xl font-editorial font-semibold mt-0.5">
                    All Website Images — Instant 1-Click Replace &amp; Remove in R2
                  </h2>
                  <p className="text-xs text-[#171513]/65 mt-0.5">
                    Every single visual rendered across Home, Our Menu, Our Story, Gallery,
                    Experiences, and Interactive Floor Plan is stored in and served from your Cloudflare R2 bucket.
                  </p>
                </div>

                {/* 1. Core Page, Home Showcase & Floor Plan Visuals */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#58644E]">
                    1. Core Page, Home Showcase &amp; Floor Plan Images
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    {/* Floor Plan Drone Shot */}
                    <div className="border border-[#E7DED3] bg-[#F8F4EE] p-3 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="font-semibold text-[#171513]">
                          Interactive Floor Plan Background (Drone Shot)
                        </div>
                        <div className="text-[11px] text-[#171513]/60">
                          Shown on /reserve Interactive Floor Plan Page
                        </div>
                        <div className="aspect-[16/10] bg-white border border-[#E7DED3] overflow-hidden">
                          <EditorialVisual
                            src={settings.floorPlanImageUrl || ''}
                            alt="Floor Plan Background"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex-1 py-1.5 px-2.5 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] cursor-pointer inline-flex items-center justify-center gap-1 font-medium">
                          <Upload className="w-3 h-3" />
                          <span>
                            {uploadingAuditKey === 'floorplan' ? 'Uploading...' : 'Upload Drone Shot'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingAuditKey('floorplan');
                              try {
                                const r2Url = await uploadMediaFile(
                                  file,
                                  'floorplan',
                                  settings.floorPlanImageUrl
                                );
                                await saveSettings({ ...settings, floorPlanImageUrl: r2Url });
                                showToast('Updated Floor Plan Drone Shot in Cloudflare R2.');
                              } finally {
                                setUploadingAuditKey(null);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                        {settings.floorPlanImageUrl && (
                          <button
                            type="button"
                            onClick={async () => {
                              await saveSettings({ ...settings, floorPlanImageUrl: '' });
                              showToast('Deleted Floor Plan Drone Shot from Cloudflare R2.');
                            }}
                            className="px-2.5 py-1.5 border border-[#E7DED3] bg-white text-[#9E3F16]"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Story, Golden Hour, Atmosphere & Concierge Images */}
                    {siteContent
                      .filter(
                        (s) =>
                          s.sectionKey === 'story' ||
                          s.sectionKey === 'golden_hour' ||
                          s.sectionKey === 'atmosphere' ||
                          s.sectionKey === 'concierge'
                      )
                      .map((sec) => (
                        <div
                          key={sec.id}
                          className="border border-[#E7DED3] bg-[#F8F4EE] p-3 flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="font-semibold text-[#171513]">
                              {sec.sectionKey === 'story'
                                ? 'Our Story Primary Image (/story)'
                                : sec.sectionKey === 'golden_hour'
                                ? 'The Golden Hour Culinary Feature (Home)'
                                : sec.sectionKey === 'atmosphere'
                                ? 'Atmosphere & Spaces Feature (Home)'
                                : 'Our Story Secondary Showcase (/story)'}
                            </div>
                            <div className="text-[11px] text-[#171513]/60 truncate">
                              {sec.heading}
                            </div>
                            <div className="aspect-[16/10] bg-white border border-[#E7DED3] overflow-hidden">
                              <EditorialVisual src={sec.imageUrl} alt={sec.heading} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex-1 py-1.5 px-2.5 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] cursor-pointer inline-flex items-center justify-center gap-1 font-medium">
                              <Upload className="w-3 h-3" />
                              <span>
                                {uploadingAuditKey === `sec_${sec.id}`
                                  ? 'Uploading...'
                                  : 'Replace Image'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploadingAuditKey(`sec_${sec.id}`);
                                  try {
                                    const r2Url = await uploadMediaFile(
                                      file,
                                      'content',
                                      sec.imageUrl
                                    );
                                    await saveSiteContent({ ...sec, imageUrl: r2Url });
                                    showToast(`Updated "${sec.sectionKey}" image in Cloudflare R2.`);
                                  } finally {
                                    setUploadingAuditKey(null);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                            {sec.imageUrl && sec.imageUrl.startsWith('http') && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await saveSiteContent({ ...sec, imageUrl: '' });
                                  showToast(`Reset "${sec.sectionKey}" image in Cloudflare R2.`);
                                }}
                                className="px-2.5 py-1.5 border border-[#E7DED3] bg-white text-[#9E3F16]"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* 2. All Gallery & Event Images */}
                <div className="space-y-3 pt-2 border-t border-[#E7DED3]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#58644E]">
                    2. All Gallery ({gallery.length}) &amp; Event ({events.length}) Images
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                    {gallery.map((g) => (
                      <div
                        key={g.id}
                        className="border border-[#E7DED3] bg-[#F8F4EE] p-2.5 flex flex-col justify-between space-y-2"
                      >
                        <div className="space-y-1">
                          <div className="aspect-[4/3] bg-white border border-[#E7DED3] overflow-hidden">
                            <EditorialVisual src={g.imageUrl} alt={g.title} />
                          </div>
                          <div className="font-semibold text-[#171513] truncate">
                            [Gallery] {g.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="flex-1 py-1.5 px-2 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] cursor-pointer inline-flex items-center justify-center gap-1 font-medium">
                            <Upload className="w-3 h-3" />
                            <span>
                              {uploadingAuditKey === `gal_${g.id}` ? 'Uploading...' : 'Replace Photo'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingAuditKey(`gal_${g.id}`);
                                try {
                                  const r2Url = await uploadMediaFile(file, 'gallery', g.imageUrl);
                                  await saveGalleryItem({ ...g, imageUrl: r2Url });
                                  showToast(`Updated gallery photo "${g.title}" in Cloudflare R2.`);
                                } finally {
                                  setUploadingAuditKey(null);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteGalleryItem(g.id);
                              showToast(`Deleted gallery photo "${g.title}" from Cloudflare R2.`);
                            }}
                            className="px-2 py-1.5 border border-[#E7DED3] bg-white text-[#9E3F16]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}

                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="border border-[#E7DED3] bg-[#F8F4EE] p-2.5 flex flex-col justify-between space-y-2"
                      >
                        <div className="space-y-1">
                          <div className="aspect-[4/3] bg-white border border-[#E7DED3] overflow-hidden">
                            <EditorialVisual src={ev.imageUrl} alt={ev.title} />
                          </div>
                          <div className="font-semibold text-[#171513] truncate">
                            [Event] {ev.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="flex-1 py-1.5 px-2 bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B] cursor-pointer inline-flex items-center justify-center gap-1 font-medium">
                            <Upload className="w-3 h-3" />
                            <span>
                              {uploadingAuditKey === `evt_${ev.id}` ? 'Uploading...' : 'Replace Photo'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingAuditKey(`evt_${ev.id}`);
                                try {
                                  const r2Url = await uploadMediaFile(file, 'events', ev.imageUrl);
                                  await saveEvent({ ...ev, imageUrl: r2Url });
                                  showToast(`Updated event photo "${ev.title}" in Cloudflare R2.`);
                                } finally {
                                  setUploadingAuditKey(null);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                          {ev.imageUrl && ev.imageUrl.startsWith('http') && (
                            <button
                              type="button"
                              onClick={async () => {
                                await saveEvent({ ...ev, imageUrl: '' });
                                showToast(`Reset event photo "${ev.title}" in Cloudflare R2.`);
                              }}
                              className="px-2 py-1.5 border border-[#E7DED3] bg-white text-[#9E3F16]"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: GUEST INQUIRIES */}
          {activeTab === 'inquiries' && (
            <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
              <h2 className="text-xl font-editorial font-semibold">
                Concierge &amp; Partnership Inquiries ({inquiries.length})
              </h2>
              {inquiries.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#171513]/50">
                  No customer inquiries submitted yet.
                </div>
              ) : (
                <div className="divide-y divide-[#E7DED3] text-xs">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="py-4 flex flex-wrap items-start justify-between gap-4"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="font-semibold text-sm">
                          {inq.subject} — {inq.name}
                        </div>
                        <div className="text-[#171513]/60 font-mono-tabular">
                          {inq.email} · {inq.phone || 'No phone'}
                        </div>
                        <p className="text-[#171513]/80 pt-1">{inq.message}</p>
                      </div>
                      <select
                        value={inq.status}
                        onChange={async (e) => {
                          await updateInquiryStatus(
                            inq,
                            e.target.value as typeof inq.status
                          );
                          showToast('Inquiry status updated.');
                        }}
                        className="px-3 py-1.5 bg-[#F8F4EE] border border-[#E7DED3] text-xs"
                      >
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 10: GLOBAL SETTINGS, FOOTER EDITOR, ZONES & GOOGLE SEARCH CONSOLE SEO */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              {renderHeroSlideshowManager()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* 1. Café Identity, Footer Details, Contact & Policies */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await saveSettings({
                        ...settings,
                        ...settingsForm,
                        heroImages: settings.heroImages,
                        heroSlideshowSpeedSeconds: settings.heroSlideshowSpeedSeconds,
                        floorPlanImageUrl: settings.floorPlanImageUrl,
                      });
                      const footerDraft =
                        contentDrafts['footer'] ||
                        siteContent.find((s) => s.sectionKey === 'footer');
                      if (footerDraft) {
                        await saveSiteContent(footerDraft);
                        setContentDrafts((prev) => ({
                          ...prev,
                          footer: footerDraft,
                          [footerDraft.id]: footerDraft,
                        }));
                      }
                      showToast('Global café settings & all Footer details saved to live site.');
                    } catch (err) {
                      console.error('Save settings failed:', err);
                      showToast('Could not save settings to Firestore. Please verify your admin sign-in and try again.');
                    }
                  }}
                  className="bg-white border border-[#E7DED3] p-6 space-y-5 text-xs"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Brand Identity, Contact &amp; Complete Footer Details
                    </div>
                    <h2 className="text-xl font-editorial font-semibold mt-0.5 border-b border-[#E7DED3] pb-3">
                      Café Identity, Footer &amp; Reservation Policies
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        Café Brand Name (Header &amp; Footer)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.cafeName}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, cafeName: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        WhatsApp Concierge (Footer &amp; Contact)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.whatsapp}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, whatsapp: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        Telephone Number (Footer &amp; Contact)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.phone}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        Concierge Email (Footer &amp; Contact)
                      </label>
                      <input
                        type="email"
                        value={settingsForm.email}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, email: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        Instagram Handle (Footer)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.instagram}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, instagram: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[#171513]/60 mb-1">GPS Coordinates</label>
                      <input
                        type="text"
                        value={settingsForm.coordinates}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, coordinates: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[#171513]/60 mb-1">
                        Footer Tagline / Sanctuary Description
                      </label>
                      <textarea
                        rows={2}
                        value={settingsForm.tagline}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, tagline: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[#171513]/60 mb-1">
                        Physical Sanctuary Address (Footer &amp; Contact)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.address}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, address: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>

                    {/* Footer Banner, Buttons & Copyright (stored in siteContent['footer']) */}
                    {(() => {
                      const footerSec =
                        contentDrafts['footer'] ||
                        siteContent.find((s) => s.sectionKey === 'footer') || {
                          id: 'footer',
                          sectionKey: 'footer',
                          kicker: 'Reserve at OneLove',
                          heading: 'From Sunrise Climb to Candlelit Palms.',
                          subheading: 'Explore Menu',
                          body: `© ${new Date().getFullYear()} OneLove Café Sigiriya. All rights reserved.`,
                          ctaLabel: 'Directions & Policies',
                          ctaLink: 'Staff & Admin Console',
                          imageUrl: '',
                        };
                      return (
                        <>
                          <div className="sm:col-span-2 pt-2 border-t border-[#E7DED3]">
                            <div className="font-semibold text-[#C65B2B] uppercase tracking-wider text-[11px]">
                              Footer Banner Headline, CTA Buttons &amp; Copyright
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[#171513]/60 mb-1">
                              Footer Top Banner Headline
                            </label>
                            <input
                              type="text"
                              value={footerSec.heading}
                              onChange={(e) =>
                                setContentDrafts({
                                  ...contentDrafts,
                                  footer: { ...footerSec, heading: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#171513]/60 mb-1">
                              Footer Primary Button Label
                            </label>
                            <input
                              type="text"
                              value={footerSec.kicker}
                              onChange={(e) =>
                                setContentDrafts({
                                  ...contentDrafts,
                                  footer: { ...footerSec, kicker: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#171513]/60 mb-1">
                              Footer Secondary Button Label
                            </label>
                            <input
                              type="text"
                              value={footerSec.subheading}
                              onChange={(e) =>
                                setContentDrafts({
                                  ...contentDrafts,
                                  footer: { ...footerSec, subheading: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[#171513]/60 mb-1">
                              Footer Copyright Text
                            </label>
                            <input
                              type="text"
                              value={footerSec.body}
                              onChange={(e) =>
                                setContentDrafts({
                                  ...contentDrafts,
                                  footer: { ...footerSec, body: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#171513]/60 mb-1">
                              Footer Bottom Link 1 Label
                            </label>
                            <input
                              type="text"
                              value={footerSec.ctaLabel}
                              onChange={(e) =>
                                setContentDrafts({
                                  ...contentDrafts,
                                  footer: { ...footerSec, ctaLabel: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#171513]/60 mb-1">
                              Footer Bottom Link 2 Label
                            </label>
                            <input
                              type="text"
                              value={footerSec.ctaLink}
                              onChange={(e) =>
                                setContentDrafts({
                                  ...contentDrafts,
                                  footer: { ...footerSec, ctaLink: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                            />
                          </div>
                        </>
                      );
                    })()}

                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        Arrival Grace Period (Min)
                      </label>
                      <input
                        type="number"
                        value={settingsForm.gracePeriodMinutes}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            gracePeriodMinutes: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        Checkout Table Hold (Min)
                      </label>
                      <input
                        type="number"
                        value={settingsForm.holdDurationMinutes}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            holdDurationMinutes: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[#171513]/60 mb-1">
                        Menu Price Currency Display (Global Website Default)
                      </label>
                      <select
                        value={settingsForm.menuCurrencyDisplay || 'both'}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            menuCurrencyDisplay: e.target.value as MenuCurrencyDisplay,
                          })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      >
                        <option value="both">Show Both Currencies (LKR &amp; USD $)</option>
                        <option value="lkr">Show Sri Lankan Rupees Only (LKR)</option>
                        <option value="usd">Show US Dollars Only (USD $)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[#171513]/60 mb-1">House Booking Policy</label>
                      <textarea
                        rows={3}
                        value={settingsForm.bookingPolicy}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, bookingPolicy: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>

                    {/* Google Maps Sanctuary Location Configuration */}
                    <div className="sm:col-span-2 pt-3 border-t border-[#E7DED3] space-y-3">
                      <div>
                        <div className="font-semibold text-[#C65B2B] uppercase tracking-wider text-[11px]">
                          Google Maps Sanctuary Location (Clean Window)
                        </div>
                        <p className="text-[11px] text-[#171513]/60 mt-0.5">
                          Set the Google Maps location displayed between the Reservation section and Customer Reviews. The map window renders clean with no controls, popups, or clutter.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[#171513]/60 mb-1">
                            Google Maps Embed URL, Iframe Code, Share Link, or Coordinates
                          </label>
                          <textarea
                            rows={2}
                            placeholder="e.g. 7.9541, 80.7547 OR OneLove Cafe Sigiriya OR paste an <iframe src='...'> embed code"
                            value={settingsForm.googleMapsEmbedUrl || ''}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, googleMapsEmbedUrl: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono text-[11px]"
                          />
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setSettingsForm({
                                  ...settingsForm,
                                  googleMapsEmbedUrl: '7.9541, 80.7547 (OneLove Café Sigiriya)',
                                })
                              }
                              className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[#E7DED3] bg-white hover:bg-[#171513] hover:text-white transition-colors"
                            >
                              Preset: Sigiriya GPS
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSettingsForm({
                                  ...settingsForm,
                                  googleMapsEmbedUrl: 'OneLove Cafe, Lion Rock Sanctuary Road, Sigiriya, Sri Lanka',
                                })
                              }
                              className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[#E7DED3] bg-white hover:bg-[#171513] hover:text-white transition-colors"
                            >
                              Preset: Address Search
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSettingsForm({
                                  ...settingsForm,
                                  googleMapsEmbedUrl: 'https://maps.google.com/maps?q=7.9541,80.7547+(OneLove+Caf%C3%A9+Sigiriya)&t=&z=15&ie=UTF8&iwloc=&output=embed',
                                })
                              }
                              className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[#E7DED3] bg-white hover:bg-[#171513] hover:text-white transition-colors"
                            >
                              Preset: Clean Embed
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[#171513]/60 mb-1">
                            Map Section Title
                          </label>
                          <input
                            type="text"
                            placeholder="Our Sanctuary Location"
                            value={settingsForm.mapTitle || ''}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, mapTitle: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                          />
                        </div>

                        <div>
                          <label className="block text-[#171513]/60 mb-1">
                            Map Section Subtitle
                          </label>
                          <input
                            type="text"
                            placeholder="Lion Rock Sanctuary Road, Kimbissa, Sigiriya"
                            value={settingsForm.mapSubtitle || ''}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, mapSubtitle: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                          />
                        </div>

                        {/* Live Clean Preview Box */}
                        <div className="sm:col-span-2 mt-2">
                          <div className="text-[11px] text-[#171513]/60 mb-1 flex items-center justify-between">
                            <span>Live Map Window Preview:</span>
                            <span className="text-[#58644E] font-medium font-mono text-[10px]">Clean embed · No controls</span>
                          </div>
                          <div className="border border-[#E7DED3] bg-[#EFE9DF] overflow-hidden">
                            <iframe
                              src={resolveGoogleMapsEmbedUrl(
                                settingsForm.googleMapsEmbedUrl || settingsForm.address || settingsForm.coordinates
                              )}
                              title="Map Location Preview"
                              className="w-full h-44 border-0 block"
                              loading="lazy"
                              allowFullScreen={false}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 px-6 bg-[#C65B2B] text-white uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors"
                  >
                    Save Global Settings, Map Location &amp; Footer Details
                  </button>
                </form>

                {/* 2. Seating Zones Manager (Appears in Footer, Story Page & Floor Plan) + SEO Sitemap Generator */}
                <div className="space-y-6">
                  <div className="bg-white border border-[#E7DED3] p-6 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E7DED3] pb-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                          Footer &quot;Seating Zones&quot; Column &amp; Floor Plan Zones
                        </div>
                        <h3 className="text-lg font-editorial font-semibold">
                          Seating Zones ({zones.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingZone({
                            id: `zone_${Date.now()}`,
                            name: '',
                            subtitle: '',
                            description: '',
                            atmosphere: 'Al Fresco · Sanctuary',
                            isActive: true,
                            sortOrder: zones.length + 1,
                          })
                        }
                        className="px-3 py-1.5 bg-[#C65B2B] text-white font-medium inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Zone
                      </button>
                    </div>

                    {editingZone && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await saveZone(editingZone);
                          showToast(`Saved seating zone "${editingZone.name}".`);
                          setEditingZone(null);
                        }}
                        className="p-4 bg-[#F8F4EE] border border-[#C65B2B] space-y-3"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Zone Name (shown in Footer & Floor Plan)"
                          value={editingZone.name}
                          onChange={(e) =>
                            setEditingZone({ ...editingZone, name: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-[#E7DED3]"
                        />
                        <input
                          type="text"
                          placeholder="Atmosphere Tags (e.g. Breezy · Panoramic)"
                          value={editingZone.atmosphere}
                          onChange={(e) =>
                            setEditingZone({ ...editingZone, atmosphere: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-[#E7DED3]"
                        />
                        <textarea
                          rows={2}
                          placeholder="Zone Description (shown on Our Story page)"
                          value={editingZone.description}
                          onChange={(e) =>
                            setEditingZone({ ...editingZone, description: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-[#E7DED3]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider font-medium"
                          >
                            Save Zone
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingZone(null)}
                            className="px-3 py-1.5 border border-[#E7DED3] bg-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="divide-y divide-[#E7DED3]">
                      {zones.map((z) => (
                        <div
                          key={z.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-semibold text-[#171513]">{z.name}</div>
                            <div className="text-[#171513]/55">{z.atmosphere}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingZone({ ...z })}
                              className="px-2.5 py-1 bg-[#F8F4EE] border border-[#E7DED3] hover:border-[#171513]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteZone(z.id);
                                showToast(`Deleted zone "${z.name}".`);
                              }}
                              className="px-2.5 py-1 border border-[#E7DED3] text-[#9E3F16]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Google Search Console XML Sitemap, Robots.txt & SPA Routing Status */}
                  <div className="bg-white border border-[#E7DED3] p-6 space-y-4 text-xs">
                    <div className="border-b border-[#E7DED3] pb-3">
                      <div className="text-[11px] uppercase tracking-widest text-[#58644E] font-semibold">
                        Google Search Console &amp; Multi-Platform SPA Deployment
                      </div>
                      <h3 className="text-lg font-editorial font-semibold mt-0.5">
                        XML Sitemap, Robots.txt &amp; SPA Routing Architecture
                      </h3>
                      <p className="text-[#171513]/65 mt-0.5">
                        Static `/sitemap.xml` and `/robots.txt` are live at your root domain. You
                        can also generate domain-specific copies below for Vercel, Cloudflare Pages,
                        or Appwrite Sites.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[#171513]/60 mb-1">
                        Production Domain URL (for Sitemap &amp; Robots.txt)
                      </label>
                      <input
                        type="url"
                        value={seoDomain}
                        onChange={(e) => setSeoDomain(e.target.value.replace(/\/+$/, ''))}
                        className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <a
                        href="/sitemap.xml"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider font-medium"
                      >
                        View Live /sitemap.xml ↗
                      </a>
                      <a
                        href="/robots.txt"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 border border-[#171513] text-[#171513] uppercase tracking-wider font-medium"
                      >
                        View Live /robots.txt ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const base = (seoDomain || 'https://onelovecafe.lk').replace(/\/+$/, '');
                          const today = new Date().toISOString().slice(0, 10);
                          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/reserve</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.95</priority></url>
  <url><loc>${base}/menu</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.90</priority></url>
  <url><loc>${base}/events</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
  <url><loc>${base}/gallery</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.80</priority></url>
  <url><loc>${base}/story</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.80</priority></url>
  <url><loc>${base}/contact</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.80</priority></url>
</urlset>`;
                          const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'sitemap.xml';
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast(`Downloaded sitemap.xml for ${base}`);
                        }}
                        className="px-3.5 py-2 bg-[#C65B2B] text-white uppercase tracking-wider font-medium"
                      >
                        Download Custom sitemap.xml
                      </button>
                    </div>

                    <div className="bg-[#F8F4EE] border border-[#E7DED3] p-3.5 space-y-1.5 text-[11px]">
                      <div className="font-semibold text-[#171513]">
                        Verified SPA Routing Configurations Included:
                      </div>
                      <div>
                        • <strong>Vercel</strong>: Configured via `/vercel.json` (serves `/sitemap.xml`
                        &amp; `/robots.txt` with XML/text headers and rewrites all SPA routes to
                        `/index.html`).
                      </div>
                      <div>
                        • <strong>Cloudflare Pages</strong>: Configured via `/public/_redirects` &amp;
                        `/public/_headers` (`/* /index.html 200` with `200 OK` status for Googlebot).
                      </div>
                      <div>
                        • <strong>Appwrite Sites</strong>: Build command `npm run build`, Output
                        directory `dist`, Fallback file `index.html`.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cloudflare R2 Object Storage Card */}
                <div className="bg-white border border-[#E7DED3] p-6 space-y-4 text-xs lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DED3] pb-3">
                    <div className="flex items-center gap-2.5">
                      <Cloud className="w-5 h-5 text-[#C65B2B]" />
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                          Zero-Egress Object Storage
                        </div>
                        <h2 className="text-xl font-editorial font-semibold mt-0.5">
                          Cloudflare R2 Storage Bucket
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase ${
                          storageStatus?.configured
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {storageStatus?.configured ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Connected to R2
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Fallback Mode (R2 Ready)
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await checkStorageStatus();
                          showToast('Storage status refreshed.');
                        }}
                        className="px-2.5 py-1 text-[11px] border border-[#E7DED3] text-[#171513]/70 hover:bg-[#F8F4EE] flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Check Status
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#F8F4EE] p-4 border border-[#E7DED3] space-y-1">
                      <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-semibold">
                        Storage Engine
                      </div>
                      <div className="text-sm font-semibold text-[#171513]">
                        {storageStatus?.configured ? 'Cloudflare R2 Bucket' : 'Adaptive Local / Inline'}
                      </div>
                      <p className="text-[11px] text-[#171513]/70">
                        {storageStatus?.configured
                          ? 'Zero egress fees. CDN edge cached across Cloudflare.'
                          : 'Stores images inline until R2 credentials are set.'}
                      </p>
                    </div>

                    <div className="bg-[#F8F4EE] p-4 border border-[#E7DED3] space-y-1">
                      <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-semibold">
                        Target Bucket
                      </div>
                      <div className="text-sm font-semibold text-[#171513] font-mono truncate">
                        {storageStatus?.bucket || 'onelove-assets'}
                      </div>
                      <p className="text-[11px] text-[#171513]/70">
                        Configured via R2_BUCKET_NAME env variable or R2_BUCKET binding.
                      </p>
                    </div>

                    <div className="bg-[#F8F4EE] p-4 border border-[#E7DED3] space-y-1">
                      <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-semibold">
                        Public CDN Endpoint
                      </div>
                      <div className="text-sm font-semibold text-[#171513] font-mono truncate">
                        {storageStatus?.publicUrl || 'https://cdn.onelovecafesigiriya.com'}
                      </div>
                      <p className="text-[11px] text-[#171513]/70">
                        Images are served at edge speeds with high cache longevity.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#F8F4EE] border border-[#E7DED3] p-4 space-y-3 text-[11px]">
                    <div className="font-semibold text-[#171513]">
                      How to link your Cloudflare R2 bucket:
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[#171513]/80">
                      <li>
                        In Cloudflare Dashboard, open <strong>R2</strong> and click <strong>Create bucket</strong> (e.g. named <code className="bg-white px-1 py-0.5 border border-[#E7DED3]">onelove-assets</code>).
                      </li>
                      <li>
                        Under bucket <strong>Settings</strong> &gt; <strong>Public Access</strong>, connect a domain (e.g. <code className="bg-white px-1 py-0.5 border border-[#E7DED3]">cdn.onelovecafesigiriya.com</code>) or allow the free <code className="bg-white px-1 py-0.5 border border-[#E7DED3]">r2.dev</code> URL.
                      </li>
                      <li>
                        In Cloudflare Pages, open your project <strong>Settings</strong> &gt; <strong>Environment Variables</strong> and add either format:
                        <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                          <div className="bg-white p-2.5 border border-[#E7DED3] space-y-1">
                            <div className="text-[9px] uppercase tracking-wider text-[#C65B2B] font-sans font-bold">Standard S3 API Credentials</div>
                            <div>S3_ENDPOINT = https://&lt;account_id&gt;.r2.cloudflarestorage.com</div>
                            <div>S3_ACCESS_KEY_ID = &lt;your_access_key&gt;</div>
                            <div>S3_SECRET_ACCESS_KEY = &lt;your_secret_key&gt;</div>
                            <div>S3_BUCKET_NAME = onelove-assets</div>
                            <div>S3_PUBLIC_URL = https://cdn.onelovecafesigiriya.com</div>
                          </div>
                          <div className="bg-white p-2.5 border border-[#E7DED3] space-y-1">
                            <div className="text-[9px] uppercase tracking-wider text-[#C65B2B] font-sans font-bold">Cloudflare R2 Format</div>
                            <div>R2_ACCOUNT_ID = &lt;your_cloudflare_account_id&gt;</div>
                            <div>R2_ACCESS_KEY_ID = &lt;your_r2_access_key&gt;</div>
                            <div>R2_SECRET_ACCESS_KEY = &lt;your_r2_secret_key&gt;</div>
                            <div>R2_BUCKET_NAME = onelove-assets</div>
                            <div>R2_PUBLIC_URL = https://cdn.onelovecafesigiriya.com</div>
                          </div>
                        </div>
                      </li>
                    </ol>
                  </div>

                  {/* One-Click Image Migration to R2 */}
                  <div className="bg-white border border-[#E7DED3] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[#171513] flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[#C65B2B]" />
                        Firestore to Cloudflare R2 Image Migration
                      </div>
                      <p className="text-[11px] text-[#171513]/70">
                        {base64Count > 0
                          ? `Found ${base64Count} image(s) stored inline in Firestore. Migrate them to cdn.onelovecafesigiriya.com to drastically shrink document sizes and prevent quota limits.`
                          : 'All media assets are served via CDN URLs or clean identifiers. Your Firestore documents are fully optimized.'}
                      </p>
                      {migrationStatus && (
                        <div className="text-[11px] text-[#C65B2B] font-mono-tabular flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          {migrationStatus}
                        </div>
                      )}
                    </div>
                    {base64Count > 0 && (
                      <button
                        type="button"
                        disabled={migratingImages || !storageStatus?.configured}
                        onClick={handleMigrateAllImages}
                        className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          storageStatus?.configured && !migratingImages
                            ? 'bg-[#C65B2B] text-white hover:bg-[#A9491E]'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {migratingImages ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Migrating ({base64Count})...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3 h-3" />
                            Migrate {base64Count} Image{base64Count > 1 ? 's' : ''} to R2
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: SEO, FAVICON & SEARCH OPTIMIZATION (/admin/seo) */}
          {activeTab === 'seo' && <AdminSeoPanel onShowToast={showToast} />}

          {/* TAB 11: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
              <h2 className="text-xl font-editorial font-semibold">
                Immutable Administrator Audit Trail
              </h2>
              {auditLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#171513]/50">
                  No administrative actions logged yet.
                </div>
              ) : (
                <div className="divide-y divide-[#E7DED3] text-xs font-mono-tabular">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-semibold text-[#C65B2B]">{log.action}</span> ·{' '}
                        <span>{log.summary}</span>
                      </div>
                      <div className="text-[#171513]/55">
                        {log.actorEmail} ({log.targetCollection})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
