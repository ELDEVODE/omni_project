// React hook that pauses the QVAC consumer when the app goes to
// background and resumes it when the app comes back to the foreground.
// Calls QVAC.suspend() / QVAC.resume() via the consumer implementation.

import { useEffect, useRef } from 'react'
// `AppState` and `AppStateStatus` are exposed by react-native at
// runtime; the ambient .d.ts in this package does not declare them,
// so we look them up via the module shim.
import { AppState } from 'react-native'
import type { QVACConsumerImpl } from './consumer.ts'

type AppStateStatus = 'active' | 'background' | 'inactive' | string

export function useAppLifecycle(consumer: QVACConsumerImpl | null): void {
	const stateRef = useRef<AppStateStatus>(
		(AppState as { currentState: AppStateStatus }).currentState,
	)
	useEffect(() => {
		if (!consumer) return
		const sub = (
			AppState as unknown as {
				addEventListener: (
					event: 'change',
					listener: (next: AppStateStatus) => void,
				) => { remove: () => void }
			}
		).addEventListener('change', (next: AppStateStatus) => {
			const prev = stateRef.current ?? 'active'
			if (prev === 'active' && next.match(/inactive|background/)) {
				void consumer.suspend()
			} else if (prev.match(/inactive|background/) && next === 'active') {
				void consumer.resume()
			}
			stateRef.current = next
		})
		return () => {
			sub.remove()
		}
	}, [consumer])
}
