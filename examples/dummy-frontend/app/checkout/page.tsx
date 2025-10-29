"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useCart } from "@/hooks/use-cart"
import { getProductById } from "@/lib/products"
import { formatPrice } from "@/lib/format"
import { useToast } from "@/hooks/use-toast"
import type { CheckoutFormData } from "@/lib/types"

const FREE_SHIPPING_THRESHOLD = 50000

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, clearCart, isLoaded } = useCart()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<CheckoutFormData>({
    name: "",
    phone: "",
    email: "",
    address: "",
    addressDetail: "",
    postalCode: "",
    paymentMethod: "card",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
  })

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

  if (cartItems.length === 0) {
    router.push("/cart")
    return null
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 3000
  const total = subtotal + shippingCost

  const updateFormData = (field: keyof CheckoutFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.name || !formData.phone || !formData.email || !formData.address || !formData.postalCode) {
        toast({
          title: "필수 정보를 입력해주세요",
          description: "배송 정보를 모두 입력해주세요.",
          variant: "destructive",
        })
        return false
      }
    } else if (step === 2) {
      if (formData.paymentMethod === "card") {
        if (!formData.cardNumber || !formData.cardExpiry || !formData.cardCvc) {
          toast({
            title: "결제 정보를 입력해주세요",
            description: "카드 정보를 모두 입력해주세요.",
            variant: "destructive",
          })
          return false
        }
      }
    }
    return true
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = () => {
    if (validateStep(2)) {
      // Simulate order processing
      clearCart()
      router.push("/success")
    }
  }

  const steps = [
    { number: 1, title: "배송정보" },
    { number: 2, title: "결제정보" },
    { number: 3, title: "주문확인" },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">주문/결제</h1>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    currentStep >= step.number
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground text-muted-foreground"
                  }`}
                >
                  {currentStep > step.number ? <Check className="h-5 w-5" /> : step.number}
                </div>
                <span
                  className={`mt-2 text-sm font-medium ${currentStep >= step.number ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-4 h-0.5 flex-1 ${currentStep > step.number ? "bg-primary" : "bg-muted-foreground/30"}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Step 1: Shipping Info */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name">이름 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateFormData("name", e.target.value)}
                        placeholder="홍길동"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">연락처 *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => updateFormData("phone", e.target.value)}
                        placeholder="010-1234-5678"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">이메일 *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      placeholder="example@email.com"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="postalCode">우편번호 *</Label>
                      <Input
                        id="postalCode"
                        value={formData.postalCode}
                        onChange={(e) => updateFormData("postalCode", e.target.value)}
                        placeholder="12345"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="address">주소 *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => updateFormData("address", e.target.value)}
                        placeholder="서울시 강남구 테헤란로 123"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="addressDetail">상세주소</Label>
                    <Input
                      id="addressDetail"
                      value={formData.addressDetail}
                      onChange={(e) => updateFormData("addressDetail", e.target.value)}
                      placeholder="101동 1001호"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Payment Info */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label className="mb-3 block">결제 방법</Label>
                    <RadioGroup
                      value={formData.paymentMethod}
                      onValueChange={(value) => updateFormData("paymentMethod", value)}
                    >
                      <div className="flex items-center space-x-2 rounded-lg border p-4">
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="flex-1 cursor-pointer">
                          신용/체크카드
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border p-4">
                        <RadioGroupItem value="transfer" id="transfer" />
                        <Label htmlFor="transfer" className="flex-1 cursor-pointer">
                          계좌이체
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border p-4">
                        <RadioGroupItem value="phone" id="phone" />
                        <Label htmlFor="phone" className="flex-1 cursor-pointer">
                          휴대폰 결제
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {formData.paymentMethod === "card" && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <div>
                        <Label htmlFor="cardNumber">카드번호 *</Label>
                        <Input
                          id="cardNumber"
                          value={formData.cardNumber}
                          onChange={(e) => updateFormData("cardNumber", e.target.value)}
                          placeholder="1234-5678-9012-3456"
                          maxLength={19}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="cardExpiry">유효기간 *</Label>
                          <Input
                            id="cardExpiry"
                            value={formData.cardExpiry}
                            onChange={(e) => updateFormData("cardExpiry", e.target.value)}
                            placeholder="MM/YY"
                            maxLength={5}
                          />
                        </div>
                        <div>
                          <Label htmlFor="cardCvc">CVC *</Label>
                          <Input
                            id="cardCvc"
                            value={formData.cardCvc}
                            onChange={(e) => updateFormData("cardCvc", e.target.value)}
                            placeholder="123"
                            maxLength={3}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.paymentMethod === "transfer" && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">
                        주문 완료 후 계좌 정보가 제공됩니다. 입금 확인 후 배송이 시작됩니다.
                      </p>
                    </div>
                  )}

                  {formData.paymentMethod === "phone" && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">
                        주문 완료 후 휴대폰 결제 인증 페이지로 이동합니다.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 font-semibold">배송 정보</h3>
                    <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
                      <p>
                        <span className="font-medium">이름:</span> {formData.name}
                      </p>
                      <p>
                        <span className="font-medium">연락처:</span> {formData.phone}
                      </p>
                      <p>
                        <span className="font-medium">이메일:</span> {formData.email}
                      </p>
                      <p>
                        <span className="font-medium">주소:</span> ({formData.postalCode}) {formData.address}{" "}
                        {formData.addressDetail}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-semibold">결제 정보</h3>
                    <div className="rounded-lg bg-muted p-4 text-sm">
                      <p>
                        <span className="font-medium">결제 방법:</span>{" "}
                        {formData.paymentMethod === "card"
                          ? "신용/체크카드"
                          : formData.paymentMethod === "transfer"
                            ? "계좌이체"
                            : "휴대폰 결제"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-semibold">주문 상품</h3>
                    <div className="space-y-3">
                      {cartItems.map((item) => (
                        <div key={`${item.productId}-${JSON.stringify(item.selectedOptions)}`} className="flex gap-3">
                          <div className="relative h-16 w-16 shrink-0">
                            <Image
                              src={item.product.images[0] || "/placeholder.svg"}
                              alt={item.product.title}
                              fill
                              className="rounded-lg object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.product.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.selectedOptions.color && `색상: ${item.selectedOptions.color}`}
                              {item.selectedOptions.color && item.selectedOptions.size && " / "}
                              {item.selectedOptions.size && `사이즈: ${item.selectedOptions.size}`}
                            </p>
                            <p className="text-sm">
                              {formatPrice(item.product.price)} x {item.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-6 flex gap-3">
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handleBack} className="bg-transparent">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    이전
                  </Button>
                )}
                {currentStep < 3 ? (
                  <Button onClick={handleNext} className="ml-auto">
                    다음
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} className="ml-auto">
                    결제하기
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>주문 요약</CardTitle>
            </CardHeader>
            <CardContent>
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

              <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                <p>• 주문 완료 후 배송 정보를 이메일로 보내드립니다.</p>
                <p>• 배송은 영업일 기준 2-3일 소요됩니다.</p>
                <p>• 제주도 및 도서산간 지역은 추가 배송비가 발생할 수 있습니다.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
