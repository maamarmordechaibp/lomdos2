// Predefined categories for a Jewish bookstore
export const BOOK_CATEGORIES = [
  'Chumash',
  'Gemara',
  'Mishnah',
  'Halacha',
  'Siddur/Tefilah',
  'Machzor',
  'Tehillim',
  'Nach',
  'Midrash',
  'Mussar',
  'Chassidus',
  'Kabbalah',
  'Jewish History',
  'Biography',
  'Children\'s Books',
  'Hebrew Learning',
  'Haggadah',
  'Megillot',
  'Seforim',
  'Fiction',
  'Cookbooks',
  'Judaica',
  'Other',
] as const;

export type BookCategory = typeof BOOK_CATEGORIES[number];
