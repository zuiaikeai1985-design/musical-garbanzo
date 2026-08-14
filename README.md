# 画语

上传一张图，反推出可直接使用的中文和英文提示词。

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 怎么用

1. 上传或拖入一张图片
2. 选择输出风格：双语、中文详细、Midjourney、Flux、Stable Diffusion
3. 在右上角「设置」里填入能看图的模型 API Key
4. 点击「反推提示词」

Key 只保存在浏览器本地。也可以改用兼容 OpenAI 接口的服务，例如硅基流动、通义。

## 服务器环境变量（可选）

复制 `.env.example` 为 `.env.local`：

```
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

配置后，即使用户没有在页面里填 Key，也可以走服务器上的密钥。
