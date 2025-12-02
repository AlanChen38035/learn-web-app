/* --- scripts/english-quiz.js --- */

document.addEventListener('DOMContentLoaded', () => {
  const DATA_PATH = '../data/english.json';

  // --- UI 元素 ---
  const startBtn = document.getElementById('start-btn');
  const quizSection = document.getElementById('quiz');
  const setupSection = document.querySelector('.setup');
  const questionArea = document.getElementById('question-area');
  
  const timerEl = document.getElementById('timer');
  const progressEl = document.getElementById('progress');
  const scoreEl = document.getElementById('score');
  
  const showAnswerBtn = document.getElementById('show-answer');
  const exitBtn = document.getElementById('exit-btn');
  const scopeMsg = document.getElementById('scope-count-msg');

  const mistakeArea = document.getElementById('mistake-area');
  const mistakeBtn = document.getElementById('mistake-btn');
  const lastScoreInfo = document.getElementById('last-score-info');

  // --- 變數狀態 ---
  let loadedWords = []; 
  let pool = [];        
  let quizList = [];    
  let wrongQuestions = []; 
  let currentSessionWrongs = []; 

  let currentIndex = 0;
  let score = 0;
  let timer = null;
  
  let currentQuestion = null;
  let currentType = null;
  let revealed = false;
  let optionAnswered = false;

  // ============================================================
  // 1. 資料初始化
  // ============================================================
  const selLessons = JSON.parse(localStorage.getItem('sel_lessons') || '[]');
  const myFavs = JSON.parse(localStorage.getItem('my_favs') || '[]');

  fetch(DATA_PATH).then(r=>r.json()).then(json => {
      const sources = json.sources || [];
      if (selLessons.length === 0) {
        if (scopeMsg) scopeMsg.textContent = "未選擇課程，請返回上一頁";
        if (startBtn) startBtn.disabled = true;
        return;
      }
      loadedWords = [];
      sources.forEach(src => {
        src.lessons.forEach(l => {
          if (selLessons.some(s => s.source === src.name && s.lesson === l.lesson)) {
            (l.vocabulary||[]).forEach(v => {
              // 這裡會讀入 standard_ans 等所有屬性
              loadedWords.push({ ...v, lesson: l.lesson, title: l.title, source: src.name });
            });
          }
        });
      });
      window.updateQuizCount();
    }).catch(err => console.error(err));

  window.updateQuizCount = function() {
    if (!scopeMsg) return;
    const scopeEl = document.querySelector('input[name="q-scope"]:checked');
    if (!scopeEl) return;
    const scope = scopeEl.value;
    let count = (scope === 'all') ? loadedWords.length : loadedWords.filter(w => myFavs.includes(w.word)).length;
    scopeMsg.textContent = `所選範圍共有 ${count} 個單字`;
  };

  // ============================================================
  // 2. 開始測驗邏輯
  // ============================================================

  startBtn.addEventListener('click', () => {
    const scope = document.querySelector('input[name="q-scope"]:checked').value;
    let targetWords = (scope === 'all') ? loadedWords : loadedWords.filter(w => myFavs.includes(w.word));

    if (targetWords.length === 0) { alert('所選範圍內沒有單字！'); return; }
    
    const selectedTypes = getSelectedTypes(); 
    if (selectedTypes.length === 0) { alert('請至少選擇一種測驗類型'); return; }

    targetWords = targetWords.filter(w => {
        return selectedTypes.some(type => w[`type-${type}`] !== false);
    });

    if (targetWords.length === 0) { alert('所選範圍內的單字不支援勾選的測驗類型！'); return; }

    pool = [...targetWords]; 

    const numWanted = getNumWanted();
    quizList = shuffle([...pool]).slice(0, Math.min(numWanted, pool.length));
    
    wrongQuestions = []; 
    startQuizSession();
  });

  mistakeBtn.addEventListener('click', () => {
    if (wrongQuestions.length === 0) return;
    
    const selectedTypes = getSelectedTypes();
    if (selectedTypes.length === 0) { alert('請至少選擇一種測驗類型'); return; }

    const validWrongs = wrongQuestions.filter(w => {
        return selectedTypes.some(type => w[`type-${type}`] !== false);
    });

    if (validWrongs.length === 0) { alert('錯題列表中的單字不支援目前勾選的測驗類型'); return; }

    quizList = shuffle([...validWrongs]);
    wrongQuestions = []; 
    startQuizSession();
  });

  function startQuizSession() {
    currentSessionWrongs = []; 
    currentIndex = 0;
    score = 0;

    setupSection.style.display = 'none';
    mistakeArea.style.display = 'none'; 
    quizSection.style.display = 'block';
    
    nextQuestion();
  }

  // ============================================================
  // 3. 測驗流程
  // ============================================================

  function nextQuestion() {
    revealed = false;
    optionAnswered = false;

    if (currentIndex >= quizList.length) {
      endQuiz();
      return;
    }

    currentQuestion = quizList[currentIndex];
    progressEl.textContent = `${currentIndex + 1} / ${quizList.length}`;
    scoreEl.textContent = `得分：${score}`;
    renderQuestion(currentQuestion);
  }

  function endQuiz() {
    clearTimer();
    quizSection.style.display = 'none';
    setupSection.style.display = 'block'; 

    let globalMistakes = JSON.parse(localStorage.getItem('english_mistakes') || '[]');
    let hasNewMistake = false;
    
    currentSessionWrongs.forEach(q => {
        if(!globalMistakes.includes(q.word)) {
            globalMistakes.push(q.word);
            hasNewMistake = true;
        }
        if(!wrongQuestions.some(wq => wq.word === q.word && wq.chinese === q.chinese)) {
            wrongQuestions.push(q);
        }
    });
    if(hasNewMistake) {
        localStorage.setItem('english_mistakes', JSON.stringify(globalMistakes));
    }

    mistakeArea.style.display = 'block';
    lastScoreInfo.textContent = `上次得分：${score} / ${quizList.length}`;
    
    if (wrongQuestions.length > 0) {
        mistakeBtn.style.display = 'inline-block';
        mistakeBtn.textContent = `錯題訂正 (${wrongQuestions.length} 題)`;
    } else {
        mistakeBtn.style.display = 'none';
        lastScoreInfo.innerHTML += ` <span style="color:#2ecc71">🎉 全對！</span>`;
    }
  }

  function renderQuestion(q) {
    const userSelectedTypes = getSelectedTypes();
    const validTypesForWord = userSelectedTypes.filter(t => q[`type-${t}`] !== false);

    if (validTypesForWord.length === 0) {
        currentIndex++;
        nextQuestion();
        return;
    }

    const type = validTypesForWord[Math.floor(Math.random() * validTypesForWord.length)];
    currentType = type;

    questionArea.innerHTML = '';
    showAnswerBtn.style.display = 'none';
    showAnswerBtn.disabled = false;
    delete q._lastChosen;

    const speakBtnHtml = `<button type="button" class="tts-btn" title="朗讀"><svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></button>`;
    const playAudio = () => { if(q.word){ window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(q.word); u.lang='en-US'; window.speechSynthesis.speak(u);} };
    const bindSpeak = (el) => { const b=el.querySelector('.tts-btn'); if(b) b.onclick=(e)=>{e.stopPropagation();playAudio();}; };
    const onTimeout = () => { playAudio(); revealAnswer(false); }; 

    const generateOptions = (answerText, isChinese) => {
        const poolKey = isChinese ? 'chinese' : 'word';
        const candidates = loadedWords.filter(w => {
            if (w[poolKey] === answerText) return false;
            if (w.word === q.word) return false; 
            return true;
        });
        const uniqueCandidates = [...new Set(candidates.map(w => w[poolKey]))];
        shuffle(uniqueCandidates);
        const opts = [answerText];
        while(opts.length < 4 && uniqueCandidates.length > 0) opts.push(uniqueCandidates.pop());
        shuffle(opts);
        return opts;
    };

    if (type === 'en2ch') {
        q._lastChosen = q.chinese;
        const h = mkHeader(q.word, q.pos, speakBtnHtml);
        questionArea.appendChild(h); bindSpeak(h);
        
        const list = document.createElement('div'); list.className='options';
        generateOptions(q.chinese, true).forEach(t => {
            const b = mkBtn(t, () => checkChoice(b, t, q.chinese));
            list.appendChild(b);
        });
        questionArea.appendChild(list);
        startTimer(10, t=>timerEl.textContent=`剩餘 ${t}s`, onTimeout);

    } else if (type === 'ch2en') {
        q._lastChosen = q.word;
        const h = mkHeader(q.chinese, q.pos, speakBtnHtml);
        questionArea.appendChild(h); bindSpeak(h);

        const list = document.createElement('div'); list.className='options';
        generateOptions(q.word, false).forEach(t => {
            const b = mkBtn(t, () => checkChoice(b, t, q.word));
            list.appendChild(b);
        });
        questionArea.appendChild(list);
        startTimer(10, t=>timerEl.textContent=`剩餘 ${t}s`, onTimeout);

    } else {
        const h = mkHeader(q.chinese, q.pos, speakBtnHtml);
        questionArea.appendChild(h); bindSpeak(h);
        const inp = document.createElement('input'); inp.className='spell-input'; inp.placeholder='輸入英文'; inp.autocomplete='off';
        questionArea.appendChild(inp);
        showAnswerBtn.style.display='inline-block';
        
        inp.onkeydown = (e) => { if(e.key==='Enter') { if(!revealed) { showAnswerBtn.disabled=true; revealAnswer(true); } } };
        
        const defaultSpellTime = 25;
        const spellTime = (typeof q['time-spell'] === 'number' && q['time-spell'] > 0) 
                          ? q['time-spell'] 
                          : defaultSpellTime;

        startTimer(spellTime, t=>timerEl.textContent=`剩餘 ${t}s`, onTimeout);
        setTimeout(() => { inp.focus(); }, 50);
    }
  }

  function checkChoice(btn, val, correct) {
    if (optionAnswered) return; optionAnswered = true; clearTimer();
    const isCorrect = (val === correct);
    if (isCorrect) score++; else recordWrong();
    
    if(!isCorrect) btn.classList.add('wrong');
    document.querySelectorAll('.option').forEach(b => {
      b.disabled = true;
      if(b.innerText === correct) b.classList.add('correct'); else b.classList.add('disabled');
    });
    setTimeout(() => { currentIndex++; nextQuestion(); }, 1200);
  }

  function revealAnswer(manual) {
    if (revealed) return; revealed = true; clearTimer();
    if (showAnswerBtn) showAnswerBtn.disabled = true;
    
    let isCorrect = false;
    if (currentType === 'spell') {
        const inp = document.querySelector('.spell-input');
        const val = inp ? inp.value.trim().toLowerCase() : '';
        const correctStr = currentQuestion.word;
        
        const possibleAnswers = correctStr.split(/[\/,]+/).map(s => s.trim().toLowerCase());
        isCorrect = possibleAnswers.includes(val);

        const div = document.createElement('div');
        div.className = 'answer-display ' + (isCorrect ? 'correct' : 'wrong');
        
        // --- 修改處：決定顯示的答案 ---
        // 如果有設定 standard_ans，就顯示它；否則顯示原本的 word (可能包含斜線)
        const displayAnswer = currentQuestion.standard_ans 
                              ? currentQuestion.standard_ans 
                              : correctStr;

        div.textContent = displayAnswer;
        questionArea.appendChild(div);
    } else {
        const correct = currentQuestion._lastChosen;
        document.querySelectorAll('.option').forEach(o => {
            o.disabled = true;
            if(o.innerText === correct) o.classList.add('correct'); else o.classList.add('disabled');
        });
    }

    if (isCorrect) score++; else recordWrong();
    setTimeout(() => { currentIndex++; nextQuestion(); }, 2500);
  }

  function recordWrong() {
      if(!currentSessionWrongs.some(q => q.word === currentQuestion.word && q.chinese === currentQuestion.chinese)) {
          currentSessionWrongs.push(currentQuestion);
      }
  }

  function mkHeader(main, pos, icon) {
      const d=document.createElement('div'); d.className='q-header';
      d.innerHTML = `${icon}<div class="q-text">${escapeHtml(main)}</div><div class="q-pos">${pos}</div>`;
      return d;
  }
  function mkBtn(txt, click) {
      const b=document.createElement('button'); b.className='option btn'; b.innerText=txt; b.onclick=click; return b;
  }
  function shuffle(a) { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
  function escapeHtml(s) { return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function getSelectedTypes() {
    const t=[]; 
    if(document.getElementById('type-en2ch').checked) t.push('en2ch');
    if(document.getElementById('type-ch2en').checked) t.push('ch2en');
    if(document.getElementById('type-spell').checked) t.push('spell');
    return t;
  }
  function getNumWanted() { const v=document.querySelector('input[name="num"]:checked'); return v?(v.value==='all'?Infinity:Number(v.value)):Infinity; }
  function clearTimer() { if(timer){clearInterval(timer);timer=null;} timerEl.classList.remove('low','paused'); }
  function startTimer(sec, tick, exp) {
    clearTimer(); let t=sec; tick(t);
    timer = setInterval(() => { t--; tick(t); if(t<=3)timerEl.classList.add('low'); if(t<=0){clearTimer();if(exp)exp();} }, 1000);
  }

  const exitModal = document.getElementById('exit-modal');
  if(exitBtn) exitBtn.onclick = (e) => { e.preventDefault(); exitModal.style.display='flex'; clearTimer(); }; 
  document.getElementById('exit-cancel').onclick = () => { exitModal.style.display='none'; };
  document.getElementById('exit-confirm').onclick = () => { exitModal.style.display='none'; endQuiz(); };
});