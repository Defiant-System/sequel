
// sequel.start

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-input"),
			layout: window.find("layout"),
		};

		// window.editor = CodeMirror.fromTextArea(document.getElementById("code"), {
		// 	mode: "text/x-mariadb",
		// 	indentWithTabs: true,
		// 	smartIndent: true,
		// 	lineNumbers: true,
		// 	matchBrackets : true,
		// 	autofocus: true,
		// 	extraKeys: {"Ctrl-Space": "autocomplete"},
		// 	hintOptions: {tables: {
		// 		users: ["name", "score", "birthDate"],
		// 		countries: ["name", "population", "size"]
		// 	}}
		// });
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
