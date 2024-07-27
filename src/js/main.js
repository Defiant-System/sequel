
@import "./classes/file.js"
@import "./modules/test.js"


let {
	CodeMirror,
} = await window.fetch("~/js/bundle.js");



const sequel = {
	init() {
		// fast references
		this.content = window.find("content");

		// init all sub-objects
		Object.keys(this)
			.filter(i => typeof this[i].init === "function")
			.map(i => this[i].init(this));

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
					console.log(fHandle);
					// let file = await fHandle.open({ responseType: "text" });
					// auto add first base "tab"
					// Self.dispatch({ ...event, file, type: "tab.new" });
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
				console.log(event);
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
				Self.blankView.dispatch({ type: "hide-blank-view" });
				break;
			case "open-help":
				karaqu.shell("fs -u '~/help/index.md'");
				break;
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
	blankView: @import "areas/blank-view.js",
	sidebar: @import "areas/sidebar.js",
	query: @import "areas/query.js",
	result: @import "areas/result.js",
};

window.exports = sequel;
