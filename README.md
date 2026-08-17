# Dust Outpost

浏览器里玩的 CS 风格 FPS。请在**你自己的电脑**上启动，不要打开云端或聊天里的 `localhost:5173`——那是远程机器的地址，你的浏览器打不开。

## 在你电脑上玩

需要先安装 [Node.js](https://nodejs.org/)（LTS 即可），然后在终端执行：

```bash
git clone -b cursor/cs-style-fps-game-63c1 https://github.com/zuiaikeai1985-design/musical-garbanzo.git
cd musical-garbanzo
npm install
npm run dev
```

终端会出现一行 **Local: http://localhost:5173/**，用 Chrome 或 Edge 打开**这一行**的地址。

点 **恐怖分子** 或 **反恐精英**，再单击游戏画面锁定鼠标。按 `Esc` 解锁。

如果已经克隆过仓库：

```bash
git fetch origin
git checkout cursor/cs-style-fps-game-63c1
git pull origin cursor/cs-style-fps-game-63c1
npm install
npm run dev
```

不要用 `main` 分支，那个还是旧的 Remotion 模板，不是这款游戏。

## 操作

| 按键 | 作用 |
| --- | --- |
| WASD | 移动 |
| 鼠标 | 瞄准 |
| 左键 / 右键 | 射击 / AWP 开镜 |
| 空格 / Ctrl / Shift | 跳 / 蹲 / 静步 |
| R | 换弹 |
| 1 2 3 | 步枪 / 手枪 / 刀 |
| B | 购买菜单 |
| Tab | 计分板 |
| Esc | 暂停 |

手机或微信内置浏览器玩不了，请用电脑。
