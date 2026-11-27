# member-app

The FTTDDWA member app: sign in, apply for membership, and hold your ID card.
Flutter, Android and iOS.

A second client for the member portal that shipped in the console — same
endpoints, no backend changes. The full client contract is in
[`docs/guide/mobile-clients.md`](../docs/guide/mobile-clients.md); this file is
just how to run it.

## Screens

| | |
| --- | --- |
| **Splash** | Brand, restores a stored session, routes. Asks for nothing |
| **Login** | Membership number + password |
| **Register** | The full application, over four steps, photo included |
| **Profile** | Your record, and your card with a PDF download |

## Running it

```bash
cp .env.example .env        # then edit it -- see below
flutter pub get
flutter run
```

### Configuration

Everything is in `.env`, which is **gitignored** because it holds a real API
key. `.env.example` documents each value.

```bash
APP_API_URL=https://acme.example.com/api/v1
APP_ASSOCIATION_HOST=acme.example.com
APP_API_KEY=fttddwa_...
APP_NAME=FTTDDWA
```

::: warning These are BUILD-time values
`flutter_dotenv` bundles `.env` into the binary as an asset, so changing one is
a rebuild, not a restart — unlike `console/.env`, which a running server
re-reads. **One build serves one association.**
:::

`APP_ASSOCIATION_HOST` is the important one. The API works out which
association a request belongs to from the hostname and accepts no business id
in any request body, so the app sends this as the `Origin` header. It must
match a `tenant_business_domains.hostname` row exactly — add the domain under
the business in the console first. Get it wrong and every login and
registration answers `404 This address does not serve a member portal`.

`APP_API_KEY` comes from the console, under **API Keys**. Issue the app its
own; do not reuse the console's, or revoking one locks out the other.

### Local development

```bash
APP_API_URL=http://10.0.2.2:3000/api/v1
APP_ASSOCIATION_HOST=acme.localhost
```

`10.0.2.2` is the host machine as seen from an Android emulator — `localhost`
there is the emulator itself. An iOS simulator shares the host's network, so
`localhost` works. `acme.localhost` never has to resolve as DNS; it is only
ever a header value, which is what lets this work at all.

The local stack needs a business domain row and registration enabled:

```bash
docker compose up -d
# then, in the console: add acme.localhost to the business,
# and turn on Member register under Business Settings
```

Cleartext HTTP to those addresses is permitted by a **debug-only**
`android/app/src/debug/res/xml/network_security_config.xml`. Release builds
stay HTTPS-only.

## Checks

```bash
flutter analyze
dart format --set-exit-if-changed lib test
flutter test
```

The tests are unit tests over the request body and the JSON parsing, which is
where this app can go wrong silently: a stringified `isMarried` (the server's
`z.coerce.boolean()` makes the string `"false"` truthy), an Aadhaar that is not
12 bare digits, or RTOs cascaded off `districtId` when the payload says
`tenantDistrictId`.

## Not here, on purpose

- **No profile editing.** No endpoint exists for a member to change their own
  record.
- **No web build.** A browser sets `Origin` itself and will not let the app
  override it, so a web build could only address the association serving it.

## Known toolchain issues

`flutter doctor` warns that the Android SDK path contains a space, which breaks
NDK tooling. This app has no native code, so Gradle builds fine — but that is
the cause if an NDK step ever fails, and the fix is relocating the SDK.

**Kotlin incremental compilation is off**, in
[`android/gradle.properties`](android/gradle.properties). Its cache stores
source paths relative to the project root, so a plugin compiled out of a pub
cache on `C:` has no relative path to a project on `D:`. Gradle then fails
with `Could not close incremental caches`, which names the drive problem
nowhere — the cause is three levels down in a suppressed
`this and base files have different roots`. Turning it off costs a Kotlin
recompile of the plugins per clean build and nothing on a Dart change; the
alternative is moving `PUB_CACHE` onto the project's drive, a machine-wide
change for one project.
