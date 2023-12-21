import { Pipe, PipeTransform } from '@angular/core'

import { removeStyleTags } from 'src-shared/UtilFunctions'

@Pipe({
	name: 'removeStyleTags',
})
export class RemoveStyleTagsPipe implements PipeTransform {
	transform(value: string | null): string {
		return value ? removeStyleTags(value) : 'N/A'
	}
}
