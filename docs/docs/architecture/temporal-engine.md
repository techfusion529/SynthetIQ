---
id: temporal-engine
title: Temporal Workflow Engine
sidebar_position: 2
---

# Temporal Workflow Engine

SynthetIQ leverages **Temporal.io** for distributed, resilient execution of EPR compliance workflows.

## Registered Workflows

1. **`MasterEPRComplianceWorkflow`**: End-to-end master coordinator that chains liability audit, fraud detection, auction matching, and dispatch.
2. **`QuadCoreAuditWorkflow`**: Orchestrates 4 parallel audit activities (Document Verification, Physical SCADA Audit, Geo-Spatial Check, Financial Audit).
3. **`UpstreamLiabilityWorkflow`**: Calculates quarterly plastic packaging EPR obligation across Category I, II, III, and IV polymers.
4. **`AuctionLiquidityWorkflow`**: Runs continuous double auction matching buyers and sellers within the 30%–100% price corridor.
5. **`SettlementDispatchWorkflow`**: Executes the 80/20 escrow settlement upon CPCB Form-1 filing approval.

## Saga Pattern & Compensating Transactions

When an activity fails or an audit exception is flagged:
- In-flight escrow holds are rolled back via `synthetiq_saga_compensation_total`.
- Temporal durable timers pause execution for up to 72 hours awaiting a Human-in-the-Loop (HITL) approval signal.
