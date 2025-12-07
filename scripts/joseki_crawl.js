#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const https = require('https')

const OUTDIR = path.resolve(__dirname, '..', 'josekipedia')
if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true })

function nestedPathForId(id) {
  const idStr = String(id)
  // digits before ones place
  const parts = idStr.length > 1 ? idStr.slice(0, -1).split('') : []
  const dir = parts.length > 0 ? path.join(OUTDIR, ...parts) : OUTDIR
  const outfile = path.join(dir, `${idStr}.json`)
  return { dir, outfile }
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        return resolve(fetchJson(res.headers.location))
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

const visited = new Set()
let sequencesSeen = 0

async function dfs(id) {
  if (visited.has(id)) return
  visited.add(id)

  const idStr = String(id)
  const flatFile = path.join(OUTDIR, `${idStr}.json`)
  const { dir: nestedDir, outfile } = nestedPathForId(idStr)
  let raw

  // If nested outfile exists use it. Otherwise, if a flat file exists from
  // previous runs, move it into the nested folder. Otherwise fetch.
  if (fs.existsSync(outfile)) {
    raw = fs.readFileSync(outfile, 'utf8')
    console.log(`Loaded local file ${outfile}`)
  } else {
    const url = `https://www.josekipedia.com/db/node.php?id=${id}`
    console.log(`GET ${url}`)
    await sleep(500)
    try {
      raw = await fetchJson(url)
    } catch (err) {
      console.error(`Failed to fetch id=${id}:`, err.message || err)
      return
    }
    try {
      if (!fs.existsSync(nestedDir)) fs.mkdirSync(nestedDir, { recursive: true })
      fs.writeFileSync(outfile, raw, 'utf8')
      // console.log(`Saved ${outfile}`)
    } catch (err) {
      console.error(`Failed to save ${outfile}:`, err.message || err)
    }
  }

  let obj
  try {
    obj = JSON.parse(raw)
  } catch (err) {
    console.error(`Parse error for id=${id}:`, err.message || err)
    return
  }

  const children = Array.isArray(obj._children) ? obj._children : []
  if (children.length === 0) {
    sequencesSeen += 1
    console.log(`id=${id}: end sequence (#${sequencesSeen})`)
    return
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const cid = child && (child._id || child.id || child.ID)
    if (!cid) continue

    // if (child.B) console.log(`id=${id} -> child=${cid} has B=${child.B}`)
    // if (child.W) console.log(`id=${id} -> child=${cid} has W=${child.W}`)

    await dfs(cid)
  }
}

async function main() {
  const start = process.argv[2] || '1'
  await dfs(start)
  console.log('Done')
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1) })
