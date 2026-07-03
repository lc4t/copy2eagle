#!/usr/bin/env node
'use strict'

const assert = require('assert').strict
const fs = require('fs')
const path = require('path')

const storage = new Map()
global.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
  removeItem(key) {
    storage.delete(key)
  },
}

const lifecycle = {}
const itemGetCalls = []
const addCalls = []
let itemGetHook = null
let pollEventSink = null
global.eagle = {
  log: {
    info() {},
    warn() {},
    error() {},
  },
  app: {
    theme: Promise.resolve('LIGHT'),
  },
  clipboard: {
    has() {
      return false
    },
  },
  folder: {
    async getAll() {
      return []
    },
  },
  item: {
    async get(options) {
      const folderId = options.folders[0]
      itemGetCalls.push(folderId)
      if (itemGetHook) await itemGetHook(folderId)
      return []
    },
    async addFromPath(filePath, options) {
      addCalls.push({ filePath, options })
      return 'item-test'
    },
    async open() {},
  },
  notification: {
    show() {},
  },
  onPluginCreate(fn) {
    lifecycle.create = fn
  },
  onPluginShow(fn) {
    lifecycle.show = fn
  },
  onPluginBeforeExit(fn) {
    lifecycle.beforeExit = fn
  },
  onThemeChanged(fn) {
    lifecycle.theme = fn
  },
}
global.window = {}
Object.defineProperty(global, 'navigator', {
  value: { language: 'en-US' },
  configurable: true,
})

const { state } = require('../js/lib/state')
const {
  acquireLease,
  releaseLease,
  guardLegacyHeartbeat,
  LEASE_TTL_MS,
  PLUGIN_VERSION,
} = require('../js/lib/instance')
const { decideClipboardHash } = require('../js/lib/poll')
const { backfillFolder, backfillFolders } = require('../js/lib/folders')
const { getActiveFolderIds } = require('../js/lib/config')
const { importImage } = require('../js/lib/import')
const { readClipboardFilePaths } = require('../js/lib/clipboard')

const tests = []
function test(name, fn) {
  tests.push({ name, fn })
}

function resetState() {
  state.config = null
  state.folders = []
  state.folderIndex = new Map()
  state.todayCount = 0
  state.todayDate = null
  state.lifetimeCount = 0
  state.lastImport = null
  state.recentImports = []
  state.lastError = null
  state.runtimeStatus = 'idle'
  state.hashSetByFolder = new Map()
  state.lastClipboardHash = null
  state.lastClipboardAt = 0
  state.lastFormatsKey = null
  state.indexingFolderId = null
  state.indexingProgress = 0
  state.indexingTotal = 0
  state.lastBackfillAt = new Map()
  state.instanceId = null
  state.instanceConflict = null
  state.lastHeartbeatAt = 0
}

test('single-owner lease does not let contenders overwrite a fresh owner', () => {
  storage.clear()
  resetState()

  state.instanceId = 'instance-a'
  assert.deepEqual(acquireLease(1000), { owned: false, conflict: null })
  assert.deepEqual(acquireLease(1100), { owned: true, conflict: null })

  state.instanceId = 'instance-b'
  assert.deepEqual(acquireLease(1200), {
    owned: false,
    conflict: {
      otherInstanceId: 'instance-a',
      otherVersion: '1.5.5',
    },
  })
  assert.equal(JSON.parse(storage.get('clipboardWatcher.lease.v2')).instanceId, 'instance-a')

  state.instanceId = 'instance-a'
  assert.deepEqual(acquireLease(1300), { owned: true, conflict: null })
})

test('runtime and package versions stay synchronized', () => {
  const root = path.join(__dirname, '..')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

  assert.equal(manifest.version, PLUGIN_VERSION)
  assert.equal(pkg.version, PLUGIN_VERSION)
  assert.match(html, new RegExp(`>v${PLUGIN_VERSION.replace(/\./g, '\\.')}<`))
})

test('store identity is cross-platform, MIT, and ships a production PNG icon', () => {
  const root = path.join(__dirname, '..')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')
  const clipboardSource = fs.readFileSync(path.join(root, 'js/lib/clipboard.js'), 'utf8')
  const logo = fs.readFileSync(path.join(root, 'logo.png'))
  const cover = fs.readFileSync(path.join(root, 'assets/plugin-center/cover-1800x1200.png'))

  assert.equal(manifest.name, '剪贴板图片留存')
  assert.equal(manifest.platform, 'all')
  assert.equal(manifest.id, '06343a32-d63f-4a04-bdcc-a0ca1e6f12aa')
  assert.match(
    manifest.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    'Plugin Center requires a UUID v4 plugin ID'
  )
  assert.equal(manifest.main.resizable, true)
  assert.ok(manifest.main.maxHeight >= 900, 'panel must allow useful vertical resizing')
  assert.equal(manifest.main.fullscreenable, false)
  assert.equal(manifest.main.maximizable, false)
  assert.equal(pkg.license, 'MIT')
  assert.match(html, /<h1>剪贴板图片留存<\/h1>/)
  assert.match(license, /^MIT License/)
  assert.match(clipboardSource, /powershell/i)
  assert.doesNotMatch(clipboardSource, /wl-paste|xclip/i)
  assert.equal(logo.readUInt32BE(16), 512)
  assert.equal(logo.readUInt32BE(20), 512)
  assert.ok([4, 6].includes(logo[25]), 'logo must include an alpha channel')
  assert.equal(cover.readUInt32BE(16), 1800)
  assert.equal(cover.readUInt32BE(20), 1200)
})

test('Windows multi-file clipboard invokes PowerShell FileDropList safely', async () => {
  let invocation = null
  const paths = await readClipboardFilePaths({
    platform: 'win32',
    execFile(command, args, options, callback) {
      invocation = { command, args, options }
      callback(null, 'C:\\Images\\one.png\r\nC:\\Images\\two.jpg\r\n')
    },
  })

  assert.equal(invocation.command, 'powershell')
  assert.deepEqual(invocation.args.slice(0, 2), ['-NoProfile', '-NonInteractive'])
  assert.match(invocation.args.at(-1), /Get-Clipboard -Format FileDropList/)
  assert.ok(invocation.options.timeout > 0)
  assert.deepEqual(paths, ['C:\\Images\\one.png', 'C:\\Images\\two.jpg'])
})

test('expired lease is claimed after one settling poll and only owner can release it', () => {
  storage.clear()
  resetState()

  state.instanceId = 'instance-a'
  acquireLease(1000)
  assert.equal(acquireLease(1100).owned, true)

  state.instanceId = 'instance-b'
  const takeoverAt = 1100 + LEASE_TTL_MS + 1
  assert.deepEqual(acquireLease(takeoverAt), { owned: false, conflict: null })
  assert.equal(acquireLease(takeoverAt + 1).owned, true)

  state.instanceId = 'instance-a'
  releaseLease()
  assert.equal(JSON.parse(storage.get('clipboardWatcher.lease.v2')).instanceId, 'instance-b')

  state.instanceId = 'instance-b'
  releaseLease()
  assert.equal(storage.has('clipboardWatcher.lease.v2'), false)
  assert.equal(storage.has('clipboardWatcher.heartbeat'), false)
})

test('v1.5.5 lease remains stable when v1.5.2 overwrites the legacy heartbeat', () => {
  storage.clear()
  resetState()
  state.instanceId = 'instance-new'
  localStorage.setItem('clipboardWatcher.heartbeat', JSON.stringify({
    instanceId: 'instance-old',
    ts: 1000,
    version: '1.5.2',
  }))

  assert.deepEqual(acquireLease(1100), { owned: false, conflict: null })
  assert.equal(JSON.parse(storage.get('clipboardWatcher.lease.v2')).instanceId, 'instance-new')
  assert.equal(JSON.parse(storage.get('clipboardWatcher.heartbeat')).instanceId, 'instance-new')

  localStorage.setItem('clipboardWatcher.heartbeat', JSON.stringify({
    instanceId: 'instance-old',
    ts: 1150,
    version: '1.5.2',
  }))
  assert.deepEqual(acquireLease(1200), { owned: true, conflict: null })
  assert.equal(JSON.parse(storage.get('clipboardWatcher.lease.v2')).instanceId, 'instance-new')

  localStorage.setItem('clipboardWatcher.heartbeat', JSON.stringify({
    instanceId: 'instance-old',
    ts: 1250,
    version: '1.5.2',
  }))
  assert.equal(guardLegacyHeartbeat(1300), true)
  assert.equal(JSON.parse(storage.get('clipboardWatcher.heartbeat')).instanceId, 'instance-new')
})

test('clipboard hash decision preserves skip and allow semantics', () => {
  const base = {
    hash: 'same',
    lastHash: 'same',
    lastImportAt: 1000,
  }
  assert.deepEqual(decideClipboardHash({ ...base, strategy: 'skip', now: 999999 }), {
    sameHash: true,
    shouldImport: false,
  })
  assert.equal(
    decideClipboardHash({ ...base, strategy: 'allow', now: 1000 + 29999 }).shouldImport,
    false
  )
  assert.equal(
    decideClipboardHash({ ...base, strategy: 'allow', now: 1000 + 30000 }).shouldImport,
    true
  )
  assert.deepEqual(decideClipboardHash({
    hash: 'new',
    lastHash: 'old',
    lastImportAt: 1000,
    strategy: 'allow',
    now: 1001,
  }), {
    sameHash: false,
    shouldImport: true,
  })
})

test('active route folders are unique and backfilled sequentially', async () => {
  storage.clear()
  resetState()
  itemGetCalls.length = 0

  const config = {
    folderId: 'main',
    folderIdScreenshot: 'screenshots',
    folderIdClipboard: 'main',
    folderIdFiles: 'files',
  }
  const ids = getActiveFolderIds(config)
  assert.deepEqual(ids, ['main', 'screenshots', 'files'])

  await backfillFolders(ids.concat('main'), { force: true })
  assert.deepEqual(itemGetCalls, ['main', 'screenshots', 'files'])
})

test('overlapping folder backfills share one serialized queue', async () => {
  storage.clear()
  resetState()
  const events = []
  let releaseFirst = null
  itemGetHook = async (folderId) => {
    events.push(`start:${folderId}`)
    if (folderId === 'first') {
      await new Promise((resolve) => {
        releaseFirst = resolve
      })
    }
    events.push(`end:${folderId}`)
  }

  const first = backfillFolder('first', { force: true })
  await new Promise((resolve) => setImmediate(resolve))
  const second = backfillFolder('second', { force: true })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(events, ['start:first'])

  releaseFirst()
  await Promise.all([first, second])
  itemGetHook = null
  assert.deepEqual(events, [
    'start:first',
    'end:first',
    'start:second',
    'end:second',
  ])
})

test('route updates stop polling, rebuild the new folder, then resume', async () => {
  storage.clear()
  resetState()
  itemGetCalls.length = 0
  const events = []
  itemGetHook = (folderId) => events.push(`backfill:${folderId}`)
  pollEventSink = events

  const poll = require('../js/lib/poll')
  poll.stopPolling = () => {
    if (pollEventSink) pollEventSink.push('stop')
  }
  poll.startPolling = () => {
    if (pollEventSink) pollEventSink.push('start')
  }

  delete require.cache[require.resolve('../js/plugin')]
  require('../js/plugin')

  state.config = {
    version: 2,
    enabled: true,
    folderId: 'main',
    folderIdScreenshot: null,
    folderIdClipboard: null,
    folderIdFiles: null,
    intervalMs: 1000,
    tags: '',
    notifyOnImport: false,
    duplicateStrategy: 'skip',
    importMixedContent: true,
    importMultipleFiles: false,
    nameTemplate: '{source} {dims} {timestamp}',
  }

  await window.ClipboardWatcher.updateRouteFolder('folderIdClipboard', 'clips')
  itemGetHook = null
  pollEventSink = null
  assert.deepEqual(events, ['stop', 'backfill:clips', 'start'])
  assert.equal(state.config.folderIdClipboard, 'clips')
})

test('only the latest overlapping route update can resume polling', async () => {
  storage.clear()
  resetState()
  const events = []
  pollEventSink = events
  let releaseFirst = null
  itemGetHook = async (folderId) => {
    events.push(`backfill:${folderId}`)
    if (folderId === 'clips-a') {
      await new Promise((resolve) => {
        releaseFirst = resolve
      })
    }
  }

  state.config = {
    version: 2,
    enabled: true,
    folderId: 'main',
    folderIdScreenshot: null,
    folderIdClipboard: null,
    folderIdFiles: null,
    intervalMs: 1000,
    tags: '',
    notifyOnImport: false,
    duplicateStrategy: 'skip',
    importMixedContent: true,
    importMultipleFiles: false,
    nameTemplate: '{source} {dims} {timestamp}',
  }

  const first = window.ClipboardWatcher.updateRouteFolder('folderIdClipboard', 'clips-a')
  await new Promise((resolve) => setImmediate(resolve))
  const second = window.ClipboardWatcher.updateRouteFolder('folderIdClipboard', 'clips-b')
  await new Promise((resolve) => setImmediate(resolve))
  releaseFirst()
  await Promise.all([first, second])
  itemGetHook = null
  pollEventSink = null

  assert.deepEqual(events, [
    'stop',
    'backfill:clips-a',
    'stop',
    'backfill:clips-b',
    'start',
  ])
  assert.equal(state.config.folderIdClipboard, 'clips-b')
})

test('name template counters use the next import and reset before first import of a new day', async () => {
  storage.clear()
  resetState()
  addCalls.length = 0

  state.config = {
    notifyOnImport: false,
    tags: '',
    nameTemplate: '{count}-{lifetime}',
  }
  state.todayDate = '2000-01-01'
  state.todayCount = 7
  state.lifetimeCount = 9
  state.folderIndex = new Map([['folder', 'Folder']])

  await importImage(Buffer.from([1, 2, 3]), 'hash-test', 'folder', {
    source: 'clipboard',
    dims: '1x1',
  })

  assert.equal(addCalls.length, 1)
  assert.equal(addCalls[0].options.name, '1-10')
  assert.equal(state.todayCount, 1)
  assert.equal(state.lifetimeCount, 10)
})

test('a partial temporary file is removed when clipboard image writing fails', async () => {
  storage.clear()
  resetState()
  state.config = {
    notifyOnImport: false,
    tags: '',
    nameTemplate: '{source}',
  }

  const originalWriteFileSync = fs.writeFileSync
  let partialPath = null
  fs.writeFileSync = (filePath, buffer) => {
    partialPath = filePath
    originalWriteFileSync(filePath, buffer)
    throw new Error('simulated partial write')
  }

  try {
    await assert.rejects(
      importImage(Buffer.from([4, 5, 6]), 'hash-partial', 'folder', {
        source: 'clipboard',
        dims: '1x1',
      }),
      /simulated partial write/
    )
  } finally {
    fs.writeFileSync = originalWriteFileSync
  }

  assert.ok(partialPath)
  assert.equal(fs.existsSync(partialPath), false)
})

;(async () => {
  let passed = 0
  for (const entry of tests) {
    try {
      await entry.fn()
      passed += 1
      process.stdout.write(`ok ${passed} - ${entry.name}\n`)
    } catch (err) {
      process.stderr.write(`not ok - ${entry.name}\n${err.stack || err}\n`)
      process.exitCode = 1
      return
    }
  }
  process.stdout.write(`\n${passed} checks passed\n`)
})()
