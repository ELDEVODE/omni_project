process.env["QVAC_LOCAL_DISCOVERY_ONLY"] = "1";
import https from "https";
import fs from "fs";
import {
  loadModel,
  completion,
  textToSpeech,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_EN_SUPERTONIC_Q8_0,
} from "@qvac/sdk";

const PORT = 3005;

const sslOptions = {
  key: fs.readFileSync("./localhost+1-key.pem"),
  cert: fs.readFileSync("./localhost+1.pem"),
};

console.log("🚀 Initializing secure HTTPS OmniMesh Orchestrator Server...");

let localChatModelId = null;
let localTtsModelId = null;

async function initializeMacEngine() {
  try {
    console.log("🧠 Loading Llama 3.2 LLM...");
    localChatModelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelConfig: { ctx_size: 4096 },
    });

    console.log("🔊 Loading Supertonic TTS...");
    localTtsModelId = await loadModel({
      modelSrc: TTS_EN_SUPERTONIC_Q8_0.src,
      modelType: "tts",
      modelConfig: {
        ttsEngine: "supertonic",
        language: "en",
        voice: "F1",
      },
    });

    console.log(
      `✅ Mac Engines Online. LLM: "${localChatModelId}", TTS: "${localTtsModelId}"`,
    );
  } catch (err) {
    console.error("❌ Failed to initialize Mac engines:", err.message);
  }
}

await initializeMacEngine();

const server = https.createServer(sslOptions, async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route: Text Chat
  if (req.method === "POST" && req.url === "/api/delegate") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const { prompt } = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        const run = completion({
          modelId: localChatModelId,
          history: [{ role: "user", content: prompt }],
          stream: true,
        });
        for await (const event of run.events) {
          if (event.type === "contentDelta")
            res.write(`data: ${JSON.stringify({ text: event.text })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (err) {
        res.end();
      }
    });
  }
  // Route: Text-to-Speech (Plays on the requesting device)
  else if (req.method === "POST" && req.url === "/api/tts") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const { text } = JSON.parse(body);
        const ttsResult = await textToSpeech({
          modelId: localTtsModelId,
          text: text,
          inputType: "text",
          stream: false,
        });
        const audioBuffer = Buffer.from(await ttsResult.buffer);
        res.writeHead(200, {
          "Content-Type": "audio/wav",
          "Content-Length": audioBuffer.length,
        });
        res.end(audioBuffer);
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Route: Transcription Proxy to HP
  else if (req.method === "POST" && req.url === "/api/transcribe-voice") {
    let audioChunks = [];
    req.on("data", (chunk) => {
      audioChunks.push(chunk);
    });
    req.on("end", async () => {
      try {
        const audioBuffer = Buffer.concat(audioChunks);
        const response = await fetch("http://192.168.0.2:3006/api/transcribe", {
          method: "POST",
          body: audioBuffer,
        });
        const result = await response.json();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🔒 Secure HTTPS OmniMesh Hub running locally on Port ${PORT}`);
});
