import { api } from './api'

export async function playAudioResponse(text: string): Promise<void> {
	const arrayBuffer = await api.speech('tts', text, 'default')
	const AudioCtx =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext: typeof AudioContext })
			.webkitAudioContext
	const audioContext = new AudioCtx()
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

	await new Promise<void>((resolve, reject) => {
		const source = audioContext.createBufferSource()
		source.buffer = audioBuffer
		source.connect(audioContext.destination)
		source.onended = () => resolve()
		source.start(0)
		setTimeout(() => reject(new Error('audio playback timeout')), 30_000)
	})
}
