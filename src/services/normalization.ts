/**
 * Normalization utilities for merchant names, descriptions, and categories.
 */

// Common prefixes/suffixes added by payment processors
const PROCESSOR_PREFIXES = [
  /^sq\s*\*\s*/i,
  /^tst\s*\*\s*/i,
  /^sp\s*\*\s*/i,
  /^py\s*\*\s*/i,
  /^paypal\s*\*\s*/i,
  /^stripe\s*\*\s*/i,
  /^intuit\s*\*\s*/i,
  /^chk\s*\*\s*/i,
  /^apl\s*\*\s*apple\.com/i,
];

const CLEANUP_PATTERNS = [
  /\s+#?\d{3,}(?:\s|$).*/i, // trailing store numbers like #1948 or 48291
  /\s+\d{2}\/\d{2}.*/i,     // trailing dates like 10/03
  /\s+(?:inc|llc|corp|co|ltd|gmbh)\.?$/i,
  /\s+(?:online|web|store|pos|terminal|direct)\b/i,
  /\.com\b/i,
  /\s+[A-Z]{2}\s+\d{5}.*/i, // City, State Zip
];

// Whole-word matches only, so e.g. 'aws' does not match 'SHAWS' or 'PAWS'.
const BRAND_RULES: Array<[RegExp, string]> = [
  [/\b(?:aws|amazon\s*web\s*services)\b/, 'Amazon Web Services'],
  [/\b(?:google|gsuite|workspace)\b/, 'Google Workspace'],
  [/\bgithub\b/, 'GitHub'],
  [/\bslack\b/, 'Slack Technologies'],
  [/\bstripe\b/, 'Stripe Payments'],
  [/\bgusto\b/, 'Gusto Payroll'],
  [/\b(?:quickbooks|intuit)\b/, 'QuickBooks Online'],
  [/\bfigma\b/, 'Figma'],
  [/\bnotion\b/, 'Notion Labs'],
  [/\bhubspot\b/, 'HubSpot'],
  [/\bzoom\b/, 'Zoom Video'],
  [/\bdelta\s*air|\bdelta\.com\b/, 'Delta Air Lines'],
  [/\buber\s*eats\b/, 'Uber Eats'],
  [/\buber\b/, 'Uber'],
  [/\bwework\b/, 'WeWork'],
  [/\b(?:amex|american\s*express)\b/, 'American Express'],
  [/\bchase\s*(?:card|credit)\b/, 'Chase Credit Card'],
  [/\bcapital\s*one\b/, 'Capital One'],
  [/\bmercury\b/, 'Mercury Bank'],
];

export function cleanMerchantName(rawName: string, rawDescription?: string): string {
  if (!rawName && !rawDescription) return 'Unknown Merchant';
  
  let name = (rawName || rawDescription || '').trim();

  // Strip processor prefixes
  for (const prefix of PROCESSOR_PREFIXES) {
    if (prefix.test(name)) {
      name = name.replace(prefix, '').trim();
      break;
    }
  }

  // Known brand normalization dictionary (run first to avoid stripping words like 'web' in AWS)
  const lower = name.toLowerCase();
  for (const [pattern, brand] of BRAND_RULES) {
    if (pattern.test(lower)) return brand;
  }

  // Strip store numbers and trailing junk
  for (const pattern of CLEANUP_PATTERNS) {
    name = name.replace(pattern, '').trim();
  }

  // Capitalize words nicely
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
