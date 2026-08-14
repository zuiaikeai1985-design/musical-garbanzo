import type { PromptStyle } from "./types";

export const STYLE_OPTIONS: { id: PromptStyle; label: string; hint: string }[] = [
  { id: "bilingual", label: "双语", hint: "中文说明 + 英文提示词" },
  { id: "zh", label: "中文详细", hint: "适合阅读和再创作" },
  { id: "midjourney", label: "Midjourney", hint: "英文提示词 + 参数建议" },
  { id: "flux", label: "Flux", hint: "自然段落式英文" },
  { id: "sd", label: "Stable Diffusion", hint: "逗号分隔标签" },
];

export function buildSystemPrompt(style: PromptStyle): string {
  const formatHint: Record<PromptStyle, string> = {
    bilingual:
      "prompt 用中文写一段可直接使用的完整提示词；promptEn 写对应的英文提示词，适合主流文生图模型。",
    zh: "prompt 用中文写一段完整、具体、可直接使用的提示词；promptEn 仍提供对应英文。",
    midjourney:
      "prompt 用中文简述画面；promptEn 写成 Midjourney 风格：主体在前，逗号分隔，末尾可给 --ar、--stylize 等建议参数。",
    flux: "prompt 用中文简述画面；promptEn 写成 Flux 风格的自然英文段落，强调主体、材质、光影和镜头。",
    sd: "prompt 用中文简述画面；promptEn 写成 Stable Diffusion 标签：小写英文、逗号分隔、质量词靠后。",
  };

  return `你是资深的图像提示词反推助手。用户会上传一张图片，你要仔细观察后，把它还原成高质量、可直接用于文生图的提示词。

要求：
- 只根据图中真实可见的内容来写，不要编造图里没有的物体。
- 覆盖：主体、场景、构图、视角、光线、色彩、材质、氛围、画风或摄影风格。
- 中文要具体、好读；英文要适合投给文生图模型。
- 负面提示词只写常见干扰项，不要太长。
- 分析字段全部用中文，简短准确。

输出格式（必须是合法 JSON，不要 markdown 代码块）：
{
  "prompt": "中文提示词",
  "promptEn": "English prompt",
  "negative": "负面提示词，中英均可",
  "analysis": {
    "subject": "主体",
    "style": "风格",
    "composition": "构图",
    "lighting": "光影",
    "colors": "色彩",
    "atmosphere": "氛围"
  }
}

当前输出偏好：${formatHint[style]}`;
}
