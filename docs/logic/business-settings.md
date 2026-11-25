# Business settings

There are two settings layers, and they are not the same thing.

## App settings (platform-wide)

`app_settings` is a generic typed key-value store (`key`, `dataType`, `value`,
`description`, soft-delete `status`), managed by system staff only. One row per
key for the whole instance. A stable public endpoint,
`GET /system/app-settings/public/branding`, gives every client the app name and
logo.

## Business settings (per tenant business)

| Table | Role |
| --- | --- |
| `setting_definitions` | The catalogue: key, label, category, `valueType`, default, validation rules, and the required / encrypted / read-only / visible flags. System staff manage it. |
| `tenant_business_settings` | One row per business per definition, holding that business's value. |
| `tenant_business_setting_sync_logs` | What each backfill run did, per definition per business — including what it skipped. |

- A new business gets **every definition's default**, written inside the same
  transaction that creates the business. A failure to seed them takes the
  business with it, because a business with no settings renders an empty
  settings screen and breaks any code that reads a setting by key.
- A new definition reaches **existing** businesses through **settings sync**
  (`settings-sync:run`, or the "Sync to all tenants" button on the Setting
  Definitions screen). The seed runs the same sync, matched by key. An existing
  row is **never** overwritten — that is a value the business chose.
- Values of definitions marked encrypted are stored with AES-256-GCM
  (`SETTINGS_ENCRYPTION_KEY`) and masked to an empty string in API responses.
  Server code reads them decrypted. Submitting a blank value for an encrypted
  setting means "unchanged", never "clear it" — encrypting `''` would destroy a
  working credential and only surface later, somewhere unrelated.
- Read-only definitions (counters) cannot be edited by hand.
- `isReadonly` on a **business's row** overrides the definition's default for
  that one business, independently of every other tenant's copy. System staff
  flip it from the Business Settings screen's lock icon.
- A tenant batch save is one unit: if any value is rejected, or any targeted
  setting is locked, the **whole batch** rolls back. Half a saved form is worse
  than a refused one.

### The per-business row copies its definition

`tenant_business_settings` duplicates `settingLabel`, `valueType` and
`validationRules` from its definition instead of joining to it. That is
deliberate: a definition may later be re-worded or retired, and an
already-configured business must keep rendering and validating against the
terms it was set up with.

The consequence to remember is that **editing a definition does not change
businesses that already hold a copy.** `settingKey` and `valueType` cannot be
edited at all, and there is no delete — a definition is retired by setting its
status to `INACTIVE`.

### Defined settings

| Key | Default | Category |
| --- | --- | --- |
| `timeZone` | `Asia/Kolkata` | General |
| `dateFormat` | `DD-MM-YYYY` | General |
| `currencyCode` | `INR` | General |
| `tax.taxPerItem` | `false` | Tax |
| `tax.enableInclusiveTaxesByDefault` | `false` | Tax |
| `association.name` | the registered name | Association |
| `association.nameTamil` | — | Association |
| `association.shortName` | `FTTDDWA` | Association |
| `association.shortNameTamil` | — | Association |
| `association.registrationNumber` | — | Association |
| `association.logo1Path` … `logo4Path` | — | Association |
| `association.tagline` / `.taglineTamil` | — | Association |
| `association.email` | — | Association |
| `association.phoneNumber` | — | Association |
| `association.isWhatsapp` | `false` | Association |
| `association.whatsappNumber` | — | Association |
| `association.stateId` | — | Association |
| `association.districtId` | — | Association |
| `association.talukId` | — | Association |
| `association.placeId` | — | Association |
| `association.streetId` | — | Association |
| `association.pincode` | — | Association |
| `association.officeAddress` / `.officeAddressTamil` | — | Association |
| `association.signature.chairmanPath` | — | Signatures |
| `association.signature.presidentPath` | — | Signatures |
| `association.signature.vicePresidentPath` | — | Signatures |
| `association.signature.secretaryPath` | — | Signatures |
| `association.signature.jointSecretaryPath` | — | Signatures |
| `association.signature.treasurerPath` | — | Signatures |
| `memberRegister.enabled` | `true` | Member Register |
| `memberRegister.positionId` | — | Member Register |

`category` is free text, not an enum: the settings screen groups by whatever
comes back, so a new category needs no code change.

**Signatures is its own category rather than a sub-category of Association.**
The schema has a `subCategory` column, but the settings screen groups by
`category` alone and `SettingDefinitionSeed` has no `subCategory` field, so a
catalogue row could not set one even if the screen read it.

#### The association block is what gets printed

The Association and Signatures settings exist to be rendered onto something —
a membership card, a receipt, a certificate — which is why there are four logos
and six separate signature images rather than one of each. A document needs a
particular office-bearer's signature, and a business may hold the secretary's
and not the treasurer's, so they have to be addressable one at a time.

Every text field has a Tamil twin, following `placeNameTamil`,
`positionNameTamil` and `memberNameTamil`: Tamil is a second rendering of the
same value, not a translation stored beside it.

### Blank clears a setting

Submitting an empty value stores `NULL`, and the valueType is **not** checked
against it.

Without this an optional `EMAIL` or `PHONE` could be set but never cleared:
`''` fails the email pattern outright and the phone pattern demands at least
six characters. Because the tenant screen saves every edited row in one
transaction, a single blanked field would have rolled back the whole form.

This is safe because `isRequired` is a **label, not a write rule** — it is
stored, returned, and badged on the Setting Definitions screen, and enforced on
no write path. Blank already cleared a `STRING`; now every valueType agrees.

**The one exception is an encrypted setting, where blank means "unchanged".**
Its value reads back masked, so the user cannot retype what they cannot see,
and storing `''` would destroy a working credential. The two cases sit next to
each other in `tenant-business-settings.service.ts` and mean opposite things —
they are deliberately kept apart rather than folded together.

### Reading a setting from application code

`TenantBusinessSettingsService.getSettingsMapForBusiness(businessId, keys?)`
returns a decrypted `key -> value` map. It does **not** fall back to the
definition's `defaultValue` — the default is applied once, when the row is
created, so a missing row reads as absent and **every caller must supply its
own fallback**. Assuming otherwise is the easy mistake: a business whose row
was never created would silently take the catalogue's current default instead
of the one it was set up with.

> Earlier versions of this page described a `consumeSequenceNumber()` helper
> here. It never existed — the claim came over with the IPTV port, whose
> customer-code feature was removed in 3.0. The one sequence this system does
> allocate is the membership number, and it lives with the members:
> see [Members](./members.md#the-membership-number).

### Adding a setting

Add it to `SETTING_DEFINITIONS` in
`backend/src/common/constants/setting-definitions.ts` and run `npm run seed`.
The definition is created and synced to every business. Nothing else needs
changing: the settings screen renders from `valueType` and `validationRules`,
so a setting whose rules carry an `enum` arrives as a working dropdown with no
UI code, a `multiEnum` as a checkbox list, a `FILE` as an upload with a
thumbnail, a `multiline` as a textarea, and a `ref` as a picker of another
resource's records.

Staff can also add a definition at run time from the Setting Definitions
screen. The difference is only durability: a definition in the constants file
is recreated on any fresh install, one added through the UI exists in that
database alone.

#### Editing `sortOrder` does nothing to an existing instance

`syncSettingDefinitions()` only **creates** definitions the database lacks, and
`tenant_business_settings` copies `sortOrder` when the row is created. So
renumbering a shipped setting in the catalogue changes nothing on an instance
that already seeded it — the new number reaches fresh installs only.

Leave gaps, and slot new settings into them. The association block is numbered
in tens for exactly this reason, which is how the five address settings landed
at 251–255 between `association.stateId` (250) and `association.officeAddress`
(260) without renumbering either.

If a shipped row really must move, that is a data migration, not a catalogue
edit.

### Rendering hints live in `validationRules`

`validationRules` carries two kinds of key. Some are **write rules** the server
enforces (`min`, `max`, `minLength`, `maxLength`, `pattern`, `enum`,
`multiEnum`). The rest are **rendering hints** the settings screen reads and
the server ignores by design:

| Hint | Applies to | Effect |
| --- | --- | --- |
| `accept` | `FILE` | The file picker's filter, ex. `"image/*"`. |
| `multiline` | `STRING` | A textarea instead of a one-line input. |
| `ref` | `STRING` | A picker of another resource's records. |
| `refParent` | `STRING` + `ref` | Narrow that picker by another setting's value. |
| `showIf` | any | Hide the field until another setting reads a given value. |

Keeping these out of the validator is the point: a hint steers a screen, and
promoting one to a write rule would start rejecting values the API should
accept.

#### `ref` — a setting that points at another record

A `ref` setting holds another resource's UUID in a plain `STRING`. There is no
foreign key behind it, because a key-value store has none to offer — so
deleting the record it names leaves the setting dangling and the field reads
blank. That is the accepted cost of configuration living in rows rather than
columns.

The **server owns the mapping** from a ref name to a table, in
`TenantBusinessSettingsService.listRefOptions()`, and serves the choices from:

- `GET /tenant/business-settings/options/:ref?parentId=`
- `GET /system/tenant-business-settings/options/:ref?tenantBusinessId=&parentId=`

Both are guarded by `tenant-business-settings:view` — **their own surface's
permission, deliberately.** `GET /tenant/districts/states` already returns the
same rows and would have cost nothing to reuse, but it is guarded by
`tenant-districts:list`, which would have made editing an association's address
require an unrelated permission.

An unknown ref returns `[]` rather than an error: `ref` is free text typed into
the catalogue, and a typo there must not turn the settings screen into a 500.
Options carry `labelTamil` alongside `label`, and the picker shows both.

#### `refParent` — a picker narrowed by another setting

`refParent` names the settingKey whose value narrows this picker, so the six
address settings fill top-down:

| Setting | `ref` | `refParent` |
| --- | --- | --- |
| `association.stateId` | `states` | — |
| `association.districtId` | `districts` | `association.stateId` |
| `association.talukId` | `taluks` | `association.districtId` |
| `association.placeId` | `places` | — |
| `association.streetId` | `streets` | `association.placeId` |

**A ref that needs a parent and is given none returns `[]`, never the
unfiltered list.** Falling back to everything is precisely the failure this
prevents: it is what lets a Coimbatore district be filed under Kerala, and
nothing downstream would reject the pair, because `ref` is a hint and not a
write rule.

##### The chain forks, and the screen cannot hide it

```
TenantState ──> TenantDistrict ──> TenantTaluk      a real FK chain

TenantPlace ──> TenantStreet                        separate
```

`TenantPlace` has **no `talukId`** — it is a geofence (`latitude`,
`longitude`, `radiusMeters`) hanging off the business — and `TenantStreet`
belongs to a *place*. So **Place is a second root** whose picker lists every
place the business has, and **Street narrows by place, not by the taluk sitting
directly above it on screen.** Choosing a taluk leaves Street empty. That looks
like a bug and is not.

`TenantMember` is the same shape: it references state, district and taluk, and
not place or street.

##### Changing a parent clears its descendants — on the tenant screen only

Switching the state clears the district **and** the taluk. Clearing just the
direct child would leave a taluk from the old district hanging under a new
state, and nothing re-reads the pair afterwards, so the contradiction would
survive indefinitely. A descendant that was already empty is skipped rather
than written, so switching a parent does not inflate the save count.

Clearing writes a blank, which is a real `NULL` on save by the rule above —
before blank-clears existed, a cascade would have failed validation.

The **support screen narrows but does not clear.** It saves one row at a time,
so queueing an edit to a row the operator never touched would be a surprise
write; and leaving the stored values alone is what makes a mismatched pair
visible there, which is the point of a support screen.

#### `association.pincode`

A `STRING` with `{"pattern":"^[1-9][0-9]{5}$","maxLength":6}`, not an
`INTEGER`: a PIN is an identifier, not a quantity, and `INTEGER` would invite
arithmetic on it and drop a leading digit if one ever mattered. Blank is
accepted, since a blank value skips the rule checks.

#### `showIf` — a field that waits for another

`association.whatsappNumber` carries
`{"showIf":{"key":"association.isWhatsapp","equals":"true"}}`, so it appears
only once the flag is on. The condition is evaluated against the **pending**
form value, not the stored one, so ticking the flag reveals the field without a
save first — and hiding a row drops any edit pending on it, or the save would
carry a value the user can no longer see.

Two things follow:

- **It is a UI hint.** The API still accepts a WhatsApp number with the flag
  off, so whatever reads the number must check the flag itself.
- **The support screen ignores it.** `system/dashboard/tenant-business-settings`
  applies neither `showIf` nor `isVisible`: an operator looking into a tenant's
  configuration needs to see a value stored while its condition is false,
  because that contradiction is the kind of thing they are there to find.

### `memberRegister.positionId` fixes what an applicant may claim

A `ref` setting pointing at one of the business's own association positions.
Set it and every **public application** is filed under that position; leave it
empty and applicants choose for themselves.

The distinction that matters is who is asking:

- **The public form is held to it.** `publicOptions()` narrows the position
  list to that one row, and `submit()` **overrides** whatever was posted.
  Narrowing the list stops an honest applicant choosing wrongly; overriding is
  what stops a crafted request, because a public route cannot trust its own
  form. It overrides rather than rejects — the applicant was never shown the
  choice, so failing their application over a field they could not see would be
  the worse answer.
- **Staff are only defaulted.** Both member screens pre-fill an empty position
  with it and leave it editable. An association still has to be able to enrol a
  Secretary directly, so a hard lock here would break the register to protect
  a form that is already protected.

Two traps this had to design around:

- **Absent means "applicants choose".** The opposite polarity to
  `memberRegister.enabled`, and deliberately so: an absent key is exactly what
  every existing business has until `npm run seed` backfills, and the other way
  round would pin every association's applicants to nothing at the moment of
  upgrade. For the same reason it ships with **no default value**.
- **`ref` is a rendering hint, not a write rule.** Nothing stops the stored
  UUID naming a position that was since deleted, or one belonging to another
  business if it was set through the API rather than the screen. So
  `resolveApplicantPositionId()` re-reads the row scoped to the business and
  returns `null` when it does not resolve — a stale id degrades to "applicants
  choose", never to a cross-tenant leak.

### `memberRegister.enabled` closes the register

The one setting that gates a feature. Reading `'false'` makes the **tenant
self-service** member surface refuse:
`TenantMembersService` checks it in `assertBusinessOwned()` and
`findOneForTenantUser()`, and the console hides the Members nav item.

Three choices worth knowing:

- **Unset means enabled.** `getSettingsMapForBusiness()` omits a key with no
  row and applies no default, so a business whose backfill has not run reads as
  absent — and treating that as "off" would shut it out of a feature it never
  chose to disable. Only an explicit `'false'` closes anything.
- **The list filters rather than refusing.** A caller mapped to two businesses,
  one with the register closed, sees the other's members instead of an error for
  both.
- **System staff keep access.** The flag is a business's choice about its own
  portal, not a tenant's veto over support, so `system/tenant-members` is
  unaffected.

`isSettingEnabled(businessId, key)` is the helper, built on
`getSettingsMapForBusiness()`.

### A `FILE` setting holds a path

Never a URL. The settings screen uploads through its own portal's endpoint
(`POST /system/uploads` or `POST /tenant/uploads`) and saves the relative path
the endpoint returned. The file is uploaded as soon as it is picked, but the
*value* is only persisted when the screen saves — so an abandoned pick leaves
an unreferenced file behind.

> **Rotating `JWT_ACCESS_SECRET` without setting `SETTINGS_ENCRYPTION_KEY`**
> makes every encrypted value unreadable, and this feature adds a second class
> of encrypted data behind that key. Set `SETTINGS_ENCRYPTION_KEY` explicitly
> on anything long-lived — see [Configuration](../guide/configuration.md).
