
@import "./classes/file.js"
@import "./modules/timer.js"
@import "./modules/test.js"


// load bundled resources
let {
	CodeMirror,
	dumper,
	SQLite,
	sqlite3InitModule,
} = await window.fetch("~/js/bundle.js");


// initiate sql lite module
let sqlite3 = await sqlite3InitModule({
    print: console.log,
    printErr: console.error,
});


// application
const sequel = {
	init() {
		// fast references
		this.content = window.find("content");

		// init all sub-objects
		Object.keys(this)
			.filter(i => typeof this[i].init === "function")
			.map(i => this[i].init(this));

		// DB version
		this.toolbar.dispatch({
			type: "update-display",
			data: { dbVersion: sqlite3.capi.sqlite3_libversion() }
		});

		// DEV-ONLY-START
		Test.init(this);
		// DEV-ONLY-END
	},
	dispatch(event) {
		let Self = sequel,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// system events
			case "window.init":
				break;
			case "open.file":
				(event.files || [event]).map(async fHandle => {
					let responseType = fHandle.kind === "db" ? "arrayBuffer" : "text",
						file = await fHandle.open({ responseType });
					// read arraybuffer if "db"
					if (fHandle.kind === "db") file.data = new Uint8Array(file.arrayBuffer);
					Self.dispatch({ ...event, type: "prepare-file", file: new File(file) });
				});
				break;
			// custom events
			case "open-file":
				window.dialog.open({
					db: fsItem => Self.dispatch(fsItem),
					sql: fsItem => Self.dispatch(fsItem),
				});
				break;
			case "new-file":
				Self.dispatch({ ...event, type: "prepare-file", file: new File() });
				break;
			case "close-file":
				// hide blank view
				Self.blankView.dispatch({ type: "show-blank-view" });
				break;
			case "load-samples":
				// opening image file from application package
				event.samples.map(async name => {
					// forward event to app
					let file = await File.openLocal(name);
					Self.dispatch({ ...event, type: "prepare-file", isSample: true, file });
				});
				break;
			case "prepare-file":
				// save reference to file
				Self.activeFile = event.file;
				// hide blank view
				Self.blankView.dispatch({ type: "hide-blank-view" });
				// init query view
				Self.query.dispatch({ type: "init-query-view" });
				// parse tables
				Self.sidebar.dispatch({ type: "render-sidebar" });
				break;
			case "open-help":
				karaqu.shell("fs -u '~/help/index.md'");
				break;
			// proxy events
			case "execute-query":
				return Self.query.dispatch(event);
			default:
				el = event.el;
				if (!el && event.origin) el = event.origin.el;
				if (el) {
					let pEl = el.parents(`?[data-area]`);
					if (pEl.length) {
						let name = pEl.data("area");
						return Self[name].dispatch(event);
					}
				}
		}
	},
	toolbar: @import "areas/toolbar.js",
	blankView: @import "areas/blank-view.js",
	sidebar: @import "areas/sidebar.js",
	query: @import "areas/query.js",
	result: @import "areas/result.js",
};

window.exports = sequel;
