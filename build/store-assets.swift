import AppKit

struct Crop {
    let x: CGFloat
    let top: CGFloat
    let width: CGFloat
    let height: CGFloat
}

let canvasSize = NSSize(width: 1280, height: 800)
let coverPixelScale: CGFloat = 1.5

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

func sourceRect(for image: NSImage, crop: Crop) -> NSRect {
    NSRect(
        x: crop.x,
        y: image.size.height - crop.top - crop.height,
        width: crop.width,
        height: crop.height
    )
}

func drawAspectFill(_ image: NSImage, in rect: NSRect) {
    let scale = max(rect.width / image.size.width, rect.height / image.size.height)
    let sourceWidth = rect.width / scale
    let sourceHeight = rect.height / scale
    let source = NSRect(
        x: (image.size.width - sourceWidth) / 2,
        y: (image.size.height - sourceHeight) / 2,
        width: sourceWidth,
        height: sourceHeight
    )
    image.draw(in: rect, from: source, operation: .sourceOver, fraction: 1)
}

func drawCard(_ image: NSImage, crop: Crop, top: CGFloat, left: CGFloat, width: CGFloat, height: CGFloat) {
    let rect = NSRect(x: left, y: canvasSize.height - top - height, width: width, height: height)
    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.20)
    shadow.shadowBlurRadius = 24
    shadow.shadowOffset = NSSize(width: 0, height: -8)
    shadow.set()
    color(0xffffff).setFill()
    NSBezierPath(roundedRect: rect, xRadius: 18, yRadius: 18).fill()
    NSGraphicsContext.restoreGraphicsState()

    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: rect, xRadius: 18, yRadius: 18).addClip()
    image.draw(in: rect, from: sourceRect(for: image, crop: crop), operation: .sourceOver, fraction: 1)
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
    paragraph.maximumLineHeight = lineHeight ?? size * 1.35
    paragraph.minimumLineHeight = lineHeight ?? size * 1.35
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: textColor,
        .paragraphStyle: paragraph,
    ]
    let height = max(100, (lineHeight ?? size * 1.35) * 4)
    let rect = NSRect(x: left, y: canvasSize.height - top - height, width: width, height: height)
    NSString(string: text).draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
}

func drawPill(_ text: String, top: CGFloat, left: CGFloat, width: CGFloat) {
    let height: CGFloat = 44
    let rect = NSRect(x: left, y: canvasSize.height - top - height, width: width, height: height)
    color(0x1677ff, alpha: 0.10).setFill()
    NSBezierPath(roundedRect: rect, xRadius: 22, yRadius: 22).fill()
    drawText(text, top: top + 7, left: left + 18, width: width - 36, size: 20, weight: .medium, textColor: color(0x0b63ce))
}

func makeImage(background: NSColor, pixelScale: CGFloat = 1, draw: () -> Void) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(canvasSize.width * pixelScale),
        pixelsHigh: Int(canvasSize.height * pixelScale),
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

guard CommandLine.arguments.count == 6 else {
    fatalError("Usage: store-assets.swift <background> <overview> <eagle> <settings> <output-dir>")
}

let background = load(CommandLine.arguments[1])
let overview = load(CommandLine.arguments[2])
let eagle = load(CommandLine.arguments[3])
let settings = load(CommandLine.arguments[4])
let outputDir = CommandLine.arguments[5]
try! FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let cover = makeImage(background: color(0xf4f8ff), pixelScale: coverPixelScale) {
    drawAspectFill(background, in: NSRect(origin: .zero, size: canvasSize))
    color(0xffffff, alpha: 0.70).setFill()
    NSBezierPath(roundedRect: NSRect(x: 48, y: 82, width: 610, height: 636), xRadius: 32, yRadius: 32).fill()
    drawText("剪贴板图片留存", top: 142, left: 92, width: 520, size: 58, weight: .bold, textColor: color(0x12233f))
    drawText("复制图片，自动出现在 Eagle", top: 242, left: 92, width: 510, size: 32, weight: .medium, textColor: color(0x38506f))
    drawPill("剪贴板 · 截图 · 自动归档", top: 342, left: 92, width: 310)
    drawText("macOS · Windows", top: 420, left: 94, width: 330, size: 23, weight: .regular, textColor: color(0x607896))
    drawCard(
        overview,
        crop: Crop(x: 0, top: 0, width: 838, height: 1030),
        top: 64,
        left: 790,
        width: 430,
        height: 664
    )
}
write(cover, to: "\(outputDir)/cover-1920x1200.png")

let overviewShot = makeImage(background: color(0xeff5ff)) {
    drawText("复制即保存", top: 140, left: 64, width: 500, size: 54, weight: .bold, textColor: color(0x12233f))
    drawText("剪贴板图片和截图\n自动归档到指定文件夹", top: 235, left: 66, width: 500, size: 28, weight: .regular, textColor: color(0x4e6685), lineHeight: 44)
    drawPill("后台持续运行", top: 380, left: 66, width: 190)
    drawPill("本地处理", top: 442, left: 66, width: 150)
    drawCard(
        overview,
        crop: Crop(x: 0, top: 0, width: 838, height: 1000),
        top: 44,
        left: 660,
        width: 566,
        height: 675
    )
}
write(overviewShot, to: "\(outputDir)/screenshot-01-overview.png")

let eagleShot = makeImage(background: color(0xf3f6fb)) {
    drawText("保存结果清清楚楚", top: 26, left: 72, width: 600, size: 42, weight: .bold, textColor: color(0x12233f))
    drawText("在 Eagle 中直接查看刚刚导入的图片", top: 82, left: 74, width: 650, size: 24, weight: .regular, textColor: color(0x607896))
    drawCard(
        eagle,
        crop: Crop(x: 480, top: 70, width: 1420, height: 850),
        top: 138,
        left: 70,
        width: 1140,
        height: 682
    )
}
write(eagleShot, to: "\(outputDir)/screenshot-02-eagle-result.png")

let settingsShot = makeImage(background: color(0xeff5ff)) {
    drawText("灵活，但不复杂", top: 150, left: 70, width: 520, size: 52, weight: .bold, textColor: color(0x12233f))
    drawText("自定义命名\n智能去重\n按来源分流", top: 265, left: 74, width: 460, size: 31, weight: .medium, textColor: color(0x38506f), lineHeight: 58)
    drawPill("默认设置即可使用", top: 500, left: 72, width: 230)
    drawCard(
        settings,
        crop: Crop(x: 0, top: 620, width: 920, height: 1280),
        top: 48,
        left: 700,
        width: 503,
        height: 700
    )
}
write(settingsShot, to: "\(outputDir)/screenshot-03-settings.png")
