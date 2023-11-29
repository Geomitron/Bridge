import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router'

/**
 * This makes each route with the 'reuse' data flag persist when not in focus.
 */
@Injectable()
export class TabPersistStrategy extends RouteReuseStrategy {
	private handles: { [path: string]: DetachedRouteHandle } = {}

	shouldDetach(route: ActivatedRouteSnapshot) {
		return route.data.shouldReuse || false
	}
	store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle) {
		if (route.data.shouldReuse) {
			this.handles[route.routeConfig!.path!] = handle
		}
	}
	shouldAttach(route: ActivatedRouteSnapshot) {
		return !!route.routeConfig && !!this.handles[route.routeConfig!.path!]
	}
	retrieve(route: ActivatedRouteSnapshot) {
		if (!route.routeConfig) return null
		return this.handles[route.routeConfig!.path!]
	}
	shouldReuseRoute(future: ActivatedRouteSnapshot) {
		return future.data.shouldReuse || false
	}
}
