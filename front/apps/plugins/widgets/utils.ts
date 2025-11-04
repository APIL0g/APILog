import {
  ArrowUpDown,
  CreditCard,
  Download,
  Filter,
  Heart,
  LogIn,
  MousePointerClick,
  Search as SearchIcon,
  Share2,
  ShoppingCart,
  TicketPercent,
  UserPlus,
} from "lucide-react"

export function normalizeLabel(value: string) {
  return (value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim()
}

export function getIconFor(label: string) {
  const normalized = normalizeLabel(label)
  if (normalized.includes("sign in") || normalized.includes("signin") || normalized.includes("login")) return LogIn
  if (normalized.includes("sign up") || normalized.includes("signup") || normalized.includes("register")) return UserPlus
  if (normalized.includes("add to cart") || normalized.includes("cart")) return ShoppingCart
  if (normalized.includes("download")) return Download
  if (normalized.includes("search")) return SearchIcon
  if (normalized.includes("filter")) return Filter
  if (normalized.includes("sort")) return ArrowUpDown
  if (normalized.includes("share")) return Share2
  if (normalized.includes("wishlist") || normalized.includes("favorite") || normalized.includes("heart")) return Heart
  if (normalized.includes("pay") || normalized.includes("checkout")) return CreditCard
  if (normalized.includes("coupon")) return TicketPercent
  return MousePointerClick
}
