"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Minus, Plus } from "lucide-react"

interface QuantitySelectorProps {
  value: number
  onChange: (value: number) => void
  max?: number
  min?: number
}

export function QuantitySelector({ value, onChange, max = 99, min = 1 }: QuantitySelectorProps) {
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number.parseInt(e.target.value)
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onChange(newValue)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={handleDecrement} disabled={value <= min}>
        <Minus className="h-4 w-4" />
        <span className="sr-only">수량 감소</span>
      </Button>
      <Input
        type="number"
        value={value}
        onChange={handleInputChange}
        className="w-16 text-center"
        min={min}
        max={max}
      />
      <Button variant="outline" size="icon" onClick={handleIncrement} disabled={value >= max}>
        <Plus className="h-4 w-4" />
        <span className="sr-only">수량 증가</span>
      </Button>
    </div>
  )
}
