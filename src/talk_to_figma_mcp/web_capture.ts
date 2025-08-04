import puppeteer from "puppeteer";
import { z } from "zod";

// 웹 페이지 캡쳐를 위한 스키마
const WebCaptureSchema = z.object({
  url: z.string().url().describe("웹 페이지 URL"),
  format: z.enum(["PNG", "JPG", "SVG", "PDF"]).optional().default("PNG"),
  scale: z.number().min(0.1).max(4).optional().default(1),
  quality: z.number().min(1).max(100).optional().default(90),
  width: z.number().positive().optional().describe("뷰포트 너비"),
  height: z.number().positive().optional().describe("뷰포트 높이"),
  waitForSelector: z
    .string()
    .optional()
    .describe("캡쳐 전에 대기할 CSS 셀렉터"),
  waitForTimeout: z
    .number()
    .positive()
    .optional()
    .default(2000)
    .describe("대기 시간 (밀리초)"),
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe("전체 페이지 캡쳐 여부"),
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe("캡쳐할 영역"),
  waitForNetworkIdle: z
    .boolean()
    .optional()
    .default(true)
    .describe("네트워크가 유휴 상태일 때까지 대기"),
  waitForLoadEvent: z
    .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
    .optional()
    .default("networkidle2")
    .describe("페이지 로드 이벤트 대기 타입"),
});

export type WebCaptureParams = z.infer<typeof WebCaptureSchema>;

// 웹 페이지 캡쳐 클래스
export class WebCapture {
  private browser: puppeteer.Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
        ],
      });
    }
  }

  async captureWebPage(
    params: WebCaptureParams
  ): Promise<{ imageData: string; mimeType: string; metadata: any }> {
    try {
      await this.initialize();

      if (!this.browser) {
        throw new Error("브라우저가 초기화되지 않았습니다");
      }

      const page = await this.browser.newPage();

      // 뷰포트 설정
      await page.setViewport({
        width: params.width || 1920,
        height: params.height || 1080,
        deviceScaleFactor: params.scale,
      });

      // User-Agent 설정 (선택사항)
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // 페이지 로드
      const loadOptions: puppeteer.PuppeteerLifeCycleEvent =
        params.waitForLoadEvent as puppeteer.PuppeteerLifeCycleEvent;

      await page.goto(params.url, {
        waitUntil: loadOptions,
        timeout: 30000,
      });

      // 네트워크 유휴 상태 대기 (선택사항)
      if (params.waitForNetworkIdle) {
        try {
          await page.waitForNetworkIdle({ timeout: 10000 });
        } catch (error) {
          console.warn("네트워크 유휴 상태 대기 시간 초과, 계속 진행...");
        }
      }

      // 추가 대기 시간
      if (params.waitForTimeout > 0) {
        await page.waitForTimeout(params.waitForTimeout);
      }

      // 특정 셀렉터 대기 (있는 경우)
      if (params.waitForSelector) {
        try {
          await page.waitForSelector(params.waitForSelector, {
            timeout: 10000,
          });
        } catch (error) {
          console.warn(`셀렉터 "${params.waitForSelector}" 대기 시간 초과`);
        }
      }

      // 스크린샷 옵션 설정
      const screenshotOptions: puppeteer.ScreenshotOptions = {
        type: params.format.toLowerCase() as "png" | "jpeg" | "webp",
        quality: params.format === "PNG" ? undefined : params.quality,
        fullPage: params.fullPage,
      };

      // 클립 영역 설정 (있는 경우)
      if (params.clip && params.clip.width && params.clip.height) {
        screenshotOptions.clip = {
          x: params.clip.x,
          y: params.clip.y,
          width: params.clip.width,
          height: params.clip.height,
        };
      }

      // 스크린샷 캡쳐
      const screenshot = await page.screenshot(screenshotOptions);

      // Base64로 인코딩
      const imageData = screenshot.toString("base64");

      // MIME 타입 결정
      const mimeType = this.getMimeType(params.format);

      // 페이지 정보 수집
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        };
      });

      // 메타데이터 수집
      const metadata = {
        url: params.url,
        title: pageInfo.title,
        format: params.format,
        scale: params.scale,
        quality: params.quality,
        dimensions: {
          width: params.width || 1920,
          height: params.height || 1080,
        },
        viewport: pageInfo.viewport,
        capturedAt: new Date().toISOString(),
        waitForSelector: params.waitForSelector,
        fullPage: params.fullPage,
      };

      await page.close();

      return {
        imageData,
        mimeType,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `웹 페이지 캡쳐 실패: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private getMimeType(format: string): string {
    switch (format) {
      case "PNG":
        return "image/png";
      case "JPG":
        return "image/jpeg";
      case "SVG":
        return "image/svg+xml";
      case "PDF":
        return "application/pdf";
      default:
        return "image/png";
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// 캡쳐 인스턴스 생성
export const webCapture = new WebCapture();

// 프로세스 종료 시 브라우저 정리
process.on("exit", () => {
  webCapture.close().catch(console.error);
});

process.on("SIGINT", () => {
  webCapture.close().catch(console.error);
  process.exit(0);
});

process.on("SIGTERM", () => {
  webCapture.close().catch(console.error);
  process.exit(0);
});
