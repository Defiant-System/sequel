
// sequel.sidebar

{
	init() {
		// fast references
		this.els = {
			el: window.find("sidebar"),
			wrapper: window.find(".sidebar-wrapper"),
			layout: window.find("layout"),
		};
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.sidebar,
			xNode,
			str,
			pEl,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "render-sidebar":
				// remove "old" data
				xNode = window.bluePrint.selectSingleNode(`//Data/Sidebar`);
				while (xNode.hasChildNodes()) xNode.removeChild(xNode.firstChild);

				// insert nodes into "Data"
				str = Self.dispatch({ type: "db-to-xml-string" });
				$.xmlFromString(str).selectNodes(`/i`).map(xLeaf => xNode.appendChild(xLeaf));

				// tag all items with "uniq-id"
				xNode.selectNodes(`.//*`).map((x, i) => x.setAttribute("uId", i+1));

				// render HTML
				window.render({
					template: "tree",
					match: "//Data/Sidebar",
					target: Self.els.wrapper,
				});

				// initial DB query
				APP.query.dispatch({ type: "build-first-query" });
				break;
			case "sync-sidebar":
				// remove "old" data
				xNode = window.bluePrint.selectSingleNode(`//Data/Sidebar`);

				// "fresh" representation of DB
				str = Self.dispatch({ type: "db-to-xml-string" });
				$.xmlFromString(str).selectNodes(`//i`).map(xLeaf => console.log(xLeaf));
				
				break;
			case "db-to-xml-string":
				str = [];
				// file / database name
				str.push(`<i icon="file" name="${APP.activeFile._file.base}" state="expanded">`);
				str.push(`<i icon="database" name="${APP.activeFile._file.name}" state="expanded">`);
				// iterate tables
				APP.activeFile.database.tables.map(tblName => {
					str.push(`<i icon="table" name="${tblName}">`);
					// iterate table coumns
					let tbl = APP.activeFile.database.getTableInfo(tblName);
					tbl.values.map(row => {
						let [pk, name, type, cNull] = row;
						str.push(`<i leaf="end" icon="column" pk="${pk}" name="${name}" type="${type.toLowerCase()}" null="${cNull}" />`);
					});
					// close tag
					str.push(`</i>`);
				});
				// close tags
				str.push(`</i>`);
				str.push(`</i>`);
				return str.join("");
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
								// render HTML
								window.render({
									template: "leaf-children",
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
			case "toggle-sidebar":
				Self.els.layout.toggleClass("hide-sidebar", event.value);
				break;
		}
	}
}
