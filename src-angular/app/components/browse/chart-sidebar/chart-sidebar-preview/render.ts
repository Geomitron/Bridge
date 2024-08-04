import { EventEmitter } from 'eventemitter3'
import _ from 'lodash'
import { Difficulty, getInstrumentType, Instrument, InstrumentType, instrumentTypes, NoteEvent, noteFlags, NoteType, noteTypes, parseChartFile } from 'scan-chart'
import { interpolate } from 'src-shared/UtilFunctions'
import * as THREE from 'three'

type ParsedChart = ReturnType<typeof parseChartFile>

const HIGHWAY_DURATION_MS = 1500
const SCALE = 0.105
const NOTE_SPAN_WIDTH = 0.95
// Sprite for 6-fret barre notes are the only sprites without a dedicated NoteType
type BARRE_TYPES = typeof BARRE1_TYPE | typeof BARRE2_TYPE | typeof BARRE3_TYPE
const BARRE1_TYPE = 99991
const BARRE2_TYPE = 99992
const BARRE3_TYPE = 99993
const barreTypes = [BARRE1_TYPE, BARRE2_TYPE, BARRE3_TYPE] as const
// Sprites for star power versions are the only sprites without a dedicated NoteFlag
const SP_FLAG = 2147483648

interface ChartPreviewEvents {
	progress: (percentComplete: number) => void
	end: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AudioContext = window.AudioContext || (window as any).webkitAudioContext

/**
 * Renders a chart preview of `parsedChart` inside `divContainer`, and plays `audioFiles` in sync with the render.
 */
export class ChartPreview {
	private eventEmitter = new EventEmitter<ChartPreviewEvents>()

	public instrumentType: InstrumentType
	private paused = true
	private scene = new THREE.Scene()
	private highwayTexture: THREE.Texture
	private camera: ChartCamera
	private renderer: ChartRenderer
	private audioManager: AudioManager | SilentAudioManager
	private notesManager: NotesManager
	static loadTextures = loadTextures

	private constructor() { }

	/**
	 * Available events:
	 * - `progress`: called every frame during playback.
	 * - `end`: called when the chart preview ends.
	 */
	on<T extends keyof ChartPreviewEvents>(event: T, listener: ChartPreviewEvents[T]) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.eventEmitter.on(event, listener as any)
	}

	/**
	 * @param chartDataPromise The `Uint8Array[]` of the audio files to be played, and the `ParsedChart` containing the notes to preview.
	 * @param instrument The instrument to play.
	 * @param difficulty The difficulty to play.
	 * @param startDelayMs The amount of time to delay the start of the audio. (can be negative)
	 * @param audioLengthMs The length of the longest audio file stem.
	 * @param divContainer The <div> element where the preview should be rendered.
	 *
	 * Will throw an exception if textures fail to load or if `audioFilesPromise` rejects.
	 */
	static async create(
		parsedChart: ParsedChart,
		textures: Awaited<ReturnType<typeof loadTextures>>,
		audioFiles: Uint8Array[],
		instrument: Instrument,
		difficulty: Difficulty,
		startDelayMs: number,
		audioLengthMs: number,
		divContainer: HTMLDivElement,
	) {
		const chartPreview = new ChartPreview()
		chartPreview.instrumentType = getInstrumentType(instrument)
		chartPreview.highwayTexture = textures.highwayTexture
		chartPreview.camera = new ChartCamera(divContainer)
		chartPreview.renderer = new ChartRenderer(divContainer)
		chartPreview.audioManager = await (AudioContext ?
			AudioManager.create(audioFiles, startDelayMs)
			: SilentAudioManager.create(startDelayMs, audioLengthMs))
		chartPreview.audioManager.on('end', () => chartPreview.eventEmitter.emit('end'))
		chartPreview.notesManager = new NotesManager(parsedChart, instrument, difficulty, chartPreview.scene, textures.noteTextures)

		chartPreview.addHighwayToScene(textures.highwayTexture)
		chartPreview.addStrikelineToScene(textures.strikelineTexture)
		divContainer.firstChild?.remove()
		divContainer.appendChild(chartPreview.renderer.domElement)

		return chartPreview
	}

	async togglePaused() {
		if (this.paused) {
			await this.audioManager.play()
			this.renderer.setAnimationLoop(() => this.animateFrame())
		} else {
			await this.audioManager.pause()
			this.renderer.setAnimationLoop(null)
		}
		this.paused = !this.paused
	}

	/**
	 * Moves the playback time to `percentComplete` of the way through the preview.
	 * @param percentComplete A number between 0 and 1 (inclusive)
	 */
	async seek(percentComplete: number) {
		await this.audioManager.seek(percentComplete)
		this.animateFrame(false)
		this.renderer.setAnimationLoop(null)
		this.paused = true
	}

	/** `volume` is a number between 0 and 1 (inclusive). May be `null` if audio isn't loaded. */
	set volume(volume: number | null) {
		this.audioManager.volume = volume
	}
	/** `volume` is a number between 0 and 1 (inclusive). May be `null` if audio isn't loaded. */
	get volume() {
		return this.audioManager.volume
	}

	get chartCurrentTimeMs() {
		return this.audioManager.chartCurrentTimeMs
	}
	get chartEndTimeMs() {
		return this.audioManager.chartEndTimeMs
	}

	/*
	 * Should be called when discarding the preview, and the preview should not be used after this is called.
	 */
	dispose() {
		this.eventEmitter.removeAllListeners()
		this.camera.dispose()
		this.renderer.setAnimationLoop(null)
		this.renderer.renderLists.dispose()
		this.renderer.dispose()
		this.renderer.forceContextLoss()
		this.audioManager.closeAudio()
	}

	private addHighwayToScene(highwayTexture: THREE.Texture) {
		const mat = new THREE.MeshBasicMaterial({ map: highwayTexture })

		const geometry = new THREE.PlaneGeometry(
			this.instrumentType === instrumentTypes.drums ? 0.9
				: this.instrumentType === instrumentTypes.sixFret ? 0.7
					: 1,
			2,
		)
		const plane = new THREE.Mesh(geometry, mat)
		plane.position.y = -0.1
		plane.renderOrder = 1

		this.scene.add(plane)
	}

	private addStrikelineToScene(strikelineTexture: THREE.Texture) {
		const material = new THREE.SpriteMaterial({
			map: strikelineTexture,
			sizeAttenuation: true,
			transparent: true,
			depthTest: false,
		})
		const aspectRatio = strikelineTexture.image.width / strikelineTexture.image.height
		const scale = this.instrumentType === instrumentTypes.sixFret ? 0.141 : 0.19
		const sprite = new THREE.Sprite(material)
		if (aspectRatio > 1) {
			// Texture is wider than it is tall
			sprite.scale.set(aspectRatio * scale, 1 * scale, 1)
		} else {
			// Texture is taller than it is wide or square
			sprite.scale.set(1 * scale, (1 / aspectRatio) * scale, 1)
		}
		sprite.position.y = -1
		sprite.renderOrder = 3

		this.scene.add(sprite)
	}

	private animateFrame(emit = true) {
		this.notesManager.updateDisplayedNotes(this.audioManager.chartCurrentTimeMs)

		// Shift highway position
		const scrollPosition = -0.9 * (this.audioManager.chartCurrentTimeMs / 1000) * (HIGHWAY_DURATION_MS / 1000)
		this.highwayTexture.offset.y = -1 * scrollPosition
		// Y position goes from -0.1 to 2-0.1

		this.renderer.render(this.scene, this.camera)

		if (emit) {
			this.eventEmitter.emit('progress', this.audioManager.chartCurrentTimeMs / this.audioManager.chartEndTimeMs)
		}
	}
}

class ChartCamera extends THREE.PerspectiveCamera {
	constructor(private divContainer: HTMLDivElement) {
		super(90, 1 / 1, 0.01, 10)
		this.position.z = 0.8
		this.position.y = -1.3
		this.rotation.x = THREE.MathUtils.degToRad(60)
		this.onResize()
		window.addEventListener('resize', this.resizeListener)
	}

	private resizeListener = () => this.onResize()
	private onResize() {
		const width = this.divContainer.offsetWidth ?? window.innerWidth
		const height = this.divContainer.offsetHeight ?? window.innerHeight
		this.aspect = width / height
		this.updateProjectionMatrix()
	}

	dispose() {
		window.removeEventListener('resize', this.resizeListener)
		this.clear()
	}
}

class ChartRenderer extends THREE.WebGLRenderer {
	constructor(private divContainer: HTMLDivElement) {
		super({
			antialias: true,
		})
		this.localClippingEnabled = true
		this.outputColorSpace = THREE.LinearSRGBColorSpace
		this.onResize()
		window.addEventListener('resize', this.resizeListener)
	}

	private resizeListener = () => this.onResize()
	private onResize() {
		const width = this.divContainer.offsetWidth ?? window.innerWidth
		const height = this.divContainer.offsetHeight ?? window.innerHeight
		this.setSize(width, height)
	}

	override dispose() {
		window.removeEventListener('resize', this.resizeListener)
		super.dispose()
	}
}

interface AudioManagerEvents {
	end: () => void
}
class AudioManager {
	private eventEmitter = new EventEmitter()

	private audioCtx = new AudioContext()
	private gainNode: GainNode | null = null
	private _volume = 0.5
	private lastSeekChartTimeMs = 0
	private lastAudioCtxCurrentTime = 0 // Necessary because audioCtx.currentTime doesn't reset to 0 on seek
	private audioLengthMs: number

	private constructor(
		private audioFiles: Uint8Array[],
		private startDelayMs: number,
	) { }

	/**
	 * @param audioFiles The `Uint8Array[]` of the audio files to be played.
	 * @param startDelayMs The amount of time to delay the start of the audio. (can be negative)
	 * @param audioLengthMs The length of the longest audio file stem.
	 */
	static async create(audioFiles: Uint8Array[], startDelayMs: number) {
		const audioManager = new AudioManager(audioFiles, startDelayMs)
		await audioManager.initAudio()
		return audioManager
	}

	/**
	 * Available events:
	 * - `end`: called when the audio playback ends.
	 */
	on<T extends keyof AudioManagerEvents>(event: T, listener: AudioManagerEvents[T]) {
		this.eventEmitter.on(event, listener)
	}

	/** `volume` is a number between 0 and 1 (inclusive) */
	set volume(volume: number) {
		this._volume = volume * volume
		if (this.gainNode) {
			this.gainNode.gain.value = this._volume
		}
	}
	/** `volume` is a number between 0 and 1 (inclusive) */
	get volume() {
		return Math.sqrt(this._volume)
	}

	/** Nonnegative number of milliseconds representing time elapsed since the chart preview start. */
	get chartCurrentTimeMs() {
		const isPaused = this.audioCtx.state === 'suspended'
		// outputLatency is not implemented in safari
		const audioLatency = (this.audioCtx.baseLatency + (this.audioCtx.outputLatency || 0)) * 1000
		const audioTimeSinceLastSeekMs = (this.audioCtx.currentTime - this.lastAudioCtxCurrentTime) * 1000
		// Note: when paused, the queued audio during the latency period is skipped and never heard.
		// The solution here is to represent that visually by jumping ahead slightly by ignoring latency when paused.
		// If this is a more significant problem, it can be fixed by seeking backward by `audioLatency`.
		return this.lastSeekChartTimeMs + audioTimeSinceLastSeekMs - (isPaused ? 0 : audioLatency)
	}

	/** Nonnegative number of milliseconds representing when the audio ends (and when the chart preview ends). */
	get chartEndTimeMs() {
		return Math.max(this.startDelayMs + this.audioLengthMs, 0)
	}

	async play() {
		if (this.audioCtx.state === 'suspended') {
			if (this.gainNode === null) {
				await this.initAudio()
			}
			await this.audioCtx.resume()
		}
	}
	async pause() {
		if (this.audioCtx.state === 'running') {
			await this.audioCtx.suspend()
		}
	}

	closeAudio() {
		this.eventEmitter.removeAllListeners()
		this.gainNode?.disconnect()
		this.audioCtx.close()
	}

	async initAudio() {
		const audioBuffers = await Promise.all(
			// Must be recreated on each seek because seek is not supported by the Web Audio API
			// TODO: use audio-decode library instead if this fails
			this.audioFiles.map(file => this.audioCtx.decodeAudioData(file.slice(0).buffer)),
		)
		this.audioLengthMs = Math.max(...audioBuffers.map(b => b.duration)) * 1000

		this.gainNode = this.audioCtx.createGain()
		this.gainNode.gain.value = this._volume
		this.gainNode.connect(this.audioCtx.destination)

		let endedCount = 0
		const audioStartOffsetSeconds = (this.lastSeekChartTimeMs - this.startDelayMs) / 1000
		for (const audioBuffer of audioBuffers) {
			const source = this.audioCtx.createBufferSource()
			source.buffer = audioBuffer
			source.onended = () => {
				endedCount++
				if (endedCount === audioBuffers.length) {
					this.eventEmitter.emit('end')
				}
			}
			source.connect(this.gainNode!)
			const when = Math.abs(Math.min(audioStartOffsetSeconds, 0))
			const offset = Math.max(audioStartOffsetSeconds, 0)
			source.start(when, offset)
		}
		this.lastAudioCtxCurrentTime = this.audioCtx.currentTime
		this.pause()
	}

	/**
	 * @param percentComplete The progress between the start and end of the preview.
	 */
	async seek(percentComplete: number) {
		await this.audioCtx.suspend()
		this.gainNode?.disconnect()
		this.gainNode = null
		const chartSeekTimeMs = percentComplete * this.chartEndTimeMs
		this.lastSeekChartTimeMs = chartSeekTimeMs
		this.lastAudioCtxCurrentTime = this.audioCtx.currentTime
	}
}

/** Used if window.AudioContext || window.webkitAudioContext is undefined. */
class SilentAudioManager {
	private eventEmitter = new EventEmitter()
	private endEventTimeout: NodeJS.Timeout | null = null

	private isPaused = true
	private lastResumeChartTimeMs: number
	private lastResumeClockTimeMs: number

	private constructor(
		private startDelayMs: number,
		private audioLengthMs: number,
	) { }

	/**
	 * @param audioFiles The `ArrayBuffer[]` of the audio files to be played.
	 * @param startDelayMs The amount of time to delay the start of the audio. (can be negative)
	 * @param audioLengthMs The length of the longest audio file stem.
	 */
	static async create(startDelayMs: number, audioLengthMs: number) {
		const audioManager = new SilentAudioManager(startDelayMs, audioLengthMs)
		await audioManager.seek(0)
		return audioManager
	}

	/**
	 * Available events:
	 * - `end`: called when the playback ends.
	 */
	on<T extends keyof AudioManagerEvents>(event: T, listener: AudioManagerEvents[T]) {
		this.eventEmitter.on(event, listener)
	}

	/** `volume` is invalid for silent playback. */
	set volume(_null: number | null) {
		return
	}
	/** `volume` is invalid for silent playback. */
	get volume() {
		return null
	}

	/** Nonnegative number of milliseconds representing time elapsed since the chart preview start. */
	get chartCurrentTimeMs() {
		if (this.isPaused) {
			return this.lastResumeChartTimeMs
		} else {
			return this.lastResumeChartTimeMs + performance.now() - this.lastResumeClockTimeMs
		}
	}
	/** Nonnegative number of milliseconds representing when the audio ends (and when the chart preview ends). */
	get chartEndTimeMs() {
		return Math.max(this.startDelayMs + this.audioLengthMs, 0)
	}

	async play() {
		if (this.lastResumeChartTimeMs >= this.chartEndTimeMs - 2) {
			this.lastResumeChartTimeMs = 0 // Restart at the end
		}
		this.lastResumeClockTimeMs = performance.now()
		this.endEventTimeout = setTimeout(() => {
			this.pause()
			this.eventEmitter.emit('end')
		}, this.chartEndTimeMs - this.lastResumeChartTimeMs)
		this.isPaused = false
	}

	async pause() {
		this.lastResumeChartTimeMs = this.chartCurrentTimeMs
		if (this.endEventTimeout) {
			clearTimeout(this.endEventTimeout)
		}
		this.isPaused = true
	}

	closeAudio() {
		this.eventEmitter.removeAllListeners()
		if (this.endEventTimeout) {
			clearTimeout(this.endEventTimeout)
		}
	}

	/**
	 * @param percentComplete The progress between the start and end of the preview.
	 */
	async seek(percentComplete: number) {
		this.lastResumeChartTimeMs = this.chartEndTimeMs * percentComplete

		if (!this.isPaused) {
			this.play()
		}
	}
}

/**
 * Handles adding/removing/moving the notes in `scene` at the given `chartCurrentTimeMs` value.
 * TODO: Potential optimization: use InstancedMesh and a custom shader to render multiple sprites in a single draw call
 */
class NotesManager {
	private noteMaterials = new Map<NoteType | BARRE_TYPES, Map<number, THREE.SpriteMaterial>>()
	private clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 1), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.9)]

	private instrumentType: InstrumentType
	private noteEvents: NoteEvent[]
	private notes: EventSequence<ParsedChart['trackData'][number]['noteEventGroups'][number][number]>
	private soloSections: EventSequence<ParsedChart['trackData'][number]['soloSections'][number]>
	private flexLanes: EventSequence<ParsedChart['trackData'][number]['flexLanes'][number]>
	private drumFreestyleSections: EventSequence<ParsedChart['trackData'][number]['drumFreestyleSections'][number]>

	private noteGroups = new Map<number, THREE.Group<THREE.Object3DEventMap>>()

	constructor(
		private chartData: ParsedChart,
		private instrument: Instrument,
		private difficulty: Difficulty,
		private scene: THREE.Scene,
		noteTextures: Map<NoteType | BARRE_TYPES, Map<number, THREE.Texture>>,
	) {
		adjustParsedChart(chartData, instrument, difficulty)
		_.values(noteTypes).forEach(noteType => this.noteMaterials.set(noteType, new Map()))
		barreTypes.forEach(barreType => this.noteMaterials.set(barreType, new Map()))
		noteTextures.forEach((flagTextures, noteType) => {
			flagTextures.forEach((texture, noteFlags) => {
				this.noteMaterials.get(noteType)!.set(noteFlags, new THREE.SpriteMaterial({ map: texture }))
			})
		})
		const track = chartData.trackData.find(t => t.instrument === instrument && t.difficulty === difficulty)!

		this.instrumentType = getInstrumentType(instrument)
		this.noteEvents = _.flatten(track.noteEventGroups)
		this.notes = new EventSequence(this.noteEvents)
		this.soloSections = new EventSequence(track.soloSections)
		this.flexLanes = new EventSequence(track.flexLanes)
		this.drumFreestyleSections = new EventSequence(track.drumFreestyleSections)
	}

	updateDisplayedNotes(chartCurrentTimeMs: number) {
		const noteStartIndex = this.notes.getEarliestActiveEventIndex(chartCurrentTimeMs)
		// TODO: render beat lines
		// TODO: const renderedSoloSections = this.soloSections.getEventRange(chartCurrentTimeMs, chartCurrentTimeMs + 1)
		// TODO: const renderedDrumRollLanes = this.drumRollLanes.getEventRange(chartCurrentTimeMs, renderEndTimeMs)
		// TODO: const renderedDrumFreestyleSections = this.drumFreestyleSections.getEventRange(chartCurrentTimeMs, renderEndTimeMs)

		const renderEndTimeMs = chartCurrentTimeMs + HIGHWAY_DURATION_MS
		let maxNoteEventIndex = noteStartIndex - 1
		for (const [noteEventIndex, sprite] of this.noteGroups) {
			if (noteEventIndex < noteStartIndex || this.noteEvents[noteEventIndex].msTime > renderEndTimeMs) {
				this.scene.remove(sprite)
				this.noteGroups.delete(noteEventIndex)
			} else {
				// TODO: update animation frame (.webp or sprite sheet?)
				sprite.position.y = interpolate(this.noteEvents[noteEventIndex].msTime, chartCurrentTimeMs, renderEndTimeMs, -1, 1)
				if (noteEventIndex > maxNoteEventIndex) {
					maxNoteEventIndex = noteEventIndex
				}
			}
		}

		for (let i = maxNoteEventIndex + 1; this.noteEvents[i] && this.noteEvents[i].msTime < renderEndTimeMs; i++) {
			const note = this.noteEvents[i]
			const noteGroup = new THREE.Group()
			const scale =
				note.type === noteTypes.kick ? 0.045
					: note.type === noteTypes.open && this.instrumentType === instrumentTypes.sixFret ? 0.04
						: SCALE
			const sprite = new THREE.Sprite(this.noteMaterials.get(note.type)!.get(note.flags)!)
			noteGroup.add(sprite)
			sprite.center = new THREE.Vector2(note.type === noteTypes.kick ? 0.62 : 0.5, note.type === noteTypes.kick ? -0.5 : 0)
			const aspectRatio = sprite.material.map!.image.width / sprite.material.map!.image.height
			sprite.scale.set(scale * aspectRatio, scale, scale)
			noteGroup.position.x = calculateNoteXOffset(this.instrumentType, note.type)
			noteGroup.position.y = interpolate(note.msTime, chartCurrentTimeMs, renderEndTimeMs, -1, 1)
			noteGroup.position.z = 0
			sprite.material.clippingPlanes = this.clippingPlanes
			sprite.material.depthTest = false
			sprite.material.transparent = true
			sprite.renderOrder = note.type === noteTypes.kick ? 1 : 4

			if (note.msLength > 0) {
				const mat = new THREE.MeshBasicMaterial({
					color: calculateColor(note.type),
					side: THREE.DoubleSide,
				})

				mat.clippingPlanes = this.clippingPlanes
				mat.depthTest = false
				mat.transparent = true
				const geometry = new THREE.PlaneGeometry(SCALE * (note.type === noteTypes.open ? 5 : 0.3), 2 * (note.msLength / HIGHWAY_DURATION_MS))
				const plane = new THREE.Mesh(geometry, mat)
				plane.position.y = 0.03 + note.msLength / HIGHWAY_DURATION_MS
				plane.renderOrder = 2

				noteGroup.add(plane)
			}

			this.noteGroups.set(i, noteGroup)
			this.scene.add(noteGroup)
		}
	}
}

class EventSequence<T extends { msTime: number; msLength: number; type?: NoteType }> {
	/** Contains the closest events before msTime, grouped by type */
	private lastPrecedingEventIndexesOfType = new Map<NoteType | undefined, number>()
	private lastPrecedingEventIndex = -1

	/** Assumes `events` are already sorted in `msTime` order. */
	constructor(private events: T[]) { }

	getEarliestActiveEventIndex(startMs: number) {
		if (this.lastPrecedingEventIndex !== -1 && startMs < this.events[this.lastPrecedingEventIndex].msTime) {
			this.lastPrecedingEventIndexesOfType = new Map<NoteType | undefined, number>()
			this.lastPrecedingEventIndex = -1
		}
		while (this.events[this.lastPrecedingEventIndex + 1] && this.events[this.lastPrecedingEventIndex + 1].msTime < startMs) {
			this.lastPrecedingEventIndexesOfType.set(this.events[this.lastPrecedingEventIndex + 1].type, this.lastPrecedingEventIndex + 1)
			this.lastPrecedingEventIndex++
		}

		let earliestActiveEventIndex: number | null = null
		for (const [, index] of this.lastPrecedingEventIndexesOfType) {
			if (this.events[index].msTime + this.events[index].msLength > startMs) {
				if (earliestActiveEventIndex === null || earliestActiveEventIndex > index) {
					earliestActiveEventIndex = index
				}
			}
		}

		return earliestActiveEventIndex === null ? this.lastPrecedingEventIndex + 1 : earliestActiveEventIndex
	}
}

async function loadTextures(instrumentType: InstrumentType) {
	const textureLoader = new THREE.TextureLoader()
	const load = (path: string) => textureLoader.loadAsync('https://static.enchor.us/' + path)

	const [highwayTexture, strikelineTexture, noteTextures] = await Promise.all([
		(async () => {
			const texture = await load('preview-highway.png')

			texture.wrapS = THREE.RepeatWrapping
			texture.wrapT = THREE.RepeatWrapping

			texture.repeat.set(1, 2)
			return texture
		})(),
		(async () => {
			switch (instrumentType) {
				case instrumentTypes.drums:
					return await load('preview-drums-strikeline.png')
				case instrumentTypes.sixFret:
					return await load('preview-6fret-strikeline.png')
				case instrumentTypes.fiveFret:
					return await load('preview-5fret-strikeline.png')
			}
		})(),
		(async () => {
			const texturePromises: { type: NoteType | BARRE_TYPES; flags: number; texture: Promise<THREE.Texture> }[] = []
			const addTexture = (type: NoteType | BARRE_TYPES, flags: number, path: string) => {
				const texture = textureLoader.loadAsync(`https://static.enchor.us/preview-${path}.webp`)
				texturePromises.push({ type, flags, texture })
				return texture
			}
			const reuseTexture = (type: NoteType | BARRE_TYPES, flags: number, texture: Promise<THREE.Texture>) => {
				texturePromises.push({ type, flags, texture })
			}

			// TODO: use VideoTexture and make all note extensions consistent
			// https://stackoverflow.com/questions/18383470/using-video-as-texture-with-three-js/77077409#77077409
			if (instrumentType === instrumentTypes.drums) {
				const colors = new Map([
					[noteTypes.redDrum, 'red'],
					[noteTypes.yellowDrum, 'yellow'],
					[noteTypes.blueDrum, 'blue'],
					[noteTypes.greenDrum, 'green'],
				])
				const dynamicFlags = new Map([
					[noteFlags.none, ''],
					[noteFlags.ghost, '-ghost'],
					[noteFlags.accent, '-accent'],
				])
				const spFlags = new Map([
					[noteFlags.none, ''],
					[SP_FLAG, '-sp'],
				])

				addTexture(noteTypes.kick, noteFlags.none, 'drums-kick')
				addTexture(noteTypes.kick, noteFlags.doubleKick, 'drums-kick')
				addTexture(noteTypes.kick, noteFlags.none | SP_FLAG, 'drums-kick-sp')
				addTexture(noteTypes.kick, noteFlags.doubleKick | SP_FLAG, 'drums-kick-sp')
				for (const [colorKey, colorName] of colors) {
					for (const [dynamicFlagKey, dynamicFlagName] of dynamicFlags) {
						for (const [spFlagKey, spFlagName] of spFlags) {
							addTexture(colorKey, spFlagKey | dynamicFlagKey | noteFlags.tom, `drums-${colorName}-tom${dynamicFlagName}${spFlagName}`)
							if (colorKey !== noteTypes.redDrum) {
								addTexture(colorKey, spFlagKey | dynamicFlagKey | noteFlags.cymbal, `drums-${colorName}-cymbal${dynamicFlagName}${spFlagName}`)
							}
						}
					}
				}
			} else if (instrumentType === instrumentTypes.sixFret) {
				const lanes = new Map<NoteType | BARRE_TYPES, string>([
					[noteTypes.open, 'open'],
					[noteTypes.black1, 'black'],
					[noteTypes.white1, 'white'],
					[BARRE1_TYPE, 'barre'],
				])
				const modifiers = new Map([
					[noteFlags.strum, '-strum'],
					[noteFlags.hopo, '-hopo'],
					[noteFlags.tap, '-tap'],
				])
				const spFlags = new Map([
					[noteFlags.none, ''],
					[SP_FLAG, '-sp'],
				])

				for (const [laneKey, laneName] of lanes) {
					for (const [modifierKey, modifierName] of modifiers) {
						for (const [spFlagKey, spFlagName] of spFlags) {
							const texturePromise = addTexture(laneKey, modifierKey | spFlagKey, `6fret-${laneName}${modifierName}${spFlagName}`)

							// Same texture used for all three lanes
							if (laneKey === noteTypes.black1) {
								reuseTexture(noteTypes.black2, modifierKey | spFlagKey, texturePromise)
								reuseTexture(noteTypes.black3, modifierKey | spFlagKey, texturePromise)
							} else if (laneKey === noteTypes.white1) {
								reuseTexture(noteTypes.white2, modifierKey | spFlagKey, texturePromise)
								reuseTexture(noteTypes.white3, modifierKey | spFlagKey, texturePromise)
							} else if (laneKey === BARRE1_TYPE) {
								reuseTexture(BARRE2_TYPE, modifierKey | spFlagKey, texturePromise)
								reuseTexture(BARRE3_TYPE, modifierKey | spFlagKey, texturePromise)
							}
						}
					}
				}
			} else if (instrumentType === instrumentTypes.fiveFret) {
				const lanes = new Map([
					[noteTypes.open, 'open'],
					[noteTypes.green, 'green'],
					[noteTypes.red, 'red'],
					[noteTypes.yellow, 'yellow'],
					[noteTypes.blue, 'blue'],
					[noteTypes.orange, 'orange'],
				])
				const modifiers = new Map([
					[noteFlags.strum, '-strum'],
					[noteFlags.hopo, '-hopo'],
					[noteFlags.tap, '-tap'],
				])
				const spFlags = new Map([
					[noteFlags.none, ''],
					[SP_FLAG, '-sp'],
				])

				for (const [laneKey, laneName] of lanes) {
					for (let [modifierKey, modifierName] of modifiers) {
						for (const [spFlagKey, spFlagName] of spFlags) {
							if (laneKey === noteTypes.open && modifierKey === noteFlags.tap) {
								modifierName = '-hopo'
								modifierKey = noteFlags.hopo
							}
							addTexture(laneKey, modifierKey | spFlagKey, `5fret-${laneName}${modifierName}${spFlagName}`)
						}
					}
				}
			}

			const textures = await Promise.all(texturePromises.map(async t => ({ type: t.type, flags: t.flags, texture: await t.texture })))

			const textureMap = new Map<NoteType | BARRE_TYPES, Map<number, THREE.Texture>>()
			_.values(noteTypes).forEach(noteType => textureMap.set(noteType, new Map()))
			barreTypes.forEach(barreType => textureMap.set(barreType, new Map()))
			for (const texture of textures) {
				textureMap.get(texture.type)!.set(texture.flags, texture.texture)
			}

			return textureMap
		})(),
	])

	return {
		highwayTexture,
		strikelineTexture,
		noteTextures,
	}
}

function adjustParsedChart(parsedChart: ParsedChart, instrument: Instrument, difficulty: Difficulty) {
	const track = parsedChart.trackData.find(t => t.instrument === instrument && t.difficulty === difficulty)!
	const starPower = track.starPowerSections

	if (starPower.length > 0) {
		let starPowerIndex = 0
		for (const noteGroup of track.noteEventGroups) {
			while (starPowerIndex < starPower.length && starPower[starPowerIndex].tick + starPower[starPowerIndex].length < noteGroup[0].tick) {
				starPowerIndex++
			}
			if (starPowerIndex === starPower.length) {
				break
			}
			if (
				noteGroup[0].tick >= starPower[starPowerIndex].tick &&
				noteGroup[0].tick < starPower[starPowerIndex].tick + starPower[starPowerIndex].length
			) {
				for (const note of noteGroup) {
					note.flags |= SP_FLAG
				}
			}
		}
	}

	if (getInstrumentType(instrument) === instrumentTypes.sixFret) {
		for (const noteGroup of track.noteEventGroups) {
			let oneCount = 0
			let twoCount = 0
			let threeCount = 0
			for (const note of noteGroup) {
				switch (note.type) {
					case noteTypes.black1:
					case noteTypes.white1:
						oneCount++
						break
					case noteTypes.black2:
					case noteTypes.white2:
						twoCount++
						break
					case noteTypes.black3:
					case noteTypes.white3:
						threeCount++
						break
				}
			}
			if (oneCount > 1) {
				const removed = _.remove(noteGroup, n => n.type === noteTypes.black1 || n.type === noteTypes.white1)
				removed[0].type = BARRE1_TYPE as NoteType
				noteGroup.push(removed[0])
			}
			if (twoCount > 1) {
				const removed = _.remove(noteGroup, n => n.type === noteTypes.black2 || n.type === noteTypes.white2)
				removed[0].type = BARRE2_TYPE as NoteType
				noteGroup.push(removed[0])
			}
			if (threeCount > 1) {
				const removed = _.remove(noteGroup, n => n.type === noteTypes.black3 || n.type === noteTypes.white3)
				removed[0].type = BARRE3_TYPE as NoteType
				noteGroup.push(removed[0])
			}
		}
	}

	return parsedChart
}

// TODO: Consider doing document.createElement('video') instead, and use webp
// class SpriteSheetTexture extends THREE.CanvasTexture {
// 	private timer: NodeJS.Timer
// 	private currentFrameIndex = 0
// 	private canvas: HTMLCanvasElement
// 	private ctx: CanvasRenderingContext2D
// 	private img = new Image()

// 	constructor(
// 		imageUrl: string,
// 		private framesX: number,
// 		framesY: number,
// 		private endFrame = framesX * framesY,
// 	) {
// 		const canvas = document.createElement('canvas')
// 		super(canvas)
// 		this.canvas = canvas
// 		this.ctx = canvas.getContext('2d')!

// 		this.img.src = imageUrl
// 		this.img.onload = () => {
// 			canvas.width = this.img.width / framesX
// 			canvas.height = this.img.height / framesY
// 			this.timer = setInterval(() => this.nextFrame(), 16.67)
// 		}
// 	}

// 	nextFrame() {
// 		this.currentFrameIndex++

// 		if (this.currentFrameIndex >= this.endFrame) {
// 			this.currentFrameIndex = 0
// 		}

// 		const x = (this.currentFrameIndex % this.framesX) * this.canvas.width
// 		const y = ((this.currentFrameIndex / this.framesX) | 0) * this.canvas.height

// 		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
// 		this.ctx.drawImage(this.img, x, y, this.canvas.width, this.canvas.height, 0, 0, this.canvas.width, this.canvas.height)

// 		this.needsUpdate = true
// 	}
// }

function calculateNoteXOffset(instrumentType: InstrumentType, noteType: NoteType) {
	const lane = calculateLane(noteType)
	const leftOffset =
		instrumentType === instrumentTypes.drums ? 0.135
			: instrumentType === instrumentTypes.sixFret && noteType !== noteTypes.open ? 0.2
				: instrumentType === instrumentTypes.sixFret && noteType === noteTypes.open ? 0.035
					: 0.035

	return leftOffset + -(NOTE_SPAN_WIDTH / 2) + SCALE + ((NOTE_SPAN_WIDTH - SCALE) / 5) * lane
}

function calculateLane(noteType: NoteType) {
	switch (noteType) {
		case noteTypes.green:
		case noteTypes.redDrum:
		case noteTypes.black1:
		case noteTypes.white1:
		case BARRE1_TYPE as NoteType:
			return 0
		case noteTypes.red:
		case noteTypes.yellowDrum:
		case noteTypes.black2:
		case noteTypes.white2:
		case BARRE2_TYPE as NoteType:
			return 1
		case noteTypes.yellow:
		case noteTypes.blueDrum:
		case noteTypes.open:
		case noteTypes.kick:
		case noteTypes.black3:
		case noteTypes.white3:
		case BARRE3_TYPE as NoteType:
			return 2
		case noteTypes.blue:
		case noteTypes.greenDrum:
			return 3
		case noteTypes.orange:
			return 4
		default:
			return 0
	}
}

function calculateColor(noteType: NoteType) {
	switch (noteType) {
		case noteTypes.green:
		case noteTypes.greenDrum:
			return '#01B11A'
		case noteTypes.red:
		case noteTypes.redDrum:
			return '#DD2214'
		case noteTypes.yellow:
		case noteTypes.yellowDrum:
			return '#DEEB52'
		case noteTypes.blue:
		case noteTypes.blueDrum:
			return '#006CAF'
		case noteTypes.open:
			return '#8A0BB5'
		case noteTypes.orange:
			return '#F8B272'
		default:
			return '#FFFFFF'
	}
}
