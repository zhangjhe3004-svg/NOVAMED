/**
 * 本地 OCR 封装 —— tesseract.js（离线，无需联网 / API Key）
 *
 * 语言包与 core wasm 已本地化到 public/ocr/（chi_sim + eng），
 * worker / core / lang 三路径全部指向本地静态资源，内网环境亦可离线识别。
 *
 * worker 单例复用：识别多张图时共用同一个 worker，避免重复加载 wasm 与语言包。
 */
import { createWorker, OEM, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

export function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(["chi_sim", "eng"], OEM.LSTM_ONLY, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr",
    });
  }
  return workerPromise;
}

/** 识别一张图（支持 base64 / dataURL / File / Blob），返回纯文本 */
export async function recognizeImage(input: string | Blob | File): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(input);
  return (data.text || "").trim();
}

/** 释放 OCR worker（页面卸载或长时间不使用时调用） */
export function disposeOcrWorker(): void {
  if (workerPromise) {
    const p = workerPromise;
    workerPromise = null;
    p.then((w) => w.terminate()).catch(() => {});
  }
}
