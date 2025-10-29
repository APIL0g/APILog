import productsData from "@/data/products.json"
import categoriesData from "@/data/categories.json"
import type { Product, Category } from "./types"

export function getAllProducts(): Product[] {
  return productsData as Product[]
}

export function getProductBySlug(slug: string): Product | undefined {
  return productsData.find((p) => p.slug === slug) as Product | undefined
}

export function getProductById(id: string): Product | undefined {
  return productsData.find((p) => p.id === id) as Product | undefined
}

export function getAllCategories(): Category[] {
  return categoriesData as Category[]
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categoriesData.find((c) => c.slug === slug) as Category | undefined
}

export function filterProducts(
  products: Product[],
  filters: {
    category?: string
    minPrice?: number
    maxPrice?: number
    minRating?: number
    tags?: string[]
    search?: string
  },
): Product[] {
  return products.filter((product) => {
    if (filters.category && product.category !== filters.category) {
      return false
    }
    if (filters.minPrice !== undefined && product.price < filters.minPrice) {
      return false
    }
    if (filters.maxPrice !== undefined && product.price > filters.maxPrice) {
      return false
    }
    if (filters.minRating !== undefined && product.rating < filters.minRating) {
      return false
    }
    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some((tag) => product.tags.includes(tag))
      if (!hasTag) return false
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = product.title.toLowerCase().includes(searchLower)
      const matchesDescription = product.description.toLowerCase().includes(searchLower)
      const matchesTags = product.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      if (!matchesTitle && !matchesDescription && !matchesTags) {
        return false
      }
    }
    return true
  })
}

export function sortProducts(
  products: Product[],
  sortBy: "popular" | "newest" | "price-asc" | "price-desc",
): Product[] {
  const sorted = [...products]
  switch (sortBy) {
    case "popular":
      return sorted.sort((a, b) => b.reviews_count - a.reviews_count)
    case "newest":
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price)
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price)
    default:
      return sorted
  }
}
