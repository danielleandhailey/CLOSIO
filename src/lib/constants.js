// ============================================================
// CLOSIO™ Constants
// ============================================================

export const STAGES = [
  'Working',
  'Shopping',
  "Lip's",
  'Funded',
  'LP Ready',
  'Paycom',
  'Future Deal',
  'Credit Upgrade',
  'CXLD',
];

export const STAGE_COLORS = {
  'Working':       { bg: '#7c3aed', text: '#fff', light: '#ede9fe' },
  'Shopping':      { bg: '#16a34a', text: '#fff', light: '#dcfce7' },
  "Lip's":         { bg: '#d97706', text: '#fff', light: '#fef3c7' },
  'Funded':        { bg: '#065f46', text: '#fff', light: '#d1fae5' },
  'LP Ready':      { bg: '#1d4ed8', text: '#fff', light: '#dbeafe' },
  'Paycom':        { bg: '#b45309', text: '#fff', light: '#fef3c7' },
  'Future Deal':   { bg: '#0f766e', text: '#fff', light: '#ccfbf1' },
  'Credit Upgrade':{ bg: '#be185d', text: '#fff', light: '#fce7f3' },
  'CXLD':          { bg: '#ea580c', text: '#fff', light: '#ffedd5' },
};

// Preset tags — add new ones here with one line
export const PRESET_TAGS = [
  { label: 'FHA',            color: '#3b82f6', bg: '#dbeafe' },
  { label: 'VA',             color: '#7c3aed', bg: '#ede9fe' },
  { label: 'Conventional',  color: '#16a34a', bg: '#dcfce7' },
  { label: 'DPA',            color: '#d97706', bg: '#fef3c7' },
  { label: 'Jumbo',          color: '#0f766e', bg: '#ccfbf1' },
  { label: 'Reverse',        color: '#be185d', bg: '#fce7f3' },
  { label: 'LOCKED',         color: '#065f46', bg: '#d1fae5' },
  { label: 'FLOATING',       color: '#ea580c', bg: '#ffedd5' },
  { label: 'PR',             color: '#1d4ed8', bg: '#dbeafe' },
  { label: 'Investment',     color: '#b45309', bg: '#fef3c7' },
  { label: 'Non-Borr Spouse',color: '#9333ea', bg: '#f3e8ff' },
  { label: 'First-Time',     color: '#0891b2', bg: '#e0f2fe' },
  // Future additions — uncomment to enable:
  // { label: 'Purchase',       color: '#4f46e5', bg: '#e0e7ff' },
  // { label: 'Refi',           color: '#0369a1', bg: '#e0f2fe' },
  // { label: 'Cash-Out Refi',  color: '#b91c1c', bg: '#fee2e2' },
  // { label: 'HELOC',          color: '#6b21a8', bg: '#f3e8ff' },
  // { label: 'Rate & Term Refi',color: '#065f46', bg: '#d1fae5' },
];

export const SORT_OPTIONS = [
  { value: 'stage',         label: 'Stage Order' },
  { value: 'coe_date',      label: 'COE Date (Soonest)' },
  { value: 'floating',      label: 'Floating First' },
  { value: 'contingencies', label: 'Contingencies Due' },
  { value: 'tasks',         label: 'Tasks by Date' },
  { value: 'last_touched',  label: 'Last Touched' },
  { value: 'name',          label: 'Name A–Z' },
];

export const CONTACT_ROLES = [
  { value: 'buyers_agent',  label: "Buyer's Agent" },
  { value: 'title_escrow',  label: 'Title & Escrow' },
  { value: 'lender',        label: 'Lender' },
  { value: 'processor',     label: 'Processor' },
];

export const STAGES_WITH_FULL_DETAILS = ["Lip's", 'Funded', 'LP Ready', 'Paycom'];

export const BONZO_AUTO_PULL_INTERVALS = [
  { value: 900000,  label: 'Every 15 min' },
  { value: 1800000, label: 'Every 30 min' },
  { value: 3600000, label: 'Every 1 hour' },
];

// Initial seed data
export const INITIAL_BORROWERS = [
  // Working (13)
  { name: 'John Smith',      stage: 'Working', loan_type: 'Conventional' },
  { name: 'Norvell',         stage: 'Working', loan_type: 'Conventional' },
  { name: 'Solether',        stage: 'Working', loan_type: 'Conventional' },
  { name: 'Krogh',           stage: 'Working', loan_type: 'Conventional' },
  { name: 'Santa Cruz',      stage: 'Working', loan_type: 'Conventional' },
  { name: 'Kyle Orr',        stage: 'Working', loan_type: 'Conventional' },
  { name: 'Timothy Benson',  stage: 'Working', loan_type: 'Conventional' },
  { name: 'Piwoni',          stage: 'Working', loan_type: 'Conventional' },
  { name: 'Thigpen',         stage: 'Working', loan_type: 'Conventional' },
  { name: 'Destiny Smith',   stage: 'Working', loan_type: 'DPA' },
  { name: 'Dabel',           stage: 'Working', loan_type: 'Reverse' },
  { name: 'Elyor Nishonov',  stage: 'Working', loan_type: 'Conventional' },
  { name: 'Sue Gemina',      stage: 'Working', loan_type: 'Conventional' },
  // Shopping (2)
  { name: 'Chad Peate',      stage: 'Shopping', loan_type: 'Conventional', purchase_price: 339000 },
  { name: 'Derek Simpson',   stage: 'Shopping', loan_type: 'Conventional', purchase_price: 1530000 },
  // Lip's (3)
  { name: 'Rhodes',          stage: "Lip's", lender: 'PRMG',   rate_status: 'Floating', coe_date: '2025-06-25' },
  { name: 'Watts',           stage: "Lip's", lender: 'Rocket', rate_status: 'Floating', coe_date: '2025-07-17' },
  { name: 'Chris Saxon',     stage: "Lip's", loan_type: 'Conventional', purchase_price: 250000, coe_date: '2025-06-18', lender: 'PRMG' },
  // Funded (1)
  { name: 'Wicks',           stage: 'Funded', locked_rate: null },
];

export const INITIAL_TAGS = {
  'Destiny Smith': ['DPA', 'First-Time'],
  'Dabel':         ['Reverse'],
  'Chad Peate':    ['Conventional'],
  'Derek Simpson': ['Conventional', 'Jumbo'],
  'Rhodes':        ['FLOATING'],
  'Watts':         ['FLOATING'],
  'Chris Saxon':   ['Conventional'],
};
