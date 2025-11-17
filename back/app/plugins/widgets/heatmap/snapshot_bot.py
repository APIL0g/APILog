import os
import io
import json
from datetime import datetime
from playwright.async_api import async_playwright
from PIL import Image

INTERACTIVE_SELECTOR = ", ".join(
    [
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
    ]
)

async def _collect_element_metadata(page):
    return await page.evaluate(
        """(selectorString) => {
            const DEAD_CLICK_LABEL = "unknown";

            function normalizeWhitespace(value) {
                if (!value) return "";
                const lines = value
                  .split(/\\n+/)
                  .map((line) => line.replace(/\\s+/g, " ").trim())
                  .filter(Boolean);
                return lines.join("\\n");
            }

            function isCheckLikeControl(el) {
                if (!el) return false;
                const tag = el.tagName?.toLowerCase();
                if (tag === "input") {
                    const type = (el.type || "").toLowerCase();
                    if (type === "checkbox" || type === "radio") {
                        return true;
                    }
                }
                const role = el.getAttribute?.("role")?.toLowerCase();
                return role === "checkbox" || role === "radio";
            }

            function escapeAttrValue(value) {
                return value.replace(/\\\\/g, "\\\\\\\\").replace(/"/g, '\\"');
            }

            function cleanLabelNodeText(labelEl) {
                if (!labelEl) return null;
                try {
                    const clone = labelEl.cloneNode(true);
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

            function getLabelTextForControl(el) {
                if (!el || !isCheckLikeControl(el)) {
                    return null;
                }

                const ariaLabelledBy = el.getAttribute?.("aria-labelledby")?.trim();
                if (ariaLabelledBy) {
                    const ids = ariaLabelledBy.split(/\\s+/);
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
                    } catch {}
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

            function getReadableLabel(el) {
                if (!el) {
                    return DEAD_CLICK_LABEL;
                }
                const heuristics = el.getAttribute?.("data-apilog-label")?.trim();
                const labelText = getLabelTextForControl(el);
                const visibleText = el.innerText?.trim();
                const allText = el.textContent?.trim();
                const aria = el.getAttribute?.("aria-label")?.trim();
                const alt = el.getAttribute?.("alt")?.trim();
                const title = el.getAttribute?.("title")?.trim();
                const candidate = heuristics || labelText || visibleText || allText || aria || alt || title;
                if (!candidate) {
                    return DEAD_CLICK_LABEL;
                }
                const cleaned = normalizeWhitespace(candidate);
                if (!cleaned) {
                    return DEAD_CLICK_LABEL;
                }
                const wordCount = cleaned.split(/\\s+/).length;
                if (wordCount > 8) {
                    return DEAD_CLICK_LABEL;
                }
                if (cleaned.length > 48) {
                    return cleaned.slice(0, 48).trim();
                }
                return cleaned;
            }

            function sanitizeOuterHtml(el, labelText, maxLength = 4000) {
                if (!el) {
                    return null;
                }
                try {
                    const clone = el.cloneNode(true);
                    const scripts = clone.querySelectorAll("script");
                    scripts.forEach((node) => node.remove());

                    const treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
                    while (treeWalker.nextNode()) {
                        const node = treeWalker.currentNode;
                        if (!node.hasAttributes()) continue;
                        const attrs = node.attributes;
                        for (let i = attrs.length - 1; i >= 0; i--) {
                            const attrName = attrs[i].name.toLowerCase();
                            if (attrName.startsWith("on") || attrName === "style") {
                                node.removeAttribute(attrs[i].name);
                            }
                        }
                    }

                    const commentWalker = document.createTreeWalker(
                        clone,
                        NodeFilter.SHOW_COMMENT
                    );
                    const commentsToRemove = [];
                    while (commentWalker.nextNode()) {
                        commentsToRemove.push(commentWalker.currentNode);
                    }
                    commentsToRemove.forEach((node) => {
                        if (node && node.parentNode) {
                            node.parentNode.removeChild(node);
                        }
                    });

                    let outer = clone.outerHTML || "";

                    const trimmedLabel = labelText?.trim();
                    const shouldAppendLabel =
                        !!trimmedLabel &&
                        trimmedLabel.toLowerCase() !== DEAD_CLICK_LABEL &&
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

            const doc = document.documentElement;
            const body = document.body;
            const scrollX = window.scrollX || doc.scrollLeft || (body ? body.scrollLeft : 0) || 0;
            const scrollY = window.scrollY || doc.scrollTop || (body ? body.scrollTop : 0) || 0;
            const docWidth = Math.max(
                doc.scrollWidth || 0,
                body ? (body.scrollWidth || 0) : 0,
                doc.clientWidth || 0
            );
            const docHeight = Math.max(
                doc.scrollHeight || 0,
                body ? (body.scrollHeight || 0) : 0,
                doc.clientHeight || 0
            );

            const nodes = selectorString
                ? Array.from(document.querySelectorAll(selectorString))
                : [];

            const elements = nodes
                .map((el) => {
                    const rect = el.getBoundingClientRect();
                    const absX = rect.left + scrollX;
                    const absY = rect.top + scrollY;
                    const width = rect.width;
                    const height = rect.height;

                    if (!Number.isFinite(width) || !Number.isFinite(height)) {
                        return null;
                    }
                    if (width <= 0 || height <= 0) {
                        return null;
                    }

                    const textCandidates = [
                        el.getAttribute("data-apilog-label"),
                        el.innerText,
                        el.textContent,
                        el.getAttribute("aria-label"),
                        el.getAttribute("alt"),
                        el.getAttribute("title"),
                    ].filter(Boolean);

                    let readable = null;
                    if (textCandidates.length) {
                        const rawText = String(textCandidates[0] || "");
                        const trimmed = rawText.trim();
                        if (trimmed) {
                            readable = trimmed.slice(0, 120);
                        }
                    }

                    const readableLabel = getReadableLabel(el);
                    const sanitized = sanitizeOuterHtml(el, readableLabel, 4000);
                    const elementHash = sanitized || readableLabel || readable || null;

                    return {
                        tag_name: el.tagName ? el.tagName.toLowerCase() : null,
                        id: el.id || null,
                        classes: el.getAttribute("class") || null,
                        text: readableLabel || readable || null,
                        element_hash: elementHash || null,
                        x: absX,
                        y: absY,
                        width,
                        height,
                        rel_x: docWidth ? absX / docWidth : null,
                        rel_y: docHeight ? absY / docHeight : null,
                        rel_width: docWidth ? width / docWidth : null,
                        rel_height: docHeight ? height / docHeight : null,
                    };
                })
                .filter(Boolean);

            return {
                doc_width: docWidth || 0,
                doc_height: docHeight || 0,
                viewport_width: window.innerWidth || doc.clientWidth || 0,
                viewport_height: window.innerHeight || doc.clientHeight || 0,
                elements,
            };
        }""",
        INTERACTIVE_SELECTOR,
    )

async def take_snapshot(target_url: str, device_type: str, output_path: str):
    """
    Playwright 봇을 사용하여 비동기적으로 스냅샷을 촬영하고 output_path에 저장합니다.
    """
    viewports = {
        "desktop": {"width": 1920, "height": 1080},
        "mobile": {"width": 390, "height": 844},
    }
    # 정의되지 않은 device_type의 경우 기본값으로 'desktop' 사용
    viewport = viewports.get(device_type, viewports["desktop"])

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport=viewport,
            device_scale_factor=1
        )
        page = await context.new_page()
        
        try:
            print(f"[Snapshot Bot] Attempting snapshot for: {target_url}")
            # 네트워크가 안정화될 때까지 대기 (timeout 15초)
            await page.goto(target_url, wait_until="networkidle", timeout=15000)
            await page.wait_for_timeout(5000)
            
            # 스냅샷 저장 디렉토리 생성 (최초 1회)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            metadata_path = os.path.splitext(output_path)[0] + ".json"

            screenshot_bytes = await page.screenshot(
                type="png",
                full_page=True 
            )
            image_dimensions = None
            with Image.open(io.BytesIO(screenshot_bytes)) as img:
                img.save(output_path, "webp", quality=25)
                image_dimensions = (img.width, img.height)

            metadata_payload = None
            try:
                metadata_payload = await _collect_element_metadata(page)
            except Exception as metadata_error:
                print(f"[Snapshot Bot] Failed to collect metadata for {target_url}: {metadata_error}")

            if metadata_payload:
                metadata_payload.update(
                    {
                        "target_url": target_url,
                        "device_type": device_type,
                        "selectors": INTERACTIVE_SELECTOR,
                        "captured_at": datetime.utcnow().isoformat() + "Z",
                        "screenshot_width": image_dimensions[0] if image_dimensions else None,
                        "screenshot_height": image_dimensions[1] if image_dimensions else None,
                    }
                )
                try:
                    with open(metadata_path, "w", encoding="utf-8") as meta_file:
                        json.dump(metadata_payload, meta_file, ensure_ascii=False)
                except Exception as write_error:
                    print(f"[Snapshot Bot] Failed to write metadata for {target_url}: {write_error}")
            else:
                if os.path.exists(metadata_path):
                    try:
                        os.remove(metadata_path)
                    except OSError:
                        pass
    
            print(f"[Snapshot Bot] Successfully saved snapshot to {output_path}")
            
        except Exception as e:
            print(f"[Snapshot Bot] Error taking snapshot for {target_url}: {e}")
        finally:
            await browser.close()
