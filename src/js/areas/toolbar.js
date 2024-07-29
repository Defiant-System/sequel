
// sequel.toolbar

{
	init() {
		// fast references
		this.els = {
			el: window.find(`div[data-area="toolbar"]`),
		};
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
				el = (event.el || Self.els.el.find(`.toolbar-tool_[data-click="toggle-sidebar"]`));
				value = !el.hasClass("tool-active_");
				if (!event.el) el.toggleClass("tool-active_", !value);
				// forward event
				APP.sidebar.dispatch({ ...event, value });
				return value;
			case "toggle-query-view":
				el = (event.el || Self.els.el.find(`.toolbar-tool_[data-click="toggle-query-view"]`));
				value = !el.hasClass("tool-active_");
				if (!event.el) el.toggleClass("tool-active_", !value);
				// forward event
				APP.query.dispatch({ ...event, value });
				return value;
		}
	}
}
