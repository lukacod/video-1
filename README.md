Golf Swing Recorder — Final v3

Changes in this version:
- Record button fixed and reliably toggles recording on/off.
- When recording starts, a short beep plays (WebAudio) and a precise timer (mm:ss.cc) shows—similar to Onform.
- 240fps: capability detection via getCapabilities + applyConstraints; UI disables 240 option if hardware doesn't support it.
- Gallery import uses a hidden file input. Imported videos open in playback modal and can be played at 1x or 1/8x only (buttons control playbackRate).
- Save via Share API or download fallback.

Notes and limitations:
- Many mobile browsers (especially older Safari) do not support MediaRecorder or high fps capture in the browser. For guaranteed 240fps capture and iPhone Photos saving, a native iOS app (AVFoundation) is recommended.
- Host the folder using HTTPS or localhost (`python -m http.server`) for camera permissions to work on mobile.
