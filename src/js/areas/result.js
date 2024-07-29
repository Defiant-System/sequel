
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
				value = event.value.trim();
				result = APP.activeFile.database.execute(value);
				str = [];

				// console.log( result );
				result.values.map(row => {
					let attr = result.columns.map((k, i) => `${k}="${row[i]}"`);
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
