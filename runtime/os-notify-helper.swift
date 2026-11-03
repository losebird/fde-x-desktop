import Cocoa
import UserNotifications

final class Delegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
  let title: String
  let body: String
  let logPath: String?

  init(title: String, body: String, logPath: String?) {
    self.title = title
    self.body = body
    self.logPath = logPath
    super.init()
  }

  func log(_ line: String) {
    fputs(line + "\n", stderr)
    guard let logPath, !logPath.isEmpty else { return }
    let payload = Data((line + "\n").utf8)
    if FileManager.default.fileExists(atPath: logPath),
       let handle = FileHandle(forWritingAtPath: logPath) {
      handle.seekToEndOfFile()
      handle.write(payload)
      try? handle.close()
    } else {
      FileManager.default.createFile(atPath: logPath, contents: payload)
    }
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    log("fde_notify_bundle \(Bundle.main.bundleIdentifier ?? "nil")")
    let center = UNUserNotificationCenter.current()
    center.delegate = self
    DispatchQueue.main.asyncAfter(deadline: .now() + 45) { NSApp.terminate(nil) }
    center.requestAuthorization(options: [.alert, .sound]) { granted, error in
      if let error { self.log("fde_notify_auth_error \(error.localizedDescription)") }
      self.log("fde_notify_granted \(granted)")
      guard granted else {
        DispatchQueue.main.async { NSApp.terminate(nil) }
        return
      }
      let content = UNMutableNotificationContent()
      content.title = self.title
      content.body = self.body
      let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
      center.add(request) { error in
        if let error { self.log("fde_notify_add_error \(error.localizedDescription)") }
        else { self.log("fde_notify_ok") }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { NSApp.terminate(nil) }
      }
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound])
  }
}

let title = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "FDE-X"
let body = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : ""
let logPath = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : nil
let app = NSApplication.shared
let delegate = Delegate(title: title, body: body, logPath: logPath)
app.delegate = delegate
app.setActivationPolicy(.accessory)
withExtendedLifetime(delegate) { app.run() }
