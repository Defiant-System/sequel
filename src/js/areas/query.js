
// sequel.start

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-input"),
			layout: window.find("layout"),
		};

		let cmOptions = {
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
		// delayed init (!?)
		setTimeout(() => CodeMirror.fromTextArea(this.els.el.find("textarea")[0], cmOptions), 1);
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
