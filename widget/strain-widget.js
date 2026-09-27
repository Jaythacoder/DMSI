/**
 * Strain Effects Widget — drop-in, dependency-free embed.
 *
 * Usage:
 *   <div id="strain-widget"></div>
 *   <script
 *     src="strain-widget.js"
 *     data-api="https://your-api-domain.com"
 *     data-target="#strain-widget">
 *   </script>
 *
 * Everything is scoped under .sw-root and namespaced CSS variables, so it
 * won't collide with the host site's styles. Colors are overridable via
 * --sw-accent / --sw-bg / --sw-text custom properties on the target element.
 */
(function () {
  var currentScript = document.currentScript;
  var apiBase = (currentScript && currentScript.getAttribute('data-api')) || 'http://localhost:4000';
  var targetSelector = (currentScript && currentScript.getAttribute('data-target')) || '#strain-widget';

  function injectStyles() {
    if (document.getElementById('sw-styles')) return;
    var style = document.createElement('style');
    style.id = 'sw-styles';
    style.textContent =
      '.sw-root{--sw-accent:#3f7a5c;--sw-bg:#ffffff;--sw-text:#1a1a1a;--sw-muted:#6b6b6b;' +
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--sw-text);' +
      'background:var(--sw-bg);border:1px solid #e2e2e2;border-radius:10px;padding:16px;max-width:480px;}' +
      '.sw-search{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:14px;margin-bottom:10px;}' +
      '.sw-disclaimer{font-size:11px;color:var(--sw-muted);margin-bottom:10px;line-height:1.4;}' +
      '.sw-card{border-top:1px solid #eee;padding:10px 0;}' +
      '.sw-name{font-weight:600;font-size:15px;display:flex;justify-content:space-between;align-items:center;}' +
      '.sw-type{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--sw-muted);}' +
      '.sw-scale{margin-top:8px;}' +
      '.sw-scale-label{font-size:11px;color:var(--sw-muted);display:flex;justify-content:space-between;}' +
      '.sw-bar-track{height:6px;border-radius:3px;background:#eee;overflow:hidden;margin-top:2px;}' +
      '.sw-bar-fill{height:100%;background:var(--sw-accent);}' +
      '.sw-adhd-pill{display:inline-block;margin-top:6px;font-size:11px;padding:2px 8px;border-radius:999px;background:#eef5f0;color:var(--sw-accent);font-weight:600;}' +
      '.sw-empty{font-size:13px;color:var(--sw-muted);padding:8px 0;}' +
      '.sw-footer{font-size:10px;color:var(--sw-muted);text-align:right;margin-top:10px;}';
    document.head.appendChild(style);
  }

  function bar(label, value, max) {
    var pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      '<div class="sw-scale"><div class="sw-scale-label"><span>' + label + '</span><span>' +
      value + ' / ' + max + '</span></div>' +
      '<div class="sw-bar-track"><div class="sw-bar-fill" style="width:' + pct + '%"></div></div></div>'
    );
  }

  function renderCard(s) {
    var proData = '';
    if (s.thc || s.cbd || s.lineage) {
      proData = '<div style="margin-top:8px; font-size:11px; display:flex; gap:10px; flex-wrap:wrap;">' +
                (s.thc ? '<span style="color:var(--sw-muted)">THC: <b>' + s.thc + '</b></span>' : '') +
                (s.cbd ? '<span style="color:var(--sw-muted)">CBD: <b>' + s.cbd + '</b></span>' : '') +
                (s.lineage ? '<span style="color:var(--sw-muted)">Lineage: <b>' + s.lineage + '</b></span>' : '') +
                '</div>';
    }

    var imgHtml = s.image ? '<img src="' + s.image + '" style="width:100%; height:120px; object-fit:cover; border-radius:6px; margin-bottom:10px;" />' : '';

    return (
      '<div class="sw-card">' +
      imgHtml +
      '<div class="sw-name"><span>' + s.name + '</span><span class="sw-type">' + s.type + '</span></div>' +
      bar('Mental energy (calming \u2192 energizing)', s.scores.mentalEnergy, 10) +
      bar('Panic meter', s.scores.panicMeter, 10) +
      '<span class="sw-adhd-pill">' + s.scores.adhd.label + '</span>' +
      proData +
      '</div>'
    );
  }

  function renderResults(root, data) {
    var list = root.querySelector('.sw-results');
    if (!data.results.length) {
      list.innerHTML = '<div class="sw-empty">No strains matched.</div>';
      return;
    }
    list.innerHTML = data.results.map(renderCard).join('');
  }

  function search(root, query) {
    var url = apiBase + '/api/strains' + (query ? '?q=' + encodeURIComponent(query) : '');
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) { renderResults(root, data); })
      .catch(function () {
        root.querySelector('.sw-results').innerHTML =
          '<div class="sw-empty">Couldn\u2019t reach the strain API right now.</div>';
      });
  }

  function autoDetect(root) {
    fetch(apiBase + '/api/strains')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.results) return;
        var pageText = document.body.innerText;
        var found = data.results.find(function (s) {
          return pageText.includes(s.name);
        });
        if (found) {
          renderResults(root, { results: [found] });
          console.log('Strain identified automatically: ' + found.name);
        }
      })
      .catch(function () { });
  }

  function mount() {
    injectStyles();
    var target = document.querySelector(targetSelector);
    if (!target) return;
    target.classList.add('sw-root');
    target.innerHTML =
      '<input class="sw-search" type="text" placeholder="Search a strain (e.g. Blue Dream)" />' +
      '<div class="sw-disclaimer">Effect scores are self-reported approximations, not lab or medical data. Not medical advice. Legality varies by location.</div>' +
      '<div class="sw-results"></div>' +
      '<div class="sw-footer">Powered by Strain Effects API</div>';

    var input = target.querySelector('.sw-search');
    var debounceTimer;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var val = input.value;
      debounceTimer = setTimeout(function () { search(target, val); }, 250);
    });

    autoDetect(target);
    search(target, ''); // initial load shows everything
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
