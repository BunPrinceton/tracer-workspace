/* sop/sidebar.js — experimental left-hand navigation for the SOP section.
 *
 * Single source of truth for the SOP list. Renders the rail into
 * <aside id="sop-sidebar">, resolves links relative to the current page's
 * depth (works on file:// and on GitHub Pages), and marks the active item.
 *
 * The rail is grouped: "Current procedures" (tools we use now) and "Older
 * SOPs" (valid procedures for tools we no longer routinely use, e.g. VAST /
 * Omni). On an SOP page that declares in-page views (elements with
 * [data-view] in <main>, e.g. Procedure / Details), it also renders a nested
 * sub-menu under the active SOP and switches which view is shown.
 *
 * Scoped to /sop/ pages for now while we test the pattern.
 */
(function () {
    var container = document.getElementById('sop-sidebar');
    if (!container) return;

    // Display order == rail order. `dir` is relative to /sop/.
    var GROUPS = [
        { label: 'Current procedures', items: [
            { id: 'SOP-001', title: 'GT Task Handling',                 dir: 'gt-task-handling/' },
            { id: 'SOP-006', title: 'Voxel Painting Cell Segmentation', dir: 'voxel-painting/' }
        ] },
        { label: 'Recent procedures', items: [
            { id: 'SOP-005', title: 'GT Protocol Guidelines',           dir: 'gt-protocol-guidelines/' }
        ] },
        { label: 'Older procedures', items: [
            { id: 'SOP-002', title: 'GT Verification',                  dir: 'gt-verification/' },
            { id: 'SOP-003', title: 'GT Checklist',                     dir: 'gt-checklist/' },
            { id: 'SOP-004', title: 'File Naming',                      dir: 'file-naming/' }
        ] }
    ];

    // Locate this page within /sop/ to compute depth + active state.
    var path = location.pathname;
    var at = path.lastIndexOf('/sop/');
    var rel = at >= 0 ? path.slice(at + 5) : '';   // "" | "gt-task-handling/" | "voxel-painting/v1.2.html"
    var dir = rel.replace(/[^/]*$/, '');           // "" (landing) | "gt-task-handling/"
    var depth = (dir.match(/\//g) || []).length;   // 0 landing, 1 sub-page
    var up = new Array(depth + 1).join('../');      // "" | "../"

    // In-page views for the current SOP (Procedure / Details), if any.
    var views = [].slice.call(document.querySelectorAll('main .sop-view[data-view]'));

    function railLink(href, active, title, id, caret) {
        var cls = active ? ' class="active"' : '';
        var cur = active ? ' aria-current="page"' : '';
        var idHtml = id ? '<span class="sop-side-id">' + id + '</span>' : '';
        var caretHtml = caret ? '<span class="sop-caret' + (active ? ' open' : '') + '" aria-hidden="true"></span>' : '';
        return '<a href="' + href + '"' + cls + cur + '>' + idHtml + title + caretHtml + '</a>';
    }

    function subMenu() {
        var out = '<ul class="sop-side-sub">';
        views.forEach(function (v) {
            var name = v.getAttribute('data-view');
            var label = v.getAttribute('data-view-label') || name;
            out += '<li><a href="#' + name + '" data-view-link="' + name + '">' + label + '</a></li>';
        });
        return out + '</ul>';
    }

    var html = '<nav class="sop-side-nav" aria-label="SOP section navigation">'
        + '<div class="sop-side-title">Standard Operating Procedures</div>'
        + '<ul class="sop-side-list"><li>' + railLink(up + 'index.html', dir === '', 'Overview', '') + '</li></ul>';

    GROUPS.forEach(function (g) {
        html += '<div class="sop-side-group">' + g.label + '</div><ul class="sop-side-list">';
        g.items.forEach(function (s) {
            var active = dir === s.dir;
            html += '<li>' + railLink(up + s.dir + 'index.html', active, s.title, s.id, true);
            if (active && views.length) { html += subMenu(); }
            html += '</li>';
        });
        html += '</ul>';
    });
    html += '</nav>';
    container.innerHTML = html;

    // --- View switching (only on SOP pages that declare views) ---
    if (views.length) {
        var sublinks = [].slice.call(container.querySelectorAll('[data-view-link]'));
        var names = views.map(function (v) { return v.getAttribute('data-view'); });

        function show(name) {
            if (names.indexOf(name) < 0) name = names[0];   // default to the first view (Procedure)
            views.forEach(function (v) { v.classList.toggle('active', v.getAttribute('data-view') === name); });
            sublinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-view-link') === name); });
        }

        sublinks.forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                var name = a.getAttribute('data-view-link');
                if (location.hash !== '#' + name) { location.hash = name; }  // hashchange triggers show()
                else { show(name); }
            });
        });
        window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });
        show(location.hash.replace('#', ''));
    }
})();
