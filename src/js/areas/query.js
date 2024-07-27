
// sequel.start

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-input"),
			layout: window.find("layout"),
		};

		// delayed init (!?)
		setTimeout(() => {
			let cmOptions = {
			        mode: "text/x-mariadb",
					indentWithTabs: true,
					smartIndent: true,
					lineWrapping: false,
					lineNumbers: true,
					matchBrackets : true,
					extraKeys: {"Ctrl-Space": "autocomplete"},
					hintOptions: {
						tables: {
							users: ["name", "score", "birthDate"],
							countries: ["name", "population", "size"]
						}
					}
				};
			CodeMirror.fromTextArea(this.els.el.find("textarea")[0], cmOptions);
		}, 100);
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
