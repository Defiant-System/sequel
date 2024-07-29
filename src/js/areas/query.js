
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
			        mode: "text/x-sql",
					indentWithTabs: true,
					smartIndent: true,
					lineNumbers: true,
					matchBrackets : true,
					// scrollbarStyle: "overlay",
					extraKeys: {
						"Alt-Enter": editor => Self.dispatch({ type: "execute-query" }),
					},
					// hintOptions: {
					// 	tables: {
					// 		users: ["name", "score", "birthDate"],
					// 		countries: ["name", "population", "size"]
					// 	}
					// }
				};
				Self.editor = CodeMirror.fromTextArea(Self.els.el.find("textarea")[0], value);
				break;
			case "execute-query":
				value = Self.editor.doc.getValue();
				APP.result.dispatch({ ...event, value });
				break;
		}
	}
}
