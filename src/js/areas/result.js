
// sequel.result

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-result"),
			layout: window.find("layout"),
		};

		// temp
		this.dispatch({ type: "execute-query" });
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.result,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "execute-query":
				// render blank view
				window.render({
					template: "query-result",
					match: `//Result`,
					target: Self.els.el
				});
				break;
		}
	}
}
