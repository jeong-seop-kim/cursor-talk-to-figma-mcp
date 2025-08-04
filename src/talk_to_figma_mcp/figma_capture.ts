import puppeteer from "puppeteer";
import { z } from "zod";

// 피그마 링크 유효성 검사를 위한 스키마
const FigmaUrlSchema = z.object({
  url: z
    .string()
    .url()
    .refine((url) => {
      return url.includes("figma.com") || url.includes("figjam.com");
    }, "URL must be a valid Figma or FigJam URL"),
  nodeId: z
    .string()
    .optional()
    .describe("Optional specific node ID to capture"),
  format: z.enum(["PNG", "JPG", "SVG", "PDF"]).optional().default("PNG"),
  scale: z.number().min(0.1).max(4).optional().default(1),
  quality: z.number().min(1).max(100).optional().default(90),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  waitForSelector: z
    .string()
    .optional()
    .describe("CSS selector to wait for before capturing"),
  waitForTimeout: z
    .number()
    .positive()
    .optional()
    .default(2000)
    .describe("Time to wait in milliseconds"),
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to capture the full page"),
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe("Clip area to capture"),
});

export type FigmaCaptureParams = z.infer<typeof FigmaUrlSchema>;

// 피그마 링크에서 파일 키와 노드 ID를 추출하는 함수
function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } {
  const figmaUrlRegex =
    /figma\.com\/file\/([a-zA-Z0-9]+)(?:\/([a-zA-Z0-9-]+))?/;
  const figjamUrlRegex =
    /figjam\.com\/file\/([a-zA-Z0-9]+)(?:\/([a-zA-Z0-9-]+))?/;

  const figmaMatch = url.match(figmaUrlRegex);
  const figjamMatch = url.match(figjamUrlRegex);

  if (figmaMatch) {
    return {
      fileKey: figmaMatch[1],
      nodeId: figmaMatch[2],
    };
  }

  if (figjamMatch) {
    return {
      fileKey: figjamMatch[1],
      nodeId: figjamMatch[2],
    };
  }

  throw new Error("Invalid Figma URL format");
}

// 피그마 캡쳐 클래스
export class FigmaCapture {
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
        ],
      });
    }
  }

  async captureFigmaDesign(
    params: FigmaCaptureParams
  ): Promise<{ imageData: string; mimeType: string; metadata: any }> {
    try {
      await this.initialize();

      if (!this.browser) {
        throw new Error("Browser not initialized");
      }

      const page = await this.browser.newPage();

      // 피그마 URL 파싱
      const { fileKey, nodeId } = parseFigmaUrl(params.url);

      // 피그마 뷰어 URL 구성
      const figmaUrl = `https://www.figma.com/file/${fileKey}${
        nodeId ? `?node-id=${nodeId}` : ""
      }`;

      // 페이지 설정
      await page.setViewport({
        width: params.width || 1920,
        height: params.height || 1080,
        deviceScaleFactor: params.scale,
      });

      // 페이지 로드
      await page.goto(figmaUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // 로그인 상태 확인 및 대기
      await this.waitForFigmaLoad(page, params.waitForTimeout);

      // 특정 셀렉터 대기 (있는 경우)
      if (params.waitForSelector) {
        await page.waitForSelector(params.waitForSelector, { timeout: 10000 });
      }

      // 캡쳐 옵션 설정
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

      // 메타데이터 수집
      const metadata = {
        url: params.url,
        fileKey,
        nodeId,
        format: params.format,
        scale: params.scale,
        quality: params.quality,
        dimensions: {
          width: params.width || 1920,
          height: params.height || 1080,
        },
        capturedAt: new Date().toISOString(),
      };

      await page.close();

      return {
        imageData,
        mimeType,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `Figma capture failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async waitForFigmaLoad(
    page: puppeteer.Page,
    timeout: number
  ): Promise<void> {
    try {
      // 피그마 로딩 상태 확인
      await page.waitForFunction(
        () => {
          // 피그마 뷰어가 로드되었는지 확인
          const canvas = document.querySelector("canvas");
          const loadingElements = document.querySelectorAll(
            '[data-testid="loading"]'
          );
          return canvas && loadingElements.length === 0;
        },
        { timeout }
      );
    } catch (error) {
      // 타임아웃이 발생해도 계속 진행 (이미 로드되었을 수 있음)
      console.warn("Figma load timeout, proceeding with capture...");
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
export const figmaCapture = new FigmaCapture();

// 프로세스 종료 시 브라우저 정리
process.on("exit", () => {
  figmaCapture.close().catch(console.error);
});

process.on("SIGINT", () => {
  figmaCapture.close().catch(console.error);
  process.exit(0);
});

process.on("SIGTERM", () => {
  figmaCapture.close().catch(console.error);
  process.exit(0);
});
