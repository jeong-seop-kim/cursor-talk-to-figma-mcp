import { writeFileSync } from "fs";
import { imageComparison } from "./src/talk_to_figma_mcp/image_comparison.js";
import { webCapture } from "./src/talk_to_figma_mcp/web_capture.js";

async function captureAndCompare() {
  try {
    console.log("웹 페이지 캡쳐 및 비교 시작...");

    // 웹 페이지 캡쳐
    console.log("웹 페이지 캡쳐 중...");
    const webResult = await webCapture.captureWebPage({
      url: "http://localhost:3000",
      format: "PNG",
      scale: 1,
      width: 1200,
      height: 800,
      waitForTimeout: 3000,
      fullPage: false,
    });

    // 웹 캡쳐 이미지 저장
    writeFileSync(
      "current_web_capture.png",
      Buffer.from(webResult.imageData, "base64")
    );
    console.log("웹 캡쳐 이미지 저장됨: current_web_capture.png");

    // 피그마 캡쳐 (예시 URL 사용)
    console.log("피그마 디자인 캡쳐 중...");
    const figmaResult = await webCapture.captureWebPage({
      url: "https://www.figma.com/file/example", // 실제 피그마 URL로 변경 필요
      format: "PNG",
      scale: 1,
      width: 1200,
      height: 800,
      waitForTimeout: 3000,
      fullPage: false,
    });

    // 피그마 캡쳐 이미지 저장
    writeFileSync(
      "figma_design_capture.png",
      Buffer.from(figmaResult.imageData, "base64")
    );
    console.log("피그마 캡쳐 이미지 저장됨: figma_design_capture.png");

    // 이미지 비교
    console.log("이미지 비교 중...");
    const comparisonResult = await imageComparison.compareImages({
      image1Path: "./current_web_capture.png",
      image2Path: "./figma_design_capture.png",
      threshold: 0.1,
      outputPath: "./web_vs_figma_diff.png",
    });

    // 결과 출력
    console.log("이미지 비교 완료!");
    console.log("차이점 픽셀 수:", comparisonResult.diffPixels);
    console.log("총 픽셀 수:", comparisonResult.totalPixels);
    console.log(
      "차이점 비율:",
      comparisonResult.diffPercentage.toFixed(2) + "%"
    );

    // 차이점 설명 생성
    const description =
      imageComparison.generateDifferenceDescription(comparisonResult);
    console.log("\n" + description);
  } catch (error) {
    console.error("캡쳐 및 비교 실패:", error);
  } finally {
    await webCapture.close();
  }
}

captureAndCompare();
