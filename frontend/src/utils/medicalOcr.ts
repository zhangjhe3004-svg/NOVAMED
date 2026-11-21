/**
 * 病历 OCR 文本结构化 —— 把扫描识别出的整段文字，按常见病历关键词
 * 粗略切分到「主诉 / 诊断 / 处方」等字段，供录入表单回填。
 * 识别不精确时用户仍可手动修正，因此这里用保守启发式，不做过度承诺。
 */

export interface ParsedMedicalOcr {
  symptoms: string;
  diagnosis: string;
  prescription: string;
  rest: string;
}

const FIELD_RULES: Array<{ field: keyof ParsedMedicalOcr; keys: string[] }> = [
  { field: "symptoms", keys: ["主诉", "症状", "现病史", "主症", "不适"] },
  { field: "diagnosis", keys: ["诊断", "初步诊断", "诊断意见", "印象"] },
  { field: "prescription", keys: ["处方", "用药", "医嘱", "治疗", "Rp", "RP", "处理"] },
];

export function parseMedicalOcr(text: string): ParsedMedicalOcr {
  const result: ParsedMedicalOcr = { symptoms: "", diagnosis: "", prescription: "", rest: "" };
  if (!text || !text.trim()) return result;

  // 按空行 / 换行切段，保留无分段的整段兜底
  const segments = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const restParts: string[] = [];
  for (const seg of segments) {
    const rule = FIELD_RULES.find((r) => r.keys.some((k) => seg.includes(k)));
    if (rule) {
      const cleaned = seg.replace(/^(主诉|症状|现病史|诊断|初步诊断|诊断意见|印象|处方|用药|医嘱|治疗|处理|Rp|RP)\s*[:：]?/, "").trim();
      if (cleaned) result[rule.field] = (result[rule.field] ? result[rule.field] + " " : "") + cleaned;
    } else {
      restParts.push(seg);
    }
  }

  // 兜底：完全没命中任何字段时，整体归入主诉
  if (!result.symptoms && !result.diagnosis && !result.prescription && restParts.length) {
    result.symptoms = restParts.join(" ");
    return result;
  }
  result.rest = restParts.join(" ");
  return result;
}
