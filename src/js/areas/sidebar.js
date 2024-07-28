
// sequel.sidebar

{
	init() {
		// fast references
		this.els = {
			el: window.find("sidebar"),
			layout: window.find("layout"),
		};
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.sidebar,
			value,
			pEl,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "render-sidebar":
				value = [];
				// file / database name
				value.push(`<i icon="file" name="${APP.activeFile._file.base}" state="expanded">`);
				value.push(`<i icon="database" name="${APP.activeFile._file.name}" state="expanded">`);
				// iterate tables
				APP.activeFile.database.tables.map(tblName => {
					value.push(`<i icon="table" name="${tblName}">`);
					// iterate table coumns
					let tbl = APP.activeFile.database.getTableInfo(tblName);
					tbl.values.map(row => {
						let [pk, name, type, cNull] = row;
						value.push(`<i leaf="end" icon="column" pk="${pk}" name="${name}" type="${type.toLowerCase()}" null="${cNull}" />`);
					});
					// close tag
					value.push(`</i>`);
				});
				// close tags
				value.push(`</i>`);
				value.push(`</i>`);
				
				// remove "old" data
				let xSidebar = window.bluePrint.selectSingleNode(`//Data/Sidebar`);
				while (xSidebar.hasChildNodes()) xSidebar.removeChild(xSidebar.firstChild);

				// insert nodes into "Data"
				$.xmlFromString(value.join("")).selectNodes(`/i`).map(xFile => xSidebar.appendChild(xFile));

				// tag all items with "uniq-id"
				xSidebar.selectNodes(`.//*`).map((x, i) => x.setAttribute("uId", i+1));

				// render HTML
				window.render({
					template: "tree",
					match: "//Data/Sidebar",
					target: Self.els.el,
				});
				break;
			case "click-tree":
				el = $(event.target);
				if (el[0] === event.el[0]) return;

				switch (true) {
					case el.hasClass("icon-arrow"):
						pEl = el.parent();
						if (pEl.data("state") === "expanded") {
							pEl.data({ state: "collapsed" });
						} else {
							let xChildren = pEl.nextAll("div:first");
							if (!xChildren.hasClass("children") || !xChildren.length) {
								// 	let uId = el.parents(".leaf:first").data("uId");
								// 	console.log("render children", uId);

								// render HTML
								window.render({
									template: "tree",
									match: `//Data/Sidebar//*[@uId="${pEl.data("uId")}"]`,
									after: pEl,
								});
							}
							pEl.data({ state: "expanded" });
						}
						break;
					case el.hasClass("name"):
						event.el.find(".active").removeClass("active");
						el.parents(".leaf:first").addClass("active");
						break;
				}

				break;
		}
	}
}
