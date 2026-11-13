import Vision
import CoreImage
import AppKit

// Usage: cutout in.png out.png — foreground subject mask from Apple Vision (macOS 14+).
let args = CommandLine.arguments
let input = CIImage(contentsOf: URL(fileURLWithPath: args[1]))!
let handler = VNImageRequestHandler(ciImage: input)
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
