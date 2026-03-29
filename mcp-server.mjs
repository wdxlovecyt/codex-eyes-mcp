#!/usr/bin/env node

import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { capturePage, DEFAULTS } from './scripts/capture-page-core.mjs'

const pageActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    selector: z.string(),
    delayMs: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal('fill'),
    selector: z.string(),
    value: z.string(),
    delayMs: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal('press'),
    selector: z.string(),
    key: z.string(),
    delayMs: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal('selectOption'),
    selector: z.string(),
    value: z.string().optional(),
    label: z.string().optional(),
    index: z.number().int().min(0).optional(),
    delayMs: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal('hover'),
    selector: z.string(),
    delayMs: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal('waitFor'),
    selector: z.string(),
    state: z.enum(['attached', 'detached', 'visible', 'hidden']).optional(),
    delayMs: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal('wait'),
    durationMs: z.number().int().min(0),
    delayMs: z.number().int().min(0).optional()
  })
])

export function buildServer() {
  const server = new McpServer({
    name: 'frontend-visual-debugger',
    version: '1.0.0'
  })

  server.registerTool(
    'capture_page',
    {
      title: 'Capture Page',
      description:
        'Use this during frontend development to visually inspect a page, verify UI changes, reproduce interaction states, and capture the rendered result after scripted actions. It opens a page with Playwright, can run actions like click/fill/wait before capture, and returns both an image attachment and structured metadata. Prefer passing the real running app URL when known; only omit `url` when you need to fall back to the default http://localhost:5173.',
      inputSchema: {
        url: z
          .string()
          .url()
          .optional()
          .describe(
            `Page URL. Prefer passing the current project's actual running URL. If omitted, the tool falls back to ${DEFAULTS.url}.`
          ),
        output: z
          .string()
          .optional()
          .describe('Optional absolute filesystem path to save the screenshot. If omitted, the tool only returns image content without writing to disk.'),
        waitFor: z.string().optional().describe('Optional CSS selector to wait for before capture.'),
        browser: z
          .enum(['chromium', 'firefox', 'webkit'])
          .optional()
          .describe(`Browser engine. Default: ${DEFAULTS.browser}`),
        width: z.number().int().positive().optional().describe(`Viewport width. Default: ${DEFAULTS.width}`),
        height: z.number().int().positive().optional().describe(`Viewport height. Default: ${DEFAULTS.height}`),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(`Navigation and wait timeout. Default: ${DEFAULTS.timeoutMs}`),
        delayMs: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(`Extra delay before screenshot. Default: ${DEFAULTS.delayMs}`),
        fullPage: z.boolean().optional().describe(`Capture the full scrollable page. Default: ${DEFAULTS.fullPage}`),
        actions: z
          .array(pageActionSchema)
          .optional()
          .describe(
            'Optional Playwright actions to run before the screenshot, such as click, fill, press, selectOption, hover, waitFor, or wait. Prefer precise selectors like `.search-bar input` instead of broad selectors like `input` or `button`.'
          )
      },
      outputSchema: {
        output: z.string().nullable(),
        url: z.string(),
        title: z.string(),
        actionsExecuted: z.number(),
        mimeType: z.string(),
        viewport: z.object({
          width: z.number(),
          height: z.number()
        }),
        fullPage: z.boolean()
      }
    },
    async (input) => {
      const result = await capturePage(input)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                output: result.output,
                url: result.url,
                title: result.title,
                actionsExecuted: result.actionsExecuted,
                mimeType: result.mimeType,
                viewport: result.viewport,
                fullPage: result.fullPage
              },
              null,
              2
            )
          },
          {
            type: 'image',
            data: result.imageBase64,
            mimeType: result.mimeType
          }
        ],
        structuredContent: {
          output: result.output,
          url: result.url,
          title: result.title,
          actionsExecuted: result.actionsExecuted,
          mimeType: result.mimeType,
          viewport: result.viewport,
          fullPage: result.fullPage
        }
      }
    }
  )

  return server
}

export async function startServer() {
  const server = buildServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null

if (entryUrl === import.meta.url) {
  startServer().catch((error) => {
    console.error('frontend-visual-debugger MCP server error:', error)
    process.exit(1)
  })
}
