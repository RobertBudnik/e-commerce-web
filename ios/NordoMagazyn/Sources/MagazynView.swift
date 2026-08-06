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
    case przeglad, zamowienia, magazyn, skaner

    var sciezka: String {
        switch self {
        case .przeglad: return "magazyn"
        case .zamowienia: return "magazyn/zamowienia"
        case .magazyn: return "magazyn/stany"
        case .skaner: return "magazyn/skan"
        }
    }

    var etykieta: String {
        switch self {
        case .przeglad: return "Przegląd"
        case .zamowienia: return "Zamówienia"
        case .magazyn: return "Magazyn"
        case .skaner: return "Skaner"
        }
    }

    var ikona: String {
        switch self {
        case .przeglad: return "square.grid.2x2"
        case .zamowienia: return "shippingbox"
        case .magazyn: return "square.stack.3d.up"
        case .skaner: return "barcode.viewfinder"
        }
    }

    var url: URL { bazowyAdres.appendingPathComponent(sciezka) }
}

/// Pasek zakładek jest natywny, treść przychodzi z serwera. Dzięki temu
/// nawigacja zachowuje się jak w każdej aplikacji na iOS — gest przesunięcia,
/// zapamiętana pozycja w każdej zakładce, pasek nad obszarem gestów — a
/// jednocześnie zmiana w magazynie nie wymaga wgrywania aplikacji od nowa.
///
/// Przed zalogowaniem pasek się nie pokazuje: każda zakładka odbijałaby wtedy
/// na ten sam ekran logowania, a trzy drogi do jednego miejsca to nie wybór,
/// tylko zamieszanie.
struct MagazynView: View {
    @State private var wybrana: Zakladka = .przeglad
    @State private var zalogowany = false

    var body: some View {
        Group {
            if zalogowany {
                TabView(selection: $wybrana) {
                    ForEach(Zakladka.allCases, id: \.self) { zakladka in
                        WebTab(url: zakladka.url, naSciezke: sprawdzDostep)
                            .tabItem {
                                Label(zakladka.etykieta, systemImage: zakladka.ikona)
                            }
                            .tag(zakladka)
                    }
                }
            } else {
                WebTab(url: Zakladka.przeglad.url, naSciezke: sprawdzDostep)
            }
        }
        .tint(Color(red: 0.62, green: 0.29, blue: 0.13))
        .animation(.easeInOut(duration: 0.2), value: zalogowany)
    }

    /// Stan logowania czytamy z adresu, pod którym wylądował widok. Serwer
    /// odsyła nieuprawnionych na /logowanie, więc to on pozostaje jedynym
    /// źródłem prawdy — aplikacja niczego nie ocenia po swojemu.
    private func sprawdzDostep(_ sciezka: String) {
        let wMagazynie = sciezka.hasPrefix("/magazyn")
        if wMagazynie != zalogowany { zalogowany = wMagazynie }
    }
}

/// Jedna zakładka: własny widok sieciowy, własna historia, własna pozycja
/// przewijania. Przełączanie zakładek nie przeładowuje treści.
private struct WebTab: View {
    let url: URL
    var naSciezke: ((String) -> Void)? = nil
    @State private var laduje = true
    @State private var blad: String?

    var body: some View {
        ZStack {
            WebView(url: url, laduje: $laduje, blad: $blad, naSciezke: naSciezke)

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
    var naSciezke: ((String) -> Void)? = nil

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
        // Bez delegata interfejsu WebKit odrzuca `getUserMedia` z miejsca —
        // iOS nie zdąży nawet zapytać o zgodę na aparat, a skaner pokazuje
        // „brak zgody" mimo że użytkownik o nic nie był proszony.
        web.uiDelegate = context.coordinator
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

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let rodzic: WebView
        weak var web: WKWebView?
        init(_ rodzic: WebView) { self.rodzic = rodzic }

        /// Zgoda na aparat dla skanera kodów.
        ///
        /// Zgadzamy się wyłącznie dla własnego adresu — strona wczytana
        /// z obcego hosta (przekierowanie, cudzy link) aparatu nie dostanie.
        /// `.grant` zdejmuje tylko pytanie WebKitu; systemowe pytanie iOS-a
        /// o dostęp do aparatu i tak pojawia się przy pierwszym użyciu,
        /// z opisem z `NSCameraUsageDescription`.
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            let swoj = origin.host == rodzic.url.host && type == .camera
            decisionHandler(swoj ? .grant : .deny)
        }

        @objc func odswiez(_ kontrolka: UIRefreshControl) {
            web?.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            rodzic.laduje = false
            webView.scrollView.refreshControl?.endRefreshing()
            if let sciezka = webView.url?.path { rodzic.naSciezke?(sciezka) }
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
