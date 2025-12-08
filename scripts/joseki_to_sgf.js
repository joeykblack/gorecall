#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const BASE = path.resolve(__dirname, '..', 'josekipedia')

function nestedPathForId(id) {
  const idStr = String(id)
  const parts = idStr.length > 1 ? idStr.slice(0, -1).split('') : []
  const dir = parts.length > 0 ? path.join(BASE, ...parts) : BASE
  const outfile = path.join(dir, `${idStr}.json`)
  return { dir, outfile, flat: path.join(BASE, `${idStr}.json`) }
}

function findLocalJsonPath(id) {
  const { outfile, flat } = nestedPathForId(id)
  if (fs.existsSync(outfile)) return outfile
  if (fs.existsSync(flat)) return flat
  return null
}

function loadNodeById(id) {
  const p = findLocalJsonPath(id)
  if (!p) return null
  try {
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to load', p, err.message || err)
    return null
  }
}

function esc(s) {
  if (s == null) return ''
  return String(s).replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
}

function moveProp(node) {
  if (!node) return ''
  if (node.B) return `B[${node.B}]`
  if (node.W) return `W[${node.W}]`
  return ''
}

function nodeToSgf(node) {
  // node is the JSON object for this node
  let s = ';'
  const mv = moveProp(node)
  if (mv) s += mv
  if (node.C) s += `C[${esc(node.C)}]`
  // include label array if present as LB[...] entries? skip for now
  // traverse children that exist locally
  // Only include locally-saved children that are joseki (_mtype === 0)
  const children = (node._children || []).slice(0, 9).filter(c => c && c._mtype === 0 && !!findLocalJsonPath(c._id))
  if (!children || children.length === 0) return s
  if (children.length === 1) {
    const childNode = loadNodeById(children[0]._id)
    if (!childNode) return s
    return s + nodeToSgf(childNode)
  }
  // multiple children -> each becomes a separate parenthesized subtree
  const parts = children.map(c => {
    const childNode = loadNodeById(c._id)
    if (!childNode) return ''
    return '(' + nodeToSgf(childNode) + ')'
  }).filter(Boolean)
  return s + parts.join('')
}

function buildSgfFromRoot(rootNode) {
  // root properties: use standard header
  const header = 'GM[1]FF[4]SZ[19]'
  let s = '(' + ';' + header
  if (rootNode.C) s += `C[${esc(rootNode.C)}]`
  // children of root
  // Only include locally-saved children that are joseki (_mtype === 0)
  const children = (rootNode._children || []).filter(c => c && c._mtype === 0 && !!findLocalJsonPath(c._id))
  if (!children || children.length === 0) {
    s += ')'
    return s
  }
  if (children.length === 1) {
    const child = loadNodeById(children[0]._id)
    if (child) s += nodeToSgf(child)
  } else {
    for (const c of children) {
      const child = loadNodeById(c._id)
      if (!child) continue
      s += '(' + nodeToSgf(child) + ')'
    }
  }
  s += ')'
  return s
}

function usage() {
  console.log('Usage: joseki_to_sgf.js <root-json-path-or-id> [out.sgf]')
}

async function main() {
  const arg = process.argv[2]
  if (!arg) return usage()
  let root
  // if arg is a path to file
  const p = path.resolve(arg)
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, 'utf8')
    // try to parse JSON; if it fails, attempt to recover by extracting a numeric id
    try {
      root = JSON.parse(raw)
    } catch (e) {
      // likely the file isn't JSON (maybe an SGF or other). Print filename + snippet to help debugging
      console.error(`Failed to parse ${p} as JSON: ${e && e.message ? e.message : e}`)
    }
  } else if (/^\d+$/.test(arg)) {
    root = loadNodeById(arg)
    if (!root) { console.error('No local json for id', arg); return }
  } else {
    console.error('Invalid argument: must be a path to json or an id')
    return
  }

  const sgf = buildSgfFromRoot(root)
  const out = process.argv[3] || (path.join(process.cwd(), `${root._id || 'out'}.sgf`))
  fs.writeFileSync(out, sgf, 'utf8')
  console.log('Wrote', out)
}

if (require.main === module) main()
