# @huangwu/codex-eyes-mcp

一个基于 Playwright 的 MCP server，用来让 Codex 在前端开发过程中打开页面、执行交互并返回截图。

## 安装

```bash
codex mcp add codex-eyes -- npx -y @huangwu/codex-eyes-mcp
```

## 说明

- 提供一个 MCP tool：`capture_page`
- 适合在改样式、查布局、验证交互状态和做视觉回归时使用
- 建议结合项目实际页面结构、真实运行 URL 和相关 skill 一起使用，这样更容易获得稳定结果
