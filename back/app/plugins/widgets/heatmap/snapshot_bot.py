import os
import io
from playwright.async_api import async_playwright
from PIL import Image

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
            
            # 스냅샷 저장 디렉토리 생성 (최초 1회)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            screenshot_bytes = await page.screenshot(
                type="png",
                full_page=True 
            )
    
            with Image.open(io.BytesIO(screenshot_bytes)) as img:
                img.save(output_path, "webp", quality=25)
            
            print(f"[Snapshot Bot] Successfully saved snapshot to {output_path}")
            
        except Exception as e:
            print(f"[Snapshot Bot] Error taking snapshot for {target_url}: {e}")
        finally:
            await browser.close()