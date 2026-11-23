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
| `association.officeAddress` / `.officeAddressTamil` | — | Association |
| `association.signature.chairmanPath` | — | Signatures |
| `association.signature.presidentPath` | — | Signatures |
| `association.signature.vicePresidentPath` | — | Signatures |
| `association.signature.secretaryPath` | — | Signatures |
| `association.signature.jointSecretaryPath` | — | Signatures |
| `association.signature.treasurerPath` | — | Signatures |
| `memberRegister.enabled` | `true` | Member Register |

`category` is free text, not an enum: the settings screen groups by whatever
comes back, so a new category needs no code change.

**Signatures is its own category rather than a sub-category of Association.**
The schema has a `subCategory` column, but the settings screen groups by
`category` alone and `SettingDefinitionSeed` has no `subCategory` field, so a
catalogue row could not set one even if the screen read it.

#### The association block is what gets printed

These 24 settings exist to be rendered onto something — a membership card, a
receipt, a certificate — which is why there are four logos and six separate
signature images rather than one of each. A document needs a particular
office-bearer's signature, and a business may hold the secretary's and not the
treasurer's, so they have to be addressable one at a time.

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

Counters are allocated with `consumeSequenceNumber(tx, businessId, key)`, which
takes a locking read (`SELECT … FOR UPDATE`) and must run inside the caller's
own transaction, so a failed insert does not burn a number.

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

`association.stateId` is the only one today, with `{"ref":"states"}`. The
**server owns the mapping** from a ref name to a table, in
`TenantBusinessSettingsService.listRefOptions()`, and serves the choices from:

- `GET /tenant/business-settings/options/:ref`
- `GET /system/tenant-business-settings/options/:ref?tenantBusinessId=`

Both are guarded by `tenant-business-settings:view` — **their own surface's
permission, deliberately.** `GET /tenant/districts/states` already returns the
same rows and would have cost nothing to reuse, but it is guarded by
`tenant-districts:list`, which would have made editing an association's address
require an unrelated permission.

An unknown ref returns `[]` rather than an error: `ref` is free text typed into
the catalogue, and a typo there must not turn the settings screen into a 500.
Options carry `labelTamil` alongside `label`, and the picker shows both.

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
