# K-Shop - 한국 온라인 쇼핑몰 데모

프론트엔드 전용 이커머스 데모 애플리케이션입니다. 백엔드 호출 없이 로컬에서 100% 동작하며, 한국 쇼핑몰 스타일의 깔끔하고 현대적인 UI/UX를 제공합니다.

## 기술 스택

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** 컴포넌트
- **lucide-react** 아이콘

## 주요 기능

### 페이지

- **홈 (/)**: 히어로 섹션, 카테고리 하이라이트, 베스트 상품, 프로모션 배너, 신상품
- **상품 카탈로그 (/products)**: 그리드 뷰, 필터링, 정렬, 페이지네이션
- **상품 상세 (/products/[slug])**: 이미지 갤러리, 옵션 선택, 수량 조절, 장바구니/위시리스트, 상세정보 탭, 관련 상품
- **장바구니 (/cart)**: 수량 변경, 삭제, 쿠폰 입력, 무료배송 진행바, 주문 요약
- **위시리스트 (/wishlist)**: 저장된 상품 관리
- **결제 (/checkout)**: 3단계 마법사 (배송정보 → 결제정보 → 주문확인)
- **주문 완료 (/success)**: 주문 완료 화면
- **검색 (/search)**: 클라이언트 사이드 퍼지 검색

### 기능

- **필터링**: 카테고리, 가격대, 평점, 태그별 필터
- **정렬**: 인기순, 최신순, 가격 낮은순/높은순
- **장바구니**: localStorage 기반 영구 저장
- **위시리스트**: localStorage 기반 영구 저장
- **검색**: 300ms 디바운스 적용된 실시간 검색
- **다크모드**: 테마 토글 지원
- **반응형**: 모바일, 태블릿, 데스크톱 대응

## 데이터 구조

### 상품 데이터 (`/data/products.json`)

50개의 더미 상품 데이터:
- id, slug, title, description
- price (KRW), currency
- images[] (picsum.photos 사용)
- category, tags[]
- rating (0-5), reviews_count
- options (size[], color[])
- stock, createdAt

### 카테고리 데이터 (`/data/categories.json`)

6개 카테고리:
- 패션, 전자기기, 뷰티, 홈·리빙, 스포츠, 식품

## 실행 방법

\`\`\`bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 브라우저에서 열기
# http://localhost:3000
\`\`\`

## 프로젝트 구조

\`\`\`
├── app/                      # Next.js App Router 페이지
│   ├── layout.tsx           # 루트 레이아웃 (헤더, 푸터)
│   ├── page.tsx             # 홈페이지
│   ├── products/            # 상품 관련 페이지
│   ├── cart/                # 장바구니
│   ├── wishlist/            # 위시리스트
│   ├── checkout/            # 결제
│   ├── success/             # 주문 완료
│   └── search/              # 검색
├── components/              # 재사용 가능한 컴포넌트
│   ├── ui/                  # shadcn/ui 컴포넌트
│   ├── header.tsx           # 글로벌 헤더
│   ├── footer.tsx           # 글로벌 푸터
│   ├── product-card.tsx     # 상품 카드
│   ├── product-filters.tsx  # 필터 컴포넌트
│   └── ...
├── data/                    # Mock 데이터
│   ├── products.json        # 상품 데이터
│   └── categories.json      # 카테고리 데이터
├── hooks/                   # 커스텀 훅
│   ├── use-cart.ts          # 장바구니 관리
│   └── use-wishlist.ts      # 위시리스트 관리
├── lib/                     # 유틸리티 함수
│   ├── types.ts             # TypeScript 타입 정의
│   ├── products.ts          # 상품 관련 함수
│   └── format.ts            # 포맷팅 함수
└── app/globals.css          # 글로벌 스타일 (Tailwind)
\`\`\`

## 주요 컴포넌트

- **ProductCard**: 상품 카드 (이미지, 제목, 가격, 평점)
- **ProductFilters**: 필터 사이드바 (카테고리, 가격, 평점, 태그)
- **ProductSort**: 정렬 드롭다운
- **Pagination**: 페이지네이션
- **QuantitySelector**: 수량 선택기
- **RatingDisplay**: 별점 표시
- **ProductImageGallery**: 이미지 갤러리 (썸네일 포함)
- **Breadcrumbs**: 브레드크럼 네비게이션

## 데이터 처리

- 모든 데이터는 `/data/*.json` 파일에서 로드
- 외부 API 호출 없음
- 장바구니/위시리스트는 localStorage에 저장
- 검색/필터/정렬은 클라이언트 사이드에서 처리
- 통화 표기: `Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' })`

## UX/UI 특징

- **스티키 헤더**: 스크롤 시 상단 고정
- **브레드크럼**: 현재 위치 표시
- **스켈레톤 로더**: 로딩 상태 표시
- **토스트 알림**: 액션 피드백
- **빈 상태**: 장바구니/위시리스트/검색 결과 없음
- **접근성**: 시맨틱 HTML, 포커스 스타일, 키보드 조작
- **다크모드**: 테마 토글
- **반응형**: 모바일 우선 디자인

## 스타일 가이드

- **색상**: 미니멀, 3-5개 색상 사용
- **타이포그래피**: Geist Sans (본문), Geist Mono (코드)
- **레이아웃**: Flexbox 우선, Grid는 복잡한 2D 레이아웃에만 사용
- **간격**: Tailwind 스페이싱 스케일 사용
- **라운드**: 2xl (10px)
- **그림자**: 소프트 그림자

## 제한사항

- 백엔드 없음 (인증, 결제 연동 없음)
- 실제 결제 처리 없음 (더미 데이터만)
- 외부 네트워크 호출 없음 (이미지는 picsum.photos 사용)
- 분석/로그 없음

## 라이선스

MIT
