
// sequel.result

{
	init() {
		// fast references
		this.els = {
			el: window.find(".query-result"),
			layout: window.find("layout"),
		};

		// temp
		// this.dispatch({ type: "execute-query" });
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.result,
			result,
			value,
			str,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "execute-query":
				str = [];
				value = event.value.trim();

				// start timer
				Timer.start();

				try {
					result = APP.activeFile.database.execute(value);
				} catch (e) {
					result = {
						columns: ["SQLite3Error"],
						values: [e.toString().slice(28).split("\n")],
					}
				}

				if (result === null) {
					// guessing it is operation; "CREATE", "DROP", "ALTER"
					APP.activeFile.database.gatherTables();
					APP.activeFile.database.query = "";
					// sync sidebar
					APP.sidebar.dispatch({ type: "sync-sidebar" });
					// reset result
					result = { columns: [], values: [] };
				}

				// stop timer
				let t = Timer.finish();

				APP.toolbar.dispatch({
					type: "update-display",
					data: {
						qryRows: `${result.values.length} rows`,
						qryTime: `${t} ms`,
					}
				});

				// console.log( result );
				result.values.map(row => {
					let attr = result.columns.map((k, i) => `${k}="${row[i].toString().escapeHtml()}"`);
					str.push(`<i ${attr.join(" ")}/>`);
				});
				
				// remove "old" data
				let xResult = window.bluePrint.selectSingleNode(`//Data/Result`);
				while (xResult.hasChildNodes()) xResult.removeChild(xResult.firstChild);

				// make xml
				$.xmlFromString(`<data>${str.join("")}</data>`).selectNodes(`/data/*`).map(xRow => xResult.appendChild(xRow));

				if (!str.length) {
					Self.els.el.html("");
				} else {
					// render blank view
					window.render({
						template: "query-result",
						match: `//Result`,
						target: Self.els.el
					});
				}
				break;
		}
	}
}
