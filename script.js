const preview = document.getElementById('preview');
const recordBtn = document.getElementById('recordBtn');
const recordInner = document.getElementById('recordInner');
const fpsSelect = document.getElementById('fpsSelect');
const fileInput = document.getElementById('fileInput');
const galleryBtn = document.getElementById('galleryBtn');
const playbackArea = document.getElementById('playbackArea');
const playback = document.getElementById('playback');
const downloadLink = document.getElementById('downloadLink');
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

async function startPreview() {
  const fps = Number(fpsSelect.value) || 30;
  const constraints = {
    audio: true,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: fps }
    }
  };
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    preview.srcObject = mediaStream;
    await preview.play();
    showMessage('카메라 준비됨 (요청 FPS: ' + fps + ')', 1500);
  } catch (err) {
    console.error('getUserMedia error', err);
    showMessage('카메라 접근 실패: ' + err.message, 4000);
  }
}

function stopPreview() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
    preview.srcObject = null;
  }
}

recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    await startRecording();
  } else {
    await stopRecording();
  }
});

async function startRecording() {
  if (!mediaStream) {
    await startPreview();
    if (!mediaStream) return;
  }
  recordedChunks = [];
  try {
    let options = { mimeType: 'video/mp4' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp9' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};
    mediaRecorder = new MediaRecorder(mediaStream, options);
  } catch (e) {
    try {
      mediaRecorder = new MediaRecorder(mediaStream);
    } catch (err) {
      console.error('MediaRecorder unsupported', err);
      showMessage('녹화 불가능: 브라우저가 MediaRecorder를 지원하지 않습니다.', 4000);
      return;
    }
  }

  mediaRecorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
  };
  mediaRecorder.onstop = handleRecordingStop;
  mediaRecorder.start();
  isRecording = true;
  recordInner.classList.add('recording');
  recordBtn.classList.add('recording');
  recordStart = Date.now();
  startTimer();
  showMessage('녹화 시작', 1000);
}

async function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    recordInner.classList.remove('recording');
    recordBtn.classList.remove('recording');
    stopTimer();
    showMessage('녹화 중지', 1000);
  }
}

function handleRecordingStop() {
  const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'video/webm' });
  const url = URL.createObjectURL(blob);
  openPlayback(url, blob);
  downloadLink.href = url;
  downloadLink.download = 'swing.' + (blob.type.includes('mp4') ? 'mp4' : 'webm');
}

function openPlayback(url, blob) {
  playbackArea.classList.remove('hidden');
  playback.src = url;
  playback.playbackRate = 1.0;
  requestFullscreenSafe(playback);
  playback.play();
}

function requestFullscreenSafe(el) {
  try {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch (e) {
    console.warn('Fullscreen failed', e);
  }
}

closePlayback.addEventListener('click', () => {
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e){}
  playback.pause();
  playback.src = '';
  playbackArea.classList.add('hidden');
});

speedNormal.addEventListener('click', () => {
  playback.playbackRate = 1.0;
});
speedSlow.addEventListener('click', () => {
  playback.playbackRate = 0.125;
});

galleryBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  openPlayback(url, f);
  downloadLink.href = url;
  downloadLink.download = f.name || 'swing.mp4';
});

function startTimer() {
  timerLabel.textContent = '00:00';
  timerInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - recordStart) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2,'0');
    const ss = String(diff % 60).padStart(2,'0');
    timerLabel.textContent = `${mm}:${ss}`;
  }, 200);
}
function stopTimer() {
  clearInterval(timerInterval);
}

let msgTimeout = null;
function showMessage(txt, ms=2000) {
  message.textContent = txt;
  message.classList.remove('hidden');
  if (msgTimeout) clearTimeout(msgTimeout);
  msgTimeout = setTimeout(()=> message.classList.add('hidden'), ms);
}

window.addEventListener('load', async () => {
  try { await startPreview(); } catch(e){ console.log(e); showMessage('카메라 미리보기 시작 실패. 화면을 탭하여 권한을 허용하세요.',4000); }
});

fpsSelect.addEventListener('change', async () => {
  stopPreview();
  await startPreview();
  showMessage('FPS 설정 변경: ' + fpsSelect.value, 1200);
});
