
// sequel.toolbar

{
	init() {
		
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.toolbar,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "toggle-sidebar":
				value = event.el.hasClass("tool-active_");
				return !value;
			case "toggle-query-view":
				value = event.el.hasClass("tool-active_");
				return !value;
		}
	}
}
