
// sequel.start

{
	init() {
		// fast references
		this.els = {
			el: window.find("sidebar"),
			layout: window.find("layout"),
		};

		// render HTML
		window.render({
			template: "tree",
			match: "//Data/Sidebar",
			target: this.els.el,
		});
	},
	dispatch(event) {
		let APP = sequel,
			Self = APP.start,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// custom events
			case "render-sidebar":
				APP.activeFile.database.tables.map(name => {
					let resp = APP.activeFile.database.getTableInfo(name);
					console.log( resp );
				});
				break;
			case "click-tree":
				el = $(event.target);
				if (el[0] === event.el[0]) return;

				switch (true) {
					case el.hasClass("icon-arrow"):
						value = el.parent().data("state") === "expanded" ? "collapsed" : "expanded";
						el.parent().data({ state: value });
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
