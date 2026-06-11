import { format, isToday, isBefore, differenceInDays, parseISO } from 'date-fns';
import { PRESET_TAGS } from './constants';

// ---- Date helpers ----
export const formatDate = (d) => {
  if (!d) return '—';
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'MM/dd/yy'); }
  catch { return '—'; }
};

export const formatDateTime = (d) => {
  if (!d) return '—';
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'MM/dd hh:mm a'); }
  catch { return '—'; }
};

export const taskUrgency = (due) => {
  if (!due) return 'upcoming';
  const d = typeof due === 'string' ? parseISO(due) : due;
  if (isBefore(d, new Date()) && !isToday(d)) return 'overdue';
  if (isToday(d)) return 'today';
  return 'upcoming';
};

export const urgencyColor = (urgency) => ({
  overdue:  { color: '#dc2626', bg: '#fee2e2' },
  today:    { color: '#d97706', bg: '#fef3c7' },
  upcoming: { color: '#16a34a', bg: '#dcfce7' },
}[urgency] || { color: '#6b7280', bg: '#f3f4f6' });

// ---- Loan calculations ----
export const calcPI = (loanAmount, rate, termYears = 30) => {
  if (!loanAmount || !rate) return null;
  const r = (rate / 100) / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
};

export const calcLTV = (loanAmount, purchasePrice) => {
  if (!loanAmount || !purchasePrice) return null;
  return ((loanAmount / purchasePrice) * 100).toFixed(1);
};

export const formatCurrency = (n) => {
  if (n == null || n === '') return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

export const formatRate = (r) => r ? `${parseFloat(r).toFixed(3)}%` : '—';

// ---- Tag helpers ----
export const getTagStyle = (tag) => {
  const preset = PRESET_TAGS.find(t => t.label === tag);
  if (preset) return { color: preset.color, backgroundColor: preset.bg, border: `1px solid ${preset.color}40` };
  return { color: '#4b5563', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' };
};

// ---- Touch stamp helpers ----
export const touchedRecently = (lastTouched) => {
  if (!lastTouched) return false;
  const d = typeof lastTouched === 'string' ? parseISO(lastTouched) : lastTouched;
  return differenceInDays(new Date(), d) <= 2;
};

// ---- Sorting ----
export const sortBorrowers = (borrowers, sortBy, stageOrder) => {
  // Map old stage names to new ones for sorting
  const normalizeStage = (s) => {
    if (s === 'Went With Competitor') return 'W/Competitor';
    return s;
  };
  const stageIdx = (s) => {
    const idx = stageOrder.indexOf(normalizeStage(s));
    return idx === -1 ? 999 : idx; // Unknown stages go to end
  };
  return [...borrowers].sort((a, b) => {
    switch (sortBy) {
      case 'stage':
        // First by stage order
        const stageDiff = stageIdx(a.stage) - stageIdx(b.stage);
        if (stageDiff !== 0) return stageDiff;
        // Within same stage: favorites first
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        // Then stips needed
        const aStips = a.stips_needed || 0;
        const bStips = b.stips_needed || 0;
        if (aStips > 0 && bStips === 0) return -1;
        if (aStips === 0 && bStips > 0) return 1;
        return 0;
      case 'new':
        // NEW borrowers first (is_new = true)
        if (a.is_new && !b.is_new) return -1;
        if (!a.is_new && b.is_new) return 1;
        return stageIdx(a.stage) - stageIdx(b.stage);
      case 'updated':
        // UPDATED borrowers first (is_updated = true, but NOT is_new)
        const aUpdated = a.is_updated && !a.is_new;
        const bUpdated = b.is_updated && !b.is_new;
        if (aUpdated && !bUpdated) return -1;
        if (!aUpdated && bUpdated) return 1;
        return stageIdx(a.stage) - stageIdx(b.stage);
      case 'stips': {
        // STIPS needed first - by stips_needed count (NEED tags)
        const aS = a.stips_needed || 0;
        const bS = b.stips_needed || 0;
        if (aS > 0 && bS === 0) return -1;
        if (aS === 0 && bS > 0) return 1;
        if (aS !== bS) return bS - aS; // Higher count first
        return stageIdx(a.stage) - stageIdx(b.stage);
      }
      case 'duplicates':
        // Duplicates first (is_duplicate = true)
        if (a.is_duplicate && !b.is_duplicate) return -1;
        if (!a.is_duplicate && b.is_duplicate) return 1;
        return stageIdx(a.stage) - stageIdx(b.stage);
      case 'favorites':
        // Favorites first (is_favorite = true)
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return stageIdx(a.stage) - stageIdx(b.stage);
      case 'coe_date':
        if (!a.coe_date && !b.coe_date) return 0;
        if (!a.coe_date) return 1;
        if (!b.coe_date) return -1;
        return new Date(a.coe_date) - new Date(b.coe_date);
      case 'floating':
        if (a.rate_status === 'Floating' && b.rate_status !== 'Floating') return -1;
        if (a.rate_status !== 'Floating' && b.rate_status === 'Floating') return 1;
        return 0;
      case 'last_touched':
        if (!a.last_touched) return 1;
        if (!b.last_touched) return -1;
        return new Date(b.last_touched) - new Date(a.last_touched);
      case 'last_name':
        return getLastName(a.name).localeCompare(getLastName(b.name));
      case 'first_name':
        return getFirstName(a.name).localeCompare(getFirstName(b.name));
      default:
        return stageIdx(a.stage) - stageIdx(b.stage);
    }
  });
};

// Parse name to get last name (handles "Last, First" or "First Last")
export const getLastName = (name) => {
  if (!name) return '';
  if (name.includes(',')) return name.split(',')[0].trim();
  const parts = name.trim().split(' ');
  return parts[parts.length - 1];
};

export const getFirstName = (name) => {
  if (!name) return '';
  if (name.includes(',')) return name.split(',')[1]?.trim() || '';
  const parts = name.trim().split(' ');
  return parts[0];
};

// Format name as "LASTNAME, First" with co-borrower(s)
export const formatBorrowerName = (name, coBorrower, coBorrowers) => {
  if (!name) return '';
  let lastName, firstName;
  if (name.includes(',')) {
    [lastName, firstName] = name.split(',').map(s => s.trim());
  } else {
    const parts = name.trim().split(' ');
    firstName = parts.slice(0, -1).join(' ');
    lastName = parts[parts.length - 1];
  }
  let display = `${lastName}, ${firstName}`;
  const allCoBorrowers = coBorrowers?.length ? coBorrowers : (coBorrower ? [coBorrower] : []);
  if (allCoBorrowers.length === 1) display += ` & ${allCoBorrowers[0]}`;
  else if (allCoBorrowers.length > 1) display += ` + ${allCoBorrowers.length} co-borrowers`;
  return display;
};

// ---- Annual savings from rate retread ----
export const calcAnnualSavings = (loanAmount, lockedRate, currentRate) => {
  if (!loanAmount || !lockedRate || !currentRate) return 0;
  const oldPI = calcPI(loanAmount, lockedRate);
  const newPI = calcPI(loanAmount, currentRate);
  if (!oldPI || !newPI) return 0;
  return (oldPI - newPI) * 12;
};

// ---- Debounce ----
export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
