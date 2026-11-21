import { SetMetadata } from '@nestjs/common';

export const SKIP_API_KEY_KEY = 'skipApiKey';

/**
 * Exempts a route from the globally required API key.
 *
 * NOT the same axis as `@Public()`, which skips the JWT guard. A route can
 * need one, both or neither:
 *
 *   @Public()                    session not required, API key still is
 *   @SkipApiKey()                API key not required, session still is
 *   @Public() @SkipApiKey()      neither - reachable by anything
 *
 * Confusing the two either locks the console out or opens every route, so
 * each use below states why it cannot present a key.
 */
export const SkipApiKey = () => SetMetadata(SKIP_API_KEY_KEY, true);
