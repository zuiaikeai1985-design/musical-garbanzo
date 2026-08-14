export type PromptStyle = "bilingual" | "zh" | "midjourney" | "flux" | "sd";

export type AnalyzeResult = {
  prompt: string;
  promptEn: string;
  negative: string;
  analysis: {
    subject: string;
    style: string;
    composition: string;
    lighting: string;
    colors: string;
    atmosphere: string;
  };
};

export type AnalyzeRequest = {
  image: string;
  mimeType: string;
  style: PromptStyle;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};
