import { readFileSync, writeFileSync } from "fs";
import pixelmatch from "pixelmatch";
import sharp from "sharp";
import { z } from "zod";

// 이미지 비교를 위한 스키마
const ImageComparisonSchema = z.object({
  image1Path: z.string().describe("첫 번째 이미지 파일 경로"),
  image2Path: z.string().describe("두 번째 이미지 파일 경로"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.1)
    .describe("차이 감지 임계값"),
  outputPath: z.string().optional().describe("차이점 이미지 출력 경로"),
});

export type ImageComparisonParams = z.infer<typeof ImageComparisonSchema>;

// 이미지 비교 결과 인터페이스
interface ComparisonResult {
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  diffImageData: string;
  metadata: {
    image1Size: { width: number; height: number };
    image2Size: { width: number; height: number };
    threshold: number;
    comparedAt: string;
  };
}

// 이미지 비교 클래스
export class ImageComparison {
  async compareImages(
    params: ImageComparisonParams
  ): Promise<ComparisonResult> {
    try {
      // 이미지 파일 읽기
      const image1Buffer = readFileSync(params.image1Path);
      const image2Buffer = readFileSync(params.image2Path);

      // 이미지 정보 가져오기
      const image1Info = await sharp(image1Buffer).metadata();
      const image2Info = await sharp(image2Buffer).metadata();

      // 이미지 크기 통일 (더 작은 크기로 리사이즈)
      const targetWidth = Math.min(
        image1Info.width || 0,
        image2Info.width || 0
      );
      const targetHeight = Math.min(
        image1Info.height || 0,
        image2Info.height || 0
      );

      // 이미지 리사이즈 및 RGBA 변환
      const image1Resized = await sharp(image1Buffer)
        .resize(targetWidth, targetHeight)
        .raw()
        .toBuffer();

      const image2Resized = await sharp(image2Buffer)
        .resize(targetWidth, targetHeight)
        .raw()
        .toBuffer();

      // 차이점 이미지 버퍼 생성
      const diffBuffer = Buffer.alloc(targetWidth * targetHeight * 4);

      // pixelmatch로 이미지 비교
      const diffPixels = pixelmatch(
        image1Resized,
        image2Resized,
        diffBuffer,
        targetWidth,
        targetHeight,
        { threshold: params.threshold }
      );

      // 차이점 이미지를 PNG로 변환
      const diffImageBuffer = await sharp(diffBuffer, {
        raw: {
          width: targetWidth,
          height: targetHeight,
          channels: 4,
        },
      })
        .png()
        .toBuffer();

      // Base64로 인코딩
      const diffImageData = diffImageBuffer.toString("base64");

      // 결과 계산
      const totalPixels = targetWidth * targetHeight;
      const diffPercentage = (diffPixels / totalPixels) * 100;

      // 메타데이터
      const metadata = {
        image1Size: {
          width: image1Info.width || 0,
          height: image1Info.height || 0,
        },
        image2Size: {
          width: image2Info.width || 0,
          height: image2Info.height || 0,
        },
        threshold: params.threshold,
        comparedAt: new Date().toISOString(),
      };

      // 차이점 이미지 파일 저장 (선택사항)
      if (params.outputPath) {
        writeFileSync(params.outputPath, diffImageBuffer);
      }

      return {
        diffPixels,
        totalPixels,
        diffPercentage,
        diffImageData,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `이미지 비교 실패: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // 차이점 분석 및 설명 생성
  generateDifferenceDescription(result: ComparisonResult): string {
    const { diffPixels, totalPixels, diffPercentage, metadata } = result;

    let description = `## 이미지 비교 결과\n\n`;

    // 기본 통계
    description += `### 📊 기본 통계\n`;
    description += `- **총 픽셀 수**: ${totalPixels.toLocaleString()}개\n`;
    description += `- **차이점 픽셀 수**: ${diffPixels.toLocaleString()}개\n`;
    description += `- **차이점 비율**: ${diffPercentage.toFixed(2)}%\n`;
    description += `- **임계값**: ${(metadata.threshold * 100).toFixed(
      1
    )}%\n\n`;

    // 이미지 크기 정보
    description += `### 📐 이미지 크기\n`;
    description += `- **이미지 1**: ${metadata.image1Size.width} × ${metadata.image1Size.height}\n`;
    description += `- **이미지 2**: ${metadata.image2Size.width} × ${metadata.image2Size.height}\n\n`;

    // 차이점 수준 평가
    description += `### 🔍 차이점 분석\n`;
    if (diffPercentage < 1) {
      description += `✅ **거의 동일**: 두 이미지는 거의 동일합니다 (차이점 < 1%)\n`;
    } else if (diffPercentage < 5) {
      description += `⚠️ **약간의 차이**: 두 이미지에 약간의 차이가 있습니다 (1-5%)\n`;
    } else if (diffPercentage < 20) {
      description += `🔶 **상당한 차이**: 두 이미지에 상당한 차이가 있습니다 (5-20%)\n`;
    } else {
      description += `❌ **큰 차이**: 두 이미지에 큰 차이가 있습니다 (> 20%)\n`;
    }

    // 차이점 유형 추정
    description += `\n### 🎯 차이점 유형 추정\n`;
    if (diffPercentage < 1) {
      description += `- 미세한 렌더링 차이\n`;
      description += `- 압축 아티팩트\n`;
      description += `- 색상 프로파일 차이\n`;
    } else if (diffPercentage < 10) {
      description += `- UI 요소 위치 차이\n`;
      description += `- 폰트 렌더링 차이\n`;
      description += `- 색상 및 투명도 차이\n`;
    } else {
      description += `- 레이아웃 구조 차이\n`;
      description += `- 콘텐츠 변경\n`;
      description += `- 새로운 UI 요소 추가/제거\n`;
    }

    return description;
  }
}

// 이미지 비교 인스턴스 생성
export const imageComparison = new ImageComparison();
