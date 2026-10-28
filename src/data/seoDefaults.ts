import { GlobalSeoConfig, PageSeoConfig, SeoKeywordCategory, SeoPageKey } from '../types/seo';

export const DEFAULT_BRAND_FAVICON_PATH =
  '/assets/aistudio/WhatsApp_Image_2026-10-26_at_07.57.02_10c5e84e.jpg';

export const DEFAULT_BRAND_LOGO_PATH =
  '/assets/aistudio/WhatsApp_Image_2026-10-26_at_07.57.02-removebg-preview_7b99b00d.png';

export const DEFAULT_GLOBAL_SEO: GlobalSeoConfig = {
  id: 'main',
  siteName: 'OneLove Café',
  alternateNames: [
    'OneLove Café Sigiriya',
    'OneLove Cafe Sigiriya',
    'One Love Cafe Sigiriya',
    'One Love Cafe Sri Lanka',
    'One Love Café Sri Lanka',
    'One Love Cafe Lanka',
    'One Love Cafe',
    'OneLove Sigiriya',
  ],
  defaultTitle: 'OneLove Café Sigiriya | Café & Restaurant in Sri Lanka',
  titleTemplate: '%s | OneLove Café Sigiriya',
  defaultDescription:
    'Visit OneLove Café in Sigiriya, Central Province, Sri Lanka. Explore our specialty coffee & brunch menu, get directions near Lion Rock, and reserve a table.',
  canonicalDomain: 'https://onelovecafesigiriya.com',
  language: 'en',
  googleVerificationTag: '',
  defaultOgImageUrl: DEFAULT_BRAND_LOGO_PATH,
  brandLogoUrl: DEFAULT_BRAND_LOGO_PATH,
  faviconSourceUrl: DEFAULT_BRAND_FAVICON_PATH,
  favicon48Url: '/favicon-48x48.png',
  favicon96Url: '/favicon-96x96.png',
  favicon192Url: '/favicon-192x192.png',
  appleTouchIconUrl: '/apple-touch-icon.png',
  allowIndexing: true,
  noindexPreviewDomains: false,
  businessType: 'CafeOrCoffeeShop',
  streetAddress: 'Lion Rock Sanctuary Road, Kimbissa',
  addressLocality: 'Sigiriya',
  addressRegion: 'Central Province',
  postalCode: '21120',
  addressCountry: 'LK',
  latitude: 7.9541,
  longitude: 80.7547,
  telephone: '+94 66 228 6420',
  whatsapp: '+94 77 842 9100',
  email: 'concierge@onelovecafe.lk',
  priceRange: '$$',
  servesCuisine: [
    'Cafe',
    'Breakfast',
    'Brunch',
    'Specialty Coffee',
    'Sri Lankan',
    'Western',
    'Smoothie Bowls',
    'Vegetarian',
    'Vegan Options',
  ],
  openingHoursSpec: 'Mo-Su 07:30-22:30',
  socialLinks: ['https://www.instagram.com/onelovesigiriya'],
  customKeywords: [],
  imageAltOverrides: {},
};

export const DEFAULT_PAGE_SEO: Record<SeoPageKey, PageSeoConfig> = {
  home: {
    id: 'home',
    routePath: '/',
    pageLabel: 'Home (/)',
    title: 'OneLove Café Sigiriya | Café & Restaurant in Sri Lanka',
    metaDescription:
      'Visit OneLove Café in Sigiriya, Central Province, Sri Lanka. Explore our specialty coffee & brunch menu, get directions near Lion Rock, and reserve a table.',
    canonicalPath: '/',
    primaryKeyword: 'OneLove Cafe Sigiriya',
    supportingKeywords: [
      'One Love Cafe Sri Lanka',
      'One Love Cafe Lanka',
      'One Love Cafe',
      'One Love Cafe Sigiriya',
      'cafe in Sigiriya',
      'restaurants in Sigiriya',
      'best breakfast in Sigiriya',
      'best coffee in Sigiriya',
    ],
    ogTitle: 'OneLove Café Sigiriya | Café & Restaurant in Sri Lanka',
    ogDescription:
      'Visit OneLove Café in Sigiriya, Central Province, Sri Lanka. Explore our specialty coffee & brunch menu, get directions near Lion Rock, and reserve a table.',
    ogImageUrl: DEFAULT_BRAND_FAVICON_PATH,
    indexable: true,
  },
  menu: {
    id: 'menu',
    routePath: '/menu',
    pageLabel: 'Menu (/menu)',
    title: 'OneLove Café Menu | Breakfast, Brunch, Coffee & Smoothies in Sigiriya',
    metaDescription:
      'Explore the OneLove Café Sigiriya menu featuring specialty Ceylon espresso, smoothie bowls, avocado toast, Sri Lankan rice & curry, pancakes, and fresh tropical juices.',
    canonicalPath: '/menu',
    primaryKeyword: 'OneLove Cafe menu',
    supportingKeywords: [
      'One Love Cafe menu',
      'Sigiriya restaurant menu',
      'smoothie bowl Sigiriya',
      'avocado toast Sigiriya',
      'Sri Lankan food Sigiriya',
      'specialty coffee Sigiriya',
    ],
    ogTitle: 'OneLove Café Sigiriya Menu — Breakfast, Brunch, Coffee & Dining',
    ogDescription:
      'View dishes and prices in LKR & USD: highland pour-over coffee, smoothie bowls, hopper brunch plates, and wood-fired Sri Lankan cuisine.',
    ogImageUrl: DEFAULT_BRAND_FAVICON_PATH,
    indexable: true,
  },
  reserve: {
    id: 'reserve',
    routePath: '/reserve',
    pageLabel: 'Reservations (/reserve)',
    title: 'Reserve a Table | OneLove Café Sigiriya',
    metaDescription:
      'Book your table online at OneLove Café in Sigiriya, Sri Lanka. Choose your preferred seating zone on our interactive floor plan for breakfast, brunch, lunch, or dinner.',
    canonicalPath: '/reserve',
    primaryKeyword: 'OneLove Cafe reservations',
    supportingKeywords: [
      'table reservation Sigiriya',
      'book a restaurant in Sigiriya',
      'reserve cafe table Sigiriya',
      'outdoor dining Sigiriya',
      'restaurants around Lion Rock',
    ],
    ogTitle: 'Reserve a Table Online | OneLove Café Sigiriya Interactive Floor Plan',
    ogDescription:
      'Select your exact table across our Jungle Canopy Verandah, Laterite Stone Courtyard, Roastery Lounge, or Lotus Pavilion in Sigiriya.',
    ogImageUrl: DEFAULT_BRAND_FAVICON_PATH,
    indexable: true,
  },
  story: {
    id: 'story',
    routePath: '/story',
    pageLabel: 'Our Story (/story)',
    title: 'Our Story | OneLove Café in Sigiriya, Sri Lanka',
    metaDescription:
      'Discover the story and tropical garden architecture of OneLove Café in Sigiriya—crafted from local laterite earth, reclaimed teak, and Sri Lankan hospitality.',
    canonicalPath: '/story',
    primaryKeyword: 'One Love Café Sri Lanka',
    supportingKeywords: [
      'garden cafe Sigiriya',
      'Sigiriya cafe',
      'cafes around Sigiriya Rock',
      'OneLove Sigiriya',
      'Cultural Triangle Sri Lanka cafes',
    ],
    ogTitle: 'Our Sigiriya Story & Sanctuary Architecture | OneLove Café',
    ogDescription:
      'Crafted from laterite earth, reclaimed teak, and monsoon light beneath Sigiriya Lion Rock.',
    ogImageUrl: DEFAULT_BRAND_FAVICON_PATH,
    indexable: true,
  },
  gallery: {
    id: 'gallery',
    routePath: '/gallery',
    pageLabel: 'Gallery (/gallery)',
    title: 'Gallery | OneLove Café Sigiriya Atmosphere, Food & Coffee',
    metaDescription:
      'Browse photos of OneLove Café in Sigiriya, Sri Lanka: tropical garden seating, specialty coffee, colorful smoothie bowls, brunch plates, and evening ambiance.',
    canonicalPath: '/gallery',
    primaryKeyword: 'One Love Cafe Sigiriya photos',
    supportingKeywords: [
      'OneLove Cafe Sigiriya',
      'best cafes in Sigiriya',
      'outdoor dining Sigiriya',
      'tropical breakfast Sri Lanka',
    ],
    ogTitle: 'Photography Gallery | OneLove Café Sigiriya',
    ogDescription:
      'Visual archive of OneLove Café Sigiriya: open-air jungle architecture, specialty coffee rituals, brunch, and candlelit evenings.',
    ogImageUrl: DEFAULT_BRAND_FAVICON_PATH,
    indexable: true,
  },
  contact: {
    id: 'contact',
    routePath: '/contact',
    pageLabel: 'Contact & Visit (/contact & /visit)',
    title: 'Location, Opening Hours & Contact | OneLove Café Sigiriya',
    metaDescription:
      'Find OneLove Café near Sigiriya Lion Rock and Pidurangala in Sri Lanka. View opening hours, Google Maps directions, WhatsApp concierge contact, and visitor details.',
    canonicalPath: '/contact',
    primaryKeyword: 'One Love Cafe location',
    supportingKeywords: [
      'One Love Cafe opening hours',
      'One Love Cafe Sigiriya contact',
      'where to eat after visiting Sigiriya Rock',
      'places to eat near Pidurangala',
      'cafe near me in Sigiriya',
    ],
    ogTitle: 'Visit OneLove Café Sigiriya — Location, Hours & Directions',
    ogDescription:
      'Located on Lion Rock Sanctuary Road in Kimbissa, Sigiriya. Open daily 7:30 AM – 10:30 PM for sunrise coffee, brunch, and dinner.',
    ogImageUrl: DEFAULT_BRAND_FAVICON_PATH,
    indexable: true,
  },
  events: {
    id: 'events',
    routePath: '/events',
    pageLabel: 'Experiences & Events (/events)',
    title: 'Acoustic Nights & Coffee Cuppings | OneLove Café Sigiriya',
    metaDescription:
      'Join twilight acoustic music sessions, Highland Ceylon coffee cuppings, and seasonal dining experiences at OneLove Café in Sigiriya, Sri Lanka.',
    canonicalPath: '/events',
    primaryKeyword: 'acoustic music Sigiriya',
    supportingKeywords: [
      'coffee cupping Sri Lanka',
      'dinner in Sigiriya',
      'romantic dinner Sigiriya',
      'Sigiriya travel food guide',
    ],
    ogTitle: 'Experiences, Acoustic Nights & Coffee Cuppings | OneLove Café Sigiriya',
    ogDescription:
      'Weekly acoustic guitar evenings, single-estate Ceylon coffee tastings, and claypot supper clubs in Sigiriya.',
    ogImageUrl: DEFAULT_BRAND_FAVICON_PATH,
    indexable: true,
  },
};

export const SEO_KEYWORD_LIBRARY: SeoKeywordCategory[] = [
  {
    key: 'brand',
    label: 'A. Brand Keywords',
    description:
      'Direct brand searches and navigational queries for OneLove Café in Sigiriya, Sri Lanka.',
    keywords: [
      'OneLove Cafe Sigiriya',
      'One Love Cafe Sigiriya',
      'One Love Café Sri Lanka',
      'OneLove Cafe Sri Lanka',
      'One Love Cafe Lanka',
      'One Love Cafe',
      'One Love Cafe menu',
      'OneLove Cafe menu',
      'One Love Cafe breakfast',
      'One Love Cafe brunch',
      'One Love Cafe restaurant',
      'OneLove Cafe reservations',
      'One Love Sigiriya',
      'One Love Sigiriya cafe',
      'One Love Cafe location',
      'One Love Cafe reviews',
      'OneLove Sigiriya',
      'One Love Sigiriya coffee',
      'One Love Cafe opening hours',
      'One Love Cafe Sigiriya photos',
      'One Love Cafe Sigiriya contact',
    ],
  },
  {
    key: 'local_cafe',
    label: 'B. High-Intent Local Café Keywords',
    description:
      'High-conversion local discovery searches from travelers looking for cafés and restaurants in Sigiriya.',
    keywords: [
      'cafe in Sigiriya',
      'cafes in Sigiriya',
      'Sigiriya cafe',
      'coffee shop Sigiriya',
      'coffee in Sigiriya',
      'best cafes in Sigiriya',
      'best cafe Sigiriya',
      'Sigiriya coffee shop',
      'Sigiriya breakfast cafe',
      'Sigiriya brunch cafe',
      'restaurant in Sigiriya',
      'restaurants in Sigiriya',
      'places to eat in Sigiriya',
      'Sigiriya food places',
      'where to eat in Sigiriya',
      'breakfast in Sigiriya',
      'brunch in Sigiriya',
      'lunch in Sigiriya',
      'Sigiriya restaurant menu',
      'cafe near me in Sigiriya',
      'breakfast near me Sigiriya',
      'coffee near me Sigiriya',
      'restaurants near me Sigiriya',
    ],
  },
  {
    key: 'breakfast_brunch',
    label: 'C. Breakfast & Brunch Keywords',
    description:
      'Morning and post-climb dining searches for smoothie bowls, avocado toast, pancakes, and Sri Lankan breakfast.',
    keywords: [
      'best breakfast in Sigiriya',
      'best brunch in Sigiriya',
      'breakfast restaurant Sigiriya',
      'brunch restaurant Sigiriya',
      'healthy breakfast Sigiriya',
      'healthy brunch Sri Lanka',
      'pancakes in Sigiriya',
      'smoothie bowl Sigiriya',
      'smoothie bowls Sri Lanka',
      'granola bowl Sigiriya',
      'French toast Sigiriya',
      'avocado toast Sigiriya',
      'tropical breakfast Sri Lanka',
      'western breakfast Sigiriya',
      'continental breakfast Sigiriya',
      'Sri Lankan breakfast Sigiriya',
      'fresh fruit bowl Sigiriya',
      'vegetarian breakfast Sigiriya',
      'breakfast and coffee Sigiriya',
      'breakfast spots in Sigiriya',
      'morning cafe Sigiriya',
    ],
  },
  {
    key: 'coffee_beverages',
    label: 'D. Coffee & Beverages',
    description:
      'Specialty espresso, iced coffee, matcha, and fresh tropical fruit smoothie searches.',
    keywords: [
      'best coffee in Sigiriya',
      'specialty coffee Sigiriya',
      'espresso Sigiriya',
      'cappuccino Sigiriya',
      'latte Sigiriya',
      'iced coffee Sigiriya',
      'iced latte Sigiriya',
      'iced matcha Sigiriya',
      'matcha latte Sigiriya',
      'fresh juice Sigiriya',
      'tropical fruit juice Sigiriya',
      'mango smoothie Sigiriya',
      'fresh smoothies Sigiriya',
      'papaya juice Sigiriya',
      'passion fruit juice Sigiriya',
      'coconut water Sigiriya',
      'fruit lassi Sigiriya',
      'healthy drinks Sigiriya',
      'coffee and breakfast Sigiriya',
    ],
  },
  {
    key: 'dining_cuisine',
    label: 'E. Dining & Cuisine',
    description:
      'Cuisine-specific searches covering Sri Lankan rice & curry, vegan/vegetarian options, and Western plates.',
    keywords: [
      'Sri Lankan food Sigiriya',
      'Sri Lankan restaurant Sigiriya',
      'rice and curry Sigiriya',
      'healthy food Sigiriya',
      'fresh food Sigiriya',
      'vegetarian food Sigiriya',
      'vegan options Sigiriya',
      'salads Sigiriya',
      'Western food Sigiriya',
      'tropical food Sri Lanka',
      'fresh fruit Sigiriya',
      'local food Sigiriya',
      'international food Sigiriya',
      'breakfast and lunch Sigiriya',
      'casual dining Sigiriya',
      'family dining Sigiriya',
    ],
  },
  {
    key: 'tourism_destination',
    label: 'F. Tourism & Destination Searches',
    description:
      'Itinerary-driven queries from visitors climbing Sigiriya Lion Rock Fortress and Pidurangala Rock.',
    keywords: [
      'where to eat after visiting Sigiriya Rock',
      'breakfast before Sigiriya Rock',
      'cafes around Sigiriya Rock',
      'food around Sigiriya Rock',
      'coffee after Sigiriya Rock hike',
      'where to have breakfast in Sigiriya',
      'restaurants around Lion Rock',
      'places to eat near Pidurangala',
      'Sigiriya travel food guide',
      'Sigiriya tourist cafes',
      'Sigiriya dining guide',
      'where to eat near Sigiriya Rock Fortress',
      'Cultural Triangle Sri Lanka cafes',
      'Dambulla and Sigiriya restaurants',
    ],
  },
  {
    key: 'reservations_experiences',
    label: 'G. Reservations & Experiences',
    description:
      'Transactional table booking, garden atmosphere, and evening acoustic music queries.',
    keywords: [
      'table reservation Sigiriya',
      'book a restaurant in Sigiriya',
      'reserve cafe table Sigiriya',
      'outdoor dining Sigiriya',
      'garden cafe Sigiriya',
      'acoustic music Sigiriya',
      'coffee cupping Sri Lanka',
      'romantic dinner Sigiriya',
      'private dining Sigiriya',
    ],
  },
  {
    key: 'alternative_spellings',
    label: 'H. Alternative Spellings & Variations',
    description:
      'Common spelling variations used by international and local guests.',
    keywords: [
      'OneLove',
      'One Love',
      'OneLove Cafe',
      'One Love Cafe',
      'OneLove Café',
      'One Love Café',
      'Sigiriya',
      'Seegiriya',
      'Lion Rock Sigiriya',
      'Kimbissa Sigiriya',
    ],
  },
  {
    key: 'sinhala',
    label: 'I. Sinhala Searches (සිංහල)',
    description:
      'Local Sinhala search queries for Sigiriya cafés, restaurants, coffee, and breakfast.',
    keywords: [
      'සීගිරිය කැෆේ',
      'සීගිරිය ආපනශාලා',
      'සීගිරිය කෑම කඩ',
      'සීගිරිය හොඳම කැෆේ',
      'සීගිරිය කෝපි',
      'සීගිරිය උදේ ආහාර',
      'OneLove Cafe සීගිරිය',
    ],
  },
  {
    key: 'tamil',
    label: 'J. Tamil Searches (தமிழ்)',
    description:
      'Local Tamil search queries for Sigiriya cafés, dining, coffee, and morning meals.',
    keywords: [
      'சிகிரியா கபே',
      'சிகிரியா உணவகம்',
      'சிகிரியா காபி கடை',
      'சிகிரியா காலை உணவு',
      'ஒன் லவ் கபே சிகிரியா',
    ],
  },
];

export function buildStructuredDataGraph(
  globalSeo: GlobalSeoConfig,
  pageSeo: PageSeoConfig
): Record<string, unknown> {
  const domain = (globalSeo.canonicalDomain || 'https://onelovecafesigiriya.com').replace(
    /\/+$/,
    ''
  );
  const canonicalUrl = `${domain}${
    pageSeo.canonicalPath.startsWith('/') ? pageSeo.canonicalPath : `/${pageSeo.canonicalPath}`
  }`;
  const logoUrl = globalSeo.brandLogoUrl.startsWith('http')
    ? globalSeo.brandLogoUrl
    : `${domain}${globalSeo.brandLogoUrl.startsWith('/') ? globalSeo.brandLogoUrl : `/${globalSeo.brandLogoUrl}`}`;

  const graph: Record<string, unknown>[] = [
    // 1. WebSite Schema (Required by Google Search for Site Name & Favicon association)
    {
      '@type': 'WebSite',
      '@id': `${domain}/#website`,
      name: globalSeo.siteName || 'OneLove Café Sigiriya',
      alternateName:
        globalSeo.alternateNames && globalSeo.alternateNames.length > 0
          ? globalSeo.alternateNames
          : [
              'OneLove Café Sigiriya',
              'OneLove Cafe Sigiriya',
              'One Love Cafe Sigiriya',
              'One Love Cafe Sri Lanka',
              'One Love Cafe Lanka',
              'One Love Cafe',
            ],
      url: `${domain}/`,
      inLanguage: globalSeo.language || 'en',
    },
    // 2. Organization Schema
    {
      '@type': 'Organization',
      '@id': `${domain}/#organization`,
      name: globalSeo.siteName || 'OneLove Café Sigiriya',
      alternateName: globalSeo.alternateNames,
      url: `${domain}/`,
      logo: {
        '@type': 'ImageObject',
        url: logoUrl,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: globalSeo.telephone || '+94 66 228 6420',
        email: globalSeo.email || 'concierge@onelovecafe.lk',
        contactType: 'customer service',
        areaServed: 'LK',
        availableLanguage: ['en', 'si', 'ta'],
      },
      sameAs: globalSeo.socialLinks || ['https://www.instagram.com/onelovesigiriya'],
    },
    // 3. CafeOrCoffeeShop / Restaurant LocalBusiness Schema
    {
      '@type': [globalSeo.businessType || 'CafeOrCoffeeShop', 'Restaurant'],
      '@id': `${domain}/#cafe`,
      name: globalSeo.siteName || 'OneLove Café Sigiriya',
      alternateName: globalSeo.alternateNames,
      description: globalSeo.defaultDescription,
      url: `${domain}/`,
      logo: logoUrl,
      image: [logoUrl],
      telephone: globalSeo.telephone || '+94 66 228 6420',
      email: globalSeo.email || 'concierge@onelovecafe.lk',
      priceRange: globalSeo.priceRange || '$$',
      servesCuisine: globalSeo.servesCuisine,
      acceptsReservations: true,
      hasMenu: `${domain}/menu`,
      sameAs: globalSeo.socialLinks || ['https://www.instagram.com/onelovesigiriya'],
      address: {
        '@type': 'PostalAddress',
        streetAddress: globalSeo.streetAddress || 'Lion Rock Sanctuary Road, Kimbissa',
        addressLocality: globalSeo.addressLocality || 'Sigiriya',
        addressRegion: globalSeo.addressRegion || 'Central Province',
        postalCode: globalSeo.postalCode || '21120',
        addressCountry: globalSeo.addressCountry || 'LK',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: globalSeo.latitude,
        longitude: globalSeo.longitude,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          opens: '07:30',
          closes: '22:30',
        },
      ],
      potentialAction: {
        '@type': 'ReserveAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${domain}/reserve`,
          inLanguage: 'en',
          actionPlatform: [
            'http://schema.org/DesktopWebPlatform',
            'http://schema.org/MobileWebPlatform',
          ],
        },
        result: {
          '@type': 'FoodEstablishmentReservation',
          name: 'Table Reservation at OneLove Café Sigiriya',
        },
      },
    },
    // 4. BreadcrumbList Schema
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement:
        pageSeo.id === 'home'
          ? [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'OneLove Café Sigiriya',
                item: `${domain}/`,
              },
            ]
          : [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'OneLove Café Sigiriya',
                item: `${domain}/`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: pageSeo.title.split('|')[0].trim(),
                item: canonicalUrl,
              },
            ],
    },
  ];

  if (pageSeo.id === 'menu') {
    graph.push({
      '@type': 'Menu',
      '@id': `${domain}/menu#menu`,
      name: 'OneLove Café Sigiriya Menu',
      description: pageSeo.metaDescription,
      url: `${domain}/menu`,
      inLanguage: 'en',
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
