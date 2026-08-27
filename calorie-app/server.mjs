import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MOCK = process.env.MOCK === "1";

const FoodAnalysisSchema = z.object({
  is_food: z.boolean().describe("图片中是否包含食物"),
  meal_name: z.string().describe("对这一餐的简短命名，例如“番茄炒蛋盖饭”"),
  items: z.array(
    z.object({
      name: z.string().describe("食物名称（中文）"),
      portion: z.string().describe("估算的份量描述，例如“约150克 / 1碗”"),
      calories_kcal: z.number().describe("该食物的估算热量（千卡）"),
      protein_g: z.number().describe("蛋白质克数"),
      fat_g: z.number().describe("脂肪克数"),
      carbs_g: z.number().describe("碳水化合物克数"),
      confidence: z.enum(["high", "medium", "low"]).describe("识别与估算的置信度"),
    }),
  ),
  total_calories_kcal: z.number().describe("整餐估算总热量（千卡）"),
  health_tip: z.string().describe("一句简短的中文健康建议"),
});

const MOCK_RESULT = {
  is_food: true,
  meal_name: "番茄炒蛋盖饭（演示数据）",
  items: [
    {
      name: "米饭",
      portion: "约200克 / 1碗",
      calories_kcal: 232,
      protein_g: 5.2,
      fat_g: 0.6,
      carbs_g: 51.6,
      confidence: "high",
    },
    {
      name: "番茄炒蛋",
      portion: "约180克",
      calories_kcal: 210,
      protein_g: 10.5,
      fat_g: 15.2,
      carbs_g: 7.8,
      confidence: "medium",
    },
  ],
  total_calories_kcal: 442,
  health_tip: "这餐碳水偏高，可以搭配一份绿叶蔬菜让营养更均衡。",
};

let client = null;
function getClient() {
  if (!client) {
    try {
      client = new Anthropic();
    } catch {
      throw Object.assign(
        new Error("服务端未配置 ANTHROPIC_API_KEY，无法调用 AI；可先用 npm run mock 体验演示模式"),
        { status: 500 },
      );
    }
  }
  return client;
}

async function analyzeImage(base64Data, mediaType) {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    return MOCK_RESULT;
  }

  const response = await getClient().messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system:
      "你是一位专业营养师。用户会发来一张食物照片，请识别其中的每种食物，" +
      "根据画面中的参照物（餐具、餐盘大小等）估算份量，并给出热量与三大营养素的估算值。" +
      "估算要务实：不确定时给出中间值并用 confidence 标注置信度。" +
      "所有文字使用简体中文。如果图片里没有食物，把 is_food 设为 false，其余字段给出空列表或 0。",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          },
          { type: "text", text: "请分析这张照片中食物的热量和营养成分。" },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(FoodAnalysisSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("模型返回的结果无法解析，请重试");
  }
  return response.parsed_output;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const rel = urlPath === "/" ? "index.html" : urlPath.slice(1);
  const filePath = path.join(here, "public", path.normalize(rel));
  if (!filePath.startsWith(path.join(here, "public"))) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}

function readJsonBody(req, maxBytes = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("图片太大，请压缩后重试"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(Object.assign(new Error("请求格式错误"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function handleAnalyze(req, res) {
  try {
    const body = await readJsonBody(req);
    const { image, media_type: mediaType } = body || {};
    if (typeof image !== "string" || !image) {
      throw Object.assign(new Error("缺少图片数据"), { status: 400 });
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      throw Object.assign(new Error("不支持的图片格式"), { status: 400 });
    }
    // 前端传的是纯 base64；如果带 dataURL 前缀这里去掉
    const base64Data = image.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");

    const result = await analyzeImage(base64Data, mediaType);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result));
  } catch (error) {
    let status = error.status || 500;
    let message = error.message || "服务器内部错误";
    if (error instanceof Anthropic.AuthenticationError) {
      status = 500;
      message = "服务端未配置有效的 ANTHROPIC_API_KEY";
    } else if (error instanceof Anthropic.RateLimitError) {
      status = 429;
      message = "请求太频繁，请稍后再试";
    } else if (error instanceof Anthropic.APIError) {
      status = 502;
      message = `AI 服务出错（${error.status}），请稍后重试`;
    }
    console.error("analyze error:", error);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/analyze") {
    handleAnalyze(req, res);
  } else if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
  } else {
    res.writeHead(405).end();
  }
});

server.listen(PORT, () => {
  console.log(`拍照测热量服务已启动: http://localhost:${PORT}${MOCK ? "（演示模式，不调用真实 AI）" : ""}`);
});
