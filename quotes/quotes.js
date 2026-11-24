/* Edit the quotes here. Each one appears between two sections of the page, in order.
   "lines" is one string per line. "credit" is the small text underneath (leave "" for none).
   Add or remove entries freely; the number of quotes just needs to match the slots in index.html
   (4 slots: before mwah., before reasons, before snapshots, before the footer). */
window.QUOTES = [
  { lines: ["O my Luve is like a red, red rose", "That’s newly sprung in June;"],
    credit: "Robert Burns — A Red, Red Rose" },
  { lines: ["So fair art thou, my bonnie lass,", "So deep in luve am I;"],
    credit: "Robert Burns — A Red, Red Rose" },
  { lines: ["Till a’ the seas gang dry, my dear,", "And the rocks melt wi’ the sun;"],
    credit: "Robert Burns — A Red, Red Rose" },
  { lines: ["And I will come again, my luve,", "Though it were ten thousand mile."],
    credit: "Robert Burns — A Red, Red Rose" }
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
