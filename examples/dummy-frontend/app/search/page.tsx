"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ProductCard } from "@/components/product-card"
import { ProductSort } from "@/components/product-sort"
import { Pagination } from "@/components/pagination"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, X } from "lucide-react"
import { getAllProducts, sortProducts } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const ITEMS_PER_PAGE = 12

function SearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "price-asc" | "price-desc">("popular")
  const [currentPage, setCurrentPage] = useState(1)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const allProducts = getAllProducts()

  // Fuzzy search implementation
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return []
    }

    const query = debouncedQuery.toLowerCase()
    return allProducts.filter((product) => {
      const titleMatch = product.title.toLowerCase().includes(query)
      const descriptionMatch = product.description.toLowerCase().includes(query)
      const categoryMatch = product.category.toLowerCase().includes(query)
      const tagsMatch = product.tags.some((tag) => tag.toLowerCase().includes(query))

      return titleMatch || descriptionMatch || categoryMatch || tagsMatch
    })
  }, [allProducts, debouncedQuery])

  // Apply sorting
  const sortedResults = sortProducts(searchResults, sortBy)

  // Pagination
  const totalPages = Math.ceil(sortedResults.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedResults = sortedResults.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const handleClearSearch = () => {
    setSearchQuery("")
    setDebouncedQuery("")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">검색</h1>

      {/* Search Input */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="상품을 검색하세요..."
              className="pl-10 pr-10 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={handleClearSearch}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">검색어 지우기</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {debouncedQuery.trim() ? (
        <>
          {/* Toolbar */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">&quot;{debouncedQuery}&quot;</span> 검색 결과{" "}
              <span className="font-semibold text-foreground">{sortedResults.length}</span>개
            </p>
            {sortedResults.length > 0 && (
              <ProductSort
                value={sortBy}
                onChange={(value) => setSortBy(value as "popular" | "newest" | "price-asc" | "price-desc")}
              />
            )}
          </div>

          {/* Products Grid */}
          {paginatedResults.length > 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedResults.map((product) => (
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
            <Card>
              <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
                <Search className="mb-4 h-16 w-16 text-muted-foreground" />
                <h2 className="mb-2 text-xl font-semibold">검색 결과가 없습니다</h2>
                <p className="mb-6 text-muted-foreground">
                  &quot;{debouncedQuery}&quot;에 대한 검색 결과를 찾을 수 없습니다.
                  <br />
                  다른 검색어로 다시 시도해보세요.
                </p>
                <Button onClick={handleClearSearch}>검색어 지우기</Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
            <Search className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">검색어를 입력하세요</h2>
            <p className="text-muted-foreground">찾으시는 상품을 검색해보세요.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="mb-8 h-12 w-64" />
          <Skeleton className="mb-8 h-20 w-full" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
