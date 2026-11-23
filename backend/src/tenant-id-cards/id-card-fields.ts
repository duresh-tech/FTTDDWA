/**
 * The catalogue of values an ID card template may bind to, in one place.
 *
 * This is to a card template what `permissions.ts` is to permissions and
 * `setting-definitions.ts` is to settings: the declared truth, owned by the
 * server. A template stores a TOKEN - `member.memberNameTamil` - and never a
 * value, so one design renders every member.
 *
 * The designer fetches this list rather than hardcoding one, exactly as the
 * settings screen fetches `ref` options rather than knowing which table a ref
 * names. Adding a field is a one-file change that both sides pick up.
 *
 * `sample` exists because a layout has to be judged at realistic width. A
 * Tamil name is wider than `{{memberName}}`, and a designer that previews the
 * token instead of a value produces cards that overflow on the first print
 * run.
 */
export type IdCardFieldKind = 'text' | 'image' | 'qr';

export interface IdCardField {
  /** What the template stores. For `association.*` this IS the setting key. */
  token: string;
  label: string;
  /** Groups the palette. Free text; the designer groups by whatever arrives. */
  group: string;
  kind: IdCardFieldKind;
  /** Shown in the designer in place of the real value. */
  sample: string;
}

export const ID_CARD_FIELDS: IdCardField[] = [
  // ---- Member ----
  { token: 'member.systemCode', label: 'Member code', group: 'Member', kind: 'text', sample: 'MEM-MR8NZ6OO-0-C0CB' },
  { token: 'member.memberName', label: 'Name', group: 'Member', kind: 'text', sample: 'Ramesh Kumar' },
  { token: 'member.memberNameTamil', label: 'Name (Tamil)', group: 'Member', kind: 'text', sample: 'ரமேஷ் குமார்' },
  { token: 'member.businessName', label: 'Business name', group: 'Member', kind: 'text', sample: 'Kumar Tents & Decorators' },
  { token: 'member.businessNameTamil', label: 'Business name (Tamil)', group: 'Member', kind: 'text', sample: 'குமார் கூடாரம் & அலங்காரம்' },
  { token: 'member.positionName', label: 'Position', group: 'Member', kind: 'text', sample: 'Secretary' },
  { token: 'member.positionNameTamil', label: 'Position (Tamil)', group: 'Member', kind: 'text', sample: 'செயலாளர்' },
  { token: 'member.industryName', label: 'Industry', group: 'Member', kind: 'text', sample: 'Tent & Decoration' },
  { token: 'member.industryNameTamil', label: 'Industry (Tamil)', group: 'Member', kind: 'text', sample: 'கூடாரம் & அலங்காரம்' },
  { token: 'member.phoneNumber', label: 'Phone', group: 'Member', kind: 'text', sample: '+91-9876543210' },
  { token: 'member.whatsappNumber', label: 'WhatsApp', group: 'Member', kind: 'text', sample: '+91-9876543210' },
  { token: 'member.email', label: 'Email', group: 'Member', kind: 'text', sample: 'ramesh@example.com' },
  { token: 'member.dateOfBirth', label: 'Date of birth', group: 'Member', kind: 'text', sample: '1984-07-19' },
  // The last four digits only. The register never returns the full number and
  // a printed card is not the place to make an exception.
  { token: 'member.aadhaarLast4', label: 'Aadhaar (last 4)', group: 'Member', kind: 'text', sample: '9012' },
  { token: 'member.status', label: 'Membership status', group: 'Member', kind: 'text', sample: 'ACTIVE' },
  { token: 'member.photo', label: 'Passport photo', group: 'Member', kind: 'image', sample: '' },
  { token: 'member.qr', label: 'QR (member code)', group: 'Member', kind: 'qr', sample: 'MEM-MR8NZ6OO-0-C0CB' },

  // ---- Member address ----
  { token: 'member.addressLine1', label: 'Address line 1', group: 'Member address', kind: 'text', sample: '12 Bazaar Street' },
  { token: 'member.addressLine2', label: 'Address line 2', group: 'Member address', kind: 'text', sample: '' },
  { token: 'member.talukName', label: 'Taluk', group: 'Member address', kind: 'text', sample: 'Pollachi' },
  { token: 'member.talukNameTamil', label: 'Taluk (Tamil)', group: 'Member address', kind: 'text', sample: 'பொள்ளாச்சி' },
  { token: 'member.districtName', label: 'District', group: 'Member address', kind: 'text', sample: 'Coimbatore' },
  { token: 'member.districtNameTamil', label: 'District (Tamil)', group: 'Member address', kind: 'text', sample: 'கோயம்புத்தூர்' },
  { token: 'member.stateName', label: 'State', group: 'Member address', kind: 'text', sample: 'Tamil Nadu' },
  { token: 'member.stateNameTamil', label: 'State (Tamil)', group: 'Member address', kind: 'text', sample: 'தமிழ்நாடு' },

  // ---- Association ----
  // For this group the token IS the settingKey, so resolution is a lookup in
  // the settings map and nothing has to be kept in step by hand.
  { token: 'association.name', label: 'Association name', group: 'Association', kind: 'text', sample: 'FEDERATION OF TAMILNADU TENT DEALERS & DECORATORS WELFARE ASSOCIATION' },
  { token: 'association.nameTamil', label: 'Association name (Tamil)', group: 'Association', kind: 'text', sample: 'தமிழ்நாடு கூடாரம் அலங்கார நலச்சங்கம்' },
  { token: 'association.shortName', label: 'Short name', group: 'Association', kind: 'text', sample: 'FTTDDWA' },
  { token: 'association.shortNameTamil', label: 'Short name (Tamil)', group: 'Association', kind: 'text', sample: 'ஃப.த.கூ.அ.ந.ச' },
  { token: 'association.registrationNumber', label: 'Registration number', group: 'Association', kind: 'text', sample: '123/2019' },
  { token: 'association.tagline', label: 'Tagline', group: 'Association', kind: 'text', sample: 'Serving the trade since 1998' },
  { token: 'association.taglineTamil', label: 'Tagline (Tamil)', group: 'Association', kind: 'text', sample: 'வணிகத்திற்கு சேவை' },
  { token: 'association.email', label: 'Association email', group: 'Association', kind: 'text', sample: 'office@example.org' },
  { token: 'association.phoneNumber', label: 'Association phone', group: 'Association', kind: 'text', sample: '+91-4222-000000' },
  { token: 'association.whatsappNumber', label: 'Association WhatsApp', group: 'Association', kind: 'text', sample: '+91-9876500000' },
  { token: 'association.officeAddress', label: 'Office address', group: 'Association', kind: 'text', sample: '45 Gandhipuram, Coimbatore' },
  { token: 'association.officeAddressTamil', label: 'Office address (Tamil)', group: 'Association', kind: 'text', sample: '45 காந்திபுரம், கோயம்புத்தூர்' },
  { token: 'association.pincode', label: 'Pincode', group: 'Association', kind: 'text', sample: '641001' },
  { token: 'association.logo1Path', label: 'Logo 1', group: 'Association', kind: 'image', sample: '' },
  { token: 'association.logo2Path', label: 'Logo 2', group: 'Association', kind: 'image', sample: '' },
  { token: 'association.logo3Path', label: 'Logo 3', group: 'Association', kind: 'image', sample: '' },
  { token: 'association.logo4Path', label: 'Logo 4', group: 'Association', kind: 'image', sample: '' },

  // ---- Signatures ----
  { token: 'association.signature.chairmanPath', label: "Chairman's signature", group: 'Signatures', kind: 'image', sample: '' },
  { token: 'association.signature.presidentPath', label: "President's signature", group: 'Signatures', kind: 'image', sample: '' },
  { token: 'association.signature.vicePresidentPath', label: "Vice President's signature", group: 'Signatures', kind: 'image', sample: '' },
  { token: 'association.signature.secretaryPath', label: "Secretary's signature", group: 'Signatures', kind: 'image', sample: '' },
  { token: 'association.signature.jointSecretaryPath', label: "Joint Secretary's signature", group: 'Signatures', kind: 'image', sample: '' },
  { token: 'association.signature.treasurerPath', label: "Treasurer's signature", group: 'Signatures', kind: 'image', sample: '' },

  // ---- System ----
  { token: 'system.generatedOn', label: 'Generated on', group: 'System', kind: 'text', sample: '2026-11-23' },
];

/** Every declared token, for quick membership checks. */
export const ID_CARD_TOKENS = new Set(ID_CARD_FIELDS.map((f) => f.token));

/**
 * What a card needs to know about one member.
 *
 * Structural rather than a Prisma type, so the resolver does not drag the
 * generated client into the designer's type surface and so the relation names
 * are stated once, here.
 */
export interface IdCardMember {
  systemCode: string;
  memberName: string;
  memberNameTamil: string | null;
  businessName: string;
  businessNameTamil: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  email: string | null;
  dateOfBirth: string;
  aadhaarLast4: string;
  addressLine1: string;
  addressLine2: string | null;
  passportPhotoPath: string | null;
  status: string;
  associationPosition: { positionName: string; positionNameTamil: string | null } | null;
  industry: { industryName: string; industryNameTamil: string | null } | null;
  state: { stateName: string; stateNameTamil: string | null } | null;
  district: { districtName: string; districtNameTamil: string | null } | null;
  taluk: { talukName: string; talukNameTamil: string | null } | null;
}

export interface IdCardContext {
  member: IdCardMember;
  /** From getSettingsMapForBusiness(); keys are settingKeys. */
  settings: Record<string, string>;
  /** YYYY-MM-DD, in the business's own terms rather than the server's. */
  generatedOn: string;
}

/**
 * Turns one token into its value, or '' when there is nothing to show.
 *
 * **An unknown token resolves to '' and never throws, and never prints the
 * token itself.** A template outlives the catalogue: removing a field here
 * must not 500 every card generated from a layout that still mentions it, and
 * printing `member.oldField` on a member's card would be worse than printing
 * nothing.
 */
export function resolveToken(token: string, ctx: IdCardContext): string {
  const { member, settings } = ctx;

  if (token.startsWith('association.')) {
    // The token is the settingKey, so there is no second mapping to keep in
    // step. A setting the business has not filled in is simply absent.
    return settings[token] ?? '';
  }

  switch (token) {
    case 'member.systemCode':
    case 'member.qr':
      return member.systemCode;
    case 'member.memberName':
      return member.memberName;
    case 'member.memberNameTamil':
      return member.memberNameTamil ?? '';
    case 'member.businessName':
      return member.businessName;
    case 'member.businessNameTamil':
      return member.businessNameTamil ?? '';
    case 'member.positionName':
      return member.associationPosition?.positionName ?? '';
    case 'member.positionNameTamil':
      return member.associationPosition?.positionNameTamil ?? '';
    case 'member.industryName':
      return member.industry?.industryName ?? '';
    case 'member.industryNameTamil':
      return member.industry?.industryNameTamil ?? '';
    case 'member.phoneNumber':
      return member.phoneNumber ?? '';
    case 'member.whatsappNumber':
      return member.whatsappNumber ?? '';
    case 'member.email':
      return member.email ?? '';
    case 'member.dateOfBirth':
      return member.dateOfBirth;
    case 'member.aadhaarLast4':
      return member.aadhaarLast4;
    case 'member.status':
      return member.status;
    case 'member.photo':
      return member.passportPhotoPath ?? '';
    case 'member.addressLine1':
      return member.addressLine1;
    case 'member.addressLine2':
      return member.addressLine2 ?? '';
    case 'member.talukName':
      return member.taluk?.talukName ?? '';
    case 'member.talukNameTamil':
      return member.taluk?.talukNameTamil ?? '';
    case 'member.districtName':
      return member.district?.districtName ?? '';
    case 'member.districtNameTamil':
      return member.district?.districtNameTamil ?? '';
    case 'member.stateName':
      return member.state?.stateName ?? '';
    case 'member.stateNameTamil':
      return member.state?.stateNameTamil ?? '';
    case 'system.generatedOn':
      return ctx.generatedOn;
    default:
      return '';
  }
}
