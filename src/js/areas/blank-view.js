
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
			case "new-file":
				APP.dispatch({ ...event, type: "new-file" });
				break;
			case "open-filesystem":
				APP.dispatch({ ...event, type: "open-file" });
				break;
			case "from-clipboard":
				// TODO ?
				break;
			case "select-sample":
				el = $(event.target);
				if (!el.hasClass("sample")) return;

				console.log(el);
				break;
		}
	}
}
