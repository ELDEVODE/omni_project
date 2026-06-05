// Minimal ambient type declarations for the mobile package.
// Real `expo`, `react`, `react-native`, and `expo-*` types install
// alongside the full Expo dev client. These stubs are permissive
// enough to typecheck the JS layer in isolation.

declare module 'react' {
	export type ReactNode = unknown
	export type ReactElement = unknown
	export type StateUpdater<T> = (next: T | ((prev: T) => T)) => void
	export function useState<T>(initial: T | (() => T)): [T, StateUpdater<T>]
	export function useEffect(
		effect: () => void | (() => void),
		deps?: unknown[],
	): void
	export function useCallback<T extends (...args: never[]) => unknown>(
		fn: T,
		deps: unknown[],
	): T
	export function useMemo<T>(fn: () => T, deps: unknown[]): T
	export function useRef<T>(initial: T | null): { current: T | null }
	export function useContext<T>(ctx: { Provider: any } & T): T
	export function createContext<T>(defaultValue: T): { Provider: any } & T
	const React: unknown
	export default React
}

declare module 'react-native' {
  export const AppState: {
    currentState: 'active' | 'background' | 'inactive' | string
    addEventListener(
      event: 'change',
      listener: (next: 'active' | 'background' | 'inactive' | string) => void,
    ): { remove(): void }
  }
  export const StyleSheet: any
  export const View: any
  export const Text: any
  export const TextInput: any
  export const Pressable: any
  export const ScrollView: any
  export const Switch: any
  export const KeyboardAvoidingView: any
  export const ActivityIndicator: any
  export const SafeAreaView: any
  export const Platform: {
    OS: 'ios' | 'android' | 'web' | 'macos' | 'windows'
    select: <T>(opts: Record<string, T>) => T
    Version: string | number
  }
  export const NativeModules: Record<string, unknown> | undefined
  export type TextProps = Record<string, unknown> & { children?: unknown }
  export type ViewProps = Record<string, unknown> & { children?: unknown }
}

declare module 'expo-status-bar' {
	export const StatusBar: any
}

declare module 'expo-device' {
	export const osName: string | null
	export const osVersion: string | null
	export const modelName: string | null
	export const totalMemory: number | null
	export const supportedCpuArchitectures: readonly string[] | null
	export const isDevice: boolean
}

declare module 'expo-application' {
	export const applicationId: string | null
	export const applicationName: string | null
	export const nativeApplicationVersion: string | null
}

declare module 'expo-file-system' {
  export const documentDirectory: string | null
  export function getInfoAsync(path: string): Promise<{ exists: boolean }>
  export function readAsStringAsync(path: string): Promise<string>
  export function writeAsStringAsync(path: string, contents: string): Promise<void>
  export function deleteAsync(path: string, opts?: { idempotent?: boolean }): Promise<void>
}

declare module 'expo-av' {
  export const Audio: {
    requestPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }>
    setAudioModeAsync(mode: {
      allowsRecordingIOS?: boolean
      playsInSilentModeIOS?: boolean
      shouldDuckAndroid?: boolean
      staysActiveInBackground?: boolean
    }): Promise<void>
    Recording: any
    RecordingOptionsPresets: { HIGH_QUALITY: any }
    Sound: any
  }
}

declare module 'bun:test' {
	export const describe: (name: string, fn: () => void | Promise<void>) => void
	export const it: (name: string, fn: () => void | Promise<void>) => void
	export const test: (name: string, fn: () => void | Promise<void>) => void
	export const expect: any
	export const beforeEach: (fn: () => void | Promise<void>) => void
	export const afterEach: (fn: () => void | Promise<void>) => void
	export const beforeAll: (fn: () => void | Promise<void>) => void
	export const afterAll: (fn: () => void | Promise<void>) => void
	export const mock: any
}

declare module '@qvac/sdk' {
	const sdk: {
		loadModel(opts: {
			modelSrc: string
			delegate: { providerPublicKey: string; timeout?: number; fallbackToLocal?: boolean }
		}): Promise<string>
		unloadModel(modelId: string): Promise<void>
		completion(opts: {
			modelId: string
			history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
			prompt?: string
			stream?: boolean
			delegate: { providerPublicKey: string; timeout?: number; fallbackToLocal?: boolean }
		}): { events: AsyncIterable<{ type: string; text?: string }> }
		heartbeat?(opts: {
			delegate: { providerPublicKey: string; timeout?: number; fallbackToLocal?: boolean }
			timeout?: number
		}): Promise<{ rttMs: number; reachable: boolean }>
		suspend?(): Promise<void>
		resume?(): Promise<void>
	}
	export default sdk
}
