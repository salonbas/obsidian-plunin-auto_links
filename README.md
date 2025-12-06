# Obsidian Vocab Linker Plugin

自動在單字和例句之間建立雙向連結的 Obsidian 插件。

## 功能特色

- **防抖動處理**：停止打字 2 秒後才執行，避免編輯時文字跳動
- **智慧 ID 生成**：自動為單字和例句生成 `^xxxxxx` ID
- **雙向連結**：
  - 上方單字區：自動加上 `[s1](#^sentence_id)`
  - 下方例句區：自動將單字轉換為 `[word](#^vocab_id)`

## 使用方式

1. 在筆記中使用 `---` 分隔單字區和例句區：

```
knowability

---

Scientific research aims to expand our knowability of the universe.
```

2. 停止編輯並等待 2 秒

3. 自動轉換為：

```
knowability [s1](#^a1b2c3) ^x9y8z7

---

Scientific research aims to expand our [knowability](#^x9y8z7) of the universe. ^a1b2c3
```

## 開發指南

### 初次設定

```bash
# 安裝依賴
npm install

# 開發模式（自動監聽檔案變化）
npm run dev

# 生產建置
npm run build
```

### 開發工作流程

1. 執行 `npm run dev` 啟動 Watch Mode
2. 修改 `src/main.ts` 並儲存
3. 在 Obsidian 中按 `Ctrl/Cmd + P` → `Reload app without saving`
4. 測試功能

### 架構說明

- **package.json**：定義依賴與建置腳本
- **esbuild.config.mjs**：建置配置（處理 External vs Bundle）
- **tsconfig.json**：TypeScript 編譯設定
- **src/main.ts**：Plugin 核心邏輯
- **manifest.json**：Obsidian Plugin 描述檔

## 技術細節

### External vs Bundled Dependencies

**External（不打包）：**
- `obsidian`、`electron`、`@codemirror/*`
- 原因：Obsidian App 已內建，重複打包會造成衝突

**Bundled（需打包）：**
- 第三方工具庫（如 lodash、uuid）
- 原因：Obsidian 未內建，必須包進 `main.js`

## License

MIT

