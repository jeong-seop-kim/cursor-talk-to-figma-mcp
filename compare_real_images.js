import { imageComparison } from "./src/talk_to_figma_mcp/image_comparison.js";

async function compareRealImages() {
  try {
    console.log("실제 이미지 비교 시작...\n");

    // 1. 웹 페이지 vs 피그마 디자인 비교
    console.log("=== 1. 웹 페이지 vs 피그마 디자인 비교 ===");
    const result1 = await imageComparison.compareImages({
      image1Path: "./current_web_capture.png",
      image2Path: "./figma_design_capture.png",
      threshold: 0.1,
      outputPath: "./web_vs_figma_comparison.png",
    });

    console.log("차이점 픽셀 수:", result1.diffPixels.toLocaleString());
    console.log("총 픽셀 수:", result1.totalPixels.toLocaleString());
    console.log("차이점 비율:", result1.diffPercentage.toFixed(2) + "%");

    const description1 = imageComparison.generateDifferenceDescription(result1);
    console.log("\n" + description1);

    // 2. 테스트 이미지들 비교 (파란색 vs 빨간색)
    console.log("\n=== 2. 테스트 이미지 비교 (파란색 vs 빨간색) ===");
    const result2 = await imageComparison.compareImages({
      image1Path: "./test_image1.png",
      image2Path: "./test_image2.png",
      threshold: 0.1,
      outputPath: "./test_comparison.png",
    });

    console.log("차이점 픽셀 수:", result2.diffPixels.toLocaleString());
    console.log("총 픽셀 수:", result2.totalPixels.toLocaleString());
    console.log("차이점 비율:", result2.diffPercentage.toFixed(2) + "%");

    const description2 = imageComparison.generateDifferenceDescription(result2);
    console.log("\n" + description2);

    // 3. 동일한 이미지 비교 (파란색 vs 파란색)
    console.log("\n=== 3. 동일한 이미지 비교 (파란색 vs 파란색) ===");
    const result3 = await imageComparison.compareImages({
      image1Path: "./test_image1.png",
      image2Path: "./test_image3.png",
      threshold: 0.1,
      outputPath: "./identical_comparison.png",
    });

    console.log("차이점 픽셀 수:", result3.diffPixels.toLocaleString());
    console.log("총 픽셀 수:", result3.totalPixels.toLocaleString());
    console.log("차이점 비율:", result3.diffPercentage.toFixed(2) + "%");

    const description3 = imageComparison.generateDifferenceDescription(result3);
    console.log("\n" + description3);

    console.log("\n=== 📊 종합 분석 ===");
    console.log(
      "1. 웹 vs 피그마: " + result1.diffPercentage.toFixed(2) + "% 차이"
    );
    console.log(
      "2. 파란색 vs 빨간색: " + result2.diffPercentage.toFixed(2) + "% 차이"
    );
    console.log(
      "3. 파란색 vs 파란색: " + result3.diffPercentage.toFixed(2) + "% 차이"
    );

    console.log("\n이미지 비교 완료!");
  } catch (error) {
    console.error("이미지 비교 실패:", error);
  }
}

compareRealImages();
