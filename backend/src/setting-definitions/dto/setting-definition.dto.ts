import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SettingValueTypeEnum = z.enum([
  'STRING',
  'INTEGER',
  'DECIMAL',
  'BOOLEAN',
  'JSON',
  'ARRAY',
  'OBJECT',
  'DATE',
  'DATETIME',
  'TIME',
  'COLOR',
  'FILE',
  'URL',
  'EMAIL',
  'PHONE',
]);
const SettingDefinitionStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;
const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s()-]{6,20}$/;

/**
 * The shape of a definition's `validationRules` JSON.
 *
 * The settings screen reads two further keys that are deliberately absent
 * here and ignored by the validator, because they steer rendering rather than
 * acceptance: `accept` (a file input's filter) and `ref` (render a picker of
 * another resource's records). Adding them to the validator would turn a UI
 * hint into a write rule.
 */
interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  /**
   * Like `enum`, but the value is a comma-separated subset - every item must
   * be in the list, duplicates are rejected, and an empty value means "none
   * selected". For a setting where a business may pick several of something.
   */
  multiEnum?: string[];
}

/** The chosen items of a multiEnum value. Empty string means none. */
export function parseMultiValue(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function parseValidationRules(json?: string | null): ValidationRules | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ValidationRules;
  } catch {
    return null;
  }
}

function checkType(
  valueType: z.infer<typeof SettingValueTypeEnum>,
  value: string,
): string | null {
  switch (valueType) {
    case 'INTEGER':
      return /^-?\d+$/.test(value) ? null : 'value must be an integer';
    case 'DECIMAL':
      return value !== '' && !Number.isNaN(Number(value))
        ? null
        : 'value must be a decimal number';
    case 'BOOLEAN':
      return value === 'true' || value === 'false'
        ? null
        : 'value must be "true" or "false"';
    case 'JSON':
      try {
        JSON.parse(value);
        return null;
      } catch {
        return 'value must be valid JSON';
      }
    case 'ARRAY':
      try {
        return Array.isArray(JSON.parse(value)) ? null : 'value must be a JSON array';
      } catch {
        return 'value must be a JSON array';
      }
    case 'OBJECT':
      try {
        const parsed: unknown = JSON.parse(value);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
          ? null
          : 'value must be a JSON object';
      } catch {
        return 'value must be a JSON object';
      }
    case 'DATE':
      return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
        ? null
        : 'value must be a date in YYYY-MM-DD format';
    case 'DATETIME':
      return !Number.isNaN(Date.parse(value)) ? null : 'value must be a valid ISO datetime';
    case 'TIME':
      return TIME_PATTERN.test(value)
        ? null
        : 'value must be a time in HH:mm or HH:mm:ss format';
    case 'COLOR':
      return COLOR_PATTERN.test(value) ? null : 'value must be a hex color (#RGB or #RRGGBB)';
    case 'URL':
      try {
        new URL(value);
        return null;
      } catch {
        return 'value must be a valid URL';
      }
    case 'EMAIL':
      return EMAIL_PATTERN.test(value) ? null : 'value must be a valid email address';
    case 'PHONE':
      return PHONE_PATTERN.test(value) ? null : 'value must be a valid phone number';
    case 'STRING':
    case 'FILE':
    default:
      // A FILE value is a relative storage path, checked by checkSettingPath()
      // in the settings service rather than by a type regex here.
      return null;
  }
}

/**
 * Validates one submitted value against a valueType and its rules.
 *
 * Shared by the create/update refinements below (which check a definition's
 * `defaultValue`) and by every tenant-business-settings write, which validates
 * against the valueType and rules COPIED DOWN onto its own row rather than the
 * definition's current ones. Returns null when the value is acceptable, or a
 * message fragment that reads correctly after a field name.
 */
export function validateValueForValueType(
  valueType: z.infer<typeof SettingValueTypeEnum>,
  value: string,
  validationRulesJson?: string | null,
): string | null {
  const typeError = checkType(valueType, value);
  if (typeError) return typeError;

  const rules = parseValidationRules(validationRulesJson);
  if (!rules) return null;

  if (rules.enum && !rules.enum.includes(value)) {
    return `value must be one of: ${rules.enum.join(', ')}`;
  }
  if (rules.multiEnum) {
    const chosen = parseMultiValue(value);
    const unknown = chosen.filter((v) => !rules.multiEnum!.includes(v));
    if (unknown.length > 0) {
      return `value may only contain: ${rules.multiEnum.join(', ')} (got ${unknown.join(', ')})`;
    }
    if (new Set(chosen).size !== chosen.length) {
      return 'value must not repeat the same option';
    }
  }
  if (valueType === 'INTEGER' || valueType === 'DECIMAL') {
    const num = Number(value);
    if (rules.min !== undefined && num < rules.min) return `value must be >= ${rules.min}`;
    if (rules.max !== undefined && num > rules.max) return `value must be <= ${rules.max}`;
  }
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    return `value must be at least ${rules.minLength} characters`;
  }
  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    return `value must be at most ${rules.maxLength} characters`;
  }
  if (rules.pattern) {
    try {
      if (!new RegExp(rules.pattern).test(value)) {
        return 'value does not match the required pattern';
      }
    } catch {
      // A malformed pattern stored in validationRules is the catalogue's
      // problem, not this write's - ignore it rather than blocking every save
      // of a setting whose rules someone typed wrong.
    }
  }
  return null;
}

const CreateSettingDefinitionSchema = z
  .object({
    category: z.string().min(1).max(50),
    subCategory: z.string().max(50).optional(),
    settingKey: z.string().min(1).max(150),
    settingLabel: z.string().min(1).max(150),
    // 255 to match the column; a longer description would be truncated by
    // Postgres rather than rejected here.
    description: z.string().max(255).optional(),
    valueType: SettingValueTypeEnum,
    defaultValue: z.string().max(100000).optional(),
    validationRules: z.string().max(2000).optional(),
    isRequired: z.coerce.boolean().default(false),
    isEncrypted: z.coerce.boolean().default(false),
    isReadonly: z.coerce.boolean().default(false),
    isVisible: z.coerce.boolean().default(true),
    autoSyncToExistingTenants: z.coerce.boolean().default(false),
    sortOrder: z.coerce.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.validationRules) {
      try {
        JSON.parse(data.validationRules);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'validationRules must be valid JSON',
          path: ['validationRules'],
        });
        return;
      }
    }
    if (data.defaultValue) {
      const error = validateValueForValueType(
        data.valueType,
        data.defaultValue,
        data.validationRules,
      );
      if (error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['defaultValue'] });
      }
    }
  });

/**
 * `settingKey` and `valueType` are absent on purpose. Businesses hold copies
 * keyed by settingKey and validated against the valueType they were created
 * with, so changing either would orphan or silently re-type every existing
 * row. Retire the definition (status INACTIVE) and add a new one instead.
 */
const UpdateSettingDefinitionSchema = z.object({
  category: z.string().min(1).max(50).optional(),
  subCategory: z.string().max(50).optional(),
  settingLabel: z.string().min(1).max(150).optional(),
  description: z.string().max(255).optional(),
  defaultValue: z.string().max(100000).optional(),
  validationRules: z.string().max(2000).optional(),
  isRequired: z.coerce.boolean().optional(),
  isEncrypted: z.coerce.boolean().optional(),
  isReadonly: z.coerce.boolean().optional(),
  isVisible: z.coerce.boolean().optional(),
  autoSyncToExistingTenants: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  status: SettingDefinitionStatusEnum.optional(),
});

export class CreateSettingDefinitionDto extends createZodDto(CreateSettingDefinitionSchema) {}
export class UpdateSettingDefinitionDto extends createZodDto(UpdateSettingDefinitionSchema) {}
