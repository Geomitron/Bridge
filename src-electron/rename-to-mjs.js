import fs from 'fs'

const filePath = './dist/electron/src-electron/preload.js'
const newFilePath = './dist/electron/src-electron/preload.mjs'

/** This is the dumbest hack I've ever implemented, but it works lol */
if (fs.existsSync(filePath)) {
	const mjsFile = fs.readFileSync(filePath).toString('utf8')
	fs.writeFileSync(newFilePath, mjsFile.replace(/export {};/, ''))
	fs.rmSync(filePath)
}
