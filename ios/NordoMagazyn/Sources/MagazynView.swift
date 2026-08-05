import SwiftUI
import WebKit

/// Adres magazynu z Info.plist, ustawiany flagą NORDO_URL przy budowaniu.
/// Produkcja jest wartością domyślną projektu; build pod sieć lokalną
/// nadpisuje ją w wierszu poleceń, więc repozytorium zostaje czyste.
private let adresMagazynu: URL = {
    let zPlist = Bundle.main.object(forInfoDictionaryKey: "NordoURL") as? String
    return URL(string: zPlist ?? "") ?? URL(string: "https://nordo-one.vercel.app/magazyn")!
}()

struct MagazynView: View {
    @State private var laduje = true
    @State private var blad: String?

    var body: some View {
        ZStack {
            WebView(url: adresMagazynu, laduje: $laduje, blad: $blad)

            if let blad {
                // Magazyn bez sieci jest bezużyteczny — nieaktualny status
                // zamówienia jest gorszy niż jego brak. Zamiast udawać, że
                // działa, pokazujemy wprost, co się stało.
                VStack(spacing: 14) {
                    Text("Brak połączenia")
                        .font(.title2)
                    Text(blad)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Spróbuj ponownie") {
                        self.blad = nil
                        self.laduje = true
                        NotificationCenter.default.post(name: .odswiezMagazyn, object: nil)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
            } else if laduje {
                ProgressView()
            }
        }
    }
}

extension Notification.Name {
    static let odswiezMagazyn = Notification.Name("odswiezMagazyn")
}

/// Cienka powłoka nad WKWebView. Sesja trzyma się w ciasteczkach tak samo jak
/// w Safari, więc logowanie działa bez żadnego dodatkowego kodu.
struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var laduje: Bool
    @Binding var blad: String?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Kamera do skanowania kodów ma działać bez wychodzenia z aplikacji
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInsetAdjustmentBehavior = .always
        web.load(URLRequest(url: url))

        NotificationCenter.default.addObserver(
            forName: .odswiezMagazyn, object: nil, queue: .main
        ) { [weak web] _ in
            web?.load(URLRequest(url: url))
        }

        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let rodzic: WebView
        init(_ rodzic: WebView) { self.rodzic = rodzic }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            rodzic.laduje = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            rodzic.laduje = false
            rodzic.blad = error.localizedDescription
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            rodzic.laduje = false
            rodzic.blad = error.localizedDescription
        }
    }
}
