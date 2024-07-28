
// sequel.query

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-input"),
			layout: window.find("layout"),
		};
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.query,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "init-query-view":
				value = {
			        mode: "text/x-mariadb",
					indentWithTabs: true,
					smartIndent: true,
					// lineWrapping: "scroll",
					lineNumbers: true,
					matchBrackets : true,
					// scrollbarStyle: "overlay",
					extraKeys: { "Ctrl-Space": "autocomplete" },
					hintOptions: {
						tables: {
							users: ["name", "score", "birthDate"],
							countries: ["name", "population", "size"]
						}
					}
				};
				CodeMirror.fromTextArea(Self.els.el.find("textarea")[0], value)
				break;
		}
	}
}
