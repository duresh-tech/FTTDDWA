/**
 * The catalogue of per-business settings, in one place.
 *
 * This is to `setting_definitions` what `permissions.ts` is to `permissions`:
 * the declared truth, applied by the bootstrap. Adding a row here and
 * re-running `npm run seed` creates the definition and gives it to every
 * existing business at its default. Nothing else needs changing - the settings
 * screen renders from `valueType` and `validationRules`, so a setting with an
 * `enum` rule arrives as a working dropdown with no UI code.
 *
 * Do NOT change a `settingKey` or `valueType` once shipped. Businesses hold
 * copies keyed by the one and validated against the other, so editing either
 * orphans or silently re-types every existing row. Retire the definition
 * through the admin screen (status INACTIVE) and add a new key instead.
 *
 * `category` is free text, not an enum: the tenant settings screen groups by
 * whatever comes back, so a new category needs no code change.
 */
export interface SettingDefinitionSeed {
  category: string;
  settingKey: string;
  settingLabel: string;
  description?: string;
  valueType:
    | 'STRING'
    | 'INTEGER'
    | 'DECIMAL'
    | 'BOOLEAN'
    | 'JSON'
    | 'ARRAY'
    | 'OBJECT'
    | 'DATE'
    | 'DATETIME'
    | 'TIME'
    | 'COLOR'
    | 'FILE'
    | 'URL'
    | 'EMAIL'
    | 'PHONE';
  defaultValue?: string;
  /** JSON string. `enum` renders a dropdown; `min`/`max` bound a number. */
  validationRules?: string;
  isRequired?: boolean;
  /** Stored AES-256-GCM encrypted and masked in every response. */
  isEncrypted?: boolean;
  /** Readable but not editable - counters the server allocates. */
  isReadonly?: boolean;
  /** Returned by the API but left off the settings screen. */
  isVisible?: boolean;
  sortOrder: number;
}

export const SETTING_DEFINITIONS: SettingDefinitionSeed[] = [
  // ---- General ----
  {
    category: 'General',
    settingKey: 'timeZone',
    settingLabel: 'Time zone',
    description: 'The zone dates and times are displayed in for this business.',
    valueType: 'STRING',
    defaultValue: 'Asia/Kolkata',
    isRequired: true,
    sortOrder: 10,
  },
  {
    category: 'General',
    settingKey: 'dateFormat',
    settingLabel: 'Date format',
    description: 'How dates are written on screen and in printed documents.',
    valueType: 'STRING',
    defaultValue: 'DD-MM-YYYY',
    validationRules: JSON.stringify({
      enum: ['DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY'],
    }),
    isRequired: true,
    sortOrder: 20,
  },
  {
    category: 'General',
    settingKey: 'currencyCode',
    settingLabel: 'Currency',
    description: 'ISO 4217 code used for every amount this business shows.',
    valueType: 'STRING',
    defaultValue: 'INR',
    validationRules: JSON.stringify({ minLength: 3, maxLength: 3, pattern: '^[A-Z]{3}$' }),
    isRequired: true,
    sortOrder: 30,
  },


  // ---- Tax ----
  {
    category: 'Tax',
    settingKey: 'tax.taxPerItem',
    settingLabel: 'Tax per item',
    description: 'Apply tax line by line instead of once on the document total.',
    valueType: 'BOOLEAN',
    defaultValue: 'false',
    sortOrder: 70,
  },
  {
    category: 'Tax',
    settingKey: 'tax.enableInclusiveTaxesByDefault',
    settingLabel: 'Prices include tax by default',
    description: 'New documents start with tax-inclusive pricing selected.',
    valueType: 'BOOLEAN',
    defaultValue: 'false',
    sortOrder: 80,
  },
];

/**
 * Settings that used to exist. Their per-business rows and their definitions
 * are deleted at bootstrap, so a retired key cannot linger on the settings
 * screen of an instance that was created before it was dropped.
 *
 * This is the counterpart of REMOVED_PERMISSION_MODULES in `permissions.ts`,
 * and exists for the same reason: taking a key out of the catalogue above only
 * stops it being CREATED. `syncSettingDefinitions()` never deletes, because it
 * must never clobber a value a business chose - so retiring one has to be said
 * out loud, here.
 *
 * No-op once applied.
 */
export const REMOVED_SETTING_DEFINITIONS: string[] = [
  // Retired with the customers feature.
  'customer.codeGeneration',
  'customer.codePrefix',
  'customer.nextCode',
];
