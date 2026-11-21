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
| `customer.codeGeneration` | `MANUAL` | Customers |
| `customer.codePrefix` | `CUS` | Customers |
| `customer.nextCode` | `1` | Customers. Read-only — the server allocates it. |
| `tax.taxPerItem` | `false` | Tax |
| `tax.enableInclusiveTaxesByDefault` | `false` | Tax |

`category` is free text, not an enum: the settings screen groups by whatever
comes back, so a new category needs no code change.

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
UI code, a `multiEnum` as a checkbox list, and a `FILE` as an upload with a
thumbnail.

Staff can also add a definition at run time from the Setting Definitions
screen. The difference is only durability: a definition in the constants file
is recreated on any fresh install, one added through the UI exists in that
database alone.

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
