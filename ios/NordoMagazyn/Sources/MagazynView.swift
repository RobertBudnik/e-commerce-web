import SwiftUI
import WebKit

/// Które z dwóch wcieleń powłoki zbudowano. Ten sam kod stoi za aplikacją
/// klienta i za aplikacją zaplecza — różni je wyłącznie ta flaga, ustawiana
/// przez `zbuduj.sh` przez `NORDO_WARIANT`.
///
/// Bez niej obie aplikacje pokazywały pasek zakładek magazynu, bo zakładki
/// mają ścieżki wpisane na sztywno. Sklep dostawał wtedy zaplecze pod cudzym
/// identyfikatorem pakietu, a nie sklep.
enum Wariant: String {
    case sklep, magazyn

    static let biezacy: Wariant = {
        let zPlist = Bundle.main.object(forInfoDictionaryKey: "NordoWariant") as? String
        // Domyślnie magazyn: to on był tu pierwszy i to jego buduje Xcode,
        // gdy ktoś naciśnie „Run" zamiast wywołać `zbuduj.sh`.
        return Wariant(rawValue: zPlist ?? "") ?? .magazyn
    }()
}

/// Adres, pod którym stoi serwis. Z Info.plist, ustawiany flagą NORDO_URL
/// przy budowaniu; produkcja jest wartością domyślną projektu, a build pod
/// sieć lokalną nadpisuje ją w wierszu poleceń, więc repozytorium zostaje
/// czyste.
///
/// NORDO_URL wskazuje ekran startowy wariantu (`/` albo `/magazyn`), a
/// zakładki dokładają własne ścieżki — dlatego bierzemy sam korzeń.
private let bazowyAdres: URL = {
    let zPlist = Bundle.main.object(forInfoDictionaryKey: "NordoURL") as? String
    let adres = URL(string: zPlist ?? "") ?? URL(string: "https://nordo-one.vercel.app/")!
    var skladniki = URLComponents(url: adres, resolvingAgainstBaseURL: false)
    skladniki?.path = "/"
    skladniki?.query = nil
    skladniki?.fragment = nil
    return skladniki?.url ?? adres
}()

enum Zakladka: String, CaseIterable {
    case sklep, przeglad, zamowienia, magazyn, skaner

    /// Zakładki tego wariantu. Sklep ma jedną i dlatego nie dostaje paska —
    /// pojedyncza zakładka to nie wybór, tylko pasek zajmujący miejsce.
    static var dostepne: [Zakladka] {
        switch Wariant.biezacy {
        case .sklep: return [.sklep]
        case .magazyn: return [.przeglad, .zamowienia, .magazyn, .skaner]
        }
    }

    var sciezka: String {
        switch self {
        case .sklep: return ""
        case .przeglad: return "magazyn"
        case .zamowienia: return "magazyn/zamowienia"
        case .magazyn: return "magazyn/stany"
        case .skaner: return "magazyn/skan"
        }
    }

    var etykieta: String {
        switch self {
        case .sklep: return "Sklep"
        case .przeglad: return "Przegląd"
        case .zamowienia: return "Zamówienia"
        case .magazyn: return "Magazyn"
        case .skaner: return "Skaner"
        }
    }

    /// Symbole dobrane pod makiety. Ikony w projekcie nie są SF Symbols, tylko
    /// rysunkami liniowymi, więc bierzemy najbliższe systemowe odpowiedniki
    /// kształtu: prostokąt z poprzeczką, domek, ramka celownika.
    var ikona: String {
        switch self {
        case .sklep: return "bag"
        case .przeglad: return "square.grid.2x2"
        case .zamowienia: return "archivebox"
        case .magazyn: return "house"
        case .skaner: return "viewfinder"
        }
    }

    var url: URL { bazowyAdres.appendingPathComponent(sciezka) }
}

/// Widoki sieciowe wariantu powstają raz, przy starcie aplikacji, i od razu
/// zaczynają wczytywać swoje ekrany.
///
/// Wcześniej `TabView` tworzył widok dopiero przy pierwszym wejściu w zakładkę,
/// więc każda z nich witała kręciołkiem — cztery ekrany ładowania na jedną
/// sesję. Teraz ładuje się wyłącznie ta, w którą magazynier wchodzi jako
/// pierwszą; reszta dojeżdża w tle i przełączanie jest natychmiastowe.
///
/// Koszt: cztery lekkie listy w pamięci naraz. Przy narzędziu, w którym
/// przeskakuje się między zakładkami co kilkanaście sekund, to dobra wymiana.
/// W wariancie sklepu zakładka jest jedna, więc koszt znika.
@MainActor
final class Powloka: ObservableObject {
    /// Zakładki, które choć raz doczytały treść — kręciołek pokazujemy
    /// wyłącznie zanim jest cokolwiek do oglądania.
    @Published var wczytane: Set<Zakladka> = []
    @Published var bledy: [Zakladka: String] = [:]

    private var widoki: [Zakladka: WKWebView] = [:]
    private var koordynatorzy: [Zakladka: Koordynator] = [:]

    /// Ścieżka, na której wylądował przegląd — po niej poznajemy zalogowanie.
    @Published var sciezkaPrzegladu = ""

    init() {
        for zakladka in Zakladka.dostepne {
            let koordynator = Koordynator(zakladka: zakladka, powloka: self)
            let widok = Self.zbuduj(koordynator: koordynator)
            koordynator.web = widok
            widoki[zakladka] = widok
            koordynatorzy[zakladka] = koordynator
            widok.load(URLRequest(url: zakladka.url))
        }
    }

    func widok(_ zakladka: Zakladka) -> WKWebView { widoki[zakladka]! }

    func odswiez(_ zakladka: Zakladka) {
        bledy[zakladka] = nil
        widoki[zakladka]?.load(URLRequest(url: zakladka.url))
    }

    private static func zbuduj(koordynator: Koordynator) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Kamera do skanowania ma działać w kadrze, bez przejmowania ekranu
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Znacznik doklejany publicznym API: WebKit sam dopisze go do
        // standardowego User-Agenta. Wcześniej szedł tu odczyt przez KVC,
        // który potrafi zwrócić pusto i wtedy serwer nie rozpoznawał powłoki.
        config.applicationNameForUserAgent = "NordoApp/1.0"

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = koordynator
        // Bez delegata interfejsu WebKit odrzuca `getUserMedia` z miejsca —
        // iOS nie zdąży nawet zapytać o zgodę na aparat, a skaner pokazuje
        // „brak zgody" mimo że użytkownik o nic nie był proszony.
        web.uiDelegate = koordynator
        web.allowsBackForwardNavigationGestures = true

        // Tło strony w obu motywach; widok jest nieprzezroczysty, więc sam
        // zamalowuje wcięcia i nie prześwituje przez niego tło systemu.
        web.isOpaque = true
        web.backgroundColor = .tloNordo
        web.scrollView.backgroundColor = .tloNordo

        // WebKit sam dokłada wcięcia pod pasek stanu i pasek zakładek. Skoro
        // widok sięga krawędzi ekranu, drugie wcięcie odsuwałoby treść dwa
        // razy — a strona liczy swoje odstępy sama, z `env()`.
        web.scrollView.contentInsetAdjustmentBehavior = .never

        // Powiększanie szczypaniem wyłączone: magazyn obsługuje się w rękawicy
        // i jednym kciukiem, a przypadkowe rozjechanie kadru przy skanowaniu
        // kosztuje więcej, niż daje. Blokada obejmuje wyłącznie powłokę — ten
        // sam sklep otwarty w Safari powiększa się normalnie, więc nikomu nie
        // odbieramy dostępu do większych liter.
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.scrollView.minimumZoomScale = 1
        web.scrollView.maximumZoomScale = 1
        web.scrollView.bouncesZoom = false

        // Odświeżanie gestem — odruch każdego, kto trzyma telefon
        let odswiez = UIRefreshControl()
        odswiez.addTarget(koordynator, action: #selector(Koordynator.odswiez(_:)), for: .valueChanged)
        web.scrollView.refreshControl = odswiez

        return web
    }

    @MainActor
    final class Koordynator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let zakladka: Zakladka
        private weak var powloka: Powloka?
        weak var web: WKWebView?

        init(zakladka: Zakladka, powloka: Powloka) {
            self.zakladka = zakladka
            self.powloka = powloka
        }

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
            let swoj = origin.host == zakladka.url.host && type == .camera
            decisionHandler(swoj ? .grant : .deny)
        }

        @objc func odswiez(_ kontrolka: UIRefreshControl) {
            web?.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            powloka?.wczytane.insert(zakladka)
            powloka?.bledy[zakladka] = nil
            if zakladka == .przeglad, let sciezka = webView.url?.path {
                powloka?.sciezkaPrzegladu = sciezka
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            zakoncz(webView, error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            zakoncz(webView, error)
        }

        private func zakoncz(_ webView: WKWebView, _ error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            // Anulowanie to nie awaria — zdarza się przy szybkim przełączaniu
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            powloka?.bledy[zakladka] = error.localizedDescription
        }
    }
}

/// Pasek zakładek jest natywny, treść przychodzi z serwera. Dzięki temu
/// nawigacja zachowuje się jak w każdej aplikacji na iOS — gest przesunięcia,
/// zapamiętana pozycja w każdej zakładce, pasek nad obszarem gestów — a
/// jednocześnie zmiana w magazynie nie wymaga wgrywania aplikacji od nowa.
///
/// Przed zalogowaniem pasek się nie pokazuje: każda zakładka odbijałaby wtedy
/// na ten sam ekran logowania, a trzy drogi do jednego miejsca to nie wybór,
/// tylko zamieszanie. W wariancie sklepu paska nie ma nigdy — sklep to jeden
/// ciąg stron z własną nawigacją w treści, a nie cztery przyrządy obok siebie.
struct MagazynView: View {
    @StateObject private var powloka = Powloka()
    @State private var wybrana: Zakladka = Zakladka.dostepne[0]

    /// Czy pokazać pasek zakładek. Czytamy to z adresu, pod którym wylądował
    /// przegląd — serwer odsyła nieuprawnionych na /logowanie albo na ścianę
    /// „brak dostępu", więc to on pozostaje jedynym źródłem prawdy, a
    /// aplikacja niczego nie ocenia po swojemu.
    ///
    /// Ściana braku dostępu liczy się jak brak logowania, choć adres zaczyna
    /// się od /magazyn: konto bez uprawnień odbije się od niej w każdej
    /// zakładce, a cztery drogi do jednego komunikatu to nie wybór, tylko
    /// zamieszanie.
    ///
    /// Sklep nie ma czego pilnować: katalog jest jawny, a konto zakłada się
    /// w treści strony.
    private var zalogowany: Bool {
        if Wariant.biezacy == .sklep { return true }
        let sciezka = powloka.sciezkaPrzegladu
        return sciezka.hasPrefix("/magazyn") && !sciezka.hasPrefix("/magazyn/brak-dostepu")
    }

    private var zakladki: [Zakladka] { Zakladka.dostepne }

    var body: some View {
        Group {
            if zalogowany && zakladki.count > 1 {
                TabView(selection: $wybrana) {
                    ForEach(zakladki, id: \.self) { zakladka in
                        WebTab(zakladka: zakladka, powloka: powloka)
                            .tabItem {
                                Label(zakladka.etykieta, systemImage: zakladka.ikona)
                            }
                            .tag(zakladka)
                    }
                }
            } else {
                WebTab(zakladka: zakladki[0], powloka: powloka)
            }
        }
        .tint(Color(UIColor.akcentNordo))
        .background(Color(UIColor.tloNordo).ignoresSafeArea())
        .animation(.easeInOut(duration: 0.2), value: zalogowany)
    }
}

/// Jedna zakładka: gotowy widok sieciowy z powłoki, własna historia, własna
/// pozycja przewijania. Przełączanie zakładek nie przeładowuje treści.
private struct WebTab: View {
    let zakladka: Zakladka
    @ObservedObject var powloka: Powloka

    var body: some View {
        ZStack {
            Most(widok: powloka.widok(zakladka))
                // Treść idzie pod pasek stanu i pod uchwyt ekranu głównego —
                // inaczej nad nią i pod nią zostają puste pasy, a aplikacja
                // wygląda na mniejszą niż ekran. O to, żeby litery nie wpadły
                // pod wcięcie, dba strona przez `env(safe-area-inset-*)`.
                .ignoresSafeArea()

            if let blad = powloka.bledy[zakladka] {
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
                    Button("Spróbuj ponownie") { powloka.odswiez(zakladka) }
                        .buttonStyle(.borderedProminent)
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(UIColor.tloNordo))
                .ignoresSafeArea()
            } else if !powloka.wczytane.contains(zakladka) {
                // Kręciołek wyłącznie zanim w zakładce jest cokolwiek do
                // oglądania. Po pierwszym wczytaniu kolejne nawigacje idą
                // po gotowej treści — bez migania pustym ekranem.
                ProgressView()
            }
        }
    }
}

/// Cienki most do SwiftUI: widok jest już zbudowany i żyje w powłoce, więc
/// tutaj zostaje samo podanie go dalej.
private struct Most: UIViewRepresentable {
    let widok: WKWebView
    func makeUIView(context: Context) -> WKWebView { widok }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

extension UIColor {
    /// Tło strony w obu motywach. Wartości muszą zgadzać się z tym, co maluje
    /// przeglądarka, bo powłoka odsłania je w obszarach bezpiecznych i przy
    /// odbiciu sprężynowym — rozjazd widać jako pas obcego koloru nad paskiem
    /// stanu i pod treścią.
    ///
    /// Każdy wariant bierze tło swojej aplikacji:
    ///
    ///   sklep    `--bg` z `globals.css` — neutralna szarość KokonutUI,
    ///            ta sama para co `themeColor` w `web/app/layout.tsx`
    ///   magazyn  `--tlo` z bloku `.mag` — tło systemowe iOS, w ciemnym
    ///            czysta czerń, żeby na OLED piksele tła nie świeciły
    ///
    /// Dynamiczny kolor, więc zmiana motywu systemu przemalowuje wcięcia bez
    /// przeładowania widoku.
    static let tloNordo = UIColor { cechy in
        let ciemny = cechy.userInterfaceStyle == .dark
        switch Wariant.biezacy {
        case .sklep:
            return ciemny
                ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1)  // #121212
                : UIColor(red: 0.961, green: 0.961, blue: 0.961, alpha: 1)  // #f5f5f5
        case .magazyn:
            return ciemny
                ? UIColor(red: 0, green: 0, blue: 0, alpha: 1)              // #000000
                : UIColor(red: 0.949, green: 0.949, blue: 0.969, alpha: 1)  // #f2f2f7
        }
    }

    /// Barwa zaznaczenia paska zakładek i kontrolek systemowych.
    ///
    /// Magazyn ma siennę i to jest decyzja z jego palety; sienna ciemnieje na
    /// czerni, więc w ciemnym motywie idzie o stopień jaśniej — dokładnie tak
    /// jak `--tint` w `.mag` i `.dark .mag`.
    ///
    /// Sklep nie ma barwy akcentu: w KokonutUI wyróżnia kontrast, nie kolor,
    /// więc `--accent` jest tam najciemniejszą czernią (w ciemnym motywie —
    /// najjaśniejszą bielą).
    static let akcentNordo = UIColor { cechy in
        let ciemny = cechy.userInterfaceStyle == .dark
        switch Wariant.biezacy {
        case .sklep:
            return ciemny
                ? UIColor(red: 0.922, green: 0.922, blue: 0.922, alpha: 1)  // #ebebeb
                : UIColor(red: 0.090, green: 0.090, blue: 0.090, alpha: 1)  // #171717
        case .magazyn:
            return ciemny
                ? UIColor(red: 0.812, green: 0.604, blue: 0.447, alpha: 1)  // #cf9a72
                : UIColor(red: 0.612, green: 0.400, blue: 0.267, alpha: 1)  // #9c6644
        }
    }
}
