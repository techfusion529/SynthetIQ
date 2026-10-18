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
          label: 'Documentation',
        },
        {
          to: '/observability/dashboards',
          label: 'Grafana & OTel',
          position: 'left',
        },
        {
          to: '/architecture/overview',
          label: 'Architecture',
          position: 'left',
        },
        {
          to: '/deployment/kubernetes-helm',
          label: 'Deployment',
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
          title: 'Platform',
          items: [
            {
              label: 'Overview & Architecture',
              to: '/architecture/overview',
            },
            {
              label: 'Multi-Agent System',
              to: '/agents/overview',
            },
            {
              label: 'JEV Reflex Physics',
              to: '/architecture/jev-physics',
            },
          ],
        },
        {
          title: 'Observability & Monitoring',
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
              label: 'Prometheus Metrics',
              to: '/observability/prometheus',
            },
          ],
        },
        {
          title: 'Operations',
          items: [
            {
              label: 'Kubernetes & Helm Guide',
              to: '/deployment/kubernetes-helm',
            },
            {
              label: 'Docker Compose Stack',
              to: '/deployment/docker-compose',
            },
            {
              label: 'API Reference',
              to: '/api-reference/rest-api',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} SynthetIQ — TechFusion. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'python', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
