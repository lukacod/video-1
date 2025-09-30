import UIKit
import AVFoundation
import Photos
import MobileCoreServices
import AVKit

class ViewController: UIViewController {

    // UI
    let previewView = UIView()
    let recordButton = UIButton(type: .custom)
    let timerLabel = UILabel()
    let fpsControl = UISegmentedControl(items: ["Normal","240fps"])
    let galleryButton = UIButton(type: .system)

    // AV
    let captureSession = AVCaptureSession()
    var videoDeviceInput: AVCaptureDeviceInput!
    let movieFileOutput = AVCaptureMovieFileOutput()
    var currentVideoURL: URL?

    var timer: Timer?
    var startTime: Date?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupUI()
        checkPermissionsAndSetup()
    }

    func setupUI() {
        let topBar = UIView()
        topBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(topBar)
        topBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor).isActive = true
        topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor).isActive = true
        topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor).isActive = true
        topBar.heightAnchor.constraint(equalToConstant: 56).isActive = true

        galleryButton.setTitle("📁", for: .normal)
        galleryButton.titleLabel?.font = UIFont.systemFont(ofSize: 28)
        galleryButton.tintColor = .white
        galleryButton.translatesAutoresizingMaskIntoConstraints = false
        galleryButton.addTarget(self, action: #selector(openGallery), for: .touchUpInside)
        topBar.addSubview(galleryButton)
        galleryButton.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 12).isActive = true
        galleryButton.centerYAnchor.constraint(equalTo: topBar.centerYAnchor).isActive = true

        fpsControl.selectedSegmentIndex = 0
        fpsControl.translatesAutoresizingMaskIntoConstraints = false
        topBar.addSubview(fpsControl)
        fpsControl.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -12).isActive = true
        fpsControl.centerYAnchor.constraint(equalTo: topBar.centerYAnchor).isActive = true

        previewView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(previewView)
        previewView.topAnchor.constraint(equalTo: topBar.bottomAnchor).isActive = true
        previewView.leadingAnchor.constraint(equalTo: view.leadingAnchor).isActive = true
        previewView.trailingAnchor.constraint(equalTo: view.trailingAnchor).isActive = true
        previewView.bottomAnchor.constraint(equalTo: view.bottomAnchor).isActive = true

        recordButton.translatesAutoresizingMaskIntoConstraints = false
        recordButton.backgroundColor = .clear
        recordButton.layer.cornerRadius = 42
        recordButton.layer.borderWidth = 6
        recordButton.layer.borderColor = UIColor(white: 1, alpha: 0.12).cgColor
        recordButton.addTarget(self, action: #selector(toggleRecording), for: .touchUpInside)
        view.addSubview(recordButton)
        recordButton.widthAnchor.constraint(equalToConstant: 84).isActive = true
        recordButton.heightAnchor.constraint(equalToConstant: 84).isActive = true
        recordButton.centerXAnchor.constraint(equalTo: view.centerXAnchor).isActive = true
        recordButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24).isActive = true

        let inner = UIView()
        inner.translatesAutoresizingMaskIntoConstraints = false
        inner.backgroundColor = .systemRed
        inner.layer.cornerRadius = 28
        inner.tag = 999
        recordButton.addSubview(inner)
        inner.centerXAnchor.constraint(equalTo: recordButton.centerXAnchor).isActive = true
        inner.centerYAnchor.constraint(equalTo: recordButton.centerYAnchor).isActive = true
        inner.widthAnchor.constraint(equalToConstant: 64).isActive = true
        inner.heightAnchor.constraint(equalToConstant: 64).isActive = true

        timerLabel.translatesAutoresizingMaskIntoConstraints = false
        timerLabel.text = "00:00"
        timerLabel.textColor = .white
        timerLabel.textAlignment = .center
        timerLabel.backgroundColor = UIColor(white: 0, alpha: 0.45)
        timerLabel.layer.cornerRadius = 8
        timerLabel.clipsToBounds = true
        timerLabel.font = UIFont.monospacedDigitSystemFont(ofSize: 14, weight: .semibold)
        view.addSubview(timerLabel)
        timerLabel.topAnchor.constraint(equalTo: recordButton.bottomAnchor, constant: 8).isActive = true
        timerLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor).isActive = true
        timerLabel.widthAnchor.constraint(equalToConstant: 80).isActive = true
        timerLabel.heightAnchor.constraint(equalToConstant: 30).isActive = true
    }

    func checkPermissionsAndSetup() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            setupSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted { self.setupSession() } else { self.showPermissionAlert() }
                }
            }
        default:
            showPermissionAlert()
        }
    }

    func showPermissionAlert() {
        let a = UIAlertController(title: "권한 필요", message: "카메라 권한이 필요합니다.", preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "설정으로 이동", style: .default, handler: { _ in
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }))
        a.addAction(UIAlertAction(title: "취소", style: .cancel))
        present(a, animated: true)
    }

    func setupSession() {
        captureSession.beginConfiguration()
        captureSession.sessionPreset = .high

        guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else { return }
        do {
            videoDeviceInput = try AVCaptureDeviceInput(device: videoDevice)
            if captureSession.canAddInput(videoDeviceInput) { captureSession.addInput(videoDeviceInput) }
        } catch {
            print("Error creating video device input: \(error)")
            return
        }

        if let audioDevice = AVCaptureDevice.default(for: .audio) {
            do {
                let audioInput = try AVCaptureDeviceInput(device: audioDevice)
                if captureSession.canAddInput(audioInput) { captureSession.addInput(audioInput) }
            } catch { print(error) }
        }

        if captureSession.canAddOutput(movieFileOutput) {
            captureSession.addOutput(movieFileOutput)
        }

        captureSession.commitConfiguration()

        let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = previewView.bounds
        previewLayer.connection?.videoOrientation = .portrait
        previewView.layer.addSublayer(previewLayer)

        DispatchQueue.global(qos: .userInitiated).async {
            self.captureSession.startRunning()
            DispatchQueue.main.async {
                previewLayer.frame = self.previewView.bounds
            }
        }
    }

    @objc func toggleRecording() {
        if movieFileOutput.isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }

    func startRecording() {
        if fpsControl.selectedSegmentIndex == 1 {
            if let device = videoDeviceInput.device {
                for format in device.formats {
                    let ranges = format.videoSupportedFrameRateRanges
                    if ranges.contains(where: { $0.maxFrameRate >= 240 }) {
                        do {
                            try device.lockForConfiguration()
                            device.activeFormat = format
                            device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 240)
                            device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 240)
                            device.unlockForConfiguration()
                            break
                        } catch {
                            print("Cannot set 240fps: \(error)")
                        }
                    }
                }
            }
        }

        let outputURL = tempURL()
        movieFileOutput.startRecording(to: outputURL, recordingDelegate: self)
        startTime = Date()
        startTimer()
        updateRecordingUI(isRecording: true)
    }

    func stopRecording() {
        if movieFileOutput.isRecording {
            movieFileOutput.stopRecording()
        }
        stopTimer()
        updateRecordingUI(isRecording: false)
    }

    func updateRecordingUI(isRecording: Bool) {
        if let inner = recordButton.viewWithTag(999) {
            inner.transform = isRecording ? CGAffineTransform(scaleX: 0.86, y: 0.86) : .identity
        }
    }

    func tempURL() -> URL {
        let fileName = "swing_\(Int(Date().timeIntervalSince1970)).mov"
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(fileName)
        return tmp
    }

    @objc func openGallery() {
        let picker = UIImagePickerController()
        picker.sourceType = .photoLibrary
        picker.mediaTypes = [kUTTypeMovie as String]
        picker.delegate = self
        present(picker, animated: true)
    }

    func saveToPhotos(url: URL) {
        PHPhotoLibrary.requestAuthorization { status in
            guard status == .authorized || status == .limited else { return }
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
            }) { saved, error in
                DispatchQueue.main.async {
                    if saved {
                        self.showSimpleAlert(title: "저장완료", message: "사진첩에 저장되었습니다.")
                    } else {
                        self.showSimpleAlert(title: "저장실패", message: error?.localizedDescription ?? "Unknown error")
                    }
                }
            }
        }
    }

    func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { _ in
            guard let s = self.startTime else { return }
            let diff = Int(Date().timeIntervalSince(s))
            let mm = String(format: "%02d", diff/60)
            let ss = String(format: "%02d", diff%60)
            self.timerLabel.text = "\(mm):\(ss)"
        }
    }

    func stopTimer() {
        timer?.invalidate()
        timer = nil
        self.timerLabel.text = "00:00"
    }

    func showSimpleAlert(title: String, message: String) {
        let a = UIAlertController(title: title, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "확인", style: .default))
        present(a, animated: true)
    }
}

extension ViewController: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput,
                    didFinishRecordingTo outputFileURL: URL,
                    from connections: [AVCaptureConnection],
                    error: Error?) {
        if let e = error {
            print("Recording error: \(e)")
            return
        }
        currentVideoURL = outputFileURL

        saveToPhotos(url: outputFileURL)

        DispatchQueue.main.async {
            let player = AVPlayer(url: outputFileURL)
            let pvc = AVPlayerViewController()
            pvc.player = player
            pvc.modalPresentationStyle = .fullScreen
            player.play()
            self.present(pvc, animated: true)
            let alert = UIAlertController(title: "재생속도", message: nil, preferredStyle: .actionSheet)
            alert.addAction(UIAlertAction(title: "1x", style: .default, handler: { _ in player.rate = 1.0 }))
            alert.addAction(UIAlertAction(title: "1/8x", style: .default, handler: { _ in player.rate = 0.125 }))
            alert.addAction(UIAlertAction(title: "닫기", style: .cancel))
            pvc.present(alert, animated: true)
        }
    }
}

extension ViewController: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }
    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
        picker.dismiss(animated: true)
        if let mediaURL = info[.mediaURL] as? URL {
            let player = AVPlayer(url: mediaURL)
            let pvc = AVPlayerViewController()
            pvc.player = player
            pvc.modalPresentationStyle = .fullScreen
            player.play()
            present(pvc, animated: true) {
                let alert = UIAlertController(title: "재생속도", message: nil, preferredStyle: .actionSheet)
                alert.addAction(UIAlertAction(title: "1x", style: .default, handler: { _ in player.rate = 1.0 }))
                alert.addAction(UIAlertAction(title: "1/8x", style: .default, handler: { _ in player.rate = 0.125 }))
                alert.addAction(UIAlertAction(title: "닫기", style: .cancel))
                pvc.present(alert, animated: true)
            }
        }
    }
}
