---
layout: home

hero:
  name: FTTDDWA
  text: Federation of Tamilnadu Tent Dealers & Decorators Welfare Association
  tagline: System console and tenant portal - a multi-tenant administration backend on NestJS, Prisma and PostgreSQL, with RBAC-driven admin CRUD and a parallel tenant portal, all in Docker.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Run it in Docker
      link: /guide/docker
    - theme: alt
      text: How it works
      link: /logic/auth

features:
  - title: Two audiences, one API
    details: System staff and tenant operators sign in on their own paths, with their own JWT audience, refresh-token table and cookie names - so two sessions coexist in one browser and neither can pass for the other.
    link: /logic/auth
  - title: Permissions, not role checks
    details: 144 permission keys across 30 modules, resolved from the database on every request. There is no super-admin bypass anywhere, so SYSTEM_SUPER_ADMIN holds every grant for real.
    link: /logic/rbac-permissions
  - title: Configured in the browser
    details: A fresh database has no accounts and no default password. The first-run wizard creates the administrator, the role and the branding in one transaction, then closes itself permanently.
    link: /guide/setup-wizard
  - title: One command, one .env per app
    details: Per-service compose stacks with their own lifecycles - the database never restarts because the API rebuilt. Hardened containers, non-root, read-only root filesystems.
    link: /guide/docker
---
