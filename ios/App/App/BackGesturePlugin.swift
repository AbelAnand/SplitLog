import Foundation
import Capacitor

/// Native chrome the web app controls: the edge swipe-back gesture (off while a screen has unsaved
/// changes, so leaving always goes through its Save / Discard question) and the colour behind the
/// web view, which shows in overscroll and under the status bar, kept equal to the theme.
@objc(BackGesturePlugin)
public class BackGesturePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackGesturePlugin"
    public let jsName = "BackGesture"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBackground", returnType: CAPPluginReturnPromise)
    ]

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? true
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.allowsBackForwardNavigationGestures = enabled
            call.resolve()
        }
    }

    @objc func setBackground(_ call: CAPPluginCall) {
        guard let hex = call.getString("color"), let color = UIColor(hexString: hex) else {
            call.reject("color must be a hex colour")
            return
        }
        DispatchQueue.main.async { [weak self] in
            if let webView = self?.bridge?.webView {
                webView.backgroundColor = color
                webView.scrollView.backgroundColor = color
                webView.underPageBackgroundColor = color
                webView.superview?.backgroundColor = color
            }
            self?.bridge?.viewController?.view.backgroundColor = color
            call.resolve()
        }
    }
}

private extension UIColor {
    convenience init?(hexString: String) {
        var s = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255, blue: CGFloat(v & 0xff) / 255, alpha: 1)
    }
}
