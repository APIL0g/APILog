"use client"

import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllCategories } from "@/lib/products"
import { formatPrice } from "@/lib/format"

interface ProductFiltersProps {
  selectedCategory?: string
  selectedTags: string[]
  priceRange: [number, number]
  minRating: number
  onCategoryChange: (category: string | undefined) => void
  onTagsChange: (tags: string[]) => void
  onPriceRangeChange: (range: [number, number]) => void
  onMinRatingChange: (rating: number) => void
  onReset: () => void
}

const availableTags = ["베스트", "신상품", "프리미엄", "세일", "친환경", "유기농"]

export function ProductFilters({
  selectedCategory,
  selectedTags,
  priceRange,
  minRating,
  onCategoryChange,
  onTagsChange,
  onPriceRangeChange,
  onMinRatingChange,
  onReset,
}: ProductFiltersProps) {
  const categories = getAllCategories()

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>필터</CardTitle>
          <Button variant="ghost" size="sm" onClick={onReset}>
            초기화
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Filter */}
        <div>
          <Label className="mb-3 block text-base font-semibold">카테고리</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="category-all"
                checked={!selectedCategory}
                onCheckedChange={() => onCategoryChange(undefined)}
              />
              <label
                htmlFor="category-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                전체
              </label>
            </div>
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={selectedCategory === category.slug}
                  onCheckedChange={() => onCategoryChange(category.slug)}
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {category.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Price Range Filter */}
        <div>
          <Label className="mb-3 block text-base font-semibold">가격대</Label>
          <div className="space-y-4">
            <Slider
              min={0}
              max={300000}
              step={10000}
              value={priceRange}
              onValueChange={(value) => onPriceRangeChange(value as [number, number])}
              className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatPrice(priceRange[0])}</span>
              <span>{formatPrice(priceRange[1])}</span>
            </div>
          </div>
        </div>

        {/* Rating Filter */}
        <div>
          <Label className="mb-3 block text-base font-semibold">평점</Label>
          <div className="space-y-2">
            {[0, 3, 4, 4.5].map((rating) => (
              <div key={rating} className="flex items-center space-x-2">
                <Checkbox
                  id={`rating-${rating}`}
                  checked={minRating === rating}
                  onCheckedChange={() => onMinRatingChange(rating)}
                />
                <label
                  htmlFor={`rating-${rating}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {rating === 0 ? "전체" : `${rating}점 이상`}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Tags Filter */}
        <div>
          <Label className="mb-3 block text-base font-semibold">태그</Label>
          <div className="space-y-2">
            {availableTags.map((tag) => (
              <div key={tag} className="flex items-center space-x-2">
                <Checkbox
                  id={`tag-${tag}`}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => handleTagToggle(tag)}
                />
                <label
                  htmlFor={`tag-${tag}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {tag}
                </label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
