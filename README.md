iOS Native Scaffold (Swift, UIKit)

What I included:
- AppDelegate.swift
- SceneDelegate.swift
- ViewController.swift (full implementation using AVFoundation and Photos)
- Info.plist (with required usage descriptions)

How to use (quick):
1. Open Xcode and create a new project:
   - Template: App
   - Interface: Storyboard or SwiftUI (we'll replace root)
   - Language: Swift
   - Product Name: GolfSwing

2. Replace the generated AppDelegate.swift, SceneDelegate.swift (if present), ViewController.swift and Info.plist contents with the files from this scaffold.

3. In Xcode:
   - Ensure 'Privacy - Camera Usage Description', 'Privacy - Microphone Usage Description', 'Privacy - Photo Library Additions Usage Description', 'Privacy - Photo Library Usage Description' are present in Info.plist (already provided).
   - Add 'AVKit' and 'Photos' frameworks if needed (imported in code).

4. Connect a real device (recommended) and run.

Notes:
- 240fps depends on device hardware; the code attempts to set a compatible device format.
- For production, add error handling, UI polish, and handle interruptions (calls, background).
