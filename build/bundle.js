#!/usr/bin/env node
/*
 * build/bundle.js — 把 js/lib/*.js + js/plugin.js + js/ui.js 打成单个 js/bundle.js
 *
 * 为什么需要：Eagle webview 加载 js/plugin.js 时 require('./lib/xxx') 抛错（issue #2），
 *           推断 nodeIntegration 下相对路径解析不在 webview 文件原目录。
 *           ship 单文件可绕开此限制。
 *
 * 怎么做：
 *   - 维护 __cw_modules 表 + __cw_require(name) 同步函数
 *   - 每个 lib/* 包 IIFE 注入到表里（带 module.exports / exports 影子变量）
 *   - 把所有 require('./xxx') 重写为 __cw_require('lib/xxx')
 *   - plugin.js / ui.js 作为入口 IIFE 放最后，执行其副作用（onPluginCreate / 暴露 window.*）
 *
 * 模块加载顺序按依赖关系硬编码，保证被依赖者先入表。
 */

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const LIB_DIR = path.join(REPO, 'js', 'lib')
const OUT = path.join(REPO, 'js', 'bundle.js')

// 依赖序：被依赖者在前
const LIB_ORDER = [
  'constants',
  'utils',
  'i18n',
  'state',
  'theme',
  'notification',
  'config',
  'clipboard',
  'folders',
  'import',
  'screenshot',
  'instance', // v1.5.2：依赖 state，给 poll 用
  'poll',
]

function read(p) {
  return fs.readFileSync(p, 'utf8')
}

/**
 * 把 require('./foo') 或 require('./lib/foo') 改写为 __cw_require('lib/foo')。
 * 保留对 node 内置 / npm 模块的 require（os / fs / path / child_process / electron 等）。
 */
function rewrite(src) {
  return src.replace(/require\(\s*(['"])\.\/([^'"]+?)\1\s*\)/g, (_full, _q, sub) => {
    const key = `lib/${sub.replace(/^lib\//, '').replace(/\.js$/, '')}`
    return `__cw_require('${key}')`
  })
}

function wrapModule(name, src) {
  return `
// ===== ${name} =====
__cw_modules['${name}'] = (function() {
  const module = { exports: {} };
  const exports = module.exports;
${src}
  return module.exports;
})();
`
}

function wrapEntry(label, src) {
  // 入口跑副作用，不需要收 exports
  return `
// ===== ${label} (entry) =====
;(function() {
  const module = { exports: {} };
  const exports = module.exports;
${src}
})();
`
}

let out = `/* AUTO-GENERATED bundle — do not edit by hand.
 * Source files: js/plugin.js, js/ui.js, js/lib/*.js
 * Regenerate: npm run build
 *
 * Built at: ${new Date().toISOString()}
 */
;(function(){
'use strict';

const __cw_modules = {};
function __cw_require(name) {
  if (!Object.prototype.hasOwnProperty.call(__cw_modules, name)) {
    throw new Error('[bundle] Module not found: ' + name);
  }
  return __cw_modules[name];
}

`

for (const name of LIB_ORDER) {
  const filePath = path.join(LIB_DIR, `${name}.js`)
  const src = rewrite(read(filePath))
  out += wrapModule(`lib/${name}`, src)
}

const pluginSrc = rewrite(read(path.join(REPO, 'js', 'plugin.js')))
out += wrapEntry('plugin', pluginSrc)

const uiSrc = rewrite(read(path.join(REPO, 'js', 'ui.js')))
out += wrapEntry('ui', uiSrc)

out += `\n})();\n`

fs.writeFileSync(OUT, out)
const sizeKB = (fs.statSync(OUT).size / 1024).toFixed(1)
console.log(`✓ bundle: ${LIB_ORDER.length} libs + plugin + ui → ${path.relative(REPO, OUT)} (${sizeKB} KB)`)
