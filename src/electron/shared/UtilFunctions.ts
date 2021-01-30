import * as randomBytes from 'randombytes'
const sanitize = require('sanitize-filename')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any) => any

/**
 * @returns `filename` with all invalid filename characters replaced.
 */
export function sanitizeFilename(filename: string): string {
  const newFilename = sanitize(filename, {
    replacement: ((invalidChar: string) => {
      switch (invalidChar) {
        case '<': return '❮'
        case '>': return '❯'
        case ':': return '꞉'
        case '"': return "'"
        case '/': return '／'
        case '\\': return '⧵'
        case '|': return '⏐'
        case '?': return '？'
        case '*': return '⁎'
        default: return '_'
      }
    })
  })
  return (newFilename == '' ? randomBytes(5).toString('hex') : newFilename)
}

/**
 * Converts `val` from the range (`fromStart`, `fromEnd`) to the range (`toStart`, `toEnd`).
 */
export function interpolate(val: number, fromStart: number, fromEnd: number, toStart: number, toEnd: number) {
  return ((val - fromStart) / (fromEnd - fromStart)) * (toEnd - toStart) + toStart
}

/**
 * @returns `objectList` split into multiple groups, where each group contains objects where every one of its values in `keys` matches.
 */
export function groupBy<T>(objectList: T[], ...keys: (keyof T)[]) {
  const results: T[][] = []
  for (const object of objectList) {
    const matchingGroup = results.find(result => keys.every(key => result[0][key] == object[key]))
    if (matchingGroup != undefined) {
      matchingGroup.push(object)
    } else {
      results.push([object])
    }
  }

  return results
}