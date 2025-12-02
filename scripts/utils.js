/* --- scripts/utils.js --- */

/**
 * HTML 跳脫字元 (防止 XSS 攻擊)
 */
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 通用 Markdown 解析器 (顯示用)
 * 支援: **粗體**, *斜體*, ==螢光筆==, ~~刪除線~~, \n換行
 */
function parseMarkdown(text) {
    if (!text) return '';
    
    // 1. 先轉義 HTML (安全性)
    let html = escapeHtml(text);

    // 2. 解析語法 (Regex)
    // 粗體 **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<span class="md-bold">$1</span>');
    // 斜體 *text*
    html = html.replace(/\*(.*?)\*/g, '<span class="md-italic">$1</span>');
    // 螢光筆 ==text==
    html = html.replace(/==(.*?)==/g, '<span class="md-highlight">$1</span>');
    // 刪除線 ~~text~~ (新增功能)
    html = html.replace(/~~(.*?)~~/g, '<span class="md-strike">$1</span>');
    
    // 3. 處理換行
    html = html.replace(/\n/g, '<br>');

    return html;
}

/**
 * 清除 Markdown 符號 (TTS 語音朗讀用)
 * 將 **text** 轉為 text，避免朗讀出符號
 */
function stripMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/==(.*?)==/g, '$1')
        .replace(/~~(.*?)~~/g, '$1');
}