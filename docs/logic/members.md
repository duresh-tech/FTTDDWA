# Members

`tenant_members` is the register: who belongs to the association, what they
trade as, where they are, and what state their membership is in.

A business can close its own register with the `memberRegister.enabled`
[business setting](./business-settings.md#memberregister-enabled-closes-the-register).
That hides this feature in the tenant portal only — system staff reach the
register either way — and an **unset** value means enabled, so a business whose
settings backfill has not run keeps working.

Each member names an association position, an industry, and a point in the
[geography chain](./tenants-and-businesses.md#the-geography-chain) — state,
district and taluk together. All six references are validated against the
caller's own business before anything is written.

## The Aadhaar number is encrypted, and still deduplicated

Three columns carry it, and each exists for a reason:

| Column | Holds | Why |
| --- | --- | --- |
| `aadhaarNumber` | AES-256-GCM ciphertext | The number itself. Never returned by any endpoint. |
| `aadhaarHash` | HMAC-SHA256 of the digits | A blind index. Also never returned. |
| `aadhaarLast4` | four digits, in the clear | What a screen shows to confirm the right person. |

The hash exists because **encryption and uniqueness are at odds**. GCM uses a
random IV, so the same number encrypts to different ciphertext every time —
which is exactly what you want for confidentiality, and exactly what makes
`@@unique` useless. Two records for the same person would not collide.

A deterministic hash restores the one property needed: equality. It is keyed
(HMAC, not a bare SHA-256) because an Aadhaar is 12 digits — a plain hash of a
10¹² space falls to a rainbow table in minutes. The key is derived from the
same root as the encryption key but under its own label, so neither can be
recovered from the other.

`@@unique([tenantBusinessId, aadhaarHash])` is therefore what catches the same
person enrolled twice. The check deliberately ignores soft-deleted rows, as the
street-code check does: a deleted member still holds their Aadhaar, so
restoring them cannot collide with someone enrolled in the meantime.

**What this buys and what it costs.** You get confidentiality and duplicate
detection. You do not get search: a blind index answers "are these the same?"
and nothing else, so member search covers names, phone and email but never the
Aadhaar. Partial matching would need a different design entirely.

The hash is never published. Handing it out would give an attacker an offline
oracle against that same 10¹² space.

### Replacing a stored number

A blank `aadhaarNumber` on update means **unchanged**, never "clear it". The
field reads back masked, so a form that submits everything it was given would
otherwise send a blank and destroy the stored value — surfacing only when
someone next opened the record. The same rule governs encrypted business
settings, for the same reason.

## Dates are calendar dates

`dateOfBirth` and `weddingDate` are `YYYY-MM-DD` strings, not epochs.

A birth date is not a moment in time. Every business picks its own `timeZone`
setting, so a date stored as an epoch renders as the previous day for anyone in
a negative offset — a bug that appears only for some users, some of the time.
The string is what `<input type="date">` emits and what the settings store
already validates.

## Married and the wedding date

`weddingDate` can only be set when `isMarried` is true, and clearing the flag
clears the date. The rule is enforced twice on purpose:

- The create schema rejects a wedding date on an unmarried member outright.
- The service re-derives both on update, because a PATCH may carry either field
  or neither, and only the stored row says what the other one currently is.

Without the second, clearing the flag would leave the old date behind — the
kind of contradiction that survives for years because nothing reads both
fields at once.

## Status is a lifecycle, not a delete flag

`PENDING`, `ACTIVE`, `INACTIVE`, `SUSPENDED`, `EXPIRED` — plus `DELETED`, which
only `DELETE` can reach.

A new member starts `PENDING`, and a restored one comes back `PENDING` rather
than `ACTIVE`: a membership that was deleted deserves another look, not a
silent resumption.

Moving between states has its **own endpoint and its own permission**,
`tenant-members:change_status`, separate from `update`. Suspending someone is a
different act from correcting their phone number, and you would plausibly grant
one without the other.

> Note `ApiKeyStatus` deliberately has no `EXPIRED` member, because expiry
> there is derived from `expiresAt` and the clock, and storing it too would
> give two sources of truth that drift. That reasoning does not apply here only
> because there is no membership-expiry column: `EXPIRED` is a state a human
> sets. If such a column is ever added, this member should go and be derived
> instead.
