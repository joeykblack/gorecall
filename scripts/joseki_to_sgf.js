#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const BASE = path.resolve(__dirname, '..', 'josekipedia')

var jlabels = {
1: 'Good for white.',
2: 'Good for black.',
3: 'White has good influence.',
4: 'Black has good influence.',
5: 'This requires a favorable ladder.',
6: '% requires a favorable ladder.',
7: 'Leads to a ko.',
8: '% leads to a ko.',
9: 'White can tenuki.',
10: 'Black can tenuki.',
11: 'White takes the corner.',
12: 'Black takes the corner.',
13: 'Solid move.',
14: 'Old pattern.',
15: 'Necessary.',
16: 'Sacrifice play.',
17: 'White is thick.',
18: 'Black is thick.',
19: 'Tesuji.',
20: 'White collapses.',
21: 'Black collapses.',
22: 'Modern pattern.',
23: 'Position is settled.',
24: 'White has good profit.',
25: 'Black has good profit.',
26: 'Vital point.',
27: 'Simple position.',
28: 'Complicated position.',
29: 'Fighting pattern.',
30: 'Running battle.',
31: 'Probing move.',
32: 'Honte.',
33: 'Leads to complicated variations.',
34: '% leads to complicated variations.',
35: 'Kills.',
36: 'Reducing move.',
37: '% kills.',
38: '% reduces.',
39: 'Takes sente.',
40: 'Overplay.',
41: '% is an overplay.',
42: 'Leaves weaknesses.',
43: 'Makes life.',
44: 'Refutes the trick play.',
45: 'Position is even.',
46: 'Slightly good for black.',
47: 'Slightly good for white.',
48: 'White connects.',
49: 'Black connects.',
50: 'Ko.',
51: 'Black is sealed in.',
52: 'White is sealed in.',
53: 'Slack.',
54: 'Black has bad shape.',
55: 'White has bad shape.'
};

var jsources = 
{
  "100tips": {
    "name": "100 Tips for Amateur Players 1",
    "senseis": "100TipsForAmateurPlayersI",
    "lang": "en"
  },
  "100tips2": {
    "name": "100 Tips for Amateur Players 2",
    "senseis": "100TipsForAmateurPlayersII",
    "lang": "en"
  },
  "dobj21": {
    "name": "21st Century Dictionary of Basic Joseki",
    "senseis": "",
    "lang": "en"
  },
  "21st": {
    "name": "21st Century New Openings",
    "senseis": "21stCenturyNewOpenings",
    "lang": "en"
  },
  "38bj": {
    "name": "38 Basic Joseki",
    "senseis": "38BasicJoseki",
    "lang": "en"
  },
  "ctp": {
    "name": "A Compendium Of Trick Plays",
    "senseis": "ACompendiumOfTrickPlays",
    "lang": "en"
  },
  "aaj": {
    "name": "All About Joseki",
    "senseis": "AllAboutJoseki",
    "lang": "en"
  },
  "afg": {
    "name": "Appreciating Famous games",
    "senseis": "AppreciatingFamousGames",
    "lang": "en"
  },
  "cosmic": {
    "name": "Cosmic Go: A Guide to Four-Stone Handicap Games",
    "senseis": "CosmicGo",
    "lang": "en"
  },
  "dobj": {
    "name": "Dictionary Of Basic Joseki",
    "senseis": "DictionaryOfBasicJoseki",
    "lang": "en"
  },
  "eoj": {
    "name": "Encyclopedia of Joseki",
    "senseis": "GendaiJosekiJiten",
    "lang": "zh"
  },
  "ej": {
    "name": "Essential Joseki",
    "senseis": "EssentialJoseki",
    "lang": "en"
  },
  "jiot": {
    "name": "Jungsuk In Our Time",
    "senseis": "JungsukInOurTime",
    "lang": "en"
  },
  "ksob": {
    "name": "Korean Style of Baduk",
    "senseis": "KoreanStyleOfBaduk",
    "lang": "en"
  },
  "mgs": {
    "name": "Making Good Shape",
    "senseis": "MakingGoodShape",
    "lang": "en"
  },
  "mjf1": {
    "name": "Modern Joseki and Fuseki Volume 1",
    "senseis": "ModernJosekiAndFusekiVol1",
    "lang": "en"
  },
  "mjf2": {
    "name": "Modern Joseki and Fuseki Volume 2",
    "senseis": "ModernJosekiAndFusekiVol2",
    "lang": "en"
  },
  "nm": {
    "name": "New Moves",
    "senseis": "",
    "lang": "en"
  },
  "pacjm": {
    "name": "Punishing and Correcting Joseki Mistakes",
    "senseis": "PunishingAndCorrectingJosekiMistakes",
    "lang": "en"
  },
  "ssj": {
    "name": "Sekai no Shin Joseki",
    "senseis": "",
    "lang": "ja"
  },
  "shojiten": {
    "name": "Shin Hayawakari Shojiten",
    "senseis": "ShinHayawakariShojiten",
    "lang": "ja"
  },
  "sps": {
    "name": "Star Point Joseki",
    "senseis": "StarPointJoseki",
    "lang": "en"
  },
  "tij": {
    "name": "Tricks in Joseki",
    "senseis": "TricksInJoseki",
    "lang": "en"
  }
}
;


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

function buildComment(node) {
  if (!node) return ''
  const values = []
  // labels first: collect label texts in numeric order
  if (Array.isArray(node._labels) && node._labels.length > 0) {
    const sorted = node._labels.slice().map(Number).sort((a, b) => a - b)
    for (const id of sorted) {
      const text = jlabels[id] !== undefined ? jlabels[id] : String(id)
      values.push(text)
    }
  }

  // then the normal comment if present
  if (node.C) {
    let commentText = ''
    if (Array.isArray(node.C)) commentText = String(node.C[0] || '')
    else commentText = String(node.C || '')
    values.push(commentText)
  }

  // then sources: map node._sources entries to jsources names when available
  if (Array.isArray(node._sources) && node._sources.length > 0) {
    for (const s of node._sources) {
      // _sources entries are often [key, extra]
      const key = Array.isArray(s) ? s[0] : s
      if (!key) continue
      const src = jsources && jsources[key]
      const name = src && src.name ? src.name : String(key)
      values.push(name)
    }
  }

  if (values.length === 0) return ''
  // single property C with multiple bracketed values: C[val1][val2][...]
  return 'C[' + values.map(v => esc(v)).join('][') + ']'
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
  const c = buildComment(node)
  if (c) s += c
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
  const rc = buildComment(rootNode)
  if (rc) s += rc
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
