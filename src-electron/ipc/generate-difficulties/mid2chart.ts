/*
	This is a re-implementation of a decompiled version of chart2mid2chart in TypeScript using midi-file.
	The original version in Java is available at http://fretsonfire.wikidot.com/converting-scorehero-charts.
	It did not include a license or original author.
*/

import { parseMidi, type MidiEvent } from "midi-file"

const STANDARD_EVENTS = [
	"[idle]",
	"[play]",
	"[solo_on]",
	"[solo_off]",
	"[wail_on]",
	"[wail_off]",
	"[ow_face_on]",
	"[ow_face_off]",
	"[half_tempo]",
	"[normal_tempo]",
]

const TRACK_0_EVENTS = [
	"[lighting (chase)]",
	"[lighting (strobe)]",
	"[lighting (color1)]",
	"[lighting (color2)]",
	"[lighting (sweep)]",
	"[crowd_lighters_fast]",
	"[crowd_lighters_off]",
	"[crowd_lighters_slow]",
	"[crowd_half_tempo]",
	"[crowd_normal_tempo]",
	"[crowd_double_tempo]",
	"[band_jump]",
	"[sync_head_bang]",
	"[sync_wag]",
	"[lighting ()]",
	"[lighting (flare)]",
	"[lighting (blackout)]",
	"[music_start]",
	"[verse]",
	"[chorus]",
	"[solo]",
	"[end]",
]

export interface Mid2ChartOptions {
	placeholderName: string
	omitEmptySections: boolean
}

const defaultOptions: Required<Mid2ChartOptions> = {
	placeholderName: "Chart",
	omitEmptySections: true,
}

// TODO tidy up this mess once we've got a test suite in place
export function mid2Chart(
	buf: ArrayBuffer,
	optionsIn?: Mid2ChartOptions
): string {
	const options: Required<Mid2ChartOptions> = {
		...defaultOptions,
		...optionsIn,
	}

	let XSingle = "[ExpertSingle]\n{\n"
	let HSingle = "[HardSingle]\n{\n"
	let MSingle = "[MediumSingle]\n{\n"
	let ESingle = "[EasySingle]\n{\n"
	let Sync = ""
	let Events = "[Events]\n{\n"
	let XLead = "[ExpertDoubleGuitar]\n{\n"
	let HLead = "[HardDoubleGuitar]\n{\n"
	let MLead = "[MediumDoubleGuitar]\n{\n"
	let ELead = "[EasyDoubleGuitar]\n{\n"
	let XBass = "[ExpertDoubleBass]\n{\n"
	let HBass = "[HardDoubleBass]\n{\n"
	let MBass = "[MediumDoubleBass]\n{\n"
	let EBass = "[EasyDoubleBass]\n{\n"
	let XDrums = "[ExpertDrums]\n{\n"
	let HDrums = "[HardDrums]\n{\n"
	let MDrums = "[MediumDrums]\n{\n"
	let EDrums = "[EasyDrums]\n{\n"
	let Header = "[Song]\n{\n"
	let scaler = 0
	let chartName = options.placeholderName
	let coop = "bass"
	let valid = true
	let hasEvents = false

	const writeEventLine = (sec: number, tick: number, event: string): void => {
		let e = event
		if (sec == 4) {
			e = '"' + event + '"'
		}

		const line = "\t" + tick + " = E " + e + "\n"
		if (sec == 4) {
			Events += line
		} else if (sec == 0) {
			XSingle += line
			HSingle += line
			MSingle += line
			ESingle += line
		} else if (sec == 1) {
			XLead += line
			HLead += line
			MLead += line
			ELead += line
		} else if (sec == 3) {
			XBass += line
			HBass += line
			MBass += line
			EBass += line
		}
	}

	const writeNoteLine = (
		section: number,
		tick: number,
		note: number,
		sustain: number
	): void => {
		const n = note % 12
		let line = ""
		if (n >= 0 && n <= 4) {
			line = "\t" + tick + " = N " + n + " " + sustain + "\n"
		} else if (n == 7) {
			line = "\t" + tick + " = S 2 " + sustain + "\n"
		} else if (n == 9) {
			line = "\t" + tick + " = S 0 " + sustain + "\n"
		} else if (n == 10) {
			line = "\t" + tick + " = S 1 " + sustain + "\n"
		} else {
			return
		}
		let diff = ""
		if (note >= 60) diff = "Easy"
		if (note >= 72) diff = "Medium"
		if (note >= 84) diff = "Hard"
		if (note >= 96) diff = "Expert"
		if (diff === "Expert") {
			if (section == 0) {
				XSingle += line
			} else if (section == 1) {
				XLead += line
			} else if (section == 3) {
				XBass += line
			} else if (section == 5) {
				XDrums += line
			}
		} else if (diff === "Hard") {
			if (section == 0) {
				HSingle += line
			} else if (section == 1) {
				HLead += line
			} else if (section == 3) {
				HBass += line
			} else if (section == 5) {
				HDrums += line
			}
		} else if (diff === "Medium") {
			if (section == 0) {
				MSingle += line
			} else if (section == 1) {
				MLead += line
			} else if (section == 3) {
				MBass += line
			} else if (section == 5) {
				MDrums += line
			}
		} else if (diff === "Easy") {
			if (section == 0) {
				ESingle += line
			} else if (section == 1) {
				ELead += line
			} else if (section == 3) {
				EBass += line
			} else if (section == 5) {
				EDrums += line
			}
		}
	}

	const writeSync = (track: MidiEvent[]): void => {
		Sync += "[SyncTrack]\n{\n"
		let tick = 0
		let event: MidiEvent
		for (let i = 0; i < track.length; i++) {
			tick += Math.round(track[i].deltaTime * scaler)
			event = track[i]
			if (event.type === "trackName") {
				chartName = '"' + event.text + '"'
			} else if (event.type === "setTempo") {
				const mpq = event.microsecondsPerBeat
				const bpm = Math.floor((6.0e7 / mpq) * 1000.0)
				Sync += "\t" + tick + " = B " + bpm + "\n"
			} else if (event.type == "timeSignature") {
				// take the sqrt of the denominator since chart formats store the denominator as an exponent of 2
				Sync += `\t${tick} = TS ${event.numerator} ${Math.sqrt(
					event.denominator
				)}\n`
			} else if (event.type == "marker" && !hasEvents) {
				writeEventLine(4, tick, "section " + event.text)
			}
		}
		Sync += "}\n"
	}

	const writeNoteSection = (track: MidiEvent[], sec: number): void => {
		const skip = Array.from({ length: track.length }, () => false)
		const isEvents = track.some(
			a => a.type === "trackName" && a.text === "EVENTS"
		)
		let i
		let tick = 0
		for (i = 0; i < track.length; i++) {
			if (!skip[i]) {
				const event = track[i]
				tick += Math.round(track[i].deltaTime * scaler)
				if (event.type === "noteOn") {
					const note = event.noteNumber
					let off = -1
					let j = i + 1
					let jtick = tick
					while (off < 0 && j != track.length) {
						const e = track[j]
						jtick += Math.round(e.deltaTime * scaler)
						if (e.type === "noteOn" || e.type === "noteOff") {
							if (e.noteNumber === note) {
								off = jtick
								if (e.type === "noteOn") {
									skip[j] = true
								}
							}
						}
						j++
					}
					let sustain = off - tick
					if (sustain < 96) {
						sustain = 0
					}
					writeNoteLine(sec, tick, note, sustain)
				} else if (isEvents && event.type === "text") {
					const validEvents = sec - 4 === 0 ? TRACK_0_EVENTS : STANDARD_EVENTS
					const text = event.text
					if (validEvents.includes(text) || text.includes("[section ")) {
						writeEventLine(sec, tick, event.text.substring(1, text.length - 1))
					}
				}
			}
		}
	}

	const main = (): void => {
		//let notices = "";
		const midi = parseMidi(new Uint8Array(buf))
		const trackArr = midi.tracks
		let named = false
		let j = 0
		let name = ""
		let i
		for (i = 0; i < trackArr.length; i++) {
			const track = trackArr[i]
			while (!named && j < track.length) {
				const event = track[j]
				if (event.type === "trackName") {
					name = event.text
					named = true
				}
				j++
			}
			if (name === "PART GUITAR") valid = true
			if (name === "EVENTS") hasEvents = true
		}
		if (!valid) {
			throw new Error("PART GUITAR not found - cannot create chart!")
			//return notices + "PART GUITAR not found. No chart created.\n\n--------------\n";
		}
		scaler = 192.0 / midi.header.ticksPerBeat!
		//notices = notices + "NumTracks = " + trackArr.length + "\n";
		writeSync(trackArr[0])
		Header += '\tName = "' + chartName + '"\n'
		Header += "\tOffset = 0\n"
		Header += "\tResolution = 192\n"
		for (i = 1; i < trackArr.length; i++) {
			const track = trackArr[i]
			named = false
			j = 0
			name = ""
			while (!named && j < track.length) {
				const event = track[j]
				if (event.type === "trackName") {
					name = event.text
					named = true
				}
				j++
			}
			if (named) {
				if (name === "PART GUITAR") {
					writeNoteSection(track, 0)
					valid = true
				} else if (name === "PART GUITAR COOP") {
					writeNoteSection(track, 1)
				} else if (name === "PART RHYTHM") {
					coop = "rhythm"
					writeNoteSection(track, 3)
				} else if (name === "PART BASS") {
					writeNoteSection(track, 3)
				} else if (name === "EVENTS") {
					writeNoteSection(track, 4)
				} else if (name === "PART DRUMS") {
					writeNoteSection(track, 5)
				}
			} /* else {
        notices = notices + "Track " + i + " ignored.\n";
      } */
		}
		Header += "\tPlayer2 = " + coop + "\n"
		const line = "}\n"
		Header += line
		XSingle += line
		HSingle += line
		MSingle += line
		ESingle += line
		XLead += line
		HLead += line
		MLead += line
		ELead += line
		XBass += line
		HBass += line
		MBass += line
		EBass += line
		XDrums += line
		HDrums += line
		MDrums += line
		EDrums += line
		Events += line
		/*     notices = notices + "Conversion Complete!\n";
		notices = notices + "\n---------------------\n";
		return notices; */
	}

	// Perform the conversion - will throw error if failed
	main()
	// Corral parts
	const parts = [
		Header,
		Sync,
		Events,
		XSingle,
		HSingle,
		MSingle,
		ESingle,
		XLead,
		HLead,
		MLead,
		ELead,
		XBass,
		HBass,
		MBass,
		EBass,
		XDrums,
		HDrums,
		MDrums,
		EDrums,
	]
	// Optional filtering + double newline removal
	return parts
		.filter(a => {
			if (options.omitEmptySections && a.split("\n").length === 4) {
				return false
			}
			return true
		})
		.join("\n")
		.replace(/\n+/g, "\n")
}
