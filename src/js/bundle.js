
@import "./external/cm/codemirror.js"
@import "./external/cm/addon/scroll/simplescrollbars.js"
@import "./external/cm/addon/edit/matchbrackets.js"
@import "./external/cm/addon/hint/show-hint.js"
@import "./external/cm/addon/hint/sql-hint.js"
@import "./external/cm/sql.js"


import dumper from "./external/sqlite/dumper.js";
import { SQLite } from "./external/sqlite/db.js";

@import "./external/sqlite/sqlite3.js"


module.exports = {
	CodeMirror,
	dumper,
	SQLite,
	sqlite3InitModule,
};
