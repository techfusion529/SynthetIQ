---
id: jev-physics
title: JEV Reflex Physics Engine
sidebar_position: 3
---

# JEV Reflex Physics Engine

The **Jev Auditor** performs sub-second thermodynamic and electrical validation of plastic recycling machinery to prevent paper-only "ghost recycling" fraud.

## Physical Laws Enforced

### 1. Specific Melt Enthalpy (Hm)
For rigid polymers (HDPE, PP, PET):

```text
E_theoretical = m * [cp * (T_melt - T_ambient) + Delta_H_fusion] * (1 / eta_thermal)
```

If an extruder claims to have melted 250 metric tons of plastic, but the electrical sub-meter reflects insufficient kWh:

```text
Delta_mass = |E_metered - E_expected| / E_expected > 0.05 => FRAUD EXCEPTION
```

### 2. Motor VFD Torque Signature
- Genuine polymer pellets in the extruder screw produce continuous viscous shear torque (400 to 500 Nm).
- An empty running motor idling produces only windage & friction torque (< 80 Nm).

### 3. Power Factor Inductive Signature
- An active induction motor under polymer shear load operates at Power Factor between 0.85 and 0.92.
- Idling motors exhibit low, heavily inductive power factors (< 0.40).
