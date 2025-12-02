// 獲取單字資料
async function fetchEnglishData() {
    const res = await fetch('../data/english.json');
    const json = await res.json();
    return json.sources;
}

// 獲取課文資料
async function fetchTextbookData() {
    const res = await fetch('../data/english-textbook.json');
    const json = await res.json();
    return json.sources;
}

// 根據 localStorage 的選擇過濾單字
function filterWords(sources, selectedLessons) {
    let words = [];
    sources.forEach(src => {
        src.lessons.forEach(lesson => {
            // 檢查是否被選中
            const isSelected = selectedLessons.some(s => s.source === src.name && s.lesson === lesson.lesson);
            if(isSelected && lesson.vocabulary) {
                words = words.concat(lesson.vocabulary.map(v => ({...v, lesson: lesson.lesson, source: src.name})));
            }
        });
    });
    return words;
}

// 文字轉語音 (TTS)
function speak(text, onEndCallback, rate = 1) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // 停止當前

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    
    if (onEndCallback) {
        u.onend = onEndCallback;
    }
    
    window.speechSynthesis.speak(u);
}