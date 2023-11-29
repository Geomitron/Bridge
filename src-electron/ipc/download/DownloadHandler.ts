import { Download } from '../../../src-shared/interfaces/download.interface'
import { ChartDownload } from './ChartDownload'
import { DownloadQueue } from './DownloadQueue'

const downloadQueue: DownloadQueue = new DownloadQueue()
const retryWaiting: ChartDownload[] = []

let currentDownload: ChartDownload | undefined = undefined

export async function download(data: Download) {
	switch (data.action) {
		case 'add': addDownload(data); break
		case 'retry': retryDownload(data); break
		case 'cancel': cancelDownload(data); break
	}
}

function addDownload(data: Download) {
	const filesHash = data.data!.driveData.filesHash // Note: using versionID would cause chart packs to download multiple times
	if (currentDownload?.hash === filesHash || downloadQueue.isDownloadingLink(filesHash)) {
		return
	}

	const newDownload = new ChartDownload(data.versionID, data.data!)
	addDownloadEventListeners(newDownload)
	if (currentDownload === undefined) {
		currentDownload = newDownload
		newDownload.beginDownload()
	} else {
		downloadQueue.push(newDownload)
	}
}

function retryDownload(data: Download) {
	const index = retryWaiting.findIndex(download => download.versionID === data.versionID)
	if (index !== -1) {
		const retryDownload = retryWaiting.splice(index, 1)[0]
		retryDownload.displayRetrying()
		if (currentDownload === undefined) {
			currentDownload = retryDownload
			retryDownload.retry()
		} else {
			downloadQueue.push(retryDownload)
		}
	}
}

function cancelDownload(data: Download) {
	if (currentDownload?.versionID === data.versionID) {
		currentDownload.cancel()
		currentDownload = undefined
		startNextDownload()
	} else {
		downloadQueue.remove(data.versionID)
	}
}

function addDownloadEventListeners(download: ChartDownload) {
	download.on('complete', () => {
		currentDownload = undefined
		startNextDownload()
	})

	download.on('error', () => {
		if (currentDownload) {
			retryWaiting.push(currentDownload)
			currentDownload = undefined
		}
		startNextDownload()
	})
}

function startNextDownload() {
	currentDownload = downloadQueue.shift()
	if (currentDownload) {
		if (currentDownload.hasFailed) {
			currentDownload.retry()
		} else {
			currentDownload.beginDownload()
		}
	}
}
