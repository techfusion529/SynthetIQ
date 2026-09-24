# SynthetIQ — Reference Datasets

These datasets are **NOT used directly** in the application. They serve as reference
baselines to ensure our simulated SCADA telemetry has physically realistic signal
characteristics (torque ramp shapes, power factor ranges, current draw envelopes).

## Source Datasets

| Dataset | Source | Extracted Baselines |
|:---|:---|:---|
| Industrial Motor Drive Performance | Kaggle | VFD torque (Nm), current (A), speed (RPM) time-series |
| Motor Control Performance | Kaggle | Torque, flux, voltage, power (W) under PID control |
| Industrial Motor Data (8000 rows) | Kaggle | Normal vs. anomalous motor signatures |
| Smart Manufacturing IoT-Cloud | Kaggle | Temperature, vibration, pressure sensors |
| Vibration/Current/Torque/RPM | PMC Research | High-freq AC motor data with VFD |
| Open Industrial Energy Dataset | MDPI | Power factor, load profiles, kWh consumption |
| Delivery Logistics India | Kaggle | Indian city-pair logistics routes for E-Way bills |

## Download Instructions

```bash
# Requires: pip install kaggle
# Set KAGGLE_USERNAME and KAGGLE_KEY environment variables

python scripts/download_reference_data.py
```

Downloaded files will be placed in this directory and are excluded from git via `.gitignore`.
