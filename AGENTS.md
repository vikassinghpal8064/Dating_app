# AGENTS.md — Permanent Rules

Read this file at the start of **every** task. These rules are not negotiable.

## 0. Ownership of the codebase
- You are taking over a **mid-build** project. Do **NOT** start fresh. Do **NOT** rewrite working code.
- Fix problems at their **root cause**. No band-aids, no silencing, no "works on my machine".
- Work on **ONE step at a time**. When a step is done, **STOP** and wait for the next prompt.

## 1. Security — non-negotiable
- **Row Level Security on every table, default deny.** Every new table ships with RLS enabled and no permissive-by-default policy.
- **Never expose the `service_role` key in frontend code or the repo.** Only the **anon** key ever goes in the browser. The owner supplies keys; agents must not create, read, or request a `service_role` key.
- **Phone numbers and exact location are PRIVATE.**
  - Phone numbers live **only** in a separate `private_contacts` table, released **only** by a consent-checking function (matched or approved, and only if the owner allowed it).
  - A phone number must **never** appear as a column on `profiles` or any table readable by other users.
- **Coordinates are rounded to 2 decimals** before storage, and **distance is shown as buckets** (never exact metres/km precision).
- **Validate all input on the client (Zod) *and* in the database** (`CHECK` constraints and RLS).
- **Never render user text as raw HTML.** No `dangerouslySetInnerHTML` on user-controlled content.
- **Secrets live in `.env` (git-ignored).** Keep `.env.example` with placeholders only. No real secret values in any committed file.
- XSS, IDOR, and open-redirect guards are mandatory, not optional.

## 2. Quality gates — run all five after every task
```bash
npm run lint        # 0 errors, 0 warnings
npm run typecheck   # 0 errors
npm run test        # 0 failures
npm run test:e2e    # 0 failures
npm run build       # succeeds
```
- **Fix every failure at its root cause.**
- **Never skip, disable, or weaken a test or a lint rule to make it pass.** No `eslint-disable`, no `.skip`, no loosened thresholds, no `only`.
- Adding a stricter rule is preferred over removing one.

## 3. Reporting — evidence, not narrative
- **Never claim something works unless you ran it and saw it work.**
- Reports must include the **raw command output**, not summaries or paraphrases.
- If a check was not run, say so explicitly. Do not imply coverage you did not produce.

## 4. Product rules
- **18+ only.** Age is enforced on the client *and* in the database. No exceptions.
- Free-tier services only (Supabase free tier, Vercel free tier).
- Visual standard: **premium red-and-black**, consistent spacing, no placeholder/"DRAFT"/lorem-ipsum copy shipped as if it were a finished feature.
- Accessibility: keyboard navigable, labelled controls, visible focus, AA contrast.

## WORKING RULES (speed and quality)
1. SCOPE: Do only what the current prompt says. No refactors, no new dependencies, no
renaming, no extra pages, no 'nice to have' features. If you notice something unrelated, add
one line to NOTES.md and move on.
2. NO WANDERING: Do not re-read the whole repo. Read only the files named in the prompt plus
files you must import from. Use grep to find things. Never list or open node_modules, dist, or
lockfiles.
3. BATCH WORK: Create or edit several files per step instead of one at a time. Write complete
files rather than many tiny edits.
4. TARGETED CHECKS (per prompt), in this order:
 a) `npx tsc --noEmit` (must be clean).
 b) `npx eslint <only the files you created or changed>` (must be clean).
 c) `npx vitest run <only the new unit test files>`.
 d) `npx playwright test <only the new e2e spec> --project=chromium --reporter=line`.
 e) One screenshot of each NEW page at 375px width, and look at it.
 Run the full lint, full test suite and full build ONLY when a prompt says 'FINAL CHECK'.
5. ONE DEV SERVER: start `npm run dev` once in the background and reuse it. Never start a
second one. Use Playwright webServer reuseExistingServer.
6. LOOP GUARD: If the same error or test failure survives 3 fix attempts, STOP. Report: the
exact error, the 3 things you tried, your best guess at the root cause, and which file to look
at. Do not keep retrying. Do not weaken, skip, or delete the test to get past it.
7. TIME GUARD: If you pass roughly 40 tool calls on one prompt without finishing, STOP and
report what is done and what remains.
8. DO NOT ASK QUESTIONS you can answer yourself. Pick the safest, most private option, write
the assumption in one line in NOTES.md, and continue. Ask me only for real blockers (logins,
keys, DNS).
9. DATABASE CHANGES: never edit an old migration. Add a new timestamped file in
supabase/migrations, run `npx supabase db reset` once, and re-run only the security tests.
10. HONEST REPORTS: end every task with (a) files created or changed, (b) the raw output of
the checks you ran, (c) anything not done. Never write 'all passing' unless you saw the
output. Then STOP and wait for my next prompt.
