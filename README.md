# Jellyfin Netflix Theme

A Netflix-inspired theme for the Jellyfin 10.11 web client: top navigation bar, hero carousel, 16:9 rows, search grid, login page, detail pages, user settings and admin dashboard, with a red accent and a responsive layout.

Unofficial and independent: not affiliated with or endorsed by Netflix, Inc. or the Jellyfin project.

## Installation

Requires Jellyfin **10.11** and the [JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) plugin.

### 1. Add the CSS

In Jellyfin, go to **Dashboard > General > Branding > Custom CSS code** and paste:

```css
@import url('https://cdn.jsdelivr.net/gh/cedev-1/jellyfin-netflix-theme@main/netflix.css');
```

### 2. Add the JavaScript

Open the **JavaScript Injector** plugin settings, add a new script and paste:

```js
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/cedev-1/jellyfin-netflix-theme@main/netflix.js';
  document.head.appendChild(s);
})();
```

The script powers the hero carousel, the navigation links and the 16:9 cards. It also loads the CSS on the admin dashboard, where Jellyfin does not apply the custom CSS.

### 3. Reload

Reload the web client with Ctrl+F5. If nothing changes, clear your browser cache: both Jellyfin and jsDelivr cache these files.
