# Spec: Borrower-Row Notes  (TRUST-CRITICAL — do not change without Daniel's okay)

Status: restored to known-good + 3-line wrap on 2026-06-16. Pending Daniel's final confirmation.
This took ~3.5 days to get right. Treat every change here as high-risk: tiny diff, confirm first.

Files: `closio/src/components/BorrowerRow.jsx` (QuickNoteInput + the notes display block),
`closio/src/hooks/useBorrowers.js` (`addNote`).

## What it MUST do
- Each note is stored as `[M/D/YY] text`. The **date stamp is always in front** and shown in **gold** (#f59e0b).
- **Newest note on top** (prepended).
- **Layout (LOCKED, took many tries):** each note is its OWN COLUMN. Newest note at the **far left**,
  older notes flow to the **right**, the whole strip clips before CONVO (`overflow:hidden; white-space:nowrap`
  on the container; each note `display:inline-block; white-space:normal`). A **new note is added at the
  left** and pushes older notes rightward, out of view.
- **Wrapping:** a long note wraps **WITHIN its own column** (max-width ~360px) up to **3 lines**
  (`maxHeight: 4.05em; overflow:hidden`). Notes NEVER stack as separate full-width rows under each other.
  A short note just takes its content width.
- A note can be **flagged priority** via the 🚩 toggle on `+Note`: it shows **bold red** on the row.
  The 🚩 marker is stored at the start of the note text but **stripped from the display**.
- Adding a note: `QuickNoteInput.save` passes **only the raw note body** to `addNote`. `addNote` does the
  date-stamp and the prepend (reading fresh notes from the DB).

## What it must NOT do
- **Never double-stamp / double-prepend.** The row must not build `[date] ...` or prepend the existing
  notes blob itself — doing both there AND in `addNote` duplicates the notes data (the 2026-06-15 bug).
- Never overwrite/clobber existing notes when adding a new one.
- Never show the raw 🚩 marker in the displayed note text.
- Never change the date color or strip the date.
- Don't let a note add/delete remove other notes as a side effect.

## Delete
- The grey **x** in front of each note deletes that one note. It re-reads the freshest notes from the DB
  first, removes only that exact line, and saves — so it can never clobber the other notes.

## Open follow-ups (not yet done)
- One-time cleanup of already-duplicated note data (e.g. Benson) — safe, tested-on-one-record SQL.
- A note added via the file's **Quick Log** should also appear on the main notes screen.
- Delete also available inside the file's notes screen (row delete is done).
