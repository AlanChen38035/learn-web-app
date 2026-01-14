/* --- scripts/english-editor.js --- */

let currentMode = 'words';
let viewMode = 'list'; // 新增：'list' or 'table'
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
    
    // 讀取視圖偏好
    const savedView = localStorage.getItem('editor_view_mode');
    if(savedView) viewMode = savedView;
    updateViewButtons();

    renderEditor();
    
    const scrollY = localStorage.getItem('editor_scroll');
    if(scrollY) window.scrollTo(0, parseInt(scrollY));

    if(localStorage.getItem('editor_autosave_words') || localStorage.getItem('editor_autosave_textbook')) {
        updateStatus("已載入草稿");
    }
});

async function loadData() {
    // ... (維持原樣) ...
    const draftWords = localStorage.getItem('editor_autosave_words');
    const draftText = localStorage.getItem('editor_autosave_textbook');

    if (draftWords) dataStore.words = JSON.parse(draftWords);
    else {
        try {
            const res = await fetch('../data/english.json');
            if(res.ok) dataStore.words = await res.json();
        } catch(e) {}
    }

    if (draftText) dataStore.textbook = JSON.parse(draftText);
    else {
        try {
            const res = await fetch('../data/english-textbook.json');
            if(res.ok) dataStore.textbook = await res.json();
        } catch(e) {}
    }
    
    if(!dataStore.words.sources) dataStore.words.sources = [];
    if(!dataStore.textbook.sources) dataStore.textbook.sources = [];
}

function switchTab(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${mode}`).classList.add('active');
    
    // 控制視圖切換器的顯示
    const switcher = document.getElementById('view-switcher');
    if(switcher) switcher.style.display = (mode === 'words') ? 'inline-flex' : 'none';

    expandedKeys.clear();
    if (currentMode === 'words' && dataStore.words.sources.length > 0) expandedKeys.add('source-0');
    else if (currentMode === 'textbook' && dataStore.textbook.sources.length > 0) expandedKeys.add('source-0');
    renderEditor();
}

function switchView(mode) {
    viewMode = mode;
    localStorage.setItem('editor_view_mode', mode);
    updateViewButtons();
    renderEditor();
}

function updateViewButtons() {
    const btnList = document.getElementById('btn-view-list');
    const btnTable = document.getElementById('btn-view-table');
    if(btnList && btnTable) {
        btnList.className = `view-btn ${viewMode === 'list' ? 'active' : ''}`;
        btnTable.className = `view-btn ${viewMode === 'table' ? 'active' : ''}`;
    }
}

function autoSave() {
    const currentScroll = window.scrollY;
    
    // 儲存前清理空資料 (如果是表格模式且為單字庫)
    if(currentMode === 'words' && viewMode === 'table') {
        cleanEmptyRows();
    }

    if(currentMode === 'words') localStorage.setItem('editor_autosave_words', JSON.stringify(dataStore.words));
    else localStorage.setItem('editor_autosave_textbook', JSON.stringify(dataStore.textbook));
    
    updateStatus(`已自動儲存 (${new Date().toLocaleTimeString()})`);
    localStorage.setItem('editor_scroll', currentScroll);
    
    // 只有在非輸入焦點狀態下才重繪，避免打字中斷
    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        // renderEditor(); // 在表格模式下，輸入時不重繪整個編輯器，避免焦點跑掉
    }
}

function updateStatus(msg) { document.getElementById('auto-save-msg').innerText = msg; }

function clearDraft() {
    if(confirm("確定要放棄修改？")) {
        localStorage.removeItem('editor_autosave_words');
        localStorage.removeItem('editor_autosave_textbook');
        localStorage.removeItem('editor_scroll');
        location.reload();
    }
}

function resetToOriginal() { clearDraft(); }

// ============================================================
// Markdown Parser
// ============================================================
function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<span class="md-bold">$1</span>');
    html = html.replace(/\*(.*?)\*/g, '<span class="md-italic">$1</span>');
    html = html.replace(/==(.*?)==/g, '<span class="md-highlight">$1</span>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

// ============================================================
// Render Logic
// ============================================================

function renderEditor() {
    const container = document.getElementById('editor-content');
    
    // 如果正在編輯表格的 input，不要重繪，否則會斷開輸入
    if(document.activeElement && document.activeElement.classList.contains('table-input')) {
        return;
    }

    container.innerHTML = '';
    
    const sources = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;

    if(!sources || sources.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#adb5bd;">尚無資料，請新增版本</div>';
        return;
    }

    sources.forEach((src, srcIdx) => {
        const srcKey = `source-${srcIdx}`;
        const isExpanded = expandedKeys.has(srcKey);
        
        const srcEl = document.createElement('div');
        srcEl.className = `source-block ${isExpanded ? 'expanded' : ''}`;
        srcEl.innerHTML = `
            <div class="accordion-header" onclick="toggleAccordion('${srcKey}')">
                <div class="header-left">
                    ${ICONS.chevron}
                    ${ICONS.book}
                    <div class="source-title">${escapeHtml(src.name)}</div>
                </div>
                <div class="action-group">
                    <button class="icon-btn-sm primary" title="編輯版本名稱" onclick="editSource(${srcIdx}, event)">${ICONS.edit}</button>
                    <button class="icon-btn-sm danger" title="刪除版本" onclick="delSource(${srcIdx}, event)">${ICONS.delete}</button>
                </div>
            </div>
            <div class="lesson-container ${isExpanded ? 'show' : ''}">
                <button class="btn-add-text" onclick="addLesson(${srcIdx}, event)">${ICONS.add} 新增課程</button>
                <div class="lesson-list-wrapper"></div>
            </div>
        `;
        
        const lessonWrapper = srcEl.querySelector('.lesson-list-wrapper');
        
        if(src.lessons) {
            src.lessons.forEach((lesson, lIdx) => {
                const lessonKey = `lesson-${srcIdx}-${lIdx}`;
                const isLessonExpanded = expandedKeys.has(lessonKey);

                const lEl = document.createElement('div');
                lEl.className = `lesson-block ${isLessonExpanded ? 'expanded' : ''}`;
                
                // Header
                let headerHTML = `
                    <div class="accordion-header lesson-header" onclick="toggleAccordion('${lessonKey}')">
                        <div class="header-left">
                            ${ICONS.chevron}
                            <div class="lesson-title">第 ${lesson.lesson} 課：${escapeHtml(lesson.title)}</div>
                        </div>
                        <div class="action-group">
                            <button class="icon-btn-sm primary" title="編輯課程" onclick="editLesson(${srcIdx}, ${lIdx}, event)">${ICONS.edit}</button>
                            <button class="icon-btn-sm danger" title="刪除課程" onclick="delLesson(${srcIdx}, ${lIdx}, event)">${ICONS.delete}</button>
                        </div>
                    </div>
                `;

                // Content
                let contentHTML = '';
                
                // 判斷使用列表模式還是表格模式 (僅限單字)
                if (currentMode === 'words' && viewMode === 'table') {
                    // --- 表格模式 ---
                    contentHTML = `<div class="item-list table-wrapper" style="padding: 0;">`;
                    contentHTML += renderWordTable(srcIdx, lIdx, lesson.vocabulary || []);
                    contentHTML += `</div>`;
                } else {
                    // --- 列表模式 (原版) ---
                    contentHTML = `<ul class="item-list ${isLessonExpanded ? 'show' : ''}"></ul>`;
                    contentHTML += `
                        <div style="padding:10px 16px;">
                            <button class="btn-add-text" onclick="addItem(${srcIdx}, ${lIdx}, null, event)">${ICONS.add} 新增內容</button>
                        </div>
                    `;
                }

                lEl.innerHTML = headerHTML + contentHTML;

                // 如果是列表模式，需要執行原本的渲染邏輯 (Drag & Drop, Inline Edit Divs)
                if (!(currentMode === 'words' && viewMode === 'table')) {
                    const itemContainer = lEl.querySelector('.item-list');
                    if (itemContainer) {
                        renderListItems(itemContainer, srcIdx, lIdx, lesson);
                    }
                }

                lessonWrapper.appendChild(lEl);
            });
        }
        container.appendChild(srcEl);
    });
}

// 拆分出原本的列表渲染邏輯
function renderListItems(container, srcIdx, lIdx, lesson) {
    setupDragAndDrop(container, srcIdx, lIdx);
    const items = currentMode === 'words' ? (lesson.vocabulary || []) : (lesson.sentences || []);
    
    const topInsert = createInsertSeparator(srcIdx, lIdx, 0);
    container.appendChild(topInsert);

    items.forEach((item, iIdx) => {
        const iEl = document.createElement('li');
        iEl.className = 'data-item';
        iEl.draggable = false;
        iEl.dataset.idx = iIdx;
        
        const domId = `item-${srcIdx}-${lIdx}-${iIdx}`;
        iEl.id = domId;

        let contentHtml = '';
        if(currentMode === 'words') {
            contentHtml = `
                <div class="item-content word-grid">
                    <div class="editable-cell col-en" id="${domId}-en" onclick="startInlineEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'word')" title="點擊編輯英文">${escapeHtml(item.word)}</div>
                    <div class="editable-cell col-pos" onclick="startInlineEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'pos')" title="點擊編輯詞性">${escapeHtml(item.pos)}</div>
                    <div class="editable-cell col-ch" onclick="startInlineEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'chinese')" title="點擊編輯中文">${escapeHtml(item.chinese)}</div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="item-content textbook-layout">
                    <div class="editable-cell tb-en" 
                            id="${domId}-en"
                            data-raw="${escapeHtml(item.en)}"
                            onclick="startInlineEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'en')" 
                            title="點擊編輯英文">${parseMarkdown(item.en) || '<span style="color:#ccc">點擊輸入英文 (支援 Markdown)</span>'}</div>
                    <div class="editable-cell tb-ch" 
                            data-raw="${escapeHtml(item.ch)}"
                            onclick="startInlineEdit(this, ${srcIdx}, ${lIdx}, ${iIdx}, 'ch')" 
                            title="點擊編輯中文">${parseMarkdown(item.ch) || '<span style="color:#ccc">點擊輸入中文</span>'}</div>
                </div>
            `;
        }

        iEl.innerHTML = `
            <div class="drag-handle" title="按住拖曳">${ICONS.drag}</div>
            ${contentHtml}
            <div class="action-group">
                <button class="icon-btn-sm danger" onclick="delItem(${srcIdx}, ${lIdx}, ${iIdx})">${ICONS.delete}</button>
            </div>
        `;
        container.appendChild(iEl);
        
        const nextInsert = createInsertSeparator(srcIdx, lIdx, iIdx + 1);
        container.appendChild(nextInsert);
    });
}

// ============================================================
// Table Mode Logic (New)
// ============================================================

function renderWordTable(srcIdx, lIdx, items) {
    let html = `
        <table class="editor-table">
            <thead>
                <tr>
                    <th style="width:35%">英文</th>
                    <th style="width:15%">詞性</th>
                    <th style="width:40%">中文</th>
                    <th style="width:10%"></th>
                </tr>
            </thead>
            <tbody id="tbody-${srcIdx}-${lIdx}">
    `;

    // Render existing items
    items.forEach((item, iIdx) => {
        html += createTableRow(srcIdx, lIdx, iIdx, item);
    });

    // Add empty row for new input
    html += createTableRow(srcIdx, lIdx, items.length, { word: '', pos: '', chinese: '' }, true);

    html += `</tbody></table>`;
    return html;
}

function createTableRow(srcIdx, lIdx, iIdx, item, isGhost = false) {
    const rowClass = isGhost ? 'new-row-hint' : '';
    return `
        <tr class="${rowClass}" data-idx="${iIdx}">
            <td><input type="text" class="table-input" 
                value="${escapeHtml(item.word)}" 
                placeholder="輸入英文..."
                oninput="updateTableData(${srcIdx}, ${lIdx}, ${iIdx}, 'word', this.value)"
                onkeydown="handleTableKey(event, ${srcIdx}, ${lIdx}, ${iIdx}, 'word')"
                data-field="word"></td>
            
            <td><input type="text" class="table-input" list="pos-list-table"
                value="${escapeHtml(item.pos)}" 
                placeholder="詞性"
                oninput="updateTableData(${srcIdx}, ${lIdx}, ${iIdx}, 'pos', this.value)"
                onkeydown="handleTableKey(event, ${srcIdx}, ${lIdx}, ${iIdx}, 'pos')"
                data-field="pos"></td>
            
            <td><input type="text" class="table-input" 
                value="${escapeHtml(item.chinese)}" 
                placeholder="輸入中文..."
                oninput="updateTableData(${srcIdx}, ${lIdx}, ${iIdx}, 'chinese', this.value)"
                onkeydown="handleTableKey(event, ${srcIdx}, ${lIdx}, ${iIdx}, 'chinese')"
                data-field="chinese"></td>
            
            <td class="col-action">
                ${!isGhost ? `
                    <button class="table-del-btn" tabindex="-1" onclick="delItem(${srcIdx}, ${lIdx}, ${iIdx})">
                        ${ICONS.delete}
                    </button>` : ''}
            </td>
        </tr>
    `;
}

// 建立詞性 datalist (只需建立一次)
if (!document.getElementById('pos-list-table')) {
    const dl = document.createElement('datalist');
    dl.id = 'pos-list-table';
    POS_OPTIONS.forEach(opt => {
        const op = document.createElement('option');
        op.value = opt;
        dl.appendChild(op);
    });
    document.body.appendChild(dl);
}

function updateTableData(srcIdx, lIdx, iIdx, field, value) {
    const list = dataStore.words.sources;
    const vocabulary = list[srcIdx].lessons[lIdx].vocabulary;
    
    // 如果是編輯 "Ghost Row" (最後一列)
    if (iIdx >= vocabulary.length) {
        // 新增一個物件
        const newItem = { word: '', pos: '', chinese: '' };
        newItem[field] = value;
        vocabulary.push(newItem);
        
        // 渲染新的一行 "Ghost Row" 到 DOM，而不用重繪整個 Table
        const tbody = document.getElementById(`tbody-${srcIdx}-${lIdx}`);
        if(tbody) {
            // 把目前這行變成正常行 (移除 hint class, 加刪除鈕)
            const currentRow = tbody.lastElementChild;
            currentRow.classList.remove('new-row-hint');
            const actionCell = currentRow.querySelector('.col-action');
            actionCell.innerHTML = `<button class="table-del-btn" tabindex="-1" onclick="delItem(${srcIdx}, ${lIdx}, ${iIdx})">${ICONS.delete}</button>`;

            // 插入新的 Ghost Row
            const nextIdx = iIdx + 1;
            const tempRow = document.createElement('tr'); // 暫存容器
            tempRow.innerHTML = createTableRow(srcIdx, lIdx, nextIdx, {word:'', pos:'', chinese:''}, true);
            // 只要裡面的 tr 內容
            const newTrHtml = createTableRow(srcIdx, lIdx, nextIdx, {word:'', pos:'', chinese:''}, true);
            tbody.insertAdjacentHTML('beforeend', newTrHtml);
        }
    } else {
        // 更新現有資料
        vocabulary[iIdx][field] = value;
    }
    
    autoSave();
}

function handleTableKey(e, srcIdx, lIdx, iIdx, field) {
    // 方向鍵導航
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        // e.preventDefault(); // 視情況，左右鍵在文字輸入時應保留原生行為
        navigateTable(e.key, srcIdx, lIdx, iIdx, field, e.target);
        return;
    }

    // Enter 新增行
    if (e.key === 'Enter') {
        e.preventDefault();
        
        const list = dataStore.words.sources;
        const vocabulary = list[srcIdx].lessons[lIdx].vocabulary;

        // 如果是在 ghost row 按 enter，不做事，因為輸入內容時已經自動新增了
        // 但如果是在中間行按 enter，則插入新行
        if (iIdx < vocabulary.length - 1) {
            vocabulary.splice(iIdx + 1, 0, { word: '', pos: '', chinese: '' });
            
            // 為了簡化 DOM 操作，這裡選擇重繪該 Lesson 的區塊
            // 雖然效率稍低，但邏輯最穩健
            renderEditor(); 
            
            // 重新聚焦到新的一行
            setTimeout(() => {
                const nextInput = document.querySelector(`#tbody-${srcIdx}-${lIdx} tr[data-idx="${iIdx+1}"] input[data-field="word"]`);
                if(nextInput) nextInput.focus();
            }, 50);
        } else {
            // 如果是在最後一筆實體資料按 enter，聚焦到 ghost row
            const nextInput = document.querySelector(`#tbody-${srcIdx}-${lIdx} tr[data-idx="${iIdx+1}"] input[data-field="word"]`);
            if(nextInput) nextInput.focus();
        }
        autoSave();
    }
}

function navigateTable(key, srcIdx, lIdx, iIdx, field, currentInput) {
    const tbody = document.getElementById(`tbody-${srcIdx}-${lIdx}`);
    if (!tbody) return;

    let targetRowIdx = iIdx;
    let targetField = field;
    
    // 欄位順序
    const fields = ['word', 'pos', 'chinese'];
    const fieldIdx = fields.indexOf(field);

    if (key === 'ArrowUp') targetRowIdx = iIdx - 1;
    if (key === 'ArrowDown') targetRowIdx = iIdx + 1;
    
    if (key === 'ArrowLeft') {
        // 只有當游標在最左邊時才跳欄 (避免影響打字)
        if (currentInput.selectionStart === 0 && currentInput.selectionEnd === 0) {
            if (fieldIdx > 0) targetField = fields[fieldIdx - 1];
        } else return; 
    }
    
    if (key === 'ArrowRight') {
        // 只有當游標在最右邊時才跳欄
        if (currentInput.selectionStart === currentInput.value.length) {
            if (fieldIdx < fields.length - 1) targetField = fields[fieldIdx + 1];
        } else return;
    }

    const targetRow = tbody.querySelector(`tr[data-idx="${targetRowIdx}"]`);
    if (targetRow) {
        const targetInput = targetRow.querySelector(`input[data-field="${targetField}"]`);
        if (targetInput) {
            targetInput.focus();
            // 上下移動時，全選文字方便覆蓋 (Excel 風格)
            // if (key === 'ArrowUp' || key === 'ArrowDown') targetInput.select();
        }
    }
}

// 移除空行 (在儲存/下載前呼叫)
function cleanEmptyRows() {
    if(!dataStore.words || !dataStore.words.sources) return;
    
    dataStore.words.sources.forEach(src => {
        src.lessons.forEach(lesson => {
            if(lesson.vocabulary) {
                lesson.vocabulary = lesson.vocabulary.filter(v => {
                    return v.word.trim() !== '' || v.pos.trim() !== '' || v.chinese.trim() !== '';
                });
            }
        });
    });
}

// ============================================================
// Shared Helper Functions (Insert, etc.)
// ============================================================

function createInsertSeparator(srcIdx, lIdx, insertIndex) {
    const div = document.createElement('div');
    div.className = 'insert-separator';
    div.title = '按此插入新項目';
    div.innerHTML = `<div class="insert-line"></div><div class="insert-btn-icon">+</div><div class="insert-line"></div>`;
    div.onclick = (e) => {
        e.stopPropagation();
        addItem(srcIdx, lIdx, insertIndex, e);
    };
    return div;
}

function toggleAccordion(key) {
    if (expandedKeys.has(key)) expandedKeys.delete(key);
    else expandedKeys.add(key);
    autoSave(); 
    renderEditor(); // 需要重繪以顯示/隱藏
}

// ============================================================
// Inline Edit for List Mode (Retained)
// ============================================================
// ... (startInlineEdit, finishInlineEdit, saveDataOnly 保持原樣，
// 但需注意 finishInlineEdit 中的更新邏輯只在 viewMode='list' 時觸發) ...

function startInlineEdit(element, srcIdx, lIdx, iIdx, field) {
    if (isInlineEditing) return; 
    if (element.querySelector('input, select, textarea')) return;

    isInlineEditing = true;
    
    let currentValue = element.getAttribute('data-raw');
    if (currentValue === null) {
        currentValue = element.innerText;
        if (currentValue.includes('點擊輸入')) currentValue = '';
    }
    
    element.innerHTML = '';

    let input;
    if (currentMode === 'textbook') {
        input = document.createElement('textarea');
        input.className = 'inline-textarea';
        input.value = currentValue;
    } else if (field === 'pos') {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'inline-input';
        
        const datalistId = `pos-list-${Date.now()}`;
        input.setAttribute('list', datalistId);
        const datalist = document.createElement('datalist');
        datalist.id = datalistId;
        POS_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            datalist.appendChild(option);
        });
        element.appendChild(datalist);
    } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'inline-input';
    }
    
    element.appendChild(input);
    input.focus();
    input.onclick = (e) => e.stopPropagation();

    const saveHandler = () => finishInlineEdit(element, input.value, srcIdx, lIdx, iIdx, field);

    input.addEventListener('blur', saveHandler);
    
    if (input.tagName === 'INPUT') {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            else if (e.key === 'Escape') {
                isInlineEditing = false;
                if (currentMode === 'textbook') element.innerHTML = parseMarkdown(currentValue) || '<span style="color:#ccc">點擊輸入...</span>';
                else element.innerHTML = escapeHtml(currentValue);
            }
        });
    }
}

function finishInlineEdit(element, newValue, srcIdx, lIdx, iIdx, field) {
    isInlineEditing = false;
    
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    const itemsArray = currentMode === 'words' ? list[srcIdx].lessons[lIdx].vocabulary : list[srcIdx].lessons[lIdx].sentences;
    const item = itemsArray[iIdx];
    
    if (item[field] !== newValue) {
        item[field] = newValue;
    }

    // 空值檢查
    let isEmpty = false;
    if (currentMode === 'words') {
        if (!item.word.trim() && !item.pos.trim() && !item.chinese.trim()) isEmpty = true;
    } else {
        if (!item.en.trim() && !item.ch.trim()) isEmpty = true;
    }

    if (isEmpty) {
        itemsArray.splice(iIdx, 1);
        autoSave(); 
        renderEditor(); // 列表模式下刪除需要重繪
    } else {
        element.setAttribute('data-raw', newValue);
        if (currentMode === 'textbook') {
            element.innerHTML = parseMarkdown(newValue) || '<span style="color:#ccc">點擊輸入...</span>';
        } else {
            element.innerHTML = escapeHtml(newValue);
        }
        autoSave(); // 改為統一使用 autoSave
    }
}

// ============================================================
// Actions (Add/Del/Modal)
// ============================================================

function addItem(srcIdx, lIdx, insertIndex, e) {
    if(e) e.stopPropagation();
    
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    const l = list[srcIdx].lessons[lIdx];
    const targetArray = currentMode === 'words' ? l.vocabulary : l.sentences;

    const emptyItem = currentMode === 'words' 
        ? { word: '', pos: '', chinese: '' }
        : { en: '', ch: '' };

    let newIdx = insertIndex;
    if (insertIndex !== null && insertIndex !== undefined) {
        targetArray.splice(insertIndex, 0, emptyItem);
    } else {
        newIdx = targetArray.length;
        targetArray.push(emptyItem);
    }

    autoSave(); 
    renderEditor(); // 新增項目必須重繪

    // 如果是列表模式，自動聚焦
    if (viewMode === 'list') {
        setTimeout(() => {
            const domId = `item-${srcIdx}-${lIdx}-${newIdx}-en`;
            const cell = document.getElementById(domId);
            if (cell) cell.click();
        }, 100);
    }
}

function delItem(srcIdx, lIdx, iIdx) {
    // 表格模式下若刪除，不需確認，操作更流暢；或保留確認視個人喜好
    // 這裡維持確認，避免誤刪
    if(confirm("確定刪除？")) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        const lesson = list[srcIdx].lessons[lIdx];
        if(currentMode === 'words') lesson.vocabulary.splice(iIdx, 1);
        else lesson.sentences.splice(iIdx, 1);
        autoSave();
        renderEditor();
    }
}

function addNewSource() {
    const name = prompt("輸入版本名稱:");
    if(name) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list.push({ name: name, lessons: [] });
        expandedKeys.add(`source-${list.length-1}`);
        autoSave();
        renderEditor();
    }
}

function editSource(idx, e) {
    e.stopPropagation();
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    const newName = prompt("修改版本名稱:", list[idx].name);
    if(newName) { list[idx].name = newName; autoSave(); renderEditor(); }
}

function delSource(idx, e) {
    e.stopPropagation();
    if(confirm("確定刪除此版本？")) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list.splice(idx, 1);
        autoSave();
        renderEditor();
    }
}

function addLesson(srcIdx, e) {
    e.stopPropagation();
    openModal('addLesson', { srcIdx });
}

function editLesson(srcIdx, lIdx, e) {
    e.stopPropagation();
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    openModal('editLesson', { srcIdx, lIdx, data: list[srcIdx].lessons[lIdx] });
}

function delLesson(srcIdx, lIdx, e) {
    e.stopPropagation();
    if(confirm("確定刪除此課程？")) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list[srcIdx].lessons.splice(lIdx, 1);
        autoSave();
        renderEditor();
    }
}

// ============================================================
// Modal
// ============================================================

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
}

function closeModal() { document.getElementById('edit-modal').classList.remove('show'); }

function saveModal() {
    const { type, params } = editingTarget;
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    
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
    closeModal(); autoSave(); renderEditor();
}

// ============================================================
// Drag and Drop
// ============================================================

let dragSrcEl=null, dragSrcIdx=null, dragLessonIdx=null;
function setupDragAndDrop(container, sIdx, lIdx) {
    // 拖曳功能僅在 List 模式有效
    if(viewMode === 'table' && currentMode === 'words') return;

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
            autoSave(); renderEditor();
        }
        return false;
    });
}

function downloadJSON() {
    // 下載前清除空行
    cleanEmptyRows();
    
    const data = currentMode === 'words' ? dataStore.words : dataStore.textbook;
    const filename = currentMode === 'words' ? 'english.json' : 'english-textbook.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if(currentMode === 'words') localStorage.removeItem('editor_autosave_words');
    else localStorage.removeItem('editor_autosave_textbook');
    
    // 如果是表格模式，重繪以移除畫面上的空行
    if(viewMode === 'table') renderEditor();
    
    updateStatus("檔案已下載，請覆蓋原始檔");
}

function escapeHtml(text) {
    if(!text) return "";
    return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
