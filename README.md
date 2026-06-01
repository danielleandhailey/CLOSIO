# CLOSIO™ V6 — Mortgage Pipeline Intelligence Platform
### "Close More. Pipeline Manager."

A production-grade React + Supabase mortgage pipeline management platform with real-time multi-user sync, AI document reading, rate monitoring, and Bonzo CRM integration.

---

## 🚀 Deployment Guide

### Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `closio` — note your **Project URL** and **anon public key**
3. Go to **SQL Editor** → paste the full contents of `supabase-schema.sql` → Run
4. Go to **Storage** → Create two buckets:
   - `documents` (private) — for borrower files
   - `matrices` (private) — for lender guideline PDFs
5. Go to **Database** → **Replication** → enable realtime for:
   - `borrowers`, `borrower_tags`, `tasks`, `team_chat`, `contingencies`, `contacts`, `stipulations`, `stage_history`
6. Go to **Authentication** → **Providers** → ensure Email is enabled

### Step 2: API Keys

Gather these keys:
| Key | Where to get |
|-----|-------------|
| `REACT_APP_SUPABASE_URL` | Supabase > Project Settings > API |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase > Project Settings > API |
| `REACT_APP_CLAUDE_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `REACT_APP_FRED_API_KEY` | [fred.stlouisfed.org/docs/api](https://fred.stlouisfed.org/docs/api/api_key.html) (free) |
| `REACT_APP_BONZO_API_KEY` | Bonzo CRM > Settings > API |
| `REACT_APP_BONZO_WEBHOOK_URL` | Bonzo CRM > Webhooks |
| `REACT_APP_GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) (optional) |
| `REACT_APP_RESEND_API_KEY` | [resend.com](https://resend.com) (optional, for email) |

### Step 3: Deploy to Vercel

#### Option A: GitHub + Vercel (recommended)

```bash
# Initialize git repo
cd closio
git init
git add .
git commit -m "CLOSIO V6 initial deploy"

# Push to GitHub
gh repo create closio --public
git push -u origin main
```

Then:
1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select your `closio` repo
3. Add all environment variables from Step 2
4. Deploy → get your live URL

#### Option B: Vercel CLI

```bash
npm install -g vercel
cd closio
vercel --prod
# Follow prompts, add env vars when asked
```

### Step 4: First Login

1. Open your Vercel URL
2. Click "Sign up" → create your LO account (choose role: LO)
3. Create a second account for LOA role
4. Initial borrower data seeds automatically on first load

---

## 🏗 Architecture

```
closio/
├── src/
│   ├── lib/
│   │   ├── supabase.js      # Supabase client
│   │   ├── constants.js     # Stages, colors, tags, seed data
│   │   ├── utils.js         # Loan calculations, date helpers
│   │   ├── claude.js        # Claude AI service (chat + doc reading)
│   │   ├── fred.js          # FRED API rate monitoring
│   │   └── bonzo.js         # Bonzo CRM integration (pull + push)
│   ├── hooks/
│   │   ├── useAuth.js       # Supabase Auth context
│   │   ├── useBorrowers.js  # Real-time borrower CRUD + subscriptions
│   │   └── useTeamChat.js   # Real-time team messaging
│   ├── components/
│   │   ├── BorrowerRow.jsx  # Condensed one-line card
│   │   ├── ExpandedCard.jsx # Full detail panel (all tabs)
│   │   ├── AddBorrowerModal.jsx
│   │   ├── AIChatBubble.jsx # Claude AI assistant
│   │   └── TeamChatBubble.jsx # Real-time team chat
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── PipelinePage.jsx
│   │   ├── CalendarPage.jsx
│   │   ├── RateTreadPage.jsx
│   │   └── MatrixPage.jsx
│   └── styles/
│       └── global.css
├── supabase-schema.sql      # Complete DB schema — run this first
├── vercel.json
└── package.json
```

---

## ✨ Feature Summary

### Pipeline Stages (color-coded)
Working → Shopping → Lip's → Funded → LP Ready → Paycom → Future Deal → Credit Upgrade → CXLD

### Condensed Card Row
Checkbox → Stage Badge → Borrower Name → Tags → Touch Stamp → Touch Button → Quick Summary (→) → Edit → Expand → Delete

### Quick Summary Panel (→ button)
Shows: Purchase Price, Loan Amount, Loan Type, Occupancy, Rate, P&I/mo, LTV, DTI, Income Type, Seller CC, COE Date, Lender, Lock Status, Stage + Move Stage button

### Expanded Card Tabs
- **Notes & Tasks** — auto-save notes, tasks (overdue/today/upcoming), appointments
- **Documents** — drag/drop PDF upload → AI extracts data → auto-fills fields
- **Loan Terms** (Lip's, Funded, LP Ready, Paycom) — full grid with P&I auto-calc
- **Contacts** — accordion for Buyer's Agent, Title, Lender, Processor
- **Stipulations** — needs list with Got-it tracking
- **Contingencies** — with red due dates
- **Appraisal** — value or waiver + AUS reason
- **History** — stage change log

### Tags System
Preset: FHA, VA, Conventional, DPA, Jumbo, Reverse, LOCKED, FLOATING, PR, Investment, Non-Borr Spouse, First-Time
+ Free-type custom tags (add one line to `PRESET_TAGS` in `constants.js`)

### Bonzo CRM Integration
- **Pull**: Syncs inbound leads from Bonzo → lands in Working stage
- **Push**: Stage changes, touch stamps, rate retread triggers → Bonzo webhook
- **Auto-pull**: Configure interval in settings (15/30/60 min)
- Pull log with timestamp + record count

### Rate Retread Monitor
- Pulls live 30-year fixed rate from FRED API
- Compares against each funded borrower's locked rate
- Ranks by annual savings
- Triggers Bonzo SMS + email outreach at 0.25%+ drop

### AI Features
- **Document Drop Zone**: Claude reads pay stubs, bank statements, tax returns, AUS findings, appraisals, PAs — extracts data + fills fields
- **AI Chat Bubble**: Ask about pipeline, floating borrowers, COE dates, stips needed, etc.
- **Matrix Q&A**: Index lender guideline PDFs — plain-English Q&A

### Real-Time Sync
Supabase WebSocket subscriptions on all tables — changes from any user appear instantly everywhere, no refresh required.

---

## 🔧 Adding New Tags

Open `src/lib/constants.js` → find `PRESET_TAGS` → add one line:
```js
{ label: 'Purchase', color: '#4f46e5', bg: '#e0e7ff' },
```

---

## 📱 Mobile Support

Fully responsive — works on iOS Safari and Android Chrome. Tags row hides on narrow screens; all core functions accessible.

---

## 🔐 Role-Based Access

| Role  | Description |
|-------|-------------|
| LO    | Loan Officer — full access |
| LOA   | Loan Officer Assistant — full access |
| Admin | Admin — full access + user management |

Set at signup. Managed via Supabase Auth + `profiles` table.

---

## Initial Borrowers (auto-seeded)

**Working (13):** John Smith, Norvell, Solether, Krogh, Santa Cruz, Kyle Orr, Timothy Benson, Piwoni, Thigpen, Destiny Smith (DPA), Dabel (Reverse), Elyor Nishonov, Sue Gemina

**Shopping (2):** Chad Peate (Conv $339k), Derek Simpson (Conv $1.53m)

**Lip's (3):** Rhodes (PRMG, Floating, COE 6/25), Watts (Rocket, Floating, COE 7/17 + rescore contingency), Chris Saxon (Conv $250k, COE 6/18, 3 contingencies, Marina Anderson @ eXp Realty, Titan Title)

**Funded (1):** Wicks (add locked rate when known)
