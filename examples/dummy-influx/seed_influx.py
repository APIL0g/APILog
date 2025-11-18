"""
InfluxDB seeding utility that generates realistic e-commerce session data.
리얼한 전자상거래 시나리오 기반으로 InfluxDB에 더미 데이터를 적재합니다.
"""

from __future__ import annotations

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


@dataclass(frozen=True)
class Product:
    slug: str
    category: str
    price: float
    title: str
    discount: float
    tags: Sequence[str]


@dataclass(frozen=True)
class VisitorProfile:
    name: str
    weight: float
    device_type: str
    browser_family: str
    country_code: str
    viewport_choices: Sequence[Tuple[int, int]]


REPO_ROOT = Path(__file__).resolve().parents[2]
PRODUCTS_PATH = REPO_ROOT / "examples" / "dummy-frontend" / "data" / "products.json"

VISITOR_PROFILES: List[VisitorProfile] = [
    VisitorProfile(
        name="kr_desktop_chrome",
        weight=0.38,
        device_type="desktop",
        browser_family="Chrome",
        country_code="KR",
        viewport_choices=[(1920, 1080), (1680, 1050), (1440, 900)],
    ),
    VisitorProfile(
        name="kr_mobile_ios",
        weight=0.22,
        device_type="mobile",
        browser_family="Mobile Safari",
        country_code="KR",
        viewport_choices=[(390, 844), (375, 812), (414, 896)],
    ),
    VisitorProfile(
        name="kr_mobile_android",
        weight=0.18,
        device_type="mobile",
        browser_family="Chrome Mobile",
        country_code="KR",
        viewport_choices=[(412, 915), (360, 800), (393, 873)],
    ),
    VisitorProfile(
        name="us_desktop_chrome",
        weight=0.08,
        device_type="desktop",
        browser_family="Chrome",
        country_code="US",
        viewport_choices=[(1920, 1080), (2560, 1440)],
    ),
    VisitorProfile(
        name="jp_desktop_firefox",
        weight=0.06,
        device_type="desktop",
        browser_family="Firefox",
        country_code="JP",
        viewport_choices=[(1536, 864), (1920, 1080)],
    ),
    VisitorProfile(
        name="tablet_safari",
        weight=0.08,
        device_type="tablet",
        browser_family="Mobile Safari",
        country_code="KR",
        viewport_choices=[(1024, 1366), (834, 1194)],
    ),
]

SITE_POOL = [
    {"id": "main", "weight": 0.6},
    {"id": "campaign", "weight": 0.18},
    {"id": "beta", "weight": 0.12},
    {"id": "event", "weight": 0.1},
]

PAGE_VARIANTS = ["control", "variant-a", "variant-b"]

UTM_CAMPAIGNS = [
    {"source": "newsletter", "campaign": "spring-style", "weight": 0.18},
    {"source": "social", "campaign": "lookbook-live", "weight": 0.22},
    {"source": "ads", "campaign": "smart-appliances", "weight": 0.25},
    {"source": "affiliate", "campaign": "fitness-launch", "weight": 0.07},
    {"source": "direct", "campaign": "(direct)", "weight": 0.28},
]

SEARCH_QUERIES = [
    "티셔츠",
    "이어폰",
    "요가 매트",
    "노트북 가방",
    "에어프라이어",
    "수분 세럼",
    "데스크 램프",
]

FUNNEL_STEPS = {
    "landing": 1,
    "catalog": 2,
    "product": 3,
    "cart": 4,
    "checkout": 5,
    "success": 6,
}

ELEMENT_HTML_SNIPPETS = {
    "home-hero": '<section class="hero-banner" data-section="hero"><h1>Spring Sale</h1><p>Discover new arrivals</p></section>',
    "hero-cta": '<button class="btn btn-primary hero-cta" data-action="primary-cta">Shop now</button>',
    "product-grid": '<div class="product-grid" data-columns="4"><article class="product-card">Featured</article></div>',
    "search-page": '<section class="search-page"><input type="search" placeholder="Search products" /><div class="results"></div></section>',
    "search-result": '<a class="search-result-card"><span class="title">Result title</span><span class="price">KRW 59,000</span></a>',
    "product-hero": '<section class="product-hero"><h1 class="title">Essential crew neck tee</h1><p class="price">KRW 39,000</p></section>',
    "product-details": '<section class="product-details"><h2>Details</h2><ul><li>Fabric</li><li>Delivery</li></ul></section>',
    "add-to-cart": '<button class="btn btn-accent add-to-cart" data-track-click="add_to_cart">Add to cart</button>',
    "cart-summary": '<section class="cart-summary"><h1>Your cart</h1><button class="btn">Checkout</button></section>',
    "checkout-button": '<button class="btn btn-primary checkout-button" data-step="cart">Go to checkout</button>',
    "checkout-form": '<form class="checkout-form"><input name="card_number" /><button type="submit">Pay now</button></form>',
    "complete-order": '<button class="btn btn-primary submit-order" data-step="checkout">Complete order</button>',
    "order-complete": '<section class="order-complete"><h1>Thank you!</h1><p>Your order is confirmed.</p></section>',
    "wishlist-page": '<section class="wishlist-page"><h1>Wishlist</h1><ul><li>Saved item</li></ul></section>',
}

TAG_KEYS = [
    "site_id",
    "path",
    "event_name",
    "device_type",
    "browser_family",
    "country_code",
    "page_variant",
    "utm_source",
    "utm_campaign",
]

FIELD_ORDER = [
    "count",
    "session_id",
    "user_hash",
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
    "viewport_w",
    "viewport_h",
    "funnel_step",
    "error_flag",
    "bot_score",
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
                )
            )
        except KeyError:
            continue
    return products


PRODUCTS: List[Product] = _load_products()


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
    snippet = ELEMENT_HTML_SNIPPETS.get(key)
    if snippet:
        return snippet

    safe_attr = key.replace('"', "&quot;") or "unknown"
    safe_text = key.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") or "unknown element"
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
        "page_variant": ctx["page_variant"],
        "utm_source": ctx["utm_source"],
        "utm_campaign": ctx["utm_campaign"],
        "viewport_w": ctx["viewport"][0],
        "viewport_h": ctx["viewport"][1],
        "click_x": 0.0,
        "click_y": 0.0,
        "viewport_click_x": 0.0,
        "viewport_click_y": 0.0,
        "element_rel_x": 0.0,
        "element_rel_y": 0.0,
        "element_rect_x": 0.0,
        "element_rect_y": 0.0,
        "element_rect_w": 1.0,
        "element_rect_h": 0.4,
        "scroll_pct": 0.0,
        "dwell_ms": random.randint(600, 8000),
        "bot_score": round(random.betavariate(4, 2), 4),
        "error_flag": False,
        "extra_json": "{}",
    }


def _make_ctx() -> Dict[str, object]:
    profile = _pick_profile()
    site = _weighted_choice_dict(SITE_POOL)
    utm = _weighted_choice_dict(UTM_CAMPAIGNS)
    viewport = random.choice(profile.viewport_choices)
    ctx = {
        "profile": profile,
        "site_id": site["id"],
        "page_variant": random.choice(PAGE_VARIANTS),
        "utm_source": utm["source"],
        "utm_campaign": utm["campaign"],
        "session_id": uuid4().hex,
        "user_hash": f"user-{profile.name}-{random.randint(0, 99999):05d}",
        "device_type": profile.device_type,
        "browser_family": profile.browser_family,
        "country_code": profile.country_code,
        "viewport": viewport,
    }
    return ctx


def _rand_click_tuple() -> Tuple[float, float]:
    return round(random.uniform(0.05, 0.95), 4), round(random.uniform(0.05, 0.95), 4)


def _append_event(
    ctx: Dict[str, object],
    events: List[Dict[str, object]],
    timestamp: datetime,
    *,
    path: str,
    event_name: str,
    element_key: str,
    funnel_step: int,
    dwell_ms: int | None = None,
    scroll_pct: float | None = None,
    click: bool = False,
    extra: Dict[str, object] | None = None,
    error_flag: bool = False,
) -> None:
    event = _base_event(ctx)
    event["path"] = path
    event["event_name"] = event_name
    event["element_hash"] = _element_html(element_key)
    event["funnel_step"] = funnel_step
    event["dwell_ms"] = dwell_ms if dwell_ms is not None else event["dwell_ms"]
    event["scroll_pct"] = (
        max(0.0, min(1.0, scroll_pct)) if scroll_pct is not None else random.uniform(0.2, 0.95)
    )
    if click:
        cx, cy = _rand_click_tuple()
        event["click_x"] = cx
        event["click_y"] = cy
        event["viewport_click_x"] = cx
        event["viewport_click_y"] = cy
        event["element_rel_x"] = cx
        event["element_rel_y"] = cy
        event["element_rect_w"] = round(random.uniform(0.15, 0.45), 4)
        event["element_rect_h"] = round(random.uniform(0.05, 0.2), 4)
    event["error_flag"] = error_flag
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

    def advance(seconds: float = 3.0) -> None:
        nonlocal current
        current += timedelta(seconds=random.uniform(0.5, seconds))

    def add_event(**kwargs) -> None:
        nonlocal current
        _append_event(ctx, session_events, current, **kwargs)
        advance()

    # Landing
    add_event(
        path="/",
        event_name="page_view",
        element_key="home-hero",
        funnel_step=FUNNEL_STEPS["landing"],
        scroll_pct=random.uniform(0.4, 0.9),
        extra={"section": "hero"},
    )
    if random.random() < 0.55:
        add_event(
            path="/",
            event_name="click",
            element_key="hero-cta",
            funnel_step=FUNNEL_STEPS["landing"],
            click=True,
            extra={"cta": "hero_primary"},
        )

    # Catalog / search phase
    if random.random() < 0.85:
        add_event(
            path="/products",
            event_name="page_view",
            element_key="product-grid",
            funnel_step=FUNNEL_STEPS["catalog"],
            scroll_pct=random.uniform(0.5, 0.95),
            extra={"category": "all"},
        )

    if random.random() < 0.4:
        query = random.choice(SEARCH_QUERIES)
        add_event(
            path="/search",
            event_name="page_view",
            element_key="search-page",
            funnel_step=FUNNEL_STEPS["catalog"],
            scroll_pct=random.uniform(0.6, 0.95),
            extra={"query": query},
        )
        add_event(
            path="/search",
            event_name="click",
            element_key="search-result",
            funnel_step=FUNNEL_STEPS["catalog"],
            click=True,
            extra={"query": query, "position": random.randint(1, 5)},
        )

    # Product exploration
    product_visits = random.randint(1, 4)

    for _ in range(product_visits):
        product = _weighted_choice(PRODUCTS, PRODUCT_WEIGHTS)  # type: ignore[arg-type]
        product_path = f"/products/{product.slug}"
        add_event(
            path=product_path,
            event_name="page_view",
            element_key="product-hero",
            funnel_step=FUNNEL_STEPS["product"],
            scroll_pct=random.uniform(0.5, 0.9),
            extra={
                "product_id": product.slug,
                "category": product.category,
                "price": product.price,
            },
        )
        add_event(
            path=product_path,
            event_name="scroll",
            element_key="product-details",
            funnel_step=FUNNEL_STEPS["product"],
            scroll_pct=random.uniform(0.7, 1.0),
            extra={"detail_section": random.choice(["specs", "reviews", "delivery"])},
        )

        if random.random() < 0.62:
            qty = 1 if random.random() < 0.7 else 2
            cart_items.append({"slug": product.slug, "qty": qty, "price": product.price})
            cart_value += product.price * qty
            add_event(
                path=product_path,
                event_name="click",
                element_key="add-to-cart",
                funnel_step=FUNNEL_STEPS["product"],
                click=True,
                extra={"product_id": product.slug, "qty": qty},
            )

    proceeded_checkout = False
    if cart_items:
        add_event(
            path="/cart",
            event_name="page_view",
            element_key="cart-summary",
            funnel_step=FUNNEL_STEPS["cart"],
            scroll_pct=random.uniform(0.4, 0.8),
            extra={"items": len(cart_items), "order_value": cart_value},
        )
        if random.random() < 0.7:
            add_event(
                path="/cart",
                event_name="click",
                element_key="checkout-button",
                funnel_step=FUNNEL_STEPS["cart"],
                click=True,
                extra={"items": len(cart_items)},
            )
            proceeded_checkout = True

    purchase_completed = False
    if proceeded_checkout:
        add_event(
            path="/checkout",
            event_name="page_view",
            element_key="checkout-form",
            funnel_step=FUNNEL_STEPS["checkout"],
            scroll_pct=random.uniform(0.3, 0.7),
            extra={"items": len(cart_items), "order_value": cart_value},
        )
        payment_error = random.random() < 0.08
        add_event(
            path="/checkout",
            event_name="click",
            element_key="complete-order",
            funnel_step=FUNNEL_STEPS["checkout"],
            click=True,
            extra={"payment_method": random.choice(["card", "kakaopay", "naverpay"])},
            error_flag=payment_error,
        )
        if not payment_error and random.random() < 0.65:
            purchase_completed = True

    if purchase_completed:
        add_event(
            path="/success",
            event_name="page_view",
            element_key="order-complete",
            funnel_step=FUNNEL_STEPS["success"],
            scroll_pct=1.0,
            extra={"order_value": cart_value, "items": len(cart_items)},
        )
        add_event(
            path="/success",
            event_name="purchase",
            element_key="order-complete",
            funnel_step=FUNNEL_STEPS["success"],
            click=False,
            extra={
                "order_value": cart_value,
                "currency": "KRW",
                "items": len(cart_items),
                "products": cart_items,
            },
        )

    # Occasionally capture a wishlist visit even if no purchase
    if not purchase_completed and random.random() < 0.15:
        add_event(
            path="/wishlist",
            event_name="page_view",
            element_key="wishlist-page",
            funnel_step=FUNNEL_STEPS["catalog"],
            scroll_pct=random.uniform(0.5, 0.8),
            extra={"items": random.randint(1, 5)},
        )

    # Keep timestamps inside the requested window
    filtered = [
        ev for ev in session_events if start.timestamp() <= ev["ts_ns"] / 1_000_000_000 <= end.timestamp()
    ]
    return filtered or session_events


def _generate_event_dicts(
    total: int,
    start: datetime,
    end: datetime,
    stats: Dict[str, int],
) -> Iterable[Dict[str, object]]:
    produced = 0
    while produced < total:
        session_events = _build_session(start, end, stats)
        if not session_events:
            continue
        for event in session_events:
            yield event
            produced += 1
            if produced >= total:
                break


def seed() -> None:
    wait_for_influx()

    now = datetime.utcnow()
    start = now - timedelta(days=DAYS)
    stats: Dict[str, int] = {}
    sent = 0
    batch: List[str] = []

    print(
        f"🔨 Seeding {EVENT_COUNT} events spanning {DAYS} days "
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

    for event in _generate_event_dicts(EVENT_COUNT, start, now, stats):
        line = _event_to_line(event)
        batch.append(line)
        stats[event["event_name"]] = stats.get(event["event_name"], 0) + 1

        if len(batch) >= BATCH_SIZE:
            write_batch(batch)
            sent += len(batch)
            print(f"  -> wrote {sent}/{EVENT_COUNT}")
            batch = []

    if batch:
        write_batch(batch)
        sent += len(batch)
        print(f"  -> wrote {sent}/{EVENT_COUNT}")

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
