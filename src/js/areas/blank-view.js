
// sequel.blankView

{
	init() {
		// fast references
		this.els = {
			el: window.find(".blank-view"),
			content: window.find("content"),
		};
		
		// render blank view
		window.render({
			template: "blank-view",
			match: `//Data`,
			target: this.els.el
		});
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.blankView,
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
