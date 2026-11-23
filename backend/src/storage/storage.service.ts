import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import * as path from 'path';
import { newId } from '../common/utils/id.util';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Which of the two storage areas a path lives in.
 *
 * `public` is LOCAL_STORAGE_DIR, which main.ts serves as static `/uploads`
 * OUTSIDE Nest's guard pipeline - that is what lets an `<img src>` work
 * without an API key, and equally what makes everything in it world-readable
 * to anyone holding the URL.
 *
 * `private` is PRIVATE_STORAGE_DIR, which is served by nothing. A file there
 * can only leave through an endpoint that checked a permission first. Member
 * ID cards carry a photo, a phone number, an address and the last four digits
 * of an Aadhaar, so they belong here and not beside the logos.
 */
export type StorageScope = 'public' | 'private';

/**
 * Driver-based storage. STORAGE_DRIVER=s3 uploads to cloud S3,
 * otherwise files land in the local public folder.
 * Only the relative PATH is returned/stored — never a full URL.
 * URL resolution is the consumer's concern (CDN, S3 signed URL, or
 * the backend's static /uploads route for local files).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 's3';
  private readonly localDir: string;
  private readonly privateDir: string;
  private s3?: S3Client;
  private bucket?: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get('STORAGE_DRIVER') === 's3' ? 's3' : 'local';
    this.localDir = this.config.get('LOCAL_STORAGE_DIR', 'public/uploads');
    this.privateDir = this.config.get('PRIVATE_STORAGE_DIR', 'storage/private');

    if (this.driver === 's3') {
      this.bucket = this.config.getOrThrow('S3_BUCKET');
      this.s3 = new S3Client({
        region: this.config.getOrThrow('S3_REGION'),
        endpoint: this.config.get('S3_ENDPOINT') || undefined,
        credentials: {
          accessKeyId: this.config.getOrThrow('S3_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow('S3_SECRET_ACCESS_KEY'),
        },
      });
    }
  }

  /**
   * The local directory a scope resolves to.
   *
   * The returned path is a prefix only - callers still join a relative path
   * onto it, and must have checked that path for traversal first.
   */
  private dirFor(scope: StorageScope): string {
    return scope === 'private' ? this.privateDir : this.localDir;
  }

  /**
   * The S3 key for a path. Private objects get their own prefix so a bucket
   * policy can keep them unreadable while public ones stay servable.
   */
  private keyFor(relativePath: string, scope: StorageScope): string {
    return scope === 'private' ? `private/${relativePath}` : relativePath;
  }

  /** Uploads a file and returns its storage path (not a URL). */
  async upload(
    file: UploadedFileLike,
    folder = 'general',
    scope: StorageScope = 'public',
  ): Promise<string> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '');
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const filename = `${newId()}${ext}`;
    const relativePath = `${safeFolder}/${filename}`;

    if (this.driver === 's3') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket!,
          Key: this.keyFor(relativePath, scope),
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      this.logger.log(`Uploaded to S3 (${scope}): ${relativePath}`);
    } else {
      const absoluteDir = path.join(process.cwd(), this.dirFor(scope), safeFolder);
      await fs.mkdir(absoluteDir, { recursive: true });
      await fs.writeFile(path.join(absoluteDir, filename), file.buffer);
      this.logger.log(`Uploaded locally (${scope}): ${relativePath}`);
    }
    return relativePath;
  }

  /**
   * Reads a stored file back.
   *
   * Needed because the ID card renderer composes logos, signatures and member
   * photos into a PDF, and those live in storage rather than in the database.
   * Returns null when the file is missing, rather than throwing: one member
   * without a photo must not fail a bulk run of several hundred cards.
   */
  async readBuffer(
    relativePath: string,
    scope: StorageScope = 'public',
  ): Promise<Buffer | null> {
    if (!this.isSafeRelativePath(relativePath)) {
      this.logger.warn(`Refused to read unsafe storage path: ${relativePath}`);
      return null;
    }
    try {
      if (this.driver === 's3') {
        const result = await this.s3!.send(
          new GetObjectCommand({
            Bucket: this.bucket!,
            Key: this.keyFor(relativePath, scope),
          }),
        );
        const bytes = await result.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      }
      return await fs.readFile(
        path.join(process.cwd(), this.dirFor(scope), relativePath),
      );
    } catch {
      return null;
    }
  }

  /** Deletes a previously stored file by its path. */
  async remove(relativePath: string, scope: StorageScope = 'public'): Promise<void> {
    if (!this.isSafeRelativePath(relativePath)) {
      this.logger.warn(`Refused to remove unsafe storage path: ${relativePath}`);
      return;
    }
    if (this.driver === 's3') {
      await this.s3!.send(
        new DeleteObjectCommand({
          Bucket: this.bucket!,
          Key: this.keyFor(relativePath, scope),
        }),
      );
    } else {
      const absolute = path.join(process.cwd(), this.dirFor(scope), relativePath);
      await fs.rm(absolute, { force: true });
    }
  }

  /**
   * A stored path is relative, forward-slashed and may not climb out.
   *
   * Checked here rather than trusted from the database, because these paths
   * now reach `readFile` and `rm`. A row holding `../../etc/passwd` would
   * otherwise be a file-read primitive, and the private area exists precisely
   * to keep some files unreadable.
   */
  private isSafeRelativePath(relativePath: string): boolean {
    if (!relativePath || relativePath.startsWith('/') || relativePath.includes('\\')) {
      return false;
    }
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(relativePath)) return false;
    return !relativePath.split('/').includes('..');
  }

  get activeDriver(): string {
    return this.driver;
  }
}
