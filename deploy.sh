#!/bin/bash

# Obsidian Plugin 部署腳本
# 此腳本會刪除舊的 plugin 檔案並複製新編譯的檔案

set -e  # 遇到錯誤立即停止

# 設定路徑
SOURCE_DIR="/Volumes/wow/active/github/obsidian-plunin-auto_links"
TARGET_DIR="/Users/taishen/mynote/.obsidian/plugins/obsidian-dynamic-link"

echo "🚀 開始部署 Obsidian Plugin..."

# 檢查來源檔案是否存在
if [ ! -f "$SOURCE_DIR/main.js" ]; then
    echo "❌ 錯誤: 找不到編譯後的 main.js"
    echo "   請先執行: npm run build"
    exit 1
fi

if [ ! -f "$SOURCE_DIR/manifest.json" ]; then
    echo "❌ 錯誤: 找不到 manifest.json"
    exit 1
fi

# 檢查目標目錄是否存在,不存在則建立
if [ ! -d "$TARGET_DIR" ]; then
    echo "📁 建立目標目錄: $TARGET_DIR"
    mkdir -p "$TARGET_DIR"
fi

# 刪除舊檔案 (如果存在)
if [ -f "$TARGET_DIR/main.js" ]; then
    echo "🗑️  刪除舊的 main.js"
    rm "$TARGET_DIR/main.js"
fi

if [ -f "$TARGET_DIR/manifest.json" ]; then
    echo "🗑️  刪除舊的 manifest.json"
    rm "$TARGET_DIR/manifest.json"
fi

# 複製新檔案
echo "📦 複製 main.js..."
cp "$SOURCE_DIR/main.js" "$TARGET_DIR/main.js"

echo "📦 複製 manifest.json..."
cp "$SOURCE_DIR/manifest.json" "$TARGET_DIR/manifest.json"

echo "✅ 部署完成!"
echo ""
echo "📝 下一步:"
echo "   1. 在 Obsidian 中按 Ctrl/Cmd + P"
echo "   2. 執行 'Reload app without saving'"
echo "   3. 測試 plugin 功能"
