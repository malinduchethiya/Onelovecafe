import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  ArrowRight,
  MapPin,
  Phone,
  Clock,
  X,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Compass,
  Menu as MenuIcon,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Check,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { CafeProvider, useCafe } from './context/CafeContext';
import { EditorialVisual } from './components/EditorialVisual';
import { LateriteStorySection } from './components/LateriteStorySection';
import { ReservationEngine } from './components/ReservationEngine';
import { SanctuaryMap } from './components/SanctuaryMap';
import { MenuPage } from './components/MenuPage';
import { OFFICIAL_ONELOVE_MAPS_PLACE_URL } from './lib/mapUtils';
import { extractDietaryFlags, resolveMenuItemSection } from './lib/menuSections';
import { AdminDashboard, AdminTab } from './components/AdminDashboard';
import { SeoHead } from './components/SeoHead';
import { GalleryItem, MenuItem } from './types/cafe';

gsap.registerPlugin(ScrollTrigger);

// Error Boundary for clear diagnostics (including Firestore quota or rule messages)
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorText: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, errorText: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F4EE] text-[#171513] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E7DED3] p-8 space-y-4">
            <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-semibold">
              Application Diagnostic Notice
            </div>
            <h1 className="text-2xl font-editorial font-semibold">
              We encountered an unexpected state
            </h1>
            <p className="text-xs font-mono-tabular bg-[#F8F4EE] p-3 border border-[#E7DED3] break-words">
              {this.state.errorText}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorText: '' });
                window.location.href = '/';
              }}
              className="px-5 py-2.5 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-widest"
            >
              Reload Sanctuary
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function parsePathname(pathname: string): {
  page:
    | 'home'
    | 'menu'
    | 'story'
    | 'gallery'
    | 'events'
    | 'contact'
    | 'reserve'
    | 'admin'
    | 'notfound';
  adminTab?: AdminTab;
  voucherCode?: string | null;
} {
  const rawClean = pathname.replace(/\/+$/, '') || '/';
  const lower = rawClean.toLowerCase();
  if (lower === '/' || lower === '/index.html') return { page: 'home' };
  if (lower === '/menu') return { page: 'menu' };
  if (lower === '/story') return { page: 'story' };
  if (lower === '/gallery') return { page: 'gallery' };
  if (lower === '/events') return { page: 'events' };
  if (lower === '/contact' || lower === '/visit') return { page: 'contact' };
  if (lower === '/reserve') return { page: 'reserve', voucherCode: null };
  if (lower.startsWith('/reserve/voucher/')) {
    const code = rawClean.slice('/reserve/voucher/'.length);
    return { page: 'reserve', voucherCode: decodeURIComponent(code) };
  }
  if (lower === '/admin') return { page: 'admin', adminTab: 'overview' };
  if (lower.startsWith('/admin/')) {
    const sub = lower.replace('/admin/', '') as AdminTab;
    const validTabs: AdminTab[] = [
      'overview',
      'reservations',
      'floor-plan',
      'schedule',
      'menu',
      'gallery',
      'events',
      'content',
      'inquiries',
      'seo',
      'settings',
      'audit',
    ];
    return {
      page: 'admin',
      adminTab: validTabs.includes(sub) ? sub : 'overview',
    };
  }
  return { page: 'notfound' };
}

const OneLoveRouter: React.FC = () => {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    settings,
    zones,
    openingHours,
    menuCategories,
    menuItems,
    gallery,
    events,
    siteContent,
    siteImages,
    seoGlobal,
    submitInquiry,
  } = useCafe();

  const resolveSectionImageUrl = (sectionKey: string, fallbackKey?: string): string => {
    const imgDoc = siteImages.find((si) => si.id === sectionKey || si.sectionKey === sectionKey);
    if (imgDoc?.imageUrl && /^https?:\/\//i.test(imgDoc.imageUrl.trim())) {
      return imgDoc.imageUrl.trim();
    }
    const contentDoc = siteContent.find(
      (s) => s.sectionKey === sectionKey || s.id === sectionKey
    );
    if (contentDoc?.imageUrl && /^https?:\/\//i.test(contentDoc.imageUrl.trim())) {
      return contentDoc.imageUrl.trim();
    }
    if (fallbackKey) {
      const fbImg = siteImages.find(
        (si) => si.id === fallbackKey || si.sectionKey === fallbackKey
      );
      if (fbImg?.imageUrl && /^https?:\/\//i.test(fbImg.imageUrl.trim())) {
        return fbImg.imageUrl.trim();
      }
      const fbContent = siteContent.find(
        (s) => s.sectionKey === fallbackKey || s.id === fallbackKey
      );
      if (fbContent?.imageUrl && /^https?:\/\//i.test(fbContent.imageUrl.trim())) {
        return fbContent.imageUrl.trim();
      }
    }
    return '';
  };

  const resolveMenuPriceCurrency = (item: MenuItem): 'both' | 'lkr' | 'usd' => {
    if (item.priceCurrency && item.priceCurrency !== 'default') {
      return item.priceCurrency;
    }
    return settings.menuCurrencyDisplay || 'both';
  };

  // Gallery page filter & lightbox states
  const [selectedGalleryCat, setSelectedGalleryCat] = useState<string>('All');
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  // Contact inquiry form states
  const [inqName, setInqName] = useState('');
  const [inqEmail, setInqEmail] = useState('');
  const [inqPhone, setInqPhone] = useState('');
  const [inqSubject, setInqSubject] = useState('Private Sanctuary Dining & Concierge');
  const [inqMessage, setInqMessage] = useState('');
  const [inqStatus, setInqStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inqError, setInqError] = useState('');

  useEffect(() => {
    // Support hash-route fallback (#/menu) or ?p=/menu query redirect if used on static hosts
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const redirectedRoute = params.get('p') || params.get('route');
      if (redirectedRoute && redirectedRoute.startsWith('/')) {
        window.history.replaceState({}, '', redirectedRoute);
        setPathname(redirectedRoute);
      } else if (window.location.hash.startsWith('#/')) {
        const hashPath = window.location.hash.slice(1);
        window.history.replaceState({}, '', hashPath);
        setPathname(hashPath);
      }
    }

    const handlePopState = () => {
      setPathname(window.location.pathname);
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    setMobileMenuOpen(false);
    if (to === pathname) return;
    window.history.pushState({}, '', to);
    setPathname(to);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReserveCtaClick = () => {
    setMobileMenuOpen(false);
    if (pathname === '/') {
      const el = document.getElementById('reserve-section');
      if (el) {
        const navHeight = 76;
        if (lenisRef.current) {
          lenisRef.current.scrollTo(el, { offset: -navHeight, duration: 1.1 });
        } else {
          const y = el.getBoundingClientRect().top + window.scrollY - navHeight;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
        return;
      }
    }
    navigate('/reserve');
  };

  const routeInfo = parsePathname(pathname);

  const heroContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'hero') || siteContent[0],
    [siteContent]
  );
  const storyContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'story') || siteContent[1],
    [siteContent]
  );
  const conciergeContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'concierge') || siteContent[2],
    [siteContent]
  );
  const footerContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'footer'),
    [siteContent]
  );
  const goldenHourContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'golden_hour'),
    [siteContent]
  );
  const atmosphereContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'atmosphere'),
    [siteContent]
  );
  const homeReserveContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'home_reserve'),
    [siteContent]
  );
  const findUsContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'find_us'),
    [siteContent]
  );

  const [homeMenuDetailItem, setHomeMenuDetailItem] = useState<MenuItem | null>(null);
  const [homeReserveTime, setHomeReserveTime] = useState<string>('19:30');
  const [homeReserveGuests, setHomeReserveGuests] = useState<number>(2);

  // Hero Background Slideshow list & timer (strictly mirrors Admin Panel settings.heroImages from Firestore + Cloudflare R2)
  const heroSlides = useMemo(() => {
    const rawSlides = Array.isArray(settings.heroImages)
      ? settings.heroImages.filter((img) => typeof img === 'string' && /^https?:\/\//i.test(img.trim()))
      : [];
    return rawSlides.length > 0 ? rawSlides : [''];
  }, [settings.heroImages]);

  const [heroSlideIndex, setHeroSlideIndex] = useState(0);

  useEffect(() => {
    if (heroSlideIndex >= heroSlides.length) {
      setHeroSlideIndex(0);
    }
  }, [heroSlides.length, heroSlideIndex]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const speedMs = Math.max(1000, (settings.heroSlideshowSpeedSeconds || 5) * 1000);
    const timer = window.setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [heroSlides.length, settings.heroSlideshowSpeedSeconds]);

  const handlePrevSlide = () => {
    if (heroSlides.length <= 1) return;
    setHeroSlideIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const handleNextSlide = () => {
    if (heroSlides.length <= 1) return;
    setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
  };

  // Zero-Jank Smooth Scroll (Lenis + GSAP Ticker) & Ref-Driven Parallax (Zero React Re-Renders on Scroll)
  const [isScrolledPastHeader, setIsScrolledPastHeader] = useState(false);
  const heroBgRef = useRef<HTMLDivElement | null>(null);
  const mouseParallaxRef = useRef({ x: 0, y: 0 });
  const lenisRef = useRef<Lenis | null>(null);
  const appRootRef = useRef<HTMLDivElement | null>(null);

  const applyHeroParallaxTransform = (scrollTop: number) => {
    const bgEl = heroBgRef.current;
    if (!bgEl) return;
    // Clamp hero parallax once scrolled well past the hero to save GPU work
    const clampedScroll = Math.min(scrollTop, 1100);
    const tx = mouseParallaxRef.current.x * 0.06;
    const ty = clampedScroll * 0.12 + mouseParallaxRef.current.y * 0.06;
    bgEl.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
  };

  // Lenis Inertial Smooth Scrolling synced directly to GSAP ScrollTrigger
  useEffect(() => {
    if (routeInfo.page === 'admin') return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.15,
      autoRaf: false,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const onTick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.off('scroll', ScrollTrigger.update);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [routeInfo.page]);

  // Lightweight Ref-Driven Scroll Updates (never triggers per-frame React state updates)
  useEffect(() => {
    let rafId: number | null = null;
    const updateScrollEffects = () => {
      rafId = null;
      const y = window.scrollY;
      const pastHeader = y > 48;
      setIsScrolledPastHeader((prev) => (prev === pastHeader ? prev : pastHeader));
      applyHeroParallaxTransform(y);
    };

    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(updateScrollEffects);
      }
    };

    updateScrollEffects();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [pathname]);

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseParallaxRef.current = {
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 24,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 24,
    };
    applyHeroParallaxTransform(window.scrollY);
  };

  const handleHeroMouseLeave = () => {
    mouseParallaxRef.current = { x: 0, y: 0 };
    applyHeroParallaxTransform(window.scrollY);
  };

  // Featured Food & Drinks items separated for the Home Page Menu Section (4 in a row)
  const sortNewestCustomFirst = <T extends { id: string }>(items: T[]): T[] => {
    const extractTimestamp = (id: string): number => {
      const m = id.match(/_(\d{10,})/);
      return m ? Number(m[1]) : 0;
    };
    return [...items].sort((a, b) => extractTimestamp(b.id) - extractTimestamp(a.id));
  };

  const featuredFoodItems = useMemo(() => {
    const available = menuItems.filter(
      (m) => m.isAvailable && resolveMenuItemSection(m, menuCategories) === 'food'
    );
    const featured = sortNewestCustomFirst(available.filter((m) => m.isFeatured));
    const nonFeatured = sortNewestCustomFirst(available.filter((m) => !m.isFeatured));
    return [...featured, ...nonFeatured].slice(0, 8);
  }, [menuItems, menuCategories]);

  const featuredDrinkItems = useMemo(() => {
    const available = menuItems.filter(
      (m) => m.isAvailable && resolveMenuItemSection(m, menuCategories) === 'drinks'
    );
    const featured = sortNewestCustomFirst(available.filter((m) => m.isFeatured));
    const nonFeatured = sortNewestCustomFirst(available.filter((m) => !m.isFeatured));
    return [...featured, ...nonFeatured].slice(0, 8);
  }, [menuItems, menuCategories]);

  const featuredDishesCount = featuredFoodItems.length + featuredDrinkItems.length;

  const homeGalleryItems = useMemo(() => {
    const extractTs = (id: string): number => {
      const m = id.match(/_(\d{10,})/);
      return m ? Number(m[1]) : 0;
    };
    const byOrderThenNewest = (a: { id: string; sortOrder: number }, b: { id: string; sortOrder: number }) =>
      a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : extractTs(b.id) - extractTs(a.id);
    const featured = [...gallery.filter((g) => g.isFeatured)].sort(byOrderThenNewest);
    const rest = [...gallery.filter((g) => !g.isFeatured)].sort(byOrderThenNewest);
    return [...featured, ...rest].slice(0, 6);
  }, [gallery]);

  const filteredGallery = useMemo(() => {
    if (selectedGalleryCat === 'All') return gallery;
    return gallery.filter((g) => g.category === selectedGalleryCat);
  }, [gallery, selectedGalleryCat]);

  // GSAP Master Choreography across Homepage & Subpages
  useLayoutEffect(() => {
    if (routeInfo.page === 'admin') return;
    const rootEl = appRootRef.current;
    if (!rootEl) return;

    const ctx = gsap.context(() => {
      // 1. Hero Entrance Timeline (when on Home)
      const heroItems = gsap.utils.toArray<HTMLElement>('[data-gsap-hero]');
      if (heroItems.length > 0) {
        gsap.fromTo(
          heroItems,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.0,
            stagger: 0.14,
            ease: 'power3.out',
            delay: 0.08,
            clearProps: 'transform,opacity,filter',
          }
        );
      }

      // 1b. Minimalist Accolades & Ratings Strap Reveal
      const ratingItems = gsap.utils.toArray<HTMLElement>('[data-gsap-ratings]');
      if (ratingItems.length > 0) {
        gsap.fromTo(
          ratingItems,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: ratingItems[0],
              start: 'top 92%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      // 2. Signature Plates & Highland Pour-Overs Section Header + Cards
      const menuHeader = gsap.utils.toArray<HTMLElement>('[data-gsap-menu-header]');
      if (menuHeader.length > 0) {
        gsap.fromTo(
          menuHeader,
          { y: 32, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: menuHeader[0],
              start: 'top 84%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      const menuCards = gsap.utils.toArray<HTMLElement>('[data-gsap-menu-card]');
      if (menuCards.length > 0) {
        const rowSize = 4;
        for (let i = 0; i < menuCards.length; i += rowSize) {
          const row = menuCards.slice(i, i + rowSize);
          row.forEach((card) => {
            card.style.transition = 'none';
          });
          gsap.fromTo(
            row,
            { y: 26, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.65,
              stagger: 0.06,
              ease: 'power3.out',
              onComplete: () => {
                gsap.set(row, { clearProps: 'transform,opacity' });
                row.forEach((card) => {
                  card.style.transition = '';
                });
              },
              scrollTrigger: {
                trigger: row[0],
                start: 'top 90%',
                toggleActions: 'play none none none',
              },
            }
          );
        }
      }

      // 3. Reserve Your Sanctuary Table Section
      const reserveItems = gsap.utils.toArray<HTMLElement>('[data-gsap-reserve]');
      if (reserveItems.length > 0) {
        gsap.fromTo(
          reserveItems,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            stagger: 0.14,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: reserveItems[0],
              start: 'top 82%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      // 4. Home Page Editorial Showcase & Gallery Reveal (handled seamlessly by section flyover)

      // 5. Traveler & Partner Voices Section
      const voiceItems = gsap.utils.toArray<HTMLElement>('[data-gsap-voice]');
      if (voiceItems.length > 0) {
        voiceItems.forEach((item) => {
          item.style.transition = 'none';
        });
        gsap.fromTo(
          voiceItems,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            stagger: 0.12,
            ease: 'power3.out',
            onComplete: () => {
              gsap.set(voiceItems, { clearProps: 'transform,opacity' });
              voiceItems.forEach((item) => {
                item.style.transition = '';
              });
            },
            scrollTrigger: {
              trigger: voiceItems[0],
              start: 'top 86%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      // 6. Subpages Entrance Choreography (/menu, /story, /gallery, /events, /contact, /reserve)
      const subpageHeaders = gsap.utils.toArray<HTMLElement>('[data-gsap-subpage]');
      if (subpageHeaders.length > 0) {
        gsap.fromTo(
          subpageHeaders,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.08,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }
        );
      }

      const subpageCards = gsap.utils.toArray<HTMLElement>('[data-gsap-subcard]');
      if (subpageCards.length > 0) {
        subpageCards.forEach((card) => {
          card.style.transition = 'none';
        });
        gsap.fromTo(
          subpageCards,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.035,
            ease: 'power2.out',
            onComplete: () => {
              gsap.set(subpageCards, { clearProps: 'transform,opacity' });
              subpageCards.forEach((card) => {
                card.style.transition = '';
              });
            },
          }
        );
      }

      // 7. Quiet Architectural Footer Reveal
      const footerItems = gsap.utils.toArray<HTMLElement>('[data-gsap-footer]');
      if (footerItems.length > 0) {
        gsap.fromTo(
          footerItems,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: footerItems[0],
              start: 'top 92%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      // 8. One-Way Section Flyover Lift Effect (plays only when scrolling down, never when scrolling up)
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        const scrollSections = gsap.utils.toArray<HTMLElement>('main section');
        scrollSections.forEach((sectionEl, idx) => {
          // Keep the initial hero section anchored immediately above the fold
          if (routeInfo.page === 'home' && idx === 0) return;

          // Only hide sections that are currently below the viewport fold
          const rect = sectionEl.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.92) return;

          gsap.set(sectionEl, {
            y: 64,
            scale: 0.97,
            opacity: 0,
            transformOrigin: 'center top',
            force3D: true,
          });

          ScrollTrigger.create({
            trigger: sectionEl,
            start: 'top 90%',
            once: true,
            onEnter: () => {
              gsap.to(sectionEl, {
                y: 0,
                scale: 1,
                opacity: 1,
                duration: 0.85,
                ease: 'power3.out',
                force3D: true,
                clearProps: 'transform,opacity',
              });
            },
            onEnterBack: () => {
              // Never play flyover animation when scrolling up — snap cleanly to visible
              gsap.set(sectionEl, {
                y: 0,
                scale: 1,
                opacity: 1,
                clearProps: 'transform,opacity',
              });
            },
          });
        });
      }
    }, rootEl);

    return () => ctx.revert();
  }, [
    pathname,
    routeInfo.page,
    selectedGalleryCat,
    featuredDishesCount,
    filteredGallery.length,
  ]);

  // Protected Admin Route
  if (routeInfo.page === 'admin') {
    return (
      <>
        <SeoHead
          currentPage={routeInfo.page}
          pathname={pathname}
          voucherCode={routeInfo.voucherCode}
        />
        <AdminDashboard
          initialTab={routeInfo.adminTab}
          onNavigatePublic={(path) => navigate(path)}
        />
      </>
    );
  }

  const isHeaderScrolledOrSubpage = routeInfo.page !== 'home' || isScrolledPastHeader;

  return (
    <div ref={appRootRef} className="min-h-screen flex flex-col bg-[#FCF9F4] text-[#110F0D]">
      <SeoHead
        currentPage={routeInfo.page}
        pathname={pathname}
        voucherCode={routeInfo.voucherCode}
      />
      {/* Strict 3-Zone Top Bar Contract */}
      <header
        className={`sticky top-0 z-40 h-[72px] px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-3 sm:gap-8 text-white transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
          isHeaderScrolledOrSubpage
            ? 'bg-[#110F0D]/85 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.22)]'
            : 'bg-transparent'
        }`}
      >
        {/* Zone 1: Brand Wordmark (or R2 brand logo if uploaded in Admin) */}
        <a
          href="/"
          aria-label="OneLove Café Sigiriya"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="flex items-center font-editorial text-lg sm:text-2xl font-bold tracking-wider text-white drop-shadow-sm whitespace-nowrap shrink-0"
        >
          {seoGlobal.brandLogoUrl && /^https?:\/\//i.test(seoGlobal.brandLogoUrl) ? (
            <img
              src={seoGlobal.brandLogoUrl}
              alt={settings.cafeName || 'OneLove Café Sigiriya'}
              width="48"
              height="48"
              decoding="async"
              className="md:hidden h-10 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
            />
          ) : (
            <span className="md:hidden text-white">
              {(settings.cafeName || 'ONELOVE CAFÉ').toUpperCase()}
            </span>
          )}
          <span className="hidden md:inline text-white">
            {(settings.cafeName || 'ONELOVE CAFÉ').toUpperCase()}
          </span>
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs uppercase tracking-widest font-semibold text-white drop-shadow-sm">
          {[
            { label: 'Our Menu', path: '/menu' },
            { label: 'Our Story', path: '/story' },
            { label: 'Gallery', path: '/gallery' },
            { label: 'Experiences', path: '/events' },
            { label: 'Contact', path: '/contact' },
          ].map((link) => {
            const active = pathname === link.path;
            return (
              <a
                key={link.path}
                href={link.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(link.path);
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b ${
                  active
                    ? 'text-[#D9622B] border-[#D9622B]'
                    : 'text-white border-transparent hover:text-white/80 hover:border-white/70'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="/reserve"
            onClick={(e) => {
              e.preventDefault();
              handleReserveCtaClick();
            }}
            className="px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-[#D9622B] text-white text-[11px] sm:text-xs font-semibold uppercase tracking-wider hover:bg-[#BF5220] transition-colors whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(217,98,43,0.35)] cursor-pointer inline-flex items-center justify-center"
          >
            Reserve a Table
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-white drop-shadow-sm"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer — Always mounted in DOM (sr-only when closed) so Googlebot smartphone crawls all primary links */}
      <nav
        aria-label="Mobile Navigation"
        className={
          mobileMenuOpen
            ? 'sticky top-[72px] z-30 md:hidden bg-[#FCF9F4] border-b border-[#DFD5C6] px-4 sm:px-6 py-4 space-y-1 shadow-lg max-h-[calc(100vh-72px)] overflow-y-auto'
            : 'sr-only'
        }
      >
        {[
          { label: 'Home', path: '/' },
          { label: 'Our Menu', path: '/menu' },
          { label: 'Our Story', path: '/story' },
          { label: 'Gallery', path: '/gallery' },
          { label: 'Experiences & Events', path: '/events' },
          { label: 'Contact & Location', path: '/contact' },
          { label: 'Reserve a Table', path: '/reserve' },
        ].map((item) => (
          <a
            key={item.path}
            href={item.path}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.path);
            }}
            className="w-full min-h-[44px] flex items-center text-left py-2.5 text-sm font-medium border-b border-[#E7DED3]/60 text-[#110F0D]"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* MAIN PAGE CONTENT */}
      <main className="flex-1">
        {/* ==================== HOME PAGE ==================== */}
        {routeInfo.page === 'home' && (
          <div>
            {/* 1. Immersive Full-Screen Hero Section + Straddling 3D Wooden Café Menu Stand */}
            <div className="relative">
              <section
                onMouseMove={handleHeroMouseMove}
                onMouseLeave={handleHeroMouseLeave}
                className="relative -mt-[72px] pt-[72px] min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-[#1C1612] text-white overflow-hidden"
              >
                {/* Background Slideshow Layer with Wide Field of View & Zero-Jank Ref Parallax */}
                <div
                  ref={heroBgRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    transform: 'translate3d(0px, 0px, 0)',
                    willChange: 'transform',
                  }}
                >
                  {heroSlides.map((slideSrc, idx) => (
                    <div
                      key={`${idx}-${slideSrc.slice(0, 24)}`}
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                        idx === heroSlideIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                    >
                      <EditorialVisual
                        src={slideSrc}
                        alt={`OneLove Café Sigiriya, Sri Lanka hero slide ${idx + 1}`}
                        priority={true}
                        className="h-full w-full object-cover object-center contrast-[1.06] saturate-[1.08] brightness-[0.88]"
                      />
                    </div>
                  ))}
                  {/* Warm Deep Atmospheric Scrim matching Reference Screenshot */}
                  <div className="absolute inset-0 bg-[#18120D]/55" />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#140F0B]/60 via-[#18120D]/35 to-[#120D0A]/80" />
                </div>

                {/* Slider Navigation Arrows (Left & Right) */}
                {heroSlides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      aria-label="Previous slide"
                      className="hidden sm:flex absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 border border-white/15 text-white/85 hover:bg-black/75 hover:text-white items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      aria-label="Next slide"
                      className="hidden sm:flex absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 border border-white/15 text-white/85 hover:bg-black/75 hover:text-white items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Foreground Content Layer — Centered Editorial Layout Matching Reference */}
                <div className="relative z-10 max-w-4xl mx-auto w-full px-5 sm:px-10 pt-10 pb-16 sm:pt-14 sm:pb-20 flex flex-col items-center justify-center text-center subpixel-antialiased">
                  <div className="flex flex-col items-center justify-center text-center w-full space-y-5 sm:space-y-6">
                    {/* Minimal Location Eyebrow */}
                    <div
                      data-gsap-hero
                      className="inline-flex items-center px-4 py-1.5 rounded-full bg-black/35 border border-white/15 backdrop-blur-xs text-[10px] sm:text-[11px] font-mono-tabular uppercase tracking-[0.22em] text-white/90"
                    >
                      {heroContent?.kicker || 'Sigiriya · Sri Lanka · Lion Rock Sanctuary'}
                    </div>

                    {/* Hero Headline — 50% Reduced Size, Clean Balanced Proportions */}
                    <h1
                      data-gsap-hero
                      style={{ textWrap: 'balance' }}
                      className="font-outfit text-[26px] sm:text-[36px] md:text-[42px] lg:text-[52px] xl:text-[62px] font-normal leading-[1.08] tracking-[-0.02em] text-[#FFFFFF] max-w-2xl mx-auto [text-shadow:0_4px_24px_rgba(0,0,0,0.45)]"
                    >
                      <span className="sr-only">
                        OneLove Café Sigiriya — Café &amp; Restaurant in Sigiriya, Central Province, Sri Lanka:{' '}
                      </span>
                      {heroContent?.heading || 'Where Jungle Stone Meets Slow Highland Coffee.'}
                    </h1>

                    {/* Clean Centered Subtitle */}
                    <p
                      data-gsap-hero
                      className="text-sm sm:text-base text-white/90 max-w-xl mx-auto leading-relaxed font-light px-1 sm:px-2"
                    >
                      {heroContent?.subheading ||
                        'Nestled in the emerald canopy beneath Sigiriya Lion Rock in Central Province, Sri Lanka, OneLove Café is an open-air architectural sanctuary for single-estate Ceylon coffee, wood-fired coastal plates, and unhurried twilight gatherings.'}
                    </p>

                    {/* Balanced 3-Button Pill Row */}
                    <div
                      data-gsap-hero
                      className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5 pt-2 w-full"
                    >
                      <a
                        href="/menu"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/menu');
                        }}
                        className="min-h-[44px] px-6 sm:px-7 py-2.5 rounded-full bg-[#D9622B] text-white text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[#BF5220] transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center justify-center"
                      >
                        View Menu
                      </a>
                      <a
                        href="/reserve"
                        onClick={(e) => {
                          e.preventDefault();
                          handleReserveCtaClick();
                        }}
                        className="min-h-[44px] px-6 sm:px-7 py-2.5 rounded-full bg-[#FFFFFF] text-[#14100D] text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[#F3ECE0] transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center justify-center"
                      >
                        Reserve a Table
                      </a>
                      <a
                        href="/story"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/story');
                        }}
                        className="min-h-[44px] px-6 sm:px-7 py-2.5 rounded-full bg-black/30 border border-white/40 text-white text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] hover:bg-black/55 hover:border-white/75 transition-colors whitespace-nowrap shrink-0 backdrop-blur-xs cursor-pointer inline-flex items-center justify-center"
                      >
                        Discover More
                      </a>
                    </div>

                    {/* Minimal Bottom Hairline Bar (Hours + Quick Links) */}
                    <div
                      data-gsap-hero
                      className="w-full max-w-2xl mx-auto pt-4 mt-6 sm:mt-8 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[10px] sm:text-[11px] text-white/75"
                    >
                      <span className="font-mono-tabular uppercase tracking-[0.16em]">
                        {heroContent?.body || 'Open Daily 7:30 AM – 10:30 PM · Sigiriya'}
                      </span>
                      <nav
                        aria-label="Quick sanctuary navigation"
                        className="flex items-center gap-3 font-mono-tabular text-white/80"
                      >
                        <a
                          href="/story"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/story');
                          }}
                          className="hover:text-white transition-colors"
                        >
                          Sanctuary
                        </a>
                        <span className="text-white/30">·</span>
                        <a
                          href="/menu"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/menu');
                          }}
                          className="hover:text-white transition-colors"
                        >
                          Menu
                        </a>
                        <span className="text-white/30">·</span>
                        <a
                          href="/gallery"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/gallery');
                          }}
                          className="hover:text-white transition-colors"
                        >
                          Gallery
                        </a>
                        <span className="text-white/30">·</span>
                        <a
                          href="/contact"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/contact');
                          }}
                          className="hover:text-white transition-colors"
                        >
                          Contact
                        </a>
                      </nav>
                    </div>
                  </div>
                </div>

                {/* Slide Indicator Dots at bottom center */}
                {heroSlides.length > 1 && (
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2">
                    {heroSlides.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setHeroSlideIndex(idx)}
                        aria-label={`Show hero slide ${idx + 1}`}
                        className={`rounded-full transition-all cursor-pointer ${
                          idx === heroSlideIndex
                            ? 'w-2.5 h-2.5 bg-[#D9622B]'
                            : 'w-2 h-2 bg-white/45 hover:bg-white'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* 2. Crafted from Laterite Earth, Teak & Monsoon Light — 5-Photo Hover-Animated Collage */}
            <LateriteStorySection onReadMonograph={() => navigate('/story')} />

            {/* 3. Featured Culinary & Roastery Selections (Solid White, Separated into Food & Drinks, 4-in-a-Row Square Cards) */}
            <section className="relative w-full bg-white py-16 sm:py-24 lg:py-28 border-b border-[#E7DED3]">
              <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 space-y-12 sm:space-y-16">
                <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
                  <div data-gsap-menu-header className="space-y-2 max-w-2xl">
                    <div className="text-[11px] font-mono-tabular uppercase tracking-[0.22em] text-[#C65B2B] font-medium">
                      Curated Highlights
                    </div>
                    <h2 className="font-outfit text-3xl sm:text-4xl lg:text-[42px] font-normal text-[#14110E] tracking-tight leading-tight">
                      Culinary &amp; Roastery Monograph
                    </h2>
                  </div>
                  <a
                    data-gsap-menu-header
                    href="/menu"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/menu');
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono-tabular uppercase tracking-[0.18em] text-[#C65B2B] hover:text-[#14110E] transition-colors font-medium cursor-pointer"
                  >
                    <span>View Complete Dining Menu</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>

                {/* FOOD SELECTIONS */}
                {featuredFoodItems.length > 0 && (
                  <div className="space-y-6">
                    <div
                      data-gsap-menu-header
                      className="flex items-baseline justify-between border-b border-[#14110E]/10 pb-3"
                    >
                      <h3 className="font-outfit text-xl sm:text-2xl font-normal text-[#14110E] tracking-tight">
                        Food Selections
                      </h3>
                      <span className="text-xs font-mono-tabular text-[#14110E]/50">
                        {featuredFoodItems.length} dishes
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                      {featuredFoodItems.map((dish) => {
                        const flags = extractDietaryFlags(dish);
                        const primaryTag = dish.dietaryTags[0] || dish.categoryName;
                        const shortCodes = [
                          flags.isVegetarian && !flags.isVegan ? '[V]' : null,
                          flags.isVegan ? '[VG]' : null,
                          flags.isGlutenFree ? '[GF]' : null,
                          flags.isSeafood ? '[SF]' : null,
                        ].filter(Boolean);
                        const currencyMode = resolveMenuPriceCurrency(dish);
                        const priceText =
                          currencyMode === 'usd'
                            ? `$${dish.priceUsd.toFixed(2)}`
                            : `LKR ${dish.priceLkr.toLocaleString()}`;

                        const hasPhoto =
                          typeof dish.imageUrl === 'string' &&
                          /^https?:\/\//i.test(dish.imageUrl.trim());

                        return (
                          <article
                            key={dish.id}
                            data-gsap-menu-card
                            onClick={() => setHomeMenuDetailItem(dish)}
                            className="group bg-white rounded-[22px] border border-[#14110E]/10 shadow-[0_8px_28px_rgba(18,14,11,0.06)] hover:shadow-[0_18px_40px_rgba(18,14,11,0.11)] hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col justify-between aspect-square cursor-pointer overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#181512] text-white text-[9px] font-mono-tabular uppercase tracking-[0.16em] font-medium truncate max-w-[75%]">
                                {primaryTag}
                              </span>
                              {shortCodes.length > 0 && (
                                <span className="text-[10px] font-mono-tabular text-[#14110E]/55 shrink-0">
                                  {shortCodes.join(' ')}
                                </span>
                              )}
                            </div>

                            {hasPhoto && (
                              <div className="mt-3 rounded-xl overflow-hidden aspect-[16/10] w-full bg-[#EAE2D6] border border-[#14110E]/8 shrink-0">
                                <EditorialVisual
                                  src={dish.imageUrl}
                                  alt={dish.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              </div>
                            )}

                            <div className="my-auto py-3 space-y-2">
                              <h4 className="font-outfit text-xl font-normal text-[#14110E] leading-snug tracking-tight group-hover:text-[#C65B2B] transition-colors line-clamp-2">
                                {dish.name}
                              </h4>
                              <p
                                className={`text-[13px] text-[#14110E]/65 font-light leading-relaxed ${
                                  hasPhoto ? 'line-clamp-2' : 'line-clamp-3'
                                }`}
                              >
                                {dish.description}
                              </p>
                            </div>

                            <div className="pt-3.5 border-t border-[#14110E]/8 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-mono-tabular uppercase tracking-[0.12em] font-semibold text-[#C65B2B] tabular-nums">
                                {priceText}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#C65B2B] group-hover:translate-x-0.5 transition-transform">
                                <span>Details</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DRINKS & COFFEE */}
                {featuredDrinkItems.length > 0 && (
                  <div className="space-y-6">
                    <div
                      data-gsap-menu-header
                      className="flex items-baseline justify-between border-b border-[#14110E]/10 pb-3"
                    >
                      <h3 className="font-outfit text-xl sm:text-2xl font-normal text-[#14110E] tracking-tight">
                        Drinks &amp; Coffee
                      </h3>
                      <span className="text-xs font-mono-tabular text-[#14110E]/50">
                        {featuredDrinkItems.length} drinks
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                      {featuredDrinkItems.map((drink) => {
                        const flags = extractDietaryFlags(drink);
                        const primaryTag = drink.dietaryTags[0] || drink.categoryName;
                        const shortCodes = [
                          flags.isVegan ? '[VG]' : null,
                          flags.isGlutenFree ? '[GF]' : null,
                        ].filter(Boolean);
                        const currencyMode = resolveMenuPriceCurrency(drink);
                        const priceText =
                          currencyMode === 'usd'
                            ? `$${drink.priceUsd.toFixed(2)}`
                            : `LKR ${drink.priceLkr.toLocaleString()}`;

                        const hasPhoto =
                          typeof drink.imageUrl === 'string' &&
                          /^https?:\/\//i.test(drink.imageUrl.trim());

                        return (
                          <article
                            key={drink.id}
                            data-gsap-menu-card
                            onClick={() => setHomeMenuDetailItem(drink)}
                            className="group bg-white rounded-[22px] border border-[#14110E]/10 shadow-[0_8px_28px_rgba(18,14,11,0.06)] hover:shadow-[0_18px_40px_rgba(18,14,11,0.11)] hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col justify-between aspect-square cursor-pointer overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#181512] text-white text-[9px] font-mono-tabular uppercase tracking-[0.16em] font-medium truncate max-w-[75%]">
                                {primaryTag}
                              </span>
                              {shortCodes.length > 0 && (
                                <span className="text-[10px] font-mono-tabular text-[#14110E]/55 shrink-0">
                                  {shortCodes.join(' ')}
                                </span>
                              )}
                            </div>

                            {hasPhoto && (
                              <div className="mt-3 rounded-xl overflow-hidden aspect-[16/10] w-full bg-[#EAE2D6] border border-[#14110E]/8 shrink-0">
                                <EditorialVisual
                                  src={drink.imageUrl}
                                  alt={drink.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              </div>
                            )}

                            <div className="my-auto py-3 space-y-2">
                              <h4 className="font-outfit text-xl font-normal text-[#14110E] leading-snug tracking-tight group-hover:text-[#C65B2B] transition-colors line-clamp-2">
                                {drink.name}
                              </h4>
                              <p
                                className={`text-[13px] text-[#14110E]/65 font-light leading-relaxed ${
                                  hasPhoto ? 'line-clamp-2' : 'line-clamp-3'
                                }`}
                              >
                                {drink.description}
                              </p>
                            </div>

                            <div className="pt-3.5 border-t border-[#14110E]/8 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-mono-tabular uppercase tracking-[0.12em] font-semibold text-[#C65B2B] tabular-nums">
                                {priceText}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#C65B2B] group-hover:translate-x-0.5 transition-transform">
                                <span>Details</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Clean Text-Only Detail Modal for Home Menu Cards */}
              {homeMenuDetailItem && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                  role="dialog"
                  aria-modal="true"
                  aria-label={homeMenuDetailItem.name}
                >
                  <div
                    onClick={() => setHomeMenuDetailItem(null)}
                    className="absolute inset-0 bg-[#120E0B]/60 backdrop-blur-xs"
                  />
                  <div className="relative w-full max-w-lg bg-white rounded-3xl p-7 sm:p-9 shadow-2xl border border-[#120E0B]/10 z-10 space-y-5">
                    <button
                      type="button"
                      onClick={() => setHomeMenuDetailItem(null)}
                      aria-label="Close item details"
                      className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#120E0B]/5 hover:bg-[#120E0B]/12 text-[#120E0B] flex items-center justify-center transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="space-y-1.5 border-b border-[#120E0B]/10 pb-4 pr-8">
                      <span className="text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.2em] text-[#C65B2B] block">
                        {resolveMenuItemSection(homeMenuDetailItem, menuCategories) === 'drinks'
                          ? 'Drinks & Coffee'
                          : 'Food Selections'}{' '}
                        · {homeMenuDetailItem.categoryName}
                      </span>
                      <h3 className="font-outfit text-2xl sm:text-3xl font-normal text-[#120E0B] tracking-tight">
                        {homeMenuDetailItem.name}
                      </h3>
                      <div className="flex items-baseline gap-3 pt-1 font-mono-tabular">
                        <span className="text-lg font-semibold text-[#120E0B]">
                          LKR {homeMenuDetailItem.priceLkr.toLocaleString()}
                        </span>
                        {homeMenuDetailItem.priceUsd > 0 && (
                          <span className="text-xs text-[#120E0B]/55">
                            (USD ${homeMenuDetailItem.priceUsd.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    {homeMenuDetailItem.imageUrl &&
                      /^https?:\/\//i.test(homeMenuDetailItem.imageUrl.trim()) && (
                        <div className="rounded-2xl overflow-hidden aspect-[16/10] w-full bg-[#EAE2D6] border border-[#120E0B]/10">
                          <EditorialVisual
                            src={homeMenuDetailItem.imageUrl}
                            alt={homeMenuDetailItem.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                    <p className="text-sm text-[#120E0B]/80 font-light leading-relaxed">
                      {homeMenuDetailItem.description}
                    </p>

                    {homeMenuDetailItem.dietaryTags.length > 0 && (
                      <div className="text-xs text-[#120E0B]/65 font-light">
                        {homeMenuDetailItem.dietaryTags.join(' · ')}
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setHomeMenuDetailItem(null)}
                        className="px-5 py-2.5 rounded-full border border-[#120E0B]/20 text-[#120E0B] font-outfit text-xs font-semibold uppercase tracking-wider hover:border-[#120E0B] transition cursor-pointer"
                      >
                        Close
                      </button>
                      <div className="flex items-center gap-2">
                        <a
                          href="/menu"
                          onClick={(e) => {
                            e.preventDefault();
                            setHomeMenuDetailItem(null);
                            navigate('/menu');
                          }}
                          className="px-5 py-2.5 rounded-full border border-[#120E0B]/20 text-[#120E0B] font-outfit text-xs font-semibold uppercase tracking-wider hover:border-[#120E0B] transition cursor-pointer"
                        >
                          Full Menu
                        </a>
                        <a
                          href="/reserve"
                          onClick={(e) => {
                            e.preventDefault();
                            setHomeMenuDetailItem(null);
                            handleReserveCtaClick();
                          }}
                          className="px-5 py-2.5 rounded-full bg-[#C65B2B] hover:bg-[#B04E22] text-white font-outfit text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
                        >
                          Reserve Table
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 4. The Golden Hour Culinary Feature (Admin-Editable via siteContent: golden_hour) */}
            <section className="w-full bg-[#120E0B] text-white py-20 sm:py-28 lg:py-32">
              <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
                <div className="lg:col-span-6">
                  <div className="rounded-[24px] overflow-hidden border border-white/10 bg-[#1C1612] aspect-[4/3] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                    <EditorialVisual
                      src={resolveSectionImageUrl('golden_hour')}
                      alt={goldenHourContent?.heading || 'OneLove Café Sigiriya culinary showcase'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="lg:col-span-6 space-y-6">
                  <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#E6DDD3]">
                    {goldenHourContent?.kicker || 'The Golden Hour'}
                  </div>
                  <h2 className="font-outfit text-4xl sm:text-5xl lg:text-[54px] font-normal text-white leading-[1.06] tracking-[-0.02em]">
                    {goldenHourContent?.heading || 'Fresh from the Sigiriya valley.'}
                  </h2>
                  <p className="text-sm sm:text-[15px] text-[#CFC5B9] leading-relaxed font-light max-w-md">
                    {goldenHourContent?.body ||
                      'Harvested daily from Dry Zone gardens and highland roasters, prepared with care and served beneath the palms on our open-air verandah.'}
                  </p>
                  <div className="pt-2">
                    <a
                      href={goldenHourContent?.ctaLink || '/menu'}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(goldenHourContent?.ctaLink || '/menu');
                      }}
                      className="inline-flex items-center justify-center min-h-[44px] px-7 py-3 rounded-full bg-[#C65B2B] hover:bg-[#B04E22] text-white text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer"
                    >
                      {goldenHourContent?.ctaLabel || 'Explore Evening Menu'}
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Atmosphere & Spaces Section (Admin-Editable via siteContent: atmosphere) */}
            <section className="w-full bg-[#F5F1EB] text-[#14110E] py-20 sm:py-28 lg:py-32">
              <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
                <div className="lg:col-span-5 space-y-5">
                  <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white border border-[#E7DED3] text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#C65B2B]">
                    {atmosphereContent?.kicker || 'Atmosphere & Spaces'}
                  </div>
                  <h2 className="font-outfit text-4xl sm:text-5xl lg:text-[48px] font-normal text-[#14110E] leading-[1.08] tracking-[-0.02em]">
                    {atmosphereContent?.heading || 'Teak, Woven Textures, and Tropical Light'}
                  </h2>
                  <p className="text-sm sm:text-[15px] text-[#5C544D] leading-[1.75] font-light max-w-md">
                    {atmosphereContent?.body ||
                      'Natural woven lamps, warm reclaimed teak details, candlelit corners, and an open Sigiriya breeze create a relaxed setting where mornings and evenings unfold naturally.'}
                  </p>
                </div>

                <div className="lg:col-span-7">
                  <div className="rounded-[24px] border-[4px] border-white shadow-[0_20px_50px_rgba(20,16,12,0.09)] overflow-hidden aspect-[16/10] bg-[#EAE2D6]">
                    <EditorialVisual
                      src={resolveSectionImageUrl('atmosphere')}
                      alt={
                        atmosphereContent?.heading ||
                        'OneLove Café Sigiriya warm teak and tropical light atmosphere'
                      }
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 6. Gallery Section — Life Beneath the Rock (Admin-Editable via Gallery Tab) */}
            <section className="w-full bg-[#FAF8F5] text-[#14110E] py-20 sm:py-28 lg:py-32 border-t border-[#EAE2D6]">
              <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 space-y-10 sm:space-y-12">
                <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white border border-[#E7DED3] text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#C65B2B]">
                      Life at OneLove
                    </div>
                    <h2 className="font-outfit text-4xl sm:text-5xl lg:text-[52px] font-normal text-[#14110E] leading-[1.06] tracking-[-0.02em]">
                      Life Beneath the Rock
                    </h2>
                  </div>

                  <a
                    href="/gallery"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/gallery');
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono-tabular uppercase tracking-[0.18em] text-[#C65B2B] hover:text-[#14110E] font-medium transition-colors cursor-pointer"
                  >
                    <span>Explore Visual Archive</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                  {homeGalleryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLightboxItem(item)}
                      aria-label={`View ${item.title}`}
                      className="group relative aspect-square rounded-[22px] overflow-hidden bg-[#EAE2D6] shadow-[0_10px_28px_rgba(20,16,12,0.06)] hover:shadow-[0_18px_40px_rgba(20,16,12,0.12)] transition-all duration-300 cursor-pointer block w-full text-left"
                    >
                      <EditorialVisual
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 7. Home Page Reservation Section (#reserve-section — Admin-Editable via siteContent: home_reserve) */}
            <section
              id="reserve-section"
              className="scroll-mt-20 w-full bg-[#14100C] text-[#F8F4EE] py-20 sm:py-28 lg:py-32"
            >
              <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
                {/* Left Editorial Column */}
                <div data-gsap-reserve className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/15 text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#D89A78]">
                    {homeReserveContent?.kicker || 'Effortless Dining'}
                  </div>
                  <h2 className="font-outfit text-4xl sm:text-5xl lg:text-[56px] font-normal text-white leading-[1.06] tracking-[-0.02em] max-w-lg">
                    {homeReserveContent?.heading || 'Make the evening feel effortless.'}
                  </h2>
                  <p className="text-sm sm:text-[15px] text-[#BFAEA0] leading-relaxed font-light max-w-xl">
                    {homeReserveContent?.body ||
                      'Reserve your table online in seconds. Choose your preferred dining area—from leafy garden shade to candlelit verandah tables beneath the Sigiriya palms.'}
                  </p>

                  {/* Three Clean Ritual Timing Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                    {[
                      {
                        kicker: 'Ritual 01',
                        title: 'Sunrise Roast & Brunch',
                        hours: '7:30 AM – 11:30 AM',
                      },
                      {
                        kicker: 'Ritual 02',
                        title: 'Golden Hour Verandah',
                        hours: '4:00 PM – 6:30 PM',
                      },
                      {
                        kicker: 'Ritual 03',
                        title: 'Candlelit Hearth Dining',
                        hours: '6:30 PM – 10:30 PM',
                      },
                    ].map((ritual) => (
                      <div
                        key={ritual.kicker}
                        className="rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-4 space-y-1.5"
                      >
                        <div className="text-[9px] font-mono-tabular uppercase tracking-[0.2em] text-[#C86634]">
                          {ritual.kicker}
                        </div>
                        <div className="text-xs font-medium text-white leading-snug">
                          {ritual.title}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-white/55">
                          {ritual.hours}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Primary & WhatsApp Concierge Buttons */}
                  <div className="flex flex-wrap items-center gap-3.5 pt-2">
                    <a
                      href="/reserve"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/reserve');
                      }}
                      className="inline-flex items-center justify-center gap-2 min-h-[46px] px-7 py-3 rounded-full bg-[#C65B2B] hover:bg-[#B04E22] text-white text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer"
                    >
                      <span>{homeReserveContent?.ctaLabel || 'Select Table on Floor Plan'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${(settings.whatsapp || '+94778429100').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 rounded-full bg-transparent border border-white/20 hover:border-white/50 text-white text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#C86634]" />
                      <span>WhatsApp Concierge</span>
                    </a>
                  </div>
                </div>

                {/* Right Elevated Cream Quick-Booking Card */}
                <div data-gsap-reserve className="lg:col-span-5">
                  <div className="bg-[#FAF7F2] text-[#171310] rounded-[28px] p-7 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] space-y-6">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-4 border-b border-[#171310]/10 pb-5">
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono-tabular uppercase tracking-[0.2em] text-[#C65B2B] font-medium">
                          Direct Concierge
                        </div>
                        <h3 className="font-outfit text-2xl sm:text-[26px] font-normal text-[#171310] leading-snug tracking-tight">
                          {homeReserveContent?.subheading || 'Reserve Your Sanctuary Table'}
                        </h3>
                        <p className="text-xs text-[#171310]/55 font-light">
                          Direct table assignment · Zero reservation fees
                        </p>
                      </div>
                      <div
                        aria-hidden="true"
                        className="w-11 h-11 rounded-full bg-[#C65B2B] text-white flex items-center justify-center shrink-0"
                      >
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Preferred Time of Evening */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-mono-tabular uppercase tracking-[0.18em] text-[#171310]/55">
                        Preferred Time of Evening
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { label: '7:00 PM', value: '19:00' },
                          { label: '8:00 PM', value: '20:00' },
                          { label: '9:00 PM', value: '21:00' },
                        ].map((slot) => {
                          const isSelected = homeReserveTime === slot.value;
                          return (
                            <button
                              key={slot.value}
                              type="button"
                              onClick={() => setHomeReserveTime(slot.value)}
                              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-mono-tabular font-medium border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#C65B2B] text-white border-[#C65B2B]'
                                  : 'bg-white text-[#171310] border-[#E6DDD2] hover:border-[#C65B2B]/50'
                              }`}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Party Size */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-mono-tabular uppercase tracking-[0.18em] text-[#171310]/55">
                        Party Size
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { label: '2 Guests', value: 2 },
                          { label: '4 Guests', value: 4 },
                          { label: '6+ Group', value: 6 },
                        ].map((opt) => {
                          const isSelected = homeReserveGuests === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setHomeReserveGuests(opt.value)}
                              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#C65B2B] text-white border-[#C65B2B]'
                                  : 'bg-white text-[#171310] border-[#E6DDD2] hover:border-[#C65B2B]/50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Live Selection Summary Row */}
                    <div className="rounded-xl bg-white border border-[#E6DDD2] px-4 py-3 flex items-center justify-between text-xs text-[#171310] font-medium">
                      <span className="inline-flex items-center gap-2 font-mono-tabular">
                        <Clock className="w-3.5 h-3.5 text-[#C65B2B]" />
                        <span>
                          Today,{' '}
                          {homeReserveTime === '19:00'
                            ? '7:00 PM'
                            : homeReserveTime === '20:00'
                            ? '8:00 PM'
                            : homeReserveTime === '21:00'
                            ? '9:00 PM'
                            : '7:30 PM'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2 font-mono-tabular">
                        <Users className="w-3.5 h-3.5 text-[#C65B2B]" />
                        <span>
                          {homeReserveGuests === 6 ? '6+ Guests' : `${homeReserveGuests} Guests`}
                        </span>
                      </span>
                    </div>

                    {/* Choose Table on Floor Plan CTA */}
                    <a
                      href="/reserve"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/reserve');
                      }}
                      className="w-full min-h-[48px] py-3.5 px-5 rounded-xl bg-[#C65B2B] hover:bg-[#B04E22] text-white text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.18em] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Choose Table on Floor Plan</span>
                      <span aria-hidden="true">↗</span>
                    </a>

                    {/* Reassurance Notes */}
                    <div className="space-y-2 pt-1 text-xs text-[#171310]/65 font-light">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#C65B2B] shrink-0" />
                        <span>Instant confirmation sent via SMS / Email</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#C65B2B] shrink-0" />
                        <span>Select garden, lounge, or candlelit dining zone</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Clean Google Maps Location Window (Admin-editable, strictly no controls/clutter in window) */}
            <SanctuaryMap settings={settings} />

            {/* 8. Find Us in Sigiriya — Two-Card Location & Sanctuary Proximity Section (Admin-Editable via siteContent: find_us) */}
            <section className="w-full bg-[#FAF7F2] text-[#14110E] py-20 sm:py-28 lg:py-32">
              <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
                {/* Centered Section Header */}
                <div data-gsap-voice className="text-center max-w-2xl mx-auto space-y-3">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-[0.26em] text-[#C65B2B] font-medium">
                    {findUsContent?.kicker || 'Find Us in Sigiriya'}
                  </div>
                  <h2 className="font-outfit text-4xl sm:text-5xl lg:text-[52px] font-normal text-[#14110E] tracking-[-0.02em] leading-[1.08]">
                    {findUsContent?.heading || 'Lion Rock Road, Sigiriya'}
                  </h2>
                  <p className="text-sm sm:text-[15px] text-[#665E57] font-light leading-relaxed max-w-xl mx-auto pt-1">
                    {findUsContent?.body ||
                      'Located in Kimbissa along Lion Rock Sanctuary Road, just minutes from Sigiriya Lion Rock Fortress. An easy-to-find spot for specialty coffee, island plates, and unhurried evenings.'}
                  </p>
                </div>

                {/* Two Equal Side-by-Side Rounded Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mt-12 sm:mt-16 max-w-5xl mx-auto">
                  {/* Left Card: Pure White Elevated Location & Hours Card */}
                  <div
                    data-gsap-voice
                    className="bg-white rounded-[28px] border border-[#EAE2D6] shadow-[0_14px_38px_rgba(20,16,12,0.05)] p-8 sm:p-10 flex flex-col justify-between space-y-8"
                  >
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#C65B2B] font-medium">
                          Sanctuary Location &amp; Hours
                        </div>
                        <h3 className="font-outfit text-2xl sm:text-[30px] font-normal text-[#14110E] tracking-[-0.015em] leading-snug">
                          {settings.cafeName || 'OneLove Café'} Sigiriya
                        </h3>
                        <p className="text-sm text-[#665E57] font-light leading-relaxed">
                          Easy to reach by road along Lion Rock Sanctuary Road in Kimbissa, just 1.5
                          km west of Sigiriya Lion Rock Fortress.
                        </p>
                      </div>

                      <div className="pt-6 border-t border-[#EAE2D6] space-y-3.5 text-sm text-[#4A433D] font-light">
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-[#C65B2B] shrink-0 mt-0.5" />
                          <span>Daily Service: 7:30 AM – 10:30 PM</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-[#C65B2B] shrink-0 mt-0.5" />
                          <span>
                            {settings.address ||
                              'Lion Rock Sanctuary Road, Kimbissa, Sigiriya, Sri Lanka'}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-[#C65B2B] shrink-0 mt-0.5" />
                          <span className="font-mono-tabular">
                            Concierge: {settings.phone || settings.whatsapp || '+94 66 228 6420'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <a
                        href={OFFICIAL_ONELOVE_MAPS_PLACE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-full bg-[#C65B2B] hover:bg-[#B04E22] text-white text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.15em] transition-colors cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Open in Google Maps</span>
                      </a>
                      <a
                        href={`tel:${(settings.phone || settings.whatsapp || '+94662286420').replace(/[^0-9+]/g, '')}`}
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full bg-white border border-[#E5DDD2] hover:border-[#14110E] text-[#14110E] text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.15em] transition-colors cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#14110E]/75" />
                        <span>Call Desk</span>
                      </a>
                    </div>
                  </div>

                  {/* Right Card: Warm Sand Sanctuary Trail Proximity Card */}
                  <div
                    data-gsap-voice
                    className="bg-[#F3EEE6] rounded-[28px] border border-[#E7DFD3] shadow-[0_14px_38px_rgba(20,16,12,0.04)] p-8 sm:p-10 flex flex-col justify-between space-y-8"
                  >
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#665E57] font-medium">
                          Sanctuary Trail Proximity
                        </div>
                        <h3 className="font-outfit text-2xl sm:text-[30px] font-normal text-[#14110E] tracking-[-0.015em] leading-snug">
                          {findUsContent?.subheading || 'Two Landmarks. One Island Spirit.'}
                        </h3>
                        <p className="text-sm text-[#665E57] font-light leading-relaxed">
                          Unwind after your sunrise climb up Pidurangala Rock or an afternoon at
                          Sigiriya Lion Rock Fortress with single-estate Ceylon coffee, wood-fired
                          plates, and shaded garden tables.
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl border border-[#EAE2D6] p-5 space-y-2">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-mono-tabular uppercase tracking-[0.18em]">
                          <span className="text-[#14110E] font-semibold">
                            Distance From Lion Rock:
                          </span>
                          <span className="text-[#C65B2B] font-semibold">
                            {findUsContent?.ctaLabel || '1.5 Kilometers'}
                          </span>
                        </div>
                        <p className="text-xs text-[#665E57] font-light leading-relaxed">
                          A gentle 4-minute tuk-tuk ride or scenic 15-minute stroll along Kimbissa
                          Road connects both ancient rock trails to our garden tables.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <a
                        href={findUsContent?.ctaLink || '/story'}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(findUsContent?.ctaLink || '/story');
                        }}
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-full bg-transparent border border-[#14110E] hover:bg-[#14110E] hover:text-white text-[#14110E] text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.15em] transition-colors cursor-pointer"
                      >
                        <span>Explore Our Story</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                      <a
                        href={OFFICIAL_ONELOVE_MAPS_PLACE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full bg-white border border-[#E5DDD2] hover:border-[#14110E] text-[#14110E] text-[11px] font-mono-tabular font-semibold uppercase tracking-[0.15em] transition-colors cursor-pointer"
                      >
                        <span>Directions Link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ==================== OUR MENU PAGE (/menu) ==================== */}
        {routeInfo.page === 'menu' && (
          <MenuPage
            settings={settings}
            openingHours={openingHours}
            menuCategories={menuCategories}
            menuItems={menuItems}
            onNavigate={navigate}
          />
        )}

        {/* ==================== OUR STORY PAGE (/story) ==================== */}
        {routeInfo.page === 'story' && (
          <div>
            <LateriteStorySection showMonographButton={false} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-24 space-y-12 sm:space-y-20">
              <div
                data-gsap-subpage
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-stretch"
              >
                <div className="lg:col-span-7 min-h-[260px] sm:min-h-[420px] bg-white border border-[#E7DED3] p-2.5 sm:p-3">
                  <EditorialVisual
                    src={resolveSectionImageUrl('story', 'story_collage_1')}
                    alt={storyContent?.heading || 'Sigiriya sanctuary architecture at dusk'}
                    className="h-full"
                  />
                </div>
              <div className="lg:col-span-5 bg-white border border-[#E7DED3] p-6 sm:p-10 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="text-xs uppercase tracking-widest text-[#58644E] font-medium">
                    Earth, Timber &amp; Craft
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
                    Four Distinct Dining Atmospheres
                  </h2>
                  <p className="text-xs text-[#171513]/75 leading-relaxed">
                    Whether you seek a quiet morning corner with a laptop and a V60 carafe, or a
                    candlelit celebration table beside our wood-fired hearth, each zone of OneLove
                    Café is tuned to the time of day.
                  </p>
                </div>

                <div className="divide-y divide-[#E7DED3] text-xs">
                  {zones.map((z, idx) => (
                    <div key={z.id} className="py-3.5 space-y-1">
                      <div className="font-semibold text-sm text-[#171513]">
                        0{idx + 1}. {z.name}
                      </div>
                      <div className="text-[#58644E]">{z.atmosphere}</div>
                      <p className="text-[#171513]/65">{z.description}</p>
                    </div>
                  ))}
                </div>

                <a
                  href="/reserve"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/reserve');
                  }}
                  className="w-full min-h-[44px] py-3 bg-[#C65B2B] text-white text-xs uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors inline-flex items-center justify-center text-center"
                >
                  Choose Your Zone on the Floor Plan
                </a>
              </div>
            </div>

            {/* Secondary Story / Concierge Hospitality Showcase (Image editable via sectionKey: concierge) */}
            {conciergeContent && (
              <div
                data-gsap-subcard
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center bg-white border border-[#E7DED3] p-6 sm:p-10"
              >
                <div className="lg:col-span-6 space-y-4">
                  <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                    {conciergeContent.kicker}
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-editorial font-normal">
                    {conciergeContent.heading}
                  </h2>
                  <p className="text-sm text-[#58644E]">{conciergeContent.subheading}</p>
                  <p className="text-xs text-[#171513]/75 leading-relaxed">
                    {conciergeContent.body}
                  </p>
                </div>
                <div className="lg:col-span-6 aspect-[16/10] border border-[#E7DED3] overflow-hidden bg-[#F8F4EE]">
                  <EditorialVisual
                    src={resolveSectionImageUrl('concierge', 'story_collage_2')}
                    alt={conciergeContent.heading}
                  />
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* ==================== GALLERY PAGE (/gallery) ==================== */}
        {routeInfo.page === 'gallery' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-24 space-y-8 sm:space-y-12">
            <div
              data-gsap-subpage
              className="border-b border-[#E7DED3] pb-6 sm:pb-8 flex flex-wrap items-end justify-between gap-4 sm:gap-6"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                  Visual Archive · OneLove Café Sigiriya
                </div>
                <h1 className="text-3xl sm:text-6xl font-editorial font-normal">
                  Sanctuary Gallery
                </h1>
              </div>

              <div className="flex items-center gap-1.5 bg-[#EFE9DF] p-1 border border-[#E7DED3] overflow-x-auto max-w-full">
                {[
                  'All',
                  'Architecture',
                  'Culinary',
                  'Coffee & Botanicals',
                  'Evening Sanctuary',
                  'Sigiriya Surroundings',
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedGalleryCat(cat)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedGalleryCat === cat
                        ? 'bg-[#171513] text-[#F8F4EE]'
                        : 'text-[#171513]/70 hover:text-[#171513]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredGallery.map((item) => (
                <div
                  key={item.id}
                  data-gsap-subcard
                  onClick={() => setLightboxItem(item)}
                  className="bg-white border border-[#E7DED3] p-3 cursor-pointer group space-y-3 hover:-translate-y-1.5 hover:shadow-[0_18px_36px_rgba(23,21,19,0.1)] transition-all duration-300"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[#EAE2D6]">
                    <EditorialVisual
                      src={item.imageUrl}
                      alt={item.title}
                      className="group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  </div>
                  <div className="px-2 pb-2 space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-[#58644E]">
                      {item.category}
                    </div>
                    <h2 className="text-lg font-editorial font-semibold group-hover:text-[#C65B2B] transition-colors">{item.title}</h2>
                    <p className="text-xs text-[#171513]/65">{item.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== EXPERIENCES & EVENTS PAGE (/events) ==================== */}
        {routeInfo.page === 'events' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-24 space-y-10 sm:space-y-14">
            <div data-gsap-subpage className="border-b border-[#E7DED3] pb-6 sm:pb-8 space-y-3 max-w-3xl">
              <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                Sanctuary Gatherings &amp; Cultural Programming
              </div>
              <h1 className="text-3xl sm:text-6xl font-editorial font-semibold text-[#171513]">
                Experiences &amp; Weekly Rituals
              </h1>
              <p className="text-xs sm:text-sm text-[#171513]/75 leading-relaxed font-light">
                From guided highland coffee cuppings in our roastery to candlelit Thursday &amp;
                Saturday acoustic hearth sessions beneath the palms.
              </p>
            </div>

            <div className="space-y-6 sm:space-y-8">
              {events
                .filter((e) => e.isActive)
                .map((evt) => (
                  <div
                    key={evt.id}
                    data-gsap-subcard
                    className="bg-white border border-[#E7DED3] grid grid-cols-1 lg:grid-cols-12 items-stretch shadow-xs hover:shadow-[0_16px_36px_rgba(23,21,19,0.08)] transition-shadow duration-300"
                  >
                    <div className="lg:col-span-5 min-h-[220px] sm:min-h-[260px] border-b lg:border-b-0 lg:border-r border-[#E7DED3]">
                      <EditorialVisual
                        src={evt.imageUrl}
                        alt={evt.title}
                        className="h-full"
                      />
                    </div>
                    <div className="lg:col-span-7 p-5 sm:p-10 flex flex-col justify-between space-y-5 sm:space-y-6">
                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-widest text-[#58644E] font-mono-tabular font-medium">
                          {evt.category} · {evt.date} · {evt.time}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">{evt.title}</h2>
                        <p className="text-xs sm:text-sm text-[#171513]/75 leading-relaxed font-light">
                          {evt.description}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-[#E7DED3] flex flex-wrap items-center justify-between gap-4">
                        <span className="text-xs font-mono-tabular font-semibold text-[#171513]">
                          {evt.priceInfo}
                        </span>
                        <a
                          href="/reserve"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/reserve');
                          }}
                          className="w-full sm:w-auto justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#B04E22] transition-colors shadow-sm cursor-pointer inline-flex items-center"
                        >
                          Reserve Table for Event
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ==================== CONTACT & LOCATION PAGE (/contact) ==================== */}
        {routeInfo.page === 'contact' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-24 space-y-10 sm:space-y-16">
            <div data-gsap-subpage className="border-b border-[#E7DED3] pb-6 sm:pb-8 space-y-3 max-w-3xl">
              <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                Concierge Desk &amp; Directions · Sigiriya, Sri Lanka
              </div>
              <h1 className="text-3xl sm:text-6xl font-editorial font-normal">
                Visit the Sanctuary
              </h1>
              <p className="text-xs sm:text-sm text-[#171513]/70">
                Located along Lion Rock Sanctuary Road in Kimbissa, 6 minutes from the Sigiriya
                World Heritage Fortress and Pidurangala Rock trailhead.
              </p>
            </div>

            <div data-gsap-subpage className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10">
              {/* Contact Information & Opening Hours */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white border border-[#E7DED3] p-5 sm:p-7 space-y-5 text-xs">
                  <div className="space-y-1">
                    <div className="uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Sanctuary Address
                    </div>
                    <div className="text-sm font-medium flex items-start gap-2 pt-1">
                      <MapPin className="w-4 h-4 text-[#C65B2B] shrink-0 mt-0.5" />
                      <span>{settings.address}</span>
                    </div>
                    <div className="font-mono-tabular text-[#171513]/55 pl-6">
                      GPS: {settings.coordinates}
                    </div>
                  </div>

                  <div className="space-y-1 pt-3 border-t border-[#E7DED3]">
                    <div className="uppercase tracking-widest text-[#58644E] font-semibold">
                      Direct Host Desk &amp; WhatsApp
                    </div>
                    <div className="font-mono-tabular text-sm font-medium flex items-center gap-2 pt-1">
                      <Phone className="w-4 h-4 text-[#58644E]" />
                      <span>{settings.phone}</span>
                    </div>
                    <div className="pt-2 flex flex-wrap gap-2">
                      <a
                        href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[40px] px-4 py-2 bg-[#58644E] text-white uppercase tracking-wider font-medium inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Chat on WhatsApp
                      </a>
                      <a
                        href={OFFICIAL_ONELOVE_MAPS_PLACE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[40px] px-4 py-2 border border-[#171513] text-[#171513] uppercase tracking-wider font-medium inline-flex items-center gap-1.5"
                      >
                        <Compass className="w-3.5 h-3.5" /> Google Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-[#E7DED3]">
                    <div className="uppercase tracking-widest text-[#171513]/60 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Weekly Hours
                    </div>
                    <div className="divide-y divide-[#E7DED3]/60 font-mono-tabular">
                      {openingHours.map((oh) => (
                        <div key={oh.id} className="py-1.5 flex justify-between gap-2">
                          <span>{oh.dayOfWeek}</span>
                          <span>
                            {oh.isOpen ? `${oh.openTime} – ${oh.closeTime}` : 'Closed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Validated Inquiry Form */}
              <div className="lg:col-span-7 bg-white border border-[#E7DED3] p-5 sm:p-10">
                <h2 className="text-2xl font-editorial font-semibold mb-2">
                  Send a Concierge or Private Dining Inquiry
                </h2>
                <p className="text-xs text-[#171513]/65 mb-6">
                  Inquire about private group dinners, custom celebration cakes, or tuk-tuk transfers
                  from Habarana, Dambulla, and Kandalama.
                </p>

                {inqStatus === 'sent' ? (
                  <div className="p-6 bg-[#F8F4EE] border border-[#58644E] space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-[#58644E] font-semibold text-sm">
                      <CheckCircle2 className="w-5 h-5" /> Inquiry Dispatched to Our Host Desk
                    </div>
                    <p className="text-[#171513]/75">
                      Thank you for reaching out to OneLove Café Sigiriya. Your message has been
                      stored in Firestore and our hospitality concierge will respond shortly.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setInqStatus('idle');
                        setInqMessage('');
                      }}
                      className="px-4 py-2 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setInqStatus('sending');
                      setInqError('');
                      try {
                        await submitInquiry({
                          name: inqName,
                          email: inqEmail,
                          phone: inqPhone,
                          subject: inqSubject,
                          message: inqMessage,
                        });
                        setInqStatus('sent');
                      } catch (err) {
                        setInqStatus('error');
                        setInqError(
                          err instanceof Error ? err.message : 'Unable to send inquiry.'
                        );
                      }
                    }}
                    className="space-y-4 text-xs"
                  >
                    {inqStatus === 'error' && (
                      <div className="p-3 bg-[#FDF3EF] border border-[#C65B2B] text-[#9E3F16]">
                        {inqError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block uppercase tracking-wider text-[#171513]/70 mb-1">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={inqName}
                          onChange={(e) => setInqName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                      </div>
                      <div>
                        <label className="block uppercase tracking-wider text-[#171513]/70 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={inqEmail}
                          onChange={(e) => setInqEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block uppercase tracking-wider text-[#171513]/70 mb-1">
                          WhatsApp / Phone
                        </label>
                        <input
                          type="tel"
                          value={inqPhone}
                          onChange={(e) => setInqPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="block uppercase tracking-wider text-[#171513]/70 mb-1">
                          Topic
                        </label>
                        <select
                          value={inqSubject}
                          onChange={(e) => setInqSubject(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F8F4EE] border border-[#E7DED3]"
                        >
                          <option value="Private Sanctuary Dining & Concierge">
                            Private Sanctuary Dining &amp; Concierge
                          </option>
                          <option value="Large Group Reservation (8+ Guests)">
                            Large Group Reservation (8+ Guests)
                          </option>
                          <option value="Hospitality & Tour Partnership">
                            Hospitality &amp; Tour Partnership
                          </option>
                          <option value="Roastery Wholesale & Press">
                            Roastery Wholesale &amp; Press
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block uppercase tracking-wider text-[#171513]/70 mb-1">
                        Message *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={inqMessage}
                        onChange={(e) => setInqMessage(e.target.value)}
                        placeholder="Tell us about your travel dates, group size, or special requests..."
                        className="w-full px-3.5 py-2.5 bg-[#F8F4EE] border border-[#E7DED3]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={inqStatus === 'sending'}
                      className="w-full sm:w-auto min-h-[44px] px-7 py-3 bg-[#C65B2B] text-white uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors"
                    >
                      {inqStatus === 'sending' ? 'Sending to Host Desk...' : 'Submit Inquiry'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== DEDICATED RESERVE PAGE (/reserve & /reserve/voucher/:code) ==================== */}
        {routeInfo.page === 'reserve' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-20 space-y-8 sm:space-y-10">
            <div data-gsap-subpage className="text-center max-w-2xl mx-auto space-y-3">
              <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                Table Reservations · OneLove Café Sigiriya
              </div>
              <h1 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#171513]">
                Reserve Your Sanctuary Table
              </h1>
              <p className="text-xs sm:text-sm text-[#171513]/70">
                Select your date, sitting time, and exact table on our live interactive floor plan.
              </p>
              <div className="text-[11px] sm:text-xs font-mono-tabular text-[#171513]/55">
                {settings.coordinates} · Open Daily 7:30 AM – 10:30 PM · {settings.gracePeriodMinutes}-Min Arrival Grace
              </div>
            </div>

            <div data-gsap-subpage>
              <ReservationEngine
                initialVoucherCode={routeInfo.voucherCode}
                initialTime={homeReserveTime}
                initialPartySize={homeReserveGuests}
              />
            </div>
          </div>
        )}

        {/* ==================== FRIENDLY 404 PAGE ==================== */}
        {routeInfo.page === 'notfound' && (
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center space-y-5">
            <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-mono-tabular">
              404 · Trail Not Found
            </div>
            <h1 className="text-3xl sm:text-4xl font-editorial font-normal">
              This Jungle Path Leads Elsewhere
            </h1>
            <p className="text-xs sm:text-sm text-[#171513]/70">
              The page you requested could not be found. Return to our Sigiriya sanctuary homepage or
              reserve your table directly.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/');
                }}
                className="min-h-[44px] px-6 py-2.5 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-widest inline-flex items-center justify-center"
              >
                Return Home
              </a>
              <a
                href="/reserve"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/reserve');
                }}
                className="min-h-[44px] px-6 py-2.5 bg-[#C65B2B] text-white text-xs uppercase tracking-widest inline-flex items-center justify-center"
              >
                Reserve a Table
              </a>
            </div>
          </div>
        )}

        {/* Shared Gallery Lightbox Modal (Home Gallery + /gallery) */}
        {lightboxItem && (
          <div
            onClick={() => setLightboxItem(null)}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-w-4xl w-full bg-[#171513] text-[#F8F4EE] border border-[#38312B] rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[#C65B2B]">
                    {lightboxItem.category}
                  </div>
                  <h3 className="text-2xl font-outfit font-normal">{lightboxItem.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  aria-label="Close photo preview"
                  className="p-2 text-[#F8F4EE]/70 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#2E2925]">
                <EditorialVisual src={lightboxItem.imageUrl} alt={lightboxItem.title} />
              </div>
              <p className="text-xs text-[#F8F4EE]/75">{lightboxItem.caption}</p>
            </div>
          </div>
        )}
      </main>

      {/* Quiet Architectural Footer — 100% Editable via Admin Panel */}
      <footer className="bg-[#171513] text-[#F8F4EE] border-t border-[#2C2622]">
        <div
          data-gsap-footer
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-16 space-y-10 sm:space-y-12"
        >
          <div className="flex flex-wrap items-center justify-between gap-5 sm:gap-6 border-b border-[#2C2622] pb-8 sm:pb-10">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-editorial">
                {footerContent?.heading || 'From Sunrise Climb to Candlelit Palms.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              <a
                href="/reserve"
                onClick={(e) => {
                  e.preventDefault();
                  handleReserveCtaClick();
                }}
                className="flex-1 sm:flex-initial justify-center min-h-[44px] px-6 py-3 bg-[#C65B2B] text-white text-xs uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors whitespace-nowrap shrink-0 inline-flex items-center"
              >
                {footerContent?.kicker || 'Reserve at OneLove'}
              </a>
              <a
                href="/menu"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/menu');
                }}
                className="flex-1 sm:flex-initial justify-center min-h-[44px] px-6 py-3 border border-[#F8F4EE]/25 text-xs uppercase tracking-widest font-medium hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 inline-flex items-center"
              >
                {footerContent?.subheading || 'Explore Menu'}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-xs text-[#F8F4EE]/70 items-start">
            <div className="space-y-3">
              <div className="font-editorial text-xl text-[#F8F4EE] tracking-wider uppercase">
                {settings.cafeName || 'ONELOVE CAFÉ'}
              </div>
              <p className="leading-relaxed">{settings.tagline}</p>
              {seoGlobal.brandLogoUrl && /^https?:\/\//i.test(seoGlobal.brandLogoUrl) && (
                <div className="pt-2">
                  <img
                    src={seoGlobal.brandLogoUrl}
                    alt={`${settings.cafeName || 'OneLove Café'} Emblem`}
                    loading="lazy"
                    decoding="async"
                    width="112"
                    height="112"
                    className="w-28 h-auto object-contain"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2.5 md:justify-self-center md:text-center">
              <div className="uppercase tracking-widest text-[#F8F4EE] font-semibold">
                Navigation
              </div>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/');
                    }}
                    className="hover:text-white"
                  >
                    OneLove Café Home
                  </a>
                </li>
                <li>
                  <a
                    href="/menu"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/menu');
                    }}
                    className="hover:text-white"
                  >
                    Seasonal Menu &amp; Roastery
                  </a>
                </li>
                <li>
                  <a
                    href="/reserve"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/reserve');
                    }}
                    className="hover:text-white"
                  >
                    Interactive Floor Plan Booking
                  </a>
                </li>
                <li>
                  <a
                    href="/story"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/story');
                    }}
                    className="hover:text-white"
                  >
                    Our Sigiriya Story
                  </a>
                </li>
                <li>
                  <a
                    href="/gallery"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/gallery');
                    }}
                    className="hover:text-white"
                  >
                    Sanctuary Gallery
                  </a>
                </li>
                <li>
                  <a
                    href="/events"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/events');
                    }}
                    className="hover:text-white"
                  >
                    Acoustic Nights &amp; Cuppings
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/contact');
                    }}
                    className="hover:text-white"
                  >
                    Location &amp; Directions
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5 md:justify-self-end md:text-right">
              <div className="uppercase tracking-widest text-[#F8F4EE] font-semibold">
                Location &amp; Concierge
              </div>
              <p>{settings.address}</p>
              {settings.phone && <p className="font-mono-tabular">Tel: {settings.phone}</p>}
              <p className="font-mono-tabular">WhatsApp: {settings.whatsapp}</p>
              <p className="font-mono-tabular">{settings.email}</p>
              {settings.instagram && (
                <p className="font-mono-tabular">Instagram: {settings.instagram}</p>
              )}
            </div>
          </div>

          <div className="pt-8 border-t border-[#2C2622] flex flex-wrap items-center justify-between gap-4 text-[11px] text-[#F8F4EE]/45">
            <div>
              {footerContent?.body ||
                `© ${new Date().getFullYear()} ${settings.cafeName || 'OneLove Café'} Sigiriya. All rights reserved.`}
            </div>
             <div className="flex items-center gap-6">
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/contact');
                }}
                className="hover:text-[#F8F4EE]"
              >
                {footerContent?.ctaLabel || 'Directions & Policies'}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <CafeProvider>
        <OneLoveRouter />
      </CafeProvider>
    </AppErrorBoundary>
  );
}
