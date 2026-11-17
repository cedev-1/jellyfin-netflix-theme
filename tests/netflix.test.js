const test = require('node:test');
const assert = require('node:assert');
const { pickHeroItems, formatMeta, isRecentlyAdded, nextIndex, landscapeCandidates, needsLandscape, isLandscapeType, playParams } = require('../netflix.js');

const mk = (id, type, backdrops = ['t']) => ({ Id: id, Type: type, BackdropImageTags: backdrops });

test('pickHeroItems keeps movies and series with a backdrop, without duplicates', () => {
  const items = [mk('a', 'Movie'), mk('a', 'Movie'), mk('b', 'Episode'),
                 mk('c', 'Series', []), mk('d', 'Series')];
  assert.deepStrictEqual(pickHeroItems(items).map(i => i.Id), ['a', 'd']);
});

test('pickHeroItems honours max', () => {
  const items = Array.from({ length: 10 }, (_, i) => mk('i' + i, 'Movie'));
  assert.strictEqual(pickHeroItems(items, 3).length, 3);
});

test('formatMeta for a series in French (episodes = RecursiveItemCount)', () => {
  // French strings below are expected output of the bundled 'fr' labels (LABELS.fr)
  const item = { Type: 'Series', Genres: ['Drame', 'Thriller'], ProductionYear: 2026,
                 ChildCount: 1, RecursiveItemCount: 8, OfficialRating: '16' };
  assert.deepStrictEqual(formatMeta(item, 'fr'),
    // French fixture: expected output of LABELS.fr
    ['Série', 'Drame', '2026', '8 épisodes', '16']);
});

test('formatMeta for a series without RecursiveItemCount: ChildCount (seasons) is not used', () => {
  assert.deepStrictEqual(formatMeta({ Type: 'Series', ChildCount: 3 }, 'en'), ['Series']);
});

test('formatMeta for a movie in English, missing fields omitted', () => {
  const item = { Type: 'Movie', ProductionYear: 2020 };
  assert.deepStrictEqual(formatMeta(item, 'en'), ['Movie', '2020']);
});

test('isRecentlyAdded', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  assert.strictEqual(isRecentlyAdded({ DateCreated: '2026-11-10T00:00:00Z' }, now), true);
  assert.strictEqual(isRecentlyAdded({ DateCreated: '2026-10-01T00:00:00Z' }, now), false);
  assert.strictEqual(isRecentlyAdded({}, now), false);
});

test('nextIndex wraps around', () => {
  assert.strictEqual(nextIndex(0, 3), 1);
  assert.strictEqual(nextIndex(2, 3), 0);
  assert.strictEqual(nextIndex(0, 0), 0);
});

test('landscapeCandidates: backdrop then thumb', () => {
  const g = (id, o) => 'u/' + id + '/' + o.type;
  assert.deepStrictEqual(landscapeCandidates('x1', g), ['u/x1/Backdrop', 'u/x1/Thumb']);
  // an episode's Primary image is already 16:9: last resort for this type only
  assert.deepStrictEqual(landscapeCandidates('e1', g, 'Episode'), ['u/e1/Backdrop', 'u/e1/Thumb', 'u/e1/Primary']);
});

test('needsLandscape: only unprocessed video portrait cards', () => {
  const card = (cls, done, type) => ({ classList: { contains: c => cls.includes(c) }, dataset: Object.assign(done ? { nfLandscape: '1' } : {}, type ? { type } : {}) });
  assert.strictEqual(needsLandscape(card(['overflowPortraitCard'], false, 'Movie')), true);
  assert.strictEqual(needsLandscape(card(['overflowPortraitCard'], true, 'Movie')), false);
  assert.strictEqual(needsLandscape(card(['overflowBackdropCard'], false, 'Movie')), false);
  assert.strictEqual(needsLandscape(card(['overflowPortraitCard'], false, 'Book')), false);
  assert.strictEqual(needsLandscape(card(['overflowSquareCard'], false, 'MusicAlbum')), false);
});

test('isLandscapeType: video content only', () => {
  ['Movie', 'Series', 'Episode', 'Video'].forEach(t => assert.strictEqual(isLandscapeType(t), true, t));
  ['MusicAlbum', 'Book', 'Playlist', 'BoxSet', 'Season', 'Person', undefined].forEach(t => assert.strictEqual(isLandscapeType(t), false, String(t)));
});

test('playParams: resume if position > 0, otherwise play', () => {
  assert.deepStrictEqual(playParams({ UserData: { PlaybackPositionTicks: 5000 } }), { action: 'resume', positionTicks: 5000 });
  assert.deepStrictEqual(playParams({ UserData: { PlaybackPositionTicks: 0 } }), { action: 'play', positionTicks: 0 });
  assert.deepStrictEqual(playParams({}), { action: 'play', positionTicks: 0 });
});

const { pickNavLibraries, libraryHash, navActiveKey } = require('../netflix.js');

test('pickNavLibraries finds the first movies and series libraries', () => {
  const views = [{ Id: 'm1', CollectionType: 'movies' }, { Id: 'x', CollectionType: 'music' },
                 { Id: 's1', CollectionType: 'tvshows' }, { Id: 'm2', CollectionType: 'movies' }];
  assert.deepStrictEqual(pickNavLibraries(views), { tvshows: 's1', movies: 'm1' });
  assert.deepStrictEqual(pickNavLibraries([{ Id: 'x', CollectionType: 'music' }]), {});
  assert.deepStrictEqual(pickNavLibraries(null), {});
});

test('libraryHash uses the 10.11 routes (#/tv, #/movies)', () => {
  assert.strictEqual(libraryHash('tvshows', 'abc'), '#/tv?topParentId=abc&collectionType=tvshows');
  assert.strictEqual(libraryHash('movies', 'abc'), '#/movies?topParentId=abc&collectionType=movies');
  assert.strictEqual(libraryHash('music', 'abc'), null);
});

test('navActiveKey follows the current page', () => {
  const libs = { tvshows: 's1', movies: 'm1' };
  assert.strictEqual(navActiveKey('#/home', 0, libs), 'home');
  assert.strictEqual(navActiveKey('', 0, libs), 'home');
  assert.strictEqual(navActiveKey('#/home', 1, libs), 'list');
  assert.strictEqual(navActiveKey('#/home?tab=1', null, libs), 'list');
  assert.strictEqual(navActiveKey('#/tv?topParentId=s1&collectionType=tvshows', 0, libs), 'tvshows');
  assert.strictEqual(navActiveKey('#/movies?topParentId=m1&collectionType=movies&tab=2', 0, libs), 'movies');
  assert.strictEqual(navActiveKey('#/details?id=1', 0, libs), null);
  assert.strictEqual(navActiveKey('#/search?query=a', 0, libs), null);
});

const { navLibsFor, mergeNavLibs } = require('../netflix.js');

test('navActiveKey: the active native tab wins over a stale ?tab=1', () => {
  const libs = {};
  assert.strictEqual(navActiveKey('#/home?tab=1', 0, libs), 'home');
  assert.strictEqual(navActiveKey('#/home?tab=1', 1, libs), 'list');
  assert.strictEqual(navActiveKey('#/home', 1, libs), 'list');
});

test('navLibsFor: per-user cache', () => {
  const c = { uid: 'u1', libs: { movies: 'm' } };
  assert.deepStrictEqual(navLibsFor(c, 'u1'), { movies: 'm' });
  assert.strictEqual(navLibsFor(c, 'u2'), null);
  assert.strictEqual(navLibsFor(null, 'u1'), null);
});

test('mergeNavLibs: replaces with the new views, keeps the last value on failure', () => {
  const prev = { uid: 'u1', libs: { movies: 'm' } };
  assert.deepStrictEqual(mergeNavLibs(prev, 'u1', [{ Id: 's', CollectionType: 'tvshows' }]),
    { uid: 'u1', libs: { tvshows: 's' } });
  assert.strictEqual(mergeNavLibs(prev, 'u1', undefined), prev);      // transient failure
  assert.strictEqual(mergeNavLibs(prev, 'u2', undefined), null);      // different user: nothing to keep
  assert.deepStrictEqual(mergeNavLibs(null, 'u1', []), { uid: 'u1', libs: {} }); // valid but empty response
});

const { splitEpisodeTitle, formatRuntime, pickDefaultSeason, episodesTarget, progressPercent, orderSeasons } = require('../netflix.js');

// Titles below mimic French Jellyfin output (episode names are user content, not UI strings)
test('splitEpisodeTitle separates the number from the title ("1. Title")', () => {
  assert.deepStrictEqual(splitEpisodeTitle('1. Chapitre un : La Disparition'), { num: '1', title: 'Chapitre un : La Disparition' });
  assert.deepStrictEqual(splitEpisodeTitle('12. Fin'), { num: '12', title: 'Fin' });
  // French titles below mimic Jellyfin output
  assert.deepStrictEqual(splitEpisodeTitle('Sans numéro'), { num: '', title: 'Sans numéro' });
  assert.deepStrictEqual(splitEpisodeTitle('2001. L\'odyssée'), { num: '2001', title: 'L\'odyssée' });
  assert.deepStrictEqual(splitEpisodeTitle(''), { num: '', title: '' });
});

test('formatRuntime: ticks -> "42 min" / "1 h 5 min"', () => {
  const T = 600000000; // 1 min
  assert.strictEqual(formatRuntime(42 * T, 'fr'), '42 min');
  assert.strictEqual(formatRuntime(65 * T, 'fr'), '1 h 5 min');
  assert.strictEqual(formatRuntime(120 * T, 'en'), '2 h');
  assert.strictEqual(formatRuntime(0, 'en'), '');
  assert.strictEqual(formatRuntime(undefined, 'en'), '');
  assert.strictEqual(formatRuntime(20000000, 'en'), '1 min'); // < 1 min: rounded up to 1
});

test('pickDefaultSeason: first season with unwatched episodes, otherwise the first, specials last', () => {
  const s = (id, n, unplayed) => ({ Id: id, IndexNumber: n, UserData: { UnplayedItemCount: unplayed } });
  assert.strictEqual(pickDefaultSeason([s('sp', 0, 3), s('a', 1, 0), s('b', 2, 4)]).Id, 'b');
  assert.strictEqual(pickDefaultSeason([s('sp', 0, 3), s('a', 1, 0), s('b', 2, 0)]).Id, 'a');
  assert.strictEqual(pickDefaultSeason([s('sp', 0, 0)]).Id, 'sp');
  assert.strictEqual(pickDefaultSeason([]), null);
  assert.strictEqual(pickDefaultSeason(null), null);
});

test('orderSeasons: specials (0) last, stable order', () => {
  const l = orderSeasons([{ Id: 'sp', IndexNumber: 0 }, { Id: 'b', IndexNumber: 2 }, { Id: 'a', IndexNumber: 1 }]);
  assert.deepStrictEqual(l.map(x => x.Id), ['a', 'b', 'sp']);
});

test('episodesTarget: series, season, episode; other types -> null', () => {
  assert.deepStrictEqual(episodesTarget({ Id: 's', Type: 'Series' }), { seriesId: 's', seasonId: null, currentId: null });
  assert.deepStrictEqual(episodesTarget({ Id: 'x', Type: 'Season', SeriesId: 's' }), { seriesId: 's', seasonId: 'x', currentId: null });
  assert.deepStrictEqual(episodesTarget({ Id: 'e', Type: 'Episode', SeriesId: 's', SeasonId: 'x' }), { seriesId: 's', seasonId: 'x', currentId: 'e' });
  assert.strictEqual(episodesTarget({ Id: 'm', Type: 'Movie' }), null);
  assert.strictEqual(episodesTarget({ Id: 'e', Type: 'Episode' }), null);
  assert.strictEqual(episodesTarget(null), null);
});

test('progressPercent: 0..100, 0 without a position', () => {
  assert.strictEqual(progressPercent({ RunTimeTicks: 1000, UserData: { PlaybackPositionTicks: 250 } }), 25);
  assert.strictEqual(progressPercent({ RunTimeTicks: 1000, UserData: { PlaybackPositionTicks: 5000 } }), 100);
  assert.strictEqual(progressPercent({ RunTimeTicks: 1000, UserData: { PlaybackPositionTicks: 0 } }), 0);
  assert.strictEqual(progressPercent({ UserData: { PlaybackPositionTicks: 5 } }), 0);
  assert.strictEqual(progressPercent({}), 0);
});

const { backdropSource } = require('../netflix.js');

test('backdropSource: own backdrop, then the parent backdrop, then Thumb/Primary', () => {
  assert.deepStrictEqual(backdropSource({ Id: 'a', BackdropImageTags: ['t1'] }), { id: 'a', type: 'Backdrop', tag: 't1' });
  assert.deepStrictEqual(backdropSource({ Id: 'e', BackdropImageTags: [], ParentBackdropItemId: 's', ParentBackdropImageTags: ['p1'] }), { id: 's', type: 'Backdrop', tag: 'p1' });
  assert.deepStrictEqual(backdropSource({ Id: 'e', ImageTags: { Primary: 'x', Thumb: 'th' } }), { id: 'e', type: 'Thumb', tag: 'th' });
  assert.deepStrictEqual(backdropSource({ Id: 'e', ImageTags: { Primary: 'x' } }), { id: 'e', type: 'Primary', tag: 'x' });
  assert.strictEqual(backdropSource({ Id: 'e' }), null);
  assert.strictEqual(backdropSource(null), null);
});

test('themeCssUrl derives netflix.css from the script folder (query and hash ignored)', () => {
  const { themeCssUrl } = require('../netflix.js');
  assert.strictEqual(themeCssUrl('http://localhost:8000/netflix.js?123'), 'http://localhost:8000/netflix.css');
  assert.strictEqual(themeCssUrl('https://cdn.jsdelivr.net/gh/u/r@main/netflix.js#x'), 'https://cdn.jsdelivr.net/gh/u/r@main/netflix.css');
  assert.strictEqual(themeCssUrl('/web/netflix.js'), '/web/netflix.css');
  assert.strictEqual(themeCssUrl(''), null);
  assert.strictEqual(themeCssUrl(null), null);
});
