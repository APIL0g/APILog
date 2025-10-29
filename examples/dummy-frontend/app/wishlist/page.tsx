"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RatingDisplay } from "@/components/rating-display"
import { Heart, ShoppingCart, Trash2 } from "lucide-react"
import { useWishlist } from "@/hooks/use-wishlist"
import { useCart } from "@/hooks/use-cart"
import { getProductById } from "@/lib/products"
import { formatPrice } from "@/lib/format"
import { useToast } from "@/hooks/use-toast"

export default function WishlistPage() {
  const { wishlist, removeFromWishlist, isLoaded } = useWishlist()
  const { addToCart } = useCart()
  const { toast } = useToast()

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <p>로딩 중...</p>
        </div>
      </div>
    )
  }

  const wishlistItems = wishlist
    .map((item) => {
      const product = getProductById(item.productId)
      return product ? { ...item, product } : null
    })
    .filter((item) => item !== null)

  const handleAddToCart = (productId: string) => {
    const product = getProductById(productId)
    if (!product) return

    if (product.stock === 0) {
      toast({
        title: "품절된 상품입니다",
        description: "현재 재고가 없습니다.",
        variant: "destructive",
      })
      return
    }

    addToCart({
      productId,
      quantity: 1,
      selectedOptions: {
        size: product.options.size?.[0],
        color: product.options.color?.[0],
      },
    })

    toast({
      title: "장바구니에 추가되었습니다",
      description: `${product.title}이(가) 장바구니에 담겼습니다.`,
    })
  }

  const handleRemove = (productId: string) => {
    removeFromWishlist(productId)
    toast({
      title: "위시리스트에서 제거되었습니다",
    })
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">위시리스트</h1>
        <Card>
          <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
            <Heart className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">위시리스트가 비어있습니다</h2>
            <p className="mb-6 text-muted-foreground">마음에 드는 상품을 저장해보세요!</p>
            <Button asChild size="lg">
              <Link href="/products">상품 둘러보기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">위시리스트</h1>
        <p className="text-muted-foreground">{wishlistItems.length}개의 상품</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {wishlistItems.map((item) => (
          <Card key={item.productId} className="group overflow-hidden">
            <div className="relative aspect-square overflow-hidden">
              <Link href={`/products/${item.product.slug}`}>
                <Image
                  src={item.product.images[0] || "/placeholder.svg"}
                  alt={item.product.title}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                />
              </Link>
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => handleRemove(item.productId)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">제거</span>
              </Button>
              {item.product.stock === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="rounded-lg bg-destructive px-3 py-1 text-sm font-semibold text-destructive-foreground">
                    품절
                  </span>
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <Link href={`/products/${item.product.slug}`}>
                <h3 className="mb-2 line-clamp-2 font-semibold group-hover:text-primary">{item.product.title}</h3>
              </Link>
              <RatingDisplay rating={item.product.rating} reviewCount={item.product.reviews_count} size="sm" />
              <p className="mt-2 text-lg font-bold">{formatPrice(item.product.price)}</p>
              <Button
                onClick={() => handleAddToCart(item.productId)}
                className="mt-4 w-full"
                disabled={item.product.stock === 0}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                장바구니 담기
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
