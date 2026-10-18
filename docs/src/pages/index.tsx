import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)} style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #090d16 100%)',
      padding: '64px 0',
      textAlign: 'center'
    }}>
      <div className="container">
        <Heading as="h1" className="hero__title" style={{ fontSize: '3rem', fontWeight: 800, color: '#f8fafc' }}>
          SynthetIQ Documentation Portal
        </Heading>
        <p className="hero__subtitle" style={{ color: '#94a3b8', fontSize: '1.25rem', maxWidth: '800px', margin: '16px auto 32px' }}>
          Autonomous EPR Compliance, Multi-Agent Anti-Fraud Engine & Full-Stack OpenTelemetry Observability.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            className="button button--primary button--lg"
            to="/intro"
            style={{ borderRadius: '8px', fontWeight: 600 }}>
            Get Started 🚀
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/observability/dashboards"
            style={{ borderRadius: '8px', fontWeight: 600 }}>
            Grafana Pod Dashboards 📊
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/architecture/overview"
            style={{ borderRadius: '8px', fontWeight: 600 }}>
            System Architecture 🏛️
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="SynthetIQ Documentation Portal"
      description="Autonomous EPR Compliance & Multi-Agent Anti-Fraud Engine Documentation">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
