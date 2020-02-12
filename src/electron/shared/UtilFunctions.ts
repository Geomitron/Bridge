let sanitize = require('sanitize-filename')

/**
 * @returns A random UUID
 */
export function generateUUID() { // Public Domain/MIT
  var d = new Date().getTime()//Timestamp
  var d2 = Date.now() // Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16//random number between 0 and 16
    if (d > 0) {//Use timestamp until depleted
      r = (d + r) % 16 | 0
      d = Math.floor(d / 16)
    } else {//Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0
      d2 = Math.floor(d2 / 16)
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

/**
   * Sanitizes a filename of any characters that cannot be part of a windows filename.
   * @param filename The name of the file to sanitize.
   */
export function sanitizeFilename(filename: string): string {
  const newName = sanitize(filename, {
    replacement: ((invalidChar: string) => {
      switch (invalidChar) {
        case '/': return '-'
        case '\\': return '-'
        case '"': return "'"
        default: return '_' //TODO: add more cases for replacing invalid characters
      }
    })
  })
  return newName
}

/**
 * Converts <val> from the range (<fromA>, <fromB>) to the range (<toA>, <toB>).
 */
export function interpolate(val: number, fromA: number, fromB: number, toA: number, toB: number) {
  return ((val - fromA) / (fromB - fromA)) * (toB - toA) + toA
}

/**
 * Splits <objectList> into multiple arrays, grouping by matching <key> values.
 * @param objectList A list of objects.
 * @param key A key from the list of objects.
 */
export function groupBy<T>(objectList: T[], key: keyof T) {
  const results: T[][] = []
  for (const object of objectList) {
    const matchingGroup = results.find(result => result[0][key] == object[key])
    if (matchingGroup != undefined) {
      matchingGroup.push(object)
    } else {
      results.push([object])
    }
  }

  return results
}