// ====== CONFIG ======
// Optional visitor counter: put a URL that returns JSON like {"count": 123}. Leave "" to hide.
const COUNTER_URL = "";

const $ = id => document.getElementById(id);
const vivaMap = new Map(); // roll -> slot index
VIVA.forEach((s, i) => s[2].forEach(r => vivaMap.set(r, i)));
const total = WRITTEN.length, vTotal = vivaMap.size;

// Precompute group/slot info for ratio calculation
// Each slot in VIVA has: [date, time, rolls]
const slotInfos = VIVA.map((s, i) => {
  const rolls = s[2];
  const minRoll = Math.min(...rolls);
  const maxRoll = Math.max(...rolls);
  const vivaCount = rolls.length;
  // Count how many candidates passed MCQ (written) in range [minRoll, maxRoll]
  const writtenCount = WRITTEN.filter(r => r >= minRoll && r <= maxRoll).length;
  const ratio = vivaCount > 0 ? writtenCount / vivaCount : 0;
  return { minRoll, maxRoll, vivaCount, writtenCount, ratio, slotIndex: i, date: s[0], time: s[1] };
});

// Function to get slot info for a given roll or slot index
const getSlotInfoForRoll = r => {
  if (vivaMap.has(r)) {
    const idx = vivaMap.get(r);
    return slotInfos[idx];
  }
  return null;
};

const BINS = [[0,2,"≤ 2"],[2,3,"2 – 3"],[3,4,"3 – 4"],[4,5,"4 – 5"],[5,7,"5 – 7"],[7,10,"7 – 10"],[10,1e9,"10+"]];

$("sW").textContent = total.toLocaleString();
$("sV").textContent = vTotal.toLocaleString();
$("sQ").textContent = vTotal.toLocaleString();
$("sN").textContent = (total - vTotal).toLocaleString();
$("rt").textContent = vTotal.toLocaleString();

const modal = (html) => { $("mb").innerHTML = html; $("modal").classList.add("show"); };
$("mx").onclick = () => $("modal").classList.remove("show");
$("modal").onclick = e => { if (e.target.id === "modal") $("modal").classList.remove("show"); };
addEventListener("keydown", e => { if (e.key === "Escape") $("modal").classList.remove("show"); });
const slotTxt = i => `${VIVA[i][0]} · ${VIVA[i][1]}`;
const chips = a => `<div class="grid">${a.map(r => `<div class="chip v">${r}</div>`).join("")}</div>`;

// ---- Search
function search() {
  const v = $("q").value.trim(), n = +v, out = $("res");
  if (!/^\d{6}$/.test(v)) { out.innerHTML = `<div class="r na">Enter a valid 6-digit roll number.</div>`; return; }
  if (!WRITTEN.includes(n)) { out.innerHTML = `<div class="r na"><h3>${v}</h3><p>Not found in the written-exam list (did not pass MCQ).</p></div>`; return; }
  if (vivaMap.has(n)) {
    const info = getSlotInfoForRoll(n);
    const slotIdx = info.slotIndex;
    out.innerHTML = `<div class="r ok"><h3>✅ ${v} — Qualified for Viva</h3>
      <p>📅 Date: <b>${info.date}</b> &nbsp; ⏰ Reporting: <b>${info.time}</b></p>
      <p>Batch: ${VIVA[slotIdx][2].indexOf(n) + 1} of ${info.vivaCount} in this slot</p>
      <p>Group Range (${info.minRoll}–${info.maxRoll}): <b>${info.ratio.toFixed(2)}</b> (Group MCQ Passed: ${info.writtenCount} ÷ Viva: ${info.vivaCount})</p></div>`;
  } else {
    out.innerHTML = `<div class="r no"><h3>${v} — Not Selected for Viva</h3><p>Appeared in written exam but is not in the viva list.</p></div>`;
  }
}
$("go").onclick = search;
$("q").onkeydown = e => { if (e.key === "Enter") search(); };

// ---- Viva schedule
$("slots").innerHTML = VIVA.map((s, i) => {
  const info = slotInfos[i];
  return `<button class="slot" data-i="${i}"><b>${s[0]}</b>${s[1]} · ${s[2].length} candidates<br><small style="color:var(--mut)">Ratio: ${info.ratio.toFixed(2)} (${info.minRoll}–${info.maxRoll})</small></button>`;
}).join("");

$("slots").onclick = e => { 
  const b = e.target.closest(".slot"); 
  if (b) { 
    const i = +b.dataset.i; 
    const info = slotInfos[i];
    modal(`2>${slotTxt(i)}</h2>
      <p class="hint">${VIVA[i][2].length} candidates | Range: ${info.minRoll} – ${info.maxRoll} | Written Range Total: ${info.writtenCount} | Ratio: <b>${info.ratio.toFixed(2)}</b></p>
      ${chips(VIVA[i][2])}`); 
  } 
};

// ---- Roll grid
let filter = "all", shown = 0; const STEP = 600;
const list = () => filter === "v" ? WRITTEN.filter(r => vivaMap.has(r)) : filter === "n" ? WRITTEN.filter(r => !vivaMap.has(r)) : WRITTEN;
function render(reset) {
  const L = list(); if (reset) { shown = 0; $("grid").innerHTML = ""; }
  $("grid").insertAdjacentHTML("beforeend", L.slice(shown, shown + STEP).map(r => `<div class="chip${vivaMap.has(r) ? " v" : ""}" data-r="${r}">${r}</div>`).join(""));
  shown = Math.min(L.length, shown + STEP);
  $("more").style.display = shown < L.length ? "block" : "none";
  $("more").textContent = `Load more (${L.length - shown} left)`;
}
$("more").onclick = () => render(false);
$("tabs").onclick = e => { const t = e.target.closest(".tab"); if (!t) return; document.querySelectorAll(".tab").forEach(x => x.classList.remove("on")); t.classList.add("on"); filter = t.dataset.f; render(true); };
$("grid").onclick = e => { const c = e.target.closest(".chip"); if (c) { $("q").value = c.dataset.r; search(); scrollTo({ top: 0, behavior: "smooth" }); } };
render(true);

// ---- Ratio distribution
const groups = BINS.map(() => []);
slotInfos.forEach(info => {
  const x = info.ratio;
  const binIdx = BINS.findIndex(b => x > b[0] - (b[0] === 0 ? 1 : 0) && x <= b[1]);
  if (binIdx !== -1) {
    info.vivaRolls = VIVA[info.slotIndex][2];
    groups[binIdx].push(info);
  }
});

const max = Math.max(...groups.map(g => g.length));
$("bars").innerHTML = BINS.map((b, i) => {
  const candCount = groups[i].reduce((acc, g) => acc + g.vivaCount, 0);
  return `<div class="bar" data-i="${i}"><span>${b[2]}</span><div class="track"><div class="fill" style="width:${groups[i].length / (max || 1) * 100}%"></div></div><b>${groups[i].length} slots (${candCount} candidates)</b></div>`;
}).join("");

$("bars").onclick = e => { 
  const b = e.target.closest(".bar"); 
  if (b) { 
    const i = +b.dataset.i; 
    const allRolls = groups[i].flatMap(g => VIVA[g.slotIndex][2]).sort((a, b) => a - b);
    modal(`<h2>Ratio Range: ${BINS[i][2]}</h2><p class="hint">${groups[i].length} viva groups/slots (${allRolls.length} candidates)</p>${chips(allRolls)}`); 
  } 
};

$("ratioBtn").onclick = () => modal(`<h2>Group Ratio কি?</h2>
<p>প্রতিটি ভাইভা ব্যাচ/গ্রুপে (যেমন প্রথম ৬৪ জন) সর্বনিম্ন ও সর্বোচ্চ রোল রেঞ্জের মধ্যে (যেমন ৫০MD১১২ হতে ৫০৩১০১) কতজন লিখিত/MCQ পাস করেছে তাকে ওই ব্যাচের ভাইভা পরীক্ষার্থীর সংখ্যা (৬৪ জন) দিয়ে ভাগ করে গ্রুপের রেশিও নির্ণয় করা হয়েছে।</p>
<p><b>Group Ratio = গ্রুপ রেঞ্জের লিখিত পরীক্ষার্থী ÷ গ্রুপের ভাইভা ক্যান্ডিডেট</b></p>
<p class="hint">এটি গ্রুপের প্রতিযোগিতা পরিমাপের সঠিক ও নিখুঁত অনানুষ্ঠানিক বিশ্লেষণ।</p>`);

// ---- Visitor counter (optional)
if (COUNTER_URL) fetch(COUNTER_URL).then(r => r.json()).then(d => $("vis").textContent = d.count ?? "—").catch(() => {});
else $("vis").parentElement.style.display = "none";
