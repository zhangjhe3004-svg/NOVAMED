/**
 * DocScanner —— 通用「扫描文档」组件
 *
 * 拍照 / 选择图片（可多张）→ 本地压缩 → 缩略图预览 → tesseract.js 本地 OCR 识别
 * → 返回 { images, ocr_text, title, category } 供调用方归档或回填表单。
 *
 * 三个入口复用：就诊记录（扫描辅助录入病历）、患者档案（扫描归档）、检查检验（报告扫描）。
 * OCR 全部在前端本地完成（utils/ocr.ts），无需联网 / API Key。
 */
import { useRef, useState } from "react";
import { Modal, Button, Input, Select, message, Spin } from "antd";
import {
  CameraOutlined, ScanOutlined, DeleteOutlined, PlusOutlined, LoadingOutlined,
} from "@ant-design/icons";
import { recognizeImage } from "../utils/ocr";

export interface DocScanResult {
  title: string;
  category: string;
  images: string[];
  ocr_text: string;
}

interface DocScannerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: DocScanResult) => void;
  /** 是否显示「标题 / 分类」元数据（归档场景 true；纯录入回填场景 false） */
  showMeta?: boolean;
  defaultCategory?: string;
  categories?: string[];
  /** 确认按钮文案 */
  okText?: string;
  confirmLoading?: boolean;
}

const DEFAULT_CATEGORIES = ["病历", "处方", "检验单", "影像", "证件", "其他"];

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 压缩图片到合理尺寸（最长边 1600px，JPEG 0.82），返回 dataURL */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  const maxSide = 1600;
  let { naturalWidth: w, naturalHeight: h } = img;
  const longer = Math.max(w, h);
  if (longer > maxSide) {
    const scale = maxSide / longer;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function DocScanner({
  open, onClose, onConfirm, showMeta = true, defaultCategory = "病历",
  categories = DEFAULT_CATEGORIES, okText = "保存归档", confirmLoading = false,
}: DocScannerProps) {
  const [images, setImages] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [recognizing, setRecognizing] = useState(false);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImages([]);
    setOcrText("");
    setTitle("");
    setCategory(defaultCategory);
    setProgress("");
    setRecognizing(false);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const list: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        list.push(await compressImage(f));
      }
      if (list.length) {
        setImages((prev) => [...prev, ...list]);
      } else {
        message.warning("未识别到图片文件");
      }
    } catch {
      message.error("图片读取失败");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const handleRecognize = async () => {
    if (!images.length) {
      message.warning("请先添加要识别的图片");
      return;
    }
    setRecognizing(true);
    const parts: string[] = [];
    try {
      for (let i = 0; i < images.length; i++) {
        setProgress(`正在识别第 ${i + 1}/${images.length} 页…`);
        const text = await recognizeImage(images[i]);
        if (text) parts.push(text);
      }
      setOcrText(parts.join("\n\n").trim());
      setProgress("");
      message.success("识别完成，可在下方校对修改");
    } catch {
      setProgress("");
      message.error("识别失败，请重试或改用手动录入");
    } finally {
      setRecognizing(false);
    }
  };

  const handleConfirm = () => {
    onConfirm({ title, category, images, ocr_text: ocrText });
  };

  return (
    <Modal
      title={showMeta ? "扫描文档" : "扫描识别"}
      open={open}
      onCancel={() => { reset(); onClose(); }}
      onOk={handleConfirm}
      okText={okText}
      confirmLoading={confirmLoading || recognizing}
      width={640}
      destroyOnHidden
    >
      <div style={{ display: "grid", gap: 14 }}>
        {showMeta && (
          <div style={{ display: "flex", gap: 12 }}>
            <Input
              placeholder="文档标题（如：门诊病历 2026-10-15）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              value={category}
              style={{ width: 130 }}
              onChange={setCategory}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          </div>
        )}

        {/* 图片预览区 */}
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <Button
              icon={<CameraOutlined />}
              onClick={() => fileRef.current?.click()}
              loading={busy}
            >
              拍照 / 添加图片
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            {images.length > 0 && (
              <Button type="link" onClick={handleRecognize} disabled={recognizing}>
                {recognizing ? <><LoadingOutlined /> {progress || "识别中…"}</> : <><ScanOutlined /> 识别文字</>}
              </Button>
            )}
          </div>

          {images.length === 0 ? (
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: "1.5px dashed #d4dce8", borderRadius: 12, padding: "30px 16px",
                textAlign: "center", color: "var(--muted)", fontSize: 12, cursor: "pointer",
              }}
            >
              <PlusOutlined style={{ fontSize: 22, display: "block", marginBottom: 6 }} />
              点击或拍照添加纸质病历 / 处方 / 检验单，支持多页
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {images.map((src, i) => (
                <div key={i} style={{ position: "relative", width: 96, height: 96 }}>
                  <img
                    src={src}
                    alt={`第${i + 1}页`}
                    style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid #e6ecf3" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label={`删除第${i + 1}页`}
                    style={{
                      position: "absolute", top: -6, right: -6, width: 20, height: 20,
                      borderRadius: 10, border: "none", background: "#e5484d", color: "#fff",
                      cursor: "pointer", lineHeight: "20px", textAlign: "center", padding: 0,
                    }}
                  >
                    <DeleteOutlined style={{ fontSize: 11 }} />
                  </button>
                </div>
              ))}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 96, height: 96, border: "1.5px dashed #d4dce8", borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--muted)", cursor: "pointer", fontSize: 22,
                }}
              >
                <PlusOutlined />
              </div>
            </div>
          )}
        </div>

        {/* 识别文本 */}
        <div>
          <div style={{ fontSize: 12, color: "#8190a4", marginBottom: 6 }}>
            识别文本（可校对修改）
            {recognizing && <Spin size="small" style={{ marginLeft: 8 }} />}
          </div>
          <Input.TextArea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            placeholder={recognizing ? "识别中…" : "识别结果将显示在此，也可手动粘贴或录入"}
            rows={6}
            autoSize={{ minRows: 4, maxRows: 10 }}
          />
        </div>
      </div>
    </Modal>
  );
}
