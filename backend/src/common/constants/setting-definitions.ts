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

/**
 * An image-only file picker. `accept` is a rendering hint the settings screen
 * reads and the server ignores by design - a FILE value is checked as a
 * relative storage path, not by extension.
 */
const IMAGE_FILE = JSON.stringify({ accept: 'image/*' });

/** A multi-line STRING, bounded to the same width as an address column. */
const ADDRESS_TEXT = JSON.stringify({ multiline: true, maxLength: 255 });

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

  // ---- Association ----
  //
  // Who this business is, as it should appear on a membership card, a receipt
  // or a certificate. Every text field has a Tamil twin, following the
  // precedent set by placeNameTamil / positionNameTamil / memberNameTamil:
  // Tamil is a first-class rendering of the same value, not a translation
  // bolted on beside it.
  {
    category: 'Association',
    settingKey: 'association.name',
    settingLabel: 'Association name',
    description: 'The full registered name, as it appears on official documents.',
    valueType: 'STRING',
    defaultValue:
      'FEDERATION OF TAMILNADU TENT DEALERS & DECORATORS WELFARE ASSOCIATION',
    validationRules: JSON.stringify({ maxLength: 150 }),
    isRequired: true,
    sortOrder: 100,
  },
  {
    category: 'Association',
    settingKey: 'association.nameTamil',
    settingLabel: 'Association name (Tamil)',
    description: 'The full registered name in Tamil.',
    valueType: 'STRING',
    validationRules: JSON.stringify({ maxLength: 150 }),
    sortOrder: 110,
  },
  {
    category: 'Association',
    settingKey: 'association.shortName',
    settingLabel: 'Short name',
    description: 'The abbreviation used where the full name will not fit.',
    valueType: 'STRING',
    defaultValue: 'FTTDDWA',
    validationRules: JSON.stringify({ maxLength: 50 }),
    sortOrder: 120,
  },
  {
    category: 'Association',
    settingKey: 'association.shortNameTamil',
    settingLabel: 'Short name (Tamil)',
    valueType: 'STRING',
    validationRules: JSON.stringify({ maxLength: 50 }),
    sortOrder: 130,
  },
  {
    category: 'Association',
    settingKey: 'association.registrationNumber',
    settingLabel: 'Registration number',
    description: 'The society or trust registration number.',
    valueType: 'STRING',
    validationRules: JSON.stringify({ maxLength: 50 }),
    sortOrder: 140,
  },
  {
    category: 'Association',
    settingKey: 'association.logo1Path',
    settingLabel: 'Logo 1',
    description: 'The primary logo. Used wherever a single mark is shown.',
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 150,
  },
  {
    category: 'Association',
    settingKey: 'association.logo2Path',
    settingLabel: 'Logo 2',
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 160,
  },
  {
    category: 'Association',
    settingKey: 'association.logo3Path',
    settingLabel: 'Logo 3',
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 170,
  },
  {
    category: 'Association',
    settingKey: 'association.logo4Path',
    settingLabel: 'Logo 4',
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 180,
  },
  {
    category: 'Association',
    settingKey: 'association.tagline',
    settingLabel: 'Tagline',
    description: 'A single line printed under the name.',
    valueType: 'STRING',
    validationRules: JSON.stringify({ maxLength: 150 }),
    sortOrder: 190,
  },
  {
    category: 'Association',
    settingKey: 'association.taglineTamil',
    settingLabel: 'Tagline (Tamil)',
    valueType: 'STRING',
    validationRules: JSON.stringify({ maxLength: 150 }),
    sortOrder: 200,
  },
  {
    category: 'Association',
    settingKey: 'association.email',
    settingLabel: 'Email',
    description: 'The address members should write to.',
    valueType: 'EMAIL',
    sortOrder: 210,
  },
  {
    category: 'Association',
    settingKey: 'association.phoneNumber',
    settingLabel: 'Phone number',
    valueType: 'PHONE',
    sortOrder: 220,
  },
  {
    category: 'Association',
    settingKey: 'association.isWhatsapp',
    settingLabel: 'Reachable on WhatsApp',
    description: 'Turn on to publish a WhatsApp number alongside the phone number.',
    valueType: 'BOOLEAN',
    defaultValue: 'false',
    sortOrder: 230,
  },
  {
    category: 'Association',
    settingKey: 'association.whatsappNumber',
    settingLabel: 'WhatsApp number',
    // `showIf` hides this field until the flag above is on. It steers the
    // SCREEN only - the API still accepts a number with the flag off, so
    // anything that reads this must check association.isWhatsapp itself.
    valueType: 'PHONE',
    validationRules: JSON.stringify({
      showIf: { key: 'association.isWhatsapp', equals: 'true' },
    }),
    sortOrder: 240,
  },
  {
    category: 'Association',
    settingKey: 'association.stateId',
    settingLabel: 'State',
    description: 'The state the head office is registered in.',
    // STRING, not a foreign key: this is a key-value store, so the value is a
    // tenant_states UUID with nothing enforcing it. `ref` makes the screen
    // render a picker of that business's states instead of a UUID box; it is a
    // rendering hint and deliberately not a write rule.
    valueType: 'STRING',
    validationRules: JSON.stringify({ ref: 'states' }),
    sortOrder: 250,
  },
  {
    category: 'Association',
    settingKey: 'association.officeAddress',
    settingLabel: 'Office address',
    description: 'The postal address of the head office.',
    valueType: 'STRING',
    validationRules: ADDRESS_TEXT,
    sortOrder: 260,
  },
  {
    category: 'Association',
    settingKey: 'association.officeAddressTamil',
    settingLabel: 'Office address (Tamil)',
    valueType: 'STRING',
    validationRules: ADDRESS_TEXT,
    sortOrder: 270,
  },

  // ---- Signatures ----
  //
  // Its own category rather than a subCategory of Association: the settings
  // screen groups by `category` alone, and SettingDefinitionSeed has no
  // subCategory field for a catalogue row to set.
  //
  // One image per office-bearer, each printed on a different document, so they
  // are six settings rather than one list - a business may hold the
  // chairman's and not the treasurer's, and the screen has to show which.
  {
    category: 'Signatures',
    settingKey: 'association.signature.chairmanPath',
    settingLabel: "Chairman's signature",
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 300,
  },
  {
    category: 'Signatures',
    settingKey: 'association.signature.presidentPath',
    settingLabel: "President's signature",
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 310,
  },
  {
    category: 'Signatures',
    settingKey: 'association.signature.vicePresidentPath',
    settingLabel: "Vice President's signature",
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 320,
  },
  {
    category: 'Signatures',
    settingKey: 'association.signature.secretaryPath',
    settingLabel: "Secretary's signature",
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 330,
  },
  {
    category: 'Signatures',
    settingKey: 'association.signature.jointSecretaryPath',
    settingLabel: "Joint Secretary's signature",
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 340,
  },
  {
    category: 'Signatures',
    settingKey: 'association.signature.treasurerPath',
    settingLabel: "Treasurer's signature",
    valueType: 'FILE',
    validationRules: IMAGE_FILE,
    sortOrder: 350,
  },

  // ---- Member Register ----
  {
    category: 'Member Register',
    settingKey: 'memberRegister.enabled',
    settingLabel: 'Member register enabled',
    description:
      'Turn off to close the member register in this business’s own portal. ' +
      'System staff keep access either way.',
    valueType: 'BOOLEAN',
    // Default ON. The register already exists and is in use, so shipping this
    // flag must not switch a working feature off for every business at once.
    // Readers treat an UNSET value as enabled for the same reason.
    defaultValue: 'true',
    sortOrder: 400,
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
