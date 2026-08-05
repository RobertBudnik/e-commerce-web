import SwiftUI
import WebKit

/// Bazowy adres z Info.plist, ustawiany flagą NORDO_URL przy budowaniu.
/// Produkcja jest wartością domyślną projektu; build pod sieć lokalną
/// nadpisuje ją w wierszu poleceń, więc repozytorium zostaje czyste.
private let bazowyAdres: URL = {
    let zPlist = Bundle.main.object(forInfoDictionaryKey: "NordoURL") as? String
    let adres = URL(string: zPlist ?? "") ?? URL(string: "https://nordo-one.vercel.app/magazyn")!
    // NORDO_URL wskazuje na /magazyn; zakładki dokładają własne ścieżki
    return adres.deletingLastPathComponent()
}()

private enum Zakladka: String, CaseIterable {
    case pakowanie, stany, skaner

    var sciezka: String {
        switch self {
        case .pakowanie: return "magazyn"
        case .stany: return "magazyn/stany"
        case .skaner: return "magazyn/skan"
        }
    }

    var etykieta: String {
        switch self {
        case .pakowanie: return "Do spakowania"
        case .stany: return "Stany"
        case .skaner: return "Skaner"
        }
    }

    var ikona: String {
        switch self {
        case .pakowanie: return "shippingbox"
        case .stany: return "square.stack.3d.up"
        case .skaner: return "barcode.viewfinder"
        }
    }

    var url: URL { bazowyAdres.appendingPathComponent(sciezka) }
}

/// Pasek zakładek jest natywny, treść przychodzi z serwera. Dzięki temu
/// nawigacja zachowuje się jak w każdej aplikacji na iOS — gest przesunięcia,
/// zapamiętana pozycja w każdej zakładce, pasek nad obszarem gestów — a
/// jednocześnie zmiana w magazynie nie wymaga wgrywania aplikacji od nowa.
struct MagazynView: View {
    @State private var wybrana: Zakladka = .pakowanie

    var body: some View {
        TabView(selection: $wybrana) {
            ForEach(Zakladka.allCases, id: \.self) { zakladka in
                WebTab(url: zakladka.url)
                    .tabItem {
                        Label(zakladka.etykieta, systemImage: zakladka.ikona)
                    }
                    .tag(zakladka)
            }
        }
        .tint(Color(red: 0.62, green: 0.29, blue: 0.13))
    }
}

/// Jedna zakładka: własny widok sieciowy, własna historia, własna pozycja
/// przewijania. Przełączanie zakładek nie przeładowuje treści.
private struct WebTab: View {
    let url: URL
    @State private var laduje = true
    @State private var blad: String?

    var body: some View {
        ZStack {
            WebView(url: url, laduje: $laduje, blad: $blad)

            if let blad {
                // Magazyn bez sieci jest bezużyteczny — nieaktualny status
                // zamówienia jest gorszy niż jego brak, bo dwie osoby pakują
                // wtedy tę samą paczkę.
                VStack(spacing: 14) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 34))
                        .foregroundStyle(.secondary)
                    Text("Brak połączenia")
                        .font(.title2)
                    Text(blad)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Spróbuj ponownie") {
                        self.blad = nil
                        self.laduje = true
                        NotificationCenter.default.post(name: .odswiezMagazyn, object: url)
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

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var laduje: Bool
    @Binding var blad: String?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Kamera do skanowania ma działać w kadrze, bez przejmowania ekranu
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Znacznik doklejany publicznym API: WebKit sam dopisze go do
        // standardowego User-Agenta. Wcześniej szedł tu odczyt przez KVC,
        // który potrafi zwrócić pusto i wtedy serwer nie rozpoznawał powłoki.
        config.applicationNameForUserAgent = "NordoApp/1.0"

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        // Odświeżanie gestem — odruch każdego, kto trzyma telefon
        let odswiez = UIRefreshControl()
        odswiez.addTarget(context.coordinator, action: #selector(Coordinator.odswiez(_:)), for: .valueChanged)
        web.scrollView.refreshControl = odswiez
        context.coordinator.web = web

        web.load(URLRequest(url: url))

        NotificationCenter.default.addObserver(
            forName: .odswiezMagazyn, object: nil, queue: .main
        ) { [weak web] powiadomienie in
            guard (powiadomienie.object as? URL) == url else { return }
            web?.load(URLRequest(url: url))
        }

        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let rodzic: WebView
        weak var web: WKWebView?
        init(_ rodzic: WebView) { self.rodzic = rodzic }

        @objc func odswiez(_ kontrolka: UIRefreshControl) {
            web?.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            rodzic.laduje = false
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            zakoncz(webView, error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            zakoncz(webView, error)
        }

        private func zakoncz(_ webView: WKWebView, _ error: Error) {
            rodzic.laduje = false
            webView.scrollView.refreshControl?.endRefreshing()
            // Anulowanie to nie awaria — zdarza się przy szybkim przełączaniu
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            rodzic.blad = error.localizedDescription
        }
    }
}
