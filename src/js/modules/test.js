
let Test = {
	init(APP) {
		return;

		setTimeout(() => window.find(`.leaf[data-_uid="3"] .icon-arrow`).trigger("click"), 200);

		setTimeout(() => {
			return;
// 			let value = `CREATE TABLE banan (
// 	id INTEGER primary key,
// 	name VARCHAR(50)
// );`;
			// let value = `DROP TABLE expenses;`;
			let value = `ALTER TABLE employees ADD COLUMN title;`;
			APP.query.editor.doc.setValue(value);

			setTimeout(() => APP.query.dispatch({ type: "execute-query" }), 200);
		}, 1000);

		// setTimeout(() => window.find(`.toolbar-tool_[data-click="toggle-sidebar"]`).trigger("click"), 1000);
		// setTimeout(() => window.find(`.toolbar-tool_[data-click="toggle-query-view"]`).trigger("click"), 1000);

		// setTimeout(() => {
		// 	APP.toolbar.dispatch({
		// 		type: "update-display",
		// 		data: {
		// 			dbVersion: "3.45.0",
		// 			qryRows: "10 rows",
		// 			qryTime: "2 ms",
		// 		}
		// 	});
		// }, 200);

		// setTimeout(() => APP.query.dispatch({ type: "execute-query" }), 200);
		
	}
};
