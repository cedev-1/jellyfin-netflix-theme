// Jellyfin Netflix Theme: JavaScript companion for Jellyfin 10.11 web (hero carousel, header on scroll, 16:9 cards,
// nav links, episode list). Unofficial; not affiliated with Netflix or Jellyfin. See README.md.
(function (root) {
  'use strict';

  // UI strings, keyed by language. French and English are bundled; lang() picks 'fr' when the browser language
  // starts with "fr" and falls back to English (the default) for every other language.
  var LABELS = {
    fr: { Movie: 'Film', Series: 'Série', episodes: 'épisodes', recent: 'Ajout récent', play: 'Lecture', info: "Plus d'infos",
          navHome: 'Accueil', navSeries: 'Séries', navMovies: 'Films', navList: 'Ma liste', episodesTitle: 'Épisodes', min: 'min', hour: 'h' },
    en: { Movie: 'Movie', Series: 'Series', episodes: 'episodes', recent: 'Recently added', play: 'Play', info: 'More info',
          navHome: 'Home', navSeries: 'Series', navMovies: 'Movies', navList: 'My List', episodesTitle: 'Episodes', min: 'min', hour: 'h' }
  };

  function pickHeroItems(items, max) {
    max = max || 6;
    var seen = {};
    var out = [];
    (items || []).forEach(function (item) {
      if (out.length >= max) return;
      if (item.Type !== 'Movie' && item.Type !== 'Series') return;
      if (!item.BackdropImageTags || item.BackdropImageTags.length === 0) return;
      if (seen[item.Id]) return;
      seen[item.Id] = true;
      out.push(item);
    });
    return out;
  }

  // ChildCount = number of seasons; RecursiveItemCount = number of episodes (see docs/selectors.md).
  function formatMeta(item, lang) {
    var l = LABELS[lang] || LABELS.en;
    var out = [l[item.Type] || item.Type];
    if (item.Genres && item.Genres.length) out.push(item.Genres[0]);
    if (item.ProductionYear) out.push(String(item.ProductionYear));
    if (item.Type === 'Series' && item.RecursiveItemCount) out.push(item.RecursiveItemCount + ' ' + l.episodes);
    if (item.OfficialRating) out.push(item.OfficialRating);
    return out;
  }

  function isRecentlyAdded(item, now, days) {
    days = days || 14;
    if (!item.DateCreated) return false;
    var created = new Date(item.DateCreated).getTime();
    return now.getTime() - created <= days * 86400000;
  }

  function nextIndex(current, length) {
    if (!length) return 0;
    return (current + 1) % length;
  }

  // 16:9 image URLs to try in order (the original poster remains the last resort).
  function landscapeCandidates(id, getImageUrl, type) {
    var urls = [
      getImageUrl(id, { type: 'Backdrop', index: 0, maxWidth: 780 }),
      getImageUrl(id, { type: 'Thumb', maxWidth: 780 })
    ];
    if (type === 'Episode') urls.push(getImageUrl(id, { type: 'Primary', maxWidth: 780 }));
    return urls;
  }

  // Only video content has a backdrop/thumb: other types (albums, books,
  // playlists, collections, seasons) keep their native shape (see home.css, search.css).
  var LANDSCAPE_TYPES = { Movie: 1, Series: 1, Episode: 1, Video: 1 };
  function isLandscapeType(type) {
    return !!type && LANDSCAPE_TYPES[type] === 1;
  }

  function needsLandscape(card) {
    var d = card.dataset || {};
    return card.classList.contains('overflowPortraitCard') && isLandscapeType(d.type) && !d.nfLandscape;
  }

  // Resume from the saved position (as on Netflix, "Play" resumes), otherwise play from 0.
  function playParams(item) {
    var ticks = (item && item.UserData && item.UserData.PlaybackPositionTicks) || 0;
    return ticks > 0 ? { action: 'resume', positionTicks: ticks } : { action: 'play', positionTicks: 0 };
  }


  // ---- Series / season / episode pages: Netflix-style episode list ----

  // Jellyfin prefixes an episode title with its number ("1. Title"): we split it to show the number large.
  function splitEpisodeTitle(text) {
    var m = /^(\d+)\.\s+([\s\S]*)$/.exec(text || '');
    return m ? { num: m[1], title: m[2] } : { num: '', title: text || '' };
  }

  var TICKS_PER_MIN = 600000000;
  function formatRuntime(ticks, lang) {
    if (!ticks || ticks <= 0) return '';
    var l = LABELS[lang] || LABELS.en;
    var total = Math.max(1, Math.round(ticks / TICKS_PER_MIN));
    var h = Math.floor(total / 60), m = total % 60;
    var out = [];
    if (h) out.push(h + ' ' + l.hour);
    if (m || !h) out.push(m + ' ' + l.min);
    return out.join(' ');
  }

  // Season 0 = specials: always last.
  function orderSeasons(seasons) {
    var list = (seasons || []).slice();
    var key = function (s) { return s.IndexNumber === 0 ? Infinity : (s.IndexNumber || 0); };
    return list.map(function (s, i) { return { s: s, i: i }; }).sort(function (a, b) {
      return key(a.s) === key(b.s) ? a.i - b.i : (key(a.s) < key(b.s) ? -1 : 1);
    }).map(function (x) { return x.s; });
  }

  function pickDefaultSeason(seasons) {
    var list = orderSeasons(seasons);
    if (!list.length) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].UserData && list[i].UserData.UnplayedItemCount > 0 && list[i].IndexNumber !== 0) return list[i];
    }
    return list[0];
  }

  // Jellyfin empties the backdrop below 1000px and in the mobile layout: we set the image ourselves on #itemBackdrop.
  function backdropSource(item) {
    if (!item) return null;
    if (item.BackdropImageTags && item.BackdropImageTags.length) return { id: item.Id, type: 'Backdrop', tag: item.BackdropImageTags[0] };
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) {
      return { id: item.ParentBackdropItemId, type: 'Backdrop', tag: item.ParentBackdropImageTags[0] };
    }
    var tags = item.ImageTags || {};
    if (tags.Thumb) return { id: item.Id, type: 'Thumb', tag: tags.Thumb };
    if (tags.Primary) return { id: item.Id, type: 'Primary', tag: tags.Primary };
    return null;
  }

  function episodesTarget(item) {
    if (!item) return null;
    if (item.Type === 'Series') return { seriesId: item.Id, seasonId: null, currentId: null };
    if (item.Type === 'Season' && item.SeriesId) return { seriesId: item.SeriesId, seasonId: item.Id, currentId: null };
    if (item.Type === 'Episode' && item.SeriesId) return { seriesId: item.SeriesId, seasonId: item.SeasonId || null, currentId: item.Id };
    return null;
  }

  function progressPercent(item) {
    var pos = item && item.UserData && item.UserData.PlaybackPositionTicks;
    if (!pos || !item.RunTimeTicks) return 0;
    return Math.min(100, Math.round(pos / item.RunTimeTicks * 100));
  }


  // ---- Netflix-style navigation (Home | Series | Movies | My List) ----

  function pickNavLibraries(views) {
    var out = {};
    (views || []).forEach(function (v) {
      if ((v.CollectionType === 'tvshows' || v.CollectionType === 'movies') && !out[v.CollectionType]) out[v.CollectionType] = v.Id;
    });
    return out;
  }

  // 10.11 routes as observed in the drawer: #/tv and #/movies.
  function libraryHash(type, id) {
    var route = { tvshows: 'tv', movies: 'movies' }[type];
    return route ? '#/' + route + '?topParentId=' + id + '&collectionType=' + type : null;
  }

  // favTab: index of the active native tab on the home page (1 = Favorites), otherwise null.
  function navActiveKey(hash, favTab, libs) {
    var m = /^#\/?([^?]*)(?:\?(.*))?$/.exec(hash || '');
    var route = m ? m[1] : '';
    var query = (m && m[2]) || '';
    if (route === '' || route === 'home') {
      var fav = typeof favTab === 'number' ? favTab === 1 : /(^|&)tab=1(&|$)/.test(query);
      return fav ? 'list' : 'home';
    }
    var id = (/(^|&)topParentId=([^&]*)/.exec(query) || [])[2];
    if (route === 'tv' && id && id === (libs || {}).tvshows) return 'tvshows';
    if (route === 'movies' && id && id === (libs || {}).movies) return 'movies';
    return null;
  }

  // Cache of the nav libraries, per user: { uid, libs }.
  function navLibsFor(cache, uid) {
    return cache && cache.uid === uid ? cache.libs : null;
  }

  // non-array items (failure): keep the last value for the same user, otherwise nothing.
  function mergeNavLibs(prev, uid, items) {
    if (Array.isArray(items)) return { uid: uid, libs: pickNavLibraries(items) };
    return prev && prev.uid === uid ? prev : null;
  }

  // ---- DOM (inactive under Node) ----

  function visiblePage(doc) { return doc.querySelector('.page:not(.hide)'); }

  function initHeaderScroll(doc) {
    var header = doc.querySelector('.skinHeader');
    if (!header || header.dataset.nfBound) return;
    header.dataset.nfBound = '1';
    function update() {
      var page = visiblePage(doc);
      var y = Math.max((doc.scrollingElement || doc.documentElement).scrollTop || 0,
        page ? page.scrollTop || 0 : 0);
      header.classList.toggle('nf-scrolled', y > 40);
    }
    doc.addEventListener('scroll', update, { capture: true, passive: true });
    doc.addEventListener('viewshow', update);
    update();
  }

  var navCache = null, navLibsLoading = false, navLastTry = 0;

  function currentUid() {
    try { return typeof ApiClient !== 'undefined' ? ApiClient.getCurrentUserId() || null : null; } catch (e) { return null; }
  }

  // Retries at most every 20 s after a failure; never clears the existing cache.
  function loadNavLibs() {
    var uid = currentUid();
    if (!uid || navLibsLoading || navLibsFor(navCache, uid) || Date.now() - navLastTry < 20000) return;
    navLibsLoading = true;
    navLastTry = Date.now();
    Promise.resolve().then(function () {
      return ApiClient.getUserViews ? ApiClient.getUserViews({}, uid)
        : ApiClient.getJSON(ApiClient.getUrl('UserViews', { userId: uid }));
    }).then(function (res) {
      return res && res.Items;
    }, function () { return undefined; }).then(function (items) {
      navCache = mergeNavLibs(navCache, uid, items);
    }).catch(function () { /* keep the last value */ }).then(function () {
      navLibsLoading = false;
      var d = root.document;
      if (d && navLibsFor(navCache, uid)) { var n = d.querySelector('.nf-nav'); if (n) n.remove(); try { ensureNavLinks(d); } catch (e) { /* ignored */ } }
    });
  }

  // Native home tab (0 = Home, 1 = Favorites): clicked by proxy rather than duplicated.
  function nativeHomeTab(doc, index) {
    return doc.querySelector('.headerTabs .emby-tab-button[data-index="' + index + '"]');
  }

  function goHome(doc, tab) {
    var page = visiblePage(doc);
    var btn = nativeHomeTab(doc, tab);
    if (page && page.id === 'indexPage' && btn) {
      btn.click();
      // the native tab switch only touches classes: we refresh the active pill ourselves
      [60, 400].forEach(function (ms) { root.setTimeout(function () { try { ensureNavLinks(doc); } catch (e) { /* ignored */ } }, ms); });
    }
    else root.location.hash = tab ? '#/home?tab=1' : '#/home';
  }

  function nav0(left) { return left.querySelector('.nf-nav'); }

  function ensureNavLinks(doc) {
    var header = doc.querySelector('.skinHeader');
    var left = header && header.querySelector('.headerLeft');
    if (!left) return;
    // never in the player header (OSD) nor on the login pages
    var page0 = visiblePage(doc);
    if (header.classList.contains('osdHeader') || (page0 && /^(loginPage|selectServerPage|startupWizard)/i.test(page0.id || ''))) return;
    var uid = currentUid();
    var navLibs = navLibsFor(navCache, uid);
    if (nav0(left) && nav0(left).dataset.uid !== String(uid)) nav0(left).remove();
    if (!navLibs) loadNavLibs();
    var l = LABELS[lang()];
    var nav = left.querySelector('.nf-nav');
    if (!nav) {
      var libs = navLibs || {};
      var defs = [{ key: 'home', label: l.navHome, go: function () { goHome(doc, 0); } }];
      if (libs.tvshows) defs.push({ key: 'tvshows', label: l.navSeries, go: function () { root.location.hash = libraryHash('tvshows', libs.tvshows); } });
      if (libs.movies) defs.push({ key: 'movies', label: l.navMovies, go: function () { root.location.hash = libraryHash('movies', libs.movies); } });
      defs.push({ key: 'list', label: l.navList, go: function () { goHome(doc, 1); } });
      nav = doc.createElement('nav');
      nav.className = 'nf-nav';
      nav.dataset.uid = String(uid);
      defs.forEach(function (d) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'nf-nav-tab';
        b.dataset.nav = d.key;
        b.textContent = d.label;
        b.addEventListener('click', d.go);
        nav.appendChild(b);
      });
      left.appendChild(nav);
    }
    var page = visiblePage(doc);
    var fav = null;
    if (page && page.id === 'indexPage') {
      var active = doc.querySelector('.headerTabs .emby-tab-button-active');
      fav = active ? Number(active.dataset.index) : null;
    }
    var key = navActiveKey(root.location.hash, fav, navLibs || {});
    Array.prototype.forEach.call(nav.children, function (b) { b.classList.toggle('nf-nav-active', b.dataset.nav === key); });
  }

  // Returns 'fr' for French browsers, 'en' (default) for everything else.
  function lang() {
    return ((root.navigator && navigator.language) || 'en').slice(0, 2) === 'fr' ? 'fr' : 'en';
  }

  function fetchHeroItems() {
    var userId = ApiClient.getCurrentUserId();
    return ApiClient.getItems(userId, {
      SortBy: 'DateCreated', SortOrder: 'Descending',
      IncludeItemTypes: 'Movie,Series', Recursive: true, Limit: 30,
      Fields: 'Overview,Genres,OfficialRating,ProductionYear,ChildCount,RecursiveItemCount,DateCreated,BackdropImageTags',
      ImageTypeLimit: 1, EnableImageTypes: 'Backdrop,Logo', EnableUserData: true
    }).then(function (res) { return pickHeroItems(res.Items, 6); });
  }

  function detailsHash(item) {
    return '#/details?id=' + item.Id + '&serverId=' + item.ServerId;
  }

  // playbackManager is not global: we go through the click delegate of a
  // visible .itemsContainer (docs/selectors.md, "Play", method 2).
  function playItem(item) {
    var doc = root.document;
    var container = doc.querySelector('.page:not(.hide) .itemsContainer');
    if (!container) { root.location.hash = detailsHash(item); return; }
    var b = doc.createElement('button');
    b.className = 'itemAction';
    var pp = playParams(item);
    b.dataset.action = pp.action;
    if (pp.positionTicks) b.dataset.positionticks = String(pp.positionTicks);
    b.dataset.id = item.Id;
    b.dataset.serverid = item.ServerId;
    b.dataset.type = item.Type;
    b.dataset.mediatype = item.MediaType || 'undefined';
    b.dataset.isfolder = String(!!item.IsFolder);
    b.style.display = 'none';
    container.appendChild(b);
    b.click();
    b.remove();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function slideHtml(item, l) {
    var backdrop = esc(ApiClient.getImageUrl(item.Id, { type: 'Backdrop', maxWidth: 1920, tag: item.BackdropImageTags[0] }));
    var logo = item.ImageTags && item.ImageTags.Logo
      ? '<img class="nf-hero-logo" alt="" src="' + esc(ApiClient.getImageUrl(item.Id, { type: 'Logo', maxWidth: 600, tag: item.ImageTags.Logo })) + '">'
      : '<h2 class="nf-hero-title"></h2>';
    var meta = formatMeta(item, lang()).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
    var recent = isRecentlyAdded(item, new Date()) ? '<span class="nf-badge">' + l.recent + '</span>' : '';
    return '<div class="nf-slide" style="background-image:url(\'' + backdrop + '\')">' +
      '<div class="nf-hero-content">' + logo +
      '<div class="nf-hero-meta">' + meta + '</div>' +
      '<p class="nf-hero-overview"></p>' +
      '<div class="nf-hero-actions">' +
      '<button class="nf-btn nf-btn-play" type="button"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M6 4l15 8-15 8z"/></svg>' + l.play + '</button>' +
      '<button class="nf-btn nf-btn-info" type="button">' + l.info + '</button></div></div>' +
      '<div class="nf-hero-badges">' + recent + '</div></div>';
  }

  function renderHero(items, container) {
    var l = LABELS[lang()];
    var hero = container.ownerDocument.createElement('div');
    hero.id = 'nf-hero';
    hero.innerHTML = items.map(function (it) { return slideHtml(it, l); }).join('') +
      '<div class="nf-dots">' + items.map(function () { return '<i></i>'; }).join('') + '</div>';
    var slides = hero.querySelectorAll('.nf-slide');
    var dots = hero.querySelectorAll('.nf-dots i');
    items.forEach(function (it, i) {
      var s = slides[i];
      s.querySelector('.nf-hero-overview').textContent = it.Overview || '';
      var t = s.querySelector('.nf-hero-title');
      if (t) t.textContent = it.Name;
      s.querySelector('.nf-btn-play').addEventListener('click', function () { playItem(it); });
      s.querySelector('.nf-btn-info').addEventListener('click', function () {
        root.location.hash = detailsHash(it);
      });
    });
    var current = 0, paused = false;
    function show(i) {
      slides.forEach(function (s, k) { s.classList.toggle('nf-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('nf-active', k === i); });
    }
    show(0);
    hero.addEventListener('mouseenter', function () { paused = true; });
    hero.addEventListener('mouseleave', function () { paused = false; });
    var timer = setInterval(function () {
      if (!hero.isConnected) { clearInterval(timer); return; }
      if (paused || (hero.closest('.page') || hero).classList.contains('hide')) return;
      current = nextIndex(current, items.length);
      show(current);
    }, 8000);
    container.parentNode.insertBefore(hero, container);
  }

  function ensureHero(doc) {
    var page = visiblePage(doc);
    if (!page || page.id !== 'indexPage') return;
    var home = page.querySelector('#homeTab');
    if (!home || home.querySelector('#nf-hero') || home.dataset.nfLoading) return;
    // negative cache: no new request before a viewshow or 60 s
    if (home.dataset.nfTried && Date.now() - Number(home.dataset.nfTried) < 60000) return;
    var firstSection = home.querySelector('.verticalSection');
    if (!firstSection || typeof ApiClient === 'undefined' || !ApiClient.getCurrentUserId()) return;
    home.dataset.nfLoading = '1';
    home.dataset.nfTried = String(Date.now());
    Promise.resolve().then(fetchHeroItems).then(function (items) {
      if (items.length && !home.querySelector('#nf-hero') && firstSection.parentNode) renderHero(items, firstSection);
    }).catch(function () {}).then(function () { delete home.dataset.nfLoading; });
  }

  // Home cards are posters: we replace them with the backdrop (then Thumb),
  // the CSS (home.css) does the rest. The poster is kept if no 16:9 image loads.
  function ensureLandscapeCards(doc) {
    if (typeof ApiClient === 'undefined') return;
    var page = visiblePage(doc);
    if (!page || (page.id !== 'indexPage' && page.id !== 'searchPage' && page.id !== 'itemDetailPage')) return;
    var cards = page.querySelectorAll('#homeTab .card, .searchResults .card, .similarContent .card');
    Array.prototype.forEach.call(cards, function (card) {
      if (!needsLandscape(card) || !card.dataset.id || card.dataset.type === 'Person') return;
      card.dataset.nfLandscape = '1';
      var box = card.querySelector('.cardImageContainer');
      if (!box) return;
      var urls = landscapeCandidates(card.dataset.id, ApiClient.getImageUrl.bind(ApiClient), card.dataset.type);
      (function tryNext(i) {
        if (i >= urls.length) { card.dataset.nfLandscape = 'fail'; return; } // the CSS then renders the native shape
        var img = new root.Image();
        img.onload = function () {
          // Jellyfin's lazy-loader re-reads data-src: update it too
          if (box.dataset.src) box.dataset.src = urls[i];
          box.style.backgroundImage = 'url("' + urls[i] + '")';
        };
        img.onerror = function () { tryNext(i + 1); };
        img.src = urls[i];
      })(0);
    });
  }


  // ---- Episode list (series, seasons, episodes) ----

  var itemCache = {};
  function getItemCached(id) {
    if (!itemCache[id]) {
      var uid = ApiClient.getCurrentUserId();
      itemCache[id] = Promise.resolve(ApiClient.getItem(uid, id)).catch(function () { delete itemCache[id]; return null; });
    }
    return itemCache[id];
  }

  function hashItemId(hash) {
    var m = /^#\/?details\?(?:.*&)?id=([^&]+)/.exec(hash || '');
    return m ? m[1] : null;
  }

  function episodeRow(doc, ep, current) {
    var row = doc.createElement('div');
    row.className = 'nf-ep' + (current ? ' nf-ep-current' : '');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    var thumb = ep.ImageTags && ep.ImageTags.Primary
      ? 'style="background-image:url(\'' + esc(ApiClient.getImageUrl(ep.Id, { type: 'Primary', maxWidth: 400, tag: ep.ImageTags.Primary })) + '\')"' : '';
    var pct = progressPercent(ep);
    var rt = formatRuntime(ep.RunTimeTicks, lang());
    row.innerHTML = '<span class="nf-ep-num"></span>' +
      '<span class="nf-ep-thumb" ' + thumb + '><svg class="nf-ep-play" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>' +
      (pct ? '<i class="nf-ep-progress"><b style="width:' + pct + '%"></b></i>' : '') + '</span>' +
      '<span class="nf-ep-body"><span class="nf-ep-top"><strong class="nf-ep-title"></strong><span class="nf-ep-rt">' + esc(rt) + '</span></span>' +
      '<span class="nf-ep-ov"></span></span>';
    row.querySelector('.nf-ep-num').textContent = ep.IndexNumber != null ? ep.IndexNumber : '';
    row.querySelector('.nf-ep-title').textContent = ep.Name || '';
    row.querySelector('.nf-ep-ov').textContent = ep.Overview || '';
    function go() { playItem(ep); }
    row.addEventListener('click', go);
    row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return row;
  }

  function renderEpisodes(box, seasons, target, seasonId) {
    var doc = box.ownerDocument, l = LABELS[lang()];
    var uid = ApiClient.getCurrentUserId();
    var list = box.querySelector('.nf-ep-list');
    var token = String(Date.now() + Math.random());
    box.dataset.nfToken = token;
    return Promise.resolve(ApiClient.getEpisodes(target.seriesId, {
      userId: uid, seasonId: seasonId, Fields: 'Overview', ImageTypeLimit: 1, EnableImageTypes: 'Primary', EnableUserData: true
    })).then(function (res) {
      if (box.dataset.nfToken !== token) return;
      list.textContent = '';
      ((res && res.Items) || []).forEach(function (ep) { list.appendChild(episodeRow(doc, ep, ep.Id === target.currentId)); });
    }).catch(function () { /* the native list remains as a fallback */ });
  }

  function buildEpisodes(page, target, seasons) {
    var doc = page.ownerDocument, l = LABELS[lang()];
    var ordered = orderSeasons(seasons);
    var seasonId = target.seasonId || (pickDefaultSeason(ordered) || {}).Id;
    var box = doc.createElement('section');
    box.className = 'nf-episodes';
    var head = '<div class="nf-ep-head"><h2 class="nf-ep-heading">' + esc(l.episodesTitle) + '</h2>';
    if (ordered.length > 1) {
      head += '<label class="nf-season"><select class="nf-season-select" aria-label="' + esc(l.episodesTitle) + '">' +
        ordered.map(function (s) { return '<option value="' + esc(s.Id) + '"' + (s.Id === seasonId ? ' selected' : '') + '>' + esc(s.Name) + '</option>'; }).join('') +
        '</select></label>';
    } else if (ordered.length === 1) {
      head += '<span class="nf-season-name"></span>';
    }
    box.innerHTML = head + '</div><div class="nf-ep-list"></div>';
    var nm = box.querySelector('.nf-season-name');
    if (nm) nm.textContent = ordered[0].Name;
    var sel = box.querySelector('.nf-season-select');
    if (sel) sel.addEventListener('change', function () { renderEpisodes(box, ordered, { seriesId: target.seriesId, currentId: target.currentId }, sel.value); });
    var host = page.querySelector('.detailPagePrimaryContent .detailSection');
    if (!host) return;
    host.appendChild(box);
    page.classList.add('nf-has-episodes');
    return renderEpisodes(box, ordered, target, seasonId);
  }

  function ensureDetailBackdrop(doc) {
    if (typeof ApiClient === 'undefined' || !ApiClient.getCurrentUserId()) return;
    var page = visiblePage(doc);
    if (!page || page.id !== 'itemDetailPage') return;
    var box = page.querySelector('#itemBackdrop');
    var id = hashItemId(root.location.hash);
    if (!box || !id || box.style.backgroundImage || box.dataset.nfFor === id) return;
    var narrow = root.innerWidth < 1000 || doc.documentElement.classList.contains('layout-mobile');
    if (!narrow) return;
    box.dataset.nfFor = id;
    getItemCached(id).then(function (item) {
      var src = backdropSource(item);
      if (!src || box.style.backgroundImage) return;
      box.style.backgroundImage = 'url("' + ApiClient.getImageUrl(src.id, { type: src.type, maxWidth: 1280, tag: src.tag }) + '")';
    }).catch(function () { delete box.dataset.nfFor; });
  }

  function ensureEpisodes(doc) {
    if (typeof ApiClient === 'undefined' || !ApiClient.getCurrentUserId()) return;
    var page = visiblePage(doc);
    if (!page || page.id !== 'itemDetailPage') return;
    var id = hashItemId(root.location.hash);
    if (!id || page.dataset.nfEps === id) return;
    page.dataset.nfEps = id;
    getItemCached(id).then(function (item) {
      var target = episodesTarget(item);
      if (!target || !page.isConnected || page.dataset.nfEps !== id || page.querySelector('.nf-episodes')) return;
      return Promise.resolve(ApiClient.getSeasons(target.seriesId, { userId: ApiClient.getCurrentUserId() })).then(function (res) {
        if (page.dataset.nfEps !== id || page.querySelector('.nf-episodes')) return;
        return buildEpisodes(page, target, (res && res.Items) || []);
      });
    }).catch(function () { delete page.dataset.nfEps; });
  }

  // Jellyfin shows the title as "1. Title" in native lists (fallback if ensureEpisodes fails).
  function ensureEpisodeNumbers(doc) {
    var page = visiblePage(doc);
    if (!page || page.id !== 'itemDetailPage') return;
    Array.prototype.forEach.call(page.querySelectorAll('.listItem:not([data-nf-num]) .listItemBodyText > bdi'), function (b) {
      var item = b.closest('.listItem');
      if (item.dataset.nfNum != null) return;
      var parts = splitEpisodeTitle(b.textContent);
      item.dataset.nfNum = parts.num;
      if (parts.num) b.textContent = parts.title;
    });
  }

  // URL of netflix.css = the folder of this script. On the admin dashboard, Jellyfin 10.11 does not keep the
  // Branding <style>@import</style>: the script (injected on all routes) therefore loads the stylesheet itself.
  function themeCssUrl(src) {
    if (!src) return null;
    var clean = String(src).split('#')[0].split('?')[0];
    var i = clean.lastIndexOf('/');
    return i < 0 ? null : clean.slice(0, i + 1) + 'netflix.css';
  }

  var SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';

  function ensureThemeCss(doc) {
    if (doc.getElementById('nf-theme-css')) return;
    var view = doc.defaultView;
    try { if (view && view.getComputedStyle(doc.documentElement).getPropertyValue('--nf-red').trim()) return; } catch (e) { /* load it anyway */ }
    var src = SCRIPT_SRC;
    if (!src) { var s = doc.querySelector('script[src*="netflix.js"]'); src = s && s.src; }
    var href = themeCssUrl(src);
    if (!href) return;
    var link = doc.createElement('link');
    link.id = 'nf-theme-css'; link.rel = 'stylesheet'; link.href = href;
    doc.head.appendChild(link);
  }

  function boot(doc) {
    if (doc.documentElement.dataset.nfBooted) return;
    doc.documentElement.dataset.nfBooted = '1';
    var scheduled = false;
    function run() {
      scheduled = false;
      try { ensureThemeCss(doc); initHeaderScroll(doc); ensureNavLinks(doc); ensureHero(doc); ensureLandscapeCards(doc); ensureEpisodes(doc); ensureDetailBackdrop(doc); ensureEpisodeNumbers(doc); } catch (e) { /* never break Jellyfin */ }
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      root.requestAnimationFrame(run);
    }
    new MutationObserver(schedule).observe(doc.body, { childList: true, subtree: true });
    doc.addEventListener('viewshow', function (e) {
      var home = e.target && e.target.querySelector && e.target.querySelector('#homeTab');
      if (home) delete home.dataset.nfTried; // new visit: we may retry
      schedule();
    });
    run();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(document); });
    else boot(document);
  }

  var api = { themeCssUrl: themeCssUrl, ensureThemeCss: ensureThemeCss, LABELS: LABELS, pickHeroItems: pickHeroItems, formatMeta: formatMeta,
              isRecentlyAdded: isRecentlyAdded, nextIndex: nextIndex,
              landscapeCandidates: landscapeCandidates, isLandscapeType: isLandscapeType, playParams: playParams, pickNavLibraries: pickNavLibraries,
              libraryHash: libraryHash, navLibsFor: navLibsFor, mergeNavLibs: mergeNavLibs, navActiveKey: navActiveKey, ensureNavLinks: ensureNavLinks, needsLandscape: needsLandscape,
              initHeaderScroll: initHeaderScroll, splitEpisodeTitle: splitEpisodeTitle, formatRuntime: formatRuntime,
              pickDefaultSeason: pickDefaultSeason, orderSeasons: orderSeasons, episodesTarget: episodesTarget, progressPercent: progressPercent, hashItemId: hashItemId, backdropSource: backdropSource, ensureLandscapeCards: ensureLandscapeCards };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NetflixTheme = api;
})(typeof window !== 'undefined' ? window : globalThis);
