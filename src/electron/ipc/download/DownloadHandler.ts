import { IPCEmitHandler } from '../../shared/IPCHandler'
import { Download } from '../../shared/interfaces/download.interface'
import { ChartDownload } from './ChartDownload'

class DownloadHandler implements IPCEmitHandler<'download'> {
  event: 'download' = 'download'

  downloads: { [versionID: number]: ChartDownload } = {}
  downloadQueue: ChartDownload[] = []
  isGoogleDownloading = false // This is a lock controlled by only one ChartDownload at a time

  handler(data: Download) {
    if (data.action == 'add') {
      this.downloads[data.versionID] = new ChartDownload(data.versionID, data.data)
    }

    const download = this.downloads[data.versionID]

    if (data.action == 'cancel') {
      download.cancel() // Might change isGoogleDownloading and call updateQueue()
      this.downloadQueue = this.downloadQueue.filter(download => download.versionID != data.versionID)
      this.downloads[data.versionID] = undefined
    } else {
      download.setInQueue()
      this.downloadQueue.push(download) // Add, retry, or continue will re-add the download to the queue
      this.updateQueue()
    }
  }

  /**
   * Called when at least one download in the queue can potentially be started.
   */
  updateQueue() {
    this.downloadQueue.sort((cd1: ChartDownload, cd2: ChartDownload) => {
      const value1 = 100 + (99 - cd1.allFilesProgress)
      const value2 = 100 + (99 - cd2.allFilesProgress)
      return value1 - value2 // Sorts in the order to get the most downloads completed early
    })

    while (this.downloadQueue[0] != undefined && !(this.isGoogleDownloading)) {
      const nextDownload = this.downloadQueue.shift()
      nextDownload.run()
      this.isGoogleDownloading = true
    }
  }
}

export const downloadHandler = new DownloadHandler()