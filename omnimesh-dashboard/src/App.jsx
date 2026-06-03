import React, { useState, useRef, useEffect, useCallback } from 'react';

const SERVER_IP  = "192.168.0.3";
const SERVER_URL = `https://${SERVER_IP}:3005`;

/* ────────────────────────────────────────────────
   TTS — plays audio returned as binary from /api/tts
──────────────────────────────────────────────── */
async function playAudioResponse(text, serverUrl) {
  const response = await fetch(`${serverUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) throw new Error(`TTS error: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer  = await audioContext.decodeAudioData(arrayBuffer);

  return new Promise((resolve, reject) => {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.onended = resolve;
    source.onerror = reject;
    source.start(0);
  });
}

/* ────────────────────────────────────────────────
   ICONS
──────────────────────────────────────────────── */
const Mic = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8"  y1="23" x2="16" y2="23"/>
  </svg>
);

const Stop = ({ s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
  </svg>
);

const SpeakerOn = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const SpeakerOff = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);

const Send = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const Cpu = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);

const Wifi = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
    <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
    <line x1="12" y1="20" x2="12.01" y2="20"/>
  </svg>
);

const Zap = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

/* ────────────────────────────────────────────────
   ARC REACTOR — scales with `size` prop
──────────────────────────────────────────────── */
function ArcReactor({ size = 44 }) {
  return (
    <div className="arc-reactor" style={{ width: size, height: size }}>
      <div className="arc-ring arc-ring-1" />
      <div className="arc-ring arc-ring-2" />
      <div className="arc-core" />
    </div>
  );
}

/* ────────────────────────────────────────────────
   WAVEFORM
──────────────────────────────────────────────── */
function Waveform({ height = 24 }) {
  return (
    <div style={{ display:'flex', gap: 3, alignItems:'center', height }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="wave-bar" style={{ height }} />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────
   THINKING INDICATOR
──────────────────────────────────────────────── */
function Thinking() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 10, padding:'12px 0' }}>
      <div style={{ display:'flex', gap: 5 }}>
        <div className="think-dot"/>
        <div className="think-dot"/>
        <div className="think-dot"/>
      </div>
      <span style={{ fontFamily:'var(--font-hud)', fontSize:11, color:'rgba(0,212,255,0.45)', letterSpacing:'0.1em' }}>
        PROCESSING QUERY...
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────
   NODE DATA
──────────────────────────────────────────────── */
const NODES = [
  { id:'NODE_1', label:'S20 Front',  icon:<Wifi/>, status:'idle'   },
  { id:'NODE_2', label:'iPhone 12',  icon:<Wifi/>, status:'idle'   },
  { id:'NODE_3', label:'Mac Mesh',   icon:<Cpu/>,  status:'active' },
  { id:'NODE_4', label:'OmniBook X', icon:<Zap/>,  status:'idle'   },
];

/* ────────────────────────────────────────────────
   HUD PANEL wrapper
──────────────────────────────────────────────── */
function Panel({ className='', style={}, children }) {
  return (
    <div className={`hud-panel ${className}`} style={style}>
      <div className="hud-br">{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────
   PANEL HEADER BAR
──────────────────────────────────────────────── */
function PanelBar({ label, right }) {
  return (
    <div style={{
      padding:'10px 14px',
      borderBottom:'1px solid rgba(0,212,255,0.12)',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap: 8,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {/* traffic lights */}
        <div style={{ display:'flex', gap:5 }}>
          {['rgba(255,45,85,0.6)','rgba(255,159,0,0.6)','rgba(0,255,159,0.6)'].map(c => (
            <div key={c} style={{ width:7, height:7, borderRadius:'50%', background:c }}/>
          ))}
        </div>
        <span className="hud-label">{label}</span>
      </div>
      {right}
    </div>
  );
}

/* ────────────────────────────────────────────────
   MAIN APP
──────────────────────────────────────────────── */
export default function App() {
  const [prompt,          setPrompt]          = useState('');
  const [output,          setOutput]          = useState('');
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('VOICE IDLE');
  const [timestamp,       setTimestamp]       = useState('');
  const [ttsEnabled,      setTtsEnabled]      = useState(true);
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [ttsError,        setTtsError]        = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const outputRef        = useRef(null);
  const textareaRef      = useRef(null);

  /* auto-scroll */
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, isProcessing]);

  /* auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [prompt]);

  /* ── RECORDING ── */
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      setRecordingStatus('PROCESSING AUDIO...');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorderRef.current.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordingStatus('SENDING TO OMNIBOOK...');
        try {
          const res    = await fetch(`${SERVER_URL}/api/transcribe-voice`, {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob,
          });
          const result = await res.json();
          if (result.text) {
            setPrompt(result.text);
            setRecordingStatus('TRANSCRIBED ✓');
          } else {
            setRecordingStatus(`ERROR: ${result.error}`);
          }
        } catch (err) {
          setRecordingStatus(`NET ERROR: ${err.message}`);
        }
      };

      mediaRecorderRef.current.start(250);
      setIsRecording(true);
      setRecordingStatus('LISTENING...');
    } catch (err) {
      setRecordingStatus(`MIC BLOCKED`);
    }
  }, [isRecording]);

  /* ── SEND ── */
  const sendToCluster = useCallback(async () => {
    if (!prompt.trim() || isProcessing) return;
    setIsProcessing(true);
    setOutput('');
    setTimestamp(new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }));

    try {
      const res    = await fetch(`${SERVER_URL}/api/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const p = JSON.parse(raw);
            if (p.error) acc += `\n⚠ ${p.error}`;
            else if (p.text) acc += p.text;
            setOutput(acc);
          } catch { /* skip */ }
        }
      }

      // ── AUTO-PLAY TTS ──
      if (acc && ttsEnabled) {
        setIsSpeaking(true);
        setTtsError('');
        try {
          await playAudioResponse(acc, SERVER_URL);
        } catch (err) {
          setTtsError(`TTS: ${err.message}`);
        } finally {
          setIsSpeaking(false);
        }
      }

    } catch (err) {
      setOutput(`CLUSTER UNREACHABLE: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [prompt, isProcessing, ttsEnabled]);

  /* ── SPEAK RESPONSE ── */
  const speak = useCallback(async (text) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    setTtsError('');
    try {
      await playAudioResponse(text, SERVER_URL);
    } catch (err) {
      setTtsError(`TTS: ${err.message}`);
    } finally {
      setIsSpeaking(false);
    }
  }, [isSpeaking]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToCluster(); }
  };

  const isEmpty = !output && !isProcessing;

  /* ── RENDER ── */
  return (
    <div className="app-shell">

      {/* ══════════════════════════
          HEADER
      ══════════════════════════ */}
      <header className="app-header">

        {/* Arc reactor + title */}
        <div style={{ display:'flex', alignItems:'center', gap: 12, flex:1, minWidth:0 }}>
          <ArcReactor size={40} />
          <div style={{ minWidth:0 }}>
            <h1 className="hud-title" style={{
              fontSize: 'clamp(14px, 4vw, 20px)',
              fontWeight: 700,
              color: 'var(--text-bright)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              OMNI<span style={{
                color: 'var(--cyan)',
                textShadow: '0 0 12px var(--cyan)',
              }}>MESH</span>
              <span style={{ color:'rgba(0,212,255,0.4)', fontSize:'0.55em', marginLeft: 6 }}>
                CORE
              </span>
            </h1>
            <p className="hud-label" style={{ marginTop: 1 }}>
              SOVEREIGN POLYMATH WORKSPACE
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="header-status">
          <div style={{
            display:'flex', alignItems:'center', gap: 8,
            padding:'6px 12px',
            background:'rgba(0,20,40,0.6)',
            border:'1px solid var(--border)',
            flexShrink: 0,
          }}>
            {/* dot + ring */}
            <div style={{ position:'relative', width:10, height:10, flexShrink:0 }}>
              {isRecording && (
                <div style={{
                  position:'absolute', inset:0, borderRadius:'50%',
                  background:'rgba(255,45,85,0.5)',
                  animation:'pingRing 1.2s ease-out infinite',
                }}/>
              )}
              <div style={{
                width:10, height:10, borderRadius:'50%',
                background: isRecording ? '#ff2d55' : 'var(--green)',
                boxShadow: isRecording ? '0 0 8px #ff2d55' : '0 0 8px var(--green)',
              }}/>
            </div>

            <span className="hud-label" style={{
              color: isRecording ? '#ff7090' : 'rgba(0,255,159,0.7)',
              opacity:1, whiteSpace:'nowrap', fontSize:'clamp(8px,2vw,10px)',
            }}>
              {recordingStatus}
            </span>

            {isRecording && <Waveform height={20}/>}
          </div>

          {/* Cluster status pill */}
          <div style={{
            padding:'6px 12px',
            background: isProcessing ? 'rgba(0,87,255,0.1)' : 'rgba(0,20,40,0.4)',
            border:`1px solid ${isProcessing ? 'rgba(0,87,255,0.4)' : 'var(--border)'}`,
            display:'flex', alignItems:'center', gap: 6, flexShrink:0,
          }}>
            <div style={{
              width:6, height:6, borderRadius:'50%',
              background: isProcessing ? '#0057ff' : 'rgba(0,212,255,0.3)',
              boxShadow: isProcessing ? '0 0 8px #0057ff' : 'none',
              animation: isProcessing ? 'pulseOpacity 0.8s ease-in-out infinite' : 'none',
            }}/>
            <span className="hud-label status-text-long" style={{ opacity:1, fontSize:'clamp(8px,2vw,10px)' }}>
              {isProcessing ? 'STREAMING' : 'CLUSTER READY'}
            </span>
          </div>
        </div>
      </header>

      {/* ══════════════════════════
          MAIN AREA
      ══════════════════════════ */}
      <main className="app-main">

        <Panel className="output-panel">
          <PanelBar
            label="THOUGHT_STREAM // OUTPUT"
            right={
              <div style={{ display:'flex', alignItems:'center', gap: 8 }}>

                {/* TTS error hint */}
                {ttsError && (
                  <span className="hud-label" style={{ color:'#ff6a00', opacity:1, fontSize:9 }}>
                    {ttsError}
                  </span>
                )}

                {/* Speaking indicator */}
                {isSpeaking && (
                  <span className="hud-label" style={{ color:'var(--green)', opacity:1, fontSize:'clamp(8px,2vw,10px)', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 6px var(--green)', animation:'pulseOpacity 0.8s ease-in-out infinite' }}/>
                    SPEAKING
                  </span>
                )}

                {/* Streaming indicator */}
                {isProcessing && (
                  <span className="hud-label" style={{ opacity:1, color:'var(--cyan)', fontSize:'clamp(8px,2vw,10px)' }}>
                    ◈ STREAMING
                  </span>
                )}

                {/* Speaker toggle button */}
                <button
                  id="btn-tts-toggle"
                  onClick={() => setTtsEnabled(v => !v)}
                  title={ttsEnabled ? 'Disable voice output' : 'Enable voice output'}
                  style={{
                    width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 4,
                    background: ttsEnabled ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ttsEnabled ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: ttsEnabled ? 'var(--cyan)' : 'rgba(100,180,255,0.25)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  {ttsEnabled ? <SpeakerOn s={13}/> : <SpeakerOff s={13}/>}
                </button>

                {/* Manual replay button — only shown when there's output and not speaking */}
                {output && !isSpeaking && !isProcessing && (
                  <button
                    id="btn-tts-replay"
                    onClick={() => speak(output)}
                    title="Replay voice response"
                    disabled={!ttsEnabled}
                    style={{
                      width: 28, height: 28,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 4,
                      background: 'rgba(0,87,255,0.1)',
                      border: '1px solid rgba(0,87,255,0.35)',
                      color: ttsEnabled ? '#4499ff' : 'rgba(100,180,255,0.2)',
                      transition: 'all 0.2s',
                      cursor: ttsEnabled ? 'pointer' : 'not-allowed',
                      opacity: ttsEnabled ? 1 : 0.35,
                    }}
                  >
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                )}
              </div>
            }
          />
          <div className="panel-scroll output-panel-body" ref={outputRef}>

            {isEmpty ? (
              /* ── IDLE STATE ── */
              <div className="anim-fade-up" style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', height:'100%', minHeight:160, gap:16, textAlign:'center',
              }}>
                <div style={{ position:'relative' }}>
                  <ArcReactor size={64}/>
                </div>
                <div>
                  <p className="hud-title" style={{
                    fontSize:'clamp(14px,3vw,17px)', color:'rgba(0,212,255,0.5)', fontWeight:600,
                  }}>
                    AWAITING INPUT
                  </p>
                  <p className="hud-label" style={{ marginTop:6, opacity:0.4, fontSize:'clamp(9px,2vw,11px)' }}>
                    INITIALIZE PROMPT OR VOICE CAPTURE TO BEGIN
                  </p>
                </div>

                {/* decorative HUD dashes */}
                <div style={{ display:'flex', gap: 4, alignItems:'center' }}>
                  {Array.from({length: 8}).map((_,i) => (
                    <div key={i} style={{
                      width: i === 3 || i === 4 ? 20 : 8,
                      height:1,
                      background:`rgba(0,212,255,${0.1 + i*0.03})`,
                    }}/>
                  ))}
                </div>
              </div>

            ) : (
              /* ── OUTPUT ── */
              <div className="anim-slide-left">
                {/* response header */}
                <div style={{
                  display:'flex', alignItems:'center', gap:10, marginBottom:14,
                  paddingBottom:10, borderBottom:'1px solid rgba(0,212,255,0.1)',
                  flexWrap:'wrap', gap:8,
                }}>
                  <ArcReactor size={26}/>
                  <span className="hud-title" style={{
                    fontSize:'clamp(11px,2.5vw,13px)', color:'var(--cyan)', fontWeight:600,
                  }}>
                    OMNIMESH AI
                  </span>
                  {timestamp && (
                    <span className="hud-label" style={{ opacity:0.35, fontSize:'clamp(8px,2vw,10px)' }}>
                      {timestamp}
                    </span>
                  )}
                  {isProcessing && (
                    <span style={{
                      marginLeft:'auto',
                      background:'rgba(0,87,255,0.15)',
                      border:'1px solid rgba(0,87,255,0.4)',
                      padding:'2px 8px',
                      fontFamily:'var(--font-hud)', fontSize:9,
                      color:'#4499ff', letterSpacing:'0.12em',
                    }}>
                      LIVE
                    </span>
                  )}
                </div>

                <p className={`output-text ${isProcessing ? 'cursor-blink' : ''}`}>
                  {output}
                </p>

                {isProcessing && <Thinking/>}
              </div>
            )}
          </div>
        </Panel>

        {/* INPUT PANEL */}
        <Panel className="input-panel">
          <div className="hud-br">
            <div className="input-row">

              {/* MIC BUTTON */}
              <button
                id="btn-record"
                className={`mic-btn ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                title={isRecording ? 'Stop' : 'Voice input'}
                style={{
                  width:42, height:42,
                  borderRadius:4, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                {isRecording ? <Stop s={13}/> : <Mic s={16}/>}
              </button>

              {/* TEXTAREA */}
              <div style={{ flex:1, position:'relative', minWidth:0 }}>
                <textarea
                  ref={textareaRef}
                  id="prompt-input"
                  placeholder="Input command or query... (Enter to send, Shift+Enter for newline)"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  style={{
                    width:'100%', borderRadius:4,
                    padding:'10px 12px',
                    lineHeight:1.6,
                    fontSize:'clamp(12px,2.5vw,13.5px)',
                  }}
                />
                {prompt.length > 0 && (
                  <span style={{
                    position:'absolute', bottom:6, right:8,
                    fontFamily:'var(--font-hud)', fontSize:9,
                    color:'rgba(0,212,255,0.25)',
                  }}>
                    {prompt.length}
                  </span>
                )}
              </div>

              {/* SEND BUTTON */}
              <button
                id="btn-send"
                className="send-btn"
                onClick={sendToCluster}
                disabled={isProcessing || !prompt.trim()}
                title="Send (Enter)"
                style={{
                  width:42, height:42, borderRadius:4, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                <Send s={15}/>
              </button>
            </div>

            {/* HINTS */}
            <div className="input-hint">
              <span className="hud-label hint-keys" style={{ fontSize:'clamp(8px,2vw,9px)' }}>
                ENTER → SEND &nbsp;|&nbsp; SHIFT+ENTER → NEW LINE
              </span>
              <span className="hud-label" style={{ fontSize:'clamp(8px,2vw,9px)', opacity:1,
                color: isProcessing ? 'var(--cyan)' : 'rgba(0,212,255,0.3)' }}>
                {isProcessing ? '⚡ DELEGATING...' : '◎ READY'}
              </span>
            </div>
          </div>
        </Panel>
      </main>

      {/* ══════════════════════════
          NODE GRID
      ══════════════════════════ */}
      <div className="node-grid">
        {NODES.map(node => (
          <div key={node.id} className={`node-card ${node.status === 'active' ? 'active' : ''}`}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <span style={{
                color: node.status === 'active' ? 'var(--green)' : 'rgba(0,212,255,0.3)',
                display:'flex',
              }}>
                {node.icon}
              </span>
              <div className={`status-dot ${node.status}`}/>
            </div>
            <p className="hud-label" style={{ fontSize:'clamp(7px,1.5vw,9px)', marginBottom:2 }}>
              {node.id}
            </p>
            <p style={{
              fontFamily:'var(--font-body)',
              fontSize:'clamp(11px,2.5vw,13px)',
              fontWeight: node.status === 'active' ? 600 : 400,
              color: node.status === 'active' ? 'var(--green)' : 'rgba(0,212,255,0.4)',
              margin:0,
            }}>
              {node.label}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
}