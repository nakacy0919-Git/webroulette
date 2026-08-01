document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('rouletteCanvas');
    const ctx = canvas.getContext('2d');
    const canvasContainer = document.getElementById('canvasContainer');
    const nameListTextarea = document.getElementById('nameList');
    const listTitleInput = document.getElementById('listTitle');
    const itemCountSpan = document.getElementById('itemCount');
    const startBtn = document.getElementById('startBtn');
    const updateBtn = document.getElementById('updateBtn');
    const saveHistoryBtn = document.getElementById('saveHistoryBtn');
    const historyContainer = document.getElementById('historyContainer');
    const appContainer = document.getElementById('appContainer');
    const resultDisplay = document.getElementById('resultDisplay');
    const resultName = document.getElementById('resultName');
    
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    // 追加した結果操作ボタン
    const removeAndContinueBtn = document.getElementById('removeAndContinueBtn');
    const closeResultBtn = document.getElementById('closeResultBtn');
    
    const rouletteSection = document.getElementById('rouletteSection');
    const soundToggle = document.getElementById('soundToggle');
    const speedRange = document.getElementById('speedRange');

    const disclaimerLink = document.getElementById('disclaimerLink');
    const disclaimerModal = document.getElementById('disclaimerModal');
    const closeModalBtn = document.querySelector('.close-modal');

    const twitterBtn = document.querySelector('.share-btn.twitter');
    const facebookBtn = document.querySelector('.share-btn.facebook');
    const lineBtn = document.querySelector('.share-btn.line');
    const copyLinkBtn = document.querySelector('.share-btn.copy-link');

    const colors = ['#54a0ff', '#ff6b6b', '#feca57', '#1dd1a1', '#00d2d3', '#ff9ff3', '#a29bfe'];
    
    let items = [];
    let currentAngle = 0;
    let isSpinning = false;
    let animationId;
    let lastTickIndex = -1;
    let lastSelectedIndex = -1; // 最後に選ばれたインデックスを記憶
    
    const BASE_CANVAS_SIZE = 500; 
    let currentScale = 1.0;
    const MAX_SCALE = 2.0;
    const MIN_SCALE = 0.5;
    const SCALE_STEP = 0.1;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    function playTickSound() {
        if (!soundToggle.checked) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    }

    function playResultSound() {
        if (!soundToggle.checked) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; 
        frequencies.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (i * 0.05));
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + (i * 0.05));
            gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + (i * 0.05) + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i * 0.05) + 1.5);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + (i * 0.05));
            osc.stop(audioCtx.currentTime + (i * 0.05) + 1.5);
        });
    }

    // Web Speech API を使用した音声読み上げ
    function speakResult(text) {
        if (!soundToggle.checked) return;
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US'; // 英語ベースの発音
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    }

    function init() {
        renderHistory();
        const lastNames = localStorage.getItem('currentNames');
        const lastTitle = localStorage.getItem('currentTitle');
        if (lastNames) {
            nameListTextarea.value = lastNames;
            listTitleInput.value = lastTitle || '';
        } else {
            nameListTextarea.value = "なまえ 1\nなまえ 2\nなまえ 3\nなまえ 4\nなまえ 5";
        }
        updateItems();
    }

    function updateItems() {
        const text = nameListTextarea.value;
        const title = listTitleInput.value;
        items = text.split('\n').map(name => name.trim()).filter(name => name !== '');
        itemCountSpan.textContent = items.length;
        localStorage.setItem('currentNames', text);
        localStorage.setItem('currentTitle', title);
        drawRoulette();
    }

    function saveToHistory() {
        const title = listTitleInput.value.trim() || `リスト (${new Date().toLocaleDateString()})`;
        const text = nameListTextarea.value.trim();
        if (!text) return alert("名前リストが空です！");
        let history = JSON.parse(localStorage.getItem('rouletteHistory') || '[]');
        const existingIndex = history.findIndex(h => h.title === title);
        if (existingIndex >= 0) {
            history[existingIndex].names = text;
        } else {
            history.push({ id: Date.now(), title: title, names: text });
        }
        localStorage.setItem('rouletteHistory', JSON.stringify(history));
        listTitleInput.value = title;
        renderHistory();
        alert(`「${title}」を保存しました。`);
    }

    function renderHistory() {
        const history = JSON.parse(localStorage.getItem('rouletteHistory') || '[]');
        historyContainer.innerHTML = '';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            const span = document.createElement('span');
            span.className = 'history-name';
            span.textContent = item.title;
            span.onclick = () => {
                listTitleInput.value = item.title;
                nameListTextarea.value = item.names;
                updateItems();
            };
            const delBtn = document.createElement('span');
            delBtn.className = 'delete-btn';
            delBtn.textContent = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`「${item.title}」を削除しますか？`)) {
                    const newHistory = history.filter(h => h.id !== item.id);
                    localStorage.setItem('rouletteHistory', JSON.stringify(newHistory));
                    renderHistory();
                }
            };
            div.appendChild(span);
            div.appendChild(delBtn);
            historyContainer.appendChild(div);
        });
    }

    function drawRoulette() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (items.length === 0) return;

        const arc = (2 * Math.PI) / items.length;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = centerX - 20;

        for (let i = 0; i < items.length; i++) {
            const angle = currentAngle + i * arc;
            
            ctx.beginPath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, angle, angle + arc, false);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 6; 
            ctx.stroke();

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle + arc / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = "#333";
            ctx.font = "bold 44px sans-serif"; 
            ctx.fillText(items[i], radius - 50, 16);
            ctx.restore();
        }
    }

    function getCurrentIndex() {
        if (items.length === 0) return 0;
        const arc = (2 * Math.PI) / items.length;
        const normalizedAngle = currentAngle % (2 * Math.PI);
        const offset = (3 * Math.PI / 2) - normalizedAngle;
        let index = Math.floor((offset / arc)) % items.length;
        if (index < 0) index = items.length - Math.abs(index);
        else index = items.length - index - 1;
        return index;
    }

    function spin() {
        if (isSpinning || items.length === 0) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        isSpinning = true;
        resultDisplay.style.display = 'none';
        
        startBtn.textContent = '回転中...';
        startBtn.disabled = true;

        let speed = parseInt(speedRange.value); 
        let deceleration = 0.992;
        let stopThreshold = 0.05;
        lastTickIndex = getCurrentIndex();

        function animate() {
            currentAngle += speed * (Math.PI / 180);
            drawRoulette();

            const currentIndex = getCurrentIndex();
            if (currentIndex !== lastTickIndex) {
                playTickSound();
                lastTickIndex = currentIndex;
            }

            speed *= deceleration;

            if (speed > stopThreshold) {
                animationId = requestAnimationFrame(animate);
            } else {
                isSpinning = false;
                startBtn.textContent = '▶ スタート';
                startBtn.disabled = false;
                showResult(currentIndex);
            }
        }
        animate();
    }

    function showResult(index) {
        lastSelectedIndex = index;
        resultName.textContent = items[index];
        resultDisplay.style.display = 'block';
        playResultSound();
        speakResult(items[index]); // 読み上げ機能の呼び出し
    }

    function applyCanvasSize() {
        const newSize = BASE_CANVAS_SIZE * currentScale;
        canvasContainer.style.width = `${newSize}px`;
        canvasContainer.style.height = `${newSize}px`;
    }

    updateBtn.addEventListener('click', updateItems);
    saveHistoryBtn.addEventListener('click', saveToHistory);
    startBtn.addEventListener('click', spin);

    zoomInBtn.addEventListener('click', () => {
        currentScale = Math.min(currentScale + SCALE_STEP, MAX_SCALE);
        applyCanvasSize();
    });

    zoomOutBtn.addEventListener('click', () => {
        currentScale = Math.max(currentScale - SCALE_STEP, MIN_SCALE);
        applyCanvasSize();
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            rouletteSection.requestFullscreen().catch(err => {
                alert(`全画面表示エラー: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            currentScale = 1.0;
            applyCanvasSize();
        }
    });

    // 「削除して続ける」ボタンのイベント
    if (removeAndContinueBtn) {
        removeAndContinueBtn.addEventListener('click', () => {
            if (lastSelectedIndex !== -1 && items.length > 0) {
                items.splice(lastSelectedIndex, 1);
                nameListTextarea.value = items.join('\n');
                itemCountSpan.textContent = items.length;
                localStorage.setItem('currentNames', nameListTextarea.value);
                drawRoulette();
                resultDisplay.style.display = 'none';
                lastSelectedIndex = -1;
            }
        });
    }

    // 「閉じる」ボタンのイベント
    if (closeResultBtn) {
        closeResultBtn.addEventListener('click', () => {
            resultDisplay.style.display = 'none';
        });
    }

    if (disclaimerLink) {
        disclaimerLink.addEventListener('click', (e) => {
            e.preventDefault();
            disclaimerModal.style.display = "block";
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            disclaimerModal.style.display = "none";
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target == disclaimerModal) {
            disclaimerModal.style.display = "none";
        }
    });

    const shareUrl = window.location.href; 
    const shareText = "SpinTalk - 日々の授業やイベントを盛り上げるおしゃれなルーレット機能！";

    if (twitterBtn) {
        twitterBtn.addEventListener('click', () => {
            const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
            window.open(url, '_blank', 'width=600,height=400');
        });
    }

    if (facebookBtn) {
        facebookBtn.addEventListener('click', () => {
            const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            window.open(url, '_blank', 'width=600,height=400');
        });
    }

    if (lineBtn) {
        lineBtn.addEventListener('click', () => {
            const url = `https://line.me/R/msg/text/?${encodeURIComponent(shareText + '\n' + shareUrl)}`;
            window.open(url, '_blank', 'width=600,height=500');
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('リンクをクリップボードにコピーしました！');
            }).catch(err => {
                alert('リンクのコピーに失敗しました。');
            });
        });
    }

    init();
});