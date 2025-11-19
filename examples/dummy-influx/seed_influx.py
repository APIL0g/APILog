"""
InfluxDB seeding utility that generates realistic e-commerce session data.
리얼한 전자상거래 시나리오 기반으로 InfluxDB에 더미 데이터를 적재합니다.
"""

from __future__ import annotations

import html
import json
import os
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple
from uuid import uuid4

import requests

INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb3-core:8181").rstrip("/")
DATABASE = os.getenv("INFLUX_DATABASE", "apilog_db")
EVENT_COUNT = int(os.getenv("SEED_EVENT_COUNT", "50000"))
DAYS = int(os.getenv("SEED_DAYS", "30"))
BATCH_SIZE = int(os.getenv("SEED_BATCH_SIZE", "5000"))
USER_HASH_POOL_SIZE = int(os.getenv("SEED_USER_HASH_POOL_SIZE", "500"))


@dataclass(frozen=True)
class Product:
    slug: str
    category: str
    price: float
    title: str
    discount: float
    tags: Sequence[str]
    image: str | None = None


@dataclass(frozen=True)
class VisitorProfile:
    name: str
    weight: float
    device_type: str
    browser_family: str
    country_code: str


REPO_ROOT = Path(__file__).resolve().parents[2]
PRODUCTS_PATH = REPO_ROOT / "examples" / "dummy-frontend" / "data" / "products.json"

VISITOR_PROFILES: List[VisitorProfile] = [
    VisitorProfile(
        name="kr_desktop_chrome",
        weight=0.38,
        device_type="desktop",
        browser_family="Chrome",
        country_code="KR",
    ),
    VisitorProfile(
        name="kr_mobile_ios",
        weight=0.22,
        device_type="mobile",
        browser_family="Mobile Safari",
        country_code="KR",
    ),
    VisitorProfile(
        name="kr_mobile_android",
        weight=0.18,
        device_type="mobile",
        browser_family="Chrome Mobile",
        country_code="KR",
    ),
    VisitorProfile(
        name="us_desktop_chrome",
        weight=0.08,
        device_type="desktop",
        browser_family="Chrome",
        country_code="US",
    ),
    VisitorProfile(
        name="jp_desktop_firefox",
        weight=0.06,
        device_type="desktop",
        browser_family="Firefox",
        country_code="JP",
    ),
    VisitorProfile(
        name="tablet_safari",
        weight=0.08,
        device_type="tablet",
        browser_family="Mobile Safari",
        country_code="KR",
    ),
]


def _build_user_hash_pool(size: int) -> Dict[str, List[str]]:
    pool: Dict[str, List[str]] = {}
    size = max(1, size)
    for profile in VISITOR_PROFILES:
        pool[profile.name] = [uuid4().hex for _ in range(size)]
    return pool


USER_HASH_POOL = _build_user_hash_pool(USER_HASH_POOL_SIZE)


def _pick_user_hash(profile_name: str) -> str:
    pool = USER_HASH_POOL.setdefault(profile_name, [])
    if not pool:
        pool.append(uuid4().hex)
    if random.random() < 0.05:
        fresh = uuid4().hex
        if len(pool) < USER_HASH_POOL_SIZE * 2:
            pool.append(fresh)
        else:
            pool[random.randrange(len(pool))] = fresh
        return fresh
    return random.choice(pool)

SITE_POOL = [
    {"id": "main", "weight": 0.6},
    {"id": "campaign", "weight": 0.18},
    {"id": "beta", "weight": 0.12},
    {"id": "event", "weight": 0.1},
]

ELEMENT_HTML_SNIPPETS = {
    "brand-logo": '<a class="flex items-center gap-2" href="/">'
    '<span class="text-2xl font-black text-[var(--color-coupang-orange)]">번개마켓</span></a>',
    "nav-all-products": '<a class="text-sm font-medium hover:text-[var(--color-coupang-orange)]" '
    'href="/products">전체상품</a>',
    "nav-fashion": '<a class="text-sm hover:text-[var(--color-coupang-orange)]" '
    'href="/products?category=fashion">패션</a>',
    "nav-electronics": '<a class="text-sm hover:text-[var(--color-coupang-orange)]" '
    'href="/products?category=electronics">전자기기</a>',
    "nav-beauty": '<a class="text-sm hover:text-[var(--color-coupang-orange)]" '
    'href="/products?category=beauty">뷰티</a>',
    "nav-home": '<a class="text-sm hover:text-[var(--color-coupang-orange)]" '
    'href="/products?category=home">홈·리빙</a>',
    "nav-sports": '<a class="text-sm hover:text-[var(--color-coupang-orange)]" '
    'href="/products?category=sports">스포츠</a>',
    "nav-food": '<a class="text-sm hover:text-[var(--color-coupang-orange)]" '
    'href="/products?category=food">식품</a>',
    "hero-all-products": (
        "<a data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all "
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 "
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-10 rounded-md px-6 has-[&gt;svg]:px-4 text-base bg-white "
        "text-[var(--color-coupang-orange)] hover:bg-white/90 font-bold\" href=\"/products\">전체상품 보기"
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" "
        "stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" "
        "class=\"lucide lucide-arrow-right ml-2 h-5 w-5\"><path d=\"M5 12h14\"></path><path d=\"m12 5 7 7-7 7\"></path></svg></a>"
    ),
    "hero-electronics": (
        "<a data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all "
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 "
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shadow-xs hover:text-accent-foreground dark:bg-input/30 "
        "dark:border-input dark:hover:bg-input/50 h-10 rounded-md px-6 has-[&gt;svg]:px-4 text-base bg-transparent border-2 border-white "
        "text-white hover:bg-white/10 font-bold\" href=\"/products?category=electronics\">전자기기 특가</a>"
    ),
    "wishlist-button": (
        "<button data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium "
        "transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 "
        "shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] "
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent "
        "hover:text-accent-foreground dark:hover:bg-accent/50 size-9 relative\"><svg xmlns=\"http://www.w3.org/2000/svg\" "
        "width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" "
        "stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-heart h-5 w-5\"><path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"></path></svg>"
        "<span class=\"sr-only\">위시리스트</span></button>"
    ),
    "cart-icon-button": (
        "<button data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium "
        "transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 "
        "shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] "
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent "
        "hover:text-accent-foreground dark:hover:bg-accent/50 size-9 relative\"><svg xmlns=\"http://www.w3.org/2000/svg\" "
        "width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" "
        "stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-shopping-cart h-5 w-5\"><circle cx=\"8\" cy=\"21\" r=\"1\"></circle><circle cx=\"19\" cy=\"21\" r=\"1\"></circle><path d=\"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12\"></path></svg>"
        "<span class=\"sr-only\">장바구니</span></button>"
    ),
    "cart-continue-primary": (
        "<a data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all "
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 "
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-10 "
        "rounded-md px-6 has-[&gt;svg]:px-4\" href=\"/products\">쇼핑 계속하기</a>"
    ),
    "cart-continue-outline": (
        "<a data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all "
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 "
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border shadow-xs hover:bg-accent hover:text-accent-foreground "
        "dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-10 rounded-md px-6 has-[&gt;svg]:px-4 mt-2 w-full bg-transparent\" "
        "href=\"/products\">쇼핑 계속하기</a>"
    ),
    "cart-order-button": (
        "<a data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all "
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 "
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-10 "
        "rounded-md px-6 has-[&gt;svg]:px-4 mt-6 w-full\" href=\"/checkout\">주문하기</a>"
    ),
    "checkout-next": (
        "<button data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium "
        "transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 "
        "shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] "
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground "
        "hover:bg-primary/90 h-9 px-4 py-2 has-[&gt;svg]:px-3 ml-auto\">다음<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" "
        "viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" "
        "class=\"lucide lucide-chevron-right ml-2 h-4 w-4\"><path d=\"m9 18 6-6-6-6\"></path></svg></button>"
    ),
    "quantity-input": (
        "<input data-slot=\"input\" class=\"file:text-foreground placeholder:text-muted-foreground selection:bg-primary "
        "selection:text-primary-foreground dark:bg-input/30 border-input h-9 min-w-0 rounded-md border bg-transparent px-3 py-1 "
        "text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent "
        "file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm "
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-16 text-center\" min=\"1\" max=\"89\" type=\"number\" value=\"1\">"
    ),
    "quantity-plus": (
        "<button data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium "
        "transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 "
        "shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] "
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs "
        "hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9\"><svg xmlns=\"http://www.w3.org/2000/svg\" "
        "width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" "
        "stroke-linejoin=\"round\" class=\"lucide lucide-plus h-4 w-4\"><path d=\"M5 12h14\"></path><path d=\"M12 5v14\"></path></svg><span class=\"sr-only\">수량 증가</span></button>"
    ),
    "quantity-minus": (
        "<button data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium "
        "transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 "
        "shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] "
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs "
        "hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9\"><svg xmlns=\"http://www.w3.org/2000/svg\" "
        "width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" "
        "stroke-linejoin=\"round\" class=\"lucide lucide-minus h-4 w-4\"><path d=\"M5 12h14\"></path></svg><span class=\"sr-only\">수량 감소</span></button>"
    ),
    "color-gray-radio": (
        "<button type=\"button\" role=\"radio\" aria-checked=\"false\" data-state=\"unchecked\" value=\"그레이\" "
        "data-slot=\"radio-group-item\" class=\"border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 "
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square "
        "size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] "
        "disabled:cursor-not-allowed disabled:opacity-50 peer sr-only\" id=\"color-그레이\" tabindex=\"0\" data-radix-collection-item=\"\"></button>"
        "<span data-apilog-label-preview=\"true\" style=\"display: inline-block; margin-left: 0.5rem;\">그레이</span>"
    ),
    "product-add-to-cart": (
        "<button data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all "
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 "
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-md "
        "px-6 has-[&gt;svg]:px-4 flex-1\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" "
        "stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-shopping-cart mr-2 h-5 w-5\"><circle cx=\"8\" cy=\"21\" r=\"1\"></circle><circle cx=\"19\" cy=\"21\" r=\"1\"></circle><path d=\"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12\"></path></svg>장바구니</button>"
    ),
    "product-buy-now": (
        "<button data-slot=\"button\" class=\"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all "
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 "
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 "
        "dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-10 "
        "rounded-md px-6 has-[&gt;svg]:px-4 w-full\">바로 구매</button>"
    ),
    "unknown": "unknown",
}

CATEGORY_NAV_ITEMS = [
    {"key": "nav-fashion", "category": "fashion"},
    {"key": "nav-electronics", "category": "electronics"},
    {"key": "nav-beauty", "category": "beauty"},
    {"key": "nav-home", "category": "home"},
    {"key": "nav-sports", "category": "sports"},
    {"key": "nav-food", "category": "food"},
]

HEADER_ACTIONS = [
    {"key": "wishlist-button", "target": "/wishlist"},
    {"key": "cart-icon-button", "target": "/cart"},
]

HOME_PRIMARY_CTA = ["hero-all-products", "hero-electronics"]

TAG_KEYS = [
    "site_id",
    "path",
    "event_name",
    "device_type",
    "browser_family",
    "country_code",
]

FIELD_ORDER = [
    "count",
    "session_id",
    "user_hash",
    "path_raw",
    "dwell_ms",
    "scroll_pct",
    "click_x",
    "click_y",
    "viewport_click_x",
    "viewport_click_y",
    "element_rel_x",
    "element_rel_y",
    "element_rect_x",
    "element_rect_y",
    "element_rect_w",
    "element_rect_h",
    "element_hash",
    "error_flag",
    "extra_json",
]


def wait_for_influx(timeout: int = 120) -> None:
    """Wait until the /health endpoint responds OK."""
    url = f"{INFLUX_URL}/health"
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(url, timeout=2)
            if resp.ok:
                print("✅ InfluxDB is up")
                return
        except Exception:
            pass
        print("⏳ Waiting for InfluxDB...")
        time.sleep(2)
    raise RuntimeError("InfluxDB not ready within timeout")


def _load_products() -> List[Product]:
    if PRODUCTS_PATH.exists():
        try:
            raw = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"⚠️  Failed to read {PRODUCTS_PATH}: {exc}")
            raw = []
    else:
        raw = []

    if not raw:
        # Fallback minimal catalog so the script still runs.
        raw = [
            {
                "slug": "premium-cotton-tshirt",
                "category": "fashion",
                "price": 29000,
                "title": "프리미엄 코튼 티셔츠",
                "discountPercent": 36,
                "tags": ["베스트"],
            },
            {
                "slug": "wireless-earbuds-pro",
                "category": "electronics",
                "price": 189000,
                "title": "무선 이어버드 프로",
                "discountPercent": 27,
                "tags": ["프리미엄"],
            },
            {
                "slug": "yoga-mat-premium",
                "category": "sports",
                "price": 52000,
                "title": "프리미엄 요가 매트",
                "discountPercent": 33,
                "tags": ["운동"],
            },
        ]

    products: List[Product] = []
    for item in raw:
        try:
            products.append(
                Product(
                    slug=item["slug"],
                    category=item.get("category", "misc"),
                    price=float(item.get("price") or 0),
                    title=item.get("title") or item["slug"],
                    discount=float(item.get("discountPercent") or 0),
                    tags=item.get("tags") or [],
                    image=(item.get("images") or [None])[0],
                )
            )
        except KeyError:
            continue
    return products


PRODUCTS: List[Product] = _load_products()
PRODUCT_LOOKUP: Dict[str, Product] = {item.slug: item for item in PRODUCTS}


def _product_card_html(slug: str) -> str:
    product = PRODUCT_LOOKUP.get(slug)
    title = html.escape(product.title if product else slug)
    category = html.escape(product.category if product else "misc")
    image = html.escape(product.image or f"https://picsum.photos/seed/{slug}/800/800")
    return (
        f'<a href="/products/{slug}"><div data-slot="card" '
        f'class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 shadow-sm group h-full '
        f'overflow-hidden transition-all hover:shadow-md border">'
        f'<div class="relative aspect-square overflow-hidden bg-muted"><img alt="{title}" loading="lazy" '
        f'decoding="async" data-nimg="fill" class="object-cover transition-transform group-hover:scale-105" src="{image}"></div>'
        f'<div class="px-6 flex flex-col gap-2"><span class="font-semibold text-lg">{title}</span>'
        f'<span class="text-sm text-muted-foreground">{category}</span></div></div></a>'
    )


def _product_weights(items: Sequence[Product]) -> List[float]:
    weights: List[float] = []
    for item in items:
        base = 1.0 + (item.discount / 100.0)
        if any("베스트" in tag for tag in item.tags):
            base += 0.8
        if item.category in {"electronics", "fashion"}:
            base += 0.3
        weights.append(max(base, 0.1))
    return weights


PRODUCT_WEIGHTS = _product_weights(PRODUCTS)


def _weighted_choice(seq: Sequence, weights: Sequence[float]) -> object:
    return random.choices(seq, weights=weights, k=1)[0]


def _weighted_choice_dict(options: Sequence[Dict[str, object]]) -> Dict[str, object]:
    weights = [float(opt.get("weight", 1.0)) for opt in options]
    return _weighted_choice(options, weights)


def _pick_profile() -> VisitorProfile:
    weights = [profile.weight for profile in VISITOR_PROFILES]
    return _weighted_choice(VISITOR_PROFILES, weights)  # type: ignore[arg-type]


def _escape_tag_value(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(" ", "\\ ")
        .replace(",", "\\,")
        .replace("=", "\\=")
    )


def _escape_field_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _element_html(key: str) -> str:
    if key.startswith("product-card:"):
        slug = key.split(":", 1)[1]
        return _product_card_html(slug)

    snippet = ELEMENT_HTML_SNIPPETS.get(key)
    if snippet:
        return snippet

    safe_key = key or "unknown"
    safe_attr = safe_key.replace('"', "&quot;")
    safe_text = safe_key.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<div data-apilog-element="{safe_attr}">{safe_text}</div>'


def _format_field(key: str, value) -> str:
    if isinstance(value, bool):
        return f"{key}={'true' if value else 'false'}"
    if isinstance(value, int):
        return f"{key}={value}i"
    if isinstance(value, float):
        return f"{key}={value:.6f}"
    text = _escape_field_string(str(value))
    return f'{key}="{text}"'


def _event_to_line(event: Dict[str, object]) -> str:
    tags = ",".join(f"{key}={_escape_tag_value(str(event[key]))}" for key in TAG_KEYS)
    fields = [_format_field(key, event[key]) for key in FIELD_ORDER if key in event]

    extra_keys = [k for k in event.keys() if k not in TAG_KEYS + FIELD_ORDER + ["ts_ns"]]
    for key in sorted(extra_keys):
        fields.append(_format_field(key, event[key]))

    return f"events,{tags} {','.join(fields)} {event['ts_ns']}"


def _base_event(ctx: Dict[str, object]) -> Dict[str, object]:
    return {
        "count": 1,
        "session_id": ctx["session_id"],
        "user_hash": ctx["user_hash"],
        "device_type": ctx["device_type"],
        "browser_family": ctx["browser_family"],
        "country_code": ctx["country_code"],
        "site_id": ctx["site_id"],
        "path_raw": "/",
        "scroll_pct": 0.0,
        "dwell_ms": 0,
        "error_flag": False,
        "extra_json": "{}",
    }


def _make_ctx() -> Dict[str, object]:
    profile = _pick_profile()
    site = _weighted_choice_dict(SITE_POOL)
    ctx = {
        "profile": profile,
        "site_id": site["id"],
        "session_id": uuid4().hex,
        "user_hash": _pick_user_hash(profile.name),
        "device_type": profile.device_type,
        "browser_family": profile.browser_family,
        "country_code": profile.country_code,
    }
    return ctx


def _rand_click_tuple() -> Tuple[float, float]:
    return round(random.uniform(0.05, 0.95), 4), round(random.uniform(0.05, 0.95), 4)


def _build_daily_plan(start: datetime, end: datetime, target_total: int | None = None) -> List[Tuple[datetime, datetime, int]]:
    segments: List[Tuple[datetime, datetime]] = []
    day_start = start
    while day_start < end and len(segments) < DAYS:
        day_end = min(day_start + timedelta(days=1), end)
        segments.append((day_start, day_end))
        day_start = day_end

    if not segments:
        segments.append((start, end))

    total_days = len(segments)
    if target_total is None or target_total <= 0:
        target_total = total_days * 100

    base = target_total // total_days
    remainder = target_total % total_days
    plan: List[List[object]] = [[ds, de, base] for ds, de in segments]

    while remainder > 0:
        idx = random.randrange(total_days)
        plan[idx][2] += 1
        remainder -= 1

    # Introduce light day-to-day variation while keeping totals intact
    jitter_limit = max(1, base // 4) if base else 1
    for _ in range(total_days * 2):
        donor = random.randrange(total_days)
        receiver = random.randrange(total_days)
        if donor == receiver or plan[donor][2] <= 1:
            continue
        delta = random.randint(1, min(plan[donor][2] - 1, jitter_limit))
        plan[donor][2] -= delta
        plan[receiver][2] += delta

    return [(ds, de, int(count)) for ds, de, count in plan]


def _append_event(
    ctx: Dict[str, object],
    events: List[Dict[str, object]],
    timestamp: datetime,
    *,
    path: str,
    event_name: str,
    element_key: str | None = None,
    dwell_ms: int | None = None,
    scroll_pct: float | None = None,
    click: bool = False,
    extra: Dict[str, object] | None = None,
    path_raw: str | None = None,
    error_flag: bool = False,
) -> None:
    event = _base_event(ctx)
    event["path"] = path
    event["path_raw"] = path_raw or path
    event["event_name"] = event_name
    if element_key:
        event["element_hash"] = _element_html(element_key)
    event["dwell_ms"] = dwell_ms if dwell_ms is not None else 0
    event["scroll_pct"] = (
        max(0.0, min(1.0, scroll_pct)) if scroll_pct is not None else round(random.uniform(0.05, 0.95), 6)
    )
    event["error_flag"] = error_flag
    if click:
        cx, cy = _rand_click_tuple()
        event["click_x"] = cx
        event["click_y"] = cy
        event["viewport_click_x"] = cx
        event["viewport_click_y"] = cy
        event["element_rel_x"] = cx
        event["element_rel_y"] = cy
        event["element_rect_x"] = round(random.uniform(0.01, 0.7), 4)
        event["element_rect_y"] = round(random.uniform(0.0, 0.6), 4)
        event["element_rect_w"] = round(random.uniform(0.12, 0.45), 4)
        event["element_rect_h"] = round(random.uniform(0.04, 0.25), 4)
    event["extra_json"] = json.dumps(extra or {}, ensure_ascii=False, separators=(",", ":"))
    event["ts_ns"] = int(timestamp.timestamp() * 1_000_000_000)
    events.append(event)



def _build_session(start: datetime, end: datetime, stats: Dict[str, int]) -> List[Dict[str, object]]:
    ctx = _make_ctx()
    stats["sessions"] = stats.get("sessions", 0) + 1

    current = start + (end - start) * random.random()
    session_events: List[Dict[str, object]] = []
    cart_items: List[Dict[str, object]] = []
    cart_value = 0.0
    catalog_seen = False

    def advance(seconds: float = 3.0) -> None:
        nonlocal current
        current += timedelta(seconds=random.uniform(0.5, seconds))

    def add_event(**kwargs) -> None:
        nonlocal current
        _append_event(ctx, session_events, current, **kwargs)
        advance()

    def add_page_bundle(
        path: str,
        *,
        dwell_range: Tuple[int, int] = (900, 3200),
        extra: Dict[str, object] | None = None,
        scroll: float | None = None,
    ) -> None:
        scroll_value = scroll if scroll is not None else round(random.uniform(0.25, 0.9), 6)
        add_event(path=path, event_name="page_view", element_key=None, dwell_ms=0, scroll_pct=scroll_value, extra=extra)
        if random.random() < 0.95:
            add_event(
                path=path,
                event_name="page_view_dwell",
                element_key=None,
                dwell_ms=random.randint(*dwell_range),
                scroll_pct=scroll_value,
                extra=extra,
            )
        if random.random() < 0.9:
            add_event(path=path, event_name="scroll", element_key=None, dwell_ms=0, scroll_pct=scroll_value, extra=extra)

    def go_to_catalog(category: str | None = None) -> None:
        nonlocal catalog_seen
        catalog_seen = True
        add_page_bundle("/products", extra={"category": category or "all"})

    def maybe_dead_click(path: str) -> None:
        if random.random() < 0.12:
            add_event(path=path, event_name="click", element_key="unknown", click=True, extra={"dead_click": True})

    def go_to_checkout() -> None:
        if not cart_items:
            return
        extra = {"items": len(cart_items), "cart_value": round(cart_value, 2)}
        add_page_bundle("/checkout", dwell_range=(1200, 3600), extra=extra, scroll=round(random.uniform(0.6, 0.9), 6))
        payment_error = random.random() < 0.08
        add_event(
            path="/checkout",
            event_name="click",
            element_key="checkout-next",
            click=True,
            extra=extra,
            error_flag=payment_error,
        )
        if random.random() < 0.4:
            go_to_catalog("post_checkout")

    def go_to_cart(reason: str | None = None) -> None:
        if not cart_items:
            return
        extra = {"items": len(cart_items), "cart_value": round(cart_value, 2)}
        if reason:
            extra["source"] = reason
        add_page_bundle("/cart", dwell_range=(700, 2600), extra=extra, scroll=round(random.uniform(0.3, 0.92), 6))
        if random.random() < 0.6:
            add_event(path="/cart", event_name="click", element_key="cart-continue-primary", click=True, extra=extra)
            go_to_catalog("cart_continue")
        if random.random() < 0.75:
            add_event(path="/cart", event_name="click", element_key="cart-order-button", click=True, extra=extra)
            go_to_checkout()
        elif random.random() < 0.35:
            add_event(path="/cart", event_name="click", element_key="cart-continue-outline", click=True, extra=extra)
            go_to_catalog("cart_outline")

    def visit_product(product: Product) -> None:
        nonlocal cart_value
        info = {"product_id": product.slug, "category": product.category, "price": product.price}
        add_event(
            path="/products",
            event_name="click",
            element_key=f"product-card:{product.slug}",
            click=True,
            extra=info,
        )
        product_path = f"/products/{product.slug}"
        add_page_bundle(product_path, dwell_range=(1500, 5200), extra=info, scroll=round(random.uniform(0.35, 0.85), 6))
        qty = random.randint(1, 3)
        if random.random() < 0.65:
            add_event(
                path=product_path,
                event_name="click",
                element_key="color-gray-radio",
                click=True,
                extra={**info, "option": "color"},
            )
        if random.random() < 0.8:
            add_event(
                path=product_path,
                event_name="click",
                element_key="quantity-input",
                click=True,
                extra={**info, "quantity": qty},
            )
        if random.random() < 0.55:
            control_key = "quantity-plus" if qty == 1 else random.choice(["quantity-plus", "quantity-minus"])
            add_event(
                path=product_path,
                event_name="click",
                element_key=control_key,
                click=True,
                extra={**info, "quantity": qty},
            )
        detail_extra = {**info, "quantity": qty}
        if random.random() < 0.8:
            cart_items.append(
                {
                    "product_id": product.slug,
                    "title": product.title,
                    "category": product.category,
                    "quantity": qty,
                    "unit_price": product.price,
                }
            )
            cart_value += product.price * qty
            add_event(
                path=product_path,
                event_name="click",
                element_key="product-add-to-cart",
                click=True,
                extra=detail_extra,
            )
            if random.random() < 0.55:
                go_to_cart("product_detail")
        elif random.random() < 0.35:
            add_event(
                path=product_path,
                event_name="click",
                element_key="product-buy-now",
                click=True,
                extra=detail_extra,
            )
            go_to_checkout()
        maybe_dead_click(product_path)

    def maybe_use_header_action() -> None:
        if random.random() >= 0.25:
            return
        action = random.choice(HEADER_ACTIONS)
        add_event(
            path="/",
            event_name="click",
            element_key=action["key"],
            click=True,
            extra={"target": action["target"]},
        )
        add_page_bundle(action["target"], dwell_range=(900, 2600), extra={"source": "header"})
        if action["target"] == "/wishlist":
            add_event(
                path="/wishlist",
                event_name="click",
                element_key="cart-icon-button",
                click=True,
                extra={"target": "/cart"},
            )
            add_page_bundle("/cart", dwell_range=(600, 1800), extra={"source": "wishlist"})
            add_event(
                path="/cart",
                event_name="click",
                element_key="cart-continue-primary",
                click=True,
                extra={"cta": "wishlist_return"},
            )
            go_to_catalog("wishlist")
        else:
            add_event(
                path="/cart",
                event_name="click",
                element_key="cart-continue-primary",
                click=True,
                extra={"cta": "header_cart"},
            )
            go_to_catalog("cart_header")

    add_page_bundle("/", extra={"page": "home"}, scroll=round(random.uniform(0.28, 0.7), 6))
    add_event(
        path="/",
        event_name="click",
        element_key="nav-all-products",
        click=True,
        extra={"target": "/products"},
    )
    go_to_catalog("nav")

    if random.random() < 0.6:
        cta_key = random.choice(HOME_PRIMARY_CTA)
        add_event(path="/", event_name="click", element_key=cta_key, click=True, extra={"cta": cta_key})
        go_to_catalog("cta")

    maybe_use_header_action()

    if not catalog_seen:
        go_to_catalog()

    nav_sample = random.sample(
        CATEGORY_NAV_ITEMS,
        k=random.randint(2, min(4, len(CATEGORY_NAV_ITEMS))),
    )
    for nav in nav_sample:
        add_event(
            path="/products",
            event_name="click",
            element_key=nav["key"],
            click=True,
            extra={"category": nav["category"]},
        )
        if random.random() < 0.6:
            go_to_catalog(nav["category"])

    if random.random() < 0.35:
        add_event(path="/products", event_name="click", element_key="brand-logo", click=True, extra={"target": "/"})
        add_page_bundle("/", extra={"page": "home_return"}, scroll=round(random.uniform(0.3, 0.8), 6))
        if random.random() < 0.5:
            cta_key = random.choice(HOME_PRIMARY_CTA)
            add_event(path="/", event_name="click", element_key=cta_key, click=True, extra={"cta": cta_key})
            go_to_catalog("home_return")

    product_visits = random.randint(2, 5)
    for _ in range(product_visits):
        product = _weighted_choice(PRODUCTS, PRODUCT_WEIGHTS)  # type: ignore[arg-type]
        visit_product(product)
        if random.random() < 0.25:
            go_to_catalog(product.category)

    if cart_items and random.random() < 0.5:
        go_to_cart("session_end")

    if not cart_items and random.random() < 0.2:
        add_page_bundle(
            "/wishlist",
            dwell_range=(700, 2200),
            extra={"items": random.randint(1, 4)},
            scroll=round(random.uniform(0.3, 0.8), 6),
        )

    filtered = [
        ev for ev in session_events if start.timestamp() <= ev["ts_ns"] / 1_000_000_000 <= end.timestamp()
    ]
    return filtered or session_events
def _generate_event_dicts(
    daily_plan: Sequence[Tuple[datetime, datetime, int]],
    stats: Dict[str, int],
) -> Iterable[Dict[str, object]]:
    for day_start, day_end, per_day_target in daily_plan:
        day_events = 0
        while day_events < per_day_target:
            session_events = _build_session(day_start, day_end, stats)
            if not session_events:
                continue
            for event in session_events:
                yield event
                day_events += 1
                if day_events >= per_day_target:
                    break


def seed() -> None:
    wait_for_influx()

    now = datetime.utcnow()
    start = now - timedelta(days=DAYS)
    stats: Dict[str, int] = {}
    sent = 0
    batch: List[str] = []
    daily_plan = _build_daily_plan(start, now, EVENT_COUNT)
    planned_total = sum(target for _, _, target in daily_plan)

    print(
        f"🔨 Seeding {planned_total} events across {len(daily_plan)} days (target={EVENT_COUNT}) "
        f"into DB={DATABASE} at {INFLUX_URL}"
    )

    def write_batch(lines: List[str]) -> None:
        if not lines:
            return
        payload = "\n".join(lines)
        url = f"{INFLUX_URL}/api/v3/write_lp?db={DATABASE}"
        resp = requests.post(
            url,
            data=payload.encode("utf-8"),
            headers={"Content-Type": "text/plain; charset=utf-8"},
            timeout=30,
        )
        if not resp.ok:
            raise RuntimeError(f"Write failed: {resp.status_code} {resp.text}")

    for event in _generate_event_dicts(daily_plan, stats):
        line = _event_to_line(event)
        batch.append(line)
        stats[event["event_name"]] = stats.get(event["event_name"], 0) + 1

        if len(batch) >= BATCH_SIZE:
            write_batch(batch)
            sent += len(batch)
            print(f"  -> wrote {sent}/{planned_total}")
            batch = []

    if batch:
        write_batch(batch)
        sent += len(batch)
        print(f"  -> wrote {sent}/{planned_total}")

    print("✅ Dummy seed completed")
    sessions = stats.get("sessions", 0)
    page_views = stats.get("page_view", 0)
    purchases = stats.get("purchase", 0)
    print(
        f"Sessions: {sessions} | page_view events: {page_views} | "
        f"click events: {stats.get('click', 0)} | purchases: {purchases}"
    )


if __name__ == "__main__":
    seed()
