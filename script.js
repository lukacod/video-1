let recordBtn = document.getElementById('recordBtn');
let timer = document.getElementById('timer');
let videoPlayer = document.getElementById('videoPlayer');
let fileInput = document.getElementById('fileInput');
let normalSpeed = document.getElementById('normalSpeed');
let slowSpeed = document.getElementById('slowSpeed');
let fpsSelect = document.getElementById('fpsSelect');

let mediaRecorder;
let recordedChunks = [];
let timerInterval;
let startTime;

recordBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    clearInterval(timerInterval);
    recordBtn.textContent = "●";
    return;
  }

  try {
    let fps = fpsSelect.value === "240" ? { frameRate: { ideal: 240, max: 240 } } : true;
    let stream = await navigator.mediaDevices.getUserMedia({ video: fps, audio: true });
    videoPlayer.srcObject = stream;
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      let blob = new Blob(recordedChunks, { type: "video/webm" });
      recordedChunks = [];
      videoPlayer.srcObject.getTracks().forEach(track => track.stop());
      videoPlayer.srcObject = null;
      videoPlayer.src = URL.createObjectURL(blob);
      videoPlayer.controls = true;
    };

    mediaRecorder.start();
    startTimer();
    recordBtn.textContent = "■";
  } catch (err) {
    alert("카메라 접근 불가: " + err);
  }
});

fileInput.addEventListener('change', (event) => {
  let file = event.target.files[0];
  if (file) {
    let url = URL.createObjectURL(file);
    videoPlayer.src = url;
    videoPlayer.play();
  }
});

normalSpeed.addEventListener('click', () => {
  videoPlayer.playbackRate = 1;
  normalSpeed.classList.add("active");
  slowSpeed.classList.remove("active");
});

slowSpeed.addEventListener('click', () => {
  videoPlayer.playbackRate = 0.125;
  slowSpeed.classList.add("active");
  normalSpeed.classList.remove("active");
});

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    let elapsed = Math.floor((Date.now() - startTime) / 1000);
    let minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
    let seconds = String(elapsed % 60).padStart(2, '0');
    timer.textContent = minutes + ":" + seconds;
  }, 1000);
}
