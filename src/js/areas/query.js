
// sequel.start

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-input"),
			content: window.find("content"),
		};
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.start,
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
