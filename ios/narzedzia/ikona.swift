// Ikony aplikacji — 1024×1024, rysowane raz i zapisane do PNG.
//
// Dwie aplikacje, dwie ikony. Stoją obok siebie na tym samym ekranie
// początkowym, więc muszą różnić się z odległości ramienia — a rozpoznaje się
// je najpierw po kolorze pola, nie po literze.
//
//   sklep    grafitowe pole, jasny monogram. Neutralnie, bo w palecie sklepu
//            wyróżnia kontrast, a nie barwa — nie ma tam koloru do wzięcia.
//   magazyn  pole sienną. To jedyna barwa w palecie przyrządu i jego znak
//            rozpoznawczy; ta sama, którą pasek zakładek maluje zaznaczenie.
//
// Monogram idzie krojem systemowym. Wcześniej stała tu Georgia, dobrana pod
// szeryfowy nagłówek z poprzedniej rundy — sklep jedzie dziś Geistem i szeryf
// przestał mieć z czym rozmawiać. Kropka po literze to znak z nagłówka sklepu.
//
// Bez przezroczystości i bez zaokrągleń: maskę rysuje iOS.
//
//   swift ikona.swift sklep   sciezka/do/ikona-1024.png
//   swift ikona.swift magazyn sciezka/do/ikona-1024.png
import AppKit
import CoreGraphics
import Foundation

let bok = 1024

struct Paleta {
    let pole: NSColor
    let znak: NSColor
}

let palety: [String: Paleta] = [
    // --ink #0a0a0a na --surface #fafafa, czyli para o najwyższym kontraście
    // w palecie sklepu.
    "sklep": Paleta(
        pole: NSColor(srgbRed: 0.039, green: 0.039, blue: 0.039, alpha: 1),  // #0a0a0a
        znak: NSColor(srgbRed: 0.980, green: 0.980, blue: 0.980, alpha: 1)   // #fafafa
    ),
    // --tint #9c6644 z bloku `.mag`, biel z --btn-ink.
    "magazyn": Paleta(
        pole: NSColor(srgbRed: 0.612, green: 0.400, blue: 0.267, alpha: 1),  // #9c6644
        znak: NSColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)               // #ffffff
    ),
]

guard CommandLine.arguments.count == 3 else {
    FileHandle.standardError.write("użycie: ikona.swift <sklep|magazyn> <plik.png>\n".data(using: .utf8)!)
    exit(2)
}
let wariant = CommandLine.arguments[1]
guard let paleta = palety[wariant] else {
    FileHandle.standardError.write("nieznany wariant: \(wariant) (sklep | magazyn)\n".data(using: .utf8)!)
    exit(2)
}

guard let ctx = CGContext(
    data: nil, width: bok, height: bok, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else { fatalError("nie udało się utworzyć kontekstu") }

let plotno = NSGraphicsContext(cgContext: ctx, flipped: false)
NSGraphicsContext.current = plotno

paleta.pole.setFill()
NSRect(x: 0, y: 0, width: bok, height: bok).fill()

// Monogram krojem systemowym w grubości półtłustej — najbliżej temu, co robi
// Geist w szyldzie sklepu. Ikona nie może zależeć od kroju ładowanego przez
// stronę, więc sięgamy po to, co jest na każdym Macu i każdym iPhonie.
let krój = NSFont.systemFont(ofSize: 560, weight: .semibold)
let napis = NSAttributedString(
    string: "N",
    attributes: [.font: krój, .foregroundColor: paleta.znak]
)
let rozmiar = napis.size()
napis.draw(at: NSPoint(x: (CGFloat(bok) - rozmiar.width) / 2,
                       y: (CGFloat(bok) - rozmiar.height) / 2))

// Kropka z logo — ta sama, która stoi przy szyldzie w nagłówku sklepu.
// W arkuszu ma `background: var(--accent)`, czyli w obu motywach kolor
// o najwyższym kontraście do tła; tutaj tym kolorem jest barwa monogramu.
paleta.znak.setFill()
let r: CGFloat = 42
NSBezierPath(ovalIn: NSRect(x: (CGFloat(bok) + rozmiar.width) / 2 + 20 - r,
                            y: 352 - r, width: r * 2, height: r * 2)).fill()

NSGraphicsContext.current = nil

guard let obraz = ctx.makeImage() else { fatalError("brak obrazu") }
let dane = NSBitmapImageRep(cgImage: obraz).representation(using: .png, properties: [:])!
try dane.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
print("zapisano \(CommandLine.arguments[2])")
