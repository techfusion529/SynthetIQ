import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Overview',
    },
    {
      type: 'doc',
      id: 'problem-statement',
      label: 'Problem Statement',
    },
    {
      type: 'doc',
      id: 'proposed-solution',
      label: 'Proposed Solution',
    },
    {
      type: 'doc',
      id: 'working',
      label: 'How It Works (Workflow)',
    },
    {
      type: 'doc',
      id: 'google-cloud-stack',
      label: 'Google Cloud & Gemini Stack',
    },
    {
      type: 'category',
      label: 'System Architecture',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/temporal-engine',
        'architecture/jev-physics',
      ],
    },
    {
      type: 'category',
      label: 'Autonomous Agent Fleet',
      collapsed: false,
      items: [
        'agents/overview',
        'agents/quad-core-audit',
      ],
    },
    {
      type: 'category',
      label: 'Observability & Metrics',
      collapsed: false,
      items: [
        'observability/overview',
        'observability/dashboards',
        'observability/opentelemetry',
      ],
    },
    {
      type: 'category',
      label: 'API & Gateway Catalog',
      collapsed: true,
      items: [
        'api-reference/rest-api',
        'api-reference/mcp-tools',
      ],
    },
  ],
};

export default sidebars;
