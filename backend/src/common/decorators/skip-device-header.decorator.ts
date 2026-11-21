import { SetMetadata } from '@nestjs/common';

export const SKIP_DEVICE_HEADER_KEY = 'skipDeviceHeader';

/**
 * Exempts a route from the globally required `x-device-type` header.
 *
 * Use this only where the caller genuinely cannot send the header. There is
 * exactly one such case today: Caddy's on-demand TLS check
 * (`on_demand_tls { ask ... }`) issues a bare GET with no header
 * configuration, so without this it would receive a 400, Caddy would read any
 * non-2xx as "deny the certificate", and the only symptom in a browser would
 * be ERR_SSL_PROTOCOL_ERROR.
 *
 * Put it on the HANDLER, never on a controller class - a sibling route that a
 * normal client calls must keep the header requirement.
 */
export const SkipDeviceHeader = () => SetMetadata(SKIP_DEVICE_HEADER_KEY, true);
