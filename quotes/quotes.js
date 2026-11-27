/* Edit the quotes here. Each one appears between two sections of the page, in order.
   "lines" is one string per line. "credit" is the small text underneath (leave "" for none).
   Add or remove entries freely; the number of quotes just needs to match the slots in index.html
   (4 slots: before mwah., before reasons, before snapshots, before the footer). */
window.QUOTES = [
  { lines: ["O my Luve is like a red, red rose", "That’s newly sprung in June;"],
    credit: "Robert Burns — A Red, Red Rose" },
  { lines: ["I love thee with the breath,", "Smiles, tears, of all my life!"],
    credit: "Elizabeth Barrett Browning — Sonnet 43" },
  { lines: ["For thy sweet love remembered such wealth brings", "That then I scorn to change my state with kings."],
    credit: "William Shakespeare — Sonnet 29" },
  { lines: ["Love is not love", "Which alters when it alteration finds,"],
    credit: "William Shakespeare — Sonnet 116" }
];
(function(){
  (window.QUOTES || []).forEach(function(q, i){
    var a = document.querySelector('[data-quote="' + i + '"]'); if(!a) return;
    var w = document.createElement('div'); w.className = 'wrap';
    var p = document.createElement('p'); p.className = 'pq-t reveal';
    q.lines.forEach(function(l){ var s = document.createElement('span'); s.textContent = l; p.appendChild(s); });
    w.appendChild(p);
    if(q.credit){ var c = document.createElement('p'); c.className = 'pq-c reveal'; c.textContent = q.credit; w.appendChild(c); }
    a.setAttribute('aria-label', q.credit || 'Quote'); a.appendChild(w);
  });
})();
