---
id: quad-core-audit
title: Quad-Core Anti-Fraud Audit
sidebar_position: 2
---

# Quad-Core Anti-Fraud Audit Workflow

The **Quad-Core Audit** cross-examines EPR recycling claims across four orthogonal dimensions to make fraud mathematically impossible.

```
                  +--------------------------------+
                  |  Recycler Audit Claim (250T)   |
                  +---------------+----------------+
                                  |
         +------------------------+------------------------+
         |                        |                        |
         v                        v                        v
+-----------------+      +-----------------+      +-----------------+
|  Core 1: JEV    |      |  Core 2: GST/   |      |  Core 3: Geo-   |
|  SCADA Physics  |      |  Invoice Audit  |      |  Spatial Foot-  |
|  (Torque & kWh) |      |  (E-Way & Bank) |      |  print (Area)   |
+--------+--------+      +--------+--------+      +--------+--------+
         |                        |                        |
         +------------------------+------------------------+
                                  |
                                  v
                  +--------------------------------+
                  |  Core 4: Cross-Check Synthesis |
                  |  - Anomaly Score < 0.05: PASS  |
                  |  - Anomaly Score >= 0.05: HITL |
                  +--------------------------------+
```

## Exception Routing & HITL Signals

When the mass balance discrepancy exceeds 5% or the motor drive shows idle running during recycling logs:
1. Verdict transitions to `REQUIRES_HUMAN_OVERRIDE`.
2. The Temporal workflow emits an alert to the `/api/v1/audit/exceptions` endpoint.
3. The compliance officer reviews the VFD curves in the Executive Dashboard and posts an approval signal with reason code and override tonnage.
