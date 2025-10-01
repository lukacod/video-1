
const video = document.getElementById('video');
const fileInput = document.getElementById('fileInput');
const recordBtn = document.getElementById('recordBtn');
const playbackNormal = document.getElementById('playbackNormal');
const playbackSlow = document.getElementById('playbackSlow');
const fpsSelect = document.getElementById('fpsSelect');

let mediaRecorder;
let recordedChunks = [];
let stream;

// 영상 녹화 시작
recordBtn.addEventListener('click', async () => {
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { frameRate: { ideal: fpsSelect.value === "240" ? 240 : 30 } },
        audio: false
      });
      video.srcObject = stream;
      mediaRecorder = new MediaRecorder(stream);
      recordedChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/mp4' });
        video.srcObject = null;
        video.src = URL.createObjectURL(blob);
        video.controls = true;
        video.playbackRate = 1.0;
        video.play();
      };

      mediaRecorder.start();
      recordBtn.textContent = "녹화 중지";
    } catch (err) {
      alert("카메라 접근 실패: " + err.message);
    }
  } else {
    mediaRecorder.stop();
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    recordBtn.textContent = "녹화 시작";
  }
});

// 파일 불러오기 (사진첩)
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    video.srcObject = null;
    video.src = url;
    video.controls = true;
    video.playbackRate = 1.0;
    video.play();
  }
});

// 재생 속도 (정상)
playbackNormal.addEventListener('click', () => {
  video.playbackRate = 1.0;
  playbackNormal.style.background = "yellow";
  playbackSlow.style.background = "white";
});

// 재생 속도 (1/8X)
playbackSlow.addEventListener('click', () => {
  video.playbackRate = 0.125;
  playbackSlow.style.background = "yellow";
  playbackNormal.style.background = "white";
});

// FPS 선택 (240fps 지원 확인)
fpsSelect.addEventListener('change', () => {
  if (fpsSelect.value === "240") {
    if (!navigator.mediaDevices.getSupportedConstraints().frameRate) {
      alert("이 브라우저/디바이스는 240fps를 지원하지 않습니다.");
      fpsSelect.value = "30";
    }
  }
});
