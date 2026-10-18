import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
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
      label: 'Observability & Monitoring',
      collapsed: false,
      items: [
        'observability/overview',
        'observability/dashboards',
        'observability/opentelemetry',
        'observability/prometheus',
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
      label: 'Deployment & Operations',
      collapsed: false,
      items: [
        'deployment/kubernetes-helm',
        'deployment/docker-compose',
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
