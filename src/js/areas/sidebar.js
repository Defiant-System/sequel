
// sequel.start

{
	init() {
		// fast references
		this.els = {
			el: window.find("sidebar"),
			layout: window.find("layout"),
		};

		// render HTML
		window.render({
			template: "tree",
			match: "//Data/Sidebar",
			target: this.els.el,
		});
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
