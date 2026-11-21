# Maintaining these docs

A [VitePress](https://vitepress.dev) site in `docs/`, with its own
`package.json` so the docs tooling never reaches the backend's or console's
dependencies or Docker images.

## Running it

```bash
cd docs
npm install
npm run docs:dev        # http://localhost:5173
npm run docs:build      # static build; fails on dead links
npm run docs:preview
```

`docs:build` is the useful check — `ignoreDeadLinks` is narrow (only the
GitHub-relative compare and tag links the CHANGELOGs end with), so any other
broken internal link fails the build.

## Layout

```
docs/
├── index.md                 home page (hero + feature cards)
├── changelog.md             includes both app CHANGELOGs
├── .vitepress/config.mts    title, nav, sidebar, search
├── guide/                   how to run and operate it
└── logic/                   how it works, and why
```

The split is deliberate:

- **`guide/`** answers "how do I run, configure or deploy this?"
- **`logic/`** answers "why does it behave this way?" — the decisions, not
  the API surface.

Neither duplicates the READMEs. `README.md` is the landing page for someone
browsing the repository; these pages are where the detail lives.

## Adding a page

1. Create the Markdown file under `guide/` or `logic/`.
2. Add it to the matching `sidebar` array in `.vitepress/config.mts` — pages
   not listed there are reachable but have no sidebar entry.
3. Link it from a related page, so it is discoverable by reading rather than
   only by searching.
4. Run `npm run docs:build` to confirm no dead links.

## House style

- **Say why, not just what.** The valuable pages here explain decisions:
  why the installer locks on a user count, why the console's config is not
  `NEXT_PUBLIC_*`, why there is no super-admin bypass. Anything that only
  restates the code goes stale and helps nobody.
- **Name the file.** Point at `src/common/bootstrap/bootstrap.ts`, not "the
  bootstrap module", so a reader can go and look.
- **Record what is absent.** "No account lockout", "no CSP", "no data
  migration path" are the things a reader most needs and can least infer.
- Use VitePress containers for things that bite: `::: warning`, `::: danger`,
  `::: tip`.
- Keep tables for key/default/notes; use prose for reasoning.

## Keeping it current

Update the docs in the **same change** as the code, not afterwards:

| If you change | Also update |
| --- | --- |
| A compose file, Dockerfile, port, volume or healthcheck | [Docker](./docker) — the stack table and the stack's own header comment |
| An env key | [Configuration](./configuration) and the matching `.env.example` |
| The permission catalogue or a role | [RBAC & permissions](/logic/rbac-permissions) |
| The setup endpoints or wizard steps | [Setup wizard](./setup-wizard) |
| The schema | [Database & migrations](./database) |
| Anything user-visible | the app's `CHANGELOG.md` |

The compose files carry long header comments on purpose — they are the first
thing someone reads when a stack misbehaves, and they are read far more often
than this site. Keep them in step with these pages.
