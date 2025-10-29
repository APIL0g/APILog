import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Package, Home } from "lucide-react"

export default function SuccessPage() {
  // Generate a random order number
  const orderNumber = `ORD-${Date.now().toString().slice(-8)}`

  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="mx-auto max-w-2xl">
        <CardContent className="p-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
          </div>

          <h1 className="mb-4 text-3xl font-bold">주문이 완료되었습니다!</h1>
          <p className="mb-2 text-lg text-muted-foreground">주문해 주셔서 감사합니다.</p>
          <p className="mb-8 text-sm text-muted-foreground">주문 번호: {orderNumber}</p>

          <div className="mb-8 rounded-lg bg-muted p-6">
            <div className="mb-4 flex items-center justify-center gap-2 text-primary">
              <Package className="h-5 w-5" />
              <span className="font-semibold">배송 안내</span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• 주문 확인 후 2-3일 이내에 배송이 시작됩니다.</p>
              <p>• 배송 정보는 등록하신 이메일로 발송됩니다.</p>
              <p>• 배송 조회는 마이페이지에서 확인하실 수 있습니다.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/">
                <Home className="mr-2 h-5 w-5" />
                홈으로
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-transparent">
              <Link href="/products">쇼핑 계속하기</Link>
            </Button>
          </div>

          <div className="mt-8 border-t pt-6">
            <p className="text-sm text-muted-foreground">문의사항이 있으시면 고객센터(1588-0000)로 연락주세요.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
