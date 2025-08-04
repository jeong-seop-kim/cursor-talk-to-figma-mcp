import { webCapture } from "./src/talk_to_figma_mcp/web_capture.js";

async function testWebCapture() {
  try {
    console.log("웹 페이지 캡쳐 테스트 시작...");

    const result = await webCapture.captureWebPage({
      url: "http://localhost:3000/",
      format: "PNG",
      scale: 1,
      width: 1920,
      height: 1080,
      waitForTimeout: 3000,
      fullPage: true,
    });

    console.log("캡쳐 성공!");
    console.log("메타데이터:", result.metadata);
    console.log("이미지 데이터 길이:", result.imageData.length);
    console.log("MIME 타입:", result.mimeType);

    // Base64 이미지 데이터를 파일로 저장
    const fs = await import("fs");
    fs.writeFileSync(
      "captured_page.png",
      Buffer.from(result.imageData, "base64")
    );
    console.log("이미지가 captured_page.png로 저장되었습니다.");
  } catch (error) {
    console.error("캡쳐 실패:", error);
  } finally {
    await webCapture.close();
  }
}

testWebCapture();
