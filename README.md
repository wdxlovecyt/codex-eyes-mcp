# @huangwu/codex-eyes-mcp

一个基于 Playwright 的 MCP server，用来让 Codex 打开页面、执行交互动作并返回截图，适合做前端视觉排查。

这个包只负责提供 MCP runtime。推荐在 Codex 里这样接入：

```bash
codex mcp add codex-eyes -- npx -y @huangwu/codex-eyes-mcp
```

## 提供的 Tool

这个包暴露一个 MCP tool：

- `capture_page`

默认行为：

- 已知项目实际启动 URL 时，优先把它显式传给 `url`
- 只有在拿不到项目启动 URL 时，才回退到默认页面 `http://localhost:5173`
- 默认浏览器：`chromium`
- 默认直接返回图片内容，不强制写入本地文件
- 只有传入 `output` 时，才会额外保存截图到本地绝对路径

## 支持的参数

- `url`
- `output`
- `waitFor`
- `delayMs`
- `fullPage`
- `width`
- `height`
- `timeoutMs`
- `browser`
- `actions`

`actions` 支持：

- `click`
- `fill`
- `press`
- `selectOption`
- `hover`
- `waitFor`
- `wait`

示例：

```json
{
  "url": "http://localhost:5173",
  "actions": [
    { "type": "fill", "selector": ".search-bar input", "value": "深圳旅游攻略" },
    { "type": "click", "selector": ".search-bar button" },
    { "type": "wait", "durationMs": 1200 }
  ]
}
```

## Selector 建议

- 尽量使用精确 selector，不要默认使用 `input`、`button`、`div` 这种宽选择器
- 优先使用“容器 + 元素”的写法，例如 `.search-bar input`
- 优先使用更稳定的属性，例如 `input[placeholder*="攻略"]`

## 返回结果

`capture_page` 会返回：

- 文本结果
- 图片结果
- 结构化字段，例如 `url`、`title`、`actionsExecuted`、`viewport`、`fullPage`

## 本地开发

在包目录下安装依赖：

```bash
npm install
```

手动启动 MCP server：

```bash
node cli.mjs
```
