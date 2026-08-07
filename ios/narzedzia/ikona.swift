// Ikona aplikacji Nordo — 1024×1024, rysowana raz i zapisana do PNG.
// Monogram szeryfowy w kolorze tła sklepu na grafitowym polu, plus rdzawa
// kropka z logo. Bez przezroczystości i bez zaokrągleń: maskę rysuje iOS.
import AppKit
import CoreGraphics
import Foundation

let bok = 1024
let ciemny = NSColor(srgbRed: 0.086, green: 0.082, blue: 0.059, alpha: 1) // #16150f
let kremowy = NSColor(srgbRed: 0.980, green: 0.976, blue: 0.969, alpha: 1) // #faf9f7
let rdzawy = NSColor(srgbRed: 0.647, green: 0.290, blue: 0.145, alpha: 1)  // akcent

guard let ctx = CGContext(
    data: nil, width: bok, height: bok, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else { fatalError("nie udało się utworzyć kontekstu") }

let plotno = NSGraphicsContext(cgContext: ctx, flipped: false)
NSGraphicsContext.current = plotno

ciemny.setFill()
NSRect(x: 0, y: 0, width: bok, height: bok).fill()

// Monogram. Georgia stoi najbliżej Instrument Serif z zestawu systemowego,
// a ikona i tak nie może zależeć od kroju ładowanego przez stronę.
let krój = NSFont(name: "Georgia", size: 620) ?? NSFont.systemFont(ofSize: 620)
let napis = NSAttributedString(
    string: "N",
    attributes: [.font: krój, .foregroundColor: kremowy]
)
let rozmiar = napis.size()
napis.draw(at: NSPoint(x: (CGFloat(bok) - rozmiar.width) / 2,
                       y: (CGFloat(bok) - rozmiar.height) / 2 + 18))

// Kropka z logo — ta sama, która stoi przy „Nordo" w nagłówku sklepu.
rdzawy.setFill()
let r: CGFloat = 46
NSBezierPath(ovalIn: NSRect(x: CGFloat(bok) / 2 + 242 - r,
                            y: 322 - r, width: r * 2, height: r * 2)).fill()

NSGraphicsContext.current = nil

guard let obraz = ctx.makeImage() else { fatalError("brak obrazu") }
let dane = NSBitmapImageRep(cgImage: obraz).representation(using: .png, properties: [:])!
try dane.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("zapisano \(CommandLine.arguments[1])")
