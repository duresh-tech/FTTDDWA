import { defineConfig } from 'vitepress';

/**
 * VitePress site config for the FTTDDWA docs.
 *
 * Run from docs/:  npm install && npm run docs:dev
 */
export default defineConfig({
  title: 'FTTDDWA',
  description:
    'Federation of Tamilnadu Tent Dealers & Decorators Welfare Association - ' +
    'system administration console and tenant portal, on NestJS, Prisma, ' +
    'PostgreSQL and Next.js, in Docker.',
  // Clean URLs (/guide/docker rather than /guide/docker.html).
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['**/node_modules/**'],
  // Narrow on purpose: every link not matched here still fails the build.
  ignoreDeadLinks: [
    // The CHANGELOGs end with GitHub-relative version links.
    /\/compare\//,
    /\/releases\/tag\//,
    // Local addresses the reader is told to open. Nothing to resolve at build time.
    /^https?:\/\/localhost/,
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'How it works', link: '/logic/auth' },
      { text: 'Changelog', link: '/changelog' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Setup wizard', link: '/guide/setup-wizard' },
            { text: 'Configuration (.env)', link: '/guide/configuration' },
            { text: 'Docker', link: '/guide/docker' },
            { text: 'Tenant domains', link: '/guide/domains' },
            { text: 'API keys', link: '/guide/api-keys' },
            { text: 'Database & migrations', link: '/guide/database' },
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'Security', link: '/guide/security' },
            { text: 'Maintaining these docs', link: '/guide/docs' },
          ],
        },
      ],
      '/logic/': [
        {
          text: 'How it works',
          items: [
            { text: 'Authentication', link: '/logic/auth' },
            { text: 'RBAC & permissions', link: '/logic/rbac-permissions' },
            { text: 'Tenants & businesses', link: '/logic/tenants-and-businesses' },
            { text: 'App settings & branding', link: '/logic/app-settings' },
            { text: 'Business settings', link: '/logic/business-settings' },
          ],
        },
      ],
    },

    outline: [2, 3],
    search: { provider: 'local' },
    editLink: false,
    docFooter: { prev: true, next: true },
  },
});
