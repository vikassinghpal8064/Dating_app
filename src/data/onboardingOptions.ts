/**
 * Static option sets for the onboarding wizard. Deliberately small and
 * hand-maintained: the location combobox is a *filter over* this list, but
 * still accepts any typed value (the DB CHECKs enforce the length limits), so
 * a member who already set "Leeds / United Kingdom" at sign-up can keep it.
 */

/** Countries accept a typed value too; this is the filterable suggestion set. */
export const COUNTRIES = [
  'Australia',
  'Bangladesh',
  'Brazil',
  'Canada',
  'China',
  'Egypt',
  'France',
  'Germany',
  'India',
  'Indonesia',
  'Ireland',
  'Italy',
  'Japan',
  'Kenya',
  'Malaysia',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Pakistan',
  'Philippines',
  'Portugal',
  'Saudi Arabia',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Sweden',
  'Switzerland',
  'Thailand',
  'Turkey',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
] as const

/** Indian states, enough for the product's default market. */
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const

/** Every seeded city must be filterable so a resumed wizard shows it. */
export const CITIES = [
  'Ahmedabad',
  'Amritsar',
  'Bengaluru',
  'Bhopal',
  'Chandigarh',
  'Chennai',
  'Coimbatore',
  'Delhi',
  'Goa',
  'Guwahati',
  'Hyderabad',
  'Indore',
  'Jaipur',
  'Kanpur',
  'Kochi',
  'Kolkata',
  'Lucknow',
  'Mumbai',
  'Nagpur',
  'Nashik',
  'Patna',
  'Pune',
  'Surat',
  'Thiruvananthapuram',
  'Vadodara',
  'Varanasi',
  'Visakhapatnam',
  // International, so a member who typed a foreign city at sign-up
  // still gets suggestions.
  'Amsterdam',
  'Auckland',
  'Bangkok',
  'Berlin',
  'Dubai',
  'Dublin',
  'Jakarta',
  'Kuala Lumpur',
  'Leeds',
  'London',
  'Los Angeles',
  'Manchester',
  'Melbourne',
  'New York',
  'Paris',
  'San Francisco',
  'Singapore',
  'Sydney',
  'Toronto',
  'Vancouver',
] as const

/** Lifestyle answers must stay inside the fixed vocabulary the CHECKs allow. */
export const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'quitting', label: 'Quitting' },
] as const

export const DRINKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'quitting', label: 'Quitting' },
] as const

export const EXERCISE_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
  { value: 'daily', label: 'Daily' },
] as const

export const LOOKING_FOR_OPTIONS = [
  {
    value: 'casual',
    label: 'Something casual',
    description: 'Keep it light — coffees, good conversations, no pressure.',
  },
  {
    value: 'serious',
    label: 'A serious relationship',
    description: 'You are looking for a partner, not a pen pal.',
  },
  {
    value: 'friends',
    label: 'New friends',
    description: 'Hangouts and shared interests over romance.',
  },
  {
    value: 'unsure',
    label: 'Still figuring it out',
    description: 'No expectations yet — see where a good match goes.',
  },
] as const

/** Range of the height selector, in centimetres. */
export const HEIGHT_OPTIONS = Array.from({ length: 141 }, (_, i) => {
  const cm = 110 + i
  return { value: String(cm), label: `${cm} cm` }
})

/** Interests must yield at least 5 selections, so the list is larger. */
export const INTERESTS = [
  'archery',
  'architecture',
  'art',
  'baking',
  'birdwatching',
  'board games',
  'bouldering',
  'books',
  'chess',
  'climbing',
  'coffee',
  'cooking',
  'cricket',
  'crossword',
  'cycling',
  'dancing',
  'film',
  'fishing',
  'food',
  'gardening',
  'gaming',
  'hiking',
  'jazz',
  'kayaking',
  'karaoke',
  'live music',
  'meditation',
  'motorsport',
  'photography',
  'podcasts',
  'poetry',
  'pottery',
  'reading',
  'running',
  'salsa',
  'scuba diving',
  'sketching',
  'street food',
  'surfskate',
  'synths',
  'travel',
  'trekking',
  'vinyl',
  'volunteering',
  'yoga',
] as const

/** Languages accepted as free text; this is the filterable suggestion set. */
export const LANGUAGES = [
  'Assamese',
  'Bengali',
  'English',
  'French',
  'German',
  'Gujarati',
  'Hindi',
  'Italian',
  'Japanese',
  'Kannada',
  'Korean',
  'Malayalam',
  'Mandarin',
  'Marathi',
  'Odia',
  'Portuguese',
  'Punjabi',
  'Sanskrit',
  'Spanish',
  'Tamil',
  'Telugu',
  'Urdu',
] as const

/** Maps a raw value to its display label for each option set. */
export function labelFor(
  value: string | null | undefined,
  options: readonly { value: string; label: string }[]
): string {
  if (!value) return ''
  return options.find((option) => option.value === value)?.label ?? value
}