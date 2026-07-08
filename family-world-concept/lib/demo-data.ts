// Static demo data for the $FAMILY World front-end prototype.
// No backend, no XRPL calls — everything here is placeholder content
// standing in for the future Telegram Family Vault bot + live chain data.

export const globalStats = {
  holders: "1,842",
  lpValue: "5,650 XRP",
  vaultValue: "482,311 XRP",
  nextUnlock: "11M 23D",
};

export const profile = {
  name: "Tom",
  handle: "@tom.family",
  role: "Family Member",
  avatarInitials: "T",
  holding: "2,450,000",
  nftCollection: { owned: 6, total: 10 },
  vaultShare: "0.286%",
  rank: 12,
};

export const vault = {
  supplyPercent: "5%",
  countdown: { months: 11, days: 23, hours: 4, mins: 18 },
  yourShare: "0.286%",
  estReward: "482 XRP",
  tagline: "Powered by the Family",
};

export const lpLake = {
  totalValue: "5,650 XRP",
  health: "Strong",
  healthScore: 82,
  tagline: "Liquidity · Strength · Growth",
};

export const missions = [
  { id: 1, label: "Daily Check In", progress: 1, total: 1, done: true, xp: 10 },
  { id: 2, label: "Visit Fishing Dock", progress: 0, total: 1, done: false, xp: 15 },
  { id: 3, label: "Hold $FAMILY", progress: 1, total: 1, done: true, xp: 5 },
];

export const leaderboard = [
  { rank: 1, name: "PenguinX", points: 125230 },
  { rank: 2, name: "XRPanda", points: 98420 },
  { rank: 3, name: "HODLPingu", points: 75830 },
  { rank: 4, name: "Tom", points: 68420, isYou: true },
  { rank: 5, name: "FamilyOG", points: 62110 },
  { rank: 6, name: "IcebergWhale", points: 54300 },
  { rank: 7, name: "FrostByte", points: 48750 },
  { rank: 8, name: "SnowSled99", points: 41200 },
  { rank: 9, name: "VaultKeeper", points: 37650 },
  { rank: 10, name: "ColonyCap", points: 33010 },
];

export const villageNews = [
  {
    id: 1,
    tag: "Announcement",
    title: "Community Vault snapshot scheduled",
    body: "The next holder snapshot for vault rewards will be taken automatically — no action needed if you're already holding.",
    date: "2 days ago",
  },
  {
    id: 2,
    tag: "Update",
    title: "LP Lake liquidity milestone reached",
    body: "Combined liquidity crossed a new milestone this week, strengthening price stability across the pool.",
    date: "5 days ago",
  },
  {
    id: 3,
    tag: "Coming Soon",
    title: "Fishing Dock daily game in development",
    body: "A daily mini-game is being built for the dock — check in from Missions to be first to know when it launches.",
    date: "1 week ago",
  },
  {
    id: 4,
    tag: "Community",
    title: "Family Telegram passed 1,800 members",
    body: "Thank you to everyone who has joined the journey so far. More member-only perks are planned.",
    date: "2 weeks ago",
  },
];

export const helpFaqs = [
  {
    q: "What is $FAMILY World?",
    a: "A visual community hub for the $FAMILY XRPL project, designed like a game world where each area represents a part of the ecosystem — the vault, liquidity pool, leaderboard, and more.",
  },
  {
    q: "Is this connected to the real token or wallet?",
    a: "Not yet. This is a private, front-end-only prototype using demo data. Wallet connection and live XRPL data are planned for a future version.",
  },
  {
    q: "What is the Community Vault?",
    a: "A shared vault holding a portion of supply, distributed to holders over time. The figures shown here are placeholder demo values.",
  },
  {
    q: "How do Missions work?",
    a: "Missions will be daily tasks (like checking in or visiting the Fishing Dock) that earn XP and rewards once the live version connects to the Telegram Family Vault bot.",
  },
  {
    q: "When does this connect to live data?",
    a: "After this prototype is reviewed internally, it will be connected to the Telegram Family Vault bot and live XRPL ledger data.",
  },
];

export type WorldArea = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  href: string;
  position: { top: string; left: string };
  accent: "frost" | "gold" | "mint";
};

export const worldAreas: WorldArea[] = [
  {
    id: "vault",
    slug: "vault",
    name: "Community Vault",
    tagline: "5% supply · powered by the Family",
    icon: "vault",
    href: "/vault",
    position: { top: "18%", left: "50%" },
    accent: "gold",
  },
  {
    id: "house",
    slug: "house",
    name: "My House",
    tagline: "Your profile & assets",
    icon: "house",
    href: "/house",
    position: { top: "30%", left: "20%" },
    accent: "frost",
  },
  {
    id: "leaderboard",
    slug: "leaderboard",
    name: "Leaderboard",
    tagline: "Top Family members",
    icon: "trophy",
    href: "/leaderboard",
    position: { top: "28%", left: "80%" },
    accent: "gold",
  },
  {
    id: "fishing-dock",
    slug: "fishing-dock",
    name: "Fishing Dock",
    tagline: "Daily game · win rewards",
    icon: "fish",
    href: "/fishing-dock",
    position: { top: "55%", left: "14%" },
    accent: "frost",
  },
  {
    id: "lp-lake",
    slug: "lp-lake",
    name: "LP Lake",
    tagline: "Liquidity · strength · growth",
    icon: "droplet",
    href: "/lp-lake",
    position: { top: "58%", left: "84%" },
    accent: "mint",
  },
  {
    id: "village",
    slug: "village",
    name: "Village Centre",
    tagline: "News · updates · community",
    icon: "tree",
    href: "/village",
    position: { top: "72%", left: "50%" },
    accent: "mint",
  },
  {
    id: "missions",
    slug: "missions",
    name: "Missions",
    tagline: "Complete daily tasks · earn XP",
    icon: "check",
    href: "/missions",
    position: { top: "50%", left: "50%" },
    accent: "gold",
  },
  {
    id: "help",
    slug: "help",
    name: "Help Centre",
    tagline: "Guides & support",
    icon: "help",
    href: "/help",
    position: { top: "82%", left: "18%" },
    accent: "frost",
  },
];
