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
  'Working':       { bg: '#a855f7', text: '#fff', light: '#f3e8ff' },
  'Shopping':      { bg: '#22c55e', text: '#fff', light: '#dcfce7' },
  "Lip's":         { bg: '#f59e0b', text: '#fff', light: '#fef3c7' },
  'Funded':        { bg: '#10b981', text: '#fff', light: '#d1fae5' },
  'LP Ready':      { bg: '#3b82f6', text: '#fff', light: '#dbeafe' },
  'Paycom':        { bg: '#f97316', text: '#fff', light: '#ffedd5' },
  'Future Deal':   { bg: '#14b8a6', text: '#fff', light: '#ccfbf1' },
  'Credit Upgrade':{ bg: '#ec4899', text: '#fff', light: '#fce7f3' },
  'CXLD':          { bg: '#ef4444', text: '#fff', light: '#fee2e2' },
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

  // ========== WORKING ==========
  {
    name: 'Hoadley',
    stage: 'Working',
    loan_purpose: 'Purchase',
    notes: 'Working - no additional notes yet',
  },
  {
    name: 'Sigworth, Tim',
    stage: 'Working',
    loan_type: 'Conventional',
    loan_purpose: 'Purchase',
    occupancy: 'Investment',
    notes: 'Starting back up. INVESTOR. Need to redo figures or get tax returns. Hailey sent tax return email request 6/1.',
  },
  {
    name: 'Solether',
    stage: 'Working',
    loan_purpose: 'Purchase',
    notes: 'Need Smart Pay (link sent 5/18). No huge rush - she is fixing house to sell. Text follow up 5/28.',
  },
  {
    name: 'Kyle Orr',
    stage: 'Working',
    loan_purpose: 'Purchase',
    notes: 'Need 12 months bank statements (only have Mar and April). Text follow up 6/1.',
  },
  {
    name: 'Timothy Benson',
    stage: 'Working',
    lender: 'Rocket',
    loan_purpose: 'Purchase',
    notes: 'Rocket PR. SELLING HIS HOUSE. Flyhomes sent 5/28. NEED last 2 yrs 1099 TAXES 6/1. Getting returns for internet business. Paid off CCs and raised income to qualify.',
  },
  {
    name: 'Destiny Smith',
    stage: 'Working',
    loan_type: 'DPA',
    loan_purpose: 'Purchase',
    notes: 'DPA - need all stips and Smart Pay. Banks through CHIME. Text follow up 6/1.',
  },
  {
    name: 'Paul Brass',
    stage: 'Working',
    loan_purpose: 'Purchase',
    notes: 'Need to send quick apply link. Text follow up 6/1.',
  },
  {
    name: 'Gwendolyn Hicks',
    stage: 'Working',
    loan_purpose: 'Purchase',
    lender: 'Click & Close',
    notes: 'Click & Close OTC. She is working on it 6/1.',
  },
  {
    name: 'Dabel',
    stage: 'Working',
    loan_type: 'Reverse',
    loan_purpose: 'Purchase',
    notes: 'Need app. Reverse - resent app link 6/1. HAILEY TODAY - TAKE APP OVER PHONE.',
  },
  {
    name: 'Norvell',
    stage: 'Working',
    loan_type: 'VA',
    loan_purpose: 'Purchase',
    notes: 'TEXT pre-approved. Sent for VAL 300k and Credit Upgrade 711/740 6/1. Lease is up Aug/Sept. NEED: last pay stub 2025 with Perdue & May 2026 statement for Morgan Stanley & UNFREEZE Equifax & TU 6/1.',
    purchase_price: 300000,
  },

  // ========== FUTURE DEAL ==========
  {
    name: 'Thigpen',
    stage: 'Future Deal',
    loan_purpose: 'Purchase',
    notes: 'DTI high - need student loan income based payment plan set up 5/20. He is working on it.',
  },
  {
    name: 'Elyor Nishonov',
    stage: 'Future Deal',
    lender: 'Rocket',
    loan_purpose: 'Purchase',
    notes: 'NOT ROCKET preapprove. Waiting for last 2 years tax returns. TEXT FOLLOW UP 5/28. Need correct S/E address and phone numbers in Rocket. PROBABLY NEED DPA (NOT $ FOR DOWN). APPLIED ROCKET RETAIL.',
  },
  {
    name: 'Sue Gemina',
    stage: 'Future Deal',
    loan_purpose: 'Purchase',
    notes: "November - Anthony's referral. Need to add to Bonzo. Need SSI and asset docs. 5/26. Ran in Rocket - need to see what's gross up-able, then run in PRMG for DPA.",
  },
  {
    name: 'Krogh',
    stage: 'Future Deal',
    loan_purpose: 'Purchase',
    notes: 'November.',
  },
  {
    name: 'Santa Cruz',
    stage: 'Future Deal',
    loan_purpose: 'Purchase',
    notes: 'Need stips - check Bonzo notes. Text follow up 5/28.',
  },

  // ========== SHOPPING ==========
  {
    name: 'Chad Peate',
    stage: 'Shopping',
    loan_type: 'Conventional',
    loan_purpose: 'Purchase',
    lender: 'Rocket',
    purchase_price: 339000,
    loan_amount: 139000,
    notes: 'Rocket PR (no VAL). Conv 339k with 200k down. Selling house - gave Flyhomes offer. 5/14, 5/17.',
  },
  {
    name: 'Derek Simpson',
    stage: 'Shopping',
    loan_type: 'Conventional',
    loan_purpose: 'Purchase',
    lender: 'Rocket',
    purchase_price: 1530000,
    rate: 7.1,
    notes: 'Rocket PR Conv 1.53m at 7.1% = $9,276.07 P&I. Can put more down if purchase price goes up. 5/4, 5/19.',
  },
  {
    name: 'Piwoni',
    stage: 'Shopping',
    loan_purpose: 'Purchase',
    lender: 'PRMG',
    notes: 'PRMG preapproved!! 5/26. LOOK AT 5/1 ARM FOR HER!!',
  },

  // ========== LIP'S ==========
  {
    name: 'Rhodes',
    stage: "Lip's",
    loan_purpose: 'Purchase',
    lender: 'PRMG',
    rate_status: 'Floating',
    coe_date: '2026-06-25',
    notes: '5/18. PRMG - M Plese. NEED TO DBL SUB TO PENNYMAC.',
  },
  {
    name: 'Watts',
    stage: "Lip's",
    loan_purpose: 'Purchase',
    loan_type: 'Conventional',
    lender: 'Rocket',
    rate_status: 'Floating',
    coe_date: '2026-07-17',
    purchase_price: 269900,
    loan_amount: 240000,
    property_address: '10195 Goosecreek Rd, Roseville, OH 43777',
    borrower_phone: '614-554-2587',
    loan_number: 'R354529',
    occupancy: 'Primary Residence',
    notes: 'Tobi Jeanne Watts. Conv 15yr Fixed. COE 7/17. Rocket FLOATING. Loan # R354529. Rescore submitted 5/19. Selling house at 431 W Johnstown Rd, Gahanna OH 43230 (Flyhomes offer given). Sellers: James & Teresa Hambrick. Earnest money $250. Contract date 5/11/2026.',
  },
  {
    name: 'Chris Saxon',
    stage: "Lip's",
    loan_type: 'Conventional',
    loan_purpose: 'Purchase',
    lender: 'PRMG',
    coe_date: '2026-06-18',
    notes: '5/26 offer accepted.',
    purchase_price: 250000,
  },

  // ========== FUNDED ==========
  {
    name: 'Wicks',
    stage: 'Funded',
    loan_purpose: 'Purchase',
    locked_rate: null,
    notes: 'Funded. Add locked rate when known.',
  },

  // ========== CXLD ==========
  {
    name: 'John Smith',
    stage: 'CXLD',
    loan_purpose: 'Purchase',
    notes: 'Missing income stips. Pre-approve 5/26, 5/28. DNQ.',
  },
];

export const INITIAL_TAGS = {
  'Sigworth, Tim':  ['Investment'],
  'Destiny Smith':  ['DPA', 'First-Time'],
  'Dabel':          ['Reverse'],
  'Norvell':        ['VA'],
  'Chad Peate':     ['Conventional'],
  'Derek Simpson':  ['Conventional', 'Jumbo'],
  'Piwoni':         ['Conventional'],
  'Rhodes':         ['FLOATING'],
  'Watts':          ['FLOATING'],
  'Chris Saxon':    ['Conventional'],
  'Elyor Nishonov': ['DPA'],
  'Sue Gemina':     ['DPA'],
  'Timothy Benson': ['FLOATING'],
};

export const INITIAL_CONTACTS = {
  'Watts': [
    { role: 'buyers_agent', name: 'Felicia Hence', company: 'Coldwell Banker King Thompson', phone: '614-732-3699', email: 'felicia.hence@kingthompson.com' },
    { role: 'listing_agent', name: 'Scott Bare', company: 'Mossy Oak Properties', phone: '740-404-8915', email: 'sbare@mossyakproperties.com' },
  ],
  'Chris Saxon': [
    { role: 'buyers_agent', name: 'Marina Anderson', company: 'eXp Realty', phone: '', email: '' },
    { role: 'title_escrow', name: 'Titan Title Company', company: 'Titan Title', phone: '', email: '' },
  ],
};

export const INITIAL_CONTINGENCIES = {
  'Watts': [
    { name: 'Rescore Required', due_date: '2026-07-01' },
    { name: 'Loan Contingency - 30 days', due_date: '2026-07-17' },
    { name: 'Appraisal Contingency', due_date: '2026-07-17' },
    { name: 'Inspection Period - 10 days', due_date: '2026-05-21' },
  ],
  'Chris Saxon': [
    { name: 'Inspection Contingency', due_date: '2026-06-10' },
    { name: 'Appraisal Contingency', due_date: '2026-06-14' },
    { name: 'Loan Contingency', due_date: '2026-06-16' },
  ],
};

export const INITIAL_TASKS = {
  'Hoadley': [],
  'Sigworth, Tim': [
    { title: 'Redo figures or get tax returns', type: 'task', due_date: null },
  ],
  'Solether': [
    { title: 'Smart Pay link follow up', type: 'task', due_date: null },
  ],
  'Kyle Orr': [
    { title: 'Need 12 months bank statements (only have Mar & Apr)', type: 'task', due_date: '2026-06-01' },
  ],
  'Timothy Benson': [
    { title: 'Need last 2 yrs 1099 TAXES', type: 'task', due_date: '2026-06-01' },
    { title: 'Flyhomes follow up', type: 'task', due_date: null },
  ],
  'Destiny Smith': [
    { title: 'Need all stips and Smart Pay', type: 'task', due_date: '2026-06-01' },
  ],
  'Paul Brass': [
    { title: 'Send quick apply link', type: 'task', due_date: '2026-06-01' },
  ],
  'Dabel': [
    { title: 'HAILEY - Take app over phone TODAY', type: 'task', due_date: '2026-06-01' },
  ],
  'Norvell': [
    { title: 'Need last pay stub 2025 with Perdue', type: 'task', due_date: '2026-06-01' },
    { title: 'Need May 2026 statement for Morgan Stanley', type: 'task', due_date: '2026-06-01' },
    { title: 'UNFREEZE Equifax & TU', type: 'task', due_date: '2026-06-01' },
  ],
  'Rhodes': [
    { title: 'Double submit to PennyMac', type: 'task', due_date: null },
  ],
  'Elyor Nishonov': [
    { title: 'TEXT follow up - waiting on 2 yrs tax returns', type: 'task', due_date: '2026-06-01' },
    { title: 'Fix S/E address and phone numbers in Rocket', type: 'task', due_date: null },
  ],
  'Santa Cruz': [
    { title: 'Check Bonzo notes for stips', type: 'task', due_date: '2026-06-01' },
  ],
};
