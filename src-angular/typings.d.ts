import { ContextBridgeApi } from '../src-shared/interfaces/ipc.interface'

declare global {
	interface Window {
		electron: ContextBridgeApi
	}
}
