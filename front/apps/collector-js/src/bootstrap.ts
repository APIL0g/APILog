/**
 * Browser bootstrap for the analytics collector runtime bundle.
 * 브라우저 분석 수집기 런타임 번들을 위한 부트스트랩 코드입니다.
 */

(function () {
  // ===========================================================================
  // 0. Guard: run in browser only
  // 브라우저 환경에서만 실행
  // ===========================================================================
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Treat window as any so we can attach custom properties.
  // window를 any로 단언해서 커스텀 프로퍼티(apilog, __apilog_sess 등) 쓸 때 TS 에러 안 나게 함
  const win = window as any;

  // ---------------------------------------------------------------------------
  // Type declarations shared between the stub and the live collector.
  // 스텁과 실제 수집기에서 공유하는 타입 선언입니다.

  interface InitConfig {
    siteId: string;
    ingestUrl: string;
    pageVariant?: string;
    utmSource?: string;
    utmCampaign?: string;
  }

  interface ApilogAPIStub {
    __q?: Array<{ fn: string; args: any[] }>;
    init?: (config: InitConfig) => void;
    markFunnelStep?: (stepName: string) => void;
    markError?: (info: unknown) => void;
    flushNow?: () => void;
  }

  // Attach the final API object so queued calls remain accessible.
  // Assume embed.js already created window.apilog = { __q: [...] } as a stub.
  // embed.js가 window.apilog = { __q: [...] } 형태의 스텁을 먼저 만들어뒀다고 가정합니다.
  // Replace the stub methods with the live implementation.
  // 스텁 메서드를 실제 구현으로 대체합니다.
  const globalApi: ApilogAPIStub = win.apilog || {};
  if (!globalApi.__q) {
    globalApi.__q = [];
  }

  const INTERACTIVE_SELECTOR = [
    "a[href]",
    "button",
    "details",
    "summary",
    'input:not([type="hidden"])',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="image"]',
    "select",
    "textarea",
    "[contenteditable]",
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="option"]',
    ".btn",
    ".button",
    ".link-button",
    "[onclick]",
    "[data-action]",
    "[data-apilog-action]",
    "[data-apilog-interactive]",
    "[data-track-click]",
  ].join(", ");

  const DEAD_CLICK_LABEL = "unknown"

  // ===========================================================================
  // 1. Small utility helpers
  // 작은 유틸 함수들
  // ===========================================================================

  function now(): number {
    return Date.now();
  }

  function uuid(): string {
    return (
      Math.random().toString(16).slice(2) +
      Math.random().toString(16).slice(2) +
      Math.random().toString(16).slice(2)
    ).slice(0, 32);
  }

  function getOrCreateSessionId(): string {
    // Keep the same session ID while the user stays in the tab.
    // 같은 탭 내에서는 같은 세션 ID 유지
    try {
      const KEY = "_apilog_session";
      const existing = sessionStorage.getItem(KEY);
      if (existing) return existing;
      const fresh = uuid();
      sessionStorage.setItem(KEY, fresh);
      return fresh;
    } catch {
      // Fall back to a window-scoped value when sessionStorage is unavailable.
      // 프라이버시 모드 등으로 sessionStorage가 막힌 경우 window 전역을 사용합니다.
      if (!win.__apilog_sess) {
        win.__apilog_sess = uuid();
      }
      return win.__apilog_sess;
    }
  }

  const USER_ID_STORAGE_KEY = "_apilog_user";
  const USER_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

  function readCookie(name: string): string | null {
    try {
      const pattern = new RegExp(
        "(?:^|; )" + name.replace(/([.*+?^${}()|[\]\\])/g, "\\$1") + "=([^;]*)"
      );
      const match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
    try {
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
        value
      )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
    } catch {
      // Ignore cookie write failures.
    }
  }

  function persistUserHash(value: string): void {
    try {
      window.localStorage.setItem(USER_ID_STORAGE_KEY, value);
    } catch {
      // Ignore storage quota/denied errors.
    }
    writeCookie(USER_ID_STORAGE_KEY, value, USER_ID_COOKIE_MAX_AGE);
    win.__apilog_user = value;
  }

  function getOrCreateUserHash(): string {
    try {
      const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY);
      if (existing) {
        win.__apilog_user = existing;
        return existing;
      }
    } catch {
      // localStorage unavailable (private mode, etc.)
    }

    const cookieValue = readCookie(USER_ID_STORAGE_KEY);
    if (cookieValue) {
      persistUserHash(cookieValue);
      return cookieValue;
    }

    if (typeof win.__apilog_user === "string" && win.__apilog_user) {
      return win.__apilog_user;
    }

    const fresh = uuid();
    persistUserHash(fresh);
    return fresh;
  }

  function detectDeviceType(): "mobile" | "desktop" {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobi|android|iphone|ipad/.test(ua)) return "mobile";
    return "desktop";
  }

  function detectBrowserFamily(): string {
    const ua = navigator.userAgent;
    if (/Edg|Edge/i.test(ua)) return "Edge";
    if (/OPR|Opera/i.test(ua)) return "Opera";
    if (/Whale/i.test(ua)) return "Whale";
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
    if (/Chrome/i.test(ua)) return "Chrome";
    return "Other";
  }

  function getUtmParam(key: string): string | null {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(key);
    } catch {
      return null;
    }
  }

  function normalizePath(pathname: string): string {
    return pathname.split("?")[0];
  }

  const COUNTRY_DEFAULT = "none";
  let countryLookupInFlight: Promise<string> | null = null;

  async function lookupCountryFromApi(): Promise<string> {
    try {
      const supportsAbort = typeof AbortController === "function";
      const abort = supportsAbort ? new AbortController() : null;
      const timeout = window.setTimeout(() => {
        if (abort) abort.abort();
      }, 4000);
      try {
        const res = await fetch("https://ipinfo.io/json", {
          cache: "no-store",
          signal: abort ? abort.signal : undefined,
        });
        if (!res.ok) {
          throw new Error("geoip request failed");
        }
        const data = await res.json();
        const raw = typeof data?.country === "string" ? data.country.trim() : "";
        return raw ? raw.toUpperCase() : COUNTRY_DEFAULT;
      } finally {
        window.clearTimeout(timeout);
      }
    } catch {
      return COUNTRY_DEFAULT;
    }
  }

  function requestCountryCode(): Promise<string> | null {
    if (typeof fetch !== "function") {
      return null;
    }
    if (countryLookupInFlight) {
      return countryLookupInFlight;
    }
    countryLookupInFlight = lookupCountryFromApi().finally(() => {
      countryLookupInFlight = null;
    });
    return countryLookupInFlight;
  }

  // ===========================================================================
  // 2. Scroll depth
  // 스크롤 도달 깊이 계산
  // ===========================================================================
  function getMaxScrollPct(): number {
    const doc = document.documentElement;
    const body = document.body;

    const scrollTop =
      window.pageYOffset || doc.scrollTop || body.scrollTop || 0;

    const viewportH = window.innerHeight || doc.clientHeight;

    const fullH = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      doc.clientHeight,
      doc.scrollHeight,
      doc.offsetHeight
    );

    const maxSeen = scrollTop + viewportH;
    if (fullH <= 0) return 0;

    let pct = maxSeen / fullH;
    if (pct > 1) pct = 1;
    return pct;
  }

  // ===========================================================================
  // 3. DOM element "signature" for clicks
  // 클릭된 요소 시그니처
  // ===========================================================================
  function sanitizeCssIdent(s: string): string {
    return s.replace(/[^a-zA-Z0-9\-_]/g, "_");
  }

  function nthOfType(el: Element): string {
    if (!el.parentNode) return "";
    const tag = el.tagName;
    let index = 0;
    let count = 0;

    const children = el.parentNode.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as Element;
      if (child.nodeType === 1 && child.tagName === tag) {
        count++;
        if (child === el) {
          index = count;
          break;
        }
      }
    }

    if (index === 0 || count === 1) return "";
    return ":nth-of-type(" + index + ")";
  }

  function buildDomSelector(el: Element): string {
    const parts: string[] = [];
    let current: Element | null = el;
    const depthLimit = 6;

    while (current && current.nodeType === 1 && parts.length < depthLimit) {
      const tag = current.tagName.toLowerCase();

      if ((current as HTMLElement).id) {
        parts.unshift(tag + "#" + (current as HTMLElement).id);
        break;
      }

      let classPart = "";
      if (
        (current as HTMLElement).classList &&
        (current as HTMLElement).classList.length > 0
      ) {
        const classes: string[] = [];
        const cl = (current as HTMLElement).classList;
        for (let i = 0; i < cl.length && i < 2; i++) {
          const c = sanitizeCssIdent(cl[i] || "");
          if (c) classes.push(c);
        }
        if (classes.length > 0) {
          classPart = "." + classes.join(".");
        }
      }

      const nth = nthOfType(current);
      parts.unshift(tag + classPart + nth);

      if (tag === "body") {
        break;
      }
      current = current.parentElement;
    }

    return parts.join(" > ");
  }

  function normalizeWhitespace(value?: string): string {
    if (!value) return "";
    const lines = value
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return lines.join("\n");
  }

  function isCheckLikeControl(el: Element | null): boolean {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input") {
      const type = ((el as HTMLInputElement).type || "").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        return true;
      }
    }
    const role = el.getAttribute?.("role")?.toLowerCase();
    return role === "checkbox" || role === "radio";
  }

  function escapeAttrValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function cleanLabelNodeText(labelEl: Element | null): string | null {
    if (!labelEl) return null;
    try {
      const clone = labelEl.cloneNode(true) as HTMLElement;
      const controls = clone.querySelectorAll("input,button,select,textarea");
      controls.forEach((node) => node.remove());
      const text = clone.textContent?.trim();
      const normalized = normalizeWhitespace(text);
      return normalized || null;
    } catch {
      const text = labelEl.textContent?.trim();
      const normalized = normalizeWhitespace(text);
      return normalized || null;
    }
  }

  function getLabelTextForControl(el: Element | null): string | null {
    if (!el || !isCheckLikeControl(el)) {
      return null;
    }

    const ariaLabelledBy = el.getAttribute?.("aria-labelledby")?.trim();
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(/\s+/);
      for (const id of ids) {
        const ref = document.getElementById(id);
        const text = cleanLabelNodeText(ref);
        if (text) {
          return text;
        }
      }
    }

    const id = el.getAttribute?.("id");
    if (id) {
      try {
        const selector = `label[for="${escapeAttrValue(id)}"]`;
        const assoc = document.querySelector(selector);
        const text = cleanLabelNodeText(assoc);
        if (text) {
          return text;
        }
      } catch {
        // ignore selector errors
      }
    }

    const wrapping = el.closest?.("label") ?? null;
    const wrappingText = cleanLabelNodeText(wrapping);
    if (wrappingText) {
      return wrappingText;
    }

    const parent = el.parentElement;
    if (parent) {
      const children = parent.children;
      for (let i = 0; i < children.length; i += 1) {
        const sibling = children[i];
        if (sibling === el) {
          continue;
        }
        if (sibling.tagName?.toLowerCase() === "label") {
          const text = cleanLabelNodeText(sibling);
          if (text) {
            return text;
          }
        }
      }
    }

    return null;
  }

  function sanitizeOuterHtml(
    el: Element | null,
    labelText?: string | null,
    maxLength = 4000
  ): string | null {
    if (!el) {
      return null;
    }
    try {
      const clone = el.cloneNode(true) as HTMLElement;
      const scripts = clone.querySelectorAll("script");
      scripts.forEach((node) => node.remove());

      const treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
      while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Element;
        if (!node.hasAttributes()) continue;
        const attrs = node.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const attrName = attrs[i].name.toLowerCase();
          if (attrName.startsWith("on")) {
            node.removeAttribute(attrs[i].name);
          }
        }
      }

      let outer = clone.outerHTML || "";

      const trimmedLabel = labelText?.trim();
      const shouldAppendLabel =
        !!trimmedLabel &&
        trimmedLabel.toLowerCase() !== "unknown" &&
        isCheckLikeControl(el);
      if (shouldAppendLabel) {
        const wrapper = document.createElement("div");
        wrapper.appendChild(clone);
        const labelEl = document.createElement("span");
        labelEl.setAttribute("data-apilog-label-preview", "true");
        labelEl.style.display = "inline-block";
        labelEl.style.marginLeft = "0.5rem";
        labelEl.textContent = trimmedLabel;
        wrapper.appendChild(labelEl);
        outer = wrapper.innerHTML;
      }

      if (!outer) {
        return null;
      }
      if (outer.length > maxLength) {
        return outer.slice(0, maxLength);
      }
      return outer;
    } catch {
      return null;
    }
  }

  function findInteractiveFromEvent(ev: Event): Element | null {
    if (typeof ev.composedPath === "function") {
      const path = ev.composedPath();
      for (const node of path) {
        if (
          node instanceof Element &&
          typeof node.matches === "function" &&
          node.matches(INTERACTIVE_SELECTOR)
        ) {
          return node;
        }
      }
    }
    const target = ev.target as Element | null;
    return target?.closest?.(INTERACTIVE_SELECTOR) ?? null;
  }

  function getReadableLabel(el: Element | null): string {
    if (!el) {
      return DEAD_CLICK_LABEL;
    }
    const heuristics = el.getAttribute?.("data-apilog-label")?.trim();
    const labelText = getLabelTextForControl(el);
    const visibleText = (el as HTMLElement).innerText?.trim();
    const allText = (el as HTMLElement).textContent?.trim();
    const aria = el.getAttribute?.("aria-label")?.trim();
    const alt = (el as HTMLElement).getAttribute?.("alt")?.trim();
    const title = el.getAttribute?.("title")?.trim();
    const candidate = heuristics || labelText || visibleText || allText || aria || alt || title;
    if (!candidate) {
      return DEAD_CLICK_LABEL;
    }
    const cleaned = normalizeWhitespace(candidate);
    if (!cleaned) {
      return DEAD_CLICK_LABEL;
    }
    const wordCount = cleaned.split(/\s+/).length;
    if (wordCount > 8) {
      return DEAD_CLICK_LABEL;
    }
    if (cleaned.length > 48) {
      return cleaned.slice(0, 48).trim();
    }
    return cleaned;
  }

  function getElementSignature(
    el: Element,
    clickX: number,
    clickY: number,
    labelSource?: Element | null
  ): {
    selector: string;
    elementHash: string;
    relX: number | null;
    relY: number | null;
  } {
    const selector = buildDomSelector(el);
    const elementHash = getReadableLabel(labelSource ?? el);

    const rect = (el as HTMLElement).getBoundingClientRect();

    const viewportX = clickX - window.scrollX;
    const viewportY = clickY - window.scrollY;

    let relX: number | null = null;
    let relY: number | null = null;
    if (rect.width > 0 && rect.height > 0) {
      relX = (viewportX - rect.left) / rect.width;
      relY = (viewportY - rect.top) / rect.height;

      if (relX < 0) relX = 0;
      if (relX > 1) relX = 1;
      if (relY < 0) relY = 0;
      if (relY > 1) relY = 1;
    }

    return {
      selector,
      elementHash,
      relX,
      relY,
    };
  }

  // ===========================================================================
  // 4. Throttle helper
  // 쓰로틀
  // ===========================================================================
  function throttle<T extends (...args: any[]) => void>(
    fn: T,
    ms: number
  ): (...args: Parameters<T>) => void {
    let last = 0;
    let timer: number | null = null;
    let pendingArgs: Parameters<T> | null = null;

    function run() {
      if (pendingArgs) {
        fn.apply(null, pendingArgs);
        pendingArgs = null;
        last = Date.now();
      }
      timer = null;
    }

    return function throttled(...args: Parameters<T>) {
      const nowTime = Date.now();
      const diff = nowTime - last;

      if (diff >= ms && !timer) {
        last = nowTime;
        fn.apply(null, args);
      } else {
        pendingArgs = args;
        if (!timer) {
          timer = window.setTimeout(run, Math.max(ms - diff, 0));
        }
      }
    };
  }

  // ===========================================================================
  // 5. BatchQueue
  // ===========================================================================
  interface EventRecord {
    [key: string]: any;
    ts: number;
  }

  class BatchQueue {
    buf: EventRecord[];
    flushTimer: number | null;
    flushInterval: number;
    maxBatch: number;
    endpoint: string;

    constructor(endpoint: string) {
      this.buf = [];
      this.flushTimer = null;
      this.flushInterval = 5000;
      this.maxBatch = 50;
      this.endpoint = endpoint;
    }

    push(ev: EventRecord) {
      this.buf.push(ev);

      if (this.buf.length >= this.maxBatch) {
        this.flush(false);
        return;
      }

      if (this.flushTimer == null) {
        this.flushTimer = window.setTimeout(() => {
          this.flush(false);
        }, this.flushInterval);
      }
    }

    flush(sync: boolean) {
      if (this.buf.length === 0) return;

      const batch = this.buf;
      this.buf = [];

      if (this.flushTimer != null) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }

      const payload = { events: batch };

      if (sync && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
          });
          navigator.sendBeacon(this.endpoint, blob);
          return;
          // ignore, fallback to fetch
        }
      }

      fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: !!sync,
        body: JSON.stringify(payload),
      }).catch(() => {});
    }

    updatePendingField(field: string, value: any) {
      for (let i = 0; i < this.buf.length; i += 1) {
        this.buf[i][field] = value;
      }
    }
  }

  // ===========================================================================
  // 6. ApiLogCollector
  // ===========================================================================
  interface CollectorOpts {
    siteId: string;
    ingestUrl: string;
    pageVariant?: string;
    utmSource?: string | null;
    utmCampaign?: string | null;
  }

  class ApiLogCollector {
    opts: CollectorOpts;
    sessionId: string;
    startTime: number;
    destroyed: boolean;
    maxScrollSeen: number;
    q: BatchQueue;
    countryCode: string;
    userHash: string;
    activePath: string;

    constructor(opts: CollectorOpts) {
      this.opts = opts;
      this.sessionId = getOrCreateSessionId();
      this.startTime = now();
      this.destroyed = false;
      this.maxScrollSeen = getMaxScrollPct();
      this.q = new BatchQueue(opts.ingestUrl);
      this.countryCode = COUNTRY_DEFAULT;
      this.userHash = getOrCreateUserHash();
      this.activePath = this.currentPath();

      const pendingCountry = requestCountryCode();
      if (pendingCountry) {
        pendingCountry.then((code) => {
          this.countryCode = code || COUNTRY_DEFAULT;
          this.q.updatePendingField("country_code", this.countryCode);
        });
      }

      this.installListeners();
      this.emitPageView();
    }

    installListeners() {
      // CLICK LISTENER
      document.addEventListener(
        "click",
        (ev: MouseEvent) => {
          const interactiveEl = findInteractiveFromEvent(ev);
          const docEl = document.documentElement;
          const bodyEl = document.body;
          const scrollX = window.pageXOffset || docEl.scrollLeft || 0;
          const scrollY = window.pageYOffset || docEl.scrollTop || 0;

          // Normalise mouse coordinates for consistent metrics.
          // MouseEvent에서 pageX/pageY, clientX/clientY 값을 보정합니다.
          const x = (ev.pageX || (ev.clientX + scrollX) || 0);
          const y = (ev.pageY || (ev.clientY + scrollY) || 0);

          const maxH = Math.max(
          bodyEl.scrollHeight, bodyEl.offsetHeight,
          docEl.clientHeight, docEl.scrollHeight, docEl.offsetHeight
          );
          const maxW = Math.max(
          bodyEl.scrollWidth, bodyEl.offsetWidth,
          docEl.clientWidth, docEl.scrollWidth, docEl.offsetWidth
          );

          const x_pct = (maxW > 0) ? (x / maxW) : 0;
          const y_pct = (maxH > 0) ? (y / maxH) : 0;

          if (!interactiveEl) {
            this.q.push({
              ...this.baseTags("click", DEAD_CLICK_LABEL),
              ...this.baseFields(),
              click_x: x_pct,
              click_y: y_pct,
              scroll_pct: this.maxScrollSeen,
              extra_json: JSON.stringify({ dead_click: true }),
              ts: now(),
            });
            return;
          }

          this.emitClick(interactiveEl, x_pct, y_pct, interactiveEl);
        },
        true // capture
      );

      // SCROLL LISTENER (THROTTLED)
      const onScroll = throttle(() => {
        const pct = getMaxScrollPct();
        if (pct > this.maxScrollSeen) {
          this.maxScrollSeen = pct;
        }
      }, 250);

      window.addEventListener("scroll", onScroll, { passive: true });

      // BEFOREUNLOAD
      window.addEventListener("beforeunload", () => {
        const path = this.activePath || this.currentPath();
        this.emitScrollDepth(path);
        this.emitDwell(path);

        this.q.flush(true);
        this.destroyed = true;
      });

      // SPA ROUTE CHANGE HOOKS
      // Detect client-side navigations (pushState/replaceState, back/forward, hashchange)
      // On route change: finalize previous page (scroll depth + dwell), then start new page_view
      const self = this;

      function onRouteChange() {
        const prevPath = self.activePath || self.currentPath();
        try {
          self.emitScrollDepth(prevPath);
          self.emitDwell(prevPath);
          self.q.flush(false);
        } catch {}

        self.startTime = now();
        self.maxScrollSeen = getMaxScrollPct();
        self.emitPageView();
      }

      // Patch history.pushState / replaceState to catch SPA navigations
      try {
        const origPush = history.pushState;
        history.pushState = function (...args: any[]) {
          const prev = location.href;
          const ret = origPush.apply(this, args as any);
          const next = location.href;
          if (next !== prev) onRouteChange();
          return ret;
        } as typeof history.pushState;

        const origReplace = history.replaceState;
        history.replaceState = function (...args: any[]) {
          const prev = location.href;
          const ret = origReplace.apply(this, args as any);
          const next = location.href;
          if (next !== prev) onRouteChange();
          return ret;
        } as typeof history.replaceState;
      } catch {}

      // Back/forward and hash-only navigations
      window.addEventListener("popstate", onRouteChange);
      window.addEventListener("hashchange", onRouteChange);
    }

    currentPath(): string {
      const base = normalizePath(location.pathname);
      const hash = location.hash || "";
      if (hash.startsWith("#/")) {
        return hash.slice(1).split("?")[0];
      }
      return base;
    }

    baseTags(eventName: string, elementHash: string | null, overridePath?: string) {
      const path = overridePath ?? this.activePath ?? this.currentPath();
      return {
        site_id: this.opts.siteId,
        path,
        page_variant: this.opts.pageVariant || "default",
        event_name: eventName,
        element_hash: elementHash || null,
        device_type: detectDeviceType(),
        browser_family: detectBrowserFamily(),
        country_code: this.countryCode,
        utm_source: this.opts.utmSource ?? getUtmParam("utm_source"),
        utm_campaign: this.opts.utmCampaign ?? getUtmParam("utm_campaign"),
      };
    }

    baseFields() {
      const vw =
        window.innerWidth || document.documentElement.clientWidth || 0;
      const vh =
        window.innerHeight || document.documentElement.clientHeight || 0;

      return {
        count: 1,
        session_id: this.sessionId,
        user_hash: this.userHash,
        dwell_ms: null as number | null,
        scroll_pct: null as number | null,
        click_x: null as number | null,
        click_y: null as number | null,
        viewport_w: vw,
        viewport_h: vh,
        funnel_step: null as string | null,
        error_flag: null as boolean | null,
        bot_score: null as number | null,
        extra_json: null as string | null,
      };
    }

    pushRecord(partial: Record<string, any>) {
      const rec: EventRecord = Object.assign(
        {
          ts: partial.ts != null ? partial.ts : now(),
        },
        partial
      );
      this.q.push(rec);
    }

    emitPageView() {
      const path = this.currentPath();
      this.activePath = path;

      const rec = Object.assign(
        {},
        this.baseTags("page_view", null, path),
        this.baseFields(),
        {
          dwell_ms: 0,
          scroll_pct: this.maxScrollSeen,
          ts: now(),
        }
      );
      this.pushRecord(rec);
    }

    emitClick(targetEl: Element, absX: number, absY: number, labelEl?: Element | null) {
      const sig = getElementSignature(targetEl, absX, absY, labelEl);
      const outerHtml = sanitizeOuterHtml(labelEl ?? targetEl, sig.elementHash);
      const elementHashPayload = outerHtml || sig.elementHash;

      const rec = Object.assign(
        {},
        this.baseTags("click", elementHashPayload),
        this.baseFields(),
        {
          click_x: absX,
          click_y: absY,
          scroll_pct: this.maxScrollSeen,
          ts: now(),
        }
      );

      this.pushRecord(rec);
    }

    emitScrollDepth(pathOverride?: string) {
      const pct = this.maxScrollSeen;

      const rec = Object.assign(
        {},
        this.baseTags("scroll", null, pathOverride),
        this.baseFields(),
        {
          scroll_pct: pct,
          ts: now(),
        }
      );

      this.pushRecord(rec);
    }

    emitDwell(pathOverride?: string) {
      const dur = now() - this.startTime;

      const rec = Object.assign(
        {},
        this.baseTags("page_view_dwell", null, pathOverride),
        this.baseFields(),
        {
          dwell_ms: dur,
          scroll_pct: this.maxScrollSeen,
          ts: now(),
        }
      );

      this.pushRecord(rec);
    }

    markFunnelStep(stepName: string) {
      const rec = Object.assign(
        {},
        this.baseTags("funnel_step", null),
        this.baseFields(),
        {
          funnel_step: stepName,
          ts: now(),
        }
      );
      this.pushRecord(rec);
    }

    markError(info: unknown) {
      const rec = Object.assign(
        {},
        this.baseTags("error", null),
        this.baseFields(),
        {
          error_flag: true,
          extra_json: info
            ? JSON.stringify(info).slice(0, 1024)
            : null,
          ts: now(),
        }
      );
      this.pushRecord(rec);
    }

    flush() {
      this.q.flush(false);
    }
  }

  // ===========================================================================
  // 7. Singleton management
  // 싱글턴 관리
  // ===========================================================================
  let __apilog_singleton: ApiLogCollector | null = null;

  function initCollector(opts: InitConfig): ApiLogCollector {
    if (__apilog_singleton) return __apilog_singleton;

    __apilog_singleton = new ApiLogCollector({
      siteId: opts.siteId,
      ingestUrl: opts.ingestUrl,
      pageVariant: opts.pageVariant,
      utmSource: opts.utmSource ?? null,
      utmCampaign: opts.utmCampaign ?? null,
    });

    return __apilog_singleton;
  }

  function markFunnelStep(stepName: string): void {
    if (__apilog_singleton) {
      __apilog_singleton.markFunnelStep(stepName);
    }
  }

  function markError(info: unknown): void {
    if (__apilog_singleton) {
      __apilog_singleton.markError(info);
    }
  }

  function flushNow(): void {
    if (__apilog_singleton) {
      __apilog_singleton.flush();
    }
  }

  // ===========================================================================
  // 8. Attach final API onto window.apilog
  // ===========================================================================
  globalApi.init = function (config: InitConfig) {
    initCollector(config);
  };

  globalApi.markFunnelStep = function (stepName: string) {
    markFunnelStep(stepName);
  };

  globalApi.markError = function (info: unknown) {
    markError(info);
  };

  globalApi.flushNow = function () {
    flushNow();
  };

  // Replace the loader stub with the fully initialised API.
  // embed.js에서 만든 스텁 객체를 실제 구현으로 교체합니다.
  win.apilog = globalApi;
})();
