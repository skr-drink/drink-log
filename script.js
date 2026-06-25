const key = "alcohol-day-log-v12";
const defaultKey = "alcohol-defaults-v3";
const quickPresetKey = "alcohol-quick-presets-v4";

const drinkOptions = ["微ビール","チューハイ","日本酒","焼酎","ビール","ワイン","スピリッツ","その他"];

const builtInDefaults = {
  "微ビール": { ml: 350, percent: 3 },
  "チューハイ": { ml: 500, percent: 6 },
  "日本酒": { ml: 180, percent: 15 },
  "焼酎": { ml: 100, percent: 25 },
  "ビール": { ml: 350, percent: 5 },
  "ワイン": { ml: 180, percent: 12 },
  "スピリッツ": { ml: 45, percent: 7 },
  "その他": { ml: "", percent: "" }
};

const builtInQuickPresets = [
  { id: "qp1", label: "ビール350", type: "ビール", ml: 350, p: 5 },
  { id: "qp2", label: "ビール500", type: "ビール", ml: 500, p: 5 },
  { id: "qp3", label: "チューハイ500", type: "チューハイ", ml: 500, p: 6 },
  { id: "qp4", label: "日本酒1合", type: "日本酒", ml: 180, p: 15 }
];

let data = JSON.parse(localStorage.getItem(key) || "[]");
let currentEditDate = null;
let currentManageTab = "settings";
let currentInputMode = "quick";
let lastQuickAddedDrinkId = null;
let calendarMonth = null;

function pureAlcohol(ml, p){
  return (Number(ml || 0) * (Number(p || 0) / 100) * 0.8) || 0;
}

function makeId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getTodayString(){
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekday(dateStr){
  if(!dateStr) return "";
  const d = new Date(dateStr);
  if(isNaN(d)) return "";
  const w = ["日","月","火","水","木","金","土"];
  return `（${w[d.getDay()]}）`;
}

function normalizeDateInput(raw){
  const value = String(raw || "").trim();
  if(!value) return "";

  const currentYear = new Date().getFullYear();

  if(/^\d{4}$/.test(value)){
    const mm = value.slice(0, 2);
    const dd = value.slice(2, 4);
    return `${currentYear}-${mm}-${dd}`;
  }

  if(/^\d{8}$/.test(value)){
    const yyyy = value.slice(0, 4);
    const mm = value.slice(4, 6);
    const dd = value.slice(6, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  const match = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(match){
    const yyyy = match[1];
    const mm = String(match[2]).padStart(2, "0");
    const dd = String(match[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
    return value;
  }

  return value;
}

function isValidDateString(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function focusElement(el){
  if(!el) return;
  setTimeout(() => el.focus(), 0);
}

function setData(){
  localStorage.setItem(key, JSON.stringify(data));
}

function getDefaults(){
  const stored = localStorage.getItem(defaultKey);
  if(!stored) return JSON.parse(JSON.stringify(builtInDefaults));
  try{
    const parsed = JSON.parse(stored);
    return { ...builtInDefaults, ...parsed };
  } catch {
    return JSON.parse(JSON.stringify(builtInDefaults));
  }
}

function saveDefaultsOnly(){
  const obj = {};
  drinkOptions.forEach(type => {
    obj[type] = {
      ml: document.getElementById(`default-ml-${type}`).value,
      percent: document.getElementById(`default-percent-${type}`).value
    };
  });
  localStorage.setItem(defaultKey, JSON.stringify(obj));
}

function getQuickPresets(){
  const stored = localStorage.getItem(quickPresetKey);
  if(!stored) return builtInQuickPresets;
  try{
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : builtInQuickPresets;
  } catch {
    return builtInQuickPresets;
  }
}

function saveQuickPresetsOnly(){
  const rows = [...document.querySelectorAll("#quickPresetSettings .preset-row")];
  const list = rows.map(row => ({
    id: row.dataset.presetId || makeId(),
    label: row.querySelector(".qp-label").value.trim(),
    type: row.querySelector(".qp-type").value,
    ml: row.querySelector(".qp-ml").value,
    p: row.querySelector(".qp-percent").value
  })).filter(item => item.label && item.type && item.ml && item.p);

  localStorage.setItem(quickPresetKey, JSON.stringify(list.length ? list : builtInQuickPresets));
}

function saveAllSettings(){
  saveDefaultsOnly();
  saveQuickPresetsOnly();
  renderQuickButtons();
  alert("設定を保存しました");
  closeManageModal(); // ←これ追加
}

function setInputMode(mode){
  currentInputMode = mode;
  document.getElementById("tab-normal").classList.toggle("active", mode === "normal");
  document.getElementById("tab-quick").classList.toggle("active", mode === "quick");
  document.getElementById("normalMode").classList.toggle("hidden", mode !== "normal");
  document.getElementById("quickMode").classList.toggle("hidden", mode !== "quick");

  if(mode === "normal"){
    const rows = document.querySelectorAll("#drinks .row");
    if(rows.length === 0){
      addRow({}, true);
    }
  }
}

function addRow(prefill = {}, focusType = false){
  const defaults = getDefaults();

  const div = document.createElement("div");
  div.className = "row";
  div.dataset.drinkId = prefill.id || makeId();

  const typeSelect = document.createElement("select");
  typeSelect.innerHTML = `
    <option value="">種類</option>
    ${drinkOptions.map(o => `<option value="${o}">${o}</option>`).join("")}
  `;

  const mlInput = document.createElement("input");
  mlInput.type = "number";
  mlInput.placeholder = "ml";
  mlInput.inputMode = "decimal";

  const pInput = document.createElement("input");
  pInput.type = "number";
  pInput.placeholder = "%";
  pInput.step = "0.1";
  pInput.inputMode = "decimal";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "danger";
  deleteBtn.textContent = "削除";
  deleteBtn.addEventListener("click", () => {
    div.remove();
    calcTotal();
  });

  typeSelect.addEventListener("change", () => {
    const selected = defaults[typeSelect.value] || { ml: "", percent: "" };
    mlInput.value = selected.ml ?? "";
    pInput.value = selected.percent ?? "";
    calcTotal();
  });

  mlInput.addEventListener("input", calcTotal);
  pInput.addEventListener("input", calcTotal);

  div.appendChild(typeSelect);
  div.appendChild(mlInput);
  div.appendChild(pInput);
  div.appendChild(deleteBtn);

  document.getElementById("drinks").appendChild(div);

  typeSelect.value = prefill.type || "";
  mlInput.value = prefill.ml || "";
  pInput.value = prefill.p || "";

  calcTotal();

  if(focusType){
    focusElement(typeSelect);
  }

  return div;
}

function addQuickPresetToForm(presetId){
  const preset = getQuickPresets().find(p => p.id === presetId);
  if(!preset) return;
  const row = addRow({
    id: makeId(),
    type: preset.type,
    ml: preset.ml,
    p: preset.p
  }, false);
  lastQuickAddedDrinkId = row.dataset.drinkId;
  calcTotal();
}

function undoLastQuickAdd(){
  if(!lastQuickAddedDrinkId){
    alert("取り消せる直前追加がありません");
    return;
  }

  const row = [...document.querySelectorAll("#drinks .row")]
    .find(r => r.dataset.drinkId === lastQuickAddedDrinkId);

  if(!row){
    lastQuickAddedDrinkId = null;
    alert("取り消せる直前追加がありません");
    return;
  }

  row.remove();
  lastQuickAddedDrinkId = null;
  calcTotal();
}

function deleteQuickItem(drinkId){
  const row = [...document.querySelectorAll("#drinks .row")]
    .find(r => r.dataset.drinkId === drinkId);

  if(!row) return;

  row.remove();

  if(lastQuickAddedDrinkId === drinkId){
    lastQuickAddedDrinkId = null;
  }

  calcTotal();
}

function renderQuickButtons(){
  const box = document.getElementById("quickButtons");
  const presets = getQuickPresets();
  box.innerHTML = "";

  presets.forEach(preset => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick-btn";
    btn.onclick = () => addQuickPresetToForm(preset.id);

    const g = pureAlcohol(preset.ml, preset.p).toFixed(1);

    btn.innerHTML = `
      <div>
        <div class="quick-title">${preset.label}</div>
        <div class="quick-sub">${preset.type}</div>
        <div class="quick-sub">${preset.ml}ml / ${preset.p}%</div>
      </div>
      <div class="quick-g">${g} g</div>
    `;
    box.appendChild(btn);
  });
}

function renderQuickSelectedList(){
  const box = document.getElementById("quickSelectedItems");
  if(!box) return;

  const drinks = collectDrinksFromForm();

  if(drinks.length === 0){
    box.innerHTML = `<div class="quick-selected-empty">まだ追加されていません</div>`;
    return;
  }

  box.innerHTML = drinks.map((d, index) => `
    <div class="quick-selected-row">
      <div class="quick-selected-main">
        <div class="quick-selected-name">
          ${String(index + 1).padStart(2, "0")}．${d.type || "種類未設定"}
        </div>
        <div class="quick-selected-sub">
          ${d.ml || 0}ml / ${d.p || 0}%
        </div>
      </div>

      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="quick-selected-g">${d.pureAlcohol}g</div>
        <button 
          type="button"
          class="danger quick-delete-btn"
          onclick="deleteQuickItem('${d.id}')"
        >
          削除
        </button>
      </div>
    </div>
  `).join("");
}

function renderDefaultSettings(){
  const defaults = getDefaults();
  const box = document.getElementById("defaultSettings");
  box.innerHTML = `
    <div class="grid3" style="font-weight:700;margin-bottom:8px;">
      <div>種類</div>
      <div>ml</div>
      <div>%</div>
    </div>
  `;

  drinkOptions.forEach(type => {
    const row = document.createElement("div");
    row.className = "grid3";
    row.style.marginBottom = "8px";
    row.innerHTML = `
      <label style="margin:0;">${type}</label>
      <input id="default-ml-${type}" type="number" step="1" value="${defaults[type]?.ml ?? ""}" inputmode="numeric">
      <input id="default-percent-${type}" type="number" step="0.1" value="${defaults[type]?.percent ?? ""}" inputmode="decimal">
    `;
    box.appendChild(row);
  });
}

function createQuickPresetRowElement(preset = {}){
  const row = document.createElement("div");
  row.className = "grid5 preset-row";
  row.dataset.presetId = preset.id || makeId();

  row.innerHTML = `
    <input type="text" class="qp-label" value="${preset.label ?? ""}" placeholder="例: いつものビール">

    <select class="qp-type">
      <option value="">種類</option>
      ${drinkOptions.map(o => `<option value="${o}" ${preset.type === o ? "selected" : ""}>${o}</option>`).join("")}
    </select>

    <div class="unit-input">
      <input type="number" class="qp-ml" step="1" value="${preset.ml ?? ""}" placeholder="量">
      <span class="unit-label">ml</span>
    </div>

    <div class="unit-input">
      <input type="number" class="qp-percent" step="0.1" value="${preset.p ?? ""}" placeholder="度数">
      <span class="unit-label">%</span>
    </div>

    <button type="button" class="danger preset-delete-btn">削除</button>
  `;

  const typeSelect = row.querySelector(".qp-type");
  const mlInput = row.querySelector(".qp-ml");
  const percentInput = row.querySelector(".qp-percent");

  typeSelect.addEventListener("change", () => {
    const selectedType = typeSelect.value;
    if(!selectedType){
      mlInput.value = "";
      percentInput.value = "";
      return;
    }

    // ←ここがポイント
    const defaultMlInput = document.getElementById(`default-ml-${selectedType}`);
    const defaultPercentInput = document.getElementById(`default-percent-${selectedType}`);

    if(defaultMlInput && defaultPercentInput){
      mlInput.value = defaultMlInput.value ?? "";
      percentInput.value = defaultPercentInput.value ?? "";
    } else {
      const defaults = getDefaults();
      const selected = defaults[selectedType] || { ml: "", percent: "" };
      mlInput.value = selected.ml ?? "";
      percentInput.value = selected.percent ?? "";
    }
  });

  row.querySelector(".preset-delete-btn").addEventListener("click", () => {
    row.remove();
  });

  return row;
}

function renderQuickPresetSettings(){
  const presets = getQuickPresets();
  const box = document.getElementById("quickPresetSettings");
  box.innerHTML = `
    <div class="grid5" style="font-weight:700;margin-bottom:8px;">
      <div>表示名</div>
      <div>種類</div>
      <div>ml</div>
      <div>%</div>
      <div>削除</div>
    </div>
  `;

  presets.forEach(preset => {
    box.appendChild(createQuickPresetRowElement(preset));
  });
}

function addQuickPresetRow(){
  document.getElementById("quickPresetSettings").appendChild(createQuickPresetRowElement());
}

function calcTotal(){
  let total = 0;
  document.querySelectorAll("#drinks .row").forEach(r => {
    const ml = r.children[1].value;
    const p = r.children[2].value;
    total += pureAlcohol(ml, p);
  });
  document.getElementById("total").innerText = total.toFixed(1) + " g";
  renderQuickSelectedList();
}

function collectDrinksFromForm(){
  const drinks = [];
  document.querySelectorAll("#drinks .row").forEach(r => {
    const type = r.children[0].value;
    const ml = r.children[1].value;
    const p = r.children[2].value;
    const id = r.dataset.drinkId || makeId();

    if(type || ml || p){
      drinks.push({
        id,
        type,
        ml,
        p,
        pureAlcohol: pureAlcohol(ml, p).toFixed(1)
      });
    }
  });
  return drinks;
}

function save(){
  const dateField = document.getElementById("date");
  const date = normalizeDateInput(dateField.value);
  dateField.value = date;

  const drinks = collectDrinksFromForm();
  const before = document.getElementById("before").value;
  const after = document.getElementById("after").value;
  const memo = document.getElementById("memo").value;

  if(!date){
    alert("日付を入力してください");
    focusElement(dateField);
    return;
  }

  if(!isValidDateString(date)){
    alert("日付は MMDD / YYYYMMDD / YYYY-MM-DD 形式で入力してください");
    focusElement(dateField);
    return;
  }

  if(drinks.length === 0){
    alert("お酒を1件以上入力してください");
    return;
  }

  if(currentEditDate){
    const target = data.find(d => d.date === currentEditDate);
    if(target){
      target.date = date;
      target.drinks = drinks;
      target.before = before;
      target.after = after;
      target.memo = memo;
    }
  } else {
    const existing = data.find(d => d.date === date);
    if(existing){
      existing.drinks = existing.drinks.concat(drinks);
      if(before) existing.before = existing.before ? `${existing.before} / ${before}` : before;
      if(after) existing.after = existing.after ? `${existing.after} / ${after}` : after;
      if(memo) existing.memo = existing.memo ? `${existing.memo} / ${memo}` : memo;
    } else {
      data.unshift({ date, drinks, before, after, memo });
    }
  }

  setData();
  resetForm(true);
  render();
  alert("保存しました");
}

function startEdit(date){
  const day = data.find(d => d.date === date);
  if(!day) return;

  currentEditDate = date;
  document.getElementById("date").value = day.date || "";
  document.getElementById("before").value = day.before || "";
  document.getElementById("after").value = day.after || "";
  document.getElementById("memo").value = day.memo || "";
  document.getElementById("drinks").innerHTML = "";

  day.drinks.forEach((d, index) => addRow(d, index === 0));

  document.getElementById("saveBtn").textContent = "修正を保存";
  document.getElementById("saveBtn").className = "saveedit";
  document.getElementById("cancelEditBtn").style.display = "inline-block";

  closeManageModal();
  window.scrollTo({ top: 0, behavior: "smooth" });
  calcTotal();
}

function cancelEdit(){
  resetForm(true);
}

function resetForm(focusFirstRow = false){
  currentEditDate = null;
  lastQuickAddedDrinkId = null;
  document.getElementById("date").value = getTodayString();
  document.getElementById("drinks").innerHTML = "";
  addRow({}, focusFirstRow);
  document.getElementById("before").value = "";
  document.getElementById("after").value = "";
  document.getElementById("memo").value = "";
  document.getElementById("saveBtn").textContent = "保存";
  document.getElementById("saveBtn").className = "";
  document.getElementById("cancelEditBtn").style.display = "none";
  calcTotal();
  setInputMode("quick");

  updateWeekday();
}

function deleteDay(date){
  data = data.filter(d => d.date !== date);
  setData();
  if(currentEditDate === date){
    resetForm(true);
  }
  render();
}

function deleteDrink(date, drinkId){
  const day = data.find(d => d.date === date);
  if(!day) return;

  day.drinks = day.drinks.filter(dr => dr.id !== drinkId);

  if(day.drinks.length === 0){
    data = data.filter(d => d.date !== date);
  }

  setData();
  render();
}

function render(){
  const list = document.getElementById("list");
  list.innerHTML = "";

  data.sort((a, b) => b.date.localeCompare(a.date));

  data.forEach(d => {
    let total = 0;
    d.drinks.forEach(x => {
      total += pureAlcohol(x.ml, x.p);
    });

    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
     <div class="item-head">
  <div>
    <b>${d.date}</b>
    <span style="color:#666; font-size:14px; margin-left:4px;">
      ${getWeekday(d.date)}
    </span>
  </div>
  <div style="font-weight:700; color:#7a5a00;">
    合計 ${total.toFixed(1)}g
  </div>
  <button onclick="startEdit('${d.date}')" class="edit">編集</button>
</div>

      <div style="margin-top:8px;">
        ${d.drinks.map(x => `
          <div class="drink-line">
            <span>• ${x.type} ${x.ml}ml ${x.p}% / ${x.pureAlcohol}g</span>
            <button onclick="deleteDrink('${d.date}','${x.id}')" style="background:#a33;padding:8px 10px;font-size:12px;border-radius:10px;">削除</button>
          </div>
        `).join("")}
      </div>

      <div style="margin-top:8px;">前：${d.before || ""}　後：${d.after || ""}</div>
      <div>メモ：${d.memo || ""}</div>

      <div class="inline-actions">
        <button onclick="deleteDay('${d.date}')" class="danger">この日を削除</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function openManageModal(){
  renderDefaultSettings();
  renderQuickPresetSettings();
  render();
  document.getElementById("manageModal").style.display = "block";
  document.getElementById("manage-tab-settings").classList.remove("active");
  document.getElementById("manage-tab-records").classList.remove("active");
  document.getElementById("manage-tab-report").classList.remove("active");

  document.getElementById("manageSettingsPane").classList.add("hidden");
  document.getElementById("manageRecordsPane").classList.add("hidden");
  document.getElementById("manageReportPane").classList.add("hidden");
}

function closeManageModal(){
  document.getElementById("manageModal").style.display = "none";
}

function setManageTab(tab){
  currentManageTab = tab;

  document.getElementById("manage-tab-settings").classList.toggle("active", tab === "settings");
  document.getElementById("manage-tab-records").classList.toggle("active", tab === "records");
  document.getElementById("manage-tab-report").classList.toggle("active", tab === "report");

  document.getElementById("manageSettingsPane").classList.toggle("hidden", tab !== "settings");
  document.getElementById("manageRecordsPane").classList.toggle("hidden", tab !== "records");
  document.getElementById("manageReportPane").classList.toggle("hidden", tab !== "report");
}

function openRecordsFromEntry(){
  openManageModal();
  setManageTab("records");
}

function getDailySummaryRows(startDate, endDate){
  return data
    .filter(d => d.date >= startDate && d.date <= endDate)
    .map(d => ({
      date: d.date,
      total: Number(d.drinks.reduce((sum, x) => sum + pureAlcohol(x.ml, x.p), 0).toFixed(1))
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function generateReport(){
  const start = document.getElementById("reportStart").value;
  const end = document.getElementById("reportEnd").value;
  const output = document.getElementById("reportOutput");

  if(!start || !end){
    alert("開始日と終了日を入力してください");
    return;
  }

  if(start > end){
    alert("開始日は終了日以前にしてください");
    return;
  }

  const rows = getDailySummaryRows(start, end);

  if(rows.length === 0){
    output.innerHTML = `
      <div class="report-sheet">
        <h4 style="margin:0 0 8px;">診察用レポート</h4>
        <div class="muted">対象期間：${start} ～ ${end}</div>
        <div style="margin-top:12px;">この期間の記録はありません。</div>
      </div>
    `;
    return;
  }

  const totalDays = rows.length;
  const totalGrams = rows.reduce((sum, r) => sum + r.total, 0);
  const avg = totalGrams / totalDays;

  output.innerHTML = `
    <div class="report-sheet">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <h4 style="margin:0 0 8px;">飲酒記録レポート</h4>
          <div class="muted">対象期間：${start} ～ ${end}</div>
        </div>
        <div class="muted">主治医提示用（日別サマリー）</div>
      </div>

      <div class="report-summary-grid">
        <div class="report-summary-box">
          <div class="label">記録日数</div>
          <div class="value">${totalDays}</div>
        </div>
        <div class="report-summary-box">
          <div class="label">期間合計</div>
          <div class="value">${totalGrams.toFixed(1)}g</div>
        </div>
        <div class="report-summary-box">
          <div class="label">1日平均</div>
          <div class="value">${avg.toFixed(1)}g</div>
        </div>
      </div>

      <div class="report-table-wrap">
        <table class="report-table">
          
<thead>
  <tr>
    <th>No</th>
    <th>日付</th>
    <th>曜日</th>
    <th>純アルコール量</th>
  </tr>
</thead>
<tbody>
  ${rows.map((r, index) => `
    <tr>
      <td>${String(index + 1).padStart(2, "0")}</td>
      <td>${r.date}</td>
      <td>${getWeekday(r.date)}</td>
      <td>${r.total.toFixed(1)}g</td>
    </tr>
  `).join("")}
</tbody>
        </table>
      </div>
    </div>
  `;
}


function printReport(){
  const output = document.getElementById("reportOutput");
  const hasReport = output.textContent && !output.textContent.includes("期間を選んで");

  if(!hasReport){
    alert("先に「集計を表示する」を押してください。");
    return;
  }

  const oldPrintArea = document.getElementById("printOnlyArea");
  if(oldPrintArea){
    oldPrintArea.remove();
  }

  const oldPrintStyle = document.getElementById("printOnlyStyle");
  if(oldPrintStyle){
    oldPrintStyle.remove();
  }

  const printStyle = document.createElement("style");
  printStyle.id = "printOnlyStyle";
  printStyle.textContent = `
    @media screen {
      #printOnlyArea {
        display: none;
      }
    }

    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm;
      }

      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #222 !important;
      }

      body > *:not(#printOnlyArea) {
        display: none !important;
      }

      #printOnlyArea {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #222 !important;
        font-family: sans-serif !important;
      }

      #printOnlyArea .report-sheet {
        width: 100% !important;
        max-width: none !important;
        margin: 0 auto !important;
        background: #fff !important;
      }

      #printOnlyArea .report-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        gap: 12px !important;
        margin-bottom: 10px !important;
      }

      #printOnlyArea h2 {
        margin: 0 0 6px !important;
        font-size: 18px !important;
      }

      #printOnlyArea .muted {
        color: #666 !important;
        font-size: 12px !important;
      }

      #printOnlyArea .summary-grid {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 8px !important;
        margin: 10px 0 12px !important;
      }

      #printOnlyArea .summary-card {
        border: 1px solid #ddd !important;
        border-radius: 8px !important;
        padding: 8px !important;
        background: #fafafa !important;
      }

      #printOnlyArea .summary-card .label {
        font-size: 11px !important;
        color: #666 !important;
      }

      #printOnlyArea .summary-card .value {
        font-size: 18px !important;
        font-weight: 700 !important;
        color: #7a5a00 !important;
      }

      #printOnlyArea table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 12px !important;
      }

      #printOnlyArea th,
      #printOnlyArea td {
        border: 1px solid #ddd !important;
        padding: 6px 8px !important;
        text-align: left !important;
        white-space: nowrap !important;
      }

      #printOnlyArea th {
        background: #f5f5f5 !important;
        font-weight: 700 !important;
      }
    }
  `;

  const printArea = document.createElement("div");
  printArea.id = "printOnlyArea";
  printArea.innerHTML = output.innerHTML;

  document.head.appendChild(printStyle);
  document.body.appendChild(printArea);

  window.print();
}

document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){
    closeDateCalendar();
    closeManageModal();
  }
});

function parseDateParts(dateStr){
  if(!isValidDateString(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function makeDateString(year, month, day){
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function openDateCalendar(){
  const selected = parseDateParts(document.getElementById("date").value);
  const today = new Date();
  calendarMonth = selected
    ? new Date(selected.year, selected.month - 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  renderDateCalendar();
  document.getElementById("dateCalendar").classList.remove("hidden");
}

function closeDateCalendar(){
  const calendar = document.getElementById("dateCalendar");
  if(calendar) calendar.classList.add("hidden");
}

function renderDateCalendar(){
  const calendar = document.getElementById("dateCalendar");
  if(!calendarMonth || !calendar) return;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const selectedDate = document.getElementById("date").value;
  const todayDate = getTodayString();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ["日","月","火","水","木","金","土"];

  const spacerButtons = Array.from({ length: firstDay }, () => (
    '<div class="date-day-spacer"></div>'
  )).join("");

  const dayButtons = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const value = makeDateString(year, month + 1, day);
    const classes = [
      "date-day",
      value === selectedDate ? "is-selected" : "",
      value === todayDate ? "is-today" : ""
    ].filter(Boolean).join(" ");

    return `<button type="button" class="${classes}" data-date="${value}">${day}</button>`;
  }).join("");

  calendar.innerHTML = `
    <div class="date-calendar-head">
      <button type="button" class="subbtn" data-month="-1">‹</button>
      <div class="date-calendar-title">${year}年 ${month + 1}月</div>
      <button type="button" class="subbtn" data-month="1">›</button>
    </div>
    <div class="date-calendar-grid">
      ${weekdays.map(w => `<div class="date-calendar-weekday">${w}</div>`).join("")}
      ${spacerButtons}
      ${dayButtons}
    </div>
  `;
}

document.getElementById("date").addEventListener("click", openDateCalendar);
document.getElementById("date").addEventListener("focus", openDateCalendar);

document.querySelector(".date-picker-field").addEventListener("pointerdown", function(e){
  if(e.target.closest("#dateCalendar")) return;
  openDateCalendar();
});

document.querySelector(".date-picker-field").addEventListener("keydown", function(e){
  if(e.key === "Enter" || e.key === " "){
    e.preventDefault();
    openDateCalendar();
  }
});

document.getElementById("dateCalendar").addEventListener("click", function(e){
  const monthButton = e.target.closest("[data-month]");
  if(monthButton){
    calendarMonth.setMonth(calendarMonth.getMonth() + Number(monthButton.dataset.month));
    renderDateCalendar();
    return;
  }

  const dayButton = e.target.closest("[data-date]");
  if(dayButton){
    document.getElementById("date").value = dayButton.dataset.date;
    updateWeekday();
    closeDateCalendar();
  }
});

document.addEventListener("click", function(e){
  if(e.target.closest(".date-picker-field")) return;
  closeDateCalendar();
});

function csvEscape(value){
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadTextFile(filename, content){
  const bom = "\uFEFF";
  const blob = new Blob([bom, content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}



function downloadDailyCsv(){
  const start = document.getElementById("reportStart").value;
  const end = document.getElementById("reportEnd").value;

  if(!start || !end){
    alert("開始日と終了日を入力してください");
    return;
  }

  if(start > end){
    alert("開始日は終了日以前にしてください");
    return;
  }

  const rows = getDailySummaryRows(start, end);

  if(rows.length === 0){
    alert("この期間の記録はありません");
    return;
  }

  const lines = [];
  lines.push(["No","日付","純アルコール量(g)"].map(csvEscape).join(","));

  rows.forEach((r, index) => {
    lines.push([
      String(index + 1).padStart(2, "0"),
      r.date,
      r.total.toFixed(1)
    ].map(csvEscape).join(","));
  });

  downloadTextFile(`飲酒記録_日別_${start}_to_${end}.csv`, lines.join("\n"));
}

function downloadDetailCsv(){
  const start = document.getElementById("reportStart").value;
  const end = document.getElementById("reportEnd").value;

  if(!start || !end){
    alert("開始日と終了日を入力してください");
    return;
  }

  if(start > end){
    alert("開始日は終了日以前にしてください");
    return;
  }

  const targetDays = data
    .filter(d => d.date >= start && d.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));

  const detailRows = [];

  targetDays.forEach(day => {
    day.drinks.forEach((drink, idx) => {
      detailRows.push({
        rowNo: detailRows.length + 1,
        date: day.date,
        dailyNo: idx + 1,
        type: drink.type || "",
        ml: drink.ml || "",
        percent: drink.p || "",
        pureAlcohol: pureAlcohol(drink.ml, drink.p).toFixed(1),
        before: day.before || "",
        after: day.after || "",
        memo: day.memo || ""
      });
    });
  });

  if(detailRows.length === 0){
    alert("この期間の記録はありません");
    return;
  }

  const lines = [];
  lines.push([
    "No",
    "日付",
    "日内No",
    "種類",
    "ml",
    "度数(%)",
    "純アルコール量(g)",
    "前の気持ち",
    "後の気持ち",
    "メモ"
  ].map(csvEscape).join(","));

  detailRows.forEach(r => {
    lines.push([
      String(r.rowNo).padStart(2, "0"),
      r.date,
      String(r.dailyNo).padStart(2, "0"),
      r.type,
      r.ml,
      r.percent,
      r.pureAlcohol,
      r.before,
      r.after,
      r.memo
    ].map(csvEscape).join(","));
  });

  downloadTextFile(`飲酒記録_明細_${start}_to_${end}.csv`, lines.join("\n"));
}

function updateWeekday(){
  const date = document.getElementById("date").value;
  document.getElementById("weekday").innerText = getWeekday(date);
}

(function init(){
  resetForm(true);
  renderQuickButtons();

  const today = getTodayString();
  document.getElementById("reportEnd").value = today;

  const start = new Date();
  start.setDate(start.getDate() - 13);
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  document.getElementById("reportStart").value = `${yyyy}-${mm}-${dd}`;

  render();
  renderQuickSelectedList();
})();
