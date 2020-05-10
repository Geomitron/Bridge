import Comparators from 'comparators'
import { ChartDownload } from './ChartDownload'
import { emitIPCEvent } from '../../main'

export class DownloadQueue {

  downloadQueue: ChartDownload[] = []

  isEmpty() {
    return this.downloadQueue.length == 0
  }

  push(chartDownload: ChartDownload) {
    this.downloadQueue.push(chartDownload)
    this.sort()
  }

  pop() {
    return this.downloadQueue.shift()
  }

  get(versionID: number) {
    return this.downloadQueue.find(download => download.versionID == versionID)
  }

  remove(versionID: number) {
    const index = this.downloadQueue.findIndex(download => download.versionID == versionID)
    if (index != -1) {
      this.downloadQueue[index].cancel()
      this.downloadQueue.splice(index, 1)
      emitIPCEvent('queue-updated', this.downloadQueue.map(download => download.versionID))
    }
  }

  private sort() {
    let comparator = Comparators.comparing('allFilesProgress', { reversed: true })

    const prioritizeArchives = true
    if (prioritizeArchives) {
      comparator = comparator.thenComparing('isArchive', { reversed: true })
    }

    this.downloadQueue.sort(comparator)
    emitIPCEvent('queue-updated', this.downloadQueue.map(download => download.versionID))
  }
}