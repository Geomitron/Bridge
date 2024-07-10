import fs from 'fs'

const filePath = './dist/electron/src-electron/preload.js'
const newFilePath = './dist/electron/src-electron/preload.mjs'

if (fs.existsSync(filePath)) {
  fs.renameSync(filePath, newFilePath)
}
