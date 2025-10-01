/*
Fixed script: ensures event listeners attach to proper elements,
improves file input handling, and tries to set 240fps when available.
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
  const message = document.getElementById('message');
  const timerLabel = document.getElementById('timer');

  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let recordStart = 0;
  let timerInterval = null;
  let lastBlob = null;

  const supportsGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const supportsMediaRecorder = typeof MediaRecorder !== 'undefined';

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
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const t of candidates) {
      try {
        if (t && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
      } catch (e) {}
    }
    return '';
  }

  async function startPreview() {
    if (!supportsGetUserMedia) {
      showMessage('getUserMedia 미지원 브라우저입니다.', 5000);
      return;
    }
    const fps = Number(fpsSelect.value) || 30;
    const constraints = {
      audio: true,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    if (fps) constraints.video.frameRate = { ideal: fps };
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      // Try applying exact 240fps via applyConstraints if requested
      if (fps === 240) {
        try {
          const vt = mediaStream.getVideoTracks()[0];
          const caps = vt.getCapabilities ? vt.getCapabilities() : null;
          if (caps && caps.frameRate && caps.frameRate.max >= 240) {
            await vt.applyConstraints({ frameRate: 240 });
            // re-get settings
          } else {
            console.log('240fps not available in capabilities', caps && caps.frameRate);
          }
        } catch (e) {
          console.warn('applyConstraints for 240fps failed', e);
        }
      }

      preview.srcObject = mediaStream;
      await preview.play();

      // Check actual frameRate setting if available
      try {
        const vt = mediaStream.getVideoTracks()[0];
        const settings = vt.getSettings ? vt.getSettings() : null;
        if (settings && settings.frameRate) {
          showMessage('카메라 준비됨 — 실제 FPS: ' + settings.frameRate, 1500);
        } else {
          showMessage('카메라 준비됨 (요청: ' + fps + 'fps)', 1200);
        }
      } catch (e) {
        showMessage('카메라 준비됨', 1200);
      }
    } catch (err) {
      console.error('getUserMedia error', err);
      showMessage('카메라 접근 실패: ' + (err && err.message ? err.message : err), 4000);
    }
  }

  function stopPreview() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
      preview.srcObject = null;
    }
  }

  async function startRecording() {
    if (!supportsMediaRecorder) {
      showMessage('녹화를 지원하지 않는 브라우저입니다.', 3000);
      return;
    }
    if (!mediaStream) {
      await startPreview();
      if (!mediaStream) return;
    }
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
    saveBtn.onclick = () => saveVideoBlob(blob);
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
    } catch (e) {
      console.warn('Share API failed', e);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showMessage('다운로드가 시작되었습니다. 다운로드 완료 후 링크를 길게 눌러 사진 앱에 저장하세요.', 4000);
  }

  closePlayback.addEventListener('click', () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e){}
    try { if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch(e){}
    playback.pause();
    playback.src = '';
    playbackArea.classList.add('hidden');
    playbackArea.setAttribute('aria-hidden','true');
  });

  speedNormal.addEventListener('click', () => { playback.playbackRate = 1.0; showMessage('1x 재생', 900); });
  speedSlow.addEventListener('click', () => { playback.playbackRate = 0.125; showMessage('1/8x 재생', 900); });

  galleryBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    openPlayback(url, f);
    saveBtn.onclick = () => saveFileObject(f);
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
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'swing.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showMessage('다운로드가 시작되었습니다. 다운로드 완료 후 링크를 길게 눌러 사진 앱에 저장하세요.', 4000);
  }

  function startTimer() {
    timerLabel.textContent = '00:00';
    timerInterval = setInterval(() => {
      const diff = Math.floor((Date.now() - recordStart) / 1000);
      const mm = String(Math.floor(diff / 60)).padStart(2,'0');
      const ss = String(diff % 60).padStart(2,'0');
      timerLabel.textContent = `${mm}:${ss}`;
    }, 200);
  }
  function stopTimer() { clearInterval(timerInterval); }

  // On load: start preview and detect 240fps capability; if not supported, disable option
  (async function init(){
    if (!supportsGetUserMedia) {
      showMessage('getUserMedia 미지원 브라우저입니다.', 6000);
      recordBtn.disabled = true;
      return;
    }
    await startPreview();
    // detect 240fps support
    try {
      const vt = mediaStream && mediaStream.getVideoTracks()[0];
      if (vt && vt.getCapabilities) {
        const caps = vt.getCapabilities();
        if (caps && caps.frameRate && caps.frameRate.max && caps.frameRate.max >= 240) {
          // supported - leave option
          console.log('Device supports up to', caps.frameRate.max);
        } else {
          // not supported - disable 240 option in UI
          const opt = fpsSelect.querySelector('option[value="240"]');
          if (opt) { opt.disabled = true; opt.textContent = '240fps (미지원)'; }
        }
      } else {
        // can't detect - leave option but warn user
        console.log('Cannot read track capabilities; 240fps support unknown');
      }
    } catch (e) {
      console.warn('fps detect error', e);
    }

    // ensure record button click works (some browsers need user gesture to enable camera stream)
    recordBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (!supportsMediaRecorder) {
        showMessage('이 브라우저는 녹화를 지원하지 않습니다. 사진첩에서 영상을 불러와 재생하세요.', 4000);
        return;
      }
      if (!isRecording) await startRecording(); else stopRecording();
    });
  })();

  // restart preview when fps changed
  fpsSelect.addEventListener('change', async () => {
    stopPreview();
    await startPreview();
    showMessage('FPS 설정 변경: ' + fpsSelect.value, 1200);
  });

}); // DOMContentLoaded end
