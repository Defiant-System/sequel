
// sequel.toolbar

{
	init() {
		// fast references
		this.els = {
			el: window.find(`div[data-area="toolbar"]`),
			display: window.find(`.display`),
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
			case "show-blank-view":
				Self.els.el.find(".toolbar-tool_").addClass("tool-disabled_");
				break;
			case "hide-blank-view":
				Self.els.el.find(".toolbar-tool_").removeClass("tool-disabled_");
				break;
			case "update-display":
				Object.keys(event.data).map(key => Self.els.display.find(`.${key}`).html(event.data[key]));
				break;
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
