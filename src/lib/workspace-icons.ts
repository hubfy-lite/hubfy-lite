/**
 * Default icons and colors for workspace avatars.
 * Uses individual Lucide imports to avoid pulling the entire icon library.
 */
import {
  Angry,
  Annoyed,
  Airplay,
  Balloon,
  BicepsFlexed,
  Bitcoin,
  Chrome,
  ChessBishop,
  ChessKing,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Codepen,
  Codesandbox,
  Rocket,
  BookOpen,
  GraduationCap,
  Briefcase,
  Building2,
  Store,
  ShoppingBag,
  Heart,
  Star,
  Zap,
  Flame,
  Target,
  Trophy,
  Crown,
  Diamond,
  Gem,
  Music,
  Camera,
  Film,
  Palette,
  Brush,
  PenTool,
  Code,
  Terminal,
  Globe,
  Link,
  Mail,
  MessageCircle,
  Phone,
  Users,
  UserPlus,
  HandFist,
  HandHelping,
  HandMetal,
  Shield,
  Lock,
  Key,
  Bell,
  Calendar,
  Clock,
  BarChart3,
  TrendingUp,
  PieChart,
  Lightbulb,
  Cpu,
  Database,
  Cloud,
  Download,
  Upload,
  Folder,
  FileText,
  Layers,
  Layout,
  Grid3x3,
  Box,
  Package,
  PartyPopper,
  Frown,
  Laugh,
  Meh,
  Smile,
  SmilePlus,
  ThumbsUp,
  Ribbon,
  Salad,
  Truck,
  Plane,
  MapPin,
  Compass,
  Mountain,
  Sun,
  Moon,
  HeartCrack,
  HeartHandshake,
  LeafyGreen,
  Dribbble,
  Figma,
  Framer,
  Github,
  Gitlab,
  Hexagon,
  Instagram,
  Pocket,
  Slack,
  Trello,
  Twitch,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

/** Map of icon name → component for workspace avatars */
export const WORKSPACE_ICON_MAP: Record<string, LucideIcon> = {
  Rocket,
  BookOpen,
  GraduationCap,
  Briefcase,
  Building2,
  Store,
  ShoppingBag,
  Heart,
  Star,
  Zap,
  Flame,
  Target,
  Trophy,
  Crown,
  Diamond,
  Gem,
  Music,
  Camera,
  Film,
  Palette,
  Brush,
  PenTool,
  Code,
  Terminal,
  Globe,
  Link,
  Mail,
  MessageCircle,
  Phone,
  Users,
  UserPlus,
  Shield,
  Lock,
  Key,
  Bell,
  Calendar,
  Clock,
  BarChart3,
  TrendingUp,
  PieChart,
  Lightbulb,
  Cpu,
  Database,
  Cloud,
  Download,
  Upload,
  Folder,
  FileText,
  Layers,
  Layout,
  Grid3x3,
  Box,
  Package,
  Truck,
  Plane,
  MapPin,
  Compass,
  Mountain,
  Sun,
  Moon,
  Airplay,
  Bitcoin,
  Chromium: Chrome,
  Codepen,
  Codesandbox,
  Dribbble,
  Figma,
  Framer,
  Github,
  Gitlab,
  Hexagon,
  Instagram,
  Pocket,
  Slack,
  Trello,
  Twitch,
  Twitter,
  Youtube,
  Angry,
  Annoyed,
  Balloon,
  BicepsFlexed,
  ChessBishop,
  ChessKing,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Frown,
  HandFist,
  HandHelping,
  HandMetal,
  HeartCrack,
  HeartHandshake,
  Laugh,
  LeafyGreen,
  Meh,
  PartyPopper,
  Ribbon,
  Salad,
  Smile,
  SmilePlus,
  ThumbsUp,
};

/** Ordered list of icon names */
const HIDDEN_WORKSPACE_ICONS = new Set([
  "Link",
  "Globe",
  "FileText",
  "User",
  "Users",
  "UserPlus",
  "Folder",
  "Download",
]);

export const WORKSPACE_ICONS = Object.keys(WORKSPACE_ICON_MAP).filter(
  (iconName) => !HIDDEN_WORKSPACE_ICONS.has(iconName)
);

export type WorkspaceIconName = keyof typeof WORKSPACE_ICON_MAP;

export const DEFAULT_WORKSPACE_COLOR = "#6466FA" as const;

export const WORKSPACE_COLORS = [
  "#ffffff", // white
  "#ef4444", // red
  "#f87171", // light red
  "#f43f5e", // rose
  "#ec4899", // pink
  "#d946ef", // fuchsia
  "#c026d3", // deep fuchsia
  "#a855f7", // purple
  "#8b5cf6", // violet
  "#7c3aed", // deep violet
  "#6d28d9", // dark violet
  "#6466FA", // indigo (default)
  "#3b82f6", // blue
  "#2563eb", // royal blue
  "#1e40af", // dark blue
  "#0ea5e9", // sky
  "#22d3ee", // light cyan
  "#06b6d4", // cyan
  "#14b8a6", // teal
  "#10b981", // emerald
  "#22c55e", // green
  "#4ade80", // mint green
  "#84cc16", // lime
  "#eab308", // yellow
  "#f59e0b", // amber
  "#f97316", // orange
  "#374151", // gray-700
  "#000000", // black
] as const;

export type WorkspaceColor = (typeof WORKSPACE_COLORS)[number];
