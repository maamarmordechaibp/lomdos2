// Static categories for the bookstore
// These are hardcoded and don't require database connectivity

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

// Jewish bookstore categories
const CATEGORIES: Category[] = [
  { id: '1', name: 'Chumash', sort_order: 1 },
  { id: '2', name: 'Gemara', sort_order: 2 },
  { id: '3', name: 'Mishnah', sort_order: 3 },
  { id: '4', name: 'Halacha', sort_order: 4 },
  { id: '5', name: 'Siddur/Tefilah', sort_order: 5 },
  { id: '6', name: 'Machzor', sort_order: 6 },
  { id: '7', name: 'Tehillim', sort_order: 7 },
  { id: '8', name: 'Nach', sort_order: 8 },
  { id: '9', name: 'Midrash', sort_order: 9 },
  { id: '10', name: 'Mussar', sort_order: 10 },
  { id: '11', name: 'Chassidus', sort_order: 11 },
  { id: '12', name: 'Kabbalah', sort_order: 12 },
  { id: '13', name: 'Jewish History', sort_order: 13 },
  { id: '14', name: 'Biography', sort_order: 14 },
  { id: '15', name: "Children's Books", sort_order: 15 },
  { id: '16', name: 'Hebrew Learning', sort_order: 16 },
  { id: '17', name: 'Haggadah', sort_order: 17 },
  { id: '18', name: 'Megillot', sort_order: 18 },
  { id: '19', name: 'Seforim', sort_order: 19 },
  { id: '20', name: 'Fiction', sort_order: 20 },
  { id: '21', name: 'Cookbooks', sort_order: 21 },
  { id: '22', name: 'Judaica', sort_order: 22 },
  { id: '23', name: 'Other', sort_order: 23 },
];

export function useCategories() {
  const categories = CATEGORIES;
  const categoryNames = CATEGORIES.map(c => c.name);

  return {
    categories,
    categoryNames,
    isLoading: false,
    error: null,
  };
}
