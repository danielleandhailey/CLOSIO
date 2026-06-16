# Spec: Credit Report tab  (locked 2026-06-16)

Files: `closio/src/components/ExpandedCard.jsx` — `CreditReportSection`, `CreditUpgradeSection`,
`DocumentLibrary`, helpers `midScore`, `buildCreditScores`, `extractCreditPeople`, `sinceDate`.
Data lives in `borrower.credit_report` (JSONB): `{ joint, people: { primary, co_0, ... }, history, upgrade }`.

## Scores — what it MUST do
- **Per person:** one score card per borrower (primary + each co-borrower). Each card shows
  **FICO (EQ/EX/TU)** big, and **Vantage (EQ/EX/TU)** under it when present.
- **One drop box** accepts ONE or BOTH reports at once; each report is routed to the right person by a
  shared name token. A **"Joint report (married — both borrowers on one report)"** toggle = 6 scores on 1 report.
- **MID score stands out:** in each FICO line the borrower's mid score is underlined and the other two are
  muted (`#94a3b8`). A **"MID xxx"** label sits under the scores.
- **Qualifying score = the LOWEST mid across borrowers** (the one Daniel uses to qualify). Color rule
  (LOCKED — do not flip): the qualifying mid is **GREEN** (`#059669`) + "QUALIFYING"; a non-qualifying
  borrower's mid is **RED** (`#b91c1c`). A **green banner** at the top shows the qualifying score + whose it is.

## Negatives / Public Records — MUST
- **Negative Marks** and **Public Records** are red cells; clicking opens the itemized list.
- **Bankruptcy shows ONLY under Public Records** (never under Negative Marks), with discharge date and
  time-since (e.g. "discharged 2022-07-05 (3yr 11mo ago)").
- **Charge-offs float to the top** of Negative items, the words **CHARGE OFF** in caps, with balance and
  status **"PAID THRU COLLECTIONS"** or **"CHARGED OFF"** (no date).
- Late payments show **last late date** and whether **rolling**.

## Credit Upgrade Plan (navy button → popup) — MUST
- **📋 Paste plan from email** → AI parses into checkable steps; pulls target score + lender contact.
- **Upload proof** on a step → AI verifies it matches the step and auto-crosses it off; ✅ Complete banner
  when all done. Proofs viewable via **📚 Library** in the popup.
- **📧 Copy Email / 💬 Copy SMS** to the borrower — wording follows [[feedback-template-writing-style]]
  (no em-dashes, only a happy face, first name only, human voice).
- **📧 Email Lender** appears when complete (copies note + opens the proof Library). If no lender contact
  was found in the paste, prompt to add it (name/email fields under the scores).
- Button shows "added [date]" once a plan is pasted.

## Library + colors — MUST
- **Library** link (plain underlined, bottom-left of the tab) opens all stored PDFs for the borrower.
- The old **Report History box was removed** (the Library covers it) — do NOT add it back.
- Palette: navy/slate (`#1e3a5f` / `#475569`), RED only for negatives, GREEN for the qualifying score.
  The drop box is neutral slate (NOT amber).

## Must NOT
- Don't flip the qualifying color (green = the one Daniel uses).
- Don't put bankruptcy under Negative Marks.
- Don't re-add the Report History box.
- Don't overwrite a primary borrower's name with a co-borrower / report name on drop.
