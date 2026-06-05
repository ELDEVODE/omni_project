// expo-av backed audio playback for the TTS leg of the voice pipeline.
// Production wiring plays the Int16 PCM buffer through `Audio.Sound`
// in low-latency mode. If expo-av isn't linked (e.g. dev tests) the
// play function is a no-op so the pipeline still works.

export async function playPcm(
	samples: Int16Array,
	sampleRate: number,
): Promise<void> {
	if (samples.length === 0) return
	try {
		const { Audio } = (await import('expo-av')) as {
			Audio: {
				setAudioModeAsync: (m: {
					playsInSilentModeIOS?: boolean
				}) => Promise<void>
				Sound: new (
					source: { uri: string } | number,
					initialStatus?: unknown,
				) => Promise<{
					setStatusAsync: (s: { shouldPlay: boolean }) => Promise<void>
					unloadAsync: () => Promise<void>
				}>
			}
		}

		await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })

		const wav = pcmToWav(samples, sampleRate)
		const dataUri = `data:audio/wav;base64,${arrayBufferToBase64(wav)}`

		const sound = await new Audio.Sound({ uri: dataUri })
		try {
			await sound.setStatusAsync({ shouldPlay: true })
			await new Promise<void>((resolve) => {
				const sub = sound.setStatusAsync
				void sub
				// expo-av doesn't expose a "playback ended" event on Sound in
				// all versions; sleep proportional to buffer length.
				const durationMs = Math.ceil((samples.length / sampleRate) * 1000) + 200
				setTimeout(resolve, durationMs)
			})
		} finally {
			await sound.unloadAsync()
		}
	} catch {
		// expo-av unavailable: silently skip playback
	}
}

function pcmToWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
	const buffer = new ArrayBuffer(44 + samples.length * 2)
	const view = new DataView(buffer)
	writeString(view, 0, 'RIFF')
	view.setUint32(4, 36 + samples.length * 2, true)
	writeString(view, 8, 'WAVE')
	writeString(view, 12, 'fmt ')
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, 1, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, sampleRate * 2, true)
	view.setUint16(32, 2, true)
	view.setUint16(34, 16, true)
	writeString(view, 36, 'data')
	view.setUint32(40, samples.length * 2, true)
	let off = 44
	for (let i = 0; i < samples.length; i++) {
		view.setInt16(off, samples[i] ?? 0, true)
		off += 2
	}
	return buffer
}

function writeString(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i))
	}
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf)
	let bin = ''
	for (let i = 0; i < bytes.length; i++)
		bin += String.fromCharCode(bytes[i] ?? 0)
	if (typeof globalThis.btoa === 'function') return globalThis.btoa(bin)
	const nodeBuf = (
		globalThis as {
			Buffer?: {
				from: (s: string, enc: string) => { toString: (enc: string) => string }
			}
		}
	).Buffer
	if (nodeBuf) return nodeBuf.from(bin, 'binary').toString('base64')
	return ''
}
