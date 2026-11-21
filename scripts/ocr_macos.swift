// Extract text only from pixels with Apple's on-device Vision OCR.
// Usage: compiled-ocr input.json output.json
import Foundation
import Vision

struct Sample: Codable { let file_name: String; let image_path: String }
struct Result: Codable { let file_name: String; let text: String; let image_path: String }
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let samples = try JSONDecoder().decode([Sample].self, from: Data(contentsOf: input))
var results: [Result] = []
for (index, sample) in samples.enumerated() {
    let text: String = try autoreleasepool {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["en-US"]
        request.usesLanguageCorrection = true
        try VNImageRequestHandler(url: URL(fileURLWithPath: sample.image_path), options: [:]).perform([request])
        return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    }
    results.append(Result(file_name: sample.file_name, text: text, image_path: sample.image_path))
    if (index + 1) % 10 == 0 { print("OCR processed \(index + 1)/\(samples.count)") }
}
try JSONEncoder().encode(results).write(to: output, options: .atomic)
