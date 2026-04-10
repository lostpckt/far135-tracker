'use strict';

// ============================================================
// CONFIG & DATA STORE
// ============================================================
let entries = [];
try { entries = JSON.parse(localStorage.getItem('far135_v1') || '[]'); } catch { entries = []; }

function save() { localStorage.setItem('far135_v1', JSON.stringify(entries)); }

// ============================================================
// TIME UTILITIES
// ============================================================
function ms(dtStr) {
  if (!dtStr) return null;
  const t = new Date(dtStr).getTime();
  return isNaN(t) ? null : t;
}

function hrs(startMs, endMs) {
  if (startMs === null || endMs === null) return null;
  const h = (endMs - startMs) / 3600000;
  return h >= 0 ? h : null;
}

function fmtHrs(h) {
  if (h === null || h === undefined || isNaN(h)) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

function fmtDT(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  if (isNaN(d)) return '—';
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtTime(dtStr) {
  if (!dtStr) return '—';
  return (dtStr.split('T')[1] || '').slice(0, 5) || '—';
}

function fmtDate(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  if (isNaN(d)) return '—';
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

// Read a date+time field pair and return "YYYY-MM-DDTHH:MM" or ""
function getDT(prefix) {
  const d = document.getElementById(prefix + '-d').value;
  const t = document.getElementById(prefix + '-t').value.trim();
  if (!d || !t) return '';
  const norm = t.length === 4 ? t.slice(0,2) + ':' + t.slice(2) : t;
  if (!/^\d{2}:\d{2}$/.test(norm)) return '';
  return `${d}T${norm}`;
}

function clearDT(prefix) {
  document.getElementById(prefix + '-d').value = '';
  document.getElementById(prefix + '-t').value = '';
}

// Split "YYYY-MM-DDTHH:MM" back into { d, t }
function splitDT(dtStr) {
  if (!dtStr) return { d: '', t: '' };
  const [d, t] = dtStr.split('T');
  return { d: d || '', t: t || '' };
}

function setElDT(prefix, dtStr) {
  const { d, t } = splitDT(dtStr);
  document.getElementById(prefix + '-d').value = d;
  document.getElementById(prefix + '-t').value = t;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// CALCULATION ENGINE
// ============================================================
function compute(entry, all) {
  const c = {};
  const offMs  = ms(entry.offBlocks);
  const onMs   = ms(entry.onBlocks);
  const showMs = ms(entry.showTime);
  const relMs  = ms(entry.releaseTime);
  const rsMs   = ms(entry.restStart);
  const reMs   = ms(entry.restEnd);

  c.legFlight  = hrs(offMs, onMs);
  c.dutyPeriod = hrs(showMs, relMs);
  c.consRest   = hrs(rsMs, reMs);
  c.maxFlight  = entry.crew === 'D' ? 10 : 8;

  // Part 91 — logged but exempt from all Part 135 limits
  if (entry.part91) {
    c.rolling24 = null; c.excAmt = 0; c.reqRest = 10;
    c.lookbackOk = null; c.flightOk = null; c.dutyOk = null; c.restOk = null;
    return c;
  }

  // Rolling 24-hr flight time (excludes Part 91 legs)
  if (onMs !== null) {
    const win = onMs - 86400000;
    c.rolling24 = all.reduce((sum, e) => {
      if (e.part91) return sum;
      const eOn = ms(e.onBlocks), eOff = ms(e.offBlocks);
      if (!eOn || !eOff) return sum;
      if (eOn <= onMs && eOn > win && eOn >= eOff) return sum + (eOn - eOff) / 3600000;
      return sum;
    }, 0);
  } else {
    c.rolling24 = null;
  }

  c.excAmt = c.rolling24 !== null ? Math.max(0, c.rolling24 - c.maxFlight) : 0;
  c.reqRest = c.excAmt === 0 ? 10 : c.excAmt < 0.5 ? 11 : c.excAmt <= 1 ? 12 : 16;

  // 10-hr look-back rest
  c.lookbackOk = null;
  if (onMs !== null) {
    const lbStart = onMs - 86400000;
    const found = all.some(e => {
      if (e.id === entry.id) return false;
      // A 24-hr rest day counts as a full 24-hour rest period (00:00 → 24:00)
      if (e.restDay) {
        const dayStart = ms(e.showTime);
        const dayEnd   = dayStart ? dayStart + 86400000 : null;
        if (!dayEnd) return false;
        return dayEnd >= lbStart && dayEnd <= onMs; // always ≥ 10 hrs
      }
      const eRe = ms(e.restEnd), eRs = ms(e.restStart);
      if (!eRe || !eRs) return false;
      return eRe >= lbStart && eRe <= onMs && (eRe - eRs) / 3600000 >= 10;
    });
    const hasPrior = all.some(e => e.id !== entry.id &&
      (ms(e.restEnd) !== null || e.restDay));
    c.lookbackOk = hasPrior ? found : null;
  }

  c.flightOk = c.rolling24 !== null ? c.rolling24 <= c.maxFlight : null;
  c.dutyOk   = c.dutyPeriod !== null ? c.dutyPeriod <= 14 : null;
  c.restOk   = c.consRest !== null ? c.consRest >= c.reqRest : null;
  return c;
}

function badge(flag, okTxt, warnTxt) {
  if (flag === null || flag === undefined) return `<span class="badge b-na">N/A</span>`;
  return flag
    ? `<span class="badge b-ok">&#10003; ${okTxt}</span>`
    : `<span class="badge b-warn">&#9888; ${warnTxt}</span>`;
}

function quarterRestCount() {
  const now = new Date();
  const qM = Math.floor(now.getMonth() / 3) * 3;
  const qS = new Date(now.getFullYear(), qM, 1).getTime();
  const qE = new Date(now.getFullYear(), qM + 3, 1).getTime();
  return entries.filter(e => {
    if (!e.restDay) return false;
    const a = ms(e.showTime) || ms(e.offBlocks);
    return a !== null && a >= qS && a < qE;
  }).length;
}

// ============================================================
// MULTI-LEG FORM MANAGEMENT
// ============================================================
let legIndices = [0];
let nextLegIdx = 1;

function getLegDT(idx, field) {
  const d = document.getElementById(`leg-${idx}-${field}-d`).value;
  const t = document.getElementById(`leg-${idx}-${field}-t`).value.trim();
  if (!d || !t) return '';
  const norm = t.length === 4 ? t.slice(0,2) + ':' + t.slice(2) : t;
  if (!/^\d{2}:\d{2}$/.test(norm)) return '';
  return `${d}T${norm}`;
}

function renderLegRows() {
  document.getElementById('legs-container').innerHTML = legIndices.map((idx, pos) => `
    <div class="leg-row" data-idx="${idx}">
      <div class="leg-row-header">
        <span class="leg-num">Leg ${pos + 1}</span>
        ${legIndices.length > 1
          ? `<button class="remove-leg" onclick="removeLeg(${idx})" title="Remove leg">&#10005;</button>`
          : ''}
      </div>
      <div class="leg-fields">
        <div class="lf">
          <label>Dep ICAO</label>
          <input type="text" id="leg-${idx}-dep" placeholder="KBOS" maxlength="4" autocomplete="off" autocapitalize="characters">
        </div>
        <div class="lf">
          <label>Arr ICAO</label>
          <input type="text" id="leg-${idx}-arr" placeholder="KJFK" maxlength="4" autocomplete="off" autocapitalize="characters">
        </div>
        <div class="lf">
          <label>Off Blocks</label>
          <div class="dt-pair">
            <input type="date" id="leg-${idx}-off-d">
            <input type="text" id="leg-${idx}-off-t" placeholder="09:00" maxlength="5" inputmode="numeric">
          </div>
        </div>
        <div class="lf">
          <label>On Blocks</label>
          <div class="dt-pair">
            <input type="date" id="leg-${idx}-on-d">
            <input type="text" id="leg-${idx}-on-t" placeholder="11:30" maxlength="5" inputmode="numeric">
          </div>
        </div>
        <div class="lf leg-reason">
          <label>Exceedance Reason (optional)</label>
          <input type="text" id="leg-${idx}-reason" placeholder="e.g. Weather divert">
        </div>
        <div class="lf leg-p91">
          <label>&nbsp;</label>
          <div class="check-row p91-check">
            <input type="checkbox" id="leg-${idx}-p91">
            <label for="leg-${idx}-p91">Part 91 — exclude from §135 limits</label>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function addLeg() {
  legIndices.push(nextLegIdx++);
  renderLegRows();
}

function removeLeg(idx) {
  legIndices = legIndices.filter(i => i !== idx);
  renderLegRows();
}

// ============================================================
// RENDER — DASHBOARD
// ============================================================
function renderDashboard() {
  const qCount = quarterRestCount();
  const nonRest = entries.filter(e => !e.restDay && !e.part91);
  const last = nonRest.length ? nonRest[nonRest.length - 1] : null;
  const lc = last ? compute(last, entries) : null;

  const allWarnings = entries.filter(e => {
    if (e.restDay || e.part91) return false;
    const c = compute(e, entries);
    return c.flightOk === false || c.dutyOk === false || c.restOk === false;
  }).length;

  const cards = [
    {
      lbl: 'Total Legs',
      val: entries.filter(e => !e.restDay).length,
      sub: `${entries.filter(e => e.restDay).length} rest-day entries`,
      cls: 'c-neutral'
    },
    {
      lbl: 'Last 24-hr Flight',
      val: lc ? fmtHrs(lc.rolling24) : '—',
      sub: lc ? `Limit: ${lc.maxFlight}h` : 'No entries yet',
      cls: !lc ? 'c-neutral' : lc.flightOk !== false ? 'c-ok' : 'c-warn'
    },
    {
      lbl: 'Last Duty Period',
      val: lc ? fmtHrs(lc.dutyPeriod) : '—',
      sub: 'Limit: 14h',
      cls: !lc ? 'c-neutral' : lc.dutyOk !== false ? 'c-ok' : 'c-warn'
    },
    {
      lbl: 'Last Rest Period',
      val: lc ? fmtHrs(lc.consRest) : '—',
      sub: lc ? `Required: ${lc.reqRest}h` : '',
      cls: !lc ? 'c-neutral' : lc.restOk !== false ? 'c-ok' : 'c-warn'
    },
    {
      lbl: 'Quarter Rest Days',
      val: `${qCount}/13`,
      sub: qCount >= 13 ? 'Requirement met' : `Need ${13 - qCount} more`,
      cls: qCount >= 13 ? 'c-ok' : qCount >= 8 ? 'c-caution' : 'c-warn'
    },
    {
      lbl: 'Active Violations',
      val: allWarnings,
      sub: allWarnings === 0 ? 'All entries compliant' : 'Review flagged rows',
      cls: allWarnings === 0 ? 'c-ok' : 'c-warn'
    }
  ];

  document.getElementById('dashboard').innerHTML = cards.map(c => `
    <div class="dash-card">
      <div class="lbl">${c.lbl}</div>
      <div class="val ${c.cls}">${c.val}</div>
      <div class="sub">${c.sub}</div>
    </div>
  `).join('');
}

// ============================================================
// RENDER — LOG CARDS (mobile)
// ============================================================
function renderCards() {
  const el = document.getElementById('log-cards');
  if (!entries.length) {
    el.innerHTML = '<div class="empty">No entries yet — tap Add Entry to begin.</div>';
    return;
  }

  const sorted = [...entries].sort(
    (a, b) => (ms(a.onBlocks) || ms(a.showTime) || 0) - (ms(b.onBlocks) || ms(b.showTime) || 0)
  );

  el.innerHTML = sorted.map(e => {
    if (e.restDay) {
      return `
        <div class="entry-card rest-day-card">
          <div class="card-header">
            <span class="card-date">${fmtDate(e.showTime)}</span>
            <span class="card-pilot">${e.pilot || '—'}</span>
            <div class="card-actions">
              <button class="edit-btn" onclick="editEntry('${e.id}')" title="Edit">&#9998;</button>
              <button class="del-btn"  onclick="del('${e.id}')"       title="Delete">&#10005;</button>
            </div>
          </div>
          <div class="card-rest-label">&#9679; 24-HOUR REST DAY</div>
        </div>`;
    }

    const c = compute(e, entries);

    if (e.part91) {
      return `
        <div class="entry-card part91-card">
          <div class="card-header">
            <span class="card-date">${fmtDate(e.showTime)}</span>
            <span class="card-pilot">${e.pilot || '—'}</span>
            <span class="badge b-p91">Part 91</span>
            <div class="card-actions">
              <button class="edit-btn" onclick="editEntry('${e.id}')" title="Edit">&#9998;</button>
              <button class="del-btn"  onclick="del('${e.id}')"       title="Delete">&#10005;</button>
            </div>
          </div>
          <div class="card-route">${(e.dep||'?').toUpperCase()} &#8594; ${(e.arr||'?').toUpperCase()}</div>
          <div class="card-times">Off: ${fmtTime(e.offBlocks)} &nbsp;|&nbsp; On: ${fmtTime(e.onBlocks)} &nbsp;|&nbsp; ${fmtHrs(c.legFlight)}</div>
          <div class="card-note">Excluded from §135.267 limits</div>
        </div>`;
    }

    const violation = c.flightOk === false || c.dutyOk === false || c.restOk === false;
    return `
      <div class="entry-card ${violation ? 'card-violation' : ''}">
        <div class="card-header">
          <span class="card-date">${fmtDate(e.showTime)}</span>
          <span class="card-pilot">${e.pilot || '—'}</span>
          <span class="card-crew">${e.crew === 'D' ? 'Dual' : 'Single'}</span>
          <div class="card-actions">
            <button class="edit-btn" onclick="editEntry('${e.id}')" title="Edit">&#9998;</button>
            <button class="del-btn"  onclick="del('${e.id}')"       title="Delete">&#10005;</button>
          </div>
        </div>
        <div class="card-route">${(e.dep||'—').toUpperCase()} &#8594; ${(e.arr||'—').toUpperCase()}</div>
        <div class="card-times">Off: ${fmtTime(e.offBlocks)} &nbsp;|&nbsp; On: ${fmtTime(e.onBlocks)}</div>
        <div class="card-metrics">
          <div class="metric">
            <div class="metric-val">${fmtHrs(c.legFlight)}</div>
            <div class="metric-lbl">Leg</div>
          </div>
          <div class="metric ${c.flightOk === false ? 'metric-warn' : ''}">
            <div class="metric-val">${c.rolling24 !== null ? fmtHrs(c.rolling24) : '—'}</div>
            <div class="metric-lbl">24-hr/${c.maxFlight}h</div>
          </div>
          <div class="metric ${c.dutyOk === false ? 'metric-warn' : ''}">
            <div class="metric-val">${fmtHrs(c.dutyPeriod)}</div>
            <div class="metric-lbl">Duty/14h</div>
          </div>
          <div class="metric ${c.restOk === false ? 'metric-warn' : ''}">
            <div class="metric-val">${fmtHrs(c.consRest)}</div>
            <div class="metric-lbl">Rest/${c.reqRest}h</div>
          </div>
        </div>
        <div class="card-flags">
          ${badge(c.flightOk, 'Flt', 'Flt &#9888;')}
          ${badge(c.dutyOk,   'Duty', 'Duty &#9888;')}
          ${badge(c.lookbackOk, '10-hr', '10-hr &#9888;')}
          ${badge(c.restOk,   'Rest', 'Rest &#9888;')}
          ${c.excAmt > 0 ? `<span class="badge b-warn">+${fmtHrs(c.excAmt)} over</span>` : ''}
          ${e.reason ? `<span class="card-reason">${e.reason}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// RENDER — LOG TABLE (desktop)
// ============================================================
function renderTable() {
  const el = document.getElementById('log-table');
  if (!entries.length) {
    el.innerHTML = '<div class="empty">No entries yet.</div>';
    return;
  }

  const sorted = [...entries].sort(
    (a, b) => (ms(a.onBlocks) || ms(a.showTime) || 0) - (ms(b.onBlocks) || ms(b.showTime) || 0)
  );

  const rows = sorted.map(e => {
    if (e.restDay) {
      return `<tr style="background:#f0fdf4">
        <td>${fmtDT(e.showTime)}</td>
        <td><strong>${e.pilot||'—'}</strong></td>
        <td colspan="14" style="color:#16a34a;font-weight:600">&#128308; 24-HOUR REST DAY</td>
        <td style="white-space:nowrap">
          <button class="edit-btn" onclick="editEntry('${e.id}')">&#9998;</button>
          <button class="del-btn"  onclick="del('${e.id}')">&#10005;</button>
        </td>
      </tr>`;
    }

    const c = compute(e, entries);
    const p91Badge = e.part91 ? `<span class="badge b-p91">Part 91</span>` : '';
    const excBadge = c.excAmt > 0
      ? `<span class="badge b-warn">${fmtHrs(c.excAmt)}</span>`
      : `<span class="badge b-ok">None</span>`;

    return `<tr${e.part91 ? ' style="background:#fffef0"' : ''}>
      <td>${fmtDT(e.showTime)}</td>
      <td><strong>${e.pilot||'—'}</strong></td>
      <td>${e.crew==='D'?'Dual':'Single'} ${p91Badge}</td>
      <td>${(e.dep||'—').toUpperCase()} &#8594; ${(e.arr||'—').toUpperCase()}</td>
      <td>${fmtDT(e.offBlocks)}</td>
      <td>${fmtDT(e.onBlocks)}</td>
      <td><strong>${fmtHrs(c.legFlight)}</strong></td>
      <td>${e.part91
        ? '<span style="color:#92400e;font-size:.75rem">Part 91</span>'
        : `<strong>${c.rolling24!=null?fmtHrs(c.rolling24):'—'}</strong><div style="font-size:.68rem;color:#999">Limit: ${c.maxFlight}h</div>`}</td>
      <td>${e.part91 ? '<span class="badge b-na">N/A</span>' : badge(c.flightOk,'OK','EXCEEDED')}</td>
      <td>${fmtHrs(c.dutyPeriod)}</td>
      <td>${e.part91 ? '<span class="badge b-na">N/A</span>' : badge(c.dutyOk,'OK','EXCEEDED')}</td>
      <td>${e.part91 ? '<span class="badge b-na">N/A</span>' : badge(c.lookbackOk,'10-hr met','CHECK REST')}</td>
      <td>${fmtHrs(c.consRest)}<div style="font-size:.68rem;color:#999">${e.part91?'':'Req: '+c.reqRest+'h'}</div></td>
      <td>${e.part91 ? '<span class="badge b-na">N/A</span>' : badge(c.restOk,'OK','DEFICIENT')}</td>
      <td>${e.part91 ? '<span class="badge b-na">N/A</span>' : excBadge}</td>
      <td>${e.reason||'—'}</td>
      <td style="white-space:nowrap">
        <button class="edit-btn" onclick="editEntry('${e.id}')">&#9998;</button>
        <button class="del-btn"  onclick="del('${e.id}')">&#10005;</button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>Show Time</th><th>Pilot</th><th>Crew</th><th>Route</th>
        <th>Off Blocks</th><th>On Blocks</th><th>Leg Time</th>
        <th>Rolling 24-hr</th><th>Flt OK?</th>
        <th>Duty Period</th><th>Duty OK?</th>
        <th>10-hr Lookback</th><th>Rest After</th><th>Rest OK?</th>
        <th>Exceedance</th><th>Reason</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function render() {
  renderDashboard();
  renderCards();
  renderTable();
}

// ============================================================
// EDIT MODAL
// ============================================================
let editingId = null;

function editEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  editingId = id;

  document.getElementById('m-pilot').value  = e.pilot  || '';
  document.getElementById('m-crew').value   = e.crew   || 'S';
  document.getElementById('m-reason').value = e.reason || '';
  document.getElementById('m-dep').value    = e.dep    || '';
  document.getElementById('m-arr').value    = e.arr    || '';
  document.getElementById('m-p91').checked     = !!e.part91;
  document.getElementById('m-restday').checked = !!e.restDay;

  setElDT('m-show',     e.showTime);
  setElDT('m-release',  e.releaseTime);
  setElDT('m-off',      e.offBlocks);
  setElDT('m-on',       e.onBlocks);
  setElDT('m-reststart',e.restStart);
  setElDT('m-restend',  e.restEnd);

  document.getElementById('modal-err').textContent = '';
  document.getElementById('edit-modal').classList.add('open');
}

function saveEdit() {
  const err = document.getElementById('modal-err');
  err.textContent = '';

  const isRestDay = document.getElementById('m-restday').checked;
  const off = getDT('m-off');
  const on  = getDT('m-on');

  if (!isRestDay) {
    if (!off || !on) { err.textContent = 'Off Blocks and On Blocks are required.'; return; }
    if (ms(on) <= ms(off)) { err.textContent = 'On Blocks must be after Off Blocks.'; return; }
    const show = getDT('m-show'), rel = getDT('m-release');
    if (show && rel && ms(rel) <= ms(show)) { err.textContent = 'Release Time must be after Show Time.'; return; }
  }

  const idx = entries.findIndex(x => x.id === editingId);
  if (idx === -1) return;

  entries[idx] = {
    ...entries[idx],
    pilot:       document.getElementById('m-pilot').value.trim(),
    crew:        document.getElementById('m-crew').value,
    showTime:    getDT('m-show'),
    releaseTime: getDT('m-release'),
    dep:         document.getElementById('m-dep').value.toUpperCase().trim(),
    arr:         document.getElementById('m-arr').value.toUpperCase().trim(),
    offBlocks:   off,
    onBlocks:    on,
    restStart:   getDT('m-reststart'),
    restEnd:     getDT('m-restend'),
    reason:      document.getElementById('m-reason').value.trim(),
    part91:      document.getElementById('m-p91').checked,
    restDay:     isRestDay
  };

  entries.sort((a, b) => (ms(a.onBlocks)||ms(a.showTime)||0) - (ms(b.onBlocks)||ms(b.showTime)||0));
  save(); render();
  closeModal();
  toast('Entry updated.', 'ok');
}

function closeModal(event) {
  if (event && event.target !== document.getElementById('edit-modal')) return;
  document.getElementById('edit-modal').classList.remove('open');
  editingId = null;
}

function closeReport() {
  document.getElementById('report-overlay').classList.remove('open');
  document.getElementById('report-frame').srcdoc = '';
}

// ============================================================
// ADD ENTRY
// ============================================================
function addEntry() {
  const err = document.getElementById('form-err');
  err.textContent = '';

  const isRestDay = document.getElementById('f-restday').checked;
  const pilot = document.getElementById('f-pilot').value.trim();
  const crew  = document.getElementById('f-crew').value;

  if (isRestDay) {
    const d = document.getElementById('f-show-d').value;
    if (!d) {
      err.textContent = 'Enter a date in Show Time to assign this rest day to a quarter.';
      return;
    }
    entries.push({ id: uid(), pilot, crew, showTime: `${d}T00:00`, restDay: true });
    save(); render();
    clearDT('f-show');
    document.getElementById('f-restday').checked = false;
    toast('Rest day recorded.', 'ok');
    return;
  }

  const show    = getDT('f-show');
  const release = getDT('f-release');
  if (show && release && ms(release) <= ms(show)) {
    err.textContent = 'Release Time must be after Show Time.'; return;
  }

  // Validate all legs first
  const legData = [];
  for (let pos = 0; pos < legIndices.length; pos++) {
    const idx   = legIndices[pos];
    const off   = getLegDT(idx, 'off');
    const on    = getLegDT(idx, 'on');
    const label = legIndices.length > 1 ? `Leg ${pos+1}: ` : '';
    if (!off || !on) { err.textContent = `${label}Off Blocks and On Blocks are required.`; return; }
    if (ms(on) <= ms(off)) { err.textContent = `${label}On Blocks must be after Off Blocks.`; return; }
    legData.push({
      dep:    document.getElementById(`leg-${idx}-dep`).value.toUpperCase().trim(),
      arr:    document.getElementById(`leg-${idx}-arr`).value.toUpperCase().trim(),
      off, on,
      reason: document.getElementById(`leg-${idx}-reason`).value.trim(),
      part91: document.getElementById(`leg-${idx}-p91`).checked
    });
  }

  const restStart = getDT('f-reststart');
  const restEnd   = getDT('f-restend');

  legData.forEach(leg => {
    entries.push({
      id: uid(), pilot, crew,
      showTime: show, releaseTime: release,
      dep: leg.dep, arr: leg.arr,
      offBlocks: leg.off, onBlocks: leg.on,
      restStart, restEnd,
      reason: leg.reason,
      part91:  leg.part91,
      restDay: false
    });
  });

  entries.sort((a, b) => (ms(a.onBlocks)||ms(a.showTime)||0) - (ms(b.onBlocks)||ms(b.showTime)||0));
  save(); render();

  ['f-show','f-release','f-reststart','f-restend'].forEach(clearDT);
  legIndices = [0]; nextLegIdx = 1; renderLegRows();

  const n = legData.length;
  toast(`${n} leg${n>1?'s':''} added.`, 'ok');
  setTab('log');
}

// ============================================================
// DELETE / CLEAR
// ============================================================
function del(id) {
  if (!confirm('Delete this entry?')) return;
  entries = entries.filter(e => e.id !== id);
  save(); render();
  toast('Entry deleted.', 'ok');
}

function clearAll() {
  if (!confirm('Delete ALL flight log entries? This cannot be undone.')) return;
  entries = [];
  save(); render();
  toast('All entries cleared.', 'warn');
}

// ============================================================
// EXPORT CSV
// ============================================================
function exportCSV() {
  if (!entries.length) { toast('No data to export.', 'warn'); return; }

  const hdr = [
    'Show Time','Pilot','Crew Config','Route',
    'Off Blocks','On Blocks','Leg Flight (h)','Rolling 24-hr (h)',
    'Max Allowed (h)','Flight Time OK','Duty Period (h)','Duty OK',
    '10-hr Lookback OK','Consecutive Rest (h)','Required Rest (h)',
    'Rest OK','Exceedance (h)','Exceedance Reason','Part 91','24-hr Rest Day'
  ].join(',');

  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const rows = entries.map(e => {
    const c = compute(e, entries);
    if (e.restDay) return [
      q(e.showTime),q(e.pilot),q(e.crew==='D'?'Dual':'Single'),
      '','','','','','','','','','','','','','','',q('No'),q('Yes')
    ].join(',');
    return [
      q(e.showTime), q(e.pilot), q(e.crew==='D'?'Dual':'Single'),
      q(`${(e.dep||'').toUpperCase()}-${(e.arr||'').toUpperCase()}`),
      q(e.offBlocks), q(e.onBlocks),
      q(c.legFlight!=null ? c.legFlight.toFixed(2) : ''),
      q(c.rolling24!=null ? c.rolling24.toFixed(2) : ''),
      q(c.maxFlight),
      q(c.flightOk==null?'N/A':c.flightOk?'OK':'EXCEEDED'),
      q(c.dutyPeriod!=null?c.dutyPeriod.toFixed(2):''),
      q(c.dutyOk==null?'N/A':c.dutyOk?'OK':'EXCEEDED'),
      q(c.lookbackOk==null?'N/A':c.lookbackOk?'OK':'CHECK'),
      q(c.consRest!=null?c.consRest.toFixed(2):''),
      q(c.reqRest),
      q(c.restOk==null?'N/A':c.restOk?'OK':'DEFICIENT'),
      q(c.excAmt.toFixed(2)),
      q(e.reason||''),
      q(e.part91?'Yes':'No'),
      q('No')
    ].join(',');
  });

  const csv  = [hdr, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `far135_log_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exported.', 'ok');
}

// ============================================================
// QUARTERLY REPORT
// ============================================================
function quarterlyReport() {
  const qIdx = parseInt(document.getElementById('rpt-q').value, 10);
  const year = parseInt(document.getElementById('rpt-y').value, 10);
  if (isNaN(year) || year < 2000) { toast('Enter a valid year.', 'err'); return; }

  const qStart = new Date(year, qIdx * 3, 1).getTime();
  const qEnd   = new Date(year, qIdx * 3 + 3, 1).getTime();
  const qLabel = ['Q1 (Jan–Mar)','Q2 (Apr–Jun)','Q3 (Jul–Sep)','Q4 (Oct–Dec)'][qIdx];

  const qEntries = entries.filter(e => {
    const a = ms(e.onBlocks) || ms(e.showTime);
    return a !== null && a >= qStart && a < qEnd;
  });
  if (!qEntries.length) { toast(`No entries for ${qLabel} ${year}.`, 'warn'); return; }

  const flightLegs  = qEntries.filter(e => !e.restDay);
  const part135Legs = flightLegs.filter(e => !e.part91);
  const part91Legs  = flightLegs.filter(e => e.part91);
  const restDays    = qEntries.filter(e => e.restDay).length;

  let totalFlight = 0, violations = [], exceedances = [];
  let flightFail = 0, dutyFail = 0, restFail = 0;

  flightLegs.forEach(e => {
    const c = compute(e, entries);
    totalFlight += c.legFlight || 0;
    if (e.part91) return;
    if (c.flightOk === false) { flightFail++; violations.push({ date: fmtDT(e.onBlocks), pilot: e.pilot, type: 'Flight Time Exceeded', detail: `Rolling 24-hr: ${fmtHrs(c.rolling24)} (limit ${c.maxFlight}h)` }); }
    if (c.dutyOk   === false) { dutyFail++;   violations.push({ date: fmtDT(e.showTime),  pilot: e.pilot, type: 'Duty Period Exceeded', detail: `Duty: ${fmtHrs(c.dutyPeriod)} (limit 14h)` }); }
    if (c.restOk   === false) { restFail++;   violations.push({ date: fmtDT(e.restStart), pilot: e.pilot, type: 'Rest Deficient',       detail: `Got ${fmtHrs(c.consRest)}, required ${c.reqRest}h` }); }
    if (c.excAmt > 0) exceedances.push({ date: fmtDT(e.onBlocks), pilot: e.pilot, route: `${(e.dep||'?').toUpperCase()}→${(e.arr||'?').toUpperCase()}`, over: fmtHrs(c.excAmt), reason: e.reason||'—', reqRest: c.reqRest });
  });

  const totalV  = flightFail + dutyFail + restFail;
  const restMet = restDays >= 13;
  const allOk   = totalV === 0 && restMet;
  const pilots  = [...new Set(flightLegs.map(e => e.pilot).filter(Boolean))].join(', ') || 'All Pilots';
  const generated = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const sc = (r, ok) => `<tr style="background:${ok===null?'#f8fafc':ok?'#f0fdf4':'#fef2f2'}"><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r[0]}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${ok===null?'#555':ok?'#16a34a':'#dc2626'}">${r[1]}</td></tr>`;

  const scRows = [
    sc(['Rolling 24-hr Flight Time',   flightFail===0?'PASS':`${flightFail} VIOLATION(S)`], flightFail===0),
    sc(['14-Hour Duty Day Limit',       dutyFail===0?'PASS':`${dutyFail} VIOLATION(S)`],     dutyFail===0),
    sc(['Rest Requirements',            restFail===0?'PASS':`${restFail} DEFICIENCY(IES)`],  restFail===0),
    sc(['10-hr Look-Back Rest',         'See detail rows below'],                              null),
    sc([`24-hr Rest Days (≥13/quarter)`,`${restDays} of 13 required`],                       restMet)
  ].join('');

  const vRows = violations.length
    ? violations.map(v => `<tr><td>${v.date}</td><td>${v.pilot||'—'}</td><td style="color:#dc2626;font-weight:600">${v.type}</td><td>${v.detail}</td></tr>`).join('')
    : `<tr><td colspan="4" style="color:#16a34a;padding:10px">No violations this quarter.</td></tr>`;

  const exRows = exceedances.length
    ? exceedances.map(x => `<tr><td>${x.date}</td><td>${x.pilot||'—'}</td><td>${x.route}</td><td style="color:#dc2626;font-weight:600">${x.over}</td><td>${x.reason}</td><td>${x.reqRest}h</td></tr>`).join('')
    : `<tr><td colspan="6" style="color:#16a34a;padding:10px">No exceedances this quarter.</td></tr>`;

  const sorted = [...qEntries].sort((a,b) => (ms(a.onBlocks)||ms(a.showTime)||0)-(ms(b.onBlocks)||ms(b.showTime)||0));
  const flag = f => f===null?'—':f?'✓':'⚠';
  const logRows = sorted.map(e => {
    if (e.restDay) return `<tr style="background:#f0fdf4"><td>${fmtDT(e.showTime)}</td><td>${e.pilot||'—'}</td><td colspan="12" style="color:#16a34a;font-weight:600">&#9679; 24-HOUR REST DAY</td></tr>`;
    const c = compute(e, entries);
    if (e.part91) return `<tr style="background:#fffef0"><td>${fmtDT(e.showTime)}</td><td>${e.pilot||'—'}</td><td>${e.crew==='D'?'Dual':'Single'}</td><td>${(e.dep||'—').toUpperCase()}→${(e.arr||'—').toUpperCase()}</td><td>${fmtDT(e.offBlocks)}</td><td>${fmtDT(e.onBlocks)}</td><td>${fmtHrs(c.legFlight)}</td><td colspan="7" style="color:#92400e;font-weight:600">&#9654; Part 91 — Excluded from §135.267</td></tr>`;
    return `<tr><td>${fmtDT(e.showTime)}</td><td>${e.pilot||'—'}</td><td>${e.crew==='D'?'Dual':'Single'}</td><td>${(e.dep||'—').toUpperCase()}→${(e.arr||'—').toUpperCase()}</td><td>${fmtDT(e.offBlocks)}</td><td>${fmtDT(e.onBlocks)}</td><td>${fmtHrs(c.legFlight)}</td><td style="color:${c.flightOk===false?'#dc2626':'inherit'}">${c.rolling24!=null?fmtHrs(c.rolling24):'—'}/${c.maxFlight}h</td><td>${flag(c.flightOk)}</td><td style="color:${c.dutyOk===false?'#dc2626':'inherit'}">${fmtHrs(c.dutyPeriod)}</td><td>${flag(c.dutyOk)}</td><td style="color:${c.restOk===false?'#dc2626':'inherit'}">${fmtHrs(c.consRest)}/${c.reqRest}h</td><td>${flag(c.restOk)}</td><td>${c.excAmt>0?fmtHrs(c.excAmt):'—'}</td></tr>`;
  }).join('');

  const html = buildReportHTML({ qLabel, year, pilots, generated, allOk, totalV, restMet, restDays, part135Legs, part91Legs, totalFlight, exceedances, scRows, vRows, exRows, logRows });

  const frame = document.getElementById('report-frame');
  frame.srcdoc = html;
  document.getElementById('report-overlay').classList.add('open');
}

function buildReportHTML(d) {
  const statusColor = d.allOk ? '#16a34a' : '#dc2626';
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FAR 135.267 Report — ${d.qLabel} ${d.year}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;padding:28px;font-size:13px}
h1{font-size:1.2rem;margin-bottom:4px}h2{font-size:.9rem;margin:22px 0 8px;border-bottom:2px solid #e5e7eb;padding-bottom:4px}
.meta{color:#666;font-size:.78rem;margin-bottom:18px}
.banner{padding:12px 16px;border-radius:8px;font-weight:700;font-size:.95rem;margin-bottom:18px;border:2px solid ${statusColor};color:${statusColor};background:${d.allOk?'#f0fdf4':'#fef2f2'}}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.stat{background:#f8fafc;border-radius:7px;padding:10px 14px;min-width:110px}
.stat .v{font-size:1.4rem;font-weight:700;color:#2563eb}.stat .l{font-size:.72rem;color:#888;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:8px}
th{background:#f8fafc;padding:7px 9px;text-align:left;font-weight:700;color:#555;border-bottom:2px solid #e5e7eb;white-space:nowrap}
td{padding:7px 9px;border-bottom:1px solid #f1f5f9;vertical-align:middle;white-space:nowrap}
.disclaimer{margin-top:24px;font-size:.7rem;color:#aaa;border-top:1px solid #e5e7eb;padding-top:10px;line-height:1.5}
@media print{}
</style></head><body>
<h1>FAR 135.267 Quarterly Compliance Report</h1>
<div class="meta">Period: <strong>${d.qLabel} ${d.year}</strong> &nbsp;|&nbsp; Pilot(s): <strong>${d.pilots}</strong> &nbsp;|&nbsp; Generated: ${d.generated}</div>
<div class="banner">${d.allOk?'✓':'⚠'} Overall Status: ${d.allOk?'COMPLIANT':'REVIEW REQUIRED'}${!d.allOk?` — ${d.totalV} violation(s)${!d.restMet?' and rest day shortfall':''}`:''}</div>
<div class="stats">
  <div class="stat"><div class="v">${d.part135Legs.length}</div><div class="l">Part 135 Legs${d.part91Legs.length?`<br>+${d.part91Legs.length} Part 91`:''}</div></div>
  <div class="stat"><div class="v">${fmtHrs(d.totalFlight)}</div><div class="l">Total Flight Time</div></div>
  <div class="stat"><div class="v" style="color:${d.restMet?'#16a34a':'#dc2626'}">${d.restDays}/13</div><div class="l">24-hr Rest Days</div></div>
  <div class="stat"><div class="v" style="color:${d.totalV===0?'#16a34a':'#dc2626'}">${d.totalV}</div><div class="l">Total Violations</div></div>
  <div class="stat"><div class="v" style="color:${d.exceedances.length===0?'#16a34a':'#dc2626'}">${d.exceedances.length}</div><div class="l">Exceedances</div></div>
</div>
<h2>§135.267 Compliance Scorecard</h2>
<table><thead><tr><th>Requirement</th><th>Result</th></tr></thead><tbody>${d.scRows}</tbody></table>
<h2>Violations Log</h2>
<table><thead><tr><th>Date/Time</th><th>Pilot</th><th>Type</th><th>Detail</th></tr></thead><tbody>${d.vRows}</tbody></table>
<h2>Exceedance Detail — §135.267(c) Rest Multipliers</h2>
<table><thead><tr><th>Date/Time</th><th>Pilot</th><th>Route</th><th>Over Limit</th><th>Reason</th><th>Rest Required</th></tr></thead><tbody>${d.exRows}</tbody></table>
<h2>Full Flight Log — ${d.qLabel} ${d.year}</h2>
<table><thead><tr><th>Show Time</th><th>Pilot</th><th>Crew</th><th>Route</th><th>Off Blocks</th><th>On Blocks</th><th>Leg Time</th><th>24-hr/Limit</th><th>Flt✓</th><th>Duty</th><th>Duty✓</th><th>Rest/Req</th><th>Rest✓</th><th>Exceedance</th></tr></thead><tbody>${d.logRows}</tbody></table>
<div class="disclaimer"><strong>Disclaimer:</strong> This report is generated from pilot-entered data for reference only. It does not constitute an official regulatory record. Verify all data against source documents. Compliance must be confirmed with your Director of Operations, POI, and applicable OpSpecs. 14 CFR §135.267.</div>
</body></html>`;
}

// ============================================================
// TABS (MOBILE NAV)
// ============================================================
function setTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById(`section-${name}`);
  const btn = document.querySelector(`[data-tab="${name}"]`);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  localStorage.setItem('activeTab', name);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ============================================================
// PWA INSTALL PROMPT
// ============================================================
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.hidden = false;
});

function installApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  deferredInstall.userChoice.then(r => {
    if (r.outcome === 'accepted') {
      document.getElementById('install-btn').hidden = true;
      toast('App installed!', 'ok');
    }
    deferredInstall = null;
  });
}

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('install-btn');
  if (btn) btn.hidden = true;
  toast('App installed successfully.', 'ok');
});

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// ============================================================
// INIT
// ============================================================
(function init() {
  // Default quarter/year selectors
  const now = new Date();
  document.getElementById('rpt-q').value = Math.floor(now.getMonth() / 3);
  document.getElementById('rpt-y').value = now.getFullYear();

  // Restore active tab or default to summary
  const saved = localStorage.getItem('activeTab') || 'summary';
  setTab(saved);

  // Render leg rows
  renderLegRows();

  // Initial render
  render();
})();
