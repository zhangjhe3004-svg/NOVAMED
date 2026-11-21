/** 统一错误文案：FastAPI detail 可能是字符串（业务错误）或数组（422 校验错误） */
export const errText = (e: any, fallback: string) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return fallback;
};
