import AppKit
import Foundation

let dataRoot = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/File Preview Opener", isDirectory: true)
struct Registration: Codable { let root: String; let path: String }
struct OpenFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
func resolve(_ input: URL) throws -> URL {
    guard input.scheme == "reverie-preview", input.host == "open", input.query == nil, input.fragment == nil,
          input.user == nil, input.password == nil, input.port == nil else { throw OpenFailure(message: "无效的文件打开链接。") }
    let token = String(input.path.dropFirst())
    guard token.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw OpenFailure(message: "无效的文件标识。") }
    let entryURL = dataRoot.appendingPathComponent("files/" + token + ".json")
    guard let data = try? Data(contentsOf: entryURL), let entry = try? JSONDecoder().decode(Registration.self, from: data) else {
        throw OpenFailure(message: "这份预览尚未在本机登记，请重新生成所在文件夹的索引。")
    }
    let root = URL(fileURLWithPath: entry.root, isDirectory: true).standardizedFileURL.resolvingSymlinksInPath()
    guard !entry.path.hasPrefix("/"), !entry.path.split(separator: "/").contains("..") else { throw OpenFailure(message: "文件路径无效。") }
    let file = root.appendingPathComponent(entry.path).standardizedFileURL.resolvingSymlinksInPath()
    guard file.path.hasPrefix(root.path + "/"), (try? file.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true else {
        throw OpenFailure(message: "原文件已移动、删除，或不在登记的文件夹内，请更新索引。")
    }
    return file
}
let documents: Set<String> = ["md","markdown","txt","doc","docx","odt","rtf","pdf","ppt","pptx","odp","xls","xlsx","ods","csv","tsv","pages","numbers","key","png","jpg","jpeg","gif","webp","bmp","tif","tiff","svg","heic","mp3","wav","ogg","m4a","flac","mp4","webm","mov","m4v","avi"]
let sourceText: Set<String> = ["py","c","h","cpp","hpp","m","js","ts","css","sh","bash","zsh","json","yaml","yml","xml","log","tex","ini","toml","sql","rs","go","java","swift","html","htm"]
func record(_ status: String, _ file: URL?) {
    let value: [String: Any] = ["status": status, "path": file?.path ?? "", "time": ISO8601DateFormatter().string(from: Date())]
    if let data = try? JSONSerialization.data(withJSONObject: value) {
        let output = dataRoot.appendingPathComponent("last-open.json")
        try? data.write(to: output, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.path)
    }
}
// Validation mode is used by regression tests; it never launches an application.
if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--check" {
    do {
        guard let url = URL(string: CommandLine.arguments[2]) else { throw OpenFailure(message: "无效链接") }
        let file = try resolve(url)
        print(file.path)
        exit(0)
    } catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
}
final class Opener: NSObject, NSApplicationDelegate {
    var idle: DispatchWorkItem?
    var pending = 0
    func quitSoon() {
        idle?.cancel()
        let job = DispatchWorkItem { NSApp.terminate(nil) }; idle = job
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: job)
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        if idle == nil && pending == 0 {
            let job = DispatchWorkItem { NSApp.terminate(nil) }; idle = job
            DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: job)
        }
    }
    func finish(_ file: URL?, _ status: String, _ error: Error? = nil) {
        if let error = error {
            record("failed", file)
            let alert = NSAlert(); alert.messageText = "无法打开原件"; alert.informativeText = error.localizedDescription
            alert.addButton(withTitle: "好"); alert.runModal()
        } else { record(status, file) }
        pending -= 1
        if pending == 0 { quitSoon() }
    }
    func application(_ application: NSApplication, open urls: [URL]) {
        idle?.cancel(); pending += urls.count
        for url in urls {
            do {
                let file = try resolve(url), ext = file.pathExtension.lowercased()
                let configuration = NSWorkspace.OpenConfiguration()
                if documents.contains(ext) {
                    NSWorkspace.shared.open(file, configuration: configuration) { _, error in
                        DispatchQueue.main.async { self.finish(file, "opened-default", error) }
                    }
                } else if sourceText.contains(ext) {
                    // Source files are opened as text, never executed by a script launcher.
                    guard let editor = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.TextEdit") else {
                        throw OpenFailure(message: "找不到本机文本编辑应用。")
                    }
                    NSWorkspace.shared.open([file], withApplicationAt: editor, configuration: configuration) { _, error in
                        DispatchQueue.main.async { self.finish(file, "opened-text", error) }
                    }
                } else {
                    NSWorkspace.shared.activateFileViewerSelecting([file]); finish(file, "revealed-finder")
                }
            } catch { finish(nil, "failed", error) }
        }
    }
}
let app = NSApplication.shared
let delegate = Opener()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
