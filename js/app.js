/* ============================================================
   Lumina Scan — Lógica do scanner
   Decodificação 100% local via ZXing (câmera + imagem)
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Elementos ---------- */
  var el = {
    video: document.getElementById('camera-video'),
    viewport: document.getElementById('camera-viewport'),
    cameraStatus: document.getElementById('camera-status'),
    startBtn: document.getElementById('start-camera-btn'),
    stopBtn: document.getElementById('stop-camera-btn'),
    switchBtn: document.getElementById('switch-camera-btn'),
    heroUploadBtn: document.getElementById('hero-upload-btn'),
    fileInput: document.getElementById('file-input'),
    dropzone: document.getElementById('dropzone'),
    uploadPreview: document.getElementById('upload-preview'),
    uploadPreviewImg: document.getElementById('upload-preview-img'),
    clearUploadBtn: document.getElementById('clear-upload-btn'),
    resultPanel: document.getElementById('result-panel'),
    resultFormat: document.getElementById('result-format'),
    resultFormatLabel: document.getElementById('result-format-label'),
    resultTime: document.getElementById('result-time'),
    resultContent: document.getElementById('result-content'),
    copyBtn: document.getElementById('copy-btn'),
    openLinkBtn: document.getElementById('open-link-btn'),
    newScanBtn: document.getElementById('new-scan-btn'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    toast: document.getElementById('toast')
  };

  var reader = null;          // ZXing BrowserMultiFormatReader
  var scanning = false;
  var stream = null;
  var facingBack = true;      // alterna câmera traseira/frontal
  var lastResult = null;      // { text, formatLabel, time }
  var HISTORY_KEY = 'lumina_scan_history';
  var HISTORY_LIMIT = 30;
  var toastTimer = null;

  /* Nomes amigáveis dos formatos */
  var FORMAT_NAMES = {
    QR_CODE: 'QR Code',
    DATA_MATRIX: 'Data Matrix',
    AZTEC: 'Aztec',
    PDF_417: 'PDF 417',
    EAN_13: 'EAN-13',
    EAN_8: 'EAN-8',
    UPC_A: 'UPC-A',
    UPC_E: 'UPC-E',
    CODE_128: 'Code 128',
    CODE_39: 'Code 39',
    CODE_93: 'Code 93',
    CODABAR: 'Codabar',
    ITF: 'ITF',
    RSS_14: 'GS1 DataBar',
    MAXICODE: 'MaxiCode'
  };

  /* ---------- Utilidades ---------- */

  function showToast(message, type) {
    el.toast.textContent = message;
    el.toast.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('show');
    }, 2800);
  }

  function isLikelyUrl(text) {
    return /^(https?:\/\/|www\.)[\w\-]+(\.[\w\-]+)+([\/?#][^\s]*)?$/i.test(text.trim());
  }

  function normalizeUrl(text) {
    var t = text.trim();
    return /^www\./i.test(t) ? 'https://' + t : t;
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
           ' às ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function friendlyFormat(formatEnum, formatName) {
    if (formatName && FORMAT_NAMES[formatName]) return FORMAT_NAMES[formatName];
    if (typeof formatEnum === 'number' && typeof ZXing !== 'undefined' &&
        ZXing.BarcodeFormat && ZXing.BarcodeFormat[formatEnum]) {
      var raw = ZXing.BarcodeFormat[formatEnum];
      return FORMAT_NAMES[raw] || raw.replace(/_/g, ' ');
    }
    return (formatName || 'Código').replace(/_/g, ' ');
  }

  /* ---------- Histórico (localStorage) ---------- */

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) { /* armazenamento cheio ou bloqueado — ignora */ }
  }

  function addToHistory(text, formatLabel) {
    var list = loadHistory();
    list.unshift({ text: text, format: formatLabel, ts: Date.now() });
    if (list.length > HISTORY_LIMIT) list = list.slice(0, HISTORY_LIMIT);
    saveHistory(list);
    renderHistory();
  }

  function removeFromHistory(index) {
    var list = loadHistory();
    list.splice(index, 1);
    saveHistory(list);
    renderHistory();
  }

  function renderHistory() {
    var list = loadHistory();
    el.historyList.innerHTML = '';
    el.historyEmpty.style.display = list.length ? 'none' : 'block';
    el.clearHistoryBtn.disabled = list.length === 0;

    list.forEach(function (item, idx) {
      var li = document.createElement('li');
      li.className = 'history-item';

      var icon = document.createElement('span');
      icon.className = 'h-format';
      var isQr = /qr/i.test(item.format || '');
      icon.innerHTML = '<i class="fa-solid ' + (isQr ? 'fa-qrcode' : 'fa-barcode') + '" aria-hidden="true"></i>';

      var body = document.createElement('div');
      body.className = 'h-body';
      var text = document.createElement('div');
      text.className = 'h-text';
      text.textContent = item.text;
      text.title = item.text;
      var meta = document.createElement('div');
      meta.className = 'h-meta';
      meta.textContent = (item.format || 'Código') + ' · ' + formatTime(item.ts);
      body.appendChild(text);
      body.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'h-actions';

      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'h-btn';
      copyBtn.title = 'Copiar conteúdo';
      copyBtn.setAttribute('aria-label', 'Copiar conteúdo');
      copyBtn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
      copyBtn.addEventListener('click', function () { copyText(item.text); });

      actions.appendChild(copyBtn);

      if (isLikelyUrl(item.text)) {
        var link = document.createElement('a');
        link.className = 'h-btn';
        link.href = normalizeUrl(item.text);
        link.target = '_blank';
        link.rel = 'noopener';
        link.title = 'Abrir link';
        link.setAttribute('aria-label', 'Abrir link');
        link.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>';
        actions.appendChild(link);
      }

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'h-btn';
      delBtn.title = 'Remover do histórico';
      delBtn.setAttribute('aria-label', 'Remover do histórico');
      delBtn.innerHTML = '<i class="fa-regular fa-trash-can" aria-hidden="true"></i>';
      delBtn.addEventListener('click', function () {
        removeFromHistory(idx);
        showToast('Leitura removida.');
      });

      actions.appendChild(delBtn);

      li.appendChild(icon);
      li.appendChild(body);
      li.appendChild(actions);
      el.historyList.appendChild(li);
    });
  }

  /* ---------- Cópia ---------- */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { showToast('Copiado para a área de transferência.', 'success'); },
        function () { fallbackCopy(text); }
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Copiado para a área de transferência.', 'success');
    } catch (e) {
      showToast('Não foi possível copiar.', 'error');
    }
    document.body.removeChild(ta);
  }

  /* ---------- Resultado ---------- */

  function showResult(text, formatLabel) {
    lastResult = { text: text, formatLabel: formatLabel, time: Date.now() };

    var isQr = /qr/i.test(formatLabel);
    el.resultFormat.innerHTML = '<i class="fa-solid ' +
      (isQr ? 'fa-qrcode' : 'fa-barcode') + '" aria-hidden="true"></i> <span id="result-format-label">' +
      formatLabel + '</span>';
    el.resultTime.textContent = formatTime(lastResult.time);
    el.resultContent.textContent = text;

    if (isLikelyUrl(text)) {
      el.openLinkBtn.hidden = false;
      el.openLinkBtn.href = normalizeUrl(text);
    } else {
      el.openLinkBtn.hidden = true;
      el.openLinkBtn.removeAttribute('href');
    }

    el.resultPanel.hidden = false;
    el.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    addToHistory(text, formatLabel);
    showToast('Código detectado!', 'success');

    /* Feedback tátil quando disponível */
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
  }

  /* ---------- Câmera ---------- */

  function ensureReader() {
    if (reader) return reader;
    if (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader) {
      showToast('Biblioteca de leitura não carregou. Verifique sua conexão.', 'error');
      return null;
    }
    reader = new ZXing.BrowserMultiFormatReader();
    return reader;
  }

  function setCameraUi(active) {
    el.viewport.classList.toggle('active', active);
    el.cameraStatus.textContent = active ? 'Ao vivo' : 'Inativa';
    el.cameraStatus.classList.toggle('live', active);
    el.startBtn.disabled = active;
    el.stopBtn.disabled = !active;
    el.switchBtn.disabled = !active;
  }

  function startCamera() {
    var r = ensureReader();
    if (!r || scanning) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Seu navegador não permite acesso à câmera.', 'error');
      return;
    }

    var constraints = {
      video: facingBack
        ? { facingMode: { ideal: 'environment' } }
        : { facingMode: 'user' }
    };

    el.cameraStatus.textContent = 'Iniciando…';
    scanning = true;
    setCameraUi(true);

    r.decodeFromConstraints(constraints, el.video, function (result, err) {
      if (result) {
        var rawFmt = (typeof ZXing !== 'undefined' && ZXing.BarcodeFormat)
          ? ZXing.BarcodeFormat[result.getBarcodeFormat()]
          : String(result.getBarcodeFormat());
        el.viewport.classList.add('detected');
        stopCamera();
        showResult(result.getText(), friendlyFormat(null, rawFmt));
      }
      /* Erros de NotFoundException são normais entre frames — ignoramos */
    }).then(function (s) {
      stream = s;
    }).catch(function (err) {
      scanning = false;
      setCameraUi(false);
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        showToast('Permissão de câmera negada. Autorize o acesso no navegador.', 'error');
      } else if (err && err.name === 'NotFoundError') {
        showToast('Nenhuma câmera encontrada neste dispositivo.', 'error');
      } else {
        showToast('Não foi possível iniciar a câmera.', 'error');
      }
    });
  }

  function stopCamera() {
    if (reader) {
      try { reader.reset(); } catch (e) {}
    }
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    el.video.srcObject = null;
    scanning = false;
    el.viewport.classList.remove('detected');
    setCameraUi(false);
  }

  /* ---------- Upload de imagem ---------- */

  function handleImageFile(file) {
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      showToast('Envie um arquivo de imagem (PNG, JPG, WEBP…).', 'error');
      return;
    }

    var r = ensureReader();
    if (!r) return;

    var url = URL.createObjectURL(file);
    el.uploadPreviewImg.src = url;
    el.uploadPreview.hidden = false;
    showToast('Analisando imagem…');

    r.decodeFromImageUrl(url)
      .then(function (result) {
        URL.revokeObjectURL(url);
        var rawFmt = (typeof ZXing !== 'undefined' && ZXing.BarcodeFormat)
          ? ZXing.BarcodeFormat[result.getBarcodeFormat()]
          : String(result.getBarcodeFormat());
        showResult(result.getText(), friendlyFormat(null, rawFmt));
      })
      .catch(function () {
        URL.revokeObjectURL(url);
        showToast('Nenhum código encontrado nesta imagem. Tente outra.', 'error');
      });
  }

  function clearUpload() {
    el.uploadPreview.hidden = true;
    el.uploadPreviewImg.removeAttribute('src');
    el.fileInput.value = '';
  }

  /* ---------- Eventos ---------- */

  el.startBtn.addEventListener('click', startCamera);
  el.stopBtn.addEventListener('click', stopCamera);
  el.switchBtn.addEventListener('click', function () {
    stopCamera();
    facingBack = !facingBack;
    startCamera();
  });

  el.heroUploadBtn.addEventListener('click', function () {
    el.fileInput.click();
  });

  el.fileInput.addEventListener('change', function () {
    if (el.fileInput.files && el.fileInput.files[0]) {
      handleImageFile(el.fileInput.files[0]);
    }
  });

  el.clearUploadBtn.addEventListener('click', clearUpload);

  /* Drag & drop */
  ['dragenter', 'dragover'].forEach(function (evt) {
    el.dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      el.dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(function (evt) {
    el.dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      el.dropzone.classList.remove('dragover');
    });
  });

  el.dropzone.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      handleImageFile(file);
      document.getElementById('scanner-section').scrollIntoView({ behavior: 'smooth' });
    }
  });

  el.dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.fileInput.click();
    }
  });

  /* Resultado */
  el.copyBtn.addEventListener('click', function () {
    if (lastResult) copyText(lastResult.text);
  });

  el.newScanBtn.addEventListener('click', function () {
    el.resultPanel.hidden = true;
    lastResult = null;
    document.getElementById('scanner-section').scrollIntoView({ behavior: 'smooth' });
  });

  /* Histórico */
  el.clearHistoryBtn.addEventListener('click', function () {
    saveHistory([]);
    renderHistory();
    showToast('Histórico limpo.');
  });

  /* Para a câmera ao sair da aba (economia de bateria) */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && scanning) stopCamera();
  });

  window.addEventListener('beforeunload', stopCamera);

  /* ---------- Inicialização ---------- */
  renderHistory();
})();
