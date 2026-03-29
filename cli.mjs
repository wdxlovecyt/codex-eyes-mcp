#!/usr/bin/env node

import process from 'node:process'

function printHelp() {
  console.log(`codex-eyes-mcp

Usage:
  codex-eyes-mcp
  codex-eyes-mcp serve

Commands:
  serve     Start the MCP server (default)
  -h, --help           Show this message
`)
}

async function main() {
  const [command = 'serve', ...rest] = process.argv.slice(2)

  switch (command) {
    case 'serve': {
      const { startServer } = await import('./mcp-server.mjs')
      await startServer()
      break
    }
    case '-h':
    case '--help':
    case 'help':
      printHelp()
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  )
  process.exit(1)
})
