import {
  ArrowLeftRight, Banknote, BellRing, Boxes, Building2, Calculator, CalendarClock, ClipboardList, Drill, FileBarChart,
  HandCoins, HardHat, History, Layers, LayoutDashboard, MapPinCheck, PackageSearch, Receipt, Scale, Settings2, ShieldCheck,
  TrendingUp, Truck, UsersRound, Wallet, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight, Banknote, BellRing, Boxes, Building2, Calculator, CalendarClock, ClipboardList, Drill, FileBarChart,
  HandCoins, HardHat, History, Layers, LayoutDashboard, MapPinCheck, PackageSearch, Receipt, Scale, Settings2, ShieldCheck,
  TrendingUp, Truck, UsersRound, Wallet,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? LayoutDashboard;
  return <C className={className} />;
}
