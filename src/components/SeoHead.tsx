import React, { useEffect } from 'react';
import { useCafe } from '../context/CafeContext';
import { buildStructuredDataGraph, DEFAULT_BRAND_FAVICON_PATH } from '../data/seoDefaults';
import { SeoPageKey } from '../types/seo';

interface SeoHeadProps {
  currentPage:
    | 'home'
    | 'menu'
    | 'story'
    | 'gallery'
    | 'events'
    | 'contact'
    | 'reserve'
    | 'admin'
    | 'notfound';
  pathname: string;
  voucherCode?: string | null;
}

export const SeoHead: React.FC<SeoHeadProps> = ({ currentPage, pathname, voucherCode }) => {
  const { seoGlobal, seoPages } = useCafe();

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const domain = (seoGlobal.canonicalDomain || 'https://onelovecafesigiriya.com').replace(
      /\/+$/,
      ''
    );

    // Map route to page SEO config
    const isVoucher = Boolean(voucherCode) || pathname.toLowerCase().startsWith('/reserve/voucher/');
    const isAdminRoute = currentPage === 'admin' || pathname.toLowerCase().startsWith('/admin');
    const isNotFound = currentPage === 'notfound';

    const pageKey: SeoPageKey =
      currentPage === 'menu' ||
      currentPage === 'reserve' ||
      currentPage === 'story' ||
      currentPage === 'gallery' ||
      currentPage === 'contact' ||
      currentPage === 'events'
        ? currentPage
        : 'home';

    const activePageSeo = seoPages[pageKey] || seoPages.home;

    // Compute final title & description
    let finalTitle = activePageSeo.title || seoGlobal.defaultTitle;
    let finalDesc = activePageSeo.metaDescription || seoGlobal.defaultDescription;
    let canonicalPath = activePageSeo.canonicalPath || activePageSeo.routePath || '/';

    if (isAdminRoute) {
      finalTitle = `SEO & Hospitality Admin Console | ${seoGlobal.siteName || 'OneLove Café'}`;
      finalDesc = 'Protected administrative console for OneLove Café Sigiriya.';
      canonicalPath = '/admin';
    } else if (isVoucher) {
      finalTitle = `Reservation Voucher ${voucherCode || ''} | ${seoGlobal.siteName || 'OneLove Café'}`;
      finalDesc = 'Confirmed table reservation voucher at OneLove Café Sigiriya.';
      canonicalPath = '/reserve';
    } else if (isNotFound) {
      finalTitle = `Page Not Found | ${seoGlobal.siteName || 'OneLove Café'} Sigiriya`;
      finalDesc = seoGlobal.defaultDescription;
      canonicalPath = pathname;
    }

    document.title = finalTitle;
    document.documentElement.lang = seoGlobal.language || 'en';

    const upsertMeta = (
      attrName: 'name' | 'property',
      attrValue: string,
      content: string,
      id?: string
    ) => {
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        if (id) el.id = id;
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const canonicalUrl = `${domain}${
      canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`
    }`;

    // Resolve Open Graph image URL
    const rawOgImg =
      activePageSeo.ogImageUrl || seoGlobal.defaultOgImageUrl || DEFAULT_BRAND_FAVICON_PATH;
    const ogImgUrl =
      rawOgImg.startsWith('http') || rawOgImg.startsWith('data:')
        ? rawOgImg
        : `${domain}${rawOgImg.startsWith('/') ? rawOgImg : `/${rawOgImg}`}`;

    // Keywords meta tag combining primary + supporting keywords
    const combinedKeywords = Array.from(
      new Set([
        activePageSeo.primaryKeyword,
        ...(activePageSeo.supportingKeywords || []),
        ...(seoGlobal.alternateNames || []),
      ])
    )
      .filter(Boolean)
      .join(', ');

    upsertMeta('name', 'description', finalDesc);
    upsertMeta('name', 'keywords', combinedKeywords);
    upsertMeta('name', 'application-name', seoGlobal.siteName || 'OneLove Café');
    upsertMeta('name', 'apple-mobile-web-app-title', seoGlobal.siteName || 'OneLove Café');

    // Open Graph tags
    upsertMeta('property', 'og:type', currentPage === 'menu' ? 'restaurant.menu' : 'website');
    upsertMeta('property', 'og:site_name', seoGlobal.siteName || 'OneLove Café');
    upsertMeta('property', 'og:title', activePageSeo.ogTitle || finalTitle);
    upsertMeta('property', 'og:description', activePageSeo.ogDescription || finalDesc);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', ogImgUrl);
    upsertMeta('property', 'og:locale', 'en_US');

    // Twitter Card tags
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', activePageSeo.ogTitle || finalTitle);
    upsertMeta('name', 'twitter:description', activePageSeo.ogDescription || finalDesc);
    upsertMeta('name', 'twitter:image', ogImgUrl);

    // Google Search Console verification tag
    if (seoGlobal.googleVerificationTag && seoGlobal.googleVerificationTag.trim()) {
      const cleanToken = seoGlobal.googleVerificationTag
        .replace(/<meta[^>]*content=["']?([^"'>\s]+)["']?[^>]*>/i, '$1')
        .trim();
      upsertMeta('name', 'google-site-verification', cleanToken);
    }

    // Robots indexing control
    const isPreviewHost =
      seoGlobal.noindexPreviewDomains &&
      typeof window !== 'undefined' &&
      !window.location.hostname.includes('onelovecafesigiriya.com') &&
      !window.location.hostname.includes('onelovecafe.lk');

    const shouldIndex =
      seoGlobal.allowIndexing &&
      activePageSeo.indexable &&
      !isAdminRoute &&
      !isVoucher &&
      !isNotFound &&
      !isPreviewHost;

    upsertMeta(
      'name',
      'robots',
      shouldIndex
        ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        : 'noindex, nofollow',
      'meta-robots'
    );

    // Canonical Link
    let canonicalEl = document.getElementById('canonical-link') as HTMLLinkElement | null;
    if (!canonicalEl) {
      canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    }
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.id = 'canonical-link';
      canonicalEl.rel = 'canonical';
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.href = canonicalUrl;

    // Update Favicon Links dynamically if custom cropped icons exist in seoGlobal
    const updateIconLink = (id: string, rel: string, sizes: string, href: string) => {
      let link = document.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = rel;
        if (sizes) link.sizes = sizes;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    const fav48 =
      seoGlobal.favicon48Url && seoGlobal.favicon48Url.startsWith('data:')
        ? seoGlobal.favicon48Url
        : '/favicon-48x48.png';
    const fav96 =
      seoGlobal.favicon96Url && seoGlobal.favicon96Url.startsWith('data:')
        ? seoGlobal.favicon96Url
        : '/favicon-96x96.png';
    const fav192 =
      seoGlobal.favicon192Url && seoGlobal.favicon192Url.startsWith('data:')
        ? seoGlobal.favicon192Url
        : '/favicon-192x192.png';
    const appleIcon =
      seoGlobal.appleTouchIconUrl && seoGlobal.appleTouchIconUrl.startsWith('data:')
        ? seoGlobal.appleTouchIconUrl
        : '/apple-touch-icon.png';

    updateIconLink('favicon-ico', 'icon', 'any', '/favicon.ico');
    updateIconLink('favicon-shortcut', 'shortcut icon', '', '/favicon.ico');
    updateIconLink('favicon-48', 'icon', '48x48', fav48);
    updateIconLink('favicon-96', 'icon', '96x96', fav96);
    updateIconLink('favicon-192', 'icon', '192x192', fav192);
    updateIconLink('apple-touch-icon', 'apple-touch-icon', '180x180', appleIcon);

    // Update JSON-LD Structured Data script
    if (!isAdminRoute) {
      const jsonLdData = buildStructuredDataGraph(seoGlobal, activePageSeo);
      let scriptEl = document.getElementById('onelove-jsonld') as HTMLScriptElement | null;
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = 'onelove-jsonld';
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLdData, null, 2);
    }
  }, [currentPage, pathname, voucherCode, seoGlobal, seoPages]);

  return null;
};
