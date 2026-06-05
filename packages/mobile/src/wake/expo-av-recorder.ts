// expo-av backed mic recorder for the WakeListener.
//
// On iOS the UIBackgroundModes `audio` permission in app.json lets the
// app keep recording when backgrounded; on Android we use the foreground
// service permission from the manifest. The recorder is started lazily
// on first use; if expo-av is missing (e.g. dev-time bundler without
// the native module) the import errors and WakeListener will surface
// a `state=error` event so the UI can show a graceful "mic unavailable".

import {
	type Recording,
	type RecordingOptions,
	setRecordingFactory,
} from './listener.ts'

type ExpoAV = {
	Audio: {
		requestPermissionsAsync(): Promise<{
			status: 'granted' | 'denied' | 'undetermined'
		}>
		setAudioModeAsync(mode: {
			allowsRecordingIOS?: boolean
			playsInSilentModeIOS?: boolean
			shouldDuckAndroid?: boolean
			staysActiveInBackground?: boolean
		}): Promise<void>
		Recording: new (options: unknown) => ExpoAVRecording
		RecordingOptionsPresets: {
			HIGH_QUALITY: unknown
		}
	}
}

type ExpoAVRecording = {
	prepareToRecordAsync: (uri: string) => Promise<{ status: 'ok' }>
	startAsync: () => Promise<{ status: 'ok' }>
	stopAndUnloadAsync: () => Promise<{ status: 'ok' }>
	getStatusAsync: () => Promise<{
		isRecording: boolean
		metering?: number
		durationMillis: number
	}>
	setOnRecordingStatusUpdate: (
		fn: (status: {
			isRecording: boolean
			metering?: number
			durationMillis: number
		}) => void,
	) => void
	setProgressUpdateInterval: (ms: number) => void
}

let registered = false

export function registerExpoAVRecorder(): void {
	if (registered) return
	registered = true
	setRecordingFactory(async (opts) => createRecorder(opts))
}

async function createRecorder(opts: RecordingOptions): Promise<Recording> {
	let expoAV: ExpoAV
	try {
		expoAV = (await import('expo-av')) as unknown as ExpoAV
	} catch (err) {
		throw new Error(
			`expo-av is not available: ${(err as Error).message}. Rebuild the dev client and ensure the native module is linked.`,
		)
	}

	const perm = await expoAV.Audio.requestPermissionsAsync()
	if (perm.status !== 'granted') {
		throw new Error('Microphone permission denied')
	}

	await expoAV.Audio.setAudioModeAsync({
		allowsRecordingIOS: true,
		playsInSilentModeIOS: true,
		shouldDuckAndroid: true,
		staysActiveInBackground: true,
	})

	const recording = new expoAV.Audio.Recording({
		...((expoAV.Audio.RecordingOptionsPresets?.HIGH_QUALITY ?? {}) as object),
		android: {
			...(((
				expoAV.Audio.RecordingOptionsPresets?.HIGH_QUALITY as
					| Record<string, unknown>
					| undefined
			)?.android as Record<string, unknown> | undefined) ?? {}),
			extension: '.pcm',
			outputFormat: 'lpcm16' as never,
		},
		ios: {
			...(((
				expoAV.Audio.RecordingOptionsPresets?.HIGH_QUALITY as
					| Record<string, unknown>
					| undefined
			)?.ios as Record<string, unknown> | undefined) ?? {}),
			extension: '.pcm',
			outputFormat: 'lpcm16' as never,
			audioQuality: 0 as never,
			sampleRate: opts.sampleRate,
		},
	})

	await recording.prepareToRecordAsync('')
	recording.setProgressUpdateInterval(opts.frameMs)
	recording.setOnRecordingStatusUpdate((status) => {
		if (status.metering !== undefined) {
			// expo-av metering is in dB (-160..0). Convert to normalized 0..1
			// linear RMS and feed a single sample to the wake detector.
			const db = status.metering
			const linear = Math.max(0, 1 + db / 60) // -60dB → 0, 0dB → 1
			opts.onFrame(new Float32Array([linear]), opts.sampleRate)
		}
	})
	await recording.startAsync()

	let stopped = false
	return {
		stop(): void {
			if (stopped) return
			stopped = true
			void recording.stopAndUnloadAsync().catch(() => {
				// best-effort
			})
		},
	}
}
