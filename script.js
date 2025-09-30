\
/*
 Improved script.js (v2)
 - Feature detection for getUserMedia and MediaRecorder
 - Better MIME type selection for MediaRecorder
 - Shows actual camera FPS when available
 - Disables record button when recording not supported
 - Clear user-facing messages and guidance (host on https/localhost)
*/

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

// Feature detection
const supportsGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const supportsMediaRecorder = typeof MediaRecorder !== 'undefined';

function disableRecordUI(reason) {
  recordBtn.disabled = true;
  recordBtn.style.opacity = '0.5';
  showMessage(reason, 5000);
}

if (!supportsGetUserMedia) {
  disableRecordUI('이 브라우저는 카메라 접근을 지원하지 않습니다. 최신 Safari 또는 Chrome을 사용하거나 앱을 호스팅하세요.');
}
if (!supportsMediaRecorder) {
  // Don't disable completely; user can still pick videos from gallery.
  showMessage('이 브라우저는 MediaRecorder를 지원하지 않습니다. 녹화는 불가능할 수 있습니다. (사진첩 불러오기 가능)', 5000);
  // visually indicate disabled recording
  recordBtn.style.filter = 'grayscale(60%)';
}

// Utility: show temporary message
let msgTimeout = null;
function showMessage(txt, ms=2000) {
  message.textContent = txt;
  message.classList.remove('hidden');
  if (msgTimeout) clearTimeout(msgTimeout);
  msgTimeout = setTimeout(()=> message.classList.add('hidden'), ms);
}

// Start camera preview with requested constraints
async function startPreview() {
  if (!supportsGetUserMedia) return;
  const fps = Number(fpsSelect.value) || 30;

  const constraints = {
    audio: true,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
  // only set frameRate if user chose it (browser may ignore)
  if (fps) constraints.video.frameRate = { ideal: fps };

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    preview.srcObject = mediaStream;
    await preview.play();
    // Show actual FPS if available
    const vt = mediaStream.getVideoTracks()[0];
    const settings = vt.getSettings ? vt.getSettings() : {};
    if (settings && settings.frameRate) {
      showMessage(`카메라 준비됨 — 실제 FPS: ${settings.frameRate}`, 1500);
    } else {
      showMessage(`카메라 준비됨 (요청: ${fps}fps)`, 1400);
    }
  } catch (err) {
    console.error('getUserMedia error', err);
    showMessage('카메라 접근 실패: ' + (err && err.message ? err.message : err), 4000);
  }
}

// Stop preview (stop tracks)
function stopPreview() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
    preview.srcObject = null;
  }
}

// Choose a safe mime type for MediaRecorder
function chooseMimeType() {
  if (!supportsMediaRecorder) return '';
  const candidates = [
    'video/mp4', // some browsers claim support
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const t of candidates) {
    try {
      if (t && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
    } catch (e) {
      // ignore
    }
  }
  return '';
}

recordBtn.addEventListener('click', async () => {
  if (!supportsGetUserMedia) {
    showMessage('카메라 권한 또는 getUserMedia 미지원으로 녹화할 수 없습니다.', 3000);
    return;
  }
  if (!supportsMediaRecorder) {
    showMessage('이 브라우저는 MediaRecorder를 지원하지 않습니다. 사진첩에서 영상을 불러와 재생하세요.', 3500);
    return;
  }
  if (!isRecording) await startRecording(); else await stopRecording();
});

async function startRecording() {
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
    console.warn('MediaRecorder init failed with options, trying default', e);
    try { mediaRecorder = new MediaRecorder(mediaStream); }
    catch (err) {
      console.error('MediaRecorder not available', err);
      showMessage('녹화를 시작할 수 없습니다: MediaRecorder 초기화 실패', 4000);
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

async function stopRecording() {
  if (!mediaRecorder) return;
  if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
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

// open playback modal and try fullscreen
function openPlayback(url, blob) {
  playbackArea.classList.remove('hidden');
  playbackArea.setAttribute('aria-hidden','false');
  playback.src = url;
  playback.playbackRate = 1.0;
  try { if (playback.webkitEnterFullscreen) playback.webkitEnterFullscreen(); else playback.requestFullscreen(); } catch(e){}
  playback.play();
  saveBtn.onclick = () => saveVideoBlob(blob);
}

// saving
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
  // fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showMessage('다운로드가 시작되었습니다. 다운로드 완료 후 링크를 길게 눌러 사진 앱에 저장하세요.', 4000);
}

// close playback
closePlayback.addEventListener('click', () => {
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e){}
  try { if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch(e){}
  playback.pause();
  playback.src = '';
  playbackArea.classList.add('hidden');
  playbackArea.setAttribute('aria-hidden','true');
});

// playback speed
speedNormal.addEventListener('click', () => { playback.playbackRate = 1.0; showMessage('1x 재생', 900); });
speedSlow.addEventListener('click', () => { playback.playbackRate = 0.125; showMessage('1/8x 재생', 900); });

// gallery pick
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

// timer
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

// Initialize on load
window.addEventListener('load', async () => {
  if (!supportsGetUserMedia) {
    showMessage('getUserMedia 미지원: Safari 최신 버전 또는 Chrome 사용 권장', 6000);
    return;
  }
  try {
    await startPreview();
  } catch (e) {
    console.error('preview start failed', e);
    showMessage('카메라 미리보기 시작 실패. 페이지를 https로 호스팅하거나 최신 브라우저로 시도하세요.', 5000);
  }
});

// restart preview on fps change
fpsSelect.addEventListener('change', async () => {
  stopPreview();
  await startPreview();
  showMessage('FPS 설정 변경: ' + fpsSelect.value, 1200);
});
