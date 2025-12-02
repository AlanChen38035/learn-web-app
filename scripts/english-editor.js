/* --- scripts/english-editor.js --- */

let currentMode = 'words';
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
    
    const scrollY = localStorage.getItem('editor_scroll');
    if(scrollY) window.scrollTo(0, parseInt(scrollY));

    if(localStorage.getItem('editor_autosave_words') || localStorage.getItem('editor_autosave_textbook')) {
        updateStatus("已載入草稿");
    }
});

async function loadData() {
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
    expandedKeys.clear();
    if (currentMode === 'words' && dataStore.words.sources.length > 0) expandedKeys.add('source-0');
    else if (currentMode === 'textbook' && dataStore.textbook.sources.length > 0) expandedKeys.add('source-0');
    renderEditor();
}

function autoSave() {
    const currentScroll = window.scrollY;
    if(currentMode === 'words') localStorage.setItem('editor_autosave_words', JSON.stringify(dataStore.words));
    else localStorage.setItem('editor_autosave_textbook', JSON.stringify(dataStore.textbook));
    
    updateStatus(`已自動儲存 (${new Date().toLocaleTimeString()})`);
    localStorage.setItem('editor_scroll', currentScroll);
    
    renderEditor();
    window.scrollTo(0, currentScroll);
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
// ============================================================

function renderEditor() {
    const container = document.getElementById('editor-content');
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
                lEl.innerHTML = `
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
                    <ul class="item-list ${isLessonExpanded ? 'show' : ''}"></ul>
                    <div style="padding:10px 16px;">
                        <button class="btn-add-text" onclick="addItem(${srcIdx}, ${lIdx}, null, event)">${ICONS.add} 新增內容</button>
                    </div>
                `;

                const itemContainer = lEl.querySelector('.item-list');
                setupDragAndDrop(itemContainer, srcIdx, lIdx);

                const items = currentMode === 'words' ? (lesson.vocabulary || []) : (lesson.sentences || []);
                
                const topInsert = createInsertSeparator(srcIdx, lIdx, 0);
                itemContainer.appendChild(topInsert);

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
                        // 課文模式：支援 Markdown 解析，並儲存 raw data
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
                    itemContainer.appendChild(iEl);
                    
                    const nextInsert = createInsertSeparator(srcIdx, lIdx, iIdx + 1);
                    itemContainer.appendChild(nextInsert);
                });

                lessonWrapper.appendChild(lEl);
            });
        }
        container.appendChild(srcEl);
    });
}

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
}

// ============================================================
// Inline Edit (支援 Datalist, Textarea, Markdown)
// ============================================================

function startInlineEdit(element, srcIdx, lIdx, iIdx, field) {
    if (isInlineEditing) return; 
    if (element.querySelector('input, select, textarea')) return;

    isInlineEditing = true;
    
    // 優先讀取 data-raw (用於 Markdown)，若無則用 innerText
    let currentValue = element.getAttribute('data-raw');
    if (currentValue === null) {
        currentValue = element.innerText;
        if (currentValue.includes('點擊輸入')) currentValue = '';
    }
    
    element.innerHTML = '';

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
        // 單字模式-一般
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

    setTimeout(() => {
        const domId = `item-${srcIdx}-${lIdx}-${newIdx}-en`;
        const cell = document.getElementById(domId);
        if (cell) cell.click();
    }, 100);
}

function addNewSource() {
    const name = prompt("輸入版本名稱:");
    if(name) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list.push({ name: name, lessons: [] });
        expandedKeys.add(`source-${list.length-1}`);
        autoSave();
    }
}

function editSource(idx, e) {
    e.stopPropagation();
    const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
    const newName = prompt("修改版本名稱:", list[idx].name);
    if(newName) { list[idx].name = newName; autoSave(); }
}

function delSource(idx, e) {
    e.stopPropagation();
    if(confirm("確定刪除此版本？")) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        list.splice(idx, 1);
        autoSave();
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
    }
}

function delItem(srcIdx, lIdx, iIdx) {
    if(confirm("確定刪除？")) {
        const list = currentMode === 'words' ? dataStore.words.sources : dataStore.textbook.sources;
        const lesson = list[srcIdx].lessons[lIdx];
        if(currentMode === 'words') lesson.vocabulary.splice(iIdx, 1);
        else lesson.sentences.splice(iIdx, 1);
        autoSave();
    }
}

// ============================================================
// Modal (For Lessons)
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

function escapeHtml(text) {
    if(!text) return "";
    return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}