// School Hub online play.
// 1) Friend rooms for games that already have online modes (Food Fight Online, Last Bell: Apocalypse co-op).
//    On claude.ai those used window.claude.use('room'); here the same API runs over WebRTC (Trystero).
// 2) "Play Online" for EVERY game: the host shares their School Hub tab as video, the friend
//    watches it live and their keys / clicks / taps are sent back and played on the host's game.
const LIB = 'https://esm.run/trystero@0.26.0';
const APP = { appId: 'ziplinetero-school-hub-v1' };
let libP = null;
const lib = () => (libP ||= import(LIB));

// ---------------------------------------------------------------- room API shim
function makeRoomApi() {
  return {
    async join(name) {
      const { joinRoom, selfId } = await lib();
      const room = joinRoom(APP, 'room-' + String(name).slice(0, 60));
      const pres = room.makeAction('pres');
      const peers = new Map(); // peerId -> presence
      let mine = null, peersCbs = [], connCbs = [], left = false;
      const list = () => [{ peer: selfId, sameTab: true, presence: mine }, ...[...peers].map(([peer, presence]) => ({ peer, sameTab: false, presence }))];
      const fire = () => { const ch = { peers: list() }; for (const cb of peersCbs) try { cb(ch); } catch (e) { console.error(e); } };
      room.onPeerJoin = id => { peers.set(id, null); if (mine != null) pres.send(mine, { target: id }).catch(() => {}); fire(); };
      room.onPeerLeave = id => { peers.delete(id); fire(); };
      pres.onMessage = (data, meta) => { const id = meta && meta.peerId !== undefined ? meta.peerId : meta; peers.set(id, data); fire(); };
      return {
        connected: () => !left,
        peers: list,
        onPeers(cb) { peersCbs.push(cb); },
        onConnection(cb) { connCbs.push(cb); setTimeout(() => cb(!left), 0); },
        async presence(state) { mine = state; if (!left) await pres.send(state).catch(() => {}); fire(); },
        async leave() { left = true; try { room.leave(); } catch {} for (const cb of connCbs) try { cb(false); } catch {} },
      };
    },
  };
}
if (!(window.claude && window.claude.use)) {
  window.claude = { use: async what => (what === 'room' ? makeRoomApi() : null) };
}

// ---------------------------------------------------------------- Play Online (all games)
// pointer capture throws for pretend pointers; make it harmless
for (const fn of ['setPointerCapture', 'releasePointerCapture']) {
  const orig = Element.prototype[fn];
  Element.prototype[fn] = function (...a) { try { return orig.apply(this, a); } catch {} };
}

const css = `
#olBtn{position:fixed;left:max(10px,env(safe-area-inset-left,0px));bottom:max(10px,env(safe-area-inset-bottom,0px));z-index:9998;font:400 13px var(--display,"Arial Black");letter-spacing:.04em;color:#2a1c05;background:#f5b82e;border:0;border-radius:8px;padding:8px 12px;box-shadow:0 4px 0 #b9811a;cursor:pointer}
#olBtn.live{background:#7fd17f;box-shadow:0 4px 0 #3f8a3f}
#olPanel{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(10,20,16,.72);font:600 15px/1.45 var(--body,system-ui);color:#eef0e6}
#olPanel[hidden],#olView[hidden]{display:none}
#olPanel .c{width:min(440px,92vw);background:#1f3a32;border:3px solid #eef0e6;border-radius:12px;padding:20px 22px;display:grid;gap:12px;box-shadow:0 10px 0 rgba(0,0,0,.35)}
#olPanel h2{margin:0;font:400 24px var(--display,"Arial Black");color:#f5b82e}
#olPanel p{margin:0;color:#b9c4b8}
#olPanel button{font:400 15px var(--display,"Arial Black");color:#2a1c05;background:#f5b82e;border:0;border-radius:6px;padding:10px 14px;box-shadow:0 4px 0 #b9811a;cursor:pointer}
#olPanel button.alt{background:#eef0e6;box-shadow:0 4px 0 #9aa}
#olPanel input{font:400 22px var(--display,"Arial Black");text-transform:uppercase;letter-spacing:.2em;width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:2px solid #eef0e6;background:#13261f;color:#eef0e6;text-align:center}
#olPanel .code{font:400 40px var(--display,"Arial Black");letter-spacing:.25em;color:#eef0e6;text-align:center;background:#13261f;border-radius:8px;padding:6px}
#olPanel .row{display:flex;gap:10px;flex-wrap:wrap}#olPanel .row>*{flex:1}
#olPanel .st{color:#7fd17f;font-weight:800}
#olPanel .err{color:#ff8a80;font-weight:800}
#olView{position:fixed;inset:0;z-index:9997;background:#000;touch-action:none}
#olView video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;cursor:crosshair}
#olView .bar{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:rgba(19,38,31,.88);color:#eef0e6;border-radius:8px;padding:6px 10px;font:700 13px var(--body,system-ui);z-index:2}
#olView .bar button{font:400 12px var(--display,"Arial Black");border:0;border-radius:5px;padding:6px 9px;cursor:pointer;background:#f5b82e;color:#2a1c05}
#olView .msg{position:absolute;inset:0;display:grid;place-items:center;color:#eef0e6;font:400 20px var(--display,"Arial Black");text-align:center;padding:20px;pointer-events:none}
#olCursor{position:fixed;z-index:9996;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid #fff;background:#e94f9b;pointer-events:none;box-shadow:0 0 0 2px #000;transition:opacity .3s}
`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };
const btn = el('button', { id: 'olBtn', type: 'button', textContent: '🌐 PLAY ONLINE' });
const panel = el('div', { id: 'olPanel', hidden: true });
const view = el('div', { id: 'olView', hidden: true });
const cursor = el('div', { id: 'olCursor' }); cursor.style.opacity = 0;
document.body.append(btn, panel, view, cursor);

let mode = 'off'; // off | host | guest
let room = null, shareStream = null, friends = new Set();
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const inviteLink = code => location.origin + location.pathname + '#join=' + code;

function card(...kids) { panel.replaceChildren(el('div', { className: 'c' }, kids)); panel.hidden = false; }
function closePanel() { panel.hidden = true; }
panel.addEventListener('pointerdown', e => { if (e.target === panel) closePanel(); });
// keep the games from reacting to typing inside the panel
for (const t of ['keydown', 'keyup']) panel.addEventListener(t, e => e.stopPropagation());

function showHome(prefill = '', error = '') {
  if (mode === 'host') return showHosting();
  const input = el('input', { maxLength: 4, placeholder: 'CODE', value: prefill, autocomplete: 'off', spellcheck: false });
  const join = el('button', { type: 'button', textContent: 'JOIN', onclick: () => startGuest(input.value) });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
  card(
    el('h2', { textContent: 'PLAY ONLINE' }),
    el('p', { textContent: 'Play any School Hub game with a friend on another computer. One of you hosts, the other joins with the code.' }),
    el('button', { type: 'button', textContent: '🎮 HOST A GAME', onclick: startHost }),
    el('p', { textContent: 'Got a code from your friend?' }),
    el('div', { className: 'row' }, [input, join]),
    error ? el('p', { className: 'err', textContent: error }) : '',
    el('button', { type: 'button', className: 'alt', textContent: 'CLOSE', onclick: closePanel }),
  );
  if (!prefill) setTimeout(() => input.focus(), 50);
}
btn.onclick = () => (mode === 'guest' ? null : showHome());

// ---------------- host
let hostCode = '';
function showHosting(status) {
  const copy = el('button', { type: 'button', className: 'alt', textContent: '📋 COPY INVITE LINK' });
  copy.onclick = async () => { try { await navigator.clipboard.writeText(inviteLink(hostCode)); copy.textContent = '✅ COPIED!'; } catch { copy.textContent = inviteLink(hostCode); } };
  const n = friends.size;
  card(
    el('h2', { textContent: 'YOU ARE HOSTING' }),
    el('p', { textContent: 'Tell your friend this code (or send the invite link):' }),
    el('div', { className: 'code', textContent: hostCode }),
    copy,
    el('p', { className: 'st', textContent: status || (n ? `✅ ${n === 1 ? 'Your friend is' : n + ' friends are'} connected!` : '⏳ Waiting for your friend to join…') }),
    el('p', { textContent: 'Pick any game. For 2-player games choose 2 PLAYERS: you are Player 1, your friend is Player 2. Keep this tab open and in front.' }),
    el('div', { className: 'row' }, [
      el('button', { type: 'button', textContent: 'PLAY!', onclick: closePanel }),
      el('button', { type: 'button', className: 'alt', textContent: 'STOP HOSTING', onclick: stopAll }),
    ]),
  );
}

async function startHost() {
  card(el('h2', { textContent: 'SHARE YOUR SCREEN' }), el('p', { textContent: 'Chrome will ask to share this tab so your friend can see the game. Pick this tab and click Share.' }));
  try {
    shareStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 30 } }, audio: true,
      preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude',
    });
  } catch (e) {
    return showHome('', 'Screen share was cancelled. Click HOST A GAME and choose Share to host.');
  }
  for (const t of shareStream.getVideoTracks()) { t.contentHint = 'motion'; t.onended = stopAll; }
  try {
    const { joinRoom } = await lib();
    hostCode = newCode(); mode = 'host'; friends = new Set();
    room = joinRoom(APP, 'play-' + hostCode);
    wireHost(room);
    btn.textContent = '🌐 HOSTING · ' + hostCode; btn.classList.add('live');
    showHosting();
  } catch (e) {
    console.error(e); stopAll(); showHome('', 'Could not connect to the internet service. Check your connection and try again.');
  }
}

function wireHost(r) {
  const input = r.makeAction('in');
  const hello = r.makeAction('hello');
  r.onPeerJoin = id => {
    friends.add(id); r.addStream(shareStream, { target: id });
    hello.send({ host: true }, { target: id }).catch(() => {});
    btn.textContent = `🌐 HOSTING · ${hostCode} · ${friends.size}👤`;
    if (!panel.hidden) showHosting();
    toast('✅ Your friend joined! They are Player 2.');
  };
  r.onPeerLeave = id => {
    friends.delete(id); releaseAll(id);
    btn.textContent = `🌐 HOSTING · ${hostCode}` + (friends.size ? ` · ${friends.size}👤` : '');
    if (!panel.hidden) showHosting();
    toast('👋 Your friend left.');
  };
  input.onMessage = (m, meta) => { const id = meta && meta.peerId !== undefined ? meta.peerId : meta; play(m, id); };
}

// replay the friend's input on this page
const held = new Map(); // peerId -> Set(codes)
const ptr = new Map(); // peerId -> {target, x, y, sx, sy, down}
function keyEvt(type, code, key) {
  const target = document.activeElement && document.activeElement !== document.body && !panel.contains(document.activeElement) ? document.activeElement : document.body;
  target.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true, composed: true }));
}
function releaseAll(id) {
  for (const c of held.get(id) || []) keyEvt('keyup', c, keyName(c));
  held.delete(id);
  const p = ptr.get(id); if (p && p.down) ptrEvt('pointerup', p.target, p.x, p.y, 0, p.pt);
  ptr.delete(id); cursor.style.opacity = 0;
}
function keyName(code) {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  return { Space: ' ', Enter: 'Enter', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ShiftLeft: 'Shift', ShiftRight: 'Shift', Slash: '/' }[code] || code;
}
function ptrEvt(type, target, x, y, buttons, pt) {
  if (!target) return;
  const o = { clientX: x, clientY: y, pointerId: 77, pointerType: pt || 'mouse', isPrimary: true, button: 0, buttons, bubbles: true, cancelable: true, composed: true, view: window };
  target.dispatchEvent(new PointerEvent(type, o));
}
function under(x, y) {
  cursor.style.display = 'none'; const t = document.elementFromPoint(x, y); cursor.style.display = '';
  return t && !view.contains(t) && !btn.contains(t) ? t : null;
}
let cursorT = 0;
function play(m, id) {
  if (mode !== 'host' || !m) return;
  if (m.k) { // keys
    const s = held.get(id) || new Set(); held.set(id, s);
    if (m.k === 'd') { s.add(m.c); keyEvt('keydown', m.c, m.key || keyName(m.c)); } else { s.delete(m.c); keyEvt('keyup', m.c, m.key || keyName(m.c)); }
    return;
  }
  if (m.p) { // pointer, x/y are 0..1 of the shared screen
    const x = m.x * innerWidth, y = m.y * innerHeight;
    let p = ptr.get(id); if (!p) { p = { down: false }; ptr.set(id, p); }
    p.pt = m.pt;
    cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; cursor.style.opacity = 1;
    clearTimeout(cursorT); cursorT = setTimeout(() => (cursor.style.opacity = 0), 2500);
    if (m.p === 'd') {
      const t = under(x, y); p.target = t; p.down = true; p.sx = x; p.sy = y; p.x = x; p.y = y;
      if (t && t.focus && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) { try { t.focus({ preventScroll: true }); } catch {} }
      ptrEvt('pointerdown', t, x, y, 1, m.pt);
    } else if (m.p === 'm') {
      p.x = x; p.y = y; ptrEvt('pointermove', p.down ? p.target : under(x, y), x, y, p.down ? 1 : 0, m.pt);
    } else if (m.p === 'u') {
      p.x = x; p.y = y; const t0 = p.target; p.down = false;
      ptrEvt('pointerup', t0, x, y, 0, m.pt);
      const t1 = under(x, y);
      if (t0 && t1 && (t0 === t1 || t0.contains(t1) || t1.contains(t0)) && Math.hypot(x - p.sx, y - p.sy) < 14) {
        const clickT = t0.contains(t1) ? t1 : t0;
        if (clickT.tagName === 'SELECT') cycleSelect(clickT);
        else clickT.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, view: window }));
      }
    }
  }
}
// a dropdown can't open from a pretend click, so each click picks the next option
function cycleSelect(s) {
  if (!s.options.length) return;
  s.selectedIndex = (s.selectedIndex + 1) % s.options.length;
  s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------------- guest
let keyMode = 'p2';
const P2 = { KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight', KeyF: 'Enter', Space: 'Enter', ShiftLeft: 'ShiftRight' };
let sendIn = null, video = null, guestHeld = new Set();

async function startGuest(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length !== 4) return showHome(code, 'The code has 4 letters/numbers.');
  card(el('h2', { textContent: 'JOINING ' + code + '…' }), el('p', { textContent: 'Looking for your friend. This can take up to 20 seconds.' }));
  let r;
  try { const { joinRoom } = await lib(); r = joinRoom(APP, 'play-' + code); }
  catch (e) { console.error(e); return showHome(code, 'Could not connect to the internet service. Check your connection and try again.'); }
  room = r; mode = 'guest';
  sendIn = r.makeAction('in');
  const hello = r.makeAction('hello');
  let hostId = null, gotVideo = false;
  const giveUp = setTimeout(() => { if (!hostId && mode === 'guest') { stopAll(); showHome(code, 'No game found with code ' + code + '. Check the code, and make sure your friend is still hosting.'); } }, 25000);
  hello.onMessage = (m, meta) => { hostId = meta && meta.peerId !== undefined ? meta.peerId : meta; clearTimeout(giveUp); };
  r.onPeerJoin = () => { clearTimeout(giveUp); if (!gotVideo) setMsg('Connected! Waiting for the game picture…'); };
  r.onPeerStream = stream => { gotVideo = true; clearTimeout(giveUp); video.srcObject = stream; video.play().catch(() => { video.muted = true; video.play().catch(() => {}); setMsg('Click to turn on sound'); }); setMsg(''); };
  r.onPeerLeave = id => { if (id === hostId || !Object.keys(r.getPeers ? r.getPeers() : {}).length) { setMsg('Your friend stopped hosting.'); } };
  openView(code);
  closePanel();
  setMsg('Looking for your friend…');
}

let msgEl = null;
function setMsg(t) { if (msgEl) { msgEl.textContent = t; msgEl.style.display = t ? '' : 'none'; } }
function openView(code) {
  video = el('video', { autoplay: true, playsInline: true });
  msgEl = el('div', { className: 'msg' });
  const keysBtn = el('button', { type: 'button' });
  const showKeys = () => { keysBtn.textContent = keyMode === 'p2' ? 'KEYS: PLAYER 2' : 'KEYS: SAME AS HOST'; keysBtn.title = keyMode === 'p2' ? 'WASD and arrows move Player 2, Space/F = Enter' : 'Your keys go to the game exactly as you press them'; };
  keysBtn.onclick = () => { keyMode = keyMode === 'p2' ? 'same' : 'p2'; showKeys(); keysBtn.blur(); };
  showKeys();
  const full = el('button', { type: 'button', textContent: '⛶ FULL', onclick: e => { e.currentTarget.blur(); document.fullscreenElement ? document.exitFullscreen() : view.requestFullscreen().catch(() => {}); } });
  const leave = el('button', { type: 'button', textContent: '✕ LEAVE', onclick: () => stopAll() });
  view.replaceChildren(video, msgEl, el('div', { className: 'bar' }, [el('span', { textContent: '🌐 ' + code }), keysBtn, full, leave]));
  view.hidden = false; btn.hidden = true;
  video.addEventListener('click', () => { if (video.muted) { video.muted = false; video.play().catch(() => {}); setMsg(''); } });
  // pointer → normalized position on the friend's screen
  const pos = e => {
    const r = video.getBoundingClientRect(), vw = video.videoWidth || 16, vh = video.videoHeight || 9;
    const s = Math.min(r.width / vw, r.height / vh), w = vw * s, h = vh * s, ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
    return { x: Math.min(1, Math.max(0, (e.clientX - ox) / w)), y: Math.min(1, Math.max(0, (e.clientY - oy) / h)) };
  };
  let lastMove = 0, isDown = false;
  video.addEventListener('pointerdown', e => { e.preventDefault(); isDown = true; try { video.setPointerCapture(e.pointerId); } catch {} send({ p: 'd', ...pos(e), pt: e.pointerType }); });
  video.addEventListener('pointermove', e => { const now = performance.now(); if (now - lastMove < (isDown ? 16 : 50)) return; lastMove = now; send({ p: 'm', ...pos(e), pt: e.pointerType }); });
  video.addEventListener('pointerup', e => { isDown = false; send({ p: 'u', ...pos(e), pt: e.pointerType }); });
  video.addEventListener('pointercancel', e => { if (isDown) { isDown = false; send({ p: 'u', ...pos(e), pt: e.pointerType }); } });
  video.addEventListener('contextmenu', e => e.preventDefault());
}
function send(m) { if (mode === 'guest' && sendIn) sendIn.send(m).catch(() => {}); }
const mapKey = code => (keyMode === 'p2' && P2[code]) || code;
// while watching a friend's game, our keys go to them, not to the games on this page
addEventListener('keydown', e => {
  if (mode !== 'guest') return;
  e.stopImmediatePropagation();
  if (e.code === 'F11') return;
  e.preventDefault();
  if (e.repeat) return;
  const c = mapKey(e.code); guestHeld.add(c); send({ k: 'd', c, key: c === e.code ? e.key : keyName(c) });
}, true);
addEventListener('keyup', e => {
  if (mode !== 'guest') return;
  e.stopImmediatePropagation(); e.preventDefault();
  const c = mapKey(e.code); guestHeld.delete(c); send({ k: 'u', c, key: c === e.code ? e.key : keyName(c) });
}, true);
addEventListener('blur', () => { if (mode === 'guest') { for (const c of guestHeld) send({ k: 'u', c }); guestHeld.clear(); } });

// ---------------- shared
function stopAll() {
  if (mode === 'guest') { for (const c of guestHeld) send({ k: 'u', c }); guestHeld.clear(); }
  if (mode === 'host') for (const id of [...held.keys(), ...ptr.keys()]) releaseAll(id);
  const r = room; room = null; mode = 'off'; friends = new Set();
  setTimeout(() => { try { r && r.leave(); } catch {} }, 150);
  if (shareStream) { for (const t of shareStream.getTracks()) t.stop(); shareStream = null; }
  if (video) { video.srcObject = null; video = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  view.hidden = true; view.replaceChildren(); btn.hidden = false;
  btn.textContent = '🌐 PLAY ONLINE'; btn.classList.remove('live'); closePanel();
}
let toastEl = null, toastT = 0;
function toast(t) {
  if (!toastEl) { toastEl = el('div'); Object.assign(toastEl.style, { position: 'fixed', left: '50%', bottom: '60px', transform: 'translateX(-50%)', zIndex: 9999, background: 'rgba(19,38,31,.92)', color: '#eef0e6', font: '800 15px var(--body,system-ui)', padding: '10px 16px', borderRadius: '8px', border: '2px solid #7fd17f', pointerEvents: 'none' }); document.body.append(toastEl); }
  toastEl.textContent = t; toastEl.style.display = ''; clearTimeout(toastT); toastT = setTimeout(() => (toastEl.style.display = 'none'), 4000);
}
addEventListener('beforeunload', () => { try { room && room.leave(); } catch {} });

// invite links: ...#join=CODE
const m = location.hash.match(/join=([A-Za-z0-9]{4})/);
if (m) { history.replaceState(null, '', location.pathname + location.search); showHome(m[1].toUpperCase()); }
lib().catch(() => {}); // start loading early
