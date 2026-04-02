/* leaderboard.js — universal leaderboard (Firebase REST + localStorage fallback) */
(function () {

  /* ── Config ──────────────────────────────────────────────────────────── */
  const cfg     = window.ARCADE_FIREBASE_CONFIG || {};
  const FB_URL  = (cfg.databaseURL || '').replace(/\/$/, '');
  const FB_ON   = FB_URL.length > 10 && !FB_URL.includes('YOUR_DATABASE');
  const FB_PATH = '/leaderboard';
  const LOCAL_KEY = 'wandererArcadeLB_v1';
  const TIMEOUT_MS = 6000;

  /* ── CSS ─────────────────────────────────────────────────────────────── */
  const css = `
    #lb-overlay{position:fixed;inset:0;background:rgba(5,5,14,.97);z-index:9000;display:flex;align-items:center;justify-content:center;font-family:'Press Start 2P',monospace}
    #lb-overlay.hidden{display:none}
    #lb-modal{width:min(500px,95vw);padding:32px 28px 28px;background:#0a0a1c;border:2px solid #00f5d4;box-shadow:0 0 40px rgba(0,245,212,.25);display:flex;flex-direction:column;gap:20px}
    #lb-modal h2{font-size:12px;letter-spacing:3px;color:#00f5d4;text-align:center;text-shadow:0 0 16px rgba(0,245,212,.5)}
    #lb-score-line{font-size:9px;color:#f9c74f;text-align:center;letter-spacing:2px;line-height:2.2}
    #lb-status-row{display:flex;align-items:center;justify-content:center;gap:8px;font-size:7px;letter-spacing:2px}
    #lb-status-dot{width:7px;height:7px;border-radius:50%;background:#3a3a70;flex-shrink:0;transition:background .3s}
    #lb-status-dot.online{background:#06d6a0;box-shadow:0 0 6px #06d6a0}
    #lb-status-dot.saving{background:#f9c74f;animation:lb-pulse .5s ease infinite alternate}
    #lb-status-dot.offline{background:#f72585}
    #lb-status-txt{color:#3a3a70;transition:color .3s}
    #lb-status-txt.online{color:#06d6a0}
    #lb-status-txt.saving{color:#f9c74f}
    #lb-status-txt.offline{color:#f72585}
    @keyframes lb-pulse{from{opacity:.5}to{opacity:1}}
    #lb-initials-wrap{display:flex;flex-direction:column;align-items:center;gap:12px}
    #lb-initials-label{font-size:8px;color:#6060a0;letter-spacing:2px}
    #lb-initials-row{display:flex;gap:10px}
    .lb-letter{width:52px;height:60px;font-family:'Press Start 2P',monospace;font-size:24px;text-align:center;background:#050510;border:2px solid #2a2a50;color:#e8e8ff;outline:none;text-transform:uppercase;caret-color:transparent;transition:border-color .15s,box-shadow .15s}
    .lb-letter:focus{border-color:#00f5d4;box-shadow:0 0 12px rgba(0,245,212,.3)}
    #lb-save-btn{font-family:'Press Start 2P',monospace;font-size:10px;padding:14px 28px;border:none;cursor:pointer;letter-spacing:2px;background:#00f5d4;color:#050510;box-shadow:0 0 20px rgba(0,245,212,.4);transition:box-shadow .2s,opacity .2s;align-self:center}
    #lb-save-btn:hover:not(:disabled){box-shadow:0 0 40px rgba(0,245,212,.7)}
    #lb-save-btn:disabled{opacity:.35;cursor:not-allowed}
    #lb-table-wrap{max-height:260px;overflow-y:auto}
    #lb-table-wrap::-webkit-scrollbar{width:4px}
    #lb-table-wrap::-webkit-scrollbar-thumb{background:#1e1e3a}
    #lb-table-title{font-size:7px;color:#6060a0;letter-spacing:2px;margin-bottom:10px;display:flex;align-items:center;gap:8px}
    .lb-row{display:flex;align-items:center;padding:7px 0;border-bottom:1px solid #111128;font-size:8px}
    .lb-row.new-entry{background:rgba(0,245,212,.06);border-bottom-color:rgba(0,245,212,.2)}
    .lb-rank{width:28px;color:#3a3a70;flex-shrink:0}
    .lb-rank.top{color:#f9c74f}
    .lb-init{width:44px;color:#00f5d4;flex-shrink:0;letter-spacing:2px}
    .lb-sc{flex:1;text-align:right;color:#e8e8ff}
    .lb-date{width:60px;text-align:right;color:#3a3a70;font-size:6px}
    .lb-empty{font-size:8px;color:#3a3a70;text-align:center;padding:20px 0;letter-spacing:2px}
    .lb-loading{font-size:8px;color:#3a3a70;text-align:center;padding:20px 0;letter-spacing:2px;animation:lb-pulse .8s ease infinite alternate}
    #lb-close-row{display:flex;justify-content:center;gap:12px;margin-top:4px}
    .lb-close-btn{font-family:'Press Start 2P',monospace;font-size:8px;padding:10px 20px;cursor:pointer;letter-spacing:1px;transition:all .2s}
    .lb-close-btn.primary{background:#00f5d4;color:#050510;border:none;box-shadow:0 0 12px rgba(0,245,212,.3)}
    .lb-close-btn.secondary{background:transparent;color:#6060a0;border:1px solid #1e1e3a}
    .lb-close-btn.secondary:hover{color:#e8e8ff;border-color:#e8e8ff}
    #lb-offline-note{font-size:7px;color:#f72585;text-align:center;letter-spacing:1px;display:none}
    #lb-offline-note.show{display:block}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── Firebase REST helpers ───────────────────────────────────────────── */
  function fetchWithTimeout(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return fetch(url, { ...opts, signal: ctrl.signal })
      .finally(() => clearTimeout(timer));
  }

  async function fbGet(game) {
    if (!FB_ON) return null;
    try {
      const r = await fetchWithTimeout(`${FB_URL}${FB_PATH}/${game}.json`);
      if (!r.ok) return null;
      const data = await r.json();
      return Array.isArray(data) ? data : (data && typeof data === 'object' ? Object.values(data) : null);
    } catch { return null; }
  }

  async function fbPut(game, entries) {
    if (!FB_ON) return false;
    try {
      const r = await fetchWithTimeout(`${FB_URL}${FB_PATH}/${game}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries)
      });
      return r.ok;
    } catch { return false; }
  }

  /* ── Local storage helpers ───────────────────────────────────────────── */
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; }
  }
  function saveLocal(data) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
  }
  function getLocalEntries(game) {
    return ((loadLocal()[game] || []).sort((a, b) => b.s - a.s)).slice(0, 10);
  }
  function cacheEntries(game, entries) {
    const all = loadLocal();
    all[game] = entries;
    saveLocal(all);
  }

  /* ── Entry management ────────────────────────────────────────────────── */
  async function fetchEntries(game) {
    if (FB_ON) {
      const remote = await fbGet(game);
      if (remote) {
        const sorted = remote.sort((a, b) => b.s - a.s).slice(0, 10);
        cacheEntries(game, sorted);   // keep local cache fresh
        return { entries: sorted, online: true };
      }
    }
    return { entries: getLocalEntries(game), online: false };
  }

  async function pushEntry(game, initials, score) {
    const init = initials.toUpperCase().slice(0, 3).padEnd(3, ' ');
    const newEntry = { i: init, s: score, d: Date.now() };

    // Always write locally first
    const localEntries = getLocalEntries(game);
    localEntries.push(newEntry);
    localEntries.sort((a, b) => b.s - a.s);
    const localFinal = localEntries.slice(0, 10);
    cacheEntries(game, localFinal);

    if (!FB_ON) {
      const idx = localFinal.findIndex(e => e.s === score && e.i.trim() === init.trim());
      return { entries: localFinal, idx, online: false };
    }

    // Merge with Firebase entries to handle concurrent submissions
    const remote = await fbGet(game) || [];
    remote.push(newEntry);
    remote.sort((a, b) => b.s - a.s);
    const final = remote.slice(0, 10);
    const ok = await fbPut(game, final);

    if (ok) {
      cacheEntries(game, final);
      const idx = final.findIndex(e => e.s === score && e.i.trim() === init.trim());
      return { entries: final, idx, online: true };
    } else {
      const idx = localFinal.findIndex(e => e.s === score && e.i.trim() === init.trim());
      return { entries: localFinal, idx, online: false };
    }
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  function setStatus(state, text) {
    const dot = document.getElementById('lb-status-dot');
    const txt = document.getElementById('lb-status-txt');
    if (!dot || !txt) return;
    dot.className = state;
    txt.className = state;
    txt.textContent = text;
  }

  /* ── Build / reset overlay ───────────────────────────────────────────── */
  function buildOverlay() {
    if (document.getElementById('lb-overlay')) return;
    const div = document.createElement('div');
    div.id = 'lb-overlay';
    div.className = 'hidden';
    div.innerHTML = `
      <div id="lb-modal">
        <h2 id="lb-modal-title">HIGH SCORE!</h2>
        <div id="lb-score-line"></div>
        <div id="lb-status-row">
          <div id="lb-status-dot"></div>
          <span id="lb-status-txt"></span>
        </div>
        <div id="lb-initials-wrap">
          <div id="lb-initials-label">ENTER YOUR INITIALS</div>
          <div id="lb-initials-row">
            <input class="lb-letter" maxlength="1" id="lb-l0" autocomplete="off" spellcheck="false"/>
            <input class="lb-letter" maxlength="1" id="lb-l1" autocomplete="off" spellcheck="false"/>
            <input class="lb-letter" maxlength="1" id="lb-l2" autocomplete="off" spellcheck="false"/>
          </div>
          <button id="lb-save-btn" disabled>SAVE SCORE</button>
        </div>
        <div id="lb-table-wrap">
          <div id="lb-table-title">— TOP SCORES —</div>
          <div id="lb-table"></div>
        </div>
        <div id="lb-offline-note">⚠ SAVED LOCALLY — FIREBASE NOT CONFIGURED</div>
        <div id="lb-close-row"></div>
      </div>`;
    document.body.appendChild(div);

    // Wire letter inputs (persistent delegation — survives DOM rebuilds)
    div.addEventListener('input', e => {
      if (!e.target.classList.contains('lb-letter')) return;
      const inp = e.target;
      inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const idx = parseInt(inp.id.slice(-1));
      if (inp.value && idx < 2) document.getElementById('lb-l' + (idx + 1)).focus();
      const saveBtn = document.getElementById('lb-save-btn');
      if (saveBtn) saveBtn.disabled = [0, 1, 2].some(j => !document.getElementById('lb-l' + j)?.value);
    });
    div.addEventListener('keydown', e => {
      if (!e.target.classList.contains('lb-letter')) return;
      const idx = parseInt(e.target.id.slice(-1));
      if (e.key === 'Backspace' && !e.target.value && idx > 0)
        document.getElementById('lb-l' + (idx - 1)).focus();
    });
  }

  /* ── Render table ────────────────────────────────────────────────────── */
  function renderTable(entries, highlightIdx) {
    const wrap = document.getElementById('lb-table');
    if (!wrap) return;
    if (!entries || !entries.length) {
      wrap.innerHTML = '<div class="lb-empty">NO SCORES YET</div>'; return;
    }
    wrap.innerHTML = entries.map((e, i) => `
      <div class="lb-row${i === highlightIdx ? ' new-entry' : ''}">
        <span class="lb-rank${i < 3 ? ' top' : ''}">${['🥇','🥈','🥉'][i] || (i + 1) + '.'}</span>
        <span class="lb-init">${(e.i || '???').trim()}</span>
        <span class="lb-sc">${(e.s || 0).toLocaleString()}</span>
        <span class="lb-date">${fmtDate(e.d || 0)}</span>
      </div>`).join('');
  }

  function showLoading() {
    const wrap = document.getElementById('lb-table');
    if (wrap) wrap.innerHTML = '<div class="lb-loading">LOADING SCORES...</div>';
  }

  /* ── Public API ──────────────────────────────────────────────────────── */
  window.LB = {

    submit(game, score, scoreLabel, onContinue) {
      buildOverlay();
      const overlay = document.getElementById('lb-overlay');

      // Reset modal state
      document.getElementById('lb-modal-title').textContent = 'HIGH SCORE!';
      document.getElementById('lb-score-line').innerHTML = scoreLabel || `SCORE: ${score.toLocaleString()}`;
      document.getElementById('lb-initials-wrap').style.display = 'flex';
      document.getElementById('lb-offline-note').classList.remove('show');

      // Status indicator
      if (FB_ON) {
        setStatus('online', 'GLOBAL LEADERBOARD');
      } else {
        setStatus('offline', 'LOCAL SCORES ONLY');
        document.getElementById('lb-offline-note').classList.add('show');
      }

      // Reset letters
      [0, 1, 2].forEach(i => {
        const el = document.getElementById('lb-l' + i);
        if (el) el.value = '';
      });
      const saveBtn = document.getElementById('lb-save-btn');
      if (saveBtn) saveBtn.disabled = true;

      // Load existing scores while user types initials
      showLoading();
      fetchEntries(game).then(({ entries, online }) => {
        if (!document.getElementById('lb-initials-wrap').style.display.includes('none')) {
          renderTable(entries, -1);
          if (FB_ON && !online) setStatus('offline', 'OFFLINE — LOCAL SCORES');
        }
      });

      // Close row
      const closeRow = document.getElementById('lb-close-row');
      closeRow.innerHTML = '<button class="lb-close-btn secondary" id="lb-skip">SKIP</button>';

      overlay.classList.remove('hidden');
      setTimeout(() => document.getElementById('lb-l0')?.focus(), 80);

      // Save handler
      const handleSave = async () => {
        const initials = [0, 1, 2].map(j => document.getElementById('lb-l' + j)?.value || '').join('');
        if (initials.replace(/\s/g, '').length < 1) return;

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = FB_ON ? 'SAVING...' : 'SAVING'; }
        setStatus('saving', FB_ON ? 'SYNCING TO SERVER...' : 'SAVING LOCALLY...');
        showLoading();
        document.getElementById('lb-initials-wrap').style.display = 'none';

        const { entries, idx, online } = await pushEntry(game, initials, score);

        document.getElementById('lb-modal-title').textContent = 'LEADERBOARD';
        renderTable(entries, idx);

        if (FB_ON && online) {
          setStatus('online', 'SYNCED ✓');
        } else if (FB_ON && !online) {
          setStatus('offline', 'SAVED LOCALLY — SYNC FAILED');
          document.getElementById('lb-offline-note').classList.add('show');
        } else {
          setStatus('offline', 'LOCAL SCORES ONLY');
          document.getElementById('lb-offline-note').classList.add('show');
        }

        closeRow.innerHTML = '<button class="lb-close-btn primary" id="lb-continue">CONTINUE</button>';
        document.getElementById('lb-continue').addEventListener('click', () => {
          overlay.classList.add('hidden');
          if (onContinue) onContinue();
        });
      };

      // Wire save button fresh each time (replace node to clear old listeners)
      const oldBtn = document.getElementById('lb-save-btn');
      if (oldBtn) {
        const newBtn = oldBtn.cloneNode(true);
        newBtn.disabled = true;
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        newBtn.addEventListener('click', handleSave);
        // also allow Enter key
        overlay.addEventListener('keydown', function onEnter(e) {
          if (e.key === 'Enter' && !document.getElementById('lb-save-btn')?.disabled) {
            overlay.removeEventListener('keydown', onEnter);
            handleSave();
          }
        });
      }

      document.getElementById('lb-skip').addEventListener('click', () => {
        document.getElementById('lb-modal-title').textContent = 'LEADERBOARD';
        document.getElementById('lb-initials-wrap').style.display = 'none';
        showLoading();
        fetchEntries(game).then(({ entries, online }) => {
          renderTable(entries, -1);
          if (FB_ON && !online) setStatus('offline', 'OFFLINE — LOCAL SCORES');
        });
        closeRow.innerHTML = '<button class="lb-close-btn primary" id="lb-continue">CONTINUE</button>';
        document.getElementById('lb-continue').addEventListener('click', () => {
          overlay.classList.add('hidden');
          if (onContinue) onContinue();
        });
      });
    },

    show(game, title) {
      buildOverlay();
      const overlay = document.getElementById('lb-overlay');
      document.getElementById('lb-modal-title').textContent = title || 'LEADERBOARD';
      document.getElementById('lb-score-line').innerHTML = '';
      document.getElementById('lb-initials-wrap').style.display = 'none';
      document.getElementById('lb-offline-note').classList.remove('show');
      showLoading();

      if (FB_ON) {
        setStatus('online', 'GLOBAL LEADERBOARD');
      } else {
        setStatus('offline', 'LOCAL SCORES ONLY');
        document.getElementById('lb-offline-note').classList.add('show');
      }

      fetchEntries(game).then(({ entries, online }) => {
        renderTable(entries, -1);
        if (FB_ON && !online) setStatus('offline', 'OFFLINE — LOCAL SCORES');
      });

      document.getElementById('lb-close-row').innerHTML =
        '<button class="lb-close-btn primary" id="lb-continue">CLOSE</button>';
      document.getElementById('lb-continue').addEventListener('click', () =>
        overlay.classList.add('hidden'));

      overlay.classList.remove('hidden');
    },

    // Expose for leaderboard.html
    fetchEntries,
    FB_ON,

    /* Score utilities */
    puzzleScore(moves, seconds, cols) {
      const diffMult = cols <= 3 ? 1 : cols <= 5 ? 2.5 : 5;
      return Math.max(1, Math.round(10000 / (moves * 0.6 + Math.max(1, seconds) * 0.4) * diffMult));
    },
    memoryScore(pairs, flips, seconds) {
      return Math.max(1, Math.round(pairs * 1200 / (flips * 0.55 + Math.max(1, seconds) * 0.45)));
    },
    reactionScore(avgMs) {
      return Math.max(1, Math.round(50000 / avgMs));
    },
  };

})();
