import type { ElementType } from "react";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import MemoryIcon from "@mui/icons-material/MemoryOutlined";
import ScaleIcon from "@mui/icons-material/BalanceOutlined";
import GavelIcon from "@mui/icons-material/GavelOutlined";
import RadarIcon from "@mui/icons-material/SensorsOutlined";
import WalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import SupervisorIcon from "@mui/icons-material/SupervisorAccountOutlined";
import StorageIcon from "@mui/icons-material/StorageOutlined";
import TuneIcon from "@mui/icons-material/TuneOutlined";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import ApiIcon from "@mui/icons-material/ApiOutlined";

export const HEADER_H = 64;
export const RAIL_W = 248;
export const RAIL_MINI = 64;

export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  roles?: string[];
  external?: boolean;
}
export interface NavGroup {
  label: string;
  roles?: string[];
  items: NavItem[];
}

const RESOLVERS = ["admin", "compliance_officer", "auditor", "platform_admin"];
const ADMINS = ["admin", "compliance_officer", "platform_admin"];

export const NAV: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { label: "Overview", href: "/", icon: DashboardIcon },
      { label: "Agent orchestration", href: "/agents", icon: MemoryIcon },
    ],
  },
  {
    label: "Compliance workflow",
    items: [
      { label: "Liability & sourcing", href: "/liability", icon: ScaleIcon },
      { label: "Double auction", href: "/auction", icon: GavelIcon },
      { label: "Quad-core audit", href: "/audit", icon: RadarIcon },
      { label: "Escrow & approval", href: "/settlement", icon: WalletIcon },
      { label: "Form-1 vault", href: "/dispatch", icon: DescriptionIcon },
    ],
  },
  {
    label: "Exceptions",
    items: [{ label: "HITL console", href: "/hitl", icon: SupervisorIcon, roles: RESOLVERS }],
  },
  {
    label: "Administration",
    roles: ADMINS,
    items: [
      { label: "Data sources", href: "/datasources", icon: StorageIcon },
      { label: "Agent studio", href: "/agents/config", icon: TuneIcon },
      { label: "Organizations & team", href: "/organizations", icon: BusinessIcon },
      { label: "Schedules", href: "/schedules", icon: ScheduleIcon, roles: ["admin", "platform_admin"] },
    ],
  },
  {
    label: "Platform",
    roles: ["platform_admin"],
    items: [
      { label: "Temporal", href: "/temporal", icon: MemoryIcon, external: true },
      { label: "Grafana", href: "/grafana", icon: RadarIcon, external: true },
      { label: "API docs", href: "/api/docs", icon: ApiIcon, external: true },
    ],
  },
];

/** Longest-prefix match so /agents/config resolves to Agent studio, not Agent orchestration. */
export function findNav(path: string): { group: string; item: NavItem } | null {
  let best: { group: string; item: NavItem } | null = null;
  for (const g of NAV) {
    for (const item of g.items) {
      if (item.external) continue;
      const hit = item.href === "/" ? path === "/" : path === item.href || path.startsWith(item.href + "/");
      if (hit && (!best || item.href.length > best.item.href.length)) best = { group: g.label, item };
    }
  }
  return best;
}
