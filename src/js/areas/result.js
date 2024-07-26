
// sequel.result

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-result"),
			layout: window.find("layout"),
		};
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.result,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "some-event":
				break;
		}
	}
}
