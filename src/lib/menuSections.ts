import { MenuCategory, MenuItem, MenuSection } from '../types/cafe';

const DRINK_CATEGORY_KEYWORDS = [
  'drink',
  'coffee',
  'roaster',
  'espresso',
  'brew',
  'beverage',
  'cocktail',
  'mocktail',
  'aperitif',
  'cooler',
  'juice',
  'smoothie',
  'tea',
  'matcha',
  'elixir',
  'botanical',
  'bar',
  'cellar',
  'wine',
  'beer',
  'spirit',
  'soda',
  'tonic',
  'shake',
];

/**
 * Resolves whether a MenuCategory belongs to the Food or Drinks section.
 * Uses explicit `section` when set in Firestore/Admin, with a smart fallback
 * for legacy category records that were created before `section` existed.
 */
export function resolveMenuCategorySection(
  category?: Partial<Pick<MenuCategory, 'id' | 'slug' | 'name' | 'section'>> | null
): MenuSection {
  if (!category) return 'food';
  if (category.section === 'food' || category.section === 'drinks') {
    return category.section;
  }
  const haystack = `${category.id || ''} ${category.slug || ''} ${category.name || ''}`.toLowerCase();
  return DRINK_CATEGORY_KEYWORDS.some((kw) => haystack.includes(kw)) ? 'drinks' : 'food';
}

export function resolveMenuItemSection(
  item: Pick<MenuItem, 'categoryId' | 'categoryName'>,
  categories: MenuCategory[]
): MenuSection {
  const cat = categories.find((c) => c.id === item.categoryId);
  if (cat) return resolveMenuCategorySection(cat);
  return resolveMenuCategorySection({ id: item.categoryId, name: item.categoryName });
}

export interface DietaryFlags {
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isSeafood: boolean;
  isDairyFree: boolean;
  isZeroProof: boolean;
  isSingleOrigin: boolean;
  isChefSignature: boolean;
  isSignature: boolean;
}

export function extractDietaryFlags(item: Pick<MenuItem, 'dietaryTags' | 'name' | 'description'>): DietaryFlags {
  const normalizedTags = (item.dietaryTags || []).map((t) => t.trim().toLowerCase());
  const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();

  const hasTag = (patterns: string[]) =>
    normalizedTags.some((tag) => patterns.some((p) => tag.includes(p)));

  const isVegan = hasTag(['vegan', 'plant-based', 'vg']);
  const isVegetarian = isVegan || hasTag(['vegetarian', 'veggie', '(v)']) || normalizedTags.includes('v');
  const isGlutenFree = hasTag(['gluten-free', 'gluten free', 'gf']);
  const isSeafood =
    hasTag(['seafood', 'ocean', 'coastal catch', 'fish', 'prawn', 'crab', 'sf']) ||
    /\b(prawn|prawns|crab|tuna|modha|barramundi|fish|calamari|squid|lobster|seafood)\b/.test(text);
  const isDairyFree = isVegan || hasTag(['dairy-free', 'dairy free', 'oat']);
  const isZeroProof = hasTag(['zero-proof', 'zero proof', 'non-alcoholic', 'mocktail', 'alcohol-free']);
  const isSingleOrigin = hasTag(['single-origin', 'single origin', 'estate', 'pour-over', 'arabica']);
  const isChefSignature = hasTag(['chef signature', "chef's", 'chef choice', 'hearth grill', 'local heritage']);
  const isSignature = isChefSignature || hasTag(['signature']);

  return {
    isVegetarian,
    isVegan,
    isGlutenFree,
    isSeafood,
    isDairyFree,
    isZeroProof,
    isSingleOrigin,
    isChefSignature,
    isSignature,
  };
}

export const COMMON_DIETARY_TAGS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Seafood',
  'Dairy-Free',
  'Zero-Proof',
  'Single-Origin',
  'Chef Signature',
  'Signature',
] as const;
