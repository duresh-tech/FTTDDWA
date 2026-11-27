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


## A position can run out of seats

`tenant_association_positions.maxMembers` is how many members may hold a
position. **0 means unlimited**, and 0 is the default, so adding the column
capped nothing that already existed.

**Only ACTIVE members occupy a seat.** That single rule decides everything
else about it:

- A member enrolled by staff starts `PENDING`, so **enrolment never fills a
  position** and is never refused by the cap. The seat is claimed when they
  are **activated**, which is where the check lives. Checking at enrolment
  instead would have been both wrong and useless: wrong because a pending row
  holds nothing, and useless because the obvious handover — enrol the incoming
  President, retire the outgoing one, then activate — would have been
  impossible.
- A suspended member gives their seat back. An association does not have to
  delete a retired President to appoint the next one.
- A pending **application** holds nothing either, which is why the cap is
  enforced at approval rather than at submission. Submission still refuses a
  full position, but only as a courtesy: it saves somebody waiting for a
  decision that could only go one way.

**Lowering the cap below the number already seated is allowed and evicts
nobody.** An association that decides on one Vice-President while three are
serving must be able to record that decision; the cap then simply refuses the
next one. Refusing the edit would leave them unable to express it at all.

### Why a lock, and not a constraint

A unique index enforces at most **one** row per key, and SQL has no "at most
N" form. So unlike the membership number — where the lock is the mechanism and
the constraint is the guarantee — here the lock is the whole guarantee.

`assertPositionHasRoom()` takes `SELECT ... FOR UPDATE` on the **position**
row before counting, which serialises everybody competing for its last seat
while leaving every other position uncontended. The position is locked
**before** the RTO, always: two paths taking the same two locks in opposite
orders would deadlock under exactly the concurrency this exists for.

There is no row to lock for a member who does not exist yet, which is the same
argument `allocateMemberIdNumber()` makes for locking the RTO.

## The position can be locked to the business's choice

When a business sets `memberRegister.positionId`, that position is **fixed for
staff too**, not merely offered as a default.

- `tenant-members:position_update` is the only way to change it. It is split
  from `tenant-members:update` deliberately: anybody who may correct a phone
  number should not thereby be able to promote a member to President.
- The server refuses the change, not just the form. A read-only field in the
  console is advisory — the route is reachable with a tenant JWT and an API
  key, and the console's settings read is allowed to fail silently, so a
  caller who cannot read settings would otherwise see no lock at all.
- **An existing member is never reclassified.** Editing somebody enrolled as
  Secretary before the setting was fixed omits the position from the request
  entirely, so correcting their phone number does not quietly make them a
  Member.

The public path differs on purpose: there the server **overrides** silently,
because the applicant was never shown the field and could not act on a
mismatch.

## Staff can set a member's portal password

`PATCH system/tenant-members/:id/password` and `PATCH tenant/members/:id/password`,
guarded by `tenant-members:password_reset`.

It is split from `update` because it is an impersonation risk by nature: it
hands somebody the ability to sign in **as** a member.

Two things about it are easy to miss:

- **It is also how portal access is granted for the first time.**
  `passwordHash` is nullable, and a member enrolled by staff has none — they
  cannot sign in at all until this route is used. Only applicants who
  registered themselves arrive with a password.
- **Every refresh token is revoked.** A reset is what somebody asks for after
  a lost phone or a shared password, so leaving those sessions alive would
  defeat the reason for asking. The **access** token is a JWT and cannot be
  revoked: an app already open keeps working until it expires, and then cannot
  refresh.

Nothing is emailed or texted. The password is handed over out of band, and the
member is not forced to change it on next sign-in.

## Tamil fields refuse English letters

`memberNameTamil` and `businessNameTamil` reject any `[A-Za-z]`.

The rule is narrower than "must be Tamil" on purpose. What it catches is the
mistake people actually make — typing the English name into the Tamil box, so
a membership card prints the same name twice — while a numeral or an `&` in a
business name stays legal, because those are written the same way in both
scripts. A name written only in digits would pass, and that is the accepted
cost of not refusing a legally registered name.

**Validated on submit, never per keystroke.** Tamil is commonly typed on a
transliteration keyboard, where Latin letters are the intermediate state
before the Tamil is committed — filtering input would break exactly the people
the field exists for.

## Dates have bounds, not just a format

A date of birth must be in the past and **at least 18 years** ago; a wedding
date may be today but not later, and never before the date of birth.

The age floor is not about turning teenagers away. The failure it catches is a
typo — a year entered as 2019 instead of 1979, or today's date tabbed into the
wrong box — which otherwise reaches a printed membership card. `18` lives in
one place, `MINIMUM_AGE_YEARS` in
`backend/src/common/validation/field-rules.ts`, which the console and the
Flutter app mirror when bounding their pickers.

The rules are shared by the register and the application form, from that one
module. They have to be: approval **copies** an application into a member, so
a date the application accepted and the register would not is a row that could
never be approved.
