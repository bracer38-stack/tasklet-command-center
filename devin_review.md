**Tasklet Financial Command Center: code review (Parts 1–4)**

I reviewed this by reading the code only; I didn't run it. I don't have `parseFinancialAmount`, `cleanMerchantName`, `transferEngine`, `anomalyEngine`, the sync server or the tests. The code that calculates True Available Cash and restricted collateral wasn't included, so I couldn't check whether collateral is excluded correctly. Notably, `Account` has no field for restricted or pledged funds, and the parser throws away any `household_cash_treatment` value other than business or reconciliation-only. Please send that file next.

---

### P0: produces wrong dollar figures

1. **CSVs with separate Debit and Credit columns reject every inflow** (`recordTypeParser`, amount validation). `rawAmountVal = raw_amount ?? amount ?? debit ?? credit…` stops at `debit`, because an empty string `''` isn't null/undefined. On a credit row, `debit` is `''`, so `isNumericString` is false and the row is rejected with "invalid numeric amount", even though `parsedAmount` was already set correctly from `credit`. Every deposit and refund in that file format is lost.
   *Fix:* validate the same field the amount was actually parsed from (see cleanup item C1).

2. **The sign of the `amount` column is assumed to follow Plaid** (positive = money out). Many bank CSV exports use the opposite (negative = money out). Importing one of those flips everything: paychecks become expenses and expenses become income. Add a sign-convention setting per source/institution that the user confirms on first import. One way to detect it: compare the signs of rows whose descriptions look like payroll or card payments.

3. **Credit cards, loans and investment accounts can be imported as checking (cash)** (`account_snapshot`). The type is only taken from `account_type`, the account name, or `credit_limit`.
   - Your own sample CSV's `Amex Business Gold` row (category `credit`, no limit, and neither "card" nor "credit" in the name) becomes a **checking account holding +$4,200** instead of $4,200 of debt.
   - The Plaid JSON path stores the account type in `type`, which the snapshot handler never reads. Any Plaid loan, mortgage or brokerage account without a limit is imported as checking.
   - When no available balance is reported, `availableBalance` falls back to `currentBalance`. That contradicts the type (`number | null`, null when not reported) and inflates available liquidity. For cards it's also the wrong quantity. Leave it `null`.

4. **The variance check can never fail.** The raw debit/credit totals include **every** row, including snapshots, loans, bills and notes (the sample shows $146,300 of "variance"). And whenever any non-transaction row exists, the explanation reports "Verified: N rows routed to separate tables", which hides real gaps such as rejected or duplicate transactions.
   *Fix:* total only the rows identified as transactions. Then require `raw − staged = rejected + duplicates` to the cent and show any remainder as unexplained.

5. **Credit utilization math** (`creditEngine`):
   - `totalBalance` includes balances on charge cards with no preset limit, but `totalLimit` excludes them. A $20k Amex Platinum balance makes blended utilization far higher than it really is.
   - The paydown target is exactly 30%, but the warning triggers at `>= 30`. After paying the recommended amount, the card is still in warning. Target `warningThreshold − 0.1` or use a strict `<`. Thresholds are also compared against the rounded value (29.96 rounds to 30.0, which triggers a warning).

6. **`parseFloat` on formatted numbers.** Loan `monthly_payment` and `rate`, and snapshot `minimum_payment` and `interest_rate`, use `parseFloat("1,420.00")`, which returns **1**. Use `parseFinancialAmount` everywhere.

### P1: data loss and broken audit history

7. **Identical transactions on the same day get merged.** The fallback ID hashes account, date, amount and merchant, so two $5.00 coffees on the same day get the same ID and the second is silently skipped as a duplicate. Add an occurrence index for each identical tuple, which also keeps re-imports idempotent. Also, `deterministicHash` is a 32-bit hash, and `fileMetadata.sha256` is that hash labeled as sha256. Use real SHA-256 (`crypto.subtle` / `node:crypto`), especially since this is your audit trail.

8. **Pending→posted matching guess** (`reconcileFinancialState`):
   - If `p.cleanMerchant` is `''`, then `rawDescription.includes('')` is true, so the pending charge matches any posted charge on the same account within 5 days.
   - `pendingTxs` is never updated after a match, so one pending charge can match several posted ones. The pendingToPosted entries are reported twice, and the user's override gets copied to unrelated transactions.
   - With a 0.8–1.4× amount window, two similar charges at the same merchant can delete the wrong pending hold, which understates outstanding holds.
   - The Plaid JSON parser drops `pending_transaction_id`, so the exact link is never available and the guess is always used.

9. **Reconciliation clears stale flags.** `isStale` is recalculated only from `lastSyncedAt` and `sync_error`. CSV snapshots set `lastSyncedAt = now` and `status: 'disconnected'` for "login required" accounts, so they come out of reconciliation marked *not* stale. Accounts missing from the incoming feed keep their old balance with no stale flag, so stale balances still count in totals. `detectStaleAccounts` uses different rules (an invalid date counts as stale there, but not in reconciliation). Use one shared `isAccountStale()` everywhere.

10. **Imported transactions never reach the rule engine.** The parser always adds an audit entry, and reconciliation only runs classification when `auditTrail.length === 0`. A GitHub charge imported from CSV stays `needs_review` forever. Also, a classification supplied in the source file is recorded as `userOverridden: true`, so it can never be reclassified by rules or reverted (no `priorClassification`).

11. **Problems with undoing a manual reclassification (revert):**
   - `entity` isn't restored.
   - The transaction still counts as manually overridden (`auditTrail.some(userOverridden)`), so its classification stays locked.
   - Reverting twice finds the same override again, so you can never step back more than one change.
   - `canRevert` is never checked.
   - Audit entries are appended in some places (parser, reconciliation) and prepended in others (reclassify, revert), but `find()` assumes newest-first.

12. **Classification rules have no word boundaries.** `/aws/` matches "SHAWS" (a grocery chain), "LAWSON" and "PAWS", and classifies them as business at 0.99 confidence. The same applies to `zoom`, `linear` and `slack`. Add `\b…\b`. The rules also ignore which entity the account belongs to (the `account` parameter is only used in a message). GitHub charged to a personal card shouldn't be auto-tagged business, and Costco charged to the business card should be flagged as owner draw or reimbursement. The travel rule (0.88) auto-tags hotels as business, which contradicts your zero-guessing policy.

13. **Account identity:**
   - Matching accepts substrings in both directions (`name.includes(raw) || raw.includes(name)`), so "Chase" matches whichever Chase account comes first.
   - Snapshot IDs include the mask (`acc_x_4829`) but transaction fallback IDs don't (`acc_x`). Transactions from the same file end up pointing at an account ID that doesn't exist.
   - Matching only looks at `existingAccounts`, not accounts parsed from the same file.
   - With no account column, transactions silently go to `parsedAccounts[0]` (depends on row order) or to "General Account". That contradicts the code's own comment that account identity is required.
   - The Plaid JSON path sets `account_name: 'Imported Account'`, so a first import creates an extra $0 "Imported Account" that doesn't exist at the bank.

14. **Dates:** a missing date silently becomes today. Non-ISO formats (`10/02/2026`, `Oct 2, 2026`) are stored as-is, which breaks the 7d/30d filters, sorting and the 5-day date math (`new Date` parses those in local time). Normalize to `YYYY-MM-DD` and reject rows with unparseable dates.

15. **Bills, loans and notes aren't idempotent.** IDs like `bill_${Date.now()}_${idx}` are new on every run, so each re-import duplicates them. Several snapshots for the same account aren't de-duplicated (keep the latest). `sourceBalanceTimestamp` is the import time instead of the snapshot date, so a 3-week-old statement shows as fresh.

16. **Backups** (`backup_service.js`):
   - Daily files are overwritten on every run, and so are `latest` and the Drive copies. A bad ledger at noon wipes out the morning's good backup. `timeStr` is computed but never used, and nothing deletes old backups.
   - Writes aren't atomic. A crash mid-write corrupts the backup or config file. Write to a temp file, then rename.
   - `JSON.parse` has no error handling, so a corrupt ledger throws inside the sync server.
   - There's no sanity check (e.g. refuse to back up if the transaction count dropped by more than X%), no checksum, and **no restore function**, so the backups are untested.
   - Financial data sits unencrypted in Google Drive.
   - **Spreadsheet formula injection:** `escapeCsvField` doesn't neutralize text fields from bank feeds that start with `= + - @`, which Excel or Sheets will run as formulas. `\r` isn't quoted either.
   - `path.resolve('data')` depends on the directory the script is started from, and `G:\` is hard-coded to Windows. If `googleDrivePath` can be set over HTTP without authentication, the server can be made to create directories and write files anywhere.
   - The accounts CSV writes `availableBalance ?? currentBalance`, which loses the null.

### P2: parser robustness
- **Byte-order mark:** Excel exports often start with an invisible UTF-8 BOM. It sticks to the first header, so `record_type` isn't recognized.
- Also unsupported: summary lines above the header row (common in bank exports), `;` separators, and duplicate column names.
- Row numbers in error messages drift after blank lines or quoted multi-line values.
- Status `unknown` is treated as posted (`pending: false`) in cash calculations. `cleared = "Y"` or `"true"` maps to unknown.
- Audit IDs (`audit_${Date.now()}_override`) collide when several transactions are reclassified at once. Use `crypto.randomUUID()`.
- `reconcileFinancialState` modifies its input objects in place (`incTx.classification = …; incTx.auditTrail.push(…)`), which is unsafe for React state.
- Money is stored as float dollars. Store integer cents, or at least round to 2 decimals at parse time.

### Cleanup
- **C1.** Amount-field priority is implemented three times, in different orders: raw totals check `amount` before `raw_amount`, the transaction parser does the reverse, and `transaction_amount` is missing from the totals. Replace them with one `extractAmount(row) → {value, field} | null`. This also fixes P0 #1.
- **C2.** `normalizedRow.availableBalance` can never match because keys are lowercased (dead branch). The `normalized_amount` ternary is just `-normVal`. The last clause of `hasExplicitTxIdColumn` is redundant. `TransactionClassification` is imported but unused in reconciliation. `timeStr` is unused in the backup service. In `creditEngine`, `|| 0` and `limit > 0 ?` are redundant after the no-limit check.
- **C3.** Split the ~1,000-line `parseRecordTypeContent` into one handler per record type, each returning `{ok:true, record} | {ok:false, reason}`. Add `hasUserOverride(tx)`, `mergeIncoming(existing, inc)` and `makeAudit(...)` helpers in reconciliation and classification (each currently repeated 4–6 times).
- **C4.** Duplicated fields in the types: `isBusiness` vs `entity` (they already disagree for loans and recon-only accounts), `importBatchId` vs `rawBatchId`, `pending` vs `status`, `priorClassification` vs `previousValue`, `merchantName` vs `cleanMerchant`. Keep one of each.

---

**Next steps:** push the repo to GitHub (private is fine, with the Devin GitHub app given access) and send me the URL. I'll fix these with a regression test for each, P0 first, as PRs, and check against your existing tests. Please include the liquidity/collateral calculation, `transferEngine`, `anomalyEngine`, `plaidParser` and the sync server, since several of the issues above interact with that code.