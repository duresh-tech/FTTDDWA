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
| **Language** | Tamil or English, asked once on a first run |
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

## Tamil and English

The app ships in both, and asks which on a first run. The choice is stored in
`SettingsStore` and changed afterwards from the toggle on the login and
profile screens.

Strings live in `lib/l10n/app_en.arb` and `app_ta.arb`. `flutter pub get`
regenerates `lib/l10n/app_localizations*.dart` from them — those are committed
but generated, so **edit the `.arb`, never the `.dart`**.

Three things are deliberately NOT translated:

- **Server messages.** Every `ApiException.message` is written by the API and
  shown as it arrives. Translating it client-side would mean keeping a copy of
  the server's vocabulary here and letting the two drift.
- **The association's own name.** It comes from the server, which already
  holds `association.nameTamil` beside `association.name` — a registered name
  is a fact about the association, not a string this app gets to translate.
  Fill the Tamil fields under Business Settings → Association in the console,
  or Tamil mode falls back to the English name.
- **`தமிழ்` on the language controls**, in either language. Somebody who
  cannot read English has to be able to find Tamil.

`flutter_localizations` also brings Flutter's own Tamil: the date picker,
text-selection menus and semantic labels, none of which is a string here.

## Branding

`assets/images/` holds the two association emblems, bundled rather than
fetched — they are the first thing on screen, and a logo that arrives late is
worse than one that needs a release to change.

The launcher icon and the native splash are **generated**:

```sh
dart run tool/make_brand_assets.dart   # WebP -> the PNGs the generators need
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

Only re-run these when the artwork changes; their output is committed. The
first step exists because neither generator reads WebP and converting one
otherwise means ImageMagick or Pillow — a native toolchain this project does
not require. `tool/make_brand_assets.dart` uses the pure-Dart `image` package.

The native splash and the Flutter splash are both white on purpose: the
handover between them happens in the first half second, and two different
backgrounds read as a flash.

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
