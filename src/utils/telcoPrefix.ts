/**
 * Philippine Mobile Carrier / Telco Prefix Validator
 * Validates prefixes allocated by the National Telecommunications Commission (NTC).
 */

export type TelcoCarrier = 'Globe' | 'Smart' | 'DITO' | 'Unknown';

const GLOBE_PREFIXES = new Set([
  '905', '906', '915', '916', '917', '925', '926', '927', '935', '936', '937',
  '945', '953', '954', '955', '956', '965', '966', '967', '975', '976', '977', '978', '979', '995', '996', '997'
]);

const SMART_PREFIXES = new Set([
  '907', '908', '909', '910', '911', '912', '913', '914', '918', '919', '920',
  '921', '928', '929', '930', '938', '939', '940', '946', '947', '948', '949',
  '950', '951', '961', '963', '968', '969', '970', '971', '981', '989', '992', '998', '999'
]);

const DITO_PREFIXES = new Set([
  '991', '992', '993', '994'
]);

/**
 * Extracts 3-digit prefix from Philippine local number (e.g. 917 from 9171234567 or 09171234567).
 */
export function extractPhilippinePrefix(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('63') && clean.length >= 5) {
    return clean.slice(2, 5);
  }
  if (clean.startsWith('0') && clean.length >= 4) {
    return clean.slice(1, 4);
  }
  if (clean.length >= 3) {
    return clean.slice(0, 3);
  }
  return '';
}

/**
 * Detects the Philippine carrier for a given mobile number.
 */
export function detectPhilippineCarrier(phone: string): {
  carrier: TelcoCarrier;
  isValidPrefix: boolean;
  prefix: string;
} {
  const prefix = extractPhilippinePrefix(phone);
  if (!prefix || prefix.length < 3) {
    return { carrier: 'Unknown', isValidPrefix: false, prefix };
  }

  if (DITO_PREFIXES.has(prefix)) {
    return { carrier: 'DITO', isValidPrefix: true, prefix };
  }
  if (GLOBE_PREFIXES.has(prefix)) {
    return { carrier: 'Globe', isValidPrefix: true, prefix };
  }
  if (SMART_PREFIXES.has(prefix)) {
    return { carrier: 'Smart', isValidPrefix: true, prefix };
  }

  return { carrier: 'Unknown', isValidPrefix: false, prefix };
}
