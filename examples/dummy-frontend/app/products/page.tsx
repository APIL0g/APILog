"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ProductCard } from "@/components/product-card"
import { ProductFilters } from "@/components/product-filters"
import { ProductSort } from "@/components/product-sort"
import { Pagination } from "@/components/pagination"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { SlidersHorizontal } from "lucide-react"
import { getAllProducts, filterProducts, sortProducts } from "@/lib/products"
import { Skeleton } from "@/components/ui/skeleton"

const ITEMS_PER_PAGE = 12

function ProductsContent() {
  const searchParams = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    searchParams.get("category") || undefined,
  )
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 300000])
  const [minRating, setMinRating] = useState(0)
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "price-asc" | "price-desc">("popular")
  const [currentPage, setCurrentPage] = useState(1)

  // Update category from URL params
  useEffect(() => {
    const category = searchParams.get("category")
    setSelectedCategory(category || undefined)
  }, [searchParams])

  const allProducts = getAllProducts()

  // Apply filters
  const filteredProducts = filterProducts(allProducts, {
    category: selectedCategory,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
    minRating,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  })

  // Apply sorting
  const sortedProducts = sortProducts(filteredProducts, sortBy)

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, selectedTags, priceRange, minRating, sortBy])

  const handleReset = () => {
    setSelectedCategory(undefined)
    setSelectedTags([])
    setPriceRange([0, 300000])
    setMinRating(0)
    setSortBy("popular")
    setCurrentPage(1)
  }

  const filterProps = {
    selectedCategory,
    selectedTags,
    priceRange,
    minRating,
    onCategoryChange: setSelectedCategory,
    onTagsChange: setSelectedTags,
    onPriceRangeChange: setPriceRange,
    onMinRatingChange: setMinRating,
    onReset: handleReset,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">전체 상품</h1>
        <p className="text-muted-foreground">총 {sortedProducts.length}개의 상품</p>
      </div>

      <div className="flex gap-8">
        {/* Desktop Filters */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <ProductFilters {...filterProps} />
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Toolbar */}
          <div className="mb-6 flex items-center justify-between">
            {/* Mobile Filter Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden bg-transparent">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  필터
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <div className="pt-6">
                  <ProductFilters {...filterProps} />
                </div>
              </SheetContent>
            </Sheet>

            {/* Sort */}
            <div className="ml-auto">
              <ProductSort
                value={sortBy}
                onChange={(value) => setSortBy(value as "popular" | "newest" | "price-asc" | "price-desc")}
              />
            </div>
          </div>

          {/* Products Grid */}
          {paginatedProducts.length > 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <p className="mb-2 text-lg font-semibold">검색 결과가 없습니다</p>
              <p className="mb-4 text-muted-foreground">다른 필터 조건으로 다시 시도해보세요</p>
              <Button onClick={handleReset}>필터 초기화</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="mb-8 h-12 w-64" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  )
}
