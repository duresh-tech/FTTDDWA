# Members

`tenant_members` is the register: who belongs to the association, what they
trade as, where they are, and what state their membership is in.

A business can close its own register with the `memberRegister.enabled`
[business setting](./business-settings.md#memberregister-enabled-closes-the-register).
That hides this feature in the tenant portal only — system staff reach the
register either way — and an **unset** value means enabled, so a business whose
settings backfill has not run keeps working.

Each member names an association position, an industry, a point in the
[geography chain](./tenants-and-businesses.md#the-geography-chain) — state,
district and taluk together — and an **RTO**. Every reference is validated
against the caller's own business before anything is written.

`rtoId` is required, like the rest of the chain, and is checked against the
chosen **district** rather than the taluk that sits above it on the form.
[RTOs branch off the chain](./tenants-and-businesses.md#rtos-hang-off-the-district-not-the-taluk)
rather than extending it, which is easy to get backwards.

## The membership number

`memberIdNumber` is what a card prints: the member's RTO code followed by a
sequence — `TN72001`, `TN72002`, … The sequence is **per RTO code**, so a newly
created office starts again at `001`.

It is **generated, never submitted.** It is absent from the create and update
schemas, so Zod strips it at the HTTP boundary, and `update()` strips it again
before spreading the DTO into Prisma — that second guard is for a future caller
that skips validation, like a bulk import.

### Allocating it without two members getting the same one

`allocateMemberIdNumber()` runs inside the create transaction and does two
things:

1. **Locks the RTO row** with `SELECT … FOR UPDATE`. That serialises allocation
   *per RTO*: two enrolments under TN72 queue up, while TN38 and TN72 never
   contend.

   Locking the RTO rather than the member rows is the point. There is no row to
   lock for a number that does not exist yet, so `SELECT MAX(…) FOR UPDATE`
   over members would happily let two transactions both read `001`.

2. Takes the **highest numeric suffix**, never the highest string.

> `TN72999` sorts *above* `TN721000` lexically. A string `MAX` therefore stops
> advancing the moment the sequence passes 999, and every insert after that
> collides on the unique index forever. This is the bug this feature invites,
> and the reason the suffix is parsed to a number before comparing.

`@@unique([tenantBusinessId, memberIdNumber])` is the backstop: the lock is the
mechanism, the constraint is the guarantee. The number already embeds the RTO
code, so business-scoped uniqueness *is* per-RTO uniqueness.

Because the number is derived from the members table rather than a counter
column, **a rolled-back enrolment does not burn one** — the next member gets
the number the failed attempt would have had. Soft-deleted members still count,
though: their number is issued, and reusing it would give two people the same
membership number.

### It survives a change of RTO

Moving a member to another RTO does **not** regenerate it. They may already
hold a printed card, and an identifier that changes is not an identifier — the
old number would point at nobody. The number records the office they enrolled
under, which is a fact that does not change afterwards.

So a member's prefix may not match their current RTO. That is intended.

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

## The Aadhaar is optional

It was required, and is not any more. A member or applicant may be recorded
without one.

The consequence is worth stating rather than discovering: **the blind index is
the only thing that catches a duplicate**, and it has nothing to work with when
there is no number. So:

- **supplied** — still encrypted, still given a keyed blind index, still
  checked against *both* the register and the pending applications
- **absent** — stored as null, and no duplicate check happens at all

Two records for one person therefore become possible when neither carries a
number. That is the honest cost of the field being optional, not an oversight.

The `@@unique([tenantBusinessId, aadhaarHash])` on both tables survives
unchanged: Postgres treats NULLs as distinct in a unique index, so any number
of people may have no Aadhaar while two people still cannot share one.

## Status is a lifecycle, not a delete flag

`PENDING`, `ACTIVE`, `INACTIVE` — plus `DELETED`, which only `DELETE` can
reach.

A new member starts `PENDING`, and a restored one comes back `PENDING` rather
than `ACTIVE`: a membership that was deleted deserves another look, not a
silent resumption.

Moving between states has its **own endpoint and its own permission**,
`tenant-members:change_status`, separate from `update`. Ending someone's
membership is a different act from correcting their phone number, and you would
plausibly grant one without the other.

### `SUSPENDED` and `EXPIRED` were retired

They duplicated `INACTIVE` and nothing acted on the difference: no job expired
a membership on a date, no guard treated a suspension differently, and the
portal's login check only ever asked whether the status was `ACTIVE`. Three
words for one state is three chances to pick the wrong one.

They are gone from the **write** path — the create, update, status-change and
list-filter schemas — and from both console screens.

They remain in the **Prisma enum**, deliberately. Postgres cannot drop an enum
value in place; it needs a new type, a column migration and a drop. More to the
point, a row written before this change is a true record of what staff chose at
the time, and narrowing what may be written is not a reason to rewrite history.
So a legacy row still lists, still reads, and still renders — it just cannot be
set again, and has no filter chip of its own.

> `ApiKeyStatus` deliberately has no `EXPIRED` member either, because expiry
> there is derived from `expiresAt` and the clock, and storing it too would
> give two sources of truth that drift. Memberships now agree with it, for a
> simpler reason: there is no membership-expiry column, so nothing was deriving
> it and nothing was setting it on time.
