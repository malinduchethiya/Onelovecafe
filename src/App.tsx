import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  ArrowRight,
  MapPin,
  Phone,
  Clock,
  Search,
  X,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Compass,
  Menu as MenuIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CafeProvider, useCafe } from './context/CafeContext';
import { EditorialVisual } from './components/EditorialVisual';
import { LateriteStorySection } from './components/LateriteStorySection';
import { ReservationEngine } from './components/ReservationEngine';
import { SanctuaryMap } from './components/SanctuaryMap';
import { GoogleMapsRatingCard } from './components/GoogleMapsRatingCard';
import { OFFICIAL_ONELOVE_MAPS_PLACE_URL } from './lib/mapUtils';
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
    seoGlobal,
    submitInquiry,
  } = useCafe();

  // Menu page filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState<string>('');

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    setMobileMenuOpen(false);
    if (to === pathname) return;
    window.history.pushState({}, '', to);
    setPathname(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReserveCtaClick = () => {
    setMobileMenuOpen(false);
    if (pathname === '/') {
      const el = document.getElementById('reserve-section');
      if (el) {
        const navHeight = 76;
        const y = el.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top: y, behavior: 'smooth' });
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
  const menuGalleryBgContent = useMemo(
    () => siteContent.find((s) => s.sectionKey === 'menu_gallery_bg'),
    [siteContent]
  );
  const menuGalleryBgUrl = useMemo(() => {
    const raw = menuGalleryBgContent?.imageUrl?.trim() || '';
    return raw.length > 0 ? raw : '';
  }, [menuGalleryBgContent]);

  // Hero Background Slideshow list & timer (strictly mirrors Admin Panel settings.heroImages from Cloudflare R2)
  const heroSlides = useMemo(() => {
    const rawSlides = Array.isArray(settings.heroImages)
      ? settings.heroImages.filter((img) => typeof img === 'string' && img.trim().length > 0)
      : [];
    return rawSlides.length > 0 ? rawSlides : ['editorial:hero-sanctuary'];
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

  // Scroll & Mouse Movement Parallax for Hero Section + Dynamic Coffee Roast Transition for Selected Menu Gallery Section
  const [scrollY, setScrollY] = useState(0);
  const [coffeeProgress, setCoffeeProgress] = useState(0);
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });
  const homeMenuGalleryRef = useRef<HTMLElement | null>(null);
  const appRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ticking = false;
    const updateScrollState = () => {
      setScrollY(window.scrollY);
      const targetEl = pathname === '/' ? homeMenuGalleryRef.current : null;

      if (!targetEl) {
        setCoffeeProgress(0);
        return;
      }

      const vh = window.innerHeight || 800;
      const rect = targetEl.getBoundingClientRect();
      // Smooth entry ramp as the menu gallery section scrolls into the viewport
      const entry = (vh * 0.88 - rect.top) / (vh * 0.58);
      // Smooth exit ramp as the bottom of the menu gallery section scrolls out of the viewport
      const exit = (rect.bottom - vh * 0.14) / (vh * 0.58);
      const raw = Math.max(0, Math.min(1, Math.min(entry, exit)));
      // Cubic smoothstep for an organic, stimulating progression
      const eased = raw * raw * (3 - 2 * raw);
      setCoffeeProgress(Number(eased.toFixed(3)));
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateScrollState();
          ticking = false;
        });
        ticking = true;
      }
    };

    updateScrollState();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [pathname]);

  // Multi-stop color interpolation: Limestone Cream (#FCF9F4) -> Caramel Crema (#945F3E) -> Roasted Espresso Coffee (#2E1A10)
  const dynamicCoffeeBg = useMemo(() => {
    const t = coffeeProgress;
    if (t <= 0.005) return '#FCF9F4';
    const lerp = (a: number, b: number, u: number) => Math.round(a + (b - a) * u);
    if (t < 0.45) {
      const u = t / 0.45;
      const r = lerp(252, 148, u);
      const g = lerp(249, 95, u);
      const b = lerp(244, 62, u);
      return `rgb(${r}, ${g}, ${b})`;
    }
    const u = (t - 0.45) / 0.55;
    const r = lerp(148, 46, u);
    const g = lerp(95, 26, u);
    const b = lerp(62, 16, u);
    return `rgb(${r}, ${g}, ${b})`;
  }, [coffeeProgress]);

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 24;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 24;
    setMouseParallax({ x, y });
  };

  const handleHeroMouseLeave = () => {
    setMouseParallax({ x: 0, y: 0 });
  };

  // 4 Columns × 4 Rows = 16 items in Signature Plates & Highland Pour-Overs
  const featuredDishes = useMemo(() => {
    const available = menuItems.filter((m) => m.isAvailable);
    const featured = available.filter((m) => m.isFeatured);
    const nonFeatured = available.filter((m) => !m.isFeatured);
    return [...featured, ...nonFeatured].slice(0, 16);
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCat = selectedCategory === 'all' || item.categoryId === selectedCategory;
      const matchesSearch =
        !menuSearch ||
        item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(menuSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, menuSearch]);

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

      // 4. Experiences Under the Sigiriya Palms Section
      const expHeader = gsap.utils.toArray<HTMLElement>('[data-gsap-exp-header]');
      if (expHeader.length > 0) {
        gsap.fromTo(
          expHeader,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: expHeader[0],
              start: 'top 84%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      const expCards = gsap.utils.toArray<HTMLElement>('[data-gsap-exp-card]');
      if (expCards.length > 0) {
        expCards.forEach((card) => {
          card.style.transition = 'none';
        });
        gsap.fromTo(
          expCards,
          { y: 32, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            stagger: 0.12,
            ease: 'power3.out',
            onComplete: () => {
              gsap.set(expCards, { clearProps: 'transform,opacity' });
              expCards.forEach((card) => {
                card.style.transition = '';
              });
            },
            scrollTrigger: {
              trigger: expCards[0],
              start: 'top 86%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

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
    }, rootEl);

    return () => ctx.revert();
  }, [
    pathname,
    routeInfo.page,
    selectedCategory,
    selectedGalleryCat,
    featuredDishes.length,
    filteredMenuItems.length,
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

  const isHeaderScrolledOrSubpage = routeInfo.page !== 'home' || scrollY > 48;

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
        {/* Zone 1: Brand Logo on Mobile, Wordmark on Desktop */}
        <a
          href="/"
          aria-label="OneLove Café Sigiriya"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="flex items-center font-editorial text-lg sm:text-2xl font-bold tracking-wider text-white drop-shadow-sm whitespace-nowrap shrink-0"
        >
          <img
            src={
              seoGlobal?.brandLogoUrl ||
              '/assets/aistudio/WhatsApp_Image_2026-10-26_at_07.57.02-removebg-preview_7b99b00d.png'
            }
            alt="OneLove Café Sigiriya"
            width="48"
            height="48"
            decoding="async"
            className="md:hidden h-11 w-auto object-contain brightness-0 invert sepia-[.18] saturate-[.45] hue-rotate-[355deg] drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          />
          <span className="hidden md:inline text-white">ONELOVE CAFÉ</span>
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

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="sticky top-[72px] z-30 md:hidden bg-[#FCF9F4] border-b border-[#DFD5C6] px-4 sm:px-6 py-4 space-y-1 shadow-lg max-h-[calc(100vh-72px)] overflow-y-auto"
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
      )}

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
                className="relative -mt-[72px] pt-[72px] min-h-screen flex items-center justify-center bg-[#0C0F0A] text-white overflow-hidden"
              >
                {/* Background Slideshow Layer with Elevated Luminance & Contrast */}
                <div
                  className="absolute inset-0 transition-transform duration-300 ease-out pointer-events-none"
                  style={{
                    transform: `translate3d(${mouseParallax.x * 0.15}px, ${scrollY * 0.2 + mouseParallax.y * 0.15}px, 0) scale(1.01)`,
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
                        priority={idx === 0}
                        className="h-full w-full object-cover contrast-[1.18] saturate-[1.24] brightness-[1.06]"
                      />
                    </div>
                  ))}
                  {/* Sunlit Chiaroscuro Lighting Overlay: Golden-Emerald Midtone Glow + Deep Obsidian Vignette */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_42%,rgba(255,248,214,0.14)_0%,rgba(12,15,10,0.22)_52%,rgba(8,10,7,0.72)_100%)]" />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#0A0C08]/55 via-black/15 to-[#090B07]/78" />
                </div>

                {/* Slider Navigation Arrows (Left & Right) matching reference screenshot */}
                {heroSlides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      aria-label="Previous slide"
                      className="hidden sm:flex absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/55 border border-white/35 text-white hover:bg-black/85 hover:border-white/65 items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-lg"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      aria-label="Next slide"
                      className="hidden sm:flex absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/55 border border-white/35 text-white hover:bg-black/85 hover:border-white/65 items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Foreground Content Layer - Centered, Big Main Text Widespread & High-Contrast Secondary Text */}
                <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-12 py-16 sm:py-24 flex flex-col items-center justify-center text-center subpixel-antialiased">
                  <div className="space-y-5 sm:space-y-7 flex flex-col items-center justify-center text-center w-full">
                    {/* Big Main Text Widespread matching screenshot with luminous contrast + crawlable brand H1 prefix */}
                    <h1
                      data-gsap-hero
                      style={{ textWrap: 'balance' }}
                      className="font-outfit text-3xl sm:text-6xl md:text-7xl lg:text-[90px] xl:text-[102px] font-light leading-[1.06] sm:leading-[1.04] tracking-tight text-[#FFFFFF] max-w-6xl mx-auto [text-shadow:0_6px_28px_rgba(0,0,0,0.68)]"
                    >
                      <span className="sr-only">
                        OneLove Café Sigiriya — Café &amp; Restaurant in Sigiriya, Central Province, Sri Lanka:{' '}
                      </span>
                      {heroContent?.heading || 'Where Jungle Stone Meets Slow Highland Coffee.'}
                    </h1>

                    {/* Crisp High-Contrast Secondary Text */}
                    <p
                      data-gsap-hero
                      className="text-xs sm:text-sm md:text-base text-white/95 max-w-2xl mx-auto leading-relaxed font-normal [text-shadow:0_2px_12px_rgba(0,0,0,0.75)] px-1 sm:px-2"
                    >
                      {heroContent?.subheading ||
                        'Nestled in the emerald canopy beneath Sigiriya Lion Rock in Central Province, Sri Lanka, OneLove Café is an open-air architectural sanctuary for single-estate Ceylon coffee, wood-fired coastal plates, and unhurried twilight gatherings.'}
                    </p>

                    {/* High-Contrast Action Buttons matching reference screenshot */}
                    <div
                      data-gsap-hero
                      className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 pt-2 w-full"
                    >
                      <a
                        href="/menu"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/menu');
                        }}
                        className="min-h-[44px] px-5 sm:px-7 py-3 rounded-full bg-[#D9622B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#BF5220] hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(217,98,43,0.45)] cursor-pointer inline-flex items-center justify-center"
                      >
                        View Menu
                      </a>
                      <a
                        href="/reserve"
                        onClick={(e) => {
                          e.preventDefault();
                          handleReserveCtaClick();
                        }}
                        className="min-h-[44px] px-5 sm:px-7 py-3 rounded-full bg-[#FFFDF9] text-[#110F0D] text-xs font-semibold uppercase tracking-wider hover:bg-[#F3ECE0] hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.38)] cursor-pointer inline-flex items-center justify-center"
                      >
                        Reserve a Table
                      </a>
                      <a
                        href="/story"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/story');
                        }}
                        className="min-h-[44px] px-5 sm:px-7 py-3 rounded-full bg-[#0F0D0B]/70 border border-white/45 text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#0F0D0B]/90 hover:border-white/75 hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xs cursor-pointer inline-flex items-center justify-center"
                      >
                        Discover More
                      </a>
                    </div>
                  </div>
                </div>

                {/* Slide Indicator Dots at bottom center matching reference screenshot */}
                {heroSlides.length > 1 && (
                  <div className="absolute bottom-5 sm:bottom-6 right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-20 flex items-center justify-center gap-2.5">
                    {heroSlides.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setHeroSlideIndex(idx)}
                        aria-label={`Show hero slide ${idx + 1}`}
                        className={`rounded-full transition-all cursor-pointer ${
                          idx === heroSlideIndex
                            ? 'w-2.5 h-2.5 bg-[#D9622B] ring-2 ring-[#D9622B]/50'
                            : 'w-2 h-2 bg-white/55 hover:bg-white'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Minimalist Continuous Horizontal Slider Strap Between Hero & Story Sections */}
            <div
              aria-label="Traveler ratings across platforms"
              className="relative z-20 bg-[#F7F2E9] border-b border-[#DFD5C6] overflow-hidden select-none py-3.5 sm:py-4"
            >
              {/* Soft Left & Right Edge Fade Masks */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-24 bg-gradient-to-r from-[#F7F2E9] to-transparent z-10"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-24 bg-gradient-to-l from-[#F7F2E9] to-transparent z-10"
              />

              {/* Seamless Horizontal Sliding Track */}
              <div className="animate-ratings-slider items-center">
                {[0, 1].map((halfIdx) => (
                  <div
                    key={halfIdx}
                    aria-hidden={halfIdx === 1}
                    className="flex items-center shrink-0"
                  >
                    {[0, 1].map((repeatIdx) => (
                      <React.Fragment key={`${halfIdx}-${repeatIdx}`}>
                        {[
                          {
                            id: 'tripadvisor',
                            score: '4.3',
                            outOf: '/ 5.0',
                            hasHalf: true,
                            logo: (
                              <span
                                aria-label="Tripadvisor"
                                title="Tripadvisor"
                                className="inline-flex items-center gap-2 text-[#110F0D] whitespace-nowrap"
                              >
                                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#34E0A1] flex items-center justify-center shrink-0 shadow-2xs">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#000000]"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 6.2c-2.6 0-4.9.8-6.6 2.1L2.5 8v1.8c.5.4 1 .9 1.2 1.6-.5.8-.7 1.7-.7 2.6 0 2.9 2.3 5.2 5.2 5.2 1.6 0 3.1-.7 4-1.9l-.2-.2 1.9-1.9-1.9 1.9c.9 1.2 2.4 1.9 4 1.9 2.9 0 5.2-2.3 5.2-5.2 0-.9-.2-1.8-.7-2.6.2-.7.7-1.2 1.2-1.6V8l-2.9.3C16.9 7 14.6 6.2 12 6.2zm-3.8 4.4c1.9 0 3.4 1.5 3.4 3.4s-1.5 3.4-3.4 3.4-3.4-1.5-3.4-3.4 1.5-3.4 3.4-3.4zm7.6 0c1.9 0 3.4 1.5 3.4 3.4s-1.5 3.4-3.4 3.4-3.4-1.5-3.4-3.4 1.5-3.4 3.4-3.4zm-7.6 1.7c-.9 0-1.7.8-1.7 1.7s.8 1.7 1.7 1.7 1.7-.8 1.7-1.7-.8-1.7-1.7-1.7zm7.6 0c-.9 0-1.7.8-1.7 1.7s.8 1.7 1.7 1.7 1.7-.8 1.7-1.7-.8-1.7-1.7-1.7z" />
                                  </svg>
                                </span>
                                <span className="font-sans text-xs sm:text-sm font-bold tracking-tight text-[#110F0D]">
                                  Tripadvisor
                                </span>
                              </span>
                            ),
                          },
                          {
                            id: 'google-maps',
                            score: '4.9',
                            outOf: '/ 5.0',
                            hasHalf: false,
                            logo: (
                              <span
                                aria-label="Google Maps"
                                title="Google Maps"
                                className="inline-flex items-center gap-2 text-[#110F0D] whitespace-nowrap"
                              >
                                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-[#E2D9CC] flex items-center justify-center shrink-0 shadow-2xs">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fill="#4285F4"
                                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                      fill="#34A853"
                                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                      fill="#FBBC05"
                                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                      fill="#EA4335"
                                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                  </svg>
                                </span>
                                <span className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-[#110F0D]">
                                  Google <span className="font-normal text-[#5F6368]">Maps</span>
                                </span>
                              </span>
                            ),
                          },
                          {
                            id: 'addagio',
                            score: '4.9',
                            outOf: '/ 5.0',
                            hasHalf: false,
                            logo: (
                              <span
                                aria-label="Addagio"
                                title="Addagio"
                                className="inline-flex items-center gap-2 text-[#110F0D] whitespace-nowrap"
                              >
                                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#110F0D] text-[#F7F2E9] flex items-center justify-center shrink-0 shadow-2xs">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 3L4.5 20.5h3.2l1.6-4h5.4l1.6 4h3.2L12 3zm-1.6 10L12 8.6l1.6 4.4h-3.2z"
                                    />
                                  </svg>
                                </span>
                                <span className="font-editorial text-sm sm:text-base font-semibold tracking-[0.1em] uppercase text-[#110F0D]">
                                  Addagio
                                </span>
                              </span>
                            ),
                          },
                        ].map((item) => (
                          <div
                            key={`${halfIdx}-${repeatIdx}-${item.id}`}
                            className="flex items-center gap-3 sm:gap-4 px-7 sm:px-12 border-r border-[#DFD5C6]/80 shrink-0"
                          >
                            {item.logo}
                            <span
                              className="w-3 sm:w-4 h-[1px] bg-[#D5C8B6] shrink-0"
                              aria-hidden="true"
                            />
                            <div className="inline-flex items-center gap-1.5 sm:gap-2 shrink-0">
                              <span className="font-editorial text-lg sm:text-2xl font-semibold tracking-tight text-[#110F0D] font-mono-tabular">
                                {item.score}
                              </span>
                              <span className="text-[10px] sm:text-xs font-mono-tabular text-[#110F0D]/50">
                                {item.outOf}
                              </span>
                              <span
                                aria-hidden="true"
                                className="inline-flex items-center gap-0.5 text-[#C65B2B] text-xs sm:text-sm leading-none ml-0.5"
                              >
                                <span>★</span>
                                <span>★</span>
                                <span>★</span>
                                <span>★</span>
                                <span className={item.hasHalf ? 'opacity-45' : ''}>★</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Crafted from Laterite Earth, Teak & Monsoon Light — 5-Photo Hover-Animated Collage */}
            <LateriteStorySection onReadMonograph={() => navigate('/story')} />

            {/* 3. Featured Culinary & Roastery Selections (Menu Gallery Section: Custom 20% Blurred Image or Scroll-Driven Roasted Coffee Background) */}
            <section
              ref={homeMenuGalleryRef}
              style={{
                backgroundColor: menuGalleryBgUrl ? '#1E1611' : dynamicCoffeeBg,
                borderColor:
                  menuGalleryBgUrl || coffeeProgress > 0.35
                    ? `rgba(231, 222, 211, ${Math.max(0.18, 1 - coffeeProgress * 0.75)})`
                    : '#E7DED3',
              }}
              className="relative overflow-hidden w-full py-14 sm:py-24 lg:py-28 border-b"
            >
              {/* Admin-Uploaded Menu Gallery Background Image with 20% Blur */}
              {menuGalleryBgUrl && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
                >
                  <div
                    className="w-full h-full"
                    style={{
                      filter: 'blur(4px)',
                      transform: 'scale(1.04)',
                    }}
                  >
                    <EditorialVisual
                      src={menuGalleryBgUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Subtle Atmospheric Scrim for Crisp Typography & Card Contrast */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#140E0A]/50 via-[#140E0A]/35 to-[#140E0A]/55" />
                </div>
              )}

              {/* Section-Scoped Stimulating Roasted Coffee Aura Overlay */}
              <div
                aria-hidden="true"
                style={{ opacity: menuGalleryBgUrl ? 0.35 : coffeeProgress }}
                className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_25%,rgba(217,114,54,0.24),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(138,76,38,0.32),transparent_60%)]"
              />

              <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-8 sm:space-y-12">
                <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
                  <div data-gsap-menu-header className="space-y-2 max-w-2xl">
                    <div
                      style={{
                        color:
                          menuGalleryBgUrl || coffeeProgress > 0.35 ? '#F3A871' : '#C65B2B',
                      }}
                      className="text-[11px] uppercase tracking-[0.2em] font-semibold transition-colors duration-300 ease-out"
                    >
                      Single-Estate Ceylon Roast &amp; Wood-Fired Kitchen
                    </div>
                    <h2
                      style={{
                        color:
                          menuGalleryBgUrl || coffeeProgress > 0.35 ? '#FCF6EE' : '#171513',
                      }}
                      className="text-3xl sm:text-5xl font-editorial font-semibold transition-colors duration-300 ease-out"
                    >
                      Signature Plates &amp; Highland Pour-Overs
                    </h2>
                  </div>
                  <a
                    data-gsap-menu-header
                    href="/menu"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/menu');
                    }}
                    className={`w-full sm:w-auto justify-center min-h-[44px] px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-500 whitespace-nowrap shrink-0 shadow-sm cursor-pointer inline-flex items-center ${
                      menuGalleryBgUrl || coffeeProgress > 0.35
                        ? 'bg-[#D9622B] text-[#FFFDF9] hover:bg-[#BF5220] shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
                        : 'bg-[#171513] text-[#F8F4EE] hover:bg-[#C65B2B]'
                    }`}
                  >
                    View Complete Menu
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                  {featuredDishes.map((dish) => (
                    <article
                      key={dish.id}
                      data-gsap-menu-card
                      className="bg-white text-[#171513] border border-[#E7DED3] flex flex-col justify-between group shadow-[0_10px_28px_rgba(17,11,7,0.12)] hover:-translate-y-1.5 hover:shadow-[0_20px_42px_rgba(17,11,7,0.22)] transition-all duration-300"
                    >
                      <div>
                        <div className="aspect-[4/3] overflow-hidden border-b border-[#E7DED3]">
                          <EditorialVisual
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="group-hover:scale-105 transition-transform duration-500 ease-out"
                          />
                        </div>
                        <div className="p-3 sm:p-5 space-y-1.5 sm:space-y-2">
                          {/* Zero-pill metadata */}
                          <div className="text-[9px] sm:text-[11px] text-[#58644E] uppercase tracking-wider line-clamp-1">
                            {dish.categoryName}
                            {dish.dietaryTags.length > 0 && ` · ${dish.dietaryTags.join(' · ')}`}
                          </div>
                          <h3 className="text-sm sm:text-lg font-editorial font-semibold text-[#171513] leading-snug group-hover:text-[#C65B2B] transition-colors">
                            {dish.name}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-[#171513]/70 leading-relaxed line-clamp-2 sm:line-clamp-none">
                            {dish.description}
                          </p>
                        </div>
                      </div>
                      <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 border-t border-[#E7DED3] flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-xs font-mono-tabular">
                        {(() => {
                          const currencyMode = resolveMenuPriceCurrency(dish);
                          if (currencyMode === 'lkr') {
                            return (
                              <span className="font-semibold text-[#171513]">
                                LKR {dish.priceLkr.toLocaleString()}
                              </span>
                            );
                          }
                          if (currencyMode === 'usd') {
                            return (
                              <span className="font-semibold text-[#171513]">
                                USD ${dish.priceUsd.toFixed(2)}
                              </span>
                            );
                          }
                          return (
                            <>
                              <span className="font-semibold text-[#171513]">
                                LKR {dish.priceLkr.toLocaleString()}
                              </span>
                              <span className="text-[#171513]/55">
                                USD ${dish.priceUsd.toFixed(2)}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            {/* 4. Embedded Homepage Reservation Section (#reserve-section) - Swapped & Dark Theme */}
            <section
              id="reserve-section"
              className="scroll-mt-20 bg-[#171513] text-[#F8F4EE] py-14 sm:py-24 lg:py-28"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-8 sm:space-y-10">
                <div data-gsap-reserve className="text-center max-w-2xl mx-auto space-y-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#D9622B] font-semibold">
                    Live Floor Plan &amp; Concierge Booking
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#F8F4EE]">
                    Reserve Your Sanctuary Table
                  </h2>
                  <p className="text-xs sm:text-sm text-[#F8F4EE]/75 leading-relaxed font-light">
                    Choose your preferred dining atmosphere across our open-air jungle verandah,
                    candlelit stone courtyard, or cooled specialty roastery lounge.
                  </p>
                </div>

                <div data-gsap-reserve className="text-[#171513]">
                  <ReservationEngine />
                </div>
              </div>
            </section>

            {/* 5. Curated Evening Rituals & Experiences Preview - Swapped & Light Theme */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-14 sm:py-24 lg:py-28 border-b border-[#E7DED3] space-y-8 sm:space-y-12">
              <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
                <div data-gsap-exp-header className="space-y-2 max-w-2xl">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#C65B2B] font-semibold">
                    Twilight Gatherings &amp; Roastery Sessions
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#171513]">
                    Experiences Under the Sigiriya Palms
                  </h2>
                </div>
                <a
                  data-gsap-exp-header
                  href="/events"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/events');
                  }}
                  className="w-full sm:w-auto justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[#171513] text-[#F8F4EE] text-xs font-semibold uppercase tracking-wider hover:bg-[#C65B2B] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer inline-flex items-center"
                >
                  All Events &amp; Cuppings
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {events
                  .filter((e) => e.isActive)
                  .slice(0, 3)
                  .map((evt, idx) => (
                    <div
                      key={evt.id}
                      data-gsap-exp-card
                      className="group bg-white border border-[#E7DED3] flex flex-col justify-between overflow-hidden shadow-xs hover:-translate-y-1.5 hover:shadow-[0_18px_38px_rgba(23,21,19,0.12)] transition-all duration-300"
                    >
                      <div>
                        <div className="aspect-[16/9] overflow-hidden border-b border-[#E7DED3]">
                          <EditorialVisual
                            src={evt.imageUrl}
                            alt={evt.title}
                            className="group-hover:scale-105 transition-transform duration-500 ease-out"
                          />
                        </div>
                        <div className="p-5 sm:p-7 space-y-3">
                          <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-mono-tabular font-medium">
                            0{idx + 1} · {evt.category} · {evt.date}
                          </div>
                          <h3 className="text-2xl font-editorial font-semibold text-[#171513] group-hover:text-[#C65B2B] transition-colors">
                            {evt.title}
                          </h3>
                          <p className="text-xs text-[#171513]/70 leading-relaxed font-light">
                            {evt.description}
                          </p>
                        </div>
                      </div>
                      <div className="px-5 sm:px-7 py-4 border-t border-[#E7DED3] flex items-center justify-between text-xs font-mono-tabular text-[#171513]/70">
                        <span>{evt.time}</span>
                        <button
                          type="button"
                          onClick={handleReserveCtaClick}
                          className="text-[#C65B2B] hover:underline uppercase tracking-wider font-semibold cursor-pointer"
                        >
                          Book Table →
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            {/* Clean Google Maps Location Window (Admin-editable, strictly no controls/clutter in window) */}
            <SanctuaryMap settings={settings} />

            {/* 6. Attributable Traveler & Partner Voices */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-14 sm:py-24 space-y-8 sm:space-y-10">
              <div data-gsap-voice className="text-center max-w-2xl mx-auto space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#58644E] font-semibold">
                  Field Notes &amp; Guest Reflections
                </div>
                <h2 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#171513]">
                  What Travelers &amp; Collaborators Say
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <blockquote
                  data-gsap-voice
                  className="bg-white border border-[#E7DED3] p-6 sm:p-8 space-y-4 shadow-[0_10px_28px_rgba(23,21,19,0.05)] hover:-translate-y-1 transition-transform duration-300"
                >
                  <p className="font-editorial italic text-lg sm:text-xl leading-relaxed text-[#171513]">
                    “After guiding guests up Pidurangala Rock at 5:30 AM, bringing them to OneLove
                    Café’s Jungle Verandah for red-rice egg hoppers and Kotmale pour-over coffee has
                    become the highlight of our Cultural Triangle itineraries.”
                  </p>
                  <footer className="pt-3 border-t border-[#E7DED3] flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171513]">
                      Kasun Jayawardena · Founder, Sigiriya Heritage Trails
                    </span>
                  </footer>
                </blockquote>

                <blockquote
                  data-gsap-voice
                  className="bg-white border border-[#E7DED3] p-6 sm:p-8 space-y-4 shadow-[0_10px_28px_rgba(23,21,19,0.05)] hover:-translate-y-1 transition-transform duration-300"
                >
                  <p className="font-editorial italic text-lg sm:text-xl leading-relaxed text-[#171513]">
                    “We reserved Table 06 beside the lotus pool using the interactive floor plan
                    before flying from Zurich. The wood-fired Trincomalee tiger prawns and candlelit
                    acoustic guitar made it our most memorable evening in Sri Lanka.”
                  </p>
                  <footer className="pt-3 border-t border-[#E7DED3] flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171513]">
                      Elena &amp; Marc Vogel · Architectural Photographers, Zurich
                    </span>
                  </footer>
                </blockquote>
              </div>

              {/* Google Maps 5-Star Rating & Review Featuring Card at the lower part of What Travelers & Collaborators Say */}
              <div className="pt-2 sm:pt-4">
                <GoogleMapsRatingCard />
              </div>
            </section>
          </div>
        )}

        {/* ==================== OUR MENU PAGE (/menu) ==================== */}
        {routeInfo.page === 'menu' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-24 space-y-8 sm:space-y-12">
            <div
              data-gsap-subpage
              className="border-b border-[#E7DED3] pb-8 sm:pb-10 flex flex-wrap items-end justify-between gap-4 sm:gap-6"
            >
              <div className="space-y-3 max-w-2xl">
                <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                  Culinary &amp; Roastery Monograph · Sigiriya
                </div>
                <h1 className="text-3xl sm:text-6xl font-editorial font-semibold text-[#171513]">
                  Our Seasonal Menu
                </h1>
                <p className="text-xs sm:text-sm text-[#171513]/75 leading-relaxed font-light">
                  Every dish is prepared to order using heirloom Dry Zone grains, organic Dambulla
                  orchard produce, wild east-coast seafood, and single-estate Ceylon highland coffee.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reserve')}
                className="w-full sm:w-auto justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#B04E22] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer inline-flex items-center"
              >
                Reserve a Table
              </button>
            </div>

            {/* Interactive Filter Tabs & Search Bar */}
            <div data-gsap-subpage className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 bg-[#EFE9DF] p-1 border border-[#E7DED3] overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === 'all'
                      ? 'bg-[#171513] text-[#F8F4EE]'
                      : 'text-[#171513]/70 hover:text-[#171513]'
                  }`}
                >
                  All Offerings
                </button>
                {menuCategories
                  .filter((c) => c.isActive)
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        selectedCategory === cat.id
                          ? 'bg-[#171513] text-[#F8F4EE]'
                          : 'text-[#171513]/70 hover:text-[#171513]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#171513]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search dishes, hoppers, coffee..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-[#171513] border border-[#E7DED3] text-xs focus:outline-none focus:border-[#C65B2B]"
                />
              </div>
            </div>

            {/* Menu Grid (Menu item cards strictly remain bg-white) */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
              {filteredMenuItems.map((item) => (
                <article
                  key={item.id}
                  data-gsap-subcard
                  className="group bg-white text-[#171513] border border-[#E7DED3] flex flex-col justify-between shadow-[0_10px_28px_rgba(17,11,7,0.12)] hover:-translate-y-1.5 transition-all duration-300"
                >
                  <div>
                    <div className="aspect-[4/3] overflow-hidden border-b border-[#E7DED3]">
                      <EditorialVisual
                        src={item.imageUrl}
                        alt={item.name}
                        className="group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                    </div>
                    <div className="p-3 sm:p-6 space-y-1.5 sm:space-y-2.5">
                      <div className="text-[9px] sm:text-[11px] uppercase tracking-wider text-[#58644E] line-clamp-1">
                        {item.categoryName}
                        {item.dietaryTags.length > 0 && ` · ${item.dietaryTags.join(' · ')}`}
                        {!item.isAvailable && ' · Currently Resting'}
                      </div>
                      <h2 className="text-sm sm:text-xl font-editorial font-semibold text-[#171513] leading-snug group-hover:text-[#C65B2B] transition-colors">
                        {item.name}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-[#171513]/70 leading-relaxed line-clamp-2 sm:line-clamp-none">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-t border-[#E7DED3] flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-xs font-mono-tabular">
                    {(() => {
                      const currencyMode = resolveMenuPriceCurrency(item);
                      if (currencyMode === 'lkr') {
                        return (
                          <span className="font-semibold text-[#171513]">
                            LKR {item.priceLkr.toLocaleString()}
                          </span>
                        );
                      }
                      if (currencyMode === 'usd') {
                        return (
                          <span className="font-semibold text-[#171513]">
                            USD ${item.priceUsd.toFixed(2)}
                          </span>
                        );
                      }
                      return (
                        <>
                          <span className="font-semibold text-[#171513]">
                            LKR {item.priceLkr.toLocaleString()}
                          </span>
                          <span className="text-[#171513]/55">
                            USD ${item.priceUsd.toFixed(2)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </article>
              ))}
            </div>
          </div>
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
                    src={storyContent?.imageUrl || 'editorial:courtyard'}
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

                <button
                  type="button"
                  onClick={() => navigate('/reserve')}
                  className="w-full min-h-[44px] py-3 bg-[#C65B2B] text-white text-xs uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors"
                >
                  Choose Your Zone on the Floor Plan
                </button>
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
                    src={conciergeContent.imageUrl || ''}
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
                  <div className="aspect-[4/3] overflow-hidden">
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

            {/* Lightbox Modal */}
            {lightboxItem && (
              <div
                onClick={() => setLightboxItem(null)}
                className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-4xl w-full bg-[#171513] text-[#F8F4EE] border border-[#38312B] p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-[#C65B2B]">
                        {lightboxItem.category}
                      </div>
                      <h3 className="text-2xl font-editorial">{lightboxItem.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLightboxItem(null)}
                      className="p-2 text-[#F8F4EE]/70 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="aspect-[16/9] w-full overflow-hidden border border-[#2E2925]">
                    <EditorialVisual src={lightboxItem.imageUrl} alt={lightboxItem.title} />
                  </div>
                  <p className="text-xs text-[#F8F4EE]/75">{lightboxItem.caption}</p>
                </div>
              </div>
            )}
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
                        <button
                          type="button"
                          onClick={() => navigate('/reserve')}
                          className="w-full sm:w-auto justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#B04E22] transition-colors shadow-sm cursor-pointer inline-flex items-center"
                        >
                          Reserve Table for Event
                        </button>
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
              <ReservationEngine initialVoucherCode={routeInfo.voucherCode} />
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
              <button
                type="button"
                onClick={() => navigate('/')}
                className="min-h-[44px] px-6 py-2.5 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-widest"
              >
                Return Home
              </button>
              <button
                type="button"
                onClick={() => navigate('/reserve')}
                className="min-h-[44px] px-6 py-2.5 bg-[#C65B2B] text-white text-xs uppercase tracking-widest"
              >
                Reserve a Table
              </button>
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
              <div className="pt-2">
                <img
                  src={
                    seoGlobal?.brandLogoUrl ||
                    '/assets/aistudio/WhatsApp_Image_2026-10-26_at_07.57.02-removebg-preview_7b99b00d.png'
                  }
                  alt="OneLove Café Sigiriya Sri Lanka Emblem"
                  loading="lazy"
                  decoding="async"
                  width="112"
                  height="112"
                  className="w-28 h-auto object-contain"
                />
              </div>
            </div>

            <div className="space-y-2.5 md:justify-self-center md:text-center">
              <div className="uppercase tracking-widest text-[#F8F4EE] font-semibold">
                Navigation
              </div>
              <ul className="space-y-2">
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
