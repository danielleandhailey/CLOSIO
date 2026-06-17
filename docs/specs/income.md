# Spec: Income tab  (rules locked 2026-06-16 — calc still being built to them)

File: `closio/src/components/ExpandedCard.jsx` — `IncomeSection`, helpers `consolidateIncomes`,
`calcIncomeDetail`, `calcMonthlyIncome`, `incKey`. Data: `borrower.incomes` (JSONB array).

## Layout / workflow (what it MUST do)
- **Separate income per borrower** (each person their own group) + a **grand total** off to the side.
- Each income source card shows **Employer · Type · Frequency · qualifying/mo**; click it to expand and
  see the calc (both methods + which an underwriter uses) and the **paystubs/W-2s it used**.
- **One card per job** — multiple paystubs/W-2s of the same person+employer+type CONSOLIDATE into one
  source (never stack/duplicate). Newest doc drives the numbers; every doc kept under `sources`.
- **Multiple income streams per borrower** are supported (different employers/types = separate sources).
- **Drop all docs for ONE borrower at a time** (all their paystubs + W-2s), then **GO** to process the
  batch together so a paystub can be cross-checked against W-2 history.
- When processing, offer **Add to current income** OR **Replace** the existing calculated income.

## Income calculation rules — W-2 with paystubs & W-2s
- **Current income** = YTD gross ÷ # of pay periods worked (not just current-period × periods).
- **Historical check**: compare current pace to the prior **2 years of W-2s**.
- **Stability test**: if the current pace matches W-2 history → use the current rate.
- **Declining income**: if YTD pace is LOWER than the W-2 average → use the **lower** number.
- **Increasing income**: may need verification it's permanent (promotion letter / new rate locked in).
- **Overtime / Bonus / Commission**: must have a **2-year history** to count — **average it**, don't use
  the current pace alone.
- **Variable income** (hours/pay fluctuate): average **2 years**, not just YTD.
- **Gaps in employment**: explain; may need an LOE (Letter of Explanation).
- **Job changes**: same field = OK; different field = may need 2 years in the new role.

## Red flags / questions to surface
- YTD doesn't support the W-2 history.
- Base pay changed without documentation.
- Employer name mismatch between paystub and W-2.
- Part-time hours on the current stub vs full-time on the W-2s **and** not on the job 2 years →
  need the prior job's last paystub.
- Prompt the user when ambiguous, e.g.: **"Currently employed at this job?"**, **"2 years or more?"**,
  **"Is there a second employer?"**

## Build phases (track progress here)
1. ✅ Consolidate by job, per-borrower groups, conservative (YTD-avg vs current) calc + expand.
2. ✅ Batch drop per borrower + GO, with Add-to vs Replace (IncomeDropZone). Tags each doc's source name.
   Pay frequency is editable per card (AI reads it from the stub; dropdown overrides).
3. ✅ W-2s captured as prior-year history (doc_type tag + tax_year + annual_wages). Consolidator keeps W-2s
   OUT of current income (they only feed the 2-yr W-2 average); paystubs drive current numbers.
4. ⬜ NEXT: Smart questions / red-flag prompts (employed 2 yrs? second employer? part-time vs full-time?
   declining vs W-2, base-pay change, employer-name mismatch). Precise YTD-months from pay-period count.
