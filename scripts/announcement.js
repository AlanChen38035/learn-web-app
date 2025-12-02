/* --- scripts/announcement.js --- */

document.addEventListener("DOMContentLoaded", () => {
    const JSON_PATH = 'data/announcements.json';
    const STORAGE_KEY = 'anno_hide_date'; 

    // 1. 檢查是否為「直接進入」(非返回)
    // 只有在 type 為 'navigate' (正常輸入網址或點書籤) 或 'reload' 時顯示
    // 如果是 'back_forward' (上一頁) 則不顯示
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry && navEntry.type === 'back_forward') {
        return; 
    }

    // 2. 檢查今日不再顯示
    const todayStr = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(STORAGE_KEY) === todayStr) {
        return;
    }

    // 3. 載入並渲染
    fetch(JSON_PATH)
        .then(r => r.json())
        .then(data => {
            const validAnnos = filterValidAnnouncements(data.announcements);
            if (validAnnos.length > 0) {
                new AnnouncementModal(validAnnos);
            }
        })
        .catch(err => console.error("公告載入失敗", err));
});

function filterValidAnnouncements(list) {
    if (!list) return [];
    const now = new Date();
    return list.filter(item => {
        const itemDate = new Date(item.date);
        const diffTime = Math.abs(now - itemDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7 && itemDate <= now;
    });
}

// 使用 Class 封裝邏輯，方便管理計時器與狀態
class AnnouncementModal {
    constructor(annos) {
        this.annos = annos;
        this.currentIndex = 0;
        this.timer = null;
        this.progressTimer = null;
        this.isExpanded = false; // 是否已點擊展開
        this.autoPlayTime = 5000; // 5秒
        
        this.createDOM();
        this.renderContent(0, 'init');
        
        // 只有多則公告時才啟動自動播放
        if (this.annos.length > 1) {
            this.startAutoPlay();
        }
    }

    createDOM() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'anno-overlay';
        this.overlay.innerHTML = `
            <div class="anno-card">
                ${this.annos.length > 1 ? `
                    <div class="nav-arrow nav-prev">❮</div>
                    <div class="nav-arrow nav-next">❯</div>
                    <div class="progress-bar-container"><div class="progress-bar"></div></div>
                ` : ''}
                
                <div id="anno-content-wrapper" title="點擊展開閱讀更多">
                    <!-- 內容區 -->
                </div>

                <div class="anno-footer">
                    <label class="dont-show-row">
                        <input type="checkbox" id="anno-no-show"> 今日不再顯示
                    </label>
                    <button class="btn-close">關閉</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        
        // 顯示動畫
        setTimeout(() => this.overlay.classList.add('show'), 50);

        // 綁定事件
        this.wrapper = this.overlay.querySelector('#anno-content-wrapper');
        this.bar = this.overlay.querySelector('.progress-bar');
        
        // 1. 關閉按鈕
        this.overlay.querySelector('.btn-close').onclick = () => this.close();
        
        // 2. 點擊內容：暫停播放 + 展開內容
        this.wrapper.onclick = () => {
            this.stopAutoPlay();
            this.wrapper.classList.add('expanded');
            this.wrapper.removeAttribute('title'); // 移除提示
            this.isExpanded = true;
            // 隱藏進度條 (因為停止播放了)
            if(this.bar) this.bar.parentElement.style.display = 'none';
        };

        // 3. 左右切換
        if (this.annos.length > 1) {
            this.overlay.querySelector('.nav-prev').onclick = (e) => {
                e.stopPropagation(); // 防止觸發 wrapper click
                this.manualSwitch(-1);
            };
            this.overlay.querySelector('.nav-next').onclick = (e) => {
                e.stopPropagation();
                this.manualSwitch(1);
            };
        }
    }

    renderContent(index, direction) {
        const data = this.annos[index];
        let blocksHtml = '';
        if (data.blocks) {
            data.blocks.forEach(b => {
                blocksHtml += `
                    <div class="anno-block">
                        ${b.subtitle ? `<div class="anno-subtitle">${parseMarkdown(b.subtitle)}</div>` : ''}
                        ${b.text ? `<div class="anno-text">${parseMarkdown(b.text)}</div>` : ''}
                        ${b.image ? `<img src="${b.image}" class="anno-img">` : ''}
                    </div>
                `;
            });
        }

        // 產生內容 HTML
        const contentHTML = `
            ${data.cover ? `<img src="${data.cover}" class="anno-cover">` : ''}
            <div class="anno-body">
                <h2 class="anno-title">${data.title}</h2>
                <div class="anno-date">${data.date} (${index + 1}/${this.annos.length})</div>
                ${blocksHtml}
            </div>
        `;

        // 處理動畫類別
        this.wrapper.innerHTML = contentHTML;
        
        // 移除舊動畫 class 重新觸發
        this.wrapper.classList.remove('slide-in-right', 'slide-in-left');
        void this.wrapper.offsetWidth; // Trigger reflow

        if (direction === 'next') {
            this.wrapper.classList.add('slide-in-right');
        } else if (direction === 'prev') {
            this.wrapper.classList.add('slide-in-left');
        }
        
        // 每次切換都重置捲軸位置到頂部
        this.wrapper.scrollTop = 0;
    }

    startAutoPlay() {
        if (this.isExpanded) return; // 如果已展開，不自動播放

        this.stopAutoPlay(); // 先清除舊的
        
        // 啟動進度條動畫
        if(this.bar) {
            this.bar.style.transition = 'none';
            this.bar.style.width = '0%';
            setTimeout(() => {
                this.bar.style.transition = `width ${this.autoPlayTime}ms linear`;
                this.bar.style.width = '100%';
            }, 50);
        }

        this.timer = setTimeout(() => {
            this.nextSlide();
        }, this.autoPlayTime);
    }

    stopAutoPlay() {
        if (this.timer) clearTimeout(this.timer);
        if (this.bar) {
            this.bar.style.transition = 'none';
            this.bar.style.width = '0%';
        }
    }

    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.annos.length;
        this.renderContent(this.currentIndex, 'next');
        this.startAutoPlay(); // 繼續下一輪
    }

    manualSwitch(direction) {
        // 手動切換時，先暫停，切換後重新計時 (除非已展開)
        this.stopAutoPlay();
        
        if (direction === 1) {
            this.currentIndex = (this.currentIndex + 1) % this.annos.length;
            this.renderContent(this.currentIndex, 'next');
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.annos.length) % this.annos.length;
            this.renderContent(this.currentIndex, 'prev');
        }

        if (!this.isExpanded) {
            this.startAutoPlay();
        }
    }

    close() {
        const checkbox = this.overlay.querySelector('#anno-no-show');
        if (checkbox && checkbox.checked) {
            const todayStr = new Date().toISOString().split('T')[0];
            localStorage.setItem('anno_hide_date', todayStr);
        }
        this.stopAutoPlay();
        this.overlay.classList.remove('show');
        setTimeout(() => this.overlay.remove(), 300);
    }
}