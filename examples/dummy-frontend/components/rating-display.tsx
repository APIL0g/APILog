import { Star } from "lucide-react"

interface RatingDisplayProps {
  rating: number
  reviewCount?: number
  size?: "sm" | "md" | "lg"
}

export function RatingDisplay({ rating, reviewCount, size = "md" }: RatingDisplayProps) {
  const starSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4"
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm"

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`${starSize} ${i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
      <span className={`${textSize} font-medium`}>{rating.toFixed(1)}</span>
      {reviewCount !== undefined && <span className={`${textSize} text-muted-foreground`}>({reviewCount})</span>}
    </div>
  )
}
