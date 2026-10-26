import React, { useState, useEffect, useMemo } from 'react';
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
import { CafeProvider, useCafe } from './context/CafeContext';
import { EditorialVisual } from './components/EditorialVisual';
import { LateriteStorySection } from './components/LateriteStorySection';
import { CafeMenuStand } from './components/CafeMenuStand';
import { ReservationEngine } from './components/ReservationEngine';
import { SanctuaryMap } from './components/SanctuaryMap';
import { AdminDashboard, AdminTab } from './components/AdminDashboard';
import { SeoHead } from './components/SeoHead';
import { GalleryItem } from './types/cafe';

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
    submitInquiry,
  } = useCafe();

  // Menu page filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState<string>('');

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

  // Hero Background Slideshow list & timer
  const heroSlides = useMemo(() => {
    const rawSlides =
      Array.isArray(settings.heroImages) && settings.heroImages.length > 0
        ? settings.heroImages
        : [];
    const combined =
      heroContent?.imageUrl &&
      !heroContent.imageUrl.startsWith('editorial:') &&
      !rawSlides.includes(heroContent.imageUrl)
        ? [heroContent.imageUrl, ...rawSlides]
        : rawSlides.length > 0
        ? rawSlides
        : heroContent?.imageUrl
        ? [heroContent.imageUrl]
        : [];

    const realUploadedSlides = combined.filter(
      (img) => typeof img === 'string' && img.trim().length > 0 && !img.startsWith('editorial:')
    );
    return realUploadedSlides.length > 0 ? realUploadedSlides : combined;
  }, [settings.heroImages, heroContent?.imageUrl]);

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

  // Scroll & Mouse Movement Parallax for Hero Section
  const [scrollY, setScrollY] = useState(0);
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <div className="min-h-screen flex flex-col bg-[#FCF9F4] text-[#110F0D]">
      <SeoHead
        currentPage={routeInfo.page}
        pathname={pathname}
        voucherCode={routeInfo.voucherCode}
      />
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 h-[72px] bg-[#FCF9F4]/95 backdrop-blur-md border-b border-[#DFD5C6] px-6 lg:px-12 flex items-center justify-between gap-8 shadow-[0_2px_16px_rgba(17,15,13,0.05)]">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="font-editorial text-2xl font-bold tracking-wider text-[#110F0D] whitespace-nowrap shrink-0"
        >
          ONELOVE CAFÉ
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest font-semibold text-[#110F0D]/85">
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
                    : 'border-transparent hover:text-[#110F0D] hover:border-[#110F0D]/50'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleReserveCtaClick}
            className="px-6 py-2.5 rounded-full bg-[#D9622B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#BF5220] transition-colors whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(217,98,43,0.35)] cursor-pointer"
          >
            Reserve a Table
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 text-[#110F0D]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#F8F4EE] border-b border-[#E7DED3] px-6 py-5 space-y-3">
          {[
            { label: 'Home', path: '/' },
            { label: 'Our Menu', path: '/menu' },
            { label: 'Our Story', path: '/story' },
            { label: 'Gallery', path: '/gallery' },
            { label: 'Experiences & Events', path: '/events' },
            { label: 'Contact & Location', path: '/contact' },
            { label: 'Reserve a Table', path: '/reserve' },
          ].map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="block w-full text-left py-2 text-sm font-medium border-b border-[#E7DED3]/60"
            >
              {item.label}
            </button>
          ))}
        </div>
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
                className="relative min-h-[calc(100vh-72px)] flex items-center justify-center bg-[#0C0F0A] text-white overflow-hidden"
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
                        alt={`OneLove Café Sigiriya hero slide ${idx + 1}`}
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
                      className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/55 border border-white/35 text-white hover:bg-black/85 hover:border-white/65 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-lg"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      aria-label="Next slide"
                      className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/55 border border-white/35 text-white hover:bg-black/85 hover:border-white/65 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Foreground Content Layer - Centered, Big Main Text Widespread & High-Contrast Secondary Text */}
                <div
                  className="relative z-10 max-w-6xl mx-auto w-full px-6 sm:px-12 py-16 sm:py-24 flex flex-col items-center justify-center text-center transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate3d(${-mouseParallax.x * 0.1}px, ${scrollY * -0.12 - mouseParallax.y * 0.1}px, 0)`,
                    opacity: Math.max(0, 1 - scrollY / 700),
                    willChange: 'transform, opacity',
                  }}
                >
                  <div className="space-y-6 sm:space-y-7 flex flex-col items-center justify-center text-center w-full">
                    {/* Big Main Text Widespread matching screenshot with luminous contrast */}
                    <h1
                      style={{ textWrap: 'balance' }}
                      className="font-outfit text-5xl sm:text-7xl md:text-8xl lg:text-[90px] xl:text-[102px] font-light leading-[1.04] tracking-tight text-[#FFFFFF] max-w-6xl mx-auto drop-shadow-[0_6px_28px_rgba(0,0,0,0.68)]"
                    >
                      {heroContent?.heading || 'Where Jungle Stone Meets Slow Highland Coffee.'}
                    </h1>

                    {/* Crisp High-Contrast Secondary Text */}
                    <p className="text-xs sm:text-sm md:text-base text-white/95 max-w-2xl mx-auto leading-relaxed font-normal drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)] px-2">
                      {heroContent?.subheading ||
                        'Nestled in the emerald canopy beneath Sigiriya Lion Rock, OneLove Café is an open-air architectural sanctuary for single-estate Ceylon coffee, wood-fired coastal plates, and unhurried twilight gatherings.'}
                    </p>

                    {/* High-Contrast Action Buttons matching reference screenshot */}
                    <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                      <button
                        type="button"
                        onClick={() => navigate('/menu')}
                        className="px-6 sm:px-7 py-3 rounded-full bg-[#D9622B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#BF5220] transition-all whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(217,98,43,0.45)] cursor-pointer"
                      >
                        View Menu
                      </button>
                      <button
                        type="button"
                        onClick={handleReserveCtaClick}
                        className="px-6 sm:px-7 py-3 rounded-full bg-[#FFFDF9] text-[#110F0D] text-xs font-semibold uppercase tracking-wider hover:bg-[#F3ECE0] transition-all whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.38)] cursor-pointer"
                      >
                        Reserve a Table
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/story')}
                        className="px-6 sm:px-7 py-3 rounded-full bg-[#0F0D0B]/70 border border-white/45 text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#0F0D0B]/90 hover:border-white/75 transition-all whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xs cursor-pointer"
                      >
                        Discover More
                      </button>
                    </div>
                  </div>
                </div>

                {/* Slide Indicator Dots at bottom center matching reference screenshot */}
                {heroSlides.length > 1 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2.5">
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

              {/* 3D Wooden A-Frame Chalkboard "CAFÉ MENU" Stand straddling Hero & LateriteStorySection */}
              <div className="absolute left-3 sm:left-8 lg:left-14 xl:left-24 -bottom-20 sm:-bottom-24 lg:-bottom-28 z-30">
                <CafeMenuStand onClickMenu={() => navigate('/menu')} />
              </div>
            </div>

            {/* 2. Crafted from Laterite Earth, Teak & Monsoon Light — 5-Photo Hover-Animated Collage */}
            <LateriteStorySection onReadMonograph={() => navigate('/story')} />

            {/* 3. Featured Culinary & Roastery Selections */}
            <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20 sm:py-28 border-b border-[#E7DED3] space-y-12">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <h2 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#171513]">
                    Signature Plates &amp; Highland Pour-Overs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/menu')}
                  className="px-6 py-2.5 rounded-full bg-[#171513] text-[#F8F4EE] text-xs font-semibold uppercase tracking-wider hover:bg-[#C65B2B] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
                >
                  View Complete Menu
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredDishes.map((dish) => (
                  <article
                    key={dish.id}
                    className="bg-white border border-[#E7DED3] flex flex-col justify-between group"
                  >
                    <div>
                      <div className="aspect-[4/3] overflow-hidden border-b border-[#E7DED3]">
                        <EditorialVisual
                          src={dish.imageUrl}
                          alt={dish.name}
                          className="group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-5 space-y-2">
                        {/* Zero-pill metadata */}
                        <div className="text-[11px] text-[#58644E] uppercase tracking-wider">
                          {dish.categoryName}
                          {dish.dietaryTags.length > 0 && ` · ${dish.dietaryTags.join(' · ')}`}
                        </div>
                        <h3 className="text-lg font-editorial font-semibold text-[#171513]">
                          {dish.name}
                        </h3>
                        <p className="text-xs text-[#171513]/70 leading-relaxed">
                          {dish.description}
                        </p>
                      </div>
                    </div>
                    <div className="px-5 py-3.5 border-t border-[#E7DED3] flex items-center justify-between text-xs font-mono-tabular">
                      <span className="font-semibold text-[#171513]">
                        LKR {dish.priceLkr.toLocaleString()}
                      </span>
                      <span className="text-[#171513]/55">USD ${dish.priceUsd.toFixed(2)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* 4. Embedded Homepage Reservation Section (#reserve-section) - Swapped & Dark Theme */}
            <section
              id="reserve-section"
              className="scroll-mt-20 bg-[#171513] text-[#F8F4EE] py-20 sm:py-28"
            >
              <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-10">
                <div className="text-center max-w-2xl mx-auto space-y-3">
                  <h2 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#F8F4EE]">
                    Reserve Your Sanctuary Table
                  </h2>
                  <p className="text-sm text-[#F8F4EE]/75 leading-relaxed font-light">
                    Choose your preferred dining atmosphere across our open-air jungle verandah,
                    candlelit stone courtyard, or cooled specialty roastery lounge.
                  </p>
                </div>

                <div className="text-[#171513]">
                  <ReservationEngine />
                </div>
              </div>
            </section>

            {/* 5. Curated Evening Rituals & Experiences Preview - Swapped & Light Theme */}
            <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20 sm:py-28 border-b border-[#E7DED3] space-y-12">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <h2 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#171513]">
                    Experiences Under the Sigiriya Palms
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/events')}
                  className="px-6 py-2.5 rounded-full bg-[#171513] text-[#F8F4EE] text-xs font-semibold uppercase tracking-wider hover:bg-[#C65B2B] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
                >
                  All Events &amp; Cuppings
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {events
                  .filter((e) => e.isActive)
                  .slice(0, 3)
                  .map((evt, idx) => (
                    <div
                      key={evt.id}
                      className="bg-white border border-[#E7DED3] flex flex-col justify-between overflow-hidden shadow-xs"
                    >
                      <div>
                        <div className="aspect-[16/9] overflow-hidden border-b border-[#E7DED3]">
                          <EditorialVisual src={evt.imageUrl} alt={evt.title} />
                        </div>
                        <div className="p-7 space-y-3">
                          <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-mono-tabular font-medium">
                            0{idx + 1} · {evt.category} · {evt.date}
                          </div>
                          <h3 className="text-2xl font-editorial font-semibold text-[#171513]">
                            {evt.title}
                          </h3>
                          <p className="text-xs text-[#171513]/70 leading-relaxed font-light">
                            {evt.description}
                          </p>
                        </div>
                      </div>
                      <div className="px-7 py-4 border-t border-[#E7DED3] flex items-center justify-between text-xs font-mono-tabular text-[#171513]/70">
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
            <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20 sm:py-24 space-y-10">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <h2 className="text-3xl sm:text-5xl font-editorial font-semibold text-[#171513]">
                  What Travelers &amp; Collaborators Say
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <blockquote className="bg-white border border-[#E7DED3] p-8 space-y-4">
                  <p className="font-editorial italic text-xl leading-relaxed text-[#171513]">
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

                <blockquote className="bg-white border border-[#E7DED3] p-8 space-y-4">
                  <p className="font-editorial italic text-xl leading-relaxed text-[#171513]">
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
            </section>
          </div>
        )}

        {/* ==================== OUR MENU PAGE (/menu) ==================== */}
        {routeInfo.page === 'menu' && (
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 sm:py-24 space-y-12">
            <div className="border-b border-[#E7DED3] pb-10 flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                  Culinary &amp; Roastery Monograph · Sigiriya
                </div>
                <h1 className="text-4xl sm:text-6xl font-editorial font-semibold text-[#171513]">
                  Our Seasonal Menu
                </h1>
                <p className="text-sm text-[#171513]/75 leading-relaxed font-light">
                  Every dish is prepared to order using heirloom Dry Zone grains, organic Dambulla
                  orchard produce, wild east-coast seafood, and single-estate Ceylon highland coffee.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reserve')}
                className="px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#B04E22] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              >
                Reserve a Table
              </button>
            </div>

            {/* Interactive Filter Tabs & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 bg-[#EFE9DF] p-1 border border-[#E7DED3]">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E7DED3] text-xs focus:outline-none focus:border-[#C65B2B]"
                />
              </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredMenuItems.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-[#E7DED3] flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] overflow-hidden border-b border-[#E7DED3]">
                      <EditorialVisual src={item.imageUrl} alt={item.name} />
                    </div>
                    <div className="p-6 space-y-2.5">
                      <div className="text-[11px] uppercase tracking-wider text-[#58644E]">
                        {item.categoryName}
                        {item.dietaryTags.length > 0 && ` · ${item.dietaryTags.join(' · ')}`}
                        {!item.isAvailable && ' · Currently Resting'}
                      </div>
                      <h2 className="text-xl font-editorial font-semibold text-[#171513]">
                        {item.name}
                      </h2>
                      <p className="text-xs text-[#171513]/70 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-[#E7DED3] flex items-center justify-between text-xs font-mono-tabular">
                    <span className="font-semibold text-[#171513]">
                      LKR {item.priceLkr.toLocaleString()}
                    </span>
                    <span className="text-[#171513]/55">USD ${item.priceUsd.toFixed(2)}</span>
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
            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 sm:py-24 space-y-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                <div className="lg:col-span-7 min-h-[420px] bg-white border border-[#E7DED3] p-3">
                  <EditorialVisual
                    src={storyContent?.imageUrl || 'editorial:courtyard'}
                    alt={storyContent?.heading || 'Sigiriya sanctuary architecture at dusk'}
                    className="h-full"
                  />
                </div>
              <div className="lg:col-span-5 bg-white border border-[#E7DED3] p-8 sm:p-10 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="text-xs uppercase tracking-widest text-[#58644E] font-medium">
                    Earth, Timber &amp; Craft
                  </div>
                  <h2 className="text-3xl font-editorial font-semibold text-[#171513]">
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
                  className="w-full py-3 bg-[#C65B2B] text-white text-xs uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors"
                >
                  Choose Your Zone on the Floor Plan
                </button>
              </div>
            </div>

            {/* Secondary Story / Concierge Hospitality Showcase (Image editable via sectionKey: concierge) */}
            {conciergeContent && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-white border border-[#E7DED3] p-8 sm:p-10">
                <div className="lg:col-span-6 space-y-4">
                  <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                    {conciergeContent.kicker}
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-editorial font-normal">
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
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 sm:py-24 space-y-12">
            <div className="border-b border-[#E7DED3] pb-8 flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                  Visual Archive · OneLove Café Sigiriya
                </div>
                <h1 className="text-4xl sm:text-6xl font-editorial font-normal">
                  Sanctuary Gallery
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-[#EFE9DF] p-1 border border-[#E7DED3]">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredGallery.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setLightboxItem(item)}
                  className="bg-white border border-[#E7DED3] p-3 cursor-pointer group space-y-3"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <EditorialVisual
                      src={item.imageUrl}
                      alt={item.title}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="px-2 pb-2 space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-[#58644E]">
                      {item.category}
                    </div>
                    <h2 className="text-lg font-editorial font-semibold">{item.title}</h2>
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
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 sm:py-24 space-y-14">
            <div className="border-b border-[#E7DED3] pb-8 space-y-3 max-w-3xl">
              <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                Sanctuary Gatherings &amp; Cultural Programming
              </div>
              <h1 className="text-4xl sm:text-6xl font-editorial font-semibold text-[#171513]">
                Experiences &amp; Weekly Rituals
              </h1>
              <p className="text-sm text-[#171513]/75 leading-relaxed font-light">
                From guided highland coffee cuppings in our roastery to candlelit Thursday &amp;
                Saturday acoustic hearth sessions beneath the palms.
              </p>
            </div>

            <div className="space-y-8">
              {events
                .filter((e) => e.isActive)
                .map((evt) => (
                  <div
                    key={evt.id}
                    className="bg-white border border-[#E7DED3] grid grid-cols-1 lg:grid-cols-12 items-stretch"
                  >
                    <div className="lg:col-span-5 min-h-[260px] border-b lg:border-b-0 lg:border-r border-[#E7DED3]">
                      <EditorialVisual
                        src={evt.imageUrl}
                        alt={evt.title}
                        className="h-full"
                      />
                    </div>
                    <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6">
                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-widest text-[#58644E] font-mono-tabular font-medium">
                          {evt.category} · {evt.date} · {evt.time}
                        </div>
                        <h2 className="text-3xl font-editorial font-semibold text-[#171513]">{evt.title}</h2>
                        <p className="text-sm text-[#171513]/75 leading-relaxed font-light">
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
                          className="px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#B04E22] transition-colors shadow-sm cursor-pointer"
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
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 sm:py-24 space-y-16">
            <div className="border-b border-[#E7DED3] pb-8 space-y-3 max-w-3xl">
              <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                Concierge Desk &amp; Directions · Sigiriya, Sri Lanka
              </div>
              <h1 className="text-4xl sm:text-6xl font-editorial font-normal">
                Visit the Sanctuary
              </h1>
              <p className="text-sm text-[#171513]/70">
                Located along Lion Rock Sanctuary Road in Kimbissa, 6 minutes from the Sigiriya
                World Heritage Fortress and Pidurangala Rock trailhead.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Contact Information & Opening Hours */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white border border-[#E7DED3] p-7 space-y-5 text-xs">
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
                        className="px-4 py-2 bg-[#58644E] text-white uppercase tracking-wider font-medium inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Chat on WhatsApp
                      </a>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=Sigiriya+Lion+Rock+Sri+Lanka"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 border border-[#171513] text-[#171513] uppercase tracking-wider font-medium inline-flex items-center gap-1.5"
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
                        <div key={oh.id} className="py-1.5 flex justify-between">
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
              <div className="lg:col-span-7 bg-white border border-[#E7DED3] p-8 sm:p-10">
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
                      className="px-7 py-3 bg-[#C65B2B] text-white uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors"
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
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-14 sm:py-20 space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                Table Reservations · OneLove Café Sigiriya
              </div>
              <h1 className="text-4xl sm:text-5xl font-editorial font-semibold text-[#171513]">
                Reserve Your Sanctuary Table
              </h1>
              <p className="text-sm text-[#171513]/70">
                Select your date, sitting time, and exact table on our live interactive floor plan.
              </p>
              <div className="text-xs font-mono-tabular text-[#171513]/55">
                {settings.coordinates} · Open Daily 7:30 AM – 10:30 PM · {settings.gracePeriodMinutes}-Min Arrival Grace
              </div>
            </div>

            <ReservationEngine initialVoucherCode={routeInfo.voucherCode} />
          </div>
        )}

        {/* ==================== FRIENDLY 404 PAGE ==================== */}
        {routeInfo.page === 'notfound' && (
          <div className="max-w-xl mx-auto px-6 py-28 text-center space-y-5">
            <div className="text-xs uppercase tracking-widest text-[#C65B2B] font-mono-tabular">
              404 · Trail Not Found
            </div>
            <h1 className="text-4xl font-editorial font-normal">
              This Jungle Path Leads Elsewhere
            </h1>
            <p className="text-sm text-[#171513]/70">
              The page you requested could not be found. Return to our Sigiriya sanctuary homepage or
              reserve your table directly.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-[#171513] text-[#F8F4EE] text-xs uppercase tracking-widest"
              >
                Return Home
              </button>
              <button
                type="button"
                onClick={() => navigate('/reserve')}
                className="px-6 py-2.5 bg-[#C65B2B] text-white text-xs uppercase tracking-widest"
              >
                Reserve a Table
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Quiet Architectural Footer — 100% Editable via Admin Panel */}
      <footer className="bg-[#171513] text-[#F8F4EE] border-t border-[#2C2622]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 space-y-12">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-[#2C2622] pb-10">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-editorial">
                {footerContent?.heading || 'From Sunrise Climb to Candlelit Palms.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReserveCtaClick}
                className="px-6 py-3 bg-[#C65B2B] text-white text-xs uppercase tracking-widest font-medium hover:bg-[#B04E22] transition-colors whitespace-nowrap shrink-0"
              >
                {footerContent?.kicker || 'Reserve at OneLove'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/menu')}
                className="px-6 py-3 border border-[#F8F4EE]/25 text-xs uppercase tracking-widest font-medium hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
              >
                {footerContent?.subheading || 'Explore Menu'}
              </button>
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
                  src="/assets/aistudio/WhatsApp_Image_2026-10-26_at_07.57.02-removebg-preview_eee5198f.png"
                  alt="OneLove Café Sigiriya Sri Lanka Emblem"
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
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="hover:text-[#F8F4EE]"
              >
                {footerContent?.ctaLabel || 'Directions & Policies'}
              </button>
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
