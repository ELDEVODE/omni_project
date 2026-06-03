import http from "http";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { loadModel, transcribe, PARAKEET_CTC_0_6B_Q8_0 } from "@qvac/sdk";

const PORT = 3006;
console.log("🚀 Starting HP OmniBook Dedicated Speech API Server...");

let speechModelId = null;

async function initializeEngine() {
  try {
    console.log("📥 Loading Parakeet CTC model via SDK constant...");
    speechModelId = await loadModel({
      modelSrc: PARAKEET_CTC_0_6B_Q8_0,
      modelType: "parakeet",
    });
    console.log(
      `🔊 Parakeet Speech Engine Active. Instance: "${speechModelId}"`,
    );
  } catch (err) {
    console.error(
      "❌ Failed to initialize local GPU speech engine:",
      err.message,
    );
  }
}

await initializeEngine();

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/transcribe") {
    let audioChunks = [];
    req.on("data", (chunk) => {
      audioChunks.push(chunk);
    });
    req.on("end", async () => {
      try {
        if (!speechModelId) {
          throw new Error("Speech model failed to load on boot.");
        }

        const audioBuffer = Buffer.concat(audioChunks);
        console.log(
          `🎙️ Received compressed web audio: ${audioBuffer.length} bytes`,
        );

        // 1. Create temporary file paths
        const tempInput = path.resolve("./temp_input.webm");
        const tempOutput = path.resolve("./temp_output.wav");

        // 2. Save the compressed web audio to disk
        fs.writeFileSync(tempInput, audioBuffer);

        // 3. Use FFmpeg to decode and resample to 16kHz, 16-bit, Mono WAV
        console.log(`🔄 Resampling audio to 16kHz WAV...`);
        execSync(
          `ffmpeg -y -i "${tempInput}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempOutput}"`,
          { stdio: "ignore" },
        );

        // 4. Pass the clean WAV file directly to Parakeet
        console.log(`🧠 Processing audio on Arc GPU...`);
        const transcribedText = await transcribe({
          modelId: speechModelId,
          audioChunk: tempOutput, // The SDK natively accepts file paths!
        });

        console.log(`🔊 Decoded: "${transcribedText}"`);

        // 5. Clean up temporary files
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text: transcribedText }));
      } catch (err) {
        console.error("❌ Model inference crashed:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✨ HP OmniMesh Hub running locally on Port ${PORT}`);
});
