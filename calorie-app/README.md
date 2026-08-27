# 食刻 · 拍照测热量

拍一张食物照片，AI 自动识别食物、估算份量，并给出热量与三大营养素（蛋白质 / 脂肪 / 碳水）的估算值。

## 功能

- 📸 拍照或从相册选择食物照片（移动端优先的 H5 页面）
- 🔍 AI 识别每种食物并估算份量、热量、营养成分与置信度
- 📊 整餐总热量 + 每种食物的明细卡片
- 💡 一句健康小建议
- 🗓 历史记录与今日累计热量（保存在浏览器本地，不上传）

## 技术架构

```
手机浏览器（public/index.html）
   │  拍照 → canvas 压缩为 JPEG → POST /api/analyze
   ▼
Node 服务端（server.mjs）
   │  调用 Claude 视觉模型（claude-opus-5），结构化输出食物营养数据
   ▼
Anthropic API
```

API Key 只保存在服务端，前端不接触任何密钥。

## 运行

```bash
cd calorie-app
npm install

# 正式模式（需要 Anthropic API Key）
export ANTHROPIC_API_KEY=sk-ant-...
npm start

# 演示模式（不调用真实 AI，返回示例数据，用于体验界面）
npm run mock
```

打开 `http://localhost:3000`（手机与电脑同一局域网时，用电脑的局域网 IP 访问即可在手机上拍照体验）。

## 接口

`POST /api/analyze`

请求体：

```json
{ "image": "<base64 编码的图片>", "media_type": "image/jpeg" }
```

返回：

```json
{
  "is_food": true,
  "meal_name": "番茄炒蛋盖饭",
  "items": [
    { "name": "米饭", "portion": "约200克 / 1碗", "calories_kcal": 232,
      "protein_g": 5.2, "fat_g": 0.6, "carbs_g": 51.6, "confidence": "high" }
  ],
  "total_calories_kcal": 442,
  "health_tip": "……"
}
```

## 改造为微信小程序

后端接口可以原样复用，只需：

1. 把服务部署到有 HTTPS 域名的服务器，并在小程序后台配置 request 合法域名；
2. 小程序端用 `wx.chooseMedia` 拍照、`wx.compressImage` 压缩，再把图片 base64 后 POST 到 `/api/analyze`；
3. 页面结构可直接参照 `public/index.html` 的布局（总热量卡片 + 食物明细 + 历史记录）。

## 说明

热量与营养数据为 AI 基于照片的估算值，受拍摄角度、份量判断影响，仅供参考，不能替代专业营养建议。
