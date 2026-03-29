import fs from 'node:fs/promises'
import path from 'node:path'

export const DEFAULTS = {
  url: 'http://localhost:5173',
  browser: 'chromium',
  width: 1440,
  height: 960,
  timeoutMs: 30000,
  delayMs: 0,
  fullPage: false,
  headless: true
}

function normalizeAction(action, index) {
  if (!action || typeof action !== 'object') {
    throw new Error(`Invalid action at index ${index}`)
  }

  const normalized = { ...action }

  if (typeof normalized.type !== 'string' || normalized.type.length === 0) {
    throw new Error(`Missing action type at index ${index}`)
  }

  if (normalized.delayMs != null && (!Number.isFinite(normalized.delayMs) || normalized.delayMs < 0)) {
    throw new Error(`Invalid action delayMs at index ${index}`)
  }

  if (normalized.timeoutMs != null && (!Number.isFinite(normalized.timeoutMs) || normalized.timeoutMs <= 0)) {
    throw new Error(`Invalid action timeoutMs at index ${index}`)
  }

  return normalized
}

export function normalizeOptions(input = {}) {
  const options = {
    ...DEFAULTS,
    ...input
  }

  if (options.output != null && !path.isAbsolute(options.output)) {
    throw new Error('--output must be an absolute path')
  }

  const numericFields = ['width', 'height', 'timeoutMs', 'delayMs']
  for (const field of numericFields) {
    if (!Number.isFinite(options[field]) || options[field] < 0) {
      throw new Error(`Invalid numeric value for ${field}`)
    }
  }

  if (options.actions != null) {
    if (!Array.isArray(options.actions)) {
      throw new Error('actions must be an array')
    }

    options.actions = options.actions.map(normalizeAction)
  }

  return options
}

function isTextEntryCandidate(element) {
  if (element.tagName === 'TEXTAREA') {
    return true
  }

  if (element.tagName !== 'INPUT') {
    return false
  }

  const type = (element.type || 'text').toLowerCase()
  return !['radio', 'checkbox', 'hidden', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(type)
}

function rankActionCandidate(element, actionType) {
  if (!element.visible) {
    return -1
  }

  if (actionType === 'selectOption') {
    return element.tagName === 'SELECT' ? 3 : 1
  }

  if (['fill', 'press', 'click', 'hover'].includes(actionType) && isTextEntryCandidate(element)) {
    return 3
  }

  return 1
}

async function resolveActionLocator(page, selector, actionType) {
  const locator = page.locator(selector)
  const count = await locator.count()

  if (count === 0) {
    throw new Error(`No elements matched selector: ${selector}`)
  }

  if (count === 1) {
    return locator.first()
  }

  const candidates = await locator.evaluateAll((nodes) => {
    return nodes.map((node, index) => ({
      index,
      visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
      tagName: node.tagName,
      type: node instanceof HTMLInputElement ? node.type : null
    }))
  })

  let bestCandidate = null

  for (const candidate of candidates) {
    const score = rankActionCandidate(candidate, actionType)

    if (score < 0) {
      continue
    }

    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { index: candidate.index, score }
    }
  }

  if (!bestCandidate) {
    throw new Error(`No visible elements matched selector: ${selector}`)
  }

  return locator.nth(bestCandidate.index)
}

async function runAction(page, action, index, defaultTimeoutMs) {
  const actionLabel = `action ${index + 1} (${action.type})`

  switch (action.type) {
    case 'click':
      if (!action.selector) {
        throw new Error(`${actionLabel} requires selector`)
      }
      await (await resolveActionLocator(page, action.selector, action.type)).click({
        timeout: action.timeoutMs ?? defaultTimeoutMs
      })
      break
    case 'fill':
      if (!action.selector) {
        throw new Error(`${actionLabel} requires selector`)
      }
      if (typeof action.value !== 'string') {
        throw new Error(`${actionLabel} requires string value`)
      }
      await (await resolveActionLocator(page, action.selector, action.type)).fill(action.value, {
        timeout: action.timeoutMs ?? defaultTimeoutMs
      })
      break
    case 'press':
      if (!action.selector) {
        throw new Error(`${actionLabel} requires selector`)
      }
      if (typeof action.key !== 'string' || action.key.length === 0) {
        throw new Error(`${actionLabel} requires key`)
      }
      await (await resolveActionLocator(page, action.selector, action.type)).press(action.key, {
        timeout: action.timeoutMs ?? defaultTimeoutMs
      })
      break
    case 'selectOption':
      if (!action.selector) {
        throw new Error(`${actionLabel} requires selector`)
      }
      if (action.value == null && action.label == null && action.index == null) {
        throw new Error(`${actionLabel} requires value, label, or index`)
      }
      await (await resolveActionLocator(page, action.selector, action.type)).selectOption(
        {
          value: action.value,
          label: action.label,
          index: action.index
        },
        { timeout: action.timeoutMs ?? defaultTimeoutMs }
      )
      break
    case 'hover':
      if (!action.selector) {
        throw new Error(`${actionLabel} requires selector`)
      }
      await (await resolveActionLocator(page, action.selector, action.type)).hover({
        timeout: action.timeoutMs ?? defaultTimeoutMs
      })
      break
    case 'waitFor':
      if (!action.selector) {
        throw new Error(`${actionLabel} requires selector`)
      }
      await page.waitForSelector(action.selector, {
        state: action.state ?? 'visible',
        timeout: action.timeoutMs ?? defaultTimeoutMs
      })
      break
    case 'wait':
      if (!Number.isFinite(action.durationMs) || action.durationMs < 0) {
        throw new Error(`${actionLabel} requires non-negative durationMs`)
      }
      await page.waitForTimeout(action.durationMs)
      break
    default:
      throw new Error(`Unsupported action type at index ${index}: ${action.type}`)
  }

  if (action.delayMs && action.delayMs > 0) {
    await page.waitForTimeout(action.delayMs)
  }
}

async function runActions(page, actions = [], defaultTimeoutMs) {
  for (const [index, action] of actions.entries()) {
    await runAction(page, action, index, defaultTimeoutMs)
  }

  return actions.length
}

export async function importPlaywright() {
  try {
    return await import('playwright')
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'The `playwright` package is not installed. Install it in this environment before using this MCP server.'
      )
    }

    throw error
  }
}

export async function capturePage(rawOptions = {}) {
  const options = normalizeOptions(rawOptions)
  const playwright = await importPlaywright()
  const browserType = playwright[options.browser]

  if (!browserType) {
    throw new Error(`Unsupported browser: ${options.browser}`)
  }

  if (options.output) {
    await fs.mkdir(path.dirname(options.output), { recursive: true })
  }

  const browser = await browserType.launch({ headless: options.headless })

  try {
    const page = await browser.newPage({
      viewport: {
        width: options.width,
        height: options.height
      }
    })

    page.setDefaultTimeout(options.timeoutMs)
    await page.goto(options.url, {
      waitUntil: 'networkidle',
      timeout: options.timeoutMs
    })

    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, {
        state: 'visible',
        timeout: options.timeoutMs
      })
    }

    if (options.delayMs > 0) {
      await page.waitForTimeout(options.delayMs)
    }

    const actionsExecuted = await runActions(page, options.actions, options.timeoutMs)

    const screenshot = await page.screenshot({
      path: options.output,
      fullPage: options.fullPage
    })

    const title = await page.title()

    return {
      output: options.output ?? null,
      url: page.url(),
      title,
      actionsExecuted,
      viewport: {
        width: options.width,
        height: options.height
      },
      fullPage: options.fullPage,
      mimeType: 'image/png',
      imageBase64: screenshot.toString('base64')
    }
  } finally {
    await browser.close()
  }
}
