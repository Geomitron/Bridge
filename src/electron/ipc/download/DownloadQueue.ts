import Comparators from 'comparators'
import { ChartDownload } from './ChartDownload'

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
    return this.downloadQueue.pop()
  }

  get(versionID: number) {
    return this.downloadQueue.find(download => download.versionID == versionID)
  }

  remove(versionID: number) {
    const index = this.downloadQueue.findIndex(download => download.versionID == versionID)
    if (index != -1) {
      this.downloadQueue[index].cancel()
      this.downloadQueue.splice(index, 1)
    }
  }

  private sort() { // TODO: make this order be reflected in the GUI (along with currentDownload)
    let comparator = Comparators.comparing('allFilesProgress', { reversed: true })

    const prioritizeArchives = true
    if (prioritizeArchives) {
      comparator = comparator.thenComparing('isArchive', { reversed: true })
    }

    this.downloadQueue.sort(comparator)
  }
}