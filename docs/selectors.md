# Validated selectors - Jellyfin Web 10.11

Validated on 2026-11-16 against a real Jellyfin **10.11.11** server (Docker image `jellyfin/jellyfin:10.11`, web client `version: 10.11.11` shown in the console), **stable/desktop** layout (`html.layout-desktop`, `data-theme=dark`), 1920x1080 viewport, using headless Playwright/Chromium. The source code was read in parallel: `jellyfin/jellyfin-web`, branch `release-10.11.z` (HEAD `35c0793`, `package.json` = 10.11.11).

Conclusion: all the essential selectors (header, `.card`, login) exist. Nothing blocks the theme.

Note: some evidence below (item names, genres, library names) comes from a test server whose metadata language was French. Those values are quoted as observed.

## Pitfall 1: the DOM is cached

Jellyfin keeps already-visited views in the DOM (`data-dom-cache="true"`; they just receive the `hide` class). A `document.querySelectorAll('.card')` therefore also counts the cards of hidden pages. **Always target the visible page**: `.page:not(.hide)` (or test `el.getClientRects().length`). Measured example: on the search page, `#homeTab` still exists (1 found, 0 visible) and so does `#loginPage`.

## Selector table

Format: `total (visible)` measured with a counting snippet, extended with the number of visible elements. Data with 2 libraries (Movies 8, Shows 4), logged-in user, home page with 3 rows.

| Candidate selector | Present | Login (logged out) | Home | Search (`?query=inception`) | Movie page | Series page | Actual selector / remark |
|---|---|---|---|---|---|---|---|
| `.skinHeader` | yes | 1 (1) | 1 (1) | 1 (1) | 1 (1) | 1 (1) | `<div class="skinHeader focuscontainer-x skinHeader-withBackground skinHeader-blurred">`, `position: fixed`, background `rgb(32,32,32)` on the home page. State classes: `noHomeButtonHeader` (home), `semiTransparent` (detail page and login, + `noHeaderRight` on login). Source: `src/scripts/libraryMenu.js` (`setTransparentMenu`, adds/removes `semiTransparent`). |
| `.headerTabs` | yes | 1 (0) | 1 (1) | 1 (0) | 1 (0) | 1 (0) | Always exists, class `hide` outside the home page. Content: `div.headerTabs.sectionTabs > div[is=emby-tabs].emby-tabs > div.emby-tabs-slider > button.emby-tab-button`. `body` receives `withSectionTabs` when the tabs are displayed. |
| `.emby-tab-button` | yes | 0 | 2 (2) | 0 | 0 | 0 | 2 tabs: Home / Favorites (`data-index` 0 and 1). Text inside `.emby-button-foreground`. |
| `.emby-tab-button-active` | yes | 0 | 1 (1) | 0 | 0 | 0 | OK, on the Home tab. |
| `#homeTab` | yes | 0 | 1 (1) | 1 (0) | 1 (0) | 1 (0) | `<div class="tabContent pageTabContent" id="homeTab" data-index="0">`, inside `#indexPage` (`class="page homePage libraryPage allLibraryPage pageWithAbsoluteTabs withTabs mainAnimatedPage"`). Other tab: `#favoritesTab`. |
| `.homeSectionsContainer` | yes | 0 | 1 (1) | 1 (0) | 1 (0) | 1 (0) | `<div class="sections homeSectionsContainer">` inside `#homeTab`. Filled asynchronously. |
| `.verticalSection` | yes | 0 | 11 (7) | 12 (1) | 26 (2) | 41 (3) | On the home page, sections `.verticalSection.sectionN` (N = 0..9). Empty ones have no title. Also used on search and the detail page (`.verticalSection.detailVerticalSection`). Title: `h2.sectionTitle.sectionTitle-cards`. |
| `.itemsContainer` | yes | 1 (0) | 8 (3) | 9 (1) | 23 (2) | 37 (3) | `div[is=emby-itemscontainer].itemsContainer.scrollSlider.focuscontainer-x.animatedScrollX`, inside `div[is=emby-scroller]`. On login it is `#divUsers` (hidden). |
| `.card` | yes | 0 | 14 (14) | 15 (1) | 37 (22) | 51 (13) | Home: 14 = 2 library tiles + 8 movies + 4 series. Classes: see the "Home card shape" section. |
| `.cardBox` | yes | 0 | 14 (14) | 15 (1) | 37 (22) | 51 (13) | `div.cardBox.cardBox-bottompadded` |
| `.cardImageContainer` | yes | 0 | 14 (14) | 15 (1) | 37 (22) | 51 (13) | An `<a class="cardImageContainer coveredImage cardContent itemAction lazy ...">` with the image in `style="background-image:url(...)"` (not an `<img>`). |
| `.cardOverlayContainer` | yes | 0 | 14 (14) | 15 (1) | 35 (21) | 47 (12) | Contains `button.cardOverlayButton[data-action=resume]` (play on hover), `button[data-action=menu]`, play-state and favorite. |
| `#loginPage` | yes | 1 (1) | 1 (0) | 1 (0) | 1 (0) | 0 (0) | `<div id="loginPage" class="page standalonePage backdropPage mainAnimatedPage">`. Hidden (class `hide`) after login. Route: `#/login` (`#/login.html` is deprecated, FallbackRoute logs a warning, and after login it redirects back to itself: use `#/login`). |
| `.manualLoginForm` | yes | 1 (1) | 1 (0) | 1 (0) | 1 (0) | 0 | `form.manualLoginForm`, fields `#txtManualName`, `#txtManualPassword`, `.chkRememberLogin`, button `button.button-submit` ("Sign In"), `.btnQuick`, `.btnForgotPassword`. When there is no public user list it is visible directly; otherwise `.visualLoginForm` (`#divUsers`) + `.btnManual`. Here: `.visualLoginForm.hide`, `.btnManual.hide`. |
| `.searchFields` | yes | 0 | 0 | 1 (1) | 0 | 0 | `#searchPage > div.searchFields > div.searchFieldsInner > [span.searchfields-icon, div.inputContainer > input#searchTextInput.searchfields-txtSearch]`. Results: `div.searchResults > div.verticalSection` (one per type: "Movies", "Shows"...), each with a horizontal `emby-scroller` (not a grid, so the 5-column grid requires a `flex-wrap`/`display:grid` override on `.searchResults .itemsContainer`). Cards: `.card.overflowPortraitCard`. |
| `.detailPagePrimaryContainer` | yes | 0 | 0 | 0 | 1 (1) | 2 (1) | Page: `#itemDetailPage.page.libraryPage.itemDetailPage.noSecondaryNavPage.selfBackdropPage.noBackdropTransparency`. Careful: 2 `.itemDetailPage` pages can coexist (cache): target `.itemDetailPage:not(.hide)`. |
| `.detailRibbon` | yes | 0 | 0 | 0 | 1 (1) | 2 (1) | Contains `.infoWrapper > .nameContainer (h1.itemName) + .itemMiscInfo-primary/.itemMiscInfo-secondary` and `.mainDetailButtons`. |
| `.backdropImage` | yes | 0 | 0 | 0 | 1 (1) | 1 (1) | Single global element outside the pages: `.backdropContainer > .backdropImage.displayingBackdropImage` (`style="background-image:url(.../Images/Backdrop/0?tag=...)"`). `#itemBackdrop.itemBackdrop` also exists (empty here) in the detail page. Absent on home/search as long as the page does not request a backdrop. |
| `.headerSearchButton` | yes | 1 (0) | 1 (1) | 1 (1) | 1 (1) | 1 (1) | `button.headerButton.headerButtonRight.headerSearchButton` (icon `search`), hidden on login. Opens `#/search`. |

Other useful selectors found in the header (`src/scripts/libraryMenu.js`): `.headerLeft`, `.headerRight`, `.headerBackButton`, `.headerHomeButton`, `.mainDrawerButton`, `.pageTitle` (`h3`, empty on home/detail, except the logo: `pageTitleWithLogo pageTitleWithDefaultLogo`), `.headerUserButton`, `.headerCastButton`, `.headerSyncButton`, `.headerTop`.

Detail page, visible buttons (`.mainDetailButtons button`): movie = `.btnPlay` (`data-action="resume"`, title "Play"), `.btnPlayTrailer`, `.btnPlaystate`, `.btnUserRating`, `.btnMoreCommands`; series = `.btnPlay`, `.btnPlayTrailer`, `.btnShuffle`, `.btnPlaystate`, `.btnUserRating`, `.btnMoreCommands`. Other blocks: `.detailLogo` (TMDB logo if available), `.detailImageContainer` (poster), `.itemGenres`, `.tagline`, `.overview`, `.detailSection`. Series: "Seasons" section inside `.verticalSection.detailVerticalSection`.

## What existing themes do (read from their code)

- **Transparent header**: `ElegantFin-theme-v25.10.27.css` ~L3589: `.skinHeader-withBackground.semiTransparent { background-color: transparent; backdrop-filter: none; border: none }` and the solid header on `.skinHeader-blurred:not(.osdHeader):not(.semiTransparent)`. It also hides the background on the home page with `.skinHeader.headroom:not(.osdHeader, .noHomeButtonHeader):has(.pageTitle:empty)`. On 10.11 there is **no** "transparent on home" class: `semiTransparent` is only set on detail/login (`setTransparentMenu` in `libraryMenu.js`). For a header that is transparent and then turns black on scroll on the home page, you therefore need a `scroll` listener in JS (toggling a class) or to override `.skinHeader` directly.
- **Cards**: `tashifkhan/jellyfin-netflix-theme` (`netflix.css` L384-389) only sets widths via `.emby-scroller .overflowBackdropCard` / `.overflowPortraitCard`; ElegantFin handles many breakpoints on `.overflowPortraitCard` (L500-744); neither converts the poster to 16:9, they keep the native shapes. So 16:9 on the home page requires JS (see below).
- **Login**: `#loginPage`, `#loginPage .padded-left.padded-right.padded-bottom-page`, `#loginPage .manualLoginForm, #loginPage form` (tashifkhan L1321-1334; ElegantFin L2129-2143): same selectors as the ones validated here.
- **Search**: Jellyfish `#searchPage .searchFields`, `.searchFieldsInner`, `.searchFieldsInner:focus-within` (theme.css L1794-1811): confirmed.
- **Detail**: ElegantFin `.detailPagePrimaryContainer`, `.detailPagePrimaryContent`, `.layout-desktop .detailPagePrimaryContainer`: confirmed.
- The scripts (KefinTweaks, Jellyfish) use a `MutationObserver` on `document.body` + `hashchange`; none relies on a global `playbackManager`.

## Dev environment

Use a throwaway local Jellyfin 10.11 server (for example the official Docker image) with a small test library; never commit its configuration or media to this repository.

```sh
# start (first time)
docker run -d --name jellyfin-dev -p 8096:8096 \
  -v /path/to/config:/config -v /path/to/cache:/cache -v /path/to/media:/media \
  jellyfin/jellyfin:10.11
# afterwards
docker start jellyfin-dev      # start
docker stop jellyfin-dev       # stop
docker rm -f jellyfin-dev      # remove (the config stays in /path/to/config)
```

- URL: `http://localhost:8096/web/` (example dev server; adapt host and port to your setup). Use a local-only test account.
- Test libraries used for the measurements: "Movies" (8 movies) and "Series" (4 series x 2 episodes), TMDB metadata in French. The media files were 5-second black mp4s generated with `ffmpeg -f lavfi -i color=c=black:s=640x360:d=5 -f lavfi -i anullsrc -t 5 -c:v libx264 -pix_fmt yuv420p -c:a aac <file>` and named `Name (year)/Name (year).mp4` and `Name (year)/Season 01/Name S01E01.mp4`. All titles have a poster + backdrop; Thumb except two of them.
- Scan pitfall: the first scan left the series with `ChildCount: 0` / no children; a **second** `POST /Library/Refresh` (admin token) fixed it. If a series looks empty, run the scan again.
- API token (script): `curl -s -X POST http://localhost:8096/Users/AuthenticateByName -H 'Content-Type: application/json' -H 'X-Emby-Authorization: MediaBrowser Client="t", Device="t", DeviceId="t1", Version="1"' -d '{"Username":"<user>","Pw":"<password>"}'` -> `AccessToken`, then `-H "X-Emby-Token: $TOKEN"`.

### Headless screenshots (Playwright)

Any Playwright setup with Chromium works. The script used for the measurements logs in through the form (`#txtManualName`, `#txtManualPassword`, `.manualLoginForm button[type=submit]`), waits for `.skinHeader .headerUserButton:not(.hide)`, changes the hash, injects the theme, waits 4 s and takes the screenshot. Pitfall: start from `#/login` (not `#/login.html`, otherwise the post-login redirect falls back to the login page). The UI language follows the browser locale (a `fr-FR` locale gives the French UI).

### Injecting CSS / JS without the JavaScript Injector plugin

Validated on the test instance:

1. **Real CSS through Branding** (as in production): `POST /System/Configuration/branding` (admin) with `{"LoginDisclaimer":"","CustomCss":"@import url(\"http://localhost:8000/netflix.css\");","SplashscreenEnabled":false}` (204). `GET /Branding/Css` returns the same string, and the client inserts it as `<style>@import ...</style>`. Verified: a `body{outline:...}` served from `python3 -m http.server 8000 --directory <theme folder>` applies (`getComputedStyle(body).outlineColor` = red). The `@import` is loaded **by the browser**, hence `localhost:8000` (not `host.docker.internal`, which only lets the container read from the host). Reset: same POST with `"CustomCss":""`.
2. **CSS + JS on the fly with Playwright** (fast reload, without touching the configuration): `page.addStyleTag({url})` / `page.addScriptTag({url})` with `http://localhost:8000/netflix.css` and `http://localhost:8000/netflix.js`. Verified: a script served by the local server executed `document.title = ...` and set `window.__injected`. Scripts injected after load do not re-run on each SPA navigation (by design, the theme must manage its own listeners).
3. JS in production: only the JavaScript Injector plugin (or equivalent) can inject JS; there is no JS field in Branding.

### Node tests

With Node 18+ installed, run `node --test`. **Warning**: `node --test tests/` fails with Node 24 (it treats `tests/` as a file and exits with "test failed"). Forms that work (verified, 1 test passed): `node --test` (automatic discovery), `node --test 'tests/*.test.mjs'` or `node --test tests/file.test.mjs`.

## Page transitions

The router is React Router (`src/apps/stable/routes/*`), which mounts "legacy" views via `ViewManagerPage` / `viewManager` (`src/components/viewManager/viewManager.js`). Measured with a listener on `document` during hash changes:

- DOM events fired on the relevant `.page` element, `bubbles: true`, so they can be listened to on `document`: `viewinit` (first time only), `viewbeforeshow`, `viewshow`, `viewbeforehide`, `viewhide`, `viewdestroy`, plus the duplicates `pageinit` / `pagebeforeshow` / `pageshow` / `pagehide` (`dispatchPageEvents(true)`). `e.target` is the page (`indexPage`, `searchPage`, `itemDetailPage`, `moviesPage`, `loginPage`, `videoOsdPage`). `appRouter.js` itself does `document.addEventListener('viewshow', ...)`.
- Measured order, home -> search: `popstate`, `hashchange`, `viewbeforehide`/`viewhide`/`pagehide` (indexPage), `viewbeforeshow`/`pagebeforeshow`/`viewshow`/`pageshow` (searchPage), all within the same millisecond. The result cards arrive ~35 ms later (`.card` elements added to `.itemsContainer`).
- **Going back to the home page: NO node added** (MutationObserver: 0 mutations in 2.5 s) because `#indexPage` is cached (`data-dom-cache`); only `viewshow` (target `#indexPage`) and a `hide` class change occur. An observer that only watches `childList` would never see the return to the home page: **listen to `viewshow` (or `pageshow`) on `document` in addition to the MutationObserver**.
- Detail pages are recreated on every visit (`viewinit` each time) and the previous `.itemDetailPage` stays in the DOM, hidden.
- The home sections fill asynchronously after `viewshow`: `.homeSectionsContainer` first receives the empty `.verticalSection.sectionN`, then the `.itemsContainer` elements receive the `.card` elements (network calls). A MutationObserver on `#homeTab` (`childList, subtree`) reacting to the addition of `.card` / `.verticalSection` is therefore necessary for the hero and the 16:9 conversion.
- Useful state classes: `body.withSectionTabs` (tabs visible = home/library), `.skinHeader.noHomeButtonHeader` (home), `.skinHeader.semiTransparent` (detail, login), `.page.hide` (hidden page). A `viewshow` + `e.target.id` gives the page: `indexPage` (home), `searchPage`, `itemDetailPage`, `loginPage`, `moviesPage` (movies library), `videoOsdPage`.
- Recommended recipe: `document.addEventListener('viewshow', e => route(e.target))` + `new MutationObserver(...)` on `document.body` with `{childList:true, subtree:true}`, filtering on `n.matches('.card, .verticalSection, .page')`, and always scoping to `.page:not(.hide)`. The hash `#/home` loads `#indexPage`; the old `#/home.html` format triggers a deprecation warning and a redirect.

## Home card shape

Source: `src/components/homesections/sections/recentlyAdded.ts`, `src/utils/card.ts` (`CardShape`), `src/components/cardbuilder/cardBuilder.js`. There is no user setting for the shape of home cards. The shape depends on the row type, and the image is a **Primary** (poster) for movies and series:

| Row | Card class | Padder | Image |
|---|---|---|---|
| "My Media" (`.section0`, library tiles) | `.card.overflowBackdropCard` | `.cardPadder-overflowBackdrop` | the library's Primary/Thumb image (otherwise the `defaultCardBackground` background) |
| "Recently added in Movies/Shows" (`viewType` movies/tvshows) | `.card.overflowPortraitCard` (+ `.groupedCard` on series) | `.cardPadder-overflowPortrait` | `Images/Primary?fillHeight=335&fillWidth=223` as `background-image` of `a.cardImageContainer` |
| Continue Watching / Next Up (episodes) | `.card.overflowBackdropCard` | `.cardPadder-overflowBackdrop` | Thumb/Backdrop/Primary depending on availability |

`recentlyAdded.ts`: `if (itemType === 'Channel' || viewType === 'movies' || viewType === 'books' || viewType === 'tvshows') shape = getPortraitShape(enableOverflow)`, and `preferThumb` is not enabled for movies/tvshows, hence the portrait posters. CSS cannot change the image URL: 16:9 requires **CSS + JS**.

Validated recipe (6 16:9 thumbnails per row with the TMDB backdrops):

```css
#homeTab .overflowPortraitCard { width: calc((100vw - 8vw) / 6) !important; }
#homeTab .cardPadder-overflowPortrait { padding-bottom: 56.25% !important; }   /* 16:9 */
#homeTab .overflowPortraitCard .cardImageContainer { background-size: cover; background-position: center; }
```

```js
// for each portrait card on the home page, replace the poster with the backdrop (or Thumb)
card.querySelector('.cardImageContainer').style.backgroundImage =
  `url("${ApiClient.getImageUrl(card.dataset.id, { type: 'Backdrop', index: 0, maxWidth: 780 })}")`;
```

Good to know: `data-id`, `data-type` (`Movie`, `Series`, `Episode`), `data-serverid` are present on every `.card`. Without a backdrop you must fall back to Thumb then Primary (`ImageTags` / `BackdropImageTags` via `ApiClient.getItem`). Cards are recreated when a row refreshes, so the observer must reprocess new `.card` elements (mark already-processed cards with a `data-*`). The `background-image` is set directly as an inline style (no lazy `data-src` after the first load; the `blurhash-canvas` stays underneath).

## Play

- `typeof window.playbackManager` = **`"undefined"`** (measured on a movie page, 10.11.11). The source confirms it: `playbackManager` is an imported ES module (`import { playbackManager } from './playback/playbackmanager'` in `src/components/shortcuts.js`); only `window.Events` (`src/index.jsx` L58), `window.Dashboard` (`src/utils/dashboard.js` L263) and `window.ApiClient` (`ServerConnections.js` L88) are exposed. Also measured: `window.appRouter`, `ServerConnections`, `require`, `Globalize`, `layoutManager`, `__webpack_require__` are `undefined`. `Events` and `Dashboard` are objects.
- **Method 1 (tested, ok)**: on the detail page, click the real button: `document.querySelector('.itemDetailPage:not(.hide) .mainDetailButtons .btnPlay').click()`. Measured result: the hash changes to `#/video`, 1 `<video>` element, `#videoOsdPage` visible.
- **Method 2 (tested, ok, without changing page first)**: the click delegate of `emby-itemscontainer` (`src/elements/emby-itemscontainer/emby-itemscontainer.js` calls `shortcuts.onClick`) reads `data-action` and the `data-*` attributes of the `.itemAction` element and calls `playbackManager.play`. A fabricated button placed inside a visible `.itemsContainer` is enough:
  ```js
  const b = document.createElement('button');
  b.className = 'itemAction'; b.dataset.action = 'play';          // or 'resume'
  Object.assign(b.dataset, { id: item.Id, serverid: item.ServerId, type: item.Type,
    mediatype: item.MediaType || 'undefined', isfolder: String(!!item.IsFolder) });
  document.querySelector('.page:not(.hide) .itemsContainer').appendChild(b); b.click(); b.remove();
  ```
  Measured: movie (`type=Movie`, `isfolder=false`) -> `#/video` + `<video>`; series (`type=Series`, `isfolder=true`) -> `#/video`, playback starts the 1st unwatched episode (`/Videos/<id>/stream.mp4?Static=true`). To resume at the saved position, add `data-positionticks`.
- To avoid: trying to reach `playbackManager` via `import()` or webpack (not exposed, hashed chunks).
- Useful detail: the `data-action` values supported in `shortcuts.js executeAction`: `link`, `play`, `resume`, `queue`, `playallfromhere`, `menu`, `playmenu`, `playtrailer`, `instantmix`, etc.

## API

Measured on `window.ApiClient` (type `function`): `getCurrentUserId`, `getItems`, `getItem`, `getImageUrl`, `getUrl`, `getJSON`, `getLatestItems`, `getEpisodes`, `getSeasons`, `getNextUpEpisodes`, `getSimilarItems`, `getResumableItems`, `getCurrentUser`, `serverAddress`, `accessToken`, `getScaledImageUrl`, `ajax`. The theme relies on `getCurrentUserId`, `getItems` and `getImageUrl`: confirmed (`"function"`).

Validated examples:

```js
const uid = ApiClient.getCurrentUserId();
await ApiClient.getItems(uid, { Recursive: true, IncludeItemTypes: 'Movie,Series', Fields: 'BackdropImageTags,ImageTags,Overview,Genres,CommunityRating,OfficialRating,RecursiveItemCount,ChildCount' });
await ApiClient.getItem(uid, id);   // ImageTags: { Primary, Logo, Thumb? }, BackdropImageTags: [...]
ApiClient.getImageUrl(id, { type: 'Backdrop', index: 0, maxWidth: 1920, tag })
  // http://localhost:8096/Items/<id>/Images/Backdrop/0?maxWidth=1920&tag=<tag>&quality=80
ApiClient.getImageUrl(id, { type: 'Thumb' })  // .../Images/Thumb?quality=90
ApiClient.getImageUrl(id, { type: 'Logo' })   // .../Images/Logo?quality=90
```

`Logo` exists for all test titles, `Thumb` for all except two, `Backdrop` x1 for all.

### Number of episodes of a series

Series Stranger Things (1 season, 2 episodes), real JSON from `GET /Users/<uid>/Items/<id>` after the second scan:

```json
{ "Name": "Stranger Things", "Type": "Series", "IsFolder": true, "ProductionYear": 2016,
  "OfficialRating": "FR-16", "CommunityRating": 8.542, "Status": "Ended",
  "Genres": ["Action & Adventure", "Mystère", "Science-Fiction & Fantastique"],
  "ChildCount": 1, "RecursiveItemCount": 2,
  "UserData": { "UnplayedItemCount": 2, "PlayCount": 0, "Played": false },
  "ImageTags": { "Thumb": "…", "Logo": "…", "Primary": "…" },
  "BackdropImageTags": ["952854d6…"] }
```

- **`ChildCount` = number of seasons** (1), **`RecursiveItemCount` = number of episodes** (2). Both are only returned when requested with `Fields=ChildCount,RecursiveItemCount` (RecursiveItemCount is present by default in the full DTO of an item, but it is safer to request it). On a movie: `null` for both.
- A season (`Type: Season`): `ChildCount: 2`, `RecursiveItemCount: 2` (number of episodes).
- `SeasonCount`: not returned (`null`). `UserData.UnplayedItemCount` = unwatched episodes (2).
- Cross-check: `ApiClient.getEpisodes(seriesId, {UserId})` -> `TotalRecordCount: 2`.
- Pitfall: as long as the scan is not finished (or after a failed first scan), `ChildCount` and `RecursiveItemCount` are 0 and `getItems({ParentId})` is empty.
