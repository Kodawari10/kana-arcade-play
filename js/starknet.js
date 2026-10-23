/* Kana Arcade: optional Starknet layer for the 🏅 badge book.
 * Connect via Cartridge (StarkZap: social/passkey, sponsored fees) or a browser extension wallet
 * (Ready, Braavos… via get-starknet-core). Both vendor bundles are local and lazy-loaded on Connect.
 * Without a wallet (or offline) nothing here touches the network and the game is unaffected.
 * Follows the starkzap-sdk skill from keep-starknet-strange/starknet-agentic:
 *   onboard (Cartridge, scoped policies) → ensureReady(if_needed) → preflight → execute → watch/wait,
 *   with errors classified into the skill's error classes and a paymaster → user_pays fallback. */
(function () {
  'use strict';
  const C = Object.assign({}, window.KA_STARKNET_CONFIG || {}, window.KA_STARKNET_CONFIG_OVERRIDE || {});
  const BOOK = window.KA_BOOK, B = window.KA_BADGES, SEL = window.KA_SELECTORS, EV = window.KA_EVENTS || {};
  if (!C.enabled || !BOOK || !B || !SEL) return;
  const KEY = 'kanaArcade.chain';
  const $ = id => document.getElementById(id);
  const box = $('chainBox');
  let wallet = null, address = null, walletKind = null, chainOk = true, busy = false;
  let feeMode = (C.cartridge && C.cartridge.feeMode) || { type: 'paymaster' }, feeFallbackUsed = false;
  let cs = loadCs();
  const minted = new Set(cs.address ? cs.minted || [] : []);
  const configured = /^0x[0-9a-fA-F]{1,64}$/.test(C.contractAddress || '');
  const cartridgeOn = !!(C.cartridge && C.cartridge.enabled !== false);
  let view = 'home'; // 'home' | 'picker'
  let statusHtml = '', board = '', lastError = null;

  function loadCs() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveCs() { cs.minted = [...minted]; try { localStorage.setItem(KEY, JSON.stringify(cs)); } catch (e) { /* ignore */ } }
  const short = a => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
  const hex = n => '0x' + BigInt(n).toString(16);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalize = a => '0x' + BigInt(a).toString(16).padStart(64, '0');
  // Always call Argent X "Ready" in the UI (detection still uses the injected id/name).
  function displayWalletName(w) {
    const id = String((w && w.id) || '').toLowerCase(), name = String((w && w.name) || '');
    if (/argent|ready/i.test(id) || /argent/i.test(name)) return 'Ready';
    return name || (w && w.id) || 'Wallet';
  }

  // ---------- vendor loaders (lazy) ----------
  let gsnP = null, szP = null;
  function loadScript(src, global, ok) {
    return new Promise((res, rej) => {
      if (ok(window[global])) return res(window[global]);
      const s = document.createElement('script'); s.src = src;
      s.onload = () => ok(window[global]) ? res(window[global]) : rej(new Error(global + ' failed to load'));
      s.onerror = () => rej(new Error(global + ' failed to load'));
      document.head.appendChild(s);
    });
  }
  function loadGsn() { return gsnP || (gsnP = loadScript('js/vendor/get-starknet-core.js', 'KA_GSN', g => !!g).catch(e => { gsnP = null; throw e; })); }
  function loadStarkzap() { return szP || (szP = loadScript('js/vendor/starkzap.js', 'KA_STARKZAP', g => !!(g && g.connect)).catch(e => { szP = null; throw e; })); }
  function walletWindow() { const o = {}; Object.getOwnPropertyNames(window).forEach(k => { if (k.startsWith('starknet')) o[k] = window[k]; }); return o; }
  async function gsn() { const lib = await loadGsn(); return lib.getStarknet({ windowObject: walletWindow() }); }
  const iconSrc = w => { const i = w && w.icon; if (!i) return ''; return typeof i === 'string' ? i : (i.light || i.dark || ''); };
  const cartridgePolicies = () => configured ? ((C.cartridge && C.cartridge.methods) || ['claim', 'claim_batch']).map(method => ({ target: C.contractAddress, method })) : [];

  // ---------- errors (starkzap-sdk skill: classify, then recover) ----------
  const ERR = {
    USER_CANCELLED: { msg: 'Cancelled, no worries ♡', recovery: 'none' },
    VALIDATION_ERROR: { msg: 'Something in the badge request looks off. Please reload and try again.', recovery: 'fix_input' },
    UNDEPLOYED_ACCOUNT: { msg: 'Your Starknet account isn’t set up yet. Setting it up first…', recovery: 'ensure_ready' },
    RPC_OR_NETWORK: { msg: 'Starknet is hard to reach right now. Please try again in a moment.', recovery: 'retry_backoff' },
    RATE_LIMIT_OR_TIMEOUT: { msg: 'Starknet is busy right now. Please try again in a minute.', recovery: 'retry_backoff' },
    TX_REVERTED: { msg: 'Starknet said no to this stamp', recovery: 'check_preflight' },
    AUTH_OR_PERMISSION: { msg: 'Your wallet didn’t allow this. Please reconnect and try again.', recovery: 'reconnect' },
    SPONSORSHIP_UNAVAILABLE: { msg: 'Free stamping isn’t available right now.', recovery: 'user_pays' },
    CHAIN_MISMATCH: { msg: `Wrong network. Kana Arcade badges use ${C.networkName || C.network}.`, recovery: 'switch_network' },
    POPUP_BLOCKED: { msg: 'Cartridge needs a popup. Please allow popups for this site ♡', recovery: 'allow_popup' },
    INSUFFICIENT_FUNDS: { msg: `Your wallet needs a little ${C.faucetUrl ? 'test ' : ''}STRK to pay the stamp fee.`, recovery: 'top_up' },
    UNKNOWN: { msg: 'Something went wrong', recovery: 'none' },
  };
  function classifyError(err) {
    if (err && err.code && ERR[err.code]) return Object.assign({ code: err.code, detail: err.message || '' }, ERR[err.code]);
    const m = err && err.message ? err.message : String(err || '');
    let code = 'UNKNOWN';
    if (/reject|cancel|abort(ed)? by user|denied by user|user (closed|dismissed)|closed the (popup|window)/i.test(m)) code = 'USER_CANCELLED';
    else if (/popup.*block|blocked.*popup/i.test(m)) code = 'POPUP_BLOCKED';
    else if (/insufficient (max.?fee|balance|funds|account balance|fee token)|balance is (smaller|lower|less) than|exceeds? (the )?(account |fee token )?balance|u256_sub overflow|not enough (funds|balance|STRK|ETH)/i.test(m)) code = 'INSUFFICIENT_FUNDS';
    else if (/not deployed|undeployed|contract not found.*account/i.test(m)) code = 'UNDEPLOYED_ACCOUNT';
    else if (/SNIP-9|not compatible with SNIP|paymaster|sponsor|gasless|outside.?execution/i.test(m)) code = 'SPONSORSHIP_UNAVAILABLE';
    else if (/chain.?id|chain mismatch|wrong network|network mismatch/i.test(m)) code = 'CHAIN_MISMATCH';
    else if (/\b429\b|rate.?limit|too many requests|timed? ?out|timeout/i.test(m)) code = 'RATE_LIMIT_OR_TIMEOUT';
    else if (/revert|preflight|execution failed|KA: /i.test(m)) code = 'TX_REVERTED';
    else if (/\b40[13]\b|unauthori[sz]ed|forbidden|signature|permission|policy|not allowed/i.test(m)) code = 'AUTH_OR_PERMISSION';
    else if (/failed to fetch|network ?error|fetch|ECONN|\b5\d\d\b|RPC/i.test(m)) code = 'RPC_OR_NETWORK';
    else if (/invalid|malformed|amount|decimals/i.test(m)) code = 'VALIDATION_ERROR';
    return Object.assign({ code, detail: m }, ERR[code]);
  }
  function codedError(code, detail) { const e = new Error(detail || ERR[code].msg); e.code = code; return e; }
  function friendly(err) {
    const k = classifyError(err);
    if (k.code === 'TX_REVERTED' || k.code === 'UNKNOWN') {
      const why = String(k.detail || '').replace(/^.*?(KA: [^"\\\n]+).*$/s, '$1').slice(0, 120);
      return `${k.msg}${why ? ': ' + esc(why) : ''}`;
    }
    return esc(k.msg);
  }

  // Out of test STRK? A cute link to the free Sepolia faucet (only when faucetUrl is an https link)
  function faucetLink() {
    if (!C.faucetUrl || !/^https:\/\//.test(C.faucetUrl)) return '';
    return `<a class="faucet-link" href="${esc(C.faucetUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Get free test STRK from the Starknet faucet (opens in a new tab)">🚰 Get free test STRK ↗</a>`;
  }

  // ---------- RPC (read-only views): 8s timeout, retry only transient failures with backoff ----------
  const sleepMs = ms => new Promise(r => setTimeout(r, ms));
  async function rpcOnce(method, params, timeoutMs) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let r;
    try { r = await fetch(C.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }), signal: ctl ? ctl.signal : undefined }); }
    catch (e) { throw codedError(e && e.name === 'AbortError' ? 'RATE_LIMIT_OR_TIMEOUT' : 'RPC_OR_NETWORK', e && e.name === 'AbortError' ? 'RPC timed out' : 'RPC network error'); }
    finally { if (timer) clearTimeout(timer); }
    if (r.status === 429) throw codedError('RATE_LIMIT_OR_TIMEOUT', 'RPC rate limited (429)');
    if (r.status >= 500) throw codedError('RPC_OR_NETWORK', 'RPC error ' + r.status);
    const j = await r.json(); if (j.error) { const e = new Error(j.error.message || 'RPC error'); e.rpc = true; throw e; } return j.result;
  }
  async function rpc(method, params, opt) {
    const tries = (opt && opt.tries) || 3, timeoutMs = (opt && opt.timeoutMs) || 8000;
    for (let i = 0; ; i++) {
      try { return await rpcOnce(method, params, timeoutMs); } catch (e) {
        const transient = !e.rpc && (e.code === 'RPC_OR_NETWORK' || e.code === 'RATE_LIMIT_OR_TIMEOUT');
        if (!transient || i >= tries - 1) throw e;
        await sleepMs(500 * Math.pow(2, i) + Math.floor(Math.random() * 250));
      }
    }
  }
  let rpcChainP = null;
  function checkRpcChain() { // the RPC must serve the configured chain (checked once per session)
    if (!rpcChainP) rpcChainP = rpc('starknet_chainId', [], { tries: 2 })
      .then(id => !id || !C.chainId || BigInt(id) === BigInt(C.chainId))
      .catch(e => { rpcChainP = null; return e && e.rpc ? true : null; });
    return rpcChainP;
  }
  const call = (fn, calldata) => rpc('starknet_call', { request: { contract_address: C.contractAddress, entry_point_selector: SEL[fn], calldata: calldata || [] }, block_id: 'latest' });
  async function waitTx(hash) {
    for (let i = 0; i < 90; i++) {
      try {
        const r = await rpc('starknet_getTransactionReceipt', { transaction_hash: hash }, { tries: 1 });
        if (r && r.execution_status === 'REVERTED') throw new Error('Transaction reverted: ' + (r.revert_reason || '').slice(0, 140));
        if (r && r.execution_status === 'SUCCEEDED') return r;
      } catch (e) { if (/reverted/.test(e.message)) throw e; }
      await sleepMs(i < 5 ? 1500 : 3000);
    }
    throw codedError('RATE_LIMIT_OR_TIMEOUT', 'Timed out waiting for the transaction (it may still land: check the explorer link)');
  }

  // ---------- connect ----------
  const STEP_ORDER = ['CONNECTED', 'CHECK_DEPLOYED', 'DEPLOYING', 'READY'];
  function showStep(step) {
    const ol = $('cartSteps'); if (!ol || !step) return;
    ol.hidden = false; ol.classList.toggle('failed', step === 'FAILED');
    const at = STEP_ORDER.indexOf(step);
    ol.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('done', (at >= 0 && i < at) || step === 'READY'); li.classList.toggle('now', i === at && step !== 'READY'); });
  }
  // Wallet picker: always lists Cartridge, Ready and Braavos (each with a one-line description).
  // It renders into the badge book (#chainBox) or into the home 🔗 Connect wallet sheet (#walletBox).
  let host = box;
  const KNOWN = [
    { key: 'ready', name: 'Ready', ico: 'R', desc: 'Browser extension wallet (formerly Argent X)', match: w => displayWalletName(w) === 'Ready', install: 'https://www.ready.co/' },
    { key: 'braavos', name: 'Braavos', ico: 'B', desc: 'Browser extension or mobile wallet', match: w => /braavos/i.test(String(w && w.id) + ' ' + String(w && w.name)), install: 'https://braavos.app/' },
  ];
  const sheetOpen = () => { const w = $('walletScreen'); return !!w && !w.classList.contains('hidden'); };
  async function renderPicker(target) {
    host = target && target.nodeType === 1 ? target : box;
    view = 'picker';
    const head = host === box ? `<h3>Connect a Starknet wallet <small>(${esc(C.networkName || C.network)})</small></h3>` : '';
    host.innerHTML = `${head}<p class="muted">Looking for wallets…</p>`;
    let list = [];
    try { list = await (await gsn()).getAvailableWallets(); } catch (e) { /* extensions are optional */ }
    if (view !== 'picker') return;
    const parts = [head];
    if (cartridgeOn) {
      parts.push(`<button type="button" class="wopt cart" id="optCartridge" data-wallet="cartridge"><span class="wico cartIco">✦</span><span><b>Cartridge</b><small>Sign in with a passkey or social login · no extension, works on phones · free stamps when sponsored</small></span></button>
        <p class="muted small">🔒 The game session can only <b>claim Kana Arcade badges</b>${configured ? '' : ' (once the contract is live)'}. It can’t move tokens.</p>
        <ol class="steps" id="cartSteps" hidden aria-live="polite"><li>Sign in</li><li>Check account</li><li>Set up</li><li>Ready ✦</li></ol>`);
    }
    const used = new Set();
    KNOWN.forEach(k => {
      const i = list.findIndex((w, j) => !used.has(j) && k.match(w));
      if (i >= 0) {
        used.add(i); const w = list[i];
        parts.push(`<button type="button" class="wopt" data-ext="${i}" data-wallet="${k.key}">${iconSrc(w) ? `<img src="${esc(iconSrc(w))}" alt="" width="28" height="28">` : `<span class="wico ${k.key}">${k.ico}</span>`}<span><b>${esc(k.name)}</b><small>${esc(k.desc)}</small></span><span class="wtag">Detected</span></button>`);
      } else {
        parts.push(`<a class="wopt notInstalled" data-wallet="${k.key}" href="${esc(k.install)}" target="_blank" rel="noopener noreferrer"><span class="wico ${k.key}">${k.ico}</span><span><b>${esc(k.name)}</b><small>${esc(k.desc)} · not found in this browser</small></span><span class="wtag">Get it ↗<span class="srOnly"> (opens in a new tab)</span></span></a>`);
      }
    });
    list.forEach((w, i) => { if (!used.has(i)) parts.push(`<button type="button" class="wopt" data-ext="${i}">${iconSrc(w) ? `<img src="${esc(iconSrc(w))}" alt="" width="28" height="28">` : '<span class="wico">✦</span>'}<span><b>${esc(displayWalletName(w))}</b><small>Starknet browser wallet</small></span><span class="wtag">Detected</span></button>`); });
    if (!list.length) parts.push(`<p class="muted small">No browser wallet found${cartridgeOn ? ': Cartridge works without one' : ''}. On a phone, you can also open this page inside the Ready or Braavos app’s browser.</p>`);
    parts.push('<button type="button" class="alt small" id="pickBack">Keep playing without a wallet ♡</button>');
    host.innerHTML = parts.join('');
    const cb = host.querySelector('#optCartridge'); if (cb) cb.onclick = connectCartridge;
    host.querySelectorAll('[data-ext]').forEach(b => { b.onclick = () => connectExtension(list[Number(b.dataset.ext)]); });
    host.querySelector('#pickBack').onclick = () => { view = 'home'; if (host !== box) closeSheet(); else render(); };
  }

  // ---------- 🔗 home screen: Connect wallet button / connected chip ----------
  const homeWrap = $('homeWallet'), sheet = $('walletScreen');
  let sheetFrom = null;
  function openSheet() {
    if (!sheet) return;
    sheetFrom = document.activeElement; sheet.classList.remove('hidden');
    $('walletClose').focus();
    renderPicker($('walletBox')).then(() => { if (!sheetOpen()) return; const f = $('optCartridge') || sheet.querySelector('.wopt') || $('walletClose'); if (f) f.focus(); });
  }
  function closeSheet() {
    if (!sheet || sheet.classList.contains('hidden')) return;
    sheet.classList.add('hidden'); host = box; if (view === 'picker') view = 'home';
    const w = $('walletBox'); if (w) w.innerHTML = '';
    const back = sheetFrom && sheetFrom.offsetParent ? sheetFrom : (address ? $('homeDisc') : $('homeConnect')); if (back) back.focus();
  }
  function updateHome() {
    if (!homeWrap) return;
    homeWrap.classList.remove('hidden');
    const on = !!address;
    $('homeConnect').classList.toggle('hidden', on); $('homeWalletOn').classList.toggle('hidden', !on);
    if (on) {
      $('homeAddr').textContent = short(address);
      $('homeWalletKind').textContent = walletKind === 'cartridge' ? 'Cartridge' : (walletLabel || 'Wallet');
      $('homeAddrChip').setAttribute('aria-label', 'Connected with ' + $('homeWalletKind').textContent + ': ' + short(address) + (chainOk ? '' : ', wrong network'));
      $('homeAddrChip').classList.toggle('bad', !chainOk);
    }
  }
  let walletLabel = '';
  if (homeWrap) {
    $('homeConnect').addEventListener('click', openSheet);
    $('homeDisc').addEventListener('click', () => disconnect());
    $('walletClose').addEventListener('click', closeSheet);
    sheet.addEventListener('click', ev => { if (ev.target === sheet) closeSheet(); });
    window.addEventListener('keydown', ev => {
      if (!sheetOpen() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); closeSheet(); return; }
      if (ev.key === 'Enter' || ev.key === ' ') { ev.stopImmediatePropagation(); return; }
      if (ev.key === 'Tab') {
        const f = [$('walletClose'), ...sheet.querySelectorAll('.wopt, #pickBack')].filter(e => e && e.offsetParent !== null), i = f.indexOf(document.activeElement);
        ev.preventDefault(); ev.stopImmediatePropagation(); f[(i + (ev.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
      } else ev.stopImmediatePropagation(); // the game's title shortcuts stay quiet while the sheet is open
    }, true);
    updateHome();
  }

  async function connectCartridge() {
    const b = $('optCartridge'); if (b) b.disabled = true;
    try {
      const sz = await loadStarkzap(), cart = C.cartridge || {};
      const connected = await sz.connect({
        network: C.network || 'sepolia', rpcUrl: C.rpcUrl, allowInsecureHttp: !!C.allowInsecureHttp,
        paymaster: cart.paymaster, policies: cartridgePolicies(), preset: cart.preset, url: cart.url,
        feeMode: cart.feeMode || { type: 'paymaster' }, deploy: cart.deploy || 'if_needed', onProgress: showStep,
      });
      showStep('READY');
      feeMode = cart.feeMode || { type: 'paymaster' }; feeFallbackUsed = false;
      wallet = connected; walletKind = 'cartridge'; address = normalize(connected.address);
      chainOk = (await checkRpcChain()) !== false;
      if (cs.address !== address) minted.clear();
      cs.walletId = 'cartridge'; cs.address = address; saveCs();
      let who = short(address); try { const u = await connected.username(); if (u) who = u; } catch (e) { /* optional */ }
      view = 'home'; closeSheet(); BOOK.toast(`Connected with Cartridge ✦ ${who}`); BOOK.say(`Yay, we're connected, ${who}! ✦`);
      await sync(true);
    } catch (e) {
      const k = classifyError(e); showStep('FAILED');
      BOOK.toast(k.code === 'USER_CANCELLED' ? 'Cartridge sign-in cancelled, no worries ♡' : (k.code === 'POPUP_BLOCKED' || /popup/i.test(k.detail)) ? ERR.POPUP_BLOCKED.msg : 'Cartridge connection failed: ' + k.msg);
    } finally { const b2 = $('optCartridge'); if (b2) b2.disabled = false; }
  }

  async function connectExtension(w, silent) {
    try {
      const g = await gsn();
      const sw = await g.enable(w, silent ? { silent_mode: true } : undefined);
      const accts = await sw.request({ type: 'wallet_requestAccounts', params: silent ? { silent_mode: true } : {} });
      if (!accts || !accts.length) throw new Error('No account was shared');
      wallet = sw; walletKind = 'extension'; address = normalize(accts[0]);
      let chainId = null; try { chainId = await sw.request({ type: 'wallet_requestChainId' }); } catch (e) { /* older wallets */ }
      chainOk = !chainId || BigInt(chainId) === BigInt(C.chainId);
      if (!chainOk && !silent) { try { await sw.request({ type: 'wallet_switchStarknetChain', params: { chainId: C.chainId } }); chainOk = true; } catch (e) { /* user said no */ } }
      if (cs.address !== address) minted.clear();
      cs.walletId = w.id; cs.address = address; saveCs();
      try {
        sw.on && sw.on('accountsChanged', a => { if (a && a[0]) { address = normalize(a[0]); cs.address = address; minted.clear(); saveCs(); sync(); } else disconnect(); });
        sw.on && sw.on('networkChanged', c => { chainOk = !c || BigInt(c) === BigInt(C.chainId); render(); });
      } catch (e) { /* optional */ }
      view = 'home'; walletLabel = displayWalletName(w); closeSheet();
      if (!silent) { BOOK.toast(chainOk ? `Connected ${displayWalletName(w)} ✦ ${short(address)}` : `Connected, but please switch your wallet to ${C.networkName}`); BOOK.say("Connected! Now your badges can be stamped on Starknet ✦"); }
      await sync(!silent);
      return true;
    } catch (e) {
      if (!silent) { const k = classifyError(e); BOOK.toast(k.code === 'USER_CANCELLED' ? 'Wallet connection cancelled, no worries ♡' : 'Wallet connection failed: ' + k.msg); }
      return false;
    }
  }

  async function disconnect() {
    try {
      if (walletKind === 'cartridge' && wallet && typeof wallet.disconnect === 'function') await wallet.disconnect();
      else if (walletKind === 'extension') { try { (await gsn()).disconnect({ clearLastWallet: true }); } catch (e) { /* ignore */ } }
    } catch (e) { /* ignore */ }
    wallet = null; walletKind = null; address = null; cs = {}; minted.clear(); saveCs(); feeFallbackUsed = false; statusHtml = ''; board = '';
    walletLabel = ''; view = 'home'; render(); BOOK.toast('Wallet disconnected. Your badges stay right here ♡');
  }

  // ---------- sync / reads ----------
  async function sync(loud) {
    render();
    if (!configured || !address) return;
    try {
      if ((await checkRpcChain()) === false) { chainOk = false; render(); if (loud) BOOK.toast(ERR.CHAIN_MISMATCH.msg); return; }
      const r = await call('badges_of', [address]);
      const n = parseInt(r[0], 16); minted.clear(); r.slice(1, 1 + n).map(x => parseInt(x, 16)).filter(B.isValid).forEach(id => minted.add(id)); saveCs();
      if (loud && minted.size) BOOK.toast(`✦ ${minted.size} badge${minted.size > 1 ? 's are' : ' is'} on Starknet`);
      render(); loadBoard();
    } catch (e) { if (loud) BOOK.toast('Could not reach Starknet right now. Try again later.'); }
  }
  async function loadBoard() {
    try {
      const n = parseInt((await call('player_count'))[0], 16);
      const r = await call('leaderboard', ['0x0', hex(Math.min(n, 200))]);
      const len = parseInt(r[0], 16), rows = [];
      for (let i = 0; i < len; i++) rows.push({ p: normalize(r[1 + i * 2]), n: parseInt(r[2 + i * 2], 16) });
      rows.sort((a, b) => b.n - a.n);
      board = rows.slice(0, 10).map((x, i) => `<li class="${x.p === address ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i] || i + 1}</span><span>${x.p === address ? 'You' : esc(short(x.p))}</span><span>${x.n} 🏅</span></li>`).join('') || '<li class="muted">No players yet. Be the first! ✦</li>';
    } catch (e) { board = '<li class="muted">Leaderboard unavailable right now.</li>'; }
    render();
  }
  const tokenCache = new Map();
  async function tokenOf(id) {
    const k = address + '|' + id; if (tokenCache.has(k)) return tokenCache.get(k);
    const r = await call('token_of', [address, hex(id)]);
    const n = BigInt(r[0] || 0) + (BigInt(r[1] || 0) << 128n);
    if (n > 0n) tokenCache.set(k, n.toString());
    return n > 0n ? n.toString() : null;
  }
  // extra line for the companion when a badge is tapped (holders count + collectible number)
  async function describe(id) {
    if (!configured || !address) return '';
    const parts = [];
    try { const h = parseInt((await call('holders_of', [hex(id)]))[0], 16); parts.push(h ? `${h} player${h > 1 ? 's have' : ' has'} it on Starknet.` : 'Nobody has stamped it on Starknet yet!'); } catch (e) { /* offline */ }
    if (minted.has(id)) { try { const t = await tokenOf(id); if (t) parts.push(`It's your badge #${t}.`); } catch (e) { /* offline */ } }
    return parts.join(' ');
  }

  // ---------- minting (claim_batch) ----------
  /** Badges to stamp: earned locally, not yet on-chain, in claim order (stage stamps ascend per pet). */
  function plan() { return BOOK.earned().filter(id => !minted.has(id)).sort((a, b) => a - b); }
  function calldataFor(ids) { return [hex(ids.length), ...ids.map(hex)]; }
  function validateCalldata(cd) {
    const n = Number(BigInt(cd[0]));
    if (!n || cd.length !== 1 + n) throw codedError('VALIDATION_ERROR', 'badge batch is malformed');
    cd.slice(1).forEach(x => { if (!B.isValid(Number(BigInt(x)))) throw codedError('VALIDATION_ERROR', 'badge batch has an unknown badge'); });
  }
  const isSponsoredMode = m => m === 'sponsored' || (m && typeof m === 'object' && m.type === 'paymaster');
  const shouldFallbackFees = err => classifyError(err).code === 'SPONSORSHIP_UNAVAILABLE' || /policy/i.test(err && err.message || '');
  const fallbackMode = () => (C.cartridge && C.cartridge.fallbackFeeMode) || 'user_pays';
  const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(codedError('RATE_LIMIT_OR_TIMEOUT', what + ' timed out')), ms))]);
  async function preflight(calls, mode) {
    if (typeof wallet.preflight !== 'function') return { ok: true, skipped: true };
    let res; try { res = await withTimeout(wallet.preflight({ calls, feeMode: mode }), 10000, 'preflight'); } catch (e) { return { ok: true, skipped: true }; }
    if (res && res.ok === false) return /not deployed/i.test(res.reason || '') ? { ok: false, undeployed: true, reason: res.reason } : { ok: false, reason: res.reason || 'simulation failed' };
    return { ok: true };
  }
  async function ensureReadyFor(mode) { if (typeof wallet.ensureReady === 'function') await wallet.ensureReady({ deploy: (C.cartridge && C.cartridge.deploy) || 'if_needed', feeMode: mode }); }
  async function executeCartridge(c, mode) {
    let pf = await preflight([c], mode);
    if (!pf.ok && pf.undeployed) { await ensureReadyFor(mode); pf = await preflight([c], mode); }
    if (!pf.ok) throw codedError(pf.undeployed ? 'UNDEPLOYED_ACCOUNT' : 'TX_REVERTED', 'Preflight failed: ' + pf.reason);
    try { return await wallet.execute([c], { feeMode: mode }); } catch (err) {
      if (classifyError(err).code === 'UNDEPLOYED_ACCOUNT' && !isSponsoredMode(mode)) { await ensureReadyFor(mode); return await wallet.execute([c], { feeMode: mode }); }
      throw err;
    }
  }
  async function invokeClaimBatch(ids) {
    const cd = calldataFor(ids); validateCalldata(cd);
    if (walletKind === 'cartridge') {
      const c = { contractAddress: C.contractAddress, entrypoint: 'claim_batch', calldata: cd };
      try { return await executeCartridge(c, feeFallbackUsed ? fallbackMode() : feeMode); } catch (err) {
        if (!feeFallbackUsed && isSponsoredMode(feeMode) && shouldFallbackFees(err)) {
          feeFallbackUsed = true; BOOK.toast('Free stamping isn’t available right now. Your wallet will pay the tiny fee ♡');
          return await executeCartridge(c, fallbackMode());
        }
        throw err;
      }
    }
    return await wallet.request({ type: 'wallet_addInvokeTransaction', params: { calls: [{ contract_address: C.contractAddress, entry_point: 'claim_batch', calldata: cd }] } });
  }
  const FINALITY = { RECEIVED: 'sent ✦', PRE_CONFIRMED: 'almost there ✦', CANDIDATE: 'almost there ✦', ACCEPTED_ON_L2: 'accepted ✦', ACCEPTED_ON_L1: 'final ✦' };
  function setStatus(html) { statusHtml = html; const el = $('chainStatus'); if (el) el.innerHTML = html; }
  function claimedIn(rcpt) { // BadgeClaimed events for this player (keys: [selector, player, badge])
    const out = []; if (!rcpt || !Array.isArray(rcpt.events) || !EV.BadgeClaimed) return out;
    rcpt.events.forEach(ev => { try {
      const k = ev.keys || [];
      if (k.length < 3 || BigInt(k[0]) !== BigInt(EV.BadgeClaimed) || normalize(k[1]) !== address) return;
      if (ev.from_address && BigInt(ev.from_address) !== BigInt(C.contractAddress)) return;
      out.push(Number(BigInt(k[2])));
    } catch (e) { /* ignore odd events */ } });
    return out;
  }
  async function mint() {
    if (!configured) { BOOK.toast('The badge contract is not deployed yet (see contracts/README.md).'); return; }
    if (busy || !address) return;
    if (!chainOk) { BOOK.toast(`Please switch your wallet to ${C.networkName} first`); return; }
    const ids = plan();
    if (!ids.length) { BOOK.toast('All your badges are already on Starknet ✦'); return; }
    busy = true; render();
    setStatus(walletKind === 'cartridge' && isSponsoredMode(feeMode) && !feeFallbackUsed ? 'Stamping for free with Cartridge… ✦' : 'Check your wallet to approve ✦');
    try {
      const size = Math.max(1, C.batchSize || 32); let total = 0;
      for (let i = 0; i < ids.length; i += size) {
        const chunk = ids.slice(i, i + size);
        const res = await invokeClaimBatch(chunk);
        const h = res && (res.transaction_hash || res.transactionHash || res.hash);
        if (!h) throw codedError('UNKNOWN', 'The wallet returned no transaction hash');
        const link = `<a href="${esc(C.explorerTx + h)}" target="_blank" rel="noopener noreferrer">view tx</a>`;
        setStatus(`Stamping… ${link}`);
        let stop = null;
        if (typeof res.watch === 'function') { try { stop = res.watch(({ finality }) => { if (busy && finality) setStatus(`Stamping… ${esc(FINALITY[finality] || String(finality).toLowerCase())} ${link}`); }, { pollIntervalMs: 3000, timeoutMs: 180000, onError: () => {} }); } catch (e) { stop = null; } }
        let rcpt; try { rcpt = await waitTx(h); } finally { if (typeof stop === 'function') stop(); }
        const got = claimedIn(rcpt);
        chunk.forEach(id => minted.add(id)); saveCs(); total += got.length || chunk.length;
      }
      setStatus(`Stamped on Starknet! ✦ ${total} badge${total > 1 ? 's' : ''}`);
      BOOK.toast(`✦ ${total} badge${total > 1 ? 's' : ''} stamped on Starknet!`); BOOK.say('Hooray! Your badges are on Starknet now, soulbound and forever yours ✦');
      lastError = null;
    } catch (e) {
      const k = classifyError(e); lastError = { code: k.code, recovery: k.recovery, detail: String(k.detail || '').slice(0, 200) };
      const topUp = k.code === 'INSUFFICIENT_FUNDS' && faucetLink() ? ` ${faucetLink()} then tap Stamp again ♡` : '';
      setStatus(k.code === 'USER_CANCELLED' ? 'Cancelled, no worries ♡' : 'Stamping failed: ' + friendly(e) + topUp);
      if (topUp) BOOK.say('Oops, your wallet is out of test STRK! Grab some free from the faucet and we can stamp again ♡');
    } finally { busy = false; render(); loadBoard(); }
  }

  // ---------- UI (inside the badge book) ----------
  function render() {
    updateHome();
    BOOK.render();
    if (view === 'picker') return;
    box.classList.remove('hidden');
    if (!address) {
      box.innerHTML = `<h3>✦ Starknet <small>(optional)</small></h3>
        <p class="muted small">Stamp your badges on ${esc(C.networkName || C.network)} as soulbound collectibles. You never need a wallet to play.</p>
        <button type="button" id="chainConnect">✦ CONNECT WALLET</button>`;
      $('chainConnect').onclick = () => renderPicker(box);
      return;
    }
    const paysFee = walletKind === 'extension' || (walletKind === 'cartridge' && (feeFallbackUsed || !isSponsoredMode(feeMode)));
    const fuelNote = configured && paysFee && faucetLink()
      ? `<p class="note fuel-note" id="fuelNote">⛽ Stamping uses a tiny bit of test STRK for the fee. Running low? ${faucetLink()}</p>` : '';
    const todo = plan().length, via = walletKind === 'cartridge' ? ' · via Cartridge' : '';
    box.innerHTML = `<h3>✦ Starknet</h3>
      <p class="pill ${chainOk ? '' : 'bad'}">${chainOk ? '●' : '▲'} ${esc(C.networkName)}${via}${chainOk ? '' : ': please switch network in your wallet'}</p>
      <p class="addr" title="${esc(address)}">${esc(short(address))}</p>
      ${configured ? '' : '<p class="note">The badge contract isn’t deployed yet, so stamping is off. Your badges are safe on this device.</p>'}
      ${walletKind === 'cartridge' ? `<p class="note">${feeFallbackUsed ? 'Fees: your wallet pays (sponsorship unavailable).' : 'Fees: sponsored when the Cartridge paymaster is available ✦'}<br>🔒 Session can only claim Kana Arcade badges · every stamp is checked first (preflight)</p>` : ''}
      ${fuelNote}
      <div class="stats"><div><b>${minted.size}</b><span>on Starknet</span></div><div><b>${BOOK.earned().length}</b><span>earned here</span></div></div>
      <button type="button" id="chainMint" ${configured && todo && !busy ? '' : 'disabled'}>✦ STAMP MY BADGES${todo ? ` (${todo} new)` : ''}</button>
      <p id="chainStatus" class="small" role="status" aria-live="polite">${statusHtml}</p>
      <div class="row"><button type="button" class="alt small" id="chainSync" ${configured ? '' : 'disabled'}>↻ Sync</button><button type="button" class="alt small" id="chainDisc">Disconnect</button></div>
      ${configured ? `<h3>Leaderboard</h3><ol class="lb">${board || '<li class="muted">Loading…</li>'}</ol><p class="small"><a href="${esc(C.explorerContract + C.contractAddress)}" target="_blank" rel="noopener noreferrer">View contract ↗</a></p>` : ''}`;
    $('chainMint').onclick = mint;
    $('chainSync').onclick = () => sync(true);
    $('chainDisc').onclick = disconnect;
  }

  BOOK.setChain({ enabled: true, minted, describe });
  document.addEventListener('ka:badges-open', () => { if (view !== 'picker') { render(); if (address && configured) sync(); } });
  // silently restore a previous *extension* connection (Cartridge needs a fresh login)
  if (cs.walletId && cs.walletId !== 'cartridge') {
    gsn().then(g => g.getAuthorizedWallets()).then(ws => { const w = ws.find(x => x.id === cs.walletId); if (w) connectExtension(w, true); }).catch(() => {});
  }
  window.KA_STARKNET = {
    plan, calldataFor, validateCalldata, classifyError, minted, sync, config: C, configured,
    openPicker: openSheet, closePicker: closeSheet,
    get address() { return address; }, get walletKind() { return walletKind; }, get lastError() { return lastError; },
  };
})();
