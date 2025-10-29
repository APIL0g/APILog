import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Zap } from "lucide-react"
import type { Product } from "@/lib/types"
import { formatPrice } from "@/lib/format"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.slug}`}>
      <Card className="group h-full overflow-hidden transition-all hover:shadow-md border">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <Image
            src={product.images[0] || "/placeholder.svg"}
            alt={product.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
          {product.rocketDelivery && (
            <div className="absolute left-2 top-2">
              <Badge className="bg-[var(--color-coupang-blue)] hover:bg-[var(--color-coupang-blue)] text-white font-bold px-2 py-1">
                <Zap className="h-3 w-3 mr-1 fill-[var(--color-rocket-gold)] text-[var(--color-rocket-gold)]" />
                로켓배송
              </Badge>
            </div>
          )}
          {product.discountPercent && (
            <Badge className="absolute right-2 top-2 bg-red-500 hover:bg-red-500 text-white font-bold text-base px-2 py-1">
              {product.discountPercent}%
            </Badge>
          )}
          {product.stock < 10 && product.stock > 0 && (
            <Badge variant="destructive" className="absolute bottom-2 right-2 font-bold">
              품절임박
            </Badge>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Badge variant="destructive" className="text-base font-bold">
                품절
              </Badge>
            </div>
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
            <div className="mb-2">
              <span className="text-xs text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
            </div>
          )}
          {product.deliveryTime && (
            <div className="mb-1 text-xs text-[var(--color-coupang-blue)] font-medium">{product.deliveryTime}</div>
          )}
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{product.rating}</span>
            <span className="text-xs text-muted-foreground">({product.reviews_count.toLocaleString()})</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
