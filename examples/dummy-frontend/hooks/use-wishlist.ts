"use client"

import { useState, useEffect } from "react"
import type { WishlistItem } from "@/lib/types"

const WISHLIST_STORAGE_KEY = "ecommerce-wishlist"

export function useWishlist() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(WISHLIST_STORAGE_KEY)
    if (stored) {
      try {
        setWishlist(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse wishlist from localStorage", e)
      }
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist))
    }
  }, [wishlist, isLoaded])

  const addToWishlist = (productId: string) => {
    setWishlist((prev) => {
      if (prev.some((item) => item.productId === productId)) {
        return prev
      }
      return [...prev, { productId, addedAt: new Date().toISOString() }]
    })
  }

  const removeFromWishlist = (productId: string) => {
    setWishlist((prev) => prev.filter((item) => item.productId !== productId))
  }

  const isInWishlist = (productId: string) => {
    return wishlist.some((item) => item.productId === productId)
  }

  return {
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    isLoaded,
  }
}
