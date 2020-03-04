import { red } from 'cli-color'
import { getRelativeFilepath } from './ElectronUtilFunctions'

// TODO: add better error reporting (through the UI)

/**
 * Displays an error message for reading files in the song folder
 */
export function failReadRelative(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to read files inside song folder (${getRelativeFilepath(filepath)}):\n${error}`)
}

/**
 * Displays an error message for reading files
 */
export function failRead(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to read files inside song folder (${filepath}):\n${error}`)
}

/**
 * Displays an error message for writing files
 */
export function failWrite(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to write to file (${getRelativeFilepath(filepath)}):\n${error}`)
}

/**
 * Displays an error message for opening files
 */
export function failOpen(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to open file (${getRelativeFilepath(filepath)}):\n${error}`)
}

/**
 * Displays an error message for deleting folders
 */
export function failDelete(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to delete folder (${getRelativeFilepath(filepath)}):\n${error}`)
}

/**
 * Displays an error message for opening text files
 */
export function failEncoding(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to read text file (${getRelativeFilepath(filepath)
  }):\nJavaScript cannot parse using the detected text encoding of (${error})`)
}

/**
 * Displays an error message for failing to parse an .ini file
 */
export function failParse(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to parse ini file (${getRelativeFilepath(filepath)}):\n${error}`)
}

/**
 * Displays an error message for processing a query
 */
export function failQuery(query: string, error: any) {
  console.error(`${red('ERROR:')} Failed to execute query:\n${query}\nWith error:\n${error}`)
}

/**
 * Displays an error message for connecting to the database
 */
export function failDatabase(error: any) {
  console.error(`${red('ERROR:')} Failed to connect to database:\n${error}`)
}

/**
 * Displays an error message for connecting to the database
 */
export function failTimeout(type: string, url: string, maxAttempts: number) {
  console.error(`${red('ERROR:')} Failed to connect to download server at (\n${url}) after ${maxAttempts} retry attempts. [type=${type}]`)
}

/**
 * Displays an error message for connecting to the database
 */
export function failResponse(statusCode: string, url: string) {
  console.error(`${red('ERROR:')} Failed to connect to download server at (\n${url}) [statusCode=${statusCode}]`)
}

/**
 * Displays an error message for processing audio files
 */
export function failFFMPEG(audioFile: string, error: any) {
  console.error(`${red('ERROR:')} Failed to process audio file (${getRelativeFilepath(audioFile)}):\n${error}`)
}

/**
 * Displays an error message for failing to create multiple threads
 */
export function failMultithread(error: any) {
  console.error(`${red('ERROR:')} Failed to create multiple threads:\n${error}`)
}

/**
 * Displays an error message for replacing files
 */
export function failReplace(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to rewrite file (${getRelativeFilepath(filepath)}):\n${error}`)
}

/**
 * Displays an error message for downloading charts
 */
export function failDownload(error: any) {
  console.error(`${red('ERROR:')} Failed to download chart:\n${error}`)
}

/**
 * Displays an error message for reading files
 */
export function failScan(filepath: string) {
  console.error(`${red('ERROR:')} The specified library folder contains no files (${filepath})`)
}

/**
 * Displays an error message for failing to unzip an archived file
 */
export function failUnzip(filepath: string, error: any) {
  console.error(`${red('ERROR:')} Failed to extract archive at (${filepath}):\n${error}`)
}