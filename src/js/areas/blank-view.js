
// sequel.blankView

{
	init() {
		// fast references
		this.els = {
			el: window.find(".blank-view"),
			layout: window.find("layout"),
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
			case "show-blank-view":
				Self.els.layout.removeClass("show-work-view").addClass("show-blank-view");
				// sync toolbar UI
				APP.toolbar.dispatch(event);
				break;
			case "hide-blank-view":
				Self.els.layout.removeClass("show-blank-view").addClass("show-work-view");
				// sync toolbar UI
				APP.toolbar.dispatch(event);
				break;
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
				
				// send event to APP for proxy down to spawn
				let filepath = el.data("path") + el.find("span").text();
				APP.dispatch({ ...event, type: "load-samples", samples: [filepath] });
				break;
		}
	}
}
