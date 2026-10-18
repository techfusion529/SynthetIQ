import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  badge: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Autonomous Multi-Agent Fleet',
    badge: '🤖 Google ADK & Vertex AI',
    description: (
      <>
        8 specialized Google ADK agents running over Temporal.io workflows
        perform real-time statutory verification, cross-checks, and automated CPCB Form-1 generation.
      </>
    ),
  },
  {
    title: 'JEV Reflex Physics & SCADA',
    badge: '⚡ Sub-Second Verification',
    description: (
      <>
        Evaluates extruder motor VFD torque curves, electrical power factors, and thermodynamic
        melt enthalpy to mathematically eliminate phantom recycling fraud.
      </>
    ),
  },
  {
    title: 'Full-Stack Observability',
    badge: '📊 OTel, Prometheus & Grafana',
    description: (
      <>
        End-to-end distributed tracing, OpenTelemetry Collector aggregation, and 5 tailored
        Grafana dashboards monitoring pod health, workflows, and sensor telemetry.
      </>
    ),
  },
];

function Feature({title, badge, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="padding-horiz--md" style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '24px',
        height: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
          {badge}
        </div>
        <Heading as="h3">{title}</Heading>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5' }}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features} style={{ padding: '40px 0' }}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
