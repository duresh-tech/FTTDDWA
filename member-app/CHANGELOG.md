# Changelog

All notable changes to the member app are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Its own version stream: the backend and the console do not move in lockstep
with each other, and this app moves with neither.

## [Unreleased]

### Added

- **The position is chosen for the applicant** when the association sets
  `memberRegister.positionId`. The server already narrows the list to that one
  row, so step 3 would otherwise make someone open a one-item picker to satisfy
  a field they were never given a decision about. Falls back to auto-selecting
  whenever exactly one position is offered, so it behaves the same way for an
  association that simply has one.
- `PublicSite.fixedPositionId`, matching the new field on
  `GET public/member/site`.

## [1.0.0] - 2026-11-25

First release. A native client for the member portal, covering the same three
things the web portal does: sign in, apply for membership, and see your own
record and card.

### Added

- **Login** with a membership number and password, the same identity the web
  portal uses. Server messages are shown verbatim — "This membership is
  suspended. Please contact the association." is already written for the person
  reading it, and mapping status codes to copy of our own would only lose that.

- **A four-step application**: identity, contact and sign-in, association, and
  location. It collects everything `tenant_member_applications` holds, because
  that is the point of the table — the applicant supplies their details once
  and approval is a copy rather than a second interview.
  - All six lookup lists arrive in one `options` call and cascade in memory, so
    changing a state does not cost a round trip.
  - The **RTO cascades off the DISTRICT**, not the taluk above it, and the
    payload's parent key for it is `tenantDistrictId` where every other list
    uses the short form. Reading the wrong key yields an empty picker and no
    error at all, so there is a test pinning it.
  - Submitting creates an APPLICATION, never a member. The screen says the
    membership number is issued on approval, so it cannot be mistaken for a
    welcome.

- **A profile screen** showing the member's own record in both scripts, with a
  card panel: issue number, expiry, an expired warning, and a PDF download.
  Nothing on it is editable, because no endpoint exists for a member to edit
  their own record.

- **A splash screen** that restores a stored session and fetches the
  association's branding, then leaves. It asks for nothing — everything it
  needs is in `.env`.

### How it knows which association it serves

The API resolves the business from the **hostname** and accepts no business id
in any request body. An app has no hostname, which looks like a dead end.

It is not, because `SiteService.hostOf` reads `Origin` before
`X-Forwarded-Host` before `Host`. The app sends
`Origin: https://<APP_ASSOCIATION_HOST>` and resolution works unchanged, with
no backend change and the business still never coming from a body field.

Consequences worth stating:

- **One build serves one association.** `flutter_dotenv` bundles `.env` as an
  asset, so its values are build-time. There is deliberately no public endpoint
  listing associations, so a picker is not possible — claiming a hostname is a
  trust boundary.
- **Android and iOS only.** In a browser `Origin` is set by the browser and
  cannot be overridden, so a web build could only ever address the association
  serving it.

### Deliberate omissions

- **No passport photo on registration.** `system/uploads` and `tenant/uploads`
  are both behind staff guards and there is no public upload route, so
  `passportPhotoPath` is left unset and staff attach one at approval. Adding a
  public upload endpoint is a backend decision and a new attack surface.
- **No password change**, though `POST member/auth/password` exists.
- **No state-management package and no form library**, matching the console's
  house style: one `ChangeNotifier` for the session, and plain `setState` with
  one state object and a `saving` flag per screen.

### Notes

- The refresh token is held in the platform keystore via
  `flutter_secure_storage`, not `SharedPreferences`: it is a bearer credential
  good for seven days.
- Refresh **rotates** — the presented token is revoked as the new one is issued
  — so the client replaces what it stored, and the HTTP client refreshes at
  most once per request to avoid a second attempt presenting a token the first
  just revoked.
- The splash never blocks on the network: the branding fetch runs under a 3s
  timeout and the app proceeds without it, because a member can still sign in
  when a logo cannot be loaded.
- `csrfToken` from the login response is discarded. The CSRF guards are not
  global — they sit on four staff handlers — and member routes set no cookies.
- `INTERNET` is declared in the **main** Android manifest, not only the debug
  one Flutter generates. An app that is nothing but API calls would otherwise
  ship with no network access and nothing in development would reveal it.
- Cleartext HTTP is permitted only by a **debug-only** network security config
  naming `10.0.2.2`, `localhost` and `127.0.0.1`. A blanket
  `usesCleartextTraffic` would also permit cleartext to real hosts.
- Tamil renders through `NotoSans` with `NotoSansTamil` as a **fallback**, the
  same pair the backend uses to print a card. Tamil cannot be the primary
  family: `NotoSansTamil` has no Latin glyphs, so a membership number like
  `TN72001` would render as boxes.

[1.0.0]: ../../releases/tag/member-app-v1.0.0
