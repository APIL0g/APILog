"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Star, Zap, TrendingUp, Loader2 } from "lucide-react"
import { getAllProducts, getAllCategories } from "@/lib/products"
import { formatPrice } from "@/lib/format"
import { useState, useEffect, useRef } from "react"

export default function HomePage() {
  const products = getAllProducts()
  const categories = getAllCategories()

  // Get featured products (best sellers with rocket delivery)
  const featuredProducts = products
    .filter((p) => p.rocketDelivery && p.discountPercent)
    .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0))

  // Get deal products (highest discounts)
  const dealProducts = products
    .filter((p) => p.discountPercent && p.discountPercent >= 30)
    .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0))
    .slice(0, 6)

  const [displayCount, setDisplayCount] = useState(12)
  const [isLoading, setIsLoading] = useState(false)
  const displayedProducts = featuredProducts.slice(0, displayCount)
  const hasMore = displayCount < featuredProducts.length

  const sentinelRef = useRef<HTMLDivElement>(null)
  const isLoadingRef = useRef(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        // Only load if intersecting, not already loading, and has more items
        if (entry.isIntersecting && !isLoadingRef.current && hasMore) {
          isLoadingRef.current = true
          setIsLoading(true)

          // Simulate loading delay for smooth UX
          setTimeout(() => {
            setDisplayCount((prev) => Math.min(prev + 12, featuredProducts.length))
            setIsLoading(false)
            isLoadingRef.current = false
          }, 500)
        }
      },
      {
        root: null,
        rootMargin: "200px", // Start loading before reaching the bottom
        threshold: 0.1,
      },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, featuredProducts.length])

  return (
    <div className="flex flex-col">
      <section className="bg-gradient-to-r from-[var(--color-coupang-orange)] to-orange-500 py-12 md:py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-8 w-8 fill-[var(--color-rocket-gold)] text-[var(--color-rocket-gold)]" />
              <h1 className="text-balance text-3xl font-black tracking-tight md:text-5xl">로켓배송으로 빠르게!</h1>
            </div>
            <p className="mb-6 text-pretty text-lg md:text-xl opacity-95">
              오늘 주문하면 내일 아침 7시 도착! 최대 70% 할인 중
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="text-base bg-white text-[var(--color-coupang-orange)] hover:bg-white/90 font-bold"
              >
                <Link href="/products">
                  전체상품 보기
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-base bg-transparent border-2 border-white text-white hover:bg-white/10 font-bold"
              >
                <Link href="/products?category=electronics">전자기기 특가</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-coupang-blue)] py-3">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 text-white">
            <Zap className="h-5 w-5 fill-[var(--color-rocket-gold)] text-[var(--color-rocket-gold)]" />
            <span className="font-bold">로켓배송</span>
            <span className="text-sm">오늘 주문 → 내일 아침 7시 도착</span>
          </div>
        </div>
      </section>

      <section className="py-8 md:py-12 bg-red-50 dark:bg-red-950/20">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-red-500" />
              <h2 className="text-2xl font-black">오늘의 특가</h2>
              <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold">최대 70%</Badge>
            </div>
            <Button asChild variant="ghost" className="text-[var(--color-coupang-orange)] font-bold">
              <Link href="/products">
                전체보기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {dealProducts.map((product) => (
              <Link key={product.id} href={`/products/${product.slug}`}>
                <Card className="group overflow-hidden transition-all hover:shadow-md border">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <Image
                      src={product.images[0] || "/placeholder.svg"}
                      alt={product.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    {product.rocketDelivery && (
                      <Badge className="absolute left-2 top-2 bg-[var(--color-coupang-blue)] hover:bg-[var(--color-coupang-blue)] text-white font-bold px-2 py-1">
                        <Zap className="h-3 w-3 mr-1 fill-[var(--color-rocket-gold)] text-[var(--color-rocket-gold)]" />
                        로켓
                      </Badge>
                    )}
                    {product.discountPercent && (
                      <Badge className="absolute right-2 top-2 bg-red-500 hover:bg-red-500 text-white font-bold text-base px-2 py-1">
                        {product.discountPercent}%
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="mb-1 line-clamp-2 text-sm font-medium group-hover:text-[var(--color-coupang-orange)]">
                      {product.title}
                    </h3>
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-lg font-black text-red-500">{product.discountPercent}%</span>
                      <span className="text-xl font-black">{formatPrice(product.price)}</span>
                    </div>
                    {product.originalPrice && (
                      <div className="mb-1">
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 fill-[var(--color-coupang-orange)] text-[var(--color-coupang-orange)]" />
              <h2 className="text-2xl font-black">로켓배송 상품</h2>
            </div>
            <Button asChild variant="ghost" className="text-[var(--color-coupang-orange)] font-bold">
              <Link href="/products">
                전체보기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {displayedProducts.map((product) => (
              <Link key={product.id} href={`/products/${product.slug}`}>
                <Card className="group overflow-hidden transition-all hover:shadow-md border">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <Image
                      src={product.images[0] || "/placeholder.svg"}
                      alt={product.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    <Badge className="absolute left-2 top-2 bg-[var(--color-coupang-blue)] hover:bg-[var(--color-coupang-blue)] text-white font-bold px-2 py-1">
                      <Zap className="h-3 w-3 mr-1 fill-[var(--color-rocket-gold)] text-[var(--color-rocket-gold)]" />
                      로켓
                    </Badge>
                    {product.discountPercent && (
                      <Badge className="absolute right-2 top-2 bg-red-500 hover:bg-red-500 text-white font-bold text-base px-2 py-1">
                        {product.discountPercent}%
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="mb-1 line-clamp-2 text-sm font-medium group-hover:text-[var(--color-coupang-orange)]">
                      {product.title}
                    </h3>
                    <div className="mb-1 flex items-baseline gap-2">
                      {product.discountPercent && (
                        <span className="text-lg font-black text-red-500">{product.discountPercent}%</span>
                      )}
                      <span className="text-xl font-black">{formatPrice(product.price)}</span>
                    </div>
                    {product.originalPrice && (
                      <div className="mb-1">
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      </div>
                    )}
                    {product.deliveryTime && (
                      <div className="text-xs text-[var(--color-coupang-blue)] font-medium">{product.deliveryTime}</div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{product.rating}</span>
                      <span className="text-xs text-muted-foreground">({product.reviews_count.toLocaleString()})</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>상품을 불러오는 중...</span>
                </div>
              )}
            </div>
          )}

          {!hasMore && displayedProducts.length > 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">모든 상품을 확인했습니다</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-8 md:py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-2xl font-black">카테고리별 쇼핑</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/products?category=${category.slug}`}>
                <Card className="group overflow-hidden transition-all hover:shadow-md border hover:border-[var(--color-coupang-orange)]">
                  <CardContent className="p-4 text-center">
                    <h3 className="text-sm font-bold group-hover:text-[var(--color-coupang-orange)]">
                      {category.name}
                    </h3>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
