/**
 * AI 供应商目录 —— 全站唯一数据源
 *
 * 集中维护「AI 模型供应商 + 云/开发平台」的 provider key、显示名、品牌色、
 * API 端点、以及 @lobehub/icons 品牌图标组件。ProviderIcon 与 ApiKeyManager
 * 均从此处取数，避免三处手工清单不一致。
 *
 * - key：与后端 ai_keys.json / agent.py PROVIDER_META 对齐（小写，唯一）
 * - color：品牌主色，用于卡片头像底色与图标 tint
 * - url：API 端点（可调用供应商）或官网（云平台，仅图标展示）
 * - icon：@lobehub/icons 品牌 SVG 组件（fill=currentColor，颜色由外层 color 控制）
 * - category：llm=对话模型 / media=图像·音视频 / cloud=云平台 / local=本地·聚合
 *
 * 说明：WorkBuddy 云端无独立品牌图标，由 ProviderIcon 用 BrandMark 兜底，不在此登记。
 */
import type { ComponentType, CSSProperties } from "react";
import {
  // —— 中国 · 对话模型 ——
  DeepSeek, Qwen, Kimi, Moonshot, Zhipu, ChatGLM, Baichuan, Baidu, Wenxin,
  Hunyuan, Tencent, Doubao, Volcengine, Minimax, Yi, ZeroOne, Stepfun, Spark,
  IFlyTekCloud, InternLM, Skywork, Tiangong, BAAI, SenseNova, GiteeAI, ByteDance,
  // —— 国际 · 对话模型 ——
  OpenAI, Anthropic, Claude, Gemini, Google, Grok, XAI, Mistral, Cohere, Meta,
  MetaAI, Perplexity, Together, Groq, Reka, Ai21, AlephAlpha, Stability,
  HuggingFace, Replicate, Fireworks, DeepInfra, Inflection, Upstage, SambaNova,
  Sakana, TII, NousResearch, DeepMind,
  // —— 本地 · 聚合 / 代理 ——
  SiliconCloud, ModelScope, OpenRouter, Ollama, LmStudio, Vllm, Xinference,
  NewAPI, CometAPI, DeepAI, Nebius, Hyperbolic,
  // —— 图像 · 音视频 ——
  Midjourney, Ideogram, Flux, Dalle, Sora, Recraft, Runway, Luma, Pika, Kling,
  Hailuo, Vidu, CogVideo, CogView, Jimeng, Kolors, DreamMachine, Suno,
  ElevenLabs, FishAudio,
  // —— 云 / 开发平台 ——
  Aws, Azure, AzureAI, GoogleCloud, AlibabaCloud, BaiduCloud, HuaweiCloud,
  TencentCloud, Cloudflare, DigitalOcean, Vercel, Railway, Zeabur, Lambda,
  Nvidia, Crusoe, Bedrock, VertexAI, WorkersAI, Alibaba, Huawei, Microsoft,
} from "@lobehub/icons";

export interface IconCompProps {
  size?: number | string;
  style?: CSSProperties;
}

export type AiProviderCategory = "llm" | "media" | "cloud" | "local";

export interface AiProvider {
  key: string;
  name: string;
  color: string;
  url: string;
  icon: ComponentType<IconCompProps>;
  category: AiProviderCategory;
}

export const AI_PROVIDERS: AiProvider[] = [
  // ============ 中国 · 对话模型（llm） ============
  { key: "deepseek", name: "DeepSeek", color: "#4d6bfe", url: "https://api.deepseek.com/v1", icon: DeepSeek, category: "llm" },
  { key: "qwen", name: "通义千问", color: "#615ced", url: "https://dashscope.aliyuncs.com/compatible-mode/v1", icon: Qwen, category: "llm" },
  { key: "kimi", name: "Kimi", color: "#16191e", url: "https://api.moonshot.cn/v1", icon: Kimi, category: "llm" },
  { key: "moonshot", name: "Moonshot", color: "#16191e", url: "https://api.moonshot.cn/v1", icon: Moonshot, category: "llm" },
  { key: "glm", name: "智谱 GLM", color: "#3859ff", url: "https://open.bigmodel.cn/api/paas/v4", icon: Zhipu, category: "llm" },
  { key: "chatglm", name: "ChatGLM", color: "#3859ff", url: "https://open.bigmodel.cn/api/paas/v4", icon: ChatGLM, category: "llm" },
  { key: "baichuan", name: "百川智能", color: "#2454ff", url: "https://api.baichuan-ai.com/v1", icon: Baichuan, category: "llm" },
  { key: "baidu", name: "百度文心", color: "#2932e1", url: "https://qianfan.baidubce.com/v2", icon: Baidu, category: "llm" },
  { key: "wenxin", name: "文心一言", color: "#2932e1", url: "https://qianfan.baidubce.com/v2", icon: Wenxin, category: "llm" },
  { key: "hunyuan", name: "腾讯混元", color: "#0052d9", url: "https://api.hunyuan.cloud.tencent.com/v1", icon: Hunyuan, category: "llm" },
  { key: "tencent", name: "腾讯", color: "#0052d9", url: "https://api.hunyuan.cloud.tencent.com/v1", icon: Tencent, category: "llm" },
  { key: "doubao", name: "豆包", color: "#3370ff", url: "https://ark.cn-beijing.volces.com/api/v3", icon: Doubao, category: "llm" },
  { key: "volcengine", name: "火山引擎", color: "#3370ff", url: "https://ark.cn-beijing.volces.com/api/v3", icon: Volcengine, category: "llm" },
  { key: "minimax", name: "MiniMax", color: "#e63e33", url: "https://api.minimax.chat/v1", icon: Minimax, category: "llm" },
  { key: "yi", name: "零一万物", color: "#6f42c1", url: "https://api.lingyiwanwu.com/v1", icon: Yi, category: "llm" },
  { key: "zeroone", name: "零一万物", color: "#6f42c1", url: "https://api.lingyiwanwu.com/v1", icon: ZeroOne, category: "llm" },
  { key: "stepfun", name: "阶跃星辰", color: "#0047bb", url: "https://api.stepfun.com/v1", icon: Stepfun, category: "llm" },
  { key: "spark", name: "讯飞星火", color: "#1e6fff", url: "https://spark-api-open.xf-yun.com/v1", icon: Spark, category: "llm" },
  { key: "iflytek", name: "讯飞", color: "#1e6fff", url: "https://spark-api-open.xf-yun.com/v1", icon: IFlyTekCloud, category: "llm" },
  { key: "internlm", name: "书生 InternLM", color: "#2878ff", url: "https://www.internlm.cn", icon: InternLM, category: "llm" },
  { key: "skywork", name: "天工 Skywork", color: "#fe615a", url: "https://www.tiangong.cn", icon: Skywork, category: "llm" },
  { key: "tiangong", name: "天工", color: "#fe615a", url: "https://www.tiangong.cn", icon: Tiangong, category: "llm" },
  { key: "baai", name: "智源 BAAI", color: "#0f6cff", url: "https://www.baai.ac.cn", icon: BAAI, category: "llm" },
  { key: "sensenova", name: "商汤日日新", color: "#ff4d00", url: "https://platform.sensenova.cn", icon: SenseNova, category: "llm" },
  { key: "giteeai", name: "Gitee AI", color: "#c71d23", url: "https://ai.gitee.com", icon: GiteeAI, category: "llm" },

  // ============ 国际 · 对话模型（llm） ============
  { key: "openai", name: "OpenAI", color: "#10a37f", url: "https://api.openai.com/v1", icon: OpenAI, category: "llm" },
  { key: "claude", name: "Claude", color: "#d97757", url: "https://api.anthropic.com/v1", icon: Claude, category: "llm" },
  { key: "anthropic", name: "Anthropic", color: "#d97757", url: "https://api.anthropic.com/v1", icon: Anthropic, category: "llm" },
  { key: "gemini", name: "Gemini", color: "#4285f4", url: "https://generativelanguage.googleapis.com/v1beta/openai", icon: Gemini, category: "llm" },
  { key: "google", name: "Google", color: "#4285f4", url: "https://ai.google.dev", icon: Google, category: "llm" },
  { key: "grok", name: "Grok", color: "#1a1a1a", url: "https://api.x.ai/v1", icon: Grok, category: "llm" },
  { key: "xai", name: "xAI", color: "#1a1a1a", url: "https://api.x.ai/v1", icon: XAI, category: "llm" },
  { key: "mistral", name: "Mistral", color: "#ff7000", url: "https://api.mistral.ai/v1", icon: Mistral, category: "llm" },
  { key: "cohere", name: "Cohere", color: "#39594c", url: "https://api.cohere.com/v2", icon: Cohere, category: "llm" },
  { key: "meta", name: "Meta Llama", color: "#0866ff", url: "https://ai.meta.com", icon: Meta, category: "llm" },
  { key: "metaai", name: "Meta AI", color: "#0866ff", url: "https://ai.meta.com", icon: MetaAI, category: "llm" },
  { key: "perplexity", name: "Perplexity", color: "#20808d", url: "https://api.perplexity.ai", icon: Perplexity, category: "llm" },
  { key: "together", name: "Together AI", color: "#0f6fff", url: "https://api.together.xyz/v1", icon: Together, category: "llm" },
  { key: "groq", name: "Groq", color: "#f55036", url: "https://api.groq.com/openai/v1", icon: Groq, category: "llm" },
  { key: "reka", name: "Reka AI", color: "#ff3355", url: "https://api.reka.ai", icon: Reka, category: "llm" },
  { key: "ai21", name: "AI21 Labs", color: "#00a99d", url: "https://api.ai21.com/studio/v1", icon: Ai21, category: "llm" },
  { key: "alephalpha", name: "Aleph Alpha", color: "#0c1e2f", url: "https://api.aleph-alpha.com", icon: AlephAlpha, category: "llm" },
  { key: "stability", name: "Stability AI", color: "#7c3aed", url: "https://api.stability.ai", icon: Stability, category: "llm" },
  { key: "huggingface", name: "Hugging Face", color: "#ff9d00", url: "https://api-inference.huggingface.co", icon: HuggingFace, category: "llm" },
  { key: "replicate", name: "Replicate", color: "#7057ff", url: "https://api.replicate.com/v1", icon: Replicate, category: "llm" },
  { key: "fireworks", name: "Fireworks AI", color: "#f33b4f", url: "https://api.fireworks.ai/inference/v1", icon: Fireworks, category: "llm" },
  { key: "deepinfra", name: "DeepInfra", color: "#6d28d9", url: "https://api.deepinfra.com/v1", icon: DeepInfra, category: "llm" },
  { key: "inflection", name: "Inflection", color: "#1a5cff", url: "https://api.inflection.ai", icon: Inflection, category: "llm" },
  { key: "upstage", name: "Upstage", color: "#7a5cff", url: "https://api.upstage.ai/v1", icon: Upstage, category: "llm" },
  { key: "sambanova", name: "SambaNova", color: "#ed6f1c", url: "https://api.sambanova.ai/v1", icon: SambaNova, category: "llm" },
  { key: "sakana", name: "Sakana AI", color: "#ff7300", url: "https://api.sakana.ai", icon: Sakana, category: "llm" },
  { key: "tii", name: "TII Falcon", color: "#1b1b1b", url: "https://falconllm.tii.ae", icon: TII, category: "llm" },
  { key: "nousresearch", name: "Nous Research", color: "#1b1b1b", url: "https://nousresearch.com", icon: NousResearch, category: "llm" },
  { key: "deepmind", name: "Google DeepMind", color: "#4285f4", url: "https://deepmind.google", icon: DeepMind, category: "llm" },

  // ============ 本地 · 聚合 / 代理（local） ============
  { key: "siliconcloud", name: "硅基流动", color: "#4f46e5", url: "https://api.siliconflow.cn/v1", icon: SiliconCloud, category: "local" },
  { key: "modelscope", name: "魔搭 ModelScope", color: "#624aff", url: "https://api-inference.modelscope.cn/v1", icon: ModelScope, category: "local" },
  { key: "openrouter", name: "OpenRouter", color: "#1b1b1b", url: "https://openrouter.ai/api/v1", icon: OpenRouter, category: "local" },
  { key: "ollama", name: "Ollama", color: "#1b1b1b", url: "http://localhost:11434/v1", icon: Ollama, category: "local" },
  { key: "lmstudio", name: "LM Studio", color: "#2d6cdf", url: "http://localhost:1234/v1", icon: LmStudio, category: "local" },
  { key: "vllm", name: "vLLM", color: "#2d6cdf", url: "http://localhost:8000/v1", icon: Vllm, category: "local" },
  { key: "xinference", name: "Xinference", color: "#0f6cff", url: "http://localhost:9997/v1", icon: Xinference, category: "local" },
  { key: "newapi", name: "New API", color: "#1b1b1b", url: "", icon: NewAPI, category: "local" },
  { key: "cometapi", name: "CometAPI", color: "#1b1b1b", url: "https://api.cometapi.com", icon: CometAPI, category: "local" },
  { key: "deepai", name: "DeepAI", color: "#1b1b1b", url: "https://api.deepai.org", icon: DeepAI, category: "local" },
  { key: "nebius", name: "Nebius AI", color: "#1b1b1b", url: "https://api.nebius.ai/v1", icon: Nebius, category: "local" },
  { key: "hyperbolic", name: "Hyperbolic", color: "#1b1b1b", url: "https://api.hyperbolic.xyz/v1", icon: Hyperbolic, category: "local" },

  // ============ 图像 · 音视频（media） ============
  { key: "midjourney", name: "Midjourney", color: "#5865f2", url: "https://www.midjourney.com", icon: Midjourney, category: "media" },
  { key: "ideogram", name: "Ideogram", color: "#4f46e5", url: "https://ideogram.ai", icon: Ideogram, category: "media" },
  { key: "flux", name: "Flux", color: "#1b1b1b", url: "https://blackforestlabs.ai", icon: Flux, category: "media" },
  { key: "dalle", name: "DALL·E", color: "#10a37f", url: "https://api.openai.com/v1", icon: Dalle, category: "media" },
  { key: "sora", name: "Sora", color: "#10a37f", url: "https://openai.com/sora", icon: Sora, category: "media" },
  { key: "recraft", name: "Recraft", color: "#ff6b00", url: "https://www.recraft.ai", icon: Recraft, category: "media" },
  { key: "runway", name: "Runway", color: "#7c3aed", url: "https://runwayml.com", icon: Runway, category: "media" },
  { key: "luma", name: "Luma AI", color: "#8b5cf6", url: "https://lumalabs.ai", icon: Luma, category: "media" },
  { key: "pika", name: "Pika", color: "#7c3aed", url: "https://pika.art", icon: Pika, category: "media" },
  { key: "kling", name: "可灵 Kling", color: "#e60012", url: "https://klingai.com", icon: Kling, category: "media" },
  { key: "hailuo", name: "海螺 Hailuo", color: "#00a0e9", url: "https://hailuoai.video", icon: Hailuo, category: "media" },
  { key: "vidu", name: "Vidu", color: "#7c3aed", url: "https://www.vidu.com", icon: Vidu, category: "media" },
  { key: "cogvideo", name: "CogVideo", color: "#3859ff", url: "https://open.bigmodel.cn", icon: CogVideo, category: "media" },
  { key: "cogview", name: "CogView", color: "#3859ff", url: "https://open.bigmodel.cn", icon: CogView, category: "media" },
  { key: "jimeng", name: "即梦 Jimeng", color: "#3370ff", url: "https://jimeng.jianying.com", icon: Jimeng, category: "media" },
  { key: "kolors", name: "可图 Kolors", color: "#325ab4", url: "https://kolors.com", icon: Kolors, category: "media" },
  { key: "dreammachine", name: "Dream Machine", color: "#8b5cf6", url: "https://lumalabs.ai/dream-machine", icon: DreamMachine, category: "media" },
  { key: "suno", name: "Suno", color: "#1b1b1b", url: "https://suno.com", icon: Suno, category: "media" },
  { key: "elevenlabs", name: "ElevenLabs", color: "#1b1b1b", url: "https://api.elevenlabs.io", icon: ElevenLabs, category: "media" },
  { key: "fishaudio", name: "Fish Audio", color: "#ff5c00", url: "https://fish.audio", icon: FishAudio, category: "media" },

  // ============ 云 / 开发平台（cloud） ============
  { key: "aws", name: "AWS", color: "#ff9900", url: "https://aws.amazon.com", icon: Aws, category: "cloud" },
  { key: "azure", name: "Azure", color: "#0078d4", url: "https://azure.microsoft.com", icon: Azure, category: "cloud" },
  { key: "azureai", name: "Azure AI", color: "#0078d4", url: "https://azure.microsoft.com", icon: AzureAI, category: "cloud" },
  { key: "googlecloud", name: "Google Cloud", color: "#4285f4", url: "https://cloud.google.com", icon: GoogleCloud, category: "cloud" },
  { key: "alibabacloud", name: "阿里云", color: "#ff6a00", url: "https://www.aliyun.com", icon: AlibabaCloud, category: "cloud" },
  { key: "alibaba", name: "阿里巴巴", color: "#ff6a00", url: "https://www.alibaba.com", icon: Alibaba, category: "cloud" },
  { key: "baiducloud", name: "百度智能云", color: "#2932e1", url: "https://cloud.baidu.com", icon: BaiduCloud, category: "cloud" },
  { key: "huaweicloud", name: "华为云", color: "#c7000b", url: "https://www.huaweicloud.com", icon: HuaweiCloud, category: "cloud" },
  { key: "huawei", name: "华为", color: "#c7000b", url: "https://www.huawei.com", icon: Huawei, category: "cloud" },
  { key: "tencentcloud", name: "腾讯云", color: "#0052d9", url: "https://cloud.tencent.com", icon: TencentCloud, category: "cloud" },
  { key: "cloudflare", name: "Cloudflare", color: "#f38020", url: "https://www.cloudflare.com", icon: Cloudflare, category: "cloud" },
  { key: "digitalocean", name: "DigitalOcean", color: "#0080ff", url: "https://www.digitalocean.com", icon: DigitalOcean, category: "cloud" },
  { key: "vercel", name: "Vercel", color: "#1b1b1b", url: "https://vercel.com", icon: Vercel, category: "cloud" },
  { key: "railway", name: "Railway", color: "#0b0d0e", url: "https://railway.app", icon: Railway, category: "cloud" },
  { key: "zeabur", name: "Zeabur", color: "#1b1b1b", url: "https://zeabur.com", icon: Zeabur, category: "cloud" },
  { key: "lambda", name: "Lambda Labs", color: "#1b1b1b", url: "https://lambdalabs.com", icon: Lambda, category: "cloud" },
  { key: "nvidia", name: "NVIDIA", color: "#76b900", url: "https://build.nvidia.com", icon: Nvidia, category: "cloud" },
  { key: "crusoe", name: "Crusoe", color: "#1b1b1b", url: "https://crusoe.ai", icon: Crusoe, category: "cloud" },
  { key: "bedrock", name: "AWS Bedrock", color: "#ff9900", url: "https://aws.amazon.com/bedrock", icon: Bedrock, category: "cloud" },
  { key: "vertexai", name: "Vertex AI", color: "#4285f4", url: "https://cloud.google.com/vertex-ai", icon: VertexAI, category: "cloud" },
  { key: "workersai", name: "Workers AI", color: "#f38020", url: "https://developers.cloudflare.com/workers-ai", icon: WorkersAI, category: "cloud" },
  { key: "microsoft", name: "Microsoft", color: "#5e5e5e", url: "https://www.microsoft.com", icon: Microsoft, category: "cloud" },
  { key: "bytedance", name: "字节跳动", color: "#3370ff", url: "https://www.volcengine.com", icon: ByteDance, category: "cloud" },
];

/** 主供应商索引（key → AiProvider），供 O(1) 查询 */
const BY_KEY: Record<string, AiProvider> = {};
for (const p of AI_PROVIDERS) BY_KEY[p.key] = p;

/** key → 图标组件映射，供 ProviderIcon 渲染 */
const ICON_MAP: Record<string, ComponentType<IconCompProps>> = {};
for (const p of AI_PROVIDERS) ICON_MAP[p.key] = p.icon;

export function getAiProvider(key: string): AiProvider | undefined {
  return BY_KEY[(key || "").toLowerCase()];
}

export function getProviderIcon(key: string): ComponentType<IconCompProps> | undefined {
  return ICON_MAP[(key || "").toLowerCase()];
}
