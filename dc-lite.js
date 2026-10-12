/* RHYTHMHEARTZ — tiny template runtime (sc-for / sc-if / {{ }} / onClick / ref / setState) */
(function () {
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var ONLY = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(scope, path) {
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function raw(scope, str) {
    var m = ONLY.exec(str);
    return m ? lookup(scope, m[1]) : str;
  }
  function interp(scope, str) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(scope, p);
      return v == null ? '' : String(v);
    });
  }
  function child(scope, name, val) {
    var s = Object.create(scope);
    s[name] = val;
    return s;
  }

  function walk(node, scope, out, refs) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interp(scope, node.nodeValue)));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      var list = raw(scope, node.getAttribute('list') || '') || [];
      var as = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var s = child(scope, as, list[i]);
        s.$index = i;
        node.childNodes.forEach(function (c) { walk(c, s, out, refs); });
      }
      return;
    }
    if (tag === 'sc-if') {
      if (raw(scope, node.getAttribute('value') || '')) {
        node.childNodes.forEach(function (c) { walk(c, scope, out, refs); });
      }
      return;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a];
      var n = at.name;
      if (n.indexOf('hint-') === 0) continue;
      if (n === 'ref') {
        var fn = raw(scope, at.value);
        if (typeof fn === 'function') refs.push([fn, el]);
        continue;
      }
      if (/^on[a-z]+$/i.test(n) && ONLY.test(at.value)) {
        var h = raw(scope, at.value);
        if (typeof h === 'function') el.addEventListener(n.slice(2).toLowerCase(), h);
        continue;
      }
      el.setAttribute(n, interp(scope, at.value));
    }
    var src = tag === 'template' ? node.content : node;
    src.childNodes.forEach(function (c) { walk(c, scope, el, refs); });
    out.appendChild(el);
  }

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (patch) {
    var p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, p);
    if (this.__render) this.__render();
  };
  window.DCLogic = DCLogic;

  window.DCLite = {
    mount: function (Component, props) {
      var tpl = document.getElementById('dc-tpl');
      var root = document.getElementById('dc-root');
      var inst = new Component(props || {});
      inst.__render = function () {
        var vals = inst.renderVals ? inst.renderVals() : {};
        var frag = document.createDocumentFragment();
        var refs = [];
        tpl.content.childNodes.forEach(function (c) { walk(c, vals, frag, refs); });
        root.replaceChildren(frag);
        refs.forEach(function (r) { r[0](r[1]); });
      };
      inst.__render();
      if (location.hash) {
        var t = document.getElementById(location.hash.slice(1));
        if (t) t.scrollIntoView();
      }
      return inst;
    }
  };
})();
