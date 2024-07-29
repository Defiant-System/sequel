
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

				try {
					result = APP.activeFile.database.execute(value);
				} catch (e) {
					result = {
						columns: ["SQLite3Error"],
						values: [e.toString().slice(28).split("\n")],
					}
				}

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

				// render blank view
				window.render({
					template: "query-result",
					match: `//Result`,
					target: Self.els.el
				});
				break;
		}
	}
}
