import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">번개마켓</h3>
            <p className="text-sm text-muted-foreground">
              번개처럼 빠른 배송과 최저가 보장으로 고객님께 최고의 쇼핑 경험을 제공합니다.
            </p>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">고객센터</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#" className="hover:text-foreground">
                  공지사항
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  1:1 문의
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  배송조회
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">이용안내</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#" className="hover:text-foreground">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  교환/반품 안내
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground">
                  배송 안내
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">연락처</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>대표전화: 1588-0000</li>
              <li>평일 09:00 - 18:00</li>
              <li>주말 및 공휴일 휴무</li>
              <li>이메일: support@bungaemarket.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 번개마켓. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
