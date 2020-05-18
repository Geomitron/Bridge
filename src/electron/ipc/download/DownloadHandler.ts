import { IPCEmitHandler } from '../../shared/IPCHandler'
import { Download } from '../../shared/interfaces/download.interface'
import { ChartDownload } from './ChartDownload'
import { DownloadQueue } from './DownloadQueue'

class DownloadHandler implements IPCEmitHandler<'download'> {
  event: 'download' = 'download'

  downloadQueue: DownloadQueue = new DownloadQueue()
  currentDownload: ChartDownload = undefined
  retryWaiting: ChartDownload[] = []

  handler(data: Download) { // TODO: make sure UI can't add the same versionID more than once
    switch (data.action) {
      case 'add': this.addDownload(data); break
      case 'retry': this.retryDownload(data); break
      case 'cancel': this.cancelDownload(data); break
    }
  }

  private addDownload(data: Download) {
    const filesHash = data.data.driveData.filesHash
    if (this.currentDownload?.hash == filesHash || this.downloadQueue.isDownloadingLink(filesHash)) {
      return
    }

    const newDownload = new ChartDownload(data.versionID, data.data)
    this.addDownloadEventListeners(newDownload)
    if (this.currentDownload == undefined) {
      this.currentDownload = newDownload
      newDownload.beginDownload()
    } else {
      this.downloadQueue.push(newDownload)
    }
  }

  private retryDownload(data: Download) {
    const index = this.retryWaiting.findIndex(download => download.versionID == data.versionID)
    if (index != -1) {
      const retryDownload = this.retryWaiting.splice(index, 1)[0]
      retryDownload.displayRetrying()
      if (this.currentDownload == undefined) {
        this.currentDownload = retryDownload
        retryDownload.retry()
      } else {
        this.downloadQueue.push(retryDownload)
      }
    }
  }

  private cancelDownload(data: Download) {
    if (this.currentDownload?.versionID == data.versionID) {
      this.currentDownload.cancel()
      this.currentDownload = undefined
      this.startNextDownload()
    } else {
      this.downloadQueue.remove(data.versionID)
    }
  }

  private addDownloadEventListeners(download: ChartDownload) {
    download.on('complete', () => {
      this.currentDownload = undefined
      this.startNextDownload()
    })

    download.on('error', () => {
      this.retryWaiting.push(this.currentDownload)
      this.currentDownload = undefined
      this.startNextDownload()
    })
  }

  private startNextDownload() {
    if (!this.downloadQueue.isEmpty()) {
      this.currentDownload = this.downloadQueue.shift()
      if (this.currentDownload.hasFailed) {
        this.currentDownload.retry()
      } else {
        this.currentDownload.beginDownload()
      }
    }
  }
}

export const downloadHandler = new DownloadHandler()