Golf Swing Recorder — Web (improved)

This HTML project is tailored to run on iPhone Safari (or modern mobile browsers). It implements:
- Onform-like dark UI
- Top-left: pick video from Photos (via file input)
- Top-right: FPS selector (requests 30 or 240 fps)
- Bottom-center red record button with timer similar to Onform
- Playback opens in fullscreen and has 1x and 1/8x playback speed buttons
- Download link to save the recorded file (long-press on the link on iPhone and choose 'Save Video')

Limitations:
- Browsers cannot directly write to the iOS Photos library. You must long-press the download link and choose "Save Video".
- 240fps capture via browser is rarely supported; native app required for guaranteed high-speed recording.
- For best result, open this project via a small local web server or host it; opening the file directly in Files app may restrict camera access.

To test:
1. Upload the folder to a web server or use a local server (e.g., `python -m http.server`) and visit from Safari on your iPhone.
2. Allow camera & microphone access.
3. Use the FPS selector, start recording, then stop. Tap the download link and long-press to save.

Files:
- index.html
- styles.css
- script.js
