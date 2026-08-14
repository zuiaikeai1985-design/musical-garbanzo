import { buildSystemPrompt } from "@/lib/prompts";
import type { AnalyzeRequest, AnalyzeResult, PromptStyle } from "@/lib/types";
import { NextResponse } from "next/server";

const STYLES: PromptStyle[] = ["bilingual", "zh", "midjourney", "flux", "sd"];

function isPromptStyle(value: unknown): value is PromptStyle {
  return typeof value === "string" && STYLES.includes(value as PromptStyle);
}

function extractJson(text: string): AnalyzeResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("模型没有返回可用的 JSON");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<AnalyzeResult>;
  return {
    prompt: parsed.prompt?.trim() || "",
    promptEn: parsed.promptEn?.trim() || "",
    negative: parsed.negative?.trim() || "",
    analysis: {
      subject: parsed.analysis?.subject?.trim() || "",
      style: parsed.analysis?.style?.trim() || "",
      composition: parsed.analysis?.composition?.trim() || "",
      lighting: parsed.analysis?.lighting?.trim() || "",
      colors: parsed.analysis?.colors?.trim() || "",
      atmosphere: parsed.analysis?.atmosphere?.trim() || "",
    },
  };
}

export async function POST(request: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  if (!body.image || !body.mimeType || !isPromptStyle(body.style)) {
    return NextResponse.json({ error: "请上传图片并选择输出风格" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim() || process.env.OPENAI_API_KEY || "";
  const baseUrl = (body.baseUrl?.trim() || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = body.model?.trim() || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json(
      { error: "还没有配置 API Key。请先在右上角「设置」里填入，或在服务器环境变量中配置 OPENAI_API_KEY。" },
      { status: 400 },
    );
  }

  const dataUrl = `data:${body.mimeType};base64,${body.image}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: buildSystemPrompt(body.style) },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请反推这张图片的提示词，并按要求返回 JSON。",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message || `模型接口返回 ${response.status}` },
        { status: 502 },
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "模型没有返回内容" }, { status: 502 });
    }

    return NextResponse.json(extractJson(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : "反推失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
