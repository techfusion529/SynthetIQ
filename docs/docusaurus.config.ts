import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'SynthetIQ Documentation',
  tagline: 'Autonomous EPR Compliance, Multi-Agent Anti-Fraud Engine & Observability Platform',
  favicon: 'img/favicon.ico',

  url: 'https://synthetiq.ddns.net',
  baseUrl: process.env.DOCUSAURUS_BASE_URL || '/docs/',

  organizationName: 'techfusion529',
  projectName: 'SynthetIQ',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/techfusion529/SynthetIQ/tree/dev/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo.svg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'SynthetIQ Portal',
      logo: {
        alt: 'SynthetIQ Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs Home',
        },
        {
          to: '/problem-statement',
          label: 'Problem Statement',
          position: 'left',
        },
        {
          to: '/proposed-solution',
          label: 'Proposed Solution',
          position: 'left',
        },
        {
          to: '/working',
          label: 'How It Works',
          position: 'left',
        },
        {
          to: '/google-cloud-stack',
          label: 'Google Cloud & Gemini',
          position: 'left',
        },
        {
          to: '/architecture/overview',
          label: 'Architecture',
          position: 'left',
        },
        {
          to: '/observability/dashboards',
          label: 'Grafana & OTel',
          position: 'left',
        },
        {
          href: 'https://github.com/techfusion529/SynthetIQ',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Core Journey',
          items: [
            {
              label: 'Problem Statement',
              to: '/problem-statement',
            },
            {
              label: 'Proposed Solution',
              to: '/proposed-solution',
            },
            {
              label: 'How It Works (Workflow)',
              to: '/working',
            },
            {
              label: 'Google Cloud & Gemini Stack',
              to: '/google-cloud-stack',
            },
          ],
        },
        {
          title: 'System & Architecture',
          items: [
            {
              label: 'System Architecture',
              to: '/architecture/overview',
            },
            {
              label: 'Multi-Agent Fleet',
              to: '/agents/overview',
            },
            {
              label: 'JEV Reflex Physics',
              to: '/architecture/jev-physics',
            },
            {
              label: 'Temporal Sagas',
              to: '/architecture/temporal-engine',
            },
          ],
        },
        {
          title: 'Observability & Live Platform',
          items: [
            {
              label: 'Grafana Pod Dashboards',
              to: '/observability/dashboards',
            },
            {
              label: 'OpenTelemetry (OTel)',
              to: '/observability/opentelemetry',
            },
            {
              label: 'Live Dashboard',
              href: 'https://synthetiq.ddns.net',
            },
            {
              label: 'Temporal Engine',
              href: 'https://synthetiq.ddns.net/temporal/',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} SynthetIQ — Team Techfusion (Sayantika Bose & Sai Sudhane G) for Google Cloud AI Builder Hackathon.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'python', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
