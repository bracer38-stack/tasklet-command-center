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
  if (lower.includes('aws') || lower.includes('amazon web services')) return 'Amazon Web Services';
  if (lower.includes('google') || lower.includes('gsuite') || lower.includes('workspace')) return 'Google Workspace';
  if (lower.includes('github')) return 'GitHub';
  if (lower.includes('slack')) return 'Slack Technologies';
  if (lower.includes('stripe')) return 'Stripe Payments';
  if (lower.includes('gusto')) return 'Gusto Payroll';
  if (lower.includes('quickbooks') || lower.includes('intuit')) return 'QuickBooks Online';
  if (lower.includes('figma')) return 'Figma';
  if (lower.includes('notion')) return 'Notion Labs';
  if (lower.includes('hubspot')) return 'HubSpot';
  if (lower.includes('zoom')) return 'Zoom Video';
  if (lower.includes('delta air') || lower.includes('delta.com')) return 'Delta Air Lines';
  if (lower.includes('uber') && !lower.includes('eats')) return 'Uber';
  if (lower.includes('uber eats')) return 'Uber Eats';
  if (lower.includes('wework')) return 'WeWork';
  if (lower.includes('amex') || lower.includes('american express')) return 'American Express';
  if (lower.includes('chase card') || lower.includes('chase credit')) return 'Chase Credit Card';
  if (lower.includes('capital one')) return 'Capital One';
  if (lower.includes('mercury')) return 'Mercury Bank';

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
