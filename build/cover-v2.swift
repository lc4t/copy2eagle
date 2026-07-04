import AppKit

let canvasSize = NSSize(width: 1800, height: 1200)

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
    NSColor(
        red: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: alpha
    )
}

func load(_ path: String) -> NSImage {
    guard let image = NSImage(contentsOfFile: path) else {
        fatalError("Cannot load image: \(path)")
    }
    if let rep = image.representations.first {
        image.size = NSSize(width: rep.pixelsWide, height: rep.pixelsHigh)
    }
    return image
}

func rect(top: CGFloat, left: CGFloat, width: CGFloat, height: CGFloat) -> NSRect {
    NSRect(x: left, y: canvasSize.height - top - height, width: width, height: height)
}

func drawAspectFill(_ image: NSImage, in target: NSRect) {
    let scale = max(target.width / image.size.width, target.height / image.size.height)
    let sourceWidth = target.width / scale
    let sourceHeight = target.height / scale
    let source = NSRect(
        x: (image.size.width - sourceWidth) / 2,
        y: (image.size.height - sourceHeight) / 2,
        width: sourceWidth,
        height: sourceHeight
    )
    image.draw(in: target, from: source, operation: .sourceOver, fraction: 1)
}

func drawCard(_ image: NSImage, top: CGFloat, left: CGFloat, width: CGFloat, height: CGFloat, radius: CGFloat = 24) {
    let target = rect(top: top, left: left, width: width, height: height)

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.22)
    shadow.shadowBlurRadius = 34
    shadow.shadowOffset = NSSize(width: 0, height: -12)
    shadow.set()
    color(0xffffff).setFill()
    NSBezierPath(roundedRect: target, xRadius: radius, yRadius: radius).fill()
    NSGraphicsContext.restoreGraphicsState()

    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: target, xRadius: radius, yRadius: radius).addClip()
    image.draw(
        in: target,
        from: NSRect(origin: .zero, size: image.size),
        operation: .sourceOver,
        fraction: 1
    )
    NSGraphicsContext.restoreGraphicsState()
}

func drawText(
    _ text: String,
    top: CGFloat,
    left: CGFloat,
    width: CGFloat,
    size: CGFloat,
    weight: NSFont.Weight,
    textColor: NSColor,
    lineHeight: CGFloat? = nil
) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.maximumLineHeight = lineHeight ?? size * 1.34
    paragraph.minimumLineHeight = lineHeight ?? size * 1.34
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: textColor,
        .paragraphStyle: paragraph,
    ]
    let height = max(size * 1.4, (lineHeight ?? size * 1.34) * 3)
    NSString(string: text).draw(
        with: rect(top: top, left: left, width: width, height: height),
        options: [.usesLineFragmentOrigin, .usesFontLeading],
        attributes: attributes
    )
}

func drawPill(_ text: String, top: CGFloat, left: CGFloat, width: CGFloat) {
    let target = rect(top: top, left: left, width: width, height: 66)
    color(0x1677ff, alpha: 0.11).setFill()
    NSBezierPath(roundedRect: target, xRadius: 33, yRadius: 33).fill()
    drawText(
        text,
        top: top + 13,
        left: left + 28,
        width: width - 56,
        size: 30,
        weight: .semibold,
        textColor: color(0x0b63ce)
    )
}

func makeImage(background: NSColor, draw: () -> Void) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(canvasSize.width),
        pixelsHigh: Int(canvasSize.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    rep.size = canvasSize
    let context = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    background.setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: canvasSize)).fill()
    draw()
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

func write(_ rep: NSBitmapImageRep, to path: String) {
    guard let data = rep.representation(using: .png, properties: [:]) else {
        fatalError("Cannot encode PNG: \(path)")
    }
    try! data.write(to: URL(fileURLWithPath: path))
}

guard CommandLine.arguments.count == 5 else {
    fatalError("Usage: cover-v2.swift <background> <overview-shot> <settings-shot> <output>")
}

let background = load(CommandLine.arguments[1])
let overview = load(CommandLine.arguments[2])
let settings = load(CommandLine.arguments[3])
let output = CommandLine.arguments[4]

let cover = makeImage(background: color(0xf4f8ff)) {
    drawAspectFill(background, in: NSRect(origin: .zero, size: canvasSize))

    let panel = rect(top: 150, left: 70, width: 790, height: 860)
    color(0xffffff, alpha: 0.76).setFill()
    NSBezierPath(roundedRect: panel, xRadius: 54, yRadius: 54).fill()

    drawText("剪贴板图片留存", top: 255, left: 126, width: 640, size: 78, weight: .bold, textColor: color(0x12233f))
    drawText("复制图片，自动出现在 Eagle", top: 380, left: 130, width: 620, size: 40, weight: .medium, textColor: color(0x38506f))
    drawPill("剪贴板 · 截图 · 自动归档", top: 520, left: 130, width: 470)
    drawText("macOS only", top: 650, left: 132, width: 360, size: 34, weight: .regular, textColor: color(0x607896))

    drawCard(settings, top: 610, left: 1060, width: 620, height: 387.5, radius: 26)
    drawCard(overview, top: 190, left: 890, width: 820, height: 512.5, radius: 28)
}

write(cover, to: output)
