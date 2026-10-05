"use client";

import { useMemo } from "react";
import { useSession } from "../contexts/SessionContext";
import { ComplianceService } from "../services/compliance.service";
import { LiabilityService } from "../services/liability.service";
import { AuctionService } from "../services/auction.service";
import { AuditService } from "../services/audit.service";
import { SettlementService } from "../services/settlement.service";
import { CompanyService } from "../services/company.service";
import { OrganizationService } from "../services/organization.service";
import { ScheduleService } from "../services/schedule.service";
import { ConfigService } from "../services/config.service";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Returns all nine service instances bound to the current auth token. */
export function useServices() {
  const { token } = useSession();
  return useMemo(
    () => ({
      compliance:   new ComplianceService(BASE_URL, token),
      liability:    new LiabilityService(BASE_URL, token),
      auction:      new AuctionService(BASE_URL, token),
      audit:        new AuditService(BASE_URL, token),
      settlement:   new SettlementService(BASE_URL, token),
      company:      new CompanyService(BASE_URL, token),
      organization: new OrganizationService(BASE_URL, token),
      schedule:     new ScheduleService(BASE_URL, token),
      config:       new ConfigService(BASE_URL, token),
    }),
    [token]
  );
}

export function useComplianceService()   { return useServices().compliance; }
export function useLiabilityService()    { return useServices().liability; }
export function useAuctionService()      { return useServices().auction; }
export function useAuditService()        { return useServices().audit; }
export function useSettlementService()   { return useServices().settlement; }
export function useCompanyService()      { return useServices().company; }
export function useOrganizationService() { return useServices().organization; }
export function useScheduleService()     { return useServices().schedule; }
export function useConfigService()       { return useServices().config; }
