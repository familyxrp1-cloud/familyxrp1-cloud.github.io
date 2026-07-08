import {
  Landmark,
  Home,
  Trophy,
  Fish,
  Droplet,
  TreePine,
  CheckCircle2,
  LifeBuoy,
  Users,
  Lock,
  Send,
  Menu,
  ChevronRight,
  Sparkles,
  Coins,
  Star,
  Gem,
  type LucideIcon,
} from "lucide-react";

export const iconMap: Record<string, LucideIcon> = {
  vault: Landmark,
  house: Home,
  trophy: Trophy,
  fish: Fish,
  droplet: Droplet,
  tree: TreePine,
  check: CheckCircle2,
  help: LifeBuoy,
  users: Users,
  lock: Lock,
  send: Send,
  menu: Menu,
  chevron: ChevronRight,
  sparkles: Sparkles,
  coins: Coins,
  star: Star,
  gem: Gem,
};

export function AreaIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = iconMap[name] ?? Sparkles;
  return <Icon className={className} />;
}
