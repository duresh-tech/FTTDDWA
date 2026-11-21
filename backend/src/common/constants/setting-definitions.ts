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

  // ---- Customers ----
  {
    category: 'Customers',
    settingKey: 'customer.codeGeneration',
    settingLabel: 'Customer code generation',
    description:
      'MANUAL: you type each customer code. AUTOMATIC: the next number is allocated for you.',
    valueType: 'STRING',
    defaultValue: 'MANUAL',
    validationRules: JSON.stringify({ enum: ['MANUAL', 'AUTOMATIC'] }),
    isRequired: true,
    sortOrder: 40,
  },
  {
    category: 'Customers',
    settingKey: 'customer.codePrefix',
    settingLabel: 'Customer code prefix',
    description: 'Prefixed to automatically generated customer codes.',
    valueType: 'STRING',
    defaultValue: 'CUS',
    validationRules: JSON.stringify({ maxLength: 10 }),
    sortOrder: 50,
  },
  {
    category: 'Customers',
    settingKey: 'customer.nextCode',
    settingLabel: 'Next customer number',
    description:
      'The number the next automatic customer code will use. Allocated by the ' +
      'server, so it is shown rather than edited.',
    valueType: 'INTEGER',
    defaultValue: '1',
    validationRules: JSON.stringify({ min: 1 }),
    // A counter, not a preference: editing it by hand would hand out a code
    // that already exists.
    isReadonly: true,
    sortOrder: 60,
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
