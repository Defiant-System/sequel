
let Test = {
	init(APP) {

		setTimeout(() => window.find(`.toolbar-tool_[data-click="toggle-sidebar"]`).trigger("click"), 1000);

		// setTimeout(() => APP.query.dispatch({ type: "execute-query" }), 200);
		
	}
};
