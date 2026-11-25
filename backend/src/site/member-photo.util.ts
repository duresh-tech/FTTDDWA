/**
 * What a public applicant is allowed to upload as their photo.
 *
 * This is the only route in the system that takes a file from somebody who has
 * not authenticated, so it is deliberately narrower than the staff uploader:
 * three image types, verified by their CONTENT, and a cap a third of the staff
 * one.
 */

/** 2 MB. A passport photo needs nowhere near this; a file host would. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** The folder public applicants' photos land in. */
export const APPLICANT_PHOTO_FOLDER = 'member-photos';

/**
 * Sniffs the real type from the leading bytes.
 *
 * The declared `mimetype` comes from the uploader and is worth nothing: it is
 * a header the client writes. A `.jpg` that is really an HTML document is the
 * classic way a lenient image upload becomes stored XSS, so the bytes decide
 * and the header is ignored.
 *
 * Returns null when the content is not one of the three allowed images.
 */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 'P' 'N' 'G' 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => buffer[index] === byte)) {
    return 'image/png';
  }

  // WebP: 'RIFF' ....  'WEBP'
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Whether a path looks like one THIS endpoint issued.
 *
 * `passportPhotoPath` arrives from the public form as a plain string, so
 * without this an applicant could submit any storage path they could guess -
 * another member's photo, or anything else under the uploads tree - and have
 * it copied onto their own record at approval. Checking the shape confines
 * them to files this route created.
 */
export function isApplicantPhotoPath(path: string): boolean {
  return new RegExp(
    `^${APPLICANT_PHOTO_FOLDER}/[0-9a-fA-F-]{36}\\.(jpg|jpeg|png|webp)$`,
  ).test(path);
}
