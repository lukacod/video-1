/* script.js v3
 - Fixes: record button, gallery import, playback speeds, 240fps capability checks
 - Adds: beep sound at start of recording and precise timer (mm:ss.cc)
 - Notes: Browser/hardware limitations mean 240fps may not be possible in many mobile browsers. We try best-effort.
*/
document.addEventListener('DOMContentLoaded', () => {
  const preview = document.getElementById('preview');
  const recordBtn = document.getElementById('recordBtn');
  const fpsSelect = document.getElementById('fpsSelect');
  const fileInput = document.getElementById('fileInput');
  const galleryBtn = document.getElementById('galleryBtn');
  const playbackArea = document.getElementById('playbackArea');
  const playback = document.getElementById('playback');
  const saveBtn = document.getElementById('saveBtn');
  const closePlayback = document.getElementById('closePlayback');
  const speedNormal = document.getElementById('speedNormal');
  const speedSlow = document.getElementById('speedSlow');
  const speedOverlay = document.getElementById('speedOverlay');
  const message = document.getElementById('message');
  const timerLabel = document.getElementById('timer');

  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let recordStart = 0;
  let timerInterval = null;
  let timerT0 = 0;
  let lastBlob = null;
  let actualFrameRate = null;

  const supportsGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const supportsMediaRecorder = typeof MediaRecorder !== 'undefined' && !!window.MediaRecorder;

  function showMessage(txt, ms=2000) {
    message.textContent = txt;
    message.classList.remove('hidden');
    if (message._timeout) clearTimeout(message._timeout);
    message._timeout = setTimeout(()=> message.classList.add('hidden'), ms);
  }

  function chooseMimeType() {
    if (!supportsMediaRecorder) return '';
    const candidates = [
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    for (const t of candidates) {
      try {
        if (t && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
      } catch (e) {}
    }
    return '';
  }

  // play short beep using WebAudio
  function beep(duration = 0.12, freq = 880, vol=0.2) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, duration*1000);
    } catch(e) {
      console.warn('beep failed', e);
    }
  }

  async function startPreview() {
    if (!supportsGetUserMedia) {
      showMessage('getUserMedia 미지원 브라우저입니다.', 5000);
      return false;
    }
    const fps = Number(fpsSelect.value) || 30;
    let constraints = {
      audio: true,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    if (fps === 240) constraints.video.frameRate = { ideal: 240 };
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      // try to apply exact fps if requested
      if (fps === 240 && mediaStream) {
        try {
          const vt = mediaStream.getVideoTracks()[0];
          const caps = vt.getCapabilities ? vt.getCapabilities() : null;
          if (caps && caps.frameRate && caps.frameRate.max && caps.frameRate.max >= 240) {
            await vt.applyConstraints({ advanced: [{ frameRate: 240 }] });
          } else {
            const opt = fpsSelect.querySelector('option[value="240"]');
            if (opt) { opt.disabled = true; opt.textContent = '240fps (미지원)'; }
          }
        } catch(e) { console.warn('applyConstraints 240 failed', e); }
      }
      preview.srcObject = mediaStream;
      await preview.play();
      try {
        const vt = mediaStream.getVideoTracks()[0];
        const settings = vt.getSettings ? vt.getSettings() : null;
        actualFrameRate = settings && settings.frameRate ? settings.frameRate : null;
        if (actualFrameRate) showMessage('카메라 준비됨 — 실제 FPS: ' + actualFrameRate, 1500);
        else showMessage('카메라 준비됨', 1200);
      } catch(e) { showMessage('카메라 준비됨', 1200); }
      return true;
    } catch (err) {
      console.error('getUserMedia error', err);
      showMessage('카메라 접근 실패: ' + (err && err.message ? err.message : err), 4000);
      return false;
    }
  }

  function stopPreview() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
      preview.srcObject = null;
      actualFrameRate = null;
    }
  }

  function startTimer() {
    timerT0 = performance.now();
    timerInterval = setInterval(() => {
      const diffMs = performance.now() - timerT0;
      const mm = Math.floor(diffMs/60000).toString().padStart(2,'0');
      const ss = Math.floor((diffMs%60000)/1000).toString().padStart(2,'0');
      const cs = Math.floor((diffMs%1000)/10).toString().padStart(2,'0');
      timerLabel.textContent = `${mm}:${ss}.${cs}`;
    }, 80);
  }
  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  async function startRecording() {
    if (!supportsMediaRecorder) {
      showMessage('녹화를 지원하지 않는 브라우저입니다.', 4000);
      return;
    }
    // ensure preview/stream exists and is active
    const ok = await startPreview();
    if (!ok) return;
    recordedChunks = [];
    const mime = chooseMimeType();
    let options = mime ? { mimeType: mime } : {};
    try {
      mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch (e) {
      try { mediaRecorder = new MediaRecorder(mediaStream); } catch (err) {
        console.error('MediaRecorder init failed', err);
        showMessage('녹화를 시작할 수 없습니다.', 3000);
        return;
      }
    }

    mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data); };
    mediaRecorder.onstop = handleRecordingStop;
    mediaRecorder.onerror = (ev) => { console.error('recorder error', ev); showMessage('녹화 중 오류가 발생했습니다', 3000); };

    // play beep before start to give clear user feedback (needs user gesture)
    beep(0.12, 880, 0.25);
    mediaRecorder.start();
    isRecording = true;
    recordStart = Date.now();
    recordBtn.classList.add('recording');
    recordBtn.setAttribute('aria-pressed','true');
    startTimer();
    showMessage('녹화 시작', 900);
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    isRecording = false;
    recordBtn.classList.remove('recording');
    recordBtn.setAttribute('aria-pressed','false');
    stopTimer();
    showMessage('녹화 중지', 900);
    // keep preview running so user can re-record quickly
  }

  function handleRecordingStop() {
    try {
      const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'video/webm' });
      lastBlob = blob;
      const url = URL.createObjectURL(blob);
      openPlayback(url, blob);
    } catch (e) {
      console.error('handleRecordingStop error', e);
      showMessage('녹화 파일 처리 중 오류가 발생했습니다', 3000);
    }
  }

  function openPlayback(url, blob) {
    playbackArea.classList.remove('hidden');
    playbackArea.setAttribute('aria-hidden','false');
    playback.src = url;
    playback.playbackRate = 1.0;
    try { if (playback.webkitEnterFullscreen) playback.webkitEnterFullscreen(); else playback.requestFullscreen(); } catch(e){}
    playback.play();
    lastBlob = blob;
    saveBtn.onclick = () => saveVideoBlob(blob);
    setSpeedOverlay(1.0);
    // highlight speed buttons
    speedNormal.classList.add('active');
    speedSlow.classList.remove('active');
  }

  async function saveVideoBlob(blob) {
    if (!blob) { showMessage('저장할 파일이 없습니다', 2000); return; }
    const fileName = 'swing_' + Date.now() + (blob.type.includes('mp4') ? '.mp4' : '.webm');
    try {
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '골프 스윙' });
        showMessage('공유 시트가 열렸습니다. 비디오 저장을 선택하세요.', 2500);
        return;
      }
    } catch (e) { console.warn('Share API failed', e); }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    showMessage('다운로드가 시작되었습니다. 다운로드 완료 후 링크를 길게 눌러 사진 앱에 저장하세요.', 4000);
  }

  closePlayback.addEventListener('click', () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e){}
    try { if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch(e){}
    playback.pause(); playback.src = '';
    playbackArea.classList.add('hidden'); playbackArea.setAttribute('aria-hidden','true');
  });

  function setSpeedOverlay(rate) {
    if (!speedOverlay) return;
    speedOverlay.textContent = rate === 1 ? '1x' : (rate === 0.125 ? '1/8x' : rate + 'x');
    if (rate === 1) speedOverlay.classList.add('hidden'); else speedOverlay.classList.remove('hidden');
  }

  speedNormal.addEventListener('click', () => {
    if (!playback.src) return;
    playback.playbackRate = 1.0;
    setSpeedOverlay(1.0);
    speedNormal.classList.add('active');
    speedSlow.classList.remove('active');
    showMessage('1x 재생',900);
  });
  speedSlow.addEventListener('click', () => {
    if (!playback.src) return;
    playback.playbackRate = 0.125;
    setSpeedOverlay(0.125);
    speedSlow.classList.add('active');
    speedNormal.classList.remove('active');
    showMessage('1/8x 재생',900);
  });

  galleryBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) { showMessage('파일 선택 취소',1200); return; }
    // ensure playback uses only 1x or 1/8x; we will always set playbackRate via buttons
    const url = URL.createObjectURL(f);
    openPlayback(url, f);
    saveBtn.onclick = () => saveFileObject(f);
    // set default to 1x
    playback.playbackRate = 1.0;
    setSpeedOverlay(1.0);
    speedNormal.classList.add('active');
    speedSlow.classList.remove('active');
  });

  async function saveFileObject(file) {
    if (!file) return;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '골프 스윙' });
        showMessage('공유 시트가 열렸습니다. 비디오 저장을 선택하세요.', 2500);
        return;
      }
    } catch (e) { console.warn(e); }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = file.name || 'swing.mp4'; document.body.appendChild(a); a.click(); a.remove();
    showMessage('다운로드가 시작되었습니다. 다운로드 완료 후 링크를 길게 눌러 사진 앱에 저장하세요.', 4000);
  }

  // record button gesture handler: support toggle and prevent double-actions
  recordBtn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  });

  // initialization: start preview to allow capability detection (but do not start capturing audio until record)
  (async function init() {
    if (!supportsGetUserMedia) {
      showMessage('getUserMedia 미지원 브라우저입니다.', 6000);
      recordBtn.disabled = true;
      return;
    }
    // Start preview with default fps 30 to detect capabilities
    await startPreview();
    // detect 240fps support
    try {
      const vt = mediaStream && mediaStream.getVideoTracks()[0];
      if (vt && vt.getCapabilities) {
        const caps = vt.getCapabilities();
        if (!(caps && caps.frameRate && caps.frameRate.max && caps.frameRate.max >= 240)) {
          const opt = fpsSelect.querySelector('option[value="240"]');
          if (opt) { opt.disabled = true; opt.textContent = '240fps (미지원)'; }
        } else {
          console.log('240fps POSSIBLE, max=', caps.frameRate.max);
        }
      } else {
        console.log('cannot read capabilities; 240 unknown');
      }
    } catch (e) { console.warn('fps detect error', e); }
  })();

  // restart preview when fps changed (recreate stream)
  fpsSelect.addEventListener('change', async () => {
    stopPreview();
    await startPreview();
    showMessage('FPS 설정 변경: ' + fpsSelect.value, 1200);
  });

}); // DOMContentLoaded end
