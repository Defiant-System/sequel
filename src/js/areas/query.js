
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
		console.log(event);
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
				Self.editor = Self.editor || CodeMirror.fromTextArea(Self.els.el.find("textarea")[0], value);
				break;
			case "build-first-query":
				if (!APP.activeFile.database.tables.length) return;
				// query first table available
				value = `SELECT *\n\tFROM ${APP.activeFile.database.tables[0]}\n\tLIMIT 10;\n`;
				Self.editor.doc.setValue(value);
				// auto execute query
				Self.dispatch({ type: "execute-query" });
				break;
			case "execute-query":
				value = Self.editor.doc.getValue();
				APP.result.dispatch({ ...event, value });
				break;
			case "reset-view":
				Self.editor.doc.setValue("");
				break;
			case "toggle-query-view":
				Self.els.layout.toggleClass("hide-query-view", event.value);
				break;
		}
	}
}
