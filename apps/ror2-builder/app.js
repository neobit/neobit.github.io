// RoR2 Build Planner — Scuzz-like layout (board + bottom tray)
// Left click: +1   | Right click: -1 | Shift+click: +10
const $ = (q, el=document) => el.querySelector(q);

const STORAGE_KEY = "ror2bp:saved_builds:v2";
const CURRENT_KEY = "ror2bp:current_build:v2";

const TYPE_ORDER = ["w","g","r","y","b","p","o","s","l","e"]; // matches items.json types

const state = {
  types: {}, // code -> label
  allItems: [],
  itemsByType: new Map(),
  filters: {
    search: "",
    types: new Set(),
    dlc: { sotv: true, sots: true, alloyedcollective: true },
    mods: { starstorm2: false }
  },
  build: {
    name: "Untitled Build",
    items: new Map(), // id -> qty
    order: [], // array of item ids in selection order (draggable)
  },
  lang: "en",
};

const ITEMS_FILES = {
  en: "./data/items-en.json",
  pt: "./data/items-pt.json",
};

let currentLang = "en";

async function loadItemsFile(lang, { resetTypeDefaults = false } = {}){
  const res = await fetch(ITEMS_FILES[lang] || ITEMS_FILES.en);
  const data = await res.json();

  state.types = data.types || {};
  state.allItems = data.items || [];

  state.byId = new Map(state.allItems.map(it => [it.id, it]));

  state.itemsByType = new Map();
  for (const it of state.allItems){
    if(!state.itemsByType.has(it.type)) state.itemsByType.set(it.type, []);
    state.itemsByType.get(it.type).push(it);
  }
  for (const [k, v] of state.itemsByType.entries()){
    v.sort((a,b) => a.name.localeCompare(b.name));
  }

  // Só no primeiro carregamento: definir defaults (mantém o comportamento atual do seu init)
  if (resetTypeDefaults){
    state.filters.types = new Set(Object.keys(state.types).filter(t => t !== "l" && t !== "e"));
  }

  renderTypeFilters();
  renderAll();
}

// Hover tooltip
const tooltip = document.createElement("div");
tooltip.className = "tooltip";
tooltip.style.display = "none";
document.body.appendChild(tooltip);

function itemSourceKey(item){
  // Prefer mod badge if present, otherwise DLC badge
  if(item.mod) return String(item.mod);
  if(item.dlc) return String(item.dlc);
  return null;
}

function sourceLabel(key){
  // Used only as a fallback if badge image is missing
  const k = String(key).toLowerCase();
  if(k === "sotv") return "S";
  if(k === "sots") return "S2";
  if(k === "alloyedcollective") return "AC";
  if(k === "starstorm2") return "SS";
  return k.slice(0,2).toUpperCase();
}

function sourceIconPath(key){
  // Put your small source icons here:
  //   ./assets/sources/sotv.png
  //   ./assets/sources/sots.png
  //   ./assets/sources/alloyedcollective.png
  //   ./assets/sources/starstorm2.png
  return `./assets/sources/${String(key).toLowerCase()}.png`;
}

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

// Convert lightweight markup to colored spans
function formatDesc(desc){
  if(!desc) return "";

  // Escapa tudo primeiro (segurança total)
  let out = escapeHtml(desc);

  // Quebra de linha manual
  out = out.replaceAll("\\n", "<br>");

  // mapa de cores permitidas
  const colors = {
    red: "c-red",
    green: "c-green",
    blue: "c-blue",
    yellow: "c-yellow",
    purple: "c-purple",
    cyan: "c-cyan",
    orange: "c-orange",
    gray: "c-gray",
  };

  // converte <color>texto</color>
  out = out.replace(/&lt;([a-z]+)&gt;([\s\S]*?)&lt;\/\1&gt;/g, (m, tag, inner) => {
    const cls = colors[tag];
    if (!cls) return m; // tag não permitida → fica texto
    return `<span class="${cls}">${inner}</span>`;
  });

  return out;
}


function typeLabel(code){
  return state.types[code] ?? code;
}

function typeClass(code){
  switch(code){
    case "w": return "common";
    case "g": return "uncommon";
    case "r": return "legendary";
    case "y": return "boss";
    case "b": return "lunar";
    case "p": return "void";
    case "s": return "syb";
    case "o": return "equipment";
    case "l": return "lunarequipment";
    case "e": return "elite";
    default: return "common";
  }
}

function encodeBuild(obj){
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)))
    .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function decodeBuild(str){
  const padded = str + "===".slice((str.length + 3) % 4);
  const b64 = padded.replaceAll("-","+").replaceAll("_","/");
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}

function persistCurrent(){
  const obj = buildToObject();
  localStorage.setItem(CURRENT_KEY, JSON.stringify(obj));
}
function loadCurrent(){
  try{
    const raw = localStorage.getItem(CURRENT_KEY);
    if(!raw) return;
    const obj = JSON.parse(raw);
    applyBuild(obj, {render:false});
  }catch{}
}

function loadSavedBuilds(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch{ return []; }
}
function saveBuildToStorage(buildObj){
  const builds = loadSavedBuilds();
  const i = builds.findIndex(b => b.name === buildObj.name);
  if(i>=0) builds[i] = buildObj;
  else builds.unshift(buildObj);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
}


function deleteBuildFromStorage(name){
  const builds = loadSavedBuilds().filter(b => b.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
}

function buildToObject(){
  return {
    name: state.build.name || "Untitled Build",
    items: Object.fromEntries(state.build.items.entries()),
    order: Array.isArray(state.build.order) ? state.build.order.slice() : [],
    version: "layout-v2"
  };
}
function applyBuild(obj, {render=true} = {}){
  state.build.name = obj.name || "Untitled Build";
  state.build.items = new Map(Object.entries(obj.items || {}).map(([k,v]) => [k, Number(v)]));

  // Restore selection order if present; otherwise derive from current items map order
  if(Array.isArray(obj.order)){
    state.build.order = obj.order.filter(id => state.build.items.has(id));
    // Add any missing ids at the end (keeps backward compatibility)
    for(const id of state.build.items.keys()){
      if(!state.build.order.includes(id)) state.build.order.push(id);
    }
  }else{
    state.build.order = [...state.build.items.keys()];
  }

  $("#buildName").value = state.build.name;
  persistCurrent();
  if(render){
    renderAll();
  }
}


function allowedByDlc(item){
  // DLC filtering: if item.dlc is null -> always allowed
  if(item.dlc){
    if(String(item.dlc).toLowerCase() === "starstorm2"){
      return state.filters.mods?.starstorm2 === true;
    }
    if(state.filters.dlc[item.dlc] === false) return false;
  }
  return true;
}

function searchMatches(item){
  const s = state.filters.search.trim().toLowerCase();
  if(!s) return true;
  const hay = (item.name + " " + item.id + " " + (item.desc || "")).toLowerCase();
  return hay.includes(s);
}

function matchesFilters(item){
  // Keep for legacy: used in a couple of places to mean "type + dlc"
  if(!state.filters.types.has(item.type)) return false;
  return allowedByDlc(item);
}

function adjustItem(id, delta){
  const cur = state.build.items.get(id) || 0;
  const next = Math.max(0, cur + delta);

  // Maintain selection order (first time an item is added, it goes to the end)
  if(cur === 0 && next > 0){
    if(!state.build.order.includes(id)) state.build.order.push(id);
  }

  if(next === 0){
    state.build.items.delete(id);
    // Remove from order when quantity reaches 0
    const i = state.build.order.indexOf(id);
    if(i >= 0) state.build.order.splice(i, 1);
  }else{
    state.build.items.set(id, next);
  }

  persistCurrent();
  renderAll();
}


function ensureOrderIntegrity(){
  // Make sure order contains only existing selected items, and includes all selected ids.
  if(!Array.isArray(state.build.order)) state.build.order = [];
  state.build.order = state.build.order.filter(id => state.build.items.has(id));
  for(const id of state.build.items.keys()){
    if(!state.build.order.includes(id)) state.build.order.push(id);
  }
}

function moveInOrder(dragId, targetId, place){
  // place: "before" | "after" | "end"
  ensureOrderIntegrity();
  const order = state.build.order;

  const from = order.indexOf(dragId);
  if(from < 0) return;

  order.splice(from, 1);

  if(place === "end" || !targetId){
    order.push(dragId);
    return;
  }

  let to = order.indexOf(targetId);
  if(to < 0){
    order.push(dragId);
    return;
  }
  if(place === "after") to += 1;

  order.splice(to, 0, dragId);
}


function makeItemNode(item, qty, {tray=false} = {}){
  const div = document.createElement("div");
  div.className = "item" + (tray ? " tray-item" : "");

  if(tray){
    div.draggable = true;
    div.dataset.id = item.id;

    div.addEventListener("dragstart", (ev) => {
      div.classList.add("dragging");
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", item.id);
      // some browsers need a drag image; default is fine
    });

    div.addEventListener("dragend", () => {
      div.classList.remove("dragging");
    });
  }



  const img = document.createElement("img");
  img.src = item.icon;
  img.removeAttribute("title");


  const fallback = document.createElement("div");
  fallback.className = "fallback";
  fallback.textContent = item.name;

  img.addEventListener("error", () => {
    div.innerHTML = "";
    div.appendChild(fallback);
    if(qty > 0){
      const b = document.createElement("div");
      b.className = "qty-badge";
      b.textContent = String(qty);
      div.appendChild(b);
    }
  });

  div.appendChild(img);

  // DLC/Mod badge inside icon
  const sourceKey = itemSourceKey(item);
  if(sourceKey){
    const badge = document.createElement("div");
    badge.className = "source-badge";
    badge.dataset.source = String(sourceKey).toLowerCase();

    const bimg = document.createElement("img");
    bimg.src = sourceIconPath(sourceKey);
    bimg.alt = String(sourceKey);

    const btxt = document.createElement("span");
    btxt.className = "source-badge-text";
    btxt.textContent = sourceLabel(sourceKey);

    bimg.addEventListener("error", () => {
      // If the image doesn't exist, fall back to text
      badge.innerHTML = "";
      badge.appendChild(btxt);
      badge.classList.add("text");
    });

    badge.appendChild(bimg);
    div.appendChild(badge);
  }

  if(qty > 0){
    const badge = document.createElement("div");
    badge.className = "qty-badge";
    badge.textContent = String(qty);
    div.appendChild(badge);
  }

  div.addEventListener("click", (ev) => {
    const plus = ev.shiftKey ? 10 : 1;
    adjustItem(item.id, plus);
  });
  div.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    adjustItem(item.id, -1);
  });
  // Tooltip
div.addEventListener("mouseenter", () => {
  tooltip.innerHTML = `
    <div class="tooltip-title">${escapeHtml(item.name)}</div>
    <div class="tooltip-desc">${formatDesc(item.desc)}</div>
    <div class="tooltip-stack">
      Stack Type: <strong>${escapeHtml(item.stack_type || "—")}</strong>
    </div>
  `;
  tooltip.style.display = "block";
});

div.addEventListener("mousemove", (ev) => {
  const pad = 14;
  const margin = 8;

  // posição desejada (perto do mouse)
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;

  // aplica primeiro pra medir o tamanho real
  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;

  const rect = tooltip.getBoundingClientRect();

  // limites máximos dentro da viewport
  const maxX = window.innerWidth  - rect.width  - margin;
  const maxY = window.innerHeight - rect.height - margin;

  // clamp: encosta no limite ao invés de mudar de lado/diminuir
  if (x > maxX) x = maxX;
  if (y > maxY) y = maxY;

  // garante que não sai pelo lado esquerdo/cima
  if (x < margin) x = margin;
  if (y < margin) y = margin;

  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;
});


div.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
});
  return div;
}

function renderTypeFilters(){
  const wrap = $("#typeFilters");
  const allowSyb = state.filters.mods?.starstorm2 === true;
  wrap.innerHTML = "";

  for(const code of TYPE_ORDER){
    if(code === "s" && !allowSyb) continue;
    if(!(code in state.types)) continue;
    const label = typeLabel(code);
    const id = `type_${code}`;

    const el = document.createElement("label");
    el.className = "mini-check";
    const checked = state.filters.types.has(code) ? "checked" : "";
    el.innerHTML = `<input id="${id}" type="checkbox" ${checked}><span>${escapeHtml(label)}</span>`;
    wrap.appendChild(el);

    const cb = el.querySelector("input");
    cb.addEventListener("change", () => {
      if(cb.checked) state.filters.types.add(code);
      else state.filters.types.delete(code);
      renderAll();
    });
  }
}



function renderGrid(){
  const grid = $("#grid");
  grid.innerHTML = "";

  for(const code of TYPE_ORDER){
    if(code === "s" && state.filters.mods?.starstorm2 !== true) continue;
    if(!state.filters.types.has(code)) continue;

    const list = state.itemsByType.get(code) || [];
    const allowed = list.filter(allowedByDlc);
    const hasSearch = state.filters.search.trim().length > 0;
    const matchCount = hasSearch ? allowed.filter(searchMatches).length : allowed.length;

    const stack = document.createElement("div");
    stack.className = `stack ${typeClass(code)}`;

    // Top panel (all items)
    const top = document.createElement("section");
    top.className = "panel top";
    top.innerHTML = `
      <div class="col-head">
        <div>${escapeHtml(typeLabel(code))}</div>
        <div class="count">${matchCount}</div>
      </div>
      <div class="items-grid"></div>
    `;
    const topGrid = top.querySelector(".items-grid");
    for(const item of allowed){
      const qty = state.build.items.get(item.id) || 0;
      const node = makeItemNode(item, qty, {tray:false});
      if(hasSearch){
        node.classList.add(searchMatches(item) ? "match" : "dimmed");
      }
      topGrid.appendChild(node);
    }

    // Bottom panel (selected items of this type)
    const bottom = document.createElement("section");
    bottom.className = "panel bottom";
    bottom.innerHTML = `
      <div class="col-head">
        <div>${escapeHtml(typeLabel(code))}</div>
        <div class="count">selected</div>
      </div>
      <div class="tray-grid"></div>
    `;
    const bottomGrid = bottom.querySelector(".tray-grid");

    // Drag & drop reordering (selected tray)
    bottomGrid.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
    });

    bottomGrid.addEventListener("drop", (ev) => {
      ev.preventDefault();

      const dragId = ev.dataTransfer.getData("text/plain");
      if(!dragId) return;

      const dragItem = state.byId.get(dragId);
      if(!dragItem || dragItem.type !== code) return; // only reorder within same column

      const targetEl = ev.target.closest(".tray-item");
      if(targetEl && targetEl.dataset.id){
        const targetId = targetEl.dataset.id;
        if(targetId === dragId) return;

        const rect = targetEl.getBoundingClientRect();
        const place = (ev.clientX > rect.left + rect.width / 2) ? "after" : "before";

        moveInOrder(dragId, targetId, place);
      }else{
        // Dropped on empty space: move to end (within this type)
        // Find last selected item of this type in global order and insert after it.
        ensureOrderIntegrity();
        const idsOfType = state.build.order.filter(id => {
          const it = state.byId.get(id);
          return it && it.type === code && (state.build.items.get(id) || 0) > 0;
        });

        if(idsOfType.length === 0){
          moveInOrder(dragId, null, "end");
        }else{
          moveInOrder(dragId, idsOfType[idsOfType.length - 1], "after");
        }
      }

      persistCurrent();
      renderAll();
    });


    ensureOrderIntegrity();

    const selected = (state.build.order || [])
      .map((id) => ({ item: state.byId.get(id), qty: state.build.items.get(id) || 0 }))
      .filter(x => x.item && x.qty > 0 && x.item.type === code);


    for(const {item, qty} of selected){
      const node = makeItemNode(item, qty, {tray:true});
      if(hasSearch){
        node.classList.add(searchMatches(item) ? "match" : "dimmed");
      }
      bottomGrid.appendChild(node);
    }

    stack.appendChild(top);
    stack.appendChild(bottom);
    grid.appendChild(stack);
  }
}

function openModal(title, bodyNode, actions=[]){
  const modal = $("#modal");
  $("#modalTitle").textContent = title;
  const body = $("#modalBody");
  body.innerHTML = "";
  body.appendChild(bodyNode);

  const act = $("#modalActions");
  act.innerHTML = "";
  for(const a of actions){
    const btn = document.createElement("button");
    btn.className = "btn mini";
    btn.type = a.type || "button";
    btn.value = a.value || "";
    btn.textContent = a.label;
    btn.addEventListener("click", a.onClick || (()=>{}));
    act.appendChild(btn);
  }
  modal.showModal();
}

function wireUI(){

    const cbEn = $("#lang_en");
  const cbPt = $("#lang_pt");

  async function setLang(next){
    state.lang = next;

    // mantém comportamento "radio"
    cbEn.checked = (next === "en");
    cbPt.checked = (next === "pt");

    // recarrega items e re-renderiza tudo
    await loadItemsForLang();
    renderTypeFilters();
    renderAll();
  }

  cbEn?.addEventListener("change", () => {
    if(cbEn.checked) setLang("en");
    else cbEn.checked = true; // impede ficar sem nenhum marcado
  });

  cbPt?.addEventListener("change", () => {
    if(cbPt.checked) setLang("pt");
    else cbPt.checked = true; // impede ficar sem nenhum marcado
  });

  $("#search").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderAll();
  });

  $("#dlc_sotv").addEventListener("change", (e) => { state.filters.dlc.sotv = e.target.checked; renderAll(); });
  $("#dlc_sots").addEventListener("change", (e) => { state.filters.dlc.sots = e.target.checked; renderAll(); });
  $("#dlc_alloyedcollective").addEventListener("change", (e) => { state.filters.dlc.alloyedcollective = e.target.checked; renderAll(); });

  const modStarstorm2 = $("#mod_starstorm2");
  if(modStarstorm2){
    modStarstorm2.addEventListener("change", (e) => {
      state.filters.mods.starstorm2 = e.target.checked;

      // Sybilline column only when Starstorm2 enabled
      if(state.filters.mods.starstorm2) state.filters.types.add("s");
      else state.filters.types.delete("s");

      renderTypeFilters();
      renderAll();
    });
  }

  $("#buildName").addEventListener("input", (e) => {
    state.build.name = e.target.value || "Untitled Build";
    persistCurrent();
  });

  $("#resetBuild").addEventListener("click", () => {
    state.build.items.clear();
    state.build.order = [];
    persistCurrent();
    renderAll();
  });

  $("#saveBuild").addEventListener("click", () => {
    const obj = buildToObject();
    saveBuildToStorage(obj);
    const msg = document.createElement("div");
    msg.innerHTML = `<p>Saved <strong>${escapeHtml(obj.name)}</strong> in this browser.</p>`;
    openModal("Saved", msg, [{label:"Close", type:"submit", value:"close"}]);
  });

  $("#loadBuild").addEventListener("click", () => {
    const builds = loadSavedBuilds();
    const wrap = document.createElement("div");
    if(builds.length === 0){
      wrap.innerHTML = `<p>No saved builds yet.</p>`;
      openModal("Load build", wrap, [{label:"Close", type:"submit", value:"close"}]);
      return;
    }

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";

    for(const b of builds){
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.padding = "8px";
      row.style.border = "1px solid rgba(255,255,255,.10)";
      row.style.borderRadius = "6px";
      row.style.background = "rgba(0,0,0,.25)";
      row.innerHTML = `
        <div>
          <div style="font-weight:700; font-size:12px;">${escapeHtml(b.name)}</div>
          <div style="color: rgba(231,239,233,.60); font-size:11px;">${Object.keys(b.items||{}).length} items</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn mini" data-action="load">Load</button>
          <button class="btn mini" data-action="delete" style="border-color: rgba(255,80,80,.35); color: rgba(255,200,200,.92);">Delete</button>
        </div>
      `;

      const loadBtn = row.querySelector('button[data-action="load"]');
      const delBtn  = row.querySelector('button[data-action="delete"]');

      loadBtn.addEventListener("click", () => {
        applyBuild(b);
        $("#modal").close();
      });

      delBtn.addEventListener("click", () => {
        if(!confirm(`Delete build "${b.name}"?`)) return;
        deleteBuildFromStorage(b.name);
        row.remove();

        // if list is empty, show placeholder
        if(list.children.length === 0){
          wrap.innerHTML = `<p>No saved builds yet.</p>`;
        }
      });

      list.appendChild(row);
    }
    wrap.appendChild(list);
    openModal("Load build", wrap, [{label:"Close", type:"submit", value:"close"}]);
  });

  $("#exportBuild").addEventListener("click", () => {
    const obj = buildToObject();
    const ta = document.createElement("textarea");
    ta.value = JSON.stringify(obj, null, 2);
    openModal("Export build (JSON)", ta, [
      {label:"Copy", onClick: async ()=>{ await navigator.clipboard.writeText(ta.value); }},
      {label:"Close", type:"submit", value:"close"}
    ]);
  });

  $("#importBuild").addEventListener("click", () => {
    const ta = document.createElement("textarea");
    ta.placeholder = "Paste build JSON here...";
    openModal("Import build (JSON)", ta, [
      {label:"Import", onClick: ()=>{
        try{
          const obj = JSON.parse(ta.value);
          applyBuild(obj);
          $("#modal").close();
        }catch{
          alert("Invalid JSON");
        }
      }},
      {label:"Close", type:"submit", value:"close"}
    ]);
  });

  $("#shareBuild").addEventListener("click", async () => {
    const obj = buildToObject();
    const code = encodeBuild(obj);
    const url = new URL(location.href);
    url.hash = `b=${code}`;
    await navigator.clipboard.writeText(url.toString());
    const node = document.createElement("div");
    node.innerHTML = `<p>Copied share link:</p><p><code>${escapeHtml(url.toString())}</code></p>`;
    openModal("Share", node, [{label:"Close", type:"submit", value:"close"}]);
  });
}






function updateLayoutVars(){
  const visibleTypes = TYPE_ORDER.filter(code => state.filters.types.has(code) && !(code === "s" && state.filters.mods?.starstorm2 !== true));
  const colsCount = Math.max(1, visibleTypes.length);

  const grid = $("#grid");
  if(!grid) return;

  // Always 5 icons per row
  const gridCols = 5;
  const gap = 4;
  const pad = 8;
  const headH = 26;

  // Column width available on screen (no horizontal scroll)
  const totalGap = (colsCount - 1) * 10; // outer grid gap between columns
  const colW = Math.max(140, Math.floor((grid.clientWidth - totalGap) / colsCount));
  const availW = colW - pad*2;

  // Rows needed to show ALL icons for the largest category currently visible
  let maxRowsTop = 1;
  for(const code of visibleTypes){
    const list = state.itemsByType.get(code) || [];
    const visibleCount = list.reduce((acc, it) => acc + (matchesFilters(it) ? 1 : 0), 0);
    const rows = Math.max(1, Math.ceil(visibleCount / gridCols));
    if(rows > maxRowsTop) maxRowsTop = rows;
  }

  // Bottom rows: keep a minimum empty area (like the original planner)
  let computedBottom = 1;
  for(const code of visibleTypes){
    let selectedCount = 0;
    for(const [id] of state.build.items.entries()){
      const it = state.byId.get(id);
      if(it && it.type === code) selectedCount++;
    }
    const rows = Math.max(1, Math.ceil(selectedCount / gridCols));
    if(rows > computedBottom) computedBottom = rows;
  }
  const minBottomRows = 3;
  const maxRowsBottom = Math.max(minBottomRows, computedBottom);

  // Icon size is divided equally by the available width of the column.
  const icon = Math.max(14, Math.floor((availW - gap*(gridCols-1)) / gridCols));

  // Panel heights computed to fit all rows (same for all columns)
  const topH = headH + pad*2 + (icon * maxRowsTop) + gap * Math.max(0, maxRowsTop - 1);
  const bottomH = headH + pad*2 + (icon * maxRowsBottom) + gap * Math.max(0, maxRowsBottom - 1);

  grid.style.setProperty("--col-count", String(colsCount));
  grid.style.setProperty("--grid-cols", String(gridCols));
  grid.style.setProperty("--grid-rows-top", String(maxRowsTop));
  grid.style.setProperty("--grid-rows-bottom", String(maxRowsBottom));
  grid.style.setProperty("--icon", `${icon}px`);
  grid.style.setProperty("--gap", `${gap}px`);
  grid.style.setProperty("--panel-top-h", `${topH}px`);
  grid.style.setProperty("--panel-bottom-h", `${bottomH}px`);
}

function renderAll(){
  updateLayoutVars();
  renderGrid();
}

function applyItemsData(data){
  state.types = data.types || {};
  state.allItems = data.items || [];

  state.byId = new Map(state.allItems.map(it => [it.id, it]));

  state.itemsByType = new Map();
  for(const it of state.allItems){
    if(!state.itemsByType.has(it.type)) state.itemsByType.set(it.type, []);
    state.itemsByType.get(it.type).push(it);
  }
  for(const [k,v] of state.itemsByType.entries()){
    v.sort((a,b) => a.name.localeCompare(b.name));
  }
}

async function loadItemsForLang(){
  const url = `./data/items-${state.lang}.json`;
  const res = await fetch(url);
  const data = await res.json();
  applyItemsData(data);
}


async function init(){
  await loadItemsForLang();

  state.byId = new Map(state.allItems.map(it => [it.id, it]));

  state.itemsByType = new Map();
  for(const it of state.allItems){
    if(!state.itemsByType.has(it.type)) state.itemsByType.set(it.type, []);
    state.itemsByType.get(it.type).push(it);
  }
  for(const [k,v] of state.itemsByType.entries()){
    v.sort((a,b) => a.name.localeCompare(b.name));
  }

  state.filters.types = new Set(Object.keys(state.types).filter(t => t !== "l" && t !== "e" && t !== "s"));
  renderTypeFilters();

  loadCurrent();
  $("#buildName").value = state.build.name;

  wireUI();
  window.addEventListener("resize", () => { renderAll(); });
  renderAll();

  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  if(hash.startsWith("b=")){
    try{
      const obj = decodeBuild(hash.slice(2));
      applyBuild(obj);
    }catch{}
  }
}

init();
