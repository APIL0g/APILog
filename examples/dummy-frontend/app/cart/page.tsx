"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { QuantitySelector } from "@/components/quantity-selector"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Trash2, ShoppingBag, Tag } from "lucide-react"
import { useCart } from "@/hooks/use-cart"
import { getProductById } from "@/lib/products"
import { formatPrice } from "@/lib/format"
import { useToast } from "@/hooks/use-toast"

const FREE_SHIPPING_THRESHOLD = 50000

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, isLoaded } = useCart()
  const { toast } = useToast()
  const [couponCode, setCouponCode] = useState("")

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <p>로딩 중...</p>
        </div>
      </div>
    )
  }

  const cartItems = cart
    .map((item) => {
      const product = getProductById(item.productId)
      return product ? { ...item, product } : null
    })
    .filter((item) => item !== null)

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 3000
  const total = subtotal + shippingCost
  const freeShippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)
  const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0)

  const handleApplyCoupon = () => {
    // Dummy coupon logic
    if (couponCode.toLowerCase() === "welcome10") {
      toast({
        title: "쿠폰이 적용되었습니다",
        description: "10% 할인이 적용되었습니다.",
      })
    } else if (couponCode) {
      toast({
        title: "유효하지 않은 쿠폰입니다",
        description: "쿠폰 코드를 확인해주세요.",
        variant: "destructive",
      })
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">장바구니</h1>
        <Card>
          <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
            <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">장바구니가 비어있습니다</h2>
            <p className="mb-6 text-muted-foreground">상품을 담아보세요!</p>
            <Button asChild size="lg">
              <Link href="/products">쇼핑 계속하기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">장바구니</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              {/* Free Shipping Progress */}
              {subtotal < FREE_SHIPPING_THRESHOLD && (
                <div className="mb-6 rounded-lg bg-muted p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">무료배송까지</span>
                    <span className="font-bold text-primary">{formatPrice(remainingForFreeShipping)} 남음</span>
                  </div>
                  <Progress value={freeShippingProgress} className="h-2" />
                </div>
              )}

              {subtotal >= FREE_SHIPPING_THRESHOLD && (
                <div className="mb-6 rounded-lg bg-primary/10 p-4 text-center">
                  <p className="font-semibold text-primary">무료배송 적용!</p>
                </div>
              )}

              {/* Cart Items List */}
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={`${item.productId}-${JSON.stringify(item.selectedOptions)}`} className="flex gap-4">
                    <Link href={`/products/${item.product.slug}`} className="relative h-24 w-24 shrink-0">
                      <Image
                        src={item.product.images[0] || "/placeholder.svg"}
                        alt={item.product.title}
                        fill
                        className="rounded-lg object-cover"
                      />
                    </Link>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <Link href={`/products/${item.product.slug}`} className="font-semibold hover:text-primary">
                          {item.product.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {item.selectedOptions.color && <span>색상: {item.selectedOptions.color}</span>}
                          {item.selectedOptions.size && <span>사이즈: {item.selectedOptions.size}</span>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <QuantitySelector
                          value={item.quantity}
                          onChange={(newQuantity) => updateQuantity(item.productId, item.selectedOptions, newQuantity)}
                          max={Math.min(item.product.stock, 99)}
                        />
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold">{formatPrice(item.product.price * item.quantity)}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              removeFromCart(item.productId, item.selectedOptions)
                              toast({
                                title: "상품이 제거되었습니다",
                              })
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">삭제</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-20">
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-bold">주문 요약</h2>

              {/* Coupon */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="쿠폰 코드 입력"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <Button variant="outline" onClick={handleApplyCoupon}>
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">예시: WELCOME10</p>
              </div>

              <Separator className="my-4" />

              {/* Price Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">상품 금액</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">배송비</span>
                  <span>{shippingCost === 0 ? "무료" : formatPrice(shippingCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>총 결제금액</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>

              <Button asChild size="lg" className="mt-6 w-full">
                <Link href="/checkout">주문하기</Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="mt-2 w-full bg-transparent">
                <Link href="/products">쇼핑 계속하기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
