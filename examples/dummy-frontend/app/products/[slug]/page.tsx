"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ProductImageGallery } from "@/components/product-image-gallery"
import { RatingDisplay } from "@/components/rating-display"
import { QuantitySelector } from "@/components/quantity-selector"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Heart, ShoppingCart, Truck, RefreshCw, Shield } from "lucide-react"
import { getProductBySlug, getAllProducts, getCategoryBySlug } from "@/lib/products"
import { formatPrice } from "@/lib/format"
import { useCart } from "@/hooks/use-cart"
import { useWishlist } from "@/hooks/use-wishlist"
import { useToast } from "@/hooks/use-toast"

interface ProductDetailPageProps {
  params: {
    slug: string
  }
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const product = getProductBySlug(params.slug)
  const router = useRouter()
  const { addToCart } = useCart()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const { toast } = useToast()

  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    product?.options.size ? product.options.size[0] : undefined,
  )
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product?.options.color ? product.options.color[0] : undefined,
  )

  if (!product) {
    notFound()
  }

  const category = getCategoryBySlug(product.category)
  const allProducts = getAllProducts()
  const relatedProducts = allProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)

  const breadcrumbItems = [
    { label: "상품", href: "/products" },
    { label: category?.name || product.category, href: `/products?category=${product.category}` },
    { label: product.title, href: `/products/${product.slug}` },
  ]

  const handleAddToCart = () => {
    if (product.stock === 0) {
      toast({
        title: "품절된 상품입니다",
        description: "현재 재고가 없습니다.",
        variant: "destructive",
      })
      return
    }

    addToCart({
      productId: product.id,
      quantity,
      selectedOptions: {
        size: selectedSize,
        color: selectedColor,
      },
    })

    toast({
      title: "장바구니에 추가되었습니다",
      description: `${product.title}이(가) 장바구니에 담겼습니다.`,
    })
  }

  const handleBuyNow = () => {
    if (product.stock === 0) {
      toast({
        title: "품절된 상품입니다",
        description: "현재 재고가 없습니다.",
        variant: "destructive",
      })
      return
    }

    addToCart({
      productId: product.id,
      quantity,
      selectedOptions: {
        size: selectedSize,
        color: selectedColor,
      },
    })

    router.push("/cart")
  }

  const handleWishlistToggle = () => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id)
      toast({
        title: "위시리스트에서 제거되었습니다",
      })
    } else {
      addToWishlist(product.id)
      toast({
        title: "위시리스트에 추가되었습니다",
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="mb-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      {/* Product Info */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image Gallery */}
        <div>
          <ProductImageGallery images={product.images} title={product.title} />
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Badge key={tag} variant={tag === "베스트" ? "default" : "secondary"}>
                {tag}
              </Badge>
            ))}
          </div>

          {/* Title */}
          <div>
            <h1 className="mb-2 text-3xl font-bold">{product.title}</h1>
            <RatingDisplay rating={product.rating} reviewCount={product.reviews_count} size="lg" />
          </div>

          {/* Price */}
          <div className="border-y py-4">
            <p className="text-3xl font-bold">{formatPrice(product.price)}</p>
          </div>

          {/* Options */}
          {product.options.color && product.options.color.length > 0 && (
            <div>
              <Label className="mb-3 block text-base font-semibold">색상</Label>
              <RadioGroup value={selectedColor} onValueChange={setSelectedColor}>
                <div className="flex flex-wrap gap-2">
                  {product.options.color.map((color) => (
                    <div key={color} className="flex items-center">
                      <RadioGroupItem value={color} id={`color-${color}`} className="peer sr-only" />
                      <Label
                        htmlFor={`color-${color}`}
                        className="cursor-pointer rounded-lg border-2 border-muted px-4 py-2 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                      >
                        {color}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {product.options.size && product.options.size.length > 0 && (
            <div>
              <Label className="mb-3 block text-base font-semibold">사이즈</Label>
              <RadioGroup value={selectedSize} onValueChange={setSelectedSize}>
                <div className="flex flex-wrap gap-2">
                  {product.options.size.map((size) => (
                    <div key={size} className="flex items-center">
                      <RadioGroupItem value={size} id={`size-${size}`} className="peer sr-only" />
                      <Label
                        htmlFor={`size-${size}`}
                        className="cursor-pointer rounded-lg border-2 border-muted px-4 py-2 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                      >
                        {size}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Quantity */}
          <div>
            <Label className="mb-3 block text-base font-semibold">수량</Label>
            <QuantitySelector value={quantity} onChange={setQuantity} max={Math.min(product.stock, 99)} />
            <p className="mt-2 text-sm text-muted-foreground">재고: {product.stock}개</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <Button onClick={handleAddToCart} size="lg" className="flex-1" disabled={product.stock === 0}>
                <ShoppingCart className="mr-2 h-5 w-5" />
                장바구니
              </Button>
              <Button
                onClick={handleWishlistToggle}
                variant="outline"
                size="lg"
                className={isInWishlist(product.id) ? "bg-primary/10" : ""}
              >
                <Heart className={`h-5 w-5 ${isInWishlist(product.id) ? "fill-primary text-primary" : ""}`} />
                <span className="sr-only">위시리스트</span>
              </Button>
            </div>
            <Button
              onClick={handleBuyNow}
              size="lg"
              variant="default"
              className="w-full"
              disabled={product.stock === 0}
            >
              바로 구매
            </Button>
          </div>

          {/* Info Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">무료배송</p>
                  <p className="text-muted-foreground">5만원 이상</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">교환/반품</p>
                  <p className="text-muted-foreground">7일 이내</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">안전결제</p>
                  <p className="text-muted-foreground">구매자 보호</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-16">
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="description">상세정보</TabsTrigger>
            <TabsTrigger value="specs">상품정보</TabsTrigger>
            <TabsTrigger value="reviews">리뷰 ({product.reviews_count})</TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-6">
            <Card>
              <CardContent className="prose max-w-none p-6 dark:prose-invert">
                <h3>상품 설명</h3>
                <p>{product.description}</p>
                <h3>특징</h3>
                <ul>
                  <li>고품질 소재로 제작되었습니다</li>
                  <li>세심한 디테일과 마감 처리</li>
                  <li>일상생활에서 편리하게 사용 가능</li>
                  <li>합리적인 가격대의 프리미엄 제품</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="specs" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 border-b pb-3">
                    <span className="font-semibold">카테고리</span>
                    <span className="col-span-2">{category?.name}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b pb-3">
                    <span className="font-semibold">재고</span>
                    <span className="col-span-2">{product.stock}개</span>
                  </div>
                  {product.options.color && product.options.color.length > 0 && (
                    <div className="grid grid-cols-3 border-b pb-3">
                      <span className="font-semibold">색상</span>
                      <span className="col-span-2">{product.options.color.join(", ")}</span>
                    </div>
                  )}
                  {product.options.size && product.options.size.length > 0 && (
                    <div className="grid grid-cols-3 border-b pb-3">
                      <span className="font-semibold">사이즈</span>
                      <span className="col-span-2">{product.options.size.join(", ")}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 pb-3">
                    <span className="font-semibold">등록일</span>
                    <span className="col-span-2">{new Date(product.createdAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 text-center">
                  <div className="mb-2 text-4xl font-bold">{product.rating.toFixed(1)}</div>
                  <RatingDisplay rating={product.rating} size="lg" />
                  <p className="mt-2 text-muted-foreground">{product.reviews_count}개의 리뷰</p>
                </div>
                <div className="space-y-4 border-t pt-6">
                  {/* Dummy reviews */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="border-b pb-4 last:border-0">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">구매자{i + 1}</span>
                          <RatingDisplay rating={product.rating} size="sm" />
                        </div>
                        <span className="text-sm text-muted-foreground">2025.01.{15 - i}</span>
                      </div>
                      <p className="text-sm">
                        상품이 정말 마음에 듭니다. 품질도 좋고 가격대비 만족스러워요. 배송도 빠르고 포장도 꼼꼼하게
                        되어있었습니다. 추천합니다!
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="mb-6 text-2xl font-bold">관련 상품</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
