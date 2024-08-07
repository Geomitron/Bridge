import { Download } from '../../src-shared/interfaces/download.interface.js'
import { DownloadQueue } from './download/DownloadQueue.js'

const downloadQueue: DownloadQueue = new DownloadQueue()

export async function download(data: Download) {
	switch (data.action) {
		case 'add': downloadQueue.add(data.md5, data.hasVideoBackground!, data.chart!); break
		case 'retry': downloadQueue.retry(data.md5); break
		case 'remove': downloadQueue.remove(data.md5); break
	}
}
