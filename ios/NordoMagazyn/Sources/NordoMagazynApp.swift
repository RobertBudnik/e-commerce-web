import SwiftUI

@main
struct NordoMagazynApp: App {
    var body: some Scene {
        WindowGroup {
            MagazynView()
                // Magazyn ma własne tło i pasek — widok idzie pod status bar,
                // tak jak w aplikacji dodanej do ekranu początkowego.
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
