const preview = document.getElementById('preview');
const recordBtn = document.getElementById('recordBtn');
const recordInner = document.querySelector('.record .inner');
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

// Start camera preview with requested fps (browser may ignore high fps)
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
    showMessage('카메라 준비됨 (요청 FPS: ' + fps + ')', 1400);
  } catch (err) {
    console.error('getUserMedia error', err);
    showMessage('카메라 접근 실패: ' + (err.message || err), 4000);
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
  if (!isRecording) await startRecording();
  else await stopRecording();
});

async function startRecording() {
  if (!mediaStream) {
    await startPreview();
    if (!mediaStream) return;
  }

  recordedChunks = [];
  try {
    // Safari on iOS doesn't support webm for MediaRecorder in some versions.
    let options = { mimeType: 'video/mp4' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};
    }
    mediaRecorder = new MediaRecorder(mediaStream, options);
  } catch (e) {
    try {
      mediaRecorder = new MediaRecorder(mediaStream);
    } catch (err) {
      console.error('MediaRecorder not supported', err);
      showMessage('녹화 불가능: 브라우저가 MediaRecorder를 지원하지 않습니다.', 4000);
      return;
    }
  }

  mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data); };
  mediaRecorder.onstop = handleRecordingStop;
  mediaRecorder.start();
  isRecording = true;
  recordBtn.classList.add('recording');
  recordBtn.setAttribute('aria-pressed','true');
  recordStart = Date.now();
  startTimer();
  showMessage('녹화 시작', 1000);
}

async function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    recordBtn.classList.remove('recording');
    recordBtn.setAttribute('aria-pressed','false');
    stopTimer();
    showMessage('녹화 중지', 1000);
  }
}

function handleRecordingStop() {
  const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'video/webm' });
  lastBlob = blob;
  const url = URL.createObjectURL(blob);
  openPlayback(url, blob);
}

// open playback modal and play fullscreen where possible
function openPlayback(url, blob) {
  playbackArea.classList.remove('hidden');
  playbackArea.setAttribute('aria-hidden','false');
  playback.src = url;
  playback.playbackRate = 1.0;
  // Try to enter fullscreen on video (Safari prefers webkitEnterFullscreen)
  try { if (playback.webkitEnterFullscreen) playback.webkitEnterFullscreen(); else playback.requestFullscreen(); } catch(e){}
  playback.play();
  saveBtn.onclick = () => saveVideoBlob(blob);
  // store blob for saveCurrent
  lastBlob = blob;
}

async function saveVideoBlob(blob) {
  // Try Web Share API with file (shows share sheet on iOS)
  const fileName = 'swing_' + Date.now() + (blob.type.includes('mp4') ? '.mp4' : '.webm');
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '골프 스윙' });
      showMessage('공유 시트가 열렸습니다. "비디오 저장"을 선택하세요.', 2500);
      return;
    } catch (e) {
      console.warn('Share failed', e);
    }
  }
  // Fallback to download (user should long-press to save on iPhone)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showMessage('파일 다운로드 시작. 다운로드 완료 후 링크를 길게 눌러 사진앱에 저장하세요.', 3500);
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
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '골프 스윙' });
      showMessage('공유 시트가 열렸습니다. "비디오 저장"을 선택하세요.', 2500);
      return;
    } catch (e) { console.warn(e); }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name || 'swing.mp4';
  document.body.appendChild(a);
  a.click();
  a.remove();
  showMessage('파일 다운로드 시작. 다운로드 완료 후 링크를 길게 눌러 사진앱에 저장하세요.', 3500);
});

// Timer
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

// Messages
let msgTimeout = null;
function showMessage(txt, ms=2000) {
  message.textContent = txt;
  message.classList.remove('hidden');
  if (msgTimeout) clearTimeout(msgTimeout);
  msgTimeout = setTimeout(()=> message.classList.add('hidden'), ms);
}

// Init
window.addEventListener('load', async () => {
  try { await startPreview(); } catch(e){ console.log(e); showMessage('카메라 미리보기 시작 실패. 화면을 탭하여 권한을 허용하세요.',4000); }
});

// Restart preview on fps change
fpsSelect.addEventListener('change', async () => {
  stopPreview();
  await startPreview();
  showMessage('FPS 설정 변경: ' + fpsSelect.value, 1200);
});
