"use client"

import { useState, useEffect } from "react"
import type { CartItem } from "@/lib/types"

const CART_STORAGE_KEY = "ecommerce-cart"

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      try {
        setCart(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse cart from localStorage", e)
      }
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    }
  }, [cart, isLoaded])

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) =>
          i.productId === item.productId && JSON.stringify(i.selectedOptions) === JSON.stringify(item.selectedOptions),
      )
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId && JSON.stringify(i.selectedOptions) === JSON.stringify(item.selectedOptions)
            ? { ...i, quantity: i.quantity + item.quantity }
            : i,
        )
      }
      return [...prev, item]
    })
  }

  const updateQuantity = (productId: string, selectedOptions: CartItem["selectedOptions"], quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId && JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
          ? { ...item, quantity }
          : item,
      ),
    )
  }

  const removeFromCart = (productId: string, selectedOptions: CartItem["selectedOptions"]) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(item.productId === productId && JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)),
      ),
    )
  }

  const clearCart = () => {
    setCart([])
  }

  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartCount,
    isLoaded,
  }
}
