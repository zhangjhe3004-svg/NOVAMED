/**
 * 语音转文字输入框 —— 封装浏览器 Web Speech API（webkitSpeechRecognition）
 *
 * 用法：完全兼容 antd Input.TextArea 的 props，额外支持语音识别。
 * - 右侧显示麦克风按钮，点击开始/停止语音输入
 * - 中文识别（zh-CN），支持连续识别与临时结果
 * - 识别文本自动追加到输入框
 *
 * 依赖浏览器原生能力，不支持时自动隐藏麦克风按钮（降级为普通输入框）。
 */
import { useEffect, useRef, useState } from "react";
import { Input, message, Tooltip } from "antd";
import { AudioOutlined } from "@ant-design/icons";
import type { TextAreaProps } from "antd/es/input";

interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike[] };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}

type VoiceTextAreaProps = TextAreaProps & {
  /** 语音识别引擎的语言，默认中文 */
  speechLang?: string;
};

export default function VoiceTextArea({ value, onChange, speechLang = "zh-CN", ...rest }: VoiceTextAreaProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  // 用 ref 保存最新值，避免闭包过期
  const valueRef = useRef<any>(value);
  valueRef.current = value;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);

    const r = new SR();
    r.lang = speechLang;
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e: SpeechRecognitionEventLike) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0]?.transcript || "";
      }
      if (!text) return;
      const prev = valueRef.current ? String(valueRef.current) : "";
      // 若上一段末尾无标点，用中文逗号衔接
      const joiner = prev && !/[，。！？、；,.!?;]$/.test(prev.trim()) ? "，" : "";
      const next = prev + joiner + text;
      onChange?.(next as any);
    };

    r.onerror = (e: SpeechRecognitionErrorEventLike) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        message.error("未获得麦克风权限，请在浏览器设置中允许");
      } else if (e.error === "no-speech") {
        message.info("未检测到语音");
      } else if (e.error !== "aborted") {
        message.error("语音识别出错");
      }
      setListening(false);
    };

    r.onend = () => setListening(false);

    recognitionRef.current = r;
    return () => {
      try { r.abort(); } catch { /* 忽略 */ }
    };
  }, [speechLang]);

  const toggle = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) {
      r.stop();
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  };

  const suffix = supported ? (
    <Tooltip title={listening ? "点击停止语音输入" : "点击开始语音输入"}>
      <AudioOutlined
        onClick={toggle}
        style={{
          cursor: "pointer",
          fontSize: 16,
          color: listening ? "#f5222d" : "#8c98aa",
          animation: listening ? "wb-voice-pulse 1s ease-in-out infinite" : undefined,
        }}
      />
    </Tooltip>
  ) : undefined;

  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", width: "100%", gap: 6 }}>
      <Input.TextArea
        {...rest}
        value={value}
        onChange={onChange}
        style={{ flex: 1, ...(rest.style as object) }}
      />
      {suffix && (
        <button
          type="button"
          onClick={toggle}
          title={listening ? "停止语音输入" : "语音转文字"}
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${listening ? "#f5222d" : "#e0e6ee"}`,
            background: listening ? "#fff1f0" : "#f7f9fc",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: listening ? "#f5222d" : "#8c98aa",
          }}
        >
          <AudioOutlined style={{ fontSize: 16 }} />
        </button>
      )}
    </span>
  );
}
