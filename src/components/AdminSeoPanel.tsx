import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Globe,
  Search,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Copy,
  ExternalLink,
  Plus,
  X,
  FileCode,
  Compass,
  Sparkles,
  Check,
  Crop,
} from 'lucide-react';
import { useCafe } from '../context/CafeContext';
import {
  DEFAULT_BRAND_FAVICON_PATH,
  DEFAULT_BRAND_LOGO_PATH,
  DEFAULT_GLOBAL_SEO,
  DEFAULT_PAGE_SEO,
  SEO_KEYWORD_LIBRARY,
  buildStructuredDataGraph,
} from '../data/seoDefaults';
import {
  GlobalSeoConfig,
  PageSeoConfig,
  SeoKeywordCategoryKey,
  SeoPageKey,
} from '../types/seo';
import { EditorialVisual } from './EditorialVisual';

interface AdminSeoPanelProps {
  onShowToast: (msg: string) => void;
}

type SeoSubTab = 'global' | 'pages' | 'assets' | 'readiness';

export const AdminSeoPanel: React.FC<AdminSeoPanelProps> = ({ onShowToast }) => {
  const {
    seoGlobal,
    seoPages,
    saveSeoGlobal,
    saveSeoPage,
    resetSeoToDefaults,
    menuItems,
    gallery,
    saveMenuItem,
    saveGalleryItem,
    uploadMediaFile,
  } = useCafe();

  const [subTab, setSubTab] = useState<SeoSubTab>('global');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPage, setSavingPage] = useState(false);

  // 1. Global SEO Form State
  const [globalForm, setGlobalForm] = useState<GlobalSeoConfig>(seoGlobal);
  const [altNamesInput, setAltNamesInput] = useState<string>(
    (seoGlobal.alternateNames || []).join(', ')
  );
  const [cuisinesInput, setCuisinesInput] = useState<string>(
    (seoGlobal.servesCuisine || []).join(', ')
  );
  const [socialLinksInput, setSocialLinksInput] = useState<string>(
    (seoGlobal.socialLinks || []).join('\n')
  );

  useEffect(() => {
    setGlobalForm(seoGlobal);
    setAltNamesInput((seoGlobal.alternateNames || []).join(', '));
    setCuisinesInput((seoGlobal.servesCuisine || []).join(', '));
    setSocialLinksInput((seoGlobal.socialLinks || []).join('\n'));
  }, [seoGlobal]);

  // 2. Per-Page SEO Form State
  const [selectedPageKey, setSelectedPageKey] = useState<SeoPageKey>('home');
  const [pageForm, setPageForm] = useState<PageSeoConfig>(
    seoPages.home || DEFAULT_PAGE_SEO.home
  );
  const [newSupportKeyword, setNewSupportKeyword] = useState('');

  useEffect(() => {
    setPageForm(seoPages[selectedPageKey] || DEFAULT_PAGE_SEO[selectedPageKey]);
  }, [selectedPageKey, seoPages]);

  // Keyword Library Browser State
  const [activeKeywordCat, setActiveKeywordCat] = useState<SeoKeywordCategoryKey>('brand');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [newCustomKeyword, setNewCustomKeyword] = useState('');
  const [copiedKw, setCopiedKw] = useState<string | null>(null);

  // 3. Favicon 1:1 Square Cropper & Multi-Size Generator State
  const [cropSourceImg, setCropSourceImg] = useState<HTMLImageElement | null>(null);
  const [cropSourceWarn, setCropSourceWarn] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropPanX, setCropPanX] = useState<number>(0);
  const [cropPanY, setCropPanY] = useState<number>(0);
  const [cropBg, setCropBg] = useState<'transparent' | '#F8F4EE' | '#171513' | '#FFFFFF'>(
    'transparent'
  );
  const [generatingFavicons, setGeneratingFavicons] = useState(false);
  const cropPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingDefaultOg, setUploadingDefaultOg] = useState(false);
  const [uploadingPageOg, setUploadingPageOg] = useState(false);

  // Alt-text manager filter state
  const [altFilter, setAltFilter] = useState<'all' | 'missing' | 'menu' | 'gallery'>('all');
  const [editingAltMap, setEditingAltMap] = useState<Record<string, string>>({});

  // Draw live 1:1 square preview whenever cropSourceImg, zoom, pan, or bg changes
  useEffect(() => {
    const canvas = cropPreviewCanvasRef.current;
    if (!canvas || !cropSourceImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 192;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    if (cropBg !== 'transparent') {
      ctx.fillStyle = cropBg;
      ctx.fillRect(0, 0, size, size);
    }

    const minDim = Math.min(cropSourceImg.width, cropSourceImg.height);
    const baseScale = size / minDim;
    const scale = baseScale * cropZoom;

    const drawW = cropSourceImg.width * scale;
    const drawH = cropSourceImg.height * scale;
    const dx = (size - drawW) / 2 + (cropPanX / 100) * (drawW / 2);
    const dy = (size - drawH) / 2 + (cropPanY / 100) * (drawH / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cropSourceImg, dx, dy, drawW, drawH);
  }, [cropSourceImg, cropZoom, cropPanX, cropPanY, cropBg]);

  const handleSelectFaviconFile = (file: File | undefined) => {
    if (!file) return;
    setCropSourceWarn(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 48 || img.height < 48) {
          setCropSourceWarn(
            `Uploaded image is ${img.width}×${img.height}px. Google Search requires favicons to be at least 48×48px (recommended 192×192px or 512×512px). Our generator will upscale it to 48×48, 96×96, and 192×192.`
          );
        } else if (img.width !== img.height) {
          setCropSourceWarn(
            `Source image is ${img.width}×${img.height}px (non-square). Use the 1:1 Square Crop controls below to frame your icon for Google Search.`
          );
        } else {
          setCropSourceWarn(null);
        }
        setCropZoom(1);
        setCropPanX(0);
        setCropPanY(0);
        setCropSourceImg(img);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const renderSquareFaviconAtSize = (targetSize: number): string => {
    if (!cropSourceImg) return '';
    const offscreen = document.createElement('canvas');
    offscreen.width = targetSize;
    offscreen.height = targetSize;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return '';

    if (cropBg !== 'transparent') {
      ctx.fillStyle = cropBg;
      ctx.fillRect(0, 0, targetSize, targetSize);
    }

    const minDim = Math.min(cropSourceImg.width, cropSourceImg.height);
    const baseScale = targetSize / minDim;
    const scale = baseScale * cropZoom;

    const drawW = cropSourceImg.width * scale;
    const drawH = cropSourceImg.height * scale;
    const dx = (targetSize - drawW) / 2 + (cropPanX / 100) * (drawW / 2);
    const dy = (targetSize - drawH) / 2 + (cropPanY / 100) * (drawH / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cropSourceImg, dx, dy, drawW, drawH);
    return offscreen.toDataURL('image/png');
  };

  const handleApplyAndSaveFavicons = async () => {
    if (!cropSourceImg) return;
    setGeneratingFavicons(true);
    try {
      const png48 = renderSquareFaviconAtSize(48);
      const png96 = renderSquareFaviconAtSize(96);
      const png180 = renderSquareFaviconAtSize(180);
      const png192 = renderSquareFaviconAtSize(192);

      const updated: GlobalSeoConfig = {
        ...globalForm,
        faviconSourceUrl: png192,
        favicon48Url: png48,
        favicon96Url: png96,
        favicon192Url: png192,
        appleTouchIconUrl: png180,
      };
      setGlobalForm(updated);
      await saveSeoGlobal(updated);
      setCropSourceImg(null);
      onShowToast(
        'Generated 48×48, 96×96, 192×192 & 180×180 Apple Touch icons and published to /favicon.ico & Firestore.'
      );
    } finally {
      setGeneratingFavicons(false);
    }
  };

  const handleResetFaviconToDefault = async () => {
    const updated: GlobalSeoConfig = {
      ...globalForm,
      faviconSourceUrl: DEFAULT_BRAND_FAVICON_PATH,
      favicon48Url: '/favicon-48x48.png',
      favicon96Url: '/favicon-96x96.png',
      favicon192Url: '/favicon-192x192.png',
      appleTouchIconUrl: '/apple-touch-icon.png',
    };
    setGlobalForm(updated);
    setCropSourceImg(null);
    await saveSeoGlobal(updated);
    onShowToast('Reset website favicon to the default OneLove Café Sigiriya emblem.');
  };

  const handleSaveGlobalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobal(true);
    try {
      const altNames = altNamesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const cuisines = cuisinesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const socials = socialLinksInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const nextConfig: GlobalSeoConfig = {
        ...globalForm,
        alternateNames: altNames.length > 0 ? altNames : DEFAULT_GLOBAL_SEO.alternateNames,
        servesCuisine: cuisines.length > 0 ? cuisines : DEFAULT_GLOBAL_SEO.servesCuisine,
        socialLinks: socials,
      };
      await saveSeoGlobal(nextConfig);
      onShowToast('Saved Global SEO & Schema.org Business Configuration to Firestore.');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleSavePageForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPage(true);
    try {
      await saveSeoPage(pageForm);
      onShowToast(`Saved SEO metadata for ${pageForm.pageLabel} to Firestore.`);
    } finally {
      setSavingPage(false);
    }
  };

  // Real-time Factual SEO Validation Warnings for the active page
  const pageValidationWarnings = useMemo(() => {
    const warnings: { type: 'warning' | 'good'; text: string }[] = [];
    const titleLen = pageForm.title.trim().length;
    const descLen = pageForm.metaDescription.trim().length;

    if (titleLen === 0) {
      warnings.push({ type: 'warning', text: 'Missing SEO Title tag.' });
    } else if (titleLen < 30) {
      warnings.push({
        type: 'warning',
        text: `SEO Title is short (${titleLen} chars). Recommended range is 35–60 characters.`,
      });
    } else if (titleLen > 65) {
      warnings.push({
        type: 'warning',
        text: `SEO Title is ${titleLen} chars and may be truncated in Google Search results (> 60–65 chars).`,
      });
    } else {
      warnings.push({
        type: 'good',
        text: `SEO Title length (${titleLen} chars) is within optimal Google SERP display range.`,
      });
    }

    if (descLen === 0) {
      warnings.push({ type: 'warning', text: 'Missing Meta Description.' });
    } else if (descLen < 100) {
      warnings.push({
        type: 'warning',
        text: `Meta Description is brief (${descLen} chars). Recommended range is 110–160 characters.`,
      });
    } else if (descLen > 165) {
      warnings.push({
        type: 'warning',
        text: `Meta Description is ${descLen} chars and may truncate on desktop/mobile SERPs (> 160 chars).`,
      });
    } else {
      warnings.push({
        type: 'good',
        text: `Meta Description length (${descLen} chars) is optimal for search snippets.`,
      });
    }

    if (pageForm.primaryKeyword.trim()) {
      const kwLower = pageForm.primaryKeyword.trim().toLowerCase();
      const inTitle = pageForm.title.toLowerCase().includes(kwLower);
      const inDesc = pageForm.metaDescription.toLowerCase().includes(kwLower);
      if (!inTitle && !inDesc) {
        warnings.push({
          type: 'warning',
          text: `Primary keyword "${pageForm.primaryKeyword}" does not appear in exact form in the Title or Meta Description.`,
        });
      } else {
        warnings.push({
          type: 'good',
          text: `Primary target phrase "${pageForm.primaryKeyword}" is naturally included in page metadata.`,
        });
      }
    }

    // Check duplicate titles/descriptions across other pages
    const otherPages = (Object.values(seoPages) as PageSeoConfig[]).filter(
      (p) => p.id !== pageForm.id
    );
    const duplicateTitlePage = otherPages.find(
      (p) => p.title.trim().toLowerCase() === pageForm.title.trim().toLowerCase()
    );
    if (duplicateTitlePage) {
      warnings.push({
        type: 'warning',
        text: `Duplicate Title detected: matches ${duplicateTitlePage.pageLabel}. Every page should have a unique title.`,
      });
    }

    const duplicateDescPage = otherPages.find(
      (p) =>
        p.metaDescription.trim().toLowerCase() ===
        pageForm.metaDescription.trim().toLowerCase()
    );
    if (duplicateDescPage) {
      warnings.push({
        type: 'warning',
        text: `Duplicate Meta Description detected: matches ${duplicateDescPage.pageLabel}.`,
      });
    }

    return warnings;
  }, [pageForm, seoPages]);

  // Filtered keywords in the Categorized Keyword Library
  const activeCategoryObj = useMemo(
    () =>
      SEO_KEYWORD_LIBRARY.find((c) => c.key === activeKeywordCat) || SEO_KEYWORD_LIBRARY[0],
    [activeKeywordCat]
  );

  const displayedKeywords = useMemo(() => {
    const baseList =
      activeKeywordCat === 'brand' && (seoGlobal.customKeywords || []).length > 0
        ? [...activeCategoryObj.keywords, ...(seoGlobal.customKeywords || [])]
        : activeCategoryObj.keywords;

    if (!keywordSearch.trim()) return baseList;
    const q = keywordSearch.toLowerCase();
    // Search across all categories when a search query is typed
    const allKeywords = Array.from(
      new Set([
        ...SEO_KEYWORD_LIBRARY.flatMap((c) => c.keywords),
        ...(seoGlobal.customKeywords || []),
      ])
    );
    return allKeywords.filter((kw) => kw.toLowerCase().includes(q));
  }, [activeCategoryObj, activeKeywordCat, keywordSearch, seoGlobal.customKeywords]);

  const toggleSupportingKeyword = (kw: string) => {
    const current = pageForm.supportingKeywords || [];
    const exists = current.includes(kw);
    const next = exists ? current.filter((k) => k !== kw) : [...current, kw];
    setPageForm({ ...pageForm, supportingKeywords: next });
  };

  // Search Readiness Audit across entire site
  const readinessReport = useMemo(() => {
    const pagesList = Object.values(seoPages) as PageSeoConfig[];
    const missingTitles = pagesList.filter((p) => !p.title || p.title.trim().length < 10);
    const missingDescs = pagesList.filter(
      (p) => !p.metaDescription || p.metaDescription.trim().length < 30
    );
    const titleCounts = new Map<string, number>();
    pagesList.forEach((p) => {
      const k = p.title.trim().toLowerCase();
      titleCounts.set(k, (titleCounts.get(k) || 0) + 1);
    });
    const duplicateTitles = pagesList.filter(
      (p) => (titleCounts.get(p.title.trim().toLowerCase()) || 0) > 1
    );

    const menuMissingAlt = menuItems.filter(
      (m) => !m.description || m.description.trim().length < 10
    );
    const galleryMissingAlt = gallery.filter(
      (g) => !g.caption || g.caption.trim().length < 5
    );

    return {
      pagesList,
      missingTitles,
      missingDescs,
      duplicateTitles,
      menuMissingAlt,
      galleryMissingAlt,
    };
  }, [seoPages, menuItems, gallery]);

  const domainClean = (globalForm.canonicalDomain || 'https://onelovecafesigiriya.com').replace(
    /\/+$/,
    ''
  );
  const activeFaviconPreview =
    globalForm.favicon96Url && globalForm.favicon96Url.startsWith('data:')
      ? globalForm.favicon96Url
      : globalForm.faviconSourceUrl || DEFAULT_BRAND_FAVICON_PATH;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7DED3] pb-5">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
              OneLove Café Sigiriya · Search Engine &amp; Brand Identity Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
              SEO, Favicon &amp; Search Optimization (`/admin/seo`)
            </h1>
            <p className="text-xs text-[#171513]/65 max-w-3xl">
              Manage global &amp; per-page metadata, 10-category Sigiriya keyword targeting
              (English, Sinhala &amp; Tamil), Google Search 1:1 favicon generation, Schema.org
              JSON-LD structured data, and Search Console readiness.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] text-xs font-medium hover:border-[#171513] inline-flex items-center gap-1.5"
            >
              <span>/sitemap.xml</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/robots.txt"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] text-xs font-medium hover:border-[#171513] inline-flex items-center gap-1.5"
            >
              <span>/robots.txt</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/favicon-96x96.png"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] text-xs font-medium hover:border-[#171513] inline-flex items-center gap-1.5"
            >
              <span>/favicon-96x96.png</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={async () => {
                await resetSeoToDefaults();
                onShowToast('Restored default OneLove Café Sigiriya SEO configuration.');
              }}
              className="px-3 py-2 border border-[#E7DED3] text-xs text-[#171513]/70 hover:text-[#171513] inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Reset Defaults
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-[#F8F4EE] p-1.5 border border-[#E7DED3]">
          {[
            {
              id: 'global' as SeoSubTab,
              label: '1. Global SEO & Schema.org',
              icon: <Globe className="w-3.5 h-3.5" />,
            },
            {
              id: 'pages' as SeoSubTab,
              label: '2. Per-Page SEO & Keyword Library',
              icon: <Search className="w-3.5 h-3.5" />,
            },
            {
              id: 'assets' as SeoSubTab,
              label: '3. Favicon Cropper, Social Cards & Alt-Text',
              icon: <ImageIcon className="w-3.5 h-3.5" />,
            },
            {
              id: 'readiness' as SeoSubTab,
              label: '4. Search Readiness, Sitemap & Google Guides',
              icon: <Compass className="w-3.5 h-3.5" />,
            },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-2.5 text-xs font-medium inline-flex items-center gap-2 transition-colors ${
                subTab === t.id
                  ? 'bg-[#171513] text-[#F8F4EE]'
                  : 'text-[#171513]/70 hover:text-[#171513] hover:bg-white'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          SUB-TAB 1: GLOBAL SEO & STRUCTURED BUSINESS DATA
         ===================================================================== */}
      {subTab === 'global' && (
        <form onSubmit={handleSaveGlobalForm} className="space-y-6 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Core Site Identity & Indexing */}
            <div className="lg:col-span-6 bg-white border border-[#E7DED3] p-6 space-y-4">
              <div className="border-b border-[#E7DED3] pb-3">
                <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                  Website Identity &amp; Search Console
                </div>
                <h2 className="text-lg font-editorial font-semibold mt-0.5">
                  Global Search Metadata &amp; Canonical Domain
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Website Display Name (Google Site Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={globalForm.siteName}
                    onChange={(e) => setGlobalForm({ ...globalForm, siteName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Website Language (`lang`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.language}
                    onChange={(e) => setGlobalForm({ ...globalForm, language: e.target.value })}
                    placeholder="en"
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#171513]/70 font-medium mb-1">
                  Alternate Brand Names (`WebSite.alternateName`, comma-separated)
                </label>
                <input
                  type="text"
                  value={altNamesInput}
                  onChange={(e) => setAltNamesInput(e.target.value)}
                  placeholder="One Love Cafe Sigiriya, OneLove Cafe Sigiriya, One Love Café Sri Lanka"
                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                />
                <p className="text-[11px] text-[#171513]/55 mt-1">
                  Used in homepage `WebSite` JSON-LD so Google associates both &ldquo;OneLove
                  Café&rdquo; and &ldquo;One Love Cafe Sigiriya&rdquo; with your domain and favicon.
                </p>
              </div>

              <div>
                <label className="block text-[#171513]/70 font-medium mb-1">
                  Default SEO Title *
                </label>
                <input
                  type="text"
                  required
                  value={globalForm.defaultTitle}
                  onChange={(e) =>
                    setGlobalForm({ ...globalForm, defaultTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                />
              </div>

              <div>
                <label className="block text-[#171513]/70 font-medium mb-1">
                  Default Meta Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={globalForm.defaultDescription}
                  onChange={(e) =>
                    setGlobalForm({ ...globalForm, defaultDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Canonical Production Domain *
                  </label>
                  <input
                    type="url"
                    required
                    value={globalForm.canonicalDomain}
                    onChange={(e) =>
                      setGlobalForm({
                        ...globalForm,
                        canonicalDomain: e.target.value.replace(/\/+$/, ''),
                      })
                    }
                    placeholder="https://onelovecafesigiriya.com"
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Google Search Console Verification Code
                  </label>
                  <input
                    type="text"
                    value={globalForm.googleVerificationTag}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, googleVerificationTag: e.target.value })
                    }
                    placeholder="Paste verification token or <meta> tag"
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>
              </div>

              {/* Indexing Controls */}
              <div className="pt-3 border-t border-[#E7DED3] space-y-2.5">
                <div className="font-semibold uppercase tracking-wider text-[11px] text-[#58644E]">
                  Crawler &amp; Indexing Directives
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={globalForm.allowIndexing}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, allowIndexing: e.target.checked })
                    }
                    className="accent-[#C65B2B]"
                  />
                  <span>
                    Allow Search Engine Indexing on Public Pages (`index, follow`)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={globalForm.noindexPreviewDomains}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, noindexPreviewDomains: e.target.checked })
                    }
                    className="accent-[#C65B2B]"
                  />
                  <span>
                    Automatically set `noindex` on non-production preview hostnames (prevent
                    duplicate staging indexing)
                  </span>
                </label>

                <div className="p-2.5 bg-[#F8F4EE] border border-[#E7DED3] text-[11px] text-[#171513]/70">
                  <strong>Protected Routes:</strong> `/admin`, `/admin/seo`, and
                  `/reserve/voucher/*` always output `noindex, nofollow` and are disallowed in
                  `/robots.txt`.
                </div>
              </div>
            </div>

            {/* Right Column: LocalBusiness / CafeOrCoffeeShop Schema.org Structured Data */}
            <div className="lg:col-span-6 bg-white border border-[#E7DED3] p-6 space-y-4">
              <div className="border-b border-[#E7DED3] pb-3">
                <div className="text-[11px] uppercase tracking-widest text-[#58644E] font-semibold">
                  Schema.org JSON-LD Local Hospitality Graph
                </div>
                <h2 className="text-lg font-editorial font-semibold mt-0.5">
                  Structured Business Information (`CafeOrCoffeeShop` &amp; `Restaurant`)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Primary Schema.org Type
                  </label>
                  <select
                    value={globalForm.businessType}
                    onChange={(e) =>
                      setGlobalForm({
                        ...globalForm,
                        businessType: e.target.value as 'CafeOrCoffeeShop' | 'Restaurant',
                      })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                  >
                    <option value="CafeOrCoffeeShop">CafeOrCoffeeShop + Restaurant</option>
                    <option value="Restaurant">Restaurant + CafeOrCoffeeShop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Price Range (`priceRange`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.priceRange}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, priceRange: e.target.value })
                    }
                    placeholder="$$"
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Street Address (`streetAddress`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.streetAddress}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, streetAddress: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Locality / Town (`addressLocality`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.addressLocality}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, addressLocality: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Province / Region (`addressRegion`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.addressRegion}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, addressRegion: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Postal Code (`postalCode`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.postalCode}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, postalCode: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    ISO Country Code (`addressCountry`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.addressCountry}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, addressCountry: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    GPS Latitude (`geo.latitude`)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={globalForm.latitude}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, latitude: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    GPS Longitude (`geo.longitude`)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={globalForm.longitude}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, longitude: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Telephone (`telephone`)
                  </label>
                  <input
                    type="text"
                    value={globalForm.telephone}
                    onChange={(e) =>
                      setGlobalForm({ ...globalForm, telephone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Public Email (`email`)
                  </label>
                  <input
                    type="email"
                    value={globalForm.email}
                    onChange={(e) => setGlobalForm({ ...globalForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#171513]/70 font-medium mb-1">
                  Serves Cuisine (`servesCuisine`, comma-separated)
                </label>
                <input
                  type="text"
                  value={cuisinesInput}
                  onChange={(e) => setCuisinesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                />
              </div>

              <div>
                <label className="block text-[#171513]/70 font-medium mb-1">
                  Social Profile &amp; Map Links (`sameAs`, one URL per line)
                </label>
                <textarea
                  rows={2}
                  value={socialLinksInput}
                  onChange={(e) => setSocialLinksInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingGlobal}
              className="px-6 py-3 bg-[#C65B2B] text-white uppercase tracking-widest font-semibold hover:bg-[#B04E22] transition-colors cursor-pointer"
            >
              {savingGlobal
                ? 'Saving Global SEO Configuration...'
                : 'Save Global SEO & Structured Data'}
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          SUB-TAB 2: PER-PAGE SEO & CATEGORIZED KEYWORD LIBRARY
         ===================================================================== */}
      {subTab === 'pages' && (
        <div className="space-y-6 text-xs">
          {/* Page Selector Bar */}
          <div className="bg-white border border-[#E7DED3] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold uppercase tracking-wider text-[#171513]">
              Select Public Route to Optimize:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(DEFAULT_PAGE_SEO) as SeoPageKey[]).map((key) => {
                const p = seoPages[key] || DEFAULT_PAGE_SEO[key];
                const active = selectedPageKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPageKey(key)}
                    className={`px-3.5 py-2 font-medium transition-colors ${
                      active
                        ? 'bg-[#C65B2B] text-white'
                        : 'bg-[#F8F4EE] text-[#171513]/80 hover:bg-[#EFE9DF]'
                    }`}
                  >
                    {p.pageLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Page Metadata Editor */}
            <form
              onSubmit={handleSavePageForm}
              className="lg:col-span-7 bg-white border border-[#E7DED3] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E7DED3] pb-3">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                    Route Metadata · {pageForm.routePath}
                  </div>
                  <h2 className="text-lg font-editorial font-semibold mt-0.5">
                    {pageForm.pageLabel} SEO Configuration
                  </h2>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-[#F8F4EE] px-3 py-1.5 border border-[#E7DED3]">
                  <input
                    type="checkbox"
                    checked={pageForm.indexable}
                    onChange={(e) =>
                      setPageForm({ ...pageForm, indexable: e.target.checked })
                    }
                    className="accent-[#C65B2B]"
                  />
                  <span className="font-mono-tabular font-semibold">
                    {pageForm.indexable ? 'index, follow' : 'noindex'}
                  </span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#171513]/70 font-medium">
                    Page SEO Title (`&lt;title&gt;`) *
                  </label>
                  <span
                    className={`font-mono-tabular text-[11px] ${
                      pageForm.title.length >= 30 && pageForm.title.length <= 65
                        ? 'text-[#58644E]'
                        : 'text-[#C65B2B]'
                    }`}
                  >
                    {pageForm.title.length} / 60 chars
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={pageForm.title}
                  onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#171513]/70 font-medium">
                    Meta Description (`meta[name="description"]`) *
                  </label>
                  <span
                    className={`font-mono-tabular text-[11px] ${
                      pageForm.metaDescription.length >= 100 &&
                      pageForm.metaDescription.length <= 165
                        ? 'text-[#58644E]'
                        : 'text-[#C65B2B]'
                    }`}
                  >
                    {pageForm.metaDescription.length} / 160 chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={pageForm.metaDescription}
                  onChange={(e) =>
                    setPageForm({ ...pageForm, metaDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Canonical Path (`rel="canonical"`)
                  </label>
                  <input
                    type="text"
                    value={pageForm.canonicalPath}
                    onChange={(e) =>
                      setPageForm({ ...pageForm, canonicalPath: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[#171513]/70 font-medium mb-1">
                    Primary Target Keyword
                  </label>
                  <input
                    type="text"
                    value={pageForm.primaryKeyword}
                    onChange={(e) =>
                      setPageForm({ ...pageForm, primaryKeyword: e.target.value })
                    }
                    placeholder="e.g. OneLove Cafe Sigiriya"
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                  />
                </div>
              </div>

              {/* Supporting Keywords Manager */}
              <div>
                <label className="block text-[#171513]/70 font-medium mb-1">
                  Supporting Keyword Phrases ({(pageForm.supportingKeywords || []).length})
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#F8F4EE] border border-[#E7DED3] min-h-[44px]">
                  {(pageForm.supportingKeywords || []).map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E7DED3] text-[11px]"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => toggleSupportingKeyword(kw)}
                        className="text-[#171513]/50 hover:text-[#9E3F16]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newSupportKeyword}
                    onChange={(e) => setNewSupportKeyword(e.target.value)}
                    placeholder="Add custom supporting keyword phrase..."
                    className="flex-1 px-3 py-1.5 bg-[#F8F4EE] border border-[#E7DED3]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newSupportKeyword.trim();
                      if (!clean) return;
                      if (!pageForm.supportingKeywords.includes(clean)) {
                        setPageForm({
                          ...pageForm,
                          supportingKeywords: [...pageForm.supportingKeywords, clean],
                        });
                      }
                      setNewSupportKeyword('');
                    }}
                    className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider font-medium"
                  >
                    + Add Phrase
                  </button>
                </div>
              </div>

              {/* Open Graph Social Override Fields */}
              <div className="pt-3 border-t border-[#E7DED3] space-y-3">
                <div className="font-semibold uppercase tracking-wider text-[11px] text-[#58644E]">
                  Open Graph &amp; Social Sharing Card (`og:title`, `og:description`, `og:image`)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#171513]/70 mb-1">Social Sharing Title</label>
                    <input
                      type="text"
                      value={pageForm.ogTitle}
                      onChange={(e) => setPageForm({ ...pageForm, ogTitle: e.target.value })}
                      className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#171513]/70 mb-1">
                      Open Graph Image Override
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={pageForm.ogImageUrl}
                        onChange={(e) =>
                          setPageForm({ ...pageForm, ogImageUrl: e.target.value })
                        }
                        className="flex-1 px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] font-mono-tabular"
                      />
                      <label className="px-3 py-2 bg-[#171513] text-[#F8F4EE] cursor-pointer whitespace-nowrap inline-flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>{uploadingPageOg ? '...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingPageOg(true);
                            try {
                              const b64 = await uploadMediaFile(file, 'seo');
                              setPageForm({ ...pageForm, ogImageUrl: b64 });
                            } finally {
                              setUploadingPageOg(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[#171513]/70 mb-1">
                    Social Sharing Description
                  </label>
                  <textarea
                    rows={2}
                    value={pageForm.ogDescription}
                    onChange={(e) =>
                      setPageForm({ ...pageForm, ogDescription: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPage}
                className="w-full py-3 bg-[#C65B2B] text-white uppercase tracking-widest font-semibold hover:bg-[#B04E22] transition-colors cursor-pointer"
              >
                {savingPage
                  ? 'Saving Page SEO...'
                  : `Save ${pageForm.pageLabel} SEO to Firestore`}
              </button>
            </form>

            {/* Right Column: Live Google SERP Preview + Validation Warnings */}
            <div className="lg:col-span-5 space-y-6">
              {/* Live Google Search Result Preview */}
              <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
                <div className="border-b border-[#E7DED3] pb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                      Live Google Search Result Snippet
                    </div>
                    <h3 className="text-base font-editorial font-semibold">
                      SERP Favicon, Site Name &amp; Title Preview
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono-tabular text-[#58644E]">
                    Desktop &amp; Mobile
                  </span>
                </div>

                {/* Simulated Google Result Card */}
                <div className="p-5 bg-[#FFFFFF] border border-[#E7DED3] space-y-2 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full border border-[#E7DED3] bg-[#F8F4EE] flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={activeFaviconPreview}
                        alt="Favicon"
                        className="w-5 h-5 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#202124] truncate">
                        {globalForm.siteName || 'OneLove Café'}
                      </div>
                      <div className="text-[11px] text-[#4d5156] truncate font-mono-tabular">
                        {domainClean}
                        {pageForm.canonicalPath === '/'
                          ? ''
                          : ` › ${pageForm.canonicalPath.replace(/^\//, '')}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-[18px] leading-snug text-[#1a0dab] font-normal hover:underline cursor-pointer break-words">
                    {pageForm.title || globalForm.defaultTitle}
                  </div>

                  <div className="text-[13px] text-[#4d5156] leading-relaxed line-clamp-3">
                    {pageForm.metaDescription || globalForm.defaultDescription}
                  </div>
                </div>

                {/* Real-time SEO Validation Checks */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#171513]/70">
                    Real-Time Metadata Validation
                  </div>
                  {pageValidationWarnings.map((w, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 border flex items-start gap-2 text-[11px] ${
                        w.type === 'good'
                          ? 'bg-[#F4F7F2] border-[#58644E]/40 text-[#2F3829]'
                          : 'bg-[#FDF3EF] border-[#C65B2B]/50 text-[#9E3F16]'
                      }`}
                    >
                      {w.type === 'good' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#58644E] shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#C65B2B] shrink-0 mt-0.5" />
                      )}
                      <span>{w.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Categorized Keyword Research & Targeting Library (10 Categories) */}
          <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7DED3] pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                  Sigiriya Hospitality &amp; Tourism Search Intent Library
                </div>
                <h3 className="text-xl font-editorial font-semibold mt-0.5">
                  Categorized SEO Keyword Library (English, Sinhala &amp; Tamil)
                </h3>
                <p className="text-xs text-[#171513]/65 mt-0.5">
                  Click <strong>Set Primary</strong> or <strong>+ Supporting</strong> on any
                  researched phrase to assign it to the currently selected page (
                  <strong>{pageForm.pageLabel}</strong>). Note: These are curated search-intent
                  phrases, not verified search-volume rankings.
                </p>
              </div>

              {/* Search & Custom Keyword Input */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#171513]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                    placeholder="Filter all 140+ keywords..."
                    className="pl-8 pr-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] w-56"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newCustomKeyword}
                    onChange={(e) => setNewCustomKeyword(e.target.value)}
                    placeholder="New custom keyword..."
                    className="px-3 py-2 bg-[#F8F4EE] border border-[#E7DED3] w-44"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const clean = newCustomKeyword.trim();
                      if (!clean) return;
                      const updatedCustom = Array.from(
                        new Set([...(globalForm.customKeywords || []), clean])
                      );
                      const nextGlobal = { ...globalForm, customKeywords: updatedCustom };
                      setGlobalForm(nextGlobal);
                      setNewCustomKeyword('');
                      await saveSeoGlobal(nextGlobal);
                      onShowToast(`Added "${clean}" to custom SEO keyword library.`);
                    }}
                    className="px-3 py-2 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {SEO_KEYWORD_LIBRARY.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setActiveKeywordCat(cat.key);
                    setKeywordSearch('');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                    activeKeywordCat === cat.key && !keywordSearch
                      ? 'bg-[#171513] text-[#F8F4EE] border-[#171513]'
                      : 'bg-[#F8F4EE] text-[#171513]/75 border-[#E7DED3] hover:border-[#171513]'
                  }`}
                >
                  {cat.label} ({cat.keywords.length})
                </button>
              ))}
            </div>

            <div className="text-xs text-[#58644E] font-medium">
              {keywordSearch
                ? `Showing matching phrases across all categories for "${keywordSearch}":`
                : activeCategoryObj.description}
            </div>

            {/* Keywords Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {displayedKeywords.map((kw) => {
                const isPrimary =
                  pageForm.primaryKeyword.trim().toLowerCase() === kw.toLowerCase();
                const isSupporting = (pageForm.supportingKeywords || []).includes(kw);
                return (
                  <div
                    key={kw}
                    className={`p-3 border flex items-center justify-between gap-2 ${
                      isPrimary
                        ? 'bg-[#FDF3EF] border-[#C65B2B]'
                        : isSupporting
                        ? 'bg-[#F4F7F2] border-[#58644E]'
                        : 'bg-[#F8F4EE] border-[#E7DED3]'
                    }`}
                  >
                    <span className="font-medium text-[#171513] break-words">{kw}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPageForm({ ...pageForm, primaryKeyword: kw })}
                        className={`px-2 py-1 text-[10px] uppercase tracking-wider font-semibold border ${
                          isPrimary
                            ? 'bg-[#C65B2B] text-white border-[#C65B2B]'
                            : 'bg-white text-[#171513] border-[#E7DED3] hover:border-[#C65B2B]'
                        }`}
                      >
                        {isPrimary ? 'Primary' : 'Set Primary'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSupportingKeyword(kw)}
                        className={`px-2 py-1 text-[10px] uppercase tracking-wider font-semibold border ${
                          isSupporting
                            ? 'bg-[#58644E] text-white border-[#58644E]'
                            : 'bg-white text-[#171513] border-[#E7DED3] hover:border-[#58644E]'
                        }`}
                      >
                        {isSupporting ? '✓ Added' : '+ Support'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(kw);
                          setCopiedKw(kw);
                          setTimeout(() => setCopiedKw(null), 1500);
                        }}
                        title="Copy keyword"
                        className="p-1 bg-white border border-[#E7DED3] text-[#171513]/60 hover:text-[#171513]"
                      >
                        {copiedKw === kw ? (
                          <Check className="w-3 h-3 text-[#58644E]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: SEO ASSET MANAGEMENT (FAVICON CROPPER, LOGO & ALT-TEXT)
         ===================================================================== */}
      {subTab === 'assets' && (
        <div className="space-y-6 text-xs">
          {/* 1. Google Search Favicon 1:1 Cropper & Multi-Size Generator */}
          <div className="bg-white border border-[#E7DED3] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7DED3] pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                  Google Search Favicon Specification · 1:1 Square Aspect Ratio
                </div>
                <h2 className="text-xl font-editorial font-semibold mt-0.5">
                  Favicon Uploader, 1:1 Square Cropper &amp; Multi-Resolution Generator
                </h2>
                <p className="text-xs text-[#171513]/65 mt-0.5 max-w-3xl">
                  Google Search requires a stable 1:1 square icon (minimum 48×48px; multiples of
                  48px such as 48×48, 96×96, 192×192) served with crawlable `/favicon.ico` and PNG
                  headers. Upload any image below to crop and generate all required sizes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="px-4 py-2.5 bg-[#C65B2B] text-white uppercase tracking-wider font-semibold cursor-pointer hover:bg-[#B04E22] inline-flex items-center gap-2">
                  <Crop className="w-3.5 h-3.5" />
                  <span>Upload &amp; Crop New Favicon</span>
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg,image/x-icon"
                    className="hidden"
                    onChange={(e) => {
                      handleSelectFaviconFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleResetFaviconToDefault}
                  className="px-3.5 py-2.5 border border-[#E7DED3] bg-[#F8F4EE] hover:border-[#171513] font-medium"
                >
                  Use Default OneLove Emblem
                </button>
              </div>
            </div>

            {/* Interactive 1:1 Cropper Modal/Panel when an image is selected */}
            {cropSourceImg && (
              <div className="p-5 bg-[#F8F4EE] border-2 border-[#C65B2B] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-[#171513]">
                    Interactive 1:1 Square Favicon Cropper ({cropSourceImg.width}×
                    {cropSourceImg.height}px source)
                  </div>
                  <button
                    type="button"
                    onClick={() => setCropSourceImg(null)}
                    className="text-[#171513]/60 hover:text-[#171513]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {cropSourceWarn && (
                  <div className="p-3 bg-[#FDF3EF] border border-[#C65B2B] text-[#9E3F16] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{cropSourceWarn}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-4 flex flex-col items-center space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-[#171513]/60">
                      Live 1:1 Output Preview (192×192)
                    </div>
                    <canvas
                      ref={cropPreviewCanvasRef}
                      className="w-36 h-36 border border-[#171513] bg-[radial-gradient(#E7DED3_1px,transparent_1px)] [background-size:12px_12px]"
                    />
                  </div>

                  <div className="md:col-span-8 space-y-3">
                    <div>
                      <label className="block text-[#171513]/70 mb-1">
                        Zoom Scale ({cropZoom.toFixed(2)}×)
                      </label>
                      <input
                        type="range"
                        min={0.5}
                        max={2.5}
                        step={0.05}
                        value={cropZoom}
                        onChange={(e) => setCropZoom(Number(e.target.value))}
                        className="w-full accent-[#C65B2B]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[#171513]/70 mb-1">
                          Horizontal Offset ({cropPanX}%)
                        </label>
                        <input
                          type="range"
                          min={-50}
                          max={50}
                          step={1}
                          value={cropPanX}
                          onChange={(e) => setCropPanX(Number(e.target.value))}
                          className="w-full accent-[#C65B2B]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#171513]/70 mb-1">
                          Vertical Offset ({cropPanY}%)
                        </label>
                        <input
                          type="range"
                          min={-50}
                          max={50}
                          step={1}
                          value={cropPanY}
                          onChange={(e) => setCropPanY(Number(e.target.value))}
                          className="w-full accent-[#C65B2B]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#171513]/70 mb-1">Icon Background Fill</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { val: 'transparent', label: 'Transparent' },
                          { val: '#F8F4EE', label: 'Warm Ivory (#F8F4EE)' },
                          { val: '#171513', label: 'Obsidian (#171513)' },
                          { val: '#FFFFFF', label: 'Pure White (#FFFFFF)' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() =>
                              setCropBg(
                                opt.val as 'transparent' | '#F8F4EE' | '#171513' | '#FFFFFF'
                              )
                            }
                            className={`px-3 py-1.5 border ${
                              cropBg === opt.val
                                ? 'bg-[#171513] text-white border-[#171513]'
                                : 'bg-white border-[#E7DED3]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={generatingFavicons}
                        onClick={handleApplyAndSaveFavicons}
                        className="px-6 py-2.5 bg-[#C65B2B] text-white uppercase tracking-widest font-semibold hover:bg-[#B04E22]"
                      >
                        {generatingFavicons
                          ? 'Generating All Favicon Sizes...'
                          : 'Generate & Publish 48×48, 96×96, 192×192 & Apple Touch Icons'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Favicon Multi-Size Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                {
                  label: 'Google SERP (48×48)',
                  endpoint: '/favicon-48x48.png',
                  sizePx: 'w-12 h-12',
                  src:
                    globalForm.favicon48Url && globalForm.favicon48Url.startsWith('data:')
                      ? globalForm.favicon48Url
                      : DEFAULT_BRAND_FAVICON_PATH,
                },
                {
                  label: 'High-DPI SERP (96×96)',
                  endpoint: '/favicon-96x96.png',
                  sizePx: 'w-14 h-14',
                  src:
                    globalForm.favicon96Url && globalForm.favicon96Url.startsWith('data:')
                      ? globalForm.favicon96Url
                      : DEFAULT_BRAND_FAVICON_PATH,
                },
                {
                  label: 'Android / PWA (192×192)',
                  endpoint: '/favicon-192x192.png',
                  sizePx: 'w-16 h-16',
                  src:
                    globalForm.favicon192Url && globalForm.favicon192Url.startsWith('data:')
                      ? globalForm.favicon192Url
                      : DEFAULT_BRAND_FAVICON_PATH,
                },
                {
                  label: 'Apple Touch (180×180)',
                  endpoint: '/apple-touch-icon.png',
                  sizePx: 'w-16 h-16',
                  src:
                    globalForm.appleTouchIconUrl &&
                    globalForm.appleTouchIconUrl.startsWith('data:')
                      ? globalForm.appleTouchIconUrl
                      : DEFAULT_BRAND_FAVICON_PATH,
                },
                {
                  label: 'Root Fallback (/favicon.ico)',
                  endpoint: '/favicon.ico',
                  sizePx: 'w-12 h-12',
                  src: activeFaviconPreview,
                },
              ].map((item) => (
                <div
                  key={item.endpoint}
                  className="p-4 bg-[#F8F4EE] border border-[#E7DED3] flex flex-col items-center justify-between text-center space-y-2"
                >
                  <div className="h-16 flex items-center justify-center">
                    <img
                      src={item.src}
                      alt={item.label}
                      className={`${item.sizePx} object-contain border border-[#E7DED3] bg-white p-1`}
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-[#171513]">{item.label}</div>
                    <a
                      href={item.endpoint}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono-tabular text-[#C65B2B] hover:underline"
                    >
                      {item.endpoint} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Brand Logo & Default Open Graph Social Sharing Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
              <div className="border-b border-[#E7DED3] pb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                    Schema.org Organization Logo
                  </div>
                  <h3 className="text-base font-editorial font-semibold">
                    Official Brand Logo (`Organization.logo`)
                  </h3>
                </div>
                <label className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingLogo(true);
                      try {
                        const b64 = await uploadMediaFile(file, 'seo');
                        const next = { ...globalForm, brandLogoUrl: b64 };
                        setGlobalForm(next);
                        await saveSeoGlobal(next);
                        onShowToast('Updated Schema.org Brand Logo.');
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="h-36 bg-[#171513] border border-[#E7DED3] flex items-center justify-center p-4">
                <img
                  src={globalForm.brandLogoUrl || DEFAULT_BRAND_LOGO_PATH}
                  alt="OneLove Café Brand Logo"
                  className="max-h-28 w-auto object-contain"
                />
              </div>
            </div>

            <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
              <div className="border-b border-[#E7DED3] pb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-[#58644E] font-semibold">
                    Default Open Graph &amp; WhatsApp Share Card
                  </div>
                  <h3 className="text-base font-editorial font-semibold">
                    Default Social Sharing Image (`og:image`)
                  </h3>
                </div>
                <label className="px-3 py-1.5 bg-[#C65B2B] text-white cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingDefaultOg ? 'Uploading...' : 'Upload Social Card'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingDefaultOg(true);
                      try {
                        const b64 = await uploadMediaFile(file, 'seo');
                        const next = { ...globalForm, defaultOgImageUrl: b64 };
                        setGlobalForm(next);
                        await saveSeoGlobal(next);
                        onShowToast('Updated Default Open Graph Social Image.');
                      } finally {
                        setUploadingDefaultOg(false);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="h-36 bg-[#F8F4EE] border border-[#E7DED3] flex items-center justify-center overflow-hidden">
                <img
                  src={globalForm.defaultOgImageUrl || DEFAULT_BRAND_FAVICON_PATH}
                  alt="Default Open Graph Preview"
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>
          </div>

          {/* 3. Image Alt-Text & Caption SEO Auditor */}
          <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED3] pb-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                  Google Images &amp; Accessibility Optimization
                </div>
                <h3 className="text-lg font-editorial font-semibold">
                  Menu &amp; Gallery Image Alt-Text / Caption Manager
                </h3>
              </div>

              <div className="flex gap-1.5">
                {[
                  { id: 'all', label: 'All Media' },
                  { id: 'menu', label: `Menu Dishes (${menuItems.length})` },
                  { id: 'gallery', label: `Gallery Photos (${gallery.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAltFilter(f.id as 'all' | 'missing' | 'menu' | 'gallery')}
                    className={`px-3 py-1.5 border ${
                      altFilter === f.id
                        ? 'bg-[#171513] text-white border-[#171513]'
                        : 'bg-[#F8F4EE] border-[#E7DED3]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#E7DED3] max-h-96 overflow-y-auto">
              {(altFilter === 'all' || altFilter === 'menu') &&
                menuItems.slice(0, 12).map((item) => {
                  const key = `menu_${item.id}`;
                  const currentVal =
                    editingAltMap[key] !== undefined ? editingAltMap[key] : item.description;
                  return (
                    <div
                      key={key}
                      className="py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-12 h-10 bg-[#F8F4EE] border border-[#E7DED3] overflow-hidden shrink-0">
                          <EditorialVisual src={item.imageUrl} alt={item.name} />
                        </div>
                        <div>
                          <div className="font-semibold text-[#171513]">{item.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-[#58644E]">
                            Menu · {item.categoryName}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) =>
                            setEditingAltMap({ ...editingAltMap, [key]: e.target.value })
                          }
                          className="w-full px-3 py-1.5 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await saveMenuItem({ ...item, description: currentVal });
                            onShowToast(`Updated descriptive caption/alt text for ${item.name}.`);
                          }}
                          className="px-3 py-1.5 bg-[#171513] text-white uppercase tracking-wider shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}

              {(altFilter === 'all' || altFilter === 'gallery') &&
                gallery.map((g) => {
                  const key = `gal_${g.id}`;
                  const currentVal =
                    editingAltMap[key] !== undefined ? editingAltMap[key] : g.caption;
                  return (
                    <div
                      key={key}
                      className="py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-12 h-10 bg-[#F8F4EE] border border-[#E7DED3] overflow-hidden shrink-0">
                          <EditorialVisual src={g.imageUrl} alt={g.title} />
                        </div>
                        <div>
                          <div className="font-semibold text-[#171513]">{g.title}</div>
                          <div className="text-[10px] uppercase tracking-wider text-[#C65B2B]">
                            Gallery · {g.category}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) =>
                            setEditingAltMap({ ...editingAltMap, [key]: e.target.value })
                          }
                          className="w-full px-3 py-1.5 bg-[#F8F4EE] border border-[#E7DED3]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await saveGalleryItem({ ...g, caption: currentVal });
                            onShowToast(`Updated SEO alt caption for "${g.title}".`);
                          }}
                          className="px-3 py-1.5 bg-[#171513] text-white uppercase tracking-wider shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: SEARCH READINESS, SITEMAP, JSON-LD & GOOGLE GUIDES
         ===================================================================== */}
      {subTab === 'readiness' && (
        <div className="space-y-6 text-xs">
          {/* 1. Factual Search Readiness Diagnostic Grid */}
          <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
            <div className="border-b border-[#E7DED3] pb-3">
              <div className="text-[11px] uppercase tracking-widest text-[#58644E] font-semibold">
                Real-Time Technical SEO Diagnostics
              </div>
              <h2 className="text-xl font-editorial font-semibold mt-0.5">
                Search Readiness &amp; Metadata Completeness Audit
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-[#F8F4EE] border border-[#E7DED3] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171513]">Public Route Titles</span>
                  {readinessReport.missingTitles.length === 0 &&
                  readinessReport.duplicateTitles.length === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-[#58644E]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#C65B2B]" />
                  )}
                </div>
                <div className="text-[#171513]/70">
                  {readinessReport.pagesList.length} routes configured ·{' '}
                  {readinessReport.duplicateTitles.length} duplicates
                </div>
              </div>

              <div className="p-4 bg-[#F8F4EE] border border-[#E7DED3] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171513]">Meta Descriptions</span>
                  {readinessReport.missingDescs.length === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-[#58644E]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#C65B2B]" />
                  )}
                </div>
                <div className="text-[#171513]/70">
                  {readinessReport.pagesList.length - readinessReport.missingDescs.length} /{' '}
                  {readinessReport.pagesList.length} routes have full descriptions
                </div>
              </div>

              <div className="p-4 bg-[#F8F4EE] border border-[#E7DED3] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171513]">
                    Google Search Favicon Endpoints
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#58644E]" />
                </div>
                <div className="text-[#171513]/70 font-mono-tabular">
                  /favicon.ico · 48×48 · 96×96 · 192×192 active
                </div>
              </div>

              <div className="p-4 bg-[#F8F4EE] border border-[#E7DED3] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171513]">
                    Schema.org JSON-LD Graph
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#58644E]" />
                </div>
                <div className="text-[#171513]/70">
                  WebSite, Organization, CafeOrCoffeeShop, Menu &amp; BreadcrumbList
                </div>
              </div>

              <div className="p-4 bg-[#F8F4EE] border border-[#E7DED3] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171513]">
                    Image Alt-Text &amp; Captions
                  </span>
                  {readinessReport.menuMissingAlt.length === 0 &&
                  readinessReport.galleryMissingAlt.length === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-[#58644E]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#C65B2B]" />
                  )}
                </div>
                <div className="text-[#171513]/70">
                  {readinessReport.menuMissingAlt.length +
                    readinessReport.galleryMissingAlt.length}{' '}
                  items missing descriptive text
                </div>
              </div>

              <div className="p-4 bg-[#F8F4EE] border border-[#E7DED3] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171513]">
                    Private Route Protection
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#58644E]" />
                </div>
                <div className="text-[#171513]/70">
                  `/admin`, `/admin/seo` &amp; `/reserve/voucher/*` set to `noindex`
                </div>
              </div>
            </div>
          </div>

          {/* 2. Live Structured Data (JSON-LD) Inspector & Validation Links */}
          <div className="bg-white border border-[#E7DED3] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED3] pb-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                  Schema.org Structured Data Output
                </div>
                <h3 className="text-lg font-editorial font-semibold">
                  Live JSON-LD Graph (`WebSite`, `Organization`, `CafeOrCoffeeShop`)
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(
                    domainClean
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#171513] text-[#F8F4EE] uppercase tracking-wider inline-flex items-center gap-1.5"
                >
                  <FileCode className="w-3.5 h-3.5" /> Google Rich Results Test ↗
                </a>
                <a
                  href="https://validator.schema.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 border border-[#171513] text-[#171513] uppercase tracking-wider inline-flex items-center gap-1.5"
                >
                  Schema.org Validator ↗
                </a>
              </div>
            </div>

            <pre className="p-4 bg-[#171513] text-[#F8F4EE] font-mono-tabular text-[11px] overflow-x-auto max-h-72 leading-relaxed">
              {JSON.stringify(
                buildStructuredDataGraph(globalForm, seoPages.home || DEFAULT_PAGE_SEO.home),
                null,
                2
              )}
            </pre>
          </div>

          {/* 3. Google Search Console & Google Business Profile Checklists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E7DED3] p-6 space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold">
                Step-by-Step Search Console Workflow
              </div>
              <h3 className="text-lg font-editorial font-semibold">
                Google Search Console Setup &amp; Favicon Re-Crawl Guide
              </h3>
              <ol className="space-y-2.5 text-[#171513]/80 list-decimal list-inside leading-relaxed">
                <li>
                  Open{' '}
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#C65B2B] underline"
                  >
                    Google Search Console
                  </a>{' '}
                  and add property <code className="font-mono">{domainClean}</code>.
                </li>
                <li>
                  Copy the HTML Meta Tag verification token and paste it into{' '}
                  <strong>Global SEO → Google Search Console Verification Code</strong>, then click
                  Save.
                </li>
                <li>
                  In Search Console under <strong>Sitemaps</strong>, submit{' '}
                  <code className="font-mono">{domainClean}/sitemap.xml</code>.
                </li>
                <li>
                  To refresh your <strong>Google Search Favicon &amp; Site Name</strong> after
                  updating, use the <strong>URL Inspection Tool</strong> on{' '}
                  <code className="font-mono">{domainClean}/</code> and click{' '}
                  <strong>Request Indexing</strong>. (Note: Google caches favicons and may take
                  several days to a few weeks to reflect updates in live SERPs).
                </li>
              </ol>
            </div>

            <div className="bg-white border border-[#E7DED3] p-6 space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-[#58644E] font-semibold">
                Sigiriya Local Pack &amp; Google Maps Ranking
              </div>
              <h3 className="text-lg font-editorial font-semibold">
                Google Business Profile Optimization Checklist
              </h3>
              <ul className="space-y-2 text-[#171513]/80 leading-relaxed">
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#C65B2B] shrink-0 mt-0.5" />
                  <span>
                    <strong>Exact NAP Match:</strong> Ensure Business Name (
                    <em>{globalForm.siteName}</em>), Address (<em>{globalForm.streetAddress}</em>),
                    and Phone (<em>{globalForm.telephone}</em>) match your Google Business Profile
                    character-for-character.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#C65B2B] shrink-0 mt-0.5" />
                  <span>
                    <strong>Primary &amp; Secondary Categories:</strong> Set Primary Category to{' '}
                    <code>Café</code> and add <code>Breakfast restaurant</code>,{' '}
                    <code>Brunch restaurant</code>, <code>Coffee shop</code>, and{' '}
                    <code>Sri Lankan restaurant</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#C65B2B] shrink-0 mt-0.5" />
                  <span>
                    <strong>Direct Action Links:</strong> Set Website URL to{' '}
                    <code className="font-mono">{domainClean}</code>, Menu URL to{' '}
                    <code className="font-mono">{domainClean}/menu</code>, and Table Reservation
                    URL to <code className="font-mono">{domainClean}/reserve</code>.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
