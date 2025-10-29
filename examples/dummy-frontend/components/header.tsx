"use client"

import type React from "react"

import Link from "next/link"
import { Search, ShoppingCart, Heart, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart } from "@/hooks/use-cart"
import { useWishlist } from "@/hooks/use-wishlist"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { getAllCategories } from "@/lib/products"

export function Header() {
  const { getCartCount } = useCart()
  const { wishlist } = useWishlist()
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const categories = getAllCategories()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black text-[var(--color-coupang-orange)]">번개마켓</span>
          </Link>

          {/* Search Bar - Desktop */}
          <form onSubmit={handleSearch} className="hidden flex-1 max-w-2xl md:flex">
            <div className="relative w-full">
              <Input
                type="search"
                placeholder="찾고 싶은 상품을 검색해보세요!"
                className="w-full h-11 pr-12 border-2 border-[var(--color-coupang-orange)] focus-visible:ring-[var(--color-coupang-orange)]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 bg-[var(--color-coupang-orange)] hover:bg-[var(--color-coupang-orange)]/90 text-white"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Mobile Search */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Search className="h-5 w-5" />
                  <span className="sr-only">검색</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-auto">
                <form onSubmit={handleSearch} className="pt-6">
                  <div className="relative">
                    <Input
                      type="search"
                      placeholder="찾고 싶은 상품을 검색해보세요!"
                      className="w-full h-11 pr-12 border-2 border-[var(--color-coupang-orange)]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 bg-[var(--color-coupang-orange)] hover:bg-[var(--color-coupang-orange)]/90"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </SheetContent>
            </Sheet>

            <Link href="/wishlist">
              <Button variant="ghost" size="icon" className="relative">
                <Heart className="h-5 w-5" />
                {wishlist.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-coupang-orange)] text-xs text-white font-bold">
                    {wishlist.length}
                  </span>
                )}
                <span className="sr-only">위시리스트</span>
              </Button>
            </Link>

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {getCartCount() > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-coupang-orange)] text-xs text-white font-bold">
                    {getCartCount()}
                  </span>
                )}
                <span className="sr-only">장바구니</span>
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">메뉴</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <nav className="flex flex-col gap-4 pt-6">
                  <Link href="/products" className="text-lg font-medium hover:text-[var(--color-coupang-orange)]">
                    전체상품
                  </Link>
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/products?category=${category.slug}`}
                      className="text-lg hover:text-[var(--color-coupang-orange)]"
                    >
                      {category.name}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden border-t py-2 lg:block">
          <ul className="flex items-center gap-6">
            <li>
              <Link href="/products" className="text-sm font-medium hover:text-[var(--color-coupang-orange)]">
                전체상품
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products?category=${category.slug}`}
                  className="text-sm hover:text-[var(--color-coupang-orange)]"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
