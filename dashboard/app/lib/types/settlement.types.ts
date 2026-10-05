/** Settlement, escrow PO, and Form-1 types. */

export interface EscrowPO {
  po_number: string;
  company_id: string;
  recycler_id: string;
  recycler_name?: string;
  category: string;
  plastic_tons: number;
  total_amount_inr: number;
  advance_amount_inr: number;
  retention_amount_inr: number;
  status: string;
  escrow_account?: string;
  audit_id?: string;
  sap_purchase_order_number?: string;
  sap_sync_status?: string;
}

export interface ScadaVfdVerification {
  viscous_torque_nm: number;
  motor_power_factor: number;
  thermodynamic_enthalpy_kwh_kg: number;
  system1_reflex_status: string;
}

export interface DigitalSignature {
  algorithm: string;
  signer_dn: string;
  certificate_serial: string;
  signature_value: string;
  timestamp: string;
}

export interface CpcbPortalSubmission {
  portal_status: string;
  portal_acknowledgment_number: string;
  submitted_at: string;
}

export interface Form1Payload {
  form_id: string;
  company_id: string;
  legal_entity_name: string;
  gstin: string;
  fiscal_year: string;
  recycler_id: string;
  recycler_name: string;
  plant_id: string;
  plastic_category: string;
  physical_melt_verified_tons: number;
  conversion_factor_cf: number;
  credited_compliance_tons: number;
  sap_purchase_order_number: string;
  audit_hash_sha256: string;
  scada_vfd_verification: ScadaVfdVerification;
  statutory_declaration: string;
  digital_signature: DigitalSignature;
  cpcb_portal_submission: CpcbPortalSubmission;
  portal_status?: string;
  portal_ack_number?: string;
  dsc_signature?: string;
}

export interface ApproveEscrowParams {
  audit_id: string;
  workflow_id?: string;
  action?: "APPROVE" | "REJECT";
}

export interface FormOne extends Omit<Form1Payload, 'legal_entity_name' | 'fiscal_year' | 'plastic_category' | 'physical_melt_verified_tons' | 'conversion_factor_cf' | 'credited_compliance_tons' | 'sap_purchase_order_number' | 'audit_hash_sha256' | 'scada_vfd_verification' | 'statutory_declaration' | 'digital_signature' | 'cpcb_portal_submission'> {
  form_id: string;
  company_id: string;
  auction_id?: string;
  category: string;
  plastic_tons?: number;
  cpcb_ack_number?: string;
  txn_hash?: string;
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  created_at: string;
  updated_at?: string;
}
