/** Country phone codes with flag emoji */
export interface CountryPhone {
  code: string;    // ISO 3166-1 alpha-2
  dial: string;    // Dial code with +
  flag: string;    // Emoji flag
  name: string;    // Country name (English)
}

export const COUNTRY_PHONES: CountryPhone[] = [
  { code: "AO", dial: "+244", flag: "\u{1F1E6}\u{1F1F4}", name: "Angola" },
  { code: "AR", dial: "+54", flag: "\u{1F1E6}\u{1F1F7}", name: "Argentina" },
  { code: "AU", dial: "+61", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  { code: "AT", dial: "+43", flag: "\u{1F1E6}\u{1F1F9}", name: "Austria" },
  { code: "BE", dial: "+32", flag: "\u{1F1E7}\u{1F1EA}", name: "Belgium" },
  { code: "BO", dial: "+591", flag: "\u{1F1E7}\u{1F1F4}", name: "Bolivia" },
  { code: "BR", dial: "+55", flag: "\u{1F1E7}\u{1F1F7}", name: "Brasil" },
  { code: "CA", dial: "+1", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  { code: "CL", dial: "+56", flag: "\u{1F1E8}\u{1F1F1}", name: "Chile" },
  { code: "CN", dial: "+86", flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
  { code: "CO", dial: "+57", flag: "\u{1F1E8}\u{1F1F4}", name: "Colombia" },
  { code: "CR", dial: "+506", flag: "\u{1F1E8}\u{1F1F7}", name: "Costa Rica" },
  { code: "CU", dial: "+53", flag: "\u{1F1E8}\u{1F1FA}", name: "Cuba" },
  { code: "CZ", dial: "+420", flag: "\u{1F1E8}\u{1F1FF}", name: "Czech Republic" },
  { code: "DK", dial: "+45", flag: "\u{1F1E9}\u{1F1F0}", name: "Denmark" },
  { code: "DO", dial: "+1", flag: "\u{1F1E9}\u{1F1F4}", name: "Dominican Republic" },
  { code: "EC", dial: "+593", flag: "\u{1F1EA}\u{1F1E8}", name: "Ecuador" },
  { code: "EG", dial: "+20", flag: "\u{1F1EA}\u{1F1EC}", name: "Egypt" },
  { code: "SV", dial: "+503", flag: "\u{1F1F8}\u{1F1FB}", name: "El Salvador" },
  { code: "ES", dial: "+34", flag: "\u{1F1EA}\u{1F1F8}", name: "España" },
  { code: "FI", dial: "+358", flag: "\u{1F1EB}\u{1F1EE}", name: "Finland" },
  { code: "FR", dial: "+33", flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
  { code: "DE", dial: "+49", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
  { code: "GR", dial: "+30", flag: "\u{1F1EC}\u{1F1F7}", name: "Greece" },
  { code: "GT", dial: "+502", flag: "\u{1F1EC}\u{1F1F9}", name: "Guatemala" },
  { code: "HN", dial: "+504", flag: "\u{1F1ED}\u{1F1F3}", name: "Honduras" },
  { code: "HK", dial: "+852", flag: "\u{1F1ED}\u{1F1F0}", name: "Hong Kong" },
  { code: "IN", dial: "+91", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
  { code: "ID", dial: "+62", flag: "\u{1F1EE}\u{1F1E9}", name: "Indonesia" },
  { code: "IE", dial: "+353", flag: "\u{1F1EE}\u{1F1EA}", name: "Ireland" },
  { code: "IL", dial: "+972", flag: "\u{1F1EE}\u{1F1F1}", name: "Israel" },
  { code: "IT", dial: "+39", flag: "\u{1F1EE}\u{1F1F9}", name: "Italy" },
  { code: "JP", dial: "+81", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
  { code: "KE", dial: "+254", flag: "\u{1F1F0}\u{1F1EA}", name: "Kenya" },
  { code: "MY", dial: "+60", flag: "\u{1F1F2}\u{1F1FE}", name: "Malaysia" },
  { code: "MX", dial: "+52", flag: "\u{1F1F2}\u{1F1FD}", name: "México" },
  { code: "MZ", dial: "+258", flag: "\u{1F1F2}\u{1F1FF}", name: "Mozambique" },
  { code: "NL", dial: "+31", flag: "\u{1F1F3}\u{1F1F1}", name: "Netherlands" },
  { code: "NZ", dial: "+64", flag: "\u{1F1F3}\u{1F1FF}", name: "New Zealand" },
  { code: "NI", dial: "+505", flag: "\u{1F1F3}\u{1F1EE}", name: "Nicaragua" },
  { code: "NG", dial: "+234", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigeria" },
  { code: "NO", dial: "+47", flag: "\u{1F1F3}\u{1F1F4}", name: "Norway" },
  { code: "PA", dial: "+507", flag: "\u{1F1F5}\u{1F1E6}", name: "Panamá" },
  { code: "PY", dial: "+595", flag: "\u{1F1F5}\u{1F1FE}", name: "Paraguay" },
  { code: "PE", dial: "+51", flag: "\u{1F1F5}\u{1F1EA}", name: "Perú" },
  { code: "PH", dial: "+63", flag: "\u{1F1F5}\u{1F1ED}", name: "Philippines" },
  { code: "PL", dial: "+48", flag: "\u{1F1F5}\u{1F1F1}", name: "Poland" },
  { code: "PT", dial: "+351", flag: "\u{1F1F5}\u{1F1F9}", name: "Portugal" },
  { code: "RO", dial: "+40", flag: "\u{1F1F7}\u{1F1F4}", name: "Romania" },
  { code: "RU", dial: "+7", flag: "\u{1F1F7}\u{1F1FA}", name: "Russia" },
  { code: "SA", dial: "+966", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Arabia" },
  { code: "SG", dial: "+65", flag: "\u{1F1F8}\u{1F1EC}", name: "Singapore" },
  { code: "ZA", dial: "+27", flag: "\u{1F1FF}\u{1F1E6}", name: "South Africa" },
  { code: "KR", dial: "+82", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
  { code: "SE", dial: "+46", flag: "\u{1F1F8}\u{1F1EA}", name: "Sweden" },
  { code: "CH", dial: "+41", flag: "\u{1F1E8}\u{1F1ED}", name: "Switzerland" },
  { code: "TW", dial: "+886", flag: "\u{1F1F9}\u{1F1FC}", name: "Taiwan" },
  { code: "TH", dial: "+66", flag: "\u{1F1F9}\u{1F1ED}", name: "Thailand" },
  { code: "TR", dial: "+90", flag: "\u{1F1F9}\u{1F1F7}", name: "Turkey" },
  { code: "AE", dial: "+971", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE" },
  { code: "UA", dial: "+380", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukraine" },
  { code: "GB", dial: "+44", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
  { code: "US", dial: "+1", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
  { code: "UY", dial: "+598", flag: "\u{1F1FA}\u{1F1FE}", name: "Uruguay" },
  { code: "VE", dial: "+58", flag: "\u{1F1FB}\u{1F1EA}", name: "Venezuela" },
  { code: "VN", dial: "+84", flag: "\u{1F1FB}\u{1F1F3}", name: "Vietnam" },
];

/** Find a country by ISO code */
export function findCountryByCode(code: string): CountryPhone | undefined {
  return COUNTRY_PHONES.find((c) => c.code === code);
}

/** Map i18n language to default country code */
const LOCALE_TO_COUNTRY: Record<string, string> = {
  "pt-BR": "BR",
  "en": "US",
  "es": "ES",
};

/** Get default country code based on locale */
export function getDefaultCountryCode(locale?: string): string {
  if (locale && LOCALE_TO_COUNTRY[locale]) return LOCALE_TO_COUNTRY[locale];
  return "BR";
}

/** Default country (fallback) */
export const DEFAULT_COUNTRY_CODE = "BR";
