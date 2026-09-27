// server.js — minimal, dependency-free REST API for the strain-effects widget.
// Run: node server.js   (defaults to http://localhost:4000, no npm install needed)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { computeScores } = require('./scoring');

const PORT = process.env.PORT || 4000;
const DATA_PATH = path.join(__dirname, '..', 'data', 'strains.json');

function loadStrains() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  return raw.map((s) => ({ ...s, scores: computeScores(s.effects) }));
}

// Cached in memory; call POST /api/admin/reload after editing strains.json.
// For a larger dataset, swap this for a real DB — the record shape stays
// the same, so only loadStrains() needs to change.
let strains = loadStrains();

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean); // e.g. ['api','strains','Blue Dream']

  if (parts[0] !== 'api') return send(res, 404, { error: 'Not found' });

  // GET /api/methodology
  if (req.method === 'GET' && parts[1] === 'methodology') {
    return send(res, 200, {
      note:
        'Scores are a transparent, tag-weighted heuristic built from self-reported ' +
        'effect tags found in public strain databases (e.g. the widely-used Kaggle ' +
        '"cannabis-strains" dataset). They are NOT lab-verified and are NOT medical ' +
        'advice. Actual effects vary by batch, cultivation, and the individual.',
      scales: {
        mentalEnergy: '0 = calming, 10 = energizing',
        adhd: 'label: Focus | Hyperfocus | Calm Relaxation | Sedation',
        panicMeter: '0 = low reported anxiety risk, 10 = high',
      },
    });
  }

  // GET /api/knowledge - Returns the historical and truth-check data
  if (req.method === 'GET' && parts[1] === 'knowledge') {
    try {
      const kbPath = path.join(__dirname, '..', 'data', 'knowledge.json');
      const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
      return send(res, 200, kb);
    } catch (e) {
      return send(res, 500, { error: 'Could not load knowledge base' });
    }
  }

  // POST /api/admin/reload
  if (req.method === 'POST' && parts[1] === 'admin' && parts[2] === 'reload') {
    strains = loadStrains();
    return send(res, 200, { reloaded: true, count: strains.length });
  }

  // GET /api/strains/:name
  if (req.method === 'GET' && parts[1] === 'strains' && parts[2]) {
    const name = decodeURIComponent(parts[2]).toLowerCase();
    
    // 1. Exact match
    let match = strains.find((s) => s.name.toLowerCase() === name);
    
    // 2. Fuzzy match: if no exact match, look for partial matches
    if (!match) {
      match = strains.find((s) => 
        s.name.toLowerCase().includes(name) || 
        name.includes(s.name.toLowerCase())
      );
    }
    
    if (!match) return send(res, 404, { error: 'Strain not found' });
    return send(res, 200, match);
  }

  // GET /api/strains?q=&type=&adhd=&energyMin=&energyMax=&panicMax=
  if (req.method === 'GET' && parts[1] === 'strains') {
    let results = strains;
    const q = url.searchParams.get('q');
    const type = url.searchParams.get('type');
    const adhd = url.searchParams.get('adhd');
    const energyMin = url.searchParams.get('energyMin');
    const energyMax = url.searchParams.get('energyMax');
    const panicMax = url.searchParams.get('panicMax');

    if (q) {
      const needle = q.toLowerCase();
      results = results.filter((s) => s.name.toLowerCase().includes(needle));
    }
    if (type) results = results.filter((s) => s.type.toLowerCase() === type.toLowerCase());
    if (adhd) results = results.filter((s) => s.scores.adhd.label.toLowerCase() === adhd.toLowerCase());
    if (energyMin !== null) results = results.filter((s) => s.scores.mentalEnergy >= Number(energyMin));
    if (energyMax !== null) results = results.filter((s) => s.scores.mentalEnergy <= Number(energyMax));
    if (panicMax !== null) results = results.filter((s) => s.scores.panicMeter <= Number(panicMax));

    return send(res, 200, { count: results.length, results });
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Strain-effects API running on port ${PORT}`);
});
