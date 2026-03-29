#!/usr/bin/env node

import process from 'node:process'
import { DEFAULTS, capturePage } from './capture-page-core.mjs'

function parseArgs(argv) {
  const args = { ...DEFAULTS }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)

    if (key === 'full-page') {
      args.fullPage = true
      continue
    }

    if (key === 'headed') {
      args.headless = false
      continue
    }

    const value = argv[index + 1]

    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }

    index += 1

    switch (key) {
      case 'url':
        args.url = value
        break
      case 'output':
        args.output = value
        break
      case 'wait-for':
        args.waitFor = value
        break
      case 'browser':
        args.browser = value
        break
      case 'width':
        args.width = Number(value)
        break
      case 'height':
        args.height = Number(value)
        break
      case 'timeout-ms':
        args.timeoutMs = Number(value)
        break
      case 'delay-ms':
        args.delayMs = Number(value)
        break
      case 'actions-json':
        args.actions = JSON.parse(value)
        break
      default:
        throw new Error(`Unknown argument: --${key}`)
    }
  }

  return args
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = await capturePage(options)
  delete result.imageBase64

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  const result = {
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }

  console.error(JSON.stringify(result, null, 2))
  process.exit(1)
})
