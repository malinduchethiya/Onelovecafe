import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
  Check,
  Info,
  ArrowRight,
} from 'lucide-react';
import {
  CafeSettings,
  MenuCategory,
  MenuItem,
  MenuSection,
  OpeningHoursConfig,
} from '../types/cafe';
import {
  extractDietaryFlags,
  resolveMenuCategorySection,
} from '../lib/menuSections';

interface MenuPageProps {
  settings: CafeSettings;
  openingHours: OpeningHoursConfig[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  onNavigate: (path: string) => void;
}

type CurrencyCode = 'LKR' | 'USD' | 'EUR' | 'GBP';

type FoodFilter =
  | 'all'
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'seafood'
  | 'chef-choice'
  | 'featured';

type DrinksFilter =
  | 'all'
  | 'single-origin'
  | 'vegan'
  | 'dairy-free'
  | 'zero-proof'
  | 'signature';

const FOOD_FILTER_OPTIONS: { label: string; value: FoodFilter }[] = [
  { label: 'All Dishes', value: 'all' },
  { label: 'Vegetarian (V)', value: 'vegetarian' },
  { label: 'Vegan (VG)', value: 'vegan' },
  { label: 'Gluten-Free (GF)', value: 'gluten-free' },
  { label: 'Fresh Seafood (SF)', value: 'seafood' },
  { label: "Chef's Signature", value: 'chef-choice' },
  { label: 'Guest Favorites', value: 'featured' },
];

const DRINKS_FILTER_OPTIONS: { label: string; value: DrinksFilter }[] = [
  { label: 'All Drinks', value: 'all' },
  { label: 'Single-Origin Coffee', value: 'single-origin' },
  { label: 'Plant-Based / Vegan', value: 'vegan' },
  { label: 'Dairy-Free', value: 'dairy-free' },
  { label: 'Zero-Proof / Botanical', value: 'zero-proof' },
  { label: 'House Signatures', value: 'signature' },
];

function formatTime12h(hhmm: string): string {
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return hhmm;
  const h = Number(match[1]);
  const m = match[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m} ${suffix}`;
}

export const MenuPage: React.FC<MenuPageProps> = ({
  settings,
  openingHours,
  menuCategories,
  menuItems,
  onNavigate,
}) => {
  const [activeSection, setActiveSection] = useState<MenuSection>('food');
  const [searchQuery, setSearchQuery] = useState('');
  const [foodFilter, setFoodFilter] = useState<FoodFilter>('all');
  const [drinksFilter, setDrinksFilter] = useState<DrinksFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>(() =>
    settings.menuCurrencyDisplay === 'usd' ? 'USD' : 'LKR'
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const filterRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (settings.menuCurrencyDisplay === 'usd') {
      setCurrency('USD');
    } else if (settings.menuCurrencyDisplay === 'lkr') {
      setCurrency('LKR');
    }
  }, [settings.menuCurrencyDisplay]);

  // Close dietary filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [filterOpen]);

  // Close item detail modal on Escape
  useEffect(() => {
    if (!selectedItem) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedItem]);

  const hoursSummary = useMemo(() => {
    const firstOpen = openingHours.find((h) => h.isOpen);
    if (!firstOpen) return 'Open Daily 7:30 AM – 10:30 PM';
    return `Open Daily ${formatTime12h(firstOpen.openTime)} – ${formatTime12h(firstOpen.closeTime)}`;
  }, [openingHours]);

  // Format item price according to selected currency selector
  const formatPrice = (item: MenuItem): string => {
    if (currency === 'LKR') {
      return `LKR ${Math.round(item.priceLkr).toLocaleString()}`;
    }
    if (currency === 'USD') {
      const usdVal = item.priceUsd > 0 ? item.priceUsd : item.priceLkr * 0.0033;
      return `$${usdVal.toFixed(2)}`;
    }
    if (currency === 'EUR') {
      const eurVal = item.priceUsd > 0 ? item.priceUsd * 0.92 : item.priceLkr * 0.003;
      return `€${eurVal.toFixed(2)}`;
    }
    const gbpVal = item.priceUsd > 0 ? item.priceUsd * 0.79 : item.priceLkr * 0.0026;
    return `£${gbpVal.toFixed(2)}`;
  };

  // Partition active categories into Food and Drinks
  const categorizedSections = useMemo(() => {
    const activeCats = [...menuCategories]
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const sectionCats = activeCats.filter(
      (c) => resolveMenuCategorySection(c) === activeSection
    );

    const q = searchQuery.trim().toLowerCase();

    return sectionCats
      .map((category) => {
        const items = menuItems.filter((item) => {
          if (item.categoryId !== category.id) return false;

          if (q) {
            const matchesText =
              item.name.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.categoryName.toLowerCase().includes(q) ||
              (item.dietaryTags || []).some((t) => t.toLowerCase().includes(q));
            if (!matchesText) return false;
          }

          const flags = extractDietaryFlags(item);
          if (activeSection === 'food') {
            if (foodFilter === 'vegetarian' && !flags.isVegetarian) return false;
            if (foodFilter === 'vegan' && !flags.isVegan) return false;
            if (foodFilter === 'gluten-free' && !flags.isGlutenFree) return false;
            if (foodFilter === 'seafood' && !flags.isSeafood) return false;
            if (foodFilter === 'chef-choice' && !flags.isChefSignature) return false;
            if (foodFilter === 'featured' && !item.isFeatured) return false;
          } else {
            if (drinksFilter === 'single-origin' && !flags.isSingleOrigin) return false;
            if (drinksFilter === 'vegan' && !flags.isVegan) return false;
            if (drinksFilter === 'dairy-free' && !flags.isDairyFree) return false;
            if (drinksFilter === 'zero-proof' && !flags.isZeroProof) return false;
            if (drinksFilter === 'signature' && !flags.isSignature) return false;
          }

          return true;
        });

        return { category, items };
      })
      .filter((group) => group.items.length > 0);
  }, [menuCategories, menuItems, activeSection, searchQuery, foodFilter, drinksFilter]);

  // Keep activeCategoryId synced with visible section on scroll
  useEffect(() => {
    if (categorizedSections.length === 0) {
      setActiveCategoryId('');
      return;
    }
    setActiveCategoryId((prev) =>
      categorizedSections.some((g) => g.category.id === prev)
        ? prev
        : categorizedSections[0].category.id
    );

    const handleScroll = () => {
      const scrollY = window.scrollY + 210;
      let current = categorizedSections[0]?.category.id || '';
      for (const group of categorizedSections) {
        const el = sectionRefs.current[group.category.id];
        if (el && el.offsetTop <= scrollY) {
          current = group.category.id;
        }
      }
      setActiveCategoryId(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categorizedSections]);

  const handleSwitchSection = (next: MenuSection) => {
    setActiveSection(next);
    setFilterOpen(false);
    setSearchQuery('');
  };

  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 172;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  };

  const activeFilterCount =
    activeSection === 'food'
      ? foodFilter === 'all'
        ? 0
        : 1
      : drinksFilter === 'all'
      ? 0
      : 1;

  const selectedItemSection = selectedItem
    ? resolveMenuCategorySection(
        menuCategories.find((c) => c.id === selectedItem.categoryId) || {
          id: selectedItem.categoryId,
          name: selectedItem.categoryName,
        }
      )
    : 'food';

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#120E0B] font-sans selection:bg-[#C65B2B]/15 selection:text-[#C65B2B]">
      {/* Editorial Menu Header */}
      <header
        className="pt-16 sm:pt-24 pb-12 sm:pb-16 px-6 text-center max-w-4xl mx-auto border-b border-[#120E0B]/10 w-full"
        aria-label="Menu Header"
      >
        <div className="text-[11px] uppercase tracking-[0.25em] font-medium text-[#120E0B]/65 mb-5">
          {settings.cafeName || 'OneLove Café'} · Sigiriya
        </div>

        <h1 className="font-outfit text-4xl sm:text-5xl md:text-6xl font-normal text-[#120E0B] tracking-tight leading-[1.08] mb-5">
          The Dining Menu
        </h1>

        <p className="text-[#120E0B]/70 text-sm sm:text-base md:text-lg font-light leading-relaxed max-w-2xl mx-auto mb-8">
          Heirloom Dry Zone plates, wood-fired coastal catch, single-estate Ceylon highland coffee,
          and house botanical infusions prepared fresh in Sigiriya.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#120E0B]/60 font-light border-t border-[#120E0B]/8 pt-6">
          <span>{hoursSummary}</span>
          <span className="hidden sm:inline text-[#120E0B]/25">·</span>
          <span className="font-editorial italic text-[#120E0B]/75">
            [V] Vegetarian · [VG] Vegan · [GF] Gluten-Free · [SF] Seafood
          </span>
        </div>
      </header>

      {/* Sticky Section Switcher, Search, Filter & Currency Bar */}
      <div className="sticky top-[68px] sm:top-[76px] z-40 bg-white/95 backdrop-blur-md border-b border-[#120E0B]/10 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Primary Food vs. Drinks Switcher */}
            <div
              role="tablist"
              aria-label="Menu sections"
              className="flex items-center bg-[#120E0B]/5 border border-[#120E0B]/10 p-1 rounded-full w-full md:w-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'food'}
                onClick={() => handleSwitchSection('food')}
                className={`flex-1 md:flex-none px-6 py-1.5 rounded-full font-outfit text-xs font-medium tracking-wider uppercase transition cursor-pointer ${
                  activeSection === 'food'
                    ? 'bg-[#120E0B] text-white shadow-xs'
                    : 'text-[#120E0B]/60 hover:text-[#120E0B]'
                }`}
              >
                Food Selections
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'drinks'}
                onClick={() => handleSwitchSection('drinks')}
                className={`flex-1 md:flex-none px-6 py-1.5 rounded-full font-outfit text-xs font-medium tracking-wider uppercase transition cursor-pointer ${
                  activeSection === 'drinks'
                    ? 'bg-[#120E0B] text-white shadow-xs'
                    : 'text-[#120E0B]/60 hover:text-[#120E0B]'
                }`}
              >
                Drinks &amp; Coffee
              </button>
            </div>

            {/* Search, Dietary Filter & Currency Controls */}
            <div className="flex items-center justify-between md:justify-end gap-2.5 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-1 md:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#120E0B]/40" />
                <input
                  type="text"
                  placeholder={activeSection === 'food' ? 'Find a dish...' : 'Find a drink...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-7 py-1.5 bg-white border border-[#120E0B]/15 rounded-full text-xs text-[#120E0B] placeholder:text-[#120E0B]/40 focus:outline-none focus:ring-1 focus:ring-[#120E0B]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#120E0B]/40 hover:text-[#120E0B] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filter Popover */}
              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                    activeFilterCount > 0
                      ? 'bg-[#120E0B] text-white border-[#120E0B]'
                      : 'bg-white text-[#120E0B]/80 border-[#120E0B]/15 hover:border-[#120E0B]/35'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="w-3.5 h-3.5 rounded-full bg-[#C65B2B] text-white text-[9px] flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>

                {filterOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-[#120E0B]/10 shadow-xl p-2 z-50">
                    <div className="p-2 border-b border-[#120E0B]/8 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#120E0B]/50 block">
                        {activeSection === 'food' ? 'Filter by Dietary' : 'Filter Beverages'}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {activeSection === 'food'
                        ? FOOD_FILTER_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFoodFilter(opt.value);
                                setFilterOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                foodFilter === opt.value
                                  ? 'bg-[#120E0B] text-white font-medium'
                                  : 'text-[#120E0B]/80 hover:bg-[#120E0B]/5'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {foodFilter === opt.value && <Check className="w-3 h-3" />}
                            </button>
                          ))
                        : DRINKS_FILTER_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setDrinksFilter(opt.value);
                                setFilterOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                drinksFilter === opt.value
                                  ? 'bg-[#120E0B] text-white font-medium'
                                  : 'text-[#120E0B]/80 hover:bg-[#120E0B]/5'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {drinksFilter === opt.value && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Currency Selector */}
              <div className="flex items-center bg-white border border-[#120E0B]/15 rounded-full px-2.5 py-1 text-xs">
                <select
                  aria-label="Menu currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="bg-transparent font-outfit font-semibold text-xs text-[#120E0B] focus:outline-none cursor-pointer pr-1"
                >
                  <option value="LKR">LKR</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Horizontal Category Jump Navigation (scoped to active Food or Drinks section) */}
          {categorizedSections.length > 1 && (
            <div className="mt-2.5 pt-2 border-t border-[#120E0B]/8 relative overflow-hidden">
              <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pr-8 scroll-smooth py-0.5">
                {categorizedSections.map(({ category }) => {
                  const isActive = activeCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => scrollToCategory(category.id)}
                      className={`px-3 py-1 rounded-full text-xs font-outfit font-medium tracking-wide transition-all duration-200 cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-[#120E0B] text-white'
                          : 'text-[#120E0B]/70 hover:text-[#120E0B] hover:bg-[#120E0B]/5'
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
              <div className="absolute right-0 top-2 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Main Solid-White Menu Body — 4-in-a-Row Square Rounded Cards (No Images) */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-14 md:py-20 w-full space-y-20">
        {categorizedSections.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#120E0B]/10 p-8 max-w-lg mx-auto space-y-4">
            <h2 className="font-outfit text-2xl font-medium text-[#120E0B]">
              No {activeSection === 'food' ? 'Dishes' : 'Drinks'} Found
            </h2>
            <p className="text-sm text-[#120E0B]/70 font-light leading-relaxed">
              No menu items match your active search or filter selection.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFoodFilter('all');
                setDrinksFilter('all');
              }}
              className="px-6 py-2 rounded-full bg-[#120E0B] hover:bg-[#28231D] text-white text-xs font-outfit font-semibold uppercase tracking-wider transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Categorized Menu Chapters — 4-Column Square Rounded Cards */}
            {categorizedSections.map(({ category, items }, index) => (
              <section
                key={category.id}
                id={category.id}
                ref={(el) => {
                  sectionRefs.current[category.id] = el;
                }}
                className="scroll-mt-44 space-y-8"
              >
                {/* Chapter Header */}
                <div className="space-y-2 border-b border-[#120E0B]/12 pb-4">
                  <span className="text-[11px] font-mono-tabular uppercase tracking-[0.26em] font-medium text-[#C65B2B] block">
                    CHAPTER {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <h2 className="font-outfit text-3xl sm:text-4xl font-normal text-[#120E0B] tracking-tight">
                      {category.name}
                    </h2>
                    <span className="text-xs font-mono-tabular text-[#120E0B]/50 tabular-nums">
                      {items.length} {items.length === 1 ? 'selection' : 'selections'}
                    </span>
                  </div>

                  {category.subtitle && (
                    <p className="text-sm text-[#120E0B]/65 font-light max-w-2xl pt-0.5">
                      {category.subtitle}
                    </p>
                  )}
                </div>

                {/* 4-in-a-Row Fancy Square Cards (No Images) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                  {items.map((item) => {
                    const flags = extractDietaryFlags(item);
                    const primaryBadge =
                      item.dietaryTags[0] ||
                      (activeSection === 'drinks' ? 'House Pour' : 'Fresh Daily');
                    const shortCodes = [
                      flags.isVegetarian && !flags.isVegan ? '[V]' : null,
                      flags.isVegan ? '[VG]' : null,
                      flags.isGlutenFree ? '[GF]' : null,
                      flags.isSeafood ? '[SF]' : null,
                    ].filter(Boolean);

                    return (
                      <article
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="group bg-white rounded-[22px] border border-[#120E0B]/10 shadow-[0_8px_28px_rgba(18,14,11,0.06)] hover:shadow-[0_18px_40px_rgba(18,14,11,0.11)] hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col justify-between aspect-square cursor-pointer"
                      >
                        {/* Top Tag + Dietary Shorthand */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#181512] text-white text-[9px] font-mono-tabular uppercase tracking-[0.16em] font-medium truncate max-w-[75%]">
                            {primaryBadge}
                          </span>
                          {shortCodes.length > 0 && (
                            <span className="text-[10px] font-mono-tabular text-[#120E0B]/55 shrink-0">
                              {shortCodes.join(' ')}
                            </span>
                          )}
                        </div>

                        {/* Center Editorial Title & Description */}
                        <div className="my-auto py-3 space-y-2.5">
                          <h3 className="font-outfit text-xl font-normal text-[#120E0B] leading-snug tracking-tight group-hover:text-[#C65B2B] transition-colors line-clamp-2">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-[13px] text-[#120E0B]/65 font-light leading-relaxed line-clamp-3">
                              {item.description}
                            </p>
                          )}
                          {!item.isAvailable && (
                            <div className="text-[11px] font-editorial italic text-[#9E3F16]">
                              Temporarily Unavailable
                            </div>
                          )}
                        </div>

                        {/* Bottom Hairline Price & Details Row */}
                        <div className="pt-3.5 border-t border-[#120E0B]/8 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono-tabular uppercase tracking-[0.12em] font-semibold text-[#C65B2B] tabular-nums">
                            {formatPrice(item)}
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
              </section>
            ))}

            {/* Minimal Reservation CTA */}
            <section
              className="p-10 sm:p-14 rounded-3xl bg-[#FAF6F0] border border-[#120E0B]/8 text-center space-y-5"
              aria-label="Table Reservation Call to Action"
            >
              <div className="text-[11px] font-mono-tabular uppercase tracking-[0.25em] font-medium text-[#C65B2B]">
                {settings.cafeName || 'OneLove Café'} · Sigiriya
              </div>
              <h2 className="font-outfit text-3xl sm:text-5xl font-normal text-[#120E0B] tracking-tight leading-[1.1]">
                Reserve Your Table in the Canopy
              </h2>
              <p className="text-sm sm:text-base text-[#120E0B]/70 font-light max-w-xl mx-auto leading-relaxed">
                Select your preferred garden courtyard, verandah, or roastery table directly on our
                live floor plan with instant confirmation.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <a
                  href="/reserve"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/reserve');
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#C65B2B] hover:bg-[#B04E22] text-white font-outfit text-xs font-semibold uppercase tracking-[0.14em] transition cursor-pointer"
                >
                  Reserve a Table
                </a>
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/contact');
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-[#F3ECE0] text-[#120E0B] border border-[#120E0B]/15 font-outfit text-xs font-semibold uppercase tracking-[0.14em] transition cursor-pointer"
                >
                  Location &amp; Contact
                </a>
              </div>
            </section>

            {/* Footer Note */}
            <div className="text-center pt-6 border-t border-[#120E0B]/8">
              <p className="text-xs text-[#120E0B]/50 font-light">
                Prices are listed in Sri Lankan Rupees (LKR) with approximate international currency
                equivalents. Please inform our team of any dietary requirements or allergies.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Text-Only Dish / Drink Detail Modal (No Images) */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={selectedItem.name}
        >
          <div
            onClick={() => setSelectedItem(null)}
            className="absolute inset-0 bg-[#120E0B]/60 backdrop-blur-xs"
          />
          <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-y-auto overscroll-contain max-h-[90vh] shadow-2xl border border-[#120E0B]/10 z-10 p-7 sm:p-9 space-y-5">
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#120E0B]/5 hover:bg-[#120E0B]/12 text-[#120E0B] flex items-center justify-center transition cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1.5 border-b border-[#120E0B]/10 pb-5 pr-8">
              <span className="text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.2em] text-[#C65B2B] block">
                {selectedItemSection === 'drinks' ? 'Drinks & Coffee' : 'Food Selections'} ·{' '}
                {selectedItem.categoryName}
              </span>
              <h3 className="font-outfit text-2xl sm:text-3xl font-normal text-[#120E0B] tracking-tight">
                {selectedItem.name}
              </h3>
              <div className="flex items-baseline gap-3 pt-1">
                <span className="font-outfit text-xl sm:text-2xl font-medium text-[#120E0B] tabular-nums">
                  {formatPrice(selectedItem)}
                </span>
                {currency !== 'LKR' && (
                  <span className="text-xs text-[#120E0B]/55 tabular-nums">
                    (LKR {Math.round(selectedItem.priceLkr).toLocaleString()})
                  </span>
                )}
                {currency === 'LKR' && selectedItem.priceUsd > 0 && (
                  <span className="text-xs text-[#120E0B]/55 tabular-nums">
                    (USD ${selectedItem.priceUsd.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono-tabular uppercase tracking-[0.2em] text-[#120E0B]/50 font-semibold block">
                Preparation &amp; Notes
              </span>
              <p className="text-sm text-[#120E0B]/80 font-light leading-relaxed">
                {selectedItem.description}
              </p>
            </div>

            {(selectedItem.dietaryTags.length > 0 || !selectedItem.isAvailable) && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono-tabular uppercase tracking-[0.2em] text-[#120E0B]/50 font-semibold block">
                  Dietary Information
                </span>
                <div className="text-xs text-[#120E0B]/75 font-light">
                  {selectedItem.dietaryTags.join(' · ')}
                  {!selectedItem.isAvailable && (
                    <span className="text-[#9E3F16] font-editorial italic ml-2">
                      · Temporarily Unavailable
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#120E0B]/8 flex items-start gap-2.5 text-xs text-[#120E0B]/70">
              <Info className="w-4 h-4 text-[#C65B2B] shrink-0 mt-0.5" />
              <p>
                Please inform your server of any dietary allergies. Our kitchen prepares every
                plate and pour-over fresh to order.
              </p>
            </div>

            <div className="pt-1 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2.5 rounded-full border border-[#120E0B]/20 text-[#120E0B] font-outfit text-xs font-semibold uppercase tracking-wider hover:border-[#120E0B] transition cursor-pointer"
              >
                Close
              </button>
              <a
                href="/reserve"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedItem(null);
                  onNavigate('/reserve');
                }}
                className="px-6 py-2.5 rounded-full bg-[#C65B2B] hover:bg-[#B04E22] text-white font-outfit text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
              >
                Reserve Table
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
