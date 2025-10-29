"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProductSortProps {
  value: string
  onChange: (value: string) => void
}

export function ProductSort({ value, onChange }: ProductSortProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="정렬" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="popular">인기순</SelectItem>
        <SelectItem value="newest">최신순</SelectItem>
        <SelectItem value="price-asc">가격 낮은순</SelectItem>
        <SelectItem value="price-desc">가격 높은순</SelectItem>
      </SelectContent>
    </Select>
  )
}
