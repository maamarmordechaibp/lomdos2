// Static categories for the bookstore
// These are hardcoded and don't require database connectivity

export interface Subcategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  subcategories?: Subcategory[];
}

// Jewish bookstore categories with subcategories
const CATEGORIES: Category[] = [
  { 
    id: '1', 
    name: 'Chumash', 
    sort_order: 1,
    subcategories: [
      { id: '1-1', name: 'Bereishis', sort_order: 1 },
      { id: '1-2', name: 'Shemos', sort_order: 2 },
      { id: '1-3', name: 'Vayikra', sort_order: 3 },
      { id: '1-4', name: 'Bamidbar', sort_order: 4 },
      { id: '1-5', name: 'Devarim', sort_order: 5 },
      { id: '1-6', name: 'Complete Sets', sort_order: 6 },
      { id: '1-7', name: 'With Commentary', sort_order: 7 },
    ]
  },
  { 
    id: '2', 
    name: 'Gemara', 
    sort_order: 2,
    subcategories: [
      { id: '2-1', name: 'Shas', sort_order: 1 },
      { id: '2-2', name: 'Individual Masechtos', sort_order: 2 },
      { id: '2-3', name: 'Artscroll', sort_order: 3 },
      { id: '2-4', name: 'Mesivta', sort_order: 4 },
      { id: '2-5', name: 'Oz Vehadar', sort_order: 5 },
    ]
  },
  { 
    id: '3', 
    name: 'Mishnah', 
    sort_order: 3,
    subcategories: [
      { id: '3-1', name: 'Complete Sets', sort_order: 1 },
      { id: '3-2', name: 'Individual Sedarim', sort_order: 2 },
      { id: '3-3', name: 'With Commentary', sort_order: 3 },
    ]
  },
  { 
    id: '4', 
    name: 'Halacha', 
    sort_order: 4,
    subcategories: [
      { id: '4-1', name: 'Shulchan Aruch', sort_order: 1 },
      { id: '4-2', name: 'Mishnah Berurah', sort_order: 2 },
      { id: '4-3', name: 'Kitzur Shulchan Aruch', sort_order: 3 },
      { id: '4-4', name: 'Shabbos', sort_order: 4 },
      { id: '4-5', name: 'Kashrus', sort_order: 5 },
      { id: '4-6', name: 'Family Purity', sort_order: 6 },
      { id: '4-7', name: 'Brachos', sort_order: 7 },
      { id: '4-8', name: 'Other Halacha', sort_order: 8 },
    ]
  },
  { 
    id: '5', 
    name: 'Siddur/Tefilah', 
    sort_order: 5,
    subcategories: [
      { id: '5-1', name: 'Nusach Ashkenaz', sort_order: 1 },
      { id: '5-2', name: 'Nusach Sfard', sort_order: 2 },
      { id: '5-3', name: 'Nusach Ari', sort_order: 3 },
      { id: '5-4', name: 'Edot Hamizrach', sort_order: 4 },
      { id: '5-5', name: 'Interlinear', sort_order: 5 },
      { id: '5-6', name: 'Kids Siddurim', sort_order: 6 },
    ]
  },
  { 
    id: '6', 
    name: 'Machzor', 
    sort_order: 6,
    subcategories: [
      { id: '6-1', name: 'Rosh Hashanah', sort_order: 1 },
      { id: '6-2', name: 'Yom Kippur', sort_order: 2 },
      { id: '6-3', name: 'Sukkos', sort_order: 3 },
      { id: '6-4', name: 'Pesach', sort_order: 4 },
      { id: '6-5', name: 'Shavuos', sort_order: 5 },
      { id: '6-6', name: 'Complete Sets', sort_order: 6 },
    ]
  },
  { id: '7', name: 'Tehillim', sort_order: 7 },
  { 
    id: '8', 
    name: 'Nach', 
    sort_order: 8,
    subcategories: [
      { id: '8-1', name: 'Neviim', sort_order: 1 },
      { id: '8-2', name: 'Kesuvim', sort_order: 2 },
      { id: '8-3', name: 'Complete Sets', sort_order: 3 },
    ]
  },
  { id: '9', name: 'Midrash', sort_order: 9 },
  { 
    id: '10', 
    name: 'Mussar', 
    sort_order: 10,
    subcategories: [
      { id: '10-1', name: 'Classic Mussar', sort_order: 1 },
      { id: '10-2', name: 'Contemporary', sort_order: 2 },
      { id: '10-3', name: 'Self-Help', sort_order: 3 },
    ]
  },
  { 
    id: '11', 
    name: 'Chassidus', 
    sort_order: 11,
    subcategories: [
      { id: '11-1', name: 'Chabad', sort_order: 1 },
      { id: '11-2', name: 'Breslov', sort_order: 2 },
      { id: '11-3', name: 'Other Chassidus', sort_order: 3 },
    ]
  },
  { id: '12', name: 'Kabbalah', sort_order: 12 },
  { 
    id: '13', 
    name: 'Jewish History', 
    sort_order: 13,
    subcategories: [
      { id: '13-1', name: 'Holocaust', sort_order: 1 },
      { id: '13-2', name: 'Israel', sort_order: 2 },
      { id: '13-3', name: 'General History', sort_order: 3 },
    ]
  },
  { 
    id: '14', 
    name: 'Biography', 
    sort_order: 14,
    subcategories: [
      { id: '14-1', name: 'Gedolim', sort_order: 1 },
      { id: '14-2', name: 'Rebbes', sort_order: 2 },
      { id: '14-3', name: 'Inspirational Stories', sort_order: 3 },
    ]
  },
  { 
    id: '15', 
    name: "Children's Books", 
    sort_order: 15,
    subcategories: [
      { id: '15-1', name: 'Ages 0-3', sort_order: 1 },
      { id: '15-2', name: 'Ages 4-7', sort_order: 2 },
      { id: '15-3', name: 'Ages 8-12', sort_order: 3 },
      { id: '15-4', name: 'Teens', sort_order: 4 },
      { id: '15-5', name: 'Parsha Books', sort_order: 5 },
      { id: '15-6', name: 'Holiday Books', sort_order: 6 },
    ]
  },
  { 
    id: '16', 
    name: 'Hebrew Learning', 
    sort_order: 16,
    subcategories: [
      { id: '16-1', name: 'Beginners', sort_order: 1 },
      { id: '16-2', name: 'Advanced', sort_order: 2 },
      { id: '16-3', name: 'Dictionaries', sort_order: 3 },
    ]
  },
  { id: '17', name: 'Haggadah', sort_order: 17 },
  { id: '18', name: 'Megillot', sort_order: 18 },
  { id: '19', name: 'Seforim', sort_order: 19 },
  { 
    id: '20', 
    name: 'Fiction', 
    sort_order: 20,
    subcategories: [
      { id: '20-1', name: 'Adult Fiction', sort_order: 1 },
      { id: '20-2', name: 'Teen Fiction', sort_order: 2 },
      { id: '20-3', name: 'Historical Fiction', sort_order: 3 },
    ]
  },
  { id: '21', name: 'Cookbooks', sort_order: 21 },
  { 
    id: '22', 
    name: 'Judaica', 
    sort_order: 22,
    subcategories: [
      { id: '22-1', name: 'Mezuzos', sort_order: 1 },
      { id: '22-2', name: 'Tefillin', sort_order: 2 },
      { id: '22-3', name: 'Talleisim', sort_order: 3 },
      { id: '22-4', name: 'Kiddush Cups', sort_order: 4 },
      { id: '22-5', name: 'Menorahs', sort_order: 5 },
      { id: '22-6', name: 'Other Items', sort_order: 6 },
    ]
  },
  { id: '23', name: 'Other', sort_order: 23 },
];

export function useCategories() {
  const categories = CATEGORIES;
  const categoryNames = CATEGORIES.map(c => c.name);
  
  // Get all subcategory names grouped by parent category
  const getSubcategories = (categoryName: string): Subcategory[] => {
    const category = CATEGORIES.find(c => c.name === categoryName);
    return category?.subcategories || [];
  };

  // Get all category + subcategory combinations as flat list
  const allCategoryPaths = CATEGORIES.flatMap(cat => {
    if (cat.subcategories && cat.subcategories.length > 0) {
      return cat.subcategories.map(sub => `${cat.name} > ${sub.name}`);
    }
    return [cat.name];
  });

  return {
    categories,
    categoryNames,
    getSubcategories,
    allCategoryPaths,
    isLoading: false,
    error: null,
  };
}
