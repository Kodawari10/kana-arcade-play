/* Vocab API over KA_VOCAB_DATA: decks, lookup, romaji check, distractors.
   Pure logic. Exposes window.KA_VOCAB / module.exports. */
(function (root) {
  "use strict";
  var DATA = root.KA_VOCAB_DATA || (typeof require === "function" ? require("./vocab-data.js") : null);
  if (!DATA && typeof document === "undefined") return;

  // Hepburn from hiragana/katakana (covers ん, long ー, small ya/yu/yo, dakuten)
  var MAP = {
    "あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
    "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
    "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
    "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo",
    "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"o","ん":"n",
    "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
    "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
    "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
    "きゃ":"kya","きゅ":"kyu","きょ":"kyo","しゃ":"sha","しゅ":"shu","しょ":"sho",
    "ちゃ":"cha","ちゅ":"chu","ちょ":"cho","にゃ":"nya","にゅ":"nyu","にょ":"nyo",
    "ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo","みゃ":"mya","みゅ":"myu","みょ":"myo",
    "りゃ":"rya","りゅ":"ryu","りょ":"ryo","ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo",
    "じゃ":"ja","じゅ":"ju","じょ":"jo","びゃ":"bya","びゅ":"byu","びょ":"byo",
    "ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo",
    "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o","っ":"","ゃ":"ya","ゅ":"yu","ょ":"yo","ー":"",
    "ふぁ":"fa","ふぃ":"fi","ふぇ":"fe","ふぉ":"fo","てぃ":"ti","でぃ":"di","うぃ":"wi","うぇ":"we","うぉ":"wo",
    "ちぇ":"che","しぇ":"she","じぇ":"je","ヴ":"vu","ゔ":"vu","う゛":"vu"
  };
  function toHira(s) {
    return String(s || "").replace(/[\u30A1-\u30F6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .replace(/\u30FC/g, "ー").replace(/\u30F5/g, "か").replace(/\u30F6/g, "け").replace(/\u30F4/g, "ゔ");
  }
  function kanaToRo(kana) {
    var s = toHira(kana), out = "", i = 0;
    while (i < s.length) {
      if (s[i] === "っ" && i + 1 < s.length) {
        var nxt = MAP[s.slice(i + 1, i + 3)] || MAP[s[i + 1]] || "";
        var cons = (nxt.match(/^[^aiueo]?/) || [""])[0];
        if (!cons || /[aiueon]/.test(cons)) cons = (nxt[0] && !/[aiueo]/.test(nxt[0])) ? nxt[0] : "t";
        out += cons; i++; continue;
      }
      if (s[i] === "ー" && out) {
        var last = out[out.length - 1];
        if ("aiueo".indexOf(last) >= 0) out += last; // lengthen vowel
        i++; continue;
      }
      // small vowel after a consonant mora: ファ ティ パーティー
      var dig = s.slice(i, i + 2);
      if (MAP[dig] && dig.length === 2) { out += MAP[dig]; i += 2; continue; }
      if (MAP[s[i]] != null) {
        var base = MAP[s[i]]; out += base; i++;
        // アィゥェォ after a vowel-ending mora already handled via digraphs; lone small vowels append
        continue;
      }
      i++;
    }
    return out.replace(/n(?=[bmp])/g, "m");
  }
  function normRo(r) { return String(r || "").toLowerCase().replace(/\s+/g, "").replace(/ou/g, "o").replace(/uu/g, "u"); }
  // Allow long-vowel spelling variants: oo/ou, uu, aa etc.
  function roMatches(expected, given) {
    var a = normRo(expected), b = normRo(given);
    if (a === b) return true;
    // を → o/wo; particle は → wa/ha; へ → e/he; n/m before labials
    function soft(x) {
      return x.replace(/wo/g, "o").replace(/ha/g, "wa").replace(/he/g, "e")
        .replace(/nb/g, "mb").replace(/np/g, "mp").replace(/nm/g, "mm")
        .replace(/ou/g, "o").replace(/uu/g, "u").replace(/oo/g, "o").replace(/aa/g, "a").replace(/ee/g, "e")
        .replace(/fu/g, "hu").replace(/si/g, "shi").replace(/ti/g, "chi").replace(/tu/g, "tsu").replace(/zi/g, "ji");
    }
    if (soft(a) === soft(b)) return true;
    return false;
  }
  function isKanaOnly(s) {
    return typeof s === "string" && s.length > 0 && /^[\u3040-\u309F\u30A0-\u30FF\u30FC\u3099\u309A]+$/.test(s);
  }

  function byId(id) { if (!DATA && root.KA_VOCAB_DATA) API.syncData(); if (!DATA) return null; for (var i = 0; i < DATA.ITEMS.length; i++) if (DATA.ITEMS[i].id === id) return DATA.ITEMS[i]; return null; }
  function deck(id) { if (!DATA && root.KA_VOCAB_DATA) API.syncData(); if (!DATA) return null; for (var i = 0; i < DATA.DECKS.length; i++) if (DATA.DECKS[i].id === id) return DATA.DECKS[i]; return null; }
  function items(deckId, kind) { if (!DATA && root.KA_VOCAB_DATA) API.syncData(); if (!DATA) return [];
    return DATA.ITEMS.filter(function (it) { return (!deckId || it.deck === deckId) && (!kind || it.kind === kind); });
  }
  function validate() { if (!DATA && root.KA_VOCAB_DATA) API.syncData(); if (!DATA) return ["no data"];
    var errs = [], seen = {}, ids = {};
    DATA.ITEMS.forEach(function (it, i) {
      if (!it.id || !it.deck || !it.kana || !it.ro || !it.en) errs.push("missing fields @" + i);
      if (it.level && it.level !== "N5" && it.level !== "N4" && it.level !== "N3" && it.level !== "N2" && it.level !== "N1") errs.push("bad level " + it.level + " @" + i);
      if (!deck(it.deck)) errs.push("unknown deck " + it.deck);
      if (!isKanaOnly(it.kana)) errs.push("non-kana in kana: " + it.kana);
      if (ids[it.id]) errs.push("dup id " + it.id); ids[it.id] = 1;
      var key = it.deck + "|" + it.kana + "|" + it.en;
      if (seen[key]) errs.push("dup entry " + key); seen[key] = 1;
      var got = kanaToRo(it.kana);
      if (!roMatches(it.ro, got) && !roMatches(got, it.ro.replace(/ m /g, " "))) {
        // allow spaces in stored romaji for phrases
        var compact = it.ro.replace(/\s+/g, "");
        if (!roMatches(compact, got)) errs.push("romaji mismatch: " + it.kana + " expected~" + got + " got " + it.ro);
      }
    });
    DATA.SITUATIONS.forEach(function (s, i) {
      if (!s.id || !s.prompt || !s.answer) errs.push("bad situation @" + i);
    });
    return errs;
  }
  function distractors(item, n, pool) {
    n = n || 3; pool = pool || items(item.deck, item.kind);
    var out = [], used = {}; used[item.en] = 1;
    pool.forEach(function (p) {
      if (out.length >= n || used[p.en] || p.id === item.id) return;
      used[p.en] = 1; out.push(p);
    });
    // fill from all if needed
    if (out.length < n) items(null, item.kind).forEach(function (p) {
      if (out.length >= n || used[p.en] || p.id === item.id) return;
      used[p.en] = 1; out.push(p);
    });
    return out;
  }
  function shuffle(a, rand) {
    rand = rand || Math.random; a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function quizChoices(item, n, rand) {
    n = n || 4;
    var opts = distractors(item, n - 1).map(function (d) { return { en: d.en, id: d.id }; });
    opts.push({ en: item.en, id: item.id });
    return shuffle(opts, rand);
  }
  function acceptAnswer(item, typed) {
    var t = String(typed || "").trim().toLowerCase();
    if (!t) return false;
    if (t === item.en.toLowerCase()) return true;
    if (roMatches(item.ro, t)) return true;
    if (t === item.kana || (item.kanji && t === item.kanji)) return true;
    return false;
  }
  function situationMatch(sit, typed) {
    var t = String(typed || "").trim().replace(/\s+/g, "");
    if (!t) return false;
    var all = [sit.answer].concat(sit.alts || []);
    return all.some(function (a) { return a.replace(/\s+/g, "") === t || roMatches(kanaToRo(a), t) || a === typed.trim(); });
  }

  var API = {
    DECKS: DATA ? DATA.DECKS : [], ITEMS: DATA ? DATA.ITEMS : [], SITUATIONS: DATA ? DATA.SITUATIONS : [],
    syncData: function () {
      if (root.KA_VOCAB_DATA) DATA = root.KA_VOCAB_DATA;
      if (!DATA) return false;
      API.DECKS = DATA.DECKS; API.ITEMS = DATA.ITEMS; API.SITUATIONS = DATA.SITUATIONS;
      return true;
    },
    byId: byId, deck: deck, items: items, validate: validate,
    kanaToRo: kanaToRo, isKanaOnly: isKanaOnly, roMatches: roMatches,
    distractors: distractors, quizChoices: quizChoices, acceptAnswer: acceptAnswer,
    situationMatch: situationMatch, shuffle: shuffle,
    counts: function () {
      if (!DATA && root.KA_VOCAB_DATA) API.syncData(); if (!DATA) return { words: 0, phrases: 0, decks: {}, byLevel: {}, situations: 0, total: 0 };
      var c = { words: 0, phrases: 0, decks: {}, byLevel: {} };
      DATA.DECKS.forEach(function (d) { c.decks[d.id] = 0; });
      DATA.ITEMS.forEach(function (it) { c[it.kind === "p" ? "phrases" : "words"]++; c.decks[it.deck] = (c.decks[it.deck] || 0) + 1; var lv = it.level || "N5"; if (!c.byLevel[lv]) c.byLevel[lv] = { words: 0, phrases: 0 }; c.byLevel[lv][it.kind === "p" ? "phrases" : "words"]++; });
      c.situations = DATA.SITUATIONS.length; c.total = DATA.ITEMS.length; return c;
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.KA_VOCAB = API;
})(typeof window !== "undefined" ? window : this);
