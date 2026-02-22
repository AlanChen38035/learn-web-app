/* --- scripts/english-editor.js --- */

let currentMode = 'words';
let currentViewMode = 'list'; // 'list' or 'table'
let dataStore = { words: { sources: [] }, textbook: { sources: [] } };
let editingTarget = null;
let isInlineEditing = false;

// 詞性常數
const POS_OPTIONS = [
'adj.', 'adv.', 'n.', 'n. [C]', 'n. [U]', 
'vi.', 'vt.', 'pron.', 'prep.', 'conj.', 
'interj.', 'pl.', 'sing.', 'phr.', 'v.'
];

let expandedKeys = new Set();

const ICONS = {
chevron: '<svg class="chevron-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
drag: '<svg viewBox="0 0 24 24"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
delete: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
add: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
book: '<svg viewBox="0 0 24 24" fill="#4dabf7" style="width:24px;height:24px;"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>'
};

document.addEventListener('DOMContentLoaded', async () => {
await loadData();
if (expandedKeys.size === 0 && dataStore.words.sources.length > 0) {
expandedKeys.add('source-0');
}
    renderEditor();
    // 預設渲染
    refreshCurrentView();

const scrollY = localStorage.getItem('editor_scroll');
    if(scrollY) window.scrollTo(0, parseInt(scrollY));
    if(scrollY && currentViewMode === 'list') window.scrollTo(0, parseInt(scrollY));

if(localStorage.getItem('editor_autosave_words') || localStorage.getItem('editor_autosave_textbook')) {
updateStatus("已載入草稿");
@@ -66,10 +68,36 @@
currentMode = mode;
document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
document.getElementById(`tab-${mode}`).classList.add('active');
    
    // Reset expanded keys when switching tabs to avoid confusion, but keep at least one open
expandedKeys.clear();
    if (currentMode === 'words' && dataStore.words.sources.length > 0) expandedKeys.add('source-0');
    else if (currentMode === 'textbook' && dataStore.textbook.sources.length > 0) expandedKeys.add('source-0');
    renderEditor();
    const sources = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    if (sources.length > 0) expandedKeys.add('source-0');
    
    refreshCurrentView();
}

function switchViewMode(mode) {
    currentViewMode = mode;
    const listContainer = document.getElementById('editor-content');
    const tableContainer = document.getElementById('table-editor-content');

    if (mode === 'list') {
        listContainer.classList.add('view-mode-active');
        tableContainer.classList.remove('view-mode-active');
    } else {
        listContainer.classList.remove('view-mode-active');
        tableContainer.classList.add('view-mode-active');
    }
    refreshCurrentView();
}

function refreshCurrentView() {
    if (currentViewMode === 'list') {
        renderEditor();
    } else {
        renderTableEditor();
    }
}

function autoSave() {
@@ -80,8 +108,11 @@
updateStatus(`已自動儲存 (${new Date().toLocaleTimeString()})`);
localStorage.setItem('editor_scroll', currentScroll);

    renderEditor();
    window.scrollTo(0, currentScroll);
    // 若為列表模式則重繪以更新狀態；表格模式為了效能與焦點，通常不全頁重繪，僅在增刪時重繪
    if (currentViewMode === 'list') {
        renderEditor();
        window.scrollTo(0, currentScroll);
    }
}

function updateStatus(msg) { document.getElementById('auto-save-msg').innerText = msg; }
@@ -98,24 +129,7 @@
function resetToOriginal() { clearDraft(); }

// ============================================================
// Markdown Parser (簡易版)
// ============================================================
function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text); // 先轉義 HTML 防止 XSS
    // 粗體 **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<span class="md-bold">$1</span>');
    // 斜體 *text*
    html = html.replace(/\*(.*?)\*/g, '<span class="md-italic">$1</span>');
    // 螢光筆 ==text==
    html = html.replace(/==(.*?)==/g, '<span class="md-highlight">$1</span>');
    // 換行
    html = html.replace(/\n/g, '<br>');
    return html;
}

// ============================================================
// Render Logic
// Render Logic (List View)
// ============================================================

function renderEditor() {
@@ -206,7 +220,6 @@
                           </div>
                       `;
} else {
                        // 課文模式：支援 Markdown 解析，並儲存 raw data
contentHtml = `
                           <div class="item-content textbook-layout">
                               <div class="editable-cell tb-en" 
@@ -242,6 +255,109 @@
});
}

// ============================================================
// Render Logic (Table View - Excel like)
// ============================================================

function renderTableEditor() {
    const container = document.getElementById('table-editor-content');
    container.innerHTML = '';

    const sources = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    if(!sources || sources.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center;">無資料</div>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'excel-table';

    let theadHtml = `
        <thead>
            <tr>
                <th style="width:120px;">版本</th>
                <th style="width:150px;">課程</th>
    `;
    if (currentMode === 'words') {
        theadHtml += `
            <th style="width:150px;">英文 (Word)</th>
            <th style="width:80px;">詞性 (Pos)</th>
            <th>中文 (Chinese)</th>
        `;
    } else {
        theadHtml += `
            <th>英文 (English) - Markdown</th>
            <th>中文 (Chinese) - Markdown</th>
        `;
    }
    theadHtml += `<th style="width:60px;">操作</th></tr></thead>`;
    
    const tbody = document.createElement('tbody');
    let globalRowIndex = 0;

    sources.forEach((src, srcIdx) => {
        if(src.lessons) {
            src.lessons.forEach((lesson, lIdx) => {
                const items = currentMode === 'words' ? (lesson.vocabulary || []) : (lesson.sentences || []);
                
                items.forEach((item, iIdx) => {
                    const tr = document.createElement('tr');
                    
                    const infoHtml = `
                        <td class="cell-readonly">${escapeHtml(src.name)}</td>
                        <td class="cell-readonly">L${lesson.lesson} ${escapeHtml(lesson.title)}</td>
                    `;
                    
                    let fieldsHtml = '';
                    if (currentMode === 'words') {
                        fieldsHtml = `
                            <td><div class="excel-cell" tabindex="0" data-coord="${globalRowIndex}-0" onclick="tableEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'word')">${escapeHtml(item.word)}</div></td>
                            <td><div class="excel-cell" tabindex="0" data-coord="${globalRowIndex}-1" onclick="tableEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'pos')">${escapeHtml(item.pos)}</div></td>
                            <td><div class="excel-cell" tabindex="0" data-coord="${globalRowIndex}-2" onclick="tableEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'chinese')">${escapeHtml(item.chinese)}</div></td>
                        `;
                    } else {
                        fieldsHtml = `
                            <td><div class="excel-cell" tabindex="0" data-coord="${globalRowIndex}-0" data-raw="${escapeHtml(item.en)}" onclick="tableEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'en')">${parseMarkdown(item.en)}</div></td>
                            <td><div class="excel-cell" tabindex="0" data-coord="${globalRowIndex}-1" data-raw="${escapeHtml(item.ch)}" onclick="tableEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'ch')">${parseMarkdown(item.ch)}</div></td>
                        `;
                    }

                    const actionHtml = `
                        <td style="text-align:center;">
                            <button class="icon-btn-sm danger" tabindex="-1" onclick="delItemTable(${srcIdx}, ${lIdx}, ${iIdx})">
                                <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                        </td>
                    `;

                    tr.innerHTML = infoHtml + fieldsHtml + actionHtml;
                    tbody.appendChild(tr);
                    globalRowIndex++;
                });

                const addRow = document.createElement('tr');
                addRow.innerHTML = `
                    <td colspan="${currentMode === 'words' ? 6 : 5}" style="background:#fcfcfc; text-align:center; padding:8px; cursor:pointer; color:var(--primary); font-weight:600;" onclick="addItemTable(${srcIdx}, ${lIdx})">
                        + 新增項目到 [${escapeHtml(src.name)}] L${lesson.lesson}
                    </td>
                `;
                tbody.appendChild(addRow);
                globalRowIndex++; 
            });
        }
    });

    table.innerHTML = theadHtml;
    table.appendChild(tbody);
    container.appendChild(table);

    setupTableKeydown(container);
}

// ------------------------------------------------------------
// Shared Utils
// ------------------------------------------------------------

function createInsertSeparator(srcIdx, lIdx, insertIndex) {
const div = document.createElement('div');
div.className = 'insert-separator';
@@ -257,11 +373,11 @@
function toggleAccordion(key) {
if (expandedKeys.has(key)) expandedKeys.delete(key);
else expandedKeys.add(key);
    autoSave(); 
    if(currentViewMode === 'list') renderEditor();
}

// ============================================================
// Inline Edit (支援 Datalist, Textarea, Markdown)
// Inline Edit (List View)
// ============================================================

function startInlineEdit(element, srcIdx, lIdx, iIdx, field) {
@@ -270,7 +386,6 @@

isInlineEditing = true;

    // 優先讀取 data-raw (用於 Markdown)，若無則用 innerText
let currentValue = element.getAttribute('data-raw');
if (currentValue === null) {
currentValue = element.innerText;
@@ -281,12 +396,10 @@

let input;
if (currentMode === 'textbook') {
        // 課文模式使用 textarea
input = document.createElement('textarea');
input.className = 'inline-textarea';
input.value = currentValue;
} else if (field === 'pos') {
        // 單字模式-詞性
input = document.createElement('input');
input.type = 'text';
input.value = currentValue;
@@ -303,7 +416,6 @@
});
element.appendChild(datalist);
} else {
        // 單字模式-一般
input = document.createElement('input');
input.type = 'text';
input.value = currentValue;
@@ -318,13 +430,11 @@

input.addEventListener('blur', saveHandler);

    // Textarea 允許 Enter 換行，Shift+Enter 或 Ctrl+Enter 可存檔(選擇性)，這裡主要靠 blur
if (input.tagName === 'INPUT') {
input.addEventListener('keydown', (e) => {
if (e.key === 'Enter') input.blur();
else if (e.key === 'Escape') {
isInlineEditing = false;
                // 還原顯示 (如果是課文需重繪 Markdown)
if (currentMode === 'textbook') element.innerHTML = parseMarkdown(currentValue) || '<span style="color:#ccc">點擊輸入...</span>';
else element.innerHTML = escapeHtml(currentValue);
}
@@ -343,7 +453,7 @@
item[field] = newValue;
}

    // 空值檢查
    // 空值檢查 (若全空則刪除)
let isEmpty = false;
if (currentMode === 'words') {
if (!item.word.trim() && !item.pos.trim() && !item.chinese.trim()) isEmpty = true;
@@ -353,223 +463,155 @@

if (isEmpty) {
itemsArray.splice(iIdx, 1);
        autoSave(); 
        autoSave(); // 會觸發重繪
} else {
        // 更新 data-raw 屬性供下次編輯使用
element.setAttribute('data-raw', newValue);
        
        // 更新顯示 (Markdown 或 純文字)
if (currentMode === 'textbook') {
element.innerHTML = parseMarkdown(newValue) || '<span style="color:#ccc">點擊輸入...</span>';
} else {
element.innerHTML = escapeHtml(newValue);
}
        
saveDataOnly();
}
}

function saveDataOnly() {
    if(currentMode === 'words') localStorage.setItem('editor_autosave_words', JSON.stringify(dataStore.words));
    else localStorage.setItem('editor_autosave_textbook', JSON.stringify(dataStore.textbook));
}

// ============================================================
// Actions
// Table Edit (Excel Mode)
// ============================================================

function addItem(srcIdx, lIdx, insertIndex, e) {
    if(e) e.stopPropagation();
    
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    const l = list[srcIdx].lessons[lIdx];
    const targetArray = currentMode === 'words' ? l.vocabulary : l.sentences;
function tableEdit(cell, srcIdx, lIdx, iIdx, field) {
    if (cell.querySelector('input, textarea')) return;

    const emptyItem = currentMode === 'words' 
        ? { word: '', pos: '', chinese: '' }
        : { en: '', ch: '' };
    let rawValue = cell.getAttribute('data-raw');
    if (rawValue === null) rawValue = cell.innerText;

    let newIdx = insertIndex;
    if (insertIndex !== null && insertIndex !== undefined) {
        targetArray.splice(insertIndex, 0, emptyItem);
    } else {
        newIdx = targetArray.length;
        targetArray.push(emptyItem);
    cell.innerHTML = '';
    const input = document.createElement(currentMode === 'textbook' ? 'textarea' : 'input');
    input.value = rawValue;
    
    if (field === 'pos') {
        const listId = 'pos-list-table';
        if (!document.getElementById(listId)) {
            const dl = document.createElement('datalist');
            dl.id = listId;
            POS_OPTIONS.forEach(opt => {
                const op = document.createElement('option');
                op.value = opt;
                dl.appendChild(op);
            });
            document.body.appendChild(dl);
        }
        input.setAttribute('list', listId);
}

    autoSave(); 

    setTimeout(() => {
        const domId = `item-${srcIdx}-${lIdx}-${newIdx}-en`;
        const cell = document.getElementById(domId);
        if (cell) cell.click();
    }, 100);
}
    cell.appendChild(input);
    input.focus();

function addNewSource() {
    const name = prompt("輸入版本名稱:");
    if(name) {
    const save = () => {
        const val = input.value;
const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list.push({ name: name, lessons: [] });
        expandedKeys.add(`source-${list.length-1}`);
        autoSave();
    }
}
        const target = currentMode === 'words' ? list[srcIdx].lessons[lIdx].vocabulary[iIdx] : list[srcIdx].lessons[lIdx].sentences[iIdx];
        
        if (target) {
            target[field] = val;
            if (currentMode === 'textbook') {
                cell.setAttribute('data-raw', val);
                cell.innerHTML = parseMarkdown(val);
            } else {
                cell.innerText = val;
            }
            saveDataOnly();
        }
    };

function editSource(idx, e) {
    e.stopPropagation();
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    const newName = prompt("修改版本名稱:", list[idx].name);
    if(newName) { list[idx].name = newName; autoSave(); }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            input.blur();
            moveFocusFrom(cell, 1, 0); // 下一行
        }
        if (e.key === 'Escape') {
            if (currentMode === 'textbook') cell.innerHTML = parseMarkdown(rawValue);
            else cell.innerText = rawValue;
        }
    });
}

function delSource(idx, e) {
    e.stopPropagation();
    if(confirm("確定刪除此版本？")) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list.splice(idx, 1);
        autoSave();
    }
function setupTableKeydown(container) {
    container.onkeydown = (e) => {
        const active = document.activeElement;
        if (!active.classList.contains('excel-cell')) return;
        if (active.querySelector('input, textarea')) return;

        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            moveFocusFrom(active, 1, 0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocusFrom(active, -1, 0);
        } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
            e.preventDefault();
            moveFocusFrom(active, 0, 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            moveFocusFrom(active, 0, -1);
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            active.click(); // 直接打字
        }
    };
}

function addLesson(srcIdx, e) {
    e.stopPropagation();
    openModal('addLesson', { srcIdx });
function moveFocusFrom(currentCell, rowDelta, colDelta) {
    const coord = currentCell.getAttribute('data-coord');
    if (!coord) return;
    const [r, c] = coord.split('-').map(Number);
    const targetCoord = `${r + rowDelta}-${c + colDelta}`;
    const target = document.querySelector(`.excel-cell[data-coord="${targetCoord}"]`);
    if (target) target.focus();
}

function editLesson(srcIdx, lIdx, e) {
    e.stopPropagation();
function addItemTable(srcIdx, lIdx) {
const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    openModal('editLesson', { srcIdx, lIdx, data: list[srcIdx].lessons[lIdx] });
}

function delLesson(srcIdx, lIdx, e) {
    e.stopPropagation();
    if(confirm("確定刪除此課程？")) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list[srcIdx].lessons.splice(lIdx, 1);
        autoSave();
    }
    const targetArray = currentMode === 'words' ? list[srcIdx].lessons[lIdx].vocabulary : list[srcIdx].lessons[lIdx].sentences;
    
    const emptyItem = currentMode === 'words' ? { word: '', pos: '', chinese: '' } : { en: '', ch: '' };
    targetArray.push(emptyItem);
    
    saveDataOnly();
    renderTableEditor();
}

function delItem(srcIdx, lIdx, iIdx) {
function delItemTable(srcIdx, lIdx, iIdx) {
if(confirm("確定刪除？")) {
const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
const lesson = list[srcIdx].lessons[lIdx];
if(currentMode === 'words') lesson.vocabulary.splice(iIdx, 1);
else lesson.sentences.splice(iIdx, 1);
        autoSave();
        
        saveDataOnly();
        renderTableEditor();
}
}

// ============================================================
// Modal (For Lessons)
// ============================================================
// ------------------------------------------------------------
// General Actions
// ------------------------------------------------------------

function openModal(type, params) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('modal-form');
    const title = document.getElementById('modal-title');
    editingTarget = { type, params };
    form.innerHTML = '';
    
    if(type === 'addLesson' || type === 'editLesson') {
        title.innerText = type === 'addLesson' ? '新增課程' : '編輯課程';
        const d = params.data || { lesson: '', title: '' };
        form.innerHTML = `
            <div class="form-group"><label>課號 (數字)</label><input type="number" id="inp-lesson" value="${d.lesson}"></div>
            <div class="form-group"><label>標題</label><input type="text" id="inp-title" value="${d.title}"></div>
        `;
    } 
    modal.classList.add('show');
    const fi = form.querySelector('input'); if(fi) fi.focus();
function saveDataOnly() {
    if(currentMode === 'words') localStorage.setItem('editor_autosave_words', JSON.stringify(dataStore.words));
    else localStorage.setItem('editor_autosave_textbook', JSON.stringify(dataStore.textbook));
    updateStatus(`已自動儲存 (${new Date().toLocaleTimeString()})`);
}

function closeModal() { document.getElementById('edit-modal').classList.remove('show'); }

function saveModal() {
    const { type, params } = editingTarget;
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
function addItem(srcIdx, lIdx, insertIndex, e) {
    if(e) e.stopPropagation();

    if(type.includes('Lesson')) {
        const lesson = document.getElementById('inp-lesson').value;
        const title = document.getElementById('inp-title').value;
        if(type === 'addLesson') {
            if(!list[params.srcIdx].lessons) list[params.srcIdx].lessons = [];
            const newL = { lesson: parseInt(lesson), title: title };
            if(currentMode === 'words') newL.vocabulary = []; else newL.sentences = [];
            list[params.srcIdx].lessons.push(newL);
            expandedKeys.add(`lesson-${params.srcIdx}-${list[params.srcIdx].lessons.length-1}`);
        } else {
            const l = list[params.srcIdx].lessons[params.lIdx];
            l.lesson = parseInt(lesson); l.title = title;
        }
    }
    closeModal(); autoSave();
}

// ============================================================
// Drag and Drop
// ============================================================

let dragSrcEl=null, dragSrcIdx=null, dragLessonIdx=null;
function setupDragAndDrop(container, sIdx, lIdx) {
    container.addEventListener('mousedown', (e) => {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        const item = e.target.closest('.data-item');
        if (!item) return;
        if (e.target.closest('.drag-handle')) item.draggable = true;
        else item.draggable = false;
    });

    container.addEventListener('dragstart', (e)=>{
        if(!e.target.classList.contains('data-item') || e.target.draggable === false) { e.preventDefault(); return; }
        dragSrcEl=e.target; dragSrcIdx=sIdx; dragLessonIdx=lIdx;
        e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/html',e.target.innerHTML);
        setTimeout(() => e.target.classList.add('dragging'), 0);
    });
    container.addEventListener('dragend', (e)=>{
        if(e.target.classList) { e.target.classList.remove('dragging'); e.target.draggable = false; }
        container.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    });
    container.addEventListener('dragover', (e)=>{
        e.preventDefault();
        if(dragSrcIdx!==sIdx || dragLessonIdx!==lIdx) return;
        const t = e.target.closest('.data-item');
        if(t && t!==dragSrcEl) t.classList.add('drag-over');
    });
    container.addEventListener('dragleave', (e)=>{
        const t = e.target.closest('.data-item');
        if(t) t.classList.remove('drag-over');
    });
    container.addEventListener('drop', (e)=>{
        e.stopPropagation();
        if(dragSrcIdx!==sIdx || dragLessonIdx!==lIdx) return;
        const t = e.target.closest('.data-item');
        if(dragSrcEl!==t && t) {
            const from = parseInt(dragSrcEl.dataset.idx);
            const to = parseInt(t.dataset.idx);
            const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
            const items = currentMode === 'words' ? list[sIdx].lessons[lIdx].vocabulary : list[sIdx].lessons[lIdx].sentences;
            const el = items[from]; items.splice(from,1); items.splice(to,0,el);
            autoSave();
        }
        return false;
    });
}

function downloadJSON() {
    const data = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    const filename = currentMode === 'words' ? 'english.json' : 'english-textbook.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if(currentMode === 'words') localStorage.removeItem('editor_autosave_words');
    else localStorage.removeItem('editor_autosave_textbook');
    updateStatus("檔案已下載，請覆蓋原始檔");
}
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    const l = list[srcIdx].lessons[lIdx];
    const targetArray = currentMode === 'words' ? l.vocabulary : l.sentences;

function escapeHtml(text) {
    if(!text) return "";
    return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
    const emptyItem = currentMode === 'words' 
        ? { word: '', pos: '', chinese: '' }
        : { en: '', ch: '' };
