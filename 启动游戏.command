#!/bin/bash
# ============================================================
#  红色警报 RED ALERT - macOS one-click launcher
#  Double-click this file to install (first run only) and play.
#  If macOS blocks it: right-click the file -> Open -> Open.
# ============================================================
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo " [X] 没有检测到 Node.js / Node.js not found"
  echo ""
  echo "     请先安装 Node.js（免费，装一次就行）:"
  echo "     1. 打开网址  https://nodejs.org/zh-cn"
  echo "     2. 点绿色的下载按钮，下载后双击安装，一路点\"继续\""
  echo "     3. 装好后，再回来双击本文件"
  echo ""
  read -r -p " 按回车键退出 / press Enter to exit"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo ""
  echo " 第一次运行，正在自动安装（大约 1-2 分钟，只需要装这一次）..."
  echo " First run: installing, about 1-2 minutes..."
  echo ""
  if ! npm install --no-audit --no-fund; then
    echo ""
    echo " [X] 安装失败，请检查网络后重新双击本文件"
    read -r -p " 按回车键退出 / press Enter to exit"
    exit 1
  fi
fi

echo ""
echo " 正在启动游戏... 浏览器几秒后会自动打开"
echo " ============================================"
echo "  玩的时候请不要关闭这个窗口！"
echo "  Keep this window open while playing!"
echo " ============================================"
echo ""

(sleep 4 && open "http://localhost:5173") &
npm run dev
