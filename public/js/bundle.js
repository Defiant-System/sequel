// Dumps database schema and contents into plain text formats.

const SCHEMA_SQL = `
select "name", "type", "sql"
from "sqlite_schema"
where "sql" not null
  and "type" == 'table'
order by "name"
`;

const CREATE_TABLE_PREFIX = "CREATE TABLE ";

// toSql dumps database schema and contents as SQL statements.
// Adapted from https://github.com/simonw/sqlite-dump
function toSql(database) {
    const schema = schemaToSql(database);
    if (!schema.length) {
        return "";
    }
    const tables = tablesToSql(database);
    let script = [];
    script.push("BEGIN TRANSACTION;");
    script.push("PRAGMA writable_schema=ON;");
    script.push(...schema);
    script.push(...tables);
    script.push("PRAGMA writable_schema=OFF;");
    script.push("COMMIT;");
    return script.join("\n");
}

// schemaToSql returns the database schema as SQL statements.
function schemaToSql(database) {
    let script = [];
    database.each(SCHEMA_SQL, (item) => {
        const sql = schemaItemToSql(item);
        if (sql) {
            script.push(sql);
        }
    });
    return script;
}

// schemaItemToSql returns an SQL schema statement
// for the database object.
function schemaItemToSql(item) {
    if (item.name == "sqlite_sequence") {
        return 'DELETE FROM "sqlite_sequence";';
    } else if (item.name == "sqlite_stat1") {
        return 'ANALYZE "sqlite_schema";';
    } else if (item.name.startsWith("sqlite_")) {
        return "";
    } else if (item.sql.startsWith("CREATE VIRTUAL TABLE")) {
        const qtable = item.name.replace("'", "''");
        return `INSERT INTO sqlite_schema(type,name,tbl_name,rootpage,sql)
            VALUES('table','${qtable}','${qtable}',0,'${item.sql}');`;
    } else if (item.sql.toUpperCase().startsWith(CREATE_TABLE_PREFIX)) {
        const qtable = item.sql.substr(CREATE_TABLE_PREFIX.length);
        return `CREATE TABLE IF NOT EXISTS ${qtable};`;
    } else {
        return `${item.sql};`;
    }
}

// tablesToSql returns database contents as SQL statements.
function tablesToSql(database) {
    let script = [];
    database.each(SCHEMA_SQL, (item) => {
        const sql = tableContentsToSql(database, item);
        if (sql) {
            script.push(sql);
        }
    });
    return script;
}

// tableContentsToSql returns table contents as SQL statements.
function tableContentsToSql(database, item) {
    if (
        item.name.startsWith("sqlite_") ||
        item.sql.startsWith("CREATE VIRTUAL TABLE")
    ) {
        return "";
    }
    item.nameIdent = item.name.replace('"', '""');
    let res = database.execute(`PRAGMA table_info("${item.nameIdent}")`);
    const columnNames = res.values.map((row) => row[1]);
    const valuesArr = columnNames.map((name) => {
        const col = name.replace('"', '""');
        return `'||quote("${col}")||'`;
    });
    const values = valuesArr.join(",");
    const sql = `SELECT 'INSERT INTO "${item.nameIdent}" VALUES(${values})' as stmt FROM "${item.nameIdent}";`;
    const contents = [];
    database.each(sql, (row) => {
        contents.push(`${row.stmt};`);
    });
    return contents.join("\n");
}

const Dumper = { toSql };

// Simple 32-bit integer hashcode implementation.

// string calculates a hashcode for the String value.
function string(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return hash;
}

// uint8Array calculates a hashcode for the Uint8Array value.
function uint8Array(arr) {
    let hash = 0;
    for (let i = 0; i < arr.length; i++) {
        hash = (hash << 5) - hash + arr[i];
        hash = hash & hash;
    }
    return hash;
}

const hasher = { string, uint8Array };

// SQLite database wrapper and metadata.

// default database name
const DEFAULT_NAME = "new.db";

// system queries
const QUERIES = {
    version: "select sqlite_version() as version",
    tables: `select name as "table" from sqlite_schema
      where type = 'table'
        and name not like 'sqlite_%'
        and name not like 'sqlean_%'`,
    tableContent: "select * from {} limit 10",
    tableInfo: `select
      iif(pk=1, '1', '') as pk, name, type, iif("notnull"=0, '1', '') as "null?"
      from pragma_table_info('{}')`,
};

// database messages
const MESSAGES = {
    empty: "The query returned nothing",
    executing: "Executing query...",
    invite: "Run SQL query to see the results",
    loading: "Loading database...",
};

// SQLite database wrapper.
// Wraps SQLite WASM API and calls it in the following methods:
//   - execute()
//   - each()
//   - gatherTables()
//   - calcHashcode()
// The rest of the methods are WASM-agnostic.
class SQLite {
    constructor(name, path, capi, db, query = "") {
        this.id = null;
        this.owner = null;
        this.name = name || DEFAULT_NAME;
        this.path = path;
        this.capi = capi;
        this.db = db;
        this.query = query;
        this.hashcode = 0;
        this.tables = [];
    }

    // execute runs one ore more sql queries
    // and returns the last result.
    execute(sql) {
        if (!sql) {
            // sqlite api fails when trying to execute an empty query
            return null;
        }
        this.query = sql;
        let rows = [];
        this.db.exec({
            sql: sql,
            rowMode: "object",
            resultRows: rows,
        });
        if (!rows.length) {
            return null;
        }
        const result = {
            columns: Object.getOwnPropertyNames(rows[0]),
            values: [],
        };
        for (let row of rows) {
            result.values.push(Object.values(row));
        }
        return result;
    }

    // each runs the query and invokes the callback
    // on each of the resulting rows.
    each(sql, callback) {
        this.db.exec({
            sql: sql,
            rowMode: "object",
            callback: callback,
        });
    }

    // gatherTables fills the `.tables` attribute
    // with an array of database tables and returns it.
    gatherTables() {
        let rows = [];
        this.db.exec({
            sql: QUERIES.tables,
            rowMode: "array",
            resultRows: rows,
        });
        if (!rows.length) {
            this.tables = [];
            return this.tables;
        }
        this.tables = rows.map((row) => row[0]);
        return this.tables;
    }

    // getTableInfo returns the table schema.
    getTableInfo(table) {
        const sql = QUERIES.tableInfo.replace("{}", table);
        return this.execute(sql);
    }

    // calcHashcode fills the `.hashcode` attribute
    // with the database hashcode and returns it.
    calcHashcode() {
        if (!this.tables.length) {
            // sqlite api fails when trying to export an empty database
            this.hashcode = 0;
            return 0;
        }
        const dbArr = this.capi.sqlite3_js_db_export(this.db.pointer);
        const dbHash = hasher.uint8Array(dbArr);
        const queryHash = hasher.string(this.query);
        const hash = dbHash & queryHash || dbHash || queryHash;
        this.hashcode = hash;
        return hash;
    }

    // meaningfulName returns the database name
    // if it differs from default one.
    get meaningfulName() {
        if (this.name == DEFAULT_NAME) {
            return "";
        }
        return this.name;
    }

    // ensureName changes the default name to something more meaningful.
    ensureName() {
        if (this.meaningfulName) {
            return this.meaningfulName;
        }
        if (this.tables.length) {
            this.name = this.tables[0] + ".db";
            return this.name;
        }
        if (this.id) {
            this.name = this.id.substr(0, 6) + ".db";
            return this.name;
        }
        return this.name;
    }
}

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

// This is CodeMirror (https://codemirror.net), a code editor
// implemented in JavaScript on top of the browser's DOM.
//
// You can find some technical background for some of the code below
// at http://marijnhaverbeke.nl/blog/#cm-internals .

let CodeMirror = (function (global) {
	'use strict';
	// Kludges for bugs and behavior differences that can't be feature
	// detected are enabled based on userAgent etc sniffing.
	var userAgent = navigator.userAgent;
	var platform = navigator.platform;

	var gecko = /gecko\/\d/i.test(userAgent);
	var ie_upto10 = /MSIE \d/.test(userAgent);
	var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent);
	var edge = /Edge\/(\d+)/.exec(userAgent);
	var ie = ie_upto10 || ie_11up || edge;
	var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : +(edge || ie_11up)[1]);
	var webkit = !edge && /WebKit\//.test(userAgent);
	var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent);
	var chrome = !edge && /Chrome\/(\d+)/.exec(userAgent);
	var chrome_version = chrome && +chrome[1];
	var presto = /Opera\//.test(userAgent);
	var safari = /Apple Computer/.test(navigator.vendor);
	var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent);
	var phantom = /PhantomJS/.test(userAgent);

	var ios = safari && (/Mobile\/\w+/.test(userAgent) || navigator.maxTouchPoints > 2);
	var android = /Android/.test(userAgent);
	// This is woefully incomplete. Suggestions for alternative methods welcome.
	var mobile = ios || android || /webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent);
	var mac = ios || /Mac/.test(platform);
	var chromeOS = /\bCrOS\b/.test(userAgent);
	var windows = /win/i.test(platform);

	var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/);
	if (presto_version) { presto_version = Number(presto_version[1]); }
	if (presto_version && presto_version >= 15) { presto = false; webkit = true; }
	// Some browsers use the wrong event properties to signal cmd/ctrl on OS X
	var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11));
	var captureRightClick = gecko || (ie && ie_version >= 9);

	function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*") }

	var rmClass = function(node, cls) {
		var current = node.className;
		var match = classTest(cls).exec(current);
		if (match) {
			var after = current.slice(match.index + match[0].length);
			node.className = current.slice(0, match.index) + (after ? match[1] + after : "");
		}
	};

	function removeChildren(e) {
		for (var count = e.childNodes.length; count > 0; --count)
			{ e.removeChild(e.firstChild); }
		return e
	}

	function removeChildrenAndAdd(parent, e) {
		return removeChildren(parent).appendChild(e)
	}

	function elt(tag, content, className, style) {
		var e = document.createElement(tag);
		if (className) { e.className = className; }
		if (style) { e.style.cssText = style; }
		if (typeof content == "string") { e.appendChild(document.createTextNode(content)); }
		else if (content) { for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]); } }
		return e
	}
	// wrapper for elt, which removes the elt from the accessibility tree
	function eltP(tag, content, className, style) {
		var e = elt(tag, content, className, style);
		e.setAttribute("role", "presentation");
		return e
	}

	var range;
	if (document.createRange) { range = function(node, start, end, endNode) {
		var r = document.createRange();
		r.setEnd(endNode || node, end);
		r.setStart(node, start);
		return r
	}; }
	else { range = function(node, start, end) {
		var r = document.body.createTextRange();
		try { r.moveToElementText(node.parentNode); }
		catch(e) { return r }
		r.collapse(true);
		r.moveEnd("character", end);
		r.moveStart("character", start);
		return r
	}; }

	function contains(parent, child) {
		if (child.nodeType == 3) // Android browser always returns false when child is a textnode
			{ child = child.parentNode; }
		if (parent.contains)
			{ return parent.contains(child) }
		do {
			if (child.nodeType == 11) { child = child.host; }
			if (child == parent) { return true }
		} while (child = child.parentNode)
	}

	function activeElt(rootNode) {
		// IE and Edge may throw an "Unspecified Error" when accessing document.activeElement.
		// IE < 10 will throw when accessed while the page is loading or in an iframe.
		// IE > 9 and Edge will throw when accessed in an iframe if document.body is unavailable.
		var doc = rootNode.ownerDocument || rootNode;
		var activeElement;
		try {
			activeElement = rootNode.activeElement;
		} catch(e) {
			activeElement = doc.body || null;
		}
		while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
			{ activeElement = activeElement.shadowRoot.activeElement; }
		return activeElement
	}

	function addClass(node, cls) {
		var current = node.className;
		if (!classTest(cls).test(current)) { node.className += (current ? " " : "") + cls; }
	}
	function joinClasses(a, b) {
		var as = a.split(" ");
		for (var i = 0; i < as.length; i++)
			{ if (as[i] && !classTest(as[i]).test(b)) { b += " " + as[i]; } }
		return b
	}

	var selectInput = function(node) { node.select(); };
	if (ios) // Mobile Safari apparently has a bug where select() is broken.
		{ selectInput = function(node) { node.selectionStart = 0; node.selectionEnd = node.value.length; }; }
	else if (ie) // Suppress mysterious IE10 errors
		{ selectInput = function(node) { try { node.select(); } catch(_e) {} }; }

	function doc(cm) { return cm.display.wrapper.ownerDocument }

	function root(cm) {
		return rootNode(cm.display.wrapper)
	}

	function rootNode(element) {
		// Detect modern browsers (2017+).
		return element.getRootNode ? element.getRootNode() : element.ownerDocument
	}

	function win(cm) { return doc(cm).defaultView }

	function bind(f) {
		var args = Array.prototype.slice.call(arguments, 1);
		return function(){return f.apply(null, args)}
	}

	function copyObj(obj, target, overwrite) {
		if (!target) { target = {}; }
		for (var prop in obj)
			{ if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop)))
				{ target[prop] = obj[prop]; } }
		return target
	}

	// Counts the column offset in a string, taking tabs into account.
	// Used mostly to find indentation.
	function countColumn(string, end, tabSize, startIndex, startValue) {
		if (end == null) {
			end = string.search(/[^\s\u00a0]/);
			if (end == -1) { end = string.length; }
		}
		for (var i = startIndex || 0, n = startValue || 0;;) {
			var nextTab = string.indexOf("\t", i);
			if (nextTab < 0 || nextTab >= end)
				{ return n + (end - i) }
			n += nextTab - i;
			n += tabSize - (n % tabSize);
			i = nextTab + 1;
		}
	}

	var Delayed = function() {
		this.id = null;
		this.f = null;
		this.time = 0;
		this.handler = bind(this.onTimeout, this);
	};
	Delayed.prototype.onTimeout = function (self) {
		self.id = 0;
		if (self.time <= +new Date) {
			self.f();
		} else {
			setTimeout(self.handler, self.time - +new Date);
		}
	};
	Delayed.prototype.set = function (ms, f) {
		this.f = f;
		var time = +new Date + ms;
		if (!this.id || time < this.time) {
			clearTimeout(this.id);
			this.id = setTimeout(this.handler, ms);
			this.time = time;
		}
	};

	function indexOf(array, elt) {
		for (var i = 0; i < array.length; ++i)
			{ if (array[i] == elt) { return i } }
		return -1
	}

	// Number of pixels added to scroller and sizer to hide scrollbar
	var scrollerGap = 50;

	// Returned or thrown by various protocols to signal 'I'm not
	// handling this'.
	var Pass = {toString: function(){return "CodeMirror.Pass"}};

	// Reused option objects for setSelection & friends
	var sel_dontScroll = {scroll: false}, sel_mouse = {origin: "*mouse"}, sel_move = {origin: "+move"};

	// The inverse of countColumn -- find the offset that corresponds to
	// a particular column.
	function findColumn(string, goal, tabSize) {
		for (var pos = 0, col = 0;;) {
			var nextTab = string.indexOf("\t", pos);
			if (nextTab == -1) { nextTab = string.length; }
			var skipped = nextTab - pos;
			if (nextTab == string.length || col + skipped >= goal)
				{ return pos + Math.min(skipped, goal - col) }
			col += nextTab - pos;
			col += tabSize - (col % tabSize);
			pos = nextTab + 1;
			if (col >= goal) { return pos }
		}
	}

	var spaceStrs = [""];
	function spaceStr(n) {
		while (spaceStrs.length <= n)
			{ spaceStrs.push(lst(spaceStrs) + " "); }
		return spaceStrs[n]
	}

	function lst(arr) { return arr[arr.length-1] }

	function map(array, f) {
		var out = [];
		for (var i = 0; i < array.length; i++) { out[i] = f(array[i], i); }
		return out
	}

	function insertSorted(array, value, score) {
		var pos = 0, priority = score(value);
		while (pos < array.length && score(array[pos]) <= priority) { pos++; }
		array.splice(pos, 0, value);
	}

	function nothing() {}

	function createObj(base, props) {
		var inst;
		if (Object.create) {
			inst = Object.create(base);
		} else {
			nothing.prototype = base;
			inst = new nothing();
		}
		if (props) { copyObj(props, inst); }
		return inst
	}

	var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;
	function isWordCharBasic(ch) {
		return /\w/.test(ch) || ch > "\x80" &&
			(ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
	}
	function isWordChar(ch, helper) {
		if (!helper) { return isWordCharBasic(ch) }
		if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) { return true }
		return helper.test(ch)
	}

	function isEmpty(obj) {
		for (var n in obj) { if (obj.hasOwnProperty(n) && obj[n]) { return false } }
		return true
	}

	// Extending unicode characters. A series of a non-extending char +
	// any number of extending chars is treated as a single unit as far
	// as editing and measuring is concerned. This is not fully correct,
	// since some scripts/fonts/browsers also treat other configurations
	// of code points as a group.
	var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;
	function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch) }

	// Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.
	function skipExtendingChars(str, pos, dir) {
		while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos))) { pos += dir; }
		return pos
	}

	// Returns the value from the range [`from`; `to`] that satisfies
	// `pred` and is closest to `from`. Assumes that at least `to`
	// satisfies `pred`. Supports `from` being greater than `to`.
	function findFirst(pred, from, to) {
		// At any point we are certain `to` satisfies `pred`, don't know
		// whether `from` does.
		var dir = from > to ? -1 : 1;
		for (;;) {
			if (from == to) { return from }
			var midF = (from + to) / 2, mid = dir < 0 ? Math.ceil(midF) : Math.floor(midF);
			if (mid == from) { return pred(mid) ? from : to }
			if (pred(mid)) { to = mid; }
			else { from = mid + dir; }
		}
	}

	// BIDI HELPERS

	function iterateBidiSections(order, from, to, f) {
		if (!order) { return f(from, to, "ltr", 0) }
		var found = false;
		for (var i = 0; i < order.length; ++i) {
			var part = order[i];
			if (part.from < to && part.to > from || from == to && part.to == from) {
				f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr", i);
				found = true;
			}
		}
		if (!found) { f(from, to, "ltr"); }
	}

	var bidiOther = null;
	function getBidiPartAt(order, ch, sticky) {
		var found;
		bidiOther = null;
		for (var i = 0; i < order.length; ++i) {
			var cur = order[i];
			if (cur.from < ch && cur.to > ch) { return i }
			if (cur.to == ch) {
				if (cur.from != cur.to && sticky == "before") { found = i; }
				else { bidiOther = i; }
			}
			if (cur.from == ch) {
				if (cur.from != cur.to && sticky != "before") { found = i; }
				else { bidiOther = i; }
			}
		}
		return found != null ? found : bidiOther
	}

	// Bidirectional ordering algorithm
	// See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
	// that this (partially) implements.

	// One-char codes used for character types:
	// L (L):   Left-to-Right
	// R (R):   Right-to-Left
	// r (AL):  Right-to-Left Arabic
	// 1 (EN):  European Number
	// + (ES):  European Number Separator
	// % (ET):  European Number Terminator
	// n (AN):  Arabic Number
	// , (CS):  Common Number Separator
	// m (NSM): Non-Spacing Mark
	// b (BN):  Boundary Neutral
	// s (B):   Paragraph Separator
	// t (S):   Segment Separator
	// w (WS):  Whitespace
	// N (ON):  Other Neutrals

	// Returns null if characters are ordered as they appear
	// (left-to-right), or an array of sections ({from, to, level}
	// objects) in the order in which they occur visually.
	var bidiOrdering = (function() {
		// Character types for codepoints 0 to 0xff
		var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN";
		// Character types for codepoints 0x600 to 0x6f9
		var arabicTypes = "nnnnnnNNr%%r,rNNmmmmmmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmmmnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmnNmmmmmmrrmmNmmmmrr1111111111";
		function charType(code) {
			if (code <= 0xf7) { return lowTypes.charAt(code) }
			else if (0x590 <= code && code <= 0x5f4) { return "R" }
			else if (0x600 <= code && code <= 0x6f9) { return arabicTypes.charAt(code - 0x600) }
			else if (0x6ee <= code && code <= 0x8ac) { return "r" }
			else if (0x2000 <= code && code <= 0x200b) { return "w" }
			else if (code == 0x200c) { return "b" }
			else { return "L" }
		}

		var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
		var isNeutral = /[stwN]/, isStrong = /[LRr]/, countsAsLeft = /[Lb1n]/, countsAsNum = /[1n]/;

		function BidiSpan(level, from, to) {
			this.level = level;
			this.from = from; this.to = to;
		}

		return function(str, direction) {
			var outerType = direction == "ltr" ? "L" : "R";

			if (str.length == 0 || direction == "ltr" && !bidiRE.test(str)) { return false }
			var len = str.length, types = [];
			for (var i = 0; i < len; ++i)
				{ types.push(charType(str.charCodeAt(i))); }

			// W1. Examine each non-spacing mark (NSM) in the level run, and
			// change the type of the NSM to the type of the previous
			// character. If the NSM is at the start of the level run, it will
			// get the type of sor.
			for (var i$1 = 0, prev = outerType; i$1 < len; ++i$1) {
				var type = types[i$1];
				if (type == "m") { types[i$1] = prev; }
				else { prev = type; }
			}

			// W2. Search backwards from each instance of a European number
			// until the first strong type (R, L, AL, or sor) is found. If an
			// AL is found, change the type of the European number to Arabic
			// number.
			// W3. Change all ALs to R.
			for (var i$2 = 0, cur = outerType; i$2 < len; ++i$2) {
				var type$1 = types[i$2];
				if (type$1 == "1" && cur == "r") { types[i$2] = "n"; }
				else if (isStrong.test(type$1)) { cur = type$1; if (type$1 == "r") { types[i$2] = "R"; } }
			}

			// W4. A single European separator between two European numbers
			// changes to a European number. A single common separator between
			// two numbers of the same type changes to that type.
			for (var i$3 = 1, prev$1 = types[0]; i$3 < len - 1; ++i$3) {
				var type$2 = types[i$3];
				if (type$2 == "+" && prev$1 == "1" && types[i$3+1] == "1") { types[i$3] = "1"; }
				else if (type$2 == "," && prev$1 == types[i$3+1] &&
								 (prev$1 == "1" || prev$1 == "n")) { types[i$3] = prev$1; }
				prev$1 = type$2;
			}

			// W5. A sequence of European terminators adjacent to European
			// numbers changes to all European numbers.
			// W6. Otherwise, separators and terminators change to Other
			// Neutral.
			for (var i$4 = 0; i$4 < len; ++i$4) {
				var type$3 = types[i$4];
				if (type$3 == ",") { types[i$4] = "N"; }
				else if (type$3 == "%") {
					var end = (void 0);
					for (end = i$4 + 1; end < len && types[end] == "%"; ++end) {}
					var replace = (i$4 && types[i$4-1] == "!") || (end < len && types[end] == "1") ? "1" : "N";
					for (var j = i$4; j < end; ++j) { types[j] = replace; }
					i$4 = end - 1;
				}
			}

			// W7. Search backwards from each instance of a European number
			// until the first strong type (R, L, or sor) is found. If an L is
			// found, then change the type of the European number to L.
			for (var i$5 = 0, cur$1 = outerType; i$5 < len; ++i$5) {
				var type$4 = types[i$5];
				if (cur$1 == "L" && type$4 == "1") { types[i$5] = "L"; }
				else if (isStrong.test(type$4)) { cur$1 = type$4; }
			}

			// N1. A sequence of neutrals takes the direction of the
			// surrounding strong text if the text on both sides has the same
			// direction. European and Arabic numbers act as if they were R in
			// terms of their influence on neutrals. Start-of-level-run (sor)
			// and end-of-level-run (eor) are used at level run boundaries.
			// N2. Any remaining neutrals take the embedding direction.
			for (var i$6 = 0; i$6 < len; ++i$6) {
				if (isNeutral.test(types[i$6])) {
					var end$1 = (void 0);
					for (end$1 = i$6 + 1; end$1 < len && isNeutral.test(types[end$1]); ++end$1) {}
					var before = (i$6 ? types[i$6-1] : outerType) == "L";
					var after = (end$1 < len ? types[end$1] : outerType) == "L";
					var replace$1 = before == after ? (before ? "L" : "R") : outerType;
					for (var j$1 = i$6; j$1 < end$1; ++j$1) { types[j$1] = replace$1; }
					i$6 = end$1 - 1;
				}
			}

			// Here we depart from the documented algorithm, in order to avoid
			// building up an actual levels array. Since there are only three
			// levels (0, 1, 2) in an implementation that doesn't take
			// explicit embedding into account, we can build up the order on
			// the fly, without following the level-based algorithm.
			var order = [], m;
			for (var i$7 = 0; i$7 < len;) {
				if (countsAsLeft.test(types[i$7])) {
					var start = i$7;
					for (++i$7; i$7 < len && countsAsLeft.test(types[i$7]); ++i$7) {}
					order.push(new BidiSpan(0, start, i$7));
				} else {
					var pos = i$7, at = order.length, isRTL = direction == "rtl" ? 1 : 0;
					for (++i$7; i$7 < len && types[i$7] != "L"; ++i$7) {}
					for (var j$2 = pos; j$2 < i$7;) {
						if (countsAsNum.test(types[j$2])) {
							if (pos < j$2) { order.splice(at, 0, new BidiSpan(1, pos, j$2)); at += isRTL; }
							var nstart = j$2;
							for (++j$2; j$2 < i$7 && countsAsNum.test(types[j$2]); ++j$2) {}
							order.splice(at, 0, new BidiSpan(2, nstart, j$2));
							at += isRTL;
							pos = j$2;
						} else { ++j$2; }
					}
					if (pos < i$7) { order.splice(at, 0, new BidiSpan(1, pos, i$7)); }
				}
			}
			if (direction == "ltr") {
				if (order[0].level == 1 && (m = str.match(/^\s+/))) {
					order[0].from = m[0].length;
					order.unshift(new BidiSpan(0, 0, m[0].length));
				}
				if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
					lst(order).to -= m[0].length;
					order.push(new BidiSpan(0, len - m[0].length, len));
				}
			}

			return direction == "rtl" ? order.reverse() : order
		}
	})();

	// Get the bidi ordering for the given line (and cache it). Returns
	// false for lines that are fully left-to-right, and an array of
	// BidiSpan objects otherwise.
	function getOrder(line, direction) {
		var order = line.order;
		if (order == null) { order = line.order = bidiOrdering(line.text, direction); }
		return order
	}

	// EVENT HANDLING

	// Lightweight event framework. on/off also work on DOM nodes,
	// registering native DOM handlers.

	var noHandlers = [];

	var on = function(emitter, type, f) {
		if (emitter.addEventListener) {
			emitter.addEventListener(type, f, false);
		} else if (emitter.attachEvent) {
			emitter.attachEvent("on" + type, f);
		} else {
			var map = emitter._handlers || (emitter._handlers = {});
			map[type] = (map[type] || noHandlers).concat(f);
		}
	};

	function getHandlers(emitter, type) {
		return emitter._handlers && emitter._handlers[type] || noHandlers
	}

	function off(emitter, type, f) {
		if (emitter.removeEventListener) {
			emitter.removeEventListener(type, f, false);
		} else if (emitter.detachEvent) {
			emitter.detachEvent("on" + type, f);
		} else {
			var map = emitter._handlers, arr = map && map[type];
			if (arr) {
				var index = indexOf(arr, f);
				if (index > -1)
					{ map[type] = arr.slice(0, index).concat(arr.slice(index + 1)); }
			}
		}
	}

	function signal(emitter, type /*, values...*/) {
		var handlers = getHandlers(emitter, type);
		if (!handlers.length) { return }
		var args = Array.prototype.slice.call(arguments, 2);
		for (var i = 0; i < handlers.length; ++i) { handlers[i].apply(null, args); }
	}

	// The DOM events that CodeMirror handles can be overridden by
	// registering a (non-DOM) handler on the editor for the event name,
	// and preventDefault-ing the event in that handler.
	function signalDOMEvent(cm, e, override) {
		if (typeof e == "string")
			{ e = {type: e, preventDefault: function() { this.defaultPrevented = true; }}; }
		signal(cm, override || e.type, cm, e);
		return e_defaultPrevented(e) || e.codemirrorIgnore
	}

	function signalCursorActivity(cm) {
		var arr = cm._handlers && cm._handlers.cursorActivity;
		if (!arr) { return }
		var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = []);
		for (var i = 0; i < arr.length; ++i) { if (indexOf(set, arr[i]) == -1)
			{ set.push(arr[i]); } }
	}

	function hasHandler(emitter, type) {
		return getHandlers(emitter, type).length > 0
	}

	// Add on and off methods to a constructor's prototype, to make
	// registering events on such objects more convenient.
	function eventMixin(ctor) {
		ctor.prototype.on = function(type, f) {on(this, type, f);};
		ctor.prototype.off = function(type, f) {off(this, type, f);};
	}

	// Due to the fact that we still support jurassic IE versions, some
	// compatibility wrappers are needed.

	function e_preventDefault(e) {
		if (e.preventDefault) { e.preventDefault(); }
		else { e.returnValue = false; }
	}
	function e_stopPropagation(e) {
		if (e.stopPropagation) { e.stopPropagation(); }
		else { e.cancelBubble = true; }
	}
	function e_defaultPrevented(e) {
		return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false
	}
	function e_stop(e) {e_preventDefault(e); e_stopPropagation(e);}

	function e_target(e) {return e.target || e.srcElement}
	function e_button(e) {
		var b = e.which;
		if (b == null) {
			if (e.button & 1) { b = 1; }
			else if (e.button & 2) { b = 3; }
			else if (e.button & 4) { b = 2; }
		}
		if (mac && e.ctrlKey && b == 1) { b = 3; }
		return b
	}

	// Detect drag-and-drop
	var dragAndDrop = function() {
		// There is *some* kind of drag-and-drop support in IE6-8, but I
		// couldn't get it to work yet.
		if (ie && ie_version < 9) { return false }
		var div = elt('div');
		return "draggable" in div || "dragDrop" in div
	}();

	var zwspSupported;
	function zeroWidthElement(measure) {
		if (zwspSupported == null) {
			var test = elt("span", "\u200b");
			removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]));
			if (measure.firstChild.offsetHeight != 0)
				{ zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8); }
		}
		var node = zwspSupported ? elt("span", "\u200b") :
			elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px");
		node.setAttribute("cm-text", "");
		return node
	}

	// Feature-detect IE's crummy client rect reporting for bidi text
	var badBidiRects;
	function hasBadBidiRects(measure) {
		if (badBidiRects != null) { return badBidiRects }
		var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062eA"));
		var r0 = range(txt, 0, 1).getBoundingClientRect();
		var r1 = range(txt, 1, 2).getBoundingClientRect();
		removeChildren(measure);
		if (!r0 || r0.left == r0.right) { return false } // Safari returns null in some cases (#2780)
		return badBidiRects = (r1.right - r0.right < 3)
	}

	// See if "".split is the broken IE version, if so, provide an
	// alternative way to split lines.
	var splitLinesAuto = "\n\nb".split(/\n/).length != 3 ? function (string) {
		var pos = 0, result = [], l = string.length;
		while (pos <= l) {
			var nl = string.indexOf("\n", pos);
			if (nl == -1) { nl = string.length; }
			var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
			var rt = line.indexOf("\r");
			if (rt != -1) {
				result.push(line.slice(0, rt));
				pos += rt + 1;
			} else {
				result.push(line);
				pos = nl + 1;
			}
		}
		return result
	} : function (string) { return string.split(/\r\n?|\n/); };

	var hasSelection = window.getSelection ? function (te) {
		try { return te.selectionStart != te.selectionEnd }
		catch(e) { return false }
	} : function (te) {
		var range;
		try {range = te.ownerDocument.selection.createRange();}
		catch(e) {}
		if (!range || range.parentElement() != te) { return false }
		return range.compareEndPoints("StartToEnd", range) != 0
	};

	var hasCopyEvent = (function () {
		var e = elt("div");
		if ("oncopy" in e) { return true }
		e.setAttribute("oncopy", "return;");
		return typeof e.oncopy == "function"
	})();

	var badZoomedRects = null;
	function hasBadZoomedRects(measure) {
		if (badZoomedRects != null) { return badZoomedRects }
		var node = removeChildrenAndAdd(measure, elt("span", "x"));
		var normal = node.getBoundingClientRect();
		var fromRange = range(node, 0, 1).getBoundingClientRect();
		return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1
	}

	// Known modes, by name and by MIME
	var modes = {}, mimeModes = {};

	// Extra arguments are stored as the mode's dependencies, which is
	// used by (legacy) mechanisms like loadmode.js to automatically
	// load a mode. (Preferred mechanism is the require/define calls.)
	function defineMode(name, mode) {
		if (arguments.length > 2)
			{ mode.dependencies = Array.prototype.slice.call(arguments, 2); }
		modes[name] = mode;
	}

	function defineMIME(mime, spec) {
		mimeModes[mime] = spec;
	}

	// Given a MIME type, a {name, ...options} config object, or a name
	// string, return a mode config object.
	function resolveMode(spec) {
		if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
			spec = mimeModes[spec];
		} else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
			var found = mimeModes[spec.name];
			if (typeof found == "string") { found = {name: found}; }
			spec = createObj(found, spec);
			spec.name = found.name;
		} else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
			return resolveMode("application/xml")
		} else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
			return resolveMode("application/json")
		}
		if (typeof spec == "string") { return {name: spec} }
		else { return spec || {name: "null"} }
	}

	// Given a mode spec (anything that resolveMode accepts), find and
	// initialize an actual mode object.
	function getMode(options, spec) {
		spec = resolveMode(spec);
		var mfactory = modes[spec.name];
		if (!mfactory) { return getMode(options, "text/plain") }
		var modeObj = mfactory(options, spec);
		if (modeExtensions.hasOwnProperty(spec.name)) {
			var exts = modeExtensions[spec.name];
			for (var prop in exts) {
				if (!exts.hasOwnProperty(prop)) { continue }
				if (modeObj.hasOwnProperty(prop)) { modeObj["_" + prop] = modeObj[prop]; }
				modeObj[prop] = exts[prop];
			}
		}
		modeObj.name = spec.name;
		if (spec.helperType) { modeObj.helperType = spec.helperType; }
		if (spec.modeProps) { for (var prop$1 in spec.modeProps)
			{ modeObj[prop$1] = spec.modeProps[prop$1]; } }

		return modeObj
	}

	// This can be used to attach properties to mode objects from
	// outside the actual mode definition.
	var modeExtensions = {};
	function extendMode(mode, properties) {
		var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {});
		copyObj(properties, exts);
	}

	function copyState(mode, state) {
		if (state === true) { return state }
		if (mode.copyState) { return mode.copyState(state) }
		var nstate = {};
		for (var n in state) {
			var val = state[n];
			if (val instanceof Array) { val = val.concat([]); }
			nstate[n] = val;
		}
		return nstate
	}

	// Given a mode and a state (for that mode), find the inner mode and
	// state at the position that the state refers to.
	function innerMode(mode, state) {
		var info;
		while (mode.innerMode) {
			info = mode.innerMode(state);
			if (!info || info.mode == mode) { break }
			state = info.state;
			mode = info.mode;
		}
		return info || {mode: mode, state: state}
	}

	function startState(mode, a1, a2) {
		return mode.startState ? mode.startState(a1, a2) : true
	}

	// STRING STREAM

	// Fed to the mode parsers, provides helper functions to make
	// parsers more succinct.

	var StringStream = function(string, tabSize, lineOracle) {
		this.pos = this.start = 0;
		this.string = string;
		this.tabSize = tabSize || 8;
		this.lastColumnPos = this.lastColumnValue = 0;
		this.lineStart = 0;
		this.lineOracle = lineOracle;
	};

	StringStream.prototype.eol = function () {return this.pos >= this.string.length};
	StringStream.prototype.sol = function () {return this.pos == this.lineStart};
	StringStream.prototype.peek = function () {return this.string.charAt(this.pos) || undefined};
	StringStream.prototype.next = function () {
		if (this.pos < this.string.length)
			{ return this.string.charAt(this.pos++) }
	};
	StringStream.prototype.eat = function (match) {
		var ch = this.string.charAt(this.pos);
		var ok;
		if (typeof match == "string") { ok = ch == match; }
		else { ok = ch && (match.test ? match.test(ch) : match(ch)); }
		if (ok) {++this.pos; return ch}
	};
	StringStream.prototype.eatWhile = function (match) {
		var start = this.pos;
		while (this.eat(match)){}
		return this.pos > start
	};
	StringStream.prototype.eatSpace = function () {
		var start = this.pos;
		while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) { ++this.pos; }
		return this.pos > start
	};
	StringStream.prototype.skipToEnd = function () {this.pos = this.string.length;};
	StringStream.prototype.skipTo = function (ch) {
		var found = this.string.indexOf(ch, this.pos);
		if (found > -1) {this.pos = found; return true}
	};
	StringStream.prototype.backUp = function (n) {this.pos -= n;};
	StringStream.prototype.column = function () {
		if (this.lastColumnPos < this.start) {
			this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
			this.lastColumnPos = this.start;
		}
		return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
	};
	StringStream.prototype.indentation = function () {
		return countColumn(this.string, null, this.tabSize) -
			(this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
	};
	StringStream.prototype.match = function (pattern, consume, caseInsensitive) {
		if (typeof pattern == "string") {
			var cased = function (str) { return caseInsensitive ? str.toLowerCase() : str; };
			var substr = this.string.substr(this.pos, pattern.length);
			if (cased(substr) == cased(pattern)) {
				if (consume !== false) { this.pos += pattern.length; }
				return true
			}
		} else {
			var match = this.string.slice(this.pos).match(pattern);
			if (match && match.index > 0) { return null }
			if (match && consume !== false) { this.pos += match[0].length; }
			return match
		}
	};
	StringStream.prototype.current = function (){return this.string.slice(this.start, this.pos)};
	StringStream.prototype.hideFirstChars = function (n, inner) {
		this.lineStart += n;
		try { return inner() }
		finally { this.lineStart -= n; }
	};
	StringStream.prototype.lookAhead = function (n) {
		var oracle = this.lineOracle;
		return oracle && oracle.lookAhead(n)
	};
	StringStream.prototype.baseToken = function () {
		var oracle = this.lineOracle;
		return oracle && oracle.baseToken(this.pos)
	};

	// Find the line object corresponding to the given line number.
	function getLine(doc, n) {
		n -= doc.first;
		if (n < 0 || n >= doc.size) { throw new Error("There is no line " + (n + doc.first) + " in the document.") }
		var chunk = doc;
		while (!chunk.lines) {
			for (var i = 0;; ++i) {
				var child = chunk.children[i], sz = child.chunkSize();
				if (n < sz) { chunk = child; break }
				n -= sz;
			}
		}
		return chunk.lines[n]
	}

	// Get the part of a document between two positions, as an array of
	// strings.
	function getBetween(doc, start, end) {
		var out = [], n = start.line;
		doc.iter(start.line, end.line + 1, function (line) {
			var text = line.text;
			if (n == end.line) { text = text.slice(0, end.ch); }
			if (n == start.line) { text = text.slice(start.ch); }
			out.push(text);
			++n;
		});
		return out
	}
	// Get the lines between from and to, as array of strings.
	function getLines(doc, from, to) {
		var out = [];
		doc.iter(from, to, function (line) { out.push(line.text); }); // iter aborts when callback returns truthy value
		return out
	}

	// Update the height of a line, propagating the height change
	// upwards to parent nodes.
	function updateLineHeight(line, height) {
		var diff = height - line.height;
		if (diff) { for (var n = line; n; n = n.parent) { n.height += diff; } }
	}

	// Given a line object, find its line number by walking up through
	// its parent links.
	function lineNo(line) {
		if (line.parent == null) { return null }
		var cur = line.parent, no = indexOf(cur.lines, line);
		for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
			for (var i = 0;; ++i) {
				if (chunk.children[i] == cur) { break }
				no += chunk.children[i].chunkSize();
			}
		}
		return no + cur.first
	}

	// Find the line at the given vertical position, using the height
	// information in the document tree.
	function lineAtHeight(chunk, h) {
		var n = chunk.first;
		outer: do {
			for (var i$1 = 0; i$1 < chunk.children.length; ++i$1) {
				var child = chunk.children[i$1], ch = child.height;
				if (h < ch) { chunk = child; continue outer }
				h -= ch;
				n += child.chunkSize();
			}
			return n
		} while (!chunk.lines)
		var i = 0;
		for (; i < chunk.lines.length; ++i) {
			var line = chunk.lines[i], lh = line.height;
			if (h < lh) { break }
			h -= lh;
		}
		return n + i
	}

	function isLine(doc, l) {return l >= doc.first && l < doc.first + doc.size}

	function lineNumberFor(options, i) {
		return String(options.lineNumberFormatter(i + options.firstLineNumber))
	}

	// A Pos instance represents a position within the text.
	function Pos(line, ch, sticky) {
		if ( sticky === void 0 ) sticky = null;

		if (!(this instanceof Pos)) { return new Pos(line, ch, sticky) }
		this.line = line;
		this.ch = ch;
		this.sticky = sticky;
	}

	// Compare two positions, return 0 if they are the same, a negative
	// number when a is less, and a positive number otherwise.
	function cmp(a, b) { return a.line - b.line || a.ch - b.ch }

	function equalCursorPos(a, b) { return a.sticky == b.sticky && cmp(a, b) == 0 }

	function copyPos(x) {return Pos(x.line, x.ch)}
	function maxPos(a, b) { return cmp(a, b) < 0 ? b : a }
	function minPos(a, b) { return cmp(a, b) < 0 ? a : b }

	// Most of the external API clips given positions to make sure they
	// actually exist within the document.
	function clipLine(doc, n) {return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1))}
	function clipPos(doc, pos) {
		if (pos.line < doc.first) { return Pos(doc.first, 0) }
		var last = doc.first + doc.size - 1;
		if (pos.line > last) { return Pos(last, getLine(doc, last).text.length) }
		return clipToLen(pos, getLine(doc, pos.line).text.length)
	}
	function clipToLen(pos, linelen) {
		var ch = pos.ch;
		if (ch == null || ch > linelen) { return Pos(pos.line, linelen) }
		else if (ch < 0) { return Pos(pos.line, 0) }
		else { return pos }
	}
	function clipPosArray(doc, array) {
		var out = [];
		for (var i = 0; i < array.length; i++) { out[i] = clipPos(doc, array[i]); }
		return out
	}

	var SavedContext = function(state, lookAhead) {
		this.state = state;
		this.lookAhead = lookAhead;
	};

	var Context = function(doc, state, line, lookAhead) {
		this.state = state;
		this.doc = doc;
		this.line = line;
		this.maxLookAhead = lookAhead || 0;
		this.baseTokens = null;
		this.baseTokenPos = 1;
	};

	Context.prototype.lookAhead = function (n) {
		var line = this.doc.getLine(this.line + n);
		if (line != null && n > this.maxLookAhead) { this.maxLookAhead = n; }
		return line
	};

	Context.prototype.baseToken = function (n) {
		if (!this.baseTokens) { return null }
		while (this.baseTokens[this.baseTokenPos] <= n)
			{ this.baseTokenPos += 2; }
		var type = this.baseTokens[this.baseTokenPos + 1];
		return {type: type && type.replace(/( |^)overlay .*/, ""),
						size: this.baseTokens[this.baseTokenPos] - n}
	};

	Context.prototype.nextLine = function () {
		this.line++;
		if (this.maxLookAhead > 0) { this.maxLookAhead--; }
	};

	Context.fromSaved = function (doc, saved, line) {
		if (saved instanceof SavedContext)
			{ return new Context(doc, copyState(doc.mode, saved.state), line, saved.lookAhead) }
		else
			{ return new Context(doc, copyState(doc.mode, saved), line) }
	};

	Context.prototype.save = function (copy) {
		var state = copy !== false ? copyState(this.doc.mode, this.state) : this.state;
		return this.maxLookAhead > 0 ? new SavedContext(state, this.maxLookAhead) : state
	};


	// Compute a style array (an array starting with a mode generation
	// -- for invalidation -- followed by pairs of end positions and
	// style strings), which is used to highlight the tokens on the
	// line.
	function highlightLine(cm, line, context, forceToEnd) {
		// A styles array always starts with a number identifying the
		// mode/overlays that it is based on (for easy invalidation).
		var st = [cm.state.modeGen], lineClasses = {};
		// Compute the base array of styles
		runMode(cm, line.text, cm.doc.mode, context, function (end, style) { return st.push(end, style); },
						lineClasses, forceToEnd);
		var state = context.state;

		// Run overlays, adjust style array.
		var loop = function ( o ) {
			context.baseTokens = st;
			var overlay = cm.state.overlays[o], i = 1, at = 0;
			context.state = true;
			runMode(cm, line.text, overlay.mode, context, function (end, style) {
				var start = i;
				// Ensure there's a token end at the current position, and that i points at it
				while (at < end) {
					var i_end = st[i];
					if (i_end > end)
						{ st.splice(i, 1, end, st[i+1], i_end); }
					i += 2;
					at = Math.min(end, i_end);
				}
				if (!style) { return }
				if (overlay.opaque) {
					st.splice(start, i - start, end, "overlay " + style);
					i = start + 2;
				} else {
					for (; start < i; start += 2) {
						var cur = st[start+1];
						st[start+1] = (cur ? cur + " " : "") + "overlay " + style;
					}
				}
			}, lineClasses);
			context.state = state;
			context.baseTokens = null;
			context.baseTokenPos = 1;
		};

		for (var o = 0; o < cm.state.overlays.length; ++o) loop( o );

		return {styles: st, classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null}
	}

	function getLineStyles(cm, line, updateFrontier) {
		if (!line.styles || line.styles[0] != cm.state.modeGen) {
			var context = getContextBefore(cm, lineNo(line));
			var resetState = line.text.length > cm.options.maxHighlightLength && copyState(cm.doc.mode, context.state);
			var result = highlightLine(cm, line, context);
			if (resetState) { context.state = resetState; }
			line.stateAfter = context.save(!resetState);
			line.styles = result.styles;
			if (result.classes) { line.styleClasses = result.classes; }
			else if (line.styleClasses) { line.styleClasses = null; }
			if (updateFrontier === cm.doc.highlightFrontier)
				{ cm.doc.modeFrontier = Math.max(cm.doc.modeFrontier, ++cm.doc.highlightFrontier); }
		}
		return line.styles
	}

	function getContextBefore(cm, n, precise) {
		var doc = cm.doc, display = cm.display;
		if (!doc.mode.startState) { return new Context(doc, true, n) }
		var start = findStartLine(cm, n, precise);
		var saved = start > doc.first && getLine(doc, start - 1).stateAfter;
		var context = saved ? Context.fromSaved(doc, saved, start) : new Context(doc, startState(doc.mode), start);

		doc.iter(start, n, function (line) {
			processLine(cm, line.text, context);
			var pos = context.line;
			line.stateAfter = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo ? context.save() : null;
			context.nextLine();
		});
		if (precise) { doc.modeFrontier = context.line; }
		return context
	}

	// Lightweight form of highlight -- proceed over this line and
	// update state, but don't save a style array. Used for lines that
	// aren't currently visible.
	function processLine(cm, text, context, startAt) {
		var mode = cm.doc.mode;
		var stream = new StringStream(text, cm.options.tabSize, context);
		stream.start = stream.pos = startAt || 0;
		if (text == "") { callBlankLine(mode, context.state); }
		while (!stream.eol()) {
			readToken(mode, stream, context.state);
			stream.start = stream.pos;
		}
	}

	function callBlankLine(mode, state) {
		if (mode.blankLine) { return mode.blankLine(state) }
		if (!mode.innerMode) { return }
		var inner = innerMode(mode, state);
		if (inner.mode.blankLine) { return inner.mode.blankLine(inner.state) }
	}

	function readToken(mode, stream, state, inner) {
		for (var i = 0; i < 10; i++) {
			if (inner) { inner[0] = innerMode(mode, state).mode; }
			var style = mode.token(stream, state);
			if (stream.pos > stream.start) { return style }
		}
		throw new Error("Mode " + mode.name + " failed to advance stream.")
	}

	var Token = function(stream, type, state) {
		this.start = stream.start; this.end = stream.pos;
		this.string = stream.current();
		this.type = type || null;
		this.state = state;
	};

	// Utility for getTokenAt and getLineTokens
	function takeToken(cm, pos, precise, asArray) {
		var doc = cm.doc, mode = doc.mode, style;
		pos = clipPos(doc, pos);
		var line = getLine(doc, pos.line), context = getContextBefore(cm, pos.line, precise);
		var stream = new StringStream(line.text, cm.options.tabSize, context), tokens;
		if (asArray) { tokens = []; }
		while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
			stream.start = stream.pos;
			style = readToken(mode, stream, context.state);
			if (asArray) { tokens.push(new Token(stream, style, copyState(doc.mode, context.state))); }
		}
		return asArray ? tokens : new Token(stream, style, context.state)
	}

	function extractLineClasses(type, output) {
		if (type) { for (;;) {
			var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/);
			if (!lineClass) { break }
			type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length);
			var prop = lineClass[1] ? "bgClass" : "textClass";
			if (output[prop] == null)
				{ output[prop] = lineClass[2]; }
			else if (!(new RegExp("(?:^|\\s)" + lineClass[2] + "(?:$|\\s)")).test(output[prop]))
				{ output[prop] += " " + lineClass[2]; }
		} }
		return type
	}

	// Run the given mode's parser over a line, calling f for each token.
	function runMode(cm, text, mode, context, f, lineClasses, forceToEnd) {
		var flattenSpans = mode.flattenSpans;
		if (flattenSpans == null) { flattenSpans = cm.options.flattenSpans; }
		var curStart = 0, curStyle = null;
		var stream = new StringStream(text, cm.options.tabSize, context), style;
		var inner = cm.options.addModeClass && [null];
		if (text == "") { extractLineClasses(callBlankLine(mode, context.state), lineClasses); }
		while (!stream.eol()) {
			if (stream.pos > cm.options.maxHighlightLength) {
				flattenSpans = false;
				if (forceToEnd) { processLine(cm, text, context, stream.pos); }
				stream.pos = text.length;
				style = null;
			} else {
				style = extractLineClasses(readToken(mode, stream, context.state, inner), lineClasses);
			}
			if (inner) {
				var mName = inner[0].name;
				if (mName) { style = "m-" + (style ? mName + " " + style : mName); }
			}
			if (!flattenSpans || curStyle != style) {
				while (curStart < stream.start) {
					curStart = Math.min(stream.start, curStart + 5000);
					f(curStart, curStyle);
				}
				curStyle = style;
			}
			stream.start = stream.pos;
		}
		while (curStart < stream.pos) {
			// Webkit seems to refuse to render text nodes longer than 57444
			// characters, and returns inaccurate measurements in nodes
			// starting around 5000 chars.
			var pos = Math.min(stream.pos, curStart + 5000);
			f(pos, curStyle);
			curStart = pos;
		}
	}

	// Finds the line to start with when starting a parse. Tries to
	// find a line with a stateAfter, so that it can start with a
	// valid state. If that fails, it returns the line with the
	// smallest indentation, which tends to need the least context to
	// parse correctly.
	function findStartLine(cm, n, precise) {
		var minindent, minline, doc = cm.doc;
		var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100);
		for (var search = n; search > lim; --search) {
			if (search <= doc.first) { return doc.first }
			var line = getLine(doc, search - 1), after = line.stateAfter;
			if (after && (!precise || search + (after instanceof SavedContext ? after.lookAhead : 0) <= doc.modeFrontier))
				{ return search }
			var indented = countColumn(line.text, null, cm.options.tabSize);
			if (minline == null || minindent > indented) {
				minline = search - 1;
				minindent = indented;
			}
		}
		return minline
	}

	function retreatFrontier(doc, n) {
		doc.modeFrontier = Math.min(doc.modeFrontier, n);
		if (doc.highlightFrontier < n - 10) { return }
		var start = doc.first;
		for (var line = n - 1; line > start; line--) {
			var saved = getLine(doc, line).stateAfter;
			// change is on 3
			// state on line 1 looked ahead 2 -- so saw 3
			// test 1 + 2 < 3 should cover this
			if (saved && (!(saved instanceof SavedContext) || line + saved.lookAhead < n)) {
				start = line + 1;
				break
			}
		}
		doc.highlightFrontier = Math.min(doc.highlightFrontier, start);
	}

	// Optimize some code when these features are not used.
	var sawReadOnlySpans = false, sawCollapsedSpans = false;

	function seeReadOnlySpans() {
		sawReadOnlySpans = true;
	}

	function seeCollapsedSpans() {
		sawCollapsedSpans = true;
	}

	// TEXTMARKER SPANS

	function MarkedSpan(marker, from, to) {
		this.marker = marker;
		this.from = from; this.to = to;
	}

	// Search an array of spans for a span matching the given marker.
	function getMarkedSpanFor(spans, marker) {
		if (spans) { for (var i = 0; i < spans.length; ++i) {
			var span = spans[i];
			if (span.marker == marker) { return span }
		} }
	}

	// Remove a span from an array, returning undefined if no spans are
	// left (we don't store arrays for lines without spans).
	function removeMarkedSpan(spans, span) {
		var r;
		for (var i = 0; i < spans.length; ++i)
			{ if (spans[i] != span) { (r || (r = [])).push(spans[i]); } }
		return r
	}

	// Add a span to a line.
	function addMarkedSpan(line, span, op) {
		var inThisOp = op && window.WeakSet && (op.markedSpans || (op.markedSpans = new WeakSet));
		if (inThisOp && line.markedSpans && inThisOp.has(line.markedSpans)) {
			line.markedSpans.push(span);
		} else {
			line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span];
			if (inThisOp) { inThisOp.add(line.markedSpans); }
		}
		span.marker.attachLine(line);
	}

	// Used for the algorithm that adjusts markers for a change in the
	// document. These functions cut an array of spans at a given
	// character position, returning an array of remaining chunks (or
	// undefined if nothing remains).
	function markedSpansBefore(old, startCh, isInsert) {
		var nw;
		if (old) { for (var i = 0; i < old.length; ++i) {
			var span = old[i], marker = span.marker;
			var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);
			if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
				var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh)
				;(nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to));
			}
		} }
		return nw
	}
	function markedSpansAfter(old, endCh, isInsert) {
		var nw;
		if (old) { for (var i = 0; i < old.length; ++i) {
			var span = old[i], marker = span.marker;
			var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);
			if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
				var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh)
				;(nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh,
																							span.to == null ? null : span.to - endCh));
			}
		} }
		return nw
	}

	// Given a change object, compute the new set of marker spans that
	// cover the line in which the change took place. Removes spans
	// entirely within the change, reconnects spans belonging to the
	// same marker that appear on both sides of the change, and cuts off
	// spans partially within the change. Returns an array of span
	// arrays with one element for each line in (after) the change.
	function stretchSpansOverChange(doc, change) {
		if (change.full) { return null }
		var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans;
		var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans;
		if (!oldFirst && !oldLast) { return null }

		var startCh = change.from.ch, endCh = change.to.ch, isInsert = cmp(change.from, change.to) == 0;
		// Get the spans that 'stick out' on both sides
		var first = markedSpansBefore(oldFirst, startCh, isInsert);
		var last = markedSpansAfter(oldLast, endCh, isInsert);

		// Next, merge those two ends
		var sameLine = change.text.length == 1, offset = lst(change.text).length + (sameLine ? startCh : 0);
		if (first) {
			// Fix up .to properties of first
			for (var i = 0; i < first.length; ++i) {
				var span = first[i];
				if (span.to == null) {
					var found = getMarkedSpanFor(last, span.marker);
					if (!found) { span.to = startCh; }
					else if (sameLine) { span.to = found.to == null ? null : found.to + offset; }
				}
			}
		}
		if (last) {
			// Fix up .from in last (or move them into first in case of sameLine)
			for (var i$1 = 0; i$1 < last.length; ++i$1) {
				var span$1 = last[i$1];
				if (span$1.to != null) { span$1.to += offset; }
				if (span$1.from == null) {
					var found$1 = getMarkedSpanFor(first, span$1.marker);
					if (!found$1) {
						span$1.from = offset;
						if (sameLine) { (first || (first = [])).push(span$1); }
					}
				} else {
					span$1.from += offset;
					if (sameLine) { (first || (first = [])).push(span$1); }
				}
			}
		}
		// Make sure we didn't create any zero-length spans
		if (first) { first = clearEmptySpans(first); }
		if (last && last != first) { last = clearEmptySpans(last); }

		var newMarkers = [first];
		if (!sameLine) {
			// Fill gap with whole-line-spans
			var gap = change.text.length - 2, gapMarkers;
			if (gap > 0 && first)
				{ for (var i$2 = 0; i$2 < first.length; ++i$2)
					{ if (first[i$2].to == null)
						{ (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i$2].marker, null, null)); } } }
			for (var i$3 = 0; i$3 < gap; ++i$3)
				{ newMarkers.push(gapMarkers); }
			newMarkers.push(last);
		}
		return newMarkers
	}

	// Remove spans that are empty and don't have a clearWhenEmpty
	// option of false.
	function clearEmptySpans(spans) {
		for (var i = 0; i < spans.length; ++i) {
			var span = spans[i];
			if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false)
				{ spans.splice(i--, 1); }
		}
		if (!spans.length) { return null }
		return spans
	}

	// Used to 'clip' out readOnly ranges when making a change.
	function removeReadOnlyRanges(doc, from, to) {
		var markers = null;
		doc.iter(from.line, to.line + 1, function (line) {
			if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
				var mark = line.markedSpans[i].marker;
				if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
					{ (markers || (markers = [])).push(mark); }
			} }
		});
		if (!markers) { return null }
		var parts = [{from: from, to: to}];
		for (var i = 0; i < markers.length; ++i) {
			var mk = markers[i], m = mk.find(0);
			for (var j = 0; j < parts.length; ++j) {
				var p = parts[j];
				if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) { continue }
				var newParts = [j, 1], dfrom = cmp(p.from, m.from), dto = cmp(p.to, m.to);
				if (dfrom < 0 || !mk.inclusiveLeft && !dfrom)
					{ newParts.push({from: p.from, to: m.from}); }
				if (dto > 0 || !mk.inclusiveRight && !dto)
					{ newParts.push({from: m.to, to: p.to}); }
				parts.splice.apply(parts, newParts);
				j += newParts.length - 3;
			}
		}
		return parts
	}

	// Connect or disconnect spans from a line.
	function detachMarkedSpans(line) {
		var spans = line.markedSpans;
		if (!spans) { return }
		for (var i = 0; i < spans.length; ++i)
			{ spans[i].marker.detachLine(line); }
		line.markedSpans = null;
	}
	function attachMarkedSpans(line, spans) {
		if (!spans) { return }
		for (var i = 0; i < spans.length; ++i)
			{ spans[i].marker.attachLine(line); }
		line.markedSpans = spans;
	}

	// Helpers used when computing which overlapping collapsed span
	// counts as the larger one.
	function extraLeft(marker) { return marker.inclusiveLeft ? -1 : 0 }
	function extraRight(marker) { return marker.inclusiveRight ? 1 : 0 }

	// Returns a number indicating which of two overlapping collapsed
	// spans is larger (and thus includes the other). Falls back to
	// comparing ids when the spans cover exactly the same range.
	function compareCollapsedMarkers(a, b) {
		var lenDiff = a.lines.length - b.lines.length;
		if (lenDiff != 0) { return lenDiff }
		var aPos = a.find(), bPos = b.find();
		var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b);
		if (fromCmp) { return -fromCmp }
		var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b);
		if (toCmp) { return toCmp }
		return b.id - a.id
	}

	// Find out whether a line ends or starts in a collapsed span. If
	// so, return the marker for that span.
	function collapsedSpanAtSide(line, start) {
		var sps = sawCollapsedSpans && line.markedSpans, found;
		if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
			sp = sps[i];
			if (sp.marker.collapsed && (start ? sp.from : sp.to) == null &&
					(!found || compareCollapsedMarkers(found, sp.marker) < 0))
				{ found = sp.marker; }
		} }
		return found
	}
	function collapsedSpanAtStart(line) { return collapsedSpanAtSide(line, true) }
	function collapsedSpanAtEnd(line) { return collapsedSpanAtSide(line, false) }

	function collapsedSpanAround(line, ch) {
		var sps = sawCollapsedSpans && line.markedSpans, found;
		if (sps) { for (var i = 0; i < sps.length; ++i) {
			var sp = sps[i];
			if (sp.marker.collapsed && (sp.from == null || sp.from < ch) && (sp.to == null || sp.to > ch) &&
					(!found || compareCollapsedMarkers(found, sp.marker) < 0)) { found = sp.marker; }
		} }
		return found
	}

	// Test whether there exists a collapsed span that partially
	// overlaps (covers the start or end, but not both) of a new span.
	// Such overlap is not allowed.
	function conflictingCollapsedRange(doc, lineNo, from, to, marker) {
		var line = getLine(doc, lineNo);
		var sps = sawCollapsedSpans && line.markedSpans;
		if (sps) { for (var i = 0; i < sps.length; ++i) {
			var sp = sps[i];
			if (!sp.marker.collapsed) { continue }
			var found = sp.marker.find(0);
			var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker);
			var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker);
			if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) { continue }
			if (fromCmp <= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.to, from) >= 0 : cmp(found.to, from) > 0) ||
					fromCmp >= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.from, to) <= 0 : cmp(found.from, to) < 0))
				{ return true }
		} }
	}

	// A visual line is a line as drawn on the screen. Folding, for
	// example, can cause multiple logical lines to appear on the same
	// visual line. This finds the start of the visual line that the
	// given line is part of (usually that is the line itself).
	function visualLine(line) {
		var merged;
		while (merged = collapsedSpanAtStart(line))
			{ line = merged.find(-1, true).line; }
		return line
	}

	function visualLineEnd(line) {
		var merged;
		while (merged = collapsedSpanAtEnd(line))
			{ line = merged.find(1, true).line; }
		return line
	}

	// Returns an array of logical lines that continue the visual line
	// started by the argument, or undefined if there are no such lines.
	function visualLineContinued(line) {
		var merged, lines;
		while (merged = collapsedSpanAtEnd(line)) {
			line = merged.find(1, true).line
			;(lines || (lines = [])).push(line);
		}
		return lines
	}

	// Get the line number of the start of the visual line that the
	// given line number is part of.
	function visualLineNo(doc, lineN) {
		var line = getLine(doc, lineN), vis = visualLine(line);
		if (line == vis) { return lineN }
		return lineNo(vis)
	}

	// Get the line number of the start of the next visual line after
	// the given line.
	function visualLineEndNo(doc, lineN) {
		if (lineN > doc.lastLine()) { return lineN }
		var line = getLine(doc, lineN), merged;
		if (!lineIsHidden(doc, line)) { return lineN }
		while (merged = collapsedSpanAtEnd(line))
			{ line = merged.find(1, true).line; }
		return lineNo(line) + 1
	}

	// Compute whether a line is hidden. Lines count as hidden when they
	// are part of a visual line that starts with another line, or when
	// they are entirely covered by collapsed, non-widget span.
	function lineIsHidden(doc, line) {
		var sps = sawCollapsedSpans && line.markedSpans;
		if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
			sp = sps[i];
			if (!sp.marker.collapsed) { continue }
			if (sp.from == null) { return true }
			if (sp.marker.widgetNode) { continue }
			if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
				{ return true }
		} }
	}
	function lineIsHiddenInner(doc, line, span) {
		if (span.to == null) {
			var end = span.marker.find(1, true);
			return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker))
		}
		if (span.marker.inclusiveRight && span.to == line.text.length)
			{ return true }
		for (var sp = (void 0), i = 0; i < line.markedSpans.length; ++i) {
			sp = line.markedSpans[i];
			if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to &&
					(sp.to == null || sp.to != span.from) &&
					(sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
					lineIsHiddenInner(doc, line, sp)) { return true }
		}
	}

	// Find the height above the given line.
	function heightAtLine(lineObj) {
		lineObj = visualLine(lineObj);

		var h = 0, chunk = lineObj.parent;
		for (var i = 0; i < chunk.lines.length; ++i) {
			var line = chunk.lines[i];
			if (line == lineObj) { break }
			else { h += line.height; }
		}
		for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
			for (var i$1 = 0; i$1 < p.children.length; ++i$1) {
				var cur = p.children[i$1];
				if (cur == chunk) { break }
				else { h += cur.height; }
			}
		}
		return h
	}

	// Compute the character length of a line, taking into account
	// collapsed ranges (see markText) that might hide parts, and join
	// other lines onto it.
	function lineLength(line) {
		if (line.height == 0) { return 0 }
		var len = line.text.length, merged, cur = line;
		while (merged = collapsedSpanAtStart(cur)) {
			var found = merged.find(0, true);
			cur = found.from.line;
			len += found.from.ch - found.to.ch;
		}
		cur = line;
		while (merged = collapsedSpanAtEnd(cur)) {
			var found$1 = merged.find(0, true);
			len -= cur.text.length - found$1.from.ch;
			cur = found$1.to.line;
			len += cur.text.length - found$1.to.ch;
		}
		return len
	}

	// Find the longest line in the document.
	function findMaxLine(cm) {
		var d = cm.display, doc = cm.doc;
		d.maxLine = getLine(doc, doc.first);
		d.maxLineLength = lineLength(d.maxLine);
		d.maxLineChanged = true;
		doc.iter(function (line) {
			var len = lineLength(line);
			if (len > d.maxLineLength) {
				d.maxLineLength = len;
				d.maxLine = line;
			}
		});
	}

	// LINE DATA STRUCTURE

	// Line objects. These hold state related to a line, including
	// highlighting info (the styles array).
	var Line = function(text, markedSpans, estimateHeight) {
		this.text = text;
		attachMarkedSpans(this, markedSpans);
		this.height = estimateHeight ? estimateHeight(this) : 1;
	};

	Line.prototype.lineNo = function () { return lineNo(this) };
	eventMixin(Line);

	// Change the content (text, markers) of a line. Automatically
	// invalidates cached information and tries to re-estimate the
	// line's height.
	function updateLine(line, text, markedSpans, estimateHeight) {
		line.text = text;
		if (line.stateAfter) { line.stateAfter = null; }
		if (line.styles) { line.styles = null; }
		if (line.order != null) { line.order = null; }
		detachMarkedSpans(line);
		attachMarkedSpans(line, markedSpans);
		var estHeight = estimateHeight ? estimateHeight(line) : 1;
		if (estHeight != line.height) { updateLineHeight(line, estHeight); }
	}

	// Detach a line from the document tree and its markers.
	function cleanUpLine(line) {
		line.parent = null;
		detachMarkedSpans(line);
	}

	// Convert a style as returned by a mode (either null, or a string
	// containing one or more styles) to a CSS style. This is cached,
	// and also looks for line-wide styles.
	var styleToClassCache = {}, styleToClassCacheWithMode = {};
	function interpretTokenStyle(style, options) {
		if (!style || /^\s*$/.test(style)) { return null }
		var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache;
		return cache[style] ||
			(cache[style] = style.replace(/\S+/g, "cm-$&"))
	}

	// Render the DOM representation of the text of a line. Also builds
	// up a 'line map', which points at the DOM nodes that represent
	// specific stretches of text, and is used by the measuring code.
	// The returned object contains the DOM node, this map, and
	// information about line-wide styles that were set by the mode.
	function buildLineContent(cm, lineView) {
		// The padding-right forces the element to have a 'border', which
		// is needed on Webkit to be able to get line-level bounding
		// rectangles for it (in measureChar).
		var content = eltP("span", null, null, webkit ? "padding-right: .1px" : null);
		var builder = {pre: eltP("pre", [content], "CodeMirror-line"), content: content,
									 col: 0, pos: 0, cm: cm,
									 trailingSpace: false,
									 splitSpaces: cm.getOption("lineWrapping")};
		lineView.measure = {};

		// Iterate over the logical lines that make up this visual line.
		for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
			var line = i ? lineView.rest[i - 1] : lineView.line, order = (void 0);
			builder.pos = 0;
			builder.addToken = buildToken;
			// Optionally wire in some hacks into the token-rendering
			// algorithm, to deal with browser quirks.
			if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line, cm.doc.direction)))
				{ builder.addToken = buildTokenBadBidi(builder.addToken, order); }
			builder.map = [];
			var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line);
			insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate));
			if (line.styleClasses) {
				if (line.styleClasses.bgClass)
					{ builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || ""); }
				if (line.styleClasses.textClass)
					{ builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || ""); }
			}

			// Ensure at least a single node is present, for measuring.
			if (builder.map.length == 0)
				{ builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure))); }

			// Store the map and a cache object for the current logical line
			if (i == 0) {
				lineView.measure.map = builder.map;
				lineView.measure.cache = {};
			} else {
	(lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map)
				;(lineView.measure.caches || (lineView.measure.caches = [])).push({});
			}
		}

		// See issue #2901
		if (webkit) {
			var last = builder.content.lastChild;
			if (/\bcm-tab\b/.test(last.className) || (last.querySelector && last.querySelector(".cm-tab")))
				{ builder.content.className = "cm-tab-wrap-hack"; }
		}

		signal(cm, "renderLine", cm, lineView.line, builder.pre);
		if (builder.pre.className)
			{ builder.textClass = joinClasses(builder.pre.className, builder.textClass || ""); }

		return builder
	}

	function defaultSpecialCharPlaceholder(ch) {
		var token = elt("span", "\u2022", "cm-invalidchar");
		token.title = "\\u" + ch.charCodeAt(0).toString(16);
		token.setAttribute("aria-label", token.title);
		return token
	}

	// Build up the DOM representation for a single token, and add it to
	// the line map. Takes care to render special characters separately.
	function buildToken(builder, text, style, startStyle, endStyle, css, attributes) {
		if (!text) { return }
		var displayText = builder.splitSpaces ? splitSpaces(text, builder.trailingSpace) : text;
		var special = builder.cm.state.specialChars, mustWrap = false;
		var content;
		if (!special.test(text)) {
			builder.col += text.length;
			content = document.createTextNode(displayText);
			builder.map.push(builder.pos, builder.pos + text.length, content);
			if (ie && ie_version < 9) { mustWrap = true; }
			builder.pos += text.length;
		} else {
			content = document.createDocumentFragment();
			var pos = 0;
			while (true) {
				special.lastIndex = pos;
				var m = special.exec(text);
				var skipped = m ? m.index - pos : text.length - pos;
				if (skipped) {
					var txt = document.createTextNode(displayText.slice(pos, pos + skipped));
					if (ie && ie_version < 9) { content.appendChild(elt("span", [txt])); }
					else { content.appendChild(txt); }
					builder.map.push(builder.pos, builder.pos + skipped, txt);
					builder.col += skipped;
					builder.pos += skipped;
				}
				if (!m) { break }
				pos += skipped + 1;
				var txt$1 = (void 0);
				if (m[0] == "\t") {
					var tabSize = builder.cm.options.tabSize, tabWidth = tabSize - builder.col % tabSize;
					txt$1 = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
					txt$1.setAttribute("role", "presentation");
					txt$1.setAttribute("cm-text", "\t");
					builder.col += tabWidth;
				} else if (m[0] == "\r" || m[0] == "\n") {
					txt$1 = content.appendChild(elt("span", m[0] == "\r" ? "\u240d" : "\u2424", "cm-invalidchar"));
					txt$1.setAttribute("cm-text", m[0]);
					builder.col += 1;
				} else {
					txt$1 = builder.cm.options.specialCharPlaceholder(m[0]);
					txt$1.setAttribute("cm-text", m[0]);
					if (ie && ie_version < 9) { content.appendChild(elt("span", [txt$1])); }
					else { content.appendChild(txt$1); }
					builder.col += 1;
				}
				builder.map.push(builder.pos, builder.pos + 1, txt$1);
				builder.pos++;
			}
		}
		builder.trailingSpace = displayText.charCodeAt(text.length - 1) == 32;
		if (style || startStyle || endStyle || mustWrap || css || attributes) {
			var fullStyle = style || "";
			if (startStyle) { fullStyle += startStyle; }
			if (endStyle) { fullStyle += endStyle; }
			var token = elt("span", [content], fullStyle, css);
			if (attributes) {
				for (var attr in attributes) { if (attributes.hasOwnProperty(attr) && attr != "style" && attr != "class")
					{ token.setAttribute(attr, attributes[attr]); } }
			}
			return builder.content.appendChild(token)
		}
		builder.content.appendChild(content);
	}

	// Change some spaces to NBSP to prevent the browser from collapsing
	// trailing spaces at the end of a line when rendering text (issue #1362).
	function splitSpaces(text, trailingBefore) {
		if (text.length > 1 && !/  /.test(text)) { return text }
		var spaceBefore = trailingBefore, result = "";
		for (var i = 0; i < text.length; i++) {
			var ch = text.charAt(i);
			if (ch == " " && spaceBefore && (i == text.length - 1 || text.charCodeAt(i + 1) == 32))
				{ ch = "\u00a0"; }
			result += ch;
			spaceBefore = ch == " ";
		}
		return result
	}

	// Work around nonsense dimensions being reported for stretches of
	// right-to-left text.
	function buildTokenBadBidi(inner, order) {
		return function (builder, text, style, startStyle, endStyle, css, attributes) {
			style = style ? style + " cm-force-border" : "cm-force-border";
			var start = builder.pos, end = start + text.length;
			for (;;) {
				// Find the part that overlaps with the start of this text
				var part = (void 0);
				for (var i = 0; i < order.length; i++) {
					part = order[i];
					if (part.to > start && part.from <= start) { break }
				}
				if (part.to >= end) { return inner(builder, text, style, startStyle, endStyle, css, attributes) }
				inner(builder, text.slice(0, part.to - start), style, startStyle, null, css, attributes);
				startStyle = null;
				text = text.slice(part.to - start);
				start = part.to;
			}
		}
	}

	function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
		var widget = !ignoreWidget && marker.widgetNode;
		if (widget) { builder.map.push(builder.pos, builder.pos + size, widget); }
		if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
			if (!widget)
				{ widget = builder.content.appendChild(document.createElement("span")); }
			widget.setAttribute("cm-marker", marker.id);
		}
		if (widget) {
			builder.cm.display.input.setUneditable(widget);
			builder.content.appendChild(widget);
		}
		builder.pos += size;
		builder.trailingSpace = false;
	}

	// Outputs a number of spans to make up a line, taking highlighting
	// and marked text into account.
	function insertLineContent(line, builder, styles) {
		var spans = line.markedSpans, allText = line.text, at = 0;
		if (!spans) {
			for (var i$1 = 1; i$1 < styles.length; i$1+=2)
				{ builder.addToken(builder, allText.slice(at, at = styles[i$1]), interpretTokenStyle(styles[i$1+1], builder.cm.options)); }
			return
		}

		var len = allText.length, pos = 0, i = 1, text = "", style, css;
		var nextChange = 0, spanStyle, spanEndStyle, spanStartStyle, collapsed, attributes;
		for (;;) {
			if (nextChange == pos) { // Update current marker set
				spanStyle = spanEndStyle = spanStartStyle = css = "";
				attributes = null;
				collapsed = null; nextChange = Infinity;
				var foundBookmarks = [], endStyles = (void 0);
				for (var j = 0; j < spans.length; ++j) {
					var sp = spans[j], m = sp.marker;
					if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
						foundBookmarks.push(m);
					} else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
						if (sp.to != null && sp.to != pos && nextChange > sp.to) {
							nextChange = sp.to;
							spanEndStyle = "";
						}
						if (m.className) { spanStyle += " " + m.className; }
						if (m.css) { css = (css ? css + ";" : "") + m.css; }
						if (m.startStyle && sp.from == pos) { spanStartStyle += " " + m.startStyle; }
						if (m.endStyle && sp.to == nextChange) { (endStyles || (endStyles = [])).push(m.endStyle, sp.to); }
						// support for the old title property
						// https://github.com/codemirror/CodeMirror/pull/5673
						if (m.title) { (attributes || (attributes = {})).title = m.title; }
						if (m.attributes) {
							for (var attr in m.attributes)
								{ (attributes || (attributes = {}))[attr] = m.attributes[attr]; }
						}
						if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0))
							{ collapsed = sp; }
					} else if (sp.from > pos && nextChange > sp.from) {
						nextChange = sp.from;
					}
				}
				if (endStyles) { for (var j$1 = 0; j$1 < endStyles.length; j$1 += 2)
					{ if (endStyles[j$1 + 1] == nextChange) { spanEndStyle += " " + endStyles[j$1]; } } }

				if (!collapsed || collapsed.from == pos) { for (var j$2 = 0; j$2 < foundBookmarks.length; ++j$2)
					{ buildCollapsedSpan(builder, 0, foundBookmarks[j$2]); } }
				if (collapsed && (collapsed.from || 0) == pos) {
					buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos,
														 collapsed.marker, collapsed.from == null);
					if (collapsed.to == null) { return }
					if (collapsed.to == pos) { collapsed = false; }
				}
			}
			if (pos >= len) { break }

			var upto = Math.min(len, nextChange);
			while (true) {
				if (text) {
					var end = pos + text.length;
					if (!collapsed) {
						var tokenText = end > upto ? text.slice(0, upto - pos) : text;
						builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
														 spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", css, attributes);
					}
					if (end >= upto) {text = text.slice(upto - pos); pos = upto; break}
					pos = end;
					spanStartStyle = "";
				}
				text = allText.slice(at, at = styles[i++]);
				style = interpretTokenStyle(styles[i++], builder.cm.options);
			}
		}
	}


	// These objects are used to represent the visible (currently drawn)
	// part of the document. A LineView may correspond to multiple
	// logical lines, if those are connected by collapsed ranges.
	function LineView(doc, line, lineN) {
		// The starting line
		this.line = line;
		// Continuing lines, if any
		this.rest = visualLineContinued(line);
		// Number of logical lines in this visual line
		this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1;
		this.node = this.text = null;
		this.hidden = lineIsHidden(doc, line);
	}

	// Create a range of LineView objects for the given lines.
	function buildViewArray(cm, from, to) {
		var array = [], nextPos;
		for (var pos = from; pos < to; pos = nextPos) {
			var view = new LineView(cm.doc, getLine(cm.doc, pos), pos);
			nextPos = pos + view.size;
			array.push(view);
		}
		return array
	}

	var operationGroup = null;

	function pushOperation(op) {
		if (operationGroup) {
			operationGroup.ops.push(op);
		} else {
			op.ownsGroup = operationGroup = {
				ops: [op],
				delayedCallbacks: []
			};
		}
	}

	function fireCallbacksForOps(group) {
		// Calls delayed callbacks and cursorActivity handlers until no
		// new ones appear
		var callbacks = group.delayedCallbacks, i = 0;
		do {
			for (; i < callbacks.length; i++)
				{ callbacks[i].call(null); }
			for (var j = 0; j < group.ops.length; j++) {
				var op = group.ops[j];
				if (op.cursorActivityHandlers)
					{ while (op.cursorActivityCalled < op.cursorActivityHandlers.length)
						{ op.cursorActivityHandlers[op.cursorActivityCalled++].call(null, op.cm); } }
			}
		} while (i < callbacks.length)
	}

	function finishOperation(op, endCb) {
		var group = op.ownsGroup;
		if (!group) { return }

		try { fireCallbacksForOps(group); }
		finally {
			operationGroup = null;
			endCb(group);
		}
	}

	var orphanDelayedCallbacks = null;

	// Often, we want to signal events at a point where we are in the
	// middle of some work, but don't want the handler to start calling
	// other methods on the editor, which might be in an inconsistent
	// state or simply not expect any other events to happen.
	// signalLater looks whether there are any handlers, and schedules
	// them to be executed when the last operation ends, or, if no
	// operation is active, when a timeout fires.
	function signalLater(emitter, type /*, values...*/) {
		var arr = getHandlers(emitter, type);
		if (!arr.length) { return }
		var args = Array.prototype.slice.call(arguments, 2), list;
		if (operationGroup) {
			list = operationGroup.delayedCallbacks;
		} else if (orphanDelayedCallbacks) {
			list = orphanDelayedCallbacks;
		} else {
			list = orphanDelayedCallbacks = [];
			setTimeout(fireOrphanDelayed, 0);
		}
		var loop = function ( i ) {
			list.push(function () { return arr[i].apply(null, args); });
		};

		for (var i = 0; i < arr.length; ++i)
			loop( i );
	}

	function fireOrphanDelayed() {
		var delayed = orphanDelayedCallbacks;
		orphanDelayedCallbacks = null;
		for (var i = 0; i < delayed.length; ++i) { delayed[i](); }
	}

	// When an aspect of a line changes, a string is added to
	// lineView.changes. This updates the relevant part of the line's
	// DOM structure.
	function updateLineForChanges(cm, lineView, lineN, dims) {
		for (var j = 0; j < lineView.changes.length; j++) {
			var type = lineView.changes[j];
			if (type == "text") { updateLineText(cm, lineView); }
			else if (type == "gutter") { updateLineGutter(cm, lineView, lineN, dims); }
			else if (type == "class") { updateLineClasses(cm, lineView); }
			else if (type == "widget") { updateLineWidgets(cm, lineView, dims); }
		}
		lineView.changes = null;
	}

	// Lines with gutter elements, widgets or a background class need to
	// be wrapped, and have the extra elements added to the wrapper div
	function ensureLineWrapped(lineView) {
		if (lineView.node == lineView.text) {
			lineView.node = elt("div", null, null, "position: relative");
			if (lineView.text.parentNode)
				{ lineView.text.parentNode.replaceChild(lineView.node, lineView.text); }
			lineView.node.appendChild(lineView.text);
			if (ie && ie_version < 8) { lineView.node.style.zIndex = 2; }
		}
		return lineView.node
	}

	function updateLineBackground(cm, lineView) {
		var cls = lineView.bgClass ? lineView.bgClass + " " + (lineView.line.bgClass || "") : lineView.line.bgClass;
		if (cls) { cls += " CodeMirror-linebackground"; }
		if (lineView.background) {
			if (cls) { lineView.background.className = cls; }
			else { lineView.background.parentNode.removeChild(lineView.background); lineView.background = null; }
		} else if (cls) {
			var wrap = ensureLineWrapped(lineView);
			lineView.background = wrap.insertBefore(elt("div", null, cls), wrap.firstChild);
			cm.display.input.setUneditable(lineView.background);
		}
	}

	// Wrapper around buildLineContent which will reuse the structure
	// in display.externalMeasured when possible.
	function getLineContent(cm, lineView) {
		var ext = cm.display.externalMeasured;
		if (ext && ext.line == lineView.line) {
			cm.display.externalMeasured = null;
			lineView.measure = ext.measure;
			return ext.built
		}
		return buildLineContent(cm, lineView)
	}

	// Redraw the line's text. Interacts with the background and text
	// classes because the mode may output tokens that influence these
	// classes.
	function updateLineText(cm, lineView) {
		var cls = lineView.text.className;
		var built = getLineContent(cm, lineView);
		if (lineView.text == lineView.node) { lineView.node = built.pre; }
		lineView.text.parentNode.replaceChild(built.pre, lineView.text);
		lineView.text = built.pre;
		if (built.bgClass != lineView.bgClass || built.textClass != lineView.textClass) {
			lineView.bgClass = built.bgClass;
			lineView.textClass = built.textClass;
			updateLineClasses(cm, lineView);
		} else if (cls) {
			lineView.text.className = cls;
		}
	}

	function updateLineClasses(cm, lineView) {
		updateLineBackground(cm, lineView);
		if (lineView.line.wrapClass)
			{ ensureLineWrapped(lineView).className = lineView.line.wrapClass; }
		else if (lineView.node != lineView.text)
			{ lineView.node.className = ""; }
		var textClass = lineView.textClass ? lineView.textClass + " " + (lineView.line.textClass || "") : lineView.line.textClass;
		lineView.text.className = textClass || "";
	}

	function updateLineGutter(cm, lineView, lineN, dims) {
		if (lineView.gutter) {
			lineView.node.removeChild(lineView.gutter);
			lineView.gutter = null;
		}
		if (lineView.gutterBackground) {
			lineView.node.removeChild(lineView.gutterBackground);
			lineView.gutterBackground = null;
		}
		if (lineView.line.gutterClass) {
			var wrap = ensureLineWrapped(lineView);
			lineView.gutterBackground = elt("div", null, "CodeMirror-gutter-background " + lineView.line.gutterClass,
																			("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px; width: " + (dims.gutterTotalWidth) + "px"));
			cm.display.input.setUneditable(lineView.gutterBackground);
			wrap.insertBefore(lineView.gutterBackground, lineView.text);
		}
		var markers = lineView.line.gutterMarkers;
		if (cm.options.lineNumbers || markers) {
			var wrap$1 = ensureLineWrapped(lineView);
			var gutterWrap = lineView.gutter = elt("div", null, "CodeMirror-gutter-wrapper", ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px"));
			gutterWrap.setAttribute("aria-hidden", "true");
			cm.display.input.setUneditable(gutterWrap);
			wrap$1.insertBefore(gutterWrap, lineView.text);
			if (lineView.line.gutterClass)
				{ gutterWrap.className += " " + lineView.line.gutterClass; }
			if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"]))
				{ lineView.lineNumber = gutterWrap.appendChild(
					elt("div", lineNumberFor(cm.options, lineN),
							"CodeMirror-linenumber CodeMirror-gutter-elt",
							("left: " + (dims.gutterLeft["CodeMirror-linenumbers"]) + "px; width: " + (cm.display.lineNumInnerWidth) + "px"))); }
			if (markers) { for (var k = 0; k < cm.display.gutterSpecs.length; ++k) {
				var id = cm.display.gutterSpecs[k].className, found = markers.hasOwnProperty(id) && markers[id];
				if (found)
					{ gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt",
																		 ("left: " + (dims.gutterLeft[id]) + "px; width: " + (dims.gutterWidth[id]) + "px"))); }
			} }
		}
	}

	function updateLineWidgets(cm, lineView, dims) {
		if (lineView.alignable) { lineView.alignable = null; }
		var isWidget = classTest("CodeMirror-linewidget");
		for (var node = lineView.node.firstChild, next = (void 0); node; node = next) {
			next = node.nextSibling;
			if (isWidget.test(node.className)) { lineView.node.removeChild(node); }
		}
		insertLineWidgets(cm, lineView, dims);
	}

	// Build a line's DOM representation from scratch
	function buildLineElement(cm, lineView, lineN, dims) {
		var built = getLineContent(cm, lineView);
		lineView.text = lineView.node = built.pre;
		if (built.bgClass) { lineView.bgClass = built.bgClass; }
		if (built.textClass) { lineView.textClass = built.textClass; }

		updateLineClasses(cm, lineView);
		updateLineGutter(cm, lineView, lineN, dims);
		insertLineWidgets(cm, lineView, dims);
		return lineView.node
	}

	// A lineView may contain multiple logical lines (when merged by
	// collapsed spans). The widgets for all of them need to be drawn.
	function insertLineWidgets(cm, lineView, dims) {
		insertLineWidgetsFor(cm, lineView.line, lineView, dims, true);
		if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
			{ insertLineWidgetsFor(cm, lineView.rest[i], lineView, dims, false); } }
	}

	function insertLineWidgetsFor(cm, line, lineView, dims, allowAbove) {
		if (!line.widgets) { return }
		var wrap = ensureLineWrapped(lineView);
		for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
			var widget = ws[i], node = elt("div", [widget.node], "CodeMirror-linewidget" + (widget.className ? " " + widget.className : ""));
			if (!widget.handleMouseEvents) { node.setAttribute("cm-ignore-events", "true"); }
			positionLineWidget(widget, node, lineView, dims);
			cm.display.input.setUneditable(node);
			if (allowAbove && widget.above)
				{ wrap.insertBefore(node, lineView.gutter || lineView.text); }
			else
				{ wrap.appendChild(node); }
			signalLater(widget, "redraw");
		}
	}

	function positionLineWidget(widget, node, lineView, dims) {
		if (widget.noHScroll) {
	(lineView.alignable || (lineView.alignable = [])).push(node);
			var width = dims.wrapperWidth;
			node.style.left = dims.fixedPos + "px";
			if (!widget.coverGutter) {
				width -= dims.gutterTotalWidth;
				node.style.paddingLeft = dims.gutterTotalWidth + "px";
			}
			node.style.width = width + "px";
		}
		if (widget.coverGutter) {
			node.style.zIndex = 5;
			node.style.position = "relative";
			if (!widget.noHScroll) { node.style.marginLeft = -dims.gutterTotalWidth + "px"; }
		}
	}

	function widgetHeight(widget) {
		if (widget.height != null) { return widget.height }
		var cm = widget.doc.cm;
		if (!cm) { return 0 }
		if (!contains(document.body, widget.node)) {
			var parentStyle = "position: relative;";
			if (widget.coverGutter)
				{ parentStyle += "margin-left: -" + cm.display.gutters.offsetWidth + "px;"; }
			if (widget.noHScroll)
				{ parentStyle += "width: " + cm.display.wrapper.clientWidth + "px;"; }
			removeChildrenAndAdd(cm.display.measure, elt("div", [widget.node], null, parentStyle));
		}
		return widget.height = widget.node.parentNode.offsetHeight
	}

	// Return true when the given mouse event happened in a widget
	function eventInWidget(display, e) {
		for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
			if (!n || (n.nodeType == 1 && n.getAttribute("cm-ignore-events") == "true") ||
					(n.parentNode == display.sizer && n != display.mover))
				{ return true }
		}
	}

	// POSITION MEASUREMENT

	function paddingTop(display) {return display.lineSpace.offsetTop}
	function paddingVert(display) {return display.mover.offsetHeight - display.lineSpace.offsetHeight}
	function paddingH(display) {
		if (display.cachedPaddingH) { return display.cachedPaddingH }
		var e = removeChildrenAndAdd(display.measure, elt("pre", "x", "CodeMirror-line-like"));
		var style = window.getComputedStyle ? window.getComputedStyle(e) : e.currentStyle;
		var data = {left: parseInt(style.paddingLeft), right: parseInt(style.paddingRight)};
		if (!isNaN(data.left) && !isNaN(data.right)) { display.cachedPaddingH = data; }
		return data
	}

	function scrollGap(cm) { return scrollerGap - cm.display.nativeBarWidth }
	function displayWidth(cm) {
		return cm.display.scroller.clientWidth - scrollGap(cm) - cm.display.barWidth
	}
	function displayHeight(cm) {
		return cm.display.scroller.clientHeight - scrollGap(cm) - cm.display.barHeight
	}

	// Ensure the lineView.wrapping.heights array is populated. This is
	// an array of bottom offsets for the lines that make up a drawn
	// line. When lineWrapping is on, there might be more than one
	// height.
	function ensureLineHeights(cm, lineView, rect) {
		var wrapping = cm.options.lineWrapping;
		var curWidth = wrapping && displayWidth(cm);
		if (!lineView.measure.heights || wrapping && lineView.measure.width != curWidth) {
			var heights = lineView.measure.heights = [];
			if (wrapping) {
				lineView.measure.width = curWidth;
				var rects = lineView.text.firstChild.getClientRects();
				for (var i = 0; i < rects.length - 1; i++) {
					var cur = rects[i], next = rects[i + 1];
					if (Math.abs(cur.bottom - next.bottom) > 2)
						{ heights.push((cur.bottom + next.top) / 2 - rect.top); }
				}
			}
			heights.push(rect.bottom - rect.top);
		}
	}

	// Find a line map (mapping character offsets to text nodes) and a
	// measurement cache for the given line number. (A line view might
	// contain multiple lines when collapsed ranges are present.)
	function mapFromLineView(lineView, line, lineN) {
		if (lineView.line == line)
			{ return {map: lineView.measure.map, cache: lineView.measure.cache} }
		if (lineView.rest) {
			for (var i = 0; i < lineView.rest.length; i++)
				{ if (lineView.rest[i] == line)
					{ return {map: lineView.measure.maps[i], cache: lineView.measure.caches[i]} } }
			for (var i$1 = 0; i$1 < lineView.rest.length; i$1++)
				{ if (lineNo(lineView.rest[i$1]) > lineN)
					{ return {map: lineView.measure.maps[i$1], cache: lineView.measure.caches[i$1], before: true} } }
		}
	}

	// Render a line into the hidden node display.externalMeasured. Used
	// when measurement is needed for a line that's not in the viewport.
	function updateExternalMeasurement(cm, line) {
		line = visualLine(line);
		var lineN = lineNo(line);
		var view = cm.display.externalMeasured = new LineView(cm.doc, line, lineN);
		view.lineN = lineN;
		var built = view.built = buildLineContent(cm, view);
		view.text = built.pre;
		removeChildrenAndAdd(cm.display.lineMeasure, built.pre);
		return view
	}

	// Get a {top, bottom, left, right} box (in line-local coordinates)
	// for a given character.
	function measureChar(cm, line, ch, bias) {
		return measureCharPrepared(cm, prepareMeasureForLine(cm, line), ch, bias)
	}

	// Find a line view that corresponds to the given line number.
	function findViewForLine(cm, lineN) {
		if (lineN >= cm.display.viewFrom && lineN < cm.display.viewTo)
			{ return cm.display.view[findViewIndex(cm, lineN)] }
		var ext = cm.display.externalMeasured;
		if (ext && lineN >= ext.lineN && lineN < ext.lineN + ext.size)
			{ return ext }
	}

	// Measurement can be split in two steps, the set-up work that
	// applies to the whole line, and the measurement of the actual
	// character. Functions like coordsChar, that need to do a lot of
	// measurements in a row, can thus ensure that the set-up work is
	// only done once.
	function prepareMeasureForLine(cm, line) {
		var lineN = lineNo(line);
		var view = findViewForLine(cm, lineN);
		if (view && !view.text) {
			view = null;
		} else if (view && view.changes) {
			updateLineForChanges(cm, view, lineN, getDimensions(cm));
			cm.curOp.forceUpdate = true;
		}
		if (!view)
			{ view = updateExternalMeasurement(cm, line); }

		var info = mapFromLineView(view, line, lineN);
		return {
			line: line, view: view, rect: null,
			map: info.map, cache: info.cache, before: info.before,
			hasHeights: false
		}
	}

	// Given a prepared measurement object, measures the position of an
	// actual character (or fetches it from the cache).
	function measureCharPrepared(cm, prepared, ch, bias, varHeight) {
		if (prepared.before) { ch = -1; }
		var key = ch + (bias || ""), found;
		if (prepared.cache.hasOwnProperty(key)) {
			found = prepared.cache[key];
		} else {
			if (!prepared.rect)
				{ prepared.rect = prepared.view.text.getBoundingClientRect(); }
			if (!prepared.hasHeights) {
				ensureLineHeights(cm, prepared.view, prepared.rect);
				prepared.hasHeights = true;
			}
			found = measureCharInner(cm, prepared, ch, bias);
			if (!found.bogus) { prepared.cache[key] = found; }
		}
		return {left: found.left, right: found.right,
						top: varHeight ? found.rtop : found.top,
						bottom: varHeight ? found.rbottom : found.bottom}
	}

	var nullRect = {left: 0, right: 0, top: 0, bottom: 0};

	function nodeAndOffsetInLineMap(map, ch, bias) {
		var node, start, end, collapse, mStart, mEnd;
		// First, search the line map for the text node corresponding to,
		// or closest to, the target character.
		for (var i = 0; i < map.length; i += 3) {
			mStart = map[i];
			mEnd = map[i + 1];
			if (ch < mStart) {
				start = 0; end = 1;
				collapse = "left";
			} else if (ch < mEnd) {
				start = ch - mStart;
				end = start + 1;
			} else if (i == map.length - 3 || ch == mEnd && map[i + 3] > ch) {
				end = mEnd - mStart;
				start = end - 1;
				if (ch >= mEnd) { collapse = "right"; }
			}
			if (start != null) {
				node = map[i + 2];
				if (mStart == mEnd && bias == (node.insertLeft ? "left" : "right"))
					{ collapse = bias; }
				if (bias == "left" && start == 0)
					{ while (i && map[i - 2] == map[i - 3] && map[i - 1].insertLeft) {
						node = map[(i -= 3) + 2];
						collapse = "left";
					} }
				if (bias == "right" && start == mEnd - mStart)
					{ while (i < map.length - 3 && map[i + 3] == map[i + 4] && !map[i + 5].insertLeft) {
						node = map[(i += 3) + 2];
						collapse = "right";
					} }
				break
			}
		}
		return {node: node, start: start, end: end, collapse: collapse, coverStart: mStart, coverEnd: mEnd}
	}

	function getUsefulRect(rects, bias) {
		var rect = nullRect;
		if (bias == "left") { for (var i = 0; i < rects.length; i++) {
			if ((rect = rects[i]).left != rect.right) { break }
		} } else { for (var i$1 = rects.length - 1; i$1 >= 0; i$1--) {
			if ((rect = rects[i$1]).left != rect.right) { break }
		} }
		return rect
	}

	function measureCharInner(cm, prepared, ch, bias) {
		var place = nodeAndOffsetInLineMap(prepared.map, ch, bias);
		var node = place.node, start = place.start, end = place.end, collapse = place.collapse;

		var rect;
		if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
			for (var i$1 = 0; i$1 < 4; i$1++) { // Retry a maximum of 4 times when nonsense rectangles are returned
				while (start && isExtendingChar(prepared.line.text.charAt(place.coverStart + start))) { --start; }
				while (place.coverStart + end < place.coverEnd && isExtendingChar(prepared.line.text.charAt(place.coverStart + end))) { ++end; }
				if (ie && ie_version < 9 && start == 0 && end == place.coverEnd - place.coverStart)
					{ rect = node.parentNode.getBoundingClientRect(); }
				else
					{ rect = getUsefulRect(range(node, start, end).getClientRects(), bias); }
				if (rect.left || rect.right || start == 0) { break }
				end = start;
				start = start - 1;
				collapse = "right";
			}
			if (ie && ie_version < 11) { rect = maybeUpdateRectForZooming(cm.display.measure, rect); }
		} else { // If it is a widget, simply get the box for the whole widget.
			if (start > 0) { collapse = bias = "right"; }
			var rects;
			if (cm.options.lineWrapping && (rects = node.getClientRects()).length > 1)
				{ rect = rects[bias == "right" ? rects.length - 1 : 0]; }
			else
				{ rect = node.getBoundingClientRect(); }
		}
		if (ie && ie_version < 9 && !start && (!rect || !rect.left && !rect.right)) {
			var rSpan = node.parentNode.getClientRects()[0];
			if (rSpan)
				{ rect = {left: rSpan.left, right: rSpan.left + charWidth(cm.display), top: rSpan.top, bottom: rSpan.bottom}; }
			else
				{ rect = nullRect; }
		}

		var rtop = rect.top - prepared.rect.top, rbot = rect.bottom - prepared.rect.top;
		var mid = (rtop + rbot) / 2;
		var heights = prepared.view.measure.heights;
		var i = 0;
		for (; i < heights.length - 1; i++)
			{ if (mid < heights[i]) { break } }
		var top = i ? heights[i - 1] : 0, bot = heights[i];
		var result = {left: (collapse == "right" ? rect.right : rect.left) - prepared.rect.left,
									right: (collapse == "left" ? rect.left : rect.right) - prepared.rect.left,
									top: top, bottom: bot};
		if (!rect.left && !rect.right) { result.bogus = true; }
		if (!cm.options.singleCursorHeightPerLine) { result.rtop = rtop; result.rbottom = rbot; }

		return result
	}

	// Work around problem with bounding client rects on ranges being
	// returned incorrectly when zoomed on IE10 and below.
	function maybeUpdateRectForZooming(measure, rect) {
		if (!window.screen || screen.logicalXDPI == null ||
				screen.logicalXDPI == screen.deviceXDPI || !hasBadZoomedRects(measure))
			{ return rect }
		var scaleX = screen.logicalXDPI / screen.deviceXDPI;
		var scaleY = screen.logicalYDPI / screen.deviceYDPI;
		return {left: rect.left * scaleX, right: rect.right * scaleX,
						top: rect.top * scaleY, bottom: rect.bottom * scaleY}
	}

	function clearLineMeasurementCacheFor(lineView) {
		if (lineView.measure) {
			lineView.measure.cache = {};
			lineView.measure.heights = null;
			if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
				{ lineView.measure.caches[i] = {}; } }
		}
	}

	function clearLineMeasurementCache(cm) {
		cm.display.externalMeasure = null;
		removeChildren(cm.display.lineMeasure);
		for (var i = 0; i < cm.display.view.length; i++)
			{ clearLineMeasurementCacheFor(cm.display.view[i]); }
	}

	function clearCaches(cm) {
		clearLineMeasurementCache(cm);
		cm.display.cachedCharWidth = cm.display.cachedTextHeight = cm.display.cachedPaddingH = null;
		if (!cm.options.lineWrapping) { cm.display.maxLineChanged = true; }
		cm.display.lineNumChars = null;
	}

	function pageScrollX(doc) {
		// Work around https://bugs.chromium.org/p/chromium/issues/detail?id=489206
		// which causes page_Offset and bounding client rects to use
		// different reference viewports and invalidate our calculations.
		if (chrome && android) { return -(doc.body.getBoundingClientRect().left - parseInt(getComputedStyle(doc.body).marginLeft)) }
		return doc.defaultView.pageXOffset || (doc.documentElement || doc.body).scrollLeft
	}
	function pageScrollY(doc) {
		if (chrome && android) { return -(doc.body.getBoundingClientRect().top - parseInt(getComputedStyle(doc.body).marginTop)) }
		return doc.defaultView.pageYOffset || (doc.documentElement || doc.body).scrollTop
	}

	function widgetTopHeight(lineObj) {
		var ref = visualLine(lineObj);
		var widgets = ref.widgets;
		var height = 0;
		if (widgets) { for (var i = 0; i < widgets.length; ++i) { if (widgets[i].above)
			{ height += widgetHeight(widgets[i]); } } }
		return height
	}

	// Converts a {top, bottom, left, right} box from line-local
	// coordinates into another coordinate system. Context may be one of
	// "line", "div" (display.lineDiv), "local"./null (editor), "window",
	// or "page".
	function intoCoordSystem(cm, lineObj, rect, context, includeWidgets) {
		if (!includeWidgets) {
			var height = widgetTopHeight(lineObj);
			rect.top += height; rect.bottom += height;
		}
		if (context == "line") { return rect }
		if (!context) { context = "local"; }
		var yOff = heightAtLine(lineObj);
		if (context == "local") { yOff += paddingTop(cm.display); }
		else { yOff -= cm.display.viewOffset; }
		if (context == "page" || context == "window") {
			var lOff = cm.display.lineSpace.getBoundingClientRect();
			yOff += lOff.top + (context == "window" ? 0 : pageScrollY(doc(cm)));
			var xOff = lOff.left + (context == "window" ? 0 : pageScrollX(doc(cm)));
			rect.left += xOff; rect.right += xOff;
		}
		rect.top += yOff; rect.bottom += yOff;
		return rect
	}

	// Coverts a box from "div" coords to another coordinate system.
	// Context may be "window", "page", "div", or "local"./null.
	function fromCoordSystem(cm, coords, context) {
		if (context == "div") { return coords }
		var left = coords.left, top = coords.top;
		// First move into "page" coordinate system
		if (context == "page") {
			left -= pageScrollX(doc(cm));
			top -= pageScrollY(doc(cm));
		} else if (context == "local" || !context) {
			var localBox = cm.display.sizer.getBoundingClientRect();
			left += localBox.left;
			top += localBox.top;
		}

		var lineSpaceBox = cm.display.lineSpace.getBoundingClientRect();
		return {left: left - lineSpaceBox.left, top: top - lineSpaceBox.top}
	}

	function charCoords(cm, pos, context, lineObj, bias) {
		if (!lineObj) { lineObj = getLine(cm.doc, pos.line); }
		return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch, bias), context)
	}

	// Returns a box for a given cursor position, which may have an
	// 'other' property containing the position of the secondary cursor
	// on a bidi boundary.
	// A cursor Pos(line, char, "before") is on the same visual line as `char - 1`
	// and after `char - 1` in writing order of `char - 1`
	// A cursor Pos(line, char, "after") is on the same visual line as `char`
	// and before `char` in writing order of `char`
	// Examples (upper-case letters are RTL, lower-case are LTR):
	//     Pos(0, 1, ...)
	//     before   after
	// ab     a|b     a|b
	// aB     a|B     aB|
	// Ab     |Ab     A|b
	// AB     B|A     B|A
	// Every position after the last character on a line is considered to stick
	// to the last character on the line.
	function cursorCoords(cm, pos, context, lineObj, preparedMeasure, varHeight) {
		lineObj = lineObj || getLine(cm.doc, pos.line);
		if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj); }
		function get(ch, right) {
			var m = measureCharPrepared(cm, preparedMeasure, ch, right ? "right" : "left", varHeight);
			if (right) { m.left = m.right; } else { m.right = m.left; }
			return intoCoordSystem(cm, lineObj, m, context)
		}
		var order = getOrder(lineObj, cm.doc.direction), ch = pos.ch, sticky = pos.sticky;
		if (ch >= lineObj.text.length) {
			ch = lineObj.text.length;
			sticky = "before";
		} else if (ch <= 0) {
			ch = 0;
			sticky = "after";
		}
		if (!order) { return get(sticky == "before" ? ch - 1 : ch, sticky == "before") }

		function getBidi(ch, partPos, invert) {
			var part = order[partPos], right = part.level == 1;
			return get(invert ? ch - 1 : ch, right != invert)
		}
		var partPos = getBidiPartAt(order, ch, sticky);
		var other = bidiOther;
		var val = getBidi(ch, partPos, sticky == "before");
		if (other != null) { val.other = getBidi(ch, other, sticky != "before"); }
		return val
	}

	// Used to cheaply estimate the coordinates for a position. Used for
	// intermediate scroll updates.
	function estimateCoords(cm, pos) {
		var left = 0;
		pos = clipPos(cm.doc, pos);
		if (!cm.options.lineWrapping) { left = charWidth(cm.display) * pos.ch; }
		var lineObj = getLine(cm.doc, pos.line);
		var top = heightAtLine(lineObj) + paddingTop(cm.display);
		return {left: left, right: left, top: top, bottom: top + lineObj.height}
	}

	// Positions returned by coordsChar contain some extra information.
	// xRel is the relative x position of the input coordinates compared
	// to the found position (so xRel > 0 means the coordinates are to
	// the right of the character position, for example). When outside
	// is true, that means the coordinates lie outside the line's
	// vertical range.
	function PosWithInfo(line, ch, sticky, outside, xRel) {
		var pos = Pos(line, ch, sticky);
		pos.xRel = xRel;
		if (outside) { pos.outside = outside; }
		return pos
	}

	// Compute the character position closest to the given coordinates.
	// Input must be lineSpace-local ("div" coordinate system).
	function coordsChar(cm, x, y) {
		var doc = cm.doc;
		y += cm.display.viewOffset;
		if (y < 0) { return PosWithInfo(doc.first, 0, null, -1, -1) }
		var lineN = lineAtHeight(doc, y), last = doc.first + doc.size - 1;
		if (lineN > last)
			{ return PosWithInfo(doc.first + doc.size - 1, getLine(doc, last).text.length, null, 1, 1) }
		if (x < 0) { x = 0; }

		var lineObj = getLine(doc, lineN);
		for (;;) {
			var found = coordsCharInner(cm, lineObj, lineN, x, y);
			var collapsed = collapsedSpanAround(lineObj, found.ch + (found.xRel > 0 || found.outside > 0 ? 1 : 0));
			if (!collapsed) { return found }
			var rangeEnd = collapsed.find(1);
			if (rangeEnd.line == lineN) { return rangeEnd }
			lineObj = getLine(doc, lineN = rangeEnd.line);
		}
	}

	function wrappedLineExtent(cm, lineObj, preparedMeasure, y) {
		y -= widgetTopHeight(lineObj);
		var end = lineObj.text.length;
		var begin = findFirst(function (ch) { return measureCharPrepared(cm, preparedMeasure, ch - 1).bottom <= y; }, end, 0);
		end = findFirst(function (ch) { return measureCharPrepared(cm, preparedMeasure, ch).top > y; }, begin, end);
		return {begin: begin, end: end}
	}

	function wrappedLineExtentChar(cm, lineObj, preparedMeasure, target) {
		if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj); }
		var targetTop = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, target), "line").top;
		return wrappedLineExtent(cm, lineObj, preparedMeasure, targetTop)
	}

	// Returns true if the given side of a box is after the given
	// coordinates, in top-to-bottom, left-to-right order.
	function boxIsAfter(box, x, y, left) {
		return box.bottom <= y ? false : box.top > y ? true : (left ? box.left : box.right) > x
	}

	function coordsCharInner(cm, lineObj, lineNo, x, y) {
		// Move y into line-local coordinate space
		y -= heightAtLine(lineObj);
		var preparedMeasure = prepareMeasureForLine(cm, lineObj);
		// When directly calling `measureCharPrepared`, we have to adjust
		// for the widgets at this line.
		var widgetHeight = widgetTopHeight(lineObj);
		var begin = 0, end = lineObj.text.length, ltr = true;

		var order = getOrder(lineObj, cm.doc.direction);
		// If the line isn't plain left-to-right text, first figure out
		// which bidi section the coordinates fall into.
		if (order) {
			var part = (cm.options.lineWrapping ? coordsBidiPartWrapped : coordsBidiPart)
									 (cm, lineObj, lineNo, preparedMeasure, order, x, y);
			ltr = part.level != 1;
			// The awkward -1 offsets are needed because findFirst (called
			// on these below) will treat its first bound as inclusive,
			// second as exclusive, but we want to actually address the
			// characters in the part's range
			begin = ltr ? part.from : part.to - 1;
			end = ltr ? part.to : part.from - 1;
		}

		// A binary search to find the first character whose bounding box
		// starts after the coordinates. If we run across any whose box wrap
		// the coordinates, store that.
		var chAround = null, boxAround = null;
		var ch = findFirst(function (ch) {
			var box = measureCharPrepared(cm, preparedMeasure, ch);
			box.top += widgetHeight; box.bottom += widgetHeight;
			if (!boxIsAfter(box, x, y, false)) { return false }
			if (box.top <= y && box.left <= x) {
				chAround = ch;
				boxAround = box;
			}
			return true
		}, begin, end);

		var baseX, sticky, outside = false;
		// If a box around the coordinates was found, use that
		if (boxAround) {
			// Distinguish coordinates nearer to the left or right side of the box
			var atLeft = x - boxAround.left < boxAround.right - x, atStart = atLeft == ltr;
			ch = chAround + (atStart ? 0 : 1);
			sticky = atStart ? "after" : "before";
			baseX = atLeft ? boxAround.left : boxAround.right;
		} else {
			// (Adjust for extended bound, if necessary.)
			if (!ltr && (ch == end || ch == begin)) { ch++; }
			// To determine which side to associate with, get the box to the
			// left of the character and compare it's vertical position to the
			// coordinates
			sticky = ch == 0 ? "after" : ch == lineObj.text.length ? "before" :
				(measureCharPrepared(cm, preparedMeasure, ch - (ltr ? 1 : 0)).bottom + widgetHeight <= y) == ltr ?
				"after" : "before";
			// Now get accurate coordinates for this place, in order to get a
			// base X position
			var coords = cursorCoords(cm, Pos(lineNo, ch, sticky), "line", lineObj, preparedMeasure);
			baseX = coords.left;
			outside = y < coords.top ? -1 : y >= coords.bottom ? 1 : 0;
		}

		ch = skipExtendingChars(lineObj.text, ch, 1);
		return PosWithInfo(lineNo, ch, sticky, outside, x - baseX)
	}

	function coordsBidiPart(cm, lineObj, lineNo, preparedMeasure, order, x, y) {
		// Bidi parts are sorted left-to-right, and in a non-line-wrapping
		// situation, we can take this ordering to correspond to the visual
		// ordering. This finds the first part whose end is after the given
		// coordinates.
		var index = findFirst(function (i) {
			var part = order[i], ltr = part.level != 1;
			return boxIsAfter(cursorCoords(cm, Pos(lineNo, ltr ? part.to : part.from, ltr ? "before" : "after"),
																		 "line", lineObj, preparedMeasure), x, y, true)
		}, 0, order.length - 1);
		var part = order[index];
		// If this isn't the first part, the part's start is also after
		// the coordinates, and the coordinates aren't on the same line as
		// that start, move one part back.
		if (index > 0) {
			var ltr = part.level != 1;
			var start = cursorCoords(cm, Pos(lineNo, ltr ? part.from : part.to, ltr ? "after" : "before"),
															 "line", lineObj, preparedMeasure);
			if (boxIsAfter(start, x, y, true) && start.top > y)
				{ part = order[index - 1]; }
		}
		return part
	}

	function coordsBidiPartWrapped(cm, lineObj, _lineNo, preparedMeasure, order, x, y) {
		// In a wrapped line, rtl text on wrapping boundaries can do things
		// that don't correspond to the ordering in our `order` array at
		// all, so a binary search doesn't work, and we want to return a
		// part that only spans one line so that the binary search in
		// coordsCharInner is safe. As such, we first find the extent of the
		// wrapped line, and then do a flat search in which we discard any
		// spans that aren't on the line.
		var ref = wrappedLineExtent(cm, lineObj, preparedMeasure, y);
		var begin = ref.begin;
		var end = ref.end;
		if (/\s/.test(lineObj.text.charAt(end - 1))) { end--; }
		var part = null, closestDist = null;
		for (var i = 0; i < order.length; i++) {
			var p = order[i];
			if (p.from >= end || p.to <= begin) { continue }
			var ltr = p.level != 1;
			var endX = measureCharPrepared(cm, preparedMeasure, ltr ? Math.min(end, p.to) - 1 : Math.max(begin, p.from)).right;
			// Weigh against spans ending before this, so that they are only
			// picked if nothing ends after
			var dist = endX < x ? x - endX + 1e9 : endX - x;
			if (!part || closestDist > dist) {
				part = p;
				closestDist = dist;
			}
		}
		if (!part) { part = order[order.length - 1]; }
		// Clip the part to the wrapped line.
		if (part.from < begin) { part = {from: begin, to: part.to, level: part.level}; }
		if (part.to > end) { part = {from: part.from, to: end, level: part.level}; }
		return part
	}

	var measureText;
	// Compute the default text height.
	function textHeight(display) {
		if (display.cachedTextHeight != null) { return display.cachedTextHeight }
		if (measureText == null) {
			measureText = elt("pre", null, "CodeMirror-line-like");
			// Measure a bunch of lines, for browsers that compute
			// fractional heights.
			for (var i = 0; i < 49; ++i) {
				measureText.appendChild(document.createTextNode("x"));
				measureText.appendChild(elt("br"));
			}
			measureText.appendChild(document.createTextNode("x"));
		}
		removeChildrenAndAdd(display.measure, measureText);
		var height = measureText.offsetHeight / 50;
		if (height > 3) { display.cachedTextHeight = height; }
		removeChildren(display.measure);
		return height || 1
	}

	// Compute the default character width.
	function charWidth(display) {
		if (display.cachedCharWidth != null) { return display.cachedCharWidth }
		var anchor = elt("span", "xxxxxxxxxx");
		var pre = elt("pre", [anchor], "CodeMirror-line-like");
		removeChildrenAndAdd(display.measure, pre);
		var rect = anchor.getBoundingClientRect(), width = (rect.right - rect.left) / 10;
		if (width > 2) { display.cachedCharWidth = width; }
		return width || 10
	}

	// Do a bulk-read of the DOM positions and sizes needed to draw the
	// view, so that we don't interleave reading and writing to the DOM.
	function getDimensions(cm) {
		var d = cm.display, left = {}, width = {};
		var gutterLeft = d.gutters.clientLeft;
		for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
			var id = cm.display.gutterSpecs[i].className;
			left[id] = n.offsetLeft + n.clientLeft + gutterLeft;
			width[id] = n.clientWidth;
		}
		return {fixedPos: compensateForHScroll(d),
						gutterTotalWidth: d.gutters.offsetWidth,
						gutterLeft: left,
						gutterWidth: width,
						wrapperWidth: d.wrapper.clientWidth}
	}

	// Computes display.scroller.scrollLeft + display.gutters.offsetWidth,
	// but using getBoundingClientRect to get a sub-pixel-accurate
	// result.
	function compensateForHScroll(display) {
		return display.scroller.getBoundingClientRect().left - display.sizer.getBoundingClientRect().left
	}

	// Returns a function that estimates the height of a line, to use as
	// first approximation until the line becomes visible (and is thus
	// properly measurable).
	function estimateHeight(cm) {
		var th = textHeight(cm.display), wrapping = cm.options.lineWrapping;
		var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3);
		return function (line) {
			if (lineIsHidden(cm.doc, line)) { return 0 }

			var widgetsHeight = 0;
			if (line.widgets) { for (var i = 0; i < line.widgets.length; i++) {
				if (line.widgets[i].height) { widgetsHeight += line.widgets[i].height; }
			} }

			if (wrapping)
				{ return widgetsHeight + (Math.ceil(line.text.length / perLine) || 1) * th }
			else
				{ return widgetsHeight + th }
		}
	}

	function estimateLineHeights(cm) {
		var doc = cm.doc, est = estimateHeight(cm);
		doc.iter(function (line) {
			var estHeight = est(line);
			if (estHeight != line.height) { updateLineHeight(line, estHeight); }
		});
	}

	// Given a mouse event, find the corresponding position. If liberal
	// is false, it checks whether a gutter or scrollbar was clicked,
	// and returns null if it was. forRect is used by rectangular
	// selections, and tries to estimate a character position even for
	// coordinates beyond the right of the text.
	function posFromMouse(cm, e, liberal, forRect) {
		var display = cm.display;
		if (!liberal && e_target(e).getAttribute("cm-not-content") == "true") { return null }

		var x, y, space = display.lineSpace.getBoundingClientRect();
		// Fails unpredictably on IE[67] when mouse is dragged around quickly.
		try { x = e.clientX - space.left; y = e.clientY - space.top; }
		catch (e$1) { return null }
		var coords = coordsChar(cm, x, y), line;
		if (forRect && coords.xRel > 0 && (line = getLine(cm.doc, coords.line).text).length == coords.ch) {
			var colDiff = countColumn(line, line.length, cm.options.tabSize) - line.length;
			coords = Pos(coords.line, Math.max(0, Math.round((x - paddingH(cm.display).left) / charWidth(cm.display)) - colDiff));
		}
		return coords
	}

	// Find the view element corresponding to a given line. Return null
	// when the line isn't visible.
	function findViewIndex(cm, n) {
		if (n >= cm.display.viewTo) { return null }
		n -= cm.display.viewFrom;
		if (n < 0) { return null }
		var view = cm.display.view;
		for (var i = 0; i < view.length; i++) {
			n -= view[i].size;
			if (n < 0) { return i }
		}
	}

	// Updates the display.view data structure for a given change to the
	// document. From and to are in pre-change coordinates. Lendiff is
	// the amount of lines added or subtracted by the change. This is
	// used for changes that span multiple lines, or change the way
	// lines are divided into visual lines. regLineChange (below)
	// registers single-line changes.
	function regChange(cm, from, to, lendiff) {
		if (from == null) { from = cm.doc.first; }
		if (to == null) { to = cm.doc.first + cm.doc.size; }
		if (!lendiff) { lendiff = 0; }

		var display = cm.display;
		if (lendiff && to < display.viewTo &&
				(display.updateLineNumbers == null || display.updateLineNumbers > from))
			{ display.updateLineNumbers = from; }

		cm.curOp.viewChanged = true;

		if (from >= display.viewTo) { // Change after
			if (sawCollapsedSpans && visualLineNo(cm.doc, from) < display.viewTo)
				{ resetView(cm); }
		} else if (to <= display.viewFrom) { // Change before
			if (sawCollapsedSpans && visualLineEndNo(cm.doc, to + lendiff) > display.viewFrom) {
				resetView(cm);
			} else {
				display.viewFrom += lendiff;
				display.viewTo += lendiff;
			}
		} else if (from <= display.viewFrom && to >= display.viewTo) { // Full overlap
			resetView(cm);
		} else if (from <= display.viewFrom) { // Top overlap
			var cut = viewCuttingPoint(cm, to, to + lendiff, 1);
			if (cut) {
				display.view = display.view.slice(cut.index);
				display.viewFrom = cut.lineN;
				display.viewTo += lendiff;
			} else {
				resetView(cm);
			}
		} else if (to >= display.viewTo) { // Bottom overlap
			var cut$1 = viewCuttingPoint(cm, from, from, -1);
			if (cut$1) {
				display.view = display.view.slice(0, cut$1.index);
				display.viewTo = cut$1.lineN;
			} else {
				resetView(cm);
			}
		} else { // Gap in the middle
			var cutTop = viewCuttingPoint(cm, from, from, -1);
			var cutBot = viewCuttingPoint(cm, to, to + lendiff, 1);
			if (cutTop && cutBot) {
				display.view = display.view.slice(0, cutTop.index)
					.concat(buildViewArray(cm, cutTop.lineN, cutBot.lineN))
					.concat(display.view.slice(cutBot.index));
				display.viewTo += lendiff;
			} else {
				resetView(cm);
			}
		}

		var ext = display.externalMeasured;
		if (ext) {
			if (to < ext.lineN)
				{ ext.lineN += lendiff; }
			else if (from < ext.lineN + ext.size)
				{ display.externalMeasured = null; }
		}
	}

	// Register a change to a single line. Type must be one of "text",
	// "gutter", "class", "widget"
	function regLineChange(cm, line, type) {
		cm.curOp.viewChanged = true;
		var display = cm.display, ext = cm.display.externalMeasured;
		if (ext && line >= ext.lineN && line < ext.lineN + ext.size)
			{ display.externalMeasured = null; }

		if (line < display.viewFrom || line >= display.viewTo) { return }
		var lineView = display.view[findViewIndex(cm, line)];
		if (lineView.node == null) { return }
		var arr = lineView.changes || (lineView.changes = []);
		if (indexOf(arr, type) == -1) { arr.push(type); }
	}

	// Clear the view.
	function resetView(cm) {
		cm.display.viewFrom = cm.display.viewTo = cm.doc.first;
		cm.display.view = [];
		cm.display.viewOffset = 0;
	}

	function viewCuttingPoint(cm, oldN, newN, dir) {
		var index = findViewIndex(cm, oldN), diff, view = cm.display.view;
		if (!sawCollapsedSpans || newN == cm.doc.first + cm.doc.size)
			{ return {index: index, lineN: newN} }
		var n = cm.display.viewFrom;
		for (var i = 0; i < index; i++)
			{ n += view[i].size; }
		if (n != oldN) {
			if (dir > 0) {
				if (index == view.length - 1) { return null }
				diff = (n + view[index].size) - oldN;
				index++;
			} else {
				diff = n - oldN;
			}
			oldN += diff; newN += diff;
		}
		while (visualLineNo(cm.doc, newN) != newN) {
			if (index == (dir < 0 ? 0 : view.length - 1)) { return null }
			newN += dir * view[index - (dir < 0 ? 1 : 0)].size;
			index += dir;
		}
		return {index: index, lineN: newN}
	}

	// Force the view to cover a given range, adding empty view element
	// or clipping off existing ones as needed.
	function adjustView(cm, from, to) {
		var display = cm.display, view = display.view;
		if (view.length == 0 || from >= display.viewTo || to <= display.viewFrom) {
			display.view = buildViewArray(cm, from, to);
			display.viewFrom = from;
		} else {
			if (display.viewFrom > from)
				{ display.view = buildViewArray(cm, from, display.viewFrom).concat(display.view); }
			else if (display.viewFrom < from)
				{ display.view = display.view.slice(findViewIndex(cm, from)); }
			display.viewFrom = from;
			if (display.viewTo < to)
				{ display.view = display.view.concat(buildViewArray(cm, display.viewTo, to)); }
			else if (display.viewTo > to)
				{ display.view = display.view.slice(0, findViewIndex(cm, to)); }
		}
		display.viewTo = to;
	}

	// Count the number of lines in the view whose DOM representation is
	// out of date (or nonexistent).
	function countDirtyView(cm) {
		var view = cm.display.view, dirty = 0;
		for (var i = 0; i < view.length; i++) {
			var lineView = view[i];
			if (!lineView.hidden && (!lineView.node || lineView.changes)) { ++dirty; }
		}
		return dirty
	}

	function updateSelection(cm) {
		cm.display.input.showSelection(cm.display.input.prepareSelection());
	}

	function prepareSelection(cm, primary) {
		if ( primary === void 0 ) primary = true;

		var doc = cm.doc, result = {};
		var curFragment = result.cursors = document.createDocumentFragment();
		var selFragment = result.selection = document.createDocumentFragment();

		var customCursor = cm.options.$customCursor;
		if (customCursor) { primary = true; }
		for (var i = 0; i < doc.sel.ranges.length; i++) {
			if (!primary && i == doc.sel.primIndex) { continue }
			var range = doc.sel.ranges[i];
			if (range.from().line >= cm.display.viewTo || range.to().line < cm.display.viewFrom) { continue }
			var collapsed = range.empty();
			if (customCursor) {
				var head = customCursor(cm, range);
				if (head) { drawSelectionCursor(cm, head, curFragment); }
			} else if (collapsed || cm.options.showCursorWhenSelecting) {
				drawSelectionCursor(cm, range.head, curFragment);
			}
			if (!collapsed)
				{ drawSelectionRange(cm, range, selFragment); }
		}
		return result
	}

	// Draws a cursor for the given range
	function drawSelectionCursor(cm, head, output) {
		var pos = cursorCoords(cm, head, "div", null, null, !cm.options.singleCursorHeightPerLine);

		var cursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor"));
		cursor.style.left = pos.left + "px";
		cursor.style.top = pos.top + "px";
		cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px";

		if (/\bcm-fat-cursor\b/.test(cm.getWrapperElement().className)) {
			var charPos = charCoords(cm, head, "div", null, null);
			var width = charPos.right - charPos.left;
			cursor.style.width = (width > 0 ? width : cm.defaultCharWidth()) + "px";
		}

		if (pos.other) {
			// Secondary cursor, shown when on a 'jump' in bi-directional text
			var otherCursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor CodeMirror-secondarycursor"));
			otherCursor.style.display = "";
			otherCursor.style.left = pos.other.left + "px";
			otherCursor.style.top = pos.other.top + "px";
			otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px";
		}
	}

	function cmpCoords(a, b) { return a.top - b.top || a.left - b.left }

	// Draws the given range as a highlighted selection
	function drawSelectionRange(cm, range, output) {
		var display = cm.display, doc = cm.doc;
		var fragment = document.createDocumentFragment();
		var padding = paddingH(cm.display), leftSide = padding.left;
		var rightSide = Math.max(display.sizerWidth, displayWidth(cm) - display.sizer.offsetLeft) - padding.right;
		var docLTR = doc.direction == "ltr";

		function add(left, top, width, bottom) {
			if (top < 0) { top = 0; }
			top = Math.round(top);
			bottom = Math.round(bottom);
			fragment.appendChild(elt("div", null, "CodeMirror-selected", ("position: absolute; left: " + left + "px;\n                             top: " + top + "px; width: " + (width == null ? rightSide - left : width) + "px;\n                             height: " + (bottom - top) + "px")));
		}

		function drawForLine(line, fromArg, toArg) {
			var lineObj = getLine(doc, line);
			var lineLen = lineObj.text.length;
			var start, end;
			function coords(ch, bias) {
				return charCoords(cm, Pos(line, ch), "div", lineObj, bias)
			}

			function wrapX(pos, dir, side) {
				var extent = wrappedLineExtentChar(cm, lineObj, null, pos);
				var prop = (dir == "ltr") == (side == "after") ? "left" : "right";
				var ch = side == "after" ? extent.begin : extent.end - (/\s/.test(lineObj.text.charAt(extent.end - 1)) ? 2 : 1);
				return coords(ch, prop)[prop]
			}

			var order = getOrder(lineObj, doc.direction);
			iterateBidiSections(order, fromArg || 0, toArg == null ? lineLen : toArg, function (from, to, dir, i) {
				var ltr = dir == "ltr";
				var fromPos = coords(from, ltr ? "left" : "right");
				var toPos = coords(to - 1, ltr ? "right" : "left");

				var openStart = fromArg == null && from == 0, openEnd = toArg == null && to == lineLen;
				var first = i == 0, last = !order || i == order.length - 1;
				if (toPos.top - fromPos.top <= 3) { // Single line
					var openLeft = (docLTR ? openStart : openEnd) && first;
					var openRight = (docLTR ? openEnd : openStart) && last;
					var left = openLeft ? leftSide : (ltr ? fromPos : toPos).left;
					var right = openRight ? rightSide : (ltr ? toPos : fromPos).right;
					add(left, fromPos.top, right - left, fromPos.bottom);
				} else { // Multiple lines
					var topLeft, topRight, botLeft, botRight;
					if (ltr) {
						topLeft = docLTR && openStart && first ? leftSide : fromPos.left;
						topRight = docLTR ? rightSide : wrapX(from, dir, "before");
						botLeft = docLTR ? leftSide : wrapX(to, dir, "after");
						botRight = docLTR && openEnd && last ? rightSide : toPos.right;
					} else {
						topLeft = !docLTR ? leftSide : wrapX(from, dir, "before");
						topRight = !docLTR && openStart && first ? rightSide : fromPos.right;
						botLeft = !docLTR && openEnd && last ? leftSide : toPos.left;
						botRight = !docLTR ? rightSide : wrapX(to, dir, "after");
					}
					add(topLeft, fromPos.top, topRight - topLeft, fromPos.bottom);
					if (fromPos.bottom < toPos.top) { add(leftSide, fromPos.bottom, null, toPos.top); }
					add(botLeft, toPos.top, botRight - botLeft, toPos.bottom);
				}

				if (!start || cmpCoords(fromPos, start) < 0) { start = fromPos; }
				if (cmpCoords(toPos, start) < 0) { start = toPos; }
				if (!end || cmpCoords(fromPos, end) < 0) { end = fromPos; }
				if (cmpCoords(toPos, end) < 0) { end = toPos; }
			});
			return {start: start, end: end}
		}

		var sFrom = range.from(), sTo = range.to();
		if (sFrom.line == sTo.line) {
			drawForLine(sFrom.line, sFrom.ch, sTo.ch);
		} else {
			var fromLine = getLine(doc, sFrom.line), toLine = getLine(doc, sTo.line);
			var singleVLine = visualLine(fromLine) == visualLine(toLine);
			var leftEnd = drawForLine(sFrom.line, sFrom.ch, singleVLine ? fromLine.text.length + 1 : null).end;
			var rightStart = drawForLine(sTo.line, singleVLine ? 0 : null, sTo.ch).start;
			if (singleVLine) {
				if (leftEnd.top < rightStart.top - 2) {
					add(leftEnd.right, leftEnd.top, null, leftEnd.bottom);
					add(leftSide, rightStart.top, rightStart.left, rightStart.bottom);
				} else {
					add(leftEnd.right, leftEnd.top, rightStart.left - leftEnd.right, leftEnd.bottom);
				}
			}
			if (leftEnd.bottom < rightStart.top)
				{ add(leftSide, leftEnd.bottom, null, rightStart.top); }
		}

		output.appendChild(fragment);
	}

	// Cursor-blinking
	function restartBlink(cm) {
		if (!cm.state.focused) { return }
		var display = cm.display;
		clearInterval(display.blinker);
		var on = true;
		display.cursorDiv.style.visibility = "";
		if (cm.options.cursorBlinkRate > 0)
			{ display.blinker = setInterval(function () {
				if (!cm.hasFocus()) { onBlur(cm); }
				display.cursorDiv.style.visibility = (on = !on) ? "" : "hidden";
			}, cm.options.cursorBlinkRate); }
		else if (cm.options.cursorBlinkRate < 0)
			{ display.cursorDiv.style.visibility = "hidden"; }
	}

	function ensureFocus(cm) {
		if (!cm.hasFocus()) {
			cm.display.input.focus();
			if (!cm.state.focused) { onFocus(cm); }
		}
	}

	function delayBlurEvent(cm) {
		cm.state.delayingBlurEvent = true;
		setTimeout(function () { if (cm.state.delayingBlurEvent) {
			cm.state.delayingBlurEvent = false;
			if (cm.state.focused) { onBlur(cm); }
		} }, 100);
	}

	function onFocus(cm, e) {
		if (cm.state.delayingBlurEvent && !cm.state.draggingText) { cm.state.delayingBlurEvent = false; }

		if (cm.options.readOnly == "nocursor") { return }
		if (!cm.state.focused) {
			signal(cm, "focus", cm, e);
			cm.state.focused = true;
			addClass(cm.display.wrapper, "CodeMirror-focused");
			// This test prevents this from firing when a context
			// menu is closed (since the input reset would kill the
			// select-all detection hack)
			if (!cm.curOp && cm.display.selForContextMenu != cm.doc.sel) {
				cm.display.input.reset();
				if (webkit) { setTimeout(function () { return cm.display.input.reset(true); }, 20); } // Issue #1730
			}
			cm.display.input.receivedFocus();
		}
		restartBlink(cm);
	}
	function onBlur(cm, e) {
		if (cm.state.delayingBlurEvent) { return }

		if (cm.state.focused) {
			signal(cm, "blur", cm, e);
			cm.state.focused = false;
			rmClass(cm.display.wrapper, "CodeMirror-focused");
		}
		clearInterval(cm.display.blinker);
		setTimeout(function () { if (!cm.state.focused) { cm.display.shift = false; } }, 150);
	}

	// Read the actual heights of the rendered lines, and update their
	// stored heights to match.
	function updateHeightsInViewport(cm) {
		var display = cm.display;
		var prevBottom = display.lineDiv.offsetTop;
		var viewTop = Math.max(0, display.scroller.getBoundingClientRect().top);
		var oldHeight = display.lineDiv.getBoundingClientRect().top;
		var mustScroll = 0;
		for (var i = 0; i < display.view.length; i++) {
			var cur = display.view[i], wrapping = cm.options.lineWrapping;
			var height = (void 0), width = 0;
			if (cur.hidden) { continue }
			oldHeight += cur.line.height;
			if (ie && ie_version < 8) {
				var bot = cur.node.offsetTop + cur.node.offsetHeight;
				height = bot - prevBottom;
				prevBottom = bot;
			} else {
				var box = cur.node.getBoundingClientRect();
				height = box.bottom - box.top;
				// Check that lines don't extend past the right of the current
				// editor width
				if (!wrapping && cur.text.firstChild)
					{ width = cur.text.firstChild.getBoundingClientRect().right - box.left - 1; }
			}
			var diff = cur.line.height - height;
			if (diff > .005 || diff < -.005) {
				if (oldHeight < viewTop) { mustScroll -= diff; }
				updateLineHeight(cur.line, height);
				updateWidgetHeight(cur.line);
				if (cur.rest) { for (var j = 0; j < cur.rest.length; j++)
					{ updateWidgetHeight(cur.rest[j]); } }
			}
			if (width > cm.display.sizerWidth) {
				var chWidth = Math.ceil(width / charWidth(cm.display));
				if (chWidth > cm.display.maxLineLength) {
					cm.display.maxLineLength = chWidth;
					cm.display.maxLine = cur.line;
					cm.display.maxLineChanged = true;
				}
			}
		}
		if (Math.abs(mustScroll) > 2) { display.scroller.scrollTop += mustScroll; }
	}

	// Read and store the height of line widgets associated with the
	// given line.
	function updateWidgetHeight(line) {
		if (line.widgets) { for (var i = 0; i < line.widgets.length; ++i) {
			var w = line.widgets[i], parent = w.node.parentNode;
			if (parent) { w.height = parent.offsetHeight; }
		} }
	}

	// Compute the lines that are visible in a given viewport (defaults
	// the the current scroll position). viewport may contain top,
	// height, and ensure (see op.scrollToPos) properties.
	function visibleLines(display, doc, viewport) {
		var top = viewport && viewport.top != null ? Math.max(0, viewport.top) : display.scroller.scrollTop;
		top = Math.floor(top - paddingTop(display));
		var bottom = viewport && viewport.bottom != null ? viewport.bottom : top + display.wrapper.clientHeight;

		var from = lineAtHeight(doc, top), to = lineAtHeight(doc, bottom);
		// Ensure is a {from: {line, ch}, to: {line, ch}} object, and
		// forces those lines into the viewport (if possible).
		if (viewport && viewport.ensure) {
			var ensureFrom = viewport.ensure.from.line, ensureTo = viewport.ensure.to.line;
			if (ensureFrom < from) {
				from = ensureFrom;
				to = lineAtHeight(doc, heightAtLine(getLine(doc, ensureFrom)) + display.wrapper.clientHeight);
			} else if (Math.min(ensureTo, doc.lastLine()) >= to) {
				from = lineAtHeight(doc, heightAtLine(getLine(doc, ensureTo)) - display.wrapper.clientHeight);
				to = ensureTo;
			}
		}
		return {from: from, to: Math.max(to, from + 1)}
	}

	// SCROLLING THINGS INTO VIEW

	// If an editor sits on the top or bottom of the window, partially
	// scrolled out of view, this ensures that the cursor is visible.
	function maybeScrollWindow(cm, rect) {
		if (signalDOMEvent(cm, "scrollCursorIntoView")) { return }

		var display = cm.display, box = display.sizer.getBoundingClientRect(), doScroll = null;
		var doc = display.wrapper.ownerDocument;
		if (rect.top + box.top < 0) { doScroll = true; }
		else if (rect.bottom + box.top > (doc.defaultView.innerHeight || doc.documentElement.clientHeight)) { doScroll = false; }
		if (doScroll != null && !phantom) {
			var scrollNode = elt("div", "\u200b", null, ("position: absolute;\n                         top: " + (rect.top - display.viewOffset - paddingTop(cm.display)) + "px;\n                         height: " + (rect.bottom - rect.top + scrollGap(cm) + display.barHeight) + "px;\n                         left: " + (rect.left) + "px; width: " + (Math.max(2, rect.right - rect.left)) + "px;"));
			cm.display.lineSpace.appendChild(scrollNode);
			scrollNode.scrollIntoView(doScroll);
			cm.display.lineSpace.removeChild(scrollNode);
		}
	}

	// Scroll a given position into view (immediately), verifying that
	// it actually became visible (as line heights are accurately
	// measured, the position of something may 'drift' during drawing).
	function scrollPosIntoView(cm, pos, end, margin) {
		if (margin == null) { margin = 0; }
		var rect;
		if (!cm.options.lineWrapping && pos == end) {
			// Set pos and end to the cursor positions around the character pos sticks to
			// If pos.sticky == "before", that is around pos.ch - 1, otherwise around pos.ch
			// If pos == Pos(_, 0, "before"), pos and end are unchanged
			end = pos.sticky == "before" ? Pos(pos.line, pos.ch + 1, "before") : pos;
			pos = pos.ch ? Pos(pos.line, pos.sticky == "before" ? pos.ch - 1 : pos.ch, "after") : pos;
		}
		for (var limit = 0; limit < 5; limit++) {
			var changed = false;
			var coords = cursorCoords(cm, pos);
			var endCoords = !end || end == pos ? coords : cursorCoords(cm, end);
			rect = {left: Math.min(coords.left, endCoords.left),
							top: Math.min(coords.top, endCoords.top) - margin,
							right: Math.max(coords.left, endCoords.left),
							bottom: Math.max(coords.bottom, endCoords.bottom) + margin};
			var scrollPos = calculateScrollPos(cm, rect);
			var startTop = cm.doc.scrollTop, startLeft = cm.doc.scrollLeft;
			if (scrollPos.scrollTop != null) {
				updateScrollTop(cm, scrollPos.scrollTop);
				if (Math.abs(cm.doc.scrollTop - startTop) > 1) { changed = true; }
			}
			if (scrollPos.scrollLeft != null) {
				setScrollLeft(cm, scrollPos.scrollLeft);
				if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) { changed = true; }
			}
			if (!changed) { break }
		}
		return rect
	}

	// Scroll a given set of coordinates into view (immediately).
	function scrollIntoView(cm, rect) {
		var scrollPos = calculateScrollPos(cm, rect);
		if (scrollPos.scrollTop != null) { updateScrollTop(cm, scrollPos.scrollTop); }
		if (scrollPos.scrollLeft != null) { setScrollLeft(cm, scrollPos.scrollLeft); }
	}

	// Calculate a new scroll position needed to scroll the given
	// rectangle into view. Returns an object with scrollTop and
	// scrollLeft properties. When these are undefined, the
	// vertical/horizontal position does not need to be adjusted.
	function calculateScrollPos(cm, rect) {
		var display = cm.display, snapMargin = textHeight(cm.display);
		if (rect.top < 0) { rect.top = 0; }
		var screentop = cm.curOp && cm.curOp.scrollTop != null ? cm.curOp.scrollTop : display.scroller.scrollTop;
		var screen = displayHeight(cm), result = {};
		if (rect.bottom - rect.top > screen) { rect.bottom = rect.top + screen; }
		var docBottom = cm.doc.height + paddingVert(display);
		var atTop = rect.top < snapMargin, atBottom = rect.bottom > docBottom - snapMargin;
		if (rect.top < screentop) {
			result.scrollTop = atTop ? 0 : rect.top;
		} else if (rect.bottom > screentop + screen) {
			var newTop = Math.min(rect.top, (atBottom ? docBottom : rect.bottom) - screen);
			if (newTop != screentop) { result.scrollTop = newTop; }
		}

		var gutterSpace = cm.options.fixedGutter ? 0 : display.gutters.offsetWidth;
		var screenleft = cm.curOp && cm.curOp.scrollLeft != null ? cm.curOp.scrollLeft : display.scroller.scrollLeft - gutterSpace;
		var screenw = displayWidth(cm) - display.gutters.offsetWidth;
		var tooWide = rect.right - rect.left > screenw;
		if (tooWide) { rect.right = rect.left + screenw; }
		if (rect.left < 10)
			{ result.scrollLeft = 0; }
		else if (rect.left < screenleft)
			{ result.scrollLeft = Math.max(0, rect.left + gutterSpace - (tooWide ? 0 : 10)); }
		else if (rect.right > screenw + screenleft - 3)
			{ result.scrollLeft = rect.right + (tooWide ? 0 : 10) - screenw; }
		return result
	}

	// Store a relative adjustment to the scroll position in the current
	// operation (to be applied when the operation finishes).
	function addToScrollTop(cm, top) {
		if (top == null) { return }
		resolveScrollToPos(cm);
		cm.curOp.scrollTop = (cm.curOp.scrollTop == null ? cm.doc.scrollTop : cm.curOp.scrollTop) + top;
	}

	// Make sure that at the end of the operation the current cursor is
	// shown.
	function ensureCursorVisible(cm) {
		resolveScrollToPos(cm);
		var cur = cm.getCursor();
		cm.curOp.scrollToPos = {from: cur, to: cur, margin: cm.options.cursorScrollMargin};
	}

	function scrollToCoords(cm, x, y) {
		if (x != null || y != null) { resolveScrollToPos(cm); }
		if (x != null) { cm.curOp.scrollLeft = x; }
		if (y != null) { cm.curOp.scrollTop = y; }
	}

	function scrollToRange(cm, range) {
		resolveScrollToPos(cm);
		cm.curOp.scrollToPos = range;
	}

	// When an operation has its scrollToPos property set, and another
	// scroll action is applied before the end of the operation, this
	// 'simulates' scrolling that position into view in a cheap way, so
	// that the effect of intermediate scroll commands is not ignored.
	function resolveScrollToPos(cm) {
		var range = cm.curOp.scrollToPos;
		if (range) {
			cm.curOp.scrollToPos = null;
			var from = estimateCoords(cm, range.from), to = estimateCoords(cm, range.to);
			scrollToCoordsRange(cm, from, to, range.margin);
		}
	}

	function scrollToCoordsRange(cm, from, to, margin) {
		var sPos = calculateScrollPos(cm, {
			left: Math.min(from.left, to.left),
			top: Math.min(from.top, to.top) - margin,
			right: Math.max(from.right, to.right),
			bottom: Math.max(from.bottom, to.bottom) + margin
		});
		scrollToCoords(cm, sPos.scrollLeft, sPos.scrollTop);
	}

	// Sync the scrollable area and scrollbars, ensure the viewport
	// covers the visible area.
	function updateScrollTop(cm, val) {
		if (Math.abs(cm.doc.scrollTop - val) < 2) { return }
		if (!gecko) { updateDisplaySimple(cm, {top: val}); }
		setScrollTop(cm, val, true);
		if (gecko) { updateDisplaySimple(cm); }
		startWorker(cm, 100);
	}

	function setScrollTop(cm, val, forceScroll) {
		val = Math.max(0, Math.min(cm.display.scroller.scrollHeight - cm.display.scroller.clientHeight, val));
		if (cm.display.scroller.scrollTop == val && !forceScroll) { return }
		cm.doc.scrollTop = val;
		cm.display.scrollbars.setScrollTop(val);
		if (cm.display.scroller.scrollTop != val) { cm.display.scroller.scrollTop = val; }
	}

	// Sync scroller and scrollbar, ensure the gutter elements are
	// aligned.
	function setScrollLeft(cm, val, isScroller, forceScroll) {
		val = Math.max(0, Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth));
		if ((isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) && !forceScroll) { return }
		cm.doc.scrollLeft = val;
		alignHorizontally(cm);
		if (cm.display.scroller.scrollLeft != val) { cm.display.scroller.scrollLeft = val; }
		cm.display.scrollbars.setScrollLeft(val);
	}

	// SCROLLBARS

	// Prepare DOM reads needed to update the scrollbars. Done in one
	// shot to minimize update/measure roundtrips.
	function measureForScrollbars(cm) {
		var d = cm.display, gutterW = d.gutters.offsetWidth;
		var docH = Math.round(cm.doc.height + paddingVert(cm.display));
		return {
			clientHeight: d.scroller.clientHeight,
			viewHeight: d.wrapper.clientHeight,
			scrollWidth: d.scroller.scrollWidth, clientWidth: d.scroller.clientWidth,
			viewWidth: d.wrapper.clientWidth,
			barLeft: cm.options.fixedGutter ? gutterW : 0,
			docHeight: docH,
			scrollHeight: docH + scrollGap(cm) + d.barHeight,
			nativeBarWidth: d.nativeBarWidth,
			gutterWidth: gutterW
		}
	}

	var NativeScrollbars = function(place, scroll, cm) {
		this.cm = cm;
		var vert = this.vert = elt("div", [elt("div", null, null, "min-width: 1px")], "CodeMirror-vscrollbar");
		var horiz = this.horiz = elt("div", [elt("div", null, null, "height: 100%; min-height: 1px")], "CodeMirror-hscrollbar");
		vert.tabIndex = horiz.tabIndex = -1;
		place(vert); place(horiz);

		on(vert, "scroll", function () {
			if (vert.clientHeight) { scroll(vert.scrollTop, "vertical"); }
		});
		on(horiz, "scroll", function () {
			if (horiz.clientWidth) { scroll(horiz.scrollLeft, "horizontal"); }
		});

		this.checkedZeroWidth = false;
		// Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
		if (ie && ie_version < 8) { this.horiz.style.minHeight = this.vert.style.minWidth = "18px"; }
	};

	NativeScrollbars.prototype.update = function (measure) {
		var needsH = measure.scrollWidth > measure.clientWidth + 1;
		var needsV = measure.scrollHeight > measure.clientHeight + 1;
		var sWidth = measure.nativeBarWidth;

		if (needsV) {
			this.vert.style.display = "block";
			this.vert.style.bottom = needsH ? sWidth + "px" : "0";
			var totalHeight = measure.viewHeight - (needsH ? sWidth : 0);
			// A bug in IE8 can cause this value to be negative, so guard it.
			this.vert.firstChild.style.height =
				Math.max(0, measure.scrollHeight - measure.clientHeight + totalHeight) + "px";
		} else {
			this.vert.scrollTop = 0;
			this.vert.style.display = "";
			this.vert.firstChild.style.height = "0";
		}

		if (needsH) {
			this.horiz.style.display = "block";
			this.horiz.style.right = needsV ? sWidth + "px" : "0";
			this.horiz.style.left = measure.barLeft + "px";
			var totalWidth = measure.viewWidth - measure.barLeft - (needsV ? sWidth : 0);
			this.horiz.firstChild.style.width =
				Math.max(0, measure.scrollWidth - measure.clientWidth + totalWidth) + "px";
		} else {
			this.horiz.style.display = "";
			this.horiz.firstChild.style.width = "0";
		}

		if (!this.checkedZeroWidth && measure.clientHeight > 0) {
			if (sWidth == 0) { this.zeroWidthHack(); }
			this.checkedZeroWidth = true;
		}

		return {right: needsV ? sWidth : 0, bottom: needsH ? sWidth : 0}
	};

	NativeScrollbars.prototype.setScrollLeft = function (pos) {
		if (this.horiz.scrollLeft != pos) { this.horiz.scrollLeft = pos; }
		if (this.disableHoriz) { this.enableZeroWidthBar(this.horiz, this.disableHoriz, "horiz"); }
	};

	NativeScrollbars.prototype.setScrollTop = function (pos) {
		if (this.vert.scrollTop != pos) { this.vert.scrollTop = pos; }
		if (this.disableVert) { this.enableZeroWidthBar(this.vert, this.disableVert, "vert"); }
	};

	NativeScrollbars.prototype.zeroWidthHack = function () {
		var w = mac && !mac_geMountainLion ? "12px" : "18px";
		this.horiz.style.height = this.vert.style.width = w;
		this.horiz.style.visibility = this.vert.style.visibility = "hidden";
		this.disableHoriz = new Delayed;
		this.disableVert = new Delayed;
	};

	NativeScrollbars.prototype.enableZeroWidthBar = function (bar, delay, type) {
		bar.style.visibility = "";
		function maybeDisable() {
			// To find out whether the scrollbar is still visible, we
			// check whether the element under the pixel in the bottom
			// right corner of the scrollbar box is the scrollbar box
			// itself (when the bar is still visible) or its filler child
			// (when the bar is hidden). If it is still visible, we keep
			// it enabled, if it's hidden, we disable pointer events.
			var box = bar.getBoundingClientRect();
			var elt = type == "vert" ? document.elementFromPoint(box.right - 1, (box.top + box.bottom) / 2)
					: document.elementFromPoint((box.right + box.left) / 2, box.bottom - 1);
			if (elt != bar) { bar.style.visibility = "hidden"; }
			else { delay.set(1000, maybeDisable); }
		}
		delay.set(1000, maybeDisable);
	};

	NativeScrollbars.prototype.clear = function () {
		var parent = this.horiz.parentNode;
		parent.removeChild(this.horiz);
		parent.removeChild(this.vert);
	};

	var NullScrollbars = function () {};

	NullScrollbars.prototype.update = function () { return {bottom: 0, right: 0} };
	NullScrollbars.prototype.setScrollLeft = function () {};
	NullScrollbars.prototype.setScrollTop = function () {};
	NullScrollbars.prototype.clear = function () {};

	function updateScrollbars(cm, measure) {
		if (!measure) { measure = measureForScrollbars(cm); }
		var startWidth = cm.display.barWidth, startHeight = cm.display.barHeight;
		updateScrollbarsInner(cm, measure);
		for (var i = 0; i < 4 && startWidth != cm.display.barWidth || startHeight != cm.display.barHeight; i++) {
			if (startWidth != cm.display.barWidth && cm.options.lineWrapping)
				{ updateHeightsInViewport(cm); }
			updateScrollbarsInner(cm, measureForScrollbars(cm));
			startWidth = cm.display.barWidth; startHeight = cm.display.barHeight;
		}
	}

	// Re-synchronize the fake scrollbars with the actual size of the
	// content.
	function updateScrollbarsInner(cm, measure) {
		var d = cm.display;
		var sizes = d.scrollbars.update(measure);

		d.sizer.style.paddingRight = (d.barWidth = sizes.right) + "px";
		d.sizer.style.paddingBottom = (d.barHeight = sizes.bottom) + "px";
		d.heightForcer.style.borderBottom = sizes.bottom + "px solid transparent";

		if (sizes.right && sizes.bottom) {
			d.scrollbarFiller.style.display = "block";
			d.scrollbarFiller.style.height = sizes.bottom + "px";
			d.scrollbarFiller.style.width = sizes.right + "px";
		} else { d.scrollbarFiller.style.display = ""; }
		if (sizes.bottom && cm.options.coverGutterNextToScrollbar && cm.options.fixedGutter) {
			d.gutterFiller.style.display = "block";
			d.gutterFiller.style.height = sizes.bottom + "px";
			d.gutterFiller.style.width = measure.gutterWidth + "px";
		} else { d.gutterFiller.style.display = ""; }
	}

	var scrollbarModel = {"native": NativeScrollbars, "null": NullScrollbars};

	function initScrollbars(cm) {
		if (cm.display.scrollbars) {
			cm.display.scrollbars.clear();
			if (cm.display.scrollbars.addClass)
				{ rmClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
		}

		cm.display.scrollbars = new scrollbarModel[cm.options.scrollbarStyle](function (node) {
			cm.display.wrapper.insertBefore(node, cm.display.scrollbarFiller);
			// Prevent clicks in the scrollbars from killing focus
			on(node, "mousedown", function () {
				if (cm.state.focused) { setTimeout(function () { return cm.display.input.focus(); }, 0); }
			});
			node.setAttribute("cm-not-content", "true");
		}, function (pos, axis) {
			if (axis == "horizontal") { setScrollLeft(cm, pos); }
			else { updateScrollTop(cm, pos); }
		}, cm);
		if (cm.display.scrollbars.addClass)
			{ addClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
	}

	// Operations are used to wrap a series of changes to the editor
	// state in such a way that each change won't have to update the
	// cursor and display (which would be awkward, slow, and
	// error-prone). Instead, display updates are batched and then all
	// combined and executed at once.

	var nextOpId = 0;
	// Start a new operation.
	function startOperation(cm) {
		cm.curOp = {
			cm: cm,
			viewChanged: false,      // Flag that indicates that lines might need to be redrawn
			startHeight: cm.doc.height, // Used to detect need to update scrollbar
			forceUpdate: false,      // Used to force a redraw
			updateInput: 0,       // Whether to reset the input textarea
			typing: false,           // Whether this reset should be careful to leave existing text (for compositing)
			changeObjs: null,        // Accumulated changes, for firing change events
			cursorActivityHandlers: null, // Set of handlers to fire cursorActivity on
			cursorActivityCalled: 0, // Tracks which cursorActivity handlers have been called already
			selectionChanged: false, // Whether the selection needs to be redrawn
			updateMaxLine: false,    // Set when the widest line needs to be determined anew
			scrollLeft: null, scrollTop: null, // Intermediate scroll position, not pushed to DOM yet
			scrollToPos: null,       // Used to scroll to a specific position
			focus: false,
			id: ++nextOpId,          // Unique ID
			markArrays: null         // Used by addMarkedSpan
		};
		pushOperation(cm.curOp);
	}

	// Finish an operation, updating the display and signalling delayed events
	function endOperation(cm) {
		var op = cm.curOp;
		if (op) { finishOperation(op, function (group) {
			for (var i = 0; i < group.ops.length; i++)
				{ group.ops[i].cm.curOp = null; }
			endOperations(group);
		}); }
	}

	// The DOM updates done when an operation finishes are batched so
	// that the minimum number of relayouts are required.
	function endOperations(group) {
		var ops = group.ops;
		for (var i = 0; i < ops.length; i++) // Read DOM
			{ endOperation_R1(ops[i]); }
		for (var i$1 = 0; i$1 < ops.length; i$1++) // Write DOM (maybe)
			{ endOperation_W1(ops[i$1]); }
		for (var i$2 = 0; i$2 < ops.length; i$2++) // Read DOM
			{ endOperation_R2(ops[i$2]); }
		for (var i$3 = 0; i$3 < ops.length; i$3++) // Write DOM (maybe)
			{ endOperation_W2(ops[i$3]); }
		for (var i$4 = 0; i$4 < ops.length; i$4++) // Read DOM
			{ endOperation_finish(ops[i$4]); }
	}

	function endOperation_R1(op) {
		var cm = op.cm, display = cm.display;
		maybeClipScrollbars(cm);
		if (op.updateMaxLine) { findMaxLine(cm); }

		op.mustUpdate = op.viewChanged || op.forceUpdate || op.scrollTop != null ||
			op.scrollToPos && (op.scrollToPos.from.line < display.viewFrom ||
												 op.scrollToPos.to.line >= display.viewTo) ||
			display.maxLineChanged && cm.options.lineWrapping;
		op.update = op.mustUpdate &&
			new DisplayUpdate(cm, op.mustUpdate && {top: op.scrollTop, ensure: op.scrollToPos}, op.forceUpdate);
	}

	function endOperation_W1(op) {
		op.updatedDisplay = op.mustUpdate && updateDisplayIfNeeded(op.cm, op.update);
	}

	function endOperation_R2(op) {
		var cm = op.cm, display = cm.display;
		if (op.updatedDisplay) { updateHeightsInViewport(cm); }

		op.barMeasure = measureForScrollbars(cm);

		// If the max line changed since it was last measured, measure it,
		// and ensure the document's width matches it.
		// updateDisplay_W2 will use these properties to do the actual resizing
		if (display.maxLineChanged && !cm.options.lineWrapping) {
			op.adjustWidthTo = measureChar(cm, display.maxLine, display.maxLine.text.length).left + 3;
			cm.display.sizerWidth = op.adjustWidthTo;
			op.barMeasure.scrollWidth =
				Math.max(display.scroller.clientWidth, display.sizer.offsetLeft + op.adjustWidthTo + scrollGap(cm) + cm.display.barWidth);
			op.maxScrollLeft = Math.max(0, display.sizer.offsetLeft + op.adjustWidthTo - displayWidth(cm));
		}

		if (op.updatedDisplay || op.selectionChanged)
			{ op.preparedSelection = display.input.prepareSelection(); }
	}

	function endOperation_W2(op) {
		var cm = op.cm;

		if (op.adjustWidthTo != null) {
			cm.display.sizer.style.minWidth = op.adjustWidthTo + "px";
			if (op.maxScrollLeft < cm.doc.scrollLeft)
				{ setScrollLeft(cm, Math.min(cm.display.scroller.scrollLeft, op.maxScrollLeft), true); }
			cm.display.maxLineChanged = false;
		}

		var takeFocus = op.focus && op.focus == activeElt(root(cm));
		if (op.preparedSelection)
			{ cm.display.input.showSelection(op.preparedSelection, takeFocus); }
		if (op.updatedDisplay || op.startHeight != cm.doc.height)
			{ updateScrollbars(cm, op.barMeasure); }
		if (op.updatedDisplay)
			{ setDocumentHeight(cm, op.barMeasure); }

		if (op.selectionChanged) { restartBlink(cm); }

		if (cm.state.focused && op.updateInput)
			{ cm.display.input.reset(op.typing); }
		if (takeFocus) { ensureFocus(op.cm); }
	}

	function endOperation_finish(op) {
		var cm = op.cm, display = cm.display, doc = cm.doc;

		if (op.updatedDisplay) { postUpdateDisplay(cm, op.update); }

		// Abort mouse wheel delta measurement, when scrolling explicitly
		if (display.wheelStartX != null && (op.scrollTop != null || op.scrollLeft != null || op.scrollToPos))
			{ display.wheelStartX = display.wheelStartY = null; }

		// Propagate the scroll position to the actual DOM scroller
		if (op.scrollTop != null) { setScrollTop(cm, op.scrollTop, op.forceScroll); }

		if (op.scrollLeft != null) { setScrollLeft(cm, op.scrollLeft, true, true); }
		// If we need to scroll a specific position into view, do so.
		if (op.scrollToPos) {
			var rect = scrollPosIntoView(cm, clipPos(doc, op.scrollToPos.from),
																	 clipPos(doc, op.scrollToPos.to), op.scrollToPos.margin);
			maybeScrollWindow(cm, rect);
		}

		// Fire events for markers that are hidden/unidden by editing or
		// undoing
		var hidden = op.maybeHiddenMarkers, unhidden = op.maybeUnhiddenMarkers;
		if (hidden) { for (var i = 0; i < hidden.length; ++i)
			{ if (!hidden[i].lines.length) { signal(hidden[i], "hide"); } } }
		if (unhidden) { for (var i$1 = 0; i$1 < unhidden.length; ++i$1)
			{ if (unhidden[i$1].lines.length) { signal(unhidden[i$1], "unhide"); } } }

		if (display.wrapper.offsetHeight)
			{ doc.scrollTop = cm.display.scroller.scrollTop; }

		// Fire change events, and delayed event handlers
		if (op.changeObjs)
			{ signal(cm, "changes", cm, op.changeObjs); }
		if (op.update)
			{ op.update.finish(); }
	}

	// Run the given function in an operation
	function runInOp(cm, f) {
		if (cm.curOp) { return f() }
		startOperation(cm);
		try { return f() }
		finally { endOperation(cm); }
	}
	// Wraps a function in an operation. Returns the wrapped function.
	function operation(cm, f) {
		return function() {
			if (cm.curOp) { return f.apply(cm, arguments) }
			startOperation(cm);
			try { return f.apply(cm, arguments) }
			finally { endOperation(cm); }
		}
	}
	// Used to add methods to editor and doc instances, wrapping them in
	// operations.
	function methodOp(f) {
		return function() {
			if (this.curOp) { return f.apply(this, arguments) }
			startOperation(this);
			try { return f.apply(this, arguments) }
			finally { endOperation(this); }
		}
	}
	function docMethodOp(f) {
		return function() {
			var cm = this.cm;
			if (!cm || cm.curOp) { return f.apply(this, arguments) }
			startOperation(cm);
			try { return f.apply(this, arguments) }
			finally { endOperation(cm); }
		}
	}

	// HIGHLIGHT WORKER

	function startWorker(cm, time) {
		if (cm.doc.highlightFrontier < cm.display.viewTo)
			{ cm.state.highlight.set(time, bind(highlightWorker, cm)); }
	}

	function highlightWorker(cm) {
		var doc = cm.doc;
		if (doc.highlightFrontier >= cm.display.viewTo) { return }
		var end = +new Date + cm.options.workTime;
		var context = getContextBefore(cm, doc.highlightFrontier);
		var changedLines = [];

		doc.iter(context.line, Math.min(doc.first + doc.size, cm.display.viewTo + 500), function (line) {
			if (context.line >= cm.display.viewFrom) { // Visible
				var oldStyles = line.styles;
				var resetState = line.text.length > cm.options.maxHighlightLength ? copyState(doc.mode, context.state) : null;
				var highlighted = highlightLine(cm, line, context, true);
				if (resetState) { context.state = resetState; }
				line.styles = highlighted.styles;
				var oldCls = line.styleClasses, newCls = highlighted.classes;
				if (newCls) { line.styleClasses = newCls; }
				else if (oldCls) { line.styleClasses = null; }
				var ischange = !oldStyles || oldStyles.length != line.styles.length ||
					oldCls != newCls && (!oldCls || !newCls || oldCls.bgClass != newCls.bgClass || oldCls.textClass != newCls.textClass);
				for (var i = 0; !ischange && i < oldStyles.length; ++i) { ischange = oldStyles[i] != line.styles[i]; }
				if (ischange) { changedLines.push(context.line); }
				line.stateAfter = context.save();
				context.nextLine();
			} else {
				if (line.text.length <= cm.options.maxHighlightLength)
					{ processLine(cm, line.text, context); }
				line.stateAfter = context.line % 5 == 0 ? context.save() : null;
				context.nextLine();
			}
			if (+new Date > end) {
				startWorker(cm, cm.options.workDelay);
				return true
			}
		});
		doc.highlightFrontier = context.line;
		doc.modeFrontier = Math.max(doc.modeFrontier, context.line);
		if (changedLines.length) { runInOp(cm, function () {
			for (var i = 0; i < changedLines.length; i++)
				{ regLineChange(cm, changedLines[i], "text"); }
		}); }
	}

	// DISPLAY DRAWING

	var DisplayUpdate = function(cm, viewport, force) {
		var display = cm.display;

		this.viewport = viewport;
		// Store some values that we'll need later (but don't want to force a relayout for)
		this.visible = visibleLines(display, cm.doc, viewport);
		this.editorIsHidden = !display.wrapper.offsetWidth;
		this.wrapperHeight = display.wrapper.clientHeight;
		this.wrapperWidth = display.wrapper.clientWidth;
		this.oldDisplayWidth = displayWidth(cm);
		this.force = force;
		this.dims = getDimensions(cm);
		this.events = [];
	};

	DisplayUpdate.prototype.signal = function (emitter, type) {
		if (hasHandler(emitter, type))
			{ this.events.push(arguments); }
	};
	DisplayUpdate.prototype.finish = function () {
		for (var i = 0; i < this.events.length; i++)
			{ signal.apply(null, this.events[i]); }
	};

	function maybeClipScrollbars(cm) {
		var display = cm.display;
		if (!display.scrollbarsClipped && display.scroller.offsetWidth) {
			display.nativeBarWidth = display.scroller.offsetWidth - display.scroller.clientWidth;
			display.heightForcer.style.height = scrollGap(cm) + "px";
			display.sizer.style.marginBottom = -display.nativeBarWidth + "px";
			display.sizer.style.borderRightWidth = scrollGap(cm) + "px";
			display.scrollbarsClipped = true;
		}
	}

	function selectionSnapshot(cm) {
		if (cm.hasFocus()) { return null }
		var active = activeElt(root(cm));
		if (!active || !contains(cm.display.lineDiv, active)) { return null }
		var result = {activeElt: active};
		if (window.getSelection) {
			var sel = win(cm).getSelection();
			if (sel.anchorNode && sel.extend && contains(cm.display.lineDiv, sel.anchorNode)) {
				result.anchorNode = sel.anchorNode;
				result.anchorOffset = sel.anchorOffset;
				result.focusNode = sel.focusNode;
				result.focusOffset = sel.focusOffset;
			}
		}
		return result
	}

	function restoreSelection(snapshot) {
		if (!snapshot || !snapshot.activeElt || snapshot.activeElt == activeElt(rootNode(snapshot.activeElt))) { return }
		snapshot.activeElt.focus();
		if (!/^(INPUT|TEXTAREA)$/.test(snapshot.activeElt.nodeName) &&
				snapshot.anchorNode && contains(document.body, snapshot.anchorNode) && contains(document.body, snapshot.focusNode)) {
			var doc = snapshot.activeElt.ownerDocument;
			var sel = doc.defaultView.getSelection(), range = doc.createRange();
			range.setEnd(snapshot.anchorNode, snapshot.anchorOffset);
			range.collapse(false);
			sel.removeAllRanges();
			sel.addRange(range);
			sel.extend(snapshot.focusNode, snapshot.focusOffset);
		}
	}

	// Does the actual updating of the line display. Bails out
	// (returning false) when there is nothing to be done and forced is
	// false.
	function updateDisplayIfNeeded(cm, update) {
		var display = cm.display, doc = cm.doc;

		if (update.editorIsHidden) {
			resetView(cm);
			return false
		}

		// Bail out if the visible area is already rendered and nothing changed.
		if (!update.force &&
				update.visible.from >= display.viewFrom && update.visible.to <= display.viewTo &&
				(display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo) &&
				display.renderedView == display.view && countDirtyView(cm) == 0)
			{ return false }

		if (maybeUpdateLineNumberWidth(cm)) {
			resetView(cm);
			update.dims = getDimensions(cm);
		}

		// Compute a suitable new viewport (from & to)
		var end = doc.first + doc.size;
		var from = Math.max(update.visible.from - cm.options.viewportMargin, doc.first);
		var to = Math.min(end, update.visible.to + cm.options.viewportMargin);
		if (display.viewFrom < from && from - display.viewFrom < 20) { from = Math.max(doc.first, display.viewFrom); }
		if (display.viewTo > to && display.viewTo - to < 20) { to = Math.min(end, display.viewTo); }
		if (sawCollapsedSpans) {
			from = visualLineNo(cm.doc, from);
			to = visualLineEndNo(cm.doc, to);
		}

		var different = from != display.viewFrom || to != display.viewTo ||
			display.lastWrapHeight != update.wrapperHeight || display.lastWrapWidth != update.wrapperWidth;
		adjustView(cm, from, to);

		display.viewOffset = heightAtLine(getLine(cm.doc, display.viewFrom));
		// Position the mover div to align with the current scroll position
		cm.display.mover.style.top = display.viewOffset + "px";

		var toUpdate = countDirtyView(cm);
		if (!different && toUpdate == 0 && !update.force && display.renderedView == display.view &&
				(display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo))
			{ return false }

		// For big changes, we hide the enclosing element during the
		// update, since that speeds up the operations on most browsers.
		var selSnapshot = selectionSnapshot(cm);
		if (toUpdate > 4) { display.lineDiv.style.display = "none"; }
		patchDisplay(cm, display.updateLineNumbers, update.dims);
		if (toUpdate > 4) { display.lineDiv.style.display = ""; }
		display.renderedView = display.view;
		// There might have been a widget with a focused element that got
		// hidden or updated, if so re-focus it.
		restoreSelection(selSnapshot);

		// Prevent selection and cursors from interfering with the scroll
		// width and height.
		removeChildren(display.cursorDiv);
		removeChildren(display.selectionDiv);
		display.gutters.style.height = display.sizer.style.minHeight = 0;

		if (different) {
			display.lastWrapHeight = update.wrapperHeight;
			display.lastWrapWidth = update.wrapperWidth;
			startWorker(cm, 400);
		}

		display.updateLineNumbers = null;

		return true
	}

	function postUpdateDisplay(cm, update) {
		var viewport = update.viewport;

		for (var first = true;; first = false) {
			if (!first || !cm.options.lineWrapping || update.oldDisplayWidth == displayWidth(cm)) {
				// Clip forced viewport to actual scrollable area.
				if (viewport && viewport.top != null)
					{ viewport = {top: Math.min(cm.doc.height + paddingVert(cm.display) - displayHeight(cm), viewport.top)}; }
				// Updated line heights might result in the drawn area not
				// actually covering the viewport. Keep looping until it does.
				update.visible = visibleLines(cm.display, cm.doc, viewport);
				if (update.visible.from >= cm.display.viewFrom && update.visible.to <= cm.display.viewTo)
					{ break }
			} else if (first) {
				update.visible = visibleLines(cm.display, cm.doc, viewport);
			}
			if (!updateDisplayIfNeeded(cm, update)) { break }
			updateHeightsInViewport(cm);
			var barMeasure = measureForScrollbars(cm);
			updateSelection(cm);
			updateScrollbars(cm, barMeasure);
			setDocumentHeight(cm, barMeasure);
			update.force = false;
		}

		update.signal(cm, "update", cm);
		if (cm.display.viewFrom != cm.display.reportedViewFrom || cm.display.viewTo != cm.display.reportedViewTo) {
			update.signal(cm, "viewportChange", cm, cm.display.viewFrom, cm.display.viewTo);
			cm.display.reportedViewFrom = cm.display.viewFrom; cm.display.reportedViewTo = cm.display.viewTo;
		}
	}

	function updateDisplaySimple(cm, viewport) {
		var update = new DisplayUpdate(cm, viewport);
		if (updateDisplayIfNeeded(cm, update)) {
			updateHeightsInViewport(cm);
			postUpdateDisplay(cm, update);
			var barMeasure = measureForScrollbars(cm);
			updateSelection(cm);
			updateScrollbars(cm, barMeasure);
			setDocumentHeight(cm, barMeasure);
			update.finish();
		}
	}

	// Sync the actual display DOM structure with display.view, removing
	// nodes for lines that are no longer in view, and creating the ones
	// that are not there yet, and updating the ones that are out of
	// date.
	function patchDisplay(cm, updateNumbersFrom, dims) {
		var display = cm.display, lineNumbers = cm.options.lineNumbers;
		var container = display.lineDiv, cur = container.firstChild;

		function rm(node) {
			var next = node.nextSibling;
			// Works around a throw-scroll bug in OS X Webkit
			if (webkit && mac && cm.display.currentWheelTarget == node)
				{ node.style.display = "none"; }
			else
				{ node.parentNode.removeChild(node); }
			return next
		}

		var view = display.view, lineN = display.viewFrom;
		// Loop over the elements in the view, syncing cur (the DOM nodes
		// in display.lineDiv) with the view as we go.
		for (var i = 0; i < view.length; i++) {
			var lineView = view[i];
			if (lineView.hidden) ; else if (!lineView.node || lineView.node.parentNode != container) { // Not drawn yet
				var node = buildLineElement(cm, lineView, lineN, dims);
				container.insertBefore(node, cur);
			} else { // Already drawn
				while (cur != lineView.node) { cur = rm(cur); }
				var updateNumber = lineNumbers && updateNumbersFrom != null &&
					updateNumbersFrom <= lineN && lineView.lineNumber;
				if (lineView.changes) {
					if (indexOf(lineView.changes, "gutter") > -1) { updateNumber = false; }
					updateLineForChanges(cm, lineView, lineN, dims);
				}
				if (updateNumber) {
					removeChildren(lineView.lineNumber);
					lineView.lineNumber.appendChild(document.createTextNode(lineNumberFor(cm.options, lineN)));
				}
				cur = lineView.node.nextSibling;
			}
			lineN += lineView.size;
		}
		while (cur) { cur = rm(cur); }
	}

	function updateGutterSpace(display) {
		var width = display.gutters.offsetWidth;
		display.sizer.style.marginLeft = width + "px";
		// Send an event to consumers responding to changes in gutter width.
		signalLater(display, "gutterChanged", display);
	}

	function setDocumentHeight(cm, measure) {
		cm.display.sizer.style.minHeight = measure.docHeight + "px";
		cm.display.heightForcer.style.top = measure.docHeight + "px";
		cm.display.gutters.style.height = (measure.docHeight + cm.display.barHeight + scrollGap(cm)) + "px";
	}

	// Re-align line numbers and gutter marks to compensate for
	// horizontal scrolling.
	function alignHorizontally(cm) {
		var display = cm.display, view = display.view;
		if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) { return }
		var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft;
		var gutterW = display.gutters.offsetWidth, left = comp + "px";
		for (var i = 0; i < view.length; i++) { if (!view[i].hidden) {
			if (cm.options.fixedGutter) {
				if (view[i].gutter)
					{ view[i].gutter.style.left = left; }
				if (view[i].gutterBackground)
					{ view[i].gutterBackground.style.left = left; }
			}
			var align = view[i].alignable;
			if (align) { for (var j = 0; j < align.length; j++)
				{ align[j].style.left = left; } }
		} }
		if (cm.options.fixedGutter)
			{ display.gutters.style.left = (comp + gutterW) + "px"; }
	}

	// Used to ensure that the line number gutter is still the right
	// size for the current document size. Returns true when an update
	// is needed.
	function maybeUpdateLineNumberWidth(cm) {
		if (!cm.options.lineNumbers) { return false }
		var doc = cm.doc, last = lineNumberFor(cm.options, doc.first + doc.size - 1), display = cm.display;
		if (last.length != display.lineNumChars) {
			var test = display.measure.appendChild(elt("div", [elt("div", last)],
																								 "CodeMirror-linenumber CodeMirror-gutter-elt"));
			var innerW = test.firstChild.offsetWidth, padding = test.offsetWidth - innerW;
			display.lineGutter.style.width = "";
			display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding) + 1;
			display.lineNumWidth = display.lineNumInnerWidth + padding;
			display.lineNumChars = display.lineNumInnerWidth ? last.length : -1;
			display.lineGutter.style.width = display.lineNumWidth + "px";
			updateGutterSpace(cm.display);
			return true
		}
		return false
	}

	function getGutters(gutters, lineNumbers) {
		var result = [], sawLineNumbers = false;
		for (var i = 0; i < gutters.length; i++) {
			var name = gutters[i], style = null;
			if (typeof name != "string") { style = name.style; name = name.className; }
			if (name == "CodeMirror-linenumbers") {
				if (!lineNumbers) { continue }
				else { sawLineNumbers = true; }
			}
			result.push({className: name, style: style});
		}
		if (lineNumbers && !sawLineNumbers) { result.push({className: "CodeMirror-linenumbers", style: null}); }
		return result
	}

	// Rebuild the gutter elements, ensure the margin to the left of the
	// code matches their width.
	function renderGutters(display) {
		var gutters = display.gutters, specs = display.gutterSpecs;
		removeChildren(gutters);
		display.lineGutter = null;
		for (var i = 0; i < specs.length; ++i) {
			var ref = specs[i];
			var className = ref.className;
			var style = ref.style;
			var gElt = gutters.appendChild(elt("div", null, "CodeMirror-gutter " + className));
			if (style) { gElt.style.cssText = style; }
			if (className == "CodeMirror-linenumbers") {
				display.lineGutter = gElt;
				gElt.style.width = (display.lineNumWidth || 1) + "px";
			}
		}
		gutters.style.display = specs.length ? "" : "none";
		updateGutterSpace(display);
	}

	function updateGutters(cm) {
		renderGutters(cm.display);
		regChange(cm);
		alignHorizontally(cm);
	}

	// The display handles the DOM integration, both for input reading
	// and content drawing. It holds references to DOM nodes and
	// display-related state.

	function Display(place, doc, input, options) {
		var d = this;
		this.input = input;

		// Covers bottom-right square when both scrollbars are present.
		d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler");
		d.scrollbarFiller.setAttribute("cm-not-content", "true");
		// Covers bottom of gutter when coverGutterNextToScrollbar is on
		// and h scrollbar is present.
		d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler");
		d.gutterFiller.setAttribute("cm-not-content", "true");
		// Will contain the actual code, positioned to cover the viewport.
		d.lineDiv = eltP("div", null, "CodeMirror-code");
		// Elements are added to these to represent selection and cursors.
		d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1");
		d.cursorDiv = elt("div", null, "CodeMirror-cursors");
		// A visibility: hidden element used to find the size of things.
		d.measure = elt("div", null, "CodeMirror-measure");
		// When lines outside of the viewport are measured, they are drawn in this.
		d.lineMeasure = elt("div", null, "CodeMirror-measure");
		// Wraps everything that needs to exist inside the vertically-padded coordinate system
		d.lineSpace = eltP("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv],
											null, "position: relative; outline: none");
		var lines = eltP("div", [d.lineSpace], "CodeMirror-lines");
		// Moved around its parent to cover visible view.
		d.mover = elt("div", [lines], null, "position: relative");
		// Set to the height of the document, allowing scrolling.
		d.sizer = elt("div", [d.mover], "CodeMirror-sizer");
		d.sizerWidth = null;
		// Behavior of elts with overflow: auto and padding is
		// inconsistent across browsers. This is used to ensure the
		// scrollable area is big enough.
		d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;");
		// Will contain the gutters, if any.
		d.gutters = elt("div", null, "CodeMirror-gutters");
		d.lineGutter = null;
		// Actual scrollable element.
		d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll");
		d.scroller.setAttribute("tabIndex", "-1");
		// The element in which the editor lives.
		d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror");
		// See #6982. FIXME remove when this has been fixed for a while in Chrome
		if (chrome && chrome_version >= 105) { d.wrapper.style.clipPath = "inset(0px)"; }

		// This attribute is respected by automatic translation systems such as Google Translate,
		// and may also be respected by tools used by human translators.
		d.wrapper.setAttribute('translate', 'no');

		// Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)
		if (ie && ie_version < 8) { d.gutters.style.zIndex = -1; d.scroller.style.paddingRight = 0; }
		if (!webkit && !(gecko && mobile)) { d.scroller.draggable = true; }

		if (place) {
			if (place.appendChild) { place.appendChild(d.wrapper); }
			else { place(d.wrapper); }
		}

		// Current rendered range (may be bigger than the view window).
		d.viewFrom = d.viewTo = doc.first;
		d.reportedViewFrom = d.reportedViewTo = doc.first;
		// Information about the rendered lines.
		d.view = [];
		d.renderedView = null;
		// Holds info about a single rendered line when it was rendered
		// for measurement, while not in view.
		d.externalMeasured = null;
		// Empty space (in pixels) above the view
		d.viewOffset = 0;
		d.lastWrapHeight = d.lastWrapWidth = 0;
		d.updateLineNumbers = null;

		d.nativeBarWidth = d.barHeight = d.barWidth = 0;
		d.scrollbarsClipped = false;

		// Used to only resize the line number gutter when necessary (when
		// the amount of lines crosses a boundary that makes its width change)
		d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null;
		// Set to true when a non-horizontal-scrolling line widget is
		// added. As an optimization, line widget aligning is skipped when
		// this is false.
		d.alignWidgets = false;

		d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;

		// Tracks the maximum line length so that the horizontal scrollbar
		// can be kept static when scrolling.
		d.maxLine = null;
		d.maxLineLength = 0;
		d.maxLineChanged = false;

		// Used for measuring wheel scrolling granularity
		d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null;

		// True when shift is held down.
		d.shift = false;

		// Used to track whether anything happened since the context menu
		// was opened.
		d.selForContextMenu = null;

		d.activeTouch = null;

		d.gutterSpecs = getGutters(options.gutters, options.lineNumbers);
		renderGutters(d);

		input.init(d);
	}

	// Since the delta values reported on mouse wheel events are
	// unstandardized between browsers and even browser versions, and
	// generally horribly unpredictable, this code starts by measuring
	// the scroll effect that the first few mouse wheel events have,
	// and, from that, detects the way it can convert deltas to pixel
	// offsets afterwards.
	//
	// The reason we want to know the amount a wheel event will scroll
	// is that it gives us a chance to update the display before the
	// actual scrolling happens, reducing flickering.

	var wheelSamples = 0, wheelPixelsPerUnit = null;
	// Fill in a browser-detected starting value on browsers where we
	// know one. These don't have to be accurate -- the result of them
	// being wrong would just be a slight flicker on the first wheel
	// scroll (if it is large enough).
	if (ie) { wheelPixelsPerUnit = -.53; }
	else if (gecko) { wheelPixelsPerUnit = 15; }
	else if (chrome) { wheelPixelsPerUnit = -.7; }
	else if (safari) { wheelPixelsPerUnit = -1/3; }

	function wheelEventDelta(e) {
		var dx = e.wheelDeltaX, dy = e.wheelDeltaY;
		if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) { dx = e.detail; }
		if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) { dy = e.detail; }
		else if (dy == null) { dy = e.wheelDelta; }
		return {x: dx, y: dy}
	}
	function wheelEventPixels(e) {
		var delta = wheelEventDelta(e);
		delta.x *= wheelPixelsPerUnit;
		delta.y *= wheelPixelsPerUnit;
		return delta
	}

	function onScrollWheel(cm, e) {
		// On Chrome 102, viewport updates somehow stop wheel-based
		// scrolling. Turning off pointer events during the scroll seems
		// to avoid the issue.
		if (chrome && chrome_version == 102) {
			if (cm.display.chromeScrollHack == null) { cm.display.sizer.style.pointerEvents = "none"; }
			else { clearTimeout(cm.display.chromeScrollHack); }
			cm.display.chromeScrollHack = setTimeout(function () {
				cm.display.chromeScrollHack = null;
				cm.display.sizer.style.pointerEvents = "";
			}, 100);
		}
		var delta = wheelEventDelta(e), dx = delta.x, dy = delta.y;
		var pixelsPerUnit = wheelPixelsPerUnit;
		if (e.deltaMode === 0) {
			dx = e.deltaX;
			dy = e.deltaY;
			pixelsPerUnit = 1;
		}

		var display = cm.display, scroll = display.scroller;
		// Quit if there's nothing to scroll here
		var canScrollX = scroll.scrollWidth > scroll.clientWidth;
		var canScrollY = scroll.scrollHeight > scroll.clientHeight;
		if (!(dx && canScrollX || dy && canScrollY)) { return }

		// Webkit browsers on OS X abort momentum scrolls when the target
		// of the scroll event is removed from the scrollable element.
		// This hack (see related code in patchDisplay) makes sure the
		// element is kept around.
		if (dy && mac && webkit) {
			outer: for (var cur = e.target, view = display.view; cur != scroll; cur = cur.parentNode) {
				for (var i = 0; i < view.length; i++) {
					if (view[i].node == cur) {
						cm.display.currentWheelTarget = cur;
						break outer
					}
				}
			}
		}

		// On some browsers, horizontal scrolling will cause redraws to
		// happen before the gutter has been realigned, causing it to
		// wriggle around in a most unseemly way. When we have an
		// estimated pixels/delta value, we just handle horizontal
		// scrolling entirely here. It'll be slightly off from native, but
		// better than glitching out.
		if (dx && !gecko && !presto && pixelsPerUnit != null) {
			if (dy && canScrollY)
				{ updateScrollTop(cm, Math.max(0, scroll.scrollTop + dy * pixelsPerUnit)); }
			setScrollLeft(cm, Math.max(0, scroll.scrollLeft + dx * pixelsPerUnit));
			// Only prevent default scrolling if vertical scrolling is
			// actually possible. Otherwise, it causes vertical scroll
			// jitter on OSX trackpads when deltaX is small and deltaY
			// is large (issue #3579)
			if (!dy || (dy && canScrollY))
				{ e_preventDefault(e); }
			display.wheelStartX = null; // Abort measurement, if in progress
			return
		}

		// 'Project' the visible viewport to cover the area that is being
		// scrolled into view (if we know enough to estimate it).
		if (dy && pixelsPerUnit != null) {
			var pixels = dy * pixelsPerUnit;
			var top = cm.doc.scrollTop, bot = top + display.wrapper.clientHeight;
			if (pixels < 0) { top = Math.max(0, top + pixels - 50); }
			else { bot = Math.min(cm.doc.height, bot + pixels + 50); }
			updateDisplaySimple(cm, {top: top, bottom: bot});
		}

		if (wheelSamples < 20 && e.deltaMode !== 0) {
			if (display.wheelStartX == null) {
				display.wheelStartX = scroll.scrollLeft; display.wheelStartY = scroll.scrollTop;
				display.wheelDX = dx; display.wheelDY = dy;
				setTimeout(function () {
					if (display.wheelStartX == null) { return }
					var movedX = scroll.scrollLeft - display.wheelStartX;
					var movedY = scroll.scrollTop - display.wheelStartY;
					var sample = (movedY && display.wheelDY && movedY / display.wheelDY) ||
						(movedX && display.wheelDX && movedX / display.wheelDX);
					display.wheelStartX = display.wheelStartY = null;
					if (!sample) { return }
					wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1);
					++wheelSamples;
				}, 200);
			} else {
				display.wheelDX += dx; display.wheelDY += dy;
			}
		}
	}

	// Selection objects are immutable. A new one is created every time
	// the selection changes. A selection is one or more non-overlapping
	// (and non-touching) ranges, sorted, and an integer that indicates
	// which one is the primary selection (the one that's scrolled into
	// view, that getCursor returns, etc).
	var Selection = function(ranges, primIndex) {
		this.ranges = ranges;
		this.primIndex = primIndex;
	};

	Selection.prototype.primary = function () { return this.ranges[this.primIndex] };

	Selection.prototype.equals = function (other) {
		if (other == this) { return true }
		if (other.primIndex != this.primIndex || other.ranges.length != this.ranges.length) { return false }
		for (var i = 0; i < this.ranges.length; i++) {
			var here = this.ranges[i], there = other.ranges[i];
			if (!equalCursorPos(here.anchor, there.anchor) || !equalCursorPos(here.head, there.head)) { return false }
		}
		return true
	};

	Selection.prototype.deepCopy = function () {
		var out = [];
		for (var i = 0; i < this.ranges.length; i++)
			{ out[i] = new Range(copyPos(this.ranges[i].anchor), copyPos(this.ranges[i].head)); }
		return new Selection(out, this.primIndex)
	};

	Selection.prototype.somethingSelected = function () {
		for (var i = 0; i < this.ranges.length; i++)
			{ if (!this.ranges[i].empty()) { return true } }
		return false
	};

	Selection.prototype.contains = function (pos, end) {
		if (!end) { end = pos; }
		for (var i = 0; i < this.ranges.length; i++) {
			var range = this.ranges[i];
			if (cmp(end, range.from()) >= 0 && cmp(pos, range.to()) <= 0)
				{ return i }
		}
		return -1
	};

	var Range = function(anchor, head) {
		this.anchor = anchor; this.head = head;
	};

	Range.prototype.from = function () { return minPos(this.anchor, this.head) };
	Range.prototype.to = function () { return maxPos(this.anchor, this.head) };
	Range.prototype.empty = function () { return this.head.line == this.anchor.line && this.head.ch == this.anchor.ch };

	// Take an unsorted, potentially overlapping set of ranges, and
	// build a selection out of it. 'Consumes' ranges array (modifying
	// it).
	function normalizeSelection(cm, ranges, primIndex) {
		var mayTouch = cm && cm.options.selectionsMayTouch;
		var prim = ranges[primIndex];
		ranges.sort(function (a, b) { return cmp(a.from(), b.from()); });
		primIndex = indexOf(ranges, prim);
		for (var i = 1; i < ranges.length; i++) {
			var cur = ranges[i], prev = ranges[i - 1];
			var diff = cmp(prev.to(), cur.from());
			if (mayTouch && !cur.empty() ? diff > 0 : diff >= 0) {
				var from = minPos(prev.from(), cur.from()), to = maxPos(prev.to(), cur.to());
				var inv = prev.empty() ? cur.from() == cur.head : prev.from() == prev.head;
				if (i <= primIndex) { --primIndex; }
				ranges.splice(--i, 2, new Range(inv ? to : from, inv ? from : to));
			}
		}
		return new Selection(ranges, primIndex)
	}

	function simpleSelection(anchor, head) {
		return new Selection([new Range(anchor, head || anchor)], 0)
	}

	// Compute the position of the end of a change (its 'to' property
	// refers to the pre-change end).
	function changeEnd(change) {
		if (!change.text) { return change.to }
		return Pos(change.from.line + change.text.length - 1,
							 lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0))
	}

	// Adjust a position to refer to the post-change position of the
	// same text, or the end of the change if the change covers it.
	function adjustForChange(pos, change) {
		if (cmp(pos, change.from) < 0) { return pos }
		if (cmp(pos, change.to) <= 0) { return changeEnd(change) }

		var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
		if (pos.line == change.to.line) { ch += changeEnd(change).ch - change.to.ch; }
		return Pos(line, ch)
	}

	function computeSelAfterChange(doc, change) {
		var out = [];
		for (var i = 0; i < doc.sel.ranges.length; i++) {
			var range = doc.sel.ranges[i];
			out.push(new Range(adjustForChange(range.anchor, change),
												 adjustForChange(range.head, change)));
		}
		return normalizeSelection(doc.cm, out, doc.sel.primIndex)
	}

	function offsetPos(pos, old, nw) {
		if (pos.line == old.line)
			{ return Pos(nw.line, pos.ch - old.ch + nw.ch) }
		else
			{ return Pos(nw.line + (pos.line - old.line), pos.ch) }
	}

	// Used by replaceSelections to allow moving the selection to the
	// start or around the replaced test. Hint may be "start" or "around".
	function computeReplacedSel(doc, changes, hint) {
		var out = [];
		var oldPrev = Pos(doc.first, 0), newPrev = oldPrev;
		for (var i = 0; i < changes.length; i++) {
			var change = changes[i];
			var from = offsetPos(change.from, oldPrev, newPrev);
			var to = offsetPos(changeEnd(change), oldPrev, newPrev);
			oldPrev = change.to;
			newPrev = to;
			if (hint == "around") {
				var range = doc.sel.ranges[i], inv = cmp(range.head, range.anchor) < 0;
				out[i] = new Range(inv ? to : from, inv ? from : to);
			} else {
				out[i] = new Range(from, from);
			}
		}
		return new Selection(out, doc.sel.primIndex)
	}

	// Used to get the editor into a consistent state again when options change.

	function loadMode(cm) {
		cm.doc.mode = getMode(cm.options, cm.doc.modeOption);
		resetModeState(cm);
	}

	function resetModeState(cm) {
		cm.doc.iter(function (line) {
			if (line.stateAfter) { line.stateAfter = null; }
			if (line.styles) { line.styles = null; }
		});
		cm.doc.modeFrontier = cm.doc.highlightFrontier = cm.doc.first;
		startWorker(cm, 100);
		cm.state.modeGen++;
		if (cm.curOp) { regChange(cm); }
	}

	// DOCUMENT DATA STRUCTURE

	// By default, updates that start and end at the beginning of a line
	// are treated specially, in order to make the association of line
	// widgets and marker elements with the text behave more intuitive.
	function isWholeLineUpdate(doc, change) {
		return change.from.ch == 0 && change.to.ch == 0 && lst(change.text) == "" &&
			(!doc.cm || doc.cm.options.wholeLineUpdateBefore)
	}

	// Perform a change on the document data structure.
	function updateDoc(doc, change, markedSpans, estimateHeight) {
		function spansFor(n) {return markedSpans ? markedSpans[n] : null}
		function update(line, text, spans) {
			updateLine(line, text, spans, estimateHeight);
			signalLater(line, "change", line, change);
		}
		function linesFor(start, end) {
			var result = [];
			for (var i = start; i < end; ++i)
				{ result.push(new Line(text[i], spansFor(i), estimateHeight)); }
			return result
		}

		var from = change.from, to = change.to, text = change.text;
		var firstLine = getLine(doc, from.line), lastLine = getLine(doc, to.line);
		var lastText = lst(text), lastSpans = spansFor(text.length - 1), nlines = to.line - from.line;

		// Adjust the line structure
		if (change.full) {
			doc.insert(0, linesFor(0, text.length));
			doc.remove(text.length, doc.size - text.length);
		} else if (isWholeLineUpdate(doc, change)) {
			// This is a whole-line replace. Treated specially to make
			// sure line objects move the way they are supposed to.
			var added = linesFor(0, text.length - 1);
			update(lastLine, lastLine.text, lastSpans);
			if (nlines) { doc.remove(from.line, nlines); }
			if (added.length) { doc.insert(from.line, added); }
		} else if (firstLine == lastLine) {
			if (text.length == 1) {
				update(firstLine, firstLine.text.slice(0, from.ch) + lastText + firstLine.text.slice(to.ch), lastSpans);
			} else {
				var added$1 = linesFor(1, text.length - 1);
				added$1.push(new Line(lastText + firstLine.text.slice(to.ch), lastSpans, estimateHeight));
				update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
				doc.insert(from.line + 1, added$1);
			}
		} else if (text.length == 1) {
			update(firstLine, firstLine.text.slice(0, from.ch) + text[0] + lastLine.text.slice(to.ch), spansFor(0));
			doc.remove(from.line + 1, nlines);
		} else {
			update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
			update(lastLine, lastText + lastLine.text.slice(to.ch), lastSpans);
			var added$2 = linesFor(1, text.length - 1);
			if (nlines > 1) { doc.remove(from.line + 1, nlines - 1); }
			doc.insert(from.line + 1, added$2);
		}

		signalLater(doc, "change", doc, change);
	}

	// Call f for all linked documents.
	function linkedDocs(doc, f, sharedHistOnly) {
		function propagate(doc, skip, sharedHist) {
			if (doc.linked) { for (var i = 0; i < doc.linked.length; ++i) {
				var rel = doc.linked[i];
				if (rel.doc == skip) { continue }
				var shared = sharedHist && rel.sharedHist;
				if (sharedHistOnly && !shared) { continue }
				f(rel.doc, shared);
				propagate(rel.doc, doc, shared);
			} }
		}
		propagate(doc, null, true);
	}

	// Attach a document to an editor.
	function attachDoc(cm, doc) {
		if (doc.cm) { throw new Error("This document is already in use.") }
		cm.doc = doc;
		doc.cm = cm;
		estimateLineHeights(cm);
		loadMode(cm);
		setDirectionClass(cm);
		cm.options.direction = doc.direction;
		if (!cm.options.lineWrapping) { findMaxLine(cm); }
		cm.options.mode = doc.modeOption;
		regChange(cm);
	}

	function setDirectionClass(cm) {
	(cm.doc.direction == "rtl" ? addClass : rmClass)(cm.display.lineDiv, "CodeMirror-rtl");
	}

	function directionChanged(cm) {
		runInOp(cm, function () {
			setDirectionClass(cm);
			regChange(cm);
		});
	}

	function History(prev) {
		// Arrays of change events and selections. Doing something adds an
		// event to done and clears undo. Undoing moves events from done
		// to undone, redoing moves them in the other direction.
		this.done = []; this.undone = [];
		this.undoDepth = prev ? prev.undoDepth : Infinity;
		// Used to track when changes can be merged into a single undo
		// event
		this.lastModTime = this.lastSelTime = 0;
		this.lastOp = this.lastSelOp = null;
		this.lastOrigin = this.lastSelOrigin = null;
		// Used by the isClean() method
		this.generation = this.maxGeneration = prev ? prev.maxGeneration : 1;
	}

	// Create a history change event from an updateDoc-style change
	// object.
	function historyChangeFromChange(doc, change) {
		var histChange = {from: copyPos(change.from), to: changeEnd(change), text: getBetween(doc, change.from, change.to)};
		attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
		linkedDocs(doc, function (doc) { return attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1); }, true);
		return histChange
	}

	// Pop all selection events off the end of a history array. Stop at
	// a change event.
	function clearSelectionEvents(array) {
		while (array.length) {
			var last = lst(array);
			if (last.ranges) { array.pop(); }
			else { break }
		}
	}

	// Find the top change event in the history. Pop off selection
	// events that are in the way.
	function lastChangeEvent(hist, force) {
		if (force) {
			clearSelectionEvents(hist.done);
			return lst(hist.done)
		} else if (hist.done.length && !lst(hist.done).ranges) {
			return lst(hist.done)
		} else if (hist.done.length > 1 && !hist.done[hist.done.length - 2].ranges) {
			hist.done.pop();
			return lst(hist.done)
		}
	}

	// Register a change in the history. Merges changes that are within
	// a single operation, or are close together with an origin that
	// allows merging (starting with "+") into a single event.
	function addChangeToHistory(doc, change, selAfter, opId) {
		var hist = doc.history;
		hist.undone.length = 0;
		var time = +new Date, cur;
		var last;

		if ((hist.lastOp == opId ||
				 hist.lastOrigin == change.origin && change.origin &&
				 ((change.origin.charAt(0) == "+" && hist.lastModTime > time - (doc.cm ? doc.cm.options.historyEventDelay : 500)) ||
					change.origin.charAt(0) == "*")) &&
				(cur = lastChangeEvent(hist, hist.lastOp == opId))) {
			// Merge this change into the last event
			last = lst(cur.changes);
			if (cmp(change.from, change.to) == 0 && cmp(change.from, last.to) == 0) {
				// Optimized case for simple insertion -- don't want to add
				// new changesets for every character typed
				last.to = changeEnd(change);
			} else {
				// Add new sub-event
				cur.changes.push(historyChangeFromChange(doc, change));
			}
		} else {
			// Can not be merged, start a new event.
			var before = lst(hist.done);
			if (!before || !before.ranges)
				{ pushSelectionToHistory(doc.sel, hist.done); }
			cur = {changes: [historyChangeFromChange(doc, change)],
						 generation: hist.generation};
			hist.done.push(cur);
			while (hist.done.length > hist.undoDepth) {
				hist.done.shift();
				if (!hist.done[0].ranges) { hist.done.shift(); }
			}
		}
		hist.done.push(selAfter);
		hist.generation = ++hist.maxGeneration;
		hist.lastModTime = hist.lastSelTime = time;
		hist.lastOp = hist.lastSelOp = opId;
		hist.lastOrigin = hist.lastSelOrigin = change.origin;

		if (!last) { signal(doc, "historyAdded"); }
	}

	function selectionEventCanBeMerged(doc, origin, prev, sel) {
		var ch = origin.charAt(0);
		return ch == "*" ||
			ch == "+" &&
			prev.ranges.length == sel.ranges.length &&
			prev.somethingSelected() == sel.somethingSelected() &&
			new Date - doc.history.lastSelTime <= (doc.cm ? doc.cm.options.historyEventDelay : 500)
	}

	// Called whenever the selection changes, sets the new selection as
	// the pending selection in the history, and pushes the old pending
	// selection into the 'done' array when it was significantly
	// different (in number of selected ranges, emptiness, or time).
	function addSelectionToHistory(doc, sel, opId, options) {
		var hist = doc.history, origin = options && options.origin;

		// A new event is started when the previous origin does not match
		// the current, or the origins don't allow matching. Origins
		// starting with * are always merged, those starting with + are
		// merged when similar and close together in time.
		if (opId == hist.lastSelOp ||
				(origin && hist.lastSelOrigin == origin &&
				 (hist.lastModTime == hist.lastSelTime && hist.lastOrigin == origin ||
					selectionEventCanBeMerged(doc, origin, lst(hist.done), sel))))
			{ hist.done[hist.done.length - 1] = sel; }
		else
			{ pushSelectionToHistory(sel, hist.done); }

		hist.lastSelTime = +new Date;
		hist.lastSelOrigin = origin;
		hist.lastSelOp = opId;
		if (options && options.clearRedo !== false)
			{ clearSelectionEvents(hist.undone); }
	}

	function pushSelectionToHistory(sel, dest) {
		var top = lst(dest);
		if (!(top && top.ranges && top.equals(sel)))
			{ dest.push(sel); }
	}

	// Used to store marked span information in the history.
	function attachLocalSpans(doc, change, from, to) {
		var existing = change["spans_" + doc.id], n = 0;
		doc.iter(Math.max(doc.first, from), Math.min(doc.first + doc.size, to), function (line) {
			if (line.markedSpans)
				{ (existing || (existing = change["spans_" + doc.id] = {}))[n] = line.markedSpans; }
			++n;
		});
	}

	// When un/re-doing restores text containing marked spans, those
	// that have been explicitly cleared should not be restored.
	function removeClearedSpans(spans) {
		if (!spans) { return null }
		var out;
		for (var i = 0; i < spans.length; ++i) {
			if (spans[i].marker.explicitlyCleared) { if (!out) { out = spans.slice(0, i); } }
			else if (out) { out.push(spans[i]); }
		}
		return !out ? spans : out.length ? out : null
	}

	// Retrieve and filter the old marked spans stored in a change event.
	function getOldSpans(doc, change) {
		var found = change["spans_" + doc.id];
		if (!found) { return null }
		var nw = [];
		for (var i = 0; i < change.text.length; ++i)
			{ nw.push(removeClearedSpans(found[i])); }
		return nw
	}

	// Used for un/re-doing changes from the history. Combines the
	// result of computing the existing spans with the set of spans that
	// existed in the history (so that deleting around a span and then
	// undoing brings back the span).
	function mergeOldSpans(doc, change) {
		var old = getOldSpans(doc, change);
		var stretched = stretchSpansOverChange(doc, change);
		if (!old) { return stretched }
		if (!stretched) { return old }

		for (var i = 0; i < old.length; ++i) {
			var oldCur = old[i], stretchCur = stretched[i];
			if (oldCur && stretchCur) {
				spans: for (var j = 0; j < stretchCur.length; ++j) {
					var span = stretchCur[j];
					for (var k = 0; k < oldCur.length; ++k)
						{ if (oldCur[k].marker == span.marker) { continue spans } }
					oldCur.push(span);
				}
			} else if (stretchCur) {
				old[i] = stretchCur;
			}
		}
		return old
	}

	// Used both to provide a JSON-safe object in .getHistory, and, when
	// detaching a document, to split the history in two
	function copyHistoryArray(events, newGroup, instantiateSel) {
		var copy = [];
		for (var i = 0; i < events.length; ++i) {
			var event = events[i];
			if (event.ranges) {
				copy.push(instantiateSel ? Selection.prototype.deepCopy.call(event) : event);
				continue
			}
			var changes = event.changes, newChanges = [];
			copy.push({changes: newChanges});
			for (var j = 0; j < changes.length; ++j) {
				var change = changes[j], m = (void 0);
				newChanges.push({from: change.from, to: change.to, text: change.text});
				if (newGroup) { for (var prop in change) { if (m = prop.match(/^spans_(\d+)$/)) {
					if (indexOf(newGroup, Number(m[1])) > -1) {
						lst(newChanges)[prop] = change[prop];
						delete change[prop];
					}
				} } }
			}
		}
		return copy
	}

	// The 'scroll' parameter given to many of these indicated whether
	// the new cursor position should be scrolled into view after
	// modifying the selection.

	// If shift is held or the extend flag is set, extends a range to
	// include a given position (and optionally a second position).
	// Otherwise, simply returns the range between the given positions.
	// Used for cursor motion and such.
	function extendRange(range, head, other, extend) {
		if (extend) {
			var anchor = range.anchor;
			if (other) {
				var posBefore = cmp(head, anchor) < 0;
				if (posBefore != (cmp(other, anchor) < 0)) {
					anchor = head;
					head = other;
				} else if (posBefore != (cmp(head, other) < 0)) {
					head = other;
				}
			}
			return new Range(anchor, head)
		} else {
			return new Range(other || head, head)
		}
	}

	// Extend the primary selection range, discard the rest.
	function extendSelection(doc, head, other, options, extend) {
		if (extend == null) { extend = doc.cm && (doc.cm.display.shift || doc.extend); }
		setSelection(doc, new Selection([extendRange(doc.sel.primary(), head, other, extend)], 0), options);
	}

	// Extend all selections (pos is an array of selections with length
	// equal the number of selections)
	function extendSelections(doc, heads, options) {
		var out = [];
		var extend = doc.cm && (doc.cm.display.shift || doc.extend);
		for (var i = 0; i < doc.sel.ranges.length; i++)
			{ out[i] = extendRange(doc.sel.ranges[i], heads[i], null, extend); }
		var newSel = normalizeSelection(doc.cm, out, doc.sel.primIndex);
		setSelection(doc, newSel, options);
	}

	// Updates a single range in the selection.
	function replaceOneSelection(doc, i, range, options) {
		var ranges = doc.sel.ranges.slice(0);
		ranges[i] = range;
		setSelection(doc, normalizeSelection(doc.cm, ranges, doc.sel.primIndex), options);
	}

	// Reset the selection to a single range.
	function setSimpleSelection(doc, anchor, head, options) {
		setSelection(doc, simpleSelection(anchor, head), options);
	}

	// Give beforeSelectionChange handlers a change to influence a
	// selection update.
	function filterSelectionChange(doc, sel, options) {
		var obj = {
			ranges: sel.ranges,
			update: function(ranges) {
				this.ranges = [];
				for (var i = 0; i < ranges.length; i++)
					{ this.ranges[i] = new Range(clipPos(doc, ranges[i].anchor),
																		 clipPos(doc, ranges[i].head)); }
			},
			origin: options && options.origin
		};
		signal(doc, "beforeSelectionChange", doc, obj);
		if (doc.cm) { signal(doc.cm, "beforeSelectionChange", doc.cm, obj); }
		if (obj.ranges != sel.ranges) { return normalizeSelection(doc.cm, obj.ranges, obj.ranges.length - 1) }
		else { return sel }
	}

	function setSelectionReplaceHistory(doc, sel, options) {
		var done = doc.history.done, last = lst(done);
		if (last && last.ranges) {
			done[done.length - 1] = sel;
			setSelectionNoUndo(doc, sel, options);
		} else {
			setSelection(doc, sel, options);
		}
	}

	// Set a new selection.
	function setSelection(doc, sel, options) {
		setSelectionNoUndo(doc, sel, options);
		addSelectionToHistory(doc, doc.sel, doc.cm ? doc.cm.curOp.id : NaN, options);
	}

	function setSelectionNoUndo(doc, sel, options) {
		if (hasHandler(doc, "beforeSelectionChange") || doc.cm && hasHandler(doc.cm, "beforeSelectionChange"))
			{ sel = filterSelectionChange(doc, sel, options); }

		var bias = options && options.bias ||
			(cmp(sel.primary().head, doc.sel.primary().head) < 0 ? -1 : 1);
		setSelectionInner(doc, skipAtomicInSelection(doc, sel, bias, true));

		if (!(options && options.scroll === false) && doc.cm && doc.cm.getOption("readOnly") != "nocursor")
			{ ensureCursorVisible(doc.cm); }
	}

	function setSelectionInner(doc, sel) {
		if (sel.equals(doc.sel)) { return }

		doc.sel = sel;

		if (doc.cm) {
			doc.cm.curOp.updateInput = 1;
			doc.cm.curOp.selectionChanged = true;
			signalCursorActivity(doc.cm);
		}
		signalLater(doc, "cursorActivity", doc);
	}

	// Verify that the selection does not partially select any atomic
	// marked ranges.
	function reCheckSelection(doc) {
		setSelectionInner(doc, skipAtomicInSelection(doc, doc.sel, null, false));
	}

	// Return a selection that does not partially select any atomic
	// ranges.
	function skipAtomicInSelection(doc, sel, bias, mayClear) {
		var out;
		for (var i = 0; i < sel.ranges.length; i++) {
			var range = sel.ranges[i];
			var old = sel.ranges.length == doc.sel.ranges.length && doc.sel.ranges[i];
			var newAnchor = skipAtomic(doc, range.anchor, old && old.anchor, bias, mayClear);
			var newHead = range.head == range.anchor ? newAnchor : skipAtomic(doc, range.head, old && old.head, bias, mayClear);
			if (out || newAnchor != range.anchor || newHead != range.head) {
				if (!out) { out = sel.ranges.slice(0, i); }
				out[i] = new Range(newAnchor, newHead);
			}
		}
		return out ? normalizeSelection(doc.cm, out, sel.primIndex) : sel
	}

	function skipAtomicInner(doc, pos, oldPos, dir, mayClear) {
		var line = getLine(doc, pos.line);
		if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
			var sp = line.markedSpans[i], m = sp.marker;

			// Determine if we should prevent the cursor being placed to the left/right of an atomic marker
			// Historically this was determined using the inclusiveLeft/Right option, but the new way to control it
			// is with selectLeft/Right
			var preventCursorLeft = ("selectLeft" in m) ? !m.selectLeft : m.inclusiveLeft;
			var preventCursorRight = ("selectRight" in m) ? !m.selectRight : m.inclusiveRight;

			if ((sp.from == null || (preventCursorLeft ? sp.from <= pos.ch : sp.from < pos.ch)) &&
					(sp.to == null || (preventCursorRight ? sp.to >= pos.ch : sp.to > pos.ch))) {
				if (mayClear) {
					signal(m, "beforeCursorEnter");
					if (m.explicitlyCleared) {
						if (!line.markedSpans) { break }
						else {--i; continue}
					}
				}
				if (!m.atomic) { continue }

				if (oldPos) {
					var near = m.find(dir < 0 ? 1 : -1), diff = (void 0);
					if (dir < 0 ? preventCursorRight : preventCursorLeft)
						{ near = movePos(doc, near, -dir, near && near.line == pos.line ? line : null); }
					if (near && near.line == pos.line && (diff = cmp(near, oldPos)) && (dir < 0 ? diff < 0 : diff > 0))
						{ return skipAtomicInner(doc, near, pos, dir, mayClear) }
				}

				var far = m.find(dir < 0 ? -1 : 1);
				if (dir < 0 ? preventCursorLeft : preventCursorRight)
					{ far = movePos(doc, far, dir, far.line == pos.line ? line : null); }
				return far ? skipAtomicInner(doc, far, pos, dir, mayClear) : null
			}
		} }
		return pos
	}

	// Ensure a given position is not inside an atomic range.
	function skipAtomic(doc, pos, oldPos, bias, mayClear) {
		var dir = bias || 1;
		var found = skipAtomicInner(doc, pos, oldPos, dir, mayClear) ||
				(!mayClear && skipAtomicInner(doc, pos, oldPos, dir, true)) ||
				skipAtomicInner(doc, pos, oldPos, -dir, mayClear) ||
				(!mayClear && skipAtomicInner(doc, pos, oldPos, -dir, true));
		if (!found) {
			doc.cantEdit = true;
			return Pos(doc.first, 0)
		}
		return found
	}

	function movePos(doc, pos, dir, line) {
		if (dir < 0 && pos.ch == 0) {
			if (pos.line > doc.first) { return clipPos(doc, Pos(pos.line - 1)) }
			else { return null }
		} else if (dir > 0 && pos.ch == (line || getLine(doc, pos.line)).text.length) {
			if (pos.line < doc.first + doc.size - 1) { return Pos(pos.line + 1, 0) }
			else { return null }
		} else {
			return new Pos(pos.line, pos.ch + dir)
		}
	}

	function selectAll(cm) {
		cm.setSelection(Pos(cm.firstLine(), 0), Pos(cm.lastLine()), sel_dontScroll);
	}

	// UPDATING

	// Allow "beforeChange" event handlers to influence a change
	function filterChange(doc, change, update) {
		var obj = {
			canceled: false,
			from: change.from,
			to: change.to,
			text: change.text,
			origin: change.origin,
			cancel: function () { return obj.canceled = true; }
		};
		if (update) { obj.update = function (from, to, text, origin) {
			if (from) { obj.from = clipPos(doc, from); }
			if (to) { obj.to = clipPos(doc, to); }
			if (text) { obj.text = text; }
			if (origin !== undefined) { obj.origin = origin; }
		}; }
		signal(doc, "beforeChange", doc, obj);
		if (doc.cm) { signal(doc.cm, "beforeChange", doc.cm, obj); }

		if (obj.canceled) {
			if (doc.cm) { doc.cm.curOp.updateInput = 2; }
			return null
		}
		return {from: obj.from, to: obj.to, text: obj.text, origin: obj.origin}
	}

	// Apply a change to a document, and add it to the document's
	// history, and propagating it to all linked documents.
	function makeChange(doc, change, ignoreReadOnly) {
		if (doc.cm) {
			if (!doc.cm.curOp) { return operation(doc.cm, makeChange)(doc, change, ignoreReadOnly) }
			if (doc.cm.state.suppressEdits) { return }
		}

		if (hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange")) {
			change = filterChange(doc, change, true);
			if (!change) { return }
		}

		// Possibly split or suppress the update based on the presence
		// of read-only spans in its range.
		var split = sawReadOnlySpans && !ignoreReadOnly && removeReadOnlyRanges(doc, change.from, change.to);
		if (split) {
			for (var i = split.length - 1; i >= 0; --i)
				{ makeChangeInner(doc, {from: split[i].from, to: split[i].to, text: i ? [""] : change.text, origin: change.origin}); }
		} else {
			makeChangeInner(doc, change);
		}
	}

	function makeChangeInner(doc, change) {
		if (change.text.length == 1 && change.text[0] == "" && cmp(change.from, change.to) == 0) { return }
		var selAfter = computeSelAfterChange(doc, change);
		addChangeToHistory(doc, change, selAfter, doc.cm ? doc.cm.curOp.id : NaN);

		makeChangeSingleDoc(doc, change, selAfter, stretchSpansOverChange(doc, change));
		var rebased = [];

		linkedDocs(doc, function (doc, sharedHist) {
			if (!sharedHist && indexOf(rebased, doc.history) == -1) {
				rebaseHist(doc.history, change);
				rebased.push(doc.history);
			}
			makeChangeSingleDoc(doc, change, null, stretchSpansOverChange(doc, change));
		});
	}

	// Revert a change stored in a document's history.
	function makeChangeFromHistory(doc, type, allowSelectionOnly) {
		var suppress = doc.cm && doc.cm.state.suppressEdits;
		if (suppress && !allowSelectionOnly) { return }

		var hist = doc.history, event, selAfter = doc.sel;
		var source = type == "undo" ? hist.done : hist.undone, dest = type == "undo" ? hist.undone : hist.done;

		// Verify that there is a useable event (so that ctrl-z won't
		// needlessly clear selection events)
		var i = 0;
		for (; i < source.length; i++) {
			event = source[i];
			if (allowSelectionOnly ? event.ranges && !event.equals(doc.sel) : !event.ranges)
				{ break }
		}
		if (i == source.length) { return }
		hist.lastOrigin = hist.lastSelOrigin = null;

		for (;;) {
			event = source.pop();
			if (event.ranges) {
				pushSelectionToHistory(event, dest);
				if (allowSelectionOnly && !event.equals(doc.sel)) {
					setSelection(doc, event, {clearRedo: false});
					return
				}
				selAfter = event;
			} else if (suppress) {
				source.push(event);
				return
			} else { break }
		}

		// Build up a reverse change object to add to the opposite history
		// stack (redo when undoing, and vice versa).
		var antiChanges = [];
		pushSelectionToHistory(selAfter, dest);
		dest.push({changes: antiChanges, generation: hist.generation});
		hist.generation = event.generation || ++hist.maxGeneration;

		var filter = hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange");

		var loop = function ( i ) {
			var change = event.changes[i];
			change.origin = type;
			if (filter && !filterChange(doc, change, false)) {
				source.length = 0;
				return {}
			}

			antiChanges.push(historyChangeFromChange(doc, change));

			var after = i ? computeSelAfterChange(doc, change) : lst(source);
			makeChangeSingleDoc(doc, change, after, mergeOldSpans(doc, change));
			if (!i && doc.cm) { doc.cm.scrollIntoView({from: change.from, to: changeEnd(change)}); }
			var rebased = [];

			// Propagate to the linked documents
			linkedDocs(doc, function (doc, sharedHist) {
				if (!sharedHist && indexOf(rebased, doc.history) == -1) {
					rebaseHist(doc.history, change);
					rebased.push(doc.history);
				}
				makeChangeSingleDoc(doc, change, null, mergeOldSpans(doc, change));
			});
		};

		for (var i$1 = event.changes.length - 1; i$1 >= 0; --i$1) {
			var returned = loop( i$1 );

			if ( returned ) return returned.v;
		}
	}

	// Sub-views need their line numbers shifted when text is added
	// above or below them in the parent document.
	function shiftDoc(doc, distance) {
		if (distance == 0) { return }
		doc.first += distance;
		doc.sel = new Selection(map(doc.sel.ranges, function (range) { return new Range(
			Pos(range.anchor.line + distance, range.anchor.ch),
			Pos(range.head.line + distance, range.head.ch)
		); }), doc.sel.primIndex);
		if (doc.cm) {
			regChange(doc.cm, doc.first, doc.first - distance, distance);
			for (var d = doc.cm.display, l = d.viewFrom; l < d.viewTo; l++)
				{ regLineChange(doc.cm, l, "gutter"); }
		}
	}

	// More lower-level change function, handling only a single document
	// (not linked ones).
	function makeChangeSingleDoc(doc, change, selAfter, spans) {
		if (doc.cm && !doc.cm.curOp)
			{ return operation(doc.cm, makeChangeSingleDoc)(doc, change, selAfter, spans) }

		if (change.to.line < doc.first) {
			shiftDoc(doc, change.text.length - 1 - (change.to.line - change.from.line));
			return
		}
		if (change.from.line > doc.lastLine()) { return }

		// Clip the change to the size of this doc
		if (change.from.line < doc.first) {
			var shift = change.text.length - 1 - (doc.first - change.from.line);
			shiftDoc(doc, shift);
			change = {from: Pos(doc.first, 0), to: Pos(change.to.line + shift, change.to.ch),
								text: [lst(change.text)], origin: change.origin};
		}
		var last = doc.lastLine();
		if (change.to.line > last) {
			change = {from: change.from, to: Pos(last, getLine(doc, last).text.length),
								text: [change.text[0]], origin: change.origin};
		}

		change.removed = getBetween(doc, change.from, change.to);

		if (!selAfter) { selAfter = computeSelAfterChange(doc, change); }
		if (doc.cm) { makeChangeSingleDocInEditor(doc.cm, change, spans); }
		else { updateDoc(doc, change, spans); }
		setSelectionNoUndo(doc, selAfter, sel_dontScroll);

		if (doc.cantEdit && skipAtomic(doc, Pos(doc.firstLine(), 0)))
			{ doc.cantEdit = false; }
	}

	// Handle the interaction of a change to a document with the editor
	// that this document is part of.
	function makeChangeSingleDocInEditor(cm, change, spans) {
		var doc = cm.doc, display = cm.display, from = change.from, to = change.to;

		var recomputeMaxLength = false, checkWidthStart = from.line;
		if (!cm.options.lineWrapping) {
			checkWidthStart = lineNo(visualLine(getLine(doc, from.line)));
			doc.iter(checkWidthStart, to.line + 1, function (line) {
				if (line == display.maxLine) {
					recomputeMaxLength = true;
					return true
				}
			});
		}

		if (doc.sel.contains(change.from, change.to) > -1)
			{ signalCursorActivity(cm); }

		updateDoc(doc, change, spans, estimateHeight(cm));

		if (!cm.options.lineWrapping) {
			doc.iter(checkWidthStart, from.line + change.text.length, function (line) {
				var len = lineLength(line);
				if (len > display.maxLineLength) {
					display.maxLine = line;
					display.maxLineLength = len;
					display.maxLineChanged = true;
					recomputeMaxLength = false;
				}
			});
			if (recomputeMaxLength) { cm.curOp.updateMaxLine = true; }
		}

		retreatFrontier(doc, from.line);
		startWorker(cm, 400);

		var lendiff = change.text.length - (to.line - from.line) - 1;
		// Remember that these lines changed, for updating the display
		if (change.full)
			{ regChange(cm); }
		else if (from.line == to.line && change.text.length == 1 && !isWholeLineUpdate(cm.doc, change))
			{ regLineChange(cm, from.line, "text"); }
		else
			{ regChange(cm, from.line, to.line + 1, lendiff); }

		var changesHandler = hasHandler(cm, "changes"), changeHandler = hasHandler(cm, "change");
		if (changeHandler || changesHandler) {
			var obj = {
				from: from, to: to,
				text: change.text,
				removed: change.removed,
				origin: change.origin
			};
			if (changeHandler) { signalLater(cm, "change", cm, obj); }
			if (changesHandler) { (cm.curOp.changeObjs || (cm.curOp.changeObjs = [])).push(obj); }
		}
		cm.display.selForContextMenu = null;
	}

	function replaceRange(doc, code, from, to, origin) {
		var assign;

		if (!to) { to = from; }
		if (cmp(to, from) < 0) { (assign = [to, from], from = assign[0], to = assign[1]); }
		if (typeof code == "string") { code = doc.splitLines(code); }
		makeChange(doc, {from: from, to: to, text: code, origin: origin});
	}

	// Rebasing/resetting history to deal with externally-sourced changes

	function rebaseHistSelSingle(pos, from, to, diff) {
		if (to < pos.line) {
			pos.line += diff;
		} else if (from < pos.line) {
			pos.line = from;
			pos.ch = 0;
		}
	}

	// Tries to rebase an array of history events given a change in the
	// document. If the change touches the same lines as the event, the
	// event, and everything 'behind' it, is discarded. If the change is
	// before the event, the event's positions are updated. Uses a
	// copy-on-write scheme for the positions, to avoid having to
	// reallocate them all on every rebase, but also avoid problems with
	// shared position objects being unsafely updated.
	function rebaseHistArray(array, from, to, diff) {
		for (var i = 0; i < array.length; ++i) {
			var sub = array[i], ok = true;
			if (sub.ranges) {
				if (!sub.copied) { sub = array[i] = sub.deepCopy(); sub.copied = true; }
				for (var j = 0; j < sub.ranges.length; j++) {
					rebaseHistSelSingle(sub.ranges[j].anchor, from, to, diff);
					rebaseHistSelSingle(sub.ranges[j].head, from, to, diff);
				}
				continue
			}
			for (var j$1 = 0; j$1 < sub.changes.length; ++j$1) {
				var cur = sub.changes[j$1];
				if (to < cur.from.line) {
					cur.from = Pos(cur.from.line + diff, cur.from.ch);
					cur.to = Pos(cur.to.line + diff, cur.to.ch);
				} else if (from <= cur.to.line) {
					ok = false;
					break
				}
			}
			if (!ok) {
				array.splice(0, i + 1);
				i = 0;
			}
		}
	}

	function rebaseHist(hist, change) {
		var from = change.from.line, to = change.to.line, diff = change.text.length - (to - from) - 1;
		rebaseHistArray(hist.done, from, to, diff);
		rebaseHistArray(hist.undone, from, to, diff);
	}

	// Utility for applying a change to a line by handle or number,
	// returning the number and optionally registering the line as
	// changed.
	function changeLine(doc, handle, changeType, op) {
		var no = handle, line = handle;
		if (typeof handle == "number") { line = getLine(doc, clipLine(doc, handle)); }
		else { no = lineNo(handle); }
		if (no == null) { return null }
		if (op(line, no) && doc.cm) { regLineChange(doc.cm, no, changeType); }
		return line
	}

	// The document is represented as a BTree consisting of leaves, with
	// chunk of lines in them, and branches, with up to ten leaves or
	// other branch nodes below them. The top node is always a branch
	// node, and is the document object itself (meaning it has
	// additional methods and properties).
	//
	// All nodes have parent links. The tree is used both to go from
	// line numbers to line objects, and to go from objects to numbers.
	// It also indexes by height, and is used to convert between height
	// and line object, and to find the total height of the document.
	//
	// See also http://marijnhaverbeke.nl/blog/codemirror-line-tree.html

	function LeafChunk(lines) {
		this.lines = lines;
		this.parent = null;
		var height = 0;
		for (var i = 0; i < lines.length; ++i) {
			lines[i].parent = this;
			height += lines[i].height;
		}
		this.height = height;
	}

	LeafChunk.prototype = {
		chunkSize: function() { return this.lines.length },

		// Remove the n lines at offset 'at'.
		removeInner: function(at, n) {
			for (var i = at, e = at + n; i < e; ++i) {
				var line = this.lines[i];
				this.height -= line.height;
				cleanUpLine(line);
				signalLater(line, "delete");
			}
			this.lines.splice(at, n);
		},

		// Helper used to collapse a small branch into a single leaf.
		collapse: function(lines) {
			lines.push.apply(lines, this.lines);
		},

		// Insert the given array of lines at offset 'at', count them as
		// having the given height.
		insertInner: function(at, lines, height) {
			this.height += height;
			this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));
			for (var i = 0; i < lines.length; ++i) { lines[i].parent = this; }
		},

		// Used to iterate over a part of the tree.
		iterN: function(at, n, op) {
			for (var e = at + n; at < e; ++at)
				{ if (op(this.lines[at])) { return true } }
		}
	};

	function BranchChunk(children) {
		this.children = children;
		var size = 0, height = 0;
		for (var i = 0; i < children.length; ++i) {
			var ch = children[i];
			size += ch.chunkSize(); height += ch.height;
			ch.parent = this;
		}
		this.size = size;
		this.height = height;
		this.parent = null;
	}

	BranchChunk.prototype = {
		chunkSize: function() { return this.size },

		removeInner: function(at, n) {
			this.size -= n;
			for (var i = 0; i < this.children.length; ++i) {
				var child = this.children[i], sz = child.chunkSize();
				if (at < sz) {
					var rm = Math.min(n, sz - at), oldHeight = child.height;
					child.removeInner(at, rm);
					this.height -= oldHeight - child.height;
					if (sz == rm) { this.children.splice(i--, 1); child.parent = null; }
					if ((n -= rm) == 0) { break }
					at = 0;
				} else { at -= sz; }
			}
			// If the result is smaller than 25 lines, ensure that it is a
			// single leaf node.
			if (this.size - n < 25 &&
					(this.children.length > 1 || !(this.children[0] instanceof LeafChunk))) {
				var lines = [];
				this.collapse(lines);
				this.children = [new LeafChunk(lines)];
				this.children[0].parent = this;
			}
		},

		collapse: function(lines) {
			for (var i = 0; i < this.children.length; ++i) { this.children[i].collapse(lines); }
		},

		insertInner: function(at, lines, height) {
			this.size += lines.length;
			this.height += height;
			for (var i = 0; i < this.children.length; ++i) {
				var child = this.children[i], sz = child.chunkSize();
				if (at <= sz) {
					child.insertInner(at, lines, height);
					if (child.lines && child.lines.length > 50) {
						// To avoid memory thrashing when child.lines is huge (e.g. first view of a large file), it's never spliced.
						// Instead, small slices are taken. They're taken in order because sequential memory accesses are fastest.
						var remaining = child.lines.length % 25 + 25;
						for (var pos = remaining; pos < child.lines.length;) {
							var leaf = new LeafChunk(child.lines.slice(pos, pos += 25));
							child.height -= leaf.height;
							this.children.splice(++i, 0, leaf);
							leaf.parent = this;
						}
						child.lines = child.lines.slice(0, remaining);
						this.maybeSpill();
					}
					break
				}
				at -= sz;
			}
		},

		// When a node has grown, check whether it should be split.
		maybeSpill: function() {
			if (this.children.length <= 10) { return }
			var me = this;
			do {
				var spilled = me.children.splice(me.children.length - 5, 5);
				var sibling = new BranchChunk(spilled);
				if (!me.parent) { // Become the parent node
					var copy = new BranchChunk(me.children);
					copy.parent = me;
					me.children = [copy, sibling];
					me = copy;
			 } else {
					me.size -= sibling.size;
					me.height -= sibling.height;
					var myIndex = indexOf(me.parent.children, me);
					me.parent.children.splice(myIndex + 1, 0, sibling);
				}
				sibling.parent = me.parent;
			} while (me.children.length > 10)
			me.parent.maybeSpill();
		},

		iterN: function(at, n, op) {
			for (var i = 0; i < this.children.length; ++i) {
				var child = this.children[i], sz = child.chunkSize();
				if (at < sz) {
					var used = Math.min(n, sz - at);
					if (child.iterN(at, used, op)) { return true }
					if ((n -= used) == 0) { break }
					at = 0;
				} else { at -= sz; }
			}
		}
	};

	// Line widgets are block elements displayed above or below a line.

	var LineWidget = function(doc, node, options) {
		if (options) { for (var opt in options) { if (options.hasOwnProperty(opt))
			{ this[opt] = options[opt]; } } }
		this.doc = doc;
		this.node = node;
	};

	LineWidget.prototype.clear = function () {
		var cm = this.doc.cm, ws = this.line.widgets, line = this.line, no = lineNo(line);
		if (no == null || !ws) { return }
		for (var i = 0; i < ws.length; ++i) { if (ws[i] == this) { ws.splice(i--, 1); } }
		if (!ws.length) { line.widgets = null; }
		var height = widgetHeight(this);
		updateLineHeight(line, Math.max(0, line.height - height));
		if (cm) {
			runInOp(cm, function () {
				adjustScrollWhenAboveVisible(cm, line, -height);
				regLineChange(cm, no, "widget");
			});
			signalLater(cm, "lineWidgetCleared", cm, this, no);
		}
	};

	LineWidget.prototype.changed = function () {
			var this$1$1 = this;

		var oldH = this.height, cm = this.doc.cm, line = this.line;
		this.height = null;
		var diff = widgetHeight(this) - oldH;
		if (!diff) { return }
		if (!lineIsHidden(this.doc, line)) { updateLineHeight(line, line.height + diff); }
		if (cm) {
			runInOp(cm, function () {
				cm.curOp.forceUpdate = true;
				adjustScrollWhenAboveVisible(cm, line, diff);
				signalLater(cm, "lineWidgetChanged", cm, this$1$1, lineNo(line));
			});
		}
	};
	eventMixin(LineWidget);

	function adjustScrollWhenAboveVisible(cm, line, diff) {
		if (heightAtLine(line) < ((cm.curOp && cm.curOp.scrollTop) || cm.doc.scrollTop))
			{ addToScrollTop(cm, diff); }
	}

	function addLineWidget(doc, handle, node, options) {
		var widget = new LineWidget(doc, node, options);
		var cm = doc.cm;
		if (cm && widget.noHScroll) { cm.display.alignWidgets = true; }
		changeLine(doc, handle, "widget", function (line) {
			var widgets = line.widgets || (line.widgets = []);
			if (widget.insertAt == null) { widgets.push(widget); }
			else { widgets.splice(Math.min(widgets.length, Math.max(0, widget.insertAt)), 0, widget); }
			widget.line = line;
			if (cm && !lineIsHidden(doc, line)) {
				var aboveVisible = heightAtLine(line) < doc.scrollTop;
				updateLineHeight(line, line.height + widgetHeight(widget));
				if (aboveVisible) { addToScrollTop(cm, widget.height); }
				cm.curOp.forceUpdate = true;
			}
			return true
		});
		if (cm) { signalLater(cm, "lineWidgetAdded", cm, widget, typeof handle == "number" ? handle : lineNo(handle)); }
		return widget
	}

	// TEXTMARKERS

	// Created with markText and setBookmark methods. A TextMarker is a
	// handle that can be used to clear or find a marked position in the
	// document. Line objects hold arrays (markedSpans) containing
	// {from, to, marker} object pointing to such marker objects, and
	// indicating that such a marker is present on that line. Multiple
	// lines may point to the same marker when it spans across lines.
	// The spans will have null for their from/to properties when the
	// marker continues beyond the start/end of the line. Markers have
	// links back to the lines they currently touch.

	// Collapsed markers have unique ids, in order to be able to order
	// them, which is needed for uniquely determining an outer marker
	// when they overlap (they may nest, but not partially overlap).
	var nextMarkerId = 0;

	var TextMarker = function(doc, type) {
		this.lines = [];
		this.type = type;
		this.doc = doc;
		this.id = ++nextMarkerId;
	};

	// Clear the marker.
	TextMarker.prototype.clear = function () {
		if (this.explicitlyCleared) { return }
		var cm = this.doc.cm, withOp = cm && !cm.curOp;
		if (withOp) { startOperation(cm); }
		if (hasHandler(this, "clear")) {
			var found = this.find();
			if (found) { signalLater(this, "clear", found.from, found.to); }
		}
		var min = null, max = null;
		for (var i = 0; i < this.lines.length; ++i) {
			var line = this.lines[i];
			var span = getMarkedSpanFor(line.markedSpans, this);
			if (cm && !this.collapsed) { regLineChange(cm, lineNo(line), "text"); }
			else if (cm) {
				if (span.to != null) { max = lineNo(line); }
				if (span.from != null) { min = lineNo(line); }
			}
			line.markedSpans = removeMarkedSpan(line.markedSpans, span);
			if (span.from == null && this.collapsed && !lineIsHidden(this.doc, line) && cm)
				{ updateLineHeight(line, textHeight(cm.display)); }
		}
		if (cm && this.collapsed && !cm.options.lineWrapping) { for (var i$1 = 0; i$1 < this.lines.length; ++i$1) {
			var visual = visualLine(this.lines[i$1]), len = lineLength(visual);
			if (len > cm.display.maxLineLength) {
				cm.display.maxLine = visual;
				cm.display.maxLineLength = len;
				cm.display.maxLineChanged = true;
			}
		} }

		if (min != null && cm && this.collapsed) { regChange(cm, min, max + 1); }
		this.lines.length = 0;
		this.explicitlyCleared = true;
		if (this.atomic && this.doc.cantEdit) {
			this.doc.cantEdit = false;
			if (cm) { reCheckSelection(cm.doc); }
		}
		if (cm) { signalLater(cm, "markerCleared", cm, this, min, max); }
		if (withOp) { endOperation(cm); }
		if (this.parent) { this.parent.clear(); }
	};

	// Find the position of the marker in the document. Returns a {from,
	// to} object by default. Side can be passed to get a specific side
	// -- 0 (both), -1 (left), or 1 (right). When lineObj is true, the
	// Pos objects returned contain a line object, rather than a line
	// number (used to prevent looking up the same line twice).
	TextMarker.prototype.find = function (side, lineObj) {
		if (side == null && this.type == "bookmark") { side = 1; }
		var from, to;
		for (var i = 0; i < this.lines.length; ++i) {
			var line = this.lines[i];
			var span = getMarkedSpanFor(line.markedSpans, this);
			if (span.from != null) {
				from = Pos(lineObj ? line : lineNo(line), span.from);
				if (side == -1) { return from }
			}
			if (span.to != null) {
				to = Pos(lineObj ? line : lineNo(line), span.to);
				if (side == 1) { return to }
			}
		}
		return from && {from: from, to: to}
	};

	// Signals that the marker's widget changed, and surrounding layout
	// should be recomputed.
	TextMarker.prototype.changed = function () {
			var this$1$1 = this;

		var pos = this.find(-1, true), widget = this, cm = this.doc.cm;
		if (!pos || !cm) { return }
		runInOp(cm, function () {
			var line = pos.line, lineN = lineNo(pos.line);
			var view = findViewForLine(cm, lineN);
			if (view) {
				clearLineMeasurementCacheFor(view);
				cm.curOp.selectionChanged = cm.curOp.forceUpdate = true;
			}
			cm.curOp.updateMaxLine = true;
			if (!lineIsHidden(widget.doc, line) && widget.height != null) {
				var oldHeight = widget.height;
				widget.height = null;
				var dHeight = widgetHeight(widget) - oldHeight;
				if (dHeight)
					{ updateLineHeight(line, line.height + dHeight); }
			}
			signalLater(cm, "markerChanged", cm, this$1$1);
		});
	};

	TextMarker.prototype.attachLine = function (line) {
		if (!this.lines.length && this.doc.cm) {
			var op = this.doc.cm.curOp;
			if (!op.maybeHiddenMarkers || indexOf(op.maybeHiddenMarkers, this) == -1)
				{ (op.maybeUnhiddenMarkers || (op.maybeUnhiddenMarkers = [])).push(this); }
		}
		this.lines.push(line);
	};

	TextMarker.prototype.detachLine = function (line) {
		this.lines.splice(indexOf(this.lines, line), 1);
		if (!this.lines.length && this.doc.cm) {
			var op = this.doc.cm.curOp
			;(op.maybeHiddenMarkers || (op.maybeHiddenMarkers = [])).push(this);
		}
	};
	eventMixin(TextMarker);

	// Create a marker, wire it up to the right lines, and
	function markText(doc, from, to, options, type) {
		// Shared markers (across linked documents) are handled separately
		// (markTextShared will call out to this again, once per
		// document).
		if (options && options.shared) { return markTextShared(doc, from, to, options, type) }
		// Ensure we are in an operation.
		if (doc.cm && !doc.cm.curOp) { return operation(doc.cm, markText)(doc, from, to, options, type) }

		var marker = new TextMarker(doc, type), diff = cmp(from, to);
		if (options) { copyObj(options, marker, false); }
		// Don't connect empty markers unless clearWhenEmpty is false
		if (diff > 0 || diff == 0 && marker.clearWhenEmpty !== false)
			{ return marker }
		if (marker.replacedWith) {
			// Showing up as a widget implies collapsed (widget replaces text)
			marker.collapsed = true;
			marker.widgetNode = eltP("span", [marker.replacedWith], "CodeMirror-widget");
			if (!options.handleMouseEvents) { marker.widgetNode.setAttribute("cm-ignore-events", "true"); }
			if (options.insertLeft) { marker.widgetNode.insertLeft = true; }
		}
		if (marker.collapsed) {
			if (conflictingCollapsedRange(doc, from.line, from, to, marker) ||
					from.line != to.line && conflictingCollapsedRange(doc, to.line, from, to, marker))
				{ throw new Error("Inserting collapsed marker partially overlapping an existing one") }
			seeCollapsedSpans();
		}

		if (marker.addToHistory)
			{ addChangeToHistory(doc, {from: from, to: to, origin: "markText"}, doc.sel, NaN); }

		var curLine = from.line, cm = doc.cm, updateMaxLine;
		doc.iter(curLine, to.line + 1, function (line) {
			if (cm && marker.collapsed && !cm.options.lineWrapping && visualLine(line) == cm.display.maxLine)
				{ updateMaxLine = true; }
			if (marker.collapsed && curLine != from.line) { updateLineHeight(line, 0); }
			addMarkedSpan(line, new MarkedSpan(marker,
																				 curLine == from.line ? from.ch : null,
																				 curLine == to.line ? to.ch : null), doc.cm && doc.cm.curOp);
			++curLine;
		});
		// lineIsHidden depends on the presence of the spans, so needs a second pass
		if (marker.collapsed) { doc.iter(from.line, to.line + 1, function (line) {
			if (lineIsHidden(doc, line)) { updateLineHeight(line, 0); }
		}); }

		if (marker.clearOnEnter) { on(marker, "beforeCursorEnter", function () { return marker.clear(); }); }

		if (marker.readOnly) {
			seeReadOnlySpans();
			if (doc.history.done.length || doc.history.undone.length)
				{ doc.clearHistory(); }
		}
		if (marker.collapsed) {
			marker.id = ++nextMarkerId;
			marker.atomic = true;
		}
		if (cm) {
			// Sync editor state
			if (updateMaxLine) { cm.curOp.updateMaxLine = true; }
			if (marker.collapsed)
				{ regChange(cm, from.line, to.line + 1); }
			else if (marker.className || marker.startStyle || marker.endStyle || marker.css ||
							 marker.attributes || marker.title)
				{ for (var i = from.line; i <= to.line; i++) { regLineChange(cm, i, "text"); } }
			if (marker.atomic) { reCheckSelection(cm.doc); }
			signalLater(cm, "markerAdded", cm, marker);
		}
		return marker
	}

	// SHARED TEXTMARKERS

	// A shared marker spans multiple linked documents. It is
	// implemented as a meta-marker-object controlling multiple normal
	// markers.
	var SharedTextMarker = function(markers, primary) {
		this.markers = markers;
		this.primary = primary;
		for (var i = 0; i < markers.length; ++i)
			{ markers[i].parent = this; }
	};

	SharedTextMarker.prototype.clear = function () {
		if (this.explicitlyCleared) { return }
		this.explicitlyCleared = true;
		for (var i = 0; i < this.markers.length; ++i)
			{ this.markers[i].clear(); }
		signalLater(this, "clear");
	};

	SharedTextMarker.prototype.find = function (side, lineObj) {
		return this.primary.find(side, lineObj)
	};
	eventMixin(SharedTextMarker);

	function markTextShared(doc, from, to, options, type) {
		options = copyObj(options);
		options.shared = false;
		var markers = [markText(doc, from, to, options, type)], primary = markers[0];
		var widget = options.widgetNode;
		linkedDocs(doc, function (doc) {
			if (widget) { options.widgetNode = widget.cloneNode(true); }
			markers.push(markText(doc, clipPos(doc, from), clipPos(doc, to), options, type));
			for (var i = 0; i < doc.linked.length; ++i)
				{ if (doc.linked[i].isParent) { return } }
			primary = lst(markers);
		});
		return new SharedTextMarker(markers, primary)
	}

	function findSharedMarkers(doc) {
		return doc.findMarks(Pos(doc.first, 0), doc.clipPos(Pos(doc.lastLine())), function (m) { return m.parent; })
	}

	function copySharedMarkers(doc, markers) {
		for (var i = 0; i < markers.length; i++) {
			var marker = markers[i], pos = marker.find();
			var mFrom = doc.clipPos(pos.from), mTo = doc.clipPos(pos.to);
			if (cmp(mFrom, mTo)) {
				var subMark = markText(doc, mFrom, mTo, marker.primary, marker.primary.type);
				marker.markers.push(subMark);
				subMark.parent = marker;
			}
		}
	}

	function detachSharedMarkers(markers) {
		var loop = function ( i ) {
			var marker = markers[i], linked = [marker.primary.doc];
			linkedDocs(marker.primary.doc, function (d) { return linked.push(d); });
			for (var j = 0; j < marker.markers.length; j++) {
				var subMarker = marker.markers[j];
				if (indexOf(linked, subMarker.doc) == -1) {
					subMarker.parent = null;
					marker.markers.splice(j--, 1);
				}
			}
		};

		for (var i = 0; i < markers.length; i++) loop( i );
	}

	var nextDocId = 0;
	var Doc = function(text, mode, firstLine, lineSep, direction) {
		if (!(this instanceof Doc)) { return new Doc(text, mode, firstLine, lineSep, direction) }
		if (firstLine == null) { firstLine = 0; }

		BranchChunk.call(this, [new LeafChunk([new Line("", null)])]);
		this.first = firstLine;
		this.scrollTop = this.scrollLeft = 0;
		this.cantEdit = false;
		this.cleanGeneration = 1;
		this.modeFrontier = this.highlightFrontier = firstLine;
		var start = Pos(firstLine, 0);
		this.sel = simpleSelection(start);
		this.history = new History(null);
		this.id = ++nextDocId;
		this.modeOption = mode;
		this.lineSep = lineSep;
		this.direction = (direction == "rtl") ? "rtl" : "ltr";
		this.extend = false;

		if (typeof text == "string") { text = this.splitLines(text); }
		updateDoc(this, {from: start, to: start, text: text});
		setSelection(this, simpleSelection(start), sel_dontScroll);
	};

	Doc.prototype = createObj(BranchChunk.prototype, {
		constructor: Doc,
		// Iterate over the document. Supports two forms -- with only one
		// argument, it calls that for each line in the document. With
		// three, it iterates over the range given by the first two (with
		// the second being non-inclusive).
		iter: function(from, to, op) {
			if (op) { this.iterN(from - this.first, to - from, op); }
			else { this.iterN(this.first, this.first + this.size, from); }
		},

		// Non-public interface for adding and removing lines.
		insert: function(at, lines) {
			var height = 0;
			for (var i = 0; i < lines.length; ++i) { height += lines[i].height; }
			this.insertInner(at - this.first, lines, height);
		},
		remove: function(at, n) { this.removeInner(at - this.first, n); },

		// From here, the methods are part of the public interface. Most
		// are also available from CodeMirror (editor) instances.

		getValue: function(lineSep) {
			var lines = getLines(this, this.first, this.first + this.size);
			if (lineSep === false) { return lines }
			return lines.join(lineSep || this.lineSeparator())
		},
		setValue: docMethodOp(function(code) {
			var top = Pos(this.first, 0), last = this.first + this.size - 1;
			makeChange(this, {from: top, to: Pos(last, getLine(this, last).text.length),
												text: this.splitLines(code), origin: "setValue", full: true}, true);
			if (this.cm) { scrollToCoords(this.cm, 0, 0); }
			setSelection(this, simpleSelection(top), sel_dontScroll);
		}),
		replaceRange: function(code, from, to, origin) {
			from = clipPos(this, from);
			to = to ? clipPos(this, to) : from;
			replaceRange(this, code, from, to, origin);
		},
		getRange: function(from, to, lineSep) {
			var lines = getBetween(this, clipPos(this, from), clipPos(this, to));
			if (lineSep === false) { return lines }
			if (lineSep === '') { return lines.join('') }
			return lines.join(lineSep || this.lineSeparator())
		},

		getLine: function(line) {var l = this.getLineHandle(line); return l && l.text},

		getLineHandle: function(line) {if (isLine(this, line)) { return getLine(this, line) }},
		getLineNumber: function(line) {return lineNo(line)},

		getLineHandleVisualStart: function(line) {
			if (typeof line == "number") { line = getLine(this, line); }
			return visualLine(line)
		},

		lineCount: function() {return this.size},
		firstLine: function() {return this.first},
		lastLine: function() {return this.first + this.size - 1},

		clipPos: function(pos) {return clipPos(this, pos)},

		getCursor: function(start) {
			var range = this.sel.primary(), pos;
			if (start == null || start == "head") { pos = range.head; }
			else if (start == "anchor") { pos = range.anchor; }
			else if (start == "end" || start == "to" || start === false) { pos = range.to(); }
			else { pos = range.from(); }
			return pos
		},
		listSelections: function() { return this.sel.ranges },
		somethingSelected: function() {return this.sel.somethingSelected()},

		setCursor: docMethodOp(function(line, ch, options) {
			setSimpleSelection(this, clipPos(this, typeof line == "number" ? Pos(line, ch || 0) : line), null, options);
		}),
		setSelection: docMethodOp(function(anchor, head, options) {
			setSimpleSelection(this, clipPos(this, anchor), clipPos(this, head || anchor), options);
		}),
		extendSelection: docMethodOp(function(head, other, options) {
			extendSelection(this, clipPos(this, head), other && clipPos(this, other), options);
		}),
		extendSelections: docMethodOp(function(heads, options) {
			extendSelections(this, clipPosArray(this, heads), options);
		}),
		extendSelectionsBy: docMethodOp(function(f, options) {
			var heads = map(this.sel.ranges, f);
			extendSelections(this, clipPosArray(this, heads), options);
		}),
		setSelections: docMethodOp(function(ranges, primary, options) {
			if (!ranges.length) { return }
			var out = [];
			for (var i = 0; i < ranges.length; i++)
				{ out[i] = new Range(clipPos(this, ranges[i].anchor),
													 clipPos(this, ranges[i].head || ranges[i].anchor)); }
			if (primary == null) { primary = Math.min(ranges.length - 1, this.sel.primIndex); }
			setSelection(this, normalizeSelection(this.cm, out, primary), options);
		}),
		addSelection: docMethodOp(function(anchor, head, options) {
			var ranges = this.sel.ranges.slice(0);
			ranges.push(new Range(clipPos(this, anchor), clipPos(this, head || anchor)));
			setSelection(this, normalizeSelection(this.cm, ranges, ranges.length - 1), options);
		}),

		getSelection: function(lineSep) {
			var ranges = this.sel.ranges, lines;
			for (var i = 0; i < ranges.length; i++) {
				var sel = getBetween(this, ranges[i].from(), ranges[i].to());
				lines = lines ? lines.concat(sel) : sel;
			}
			if (lineSep === false) { return lines }
			else { return lines.join(lineSep || this.lineSeparator()) }
		},
		getSelections: function(lineSep) {
			var parts = [], ranges = this.sel.ranges;
			for (var i = 0; i < ranges.length; i++) {
				var sel = getBetween(this, ranges[i].from(), ranges[i].to());
				if (lineSep !== false) { sel = sel.join(lineSep || this.lineSeparator()); }
				parts[i] = sel;
			}
			return parts
		},
		replaceSelection: function(code, collapse, origin) {
			var dup = [];
			for (var i = 0; i < this.sel.ranges.length; i++)
				{ dup[i] = code; }
			this.replaceSelections(dup, collapse, origin || "+input");
		},
		replaceSelections: docMethodOp(function(code, collapse, origin) {
			var changes = [], sel = this.sel;
			for (var i = 0; i < sel.ranges.length; i++) {
				var range = sel.ranges[i];
				changes[i] = {from: range.from(), to: range.to(), text: this.splitLines(code[i]), origin: origin};
			}
			var newSel = collapse && collapse != "end" && computeReplacedSel(this, changes, collapse);
			for (var i$1 = changes.length - 1; i$1 >= 0; i$1--)
				{ makeChange(this, changes[i$1]); }
			if (newSel) { setSelectionReplaceHistory(this, newSel); }
			else if (this.cm) { ensureCursorVisible(this.cm); }
		}),
		undo: docMethodOp(function() {makeChangeFromHistory(this, "undo");}),
		redo: docMethodOp(function() {makeChangeFromHistory(this, "redo");}),
		undoSelection: docMethodOp(function() {makeChangeFromHistory(this, "undo", true);}),
		redoSelection: docMethodOp(function() {makeChangeFromHistory(this, "redo", true);}),

		setExtending: function(val) {this.extend = val;},
		getExtending: function() {return this.extend},

		historySize: function() {
			var hist = this.history, done = 0, undone = 0;
			for (var i = 0; i < hist.done.length; i++) { if (!hist.done[i].ranges) { ++done; } }
			for (var i$1 = 0; i$1 < hist.undone.length; i$1++) { if (!hist.undone[i$1].ranges) { ++undone; } }
			return {undo: done, redo: undone}
		},
		clearHistory: function() {
			var this$1$1 = this;

			this.history = new History(this.history);
			linkedDocs(this, function (doc) { return doc.history = this$1$1.history; }, true);
		},

		markClean: function() {
			this.cleanGeneration = this.changeGeneration(true);
		},
		changeGeneration: function(forceSplit) {
			if (forceSplit)
				{ this.history.lastOp = this.history.lastSelOp = this.history.lastOrigin = null; }
			return this.history.generation
		},
		isClean: function (gen) {
			return this.history.generation == (gen || this.cleanGeneration)
		},

		getHistory: function() {
			return {done: copyHistoryArray(this.history.done),
							undone: copyHistoryArray(this.history.undone)}
		},
		setHistory: function(histData) {
			var hist = this.history = new History(this.history);
			hist.done = copyHistoryArray(histData.done.slice(0), null, true);
			hist.undone = copyHistoryArray(histData.undone.slice(0), null, true);
		},

		setGutterMarker: docMethodOp(function(line, gutterID, value) {
			return changeLine(this, line, "gutter", function (line) {
				var markers = line.gutterMarkers || (line.gutterMarkers = {});
				markers[gutterID] = value;
				if (!value && isEmpty(markers)) { line.gutterMarkers = null; }
				return true
			})
		}),

		clearGutter: docMethodOp(function(gutterID) {
			var this$1$1 = this;

			this.iter(function (line) {
				if (line.gutterMarkers && line.gutterMarkers[gutterID]) {
					changeLine(this$1$1, line, "gutter", function () {
						line.gutterMarkers[gutterID] = null;
						if (isEmpty(line.gutterMarkers)) { line.gutterMarkers = null; }
						return true
					});
				}
			});
		}),

		lineInfo: function(line) {
			var n;
			if (typeof line == "number") {
				if (!isLine(this, line)) { return null }
				n = line;
				line = getLine(this, line);
				if (!line) { return null }
			} else {
				n = lineNo(line);
				if (n == null) { return null }
			}
			return {line: n, handle: line, text: line.text, gutterMarkers: line.gutterMarkers,
							textClass: line.textClass, bgClass: line.bgClass, wrapClass: line.wrapClass,
							widgets: line.widgets}
		},

		addLineClass: docMethodOp(function(handle, where, cls) {
			return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
				var prop = where == "text" ? "textClass"
								 : where == "background" ? "bgClass"
								 : where == "gutter" ? "gutterClass" : "wrapClass";
				if (!line[prop]) { line[prop] = cls; }
				else if (classTest(cls).test(line[prop])) { return false }
				else { line[prop] += " " + cls; }
				return true
			})
		}),
		removeLineClass: docMethodOp(function(handle, where, cls) {
			return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
				var prop = where == "text" ? "textClass"
								 : where == "background" ? "bgClass"
								 : where == "gutter" ? "gutterClass" : "wrapClass";
				var cur = line[prop];
				if (!cur) { return false }
				else if (cls == null) { line[prop] = null; }
				else {
					var found = cur.match(classTest(cls));
					if (!found) { return false }
					var end = found.index + found[0].length;
					line[prop] = cur.slice(0, found.index) + (!found.index || end == cur.length ? "" : " ") + cur.slice(end) || null;
				}
				return true
			})
		}),

		addLineWidget: docMethodOp(function(handle, node, options) {
			return addLineWidget(this, handle, node, options)
		}),
		removeLineWidget: function(widget) { widget.clear(); },

		markText: function(from, to, options) {
			return markText(this, clipPos(this, from), clipPos(this, to), options, options && options.type || "range")
		},
		setBookmark: function(pos, options) {
			var realOpts = {replacedWith: options && (options.nodeType == null ? options.widget : options),
											insertLeft: options && options.insertLeft,
											clearWhenEmpty: false, shared: options && options.shared,
											handleMouseEvents: options && options.handleMouseEvents};
			pos = clipPos(this, pos);
			return markText(this, pos, pos, realOpts, "bookmark")
		},
		findMarksAt: function(pos) {
			pos = clipPos(this, pos);
			var markers = [], spans = getLine(this, pos.line).markedSpans;
			if (spans) { for (var i = 0; i < spans.length; ++i) {
				var span = spans[i];
				if ((span.from == null || span.from <= pos.ch) &&
						(span.to == null || span.to >= pos.ch))
					{ markers.push(span.marker.parent || span.marker); }
			} }
			return markers
		},
		findMarks: function(from, to, filter) {
			from = clipPos(this, from); to = clipPos(this, to);
			var found = [], lineNo = from.line;
			this.iter(from.line, to.line + 1, function (line) {
				var spans = line.markedSpans;
				if (spans) { for (var i = 0; i < spans.length; i++) {
					var span = spans[i];
					if (!(span.to != null && lineNo == from.line && from.ch >= span.to ||
								span.from == null && lineNo != from.line ||
								span.from != null && lineNo == to.line && span.from >= to.ch) &&
							(!filter || filter(span.marker)))
						{ found.push(span.marker.parent || span.marker); }
				} }
				++lineNo;
			});
			return found
		},
		getAllMarks: function() {
			var markers = [];
			this.iter(function (line) {
				var sps = line.markedSpans;
				if (sps) { for (var i = 0; i < sps.length; ++i)
					{ if (sps[i].from != null) { markers.push(sps[i].marker); } } }
			});
			return markers
		},

		posFromIndex: function(off) {
			var ch, lineNo = this.first, sepSize = this.lineSeparator().length;
			this.iter(function (line) {
				var sz = line.text.length + sepSize;
				if (sz > off) { ch = off; return true }
				off -= sz;
				++lineNo;
			});
			return clipPos(this, Pos(lineNo, ch))
		},
		indexFromPos: function (coords) {
			coords = clipPos(this, coords);
			var index = coords.ch;
			if (coords.line < this.first || coords.ch < 0) { return 0 }
			var sepSize = this.lineSeparator().length;
			this.iter(this.first, coords.line, function (line) { // iter aborts when callback returns a truthy value
				index += line.text.length + sepSize;
			});
			return index
		},

		copy: function(copyHistory) {
			var doc = new Doc(getLines(this, this.first, this.first + this.size),
												this.modeOption, this.first, this.lineSep, this.direction);
			doc.scrollTop = this.scrollTop; doc.scrollLeft = this.scrollLeft;
			doc.sel = this.sel;
			doc.extend = false;
			if (copyHistory) {
				doc.history.undoDepth = this.history.undoDepth;
				doc.setHistory(this.getHistory());
			}
			return doc
		},

		linkedDoc: function(options) {
			if (!options) { options = {}; }
			var from = this.first, to = this.first + this.size;
			if (options.from != null && options.from > from) { from = options.from; }
			if (options.to != null && options.to < to) { to = options.to; }
			var copy = new Doc(getLines(this, from, to), options.mode || this.modeOption, from, this.lineSep, this.direction);
			if (options.sharedHist) { copy.history = this.history
			; }(this.linked || (this.linked = [])).push({doc: copy, sharedHist: options.sharedHist});
			copy.linked = [{doc: this, isParent: true, sharedHist: options.sharedHist}];
			copySharedMarkers(copy, findSharedMarkers(this));
			return copy
		},
		unlinkDoc: function(other) {
			if (other instanceof CodeMirror) { other = other.doc; }
			if (this.linked) { for (var i = 0; i < this.linked.length; ++i) {
				var link = this.linked[i];
				if (link.doc != other) { continue }
				this.linked.splice(i, 1);
				other.unlinkDoc(this);
				detachSharedMarkers(findSharedMarkers(this));
				break
			} }
			// If the histories were shared, split them again
			if (other.history == this.history) {
				var splitIds = [other.id];
				linkedDocs(other, function (doc) { return splitIds.push(doc.id); }, true);
				other.history = new History(null);
				other.history.done = copyHistoryArray(this.history.done, splitIds);
				other.history.undone = copyHistoryArray(this.history.undone, splitIds);
			}
		},
		iterLinkedDocs: function(f) {linkedDocs(this, f);},

		getMode: function() {return this.mode},
		getEditor: function() {return this.cm},

		splitLines: function(str) {
			if (this.lineSep) { return str.split(this.lineSep) }
			return splitLinesAuto(str)
		},
		lineSeparator: function() { return this.lineSep || "\n" },

		setDirection: docMethodOp(function (dir) {
			if (dir != "rtl") { dir = "ltr"; }
			if (dir == this.direction) { return }
			this.direction = dir;
			this.iter(function (line) { return line.order = null; });
			if (this.cm) { directionChanged(this.cm); }
		})
	});

	// Public alias.
	Doc.prototype.eachLine = Doc.prototype.iter;

	// Kludge to work around strange IE behavior where it'll sometimes
	// re-fire a series of drag-related events right after the drop (#1551)
	var lastDrop = 0;

	function onDrop(e) {
		var cm = this;
		clearDragCursor(cm);
		if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e))
			{ return }
		e_preventDefault(e);
		if (ie) { lastDrop = +new Date; }
		var pos = posFromMouse(cm, e, true), files = e.dataTransfer.files;
		if (!pos || cm.isReadOnly()) { return }
		// Might be a file drop, in which case we simply extract the text
		// and insert it.
		if (files && files.length && window.FileReader && window.File) {
			var n = files.length, text = Array(n), read = 0;
			var markAsReadAndPasteIfAllFilesAreRead = function () {
				if (++read == n) {
					operation(cm, function () {
						pos = clipPos(cm.doc, pos);
						var change = {from: pos, to: pos,
													text: cm.doc.splitLines(
															text.filter(function (t) { return t != null; }).join(cm.doc.lineSeparator())),
													origin: "paste"};
						makeChange(cm.doc, change);
						setSelectionReplaceHistory(cm.doc, simpleSelection(clipPos(cm.doc, pos), clipPos(cm.doc, changeEnd(change))));
					})();
				}
			};
			var readTextFromFile = function (file, i) {
				if (cm.options.allowDropFileTypes &&
						indexOf(cm.options.allowDropFileTypes, file.type) == -1) {
					markAsReadAndPasteIfAllFilesAreRead();
					return
				}
				var reader = new FileReader;
				reader.onerror = function () { return markAsReadAndPasteIfAllFilesAreRead(); };
				reader.onload = function () {
					var content = reader.result;
					if (/[\x00-\x08\x0e-\x1f]{2}/.test(content)) {
						markAsReadAndPasteIfAllFilesAreRead();
						return
					}
					text[i] = content;
					markAsReadAndPasteIfAllFilesAreRead();
				};
				reader.readAsText(file);
			};
			for (var i = 0; i < files.length; i++) { readTextFromFile(files[i], i); }
		} else { // Normal drop
			// Don't do a replace if the drop happened inside of the selected text.
			if (cm.state.draggingText && cm.doc.sel.contains(pos) > -1) {
				cm.state.draggingText(e);
				// Ensure the editor is re-focused
				setTimeout(function () { return cm.display.input.focus(); }, 20);
				return
			}
			try {
				var text$1 = e.dataTransfer.getData("Text");
				if (text$1) {
					var selected;
					if (cm.state.draggingText && !cm.state.draggingText.copy)
						{ selected = cm.listSelections(); }
					setSelectionNoUndo(cm.doc, simpleSelection(pos, pos));
					if (selected) { for (var i$1 = 0; i$1 < selected.length; ++i$1)
						{ replaceRange(cm.doc, "", selected[i$1].anchor, selected[i$1].head, "drag"); } }
					cm.replaceSelection(text$1, "around", "paste");
					cm.display.input.focus();
				}
			}
			catch(e$1){}
		}
	}

	function onDragStart(cm, e) {
		if (ie && (!cm.state.draggingText || +new Date - lastDrop < 100)) { e_stop(e); return }
		if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e)) { return }

		e.dataTransfer.setData("Text", cm.getSelection());
		e.dataTransfer.effectAllowed = "copyMove";

		// Use dummy image instead of default browsers image.
		// Recent Safari (~6.0.2) have a tendency to segfault when this happens, so we don't do it there.
		if (e.dataTransfer.setDragImage && !safari) {
			var img = elt("img", null, null, "position: fixed; left: 0; top: 0;");
			img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
			if (presto) {
				img.width = img.height = 1;
				cm.display.wrapper.appendChild(img);
				// Force a relayout, or Opera won't use our image for some obscure reason
				img._top = img.offsetTop;
			}
			e.dataTransfer.setDragImage(img, 0, 0);
			if (presto) { img.parentNode.removeChild(img); }
		}
	}

	function onDragOver(cm, e) {
		var pos = posFromMouse(cm, e);
		if (!pos) { return }
		var frag = document.createDocumentFragment();
		drawSelectionCursor(cm, pos, frag);
		if (!cm.display.dragCursor) {
			cm.display.dragCursor = elt("div", null, "CodeMirror-cursors CodeMirror-dragcursors");
			cm.display.lineSpace.insertBefore(cm.display.dragCursor, cm.display.cursorDiv);
		}
		removeChildrenAndAdd(cm.display.dragCursor, frag);
	}

	function clearDragCursor(cm) {
		if (cm.display.dragCursor) {
			cm.display.lineSpace.removeChild(cm.display.dragCursor);
			cm.display.dragCursor = null;
		}
	}

	// These must be handled carefully, because naively registering a
	// handler for each editor will cause the editors to never be
	// garbage collected.

	function forEachCodeMirror(f) {
		if (!document.getElementsByClassName) { return }
		var byClass = document.getElementsByClassName("CodeMirror"), editors = [];
		for (var i = 0; i < byClass.length; i++) {
			var cm = byClass[i].CodeMirror;
			if (cm) { editors.push(cm); }
		}
		if (editors.length) { editors[0].operation(function () {
			for (var i = 0; i < editors.length; i++) { f(editors[i]); }
		}); }
	}

	var globalsRegistered = false;
	function ensureGlobalHandlers() {
		if (globalsRegistered) { return }
		registerGlobalHandlers();
		globalsRegistered = true;
	}
	function registerGlobalHandlers() {
		// When the window resizes, we need to refresh active editors.
		var resizeTimer;
		on(window, "resize", function () {
			if (resizeTimer == null) { resizeTimer = setTimeout(function () {
				resizeTimer = null;
				forEachCodeMirror(onResize);
			}, 100); }
		});
		// When the window loses focus, we want to show the editor as blurred
		on(window, "blur", function () { return forEachCodeMirror(onBlur); });
	}
	// Called when the window resizes
	function onResize(cm) {
		var d = cm.display;
		// Might be a text scaling operation, clear size caches.
		d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;
		d.scrollbarsClipped = false;
		cm.setSize();
	}

	var keyNames = {
		3: "Pause", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
		19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
		36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
		46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
		106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 145: "ScrollLock",
		173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
		221: "]", 222: "'", 224: "Mod", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
		63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
	};

	// Number keys
	for (var i = 0; i < 10; i++) { keyNames[i + 48] = keyNames[i + 96] = String(i); }
	// Alphabetic keys
	for (var i$1 = 65; i$1 <= 90; i$1++) { keyNames[i$1] = String.fromCharCode(i$1); }
	// Function keys
	for (var i$2 = 1; i$2 <= 12; i$2++) { keyNames[i$2 + 111] = keyNames[i$2 + 63235] = "F" + i$2; }

	var keyMap = {};

	keyMap.basic = {
		"Left": "goCharLeft", "Right": "goCharRight", "Up": "goLineUp", "Down": "goLineDown",
		"End": "goLineEnd", "Home": "goLineStartSmart", "PageUp": "goPageUp", "PageDown": "goPageDown",
		"Delete": "delCharAfter", "Backspace": "delCharBefore", "Shift-Backspace": "delCharBefore",
		"Tab": "defaultTab", "Shift-Tab": "indentAuto",
		"Enter": "newlineAndIndent", "Insert": "toggleOverwrite",
		"Esc": "singleSelection"
	};
	// Note that the save and find-related commands aren't defined by
	// default. User code or addons can define them. Unknown commands
	// are simply ignored.
	keyMap.pcDefault = {
		"Ctrl-A": "selectAll", "Ctrl-D": "deleteLine", "Ctrl-Z": "undo", "Shift-Ctrl-Z": "redo", "Ctrl-Y": "redo",
		"Ctrl-Home": "goDocStart", "Ctrl-End": "goDocEnd", "Ctrl-Up": "goLineUp", "Ctrl-Down": "goLineDown",
		"Ctrl-Left": "goGroupLeft", "Ctrl-Right": "goGroupRight", "Alt-Left": "goLineStart", "Alt-Right": "goLineEnd",
		"Ctrl-Backspace": "delGroupBefore", "Ctrl-Delete": "delGroupAfter", "Ctrl-S": "save", "Ctrl-F": "find",
		"Ctrl-G": "findNext", "Shift-Ctrl-G": "findPrev", "Shift-Ctrl-F": "replace", "Shift-Ctrl-R": "replaceAll",
		"Ctrl-[": "indentLess", "Ctrl-]": "indentMore",
		"Ctrl-U": "undoSelection", "Shift-Ctrl-U": "redoSelection", "Alt-U": "redoSelection",
		"fallthrough": "basic"
	};
	// Very basic readline/emacs-style bindings, which are standard on Mac.
	keyMap.emacsy = {
		"Ctrl-F": "goCharRight", "Ctrl-B": "goCharLeft", "Ctrl-P": "goLineUp", "Ctrl-N": "goLineDown",
		"Ctrl-A": "goLineStart", "Ctrl-E": "goLineEnd", "Ctrl-V": "goPageDown", "Shift-Ctrl-V": "goPageUp",
		"Ctrl-D": "delCharAfter", "Ctrl-H": "delCharBefore", "Alt-Backspace": "delWordBefore", "Ctrl-K": "killLine",
		"Ctrl-T": "transposeChars", "Ctrl-O": "openLine"
	};
	keyMap.macDefault = {
		"Cmd-A": "selectAll", "Cmd-D": "deleteLine", "Cmd-Z": "undo", "Shift-Cmd-Z": "redo", "Cmd-Y": "redo",
		"Cmd-Home": "goDocStart", "Cmd-Up": "goDocStart", "Cmd-End": "goDocEnd", "Cmd-Down": "goDocEnd", "Alt-Left": "goGroupLeft",
		"Alt-Right": "goGroupRight", "Cmd-Left": "goLineLeft", "Cmd-Right": "goLineRight", "Alt-Backspace": "delGroupBefore",
		"Ctrl-Alt-Backspace": "delGroupAfter", "Alt-Delete": "delGroupAfter", "Cmd-S": "save", "Cmd-F": "find",
		"Cmd-G": "findNext", "Shift-Cmd-G": "findPrev", "Cmd-Alt-F": "replace", "Shift-Cmd-Alt-F": "replaceAll",
		"Cmd-[": "indentLess", "Cmd-]": "indentMore", "Cmd-Backspace": "delWrappedLineLeft", "Cmd-Delete": "delWrappedLineRight",
		"Cmd-U": "undoSelection", "Shift-Cmd-U": "redoSelection", "Ctrl-Up": "goDocStart", "Ctrl-Down": "goDocEnd",
		"fallthrough": ["basic", "emacsy"]
	};
	keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault;

	// KEYMAP DISPATCH

	function normalizeKeyName(name) {
		var parts = name.split(/-(?!$)/);
		name = parts[parts.length - 1];
		var alt, ctrl, shift, cmd;
		for (var i = 0; i < parts.length - 1; i++) {
			var mod = parts[i];
			if (/^(cmd|meta|m)$/i.test(mod)) { cmd = true; }
			else if (/^a(lt)?$/i.test(mod)) { alt = true; }
			else if (/^(c|ctrl|control)$/i.test(mod)) { ctrl = true; }
			else if (/^s(hift)?$/i.test(mod)) { shift = true; }
			else { throw new Error("Unrecognized modifier name: " + mod) }
		}
		if (alt) { name = "Alt-" + name; }
		if (ctrl) { name = "Ctrl-" + name; }
		if (cmd) { name = "Cmd-" + name; }
		if (shift) { name = "Shift-" + name; }
		return name
	}

	// This is a kludge to keep keymaps mostly working as raw objects
	// (backwards compatibility) while at the same time support features
	// like normalization and multi-stroke key bindings. It compiles a
	// new normalized keymap, and then updates the old object to reflect
	// this.
	function normalizeKeyMap(keymap) {
		var copy = {};
		for (var keyname in keymap) { if (keymap.hasOwnProperty(keyname)) {
			var value = keymap[keyname];
			if (/^(name|fallthrough|(de|at)tach)$/.test(keyname)) { continue }
			if (value == "...") { delete keymap[keyname]; continue }

			var keys = map(keyname.split(" "), normalizeKeyName);
			for (var i = 0; i < keys.length; i++) {
				var val = (void 0), name = (void 0);
				if (i == keys.length - 1) {
					name = keys.join(" ");
					val = value;
				} else {
					name = keys.slice(0, i + 1).join(" ");
					val = "...";
				}
				var prev = copy[name];
				if (!prev) { copy[name] = val; }
				else if (prev != val) { throw new Error("Inconsistent bindings for " + name) }
			}
			delete keymap[keyname];
		} }
		for (var prop in copy) { keymap[prop] = copy[prop]; }
		return keymap
	}

	function lookupKey(key, map, handle, context) {
		map = getKeyMap(map);
		var found = map.call ? map.call(key, context) : map[key];
		if (found === false) { return "nothing" }
		if (found === "...") { return "multi" }
		if (found != null && handle(found)) { return "handled" }

		if (map.fallthrough) {
			if (Object.prototype.toString.call(map.fallthrough) != "[object Array]")
				{ return lookupKey(key, map.fallthrough, handle, context) }
			for (var i = 0; i < map.fallthrough.length; i++) {
				var result = lookupKey(key, map.fallthrough[i], handle, context);
				if (result) { return result }
			}
		}
	}

	// Modifier key presses don't count as 'real' key presses for the
	// purpose of keymap fallthrough.
	function isModifierKey(value) {
		var name = typeof value == "string" ? value : keyNames[value.keyCode];
		return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
	}

	function addModifierNames(name, event, noShift) {
		var base = name;
		if (event.altKey && base != "Alt") { name = "Alt-" + name; }
		if ((flipCtrlCmd ? event.metaKey : event.ctrlKey) && base != "Ctrl") { name = "Ctrl-" + name; }
		if ((flipCtrlCmd ? event.ctrlKey : event.metaKey) && base != "Mod") { name = "Cmd-" + name; }
		if (!noShift && event.shiftKey && base != "Shift") { name = "Shift-" + name; }
		return name
	}

	// Look up the name of a key as indicated by an event object.
	function keyName(event, noShift) {
		if (presto && event.keyCode == 34 && event["char"]) { return false }
		var name = keyNames[event.keyCode];
		if (name == null || event.altGraphKey) { return false }
		// Ctrl-ScrollLock has keyCode 3, same as Ctrl-Pause,
		// so we'll use event.code when available (Chrome 48+, FF 38+, Safari 10.1+)
		if (event.keyCode == 3 && event.code) { name = event.code; }
		return addModifierNames(name, event, noShift)
	}

	function getKeyMap(val) {
		return typeof val == "string" ? keyMap[val] : val
	}

	// Helper for deleting text near the selection(s), used to implement
	// backspace, delete, and similar functionality.
	function deleteNearSelection(cm, compute) {
		var ranges = cm.doc.sel.ranges, kill = [];
		// Build up a set of ranges to kill first, merging overlapping
		// ranges.
		for (var i = 0; i < ranges.length; i++) {
			var toKill = compute(ranges[i]);
			while (kill.length && cmp(toKill.from, lst(kill).to) <= 0) {
				var replaced = kill.pop();
				if (cmp(replaced.from, toKill.from) < 0) {
					toKill.from = replaced.from;
					break
				}
			}
			kill.push(toKill);
		}
		// Next, remove those actual ranges.
		runInOp(cm, function () {
			for (var i = kill.length - 1; i >= 0; i--)
				{ replaceRange(cm.doc, "", kill[i].from, kill[i].to, "+delete"); }
			ensureCursorVisible(cm);
		});
	}

	function moveCharLogically(line, ch, dir) {
		var target = skipExtendingChars(line.text, ch + dir, dir);
		return target < 0 || target > line.text.length ? null : target
	}

	function moveLogically(line, start, dir) {
		var ch = moveCharLogically(line, start.ch, dir);
		return ch == null ? null : new Pos(start.line, ch, dir < 0 ? "after" : "before")
	}

	function endOfLine(visually, cm, lineObj, lineNo, dir) {
		if (visually) {
			if (cm.doc.direction == "rtl") { dir = -dir; }
			var order = getOrder(lineObj, cm.doc.direction);
			if (order) {
				var part = dir < 0 ? lst(order) : order[0];
				var moveInStorageOrder = (dir < 0) == (part.level == 1);
				var sticky = moveInStorageOrder ? "after" : "before";
				var ch;
				// With a wrapped rtl chunk (possibly spanning multiple bidi parts),
				// it could be that the last bidi part is not on the last visual line,
				// since visual lines contain content order-consecutive chunks.
				// Thus, in rtl, we are looking for the first (content-order) character
				// in the rtl chunk that is on the last line (that is, the same line
				// as the last (content-order) character).
				if (part.level > 0 || cm.doc.direction == "rtl") {
					var prep = prepareMeasureForLine(cm, lineObj);
					ch = dir < 0 ? lineObj.text.length - 1 : 0;
					var targetTop = measureCharPrepared(cm, prep, ch).top;
					ch = findFirst(function (ch) { return measureCharPrepared(cm, prep, ch).top == targetTop; }, (dir < 0) == (part.level == 1) ? part.from : part.to - 1, ch);
					if (sticky == "before") { ch = moveCharLogically(lineObj, ch, 1); }
				} else { ch = dir < 0 ? part.to : part.from; }
				return new Pos(lineNo, ch, sticky)
			}
		}
		return new Pos(lineNo, dir < 0 ? lineObj.text.length : 0, dir < 0 ? "before" : "after")
	}

	function moveVisually(cm, line, start, dir) {
		var bidi = getOrder(line, cm.doc.direction);
		if (!bidi) { return moveLogically(line, start, dir) }
		if (start.ch >= line.text.length) {
			start.ch = line.text.length;
			start.sticky = "before";
		} else if (start.ch <= 0) {
			start.ch = 0;
			start.sticky = "after";
		}
		var partPos = getBidiPartAt(bidi, start.ch, start.sticky), part = bidi[partPos];
		if (cm.doc.direction == "ltr" && part.level % 2 == 0 && (dir > 0 ? part.to > start.ch : part.from < start.ch)) {
			// Case 1: We move within an ltr part in an ltr editor. Even with wrapped lines,
			// nothing interesting happens.
			return moveLogically(line, start, dir)
		}

		var mv = function (pos, dir) { return moveCharLogically(line, pos instanceof Pos ? pos.ch : pos, dir); };
		var prep;
		var getWrappedLineExtent = function (ch) {
			if (!cm.options.lineWrapping) { return {begin: 0, end: line.text.length} }
			prep = prep || prepareMeasureForLine(cm, line);
			return wrappedLineExtentChar(cm, line, prep, ch)
		};
		var wrappedLineExtent = getWrappedLineExtent(start.sticky == "before" ? mv(start, -1) : start.ch);

		if (cm.doc.direction == "rtl" || part.level == 1) {
			var moveInStorageOrder = (part.level == 1) == (dir < 0);
			var ch = mv(start, moveInStorageOrder ? 1 : -1);
			if (ch != null && (!moveInStorageOrder ? ch >= part.from && ch >= wrappedLineExtent.begin : ch <= part.to && ch <= wrappedLineExtent.end)) {
				// Case 2: We move within an rtl part or in an rtl editor on the same visual line
				var sticky = moveInStorageOrder ? "before" : "after";
				return new Pos(start.line, ch, sticky)
			}
		}

		// Case 3: Could not move within this bidi part in this visual line, so leave
		// the current bidi part

		var searchInVisualLine = function (partPos, dir, wrappedLineExtent) {
			var getRes = function (ch, moveInStorageOrder) { return moveInStorageOrder
				? new Pos(start.line, mv(ch, 1), "before")
				: new Pos(start.line, ch, "after"); };

			for (; partPos >= 0 && partPos < bidi.length; partPos += dir) {
				var part = bidi[partPos];
				var moveInStorageOrder = (dir > 0) == (part.level != 1);
				var ch = moveInStorageOrder ? wrappedLineExtent.begin : mv(wrappedLineExtent.end, -1);
				if (part.from <= ch && ch < part.to) { return getRes(ch, moveInStorageOrder) }
				ch = moveInStorageOrder ? part.from : mv(part.to, -1);
				if (wrappedLineExtent.begin <= ch && ch < wrappedLineExtent.end) { return getRes(ch, moveInStorageOrder) }
			}
		};

		// Case 3a: Look for other bidi parts on the same visual line
		var res = searchInVisualLine(partPos + dir, dir, wrappedLineExtent);
		if (res) { return res }

		// Case 3b: Look for other bidi parts on the next visual line
		var nextCh = dir > 0 ? wrappedLineExtent.end : mv(wrappedLineExtent.begin, -1);
		if (nextCh != null && !(dir > 0 && nextCh == line.text.length)) {
			res = searchInVisualLine(dir > 0 ? 0 : bidi.length - 1, dir, getWrappedLineExtent(nextCh));
			if (res) { return res }
		}

		// Case 4: Nowhere to move
		return null
	}

	// Commands are parameter-less actions that can be performed on an
	// editor, mostly used for keybindings.
	var commands = {
		selectAll: selectAll,
		singleSelection: function (cm) { return cm.setSelection(cm.getCursor("anchor"), cm.getCursor("head"), sel_dontScroll); },
		killLine: function (cm) { return deleteNearSelection(cm, function (range) {
			if (range.empty()) {
				var len = getLine(cm.doc, range.head.line).text.length;
				if (range.head.ch == len && range.head.line < cm.lastLine())
					{ return {from: range.head, to: Pos(range.head.line + 1, 0)} }
				else
					{ return {from: range.head, to: Pos(range.head.line, len)} }
			} else {
				return {from: range.from(), to: range.to()}
			}
		}); },
		deleteLine: function (cm) { return deleteNearSelection(cm, function (range) { return ({
			from: Pos(range.from().line, 0),
			to: clipPos(cm.doc, Pos(range.to().line + 1, 0))
		}); }); },
		delLineLeft: function (cm) { return deleteNearSelection(cm, function (range) { return ({
			from: Pos(range.from().line, 0), to: range.from()
		}); }); },
		delWrappedLineLeft: function (cm) { return deleteNearSelection(cm, function (range) {
			var top = cm.charCoords(range.head, "div").top + 5;
			var leftPos = cm.coordsChar({left: 0, top: top}, "div");
			return {from: leftPos, to: range.from()}
		}); },
		delWrappedLineRight: function (cm) { return deleteNearSelection(cm, function (range) {
			var top = cm.charCoords(range.head, "div").top + 5;
			var rightPos = cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div");
			return {from: range.from(), to: rightPos }
		}); },
		undo: function (cm) { return cm.undo(); },
		redo: function (cm) { return cm.redo(); },
		undoSelection: function (cm) { return cm.undoSelection(); },
		redoSelection: function (cm) { return cm.redoSelection(); },
		goDocStart: function (cm) { return cm.extendSelection(Pos(cm.firstLine(), 0)); },
		goDocEnd: function (cm) { return cm.extendSelection(Pos(cm.lastLine())); },
		goLineStart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStart(cm, range.head.line); },
			{origin: "+move", bias: 1}
		); },
		goLineStartSmart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStartSmart(cm, range.head); },
			{origin: "+move", bias: 1}
		); },
		goLineEnd: function (cm) { return cm.extendSelectionsBy(function (range) { return lineEnd(cm, range.head.line); },
			{origin: "+move", bias: -1}
		); },
		goLineRight: function (cm) { return cm.extendSelectionsBy(function (range) {
			var top = cm.cursorCoords(range.head, "div").top + 5;
			return cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div")
		}, sel_move); },
		goLineLeft: function (cm) { return cm.extendSelectionsBy(function (range) {
			var top = cm.cursorCoords(range.head, "div").top + 5;
			return cm.coordsChar({left: 0, top: top}, "div")
		}, sel_move); },
		goLineLeftSmart: function (cm) { return cm.extendSelectionsBy(function (range) {
			var top = cm.cursorCoords(range.head, "div").top + 5;
			var pos = cm.coordsChar({left: 0, top: top}, "div");
			if (pos.ch < cm.getLine(pos.line).search(/\S/)) { return lineStartSmart(cm, range.head) }
			return pos
		}, sel_move); },
		goLineUp: function (cm) { return cm.moveV(-1, "line"); },
		goLineDown: function (cm) { return cm.moveV(1, "line"); },
		goPageUp: function (cm) { return cm.moveV(-1, "page"); },
		goPageDown: function (cm) { return cm.moveV(1, "page"); },
		goCharLeft: function (cm) { return cm.moveH(-1, "char"); },
		goCharRight: function (cm) { return cm.moveH(1, "char"); },
		goColumnLeft: function (cm) { return cm.moveH(-1, "column"); },
		goColumnRight: function (cm) { return cm.moveH(1, "column"); },
		goWordLeft: function (cm) { return cm.moveH(-1, "word"); },
		goGroupRight: function (cm) { return cm.moveH(1, "group"); },
		goGroupLeft: function (cm) { return cm.moveH(-1, "group"); },
		goWordRight: function (cm) { return cm.moveH(1, "word"); },
		delCharBefore: function (cm) { return cm.deleteH(-1, "codepoint"); },
		delCharAfter: function (cm) { return cm.deleteH(1, "char"); },
		delWordBefore: function (cm) { return cm.deleteH(-1, "word"); },
		delWordAfter: function (cm) { return cm.deleteH(1, "word"); },
		delGroupBefore: function (cm) { return cm.deleteH(-1, "group"); },
		delGroupAfter: function (cm) { return cm.deleteH(1, "group"); },
		indentAuto: function (cm) { return cm.indentSelection("smart"); },
		indentMore: function (cm) { return cm.indentSelection("add"); },
		indentLess: function (cm) { return cm.indentSelection("subtract"); },
		insertTab: function (cm) { return cm.replaceSelection("\t"); },
		insertSoftTab: function (cm) {
			var spaces = [], ranges = cm.listSelections(), tabSize = cm.options.tabSize;
			for (var i = 0; i < ranges.length; i++) {
				var pos = ranges[i].from();
				var col = countColumn(cm.getLine(pos.line), pos.ch, tabSize);
				spaces.push(spaceStr(tabSize - col % tabSize));
			}
			cm.replaceSelections(spaces);
		},
		defaultTab: function (cm) {
			if (cm.somethingSelected()) { cm.indentSelection("add"); }
			else { cm.execCommand("insertTab"); }
		},
		// Swap the two chars left and right of each selection's head.
		// Move cursor behind the two swapped characters afterwards.
		//
		// Doesn't consider line feeds a character.
		// Doesn't scan more than one line above to find a character.
		// Doesn't do anything on an empty line.
		// Doesn't do anything with non-empty selections.
		transposeChars: function (cm) { return runInOp(cm, function () {
			var ranges = cm.listSelections(), newSel = [];
			for (var i = 0; i < ranges.length; i++) {
				if (!ranges[i].empty()) { continue }
				var cur = ranges[i].head, line = getLine(cm.doc, cur.line).text;
				if (line) {
					if (cur.ch == line.length) { cur = new Pos(cur.line, cur.ch - 1); }
					if (cur.ch > 0) {
						cur = new Pos(cur.line, cur.ch + 1);
						cm.replaceRange(line.charAt(cur.ch - 1) + line.charAt(cur.ch - 2),
														Pos(cur.line, cur.ch - 2), cur, "+transpose");
					} else if (cur.line > cm.doc.first) {
						var prev = getLine(cm.doc, cur.line - 1).text;
						if (prev) {
							cur = new Pos(cur.line, 1);
							cm.replaceRange(line.charAt(0) + cm.doc.lineSeparator() +
															prev.charAt(prev.length - 1),
															Pos(cur.line - 1, prev.length - 1), cur, "+transpose");
						}
					}
				}
				newSel.push(new Range(cur, cur));
			}
			cm.setSelections(newSel);
		}); },
		newlineAndIndent: function (cm) { return runInOp(cm, function () {
			var sels = cm.listSelections();
			for (var i = sels.length - 1; i >= 0; i--)
				{ cm.replaceRange(cm.doc.lineSeparator(), sels[i].anchor, sels[i].head, "+input"); }
			sels = cm.listSelections();
			for (var i$1 = 0; i$1 < sels.length; i$1++)
				{ cm.indentLine(sels[i$1].from().line, null, true); }
			ensureCursorVisible(cm);
		}); },
		openLine: function (cm) { return cm.replaceSelection("\n", "start"); },
		toggleOverwrite: function (cm) { return cm.toggleOverwrite(); }
	};


	function lineStart(cm, lineN) {
		var line = getLine(cm.doc, lineN);
		var visual = visualLine(line);
		if (visual != line) { lineN = lineNo(visual); }
		return endOfLine(true, cm, visual, lineN, 1)
	}
	function lineEnd(cm, lineN) {
		var line = getLine(cm.doc, lineN);
		var visual = visualLineEnd(line);
		if (visual != line) { lineN = lineNo(visual); }
		return endOfLine(true, cm, line, lineN, -1)
	}
	function lineStartSmart(cm, pos) {
		var start = lineStart(cm, pos.line);
		var line = getLine(cm.doc, start.line);
		var order = getOrder(line, cm.doc.direction);
		if (!order || order[0].level == 0) {
			var firstNonWS = Math.max(start.ch, line.text.search(/\S/));
			var inWS = pos.line == start.line && pos.ch <= firstNonWS && pos.ch;
			return Pos(start.line, inWS ? 0 : firstNonWS, start.sticky)
		}
		return start
	}

	// Run a handler that was bound to a key.
	function doHandleBinding(cm, bound, dropShift) {
		if (typeof bound == "string") {
			bound = commands[bound];
			if (!bound) { return false }
		}
		// Ensure previous input has been read, so that the handler sees a
		// consistent view of the document
		cm.display.input.ensurePolled();
		var prevShift = cm.display.shift, done = false;
		try {
			if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
			if (dropShift) { cm.display.shift = false; }
			done = bound(cm) != Pass;
		} finally {
			cm.display.shift = prevShift;
			cm.state.suppressEdits = false;
		}
		return done
	}

	function lookupKeyForEditor(cm, name, handle) {
		for (var i = 0; i < cm.state.keyMaps.length; i++) {
			var result = lookupKey(name, cm.state.keyMaps[i], handle, cm);
			if (result) { return result }
		}
		return (cm.options.extraKeys && lookupKey(name, cm.options.extraKeys, handle, cm))
			|| lookupKey(name, cm.options.keyMap, handle, cm)
	}

	// Note that, despite the name, this function is also used to check
	// for bound mouse clicks.

	var stopSeq = new Delayed;

	function dispatchKey(cm, name, e, handle) {
		var seq = cm.state.keySeq;
		if (seq) {
			if (isModifierKey(name)) { return "handled" }
			if (/\'$/.test(name))
				{ cm.state.keySeq = null; }
			else
				{ stopSeq.set(50, function () {
					if (cm.state.keySeq == seq) {
						cm.state.keySeq = null;
						cm.display.input.reset();
					}
				}); }
			if (dispatchKeyInner(cm, seq + " " + name, e, handle)) { return true }
		}
		return dispatchKeyInner(cm, name, e, handle)
	}

	function dispatchKeyInner(cm, name, e, handle) {
		var result = lookupKeyForEditor(cm, name, handle);

		if (result == "multi")
			{ cm.state.keySeq = name; }
		if (result == "handled")
			{ signalLater(cm, "keyHandled", cm, name, e); }

		if (result == "handled" || result == "multi") {
			e_preventDefault(e);
			restartBlink(cm);
		}

		return !!result
	}

	// Handle a key from the keydown event.
	function handleKeyBinding(cm, e) {
		var name = keyName(e, true);
		if (!name) { return false }

		if (e.shiftKey && !cm.state.keySeq) {
			// First try to resolve full name (including 'Shift-'). Failing
			// that, see if there is a cursor-motion command (starting with
			// 'go') bound to the keyname without 'Shift-'.
			return dispatchKey(cm, "Shift-" + name, e, function (b) { return doHandleBinding(cm, b, true); })
					|| dispatchKey(cm, name, e, function (b) {
							 if (typeof b == "string" ? /^go[A-Z]/.test(b) : b.motion)
								 { return doHandleBinding(cm, b) }
						 })
		} else {
			return dispatchKey(cm, name, e, function (b) { return doHandleBinding(cm, b); })
		}
	}

	// Handle a key from the keypress event
	function handleCharBinding(cm, e, ch) {
		return dispatchKey(cm, "'" + ch + "'", e, function (b) { return doHandleBinding(cm, b, true); })
	}

	var lastStoppedKey = null;
	function onKeyDown(e) {
		var cm = this;
		if (e.target && e.target != cm.display.input.getField()) { return }
		cm.curOp.focus = activeElt(root(cm));
		if (signalDOMEvent(cm, e)) { return }
		// IE does strange things with escape.
		if (ie && ie_version < 11 && e.keyCode == 27) { e.returnValue = false; }
		var code = e.keyCode;
		cm.display.shift = code == 16 || e.shiftKey;
		var handled = handleKeyBinding(cm, e);
		if (presto) {
			lastStoppedKey = handled ? code : null;
			// Opera has no cut event... we try to at least catch the key combo
			if (!handled && code == 88 && !hasCopyEvent && (mac ? e.metaKey : e.ctrlKey))
				{ cm.replaceSelection("", null, "cut"); }
		}
		if (gecko && !mac && !handled && code == 46 && e.shiftKey && !e.ctrlKey && document.execCommand)
			{ document.execCommand("cut"); }

		// Turn mouse into crosshair when Alt is held on Mac.
		if (code == 18 && !/\bCodeMirror-crosshair\b/.test(cm.display.lineDiv.className))
			{ showCrossHair(cm); }
	}

	function showCrossHair(cm) {
		var lineDiv = cm.display.lineDiv;
		addClass(lineDiv, "CodeMirror-crosshair");

		function up(e) {
			if (e.keyCode == 18 || !e.altKey) {
				rmClass(lineDiv, "CodeMirror-crosshair");
				off(document, "keyup", up);
				off(document, "mouseover", up);
			}
		}
		on(document, "keyup", up);
		on(document, "mouseover", up);
	}

	function onKeyUp(e) {
		if (e.keyCode == 16) { this.doc.sel.shift = false; }
		signalDOMEvent(this, e);
	}

	function onKeyPress(e) {
		var cm = this;
		if (e.target && e.target != cm.display.input.getField()) { return }
		if (eventInWidget(cm.display, e) || signalDOMEvent(cm, e) || e.ctrlKey && !e.altKey || mac && e.metaKey) { return }
		var keyCode = e.keyCode, charCode = e.charCode;
		if (presto && keyCode == lastStoppedKey) {lastStoppedKey = null; e_preventDefault(e); return}
		if ((presto && (!e.which || e.which < 10)) && handleKeyBinding(cm, e)) { return }
		var ch = String.fromCharCode(charCode == null ? keyCode : charCode);
		// Some browsers fire keypress events for backspace
		if (ch == "\x08") { return }
		if (handleCharBinding(cm, e, ch)) { return }
		cm.display.input.onKeyPress(e);
	}

	var DOUBLECLICK_DELAY = 400;

	var PastClick = function(time, pos, button) {
		this.time = time;
		this.pos = pos;
		this.button = button;
	};

	PastClick.prototype.compare = function (time, pos, button) {
		return this.time + DOUBLECLICK_DELAY > time &&
			cmp(pos, this.pos) == 0 && button == this.button
	};

	var lastClick, lastDoubleClick;
	function clickRepeat(pos, button) {
		var now = +new Date;
		if (lastDoubleClick && lastDoubleClick.compare(now, pos, button)) {
			lastClick = lastDoubleClick = null;
			return "triple"
		} else if (lastClick && lastClick.compare(now, pos, button)) {
			lastDoubleClick = new PastClick(now, pos, button);
			lastClick = null;
			return "double"
		} else {
			lastClick = new PastClick(now, pos, button);
			lastDoubleClick = null;
			return "single"
		}
	}

	// A mouse down can be a single click, double click, triple click,
	// start of selection drag, start of text drag, new cursor
	// (ctrl-click), rectangle drag (alt-drag), or xwin
	// middle-click-paste. Or it might be a click on something we should
	// not interfere with, such as a scrollbar or widget.
	function onMouseDown(e) {
		var cm = this, display = cm.display;
		if (signalDOMEvent(cm, e) || display.activeTouch && display.input.supportsTouch()) { return }
		display.input.ensurePolled();
		display.shift = e.shiftKey;

		if (eventInWidget(display, e)) {
			if (!webkit) {
				// Briefly turn off draggability, to allow widgets to do
				// normal dragging things.
				display.scroller.draggable = false;
				setTimeout(function () { return display.scroller.draggable = true; }, 100);
			}
			return
		}
		if (clickInGutter(cm, e)) { return }
		var pos = posFromMouse(cm, e), button = e_button(e), repeat = pos ? clickRepeat(pos, button) : "single";
		win(cm).focus();

		// #3261: make sure, that we're not starting a second selection
		if (button == 1 && cm.state.selectingText)
			{ cm.state.selectingText(e); }

		if (pos && handleMappedButton(cm, button, pos, repeat, e)) { return }

		if (button == 1) {
			if (pos) { leftButtonDown(cm, pos, repeat, e); }
			else if (e_target(e) == display.scroller) { e_preventDefault(e); }
		} else if (button == 2) {
			if (pos) { extendSelection(cm.doc, pos); }
			setTimeout(function () { return display.input.focus(); }, 20);
		} else if (button == 3) {
			if (captureRightClick) { cm.display.input.onContextMenu(e); }
			else { delayBlurEvent(cm); }
		}
	}

	function handleMappedButton(cm, button, pos, repeat, event) {
		var name = "Click";
		if (repeat == "double") { name = "Double" + name; }
		else if (repeat == "triple") { name = "Triple" + name; }
		name = (button == 1 ? "Left" : button == 2 ? "Middle" : "Right") + name;

		return dispatchKey(cm,  addModifierNames(name, event), event, function (bound) {
			if (typeof bound == "string") { bound = commands[bound]; }
			if (!bound) { return false }
			var done = false;
			try {
				if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
				done = bound(cm, pos) != Pass;
			} finally {
				cm.state.suppressEdits = false;
			}
			return done
		})
	}

	function configureMouse(cm, repeat, event) {
		var option = cm.getOption("configureMouse");
		var value = option ? option(cm, repeat, event) : {};
		if (value.unit == null) {
			var rect = chromeOS ? event.shiftKey && event.metaKey : event.altKey;
			value.unit = rect ? "rectangle" : repeat == "single" ? "char" : repeat == "double" ? "word" : "line";
		}
		if (value.extend == null || cm.doc.extend) { value.extend = cm.doc.extend || event.shiftKey; }
		if (value.addNew == null) { value.addNew = mac ? event.metaKey : event.ctrlKey; }
		if (value.moveOnDrag == null) { value.moveOnDrag = !(mac ? event.altKey : event.ctrlKey); }
		return value
	}

	function leftButtonDown(cm, pos, repeat, event) {
		if (ie) { setTimeout(bind(ensureFocus, cm), 0); }
		else { cm.curOp.focus = activeElt(root(cm)); }

		var behavior = configureMouse(cm, repeat, event);

		var sel = cm.doc.sel, contained;
		if (cm.options.dragDrop && dragAndDrop && !cm.isReadOnly() &&
				repeat == "single" && (contained = sel.contains(pos)) > -1 &&
				(cmp((contained = sel.ranges[contained]).from(), pos) < 0 || pos.xRel > 0) &&
				(cmp(contained.to(), pos) > 0 || pos.xRel < 0))
			{ leftButtonStartDrag(cm, event, pos, behavior); }
		else
			{ leftButtonSelect(cm, event, pos, behavior); }
	}

	// Start a text drag. When it ends, see if any dragging actually
	// happen, and treat as a click if it didn't.
	function leftButtonStartDrag(cm, event, pos, behavior) {
		var display = cm.display, moved = false;
		var dragEnd = operation(cm, function (e) {
			if (webkit) { display.scroller.draggable = false; }
			cm.state.draggingText = false;
			if (cm.state.delayingBlurEvent) {
				if (cm.hasFocus()) { cm.state.delayingBlurEvent = false; }
				else { delayBlurEvent(cm); }
			}
			off(display.wrapper.ownerDocument, "mouseup", dragEnd);
			off(display.wrapper.ownerDocument, "mousemove", mouseMove);
			off(display.scroller, "dragstart", dragStart);
			off(display.scroller, "drop", dragEnd);
			if (!moved) {
				e_preventDefault(e);
				if (!behavior.addNew)
					{ extendSelection(cm.doc, pos, null, null, behavior.extend); }
				// Work around unexplainable focus problem in IE9 (#2127) and Chrome (#3081)
				if ((webkit && !safari) || ie && ie_version == 9)
					{ setTimeout(function () {display.wrapper.ownerDocument.body.focus({preventScroll: true}); display.input.focus();}, 20); }
				else
					{ display.input.focus(); }
			}
		});
		var mouseMove = function(e2) {
			moved = moved || Math.abs(event.clientX - e2.clientX) + Math.abs(event.clientY - e2.clientY) >= 10;
		};
		var dragStart = function () { return moved = true; };
		// Let the drag handler handle this.
		if (webkit) { display.scroller.draggable = true; }
		cm.state.draggingText = dragEnd;
		dragEnd.copy = !behavior.moveOnDrag;
		on(display.wrapper.ownerDocument, "mouseup", dragEnd);
		on(display.wrapper.ownerDocument, "mousemove", mouseMove);
		on(display.scroller, "dragstart", dragStart);
		on(display.scroller, "drop", dragEnd);

		cm.state.delayingBlurEvent = true;
		setTimeout(function () { return display.input.focus(); }, 20);
		// IE's approach to draggable
		if (display.scroller.dragDrop) { display.scroller.dragDrop(); }
	}

	function rangeForUnit(cm, pos, unit) {
		if (unit == "char") { return new Range(pos, pos) }
		if (unit == "word") { return cm.findWordAt(pos) }
		if (unit == "line") { return new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))) }
		var result = unit(cm, pos);
		return new Range(result.from, result.to)
	}

	// Normal selection, as opposed to text dragging.
	function leftButtonSelect(cm, event, start, behavior) {
		if (ie) { delayBlurEvent(cm); }
		var display = cm.display, doc = cm.doc;
		e_preventDefault(event);

		var ourRange, ourIndex, startSel = doc.sel, ranges = startSel.ranges;
		if (behavior.addNew && !behavior.extend) {
			ourIndex = doc.sel.contains(start);
			if (ourIndex > -1)
				{ ourRange = ranges[ourIndex]; }
			else
				{ ourRange = new Range(start, start); }
		} else {
			ourRange = doc.sel.primary();
			ourIndex = doc.sel.primIndex;
		}

		if (behavior.unit == "rectangle") {
			if (!behavior.addNew) { ourRange = new Range(start, start); }
			start = posFromMouse(cm, event, true, true);
			ourIndex = -1;
		} else {
			var range = rangeForUnit(cm, start, behavior.unit);
			if (behavior.extend)
				{ ourRange = extendRange(ourRange, range.anchor, range.head, behavior.extend); }
			else
				{ ourRange = range; }
		}

		if (!behavior.addNew) {
			ourIndex = 0;
			setSelection(doc, new Selection([ourRange], 0), sel_mouse);
			startSel = doc.sel;
		} else if (ourIndex == -1) {
			ourIndex = ranges.length;
			setSelection(doc, normalizeSelection(cm, ranges.concat([ourRange]), ourIndex),
									 {scroll: false, origin: "*mouse"});
		} else if (ranges.length > 1 && ranges[ourIndex].empty() && behavior.unit == "char" && !behavior.extend) {
			setSelection(doc, normalizeSelection(cm, ranges.slice(0, ourIndex).concat(ranges.slice(ourIndex + 1)), 0),
									 {scroll: false, origin: "*mouse"});
			startSel = doc.sel;
		} else {
			replaceOneSelection(doc, ourIndex, ourRange, sel_mouse);
		}

		var lastPos = start;
		function extendTo(pos) {
			if (cmp(lastPos, pos) == 0) { return }
			lastPos = pos;

			if (behavior.unit == "rectangle") {
				var ranges = [], tabSize = cm.options.tabSize;
				var startCol = countColumn(getLine(doc, start.line).text, start.ch, tabSize);
				var posCol = countColumn(getLine(doc, pos.line).text, pos.ch, tabSize);
				var left = Math.min(startCol, posCol), right = Math.max(startCol, posCol);
				for (var line = Math.min(start.line, pos.line), end = Math.min(cm.lastLine(), Math.max(start.line, pos.line));
						 line <= end; line++) {
					var text = getLine(doc, line).text, leftPos = findColumn(text, left, tabSize);
					if (left == right)
						{ ranges.push(new Range(Pos(line, leftPos), Pos(line, leftPos))); }
					else if (text.length > leftPos)
						{ ranges.push(new Range(Pos(line, leftPos), Pos(line, findColumn(text, right, tabSize)))); }
				}
				if (!ranges.length) { ranges.push(new Range(start, start)); }
				setSelection(doc, normalizeSelection(cm, startSel.ranges.slice(0, ourIndex).concat(ranges), ourIndex),
										 {origin: "*mouse", scroll: false});
				cm.scrollIntoView(pos);
			} else {
				var oldRange = ourRange;
				var range = rangeForUnit(cm, pos, behavior.unit);
				var anchor = oldRange.anchor, head;
				if (cmp(range.anchor, anchor) > 0) {
					head = range.head;
					anchor = minPos(oldRange.from(), range.anchor);
				} else {
					head = range.anchor;
					anchor = maxPos(oldRange.to(), range.head);
				}
				var ranges$1 = startSel.ranges.slice(0);
				ranges$1[ourIndex] = bidiSimplify(cm, new Range(clipPos(doc, anchor), head));
				setSelection(doc, normalizeSelection(cm, ranges$1, ourIndex), sel_mouse);
			}
		}

		var editorSize = display.wrapper.getBoundingClientRect();
		// Used to ensure timeout re-tries don't fire when another extend
		// happened in the meantime (clearTimeout isn't reliable -- at
		// least on Chrome, the timeouts still happen even when cleared,
		// if the clear happens after their scheduled firing time).
		var counter = 0;

		function extend(e) {
			var curCount = ++counter;
			var cur = posFromMouse(cm, e, true, behavior.unit == "rectangle");
			if (!cur) { return }
			if (cmp(cur, lastPos) != 0) {
				cm.curOp.focus = activeElt(root(cm));
				extendTo(cur);
				var visible = visibleLines(display, doc);
				if (cur.line >= visible.to || cur.line < visible.from)
					{ setTimeout(operation(cm, function () {if (counter == curCount) { extend(e); }}), 150); }
			} else {
				var outside = e.clientY < editorSize.top ? -20 : e.clientY > editorSize.bottom ? 20 : 0;
				if (outside) { setTimeout(operation(cm, function () {
					if (counter != curCount) { return }
					display.scroller.scrollTop += outside;
					extend(e);
				}), 50); }
			}
		}

		function done(e) {
			cm.state.selectingText = false;
			counter = Infinity;
			// If e is null or undefined we interpret this as someone trying
			// to explicitly cancel the selection rather than the user
			// letting go of the mouse button.
			if (e) {
				e_preventDefault(e);
				display.input.focus();
			}
			off(display.wrapper.ownerDocument, "mousemove", move);
			off(display.wrapper.ownerDocument, "mouseup", up);
			doc.history.lastSelOrigin = null;
		}

		var move = operation(cm, function (e) {
			if (e.buttons === 0 || !e_button(e)) { done(e); }
			else { extend(e); }
		});
		var up = operation(cm, done);
		cm.state.selectingText = up;
		on(display.wrapper.ownerDocument, "mousemove", move);
		on(display.wrapper.ownerDocument, "mouseup", up);
	}

	// Used when mouse-selecting to adjust the anchor to the proper side
	// of a bidi jump depending on the visual position of the head.
	function bidiSimplify(cm, range) {
		var anchor = range.anchor;
		var head = range.head;
		var anchorLine = getLine(cm.doc, anchor.line);
		if (cmp(anchor, head) == 0 && anchor.sticky == head.sticky) { return range }
		var order = getOrder(anchorLine);
		if (!order) { return range }
		var index = getBidiPartAt(order, anchor.ch, anchor.sticky), part = order[index];
		if (part.from != anchor.ch && part.to != anchor.ch) { return range }
		var boundary = index + ((part.from == anchor.ch) == (part.level != 1) ? 0 : 1);
		if (boundary == 0 || boundary == order.length) { return range }

		// Compute the relative visual position of the head compared to the
		// anchor (<0 is to the left, >0 to the right)
		var leftSide;
		if (head.line != anchor.line) {
			leftSide = (head.line - anchor.line) * (cm.doc.direction == "ltr" ? 1 : -1) > 0;
		} else {
			var headIndex = getBidiPartAt(order, head.ch, head.sticky);
			var dir = headIndex - index || (head.ch - anchor.ch) * (part.level == 1 ? -1 : 1);
			if (headIndex == boundary - 1 || headIndex == boundary)
				{ leftSide = dir < 0; }
			else
				{ leftSide = dir > 0; }
		}

		var usePart = order[boundary + (leftSide ? -1 : 0)];
		var from = leftSide == (usePart.level == 1);
		var ch = from ? usePart.from : usePart.to, sticky = from ? "after" : "before";
		return anchor.ch == ch && anchor.sticky == sticky ? range : new Range(new Pos(anchor.line, ch, sticky), head)
	}


	// Determines whether an event happened in the gutter, and fires the
	// handlers for the corresponding event.
	function gutterEvent(cm, e, type, prevent) {
		var mX, mY;
		if (e.touches) {
			mX = e.touches[0].clientX;
			mY = e.touches[0].clientY;
		} else {
			try { mX = e.clientX; mY = e.clientY; }
			catch(e$1) { return false }
		}
		if (mX >= Math.floor(cm.display.gutters.getBoundingClientRect().right)) { return false }
		if (prevent) { e_preventDefault(e); }

		var display = cm.display;
		var lineBox = display.lineDiv.getBoundingClientRect();

		if (mY > lineBox.bottom || !hasHandler(cm, type)) { return e_defaultPrevented(e) }
		mY -= lineBox.top - display.viewOffset;

		for (var i = 0; i < cm.display.gutterSpecs.length; ++i) {
			var g = display.gutters.childNodes[i];
			if (g && g.getBoundingClientRect().right >= mX) {
				var line = lineAtHeight(cm.doc, mY);
				var gutter = cm.display.gutterSpecs[i];
				signal(cm, type, cm, line, gutter.className, e);
				return e_defaultPrevented(e)
			}
		}
	}

	function clickInGutter(cm, e) {
		return gutterEvent(cm, e, "gutterClick", true)
	}

	// CONTEXT MENU HANDLING

	// To make the context menu work, we need to briefly unhide the
	// textarea (making it as unobtrusive as possible) to let the
	// right-click take effect on it.
	function onContextMenu(cm, e) {
		if (eventInWidget(cm.display, e) || contextMenuInGutter(cm, e)) { return }
		if (signalDOMEvent(cm, e, "contextmenu")) { return }
		if (!captureRightClick) { cm.display.input.onContextMenu(e); }
	}

	function contextMenuInGutter(cm, e) {
		if (!hasHandler(cm, "gutterContextMenu")) { return false }
		return gutterEvent(cm, e, "gutterContextMenu", false)
	}

	function themeChanged(cm) {
		cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-s-\S+/g, "") +
			cm.options.theme.replace(/(^|\s)\s*/g, " cm-s-");
		clearCaches(cm);
	}

	var Init = {toString: function(){return "CodeMirror.Init"}};

	var defaults = {};
	var optionHandlers = {};

	function defineOptions(CodeMirror) {
		var optionHandlers = CodeMirror.optionHandlers;

		function option(name, deflt, handle, notOnInit) {
			CodeMirror.defaults[name] = deflt;
			if (handle) { optionHandlers[name] =
				notOnInit ? function (cm, val, old) {if (old != Init) { handle(cm, val, old); }} : handle; }
		}

		CodeMirror.defineOption = option;

		// Passed to option handlers when there is no old value.
		CodeMirror.Init = Init;

		// These two are, on init, called from the constructor because they
		// have to be initialized before the editor can start at all.
		option("value", "", function (cm, val) { return cm.setValue(val); }, true);
		option("mode", null, function (cm, val) {
			cm.doc.modeOption = val;
			loadMode(cm);
		}, true);

		option("indentUnit", 2, loadMode, true);
		option("indentWithTabs", false);
		option("smartIndent", true);
		option("tabSize", 4, function (cm) {
			resetModeState(cm);
			clearCaches(cm);
			regChange(cm);
		}, true);

		option("lineSeparator", null, function (cm, val) {
			cm.doc.lineSep = val;
			if (!val) { return }
			var newBreaks = [], lineNo = cm.doc.first;
			cm.doc.iter(function (line) {
				for (var pos = 0;;) {
					var found = line.text.indexOf(val, pos);
					if (found == -1) { break }
					pos = found + val.length;
					newBreaks.push(Pos(lineNo, found));
				}
				lineNo++;
			});
			for (var i = newBreaks.length - 1; i >= 0; i--)
				{ replaceRange(cm.doc, val, newBreaks[i], Pos(newBreaks[i].line, newBreaks[i].ch + val.length)); }
		});
		option("specialChars", /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200e\u200f\u2028\u2029\u202d\u202e\u2066\u2067\u2069\ufeff\ufff9-\ufffc]/g, function (cm, val, old) {
			cm.state.specialChars = new RegExp(val.source + (val.test("\t") ? "" : "|\t"), "g");
			if (old != Init) { cm.refresh(); }
		});
		option("specialCharPlaceholder", defaultSpecialCharPlaceholder, function (cm) { return cm.refresh(); }, true);
		option("electricChars", true);
		option("inputStyle", mobile ? "contenteditable" : "textarea", function () {
			throw new Error("inputStyle can not (yet) be changed in a running editor") // FIXME
		}, true);
		option("spellcheck", false, function (cm, val) { return cm.getInputField().spellcheck = val; }, true);
		option("autocorrect", false, function (cm, val) { return cm.getInputField().autocorrect = val; }, true);
		option("autocapitalize", false, function (cm, val) { return cm.getInputField().autocapitalize = val; }, true);
		option("rtlMoveVisually", !windows);
		option("wholeLineUpdateBefore", true);

		option("theme", "default", function (cm) {
			themeChanged(cm);
			updateGutters(cm);
		}, true);
		option("keyMap", "default", function (cm, val, old) {
			var next = getKeyMap(val);
			var prev = old != Init && getKeyMap(old);
			if (prev && prev.detach) { prev.detach(cm, next); }
			if (next.attach) { next.attach(cm, prev || null); }
		});
		option("extraKeys", null);
		option("configureMouse", null);

		option("lineWrapping", false, wrappingChanged, true);
		option("gutters", [], function (cm, val) {
			cm.display.gutterSpecs = getGutters(val, cm.options.lineNumbers);
			updateGutters(cm);
		}, true);
		option("fixedGutter", true, function (cm, val) {
			cm.display.gutters.style.left = val ? compensateForHScroll(cm.display) + "px" : "0";
			cm.refresh();
		}, true);
		option("coverGutterNextToScrollbar", false, function (cm) { return updateScrollbars(cm); }, true);
		option("scrollbarStyle", "native", function (cm) {
			initScrollbars(cm);
			updateScrollbars(cm);
			cm.display.scrollbars.setScrollTop(cm.doc.scrollTop);
			cm.display.scrollbars.setScrollLeft(cm.doc.scrollLeft);
		}, true);
		option("lineNumbers", false, function (cm, val) {
			cm.display.gutterSpecs = getGutters(cm.options.gutters, val);
			updateGutters(cm);
		}, true);
		option("firstLineNumber", 1, updateGutters, true);
		option("lineNumberFormatter", function (integer) { return integer; }, updateGutters, true);
		option("showCursorWhenSelecting", false, updateSelection, true);

		option("resetSelectionOnContextMenu", true);
		option("lineWiseCopyCut", true);
		option("pasteLinesPerSelection", true);
		option("selectionsMayTouch", false);

		option("readOnly", false, function (cm, val) {
			if (val == "nocursor") {
				onBlur(cm);
				cm.display.input.blur();
			}
			cm.display.input.readOnlyChanged(val);
		});

		option("screenReaderLabel", null, function (cm, val) {
			val = (val === '') ? null : val;
			cm.display.input.screenReaderLabelChanged(val);
		});

		option("disableInput", false, function (cm, val) {if (!val) { cm.display.input.reset(); }}, true);
		option("dragDrop", true, dragDropChanged);
		option("allowDropFileTypes", null);

		option("cursorBlinkRate", 530);
		option("cursorScrollMargin", 0);
		option("cursorHeight", 1, updateSelection, true);
		option("singleCursorHeightPerLine", true, updateSelection, true);
		option("workTime", 100);
		option("workDelay", 100);
		option("flattenSpans", true, resetModeState, true);
		option("addModeClass", false, resetModeState, true);
		option("pollInterval", 100);
		option("undoDepth", 200, function (cm, val) { return cm.doc.history.undoDepth = val; });
		option("historyEventDelay", 1250);
		option("viewportMargin", 10, function (cm) { return cm.refresh(); }, true);
		option("maxHighlightLength", 10000, resetModeState, true);
		option("moveInputWithCursor", true, function (cm, val) {
			if (!val) { cm.display.input.resetPosition(); }
		});

		option("tabindex", null, function (cm, val) { return cm.display.input.getField().tabIndex = val || ""; });
		option("autofocus", null);
		option("direction", "ltr", function (cm, val) { return cm.doc.setDirection(val); }, true);
		option("phrases", null);
	}

	function dragDropChanged(cm, value, old) {
		var wasOn = old && old != Init;
		if (!value != !wasOn) {
			var funcs = cm.display.dragFunctions;
			var toggle = value ? on : off;
			toggle(cm.display.scroller, "dragstart", funcs.start);
			toggle(cm.display.scroller, "dragenter", funcs.enter);
			toggle(cm.display.scroller, "dragover", funcs.over);
			toggle(cm.display.scroller, "dragleave", funcs.leave);
			toggle(cm.display.scroller, "drop", funcs.drop);
		}
	}

	function wrappingChanged(cm) {
		if (cm.options.lineWrapping) {
			addClass(cm.display.wrapper, "CodeMirror-wrap");
			cm.display.sizer.style.minWidth = "";
			cm.display.sizerWidth = null;
		} else {
			rmClass(cm.display.wrapper, "CodeMirror-wrap");
			findMaxLine(cm);
		}
		estimateLineHeights(cm);
		regChange(cm);
		clearCaches(cm);
		setTimeout(function () { return updateScrollbars(cm); }, 100);
	}

	// A CodeMirror instance represents an editor. This is the object
	// that user code is usually dealing with.

	function CodeMirror(place, options) {
		var this$1$1 = this;

		if (!(this instanceof CodeMirror)) { return new CodeMirror(place, options) }

		this.options = options = options ? copyObj(options) : {};
		// Determine effective options based on given values and defaults.
		copyObj(defaults, options, false);

		var doc = options.value;
		if (typeof doc == "string") { doc = new Doc(doc, options.mode, null, options.lineSeparator, options.direction); }
		else if (options.mode) { doc.modeOption = options.mode; }
		this.doc = doc;

		var input = new CodeMirror.inputStyles[options.inputStyle](this);
		var display = this.display = new Display(place, doc, input, options);
		display.wrapper.CodeMirror = this;
		themeChanged(this);
		if (options.lineWrapping)
			{ this.display.wrapper.className += " CodeMirror-wrap"; }
		initScrollbars(this);

		this.state = {
			keyMaps: [],  // stores maps added by addKeyMap
			overlays: [], // highlighting overlays, as added by addOverlay
			modeGen: 0,   // bumped when mode/overlay changes, used to invalidate highlighting info
			overwrite: false,
			delayingBlurEvent: false,
			focused: false,
			suppressEdits: false, // used to disable editing during key handlers when in readOnly mode
			pasteIncoming: -1, cutIncoming: -1, // help recognize paste/cut edits in input.poll
			selectingText: false,
			draggingText: false,
			highlight: new Delayed(), // stores highlight worker timeout
			keySeq: null,  // Unfinished key sequence
			specialChars: null
		};

		if (options.autofocus && !mobile) { display.input.focus(); }

		// Override magic textarea content restore that IE sometimes does
		// on our hidden textarea on reload
		if (ie && ie_version < 11) { setTimeout(function () { return this$1$1.display.input.reset(true); }, 20); }

		registerEventHandlers(this);
		ensureGlobalHandlers();

		startOperation(this);
		this.curOp.forceUpdate = true;
		attachDoc(this, doc);

		if ((options.autofocus && !mobile) || this.hasFocus())
			{ setTimeout(function () {
				if (this$1$1.hasFocus() && !this$1$1.state.focused) { onFocus(this$1$1); }
			}, 20); }
		else
			{ onBlur(this); }

		for (var opt in optionHandlers) { if (optionHandlers.hasOwnProperty(opt))
			{ optionHandlers[opt](this, options[opt], Init); } }
		maybeUpdateLineNumberWidth(this);
		if (options.finishInit) { options.finishInit(this); }
		for (var i = 0; i < initHooks.length; ++i) { initHooks[i](this); }
		endOperation(this);
		// Suppress optimizelegibility in Webkit, since it breaks text
		// measuring on line wrapping boundaries.
		if (webkit && options.lineWrapping &&
				getComputedStyle(display.lineDiv).textRendering == "optimizelegibility")
			{ display.lineDiv.style.textRendering = "auto"; }
	}

	// The default configuration options.
	CodeMirror.defaults = defaults;
	// Functions to run when options are changed.
	CodeMirror.optionHandlers = optionHandlers;

	// Attach the necessary event handlers when initializing the editor
	function registerEventHandlers(cm) {
		var d = cm.display;
		on(d.scroller, "mousedown", operation(cm, onMouseDown));
		// Older IE's will not fire a second mousedown for a double click
		if (ie && ie_version < 11)
			{ on(d.scroller, "dblclick", operation(cm, function (e) {
				if (signalDOMEvent(cm, e)) { return }
				var pos = posFromMouse(cm, e);
				if (!pos || clickInGutter(cm, e) || eventInWidget(cm.display, e)) { return }
				e_preventDefault(e);
				var word = cm.findWordAt(pos);
				extendSelection(cm.doc, word.anchor, word.head);
			})); }
		else
			{ on(d.scroller, "dblclick", function (e) { return signalDOMEvent(cm, e) || e_preventDefault(e); }); }
		// Some browsers fire contextmenu *after* opening the menu, at
		// which point we can't mess with it anymore. Context menu is
		// handled in onMouseDown for these browsers.
		on(d.scroller, "contextmenu", function (e) { return onContextMenu(cm, e); });
		on(d.input.getField(), "contextmenu", function (e) {
			if (!d.scroller.contains(e.target)) { onContextMenu(cm, e); }
		});

		// Used to suppress mouse event handling when a touch happens
		var touchFinished, prevTouch = {end: 0};
		function finishTouch() {
			if (d.activeTouch) {
				touchFinished = setTimeout(function () { return d.activeTouch = null; }, 1000);
				prevTouch = d.activeTouch;
				prevTouch.end = +new Date;
			}
		}
		function isMouseLikeTouchEvent(e) {
			if (e.touches.length != 1) { return false }
			var touch = e.touches[0];
			return touch.radiusX <= 1 && touch.radiusY <= 1
		}
		function farAway(touch, other) {
			if (other.left == null) { return true }
			var dx = other.left - touch.left, dy = other.top - touch.top;
			return dx * dx + dy * dy > 20 * 20
		}
		on(d.scroller, "touchstart", function (e) {
			if (!signalDOMEvent(cm, e) && !isMouseLikeTouchEvent(e) && !clickInGutter(cm, e)) {
				d.input.ensurePolled();
				clearTimeout(touchFinished);
				var now = +new Date;
				d.activeTouch = {start: now, moved: false,
												 prev: now - prevTouch.end <= 300 ? prevTouch : null};
				if (e.touches.length == 1) {
					d.activeTouch.left = e.touches[0].pageX;
					d.activeTouch.top = e.touches[0].pageY;
				}
			}
		});
		on(d.scroller, "touchmove", function () {
			if (d.activeTouch) { d.activeTouch.moved = true; }
		});
		on(d.scroller, "touchend", function (e) {
			var touch = d.activeTouch;
			if (touch && !eventInWidget(d, e) && touch.left != null &&
					!touch.moved && new Date - touch.start < 300) {
				var pos = cm.coordsChar(d.activeTouch, "page"), range;
				if (!touch.prev || farAway(touch, touch.prev)) // Single tap
					{ range = new Range(pos, pos); }
				else if (!touch.prev.prev || farAway(touch, touch.prev.prev)) // Double tap
					{ range = cm.findWordAt(pos); }
				else // Triple tap
					{ range = new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))); }
				cm.setSelection(range.anchor, range.head);
				cm.focus();
				e_preventDefault(e);
			}
			finishTouch();
		});
		on(d.scroller, "touchcancel", finishTouch);

		// Sync scrolling between fake scrollbars and real scrollable
		// area, ensure viewport is updated when scrolling.
		on(d.scroller, "scroll", function () {
			if (d.scroller.clientHeight) {
				updateScrollTop(cm, d.scroller.scrollTop);
				setScrollLeft(cm, d.scroller.scrollLeft, true);
				signal(cm, "scroll", cm);
			}
		});

		// Listen to wheel events in order to try and update the viewport on time.
		on(d.scroller, "mousewheel", function (e) { return onScrollWheel(cm, e); });
		on(d.scroller, "DOMMouseScroll", function (e) { return onScrollWheel(cm, e); });

		// Prevent wrapper from ever scrolling
		on(d.wrapper, "scroll", function () { return d.wrapper.scrollTop = d.wrapper.scrollLeft = 0; });

		d.dragFunctions = {
			enter: function (e) {if (!signalDOMEvent(cm, e)) { e_stop(e); }},
			over: function (e) {if (!signalDOMEvent(cm, e)) { onDragOver(cm, e); e_stop(e); }},
			start: function (e) { return onDragStart(cm, e); },
			drop: operation(cm, onDrop),
			leave: function (e) {if (!signalDOMEvent(cm, e)) { clearDragCursor(cm); }}
		};

		var inp = d.input.getField();
		on(inp, "keyup", function (e) { return onKeyUp.call(cm, e); });
		on(inp, "keydown", operation(cm, onKeyDown));
		on(inp, "keypress", operation(cm, onKeyPress));
		on(inp, "focus", function (e) { return onFocus(cm, e); });
		on(inp, "blur", function (e) { return onBlur(cm, e); });
	}

	var initHooks = [];
	CodeMirror.defineInitHook = function (f) { return initHooks.push(f); };

	// Indent the given line. The how parameter can be "smart",
	// "add"/null, "subtract", or "prev". When aggressive is false
	// (typically set to true for forced single-line indents), empty
	// lines are not indented, and places where the mode returns Pass
	// are left alone.
	function indentLine(cm, n, how, aggressive) {
		var doc = cm.doc, state;
		if (how == null) { how = "add"; }
		if (how == "smart") {
			// Fall back to "prev" when the mode doesn't have an indentation
			// method.
			if (!doc.mode.indent) { how = "prev"; }
			else { state = getContextBefore(cm, n).state; }
		}

		var tabSize = cm.options.tabSize;
		var line = getLine(doc, n), curSpace = countColumn(line.text, null, tabSize);
		if (line.stateAfter) { line.stateAfter = null; }
		var curSpaceString = line.text.match(/^\s*/)[0], indentation;
		if (!aggressive && !/\S/.test(line.text)) {
			indentation = 0;
			how = "not";
		} else if (how == "smart") {
			indentation = doc.mode.indent(state, line.text.slice(curSpaceString.length), line.text);
			if (indentation == Pass || indentation > 150) {
				if (!aggressive) { return }
				how = "prev";
			}
		}
		if (how == "prev") {
			if (n > doc.first) { indentation = countColumn(getLine(doc, n-1).text, null, tabSize); }
			else { indentation = 0; }
		} else if (how == "add") {
			indentation = curSpace + cm.options.indentUnit;
		} else if (how == "subtract") {
			indentation = curSpace - cm.options.indentUnit;
		} else if (typeof how == "number") {
			indentation = curSpace + how;
		}
		indentation = Math.max(0, indentation);

		var indentString = "", pos = 0;
		if (cm.options.indentWithTabs)
			{ for (var i = Math.floor(indentation / tabSize); i; --i) {pos += tabSize; indentString += "\t";} }
		if (pos < indentation) { indentString += spaceStr(indentation - pos); }

		if (indentString != curSpaceString) {
			replaceRange(doc, indentString, Pos(n, 0), Pos(n, curSpaceString.length), "+input");
			line.stateAfter = null;
			return true
		} else {
			// Ensure that, if the cursor was in the whitespace at the start
			// of the line, it is moved to the end of that space.
			for (var i$1 = 0; i$1 < doc.sel.ranges.length; i$1++) {
				var range = doc.sel.ranges[i$1];
				if (range.head.line == n && range.head.ch < curSpaceString.length) {
					var pos$1 = Pos(n, curSpaceString.length);
					replaceOneSelection(doc, i$1, new Range(pos$1, pos$1));
					break
				}
			}
		}
	}

	// This will be set to a {lineWise: bool, text: [string]} object, so
	// that, when pasting, we know what kind of selections the copied
	// text was made out of.
	var lastCopied = null;

	function setLastCopied(newLastCopied) {
		lastCopied = newLastCopied;
	}

	function applyTextInput(cm, inserted, deleted, sel, origin) {
		var doc = cm.doc;
		cm.display.shift = false;
		if (!sel) { sel = doc.sel; }

		var recent = +new Date - 200;
		var paste = origin == "paste" || cm.state.pasteIncoming > recent;
		var textLines = splitLinesAuto(inserted), multiPaste = null;
		// When pasting N lines into N selections, insert one line per selection
		if (paste && sel.ranges.length > 1) {
			if (lastCopied && lastCopied.text.join("\n") == inserted) {
				if (sel.ranges.length % lastCopied.text.length == 0) {
					multiPaste = [];
					for (var i = 0; i < lastCopied.text.length; i++)
						{ multiPaste.push(doc.splitLines(lastCopied.text[i])); }
				}
			} else if (textLines.length == sel.ranges.length && cm.options.pasteLinesPerSelection) {
				multiPaste = map(textLines, function (l) { return [l]; });
			}
		}

		var updateInput = cm.curOp.updateInput;
		// Normal behavior is to insert the new text into every selection
		for (var i$1 = sel.ranges.length - 1; i$1 >= 0; i$1--) {
			var range = sel.ranges[i$1];
			var from = range.from(), to = range.to();
			if (range.empty()) {
				if (deleted && deleted > 0) // Handle deletion
					{ from = Pos(from.line, from.ch - deleted); }
				else if (cm.state.overwrite && !paste) // Handle overwrite
					{ to = Pos(to.line, Math.min(getLine(doc, to.line).text.length, to.ch + lst(textLines).length)); }
				else if (paste && lastCopied && lastCopied.lineWise && lastCopied.text.join("\n") == textLines.join("\n"))
					{ from = to = Pos(from.line, 0); }
			}
			var changeEvent = {from: from, to: to, text: multiPaste ? multiPaste[i$1 % multiPaste.length] : textLines,
												 origin: origin || (paste ? "paste" : cm.state.cutIncoming > recent ? "cut" : "+input")};
			makeChange(cm.doc, changeEvent);
			signalLater(cm, "inputRead", cm, changeEvent);
		}
		if (inserted && !paste)
			{ triggerElectric(cm, inserted); }

		ensureCursorVisible(cm);
		if (cm.curOp.updateInput < 2) { cm.curOp.updateInput = updateInput; }
		cm.curOp.typing = true;
		cm.state.pasteIncoming = cm.state.cutIncoming = -1;
	}

	function handlePaste(e, cm) {
		var pasted = e.clipboardData && e.clipboardData.getData("Text");
		if (pasted) {
			e.preventDefault();
			if (!cm.isReadOnly() && !cm.options.disableInput && cm.hasFocus())
				{ runInOp(cm, function () { return applyTextInput(cm, pasted, 0, null, "paste"); }); }
			return true
		}
	}

	function triggerElectric(cm, inserted) {
		// When an 'electric' character is inserted, immediately trigger a reindent
		if (!cm.options.electricChars || !cm.options.smartIndent) { return }
		var sel = cm.doc.sel;

		for (var i = sel.ranges.length - 1; i >= 0; i--) {
			var range = sel.ranges[i];
			if (range.head.ch > 100 || (i && sel.ranges[i - 1].head.line == range.head.line)) { continue }
			var mode = cm.getModeAt(range.head);
			var indented = false;
			if (mode.electricChars) {
				for (var j = 0; j < mode.electricChars.length; j++)
					{ if (inserted.indexOf(mode.electricChars.charAt(j)) > -1) {
						indented = indentLine(cm, range.head.line, "smart");
						break
					} }
			} else if (mode.electricInput) {
				if (mode.electricInput.test(getLine(cm.doc, range.head.line).text.slice(0, range.head.ch)))
					{ indented = indentLine(cm, range.head.line, "smart"); }
			}
			if (indented) { signalLater(cm, "electricInput", cm, range.head.line); }
		}
	}

	function copyableRanges(cm) {
		var text = [], ranges = [];
		for (var i = 0; i < cm.doc.sel.ranges.length; i++) {
			var line = cm.doc.sel.ranges[i].head.line;
			var lineRange = {anchor: Pos(line, 0), head: Pos(line + 1, 0)};
			ranges.push(lineRange);
			text.push(cm.getRange(lineRange.anchor, lineRange.head));
		}
		return {text: text, ranges: ranges}
	}

	function disableBrowserMagic(field, spellcheck, autocorrect, autocapitalize) {
		field.setAttribute("autocorrect", autocorrect ? "on" : "off");
		field.setAttribute("autocapitalize", autocapitalize ? "on" : "off");
		field.setAttribute("spellcheck", !!spellcheck);
	}

	function hiddenTextarea() {
		var te = elt("textarea", null, null, "position: absolute; bottom: -1em; padding: 0; width: 1px; height: 1em; min-height: 1em; outline: none");
		var div = elt("div", [te], null, "overflow: hidden; position: relative; width: 3px; height: 0px;");
		// The textarea is kept positioned near the cursor to prevent the
		// fact that it'll be scrolled into view on input from scrolling
		// our fake cursor out of view. On webkit, when wrap=off, paste is
		// very slow. So make the area wide instead.
		if (webkit) { te.style.width = "1000px"; }
		else { te.setAttribute("wrap", "off"); }
		// If border: 0; -- iOS fails to open keyboard (issue #1287)
		if (ios) { te.style.border = "1px solid black"; }
		return div
	}

	// The publicly visible API. Note that methodOp(f) means
	// 'wrap f in an operation, performed on its `this` parameter'.

	// This is not the complete set of editor methods. Most of the
	// methods defined on the Doc type are also injected into
	// CodeMirror.prototype, for backwards compatibility and
	// convenience.

	function addEditorMethods(CodeMirror) {
		var optionHandlers = CodeMirror.optionHandlers;

		var helpers = CodeMirror.helpers = {};

		CodeMirror.prototype = {
			constructor: CodeMirror,
			focus: function(){win(this).focus(); this.display.input.focus();},

			setOption: function(option, value) {
				var options = this.options, old = options[option];
				if (options[option] == value && option != "mode") { return }
				options[option] = value;
				if (optionHandlers.hasOwnProperty(option))
					{ operation(this, optionHandlers[option])(this, value, old); }
				signal(this, "optionChange", this, option);
			},

			getOption: function(option) {return this.options[option]},
			getDoc: function() {return this.doc},

			addKeyMap: function(map, bottom) {
				this.state.keyMaps[bottom ? "push" : "unshift"](getKeyMap(map));
			},
			removeKeyMap: function(map) {
				var maps = this.state.keyMaps;
				for (var i = 0; i < maps.length; ++i)
					{ if (maps[i] == map || maps[i].name == map) {
						maps.splice(i, 1);
						return true
					} }
			},

			addOverlay: methodOp(function(spec, options) {
				var mode = spec.token ? spec : CodeMirror.getMode(this.options, spec);
				if (mode.startState) { throw new Error("Overlays may not be stateful.") }
				insertSorted(this.state.overlays,
										 {mode: mode, modeSpec: spec, opaque: options && options.opaque,
											priority: (options && options.priority) || 0},
										 function (overlay) { return overlay.priority; });
				this.state.modeGen++;
				regChange(this);
			}),
			removeOverlay: methodOp(function(spec) {
				var overlays = this.state.overlays;
				for (var i = 0; i < overlays.length; ++i) {
					var cur = overlays[i].modeSpec;
					if (cur == spec || typeof spec == "string" && cur.name == spec) {
						overlays.splice(i, 1);
						this.state.modeGen++;
						regChange(this);
						return
					}
				}
			}),

			indentLine: methodOp(function(n, dir, aggressive) {
				if (typeof dir != "string" && typeof dir != "number") {
					if (dir == null) { dir = this.options.smartIndent ? "smart" : "prev"; }
					else { dir = dir ? "add" : "subtract"; }
				}
				if (isLine(this.doc, n)) { indentLine(this, n, dir, aggressive); }
			}),
			indentSelection: methodOp(function(how) {
				var ranges = this.doc.sel.ranges, end = -1;
				for (var i = 0; i < ranges.length; i++) {
					var range = ranges[i];
					if (!range.empty()) {
						var from = range.from(), to = range.to();
						var start = Math.max(end, from.line);
						end = Math.min(this.lastLine(), to.line - (to.ch ? 0 : 1)) + 1;
						for (var j = start; j < end; ++j)
							{ indentLine(this, j, how); }
						var newRanges = this.doc.sel.ranges;
						if (from.ch == 0 && ranges.length == newRanges.length && newRanges[i].from().ch > 0)
							{ replaceOneSelection(this.doc, i, new Range(from, newRanges[i].to()), sel_dontScroll); }
					} else if (range.head.line > end) {
						indentLine(this, range.head.line, how, true);
						end = range.head.line;
						if (i == this.doc.sel.primIndex) { ensureCursorVisible(this); }
					}
				}
			}),

			// Fetch the parser token for a given character. Useful for hacks
			// that want to inspect the mode state (say, for completion).
			getTokenAt: function(pos, precise) {
				return takeToken(this, pos, precise)
			},

			getLineTokens: function(line, precise) {
				return takeToken(this, Pos(line), precise, true)
			},

			getTokenTypeAt: function(pos) {
				pos = clipPos(this.doc, pos);
				var styles = getLineStyles(this, getLine(this.doc, pos.line));
				var before = 0, after = (styles.length - 1) / 2, ch = pos.ch;
				var type;
				if (ch == 0) { type = styles[2]; }
				else { for (;;) {
					var mid = (before + after) >> 1;
					if ((mid ? styles[mid * 2 - 1] : 0) >= ch) { after = mid; }
					else if (styles[mid * 2 + 1] < ch) { before = mid + 1; }
					else { type = styles[mid * 2 + 2]; break }
				} }
				var cut = type ? type.indexOf("overlay ") : -1;
				return cut < 0 ? type : cut == 0 ? null : type.slice(0, cut - 1)
			},

			getModeAt: function(pos) {
				var mode = this.doc.mode;
				if (!mode.innerMode) { return mode }
				return CodeMirror.innerMode(mode, this.getTokenAt(pos).state).mode
			},

			getHelper: function(pos, type) {
				return this.getHelpers(pos, type)[0]
			},

			getHelpers: function(pos, type) {
				var found = [];
				if (!helpers.hasOwnProperty(type)) { return found }
				var help = helpers[type], mode = this.getModeAt(pos);
				if (typeof mode[type] == "string") {
					if (help[mode[type]]) { found.push(help[mode[type]]); }
				} else if (mode[type]) {
					for (var i = 0; i < mode[type].length; i++) {
						var val = help[mode[type][i]];
						if (val) { found.push(val); }
					}
				} else if (mode.helperType && help[mode.helperType]) {
					found.push(help[mode.helperType]);
				} else if (help[mode.name]) {
					found.push(help[mode.name]);
				}
				for (var i$1 = 0; i$1 < help._global.length; i$1++) {
					var cur = help._global[i$1];
					if (cur.pred(mode, this) && indexOf(found, cur.val) == -1)
						{ found.push(cur.val); }
				}
				return found
			},

			getStateAfter: function(line, precise) {
				var doc = this.doc;
				line = clipLine(doc, line == null ? doc.first + doc.size - 1: line);
				return getContextBefore(this, line + 1, precise).state
			},

			cursorCoords: function(start, mode) {
				var pos, range = this.doc.sel.primary();
				if (start == null) { pos = range.head; }
				else if (typeof start == "object") { pos = clipPos(this.doc, start); }
				else { pos = start ? range.from() : range.to(); }
				return cursorCoords(this, pos, mode || "page")
			},

			charCoords: function(pos, mode) {
				return charCoords(this, clipPos(this.doc, pos), mode || "page")
			},

			coordsChar: function(coords, mode) {
				coords = fromCoordSystem(this, coords, mode || "page");
				return coordsChar(this, coords.left, coords.top)
			},

			lineAtHeight: function(height, mode) {
				height = fromCoordSystem(this, {top: height, left: 0}, mode || "page").top;
				return lineAtHeight(this.doc, height + this.display.viewOffset)
			},
			heightAtLine: function(line, mode, includeWidgets) {
				var end = false, lineObj;
				if (typeof line == "number") {
					var last = this.doc.first + this.doc.size - 1;
					if (line < this.doc.first) { line = this.doc.first; }
					else if (line > last) { line = last; end = true; }
					lineObj = getLine(this.doc, line);
				} else {
					lineObj = line;
				}
				return intoCoordSystem(this, lineObj, {top: 0, left: 0}, mode || "page", includeWidgets || end).top +
					(end ? this.doc.height - heightAtLine(lineObj) : 0)
			},

			defaultTextHeight: function() { return textHeight(this.display) },
			defaultCharWidth: function() { return charWidth(this.display) },

			getViewport: function() { return {from: this.display.viewFrom, to: this.display.viewTo}},

			addWidget: function(pos, node, scroll, vert, horiz) {
				var display = this.display;
				pos = cursorCoords(this, clipPos(this.doc, pos));
				var top = pos.bottom, left = pos.left;
				node.style.position = "absolute";
				node.setAttribute("cm-ignore-events", "true");
				this.display.input.setUneditable(node);
				display.sizer.appendChild(node);
				if (vert == "over") {
					top = pos.top;
				} else if (vert == "above" || vert == "near") {
					var vspace = Math.max(display.wrapper.clientHeight, this.doc.height),
					hspace = Math.max(display.sizer.clientWidth, display.lineSpace.clientWidth);
					// Default to positioning above (if specified and possible); otherwise default to positioning below
					if ((vert == 'above' || pos.bottom + node.offsetHeight > vspace) && pos.top > node.offsetHeight)
						{ top = pos.top - node.offsetHeight; }
					else if (pos.bottom + node.offsetHeight <= vspace)
						{ top = pos.bottom; }
					if (left + node.offsetWidth > hspace)
						{ left = hspace - node.offsetWidth; }
				}
				node.style.top = top + "px";
				node.style.left = node.style.right = "";
				if (horiz == "right") {
					left = display.sizer.clientWidth - node.offsetWidth;
					node.style.right = "0px";
				} else {
					if (horiz == "left") { left = 0; }
					else if (horiz == "middle") { left = (display.sizer.clientWidth - node.offsetWidth) / 2; }
					node.style.left = left + "px";
				}
				if (scroll)
					{ scrollIntoView(this, {left: left, top: top, right: left + node.offsetWidth, bottom: top + node.offsetHeight}); }
			},

			triggerOnKeyDown: methodOp(onKeyDown),
			triggerOnKeyPress: methodOp(onKeyPress),
			triggerOnKeyUp: onKeyUp,
			triggerOnMouseDown: methodOp(onMouseDown),

			execCommand: function(cmd) {
				if (commands.hasOwnProperty(cmd))
					{ return commands[cmd].call(null, this) }
			},

			triggerElectric: methodOp(function(text) { triggerElectric(this, text); }),

			findPosH: function(from, amount, unit, visually) {
				var dir = 1;
				if (amount < 0) { dir = -1; amount = -amount; }
				var cur = clipPos(this.doc, from);
				for (var i = 0; i < amount; ++i) {
					cur = findPosH(this.doc, cur, dir, unit, visually);
					if (cur.hitSide) { break }
				}
				return cur
			},

			moveH: methodOp(function(dir, unit) {
				var this$1$1 = this;

				this.extendSelectionsBy(function (range) {
					if (this$1$1.display.shift || this$1$1.doc.extend || range.empty())
						{ return findPosH(this$1$1.doc, range.head, dir, unit, this$1$1.options.rtlMoveVisually) }
					else
						{ return dir < 0 ? range.from() : range.to() }
				}, sel_move);
			}),

			deleteH: methodOp(function(dir, unit) {
				var sel = this.doc.sel, doc = this.doc;
				if (sel.somethingSelected())
					{ doc.replaceSelection("", null, "+delete"); }
				else
					{ deleteNearSelection(this, function (range) {
						var other = findPosH(doc, range.head, dir, unit, false);
						return dir < 0 ? {from: other, to: range.head} : {from: range.head, to: other}
					}); }
			}),

			findPosV: function(from, amount, unit, goalColumn) {
				var dir = 1, x = goalColumn;
				if (amount < 0) { dir = -1; amount = -amount; }
				var cur = clipPos(this.doc, from);
				for (var i = 0; i < amount; ++i) {
					var coords = cursorCoords(this, cur, "div");
					if (x == null) { x = coords.left; }
					else { coords.left = x; }
					cur = findPosV(this, coords, dir, unit);
					if (cur.hitSide) { break }
				}
				return cur
			},

			moveV: methodOp(function(dir, unit) {
				var this$1$1 = this;

				var doc = this.doc, goals = [];
				var collapse = !this.display.shift && !doc.extend && doc.sel.somethingSelected();
				doc.extendSelectionsBy(function (range) {
					if (collapse)
						{ return dir < 0 ? range.from() : range.to() }
					var headPos = cursorCoords(this$1$1, range.head, "div");
					if (range.goalColumn != null) { headPos.left = range.goalColumn; }
					goals.push(headPos.left);
					var pos = findPosV(this$1$1, headPos, dir, unit);
					if (unit == "page" && range == doc.sel.primary())
						{ addToScrollTop(this$1$1, charCoords(this$1$1, pos, "div").top - headPos.top); }
					return pos
				}, sel_move);
				if (goals.length) { for (var i = 0; i < doc.sel.ranges.length; i++)
					{ doc.sel.ranges[i].goalColumn = goals[i]; } }
			}),

			// Find the word at the given position (as returned by coordsChar).
			findWordAt: function(pos) {
				var doc = this.doc, line = getLine(doc, pos.line).text;
				var start = pos.ch, end = pos.ch;
				if (line) {
					var helper = this.getHelper(pos, "wordChars");
					if ((pos.sticky == "before" || end == line.length) && start) { --start; } else { ++end; }
					var startChar = line.charAt(start);
					var check = isWordChar(startChar, helper)
						? function (ch) { return isWordChar(ch, helper); }
						: /\s/.test(startChar) ? function (ch) { return /\s/.test(ch); }
						: function (ch) { return (!/\s/.test(ch) && !isWordChar(ch)); };
					while (start > 0 && check(line.charAt(start - 1))) { --start; }
					while (end < line.length && check(line.charAt(end))) { ++end; }
				}
				return new Range(Pos(pos.line, start), Pos(pos.line, end))
			},

			toggleOverwrite: function(value) {
				if (value != null && value == this.state.overwrite) { return }
				if (this.state.overwrite = !this.state.overwrite)
					{ addClass(this.display.cursorDiv, "CodeMirror-overwrite"); }
				else
					{ rmClass(this.display.cursorDiv, "CodeMirror-overwrite"); }

				signal(this, "overwriteToggle", this, this.state.overwrite);
			},
			hasFocus: function() { return this.display.input.getField() == activeElt(root(this)) },
			isReadOnly: function() { return !!(this.options.readOnly || this.doc.cantEdit) },

			scrollTo: methodOp(function (x, y) { scrollToCoords(this, x, y); }),
			getScrollInfo: function() {
				var scroller = this.display.scroller;
				return {left: scroller.scrollLeft, top: scroller.scrollTop,
								height: scroller.scrollHeight - scrollGap(this) - this.display.barHeight,
								width: scroller.scrollWidth - scrollGap(this) - this.display.barWidth,
								clientHeight: displayHeight(this), clientWidth: displayWidth(this)}
			},

			scrollIntoView: methodOp(function(range, margin) {
				if (range == null) {
					range = {from: this.doc.sel.primary().head, to: null};
					if (margin == null) { margin = this.options.cursorScrollMargin; }
				} else if (typeof range == "number") {
					range = {from: Pos(range, 0), to: null};
				} else if (range.from == null) {
					range = {from: range, to: null};
				}
				if (!range.to) { range.to = range.from; }
				range.margin = margin || 0;

				if (range.from.line != null) {
					scrollToRange(this, range);
				} else {
					scrollToCoordsRange(this, range.from, range.to, range.margin);
				}
			}),

			setSize: methodOp(function(width, height) {
				var this$1$1 = this;

				var interpret = function (val) { return typeof val == "number" || /^\d+$/.test(String(val)) ? val + "px" : val; };
				if (width != null) { this.display.wrapper.style.width = interpret(width); }
				if (height != null) { this.display.wrapper.style.height = interpret(height); }
				if (this.options.lineWrapping) { clearLineMeasurementCache(this); }
				var lineNo = this.display.viewFrom;
				this.doc.iter(lineNo, this.display.viewTo, function (line) {
					if (line.widgets) { for (var i = 0; i < line.widgets.length; i++)
						{ if (line.widgets[i].noHScroll) { regLineChange(this$1$1, lineNo, "widget"); break } } }
					++lineNo;
				});
				this.curOp.forceUpdate = true;
				signal(this, "refresh", this);
			}),

			operation: function(f){return runInOp(this, f)},
			startOperation: function(){return startOperation(this)},
			endOperation: function(){return endOperation(this)},

			refresh: methodOp(function() {
				var oldHeight = this.display.cachedTextHeight;
				regChange(this);
				this.curOp.forceUpdate = true;
				clearCaches(this);
				scrollToCoords(this, this.doc.scrollLeft, this.doc.scrollTop);
				updateGutterSpace(this.display);
				if (oldHeight == null || Math.abs(oldHeight - textHeight(this.display)) > .5 || this.options.lineWrapping)
					{ estimateLineHeights(this); }
				signal(this, "refresh", this);
			}),

			swapDoc: methodOp(function(doc) {
				var old = this.doc;
				old.cm = null;
				// Cancel the current text selection if any (#5821)
				if (this.state.selectingText) { this.state.selectingText(); }
				attachDoc(this, doc);
				clearCaches(this);
				this.display.input.reset();
				scrollToCoords(this, doc.scrollLeft, doc.scrollTop);
				this.curOp.forceScroll = true;
				signalLater(this, "swapDoc", this, old);
				return old
			}),

			phrase: function(phraseText) {
				var phrases = this.options.phrases;
				return phrases && Object.prototype.hasOwnProperty.call(phrases, phraseText) ? phrases[phraseText] : phraseText
			},

			getInputField: function(){return this.display.input.getField()},
			getWrapperElement: function(){return this.display.wrapper},
			getScrollerElement: function(){return this.display.scroller},
			getGutterElement: function(){return this.display.gutters}
		};
		eventMixin(CodeMirror);

		CodeMirror.registerHelper = function(type, name, value) {
			if (!helpers.hasOwnProperty(type)) { helpers[type] = CodeMirror[type] = {_global: []}; }
			helpers[type][name] = value;
		};
		CodeMirror.registerGlobalHelper = function(type, name, predicate, value) {
			CodeMirror.registerHelper(type, name, value);
			helpers[type]._global.push({pred: predicate, val: value});
		};
	}

	// Used for horizontal relative motion. Dir is -1 or 1 (left or
	// right), unit can be "codepoint", "char", "column" (like char, but
	// doesn't cross line boundaries), "word" (across next word), or
	// "group" (to the start of next group of word or
	// non-word-non-whitespace chars). The visually param controls
	// whether, in right-to-left text, direction 1 means to move towards
	// the next index in the string, or towards the character to the right
	// of the current position. The resulting position will have a
	// hitSide=true property if it reached the end of the document.
	function findPosH(doc, pos, dir, unit, visually) {
		var oldPos = pos;
		var origDir = dir;
		var lineObj = getLine(doc, pos.line);
		var lineDir = visually && doc.direction == "rtl" ? -dir : dir;
		function findNextLine() {
			var l = pos.line + lineDir;
			if (l < doc.first || l >= doc.first + doc.size) { return false }
			pos = new Pos(l, pos.ch, pos.sticky);
			return lineObj = getLine(doc, l)
		}
		function moveOnce(boundToLine) {
			var next;
			if (unit == "codepoint") {
				var ch = lineObj.text.charCodeAt(pos.ch + (dir > 0 ? 0 : -1));
				if (isNaN(ch)) {
					next = null;
				} else {
					var astral = dir > 0 ? ch >= 0xD800 && ch < 0xDC00 : ch >= 0xDC00 && ch < 0xDFFF;
					next = new Pos(pos.line, Math.max(0, Math.min(lineObj.text.length, pos.ch + dir * (astral ? 2 : 1))), -dir);
				}
			} else if (visually) {
				next = moveVisually(doc.cm, lineObj, pos, dir);
			} else {
				next = moveLogically(lineObj, pos, dir);
			}
			if (next == null) {
				if (!boundToLine && findNextLine())
					{ pos = endOfLine(visually, doc.cm, lineObj, pos.line, lineDir); }
				else
					{ return false }
			} else {
				pos = next;
			}
			return true
		}

		if (unit == "char" || unit == "codepoint") {
			moveOnce();
		} else if (unit == "column") {
			moveOnce(true);
		} else if (unit == "word" || unit == "group") {
			var sawType = null, group = unit == "group";
			var helper = doc.cm && doc.cm.getHelper(pos, "wordChars");
			for (var first = true;; first = false) {
				if (dir < 0 && !moveOnce(!first)) { break }
				var cur = lineObj.text.charAt(pos.ch) || "\n";
				var type = isWordChar(cur, helper) ? "w"
					: group && cur == "\n" ? "n"
					: !group || /\s/.test(cur) ? null
					: "p";
				if (group && !first && !type) { type = "s"; }
				if (sawType && sawType != type) {
					if (dir < 0) {dir = 1; moveOnce(); pos.sticky = "after";}
					break
				}

				if (type) { sawType = type; }
				if (dir > 0 && !moveOnce(!first)) { break }
			}
		}
		var result = skipAtomic(doc, pos, oldPos, origDir, true);
		if (equalCursorPos(oldPos, result)) { result.hitSide = true; }
		return result
	}

	// For relative vertical movement. Dir may be -1 or 1. Unit can be
	// "page" or "line". The resulting position will have a hitSide=true
	// property if it reached the end of the document.
	function findPosV(cm, pos, dir, unit) {
		var doc = cm.doc, x = pos.left, y;
		if (unit == "page") {
			var pageSize = Math.min(cm.display.wrapper.clientHeight, win(cm).innerHeight || doc(cm).documentElement.clientHeight);
			var moveAmount = Math.max(pageSize - .5 * textHeight(cm.display), 3);
			y = (dir > 0 ? pos.bottom : pos.top) + dir * moveAmount;

		} else if (unit == "line") {
			y = dir > 0 ? pos.bottom + 3 : pos.top - 3;
		}
		var target;
		for (;;) {
			target = coordsChar(cm, x, y);
			if (!target.outside) { break }
			if (dir < 0 ? y <= 0 : y >= doc.height) { target.hitSide = true; break }
			y += dir * 5;
		}
		return target
	}

	// CONTENTEDITABLE INPUT STYLE

	var ContentEditableInput = function(cm) {
		this.cm = cm;
		this.lastAnchorNode = this.lastAnchorOffset = this.lastFocusNode = this.lastFocusOffset = null;
		this.polling = new Delayed();
		this.composing = null;
		this.gracePeriod = false;
		this.readDOMTimeout = null;
	};

	ContentEditableInput.prototype.init = function (display) {
			var this$1$1 = this;

		var input = this, cm = input.cm;
		var div = input.div = display.lineDiv;
		div.contentEditable = true;
		disableBrowserMagic(div, cm.options.spellcheck, cm.options.autocorrect, cm.options.autocapitalize);

		function belongsToInput(e) {
			for (var t = e.target; t; t = t.parentNode) {
				if (t == div) { return true }
				if (/\bCodeMirror-(?:line)?widget\b/.test(t.className)) { break }
			}
			return false
		}

		on(div, "paste", function (e) {
			if (!belongsToInput(e) || signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }
			// IE doesn't fire input events, so we schedule a read for the pasted content in this way
			if (ie_version <= 11) { setTimeout(operation(cm, function () { return this$1$1.updateFromDOM(); }), 20); }
		});

		on(div, "compositionstart", function (e) {
			this$1$1.composing = {data: e.data, done: false};
		});
		on(div, "compositionupdate", function (e) {
			if (!this$1$1.composing) { this$1$1.composing = {data: e.data, done: false}; }
		});
		on(div, "compositionend", function (e) {
			if (this$1$1.composing) {
				if (e.data != this$1$1.composing.data) { this$1$1.readFromDOMSoon(); }
				this$1$1.composing.done = true;
			}
		});

		on(div, "touchstart", function () { return input.forceCompositionEnd(); });

		on(div, "input", function () {
			if (!this$1$1.composing) { this$1$1.readFromDOMSoon(); }
		});

		function onCopyCut(e) {
			if (!belongsToInput(e) || signalDOMEvent(cm, e)) { return }
			if (cm.somethingSelected()) {
				setLastCopied({lineWise: false, text: cm.getSelections()});
				if (e.type == "cut") { cm.replaceSelection("", null, "cut"); }
			} else if (!cm.options.lineWiseCopyCut) {
				return
			} else {
				var ranges = copyableRanges(cm);
				setLastCopied({lineWise: true, text: ranges.text});
				if (e.type == "cut") {
					cm.operation(function () {
						cm.setSelections(ranges.ranges, 0, sel_dontScroll);
						cm.replaceSelection("", null, "cut");
					});
				}
			}
			if (e.clipboardData) {
				e.clipboardData.clearData();
				var content = lastCopied.text.join("\n");
				// iOS exposes the clipboard API, but seems to discard content inserted into it
				e.clipboardData.setData("Text", content);
				if (e.clipboardData.getData("Text") == content) {
					e.preventDefault();
					return
				}
			}
			// Old-fashioned briefly-focus-a-textarea hack
			var kludge = hiddenTextarea(), te = kludge.firstChild;
			disableBrowserMagic(te);
			cm.display.lineSpace.insertBefore(kludge, cm.display.lineSpace.firstChild);
			te.value = lastCopied.text.join("\n");
			var hadFocus = activeElt(rootNode(div));
			selectInput(te);
			setTimeout(function () {
				cm.display.lineSpace.removeChild(kludge);
				hadFocus.focus();
				if (hadFocus == div) { input.showPrimarySelection(); }
			}, 50);
		}
		on(div, "copy", onCopyCut);
		on(div, "cut", onCopyCut);
	};

	ContentEditableInput.prototype.screenReaderLabelChanged = function (label) {
		// Label for screenreaders, accessibility
		if(label) {
			this.div.setAttribute('aria-label', label);
		} else {
			this.div.removeAttribute('aria-label');
		}
	};

	ContentEditableInput.prototype.prepareSelection = function () {
		var result = prepareSelection(this.cm, false);
		result.focus = activeElt(rootNode(this.div)) == this.div;
		return result
	};

	ContentEditableInput.prototype.showSelection = function (info, takeFocus) {
		if (!info || !this.cm.display.view.length) { return }
		if (info.focus || takeFocus) { this.showPrimarySelection(); }
		this.showMultipleSelections(info);
	};

	ContentEditableInput.prototype.getSelection = function () {
		return this.cm.display.wrapper.ownerDocument.getSelection()
	};

	ContentEditableInput.prototype.showPrimarySelection = function () {
		var sel = this.getSelection(), cm = this.cm, prim = cm.doc.sel.primary();
		var from = prim.from(), to = prim.to();

		if (cm.display.viewTo == cm.display.viewFrom || from.line >= cm.display.viewTo || to.line < cm.display.viewFrom) {
			sel.removeAllRanges();
			return
		}

		var curAnchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
		var curFocus = domToPos(cm, sel.focusNode, sel.focusOffset);
		if (curAnchor && !curAnchor.bad && curFocus && !curFocus.bad &&
				cmp(minPos(curAnchor, curFocus), from) == 0 &&
				cmp(maxPos(curAnchor, curFocus), to) == 0)
			{ return }

		var view = cm.display.view;
		var start = (from.line >= cm.display.viewFrom && posToDOM(cm, from)) ||
				{node: view[0].measure.map[2], offset: 0};
		var end = to.line < cm.display.viewTo && posToDOM(cm, to);
		if (!end) {
			var measure = view[view.length - 1].measure;
			var map = measure.maps ? measure.maps[measure.maps.length - 1] : measure.map;
			end = {node: map[map.length - 1], offset: map[map.length - 2] - map[map.length - 3]};
		}

		if (!start || !end) {
			sel.removeAllRanges();
			return
		}

		var old = sel.rangeCount && sel.getRangeAt(0), rng;
		try { rng = range(start.node, start.offset, end.offset, end.node); }
		catch(e) {} // Our model of the DOM might be outdated, in which case the range we try to set can be impossible
		if (rng) {
			if (!gecko && cm.state.focused) {
				sel.collapse(start.node, start.offset);
				if (!rng.collapsed) {
					sel.removeAllRanges();
					sel.addRange(rng);
				}
			} else {
				sel.removeAllRanges();
				sel.addRange(rng);
			}
			if (old && sel.anchorNode == null) { sel.addRange(old); }
			else if (gecko) { this.startGracePeriod(); }
		}
		this.rememberSelection();
	};

	ContentEditableInput.prototype.startGracePeriod = function () {
			var this$1$1 = this;

		clearTimeout(this.gracePeriod);
		this.gracePeriod = setTimeout(function () {
			this$1$1.gracePeriod = false;
			if (this$1$1.selectionChanged())
				{ this$1$1.cm.operation(function () { return this$1$1.cm.curOp.selectionChanged = true; }); }
		}, 20);
	};

	ContentEditableInput.prototype.showMultipleSelections = function (info) {
		removeChildrenAndAdd(this.cm.display.cursorDiv, info.cursors);
		removeChildrenAndAdd(this.cm.display.selectionDiv, info.selection);
	};

	ContentEditableInput.prototype.rememberSelection = function () {
		var sel = this.getSelection();
		this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset;
		this.lastFocusNode = sel.focusNode; this.lastFocusOffset = sel.focusOffset;
	};

	ContentEditableInput.prototype.selectionInEditor = function () {
		var sel = this.getSelection();
		if (!sel.rangeCount) { return false }
		var node = sel.getRangeAt(0).commonAncestorContainer;
		return contains(this.div, node)
	};

	ContentEditableInput.prototype.focus = function () {
		if (this.cm.options.readOnly != "nocursor") {
			if (!this.selectionInEditor() || activeElt(rootNode(this.div)) != this.div)
				{ this.showSelection(this.prepareSelection(), true); }
			this.div.focus();
		}
	};
	ContentEditableInput.prototype.blur = function () { this.div.blur(); };
	ContentEditableInput.prototype.getField = function () { return this.div };

	ContentEditableInput.prototype.supportsTouch = function () { return true };

	ContentEditableInput.prototype.receivedFocus = function () {
			var this$1$1 = this;

		var input = this;
		if (this.selectionInEditor())
			{ setTimeout(function () { return this$1$1.pollSelection(); }, 20); }
		else
			{ runInOp(this.cm, function () { return input.cm.curOp.selectionChanged = true; }); }

		function poll() {
			if (input.cm.state.focused) {
				input.pollSelection();
				input.polling.set(input.cm.options.pollInterval, poll);
			}
		}
		this.polling.set(this.cm.options.pollInterval, poll);
	};

	ContentEditableInput.prototype.selectionChanged = function () {
		var sel = this.getSelection();
		return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
			sel.focusNode != this.lastFocusNode || sel.focusOffset != this.lastFocusOffset
	};

	ContentEditableInput.prototype.pollSelection = function () {
		if (this.readDOMTimeout != null || this.gracePeriod || !this.selectionChanged()) { return }
		var sel = this.getSelection(), cm = this.cm;
		// On Android Chrome (version 56, at least), backspacing into an
		// uneditable block element will put the cursor in that element,
		// and then, because it's not editable, hide the virtual keyboard.
		// Because Android doesn't allow us to actually detect backspace
		// presses in a sane way, this code checks for when that happens
		// and simulates a backspace press in this case.
		if (android && chrome && this.cm.display.gutterSpecs.length && isInGutter(sel.anchorNode)) {
			this.cm.triggerOnKeyDown({type: "keydown", keyCode: 8, preventDefault: Math.abs});
			this.blur();
			this.focus();
			return
		}
		if (this.composing) { return }
		this.rememberSelection();
		var anchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
		var head = domToPos(cm, sel.focusNode, sel.focusOffset);
		if (anchor && head) { runInOp(cm, function () {
			setSelection(cm.doc, simpleSelection(anchor, head), sel_dontScroll);
			if (anchor.bad || head.bad) { cm.curOp.selectionChanged = true; }
		}); }
	};

	ContentEditableInput.prototype.pollContent = function () {
		if (this.readDOMTimeout != null) {
			clearTimeout(this.readDOMTimeout);
			this.readDOMTimeout = null;
		}

		var cm = this.cm, display = cm.display, sel = cm.doc.sel.primary();
		var from = sel.from(), to = sel.to();
		if (from.ch == 0 && from.line > cm.firstLine())
			{ from = Pos(from.line - 1, getLine(cm.doc, from.line - 1).length); }
		if (to.ch == getLine(cm.doc, to.line).text.length && to.line < cm.lastLine())
			{ to = Pos(to.line + 1, 0); }
		if (from.line < display.viewFrom || to.line > display.viewTo - 1) { return false }

		var fromIndex, fromLine, fromNode;
		if (from.line == display.viewFrom || (fromIndex = findViewIndex(cm, from.line)) == 0) {
			fromLine = lineNo(display.view[0].line);
			fromNode = display.view[0].node;
		} else {
			fromLine = lineNo(display.view[fromIndex].line);
			fromNode = display.view[fromIndex - 1].node.nextSibling;
		}
		var toIndex = findViewIndex(cm, to.line);
		var toLine, toNode;
		if (toIndex == display.view.length - 1) {
			toLine = display.viewTo - 1;
			toNode = display.lineDiv.lastChild;
		} else {
			toLine = lineNo(display.view[toIndex + 1].line) - 1;
			toNode = display.view[toIndex + 1].node.previousSibling;
		}

		if (!fromNode) { return false }
		var newText = cm.doc.splitLines(domTextBetween(cm, fromNode, toNode, fromLine, toLine));
		var oldText = getBetween(cm.doc, Pos(fromLine, 0), Pos(toLine, getLine(cm.doc, toLine).text.length));
		while (newText.length > 1 && oldText.length > 1) {
			if (lst(newText) == lst(oldText)) { newText.pop(); oldText.pop(); toLine--; }
			else if (newText[0] == oldText[0]) { newText.shift(); oldText.shift(); fromLine++; }
			else { break }
		}

		var cutFront = 0, cutEnd = 0;
		var newTop = newText[0], oldTop = oldText[0], maxCutFront = Math.min(newTop.length, oldTop.length);
		while (cutFront < maxCutFront && newTop.charCodeAt(cutFront) == oldTop.charCodeAt(cutFront))
			{ ++cutFront; }
		var newBot = lst(newText), oldBot = lst(oldText);
		var maxCutEnd = Math.min(newBot.length - (newText.length == 1 ? cutFront : 0),
														 oldBot.length - (oldText.length == 1 ? cutFront : 0));
		while (cutEnd < maxCutEnd &&
					 newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1))
			{ ++cutEnd; }
		// Try to move start of change to start of selection if ambiguous
		if (newText.length == 1 && oldText.length == 1 && fromLine == from.line) {
			while (cutFront && cutFront > from.ch &&
						 newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1)) {
				cutFront--;
				cutEnd++;
			}
		}

		newText[newText.length - 1] = newBot.slice(0, newBot.length - cutEnd).replace(/^\u200b+/, "");
		newText[0] = newText[0].slice(cutFront).replace(/\u200b+$/, "");

		var chFrom = Pos(fromLine, cutFront);
		var chTo = Pos(toLine, oldText.length ? lst(oldText).length - cutEnd : 0);
		if (newText.length > 1 || newText[0] || cmp(chFrom, chTo)) {
			replaceRange(cm.doc, newText, chFrom, chTo, "+input");
			return true
		}
	};

	ContentEditableInput.prototype.ensurePolled = function () {
		this.forceCompositionEnd();
	};
	ContentEditableInput.prototype.reset = function () {
		this.forceCompositionEnd();
	};
	ContentEditableInput.prototype.forceCompositionEnd = function () {
		if (!this.composing) { return }
		clearTimeout(this.readDOMTimeout);
		this.composing = null;
		this.updateFromDOM();
		this.div.blur();
		this.div.focus();
	};
	ContentEditableInput.prototype.readFromDOMSoon = function () {
			var this$1$1 = this;

		if (this.readDOMTimeout != null) { return }
		this.readDOMTimeout = setTimeout(function () {
			this$1$1.readDOMTimeout = null;
			if (this$1$1.composing) {
				if (this$1$1.composing.done) { this$1$1.composing = null; }
				else { return }
			}
			this$1$1.updateFromDOM();
		}, 80);
	};

	ContentEditableInput.prototype.updateFromDOM = function () {
			var this$1$1 = this;

		if (this.cm.isReadOnly() || !this.pollContent())
			{ runInOp(this.cm, function () { return regChange(this$1$1.cm); }); }
	};

	ContentEditableInput.prototype.setUneditable = function (node) {
		node.contentEditable = "false";
	};

	ContentEditableInput.prototype.onKeyPress = function (e) {
		if (e.charCode == 0 || this.composing) { return }
		e.preventDefault();
		if (!this.cm.isReadOnly())
			{ operation(this.cm, applyTextInput)(this.cm, String.fromCharCode(e.charCode == null ? e.keyCode : e.charCode), 0); }
	};

	ContentEditableInput.prototype.readOnlyChanged = function (val) {
		this.div.contentEditable = String(val != "nocursor");
	};

	ContentEditableInput.prototype.onContextMenu = function () {};
	ContentEditableInput.prototype.resetPosition = function () {};

	ContentEditableInput.prototype.needsContentAttribute = true;

	function posToDOM(cm, pos) {
		var view = findViewForLine(cm, pos.line);
		if (!view || view.hidden) { return null }
		var line = getLine(cm.doc, pos.line);
		var info = mapFromLineView(view, line, pos.line);

		var order = getOrder(line, cm.doc.direction), side = "left";
		if (order) {
			var partPos = getBidiPartAt(order, pos.ch);
			side = partPos % 2 ? "right" : "left";
		}
		var result = nodeAndOffsetInLineMap(info.map, pos.ch, side);
		result.offset = result.collapse == "right" ? result.end : result.start;
		return result
	}

	function isInGutter(node) {
		for (var scan = node; scan; scan = scan.parentNode)
			{ if (/CodeMirror-gutter-wrapper/.test(scan.className)) { return true } }
		return false
	}

	function badPos(pos, bad) { if (bad) { pos.bad = true; } return pos }

	function domTextBetween(cm, from, to, fromLine, toLine) {
		var text = "", closing = false, lineSep = cm.doc.lineSeparator(), extraLinebreak = false;
		function recognizeMarker(id) { return function (marker) { return marker.id == id; } }
		function close() {
			if (closing) {
				text += lineSep;
				if (extraLinebreak) { text += lineSep; }
				closing = extraLinebreak = false;
			}
		}
		function addText(str) {
			if (str) {
				close();
				text += str;
			}
		}
		function walk(node) {
			if (node.nodeType == 1) {
				var cmText = node.getAttribute("cm-text");
				if (cmText) {
					addText(cmText);
					return
				}
				var markerID = node.getAttribute("cm-marker"), range;
				if (markerID) {
					var found = cm.findMarks(Pos(fromLine, 0), Pos(toLine + 1, 0), recognizeMarker(+markerID));
					if (found.length && (range = found[0].find(0)))
						{ addText(getBetween(cm.doc, range.from, range.to).join(lineSep)); }
					return
				}
				if (node.getAttribute("contenteditable") == "false") { return }
				var isBlock = /^(pre|div|p|li|table|br)$/i.test(node.nodeName);
				if (!/^br$/i.test(node.nodeName) && node.textContent.length == 0) { return }

				if (isBlock) { close(); }
				for (var i = 0; i < node.childNodes.length; i++)
					{ walk(node.childNodes[i]); }

				if (/^(pre|p)$/i.test(node.nodeName)) { extraLinebreak = true; }
				if (isBlock) { closing = true; }
			} else if (node.nodeType == 3) {
				addText(node.nodeValue.replace(/\u200b/g, "").replace(/\u00a0/g, " "));
			}
		}
		for (;;) {
			walk(from);
			if (from == to) { break }
			from = from.nextSibling;
			extraLinebreak = false;
		}
		return text
	}

	function domToPos(cm, node, offset) {
		var lineNode;
		if (node == cm.display.lineDiv) {
			lineNode = cm.display.lineDiv.childNodes[offset];
			if (!lineNode) { return badPos(cm.clipPos(Pos(cm.display.viewTo - 1)), true) }
			node = null; offset = 0;
		} else {
			for (lineNode = node;; lineNode = lineNode.parentNode) {
				if (!lineNode || lineNode == cm.display.lineDiv) { return null }
				if (lineNode.parentNode && lineNode.parentNode == cm.display.lineDiv) { break }
			}
		}
		for (var i = 0; i < cm.display.view.length; i++) {
			var lineView = cm.display.view[i];
			if (lineView.node == lineNode)
				{ return locateNodeInLineView(lineView, node, offset) }
		}
	}

	function locateNodeInLineView(lineView, node, offset) {
		var wrapper = lineView.text.firstChild, bad = false;
		if (!node || !contains(wrapper, node)) { return badPos(Pos(lineNo(lineView.line), 0), true) }
		if (node == wrapper) {
			bad = true;
			node = wrapper.childNodes[offset];
			offset = 0;
			if (!node) {
				var line = lineView.rest ? lst(lineView.rest) : lineView.line;
				return badPos(Pos(lineNo(line), line.text.length), bad)
			}
		}

		var textNode = node.nodeType == 3 ? node : null, topNode = node;
		if (!textNode && node.childNodes.length == 1 && node.firstChild.nodeType == 3) {
			textNode = node.firstChild;
			if (offset) { offset = textNode.nodeValue.length; }
		}
		while (topNode.parentNode != wrapper) { topNode = topNode.parentNode; }
		var measure = lineView.measure, maps = measure.maps;

		function find(textNode, topNode, offset) {
			for (var i = -1; i < (maps ? maps.length : 0); i++) {
				var map = i < 0 ? measure.map : maps[i];
				for (var j = 0; j < map.length; j += 3) {
					var curNode = map[j + 2];
					if (curNode == textNode || curNode == topNode) {
						var line = lineNo(i < 0 ? lineView.line : lineView.rest[i]);
						var ch = map[j] + offset;
						if (offset < 0 || curNode != textNode) { ch = map[j + (offset ? 1 : 0)]; }
						return Pos(line, ch)
					}
				}
			}
		}
		var found = find(textNode, topNode, offset);
		if (found) { return badPos(found, bad) }

		// FIXME this is all really shaky. might handle the few cases it needs to handle, but likely to cause problems
		for (var after = topNode.nextSibling, dist = textNode ? textNode.nodeValue.length - offset : 0; after; after = after.nextSibling) {
			found = find(after, after.firstChild, 0);
			if (found)
				{ return badPos(Pos(found.line, found.ch - dist), bad) }
			else
				{ dist += after.textContent.length; }
		}
		for (var before = topNode.previousSibling, dist$1 = offset; before; before = before.previousSibling) {
			found = find(before, before.firstChild, -1);
			if (found)
				{ return badPos(Pos(found.line, found.ch + dist$1), bad) }
			else
				{ dist$1 += before.textContent.length; }
		}
	}

	// TEXTAREA INPUT STYLE

	var TextareaInput = function(cm) {
		this.cm = cm;
		// See input.poll and input.reset
		this.prevInput = "";

		// Flag that indicates whether we expect input to appear real soon
		// now (after some event like 'keypress' or 'input') and are
		// polling intensively.
		this.pollingFast = false;
		// Self-resetting timeout for the poller
		this.polling = new Delayed();
		// Used to work around IE issue with selection being forgotten when focus moves away from textarea
		this.hasSelection = false;
		this.composing = null;
		this.resetting = false;
	};

	TextareaInput.prototype.init = function (display) {
			var this$1$1 = this;

		var input = this, cm = this.cm;
		this.createField(display);
		var te = this.textarea;

		display.wrapper.insertBefore(this.wrapper, display.wrapper.firstChild);

		// Needed to hide big blue blinking cursor on Mobile Safari (doesn't seem to work in iOS 8 anymore)
		if (ios) { te.style.width = "0px"; }

		on(te, "input", function () {
			if (ie && ie_version >= 9 && this$1$1.hasSelection) { this$1$1.hasSelection = null; }
			input.poll();
		});

		on(te, "paste", function (e) {
			if (signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }

			cm.state.pasteIncoming = +new Date;
			input.fastPoll();
		});

		function prepareCopyCut(e) {
			if (signalDOMEvent(cm, e)) { return }
			if (cm.somethingSelected()) {
				setLastCopied({lineWise: false, text: cm.getSelections()});
			} else if (!cm.options.lineWiseCopyCut) {
				return
			} else {
				var ranges = copyableRanges(cm);
				setLastCopied({lineWise: true, text: ranges.text});
				if (e.type == "cut") {
					cm.setSelections(ranges.ranges, null, sel_dontScroll);
				} else {
					input.prevInput = "";
					te.value = ranges.text.join("\n");
					selectInput(te);
				}
			}
			if (e.type == "cut") { cm.state.cutIncoming = +new Date; }
		}
		on(te, "cut", prepareCopyCut);
		on(te, "copy", prepareCopyCut);

		on(display.scroller, "paste", function (e) {
			if (eventInWidget(display, e) || signalDOMEvent(cm, e)) { return }
			if (!te.dispatchEvent) {
				cm.state.pasteIncoming = +new Date;
				input.focus();
				return
			}

			// Pass the `paste` event to the textarea so it's handled by its event listener.
			var event = new Event("paste");
			event.clipboardData = e.clipboardData;
			te.dispatchEvent(event);
		});

		// Prevent normal selection in the editor (we handle our own)
		on(display.lineSpace, "selectstart", function (e) {
			if (!eventInWidget(display, e)) { e_preventDefault(e); }
		});

		on(te, "compositionstart", function () {
			var start = cm.getCursor("from");
			if (input.composing) { input.composing.range.clear(); }
			input.composing = {
				start: start,
				range: cm.markText(start, cm.getCursor("to"), {className: "CodeMirror-composing"})
			};
		});
		on(te, "compositionend", function () {
			if (input.composing) {
				input.poll();
				input.composing.range.clear();
				input.composing = null;
			}
		});
	};

	TextareaInput.prototype.createField = function (_display) {
		// Wraps and hides input textarea
		this.wrapper = hiddenTextarea();
		// The semihidden textarea that is focused when the editor is
		// focused, and receives input.
		this.textarea = this.wrapper.firstChild;
		var opts = this.cm.options;
		disableBrowserMagic(this.textarea, opts.spellcheck, opts.autocorrect, opts.autocapitalize);
	};

	TextareaInput.prototype.screenReaderLabelChanged = function (label) {
		// Label for screenreaders, accessibility
		if(label) {
			this.textarea.setAttribute('aria-label', label);
		} else {
			this.textarea.removeAttribute('aria-label');
		}
	};

	TextareaInput.prototype.prepareSelection = function () {
		// Redraw the selection and/or cursor
		var cm = this.cm, display = cm.display, doc = cm.doc;
		var result = prepareSelection(cm);

		// Move the hidden textarea near the cursor to prevent scrolling artifacts
		if (cm.options.moveInputWithCursor) {
			var headPos = cursorCoords(cm, doc.sel.primary().head, "div");
			var wrapOff = display.wrapper.getBoundingClientRect(), lineOff = display.lineDiv.getBoundingClientRect();
			result.teTop = Math.max(0, Math.min(display.wrapper.clientHeight - 10,
																					headPos.top + lineOff.top - wrapOff.top));
			result.teLeft = Math.max(0, Math.min(display.wrapper.clientWidth - 10,
																					 headPos.left + lineOff.left - wrapOff.left));
		}

		return result
	};

	TextareaInput.prototype.showSelection = function (drawn) {
		var cm = this.cm, display = cm.display;
		removeChildrenAndAdd(display.cursorDiv, drawn.cursors);
		removeChildrenAndAdd(display.selectionDiv, drawn.selection);
		if (drawn.teTop != null) {
			this.wrapper.style.top = drawn.teTop + "px";
			this.wrapper.style.left = drawn.teLeft + "px";
		}
	};

	// Reset the input to correspond to the selection (or to be empty,
	// when not typing and nothing is selected)
	TextareaInput.prototype.reset = function (typing) {
		if (this.contextMenuPending || this.composing && typing) { return }
		var cm = this.cm;
		this.resetting = true;
		if (cm.somethingSelected()) {
			this.prevInput = "";
			var content = cm.getSelection();
			this.textarea.value = content;
			if (cm.state.focused) { selectInput(this.textarea); }
			if (ie && ie_version >= 9) { this.hasSelection = content; }
		} else if (!typing) {
			this.prevInput = this.textarea.value = "";
			if (ie && ie_version >= 9) { this.hasSelection = null; }
		}
		this.resetting = false;
	};

	TextareaInput.prototype.getField = function () { return this.textarea };

	TextareaInput.prototype.supportsTouch = function () { return false };

	TextareaInput.prototype.focus = function () {
		if (this.cm.options.readOnly != "nocursor" && (!mobile || activeElt(rootNode(this.textarea)) != this.textarea)) {
			try { this.textarea.focus(); }
			catch (e) {} // IE8 will throw if the textarea is display: none or not in DOM
		}
	};

	TextareaInput.prototype.blur = function () { this.textarea.blur(); };

	TextareaInput.prototype.resetPosition = function () {
		this.wrapper.style.top = this.wrapper.style.left = 0;
	};

	TextareaInput.prototype.receivedFocus = function () { this.slowPoll(); };

	// Poll for input changes, using the normal rate of polling. This
	// runs as long as the editor is focused.
	TextareaInput.prototype.slowPoll = function () {
			var this$1$1 = this;

		if (this.pollingFast) { return }
		this.polling.set(this.cm.options.pollInterval, function () {
			this$1$1.poll();
			if (this$1$1.cm.state.focused) { this$1$1.slowPoll(); }
		});
	};

	// When an event has just come in that is likely to add or change
	// something in the input textarea, we poll faster, to ensure that
	// the change appears on the screen quickly.
	TextareaInput.prototype.fastPoll = function () {
		var missed = false, input = this;
		input.pollingFast = true;
		function p() {
			var changed = input.poll();
			if (!changed && !missed) {missed = true; input.polling.set(60, p);}
			else {input.pollingFast = false; input.slowPoll();}
		}
		input.polling.set(20, p);
	};

	// Read input from the textarea, and update the document to match.
	// When something is selected, it is present in the textarea, and
	// selected (unless it is huge, in which case a placeholder is
	// used). When nothing is selected, the cursor sits after previously
	// seen text (can be empty), which is stored in prevInput (we must
	// not reset the textarea when typing, because that breaks IME).
	TextareaInput.prototype.poll = function () {
			var this$1$1 = this;

		var cm = this.cm, input = this.textarea, prevInput = this.prevInput;
		// Since this is called a *lot*, try to bail out as cheaply as
		// possible when it is clear that nothing happened. hasSelection
		// will be the case when there is a lot of text in the textarea,
		// in which case reading its value would be expensive.
		if (this.contextMenuPending || this.resetting || !cm.state.focused ||
				(hasSelection(input) && !prevInput && !this.composing) ||
				cm.isReadOnly() || cm.options.disableInput || cm.state.keySeq)
			{ return false }

		var text = input.value;
		// If nothing changed, bail.
		if (text == prevInput && !cm.somethingSelected()) { return false }
		// Work around nonsensical selection resetting in IE9/10, and
		// inexplicable appearance of private area unicode characters on
		// some key combos in Mac (#2689).
		if (ie && ie_version >= 9 && this.hasSelection === text ||
				mac && /[\uf700-\uf7ff]/.test(text)) {
			cm.display.input.reset();
			return false
		}

		if (cm.doc.sel == cm.display.selForContextMenu) {
			var first = text.charCodeAt(0);
			if (first == 0x200b && !prevInput) { prevInput = "\u200b"; }
			if (first == 0x21da) { this.reset(); return this.cm.execCommand("undo") }
		}
		// Find the part of the input that is actually new
		var same = 0, l = Math.min(prevInput.length, text.length);
		while (same < l && prevInput.charCodeAt(same) == text.charCodeAt(same)) { ++same; }

		runInOp(cm, function () {
			applyTextInput(cm, text.slice(same), prevInput.length - same,
										 null, this$1$1.composing ? "*compose" : null);

			// Don't leave long text in the textarea, since it makes further polling slow
			if (text.length > 1000 || text.indexOf("\n") > -1) { input.value = this$1$1.prevInput = ""; }
			else { this$1$1.prevInput = text; }

			if (this$1$1.composing) {
				this$1$1.composing.range.clear();
				this$1$1.composing.range = cm.markText(this$1$1.composing.start, cm.getCursor("to"),
																					 {className: "CodeMirror-composing"});
			}
		});
		return true
	};

	TextareaInput.prototype.ensurePolled = function () {
		if (this.pollingFast && this.poll()) { this.pollingFast = false; }
	};

	TextareaInput.prototype.onKeyPress = function () {
		if (ie && ie_version >= 9) { this.hasSelection = null; }
		this.fastPoll();
	};

	TextareaInput.prototype.onContextMenu = function (e) {
		var input = this, cm = input.cm, display = cm.display, te = input.textarea;
		if (input.contextMenuPending) { input.contextMenuPending(); }
		var pos = posFromMouse(cm, e), scrollPos = display.scroller.scrollTop;
		if (!pos || presto) { return } // Opera is difficult.

		// Reset the current text selection only if the click is done outside of the selection
		// and 'resetSelectionOnContextMenu' option is true.
		var reset = cm.options.resetSelectionOnContextMenu;
		if (reset && cm.doc.sel.contains(pos) == -1)
			{ operation(cm, setSelection)(cm.doc, simpleSelection(pos), sel_dontScroll); }

		var oldCSS = te.style.cssText, oldWrapperCSS = input.wrapper.style.cssText;
		var wrapperBox = input.wrapper.offsetParent.getBoundingClientRect();
		input.wrapper.style.cssText = "position: static";
		te.style.cssText = "position: absolute; width: 30px; height: 30px;\n      top: " + (e.clientY - wrapperBox.top - 5) + "px; left: " + (e.clientX - wrapperBox.left - 5) + "px;\n      z-index: 1000; background: " + (ie ? "rgba(255, 255, 255, .05)" : "transparent") + ";\n      outline: none; border-width: 0; outline: none; overflow: hidden; opacity: .05; filter: alpha(opacity=5);";
		var oldScrollY;
		if (webkit) { oldScrollY = te.ownerDocument.defaultView.scrollY; } // Work around Chrome issue (#2712)
		display.input.focus();
		if (webkit) { te.ownerDocument.defaultView.scrollTo(null, oldScrollY); }
		display.input.reset();
		// Adds "Select all" to context menu in FF
		if (!cm.somethingSelected()) { te.value = input.prevInput = " "; }
		input.contextMenuPending = rehide;
		display.selForContextMenu = cm.doc.sel;
		clearTimeout(display.detectingSelectAll);

		// Select-all will be greyed out if there's nothing to select, so
		// this adds a zero-width space so that we can later check whether
		// it got selected.
		function prepareSelectAllHack() {
			if (te.selectionStart != null) {
				var selected = cm.somethingSelected();
				var extval = "\u200b" + (selected ? te.value : "");
				te.value = "\u21da"; // Used to catch context-menu undo
				te.value = extval;
				input.prevInput = selected ? "" : "\u200b";
				te.selectionStart = 1; te.selectionEnd = extval.length;
				// Re-set this, in case some other handler touched the
				// selection in the meantime.
				display.selForContextMenu = cm.doc.sel;
			}
		}
		function rehide() {
			if (input.contextMenuPending != rehide) { return }
			input.contextMenuPending = false;
			input.wrapper.style.cssText = oldWrapperCSS;
			te.style.cssText = oldCSS;
			if (ie && ie_version < 9) { display.scrollbars.setScrollTop(display.scroller.scrollTop = scrollPos); }

			// Try to detect the user choosing select-all
			if (te.selectionStart != null) {
				if (!ie || (ie && ie_version < 9)) { prepareSelectAllHack(); }
				var i = 0, poll = function () {
					if (display.selForContextMenu == cm.doc.sel && te.selectionStart == 0 &&
							te.selectionEnd > 0 && input.prevInput == "\u200b") {
						operation(cm, selectAll)(cm);
					} else if (i++ < 10) {
						display.detectingSelectAll = setTimeout(poll, 500);
					} else {
						display.selForContextMenu = null;
						display.input.reset();
					}
				};
				display.detectingSelectAll = setTimeout(poll, 200);
			}
		}

		if (ie && ie_version >= 9) { prepareSelectAllHack(); }
		if (captureRightClick) {
			e_stop(e);
			var mouseup = function () {
				off(window, "mouseup", mouseup);
				setTimeout(rehide, 20);
			};
			on(window, "mouseup", mouseup);
		} else {
			setTimeout(rehide, 50);
		}
	};

	TextareaInput.prototype.readOnlyChanged = function (val) {
		if (!val) { this.reset(); }
		this.textarea.disabled = val == "nocursor";
		this.textarea.readOnly = !!val;
	};

	TextareaInput.prototype.setUneditable = function () {};

	TextareaInput.prototype.needsContentAttribute = false;

	function fromTextArea(textarea, options) {
		options = options ? copyObj(options) : {};
		options.value = textarea.value;
		if (!options.tabindex && textarea.tabIndex)
			{ options.tabindex = textarea.tabIndex; }
		if (!options.placeholder && textarea.placeholder)
			{ options.placeholder = textarea.placeholder; }
		// Set autofocus to true if this textarea is focused, or if it has
		// autofocus and no other element is focused.
		if (options.autofocus == null) {
			var hasFocus = activeElt(rootNode(textarea));
			options.autofocus = hasFocus == textarea ||
				textarea.getAttribute("autofocus") != null && hasFocus == document.body;
		}

		function save() {textarea.value = cm.getValue();}

		var realSubmit;
		if (textarea.form) {
			on(textarea.form, "submit", save);
			// Deplorable hack to make the submit method do the right thing.
			if (!options.leaveSubmitMethodAlone) {
				var form = textarea.form;
				realSubmit = form.submit;
				try {
					var wrappedSubmit = form.submit = function () {
						save();
						form.submit = realSubmit;
						form.submit();
						form.submit = wrappedSubmit;
					};
				} catch(e) {}
			}
		}

		options.finishInit = function (cm) {
			cm.save = save;
			cm.getTextArea = function () { return textarea; };
			cm.toTextArea = function () {
				cm.toTextArea = isNaN; // Prevent this from being ran twice
				save();
				textarea.parentNode.removeChild(cm.getWrapperElement());
				textarea.style.display = "";
				if (textarea.form) {
					off(textarea.form, "submit", save);
					if (!options.leaveSubmitMethodAlone && typeof textarea.form.submit == "function")
						{ textarea.form.submit = realSubmit; }
				}
			};
		};

		textarea.style.display = "none";
		var cm = CodeMirror(function (node) { return textarea.parentNode.insertBefore(node, textarea.nextSibling); },
			options);
		return cm
	}

	function addLegacyProps(CodeMirror) {
		CodeMirror.off = off;
		CodeMirror.on = on;
		CodeMirror.wheelEventPixels = wheelEventPixels;
		CodeMirror.Doc = Doc;
		CodeMirror.splitLines = splitLinesAuto;
		CodeMirror.countColumn = countColumn;
		CodeMirror.findColumn = findColumn;
		CodeMirror.isWordChar = isWordCharBasic;
		CodeMirror.Pass = Pass;
		CodeMirror.signal = signal;
		CodeMirror.Line = Line;
		CodeMirror.changeEnd = changeEnd;
		CodeMirror.scrollbarModel = scrollbarModel;
		CodeMirror.Pos = Pos;
		CodeMirror.cmpPos = cmp;
		CodeMirror.modes = modes;
		CodeMirror.mimeModes = mimeModes;
		CodeMirror.resolveMode = resolveMode;
		CodeMirror.getMode = getMode;
		CodeMirror.modeExtensions = modeExtensions;
		CodeMirror.extendMode = extendMode;
		CodeMirror.copyState = copyState;
		CodeMirror.startState = startState;
		CodeMirror.innerMode = innerMode;
		CodeMirror.commands = commands;
		CodeMirror.keyMap = keyMap;
		CodeMirror.keyName = keyName;
		CodeMirror.isModifierKey = isModifierKey;
		CodeMirror.lookupKey = lookupKey;
		CodeMirror.normalizeKeyMap = normalizeKeyMap;
		CodeMirror.StringStream = StringStream;
		CodeMirror.SharedTextMarker = SharedTextMarker;
		CodeMirror.TextMarker = TextMarker;
		CodeMirror.LineWidget = LineWidget;
		CodeMirror.e_preventDefault = e_preventDefault;
		CodeMirror.e_stopPropagation = e_stopPropagation;
		CodeMirror.e_stop = e_stop;
		CodeMirror.addClass = addClass;
		CodeMirror.contains = contains;
		CodeMirror.rmClass = rmClass;
		CodeMirror.keyNames = keyNames;
	}

	// EDITOR CONSTRUCTOR

	defineOptions(CodeMirror);

	addEditorMethods(CodeMirror);

	// Set up methods on CodeMirror's prototype to redirect to the editor's document.
	var dontDelegate = "iter insert remove copy getEditor constructor".split(" ");
	for (var prop in Doc.prototype) { if (Doc.prototype.hasOwnProperty(prop) && indexOf(dontDelegate, prop) < 0)
		{ CodeMirror.prototype[prop] = (function(method) {
			return function() {return method.apply(this.doc, arguments)}
		})(Doc.prototype[prop]); } }

	eventMixin(Doc);
	CodeMirror.inputStyles = {"textarea": TextareaInput, "contenteditable": ContentEditableInput};

	// Extra arguments are stored as the mode's dependencies, which is
	// used by (legacy) mechanisms like loadmode.js to automatically
	// load a mode. (Preferred mechanism is the require/define calls.)
	CodeMirror.defineMode = function(name/*, mode, …*/) {
		if (!CodeMirror.defaults.mode && name != "null") { CodeMirror.defaults.mode = name; }
		defineMode.apply(this, arguments);
	};

	CodeMirror.defineMIME = defineMIME;

	// Minimal default mode.
	CodeMirror.defineMode("null", function () { return ({token: function (stream) { return stream.skipToEnd(); }}); });
	CodeMirror.defineMIME("text/plain", "null");

	// EXTENSIONS

	CodeMirror.defineExtension = function (name, func) {
		CodeMirror.prototype[name] = func;
	};
	CodeMirror.defineDocExtension = function (name, func) {
		Doc.prototype[name] = func;
	};

	CodeMirror.fromTextArea = fromTextArea;

	addLegacyProps(CodeMirror);

	CodeMirror.version = "5.65.17";

	return CodeMirror;

})(window);

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

(function() {
	"use strict";

	function Bar(cls, orientation, scroll) {
		this.orientation = orientation;
		this.scroll = scroll;
		this.screen =
		this.total =
		this.size = 1;
		this.pos = 0;

		this.node = document.createElement("div");
		this.node.className = cls + "-" + orientation;
		this.inner = this.node.appendChild(document.createElement("div"));

		var self = this;
		CodeMirror.on(this.inner, "mousedown", function(e) {
			if (e.which != 1) return;
			CodeMirror.e_preventDefault(e);
			var axis = self.orientation == "horizontal" ? "pageX" : "pageY";
			var start = e[axis], startpos = self.pos;
			function done() {
				CodeMirror.off(document, "mousemove", move);
				CodeMirror.off(document, "mouseup", done);
			}
			function move(e) {
				if (e.which != 1) return done();
				self.moveTo(startpos + (e[axis] - start) * (self.total / self.size));
			}
			CodeMirror.on(document, "mousemove", move);
			CodeMirror.on(document, "mouseup", done);
		});

		CodeMirror.on(this.node, "click", function(e) {
			CodeMirror.e_preventDefault(e);
			var innerBox = self.inner.getBoundingClientRect(), where;
			if (self.orientation == "horizontal")
				where = e.clientX < innerBox.left ? -1 : e.clientX > innerBox.right ? 1 : 0;
			else
				where = e.clientY < innerBox.top ? -1 : e.clientY > innerBox.bottom ? 1 : 0;
			self.moveTo(self.pos + where * self.screen);
		});

		function onWheel(e) {
			var moved = CodeMirror.wheelEventPixels(e)[self.orientation == "horizontal" ? "x" : "y"];
			var oldPos = self.pos;
			self.moveTo(self.pos + moved);
			if (self.pos != oldPos) CodeMirror.e_preventDefault(e);
		}
		CodeMirror.on(this.node, "mousewheel", onWheel);
		CodeMirror.on(this.node, "DOMMouseScroll", onWheel);
	}

	Bar.prototype.setPos = function(pos, force) {
		if (pos < 0) pos = 0;
		if (pos > this.total - this.screen) pos = this.total - this.screen;
		if (!force && pos == this.pos) return false;
		this.pos = pos;
		this.inner.style[this.orientation == "horizontal" ? "left" : "top"] =
			(pos * (this.size / this.total)) + "px";
		return true
	};

	Bar.prototype.moveTo = function(pos) {
		if (this.setPos(pos)) this.scroll(pos, this.orientation);
	};

	var minButtonSize = 10;

	Bar.prototype.update = function(scrollSize, clientSize, barSize) {
		var sizeChanged = this.screen != clientSize || this.total != scrollSize || this.size != barSize;
		if (sizeChanged) {
			this.screen = clientSize;
			this.total = scrollSize;
			this.size = barSize;
		}

		var buttonSize = this.screen * (this.size / this.total);
		if (buttonSize < minButtonSize) {
			this.size -= minButtonSize - buttonSize;
			buttonSize = minButtonSize;
		}
		this.inner.style[this.orientation == "horizontal" ? "width" : "height"] =
			buttonSize + "px";
		this.setPos(this.pos, sizeChanged);
	};

	function SimpleScrollbars(cls, place, scroll) {
		this.addClass = cls;
		this.horiz = new Bar(cls, "horizontal", scroll);
		place(this.horiz.node);
		this.vert = new Bar(cls, "vertical", scroll);
		place(this.vert.node);
		this.width = null;
	}

	SimpleScrollbars.prototype.update = function(measure) {
		if (this.width == null) {
			var style = window.getComputedStyle ? window.getComputedStyle(this.horiz.node) : this.horiz.node.currentStyle;
			if (style) this.width = parseInt(style.height);
		}
		var width = this.width || 0;

		var needsH = measure.scrollWidth > measure.clientWidth + 1;
		var needsV = measure.scrollHeight > measure.clientHeight + 1;
		this.vert.node.style.display = needsV ? "block" : "none";
		this.horiz.node.style.display = needsH ? "block" : "none";

		if (needsV) {
			this.vert.update(measure.scrollHeight, measure.clientHeight,
											 measure.viewHeight - (needsH ? width : 0));
			this.vert.node.style.bottom = needsH ? width + "px" : "0";
		}
		if (needsH) {
			this.horiz.update(measure.scrollWidth, measure.clientWidth,
												measure.viewWidth - (needsV ? width : 0) - measure.barLeft);
			this.horiz.node.style.right = needsV ? width + "px" : "0";
			this.horiz.node.style.left = measure.barLeft + "px";
		}

		return {right: needsV ? width : 0, bottom: needsH ? width : 0};
	};

	SimpleScrollbars.prototype.setScrollTop = function(pos) {
		this.vert.setPos(pos);
	};

	SimpleScrollbars.prototype.setScrollLeft = function(pos) {
		this.horiz.setPos(pos);
	};

	SimpleScrollbars.prototype.clear = function() {
		var parent = this.horiz.node.parentNode;
		parent.removeChild(this.horiz.node);
		parent.removeChild(this.vert.node);
	};

	CodeMirror.scrollbarModel.simple = function(place, scroll) {
		return new SimpleScrollbars("CodeMirror-simplescroll", place, scroll);
	};
	CodeMirror.scrollbarModel.overlay = function(place, scroll) {
		return new SimpleScrollbars("CodeMirror-overlayscroll", place, scroll);
	};
})();

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

(function() {

	var ie_lt8 = /MSIE \d/.test(navigator.userAgent) &&
		(document.documentMode == null || document.documentMode < 8);

	var Pos = CodeMirror.Pos;

	var matching = {"(": ")>", ")": "(<", "[": "]>", "]": "[<", "{": "}>", "}": "{<", "<": ">>", ">": "<<"};

	function bracketRegex(config) {
		return config && config.bracketRegex || /[(){}[\]]/
	}

	function findMatchingBracket(cm, where, config) {
		var line = cm.getLineHandle(where.line), pos = where.ch - 1;
		var afterCursor = config && config.afterCursor;
		if (afterCursor == null)
			afterCursor = /(^| )cm-fat-cursor($| )/.test(cm.getWrapperElement().className);
		var re = bracketRegex(config);

		// A cursor is defined as between two characters, but in in vim command mode
		// (i.e. not insert mode), the cursor is visually represented as a
		// highlighted box on top of the 2nd character. Otherwise, we allow matches
		// from before or after the cursor.
		var match = (!afterCursor && pos >= 0 && re.test(line.text.charAt(pos)) && matching[line.text.charAt(pos)]) ||
				re.test(line.text.charAt(pos + 1)) && matching[line.text.charAt(++pos)];
		if (!match) return null;
		var dir = match.charAt(1) == ">" ? 1 : -1;
		if (config && config.strict && (dir > 0) != (pos == where.ch)) return null;
		var style = cm.getTokenTypeAt(Pos(where.line, pos + 1));

		var found = scanForBracket(cm, Pos(where.line, pos + (dir > 0 ? 1 : 0)), dir, style, config);
		if (found == null) return null;
		return {from: Pos(where.line, pos), to: found && found.pos,
						match: found && found.ch == match.charAt(0), forward: dir > 0};
	}

	// bracketRegex is used to specify which type of bracket to scan
	// should be a regexp, e.g. /[[\]]/
	//
	// Note: If "where" is on an open bracket, then this bracket is ignored.
	//
	// Returns false when no bracket was found, null when it reached
	// maxScanLines and gave up
	function scanForBracket(cm, where, dir, style, config) {
		var maxScanLen = (config && config.maxScanLineLength) || 10000;
		var maxScanLines = (config && config.maxScanLines) || 1000;

		var stack = [];
		var re = bracketRegex(config);
		var lineEnd = dir > 0 ? Math.min(where.line + maxScanLines, cm.lastLine() + 1)
													: Math.max(cm.firstLine() - 1, where.line - maxScanLines);
		for (var lineNo = where.line; lineNo != lineEnd; lineNo += dir) {
			var line = cm.getLine(lineNo);
			if (!line) continue;
			var pos = dir > 0 ? 0 : line.length - 1, end = dir > 0 ? line.length : -1;
			if (line.length > maxScanLen) continue;
			if (lineNo == where.line) pos = where.ch - (dir < 0 ? 1 : 0);
			for (; pos != end; pos += dir) {
				var ch = line.charAt(pos);
				if (re.test(ch) && (style === undefined ||
														(cm.getTokenTypeAt(Pos(lineNo, pos + 1)) || "") == (style || ""))) {
					var match = matching[ch];
					if (match && (match.charAt(1) == ">") == (dir > 0)) stack.push(ch);
					else if (!stack.length) return {pos: Pos(lineNo, pos), ch: ch};
					else stack.pop();
				}
			}
		}
		return lineNo - dir == (dir > 0 ? cm.lastLine() : cm.firstLine()) ? false : null;
	}

	function matchBrackets(cm, autoclear, config) {
		// Disable brace matching in long lines, since it'll cause hugely slow updates
		var maxHighlightLen = cm.state.matchBrackets.maxHighlightLineLength || 1000,
			highlightNonMatching = config && config.highlightNonMatching;
		var marks = [], ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
			var match = ranges[i].empty() && findMatchingBracket(cm, ranges[i].head, config);
			if (match && (match.match || highlightNonMatching !== false) && cm.getLine(match.from.line).length <= maxHighlightLen) {
				var style = match.match ? "CodeMirror-matchingbracket" : "CodeMirror-nonmatchingbracket";
				marks.push(cm.markText(match.from, Pos(match.from.line, match.from.ch + 1), {className: style}));
				if (match.to && cm.getLine(match.to.line).length <= maxHighlightLen)
					marks.push(cm.markText(match.to, Pos(match.to.line, match.to.ch + 1), {className: style}));
			}
		}

		if (marks.length) {
			// Kludge to work around the IE bug from issue #1193, where text
			// input stops going to the textarea whenever this fires.
			if (ie_lt8 && cm.state.focused) cm.focus();

			var clear = function() {
				cm.operation(function() {
					for (var i = 0; i < marks.length; i++) marks[i].clear();
				});
			};
			if (autoclear) setTimeout(clear, 800);
			else return clear;
		}
	}

	function doMatchBrackets(cm) {
		cm.operation(function() {
			if (cm.state.matchBrackets.currentlyHighlighted) {
				cm.state.matchBrackets.currentlyHighlighted();
				cm.state.matchBrackets.currentlyHighlighted = null;
			}
			cm.state.matchBrackets.currentlyHighlighted = matchBrackets(cm, false, cm.state.matchBrackets);
		});
	}

	function clearHighlighted(cm) {
		if (cm.state.matchBrackets && cm.state.matchBrackets.currentlyHighlighted) {
			cm.state.matchBrackets.currentlyHighlighted();
			cm.state.matchBrackets.currentlyHighlighted = null;
		}
	}

	CodeMirror.defineOption("matchBrackets", false, function(cm, val, old) {
		if (old && old != CodeMirror.Init) {
			cm.off("cursorActivity", doMatchBrackets);
			cm.off("focus", doMatchBrackets);
			cm.off("blur", clearHighlighted);
			clearHighlighted(cm);
		}
		if (val) {
			cm.state.matchBrackets = typeof val == "object" ? val : {};
			cm.on("cursorActivity", doMatchBrackets);
			cm.on("focus", doMatchBrackets);
			cm.on("blur", clearHighlighted);
		}
	});

	CodeMirror.defineExtension("matchBrackets", function() {matchBrackets(this, true);});
	CodeMirror.defineExtension("findMatchingBracket", function(pos, config, oldConfig){
		// Backwards-compatibility kludge
		if (oldConfig || typeof config == "boolean") {
			if (!oldConfig) {
				config = config ? {strict: true} : null;
			} else {
				oldConfig.strict = config;
				config = oldConfig;
			}
		}
		return findMatchingBracket(this, pos, config)
	});
	CodeMirror.defineExtension("scanForBracket", function(pos, dir, style, config){
		return scanForBracket(this, pos, dir, style, config);
	});
})();

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

// declare global: DOMRect

(function() {
"use strict";

	var HINT_ELEMENT_CLASS        = "CodeMirror-hint";
	var ACTIVE_HINT_ELEMENT_CLASS = "CodeMirror-hint-active";

	// This is the old interface, kept around for now to stay
	// backwards-compatible.
	CodeMirror.showHint = function(cm, getHints, options) {
		if (!getHints) return cm.showHint(options);
		if (options && options.async) getHints.async = true;
		var newOpts = {hint: getHints};
		if (options) for (var prop in options) newOpts[prop] = options[prop];
		return cm.showHint(newOpts);
	};

	CodeMirror.defineExtension("showHint", function(options) {
		options = parseOptions(this, this.getCursor("start"), options);
		var selections = this.listSelections();
		if (selections.length > 1) return;
		// By default, don't allow completion when something is selected.
		// A hint function can have a `supportsSelection` property to
		// indicate that it can handle selections.
		if (this.somethingSelected()) {
			if (!options.hint.supportsSelection) return;
			// Don't try with cross-line selections
			for (var i = 0; i < selections.length; i++)
				if (selections[i].head.line != selections[i].anchor.line) return;
		}

		if (this.state.completionActive) this.state.completionActive.close();
		var completion = this.state.completionActive = new Completion(this, options);
		if (!completion.options.hint) return;

		CodeMirror.signal(this, "startCompletion", this);
		completion.update(true);
	});

	CodeMirror.defineExtension("closeHint", function() {
		if (this.state.completionActive) this.state.completionActive.close();
	});

	function Completion(cm, options) {
		this.cm = cm;
		this.options = options;
		this.widget = null;
		this.debounce = 0;
		this.tick = 0;
		this.startPos = this.cm.getCursor("start");
		this.startLen = this.cm.getLine(this.startPos.line).length - this.cm.getSelection().length;

		if (this.options.updateOnCursorActivity) {
			var self = this;
			cm.on("cursorActivity", this.activityFunc = function() { self.cursorActivity(); });
		}
	}

	var requestAnimationFrame = window.requestAnimationFrame || function(fn) {
		return setTimeout(fn, 1000/60);
	};
	var cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;

	Completion.prototype = {
		close: function() {
			if (!this.active()) return;
			this.cm.state.completionActive = null;
			this.tick = null;
			if (this.options.updateOnCursorActivity) {
				this.cm.off("cursorActivity", this.activityFunc);
			}

			if (this.widget && this.data) CodeMirror.signal(this.data, "close");
			if (this.widget) this.widget.close();
			CodeMirror.signal(this.cm, "endCompletion", this.cm);
		},

		active: function() {
			return this.cm.state.completionActive == this;
		},

		pick: function(data, i) {
			var completion = data.list[i], self = this;
			this.cm.operation(function() {
				if (completion.hint)
					completion.hint(self.cm, data, completion);
				else
					self.cm.replaceRange(getText(completion), completion.from || data.from,
															 completion.to || data.to, "complete");
				CodeMirror.signal(data, "pick", completion);
				self.cm.scrollIntoView();
			});
			if (this.options.closeOnPick) {
				this.close();
			}
		},

		cursorActivity: function() {
			if (this.debounce) {
				cancelAnimationFrame(this.debounce);
				this.debounce = 0;
			}

			var identStart = this.startPos;
			if(this.data) {
				identStart = this.data.from;
			}

			var pos = this.cm.getCursor(), line = this.cm.getLine(pos.line);
			if (pos.line != this.startPos.line || line.length - pos.ch != this.startLen - this.startPos.ch ||
					pos.ch < identStart.ch || this.cm.somethingSelected() ||
					(!pos.ch || this.options.closeCharacters.test(line.charAt(pos.ch - 1)))) {
				this.close();
			} else {
				var self = this;
				this.debounce = requestAnimationFrame(function() {self.update();});
				if (this.widget) this.widget.disable();
			}
		},

		update: function(first) {
			if (this.tick == null) return
			var self = this, myTick = ++this.tick;
			fetchHints(this.options.hint, this.cm, this.options, function(data) {
				if (self.tick == myTick) self.finishUpdate(data, first);
			});
		},

		finishUpdate: function(data, first) {
			if (this.data) CodeMirror.signal(this.data, "update");

			var picked = (this.widget && this.widget.picked) || (first && this.options.completeSingle);
			if (this.widget) this.widget.close();

			this.data = data;

			if (data && data.list.length) {
				if (picked && data.list.length == 1) {
					this.pick(data, 0);
				} else {
					this.widget = new Widget(this, data);
					CodeMirror.signal(data, "shown");
				}
			}
		}
	};

	function parseOptions(cm, pos, options) {
		var editor = cm.options.hintOptions;
		var out = {};
		for (var prop in defaultOptions) out[prop] = defaultOptions[prop];
		if (editor) for (var prop in editor)
			if (editor[prop] !== undefined) out[prop] = editor[prop];
		if (options) for (var prop in options)
			if (options[prop] !== undefined) out[prop] = options[prop];
		if (out.hint.resolve) out.hint = out.hint.resolve(cm, pos);
		return out;
	}

	function getText(completion) {
		if (typeof completion == "string") return completion;
		else return completion.text;
	}

	function buildKeyMap(completion, handle) {
		var baseMap = {
			Up: function() {handle.moveFocus(-1);},
			Down: function() {handle.moveFocus(1);},
			PageUp: function() {handle.moveFocus(-handle.menuSize() + 1, true);},
			PageDown: function() {handle.moveFocus(handle.menuSize() - 1, true);},
			Home: function() {handle.setFocus(0);},
			End: function() {handle.setFocus(handle.length - 1);},
			Enter: handle.pick,
			Tab: handle.pick,
			Esc: handle.close
		};

		var mac = /Mac/.test(navigator.platform);

		if (mac) {
			baseMap["Ctrl-P"] = function() {handle.moveFocus(-1);};
			baseMap["Ctrl-N"] = function() {handle.moveFocus(1);};
		}

		var custom = completion.options.customKeys;
		var ourMap = custom ? {} : baseMap;
		function addBinding(key, val) {
			var bound;
			if (typeof val != "string")
				bound = function(cm) { return val(cm, handle); };
			// This mechanism is deprecated
			else if (baseMap.hasOwnProperty(val))
				bound = baseMap[val];
			else
				bound = val;
			ourMap[key] = bound;
		}
		if (custom)
			for (var key in custom) if (custom.hasOwnProperty(key))
				addBinding(key, custom[key]);
		var extra = completion.options.extraKeys;
		if (extra)
			for (var key in extra) if (extra.hasOwnProperty(key))
				addBinding(key, extra[key]);
		return ourMap;
	}

	function getHintElement(hintsElement, el) {
		while (el && el != hintsElement) {
			if (el.nodeName.toUpperCase() === "LI" && el.parentNode == hintsElement) return el;
			el = el.parentNode;
		}
	}

	function Widget(completion, data) {
		this.id = "cm-complete-" + Math.floor(Math.random(1e6));
		this.completion = completion;
		this.data = data;
		this.picked = false;
		var widget = this, cm = completion.cm;
		var ownerDocument = cm.getInputField().ownerDocument;
		var parentWindow = ownerDocument.defaultView || ownerDocument.parentWindow;

		var hints = this.hints = ownerDocument.createElement("ul");
		hints.setAttribute("role", "listbox");
		hints.setAttribute("aria-expanded", "true");
		hints.id = this.id;
		var theme = completion.cm.options.theme;
		hints.className = "CodeMirror-hints " + theme;
		this.selectedHint = data.selectedHint || 0;

		var completions = data.list;
		for (var i = 0; i < completions.length; ++i) {
			var elt = hints.appendChild(ownerDocument.createElement("li")), cur = completions[i];
			var className = HINT_ELEMENT_CLASS + (i != this.selectedHint ? "" : " " + ACTIVE_HINT_ELEMENT_CLASS);
			if (cur.className != null) className = cur.className + " " + className;
			elt.className = className;
			if (i == this.selectedHint) elt.setAttribute("aria-selected", "true");
			elt.id = this.id + "-" + i;
			elt.setAttribute("role", "option");
			if (cur.render) cur.render(elt, data, cur);
			else elt.appendChild(ownerDocument.createTextNode(cur.displayText || getText(cur)));
			elt.hintId = i;
		}

		var container = completion.options.container || ownerDocument.body;
		var pos = cm.cursorCoords(completion.options.alignWithWord ? data.from : null);
		var left = pos.left, top = pos.bottom, below = true;
		var offsetLeft = 0, offsetTop = 0;
		if (container !== ownerDocument.body) {
			// We offset the cursor position because left and top are relative to the offsetParent's top left corner.
			var isContainerPositioned = ['absolute', 'relative', 'fixed'].indexOf(parentWindow.getComputedStyle(container).position) !== -1;
			var offsetParent = isContainerPositioned ? container : container.offsetParent;
			var offsetParentPosition = offsetParent.getBoundingClientRect();
			var bodyPosition = ownerDocument.body.getBoundingClientRect();
			offsetLeft = (offsetParentPosition.left - bodyPosition.left - offsetParent.scrollLeft);
			offsetTop = (offsetParentPosition.top - bodyPosition.top - offsetParent.scrollTop);
		}
		hints.style.left = (left - offsetLeft) + "px";
		hints.style.top = (top - offsetTop) + "px";

		// If we're at the edge of the screen, then we want the menu to appear on the left of the cursor.
		var winW = parentWindow.innerWidth || Math.max(ownerDocument.body.offsetWidth, ownerDocument.documentElement.offsetWidth);
		var winH = parentWindow.innerHeight || Math.max(ownerDocument.body.offsetHeight, ownerDocument.documentElement.offsetHeight);
		container.appendChild(hints);
		cm.getInputField().setAttribute("aria-autocomplete", "list");
		cm.getInputField().setAttribute("aria-owns", this.id);
		cm.getInputField().setAttribute("aria-activedescendant", this.id + "-" + this.selectedHint);

		var box = completion.options.moveOnOverlap ? hints.getBoundingClientRect() : new DOMRect();
		var scrolls = completion.options.paddingForScrollbar ? hints.scrollHeight > hints.clientHeight + 1 : false;

		// Compute in the timeout to avoid reflow on init
		var startScroll;
		setTimeout(function() { startScroll = cm.getScrollInfo(); });

		var overlapY = box.bottom - winH;
		if (overlapY > 0) { // Does not fit below
			var height = box.bottom - box.top, spaceAbove = box.top - (pos.bottom - pos.top) - 2;
			if (winH - box.top < spaceAbove) { // More room at the top
				if (height > spaceAbove) hints.style.height = (height = spaceAbove) + "px";
				hints.style.top = ((top = pos.top - height) + offsetTop) + "px";
				below = false;
			} else {
				hints.style.height = (winH - box.top - 2) + "px";
			}
		}
		var overlapX = box.right - winW;
		if (scrolls) overlapX += cm.display.nativeBarWidth;
		if (overlapX > 0) {
			if (box.right - box.left > winW) {
				hints.style.width = (winW - 5) + "px";
				overlapX -= (box.right - box.left) - winW;
			}
			hints.style.left = (left = Math.max(pos.left - overlapX - offsetLeft, 0)) + "px";
		}
		if (scrolls) for (var node = hints.firstChild; node; node = node.nextSibling)
			node.style.paddingRight = cm.display.nativeBarWidth + "px";

		cm.addKeyMap(this.keyMap = buildKeyMap(completion, {
			moveFocus: function(n, avoidWrap) { widget.changeActive(widget.selectedHint + n, avoidWrap); },
			setFocus: function(n) { widget.changeActive(n); },
			menuSize: function() { return widget.screenAmount(); },
			length: completions.length,
			close: function() { completion.close(); },
			pick: function() { widget.pick(); },
			data: data
		}));

		if (completion.options.closeOnUnfocus) {
			var closingOnBlur;
			cm.on("blur", this.onBlur = function() { closingOnBlur = setTimeout(function() { completion.close(); }, 100); });
			cm.on("focus", this.onFocus = function() { clearTimeout(closingOnBlur); });
		}

		cm.on("scroll", this.onScroll = function() {
			var curScroll = cm.getScrollInfo(), editor = cm.getWrapperElement().getBoundingClientRect();
			if (!startScroll) startScroll = cm.getScrollInfo();
			var newTop = top + startScroll.top - curScroll.top;
			var point = newTop - (parentWindow.pageYOffset || (ownerDocument.documentElement || ownerDocument.body).scrollTop);
			if (!below) point += hints.offsetHeight;
			if (point <= editor.top || point >= editor.bottom) return completion.close();
			hints.style.top = newTop + "px";
			hints.style.left = (left + startScroll.left - curScroll.left) + "px";
		});

		CodeMirror.on(hints, "dblclick", function(e) {
			var t = getHintElement(hints, e.target || e.srcElement);
			if (t && t.hintId != null) {widget.changeActive(t.hintId); widget.pick();}
		});

		CodeMirror.on(hints, "click", function(e) {
			var t = getHintElement(hints, e.target || e.srcElement);
			if (t && t.hintId != null) {
				widget.changeActive(t.hintId);
				if (completion.options.completeOnSingleClick) widget.pick();
			}
		});

		CodeMirror.on(hints, "mousedown", function() {
			setTimeout(function(){cm.focus();}, 20);
		});

		// The first hint doesn't need to be scrolled to on init
		var selectedHintRange = this.getSelectedHintRange();
		if (selectedHintRange.from !== 0 || selectedHintRange.to !== 0) {
			this.scrollToActive();
		}

		CodeMirror.signal(data, "select", completions[this.selectedHint], hints.childNodes[this.selectedHint]);
		return true;
	}

	Widget.prototype = {
		close: function() {
			if (this.completion.widget != this) return;
			this.completion.widget = null;
			if (this.hints.parentNode) this.hints.parentNode.removeChild(this.hints);
			this.completion.cm.removeKeyMap(this.keyMap);
			var input = this.completion.cm.getInputField();
			input.removeAttribute("aria-activedescendant");
			input.removeAttribute("aria-owns");

			var cm = this.completion.cm;
			if (this.completion.options.closeOnUnfocus) {
				cm.off("blur", this.onBlur);
				cm.off("focus", this.onFocus);
			}
			cm.off("scroll", this.onScroll);
		},

		disable: function() {
			this.completion.cm.removeKeyMap(this.keyMap);
			var widget = this;
			this.keyMap = {Enter: function() { widget.picked = true; }};
			this.completion.cm.addKeyMap(this.keyMap);
		},

		pick: function() {
			this.completion.pick(this.data, this.selectedHint);
		},

		changeActive: function(i, avoidWrap) {
			if (i >= this.data.list.length)
				i = avoidWrap ? this.data.list.length - 1 : 0;
			else if (i < 0)
				i = avoidWrap ? 0  : this.data.list.length - 1;
			if (this.selectedHint == i) return;
			var node = this.hints.childNodes[this.selectedHint];
			if (node) {
				node.className = node.className.replace(" " + ACTIVE_HINT_ELEMENT_CLASS, "");
				node.removeAttribute("aria-selected");
			}
			node = this.hints.childNodes[this.selectedHint = i];
			node.className += " " + ACTIVE_HINT_ELEMENT_CLASS;
			node.setAttribute("aria-selected", "true");
			this.completion.cm.getInputField().setAttribute("aria-activedescendant", node.id);
			this.scrollToActive();
			CodeMirror.signal(this.data, "select", this.data.list[this.selectedHint], node);
		},

		scrollToActive: function() {
			var selectedHintRange = this.getSelectedHintRange();
			var node1 = this.hints.childNodes[selectedHintRange.from];
			var node2 = this.hints.childNodes[selectedHintRange.to];
			var firstNode = this.hints.firstChild;
			if (node1.offsetTop < this.hints.scrollTop)
				this.hints.scrollTop = node1.offsetTop - firstNode.offsetTop;
			else if (node2.offsetTop + node2.offsetHeight > this.hints.scrollTop + this.hints.clientHeight)
				this.hints.scrollTop = node2.offsetTop + node2.offsetHeight - this.hints.clientHeight + firstNode.offsetTop;
		},

		screenAmount: function() {
			return Math.floor(this.hints.clientHeight / this.hints.firstChild.offsetHeight) || 1;
		},

		getSelectedHintRange: function() {
			var margin = this.completion.options.scrollMargin || 0;
			return {
				from: Math.max(0, this.selectedHint - margin),
				to: Math.min(this.data.list.length - 1, this.selectedHint + margin),
			};
		}
	};

	function applicableHelpers(cm, helpers) {
		if (!cm.somethingSelected()) return helpers
		var result = [];
		for (var i = 0; i < helpers.length; i++)
			if (helpers[i].supportsSelection) result.push(helpers[i]);
		return result
	}

	function fetchHints(hint, cm, options, callback) {
		if (hint.async) {
			hint(cm, callback, options);
		} else {
			var result = hint(cm, options);
			if (result && result.then) result.then(callback);
			else callback(result);
		}
	}

	function resolveAutoHints(cm, pos) {
		var helpers = cm.getHelpers(pos, "hint"), words;
		if (helpers.length) {
			var resolved = function(cm, callback, options) {
				var app = applicableHelpers(cm, helpers);
				function run(i) {
					if (i == app.length) return callback(null)
					fetchHints(app[i], cm, options, function(result) {
						if (result && result.list.length > 0) callback(result);
						else run(i + 1);
					});
				}
				run(0);
			};
			resolved.async = true;
			resolved.supportsSelection = true;
			return resolved
		} else if (words = cm.getHelper(cm.getCursor(), "hintWords")) {
			return function(cm) { return CodeMirror.hint.fromList(cm, {words: words}) }
		} else if (CodeMirror.hint.anyword) {
			return function(cm, options) { return CodeMirror.hint.anyword(cm, options) }
		} else {
			return function() {}
		}
	}

	CodeMirror.registerHelper("hint", "auto", {
		resolve: resolveAutoHints
	});

	CodeMirror.registerHelper("hint", "fromList", function(cm, options) {
		var cur = cm.getCursor(), token = cm.getTokenAt(cur);
		var term, from = CodeMirror.Pos(cur.line, token.start), to = cur;
		if (token.start < cur.ch && /\w/.test(token.string.charAt(cur.ch - token.start - 1))) {
			term = token.string.substr(0, cur.ch - token.start);
		} else {
			term = "";
			from = cur;
		}
		var found = [];
		for (var i = 0; i < options.words.length; i++) {
			var word = options.words[i];
			if (word.slice(0, term.length) == term)
				found.push(word);
		}

		if (found.length) return {list: found, from: from, to: to};
	});

	CodeMirror.commands.autocomplete = CodeMirror.showHint;

	var defaultOptions = {
		hint: CodeMirror.hint.auto,
		completeSingle: true,
		alignWithWord: true,
		closeCharacters: /[\s()\[\]{};:>,]/,
		closeOnPick: true,
		closeOnUnfocus: true,
		updateOnCursorActivity: true,
		completeOnSingleClick: true,
		container: null,
		customKeys: null,
		extraKeys: null,
		paddingForScrollbar: true,
		moveOnOverlap: true,
	};

	CodeMirror.defineOption("hintOptions", null);
})();

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

(function() {
"use strict";

	var tables;
	var defaultTable;
	var keywords;
	var identifierQuote;
	var CONS = {
		QUERY_DIV: ";",
		ALIAS_KEYWORD: "AS"
	};
	var Pos = CodeMirror.Pos, cmpPos = CodeMirror.cmpPos;

	function isArray(val) { return Object.prototype.toString.call(val) == "[object Array]" }

	function getModeConf(editor, field) {
		return editor.getModeAt(editor.getCursor()).config[field] || CodeMirror.resolveMode("text/x-sql")[field]
	}

	function getKeywords(editor) {
		return getModeConf(editor, "keywords") || []
	}

	function getIdentifierQuote(editor) {
		return getModeConf(editor, "identifierQuote") || "`";
	}

	function getText(item) {
		return typeof item == "string" ? item : item.text;
	}

	function wrapTable(name, value) {
		if (isArray(value)) value = {columns: value};
		if (!value.text) value.text = name;
		return value
	}

	function parseTables(input) {
		var result = {};
		if (isArray(input)) {
			for (var i = input.length - 1; i >= 0; i--) {
				var item = input[i];
				result[getText(item).toUpperCase()] = wrapTable(getText(item), item);
			}
		} else if (input) {
			for (var name in input)
				result[name.toUpperCase()] = wrapTable(name, input[name]);
		}
		return result
	}

	function getTable(name) {
		return tables[name.toUpperCase()]
	}

	function shallowClone(object) {
		var result = {};
		for (var key in object) if (object.hasOwnProperty(key))
			result[key] = object[key];
		return result;
	}

	function match(string, word) {
		var len = string.length;
		var sub = getText(word).substr(0, len);
		return string.toUpperCase() === sub.toUpperCase();
	}

	function addMatches(result, search, wordlist, formatter) {
		if (isArray(wordlist)) {
			for (var i = 0; i < wordlist.length; i++)
				if (match(search, wordlist[i])) result.push(formatter(wordlist[i]));
		} else {
			for (var word in wordlist) if (wordlist.hasOwnProperty(word)) {
				var val = wordlist[word];
				if (!val || val === true)
					val = word;
				else
					val = val.displayText ? {text: val.text, displayText: val.displayText} : val.text;
				if (match(search, val)) result.push(formatter(val));
			}
		}
	}

	function cleanName(name) {
		// Get rid name from identifierQuote and preceding dot(.)
		if (name.charAt(0) == ".") {
			name = name.substr(1);
		}
		// replace duplicated identifierQuotes with single identifierQuotes
		// and remove single identifierQuotes
		var nameParts = name.split(identifierQuote+identifierQuote);
		for (var i = 0; i < nameParts.length; i++)
			nameParts[i] = nameParts[i].replace(new RegExp(identifierQuote,"g"), "");
		return nameParts.join(identifierQuote);
	}

	function insertIdentifierQuotes(name) {
		var nameParts = getText(name).split(".");
		for (var i = 0; i < nameParts.length; i++)
			nameParts[i] = identifierQuote +
			// duplicate identifierQuotes
		nameParts[i].replace(new RegExp(identifierQuote,"g"), identifierQuote+identifierQuote) +
			identifierQuote;
		var escaped = nameParts.join(".");
		if (typeof name == "string") return escaped;
		name = shallowClone(name);
		name.text = escaped;
		return name;
	}

	function nameCompletion(cur, token, result, editor) {
		// Try to complete table, column names and return start position of completion
		var useIdentifierQuotes = false;
		var nameParts = [];
		var start = token.start;
		var cont = true;
		while (cont) {
			cont = (token.string.charAt(0) == ".");
			useIdentifierQuotes = useIdentifierQuotes || (token.string.charAt(0) == identifierQuote);

			start = token.start;
			nameParts.unshift(cleanName(token.string));

			token = editor.getTokenAt(Pos(cur.line, token.start));
			if (token.string == ".") {
				cont = true;
				token = editor.getTokenAt(Pos(cur.line, token.start));
			}
		}

		// Try to complete table names
		var string = nameParts.join(".");
		addMatches(result, string, tables, function(w) {
			return useIdentifierQuotes ? insertIdentifierQuotes(w) : w;
		});

		// Try to complete columns from defaultTable
		addMatches(result, string, defaultTable, function(w) {
			return useIdentifierQuotes ? insertIdentifierQuotes(w) : w;
		});

		// Try to complete columns
		string = nameParts.pop();
		var table = nameParts.join(".");

		var alias = false;
		var aliasTable = table;
		// Check if table is available. If not, find table by Alias
		if (!getTable(table)) {
			var oldTable = table;
			table = findTableByAlias(table, editor);
			if (table !== oldTable) alias = true;
		}

		var columns = getTable(table);
		if (columns && columns.columns)
			columns = columns.columns;

		if (columns) {
			addMatches(result, string, columns, function(w) {
				var tableInsert = table;
				if (alias == true) tableInsert = aliasTable;
				if (typeof w == "string") {
					w = tableInsert + "." + w;
				} else {
					w = shallowClone(w);
					w.text = tableInsert + "." + w.text;
				}
				return useIdentifierQuotes ? insertIdentifierQuotes(w) : w;
			});
		}

		return start;
	}

	function eachWord(lineText, f) {
		var words = lineText.split(/\s+/);
		for (var i = 0; i < words.length; i++)
			if (words[i]) f(words[i].replace(/[`,;]/g, ''));
	}

	function findTableByAlias(alias, editor) {
		var doc = editor.doc;
		var fullQuery = doc.getValue();
		var aliasUpperCase = alias.toUpperCase();
		var previousWord = "";
		var table = "";
		var separator = [];
		var validRange = {
			start: Pos(0, 0),
			end: Pos(editor.lastLine(), editor.getLineHandle(editor.lastLine()).length)
		};

		//add separator
		var indexOfSeparator = fullQuery.indexOf(CONS.QUERY_DIV);
		while(indexOfSeparator != -1) {
			separator.push(doc.posFromIndex(indexOfSeparator));
			indexOfSeparator = fullQuery.indexOf(CONS.QUERY_DIV, indexOfSeparator+1);
		}
		separator.unshift(Pos(0, 0));
		separator.push(Pos(editor.lastLine(), editor.getLineHandle(editor.lastLine()).text.length));

		//find valid range
		var prevItem = null;
		var current = editor.getCursor();
		for (var i = 0; i < separator.length; i++) {
			if ((prevItem == null || cmpPos(current, prevItem) > 0) && cmpPos(current, separator[i]) <= 0) {
				validRange = {start: prevItem, end: separator[i]};
				break;
			}
			prevItem = separator[i];
		}

		if (validRange.start) {
			var query = doc.getRange(validRange.start, validRange.end, false);

			for (var i = 0; i < query.length; i++) {
				var lineText = query[i];
				eachWord(lineText, function(word) {
					var wordUpperCase = word.toUpperCase();
					if (wordUpperCase === aliasUpperCase && getTable(previousWord))
						table = previousWord;
					if (wordUpperCase !== CONS.ALIAS_KEYWORD)
						previousWord = word;
				});
				if (table) break;
			}
		}
		return table;
	}

	CodeMirror.registerHelper("hint", "sql", function(editor, options) {
		tables = parseTables(options && options.tables);
		var defaultTableName = options && options.defaultTable;
		var disableKeywords = options && options.disableKeywords;
		defaultTable = defaultTableName && getTable(defaultTableName);
		keywords = getKeywords(editor);
		identifierQuote = getIdentifierQuote(editor);

		if (defaultTableName && !defaultTable)
			defaultTable = findTableByAlias(defaultTableName, editor);

		defaultTable = defaultTable || [];

		if (defaultTable.columns)
			defaultTable = defaultTable.columns;

		var cur = editor.getCursor();
		var result = [];
		var token = editor.getTokenAt(cur), start, end, search;
		if (token.end > cur.ch) {
			token.end = cur.ch;
			token.string = token.string.slice(0, cur.ch - token.start);
		}

		if (token.string.match(/^[.`"'\w@][\w$#]*$/g)) {
			search = token.string;
			start = token.start;
			end = token.end;
		} else {
			start = end = cur.ch;
			search = "";
		}
		if (search.charAt(0) == "." || search.charAt(0) == identifierQuote) {
			start = nameCompletion(cur, token, result, editor);
		} else {
			var objectOrClass = function(w, className) {
				if (typeof w === "object") {
					w.className = className;
				} else {
					w = { text: w, className: className };
				}
				return w;
			};
			addMatches(result, search, defaultTable, function(w) {
				return objectOrClass(w, "CodeMirror-hint-table CodeMirror-hint-default-table");
			});
			addMatches(
				result,
				search,
				tables, function(w) {
					return objectOrClass(w, "CodeMirror-hint-table");
				}
			);
			if (!disableKeywords)
				addMatches(result, search, keywords, function(w) {
					return objectOrClass(w.toUpperCase(), "CodeMirror-hint-keyword");
				});
		}

		return {list: result, from: Pos(cur.line, start), to: Pos(cur.line, end)};
	});
})();

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

(function() {
"use strict";

CodeMirror.defineMode("sql", function(config, parserConfig) {
	var client         = parserConfig.client || {},
			atoms          = parserConfig.atoms || {"false": true, "true": true, "null": true},
			builtin        = parserConfig.builtin || set(defaultBuiltin),
			keywords       = parserConfig.keywords || set(sqlKeywords),
			operatorChars  = parserConfig.operatorChars || /^[*+\-%<>!=&|~^\/]/,
			support        = parserConfig.support || {},
			hooks          = parserConfig.hooks || {},
			dateSQL        = parserConfig.dateSQL || {"date" : true, "time" : true, "timestamp" : true},
			backslashStringEscapes = parserConfig.backslashStringEscapes !== false,
			brackets       = parserConfig.brackets || /^[\{}\(\)\[\]]/,
			punctuation    = parserConfig.punctuation || /^[;.,:]/;

	function tokenBase(stream, state) {
		var ch = stream.next();

		// call hooks from the mime type
		if (hooks[ch]) {
			var result = hooks[ch](stream, state);
			if (result !== false) return result;
		}

		if (support.hexNumber &&
			((ch == "0" && stream.match(/^[xX][0-9a-fA-F]+/))
			|| (ch == "x" || ch == "X") && stream.match(/^'[0-9a-fA-F]*'/))) {
			// hex
			// ref: https://dev.mysql.com/doc/refman/8.0/en/hexadecimal-literals.html
			return "number";
		} else if (support.binaryNumber &&
			(((ch == "b" || ch == "B") && stream.match(/^'[01]*'/))
			|| (ch == "0" && stream.match(/^b[01]+/)))) {
			// bitstring
			// ref: https://dev.mysql.com/doc/refman/8.0/en/bit-value-literals.html
			return "number";
		} else if (ch.charCodeAt(0) > 47 && ch.charCodeAt(0) < 58) {
			// numbers
			// ref: https://dev.mysql.com/doc/refman/8.0/en/number-literals.html
			stream.match(/^[0-9]*(\.[0-9]+)?([eE][-+]?[0-9]+)?/);
			support.decimallessFloat && stream.match(/^\.(?!\.)/);
			return "number";
		} else if (ch == "?" && (stream.eatSpace() || stream.eol() || stream.eat(";"))) {
			// placeholders
			return "variable-3";
		} else if (ch == "'" || (ch == '"' && support.doubleQuote)) {
			// strings
			// ref: https://dev.mysql.com/doc/refman/8.0/en/string-literals.html
			state.tokenize = tokenLiteral(ch);
			return state.tokenize(stream, state);
		} else if ((((support.nCharCast && (ch == "n" || ch == "N"))
				|| (support.charsetCast && ch == "_" && stream.match(/[a-z][a-z0-9]*/i)))
				&& (stream.peek() == "'" || stream.peek() == '"'))) {
			// charset casting: _utf8'str', N'str', n'str'
			// ref: https://dev.mysql.com/doc/refman/8.0/en/string-literals.html
			return "keyword";
		} else if (support.escapeConstant && (ch == "e" || ch == "E")
				&& (stream.peek() == "'" || (stream.peek() == '"' && support.doubleQuote))) {
			// escape constant: E'str', e'str'
			// ref: https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS-ESCAPE
			state.tokenize = function(stream, state) {
				return (state.tokenize = tokenLiteral(stream.next(), true))(stream, state);
			};
			return "keyword";
		} else if (support.commentSlashSlash && ch == "/" && stream.eat("/")) {
			// 1-line comment
			stream.skipToEnd();
			return "comment";
		} else if ((support.commentHash && ch == "#")
				|| (ch == "-" && stream.eat("-") && (!support.commentSpaceRequired || stream.eat(" ")))) {
			// 1-line comments
			// ref: https://kb.askmonty.org/en/comment-syntax/
			stream.skipToEnd();
			return "comment";
		} else if (ch == "/" && stream.eat("*")) {
			// multi-line comments
			// ref: https://kb.askmonty.org/en/comment-syntax/
			state.tokenize = tokenComment(1);
			return state.tokenize(stream, state);
		} else if (ch == ".") {
			// .1 for 0.1
			if (support.zerolessFloat && stream.match(/^(?:\d+(?:e[+-]?\d+)?)/i))
				return "number";
			if (stream.match(/^\.+/))
				return null
			if (stream.match(/^[\w\d_$#]+/))
				return "variable-2";
		} else if (operatorChars.test(ch)) {
			// operators
			stream.eatWhile(operatorChars);
			return "operator";
		} else if (brackets.test(ch)) {
			// brackets
			return "bracket";
		} else if (punctuation.test(ch)) {
			// punctuation
			stream.eatWhile(punctuation);
			return "punctuation";
		} else if (ch == '{' &&
				(stream.match(/^( )*(d|D|t|T|ts|TS)( )*'[^']*'( )*}/) || stream.match(/^( )*(d|D|t|T|ts|TS)( )*"[^"]*"( )*}/))) {
			// dates (weird ODBC syntax)
			// ref: https://dev.mysql.com/doc/refman/8.0/en/date-and-time-literals.html
			return "number";
		} else {
			stream.eatWhile(/^[_\w\d]/);
			var word = stream.current().toLowerCase();
			// dates (standard SQL syntax)
			// ref: https://dev.mysql.com/doc/refman/8.0/en/date-and-time-literals.html
			if (dateSQL.hasOwnProperty(word) && (stream.match(/^( )+'[^']*'/) || stream.match(/^( )+"[^"]*"/)))
				return "number";
			if (atoms.hasOwnProperty(word)) return "atom";
			if (builtin.hasOwnProperty(word)) return "type";
			if (keywords.hasOwnProperty(word)) return "keyword";
			if (client.hasOwnProperty(word)) return "builtin";
			return null;
		}
	}

	// 'string', with char specified in quote escaped by '\'
	function tokenLiteral(quote, backslashEscapes) {
		return function(stream, state) {
			var escaped = false, ch;
			while ((ch = stream.next()) != null) {
				if (ch == quote && !escaped) {
					state.tokenize = tokenBase;
					break;
				}
				escaped = (backslashStringEscapes || backslashEscapes) && !escaped && ch == "\\";
			}
			return "string";
		};
	}
	function tokenComment(depth) {
		return function(stream, state) {
			var m = stream.match(/^.*?(\/\*|\*\/)/);
			if (!m) stream.skipToEnd();
			else if (m[1] == "/*") state.tokenize = tokenComment(depth + 1);
			else if (depth > 1) state.tokenize = tokenComment(depth - 1);
			else state.tokenize = tokenBase;
			return "comment"
		}
	}

	function pushContext(stream, state, type) {
		state.context = {
			prev: state.context,
			indent: stream.indentation(),
			col: stream.column(),
			type: type
		};
	}

	function popContext(state) {
		state.indent = state.context.indent;
		state.context = state.context.prev;
	}

	return {
		startState: function() {
			return {tokenize: tokenBase, context: null};
		},

		token: function(stream, state) {
			if (stream.sol()) {
				if (state.context && state.context.align == null)
					state.context.align = false;
			}
			if (state.tokenize == tokenBase && stream.eatSpace()) return null;

			var style = state.tokenize(stream, state);
			if (style == "comment") return style;

			if (state.context && state.context.align == null)
				state.context.align = true;

			var tok = stream.current();
			if (tok == "(")
				pushContext(stream, state, ")");
			else if (tok == "[")
				pushContext(stream, state, "]");
			else if (state.context && state.context.type == tok)
				popContext(state);
			return style;
		},

		indent: function(state, textAfter) {
			var cx = state.context;
			if (!cx) return CodeMirror.Pass;
			var closing = textAfter.charAt(0) == cx.type;
			if (cx.align) return cx.col + (closing ? 0 : 1);
			else return cx.indent + (closing ? 0 : config.indentUnit);
		},

		blockCommentStart: "/*",
		blockCommentEnd: "*/",
		lineComment: support.commentSlashSlash ? "//" : support.commentHash ? "#" : "--",
		closeBrackets: "()[]{}''\"\"``",
		config: parserConfig
	};
});

	// `identifier`
	function hookIdentifier(stream) {
		// MySQL/MariaDB identifiers
		// ref: https://dev.mysql.com/doc/refman/8.0/en/identifier-qualifiers.html
		var ch;
		while ((ch = stream.next()) != null) {
			if (ch == "`" && !stream.eat("`")) return "variable-2";
		}
		stream.backUp(stream.current().length - 1);
		return stream.eatWhile(/\w/) ? "variable-2" : null;
	}

	// "identifier"
	function hookIdentifierDoublequote(stream) {
		// Standard SQL /SQLite identifiers
		// ref: http://web.archive.org/web/20160813185132/http://savage.net.au/SQL/sql-99.bnf.html#delimited%20identifier
		// ref: http://sqlite.org/lang_keywords.html
		var ch;
		while ((ch = stream.next()) != null) {
			if (ch == "\"" && !stream.eat("\"")) return "variable-2";
		}
		stream.backUp(stream.current().length - 1);
		return stream.eatWhile(/\w/) ? "variable-2" : null;
	}

	// variable token
	function hookVar(stream) {
		// variables
		// @@prefix.varName @varName
		// varName can be quoted with ` or ' or "
		// ref: https://dev.mysql.com/doc/refman/8.0/en/user-variables.html
		if (stream.eat("@")) {
			stream.match('session.');
			stream.match('local.');
			stream.match('global.');
		}

		if (stream.eat("'")) {
			stream.match(/^.*'/);
			return "variable-2";
		} else if (stream.eat('"')) {
			stream.match(/^.*"/);
			return "variable-2";
		} else if (stream.eat("`")) {
			stream.match(/^.*`/);
			return "variable-2";
		} else if (stream.match(/^[0-9a-zA-Z$\.\_]+/)) {
			return "variable-2";
		}
		return null;
	};

	// short client keyword token
	function hookClient(stream) {
		// \N means NULL
		// ref: https://dev.mysql.com/doc/refman/8.0/en/null-values.html
		if (stream.eat("N")) {
				return "atom";
		}
		// \g, etc
		// ref: https://dev.mysql.com/doc/refman/8.0/en/mysql-commands.html
		return stream.match(/^[a-zA-Z.#!?]/) ? "variable-2" : null;
	}

	// these keywords are used by all SQL dialects (however, a mode can still overwrite it)
	var sqlKeywords = "alter and as asc between by count create delete desc distinct drop from group having in insert into is join like not on or order select set table union update values where limit ";

	// turn a space-separated list into an array
	function set(str) {
		var obj = {}, words = str.split(" ");
		for (var i = 0; i < words.length; ++i) obj[words[i]] = true;
		return obj;
	}

	var defaultBuiltin = "bool boolean bit blob enum long longblob longtext medium mediumblob mediumint mediumtext time timestamp tinyblob tinyint tinytext text bigint int int1 int2 int3 int4 int8 integer float float4 float8 double char varbinary varchar varcharacter precision real date datetime year unsigned signed decimal numeric";

	// A generic SQL Mode. It's not a standard, it just tries to support what is generally supported
	CodeMirror.defineMIME("text/x-sql", {
		name: "sql",
		keywords: set(sqlKeywords + "begin"),
		builtin: set(defaultBuiltin),
		atoms: set("false true null unknown"),
		dateSQL: set("date time timestamp"),
		support: set("doubleQuote binaryNumber hexNumber")
	});

	CodeMirror.defineMIME("text/x-mssql", {
		name: "sql",
		client: set("$partition binary_checksum checksum connectionproperty context_info current_request_id error_line error_message error_number error_procedure error_severity error_state formatmessage get_filestream_transaction_context getansinull host_id host_name isnull isnumeric min_active_rowversion newid newsequentialid rowcount_big xact_state object_id"),
		keywords: set(sqlKeywords + "begin trigger proc view index for add constraint key primary foreign collate clustered nonclustered declare exec go if use index holdlock nolock nowait paglock readcommitted readcommittedlock readpast readuncommitted repeatableread rowlock serializable snapshot tablock tablockx updlock with"),
		builtin: set("bigint numeric bit smallint decimal smallmoney int tinyint money float real char varchar text nchar nvarchar ntext binary varbinary image cursor timestamp hierarchyid uniqueidentifier sql_variant xml table "),
		atoms: set("is not null like and or in left right between inner outer join all any some cross unpivot pivot exists"),
		operatorChars: /^[*+\-%<>!=^\&|\/]/,
		brackets: /^[\{}\(\)]/,
		punctuation: /^[;.,:/]/,
		backslashStringEscapes: false,
		dateSQL: set("date datetimeoffset datetime2 smalldatetime datetime time"),
		hooks: {
			"@":   hookVar
		}
	});

	CodeMirror.defineMIME("text/x-mysql", {
		name: "sql",
		client: set("charset clear connect edit ego exit go help nopager notee nowarning pager print prompt quit rehash source status system tee"),
		keywords: set(sqlKeywords + "accessible action add after algorithm all analyze asensitive at authors auto_increment autocommit avg avg_row_length before binary binlog both btree cache call cascade cascaded case catalog_name chain change changed character check checkpoint checksum class_origin client_statistics close coalesce code collate collation collations column columns comment commit committed completion concurrent condition connection consistent constraint contains continue contributors convert cross current current_date current_time current_timestamp current_user cursor data database databases day_hour day_microsecond day_minute day_second deallocate dec declare default delay_key_write delayed delimiter des_key_file describe deterministic dev_pop dev_samp deviance diagnostics directory disable discard distinctrow div dual dumpfile each elseif enable enclosed end ends engine engines enum errors escape escaped even event events every execute exists exit explain extended fast fetch field fields first flush for force foreign found_rows full fulltext function general get global grant grants group group_concat handler hash help high_priority hosts hour_microsecond hour_minute hour_second if ignore ignore_server_ids import index index_statistics infile inner innodb inout insensitive insert_method install interval invoker isolation iterate key keys kill language last leading leave left level limit linear lines list load local localtime localtimestamp lock logs low_priority master master_heartbeat_period master_ssl_verify_server_cert masters match max max_rows maxvalue message_text middleint migrate min min_rows minute_microsecond minute_second mod mode modifies modify mutex mysql_errno natural next no no_write_to_binlog offline offset one online open optimize option optionally out outer outfile pack_keys parser partition partitions password phase plugin plugins prepare preserve prev primary privileges procedure processlist profile profiles purge query quick range read read_write reads real rebuild recover references regexp relaylog release remove rename reorganize repair repeatable replace require resignal restrict resume return returns revoke right rlike rollback rollup row row_format rtree savepoint schedule schema schema_name schemas second_microsecond security sensitive separator serializable server session share show signal slave slow smallint snapshot soname spatial specific sql sql_big_result sql_buffer_result sql_cache sql_calc_found_rows sql_no_cache sql_small_result sqlexception sqlstate sqlwarning ssl start starting starts status std stddev stddev_pop stddev_samp storage straight_join subclass_origin sum suspend table_name table_statistics tables tablespace temporary terminated to trailing transaction trigger triggers truncate uncommitted undo uninstall unique unlock upgrade usage use use_frm user user_resources user_statistics using utc_date utc_time utc_timestamp value variables varying view views warnings when while with work write xa xor year_month zerofill begin do then else loop repeat"),
		builtin: set("bool boolean bit blob decimal double float long longblob longtext medium mediumblob mediumint mediumtext time timestamp tinyblob tinyint tinytext text bigint int int1 int2 int3 int4 int8 integer float float4 float8 double char varbinary varchar varcharacter precision date datetime year unsigned signed numeric"),
		atoms: set("false true null unknown"),
		operatorChars: /^[*+\-%<>!=&|^]/,
		dateSQL: set("date time timestamp"),
		support: set("decimallessFloat zerolessFloat binaryNumber hexNumber doubleQuote nCharCast charsetCast commentHash commentSpaceRequired"),
		hooks: {
			"@":   hookVar,
			"`":   hookIdentifier,
			"\\":  hookClient
		}
	});

	CodeMirror.defineMIME("text/x-mariadb", {
		name: "sql",
		client: set("charset clear connect edit ego exit go help nopager notee nowarning pager print prompt quit rehash source status system tee"),
		keywords: set(sqlKeywords + "accessible action add after algorithm all always analyze asensitive at authors auto_increment autocommit avg avg_row_length before binary binlog both btree cache call cascade cascaded case catalog_name chain change changed character check checkpoint checksum class_origin client_statistics close coalesce code collate collation collations column columns comment commit committed completion concurrent condition connection consistent constraint contains continue contributors convert cross current current_date current_time current_timestamp current_user cursor data database databases day_hour day_microsecond day_minute day_second deallocate dec declare default delay_key_write delayed delimiter des_key_file describe deterministic dev_pop dev_samp deviance diagnostics directory disable discard distinctrow div dual dumpfile each elseif enable enclosed end ends engine engines enum errors escape escaped even event events every execute exists exit explain extended fast fetch field fields first flush for force foreign found_rows full fulltext function general generated get global grant grants group group_concat handler hard hash help high_priority hosts hour_microsecond hour_minute hour_second if ignore ignore_server_ids import index index_statistics infile inner innodb inout insensitive insert_method install interval invoker isolation iterate key keys kill language last leading leave left level limit linear lines list load local localtime localtimestamp lock logs low_priority master master_heartbeat_period master_ssl_verify_server_cert masters match max max_rows maxvalue message_text middleint migrate min min_rows minute_microsecond minute_second mod mode modifies modify mutex mysql_errno natural next no no_write_to_binlog offline offset one online open optimize option optionally out outer outfile pack_keys parser partition partitions password persistent phase plugin plugins prepare preserve prev primary privileges procedure processlist profile profiles purge query quick range read read_write reads real rebuild recover references regexp relaylog release remove rename reorganize repair repeatable replace require resignal restrict resume return returns revoke right rlike rollback rollup row row_format rtree savepoint schedule schema schema_name schemas second_microsecond security sensitive separator serializable server session share show shutdown signal slave slow smallint snapshot soft soname spatial specific sql sql_big_result sql_buffer_result sql_cache sql_calc_found_rows sql_no_cache sql_small_result sqlexception sqlstate sqlwarning ssl start starting starts status std stddev stddev_pop stddev_samp storage straight_join subclass_origin sum suspend table_name table_statistics tables tablespace temporary terminated to trailing transaction trigger triggers truncate uncommitted undo uninstall unique unlock upgrade usage use use_frm user user_resources user_statistics using utc_date utc_time utc_timestamp value variables varying view views virtual warnings when while with work write xa xor year_month zerofill begin do then else loop repeat"),
		builtin: set("bool boolean bit blob decimal double float long longblob longtext medium mediumblob mediumint mediumtext time timestamp tinyblob tinyint tinytext text bigint int int1 int2 int3 int4 int8 integer float float4 float8 double char varbinary varchar varcharacter precision date datetime year unsigned signed numeric"),
		atoms: set("false true null unknown"),
		operatorChars: /^[*+\-%<>!=&|^]/,
		dateSQL: set("date time timestamp"),
		support: set("decimallessFloat zerolessFloat binaryNumber hexNumber doubleQuote nCharCast charsetCast commentHash commentSpaceRequired"),
		hooks: {
			"@":   hookVar,
			"`":   hookIdentifier,
			"\\":  hookClient
		}
	});

	// provided by the phpLiteAdmin project - phpliteadmin.org
	CodeMirror.defineMIME("text/x-sqlite", {
		name: "sql",
		// commands of the official SQLite client, ref: https://www.sqlite.org/cli.html#dotcmd
		client: set("auth backup bail binary changes check clone databases dbinfo dump echo eqp exit explain fullschema headers help import imposter indexes iotrace limit lint load log mode nullvalue once open output print prompt quit read restore save scanstats schema separator session shell show stats system tables testcase timeout timer trace vfsinfo vfslist vfsname width"),
		// ref: http://sqlite.org/lang_keywords.html
		keywords: set(sqlKeywords + "abort action add after all analyze attach autoincrement before begin cascade case cast check collate column commit conflict constraint cross current_date current_time current_timestamp database default deferrable deferred detach each else end escape except exclusive exists explain fail for foreign full glob if ignore immediate index indexed initially inner instead intersect isnull key left limit match natural no notnull null of offset outer plan pragma primary query raise recursive references regexp reindex release rename replace restrict right rollback row savepoint temp temporary then to transaction trigger unique using vacuum view virtual when with without"),
		// SQLite is weakly typed, ref: http://sqlite.org/datatype3.html. This is just a list of some common types.
		builtin: set("bool boolean bit blob decimal double float long longblob longtext medium mediumblob mediumint mediumtext time timestamp tinyblob tinyint tinytext text clob bigint int int2 int8 integer float double char varchar date datetime year unsigned signed numeric real"),
		// ref: http://sqlite.org/syntax/literal-value.html
		atoms: set("null current_date current_time current_timestamp"),
		// ref: http://sqlite.org/lang_expr.html#binaryops
		operatorChars: /^[*+\-%<>!=&|/~]/,
		// SQLite is weakly typed, ref: http://sqlite.org/datatype3.html. This is just a list of some common types.
		dateSQL: set("date time timestamp datetime"),
		support: set("decimallessFloat zerolessFloat"),
		identifierQuote: "\"",  //ref: http://sqlite.org/lang_keywords.html
		hooks: {
			// bind-parameters ref:http://sqlite.org/lang_expr.html#varparam
			"@":   hookVar,
			":":   hookVar,
			"?":   hookVar,
			"$":   hookVar,
			// The preferred way to escape Identifiers is using double quotes, ref: http://sqlite.org/lang_keywords.html
			"\"":   hookIdentifierDoublequote,
			// there is also support for backticks, ref: http://sqlite.org/lang_keywords.html
			"`":   hookIdentifier
		}
	});

	// the query language used by Apache Cassandra is called CQL, but this mime type
	// is called Cassandra to avoid confusion with Contextual Query Language
	CodeMirror.defineMIME("text/x-cassandra", {
		name: "sql",
		client: { },
		keywords: set("add all allow alter and any apply as asc authorize batch begin by clustering columnfamily compact consistency count create custom delete desc distinct drop each_quorum exists filtering from grant if in index insert into key keyspace keyspaces level limit local_one local_quorum modify nan norecursive nosuperuser not of on one order password permission permissions primary quorum rename revoke schema select set storage superuser table three to token truncate ttl two type unlogged update use user users using values where with writetime"),
		builtin: set("ascii bigint blob boolean counter decimal double float frozen inet int list map static text timestamp timeuuid tuple uuid varchar varint"),
		atoms: set("false true infinity NaN"),
		operatorChars: /^[<>=]/,
		dateSQL: { },
		support: set("commentSlashSlash decimallessFloat"),
		hooks: { }
	});

	// this is based on Peter Raganitsch's 'plsql' mode
	CodeMirror.defineMIME("text/x-plsql", {
		name:       "sql",
		client:     set("appinfo arraysize autocommit autoprint autorecovery autotrace blockterminator break btitle cmdsep colsep compatibility compute concat copycommit copytypecheck define describe echo editfile embedded escape exec execute feedback flagger flush heading headsep instance linesize lno loboffset logsource long longchunksize markup native newpage numformat numwidth pagesize pause pno recsep recsepchar release repfooter repheader serveroutput shiftinout show showmode size spool sqlblanklines sqlcase sqlcode sqlcontinue sqlnumber sqlpluscompatibility sqlprefix sqlprompt sqlterminator suffix tab term termout time timing trimout trimspool ttitle underline verify version wrap"),
		keywords:   set("abort accept access add all alter and any array arraylen as asc assert assign at attributes audit authorization avg base_table begin between binary_integer body boolean by case cast char char_base check close cluster clusters colauth column comment commit compress connect connected constant constraint crash create current currval cursor data_base database date dba deallocate debugoff debugon decimal declare default definition delay delete desc digits dispose distinct do drop else elseif elsif enable end entry escape exception exception_init exchange exclusive exists exit external fast fetch file for force form from function generic goto grant group having identified if immediate in increment index indexes indicator initial initrans insert interface intersect into is key level library like limited local lock log logging long loop master maxextents maxtrans member minextents minus mislabel mode modify multiset new next no noaudit nocompress nologging noparallel not nowait number_base object of off offline on online only open option or order out package parallel partition pctfree pctincrease pctused pls_integer positive positiven pragma primary prior private privileges procedure public raise range raw read rebuild record ref references refresh release rename replace resource restrict return returning returns reverse revoke rollback row rowid rowlabel rownum rows run savepoint schema segment select separate session set share snapshot some space split sql start statement storage subtype successful synonym tabauth table tables tablespace task terminate then to trigger truncate type union unique unlimited unrecoverable unusable update use using validate value values variable view views when whenever where while with work"),
		builtin:    set("abs acos add_months ascii asin atan atan2 average bfile bfilename bigserial bit blob ceil character chartorowid chr clob concat convert cos cosh count dec decode deref dual dump dup_val_on_index empty error exp false float floor found glb greatest hextoraw initcap instr instrb int integer isopen last_day least length lengthb ln lower lpad ltrim lub make_ref max min mlslabel mod months_between natural naturaln nchar nclob new_time next_day nextval nls_charset_decl_len nls_charset_id nls_charset_name nls_initcap nls_lower nls_sort nls_upper nlssort no_data_found notfound null number numeric nvarchar2 nvl others power rawtohex real reftohex round rowcount rowidtochar rowtype rpad rtrim serial sign signtype sin sinh smallint soundex sqlcode sqlerrm sqrt stddev string substr substrb sum sysdate tan tanh to_char text to_date to_label to_multi_byte to_number to_single_byte translate true trunc uid unlogged upper user userenv varchar varchar2 variance varying vsize xml"),
		operatorChars: /^[*\/+\-%<>!=~]/,
		dateSQL:    set("date time timestamp"),
		support:    set("doubleQuote nCharCast zerolessFloat binaryNumber hexNumber")
	});

	// Created to support specific hive keywords
	CodeMirror.defineMIME("text/x-hive", {
		name: "sql",
		keywords: set("select alter $elem$ $key$ $value$ add after all analyze and archive as asc before between binary both bucket buckets by cascade case cast change cluster clustered clusterstatus collection column columns comment compute concatenate continue create cross cursor data database databases dbproperties deferred delete delimited desc describe directory disable distinct distribute drop else enable end escaped exclusive exists explain export extended external fetch fields fileformat first format formatted from full function functions grant group having hold_ddltime idxproperties if import in index indexes inpath inputdriver inputformat insert intersect into is items join keys lateral left like limit lines load local location lock locks mapjoin materialized minus msck no_drop nocompress not of offline on option or order out outer outputdriver outputformat overwrite partition partitioned partitions percent plus preserve procedure purge range rcfile read readonly reads rebuild recordreader recordwriter recover reduce regexp rename repair replace restrict revoke right rlike row schema schemas semi sequencefile serde serdeproperties set shared show show_database sort sorted ssl statistics stored streamtable table tables tablesample tblproperties temporary terminated textfile then tmp to touch transform trigger unarchive undo union uniquejoin unlock update use using utc utc_tmestamp view when where while with admin authorization char compact compactions conf cube current current_date current_timestamp day decimal defined dependency directories elem_type exchange file following for grouping hour ignore inner interval jar less logical macro minute month more none noscan over owner partialscan preceding pretty principals protection reload rewrite role roles rollup rows second server sets skewed transactions truncate unbounded unset uri user values window year"),
		builtin: set("bool boolean long timestamp tinyint smallint bigint int float double date datetime unsigned string array struct map uniontype key_type utctimestamp value_type varchar"),
		atoms: set("false true null unknown"),
		operatorChars: /^[*+\-%<>!=]/,
		dateSQL: set("date timestamp"),
		support: set("doubleQuote binaryNumber hexNumber")
	});

	CodeMirror.defineMIME("text/x-pgsql", {
		name: "sql",
		client: set("source"),
		// For PostgreSQL - https://www.postgresql.org/docs/11/sql-keywords-appendix.html
		// For pl/pgsql lang - https://github.com/postgres/postgres/blob/REL_11_2/src/pl/plpgsql/src/pl_scanner.c
		keywords: set(sqlKeywords + "a abort abs absent absolute access according action ada add admin after aggregate alias all allocate also alter always analyse analyze and any are array array_agg array_max_cardinality as asc asensitive assert assertion assignment asymmetric at atomic attach attribute attributes authorization avg backward base64 before begin begin_frame begin_partition bernoulli between bigint binary bit bit_length blob blocked bom boolean both breadth by c cache call called cardinality cascade cascaded case cast catalog catalog_name ceil ceiling chain char char_length character character_length character_set_catalog character_set_name character_set_schema characteristics characters check checkpoint class class_origin clob close cluster coalesce cobol collate collation collation_catalog collation_name collation_schema collect column column_name columns command_function command_function_code comment comments commit committed concurrently condition condition_number configuration conflict connect connection connection_name constant constraint constraint_catalog constraint_name constraint_schema constraints constructor contains content continue control conversion convert copy corr corresponding cost count covar_pop covar_samp create cross csv cube cume_dist current current_catalog current_date current_default_transform_group current_path current_role current_row current_schema current_time current_timestamp current_transform_group_for_type current_user cursor cursor_name cycle data database datalink datatype date datetime_interval_code datetime_interval_precision day db deallocate debug dec decimal declare default defaults deferrable deferred defined definer degree delete delimiter delimiters dense_rank depends depth deref derived desc describe descriptor detach detail deterministic diagnostics dictionary disable discard disconnect dispatch distinct dlnewcopy dlpreviouscopy dlurlcomplete dlurlcompleteonly dlurlcompletewrite dlurlpath dlurlpathonly dlurlpathwrite dlurlscheme dlurlserver dlvalue do document domain double drop dump dynamic dynamic_function dynamic_function_code each element else elseif elsif empty enable encoding encrypted end end_frame end_partition endexec enforced enum equals errcode error escape event every except exception exclude excluding exclusive exec execute exists exit exp explain expression extension external extract false family fetch file filter final first first_value flag float floor following for force foreach foreign fortran forward found frame_row free freeze from fs full function functions fusion g general generated get global go goto grant granted greatest group grouping groups handler having header hex hierarchy hint hold hour id identity if ignore ilike immediate immediately immutable implementation implicit import in include including increment indent index indexes indicator info inherit inherits initially inline inner inout input insensitive insert instance instantiable instead int integer integrity intersect intersection interval into invoker is isnull isolation join k key key_member key_type label lag language large last last_value lateral lead leading leakproof least left length level library like like_regex limit link listen ln load local localtime localtimestamp location locator lock locked log logged loop lower m map mapping match matched materialized max max_cardinality maxvalue member merge message message_length message_octet_length message_text method min minute minvalue mod mode modifies module month more move multiset mumps name names namespace national natural nchar nclob nesting new next nfc nfd nfkc nfkd nil no none normalize normalized not nothing notice notify notnull nowait nth_value ntile null nullable nullif nulls number numeric object occurrences_regex octet_length octets of off offset oids old on only open operator option options or order ordering ordinality others out outer output over overlaps overlay overriding owned owner p pad parallel parameter parameter_mode parameter_name parameter_ordinal_position parameter_specific_catalog parameter_specific_name parameter_specific_schema parser partial partition pascal passing passthrough password path percent percent_rank percentile_cont percentile_disc perform period permission pg_context pg_datatype_name pg_exception_context pg_exception_detail pg_exception_hint placing plans pli policy portion position position_regex power precedes preceding precision prepare prepared preserve primary print_strict_params prior privileges procedural procedure procedures program public publication query quote raise range rank read reads real reassign recheck recovery recursive ref references referencing refresh regr_avgx regr_avgy regr_count regr_intercept regr_r2 regr_slope regr_sxx regr_sxy regr_syy reindex relative release rename repeatable replace replica requiring reset respect restart restore restrict result result_oid return returned_cardinality returned_length returned_octet_length returned_sqlstate returning returns reverse revoke right role rollback rollup routine routine_catalog routine_name routine_schema routines row row_count row_number rows rowtype rule savepoint scale schema schema_name schemas scope scope_catalog scope_name scope_schema scroll search second section security select selective self sensitive sequence sequences serializable server server_name session session_user set setof sets share show similar simple size skip slice smallint snapshot some source space specific specific_name specifictype sql sqlcode sqlerror sqlexception sqlstate sqlwarning sqrt stable stacked standalone start state statement static statistics stddev_pop stddev_samp stdin stdout storage strict strip structure style subclass_origin submultiset subscription substring substring_regex succeeds sum symmetric sysid system system_time system_user t table table_name tables tablesample tablespace temp template temporary text then ties time timestamp timezone_hour timezone_minute to token top_level_count trailing transaction transaction_active transactions_committed transactions_rolled_back transform transforms translate translate_regex translation treat trigger trigger_catalog trigger_name trigger_schema trim trim_array true truncate trusted type types uescape unbounded uncommitted under unencrypted union unique unknown unlink unlisten unlogged unnamed unnest until untyped update upper uri usage use_column use_variable user user_defined_type_catalog user_defined_type_code user_defined_type_name user_defined_type_schema using vacuum valid validate validator value value_of values var_pop var_samp varbinary varchar variable_conflict variadic varying verbose version versioning view views volatile warning when whenever where while whitespace width_bucket window with within without work wrapper write xml xmlagg xmlattributes xmlbinary xmlcast xmlcomment xmlconcat xmldeclaration xmldocument xmlelement xmlexists xmlforest xmliterate xmlnamespaces xmlparse xmlpi xmlquery xmlroot xmlschema xmlserialize xmltable xmltext xmlvalidate year yes zone"),
		// https://www.postgresql.org/docs/11/datatype.html
		builtin: set("bigint int8 bigserial serial8 bit varying varbit boolean bool box bytea character char varchar cidr circle date double precision float8 inet integer int int4 interval json jsonb line lseg macaddr macaddr8 money numeric decimal path pg_lsn point polygon real float4 smallint int2 smallserial serial2 serial serial4 text time zone timetz timestamp timestamptz tsquery tsvector txid_snapshot uuid xml"),
		atoms: set("false true null unknown"),
		operatorChars: /^[*\/+\-%<>!=&|^\/#@?~]/,
		backslashStringEscapes: false,
		dateSQL: set("date time timestamp"),
		support: set("decimallessFloat zerolessFloat binaryNumber hexNumber nCharCast charsetCast escapeConstant")
	});

	// Google's SQL-like query language, GQL
	CodeMirror.defineMIME("text/x-gql", {
		name: "sql",
		keywords: set("ancestor and asc by contains desc descendant distinct from group has in is limit offset on order select superset where"),
		atoms: set("false true"),
		builtin: set("blob datetime first key __key__ string integer double boolean null"),
		operatorChars: /^[*+\-%<>!=]/
	});

	// Greenplum
	CodeMirror.defineMIME("text/x-gpsql", {
		name: "sql",
		client: set("source"),
		//https://github.com/greenplum-db/gpdb/blob/master/src/include/parser/kwlist.h
		keywords: set("abort absolute access action active add admin after aggregate all also alter always analyse analyze and any array as asc assertion assignment asymmetric at authorization backward before begin between bigint binary bit boolean both by cache called cascade cascaded case cast chain char character characteristics check checkpoint class close cluster coalesce codegen collate column comment commit committed concurrency concurrently configuration connection constraint constraints contains content continue conversion copy cost cpu_rate_limit create createdb createexttable createrole createuser cross csv cube current current_catalog current_date current_role current_schema current_time current_timestamp current_user cursor cycle data database day deallocate dec decimal declare decode default defaults deferrable deferred definer delete delimiter delimiters deny desc dictionary disable discard distinct distributed do document domain double drop dxl each else enable encoding encrypted end enum errors escape every except exchange exclude excluding exclusive execute exists explain extension external extract false family fetch fields filespace fill filter first float following for force foreign format forward freeze from full function global grant granted greatest group group_id grouping handler hash having header hold host hour identity if ignore ilike immediate immutable implicit in including inclusive increment index indexes inherit inherits initially inline inner inout input insensitive insert instead int integer intersect interval into invoker is isnull isolation join key language large last leading least left level like limit list listen load local localtime localtimestamp location lock log login mapping master match maxvalue median merge minute minvalue missing mode modifies modify month move name names national natural nchar new newline next no nocreatedb nocreateexttable nocreaterole nocreateuser noinherit nologin none noovercommit nosuperuser not nothing notify notnull nowait null nullif nulls numeric object of off offset oids old on only operator option options or order ordered others out outer over overcommit overlaps overlay owned owner parser partial partition partitions passing password percent percentile_cont percentile_disc placing plans position preceding precision prepare prepared preserve primary prior privileges procedural procedure protocol queue quote randomly range read readable reads real reassign recheck recursive ref references reindex reject relative release rename repeatable replace replica reset resource restart restrict returning returns revoke right role rollback rollup rootpartition row rows rule savepoint scatter schema scroll search second security segment select sequence serializable session session_user set setof sets share show similar simple smallint some split sql stable standalone start statement statistics stdin stdout storage strict strip subpartition subpartitions substring superuser symmetric sysid system table tablespace temp template temporary text then threshold ties time timestamp to trailing transaction treat trigger trim true truncate trusted type unbounded uncommitted unencrypted union unique unknown unlisten until update user using vacuum valid validation validator value values varchar variadic varying verbose version view volatile web when where whitespace window with within without work writable write xml xmlattributes xmlconcat xmlelement xmlexists xmlforest xmlparse xmlpi xmlroot xmlserialize year yes zone"),
		builtin: set("bigint int8 bigserial serial8 bit varying varbit boolean bool box bytea character char varchar cidr circle date double precision float float8 inet integer int int4 interval json jsonb line lseg macaddr macaddr8 money numeric decimal path pg_lsn point polygon real float4 smallint int2 smallserial serial2 serial serial4 text time without zone with timetz timestamp timestamptz tsquery tsvector txid_snapshot uuid xml"),
		atoms: set("false true null unknown"),
		operatorChars: /^[*+\-%<>!=&|^\/#@?~]/,
		dateSQL: set("date time timestamp"),
		support: set("decimallessFloat zerolessFloat binaryNumber hexNumber nCharCast charsetCast")
	});

	// Spark SQL
	CodeMirror.defineMIME("text/x-sparksql", {
		name: "sql",
		keywords: set("add after all alter analyze and anti archive array as asc at between bucket buckets by cache cascade case cast change clear cluster clustered codegen collection column columns comment commit compact compactions compute concatenate cost create cross cube current current_date current_timestamp database databases data dbproperties defined delete delimited deny desc describe dfs directories distinct distribute drop else end escaped except exchange exists explain export extended external false fields fileformat first following for format formatted from full function functions global grant group grouping having if ignore import in index indexes inner inpath inputformat insert intersect interval into is items join keys last lateral lazy left like limit lines list load local location lock locks logical macro map minus msck natural no not null nulls of on optimize option options or order out outer outputformat over overwrite partition partitioned partitions percent preceding principals purge range recordreader recordwriter recover reduce refresh regexp rename repair replace reset restrict revoke right rlike role roles rollback rollup row rows schema schemas select semi separated serde serdeproperties set sets show skewed sort sorted start statistics stored stratify struct table tables tablesample tblproperties temp temporary terminated then to touch transaction transactions transform true truncate unarchive unbounded uncache union unlock unset use using values view when where window with"),
		builtin: set("abs acos acosh add_months aggregate and any approx_count_distinct approx_percentile array array_contains array_distinct array_except array_intersect array_join array_max array_min array_position array_remove array_repeat array_sort array_union arrays_overlap arrays_zip ascii asin asinh assert_true atan atan2 atanh avg base64 between bigint bin binary bit_and bit_count bit_get bit_length bit_or bit_xor bool_and bool_or boolean bround btrim cardinality case cast cbrt ceil ceiling char char_length character_length chr coalesce collect_list collect_set concat concat_ws conv corr cos cosh cot count count_if count_min_sketch covar_pop covar_samp crc32 cume_dist current_catalog current_database current_date current_timestamp current_timezone current_user date date_add date_format date_from_unix_date date_part date_sub date_trunc datediff day dayofmonth dayofweek dayofyear decimal decode degrees delimited dense_rank div double e element_at elt encode every exists exp explode explode_outer expm1 extract factorial filter find_in_set first first_value flatten float floor forall format_number format_string from_csv from_json from_unixtime from_utc_timestamp get_json_object getbit greatest grouping grouping_id hash hex hour hypot if ifnull in initcap inline inline_outer input_file_block_length input_file_block_start input_file_name inputformat instr int isnan isnotnull isnull java_method json_array_length json_object_keys json_tuple kurtosis lag last last_day last_value lcase lead least left length levenshtein like ln locate log log10 log1p log2 lower lpad ltrim make_date make_dt_interval make_interval make_timestamp make_ym_interval map map_concat map_entries map_filter map_from_arrays map_from_entries map_keys map_values map_zip_with max max_by md5 mean min min_by minute mod monotonically_increasing_id month months_between named_struct nanvl negative next_day not now nth_value ntile nullif nvl nvl2 octet_length or outputformat overlay parse_url percent_rank percentile percentile_approx pi pmod posexplode posexplode_outer position positive pow power printf quarter radians raise_error rand randn random rank rcfile reflect regexp regexp_extract regexp_extract_all regexp_like regexp_replace repeat replace reverse right rint rlike round row_number rpad rtrim schema_of_csv schema_of_json second sentences sequence sequencefile serde session_window sha sha1 sha2 shiftleft shiftright shiftrightunsigned shuffle sign signum sin sinh size skewness slice smallint some sort_array soundex space spark_partition_id split sqrt stack std stddev stddev_pop stddev_samp str_to_map string struct substr substring substring_index sum tan tanh textfile timestamp timestamp_micros timestamp_millis timestamp_seconds tinyint to_csv to_date to_json to_timestamp to_unix_timestamp to_utc_timestamp transform transform_keys transform_values translate trim trunc try_add try_divide typeof ucase unbase64 unhex uniontype unix_date unix_micros unix_millis unix_seconds unix_timestamp upper uuid var_pop var_samp variance version weekday weekofyear when width_bucket window xpath xpath_boolean xpath_double xpath_float xpath_int xpath_long xpath_number xpath_short xpath_string xxhash64 year zip_with"),
		atoms: set("false true null"),
		operatorChars: /^[*\/+\-%<>!=~&|^]/,
		dateSQL: set("date time timestamp"),
		support: set("doubleQuote zerolessFloat")
	});

	// Esper
	CodeMirror.defineMIME("text/x-esper", {
		name: "sql",
		client: set("source"),
		// http://www.espertech.com/esper/release-5.5.0/esper-reference/html/appendix_keywords.html
		keywords: set("alter and as asc between by count create delete desc distinct drop from group having in insert into is join like not on or order select set table union update values where limit after all and as at asc avedev avg between by case cast coalesce count create current_timestamp day days delete define desc distinct else end escape events every exists false first from full group having hour hours in inner insert instanceof into irstream is istream join last lastweekday left limit like max match_recognize matches median measures metadatasql min minute minutes msec millisecond milliseconds not null offset on or order outer output partition pattern prev prior regexp retain-union retain-intersection right rstream sec second seconds select set some snapshot sql stddev sum then true unidirectional until update variable weekday when where window"),
		builtin: {},
		atoms: set("false true null"),
		operatorChars: /^[*+\-%<>!=&|^\/#@?~]/,
		dateSQL: set("time"),
		support: set("decimallessFloat zerolessFloat binaryNumber hexNumber")
	});

	// Trino (formerly known as Presto)
	CodeMirror.defineMIME("text/x-trino", {
		name: "sql",
		// https://github.com/trinodb/trino/blob/bc7a4eeedde28684c7ae6f74cefcaf7c6e782174/core/trino-parser/src/main/antlr4/io/trino/sql/parser/SqlBase.g4#L859-L1129
		// https://github.com/trinodb/trino/blob/bc7a4eeedde28684c7ae6f74cefcaf7c6e782174/docs/src/main/sphinx/functions/list.rst
		keywords: set("abs absent acos add admin after all all_match alter analyze and any any_match approx_distinct approx_most_frequent approx_percentile approx_set arbitrary array_agg array_distinct array_except array_intersect array_join array_max array_min array_position array_remove array_sort array_union arrays_overlap as asc asin at at_timezone atan atan2 authorization avg bar bernoulli beta_cdf between bing_tile bing_tile_at bing_tile_coordinates bing_tile_polygon bing_tile_quadkey bing_tile_zoom_level bing_tiles_around bit_count bitwise_and bitwise_and_agg bitwise_left_shift bitwise_not bitwise_or bitwise_or_agg bitwise_right_shift bitwise_right_shift_arithmetic bitwise_xor bool_and bool_or both by call cardinality cascade case cast catalogs cbrt ceil ceiling char2hexint checksum chr classify coalesce codepoint column columns combinations comment commit committed concat concat_ws conditional constraint contains contains_sequence convex_hull_agg copartition corr cos cosh cosine_similarity count count_if covar_pop covar_samp crc32 create cross cube cume_dist current current_catalog current_date current_groups current_path current_role current_schema current_time current_timestamp current_timezone current_user data date_add date_diff date_format date_parse date_trunc day day_of_month day_of_week day_of_year deallocate default define definer degrees delete dense_rank deny desc describe descriptor distinct distributed dow doy drop e element_at else empty empty_approx_set encoding end error escape evaluate_classifier_predictions every except excluding execute exists exp explain extract false features fetch filter final first first_value flatten floor following for format format_datetime format_number from from_base from_base32 from_base64 from_base64url from_big_endian_32 from_big_endian_64 from_encoded_polyline from_geojson_geometry from_hex from_ieee754_32 from_ieee754_64 from_iso8601_date from_iso8601_timestamp from_iso8601_timestamp_nanos from_unixtime from_unixtime_nanos from_utf8 full functions geometric_mean geometry_from_hadoop_shape geometry_invalid_reason geometry_nearest_points geometry_to_bing_tiles geometry_union geometry_union_agg grant granted grants graphviz great_circle_distance greatest group grouping groups hamming_distance hash_counts having histogram hmac_md5 hmac_sha1 hmac_sha256 hmac_sha512 hour human_readable_seconds if ignore in including index infinity initial inner input insert intersect intersection_cardinality into inverse_beta_cdf inverse_normal_cdf invoker io is is_finite is_infinite is_json_scalar is_nan isolation jaccard_index join json_array json_array_contains json_array_get json_array_length json_exists json_extract json_extract_scalar json_format json_object json_parse json_query json_size json_value keep key keys kurtosis lag last last_day_of_month last_value lateral lead leading learn_classifier learn_libsvm_classifier learn_libsvm_regressor learn_regressor least left length level levenshtein_distance like limit line_interpolate_point line_interpolate_points line_locate_point listagg ln local localtime localtimestamp log log10 log2 logical lower lpad ltrim luhn_check make_set_digest map_agg map_concat map_entries map_filter map_from_entries map_keys map_union map_values map_zip_with match match_recognize matched matches materialized max max_by md5 measures merge merge_set_digest millisecond min min_by minute mod month multimap_agg multimap_from_entries murmur3 nan natural next nfc nfd nfkc nfkd ngrams no none none_match normal_cdf normalize not now nth_value ntile null nullif nulls numeric_histogram object objectid_timestamp of offset omit on one only option or order ordinality outer output over overflow parse_data_size parse_datetime parse_duration partition partitions passing past path pattern per percent_rank permute pi position pow power preceding prepare privileges properties prune qdigest_agg quarter quotes radians rand random range rank read recursive reduce reduce_agg refresh regexp_count regexp_extract regexp_extract_all regexp_like regexp_position regexp_replace regexp_split regr_intercept regr_slope regress rename render repeat repeatable replace reset respect restrict returning reverse revoke rgb right role roles rollback rollup round row_number rows rpad rtrim running scalar schema schemas second security seek select sequence serializable session set sets sha1 sha256 sha512 show shuffle sign simplify_geometry sin skewness skip slice some soundex spatial_partitioning spatial_partitions split split_part split_to_map split_to_multimap spooky_hash_v2_32 spooky_hash_v2_64 sqrt st_area st_asbinary st_astext st_boundary st_buffer st_centroid st_contains st_convexhull st_coorddim st_crosses st_difference st_dimension st_disjoint st_distance st_endpoint st_envelope st_envelopeaspts st_equals st_exteriorring st_geometries st_geometryfromtext st_geometryn st_geometrytype st_geomfrombinary st_interiorringn st_interiorrings st_intersection st_intersects st_isclosed st_isempty st_isring st_issimple st_isvalid st_length st_linefromtext st_linestring st_multipoint st_numgeometries st_numinteriorring st_numpoints st_overlaps st_point st_pointn st_points st_polygon st_relate st_startpoint st_symdifference st_touches st_union st_within st_x st_xmax st_xmin st_y st_ymax st_ymin start starts_with stats stddev stddev_pop stddev_samp string strpos subset substr substring sum system table tables tablesample tan tanh tdigest_agg text then ties timestamp_objectid timezone_hour timezone_minute to to_base to_base32 to_base64 to_base64url to_big_endian_32 to_big_endian_64 to_char to_date to_encoded_polyline to_geojson_geometry to_geometry to_hex to_ieee754_32 to_ieee754_64 to_iso8601 to_milliseconds to_spherical_geography to_timestamp to_unixtime to_utf8 trailing transaction transform transform_keys transform_values translate trim trim_array true truncate try try_cast type typeof uescape unbounded uncommitted unconditional union unique unknown unmatched unnest update upper url_decode url_encode url_extract_fragment url_extract_host url_extract_parameter url_extract_path url_extract_port url_extract_protocol url_extract_query use user using utf16 utf32 utf8 validate value value_at_quantile values values_at_quantiles var_pop var_samp variance verbose version view week week_of_year when where width_bucket wilson_interval_lower wilson_interval_upper window with with_timezone within without word_stem work wrapper write xxhash64 year year_of_week yow zip zip_with"),
		// https://github.com/trinodb/trino/blob/bc7a4eeedde28684c7ae6f74cefcaf7c6e782174/core/trino-main/src/main/java/io/trino/metadata/TypeRegistry.java#L131-L168
		// https://github.com/trinodb/trino/blob/bc7a4eeedde28684c7ae6f74cefcaf7c6e782174/plugin/trino-ml/src/main/java/io/trino/plugin/ml/MLPlugin.java#L35
		// https://github.com/trinodb/trino/blob/bc7a4eeedde28684c7ae6f74cefcaf7c6e782174/plugin/trino-mongodb/src/main/java/io/trino/plugin/mongodb/MongoPlugin.java#L32
		// https://github.com/trinodb/trino/blob/bc7a4eeedde28684c7ae6f74cefcaf7c6e782174/plugin/trino-geospatial/src/main/java/io/trino/plugin/geospatial/GeoPlugin.java#L37
		builtin: set("array bigint bingtile boolean char codepoints color date decimal double function geometry hyperloglog int integer interval ipaddress joniregexp json json2016 jsonpath kdbtree likepattern map model objectid p4hyperloglog precision qdigest re2jregexp real regressor row setdigest smallint sphericalgeography tdigest time timestamp tinyint uuid varbinary varchar zone"),
		atoms: set("false true null unknown"),
		// https://trino.io/docs/current/functions/list.html#id1
		operatorChars: /^[[\]|<>=!\-+*/%]/,
		dateSQL: set("date time timestamp zone"),
		// hexNumber is necessary for VARBINARY literals, e.g. X'65683F'
		// but it also enables 0xFF hex numbers, which Trino doesn't support.
		support: set("decimallessFloat zerolessFloat hexNumber")
	});
})();

(()=>{
    var Ua = Object.defineProperty;
    var Wa = (me,_e,o)=>_e in me ? Ua(me, _e, {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: o
    }) : me[_e] = o;
    var Ht = (me,_e,o)=>(Wa(me, typeof _e != "symbol" ? _e + "" : _e, o),
    o)
      , yt = (me,_e,o)=>{
        if (!_e.has(me))
            throw TypeError("Cannot " + o)
    }
    ;
    var K = (me,_e,o)=>(yt(me, _e, "read from private field"),
    o ? o.call(me) : _e.get(me))
      , Ee = (me,_e,o)=>{
        if (_e.has(me))
            throw TypeError("Cannot add the same private member more than once");
        _e instanceof WeakSet ? _e.add(me) : _e.set(me, o);
    }
      , Ae = (me,_e,o,Ie)=>(yt(me, _e, "write to private field"),
    Ie ? Ie.call(me, o) : _e.set(me, o),
    o);
    var rt = (me,_e,o)=>(yt(me, _e, "access private method"),
    o);
    var $e = (()=>{
        var me = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
        return function(_e={}) {
            var o = _e, Ie, Te;
            o.ready = new Promise((e,t)=>{
                Ie = e,
                Te = t;
            }
            );
            let Fe = globalThis.sqlite3InitModuleState || Object.assign(Object.create(null), {
                debugModule: ()=>{}
            });
            delete globalThis.sqlite3InitModuleState,
            Fe.debugModule("globalThis.location =", globalThis.location),
            o.locateFile = function(e, t) {
                "use strict";
                let r, i = this.urlParams;
                return i.has(e) ? r = i.get(e) : this.sqlite3Dir ? r = this.sqlite3Dir + e : this.scriptDir ? r = this.scriptDir + e : r = t + e,
                Fe.debugModule("locateFile(", arguments[0], ",", arguments[1], ")", "sqlite3InitModuleState.scriptDir =", this.scriptDir, "up.entries() =", Array.from(i.entries()), "result =", r),
                r
            }
            .bind(Fe);
            let Ke = "emscripten-bug-17951";
            o[Ke] = function e(t, r) {
                t.env.foo = function() {}
                ;
                let i = o.locateFile(e.uri, typeof xe > "u" ? "" : xe);
                Fe.debugModule("instantiateWasm() uri =", i);
                let n = ()=>fetch(i, {
                    credentials: "same-origin"
                });
                return (WebAssembly.instantiateStreaming ? async()=>WebAssembly.instantiateStreaming(n(), t).then(p=>r(p.instance, p.module)) : async()=>n().then(p=>p.arrayBuffer()).then(p=>WebAssembly.instantiate(p, t)).then(p=>r(p.instance, p.module)))(),
                {}
            }
            ,
            o[Ke].uri = "sqlite3.wasm";
            var vt = Object.assign({}, o)
              , Vt = []
              , wt = "./this.program"
              , Gt = (e,t)=>{
                throw t
            }
              , st = typeof window == "object"
              , je = typeof importScripts == "function"
              , $t = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string"
              , Qa = !st && !$t && !je
              , xe = "";
            function Kt(e) {
                return o.locateFile ? o.locateFile(e, xe) : xe + e
            }
            var it, Et, ot;
            (st || je) && (je ? xe = self.location.href : typeof document < "u" && document.currentScript && (xe = document.currentScript.src),
            me && (xe = me),
            xe.indexOf("blob:") !== 0 ? xe = xe.substr(0, xe.replace(/[?#].*/, "").lastIndexOf("/") + 1) : xe = "",
            it = e=>{
                var t = new XMLHttpRequest;
                return t.open("GET", e, !1),
                t.send(null),
                t.responseText
            }
            ,
            je && (ot = e=>{
                var t = new XMLHttpRequest;
                return t.open("GET", e, !1),
                t.responseType = "arraybuffer",
                t.send(null),
                new Uint8Array(t.response)
            }
            ),
            Et = (e,t,r)=>{
                var i = new XMLHttpRequest;
                i.open("GET", e, !0),
                i.responseType = "arraybuffer",
                i.onload = ()=>{
                    if (i.status == 200 || i.status == 0 && i.response) {
                        t(i.response);
                        return
                    }
                    r();
                }
                ,
                i.onerror = r,
                i.send(null);
            }
            );
            var at = o.print || console.log.bind(console)
              , Le = o.printErr || console.error.bind(console);
            Object.assign(o, vt),
            vt = null,
            o.arguments && (Vt = o.arguments),
            o.thisProgram && (wt = o.thisProgram),
            o.quit && (Gt = o.quit);
            var We;
            o.wasmBinary && (We = o.wasmBinary),
            typeof WebAssembly != "object" && Ce("no native wasm support detected");
            var De, xt = !1, Jt;
            function Ha(e, t) {
                e || Ce(t);
            }
            var Va, be, ze, Ne, Xt, fe, ge, lt, Se, Yt, ct;
            function St() {
                var e = De.buffer;
                o.HEAP8 = be = new Int8Array(e),
                o.HEAP16 = Ne = new Int16Array(e),
                o.HEAPU8 = ze = new Uint8Array(e),
                o.HEAPU16 = Xt = new Uint16Array(e),
                o.HEAP32 = fe = new Int32Array(e),
                o.HEAPU32 = ge = new Uint32Array(e),
                o.HEAPF32 = lt = new Float32Array(e),
                o.HEAPF64 = ct = new Float64Array(e),
                o.HEAP64 = Se = new BigInt64Array(e),
                o.HEAPU64 = Yt = new BigUint64Array(e);
            }
            var At = o.INITIAL_MEMORY || 16777216;
            o.wasmMemory ? De = o.wasmMemory : De = new WebAssembly.Memory({
                initial: At / 65536,
                maximum: 32768
            }),
            St(),
            At = De.buffer.byteLength;
            var It = []
              , kt = []
              , Ga = []
              , Tt = []
              , Zt = !1;
            function er() {
                if (o.preRun)
                    for (typeof o.preRun == "function" && (o.preRun = [o.preRun]); o.preRun.length; )
                        nr(o.preRun.shift());
                ft(It);
            }
            function tr() {
                Zt = !0,
                !o.noFSInit && !a.init.initialized && a.init(),
                a.ignorePermissions = !1,
                Re.init(),
                ft(kt);
            }
            function rr() {
                if (o.postRun)
                    for (typeof o.postRun == "function" && (o.postRun = [o.postRun]); o.postRun.length; )
                        ir(o.postRun.shift());
                ft(Tt);
            }
            function nr(e) {
                It.unshift(e);
            }
            function sr(e) {
                kt.unshift(e);
            }
            function $a(e) {}
            function ir(e) {
                Tt.unshift(e);
            }
            var Me = 0
              , _t = null
              , Qe = null;
            function Ka(e) {
                return e
            }
            function ut(e) {
                Me++,
                o.monitorRunDependencies?.(Me);
            }
            function Je(e) {
                if (Me--,
                o.monitorRunDependencies?.(Me),
                Me == 0 && (_t !== null && (clearInterval(_t),
                _t = null),
                Qe)) {
                    var t = Qe;
                    Qe = null,
                    t();
                }
            }
            function Ce(e) {
                o.onAbort?.(e),
                e = "Aborted(" + e + ")",
                Le(e),
                xt = !0,
                Jt = 1,
                e += ". Build with -sASSERTIONS for more info.";
                var t = new WebAssembly.RuntimeError(e);
                throw Te(t),
                t
            }
            var or = "data:application/octet-stream;base64,", Ft = e=>e.startsWith(or), Ja = e=>e.startsWith("file://"), Be;
            Be = "sqlite3.wasm",
            Ft(Be) || (Be = Kt(Be));
            function Ot(e) {
                if (e == Be && We)
                    return new Uint8Array(We);
                if (ot)
                    return ot(e);
                throw "both async and sync fetching of the wasm failed"
            }
            function ar(e) {
                return !We && (st || je) && typeof fetch == "function" ? fetch(e, {
                    credentials: "same-origin"
                }).then(t=>{
                    if (!t.ok)
                        throw "failed to load wasm binary file at '" + e + "'";
                    return t.arrayBuffer()
                }
                ).catch(()=>Ot(e)) : Promise.resolve().then(()=>Ot(e))
            }
            function Pt(e, t, r) {
                return ar(e).then(i=>WebAssembly.instantiate(i, t)).then(i=>i).then(r, i=>{
                    Le(`failed to asynchronously prepare wasm: ${i}`),
                    Ce(i);
                }
                )
            }
            function lr(e, t, r, i) {
                return !e && typeof WebAssembly.instantiateStreaming == "function" && !Ft(t) && typeof fetch == "function" ? fetch(t, {
                    credentials: "same-origin"
                }).then(n=>{
                    var s = WebAssembly.instantiateStreaming(n, r);
                    return s.then(i, function(p) {
                        return Le(`wasm streaming compile failed: ${p}`),
                        Le("falling back to ArrayBuffer instantiation"),
                        Pt(t, r, i)
                    })
                }
                ) : Pt(t, r, i)
            }
            function cr() {
                var e = {
                    env: zt,
                    wasi_snapshot_preview1: zt
                };
                function t(i, n) {
                    return b = i.exports,
                    sr(b.__wasm_call_ctors),
                    Je("wasm-instantiate"),
                    b
                }
                ut("wasm-instantiate");
                function r(i) {
                    t(i.instance);
                }
                if (o.instantiateWasm)
                    try {
                        return o.instantiateWasm(e, t)
                    } catch (i) {
                        Le(`Module.instantiateWasm callback failed with error: ${i}`),
                        Te(i);
                    }
                return lr(We, Be, e, r).catch(Te),
                {}
            }
            function Xa(e) {
                this.name = "ExitStatus",
                this.message = `Program terminated with exit(${e})`,
                this.status = e;
            }
            var ft = e=>{
                for (; e.length > 0; )
                    e.shift()(o);
            }
            ;
            function Ya(e, t="i8") {
                switch (t.endsWith("*") && (t = "*"),
                t) {
                case "i1":
                    return be[e >> 0];
                case "i8":
                    return be[e >> 0];
                case "i16":
                    return Ne[e >> 1];
                case "i32":
                    return fe[e >> 2];
                case "i64":
                    return Se[e >> 3];
                case "float":
                    return lt[e >> 2];
                case "double":
                    return ct[e >> 3];
                case "*":
                    return ge[e >> 2];
                default:
                    Ce(`invalid type for getValue: ${t}`);
                }
            }
            var Za = o.noExitRuntime || !0;
            function el(e, t, r="i8") {
                switch (r.endsWith("*") && (r = "*"),
                r) {
                case "i1":
                    be[e >> 0] = t;
                    break;
                case "i8":
                    be[e >> 0] = t;
                    break;
                case "i16":
                    Ne[e >> 1] = t;
                    break;
                case "i32":
                    fe[e >> 2] = t;
                    break;
                case "i64":
                    Se[e >> 3] = BigInt(t);
                    break;
                case "float":
                    lt[e >> 2] = t;
                    break;
                case "double":
                    ct[e >> 3] = t;
                    break;
                case "*":
                    ge[e >> 2] = t;
                    break;
                default:
                    Ce(`invalid type for setValue: ${r}`);
                }
            }
            var Lt = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0
              , Ue = (e,t,r)=>{
                for (var i = t + r, n = t; e[n] && !(n >= i); )
                    ++n;
                if (n - t > 16 && e.buffer && Lt)
                    return Lt.decode(e.subarray(t, n));
                for (var s = ""; t < n; ) {
                    var p = e[t++];
                    if (!(p & 128)) {
                        s += String.fromCharCode(p);
                        continue
                    }
                    var y = e[t++] & 63;
                    if ((p & 224) == 192) {
                        s += String.fromCharCode((p & 31) << 6 | y);
                        continue
                    }
                    var O = e[t++] & 63;
                    if ((p & 240) == 224 ? p = (p & 15) << 12 | y << 6 | O : p = (p & 7) << 18 | y << 12 | O << 6 | e[t++] & 63,
                    p < 65536)
                        s += String.fromCharCode(p);
                    else {
                        var B = p - 65536;
                        s += String.fromCharCode(55296 | B >> 10, 56320 | B & 1023);
                    }
                }
                return s
            }
              , Xe = (e,t)=>e ? Ue(ze, e, t) : ""
              , _r = (e,t,r,i)=>{
                Ce(`Assertion failed: ${Xe(e)}, at: ` + [t ? Xe(t) : "unknown filename", r, i ? Xe(i) : "unknown function"]);
            }
              , pe = {
                isAbs: e=>e.charAt(0) === "/",
                splitPath: e=>{
                    var t = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
                    return t.exec(e).slice(1)
                }
                ,
                normalizeArray: (e,t)=>{
                    for (var r = 0, i = e.length - 1; i >= 0; i--) {
                        var n = e[i];
                        n === "." ? e.splice(i, 1) : n === ".." ? (e.splice(i, 1),
                        r++) : r && (e.splice(i, 1),
                        r--);
                    }
                    if (t)
                        for (; r; r--)
                            e.unshift("..");
                    return e
                }
                ,
                normalize: e=>{
                    var t = pe.isAbs(e)
                      , r = e.substr(-1) === "/";
                    return e = pe.normalizeArray(e.split("/").filter(i=>!!i), !t).join("/"),
                    !e && !t && (e = "."),
                    e && r && (e += "/"),
                    (t ? "/" : "") + e
                }
                ,
                dirname: e=>{
                    var t = pe.splitPath(e)
                      , r = t[0]
                      , i = t[1];
                    return !r && !i ? "." : (i && (i = i.substr(0, i.length - 1)),
                    r + i)
                }
                ,
                basename: e=>{
                    if (e === "/")
                        return "/";
                    e = pe.normalize(e),
                    e = e.replace(/\/$/, "");
                    var t = e.lastIndexOf("/");
                    return t === -1 ? e : e.substr(t + 1)
                }
                ,
                join: function() {
                    var e = Array.prototype.slice.call(arguments);
                    return pe.normalize(e.join("/"))
                },
                join2: (e,t)=>pe.normalize(e + "/" + t)
            }
              , ur = ()=>{
                if (typeof crypto == "object" && typeof crypto.getRandomValues == "function")
                    return e=>crypto.getRandomValues(e);
                Ce("initRandomDevice");
            }
              , Dt = e=>(Dt = ur())(e)
              , Oe = {
                resolve: function() {
                    for (var e = "", t = !1, r = arguments.length - 1; r >= -1 && !t; r--) {
                        var i = r >= 0 ? arguments[r] : a.cwd();
                        if (typeof i != "string")
                            throw new TypeError("Arguments to path.resolve must be strings");
                        if (!i)
                            return "";
                        e = i + "/" + e,
                        t = pe.isAbs(i);
                    }
                    return e = pe.normalizeArray(e.split("/").filter(n=>!!n), !t).join("/"),
                    (t ? "/" : "") + e || "."
                },
                relative: (e,t)=>{
                    e = Oe.resolve(e).substr(1),
                    t = Oe.resolve(t).substr(1);
                    function r(B) {
                        for (var G = 0; G < B.length && B[G] === ""; G++)
                            ;
                        for (var J = B.length - 1; J >= 0 && B[J] === ""; J--)
                            ;
                        return G > J ? [] : B.slice(G, J - G + 1)
                    }
                    for (var i = r(e.split("/")), n = r(t.split("/")), s = Math.min(i.length, n.length), p = s, y = 0; y < s; y++)
                        if (i[y] !== n[y]) {
                            p = y;
                            break
                        }
                    for (var O = [], y = p; y < i.length; y++)
                        O.push("..");
                    return O = O.concat(n.slice(p)),
                    O.join("/")
                }
            }
              , dt = []
              , He = e=>{
                for (var t = 0, r = 0; r < e.length; ++r) {
                    var i = e.charCodeAt(r);
                    i <= 127 ? t++ : i <= 2047 ? t += 2 : i >= 55296 && i <= 57343 ? (t += 4,
                    ++r) : t += 3;
                }
                return t
            }
              , pt = (e,t,r,i)=>{
                if (!(i > 0))
                    return 0;
                for (var n = r, s = r + i - 1, p = 0; p < e.length; ++p) {
                    var y = e.charCodeAt(p);
                    if (y >= 55296 && y <= 57343) {
                        var O = e.charCodeAt(++p);
                        y = 65536 + ((y & 1023) << 10) | O & 1023;
                    }
                    if (y <= 127) {
                        if (r >= s)
                            break;
                        t[r++] = y;
                    } else if (y <= 2047) {
                        if (r + 1 >= s)
                            break;
                        t[r++] = 192 | y >> 6,
                        t[r++] = 128 | y & 63;
                    } else if (y <= 65535) {
                        if (r + 2 >= s)
                            break;
                        t[r++] = 224 | y >> 12,
                        t[r++] = 128 | y >> 6 & 63,
                        t[r++] = 128 | y & 63;
                    } else {
                        if (r + 3 >= s)
                            break;
                        t[r++] = 240 | y >> 18,
                        t[r++] = 128 | y >> 12 & 63,
                        t[r++] = 128 | y >> 6 & 63,
                        t[r++] = 128 | y & 63;
                    }
                }
                return t[r] = 0,
                r - n
            }
            ;
            function mt(e, t, r) {
                var i = r > 0 ? r : He(e) + 1
                  , n = new Array(i)
                  , s = pt(e, n, 0, n.length);
                return t && (n.length = s),
                n
            }
            var fr = ()=>{
                if (!dt.length) {
                    var e = null;
                    if (typeof window < "u" && typeof window.prompt == "function" ? (e = window.prompt("Input: "),
                    e !== null && (e += `
`)) : typeof readline == "function" && (e = readline(),
                    e !== null && (e += `
`)),
                    !e)
                        return null;
                    dt = mt(e, !0);
                }
                return dt.shift()
            }
              , Re = {
                ttys: [],
                init() {},
                shutdown() {},
                register(e, t) {
                    Re.ttys[e] = {
                        input: [],
                        output: [],
                        ops: t
                    },
                    a.registerDevice(e, Re.stream_ops);
                },
                stream_ops: {
                    open(e) {
                        var t = Re.ttys[e.node.rdev];
                        if (!t)
                            throw new a.ErrnoError(43);
                        e.tty = t,
                        e.seekable = !1;
                    },
                    close(e) {
                        e.tty.ops.fsync(e.tty);
                    },
                    fsync(e) {
                        e.tty.ops.fsync(e.tty);
                    },
                    read(e, t, r, i, n) {
                        if (!e.tty || !e.tty.ops.get_char)
                            throw new a.ErrnoError(60);
                        for (var s = 0, p = 0; p < i; p++) {
                            var y;
                            try {
                                y = e.tty.ops.get_char(e.tty);
                            } catch {
                                throw new a.ErrnoError(29)
                            }
                            if (y === void 0 && s === 0)
                                throw new a.ErrnoError(6);
                            if (y == null)
                                break;
                            s++,
                            t[r + p] = y;
                        }
                        return s && (e.node.timestamp = Date.now()),
                        s
                    },
                    write(e, t, r, i, n) {
                        if (!e.tty || !e.tty.ops.put_char)
                            throw new a.ErrnoError(60);
                        try {
                            for (var s = 0; s < i; s++)
                                e.tty.ops.put_char(e.tty, t[r + s]);
                        } catch {
                            throw new a.ErrnoError(29)
                        }
                        return i && (e.node.timestamp = Date.now()),
                        s
                    }
                },
                default_tty_ops: {
                    get_char(e) {
                        return fr()
                    },
                    put_char(e, t) {
                        t === null || t === 10 ? (at(Ue(e.output, 0)),
                        e.output = []) : t != 0 && e.output.push(t);
                    },
                    fsync(e) {
                        e.output && e.output.length > 0 && (at(Ue(e.output, 0)),
                        e.output = []);
                    },
                    ioctl_tcgets(e) {
                        return {
                            c_iflag: 25856,
                            c_oflag: 5,
                            c_cflag: 191,
                            c_lflag: 35387,
                            c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                        }
                    },
                    ioctl_tcsets(e, t, r) {
                        return 0
                    },
                    ioctl_tiocgwinsz(e) {
                        return [24, 80]
                    }
                },
                default_tty1_ops: {
                    put_char(e, t) {
                        t === null || t === 10 ? (Le(Ue(e.output, 0)),
                        e.output = []) : t != 0 && e.output.push(t);
                    },
                    fsync(e) {
                        e.output && e.output.length > 0 && (Le(Ue(e.output, 0)),
                        e.output = []);
                    }
                }
            }
              , dr = (e,t)=>(ze.fill(0, e, e + t),
            e)
              , pr = (e,t)=>Math.ceil(e / t) * t
              , Ct = e=>{
                e = pr(e, 65536);
                var t = Ut(65536, e);
                return t ? dr(t, e) : 0
            }
              , oe = {
                ops_table: null,
                mount(e) {
                    return oe.createNode(null, "/", 16895, 0)
                },
                createNode(e, t, r, i) {
                    if (a.isBlkdev(r) || a.isFIFO(r))
                        throw new a.ErrnoError(63);
                    oe.ops_table ||= {
                        dir: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr,
                                lookup: oe.node_ops.lookup,
                                mknod: oe.node_ops.mknod,
                                rename: oe.node_ops.rename,
                                unlink: oe.node_ops.unlink,
                                rmdir: oe.node_ops.rmdir,
                                readdir: oe.node_ops.readdir,
                                symlink: oe.node_ops.symlink
                            },
                            stream: {
                                llseek: oe.stream_ops.llseek
                            }
                        },
                        file: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr
                            },
                            stream: {
                                llseek: oe.stream_ops.llseek,
                                read: oe.stream_ops.read,
                                write: oe.stream_ops.write,
                                allocate: oe.stream_ops.allocate,
                                mmap: oe.stream_ops.mmap,
                                msync: oe.stream_ops.msync
                            }
                        },
                        link: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr,
                                readlink: oe.node_ops.readlink
                            },
                            stream: {}
                        },
                        chrdev: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr
                            },
                            stream: a.chrdev_stream_ops
                        }
                    };
                    var n = a.createNode(e, t, r, i);
                    return a.isDir(n.mode) ? (n.node_ops = oe.ops_table.dir.node,
                    n.stream_ops = oe.ops_table.dir.stream,
                    n.contents = {}) : a.isFile(n.mode) ? (n.node_ops = oe.ops_table.file.node,
                    n.stream_ops = oe.ops_table.file.stream,
                    n.usedBytes = 0,
                    n.contents = null) : a.isLink(n.mode) ? (n.node_ops = oe.ops_table.link.node,
                    n.stream_ops = oe.ops_table.link.stream) : a.isChrdev(n.mode) && (n.node_ops = oe.ops_table.chrdev.node,
                    n.stream_ops = oe.ops_table.chrdev.stream),
                    n.timestamp = Date.now(),
                    e && (e.contents[t] = n,
                    e.timestamp = n.timestamp),
                    n
                },
                getFileDataAsTypedArray(e) {
                    return e.contents ? e.contents.subarray ? e.contents.subarray(0, e.usedBytes) : new Uint8Array(e.contents) : new Uint8Array(0)
                },
                expandFileStorage(e, t) {
                    var r = e.contents ? e.contents.length : 0;
                    if (!(r >= t)) {
                        var i = 1024 * 1024;
                        t = Math.max(t, r * (r < i ? 2 : 1.125) >>> 0),
                        r != 0 && (t = Math.max(t, 256));
                        var n = e.contents;
                        e.contents = new Uint8Array(t),
                        e.usedBytes > 0 && e.contents.set(n.subarray(0, e.usedBytes), 0);
                    }
                },
                resizeFileStorage(e, t) {
                    if (e.usedBytes != t)
                        if (t == 0)
                            e.contents = null,
                            e.usedBytes = 0;
                        else {
                            var r = e.contents;
                            e.contents = new Uint8Array(t),
                            r && e.contents.set(r.subarray(0, Math.min(t, e.usedBytes))),
                            e.usedBytes = t;
                        }
                },
                node_ops: {
                    getattr(e) {
                        var t = {};
                        return t.dev = a.isChrdev(e.mode) ? e.id : 1,
                        t.ino = e.id,
                        t.mode = e.mode,
                        t.nlink = 1,
                        t.uid = 0,
                        t.gid = 0,
                        t.rdev = e.rdev,
                        a.isDir(e.mode) ? t.size = 4096 : a.isFile(e.mode) ? t.size = e.usedBytes : a.isLink(e.mode) ? t.size = e.link.length : t.size = 0,
                        t.atime = new Date(e.timestamp),
                        t.mtime = new Date(e.timestamp),
                        t.ctime = new Date(e.timestamp),
                        t.blksize = 4096,
                        t.blocks = Math.ceil(t.size / t.blksize),
                        t
                    },
                    setattr(e, t) {
                        t.mode !== void 0 && (e.mode = t.mode),
                        t.timestamp !== void 0 && (e.timestamp = t.timestamp),
                        t.size !== void 0 && oe.resizeFileStorage(e, t.size);
                    },
                    lookup(e, t) {
                        throw a.genericErrors[44]
                    },
                    mknod(e, t, r, i) {
                        return oe.createNode(e, t, r, i)
                    },
                    rename(e, t, r) {
                        if (a.isDir(e.mode)) {
                            var i;
                            try {
                                i = a.lookupNode(t, r);
                            } catch {}
                            if (i)
                                for (var n in i.contents)
                                    throw new a.ErrnoError(55)
                        }
                        delete e.parent.contents[e.name],
                        e.parent.timestamp = Date.now(),
                        e.name = r,
                        t.contents[r] = e,
                        t.timestamp = e.parent.timestamp,
                        e.parent = t;
                    },
                    unlink(e, t) {
                        delete e.contents[t],
                        e.timestamp = Date.now();
                    },
                    rmdir(e, t) {
                        var r = a.lookupNode(e, t);
                        for (var i in r.contents)
                            throw new a.ErrnoError(55);
                        delete e.contents[t],
                        e.timestamp = Date.now();
                    },
                    readdir(e) {
                        var t = [".", ".."];
                        for (var r of Object.keys(e.contents))
                            t.push(r);
                        return t
                    },
                    symlink(e, t, r) {
                        var i = oe.createNode(e, t, 41471, 0);
                        return i.link = r,
                        i
                    },
                    readlink(e) {
                        if (!a.isLink(e.mode))
                            throw new a.ErrnoError(28);
                        return e.link
                    }
                },
                stream_ops: {
                    read(e, t, r, i, n) {
                        var s = e.node.contents;
                        if (n >= e.node.usedBytes)
                            return 0;
                        var p = Math.min(e.node.usedBytes - n, i);
                        if (p > 8 && s.subarray)
                            t.set(s.subarray(n, n + p), r);
                        else
                            for (var y = 0; y < p; y++)
                                t[r + y] = s[n + y];
                        return p
                    },
                    write(e, t, r, i, n, s) {
                        if (t.buffer === be.buffer && (s = !1),
                        !i)
                            return 0;
                        var p = e.node;
                        if (p.timestamp = Date.now(),
                        t.subarray && (!p.contents || p.contents.subarray)) {
                            if (s)
                                return p.contents = t.subarray(r, r + i),
                                p.usedBytes = i,
                                i;
                            if (p.usedBytes === 0 && n === 0)
                                return p.contents = t.slice(r, r + i),
                                p.usedBytes = i,
                                i;
                            if (n + i <= p.usedBytes)
                                return p.contents.set(t.subarray(r, r + i), n),
                                i
                        }
                        if (oe.expandFileStorage(p, n + i),
                        p.contents.subarray && t.subarray)
                            p.contents.set(t.subarray(r, r + i), n);
                        else
                            for (var y = 0; y < i; y++)
                                p.contents[n + y] = t[r + y];
                        return p.usedBytes = Math.max(p.usedBytes, n + i),
                        i
                    },
                    llseek(e, t, r) {
                        var i = t;
                        if (r === 1 ? i += e.position : r === 2 && a.isFile(e.node.mode) && (i += e.node.usedBytes),
                        i < 0)
                            throw new a.ErrnoError(28);
                        return i
                    },
                    allocate(e, t, r) {
                        oe.expandFileStorage(e.node, t + r),
                        e.node.usedBytes = Math.max(e.node.usedBytes, t + r);
                    },
                    mmap(e, t, r, i, n) {
                        if (!a.isFile(e.node.mode))
                            throw new a.ErrnoError(43);
                        var s, p, y = e.node.contents;
                        if (!(n & 2) && y.buffer === be.buffer)
                            p = !1,
                            s = y.byteOffset;
                        else {
                            if ((r > 0 || r + t < y.length) && (y.subarray ? y = y.subarray(r, r + t) : y = Array.prototype.slice.call(y, r, r + t)),
                            p = !0,
                            s = Ct(t),
                            !s)
                                throw new a.ErrnoError(48);
                            be.set(y, s);
                        }
                        return {
                            ptr: s,
                            allocated: p
                        }
                    },
                    msync(e, t, r, i, n) {
                        return oe.stream_ops.write(e, t, 0, i, r, !1),
                        0
                    }
                }
            }
              , mr = (e,t,r,i)=>{
                var n = i ? "" : `al ${e}`;
                Et(e, s=>{
                    t(new Uint8Array(s)),
                    n && Je(n);
                }
                , s=>{
                    if (r)
                        r();
                    else
                        throw `Loading data file "${e}" failed.`
                }
                ),
                n && ut(n);
            }
              , hr = (e,t,r,i,n,s)=>{
                a.createDataFile(e, t, r, i, n, s);
            }
              , gr = o.preloadPlugins || []
              , qr = (e,t,r,i)=>{
                typeof Browser < "u" && Browser.init();
                var n = !1;
                return gr.forEach(s=>{
                    n || s.canHandle(t) && (s.handle(e, t, r, i),
                    n = !0);
                }
                ),
                n
            }
              , br = (e,t,r,i,n,s,p,y,O,B)=>{
                var G = t ? Oe.resolve(pe.join2(e, t)) : e
                  , J = `cp ${G}`;
                function Y(d) {
                    function f(m) {
                        B?.(),
                        y || hr(e, t, m, i, n, O),
                        s?.(),
                        Je(J);
                    }
                    qr(d, G, f, ()=>{
                        p?.(),
                        Je(J);
                    }
                    ) || f(d);
                }
                ut(J),
                typeof r == "string" ? mr(r, Y, p) : Y(r);
            }
              , yr = e=>{
                var t = {
                    r: 0,
                    "r+": 2,
                    w: 577,
                    "w+": 578,
                    a: 1089,
                    "a+": 1090
                }
                  , r = t[e];
                if (typeof r > "u")
                    throw new Error(`Unknown file open mode: ${e}`);
                return r
            }
              , ht = (e,t)=>{
                var r = 0;
                return e && (r |= 365),
                t && (r |= 146),
                r
            }
              , a = {
                root: null,
                mounts: [],
                devices: {},
                streams: [],
                nextInode: 1,
                nameTable: null,
                currentPath: "/",
                initialized: !1,
                ignorePermissions: !0,
                ErrnoError: null,
                genericErrors: {},
                filesystems: null,
                syncFSRequests: 0,
                lookupPath(e, t={}) {
                    if (e = Oe.resolve(e),
                    !e)
                        return {
                            path: "",
                            node: null
                        };
                    var r = {
                        follow_mount: !0,
                        recurse_count: 0
                    };
                    if (t = Object.assign(r, t),
                    t.recurse_count > 8)
                        throw new a.ErrnoError(32);
                    for (var i = e.split("/").filter(J=>!!J), n = a.root, s = "/", p = 0; p < i.length; p++) {
                        var y = p === i.length - 1;
                        if (y && t.parent)
                            break;
                        if (n = a.lookupNode(n, i[p]),
                        s = pe.join2(s, i[p]),
                        a.isMountpoint(n) && (!y || y && t.follow_mount) && (n = n.mounted.root),
                        !y || t.follow)
                            for (var O = 0; a.isLink(n.mode); ) {
                                var B = a.readlink(s);
                                s = Oe.resolve(pe.dirname(s), B);
                                var G = a.lookupPath(s, {
                                    recurse_count: t.recurse_count + 1
                                });
                                if (n = G.node,
                                O++ > 40)
                                    throw new a.ErrnoError(32)
                            }
                    }
                    return {
                        path: s,
                        node: n
                    }
                },
                getPath(e) {
                    for (var t; ; ) {
                        if (a.isRoot(e)) {
                            var r = e.mount.mountpoint;
                            return t ? r[r.length - 1] !== "/" ? `${r}/${t}` : r + t : r
                        }
                        t = t ? `${e.name}/${t}` : e.name,
                        e = e.parent;
                    }
                },
                hashName(e, t) {
                    for (var r = 0, i = 0; i < t.length; i++)
                        r = (r << 5) - r + t.charCodeAt(i) | 0;
                    return (e + r >>> 0) % a.nameTable.length
                },
                hashAddNode(e) {
                    var t = a.hashName(e.parent.id, e.name);
                    e.name_next = a.nameTable[t],
                    a.nameTable[t] = e;
                },
                hashRemoveNode(e) {
                    var t = a.hashName(e.parent.id, e.name);
                    if (a.nameTable[t] === e)
                        a.nameTable[t] = e.name_next;
                    else
                        for (var r = a.nameTable[t]; r; ) {
                            if (r.name_next === e) {
                                r.name_next = e.name_next;
                                break
                            }
                            r = r.name_next;
                        }
                },
                lookupNode(e, t) {
                    var r = a.mayLookup(e);
                    if (r)
                        throw new a.ErrnoError(r,e);
                    for (var i = a.hashName(e.id, t), n = a.nameTable[i]; n; n = n.name_next) {
                        var s = n.name;
                        if (n.parent.id === e.id && s === t)
                            return n
                    }
                    return a.lookup(e, t)
                },
                createNode(e, t, r, i) {
                    var n = new a.FSNode(e,t,r,i);
                    return a.hashAddNode(n),
                    n
                },
                destroyNode(e) {
                    a.hashRemoveNode(e);
                },
                isRoot(e) {
                    return e === e.parent
                },
                isMountpoint(e) {
                    return !!e.mounted
                },
                isFile(e) {
                    return (e & 61440) === 32768
                },
                isDir(e) {
                    return (e & 61440) === 16384
                },
                isLink(e) {
                    return (e & 61440) === 40960
                },
                isChrdev(e) {
                    return (e & 61440) === 8192
                },
                isBlkdev(e) {
                    return (e & 61440) === 24576
                },
                isFIFO(e) {
                    return (e & 61440) === 4096
                },
                isSocket(e) {
                    return (e & 49152) === 49152
                },
                flagsToPermissionString(e) {
                    var t = ["r", "w", "rw"][e & 3];
                    return e & 512 && (t += "w"),
                    t
                },
                nodePermissions(e, t) {
                    return a.ignorePermissions ? 0 : t.includes("r") && !(e.mode & 292) || t.includes("w") && !(e.mode & 146) || t.includes("x") && !(e.mode & 73) ? 2 : 0
                },
                mayLookup(e) {
                    var t = a.nodePermissions(e, "x");
                    return t || (e.node_ops.lookup ? 0 : 2)
                },
                mayCreate(e, t) {
                    try {
                        var r = a.lookupNode(e, t);
                        return 20
                    } catch {}
                    return a.nodePermissions(e, "wx")
                },
                mayDelete(e, t, r) {
                    var i;
                    try {
                        i = a.lookupNode(e, t);
                    } catch (s) {
                        return s.errno
                    }
                    var n = a.nodePermissions(e, "wx");
                    if (n)
                        return n;
                    if (r) {
                        if (!a.isDir(i.mode))
                            return 54;
                        if (a.isRoot(i) || a.getPath(i) === a.cwd())
                            return 10
                    } else if (a.isDir(i.mode))
                        return 31;
                    return 0
                },
                mayOpen(e, t) {
                    return e ? a.isLink(e.mode) ? 32 : a.isDir(e.mode) && (a.flagsToPermissionString(t) !== "r" || t & 512) ? 31 : a.nodePermissions(e, a.flagsToPermissionString(t)) : 44
                },
                MAX_OPEN_FDS: 4096,
                nextfd() {
                    for (var e = 0; e <= a.MAX_OPEN_FDS; e++)
                        if (!a.streams[e])
                            return e;
                    throw new a.ErrnoError(33)
                },
                getStreamChecked(e) {
                    var t = a.getStream(e);
                    if (!t)
                        throw new a.ErrnoError(8);
                    return t
                },
                getStream: e=>a.streams[e],
                createStream(e, t=-1) {
                    return a.FSStream || (a.FSStream = function() {
                        this.shared = {};
                    }
                    ,
                    a.FSStream.prototype = {},
                    Object.defineProperties(a.FSStream.prototype, {
                        object: {
                            get() {
                                return this.node
                            },
                            set(r) {
                                this.node = r;
                            }
                        },
                        isRead: {
                            get() {
                                return (this.flags & 2097155) !== 1
                            }
                        },
                        isWrite: {
                            get() {
                                return (this.flags & 2097155) !== 0
                            }
                        },
                        isAppend: {
                            get() {
                                return this.flags & 1024
                            }
                        },
                        flags: {
                            get() {
                                return this.shared.flags
                            },
                            set(r) {
                                this.shared.flags = r;
                            }
                        },
                        position: {
                            get() {
                                return this.shared.position
                            },
                            set(r) {
                                this.shared.position = r;
                            }
                        }
                    })),
                    e = Object.assign(new a.FSStream, e),
                    t == -1 && (t = a.nextfd()),
                    e.fd = t,
                    a.streams[t] = e,
                    e
                },
                closeStream(e) {
                    a.streams[e] = null;
                },
                chrdev_stream_ops: {
                    open(e) {
                        var t = a.getDevice(e.node.rdev);
                        e.stream_ops = t.stream_ops,
                        e.stream_ops.open?.(e);
                    },
                    llseek() {
                        throw new a.ErrnoError(70)
                    }
                },
                major: e=>e >> 8,
                minor: e=>e & 255,
                makedev: (e,t)=>e << 8 | t,
                registerDevice(e, t) {
                    a.devices[e] = {
                        stream_ops: t
                    };
                },
                getDevice: e=>a.devices[e],
                getMounts(e) {
                    for (var t = [], r = [e]; r.length; ) {
                        var i = r.pop();
                        t.push(i),
                        r.push.apply(r, i.mounts);
                    }
                    return t
                },
                syncfs(e, t) {
                    typeof e == "function" && (t = e,
                    e = !1),
                    a.syncFSRequests++,
                    a.syncFSRequests > 1 && Le(`warning: ${a.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
                    var r = a.getMounts(a.root.mount)
                      , i = 0;
                    function n(p) {
                        return a.syncFSRequests--,
                        t(p)
                    }
                    function s(p) {
                        if (p)
                            return s.errored ? void 0 : (s.errored = !0,
                            n(p));
                        ++i >= r.length && n(null);
                    }
                    r.forEach(p=>{
                        if (!p.type.syncfs)
                            return s(null);
                        p.type.syncfs(p, e, s);
                    }
                    );
                },
                mount(e, t, r) {
                    var i = r === "/", n = !r, s;
                    if (i && a.root)
                        throw new a.ErrnoError(10);
                    if (!i && !n) {
                        var p = a.lookupPath(r, {
                            follow_mount: !1
                        });
                        if (r = p.path,
                        s = p.node,
                        a.isMountpoint(s))
                            throw new a.ErrnoError(10);
                        if (!a.isDir(s.mode))
                            throw new a.ErrnoError(54)
                    }
                    var y = {
                        type: e,
                        opts: t,
                        mountpoint: r,
                        mounts: []
                    }
                      , O = e.mount(y);
                    return O.mount = y,
                    y.root = O,
                    i ? a.root = O : s && (s.mounted = y,
                    s.mount && s.mount.mounts.push(y)),
                    O
                },
                unmount(e) {
                    var t = a.lookupPath(e, {
                        follow_mount: !1
                    });
                    if (!a.isMountpoint(t.node))
                        throw new a.ErrnoError(28);
                    var r = t.node
                      , i = r.mounted
                      , n = a.getMounts(i);
                    Object.keys(a.nameTable).forEach(p=>{
                        for (var y = a.nameTable[p]; y; ) {
                            var O = y.name_next;
                            n.includes(y.mount) && a.destroyNode(y),
                            y = O;
                        }
                    }
                    ),
                    r.mounted = null;
                    var s = r.mount.mounts.indexOf(i);
                    r.mount.mounts.splice(s, 1);
                },
                lookup(e, t) {
                    return e.node_ops.lookup(e, t)
                },
                mknod(e, t, r) {
                    var i = a.lookupPath(e, {
                        parent: !0
                    })
                      , n = i.node
                      , s = pe.basename(e);
                    if (!s || s === "." || s === "..")
                        throw new a.ErrnoError(28);
                    var p = a.mayCreate(n, s);
                    if (p)
                        throw new a.ErrnoError(p);
                    if (!n.node_ops.mknod)
                        throw new a.ErrnoError(63);
                    return n.node_ops.mknod(n, s, t, r)
                },
                create(e, t) {
                    return t = t !== void 0 ? t : 438,
                    t &= 4095,
                    t |= 32768,
                    a.mknod(e, t, 0)
                },
                mkdir(e, t) {
                    return t = t !== void 0 ? t : 511,
                    t &= 1023,
                    t |= 16384,
                    a.mknod(e, t, 0)
                },
                mkdirTree(e, t) {
                    for (var r = e.split("/"), i = "", n = 0; n < r.length; ++n)
                        if (r[n]) {
                            i += "/" + r[n];
                            try {
                                a.mkdir(i, t);
                            } catch (s) {
                                if (s.errno != 20)
                                    throw s
                            }
                        }
                },
                mkdev(e, t, r) {
                    return typeof r > "u" && (r = t,
                    t = 438),
                    t |= 8192,
                    a.mknod(e, t, r)
                },
                symlink(e, t) {
                    if (!Oe.resolve(e))
                        throw new a.ErrnoError(44);
                    var r = a.lookupPath(t, {
                        parent: !0
                    })
                      , i = r.node;
                    if (!i)
                        throw new a.ErrnoError(44);
                    var n = pe.basename(t)
                      , s = a.mayCreate(i, n);
                    if (s)
                        throw new a.ErrnoError(s);
                    if (!i.node_ops.symlink)
                        throw new a.ErrnoError(63);
                    return i.node_ops.symlink(i, n, e)
                },
                rename(e, t) {
                    var r = pe.dirname(e), i = pe.dirname(t), n = pe.basename(e), s = pe.basename(t), p, y, O;
                    if (p = a.lookupPath(e, {
                        parent: !0
                    }),
                    y = p.node,
                    p = a.lookupPath(t, {
                        parent: !0
                    }),
                    O = p.node,
                    !y || !O)
                        throw new a.ErrnoError(44);
                    if (y.mount !== O.mount)
                        throw new a.ErrnoError(75);
                    var B = a.lookupNode(y, n)
                      , G = Oe.relative(e, i);
                    if (G.charAt(0) !== ".")
                        throw new a.ErrnoError(28);
                    if (G = Oe.relative(t, r),
                    G.charAt(0) !== ".")
                        throw new a.ErrnoError(55);
                    var J;
                    try {
                        J = a.lookupNode(O, s);
                    } catch {}
                    if (B !== J) {
                        var Y = a.isDir(B.mode)
                          , d = a.mayDelete(y, n, Y);
                        if (d)
                            throw new a.ErrnoError(d);
                        if (d = J ? a.mayDelete(O, s, Y) : a.mayCreate(O, s),
                        d)
                            throw new a.ErrnoError(d);
                        if (!y.node_ops.rename)
                            throw new a.ErrnoError(63);
                        if (a.isMountpoint(B) || J && a.isMountpoint(J))
                            throw new a.ErrnoError(10);
                        if (O !== y && (d = a.nodePermissions(y, "w"),
                        d))
                            throw new a.ErrnoError(d);
                        a.hashRemoveNode(B);
                        try {
                            y.node_ops.rename(B, O, s);
                        } catch (f) {
                            throw f
                        } finally {
                            a.hashAddNode(B);
                        }
                    }
                },
                rmdir(e) {
                    var t = a.lookupPath(e, {
                        parent: !0
                    })
                      , r = t.node
                      , i = pe.basename(e)
                      , n = a.lookupNode(r, i)
                      , s = a.mayDelete(r, i, !0);
                    if (s)
                        throw new a.ErrnoError(s);
                    if (!r.node_ops.rmdir)
                        throw new a.ErrnoError(63);
                    if (a.isMountpoint(n))
                        throw new a.ErrnoError(10);
                    r.node_ops.rmdir(r, i),
                    a.destroyNode(n);
                },
                readdir(e) {
                    var t = a.lookupPath(e, {
                        follow: !0
                    })
                      , r = t.node;
                    if (!r.node_ops.readdir)
                        throw new a.ErrnoError(54);
                    return r.node_ops.readdir(r)
                },
                unlink(e) {
                    var t = a.lookupPath(e, {
                        parent: !0
                    })
                      , r = t.node;
                    if (!r)
                        throw new a.ErrnoError(44);
                    var i = pe.basename(e)
                      , n = a.lookupNode(r, i)
                      , s = a.mayDelete(r, i, !1);
                    if (s)
                        throw new a.ErrnoError(s);
                    if (!r.node_ops.unlink)
                        throw new a.ErrnoError(63);
                    if (a.isMountpoint(n))
                        throw new a.ErrnoError(10);
                    r.node_ops.unlink(r, i),
                    a.destroyNode(n);
                },
                readlink(e) {
                    var t = a.lookupPath(e)
                      , r = t.node;
                    if (!r)
                        throw new a.ErrnoError(44);
                    if (!r.node_ops.readlink)
                        throw new a.ErrnoError(28);
                    return Oe.resolve(a.getPath(r.parent), r.node_ops.readlink(r))
                },
                stat(e, t) {
                    var r = a.lookupPath(e, {
                        follow: !t
                    })
                      , i = r.node;
                    if (!i)
                        throw new a.ErrnoError(44);
                    if (!i.node_ops.getattr)
                        throw new a.ErrnoError(63);
                    return i.node_ops.getattr(i)
                },
                lstat(e) {
                    return a.stat(e, !0)
                },
                chmod(e, t, r) {
                    var i;
                    if (typeof e == "string") {
                        var n = a.lookupPath(e, {
                            follow: !r
                        });
                        i = n.node;
                    } else
                        i = e;
                    if (!i.node_ops.setattr)
                        throw new a.ErrnoError(63);
                    i.node_ops.setattr(i, {
                        mode: t & 4095 | i.mode & -4096,
                        timestamp: Date.now()
                    });
                },
                lchmod(e, t) {
                    a.chmod(e, t, !0);
                },
                fchmod(e, t) {
                    var r = a.getStreamChecked(e);
                    a.chmod(r.node, t);
                },
                chown(e, t, r, i) {
                    var n;
                    if (typeof e == "string") {
                        var s = a.lookupPath(e, {
                            follow: !i
                        });
                        n = s.node;
                    } else
                        n = e;
                    if (!n.node_ops.setattr)
                        throw new a.ErrnoError(63);
                    n.node_ops.setattr(n, {
                        timestamp: Date.now()
                    });
                },
                lchown(e, t, r) {
                    a.chown(e, t, r, !0);
                },
                fchown(e, t, r) {
                    var i = a.getStreamChecked(e);
                    a.chown(i.node, t, r);
                },
                truncate(e, t) {
                    if (t < 0)
                        throw new a.ErrnoError(28);
                    var r;
                    if (typeof e == "string") {
                        var i = a.lookupPath(e, {
                            follow: !0
                        });
                        r = i.node;
                    } else
                        r = e;
                    if (!r.node_ops.setattr)
                        throw new a.ErrnoError(63);
                    if (a.isDir(r.mode))
                        throw new a.ErrnoError(31);
                    if (!a.isFile(r.mode))
                        throw new a.ErrnoError(28);
                    var n = a.nodePermissions(r, "w");
                    if (n)
                        throw new a.ErrnoError(n);
                    r.node_ops.setattr(r, {
                        size: t,
                        timestamp: Date.now()
                    });
                },
                ftruncate(e, t) {
                    var r = a.getStreamChecked(e);
                    if (!(r.flags & 2097155))
                        throw new a.ErrnoError(28);
                    a.truncate(r.node, t);
                },
                utime(e, t, r) {
                    var i = a.lookupPath(e, {
                        follow: !0
                    })
                      , n = i.node;
                    n.node_ops.setattr(n, {
                        timestamp: Math.max(t, r)
                    });
                },
                open(e, t, r) {
                    if (e === "")
                        throw new a.ErrnoError(44);
                    t = typeof t == "string" ? yr(t) : t,
                    r = typeof r > "u" ? 438 : r,
                    t & 64 ? r = r & 4095 | 32768 : r = 0;
                    var i;
                    if (typeof e == "object")
                        i = e;
                    else {
                        e = pe.normalize(e);
                        try {
                            var n = a.lookupPath(e, {
                                follow: !(t & 131072)
                            });
                            i = n.node;
                        } catch {}
                    }
                    var s = !1;
                    if (t & 64)
                        if (i) {
                            if (t & 128)
                                throw new a.ErrnoError(20)
                        } else
                            i = a.mknod(e, r, 0),
                            s = !0;
                    if (!i)
                        throw new a.ErrnoError(44);
                    if (a.isChrdev(i.mode) && (t &= -513),
                    t & 65536 && !a.isDir(i.mode))
                        throw new a.ErrnoError(54);
                    if (!s) {
                        var p = a.mayOpen(i, t);
                        if (p)
                            throw new a.ErrnoError(p)
                    }
                    t & 512 && !s && a.truncate(i, 0),
                    t &= -131713;
                    var y = a.createStream({
                        node: i,
                        path: a.getPath(i),
                        flags: t,
                        seekable: !0,
                        position: 0,
                        stream_ops: i.stream_ops,
                        ungotten: [],
                        error: !1
                    });
                    return y.stream_ops.open && y.stream_ops.open(y),
                    o.logReadFiles && !(t & 1) && (a.readFiles || (a.readFiles = {}),
                    e in a.readFiles || (a.readFiles[e] = 1)),
                    y
                },
                close(e) {
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    e.getdents && (e.getdents = null);
                    try {
                        e.stream_ops.close && e.stream_ops.close(e);
                    } catch (t) {
                        throw t
                    } finally {
                        a.closeStream(e.fd);
                    }
                    e.fd = null;
                },
                isClosed(e) {
                    return e.fd === null
                },
                llseek(e, t, r) {
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if (!e.seekable || !e.stream_ops.llseek)
                        throw new a.ErrnoError(70);
                    if (r != 0 && r != 1 && r != 2)
                        throw new a.ErrnoError(28);
                    return e.position = e.stream_ops.llseek(e, t, r),
                    e.ungotten = [],
                    e.position
                },
                read(e, t, r, i, n) {
                    if (i < 0 || n < 0)
                        throw new a.ErrnoError(28);
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if ((e.flags & 2097155) === 1)
                        throw new a.ErrnoError(8);
                    if (a.isDir(e.node.mode))
                        throw new a.ErrnoError(31);
                    if (!e.stream_ops.read)
                        throw new a.ErrnoError(28);
                    var s = typeof n < "u";
                    if (!s)
                        n = e.position;
                    else if (!e.seekable)
                        throw new a.ErrnoError(70);
                    var p = e.stream_ops.read(e, t, r, i, n);
                    return s || (e.position += p),
                    p
                },
                write(e, t, r, i, n, s) {
                    if (i < 0 || n < 0)
                        throw new a.ErrnoError(28);
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if (!(e.flags & 2097155))
                        throw new a.ErrnoError(8);
                    if (a.isDir(e.node.mode))
                        throw new a.ErrnoError(31);
                    if (!e.stream_ops.write)
                        throw new a.ErrnoError(28);
                    e.seekable && e.flags & 1024 && a.llseek(e, 0, 2);
                    var p = typeof n < "u";
                    if (!p)
                        n = e.position;
                    else if (!e.seekable)
                        throw new a.ErrnoError(70);
                    var y = e.stream_ops.write(e, t, r, i, n, s);
                    return p || (e.position += y),
                    y
                },
                allocate(e, t, r) {
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if (t < 0 || r <= 0)
                        throw new a.ErrnoError(28);
                    if (!(e.flags & 2097155))
                        throw new a.ErrnoError(8);
                    if (!a.isFile(e.node.mode) && !a.isDir(e.node.mode))
                        throw new a.ErrnoError(43);
                    if (!e.stream_ops.allocate)
                        throw new a.ErrnoError(138);
                    e.stream_ops.allocate(e, t, r);
                },
                mmap(e, t, r, i, n) {
                    if (i & 2 && !(n & 2) && (e.flags & 2097155) !== 2)
                        throw new a.ErrnoError(2);
                    if ((e.flags & 2097155) === 1)
                        throw new a.ErrnoError(2);
                    if (!e.stream_ops.mmap)
                        throw new a.ErrnoError(43);
                    return e.stream_ops.mmap(e, t, r, i, n)
                },
                msync(e, t, r, i, n) {
                    return e.stream_ops.msync ? e.stream_ops.msync(e, t, r, i, n) : 0
                },
                munmap: e=>0,
                ioctl(e, t, r) {
                    if (!e.stream_ops.ioctl)
                        throw new a.ErrnoError(59);
                    return e.stream_ops.ioctl(e, t, r)
                },
                readFile(e, t={}) {
                    if (t.flags = t.flags || 0,
                    t.encoding = t.encoding || "binary",
                    t.encoding !== "utf8" && t.encoding !== "binary")
                        throw new Error(`Invalid encoding type "${t.encoding}"`);
                    var r, i = a.open(e, t.flags), n = a.stat(e), s = n.size, p = new Uint8Array(s);
                    return a.read(i, p, 0, s, 0),
                    t.encoding === "utf8" ? r = Ue(p, 0) : t.encoding === "binary" && (r = p),
                    a.close(i),
                    r
                },
                writeFile(e, t, r={}) {
                    r.flags = r.flags || 577;
                    var i = a.open(e, r.flags, r.mode);
                    if (typeof t == "string") {
                        var n = new Uint8Array(He(t) + 1)
                          , s = pt(t, n, 0, n.length);
                        a.write(i, n, 0, s, void 0, r.canOwn);
                    } else if (ArrayBuffer.isView(t))
                        a.write(i, t, 0, t.byteLength, void 0, r.canOwn);
                    else
                        throw new Error("Unsupported data type");
                    a.close(i);
                },
                cwd: ()=>a.currentPath,
                chdir(e) {
                    var t = a.lookupPath(e, {
                        follow: !0
                    });
                    if (t.node === null)
                        throw new a.ErrnoError(44);
                    if (!a.isDir(t.node.mode))
                        throw new a.ErrnoError(54);
                    var r = a.nodePermissions(t.node, "x");
                    if (r)
                        throw new a.ErrnoError(r);
                    a.currentPath = t.path;
                },
                createDefaultDirectories() {
                    a.mkdir("/tmp"),
                    a.mkdir("/home"),
                    a.mkdir("/home/web_user");
                },
                createDefaultDevices() {
                    a.mkdir("/dev"),
                    a.registerDevice(a.makedev(1, 3), {
                        read: ()=>0,
                        write: (i,n,s,p,y)=>p
                    }),
                    a.mkdev("/dev/null", a.makedev(1, 3)),
                    Re.register(a.makedev(5, 0), Re.default_tty_ops),
                    Re.register(a.makedev(6, 0), Re.default_tty1_ops),
                    a.mkdev("/dev/tty", a.makedev(5, 0)),
                    a.mkdev("/dev/tty1", a.makedev(6, 0));
                    var e = new Uint8Array(1024)
                      , t = 0
                      , r = ()=>(t === 0 && (t = Dt(e).byteLength),
                    e[--t]);
                    a.createDevice("/dev", "random", r),
                    a.createDevice("/dev", "urandom", r),
                    a.mkdir("/dev/shm"),
                    a.mkdir("/dev/shm/tmp");
                },
                createSpecialDirectories() {
                    a.mkdir("/proc");
                    var e = a.mkdir("/proc/self");
                    a.mkdir("/proc/self/fd"),
                    a.mount({
                        mount() {
                            var t = a.createNode(e, "fd", 16895, 73);
                            return t.node_ops = {
                                lookup(r, i) {
                                    var n = +i
                                      , s = a.getStreamChecked(n)
                                      , p = {
                                        parent: null,
                                        mount: {
                                            mountpoint: "fake"
                                        },
                                        node_ops: {
                                            readlink: ()=>s.path
                                        }
                                    };
                                    return p.parent = p,
                                    p
                                }
                            },
                            t
                        }
                    }, {}, "/proc/self/fd");
                },
                createStandardStreams() {
                    o.stdin ? a.createDevice("/dev", "stdin", o.stdin) : a.symlink("/dev/tty", "/dev/stdin"),
                    o.stdout ? a.createDevice("/dev", "stdout", null, o.stdout) : a.symlink("/dev/tty", "/dev/stdout"),
                    o.stderr ? a.createDevice("/dev", "stderr", null, o.stderr) : a.symlink("/dev/tty1", "/dev/stderr");
                    var e = a.open("/dev/stdin", 0)
                      , t = a.open("/dev/stdout", 1)
                      , r = a.open("/dev/stderr", 1);
                },
                ensureErrnoError() {
                    a.ErrnoError || (a.ErrnoError = function(t, r) {
                        this.name = "ErrnoError",
                        this.node = r,
                        this.setErrno = function(i) {
                            this.errno = i;
                        }
                        ,
                        this.setErrno(t),
                        this.message = "FS error";
                    }
                    ,
                    a.ErrnoError.prototype = new Error,
                    a.ErrnoError.prototype.constructor = a.ErrnoError,
                    [44].forEach(e=>{
                        a.genericErrors[e] = new a.ErrnoError(e),
                        a.genericErrors[e].stack = "<generic error, no stack>";
                    }
                    ));
                },
                staticInit() {
                    a.ensureErrnoError(),
                    a.nameTable = new Array(4096),
                    a.mount(oe, {}, "/"),
                    a.createDefaultDirectories(),
                    a.createDefaultDevices(),
                    a.createSpecialDirectories(),
                    a.filesystems = {
                        MEMFS: oe
                    };
                },
                init(e, t, r) {
                    a.init.initialized = !0,
                    a.ensureErrnoError(),
                    o.stdin = e || o.stdin,
                    o.stdout = t || o.stdout,
                    o.stderr = r || o.stderr,
                    a.createStandardStreams();
                },
                quit() {
                    a.init.initialized = !1;
                    for (var e = 0; e < a.streams.length; e++) {
                        var t = a.streams[e];
                        t && a.close(t);
                    }
                },
                findObject(e, t) {
                    var r = a.analyzePath(e, t);
                    return r.exists ? r.object : null
                },
                analyzePath(e, t) {
                    try {
                        var r = a.lookupPath(e, {
                            follow: !t
                        });
                        e = r.path;
                    } catch {}
                    var i = {
                        isRoot: !1,
                        exists: !1,
                        error: 0,
                        name: null,
                        path: null,
                        object: null,
                        parentExists: !1,
                        parentPath: null,
                        parentObject: null
                    };
                    try {
                        var r = a.lookupPath(e, {
                            parent: !0
                        });
                        i.parentExists = !0,
                        i.parentPath = r.path,
                        i.parentObject = r.node,
                        i.name = pe.basename(e),
                        r = a.lookupPath(e, {
                            follow: !t
                        }),
                        i.exists = !0,
                        i.path = r.path,
                        i.object = r.node,
                        i.name = r.node.name,
                        i.isRoot = r.path === "/";
                    } catch (n) {
                        i.error = n.errno;
                    }
                    return i
                },
                createPath(e, t, r, i) {
                    e = typeof e == "string" ? e : a.getPath(e);
                    for (var n = t.split("/").reverse(); n.length; ) {
                        var s = n.pop();
                        if (s) {
                            var p = pe.join2(e, s);
                            try {
                                a.mkdir(p);
                            } catch {}
                            e = p;
                        }
                    }
                    return p
                },
                createFile(e, t, r, i, n) {
                    var s = pe.join2(typeof e == "string" ? e : a.getPath(e), t)
                      , p = ht(i, n);
                    return a.create(s, p)
                },
                createDataFile(e, t, r, i, n, s) {
                    var p = t;
                    e && (e = typeof e == "string" ? e : a.getPath(e),
                    p = t ? pe.join2(e, t) : e);
                    var y = ht(i, n)
                      , O = a.create(p, y);
                    if (r) {
                        if (typeof r == "string") {
                            for (var B = new Array(r.length), G = 0, J = r.length; G < J; ++G)
                                B[G] = r.charCodeAt(G);
                            r = B;
                        }
                        a.chmod(O, y | 146);
                        var Y = a.open(O, 577);
                        a.write(Y, r, 0, r.length, 0, s),
                        a.close(Y),
                        a.chmod(O, y);
                    }
                },
                createDevice(e, t, r, i) {
                    var n = pe.join2(typeof e == "string" ? e : a.getPath(e), t)
                      , s = ht(!!r, !!i);
                    a.createDevice.major || (a.createDevice.major = 64);
                    var p = a.makedev(a.createDevice.major++, 0);
                    return a.registerDevice(p, {
                        open(y) {
                            y.seekable = !1;
                        },
                        close(y) {
                            i?.buffer?.length && i(10);
                        },
                        read(y, O, B, G, J) {
                            for (var Y = 0, d = 0; d < G; d++) {
                                var f;
                                try {
                                    f = r();
                                } catch {
                                    throw new a.ErrnoError(29)
                                }
                                if (f === void 0 && Y === 0)
                                    throw new a.ErrnoError(6);
                                if (f == null)
                                    break;
                                Y++,
                                O[B + d] = f;
                            }
                            return Y && (y.node.timestamp = Date.now()),
                            Y
                        },
                        write(y, O, B, G, J) {
                            for (var Y = 0; Y < G; Y++)
                                try {
                                    i(O[B + Y]);
                                } catch {
                                    throw new a.ErrnoError(29)
                                }
                            return G && (y.node.timestamp = Date.now()),
                            Y
                        }
                    }),
                    a.mkdev(n, s, p)
                },
                forceLoadFile(e) {
                    if (e.isDevice || e.isFolder || e.link || e.contents)
                        return !0;
                    if (typeof XMLHttpRequest < "u")
                        throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
                    if (it)
                        try {
                            e.contents = mt(it(e.url), !0),
                            e.usedBytes = e.contents.length;
                        } catch {
                            throw new a.ErrnoError(29)
                        }
                    else
                        throw new Error("Cannot load without read() or XMLHttpRequest.")
                },
                createLazyFile(e, t, r, i, n) {
                    function s() {
                        this.lengthKnown = !1,
                        this.chunks = [];
                    }
                    if (s.prototype.get = function(d) {
                        if (!(d > this.length - 1 || d < 0)) {
                            var f = d % this.chunkSize
                              , m = d / this.chunkSize | 0;
                            return this.getter(m)[f]
                        }
                    }
                    ,
                    s.prototype.setDataGetter = function(d) {
                        this.getter = d;
                    }
                    ,
                    s.prototype.cacheLength = function() {
                        var d = new XMLHttpRequest;
                        if (d.open("HEAD", r, !1),
                        d.send(null),
                        !(d.status >= 200 && d.status < 300 || d.status === 304))
                            throw new Error("Couldn't load " + r + ". Status: " + d.status);
                        var f = Number(d.getResponseHeader("Content-length")), m, I = (m = d.getResponseHeader("Accept-Ranges")) && m === "bytes", x = (m = d.getResponseHeader("Content-Encoding")) && m === "gzip", S = 1024 * 1024;
                        I || (S = f);
                        var R = (L,$)=>{
                            if (L > $)
                                throw new Error("invalid range (" + L + ", " + $ + ") or no bytes requested!");
                            if ($ > f - 1)
                                throw new Error("only " + f + " bytes available! programmer error!");
                            var u = new XMLHttpRequest;
                            if (u.open("GET", r, !1),
                            f !== S && u.setRequestHeader("Range", "bytes=" + L + "-" + $),
                            u.responseType = "arraybuffer",
                            u.overrideMimeType && u.overrideMimeType("text/plain; charset=x-user-defined"),
                            u.send(null),
                            !(u.status >= 200 && u.status < 300 || u.status === 304))
                                throw new Error("Couldn't load " + r + ". Status: " + u.status);
                            return u.response !== void 0 ? new Uint8Array(u.response || []) : mt(u.responseText || "", !0)
                        }
                          , z = this;
                        z.setDataGetter(L=>{
                            var $ = L * S
                              , u = (L + 1) * S - 1;
                            if (u = Math.min(u, f - 1),
                            typeof z.chunks[L] > "u" && (z.chunks[L] = R($, u)),
                            typeof z.chunks[L] > "u")
                                throw new Error("doXHR failed!");
                            return z.chunks[L]
                        }
                        ),
                        (x || !f) && (S = f = 1,
                        f = this.getter(0).length,
                        S = f,
                        at("LazyFiles on gzip forces download of the whole file when length is accessed")),
                        this._length = f,
                        this._chunkSize = S,
                        this.lengthKnown = !0;
                    }
                    ,
                    typeof XMLHttpRequest < "u") {
                        if (!je)
                            throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
                        var p = new s;
                        Object.defineProperties(p, {
                            length: {
                                get: function() {
                                    return this.lengthKnown || this.cacheLength(),
                                    this._length
                                }
                            },
                            chunkSize: {
                                get: function() {
                                    return this.lengthKnown || this.cacheLength(),
                                    this._chunkSize
                                }
                            }
                        });
                        var y = {
                            isDevice: !1,
                            contents: p
                        };
                    } else
                        var y = {
                            isDevice: !1,
                            url: r
                        };
                    var O = a.createFile(e, t, y, i, n);
                    y.contents ? O.contents = y.contents : y.url && (O.contents = null,
                    O.url = y.url),
                    Object.defineProperties(O, {
                        usedBytes: {
                            get: function() {
                                return this.contents.length
                            }
                        }
                    });
                    var B = {}
                      , G = Object.keys(O.stream_ops);
                    G.forEach(Y=>{
                        var d = O.stream_ops[Y];
                        B[Y] = function() {
                            return a.forceLoadFile(O),
                            d.apply(null, arguments)
                        };
                    }
                    );
                    function J(Y, d, f, m, I) {
                        var x = Y.node.contents;
                        if (I >= x.length)
                            return 0;
                        var S = Math.min(x.length - I, m);
                        if (x.slice)
                            for (var R = 0; R < S; R++)
                                d[f + R] = x[I + R];
                        else
                            for (var R = 0; R < S; R++)
                                d[f + R] = x.get(I + R);
                        return S
                    }
                    return B.read = (Y,d,f,m,I)=>(a.forceLoadFile(O),
                    J(Y, d, f, m, I)),
                    B.mmap = (Y,d,f,m,I)=>{
                        a.forceLoadFile(O);
                        var x = Ct(d);
                        if (!x)
                            throw new a.ErrnoError(48);
                        return J(Y, be, x, d, f),
                        {
                            ptr: x,
                            allocated: !0
                        }
                    }
                    ,
                    O.stream_ops = B,
                    O
                }
            }
              , te = {
                DEFAULT_POLLMASK: 5,
                calculateAt(e, t, r) {
                    if (pe.isAbs(t))
                        return t;
                    var i;
                    if (e === -100)
                        i = a.cwd();
                    else {
                        var n = te.getStreamFromFD(e);
                        i = n.path;
                    }
                    if (t.length == 0) {
                        if (!r)
                            throw new a.ErrnoError(44);
                        return i
                    }
                    return pe.join2(i, t)
                },
                doStat(e, t, r) {
                    try {
                        var i = e(t);
                    } catch (y) {
                        if (y && y.node && pe.normalize(t) !== pe.normalize(a.getPath(y.node)))
                            return -54;
                        throw y
                    }
                    fe[r >> 2] = i.dev,
                    fe[r + 4 >> 2] = i.mode,
                    ge[r + 8 >> 2] = i.nlink,
                    fe[r + 12 >> 2] = i.uid,
                    fe[r + 16 >> 2] = i.gid,
                    fe[r + 20 >> 2] = i.rdev,
                    Se[r + 24 >> 3] = BigInt(i.size),
                    fe[r + 32 >> 2] = 4096,
                    fe[r + 36 >> 2] = i.blocks;
                    var n = i.atime.getTime()
                      , s = i.mtime.getTime()
                      , p = i.ctime.getTime();
                    return Se[r + 40 >> 3] = BigInt(Math.floor(n / 1e3)),
                    ge[r + 48 >> 2] = n % 1e3 * 1e3,
                    Se[r + 56 >> 3] = BigInt(Math.floor(s / 1e3)),
                    ge[r + 64 >> 2] = s % 1e3 * 1e3,
                    Se[r + 72 >> 3] = BigInt(Math.floor(p / 1e3)),
                    ge[r + 80 >> 2] = p % 1e3 * 1e3,
                    Se[r + 88 >> 3] = BigInt(i.ino),
                    0
                },
                doMsync(e, t, r, i, n) {
                    if (!a.isFile(t.node.mode))
                        throw new a.ErrnoError(43);
                    if (i & 2)
                        return 0;
                    var s = ze.slice(e, e + r);
                    a.msync(t, s, n, r, i);
                },
                varargs: void 0,
                get() {
                    var e = fe[+te.varargs >> 2];
                    return te.varargs += 4,
                    e
                },
                getp() {
                    return te.get()
                },
                getStr(e) {
                    var t = Xe(e);
                    return t
                },
                getStreamFromFD(e) {
                    var t = a.getStreamChecked(e);
                    return t
                }
            };
            function vr(e, t) {
                try {
                    return e = te.getStr(e),
                    a.chmod(e, t),
                    0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function wr(e, t, r, i) {
                try {
                    if (t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    r & -8)
                        return -28;
                    var n = a.lookupPath(t, {
                        follow: !0
                    })
                      , s = n.node;
                    if (!s)
                        return -44;
                    var p = "";
                    return r & 4 && (p += "r"),
                    r & 2 && (p += "w"),
                    r & 1 && (p += "x"),
                    p && a.nodePermissions(s, p) ? -2 : 0
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            function Er(e, t) {
                try {
                    return a.fchmod(e, t),
                    0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function xr(e, t, r) {
                try {
                    return a.fchown(e, t, r),
                    0
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            function Sr(e, t, r) {
                te.varargs = r;
                try {
                    var i = te.getStreamFromFD(e);
                    switch (t) {
                    case 0:
                        {
                            var n = te.get();
                            if (n < 0)
                                return -28;
                            for (; a.streams[n]; )
                                n++;
                            var s;
                            return s = a.createStream(i, n),
                            s.fd
                        }
                    case 1:
                    case 2:
                        return 0;
                    case 3:
                        return i.flags;
                    case 4:
                        {
                            var n = te.get();
                            return i.flags |= n,
                            0
                        }
                    case 12:
                        {
                            var n = te.getp()
                              , p = 0;
                            return Ne[n + p >> 1] = 2,
                            0
                        }
                    case 13:
                    case 14:
                        return 0
                    }
                    return -28
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            function Ar(e, t) {
                try {
                    var r = te.getStreamFromFD(e);
                    return te.doStat(a.stat, r.path, t)
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            var Ir = 9007199254740992
              , kr = -9007199254740992
              , Ve = e=>e < kr || e > Ir ? NaN : Number(e);
            function Tr(e, t) {
                t = Ve(t);
                try {
                    return isNaN(t) ? 61 : (a.ftruncate(e, t),
                    0)
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            var gt = (e,t,r)=>pt(e, ze, t, r);
            function Fr(e, t) {
                try {
                    if (t === 0)
                        return -28;
                    var r = a.cwd()
                      , i = He(r) + 1;
                    return t < i ? -68 : (gt(r, e, t),
                    i)
                } catch (n) {
                    if (typeof a > "u" || n.name !== "ErrnoError")
                        throw n;
                    return -n.errno
                }
            }
            function Or(e, t, r) {
                te.varargs = r;
                try {
                    var i = te.getStreamFromFD(e);
                    switch (t) {
                    case 21509:
                        return i.tty ? 0 : -59;
                    case 21505:
                        {
                            if (!i.tty)
                                return -59;
                            if (i.tty.ops.ioctl_tcgets) {
                                var n = i.tty.ops.ioctl_tcgets(i)
                                  , s = te.getp();
                                fe[s >> 2] = n.c_iflag || 0,
                                fe[s + 4 >> 2] = n.c_oflag || 0,
                                fe[s + 8 >> 2] = n.c_cflag || 0,
                                fe[s + 12 >> 2] = n.c_lflag || 0;
                                for (var p = 0; p < 32; p++)
                                    be[s + p + 17 >> 0] = n.c_cc[p] || 0;
                                return 0
                            }
                            return 0
                        }
                    case 21510:
                    case 21511:
                    case 21512:
                        return i.tty ? 0 : -59;
                    case 21506:
                    case 21507:
                    case 21508:
                        {
                            if (!i.tty)
                                return -59;
                            if (i.tty.ops.ioctl_tcsets) {
                                for (var s = te.getp(), y = fe[s >> 2], O = fe[s + 4 >> 2], B = fe[s + 8 >> 2], G = fe[s + 12 >> 2], J = [], p = 0; p < 32; p++)
                                    J.push(be[s + p + 17 >> 0]);
                                return i.tty.ops.ioctl_tcsets(i.tty, t, {
                                    c_iflag: y,
                                    c_oflag: O,
                                    c_cflag: B,
                                    c_lflag: G,
                                    c_cc: J
                                })
                            }
                            return 0
                        }
                    case 21519:
                        {
                            if (!i.tty)
                                return -59;
                            var s = te.getp();
                            return fe[s >> 2] = 0,
                            0
                        }
                    case 21520:
                        return i.tty ? -28 : -59;
                    case 21531:
                        {
                            var s = te.getp();
                            return a.ioctl(i, t, s)
                        }
                    case 21523:
                        {
                            if (!i.tty)
                                return -59;
                            if (i.tty.ops.ioctl_tiocgwinsz) {
                                var Y = i.tty.ops.ioctl_tiocgwinsz(i.tty)
                                  , s = te.getp();
                                Ne[s >> 1] = Y[0],
                                Ne[s + 2 >> 1] = Y[1];
                            }
                            return 0
                        }
                    case 21524:
                        return i.tty ? 0 : -59;
                    case 21515:
                        return i.tty ? 0 : -59;
                    default:
                        return -28
                    }
                } catch (d) {
                    if (typeof a > "u" || d.name !== "ErrnoError")
                        throw d;
                    return -d.errno
                }
            }
            function Pr(e, t) {
                try {
                    return e = te.getStr(e),
                    te.doStat(a.lstat, e, t)
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function Lr(e, t, r) {
                try {
                    return t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    t = pe.normalize(t),
                    t[t.length - 1] === "/" && (t = t.substr(0, t.length - 1)),
                    a.mkdir(t, r, 0),
                    0
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            function Dr(e, t, r, i) {
                try {
                    t = te.getStr(t);
                    var n = i & 256
                      , s = i & 4096;
                    return i = i & -6401,
                    t = te.calculateAt(e, t, s),
                    te.doStat(n ? a.lstat : a.stat, t, r)
                } catch (p) {
                    if (typeof a > "u" || p.name !== "ErrnoError")
                        throw p;
                    return -p.errno
                }
            }
            function Cr(e, t, r, i) {
                te.varargs = i;
                try {
                    t = te.getStr(t),
                    t = te.calculateAt(e, t);
                    var n = i ? te.get() : 0;
                    return a.open(t, r, n).fd
                } catch (s) {
                    if (typeof a > "u" || s.name !== "ErrnoError")
                        throw s;
                    return -s.errno
                }
            }
            function Rr(e, t, r, i) {
                try {
                    if (t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    i <= 0)
                        return -28;
                    var n = a.readlink(t)
                      , s = Math.min(i, He(n))
                      , p = be[r + s];
                    return gt(n, r, i + 1),
                    be[r + s] = p,
                    s
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            function Nr(e) {
                try {
                    return e = te.getStr(e),
                    a.rmdir(e),
                    0
                } catch (t) {
                    if (typeof a > "u" || t.name !== "ErrnoError")
                        throw t;
                    return -t.errno
                }
            }
            function Mr(e, t) {
                try {
                    return e = te.getStr(e),
                    te.doStat(a.stat, e, t)
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function jr(e, t, r) {
                try {
                    return t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    r === 0 ? a.unlink(t) : r === 512 ? a.rmdir(t) : Ce("Invalid flags passed to unlinkat"),
                    0
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            var Rt = e=>ge[e >> 2] + fe[e + 4 >> 2] * 4294967296;
            function zr(e, t, r, i) {
                try {
                    if (t = te.getStr(t),
                    t = te.calculateAt(e, t, !0),
                    r) {
                        var p = Rt(r)
                          , y = fe[r + 8 >> 2];
                        n = p * 1e3 + y / 1e6,
                        r += 16,
                        p = Rt(r),
                        y = fe[r + 8 >> 2],
                        s = p * 1e3 + y / 1e6;
                    } else
                        var n = Date.now()
                          , s = n;
                    return a.utime(t, n, s),
                    0
                } catch (O) {
                    if (typeof a > "u" || O.name !== "ErrnoError")
                        throw O;
                    return -O.errno
                }
            }
            var Br = 1
              , Ur = ()=>Br
              , Wr = e=>e % 4 === 0 && (e % 100 !== 0 || e % 400 === 0)
              , Qr = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
              , Hr = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
              , Vr = e=>{
                var t = Wr(e.getFullYear())
                  , r = t ? Qr : Hr
                  , i = r[e.getMonth()] + e.getDate() - 1;
                return i
            }
            ;
            function Gr(e, t) {
                e = Ve(e);
                var r = new Date(e * 1e3);
                fe[t >> 2] = r.getSeconds(),
                fe[t + 4 >> 2] = r.getMinutes(),
                fe[t + 8 >> 2] = r.getHours(),
                fe[t + 12 >> 2] = r.getDate(),
                fe[t + 16 >> 2] = r.getMonth(),
                fe[t + 20 >> 2] = r.getFullYear() - 1900,
                fe[t + 24 >> 2] = r.getDay();
                var i = Vr(r) | 0;
                fe[t + 28 >> 2] = i,
                fe[t + 36 >> 2] = -(r.getTimezoneOffset() * 60);
                var n = new Date(r.getFullYear(),0,1)
                  , s = new Date(r.getFullYear(),6,1).getTimezoneOffset()
                  , p = n.getTimezoneOffset()
                  , y = (s != p && r.getTimezoneOffset() == Math.min(p, s)) | 0;
                fe[t + 32 >> 2] = y;
            }
            function $r(e, t, r, i, n, s, p) {
                n = Ve(n);
                try {
                    if (isNaN(n))
                        return 61;
                    var y = te.getStreamFromFD(i)
                      , O = a.mmap(y, e, n, t, r)
                      , B = O.ptr;
                    return fe[s >> 2] = O.allocated,
                    ge[p >> 2] = B,
                    0
                } catch (G) {
                    if (typeof a > "u" || G.name !== "ErrnoError")
                        throw G;
                    return -G.errno
                }
            }
            function Kr(e, t, r, i, n, s) {
                s = Ve(s);
                try {
                    if (isNaN(s))
                        return 61;
                    var p = te.getStreamFromFD(n);
                    r & 2 && te.doMsync(e, p, t, i, s),
                    a.munmap(p);
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            var Nt = e=>{
                var t = He(e) + 1
                  , r = Bt(t);
                return r && gt(e, r, t),
                r
            }
            , Jr = (e,t,r)=>{
                var i = new Date().getFullYear()
                  , n = new Date(i,0,1)
                  , s = new Date(i,6,1)
                  , p = n.getTimezoneOffset()
                  , y = s.getTimezoneOffset()
                  , O = Math.max(p, y);
                ge[e >> 2] = O * 60,
                fe[t >> 2] = Number(p != y);
                function B(f) {
                    var m = f.toTimeString().match(/\(([A-Za-z ]+)\)$/);
                    return m ? m[1] : "GMT"
                }
                var G = B(n)
                  , J = B(s)
                  , Y = Nt(G)
                  , d = Nt(J);
                y < p ? (ge[r >> 2] = Y,
                ge[r + 4 >> 2] = d) : (ge[r >> 2] = d,
                ge[r + 4 >> 2] = Y);
            }
            , Xr = ()=>Date.now(), Mt;
            Mt = ()=>performance.now();
            var Yr = ()=>2147483648
              , Zr = e=>{
                var t = De.buffer
                  , r = (e - t.byteLength + 65535) / 65536;
                try {
                    return De.grow(r),
                    St(),
                    1
                } catch {}
            }
              , en = e=>{
                var t = ze.length;
                e >>>= 0;
                var r = Yr();
                if (e > r)
                    return !1;
                for (var i = (O,B)=>O + (B - O % B) % B, n = 1; n <= 4; n *= 2) {
                    var s = t * (1 + .2 / n);
                    s = Math.min(s, e + 100663296);
                    var p = Math.min(r, i(Math.max(e, s), 65536))
                      , y = Zr(p);
                    if (y)
                        return !0
                }
                return !1
            }
              , qt = {}
              , tn = ()=>wt || "./this.program"
              , Ge = ()=>{
                if (!Ge.strings) {
                    var e = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8"
                      , t = {
                        USER: "web_user",
                        LOGNAME: "web_user",
                        PATH: "/",
                        PWD: "/",
                        HOME: "/home/web_user",
                        LANG: e,
                        _: tn()
                    };
                    for (var r in qt)
                        qt[r] === void 0 ? delete t[r] : t[r] = qt[r];
                    var i = [];
                    for (var r in t)
                        i.push(`${r}=${t[r]}`);
                    Ge.strings = i;
                }
                return Ge.strings
            }
              , rn = (e,t)=>{
                for (var r = 0; r < e.length; ++r)
                    be[t++ >> 0] = e.charCodeAt(r);
                be[t >> 0] = 0;
            }
              , nn = (e,t)=>{
                var r = 0;
                return Ge().forEach((i,n)=>{
                    var s = t + r;
                    ge[e + n * 4 >> 2] = s,
                    rn(i, s),
                    r += i.length + 1;
                }
                ),
                0
            }
              , sn = (e,t)=>{
                var r = Ge();
                ge[e >> 2] = r.length;
                var i = 0;
                return r.forEach(n=>i += n.length + 1),
                ge[t >> 2] = i,
                0
            }
            ;
            function on(e) {
                try {
                    var t = te.getStreamFromFD(e);
                    return a.close(t),
                    0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return r.errno
                }
            }
            function an(e, t) {
                try {
                    var r = 0
                      , i = 0
                      , n = 0
                      , s = te.getStreamFromFD(e)
                      , p = s.tty ? 2 : a.isDir(s.mode) ? 3 : a.isLink(s.mode) ? 7 : 4;
                    return be[t >> 0] = p,
                    Ne[t + 2 >> 1] = n,
                    Se[t + 8 >> 3] = BigInt(r),
                    Se[t + 16 >> 3] = BigInt(i),
                    0
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return y.errno
                }
            }
            var ln = (e,t,r,i)=>{
                for (var n = 0, s = 0; s < r; s++) {
                    var p = ge[t >> 2]
                      , y = ge[t + 4 >> 2];
                    t += 8;
                    var O = a.read(e, be, p, y, i);
                    if (O < 0)
                        return -1;
                    if (n += O,
                    O < y)
                        break;
                    typeof i < "u" && (i += O);
                }
                return n
            }
            ;
            function cn(e, t, r, i) {
                try {
                    var n = te.getStreamFromFD(e)
                      , s = ln(n, t, r);
                    return ge[i >> 2] = s,
                    0
                } catch (p) {
                    if (typeof a > "u" || p.name !== "ErrnoError")
                        throw p;
                    return p.errno
                }
            }
            function _n(e, t, r, i) {
                t = Ve(t);
                try {
                    if (isNaN(t))
                        return 61;
                    var n = te.getStreamFromFD(e);
                    return a.llseek(n, t, r),
                    Se[i >> 3] = BigInt(n.position),
                    n.getdents && t === 0 && r === 0 && (n.getdents = null),
                    0
                } catch (s) {
                    if (typeof a > "u" || s.name !== "ErrnoError")
                        throw s;
                    return s.errno
                }
            }
            function un(e) {
                try {
                    var t = te.getStreamFromFD(e);
                    return t.stream_ops?.fsync ? t.stream_ops.fsync(t) : 0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return r.errno
                }
            }
            var fn = (e,t,r,i)=>{
                for (var n = 0, s = 0; s < r; s++) {
                    var p = ge[t >> 2]
                      , y = ge[t + 4 >> 2];
                    t += 8;
                    var O = a.write(e, be, p, y, i);
                    if (O < 0)
                        return -1;
                    n += O,
                    typeof i < "u" && (i += O);
                }
                return n
            }
            ;
            function dn(e, t, r, i) {
                try {
                    var n = te.getStreamFromFD(e)
                      , s = fn(n, t, r);
                    return ge[i >> 2] = s,
                    0
                } catch (p) {
                    if (typeof a > "u" || p.name !== "ErrnoError")
                        throw p;
                    return p.errno
                }
            }
            var jt = function(e, t, r, i) {
                e || (e = this),
                this.parent = e,
                this.mount = e.mount,
                this.mounted = null,
                this.id = a.nextInode++,
                this.name = t,
                this.mode = r,
                this.node_ops = {},
                this.stream_ops = {},
                this.rdev = i;
            }
              , Ye = 365
              , Ze = 146;
            Object.defineProperties(jt.prototype, {
                read: {
                    get: function() {
                        return (this.mode & Ye) === Ye
                    },
                    set: function(e) {
                        e ? this.mode |= Ye : this.mode &= ~Ye;
                    }
                },
                write: {
                    get: function() {
                        return (this.mode & Ze) === Ze
                    },
                    set: function(e) {
                        e ? this.mode |= Ze : this.mode &= ~Ze;
                    }
                },
                isFolder: {
                    get: function() {
                        return a.isDir(this.mode)
                    }
                },
                isDevice: {
                    get: function() {
                        return a.isChrdev(this.mode)
                    }
                }
            }),
            a.FSNode = jt,
            a.createPreloadedFile = br,
            a.staticInit();
            var zt = {
                __assert_fail: _r,
                __syscall_chmod: vr,
                __syscall_faccessat: wr,
                __syscall_fchmod: Er,
                __syscall_fchown32: xr,
                __syscall_fcntl64: Sr,
                __syscall_fstat64: Ar,
                __syscall_ftruncate64: Tr,
                __syscall_getcwd: Fr,
                __syscall_ioctl: Or,
                __syscall_lstat64: Pr,
                __syscall_mkdirat: Lr,
                __syscall_newfstatat: Dr,
                __syscall_openat: Cr,
                __syscall_readlinkat: Rr,
                __syscall_rmdir: Nr,
                __syscall_stat64: Mr,
                __syscall_unlinkat: jr,
                __syscall_utimensat: zr,
                _emscripten_get_now_is_monotonic: Ur,
                _localtime_js: Gr,
                _mmap_js: $r,
                _munmap_js: Kr,
                _tzset_js: Jr,
                emscripten_date_now: Xr,
                emscripten_get_now: Mt,
                emscripten_resize_heap: en,
                environ_get: nn,
                environ_sizes_get: sn,
                fd_close: on,
                fd_fdstat_get: an,
                fd_read: cn,
                fd_seek: _n,
                fd_sync: un,
                fd_write: dn,
                memory: De
            }
              , b = cr()
              , pn = ()=>(pn = b.__wasm_call_ctors)()
              , mn = o._sqlite3_status64 = (e,t,r,i)=>(mn = o._sqlite3_status64 = b.sqlite3_status64)(e, t, r, i)
              , hn = o._sqlite3_status = (e,t,r,i)=>(hn = o._sqlite3_status = b.sqlite3_status)(e, t, r, i)
              , gn = o._sqlite3_db_status = (e,t,r,i,n)=>(gn = o._sqlite3_db_status = b.sqlite3_db_status)(e, t, r, i, n)
              , qn = o._sqlite3_msize = e=>(qn = o._sqlite3_msize = b.sqlite3_msize)(e)
              , bn = o._sqlite3_vfs_find = e=>(bn = o._sqlite3_vfs_find = b.sqlite3_vfs_find)(e)
              , yn = o._sqlite3_initialize = ()=>(yn = o._sqlite3_initialize = b.sqlite3_initialize)()
              , vn = o._sqlite3_malloc = e=>(vn = o._sqlite3_malloc = b.sqlite3_malloc)(e)
              , wn = o._sqlite3_free = e=>(wn = o._sqlite3_free = b.sqlite3_free)(e)
              , En = o._sqlite3_vfs_register = (e,t)=>(En = o._sqlite3_vfs_register = b.sqlite3_vfs_register)(e, t)
              , xn = o._sqlite3_vfs_unregister = e=>(xn = o._sqlite3_vfs_unregister = b.sqlite3_vfs_unregister)(e)
              , Sn = o._sqlite3_malloc64 = e=>(Sn = o._sqlite3_malloc64 = b.sqlite3_malloc64)(e)
              , An = o._sqlite3_realloc = (e,t)=>(An = o._sqlite3_realloc = b.sqlite3_realloc)(e, t)
              , In = o._sqlite3_realloc64 = (e,t)=>(In = o._sqlite3_realloc64 = b.sqlite3_realloc64)(e, t)
              , kn = o._sqlite3_value_text = e=>(kn = o._sqlite3_value_text = b.sqlite3_value_text)(e)
              , Tn = o._sqlite3_randomness = (e,t)=>(Tn = o._sqlite3_randomness = b.sqlite3_randomness)(e, t)
              , Fn = o._sqlite3_stricmp = (e,t)=>(Fn = o._sqlite3_stricmp = b.sqlite3_stricmp)(e, t)
              , On = o._sqlite3_strnicmp = (e,t,r)=>(On = o._sqlite3_strnicmp = b.sqlite3_strnicmp)(e, t, r)
              , Pn = o._sqlite3_uri_parameter = (e,t)=>(Pn = o._sqlite3_uri_parameter = b.sqlite3_uri_parameter)(e, t)
              , Ln = o._sqlite3_uri_boolean = (e,t,r)=>(Ln = o._sqlite3_uri_boolean = b.sqlite3_uri_boolean)(e, t, r)
              , Dn = o._sqlite3_serialize = (e,t,r,i)=>(Dn = o._sqlite3_serialize = b.sqlite3_serialize)(e, t, r, i)
              , Cn = o._sqlite3_prepare_v2 = (e,t,r,i,n)=>(Cn = o._sqlite3_prepare_v2 = b.sqlite3_prepare_v2)(e, t, r, i, n)
              , Rn = o._sqlite3_step = e=>(Rn = o._sqlite3_step = b.sqlite3_step)(e)
              , Nn = o._sqlite3_column_int64 = (e,t)=>(Nn = o._sqlite3_column_int64 = b.sqlite3_column_int64)(e, t)
              , Mn = o._sqlite3_column_int = (e,t)=>(Mn = o._sqlite3_column_int = b.sqlite3_column_int)(e, t)
              , jn = o._sqlite3_finalize = e=>(jn = o._sqlite3_finalize = b.sqlite3_finalize)(e)
              , zn = o._sqlite3_file_control = (e,t,r,i)=>(zn = o._sqlite3_file_control = b.sqlite3_file_control)(e, t, r, i)
              , Bn = o._sqlite3_reset = e=>(Bn = o._sqlite3_reset = b.sqlite3_reset)(e)
              , Un = o._sqlite3_deserialize = (e,t,r,i,n,s)=>(Un = o._sqlite3_deserialize = b.sqlite3_deserialize)(e, t, r, i, n, s)
              , Wn = o._sqlite3_clear_bindings = e=>(Wn = o._sqlite3_clear_bindings = b.sqlite3_clear_bindings)(e)
              , Qn = o._sqlite3_value_blob = e=>(Qn = o._sqlite3_value_blob = b.sqlite3_value_blob)(e)
              , Hn = o._sqlite3_value_bytes = e=>(Hn = o._sqlite3_value_bytes = b.sqlite3_value_bytes)(e)
              , Vn = o._sqlite3_value_double = e=>(Vn = o._sqlite3_value_double = b.sqlite3_value_double)(e)
              , Gn = o._sqlite3_value_int = e=>(Gn = o._sqlite3_value_int = b.sqlite3_value_int)(e)
              , $n = o._sqlite3_value_int64 = e=>($n = o._sqlite3_value_int64 = b.sqlite3_value_int64)(e)
              , Kn = o._sqlite3_value_subtype = e=>(Kn = o._sqlite3_value_subtype = b.sqlite3_value_subtype)(e)
              , Jn = o._sqlite3_value_pointer = (e,t)=>(Jn = o._sqlite3_value_pointer = b.sqlite3_value_pointer)(e, t)
              , Xn = o._sqlite3_value_type = e=>(Xn = o._sqlite3_value_type = b.sqlite3_value_type)(e)
              , Yn = o._sqlite3_value_nochange = e=>(Yn = o._sqlite3_value_nochange = b.sqlite3_value_nochange)(e)
              , Zn = o._sqlite3_value_frombind = e=>(Zn = o._sqlite3_value_frombind = b.sqlite3_value_frombind)(e)
              , es = o._sqlite3_value_dup = e=>(es = o._sqlite3_value_dup = b.sqlite3_value_dup)(e)
              , ts = o._sqlite3_value_free = e=>(ts = o._sqlite3_value_free = b.sqlite3_value_free)(e)
              , rs = o._sqlite3_result_blob = (e,t,r,i)=>(rs = o._sqlite3_result_blob = b.sqlite3_result_blob)(e, t, r, i)
              , ns = o._sqlite3_result_error_toobig = e=>(ns = o._sqlite3_result_error_toobig = b.sqlite3_result_error_toobig)(e)
              , ss = o._sqlite3_result_error_nomem = e=>(ss = o._sqlite3_result_error_nomem = b.sqlite3_result_error_nomem)(e)
              , is = o._sqlite3_result_double = (e,t)=>(is = o._sqlite3_result_double = b.sqlite3_result_double)(e, t)
              , os = o._sqlite3_result_error = (e,t,r)=>(os = o._sqlite3_result_error = b.sqlite3_result_error)(e, t, r)
              , as = o._sqlite3_result_int = (e,t)=>(as = o._sqlite3_result_int = b.sqlite3_result_int)(e, t)
              , ls = o._sqlite3_result_int64 = (e,t)=>(ls = o._sqlite3_result_int64 = b.sqlite3_result_int64)(e, t)
              , cs = o._sqlite3_result_null = e=>(cs = o._sqlite3_result_null = b.sqlite3_result_null)(e)
              , _s = o._sqlite3_result_pointer = (e,t,r,i)=>(_s = o._sqlite3_result_pointer = b.sqlite3_result_pointer)(e, t, r, i)
              , us = o._sqlite3_result_subtype = (e,t)=>(us = o._sqlite3_result_subtype = b.sqlite3_result_subtype)(e, t)
              , fs = o._sqlite3_result_text = (e,t,r,i)=>(fs = o._sqlite3_result_text = b.sqlite3_result_text)(e, t, r, i)
              , ds = o._sqlite3_result_zeroblob = (e,t)=>(ds = o._sqlite3_result_zeroblob = b.sqlite3_result_zeroblob)(e, t)
              , ps = o._sqlite3_result_zeroblob64 = (e,t)=>(ps = o._sqlite3_result_zeroblob64 = b.sqlite3_result_zeroblob64)(e, t)
              , ms = o._sqlite3_result_error_code = (e,t)=>(ms = o._sqlite3_result_error_code = b.sqlite3_result_error_code)(e, t)
              , hs = o._sqlite3_user_data = e=>(hs = o._sqlite3_user_data = b.sqlite3_user_data)(e)
              , gs = o._sqlite3_context_db_handle = e=>(gs = o._sqlite3_context_db_handle = b.sqlite3_context_db_handle)(e)
              , qs = o._sqlite3_vtab_nochange = e=>(qs = o._sqlite3_vtab_nochange = b.sqlite3_vtab_nochange)(e)
              , bs = o._sqlite3_vtab_in_first = (e,t)=>(bs = o._sqlite3_vtab_in_first = b.sqlite3_vtab_in_first)(e, t)
              , ys = o._sqlite3_vtab_in_next = (e,t)=>(ys = o._sqlite3_vtab_in_next = b.sqlite3_vtab_in_next)(e, t)
              , vs = o._sqlite3_aggregate_context = (e,t)=>(vs = o._sqlite3_aggregate_context = b.sqlite3_aggregate_context)(e, t)
              , ws = o._sqlite3_get_auxdata = (e,t)=>(ws = o._sqlite3_get_auxdata = b.sqlite3_get_auxdata)(e, t)
              , Es = o._sqlite3_set_auxdata = (e,t,r,i)=>(Es = o._sqlite3_set_auxdata = b.sqlite3_set_auxdata)(e, t, r, i)
              , xs = o._sqlite3_column_count = e=>(xs = o._sqlite3_column_count = b.sqlite3_column_count)(e)
              , Ss = o._sqlite3_data_count = e=>(Ss = o._sqlite3_data_count = b.sqlite3_data_count)(e)
              , As = o._sqlite3_column_blob = (e,t)=>(As = o._sqlite3_column_blob = b.sqlite3_column_blob)(e, t)
              , Is = o._sqlite3_column_bytes = (e,t)=>(Is = o._sqlite3_column_bytes = b.sqlite3_column_bytes)(e, t)
              , ks = o._sqlite3_column_double = (e,t)=>(ks = o._sqlite3_column_double = b.sqlite3_column_double)(e, t)
              , Ts = o._sqlite3_column_text = (e,t)=>(Ts = o._sqlite3_column_text = b.sqlite3_column_text)(e, t)
              , Fs = o._sqlite3_column_value = (e,t)=>(Fs = o._sqlite3_column_value = b.sqlite3_column_value)(e, t)
              , Os = o._sqlite3_column_type = (e,t)=>(Os = o._sqlite3_column_type = b.sqlite3_column_type)(e, t)
              , Ps = o._sqlite3_column_name = (e,t)=>(Ps = o._sqlite3_column_name = b.sqlite3_column_name)(e, t)
              , Ls = o._sqlite3_bind_blob = (e,t,r,i,n)=>(Ls = o._sqlite3_bind_blob = b.sqlite3_bind_blob)(e, t, r, i, n)
              , Ds = o._sqlite3_bind_double = (e,t,r)=>(Ds = o._sqlite3_bind_double = b.sqlite3_bind_double)(e, t, r)
              , Cs = o._sqlite3_bind_int = (e,t,r)=>(Cs = o._sqlite3_bind_int = b.sqlite3_bind_int)(e, t, r)
              , Rs = o._sqlite3_bind_int64 = (e,t,r)=>(Rs = o._sqlite3_bind_int64 = b.sqlite3_bind_int64)(e, t, r)
              , Ns = o._sqlite3_bind_null = (e,t)=>(Ns = o._sqlite3_bind_null = b.sqlite3_bind_null)(e, t)
              , Ms = o._sqlite3_bind_pointer = (e,t,r,i,n)=>(Ms = o._sqlite3_bind_pointer = b.sqlite3_bind_pointer)(e, t, r, i, n)
              , js = o._sqlite3_bind_text = (e,t,r,i,n)=>(js = o._sqlite3_bind_text = b.sqlite3_bind_text)(e, t, r, i, n)
              , zs = o._sqlite3_bind_parameter_count = e=>(zs = o._sqlite3_bind_parameter_count = b.sqlite3_bind_parameter_count)(e)
              , Bs = o._sqlite3_bind_parameter_index = (e,t)=>(Bs = o._sqlite3_bind_parameter_index = b.sqlite3_bind_parameter_index)(e, t)
              , Us = o._sqlite3_db_handle = e=>(Us = o._sqlite3_db_handle = b.sqlite3_db_handle)(e)
              , Ws = o._sqlite3_stmt_readonly = e=>(Ws = o._sqlite3_stmt_readonly = b.sqlite3_stmt_readonly)(e)
              , Qs = o._sqlite3_stmt_isexplain = e=>(Qs = o._sqlite3_stmt_isexplain = b.sqlite3_stmt_isexplain)(e)
              , Hs = o._sqlite3_stmt_status = (e,t,r)=>(Hs = o._sqlite3_stmt_status = b.sqlite3_stmt_status)(e, t, r)
              , Vs = o._sqlite3_sql = e=>(Vs = o._sqlite3_sql = b.sqlite3_sql)(e)
              , Gs = o._sqlite3_expanded_sql = e=>(Gs = o._sqlite3_expanded_sql = b.sqlite3_expanded_sql)(e)
              , $s = o._sqlite3_preupdate_old = (e,t,r)=>($s = o._sqlite3_preupdate_old = b.sqlite3_preupdate_old)(e, t, r)
              , Ks = o._sqlite3_preupdate_count = e=>(Ks = o._sqlite3_preupdate_count = b.sqlite3_preupdate_count)(e)
              , Js = o._sqlite3_preupdate_depth = e=>(Js = o._sqlite3_preupdate_depth = b.sqlite3_preupdate_depth)(e)
              , Xs = o._sqlite3_preupdate_blobwrite = e=>(Xs = o._sqlite3_preupdate_blobwrite = b.sqlite3_preupdate_blobwrite)(e)
              , Ys = o._sqlite3_preupdate_new = (e,t,r)=>(Ys = o._sqlite3_preupdate_new = b.sqlite3_preupdate_new)(e, t, r)
              , Zs = o._sqlite3_value_numeric_type = e=>(Zs = o._sqlite3_value_numeric_type = b.sqlite3_value_numeric_type)(e)
              , ei = o._sqlite3_errmsg = e=>(ei = o._sqlite3_errmsg = b.sqlite3_errmsg)(e)
              , ti = o._sqlite3_set_authorizer = (e,t,r)=>(ti = o._sqlite3_set_authorizer = b.sqlite3_set_authorizer)(e, t, r)
              , ri = o._sqlite3_strglob = (e,t)=>(ri = o._sqlite3_strglob = b.sqlite3_strglob)(e, t)
              , ni = o._sqlite3_strlike = (e,t,r)=>(ni = o._sqlite3_strlike = b.sqlite3_strlike)(e, t, r)
              , si = o._sqlite3_exec = (e,t,r,i,n)=>(si = o._sqlite3_exec = b.sqlite3_exec)(e, t, r, i, n)
              , ii = o._sqlite3_auto_extension = e=>(ii = o._sqlite3_auto_extension = b.sqlite3_auto_extension)(e)
              , oi = o._sqlite3_cancel_auto_extension = e=>(oi = o._sqlite3_cancel_auto_extension = b.sqlite3_cancel_auto_extension)(e)
              , ai = o._sqlite3_reset_auto_extension = ()=>(ai = o._sqlite3_reset_auto_extension = b.sqlite3_reset_auto_extension)()
              , li = o._sqlite3_prepare_v3 = (e,t,r,i,n,s)=>(li = o._sqlite3_prepare_v3 = b.sqlite3_prepare_v3)(e, t, r, i, n, s)
              , ci = o._sqlite3_create_module = (e,t,r,i)=>(ci = o._sqlite3_create_module = b.sqlite3_create_module)(e, t, r, i)
              , _i = o._sqlite3_create_module_v2 = (e,t,r,i,n)=>(_i = o._sqlite3_create_module_v2 = b.sqlite3_create_module_v2)(e, t, r, i, n)
              , ui = o._sqlite3_drop_modules = (e,t)=>(ui = o._sqlite3_drop_modules = b.sqlite3_drop_modules)(e, t)
              , fi = o._sqlite3_declare_vtab = (e,t)=>(fi = o._sqlite3_declare_vtab = b.sqlite3_declare_vtab)(e, t)
              , di = o._sqlite3_vtab_on_conflict = e=>(di = o._sqlite3_vtab_on_conflict = b.sqlite3_vtab_on_conflict)(e)
              , pi = o._sqlite3_vtab_collation = (e,t)=>(pi = o._sqlite3_vtab_collation = b.sqlite3_vtab_collation)(e, t)
              , mi = o._sqlite3_vtab_in = (e,t,r)=>(mi = o._sqlite3_vtab_in = b.sqlite3_vtab_in)(e, t, r)
              , hi = o._sqlite3_vtab_rhs_value = (e,t,r)=>(hi = o._sqlite3_vtab_rhs_value = b.sqlite3_vtab_rhs_value)(e, t, r)
              , gi = o._sqlite3_vtab_distinct = e=>(gi = o._sqlite3_vtab_distinct = b.sqlite3_vtab_distinct)(e)
              , qi = o._sqlite3_keyword_name = (e,t,r)=>(qi = o._sqlite3_keyword_name = b.sqlite3_keyword_name)(e, t, r)
              , bi = o._sqlite3_keyword_count = ()=>(bi = o._sqlite3_keyword_count = b.sqlite3_keyword_count)()
              , yi = o._sqlite3_keyword_check = (e,t)=>(yi = o._sqlite3_keyword_check = b.sqlite3_keyword_check)(e, t)
              , vi = o._sqlite3_complete = e=>(vi = o._sqlite3_complete = b.sqlite3_complete)(e)
              , wi = o._sqlite3_libversion = ()=>(wi = o._sqlite3_libversion = b.sqlite3_libversion)()
              , Ei = o._sqlite3_libversion_number = ()=>(Ei = o._sqlite3_libversion_number = b.sqlite3_libversion_number)()
              , xi = o._sqlite3_shutdown = ()=>(xi = o._sqlite3_shutdown = b.sqlite3_shutdown)()
              , Si = o._sqlite3_last_insert_rowid = e=>(Si = o._sqlite3_last_insert_rowid = b.sqlite3_last_insert_rowid)(e)
              , Ai = o._sqlite3_set_last_insert_rowid = (e,t)=>(Ai = o._sqlite3_set_last_insert_rowid = b.sqlite3_set_last_insert_rowid)(e, t)
              , Ii = o._sqlite3_changes64 = e=>(Ii = o._sqlite3_changes64 = b.sqlite3_changes64)(e)
              , ki = o._sqlite3_changes = e=>(ki = o._sqlite3_changes = b.sqlite3_changes)(e)
              , Ti = o._sqlite3_total_changes64 = e=>(Ti = o._sqlite3_total_changes64 = b.sqlite3_total_changes64)(e)
              , Fi = o._sqlite3_total_changes = e=>(Fi = o._sqlite3_total_changes = b.sqlite3_total_changes)(e)
              , Oi = o._sqlite3_txn_state = (e,t)=>(Oi = o._sqlite3_txn_state = b.sqlite3_txn_state)(e, t)
              , Pi = o._sqlite3_close_v2 = e=>(Pi = o._sqlite3_close_v2 = b.sqlite3_close_v2)(e)
              , Li = o._sqlite3_busy_handler = (e,t,r)=>(Li = o._sqlite3_busy_handler = b.sqlite3_busy_handler)(e, t, r)
              , Di = o._sqlite3_progress_handler = (e,t,r,i)=>(Di = o._sqlite3_progress_handler = b.sqlite3_progress_handler)(e, t, r, i)
              , Ci = o._sqlite3_busy_timeout = (e,t)=>(Ci = o._sqlite3_busy_timeout = b.sqlite3_busy_timeout)(e, t)
              , Ri = o._sqlite3_create_function = (e,t,r,i,n,s,p,y)=>(Ri = o._sqlite3_create_function = b.sqlite3_create_function)(e, t, r, i, n, s, p, y)
              , Ni = o._sqlite3_create_function_v2 = (e,t,r,i,n,s,p,y,O)=>(Ni = o._sqlite3_create_function_v2 = b.sqlite3_create_function_v2)(e, t, r, i, n, s, p, y, O)
              , Mi = o._sqlite3_create_window_function = (e,t,r,i,n,s,p,y,O,B)=>(Mi = o._sqlite3_create_window_function = b.sqlite3_create_window_function)(e, t, r, i, n, s, p, y, O, B)
              , ji = o._sqlite3_overload_function = (e,t,r)=>(ji = o._sqlite3_overload_function = b.sqlite3_overload_function)(e, t, r)
              , zi = o._sqlite3_trace_v2 = (e,t,r,i)=>(zi = o._sqlite3_trace_v2 = b.sqlite3_trace_v2)(e, t, r, i)
              , Bi = o._sqlite3_commit_hook = (e,t,r)=>(Bi = o._sqlite3_commit_hook = b.sqlite3_commit_hook)(e, t, r)
              , Ui = o._sqlite3_update_hook = (e,t,r)=>(Ui = o._sqlite3_update_hook = b.sqlite3_update_hook)(e, t, r)
              , Wi = o._sqlite3_rollback_hook = (e,t,r)=>(Wi = o._sqlite3_rollback_hook = b.sqlite3_rollback_hook)(e, t, r)
              , Qi = o._sqlite3_preupdate_hook = (e,t,r)=>(Qi = o._sqlite3_preupdate_hook = b.sqlite3_preupdate_hook)(e, t, r)
              , Hi = o._sqlite3_error_offset = e=>(Hi = o._sqlite3_error_offset = b.sqlite3_error_offset)(e)
              , Vi = o._sqlite3_errcode = e=>(Vi = o._sqlite3_errcode = b.sqlite3_errcode)(e)
              , Gi = o._sqlite3_extended_errcode = e=>(Gi = o._sqlite3_extended_errcode = b.sqlite3_extended_errcode)(e)
              , $i = o._sqlite3_errstr = e=>($i = o._sqlite3_errstr = b.sqlite3_errstr)(e)
              , Ki = o._sqlite3_limit = (e,t,r)=>(Ki = o._sqlite3_limit = b.sqlite3_limit)(e, t, r)
              , Ji = o._sqlite3_open = (e,t)=>(Ji = o._sqlite3_open = b.sqlite3_open)(e, t)
              , Xi = o._sqlite3_open_v2 = (e,t,r,i)=>(Xi = o._sqlite3_open_v2 = b.sqlite3_open_v2)(e, t, r, i)
              , Yi = o._sqlite3_create_collation = (e,t,r,i,n)=>(Yi = o._sqlite3_create_collation = b.sqlite3_create_collation)(e, t, r, i, n)
              , Zi = o._sqlite3_create_collation_v2 = (e,t,r,i,n,s)=>(Zi = o._sqlite3_create_collation_v2 = b.sqlite3_create_collation_v2)(e, t, r, i, n, s)
              , eo = o._sqlite3_collation_needed = (e,t,r)=>(eo = o._sqlite3_collation_needed = b.sqlite3_collation_needed)(e, t, r)
              , to = o._sqlite3_get_autocommit = e=>(to = o._sqlite3_get_autocommit = b.sqlite3_get_autocommit)(e)
              , ro = o._sqlite3_table_column_metadata = (e,t,r,i,n,s,p,y,O)=>(ro = o._sqlite3_table_column_metadata = b.sqlite3_table_column_metadata)(e, t, r, i, n, s, p, y, O)
              , no = o._sqlite3_extended_result_codes = (e,t)=>(no = o._sqlite3_extended_result_codes = b.sqlite3_extended_result_codes)(e, t)
              , so = o._sqlite3_uri_key = (e,t)=>(so = o._sqlite3_uri_key = b.sqlite3_uri_key)(e, t)
              , io = o._sqlite3_uri_int64 = (e,t,r)=>(io = o._sqlite3_uri_int64 = b.sqlite3_uri_int64)(e, t, r)
              , oo = o._sqlite3_db_name = (e,t)=>(oo = o._sqlite3_db_name = b.sqlite3_db_name)(e, t)
              , ao = o._sqlite3_db_filename = (e,t)=>(ao = o._sqlite3_db_filename = b.sqlite3_db_filename)(e, t)
              , lo = o._sqlite3_compileoption_used = e=>(lo = o._sqlite3_compileoption_used = b.sqlite3_compileoption_used)(e)
              , co = o._sqlite3_compileoption_get = e=>(co = o._sqlite3_compileoption_get = b.sqlite3_compileoption_get)(e)
              , _o = o._sqlite3session_diff = (e,t,r,i)=>(_o = o._sqlite3session_diff = b.sqlite3session_diff)(e, t, r, i)
              , uo = o._sqlite3session_attach = (e,t)=>(uo = o._sqlite3session_attach = b.sqlite3session_attach)(e, t)
              , fo = o._sqlite3session_create = (e,t,r)=>(fo = o._sqlite3session_create = b.sqlite3session_create)(e, t, r)
              , po = o._sqlite3session_delete = e=>(po = o._sqlite3session_delete = b.sqlite3session_delete)(e)
              , mo = o._sqlite3session_table_filter = (e,t,r)=>(mo = o._sqlite3session_table_filter = b.sqlite3session_table_filter)(e, t, r)
              , ho = o._sqlite3session_changeset = (e,t,r)=>(ho = o._sqlite3session_changeset = b.sqlite3session_changeset)(e, t, r)
              , go = o._sqlite3session_changeset_strm = (e,t,r)=>(go = o._sqlite3session_changeset_strm = b.sqlite3session_changeset_strm)(e, t, r)
              , qo = o._sqlite3session_patchset_strm = (e,t,r)=>(qo = o._sqlite3session_patchset_strm = b.sqlite3session_patchset_strm)(e, t, r)
              , bo = o._sqlite3session_patchset = (e,t,r)=>(bo = o._sqlite3session_patchset = b.sqlite3session_patchset)(e, t, r)
              , yo = o._sqlite3session_enable = (e,t)=>(yo = o._sqlite3session_enable = b.sqlite3session_enable)(e, t)
              , vo = o._sqlite3session_indirect = (e,t)=>(vo = o._sqlite3session_indirect = b.sqlite3session_indirect)(e, t)
              , wo = o._sqlite3session_isempty = e=>(wo = o._sqlite3session_isempty = b.sqlite3session_isempty)(e)
              , Eo = o._sqlite3session_memory_used = e=>(Eo = o._sqlite3session_memory_used = b.sqlite3session_memory_used)(e)
              , xo = o._sqlite3session_object_config = (e,t,r)=>(xo = o._sqlite3session_object_config = b.sqlite3session_object_config)(e, t, r)
              , So = o._sqlite3session_changeset_size = e=>(So = o._sqlite3session_changeset_size = b.sqlite3session_changeset_size)(e)
              , Ao = o._sqlite3changeset_start = (e,t,r)=>(Ao = o._sqlite3changeset_start = b.sqlite3changeset_start)(e, t, r)
              , Io = o._sqlite3changeset_start_v2 = (e,t,r,i)=>(Io = o._sqlite3changeset_start_v2 = b.sqlite3changeset_start_v2)(e, t, r, i)
              , ko = o._sqlite3changeset_start_strm = (e,t,r)=>(ko = o._sqlite3changeset_start_strm = b.sqlite3changeset_start_strm)(e, t, r)
              , To = o._sqlite3changeset_start_v2_strm = (e,t,r,i)=>(To = o._sqlite3changeset_start_v2_strm = b.sqlite3changeset_start_v2_strm)(e, t, r, i)
              , Fo = o._sqlite3changeset_next = e=>(Fo = o._sqlite3changeset_next = b.sqlite3changeset_next)(e)
              , Oo = o._sqlite3changeset_op = (e,t,r,i,n)=>(Oo = o._sqlite3changeset_op = b.sqlite3changeset_op)(e, t, r, i, n)
              , Po = o._sqlite3changeset_pk = (e,t,r)=>(Po = o._sqlite3changeset_pk = b.sqlite3changeset_pk)(e, t, r)
              , Lo = o._sqlite3changeset_old = (e,t,r)=>(Lo = o._sqlite3changeset_old = b.sqlite3changeset_old)(e, t, r)
              , Do = o._sqlite3changeset_new = (e,t,r)=>(Do = o._sqlite3changeset_new = b.sqlite3changeset_new)(e, t, r)
              , Co = o._sqlite3changeset_conflict = (e,t,r)=>(Co = o._sqlite3changeset_conflict = b.sqlite3changeset_conflict)(e, t, r)
              , Ro = o._sqlite3changeset_fk_conflicts = (e,t)=>(Ro = o._sqlite3changeset_fk_conflicts = b.sqlite3changeset_fk_conflicts)(e, t)
              , No = o._sqlite3changeset_finalize = e=>(No = o._sqlite3changeset_finalize = b.sqlite3changeset_finalize)(e)
              , Mo = o._sqlite3changeset_invert = (e,t,r,i)=>(Mo = o._sqlite3changeset_invert = b.sqlite3changeset_invert)(e, t, r, i)
              , jo = o._sqlite3changeset_invert_strm = (e,t,r,i)=>(jo = o._sqlite3changeset_invert_strm = b.sqlite3changeset_invert_strm)(e, t, r, i)
              , zo = o._sqlite3changeset_apply_v2 = (e,t,r,i,n,s,p,y,O)=>(zo = o._sqlite3changeset_apply_v2 = b.sqlite3changeset_apply_v2)(e, t, r, i, n, s, p, y, O)
              , Bo = o._sqlite3changeset_apply = (e,t,r,i,n,s)=>(Bo = o._sqlite3changeset_apply = b.sqlite3changeset_apply)(e, t, r, i, n, s)
              , Uo = o._sqlite3changeset_apply_v2_strm = (e,t,r,i,n,s,p,y,O)=>(Uo = o._sqlite3changeset_apply_v2_strm = b.sqlite3changeset_apply_v2_strm)(e, t, r, i, n, s, p, y, O)
              , Wo = o._sqlite3changeset_apply_strm = (e,t,r,i,n,s)=>(Wo = o._sqlite3changeset_apply_strm = b.sqlite3changeset_apply_strm)(e, t, r, i, n, s)
              , Qo = o._sqlite3changegroup_new = e=>(Qo = o._sqlite3changegroup_new = b.sqlite3changegroup_new)(e)
              , Ho = o._sqlite3changegroup_add = (e,t,r)=>(Ho = o._sqlite3changegroup_add = b.sqlite3changegroup_add)(e, t, r)
              , Vo = o._sqlite3changegroup_output = (e,t,r)=>(Vo = o._sqlite3changegroup_output = b.sqlite3changegroup_output)(e, t, r)
              , Go = o._sqlite3changegroup_add_strm = (e,t,r)=>(Go = o._sqlite3changegroup_add_strm = b.sqlite3changegroup_add_strm)(e, t, r)
              , $o = o._sqlite3changegroup_output_strm = (e,t,r)=>($o = o._sqlite3changegroup_output_strm = b.sqlite3changegroup_output_strm)(e, t, r)
              , Ko = o._sqlite3changegroup_delete = e=>(Ko = o._sqlite3changegroup_delete = b.sqlite3changegroup_delete)(e)
              , Jo = o._sqlite3changeset_concat = (e,t,r,i,n,s)=>(Jo = o._sqlite3changeset_concat = b.sqlite3changeset_concat)(e, t, r, i, n, s)
              , Xo = o._sqlite3changeset_concat_strm = (e,t,r,i,n,s)=>(Xo = o._sqlite3changeset_concat_strm = b.sqlite3changeset_concat_strm)(e, t, r, i, n, s)
              , Yo = o._sqlite3session_config = (e,t)=>(Yo = o._sqlite3session_config = b.sqlite3session_config)(e, t)
              , Zo = o._sqlite3_sourceid = ()=>(Zo = o._sqlite3_sourceid = b.sqlite3_sourceid)()
              , ea = o._sqlite3_wasm_pstack_ptr = ()=>(ea = o._sqlite3_wasm_pstack_ptr = b.sqlite3_wasm_pstack_ptr)()
              , ta = o._sqlite3_wasm_pstack_restore = e=>(ta = o._sqlite3_wasm_pstack_restore = b.sqlite3_wasm_pstack_restore)(e)
              , ra = o._sqlite3_wasm_pstack_alloc = e=>(ra = o._sqlite3_wasm_pstack_alloc = b.sqlite3_wasm_pstack_alloc)(e)
              , na = o._sqlite3_wasm_pstack_remaining = ()=>(na = o._sqlite3_wasm_pstack_remaining = b.sqlite3_wasm_pstack_remaining)()
              , sa = o._sqlite3_wasm_pstack_quota = ()=>(sa = o._sqlite3_wasm_pstack_quota = b.sqlite3_wasm_pstack_quota)()
              , ia = o._sqlite3_wasm_db_error = (e,t,r)=>(ia = o._sqlite3_wasm_db_error = b.sqlite3_wasm_db_error)(e, t, r)
              , oa = o._sqlite3_wasm_test_struct = e=>(oa = o._sqlite3_wasm_test_struct = b.sqlite3_wasm_test_struct)(e)
              , aa = o._sqlite3_wasm_enum_json = ()=>(aa = o._sqlite3_wasm_enum_json = b.sqlite3_wasm_enum_json)()
              , la = o._sqlite3_wasm_vfs_unlink = (e,t)=>(la = o._sqlite3_wasm_vfs_unlink = b.sqlite3_wasm_vfs_unlink)(e, t)
              , ca = o._sqlite3_wasm_db_vfs = (e,t)=>(ca = o._sqlite3_wasm_db_vfs = b.sqlite3_wasm_db_vfs)(e, t)
              , _a = o._sqlite3_wasm_db_reset = e=>(_a = o._sqlite3_wasm_db_reset = b.sqlite3_wasm_db_reset)(e)
              , ua = o._sqlite3_wasm_db_export_chunked = (e,t)=>(ua = o._sqlite3_wasm_db_export_chunked = b.sqlite3_wasm_db_export_chunked)(e, t)
              , fa = o._sqlite3_wasm_db_serialize = (e,t,r,i,n)=>(fa = o._sqlite3_wasm_db_serialize = b.sqlite3_wasm_db_serialize)(e, t, r, i, n)
              , da = o._sqlite3_wasm_vfs_create_file = (e,t,r,i)=>(da = o._sqlite3_wasm_vfs_create_file = b.sqlite3_wasm_vfs_create_file)(e, t, r, i)
              , pa = o._sqlite3_wasm_posix_create_file = (e,t,r)=>(pa = o._sqlite3_wasm_posix_create_file = b.sqlite3_wasm_posix_create_file)(e, t, r)
              , ma = o._sqlite3_wasm_kvvfsMakeKeyOnPstack = (e,t)=>(ma = o._sqlite3_wasm_kvvfsMakeKeyOnPstack = b.sqlite3_wasm_kvvfsMakeKeyOnPstack)(e, t)
              , ha = o._sqlite3_wasm_kvvfs_methods = ()=>(ha = o._sqlite3_wasm_kvvfs_methods = b.sqlite3_wasm_kvvfs_methods)()
              , ga = o._sqlite3_wasm_vtab_config = (e,t,r)=>(ga = o._sqlite3_wasm_vtab_config = b.sqlite3_wasm_vtab_config)(e, t, r)
              , qa = o._sqlite3_wasm_db_config_ip = (e,t,r,i)=>(qa = o._sqlite3_wasm_db_config_ip = b.sqlite3_wasm_db_config_ip)(e, t, r, i)
              , ba = o._sqlite3_wasm_db_config_pii = (e,t,r,i,n)=>(ba = o._sqlite3_wasm_db_config_pii = b.sqlite3_wasm_db_config_pii)(e, t, r, i, n)
              , ya = o._sqlite3_wasm_db_config_s = (e,t,r)=>(ya = o._sqlite3_wasm_db_config_s = b.sqlite3_wasm_db_config_s)(e, t, r)
              , va = o._sqlite3_wasm_config_i = (e,t)=>(va = o._sqlite3_wasm_config_i = b.sqlite3_wasm_config_i)(e, t)
              , wa = o._sqlite3_wasm_config_ii = (e,t,r)=>(wa = o._sqlite3_wasm_config_ii = b.sqlite3_wasm_config_ii)(e, t, r)
              , Ea = o._sqlite3_wasm_config_j = (e,t)=>(Ea = o._sqlite3_wasm_config_j = b.sqlite3_wasm_config_j)(e, t)
              , xa = o._sqlite3_wasm_init_wasmfs = e=>(xa = o._sqlite3_wasm_init_wasmfs = b.sqlite3_wasm_init_wasmfs)(e)
              , Sa = o._sqlite3_wasm_test_intptr = e=>(Sa = o._sqlite3_wasm_test_intptr = b.sqlite3_wasm_test_intptr)(e)
              , Aa = o._sqlite3_wasm_test_voidptr = e=>(Aa = o._sqlite3_wasm_test_voidptr = b.sqlite3_wasm_test_voidptr)(e)
              , Ia = o._sqlite3_wasm_test_int64_max = ()=>(Ia = o._sqlite3_wasm_test_int64_max = b.sqlite3_wasm_test_int64_max)()
              , ka = o._sqlite3_wasm_test_int64_min = ()=>(ka = o._sqlite3_wasm_test_int64_min = b.sqlite3_wasm_test_int64_min)()
              , Ta = o._sqlite3_wasm_test_int64_times2 = e=>(Ta = o._sqlite3_wasm_test_int64_times2 = b.sqlite3_wasm_test_int64_times2)(e)
              , Fa = o._sqlite3_wasm_test_int64_minmax = (e,t)=>(Fa = o._sqlite3_wasm_test_int64_minmax = b.sqlite3_wasm_test_int64_minmax)(e, t)
              , Oa = o._sqlite3_wasm_test_int64ptr = e=>(Oa = o._sqlite3_wasm_test_int64ptr = b.sqlite3_wasm_test_int64ptr)(e)
              , Pa = o._sqlite3_wasm_test_stack_overflow = e=>(Pa = o._sqlite3_wasm_test_stack_overflow = b.sqlite3_wasm_test_stack_overflow)(e)
              , La = o._sqlite3_wasm_test_str_hello = e=>(La = o._sqlite3_wasm_test_str_hello = b.sqlite3_wasm_test_str_hello)(e)
              , Da = o._sqlite3_wasm_SQLTester_strglob = (e,t)=>(Da = o._sqlite3_wasm_SQLTester_strglob = b.sqlite3_wasm_SQLTester_strglob)(e, t)
              , Bt = o._malloc = e=>(Bt = o._malloc = b.malloc)(e)
              , Ca = o._free = e=>(Ca = o._free = b.free)(e)
              , Ra = o._realloc = (e,t)=>(Ra = o._realloc = b.realloc)(e, t)
              , Ut = (e,t)=>(Ut = b.emscripten_builtin_memalign)(e, t)
              , Na = ()=>(Na = b.stackSave)()
              , Ma = e=>(Ma = b.stackRestore)(e)
              , ja = e=>(ja = b.stackAlloc)(e);
            o.wasmMemory = De;
            var et;
            Qe = function e() {
                et || Wt(),
                et || (Qe = e);
            }
            ;
            function Wt() {
                if (Me > 0 || (er(),
                Me > 0))
                    return;
                function e() {
                    et || (et = !0,
                    o.calledRun = !0,
                    !xt && (tr(),
                    Ie(o),
                    o.onRuntimeInitialized && o.onRuntimeInitialized(),
                    rr()));
                }
                o.setStatus ? (o.setStatus("Running..."),
                setTimeout(function() {
                    setTimeout(function() {
                        o.setStatus("");
                    }, 1),
                    e();
                }, 1)) : e();
            }
            if (o.preInit)
                for (typeof o.preInit == "function" && (o.preInit = [o.preInit]); o.preInit.length > 0; )
                    o.preInit.pop()();
            return Wt(),
            o.postRun || (o.postRun = []),
            o.postRun.push(function(e) {
                "use strict";
                "use strict";
                if (globalThis.sqlite3ApiBootstrap = function t(r=globalThis.sqlite3ApiConfig || t.defaultConfig) {
                    if (t.sqlite3)
                        return console.warn("sqlite3ApiBootstrap() called multiple times.", "Config and external initializers are ignored on calls after the first."),
                        t.sqlite3;
                    let i = Object.assign(Object.create(null), {
                        exports: void 0,
                        memory: void 0,
                        bigIntEnabled: (()=>typeof e < "u" ? !!e.HEAPU64 : !!globalThis.BigInt64Array)(),
                        debug: console.debug.bind(console),
                        warn: console.warn.bind(console),
                        error: console.error.bind(console),
                        log: console.log.bind(console),
                        wasmfsOpfsDir: "/opfs",
                        useStdAlloc: !1
                    }, r || {});
                    Object.assign(i, {
                        allocExportName: i.useStdAlloc ? "malloc" : "sqlite3_malloc",
                        deallocExportName: i.useStdAlloc ? "free" : "sqlite3_free",
                        reallocExportName: i.useStdAlloc ? "realloc" : "sqlite3_realloc"
                    }, i),
                    ["exports", "memory", "wasmfsOpfsDir"].forEach(l=>{
                        typeof i[l] == "function" && (i[l] = i[l]());
                    }
                    );
                    let n = Object.create(null)
                      , s = Object.create(null)
                      , p = l=>n.sqlite3_js_rc_str && n.sqlite3_js_rc_str(l) || "Unknown result code #" + l
                      , y = l=>typeof l == "number" && l === (l | 0);
                    class O extends Error {
                        constructor(..._) {
                            let c;
                            if (_.length)
                                if (y(_[0]))
                                    if (c = _[0],
                                    _.length === 1)
                                        super(p(_[0]));
                                    else {
                                        let w = p(c);
                                        typeof _[1] == "object" ? super(w, _[1]) : (_[0] = w + ":",
                                        super(_.join(" ")));
                                    }
                                else
                                    _.length === 2 && typeof _[1] == "object" ? super(..._) : super(_.join(" "));
                            this.resultCode = c || n.SQLITE_ERROR,
                            this.name = "SQLite3Error";
                        }
                    }
                    O.toss = (...l)=>{
                        throw new O(...l)
                    }
                    ;
                    let B = O.toss;
                    i.wasmfsOpfsDir && !/^\/[^/]+$/.test(i.wasmfsOpfsDir) && B("config.wasmfsOpfsDir must be falsy or in the form '/dir-name'.");
                    let G = l=>typeof l != "bigint" && l === (l | 0) && l <= 2147483647 && l >= -2147483648
                      , J = function l(_) {
                        return l._max || (l._max = BigInt("0x7fffffffffffffff"),
                        l._min = ~l._max),
                        _ >= l._min && _ <= l._max
                    }
                      , Y = l=>l >= -0x7fffffffn - 1n && l <= 0x7fffffffn
                      , d = function l(_) {
                        return l._min || (l._min = Number.MIN_SAFE_INTEGER,
                        l._max = Number.MAX_SAFE_INTEGER),
                        _ >= l._min && _ <= l._max
                    }
                      , f = l=>l && l.constructor && G(l.constructor.BYTES_PER_ELEMENT) ? l : !1
                      , m = typeof SharedArrayBuffer > "u" ? function() {}
                    : SharedArrayBuffer
                      , I = l=>l.buffer instanceof m
                      , x = (l,_,c)=>I(l) ? l.slice(_, c) : l.subarray(_, c)
                      , S = l=>l && (l instanceof Uint8Array || l instanceof Int8Array || l instanceof ArrayBuffer)
                      , R = l=>l && (l instanceof Uint8Array || l instanceof Int8Array || l instanceof ArrayBuffer)
                      , z = l=>S(l) || B("Value is not of a supported TypedArray type.")
                      , L = new TextDecoder("utf-8")
                      , $ = function(l, _, c) {
                        return L.decode(x(l, _, c))
                    }
                      , u = function(l) {
                        return R(l) ? $(l instanceof ArrayBuffer ? new Uint8Array(l) : l) : Array.isArray(l) ? l.join("") : (s.isPtr(l) && (l = s.cstrToJs(l)),
                        l)
                    };
                    class q extends Error {
                        constructor(..._) {
                            _.length === 2 && typeof _[1] == "object" ? super(..._) : _.length ? super(_.join(" ")) : super("Allocation failed."),
                            this.resultCode = n.SQLITE_NOMEM,
                            this.name = "WasmAllocError";
                        }
                    }
                    q.toss = (...l)=>{
                        throw new q(...l)
                    }
                    ,
                    Object.assign(n, {
                        sqlite3_bind_blob: void 0,
                        sqlite3_bind_text: void 0,
                        sqlite3_create_function_v2: (l,_,c,w,j,H,se,ee,ie)=>{}
                        ,
                        sqlite3_create_function: (l,_,c,w,j,H,se,ee)=>{}
                        ,
                        sqlite3_create_window_function: (l,_,c,w,j,H,se,ee,ie,le)=>{}
                        ,
                        sqlite3_prepare_v3: (l,_,c,w,j,H)=>{}
                        ,
                        sqlite3_prepare_v2: (l,_,c,w,j)=>{}
                        ,
                        sqlite3_exec: (l,_,c,w,j)=>{}
                        ,
                        sqlite3_randomness: (l,_)=>{}
                    });
                    let F = {
                        affirmBindableTypedArray: z,
                        flexibleString: u,
                        bigIntFits32: Y,
                        bigIntFits64: J,
                        bigIntFitsDouble: d,
                        isBindableTypedArray: S,
                        isInt32: G,
                        isSQLableTypedArray: R,
                        isTypedArray: f,
                        typedArrayToString: $,
                        isUIThread: ()=>globalThis.window === globalThis && !!globalThis.document,
                        isSharedTypedArray: I,
                        toss: function(...l) {
                            throw new Error(l.join(" "))
                        },
                        toss3: B,
                        typedArrayPart: x,
                        affirmDbHeader: function(l) {
                            l instanceof ArrayBuffer && (l = new Uint8Array(l));
                            let _ = "SQLite format 3";
                            _.length > l.byteLength && B("Input does not contain an SQLite3 database header.");
                            for (let c = 0; c < _.length; ++c)
                                _.charCodeAt(c) !== l[c] && B("Input does not contain an SQLite3 database header.");
                        },
                        affirmIsDb: function(l) {
                            l instanceof ArrayBuffer && (l = new Uint8Array(l));
                            let _ = l.byteLength;
                            (_ < 512 || _ % 512 !== 0) && B("Byte array size", _, "is invalid for an SQLite3 db."),
                            F.affirmDbHeader(l);
                        }
                    };
                    Object.assign(s, {
                        ptrSizeof: i.wasmPtrSizeof || 4,
                        ptrIR: i.wasmPtrIR || "i32",
                        bigIntEnabled: !!i.bigIntEnabled,
                        exports: i.exports || B("Missing API config.exports (WASM module exports)."),
                        memory: i.memory || i.exports.memory || B("API config object requires a WebAssembly.Memory object", "in either config.exports.memory (exported)", "or config.memory (imported)."),
                        alloc: void 0,
                        realloc: void 0,
                        dealloc: void 0
                    }),
                    s.allocFromTypedArray = function(l) {
                        l instanceof ArrayBuffer && (l = new Uint8Array(l)),
                        z(l);
                        let _ = s.alloc(l.byteLength || 1);
                        return s.heapForSize(l.constructor).set(l.byteLength ? l : [0], _),
                        _
                    }
                    ;
                    {
                        let l = i.allocExportName
                          , _ = i.deallocExportName
                          , c = i.reallocExportName;
                        for (let w of [l, _, c])
                            s.exports[w]instanceof Function || B("Missing required exports[", w, "] function.");
                        s.alloc = function w(j) {
                            return w.impl(j) || q.toss("Failed to allocate", j, " bytes.")
                        }
                        ,
                        s.alloc.impl = s.exports[l],
                        s.realloc = function w(j, H) {
                            let se = w.impl(j, H);
                            return H ? se || q.toss("Failed to reallocate", H, " bytes.") : 0
                        }
                        ,
                        s.realloc.impl = s.exports[c],
                        s.dealloc = s.exports[_];
                    }
                    s.compileOptionUsed = function l(_) {
                        if (arguments.length) {
                            if (Array.isArray(_)) {
                                let c = {};
                                return _.forEach(w=>{
                                    c[w] = n.sqlite3_compileoption_used(w);
                                }
                                ),
                                c
                            } else if (typeof _ == "object")
                                return Object.keys(_).forEach(c=>{
                                    _[c] = n.sqlite3_compileoption_used(c);
                                }
                                ),
                                _
                        } else {
                            if (l._result)
                                return l._result;
                            l._opt || (l._rx = /^([^=]+)=(.+)/,
                            l._rxInt = /^-?\d+$/,
                            l._opt = function(se, ee) {
                                let ie = l._rx.exec(se);
                                ee[0] = ie ? ie[1] : se,
                                ee[1] = ie ? l._rxInt.test(ie[2]) ? +ie[2] : ie[2] : !0;
                            }
                            );
                            let c = {}, w = [0, 0], j = 0, H;
                            for (; H = n.sqlite3_compileoption_get(j++); )
                                l._opt(H, w),
                                c[w[0]] = w[1];
                            return l._result = c
                        }
                        return typeof _ == "string" ? !!n.sqlite3_compileoption_used(_) : !1
                    }
                    ,
                    s.pstack = Object.assign(Object.create(null), {
                        restore: s.exports.sqlite3_wasm_pstack_restore,
                        alloc: function(l) {
                            return typeof l == "string" && !(l = s.sizeofIR(l)) && q.toss("Invalid value for pstack.alloc(", arguments[0], ")"),
                            s.exports.sqlite3_wasm_pstack_alloc(l) || q.toss("Could not allocate", l, "bytes from the pstack.")
                        },
                        allocChunks: function(l, _) {
                            typeof _ == "string" && !(_ = s.sizeofIR(_)) && q.toss("Invalid size value for allocChunks(", arguments[1], ")");
                            let c = s.pstack.alloc(l * _)
                              , w = []
                              , j = 0
                              , H = 0;
                            for (; j < l; ++j,
                            H += _)
                                w.push(c + H);
                            return w
                        },
                        allocPtr: (l=1,_=!0)=>l === 1 ? s.pstack.alloc(_ ? 8 : s.ptrSizeof) : s.pstack.allocChunks(l, _ ? 8 : s.ptrSizeof),
                        call: function(l) {
                            let _ = s.pstack.pointer;
                            try {
                                return l(h)
                            } finally {
                                s.pstack.restore(_);
                            }
                        }
                    }),
                    Object.defineProperties(s.pstack, {
                        pointer: {
                            configurable: !1,
                            iterable: !0,
                            writeable: !1,
                            get: s.exports.sqlite3_wasm_pstack_ptr
                        },
                        quota: {
                            configurable: !1,
                            iterable: !0,
                            writeable: !1,
                            get: s.exports.sqlite3_wasm_pstack_quota
                        },
                        remaining: {
                            configurable: !1,
                            iterable: !0,
                            writeable: !1,
                            get: s.exports.sqlite3_wasm_pstack_remaining
                        }
                    }),
                    n.sqlite3_randomness = (...l)=>{
                        if (l.length === 1 && F.isTypedArray(l[0]) && l[0].BYTES_PER_ELEMENT === 1) {
                            let _ = l[0];
                            if (_.byteLength === 0)
                                return s.exports.sqlite3_randomness(0, 0),
                                _;
                            let c = s.pstack.pointer;
                            try {
                                let w = _.byteLength
                                  , j = 0
                                  , H = s.exports.sqlite3_randomness
                                  , se = s.heap8u()
                                  , ee = w < 512 ? w : 512
                                  , ie = s.pstack.alloc(ee);
                                do {
                                    let le = w > ee ? ee : w;
                                    H(le, ie),
                                    _.set(x(se, ie, ie + le), j),
                                    w -= le,
                                    j += le;
                                } while (w > 0)
                            } catch (w) {
                                console.error("Highly unexpected (and ignored!) exception in sqlite3_randomness():", w);
                            } finally {
                                s.pstack.restore(c);
                            }
                            return _
                        }
                        s.exports.sqlite3_randomness(...l);
                    }
                    ;
                    let D;
                    if (n.sqlite3_wasmfs_opfs_dir = function() {
                        if (D !== void 0)
                            return D;
                        let l = i.wasmfsOpfsDir;
                        if (!l || !globalThis.FileSystemHandle || !globalThis.FileSystemDirectoryHandle || !globalThis.FileSystemFileHandle)
                            return D = "";
                        try {
                            return l && s.xCallWrapped("sqlite3_wasm_init_wasmfs", "i32", ["string"], l) === 0 ? D = l : D = ""
                        } catch {
                            return D = ""
                        }
                    }
                    ,
                    n.sqlite3_wasmfs_filename_is_persistent = function(l) {
                        let _ = n.sqlite3_wasmfs_opfs_dir();
                        return _ && l ? l.startsWith(_ + "/") : !1
                    }
                    ,
                    n.sqlite3_js_db_uses_vfs = function(l, _, c=0) {
                        try {
                            let w = n.sqlite3_vfs_find(_);
                            return w ? l ? w === n.sqlite3_js_db_vfs(l, c) ? w : !1 : w === n.sqlite3_vfs_find(0) ? w : !1 : !1
                        } catch {
                            return !1
                        }
                    }
                    ,
                    n.sqlite3_js_vfs_list = function() {
                        let l = []
                          , _ = n.sqlite3_vfs_find(0);
                        for (; _; ) {
                            let c = new n.sqlite3_vfs(_);
                            l.push(s.cstrToJs(c.$zName)),
                            _ = c.$pNext,
                            c.dispose();
                        }
                        return l
                    }
                    ,
                    n.sqlite3_js_db_export = function(l, _=0) {
                        l = s.xWrap.testConvertArg("sqlite3*", l),
                        l || B("Invalid sqlite3* argument."),
                        s.bigIntEnabled || B("BigInt64 support is not enabled.");
                        let c = s.scopedAllocPush(), w;
                        try {
                            let j = s.scopedAlloc(8 + s.ptrSizeof)
                              , H = j + 8
                              , se = _ ? s.isPtr(_) ? _ : s.scopedAllocCString("" + _) : 0
                              , ee = s.exports.sqlite3_wasm_db_serialize(l, se, H, j, 0);
                            ee && B("Database serialization failed with code", h.capi.sqlite3_js_rc_str(ee)),
                            w = s.peekPtr(H);
                            let ie = s.peek(j, "i64");
                            return ee = ie ? s.heap8u().slice(w, w + Number(ie)) : new Uint8Array,
                            ee
                        } finally {
                            w && s.exports.sqlite3_free(w),
                            s.scopedAllocPop(c);
                        }
                    }
                    ,
                    n.sqlite3_js_db_vfs = (l,_=0)=>s.sqlite3_wasm_db_vfs(l, _),
                    n.sqlite3_js_aggregate_context = (l,_)=>n.sqlite3_aggregate_context(l, _) || (_ ? q.toss("Cannot allocate", _, "bytes for sqlite3_aggregate_context()") : 0),
                    n.sqlite3_js_posix_create_file = function(l, _, c) {
                        let w;
                        _ && s.isPtr(_) ? w = _ : _ instanceof ArrayBuffer || _ instanceof Uint8Array ? (w = s.allocFromTypedArray(_),
                        (arguments.length < 3 || !F.isInt32(c) || c < 0) && (c = _.byteLength)) : O.toss("Invalid 2nd argument for sqlite3_js_posix_create_file().");
                        try {
                            (!F.isInt32(c) || c < 0) && O.toss("Invalid 3rd argument for sqlite3_js_posix_create_file().");
                            let j = s.sqlite3_wasm_posix_create_file(l, w, c);
                            j && O.toss("Creation of file failed with sqlite3 result code", n.sqlite3_js_rc_str(j));
                        } finally {
                            s.dealloc(w);
                        }
                    }
                    ,
                    n.sqlite3_js_vfs_create_file = function(l, _, c, w) {
                        i.warn("sqlite3_js_vfs_create_file() is deprecated and", "should be avoided because it can lead to C-level crashes.", "See its documentation for alternative options.");
                        let j;
                        c ? (s.isPtr(c) ? j = c : c instanceof ArrayBuffer && (c = new Uint8Array(c)),
                        c instanceof Uint8Array ? (j = s.allocFromTypedArray(c),
                        (arguments.length < 4 || !F.isInt32(w) || w < 0) && (w = c.byteLength)) : O.toss("Invalid 3rd argument type for sqlite3_js_vfs_create_file().")) : j = 0,
                        (!F.isInt32(w) || w < 0) && (s.dealloc(j),
                        O.toss("Invalid 4th argument for sqlite3_js_vfs_create_file()."));
                        try {
                            let H = s.sqlite3_wasm_vfs_create_file(l, _, j, w);
                            H && O.toss("Creation of file failed with sqlite3 result code", n.sqlite3_js_rc_str(H));
                        } finally {
                            s.dealloc(j);
                        }
                    }
                    ,
                    n.sqlite3_js_sql_to_string = l=>{
                        if (typeof l == "string")
                            return l;
                        let _ = u(v);
                        return _ === v ? void 0 : _
                    }
                    ,
                    F.isUIThread()) {
                        let l = function(_) {
                            let c = Object.create(null);
                            return c.prefix = "kvvfs-" + _,
                            c.stores = [],
                            (_ === "session" || _ === "") && c.stores.push(globalThis.sessionStorage),
                            (_ === "local" || _ === "") && c.stores.push(globalThis.localStorage),
                            c
                        };
                        n.sqlite3_js_kvvfs_clear = function(_="") {
                            let c = 0
                              , w = l(_);
                            return w.stores.forEach(j=>{
                                let H = [], se;
                                for (se = 0; se < j.length; ++se) {
                                    let ee = j.key(se);
                                    ee.startsWith(w.prefix) && H.push(ee);
                                }
                                H.forEach(ee=>j.removeItem(ee)),
                                c += H.length;
                            }
                            ),
                            c
                        }
                        ,
                        n.sqlite3_js_kvvfs_size = function(_="") {
                            let c = 0
                              , w = l(_);
                            return w.stores.forEach(j=>{
                                let H;
                                for (H = 0; H < j.length; ++H) {
                                    let se = j.key(H);
                                    se.startsWith(w.prefix) && (c += se.length,
                                    c += j.getItem(se).length);
                                }
                            }
                            ),
                            c * 2
                        };
                    }
                    n.sqlite3_db_config = function(l, _, ...c) {
                        switch (this.s || (this.s = s.xWrap("sqlite3_wasm_db_config_s", "int", ["sqlite3*", "int", "string:static"]),
                        this.pii = s.xWrap("sqlite3_wasm_db_config_pii", "int", ["sqlite3*", "int", "*", "int", "int"]),
                        this.ip = s.xWrap("sqlite3_wasm_db_config_ip", "int", ["sqlite3*", "int", "int", "*"])),
                        _) {
                        case n.SQLITE_DBCONFIG_ENABLE_FKEY:
                        case n.SQLITE_DBCONFIG_ENABLE_TRIGGER:
                        case n.SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER:
                        case n.SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION:
                        case n.SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE:
                        case n.SQLITE_DBCONFIG_ENABLE_QPSG:
                        case n.SQLITE_DBCONFIG_TRIGGER_EQP:
                        case n.SQLITE_DBCONFIG_RESET_DATABASE:
                        case n.SQLITE_DBCONFIG_DEFENSIVE:
                        case n.SQLITE_DBCONFIG_WRITABLE_SCHEMA:
                        case n.SQLITE_DBCONFIG_LEGACY_ALTER_TABLE:
                        case n.SQLITE_DBCONFIG_DQS_DML:
                        case n.SQLITE_DBCONFIG_DQS_DDL:
                        case n.SQLITE_DBCONFIG_ENABLE_VIEW:
                        case n.SQLITE_DBCONFIG_LEGACY_FILE_FORMAT:
                        case n.SQLITE_DBCONFIG_TRUSTED_SCHEMA:
                        case n.SQLITE_DBCONFIG_STMT_SCANSTATUS:
                        case n.SQLITE_DBCONFIG_REVERSE_SCANORDER:
                            return this.ip(l, _, c[0], c[1] || 0);
                        case n.SQLITE_DBCONFIG_LOOKASIDE:
                            return this.pii(l, _, c[0], c[1], c[2]);
                        case n.SQLITE_DBCONFIG_MAINDBNAME:
                            return this.s(l, _, c[0]);
                        default:
                            return n.SQLITE_MISUSE
                        }
                    }
                    .bind(Object.create(null)),
                    n.sqlite3_value_to_js = function(l, _=!0) {
                        let c, w = n.sqlite3_value_type(l);
                        switch (w) {
                        case n.SQLITE_INTEGER:
                            s.bigIntEnabled ? (c = n.sqlite3_value_int64(l),
                            F.bigIntFitsDouble(c) && (c = Number(c))) : c = n.sqlite3_value_double(l);
                            break;
                        case n.SQLITE_FLOAT:
                            c = n.sqlite3_value_double(l);
                            break;
                        case n.SQLITE_TEXT:
                            c = n.sqlite3_value_text(l);
                            break;
                        case n.SQLITE_BLOB:
                            {
                                let j = n.sqlite3_value_bytes(l)
                                  , H = n.sqlite3_value_blob(l);
                                j && !H && h.WasmAllocError.toss("Cannot allocate memory for blob argument of", j, "byte(s)"),
                                c = j ? s.heap8u().slice(H, H + Number(j)) : null;
                                break
                            }
                        case n.SQLITE_NULL:
                            c = null;
                            break;
                        default:
                            _ && B(n.SQLITE_MISMATCH, "Unhandled sqlite3_value_type():", w),
                            c = void 0;
                        }
                        return c
                    }
                    ,
                    n.sqlite3_values_to_js = function(l, _, c=!0) {
                        let w, j = [];
                        for (w = 0; w < l; ++w)
                            j.push(n.sqlite3_value_to_js(s.peekPtr(_ + s.ptrSizeof * w), c));
                        return j
                    }
                    ,
                    n.sqlite3_result_error_js = function(l, _) {
                        _ instanceof q ? n.sqlite3_result_error_nomem(l) : n.sqlite3_result_error(l, "" + _, -1);
                    }
                    ,
                    n.sqlite3_result_js = function(l, _) {
                        if (_ instanceof Error) {
                            n.sqlite3_result_error_js(l, _);
                            return
                        }
                        try {
                            switch (typeof _) {
                            case "undefined":
                                break;
                            case "boolean":
                                n.sqlite3_result_int(l, _ ? 1 : 0);
                                break;
                            case "bigint":
                                F.bigIntFits32(_) ? n.sqlite3_result_int(l, Number(_)) : F.bigIntFitsDouble(_) ? n.sqlite3_result_double(l, Number(_)) : s.bigIntEnabled ? F.bigIntFits64(_) ? n.sqlite3_result_int64(l, _) : B("BigInt value", _.toString(), "is too BigInt for int64.") : B("BigInt value", _.toString(), "is too BigInt.");
                                break;
                            case "number":
                                {
                                    let c;
                                    F.isInt32(_) ? c = n.sqlite3_result_int : s.bigIntEnabled && Number.isInteger(_) && F.bigIntFits64(BigInt(_)) ? c = n.sqlite3_result_int64 : c = n.sqlite3_result_double,
                                    c(l, _);
                                    break
                                }
                            case "string":
                                {
                                    let[c,w] = s.allocCString(_, !0);
                                    n.sqlite3_result_text(l, c, w, n.SQLITE_WASM_DEALLOC);
                                    break
                                }
                            case "object":
                                if (_ === null) {
                                    n.sqlite3_result_null(l);
                                    break
                                } else if (F.isBindableTypedArray(_)) {
                                    let c = s.allocFromTypedArray(_);
                                    n.sqlite3_result_blob(l, c, _.byteLength, n.SQLITE_WASM_DEALLOC);
                                    break
                                }
                            default:
                                B("Don't not how to handle this UDF result value:", typeof _, _);
                            }
                        } catch (c) {
                            n.sqlite3_result_error_js(l, c);
                        }
                    }
                    ,
                    n.sqlite3_column_js = function(l, _, c=!0) {
                        let w = n.sqlite3_column_value(l, _);
                        return w === 0 ? void 0 : n.sqlite3_value_to_js(w, c)
                    }
                    ;
                    let P = function(l, _, c) {
                        c = n[c],
                        this.ptr ? s.pokePtr(this.ptr, 0) : this.ptr = s.allocPtr();
                        let w = c(l, _, this.ptr);
                        if (w)
                            return O.toss(w, arguments[2] + "() failed with code " + w);
                        let j = s.peekPtr(this.ptr);
                        return j ? n.sqlite3_value_to_js(j, !0) : void 0
                    }
                    .bind(Object.create(null));
                    n.sqlite3_preupdate_new_js = (l,_)=>P(l, _, "sqlite3_preupdate_new"),
                    n.sqlite3_preupdate_old_js = (l,_)=>P(l, _, "sqlite3_preupdate_old"),
                    n.sqlite3changeset_new_js = (l,_)=>P(l, _, "sqlite3changeset_new"),
                    n.sqlite3changeset_old_js = (l,_)=>P(l, _, "sqlite3changeset_old");
                    let h = {
                        WasmAllocError: q,
                        SQLite3Error: O,
                        capi: n,
                        util: F,
                        wasm: s,
                        config: i,
                        version: Object.create(null),
                        client: void 0,
                        asyncPostInit: async function l() {
                            if (l.isReady instanceof Promise)
                                return l.isReady;
                            let _ = t.initializersAsync;
                            delete t.initializersAsync;
                            let c = async()=>(h.__isUnderTest || (delete h.util,
                            delete h.StructBinder),
                            h)
                              , w = H=>{
                                throw i.error("an async sqlite3 initializer failed:", H),
                                H
                            }
                            ;
                            if (!_ || !_.length)
                                return l.isReady = c().catch(w);
                            _ = _.map(H=>H instanceof Function ? async se=>H(h) : H),
                            _.push(c);
                            let j = Promise.resolve(h);
                            for (; _.length; )
                                j = j.then(_.shift());
                            return l.isReady = j.catch(w)
                        },
                        scriptInfo: void 0
                    };
                    try {
                        t.initializers.forEach(l=>{
                            l(h);
                        }
                        );
                    } catch (l) {
                        throw console.error("sqlite3 bootstrap initializer threw:", l),
                        l
                    }
                    return delete t.initializers,
                    t.sqlite3 = h,
                    h
                }
                ,
                globalThis.sqlite3ApiBootstrap.initializers = [],
                globalThis.sqlite3ApiBootstrap.initializersAsync = [],
                globalThis.sqlite3ApiBootstrap.defaultConfig = Object.create(null),
                globalThis.sqlite3ApiBootstrap.sqlite3 = void 0,
                globalThis.WhWasmUtilInstaller = function(t) {
                    "use strict";
                    t.bigIntEnabled === void 0 && (t.bigIntEnabled = !!globalThis.BigInt64Array);
                    let r = (...u)=>{
                        throw new Error(u.join(" "))
                    }
                    ;
                    t.exports || Object.defineProperty(t, "exports", {
                        enumerable: !0,
                        configurable: !0,
                        get: ()=>t.instance && t.instance.exports
                    });
                    let i = t.pointerIR || "i32"
                      , n = t.ptrSizeof = i === "i32" ? 4 : i === "i64" ? 8 : r("Unhandled ptrSizeof:", i)
                      , s = Object.create(null);
                    s.heapSize = 0,
                    s.memory = null,
                    s.freeFuncIndexes = [],
                    s.scopedAlloc = [],
                    s.utf8Decoder = new TextDecoder,
                    s.utf8Encoder = new TextEncoder("utf-8"),
                    t.sizeofIR = u=>{
                        switch (u) {
                        case "i8":
                            return 1;
                        case "i16":
                            return 2;
                        case "i32":
                        case "f32":
                        case "float":
                            return 4;
                        case "i64":
                        case "f64":
                        case "double":
                            return 8;
                        case "*":
                            return n;
                        default:
                            return ("" + u).endsWith("*") ? n : void 0
                        }
                    }
                    ;
                    let p = function() {
                        if (!s.memory)
                            s.memory = t.memory instanceof WebAssembly.Memory ? t.memory : t.exports.memory;
                        else if (s.heapSize === s.memory.buffer.byteLength)
                            return s;
                        let u = s.memory.buffer;
                        return s.HEAP8 = new Int8Array(u),
                        s.HEAP8U = new Uint8Array(u),
                        s.HEAP16 = new Int16Array(u),
                        s.HEAP16U = new Uint16Array(u),
                        s.HEAP32 = new Int32Array(u),
                        s.HEAP32U = new Uint32Array(u),
                        t.bigIntEnabled && (s.HEAP64 = new BigInt64Array(u),
                        s.HEAP64U = new BigUint64Array(u)),
                        s.HEAP32F = new Float32Array(u),
                        s.HEAP64F = new Float64Array(u),
                        s.heapSize = u.byteLength,
                        s
                    };
                    t.heap8 = ()=>p().HEAP8,
                    t.heap8u = ()=>p().HEAP8U,
                    t.heap16 = ()=>p().HEAP16,
                    t.heap16u = ()=>p().HEAP16U,
                    t.heap32 = ()=>p().HEAP32,
                    t.heap32u = ()=>p().HEAP32U,
                    t.heapForSize = function(u, q=!0) {
                        let F, D = s.memory && s.heapSize === s.memory.buffer.byteLength ? s : p();
                        switch (u) {
                        case Int8Array:
                            return D.HEAP8;
                        case Uint8Array:
                            return D.HEAP8U;
                        case Int16Array:
                            return D.HEAP16;
                        case Uint16Array:
                            return D.HEAP16U;
                        case Int32Array:
                            return D.HEAP32;
                        case Uint32Array:
                            return D.HEAP32U;
                        case 8:
                            return q ? D.HEAP8U : D.HEAP8;
                        case 16:
                            return q ? D.HEAP16U : D.HEAP16;
                        case 32:
                            return q ? D.HEAP32U : D.HEAP32;
                        case 64:
                            if (D.HEAP64)
                                return q ? D.HEAP64U : D.HEAP64;
                            break;
                        default:
                            if (t.bigIntEnabled) {
                                if (u === globalThis.BigUint64Array)
                                    return D.HEAP64U;
                                if (u === globalThis.BigInt64Array)
                                    return D.HEAP64;
                                break
                            }
                        }
                        r("Invalid heapForSize() size: expecting 8, 16, 32,", "or (if BigInt is enabled) 64.");
                    }
                    ,
                    t.functionTable = function() {
                        return t.exports.__indirect_function_table
                    }
                    ,
                    t.functionEntry = function(u) {
                        let q = t.functionTable();
                        return u < q.length ? q.get(u) : void 0
                    }
                    ,
                    t.jsFuncToWasm = function u(q, F) {
                        if (u._ || (u._ = {
                            sigTypes: Object.assign(Object.create(null), {
                                i: "i32",
                                p: "i32",
                                P: "i32",
                                s: "i32",
                                j: "i64",
                                f: "f32",
                                d: "f64"
                            }),
                            typeCodes: Object.assign(Object.create(null), {
                                f64: 124,
                                f32: 125,
                                i64: 126,
                                i32: 127
                            }),
                            uleb128Encode: function(h, l, _) {
                                _ < 128 ? h[l](_) : h[l](_ % 128 | 128, _ >> 7);
                            },
                            rxJSig: /^(\w)\((\w*)\)$/,
                            sigParams: function(h) {
                                let l = u._.rxJSig.exec(h);
                                return l ? l[2] : h.substr(1)
                            },
                            letterType: h=>u._.sigTypes[h] || r("Invalid signature letter:", h),
                            pushSigType: (h,l)=>h.push(u._.typeCodes[u._.letterType(l)])
                        }),
                        typeof q == "string") {
                            let h = F;
                            F = q,
                            q = h;
                        }
                        let D = u._.sigParams(F)
                          , P = [1, 96];
                        u._.uleb128Encode(P, "push", D.length);
                        for (let h of D)
                            u._.pushSigType(P, h);
                        return F[0] === "v" ? P.push(0) : (P.push(1),
                        u._.pushSigType(P, F[0])),
                        u._.uleb128Encode(P, "unshift", P.length),
                        P.unshift(0, 97, 115, 109, 1, 0, 0, 0, 1),
                        P.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0),
                        new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(P)),{
                            e: {
                                f: q
                            }
                        }).exports.f
                    }
                    ;
                    let y = function(q, F, D) {
                        if (D && !s.scopedAlloc.length && r("No scopedAllocPush() scope is active."),
                        typeof q == "string") {
                            let _ = F;
                            F = q,
                            q = _;
                        }
                        (typeof F != "string" || !(q instanceof Function)) && r("Invalid arguments: expecting (function,signature) or (signature,function).");
                        let P = t.functionTable(), h = P.length, l;
                        for (; s.freeFuncIndexes.length && (l = s.freeFuncIndexes.pop(),
                        P.get(l)); ) {
                            l = null;
                            continue
                        }
                        l || (l = h,
                        P.grow(1));
                        try {
                            return P.set(l, q),
                            D && s.scopedAlloc[s.scopedAlloc.length - 1].push(l),
                            l
                        } catch (_) {
                            if (!(_ instanceof TypeError))
                                throw l === h && s.freeFuncIndexes.push(h),
                                _
                        }
                        try {
                            let _ = t.jsFuncToWasm(q, F);
                            P.set(l, _),
                            D && s.scopedAlloc[s.scopedAlloc.length - 1].push(l);
                        } catch (_) {
                            throw l === h && s.freeFuncIndexes.push(h),
                            _
                        }
                        return l
                    };
                    t.installFunction = (u,q)=>y(u, q, !1),
                    t.scopedInstallFunction = (u,q)=>y(u, q, !0),
                    t.uninstallFunction = function(u) {
                        if (!u && u !== 0)
                            return;
                        let q = s.freeFuncIndexes
                          , F = t.functionTable();
                        q.push(u);
                        let D = F.get(u);
                        return F.set(u, null),
                        D
                    }
                    ,
                    t.peek = function(q, F="i8") {
                        F.endsWith("*") && (F = i);
                        let D = s.memory && s.heapSize === s.memory.buffer.byteLength ? s : p(), P = Array.isArray(q) ? [] : void 0, h;
                        do {
                            switch (P && (q = arguments[0].shift()),
                            F) {
                            case "i1":
                            case "i8":
                                h = D.HEAP8[q >> 0];
                                break;
                            case "i16":
                                h = D.HEAP16[q >> 1];
                                break;
                            case "i32":
                                h = D.HEAP32[q >> 2];
                                break;
                            case "float":
                            case "f32":
                                h = D.HEAP32F[q >> 2];
                                break;
                            case "double":
                            case "f64":
                                h = Number(D.HEAP64F[q >> 3]);
                                break;
                            case "i64":
                                if (t.bigIntEnabled) {
                                    h = BigInt(D.HEAP64[q >> 3]);
                                    break
                                }
                            default:
                                r("Invalid type for peek():", F);
                            }
                            P && P.push(h);
                        } while (P && arguments[0].length);
                        return P || h
                    }
                    ,
                    t.poke = function(u, q, F="i8") {
                        F.endsWith("*") && (F = i);
                        let D = s.memory && s.heapSize === s.memory.buffer.byteLength ? s : p();
                        for (let P of Array.isArray(u) ? u : [u])
                            switch (F) {
                            case "i1":
                            case "i8":
                                D.HEAP8[P >> 0] = q;
                                continue;
                            case "i16":
                                D.HEAP16[P >> 1] = q;
                                continue;
                            case "i32":
                                D.HEAP32[P >> 2] = q;
                                continue;
                            case "float":
                            case "f32":
                                D.HEAP32F[P >> 2] = q;
                                continue;
                            case "double":
                            case "f64":
                                D.HEAP64F[P >> 3] = q;
                                continue;
                            case "i64":
                                if (D.HEAP64) {
                                    D.HEAP64[P >> 3] = BigInt(q);
                                    continue
                                }
                            default:
                                r("Invalid type for poke(): " + F);
                            }
                        return this
                    }
                    ,
                    t.peekPtr = (...u)=>t.peek(u.length === 1 ? u[0] : u, i),
                    t.pokePtr = (u,q=0)=>t.poke(u, q, i),
                    t.peek8 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i8"),
                    t.poke8 = (u,q)=>t.poke(u, q, "i8"),
                    t.peek16 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i16"),
                    t.poke16 = (u,q)=>t.poke(u, q, "i16"),
                    t.peek32 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i32"),
                    t.poke32 = (u,q)=>t.poke(u, q, "i32"),
                    t.peek64 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i64"),
                    t.poke64 = (u,q)=>t.poke(u, q, "i64"),
                    t.peek32f = (...u)=>t.peek(u.length === 1 ? u[0] : u, "f32"),
                    t.poke32f = (u,q)=>t.poke(u, q, "f32"),
                    t.peek64f = (...u)=>t.peek(u.length === 1 ? u[0] : u, "f64"),
                    t.poke64f = (u,q)=>t.poke(u, q, "f64"),
                    t.getMemValue = t.peek,
                    t.getPtrValue = t.peekPtr,
                    t.setMemValue = t.poke,
                    t.setPtrValue = t.pokePtr,
                    t.isPtr32 = u=>typeof u == "number" && u === (u | 0) && u >= 0,
                    t.isPtr = t.isPtr32,
                    t.cstrlen = function(u) {
                        if (!u || !t.isPtr(u))
                            return null;
                        let q = p().HEAP8U
                          , F = u;
                        for (; q[F] !== 0; ++F)
                            ;
                        return F - u
                    }
                    ;
                    let O = typeof SharedArrayBuffer > "u" ? function() {}
                    : SharedArrayBuffer
                      , B = function(u, q, F) {
                        return s.utf8Decoder.decode(u.buffer instanceof O ? u.slice(q, F) : u.subarray(q, F))
                    };
                    t.cstrToJs = function(u) {
                        let q = t.cstrlen(u);
                        return q ? B(p().HEAP8U, u, u + q) : q === null ? q : ""
                    }
                    ,
                    t.jstrlen = function(u) {
                        if (typeof u != "string")
                            return null;
                        let q = u.length
                          , F = 0;
                        for (let D = 0; D < q; ++D) {
                            let P = u.charCodeAt(D);
                            P >= 55296 && P <= 57343 && (P = 65536 + ((P & 1023) << 10) | u.charCodeAt(++D) & 1023),
                            P <= 127 ? ++F : P <= 2047 ? F += 2 : P <= 65535 ? F += 3 : F += 4;
                        }
                        return F
                    }
                    ,
                    t.jstrcpy = function(u, q, F=0, D=-1, P=!0) {
                        if ((!q || !(q instanceof Int8Array) && !(q instanceof Uint8Array)) && r("jstrcpy() target must be an Int8Array or Uint8Array."),
                        D < 0 && (D = q.length - F),
                        !(D > 0) || !(F >= 0))
                            return 0;
                        let h = 0
                          , l = u.length
                          , _ = F
                          , c = F + D - (P ? 1 : 0);
                        for (; h < l && F < c; ++h) {
                            let w = u.charCodeAt(h);
                            if (w >= 55296 && w <= 57343 && (w = 65536 + ((w & 1023) << 10) | u.charCodeAt(++h) & 1023),
                            w <= 127) {
                                if (F >= c)
                                    break;
                                q[F++] = w;
                            } else if (w <= 2047) {
                                if (F + 1 >= c)
                                    break;
                                q[F++] = 192 | w >> 6,
                                q[F++] = 128 | w & 63;
                            } else if (w <= 65535) {
                                if (F + 2 >= c)
                                    break;
                                q[F++] = 224 | w >> 12,
                                q[F++] = 128 | w >> 6 & 63,
                                q[F++] = 128 | w & 63;
                            } else {
                                if (F + 3 >= c)
                                    break;
                                q[F++] = 240 | w >> 18,
                                q[F++] = 128 | w >> 12 & 63,
                                q[F++] = 128 | w >> 6 & 63,
                                q[F++] = 128 | w & 63;
                            }
                        }
                        return P && (q[F++] = 0),
                        F - _
                    }
                    ,
                    t.cstrncpy = function(u, q, F) {
                        if ((!u || !q) && r("cstrncpy() does not accept NULL strings."),
                        F < 0)
                            F = t.cstrlen(strPtr) + 1;
                        else if (!(F > 0))
                            return 0;
                        let D = t.heap8u(), P = 0, h;
                        for (; P < F && (h = D[q + P]); ++P)
                            D[u + P] = h;
                        return P < F && (D[u + P++] = 0),
                        P
                    }
                    ,
                    t.jstrToUintArray = (u,q=!1)=>s.utf8Encoder.encode(q ? u + "\0" : u);
                    let G = (u,q)=>{
                        (!(u.alloc instanceof Function) || !(u.dealloc instanceof Function)) && r("Object is missing alloc() and/or dealloc() function(s)", "required by", q + "().");
                    }
                      , J = function(u, q, F, D) {
                        if (G(t, D),
                        typeof u != "string")
                            return null;
                        {
                            let P = s.utf8Encoder.encode(u)
                              , h = F(P.length + 1)
                              , l = p().HEAP8U;
                            return l.set(P, h),
                            l[h + P.length] = 0,
                            q ? [h, P.length] : h
                        }
                    };
                    t.allocCString = (u,q=!1)=>J(u, q, t.alloc, "allocCString()"),
                    t.scopedAllocPush = function() {
                        G(t, "scopedAllocPush");
                        let u = [];
                        return s.scopedAlloc.push(u),
                        u
                    }
                    ,
                    t.scopedAllocPop = function(u) {
                        G(t, "scopedAllocPop");
                        let q = arguments.length ? s.scopedAlloc.indexOf(u) : s.scopedAlloc.length - 1;
                        q < 0 && r("Invalid state object for scopedAllocPop()."),
                        arguments.length === 0 && (u = s.scopedAlloc[q]),
                        s.scopedAlloc.splice(q, 1);
                        for (let F; F = u.pop(); )
                            t.functionEntry(F) ? t.uninstallFunction(F) : t.dealloc(F);
                    }
                    ,
                    t.scopedAlloc = function(u) {
                        s.scopedAlloc.length || r("No scopedAllocPush() scope is active.");
                        let q = t.alloc(u);
                        return s.scopedAlloc[s.scopedAlloc.length - 1].push(q),
                        q
                    }
                    ,
                    Object.defineProperty(t.scopedAlloc, "level", {
                        configurable: !1,
                        enumerable: !1,
                        get: ()=>s.scopedAlloc.length,
                        set: ()=>r("The 'active' property is read-only.")
                    }),
                    t.scopedAllocCString = (u,q=!1)=>J(u, q, t.scopedAlloc, "scopedAllocCString()");
                    let Y = function(u, q) {
                        let F = t[u ? "scopedAlloc" : "alloc"]((q.length + 1) * t.ptrSizeof)
                          , D = 0;
                        return q.forEach(P=>{
                            t.pokePtr(F + t.ptrSizeof * D++, t[u ? "scopedAllocCString" : "allocCString"]("" + P));
                        }
                        ),
                        t.pokePtr(F + t.ptrSizeof * D, 0),
                        F
                    };
                    t.scopedAllocMainArgv = u=>Y(!0, u),
                    t.allocMainArgv = u=>Y(!1, u),
                    t.cArgvToJs = (u,q)=>{
                        let F = [];
                        for (let D = 0; D < u; ++D) {
                            let P = t.peekPtr(q + t.ptrSizeof * D);
                            F.push(P ? t.cstrToJs(P) : null);
                        }
                        return F
                    }
                    ,
                    t.scopedAllocCall = function(u) {
                        t.scopedAllocPush();
                        try {
                            return u()
                        } finally {
                            t.scopedAllocPop();
                        }
                    }
                    ;
                    let d = function(u, q, F) {
                        G(t, F);
                        let D = q ? "i64" : i
                          , P = t[F](u * (q ? 8 : n));
                        if (t.poke(P, 0, D),
                        u === 1)
                            return P;
                        let h = [P];
                        for (let l = 1; l < u; ++l)
                            P += q ? 8 : n,
                            h[l] = P,
                            t.poke(P, 0, D);
                        return h
                    };
                    t.allocPtr = (u=1,q=!0)=>d(u, q, "alloc"),
                    t.scopedAllocPtr = (u=1,q=!0)=>d(u, q, "scopedAlloc"),
                    t.xGet = function(u) {
                        return t.exports[u] || r("Cannot find exported symbol:", u)
                    }
                    ;
                    let f = (u,q)=>r(u + "() requires", q, "argument(s).");
                    t.xCall = function(u, ...q) {
                        let F = t.xGet(u);
                        return F instanceof Function || r("Exported symbol", u, "is not a function."),
                        F.length !== q.length && f(u, F.length),
                        arguments.length === 2 && Array.isArray(arguments[1]) ? F.apply(null, arguments[1]) : F.apply(null, q)
                    }
                    ,
                    s.xWrap = Object.create(null),
                    s.xWrap.convert = Object.create(null),
                    s.xWrap.convert.arg = new Map,
                    s.xWrap.convert.result = new Map;
                    let m = s.xWrap.convert.arg
                      , I = s.xWrap.convert.result;
                    t.bigIntEnabled && m.set("i64", u=>BigInt(u));
                    let x = i === "i32" ? u=>u | 0 : u=>BigInt(u) | BigInt(0);
                    m.set("i32", x).set("i16", u=>(u | 0) & 65535).set("i8", u=>(u | 0) & 255).set("f32", u=>Number(u).valueOf()).set("float", m.get("f32")).set("f64", m.get("f32")).set("double", m.get("f64")).set("int", m.get("i32")).set("null", u=>u).set(null, m.get("null")).set("**", x).set("*", x),
                    I.set("*", x).set("pointer", x).set("number", u=>Number(u)).set("void", u=>{}
                    ).set("null", u=>u).set(null, I.get("null"));
                    {
                        let u = ["i8", "i16", "i32", "int", "f32", "float", "f64", "double"];
                        t.bigIntEnabled && u.push("i64");
                        let q = m.get(i);
                        for (let F of u)
                            m.set(F + "*", q),
                            I.set(F + "*", q),
                            I.set(F, m.get(F) || r("Missing arg converter:", F));
                    }
                    let S = function(u) {
                        return typeof u == "string" ? t.scopedAllocCString(u) : u ? x(u) : null
                    };
                    m.set("string", S).set("utf8", S).set("pointer", S),
                    I.set("string", u=>t.cstrToJs(u)).set("utf8", I.get("string")).set("string:dealloc", u=>{
                        try {
                            return u ? t.cstrToJs(u) : null
                        } finally {
                            t.dealloc(u);
                        }
                    }
                    ).set("utf8:dealloc", I.get("string:dealloc")).set("json", u=>JSON.parse(t.cstrToJs(u))).set("json:dealloc", u=>{
                        try {
                            return u ? JSON.parse(t.cstrToJs(u)) : null
                        } finally {
                            t.dealloc(u);
                        }
                    }
                    );
                    let R = class {
                        constructor(u) {
                            this.name = u.name || "unnamed adapter";
                        }
                        convertArg(u, q, F) {
                            r("AbstractArgAdapter must be subclassed.");
                        }
                    }
                    ;
                    m.FuncPtrAdapter = class Pe extends R {
                        constructor(q) {
                            super(q),
                            m.FuncPtrAdapter.warnOnUse && console.warn("xArg.FuncPtrAdapter is an internal-only API", "and is not intended to be invoked from", "client-level code. Invoked with:", q),
                            this.name = q.name || "unnamed",
                            this.signature = q.signature,
                            q.contextKey instanceof Function && (this.contextKey = q.contextKey,
                            q.bindScope || (q.bindScope = "context")),
                            this.bindScope = q.bindScope || r("FuncPtrAdapter options requires a bindScope (explicit or implied)."),
                            Pe.bindScopes.indexOf(q.bindScope) < 0 && r("Invalid options.bindScope (" + q.bindMod + ") for FuncPtrAdapter. Expecting one of: (" + Pe.bindScopes.join(", ") + ")"),
                            this.isTransient = this.bindScope === "transient",
                            this.isContext = this.bindScope === "context",
                            this.isPermanent = this.bindScope === "permanent",
                            this.singleton = this.bindScope === "singleton" ? [] : void 0,
                            this.callProxy = q.callProxy instanceof Function ? q.callProxy : void 0;
                        }
                        contextKey(q, F) {
                            return this
                        }
                        contextMap(q) {
                            let F = this.__cmap || (this.__cmap = new Map)
                              , D = F.get(q);
                            return D === void 0 && F.set(q, D = []),
                            D
                        }
                        convertArg(q, F, D) {
                            let P = this.singleton;
                            if (!P && this.isContext && (P = this.contextMap(this.contextKey(F, D))),
                            P && P[0] === q)
                                return P[1];
                            if (q instanceof Function) {
                                this.callProxy && (q = this.callProxy(q));
                                let h = y(q, this.signature, this.isTransient);
                                if (Pe.debugFuncInstall && Pe.debugOut("FuncPtrAdapter installed", this, this.contextKey(F, D), "@" + h, q),
                                P) {
                                    if (P[1]) {
                                        Pe.debugFuncInstall && Pe.debugOut("FuncPtrAdapter uninstalling", this, this.contextKey(F, D), "@" + P[1], q);
                                        try {
                                            s.scopedAlloc[s.scopedAlloc.length - 1].push(P[1]);
                                        } catch {}
                                    }
                                    P[0] = q,
                                    P[1] = h;
                                }
                                return h
                            } else if (t.isPtr(q) || q === null || q === void 0) {
                                if (P && P[1] && P[1] !== q) {
                                    Pe.debugFuncInstall && Pe.debugOut("FuncPtrAdapter uninstalling", this, this.contextKey(F, D), "@" + P[1], q);
                                    try {
                                        s.scopedAlloc[s.scopedAlloc.length - 1].push(P[1]);
                                    } catch {}
                                    P[0] = P[1] = q | 0;
                                }
                                return q || 0
                            } else
                                throw new TypeError("Invalid FuncPtrAdapter argument type. Expecting a function pointer or a " + (this.name ? this.name + " " : "") + "function matching signature " + this.signature + ".")
                        }
                    }
                    ,
                    m.FuncPtrAdapter.warnOnUse = !1,
                    m.FuncPtrAdapter.debugFuncInstall = !1,
                    m.FuncPtrAdapter.debugOut = console.debug.bind(console),
                    m.FuncPtrAdapter.bindScopes = ["transient", "context", "singleton", "permanent"];
                    let z = u=>m.get(u) || r("Argument adapter not found:", u)
                      , L = u=>I.get(u) || r("Result adapter not found:", u);
                    s.xWrap.convertArg = (u,...q)=>z(u)(...q),
                    s.xWrap.convertArgNoCheck = (u,...q)=>m.get(u)(...q),
                    s.xWrap.convertResult = (u,q)=>u === null ? q : u ? L(u)(q) : void 0,
                    s.xWrap.convertResultNoCheck = (u,q)=>u === null ? q : u ? I.get(u)(q) : void 0,
                    t.xWrap = function(u, q, ...F) {
                        arguments.length === 3 && Array.isArray(arguments[2]) && (F = arguments[2]),
                        t.isPtr(u) && (u = t.functionEntry(u) || r("Function pointer not found in WASM function table."));
                        let D = u instanceof Function
                          , P = D ? u : t.xGet(u);
                        if (D && (u = P.name || "unnamed function"),
                        F.length !== P.length && f(u, P.length),
                        q === null && P.length === 0)
                            return P;
                        q != null && L(q);
                        for (let l of F)
                            l instanceof R ? m.set(l, (..._)=>l.convertArg(..._)) : z(l);
                        let h = s.xWrap;
                        return P.length === 0 ? (...l)=>l.length ? f(u, P.length) : h.convertResult(q, P.call(null)) : function(...l) {
                            l.length !== P.length && f(u, P.length);
                            let _ = t.scopedAllocPush();
                            try {
                                for (let c in l)
                                    l[c] = h.convertArgNoCheck(F[c], l[c], l, c);
                                return h.convertResultNoCheck(q, P.apply(null, l))
                            } finally {
                                t.scopedAllocPop(_);
                            }
                        }
                    }
                    ;
                    let $ = function(u, q, F, D, P, h) {
                        if (typeof F == "string") {
                            if (q === 1)
                                return h.get(F);
                            if (q === 2) {
                                if (D)
                                    D instanceof Function || r(P, "requires a function argument.");
                                else
                                    return delete h.get(F),
                                    u;
                                return h.set(F, D),
                                u
                            }
                        }
                        r("Invalid arguments to", P);
                    };
                    return t.xWrap.resultAdapter = function u(q, F) {
                        return $(u, arguments.length, q, F, "resultAdapter()", I)
                    }
                    ,
                    t.xWrap.argAdapter = function u(q, F) {
                        return $(u, arguments.length, q, F, "argAdapter()", m)
                    }
                    ,
                    t.xWrap.FuncPtrAdapter = m.FuncPtrAdapter,
                    t.xCallWrapped = function(u, q, F, ...D) {
                        return Array.isArray(arguments[3]) && (D = arguments[3]),
                        t.xWrap(u, q, F || []).apply(null, D || [])
                    }
                    ,
                    t.xWrap.testConvertArg = s.xWrap.convertArg,
                    t.xWrap.testConvertResult = s.xWrap.convertResult,
                    t
                }
                ,
                globalThis.WhWasmUtilInstaller.yawl = function(t) {
                    let r = ()=>fetch(t.uri, {
                        credentials: "same-origin"
                    })
                      , i = this
                      , n = function(p) {
                        if (t.wasmUtilTarget) {
                            let y = (...B)=>{
                                throw new Error(B.join(" "))
                            }
                              , O = t.wasmUtilTarget;
                            if (O.module = p.module,
                            O.instance = p.instance,
                            O.instance.exports.memory || (O.memory = t.imports && t.imports.env && t.imports.env.memory || y("Missing 'memory' object!")),
                            !O.alloc && p.instance.exports.malloc) {
                                let B = p.instance.exports;
                                O.alloc = function(G) {
                                    return B.malloc(G) || y("Allocation of", G, "bytes failed.")
                                }
                                ,
                                O.dealloc = function(G) {
                                    B.free(G);
                                };
                            }
                            i(O);
                        }
                        return t.onload && t.onload(p, t),
                        p
                    };
                    return WebAssembly.instantiateStreaming ? function() {
                        return WebAssembly.instantiateStreaming(r(), t.imports || {}).then(n)
                    }
                    : function() {
                        return r().then(y=>y.arrayBuffer()).then(y=>WebAssembly.instantiate(y, t.imports || {})).then(n)
                    }
                }
                .bind(globalThis.WhWasmUtilInstaller),
                globalThis.Jaccwabyt = function t(r) {
                    let i = (...E)=>{
                        throw new Error(E.join(" "))
                    }
                    ;
                    !(r.heap instanceof WebAssembly.Memory) && !(r.heap instanceof Function) && i("config.heap must be WebAssembly.Memory instance or a function."),
                    ["alloc", "dealloc"].forEach(function(E) {
                        r[E]instanceof Function || i("Config option '" + E + "' must be a function.");
                    });
                    let n = t
                      , s = r.heap instanceof Function ? r.heap : ()=>new Uint8Array(r.heap.buffer)
                      , p = r.alloc
                      , y = r.dealloc
                      , O = r.log || console.log.bind(console)
                      , B = r.memberPrefix || ""
                      , G = r.memberSuffix || ""
                      , J = r.bigIntEnabled === void 0 ? !!globalThis.BigInt64Array : !!r.bigIntEnabled
                      , Y = globalThis.BigInt
                      , d = globalThis.BigInt64Array
                      , f = r.ptrSizeof || 4
                      , m = r.ptrIR || "i32";
                    n.debugFlags || (n.__makeDebugFlags = function(E=null) {
                        E && E.__flags && (E = E.__flags);
                        let g = function A(T) {
                            return arguments.length === 0 ? A.__flags : (T < 0 ? (delete A.__flags.getter,
                            delete A.__flags.setter,
                            delete A.__flags.alloc,
                            delete A.__flags.dealloc) : (A.__flags.getter = (1 & T) !== 0,
                            A.__flags.setter = (2 & T) !== 0,
                            A.__flags.alloc = (4 & T) !== 0,
                            A.__flags.dealloc = (8 & T) !== 0),
                            A._flags)
                        };
                        return Object.defineProperty(g, "__flags", {
                            iterable: !1,
                            writable: !1,
                            value: Object.create(E)
                        }),
                        E || g(0),
                        g
                    }
                    ,
                    n.debugFlags = n.__makeDebugFlags());
                    let I = function() {
                        let E = new ArrayBuffer(2);
                        return new DataView(E).setInt16(0, 256, !0),
                        new Int16Array(E)[0] === 256
                    }()
                      , x = E=>E[1] === "("
                      , S = E=>E === "p" || E === "P"
                      , R = E=>E === "P"
                      , z = E=>x(E) ? "p" : E[0]
                      , L = function(E) {
                        switch (z(E)) {
                        case "c":
                        case "C":
                            return "i8";
                        case "i":
                            return "i32";
                        case "p":
                        case "P":
                        case "s":
                            return m;
                        case "j":
                            return "i64";
                        case "f":
                            return "float";
                        case "d":
                            return "double"
                        }
                        i("Unhandled signature IR:", E);
                    }
                      , $ = d ? ()=>!0 : ()=>i("BigInt64Array is not available.")
                      , u = function(E) {
                        switch (z(E)) {
                        case "p":
                        case "P":
                        case "s":
                            {
                                switch (f) {
                                case 4:
                                    return "getInt32";
                                case 8:
                                    return $() && "getBigInt64"
                                }
                                break
                            }
                        case "i":
                            return "getInt32";
                        case "c":
                            return "getInt8";
                        case "C":
                            return "getUint8";
                        case "j":
                            return $() && "getBigInt64";
                        case "f":
                            return "getFloat32";
                        case "d":
                            return "getFloat64"
                        }
                        i("Unhandled DataView getter for signature:", E);
                    }
                      , q = function(E) {
                        switch (z(E)) {
                        case "p":
                        case "P":
                        case "s":
                            {
                                switch (f) {
                                case 4:
                                    return "setInt32";
                                case 8:
                                    return $() && "setBigInt64"
                                }
                                break
                            }
                        case "i":
                            return "setInt32";
                        case "c":
                            return "setInt8";
                        case "C":
                            return "setUint8";
                        case "j":
                            return $() && "setBigInt64";
                        case "f":
                            return "setFloat32";
                        case "d":
                            return "setFloat64"
                        }
                        i("Unhandled DataView setter for signature:", E);
                    }
                      , F = function(E) {
                        switch (z(E)) {
                        case "i":
                        case "f":
                        case "c":
                        case "C":
                        case "d":
                            return Number;
                        case "j":
                            return $() && Y;
                        case "p":
                        case "P":
                        case "s":
                            switch (f) {
                            case 4:
                                return Number;
                            case 8:
                                return $() && Y
                            }
                            break
                        }
                        i("Unhandled DataView set wrapper for signature:", E);
                    }
                      , D = (E,g)=>E + "::" + g
                      , P = function(E, g) {
                        return ()=>i(D(E, g), "is read-only.")
                    }
                      , h = new WeakMap
                      , l = "(pointer-is-external)"
                      , _ = function(E, g, A) {
                        if (A || (A = h.get(g)),
                        A) {
                            if (h.delete(g),
                            Array.isArray(g.ondispose)) {
                                let T;
                                for (; T = g.ondispose.shift(); )
                                    try {
                                        T instanceof Function ? T.call(g) : T instanceof re ? T.dispose() : typeof T == "number" && y(T);
                                    } catch (M) {
                                        console.warn("ondispose() for", E.structName, "@", A, "threw. NOT propagating it.", M);
                                    }
                            } else if (g.ondispose instanceof Function)
                                try {
                                    g.ondispose();
                                } catch (T) {
                                    console.warn("ondispose() for", E.structName, "@", A, "threw. NOT propagating it.", T);
                                }
                            delete g.ondispose,
                            E.debugFlags.__flags.dealloc && O("debug.dealloc:", g[l] ? "EXTERNAL" : "", E.structName, "instance:", E.structInfo.sizeof, "bytes @" + A),
                            g[l] || y(A);
                        }
                    }
                      , c = E=>({
                        configurable: !1,
                        writable: !1,
                        iterable: !1,
                        value: E
                    })
                      , w = function(E, g, A) {
                        let T = !A;
                        A ? Object.defineProperty(g, l, c(A)) : (A = p(E.structInfo.sizeof),
                        A || i("Allocation of", E.structName, "structure failed."));
                        try {
                            E.debugFlags.__flags.alloc && O("debug.alloc:", T ? "" : "EXTERNAL", E.structName, "instance:", E.structInfo.sizeof, "bytes @" + A),
                            T && s().fill(0, A, A + E.structInfo.sizeof),
                            h.set(g, A);
                        } catch (M) {
                            throw _(E, g, A),
                            M
                        }
                    }
                      , j = function() {
                        let E = this.pointer;
                        return E ? new Uint8Array(s().slice(E, E + this.structInfo.sizeof)) : null
                    }
                      , se = c(E=>B + E + G)
                      , ee = function(E, g, A=!0) {
                        let T = E.members[g];
                        if (!T && (B || G)) {
                            for (let M of Object.values(E.members))
                                if (M.key === g) {
                                    T = M;
                                    break
                                }
                            !T && A && i(D(E.name, g), "is not a mapped struct member.");
                        }
                        return T
                    }
                      , ie = function E(g, A, T=!1) {
                        E._ || (E._ = Q=>Q.replace(/[^vipPsjrdcC]/g, "").replace(/[pPscC]/g, "i"));
                        let M = ee(g.structInfo, A, !0);
                        return T ? E._(M.signature) : M.signature
                    }
                      , le = {
                        configurable: !1,
                        enumerable: !1,
                        get: function() {
                            return h.get(this)
                        },
                        set: ()=>i("Cannot assign the 'pointer' property of a struct.")
                    }
                      , ae = c(function() {
                        let E = [];
                        for (let g of Object.keys(this.structInfo.members))
                            E.push(this.memberKey(g));
                        return E
                    })
                      , ce = new TextDecoder("utf-8")
                      , de = new TextEncoder
                      , we = typeof SharedArrayBuffer > "u" ? function() {}
                    : SharedArrayBuffer
                      , qe = function(E, g, A) {
                        return ce.decode(E.buffer instanceof we ? E.slice(g, A) : E.subarray(g, A))
                    }
                      , k = function(E, g, A=!1) {
                        let T = ee(E.structInfo, g, A);
                        return T && T.signature.length === 1 && T.signature[0] === "s" ? T : !1
                    }
                      , C = function(E) {
                        E.signature !== "s" && i("Invalid member type signature for C-string value:", JSON.stringify(E));
                    }
                      , N = function(g, A) {
                        let T = ee(g.structInfo, A, !0);
                        C(T);
                        let M = g[T.key];
                        if (!M)
                            return null;
                        let Q = M
                          , X = s();
                        for (; X[Q] !== 0; ++Q)
                            ;
                        return M === Q ? "" : qe(X, M, Q)
                    }
                      , U = function(E, ...g) {
                        E.ondispose ? Array.isArray(E.ondispose) || (E.ondispose = [E.ondispose]) : E.ondispose = [],
                        E.ondispose.push(...g);
                    }
                      , W = function(E) {
                        let g = de.encode(E)
                          , A = p(g.length + 1);
                        A || i("Allocation error while duplicating string:", E);
                        let T = s();
                        return T.set(g, A),
                        T[A + g.length] = 0,
                        A
                    }
                      , Z = function(E, g, A) {
                        let T = ee(E.structInfo, g, !0);
                        C(T);
                        let M = W(A);
                        return E[T.key] = M,
                        U(E, M),
                        E
                    }
                      , re = function(g, A) {
                        arguments[2] !== c && i("Do not call the StructType constructor", "from client-level code."),
                        Object.defineProperties(this, {
                            structName: c(g),
                            structInfo: c(A)
                        });
                    };
                    re.prototype = Object.create(null, {
                        dispose: c(function() {
                            _(this.constructor, this);
                        }),
                        lookupMember: c(function(E, g=!0) {
                            return ee(this.structInfo, E, g)
                        }),
                        memberToJsString: c(function(E) {
                            return N(this, E)
                        }),
                        memberIsString: c(function(E, g=!0) {
                            return k(this, E, g)
                        }),
                        memberKey: se,
                        memberKeys: ae,
                        memberSignature: c(function(E, g=!1) {
                            return ie(this, E, g)
                        }),
                        memoryDump: c(j),
                        pointer: le,
                        setMemberCString: c(function(E, g) {
                            return Z(this, E, g)
                        })
                    }),
                    Object.assign(re.prototype, {
                        addOnDispose: function(...E) {
                            return U(this, ...E),
                            this
                        }
                    }),
                    Object.defineProperties(re, {
                        allocCString: c(W),
                        isA: c(E=>E instanceof re),
                        hasExternalPointer: c(E=>E instanceof re && !!E[l]),
                        memberKey: se
                    });
                    let V = E=>Number.isFinite(E) || E instanceof (Y || Number)
                      , ye = function E(g, A, T) {
                        if (!E._) {
                            E._ = {
                                getters: {},
                                setters: {},
                                sw: {}
                            };
                            let ve = ["i", "c", "C", "p", "P", "s", "f", "d", "v()"];
                            J && ve.push("j"),
                            ve.forEach(function(ke) {
                                E._.getters[ke] = u(ke),
                                E._.setters[ke] = q(ke),
                                E._.sw[ke] = F(ke);
                            });
                            let tt = /^[ipPsjfdcC]$/
                              , za = /^[vipPsjfdcC]\([ipPsjfdcC]*\)$/;
                            E.sigCheck = function(ke, Ba, Qt, bt) {
                                Object.prototype.hasOwnProperty.call(ke, Qt) && i(ke.structName, "already has a property named", Qt + "."),
                                tt.test(bt) || za.test(bt) || i("Malformed signature for", D(ke.structName, Ba) + ":", bt);
                            };
                        }
                        let M = g.memberKey(A);
                        E.sigCheck(g.prototype, A, M, T.signature),
                        T.key = M,
                        T.name = A;
                        let Q = z(T.signature)
                          , X = D(g.prototype.structName, M)
                          , ne = g.prototype.debugFlags.__flags
                          , he = Object.create(null);
                        he.configurable = !1,
                        he.enumerable = !1,
                        he.get = function() {
                            ne.getter && O("debug.getter:", E._.getters[Q], "for", L(Q), X, "@", this.pointer, "+", T.offset, "sz", T.sizeof);
                            let ve = new DataView(s().buffer,this.pointer + T.offset,T.sizeof)[E._.getters[Q]](0, I);
                            return ne.getter && O("debug.getter:", X, "result =", ve),
                            ve
                        }
                        ,
                        T.readOnly ? he.set = P(g.prototype.structName, M) : he.set = function(ve) {
                            if (ne.setter && O("debug.setter:", E._.setters[Q], "for", L(Q), X, "@", this.pointer, "+", T.offset, "sz", T.sizeof, ve),
                            this.pointer || i("Cannot set struct property on disposed instance."),
                            ve === null)
                                ve = 0;
                            else
                                for (; !V(ve); ) {
                                    if (R(T.signature) && ve instanceof re) {
                                        ve = ve.pointer || 0,
                                        ne.setter && O("debug.setter:", X, "resolved to", ve);
                                        break
                                    }
                                    i("Invalid value for pointer-type", X + ".");
                                }
                            new DataView(s().buffer,this.pointer + T.offset,T.sizeof)[E._.setters[Q]](0, E._.sw[Q](ve), I);
                        }
                        ,
                        Object.defineProperty(g.prototype, M, he);
                    }
                      , ue = function E(g, A) {
                        arguments.length === 1 ? (A = g,
                        g = A.name) : A.name || (A.name = g),
                        g || i("Struct name is required.");
                        let T = !1;
                        Object.keys(A.members).forEach(X=>{
                            let ne = A.members[X];
                            ne.sizeof ? ne.sizeof === 1 ? ne.signature === "c" || ne.signature === "C" || i("Unexpected sizeof==1 member", D(A.name, X), "with signature", ne.signature) : (ne.sizeof % 4 !== 0 && (console.warn("Invalid struct member description =", ne, "from", A),
                            i(g, "member", X, "sizeof is not aligned. sizeof=" + ne.sizeof)),
                            ne.offset % 4 !== 0 && (console.warn("Invalid struct member description =", ne, "from", A),
                            i(g, "member", X, "offset is not aligned. offset=" + ne.offset))) : i(g, "member", X, "is missing sizeof."),
                            (!T || T.offset < ne.offset) && (T = ne);
                        }
                        ),
                        T ? A.sizeof < T.offset + T.sizeof && i("Invalid struct config:", g, "max member offset (" + T.offset + ") ", "extends past end of struct (sizeof=" + A.sizeof + ").") : i("No member property descriptions found.");
                        let M = c(n.__makeDebugFlags(E.debugFlags))
                          , Q = function X(ne) {
                            this instanceof X ? arguments.length ? ((ne !== (ne | 0) || ne <= 0) && i("Invalid pointer value for", g, "constructor."),
                            w(X, this, ne)) : w(X, this) : i("The", g, "constructor may only be called via 'new'.");
                        };
                        return Object.defineProperties(Q, {
                            debugFlags: M,
                            isA: c(X=>X instanceof Q),
                            memberKey: se,
                            memberKeys: ae,
                            methodInfoForKey: c(function(X) {}),
                            structInfo: c(A),
                            structName: c(g)
                        }),
                        Q.prototype = new re(g,A,c),
                        Object.defineProperties(Q.prototype, {
                            debugFlags: M,
                            constructor: c(Q)
                        }),
                        Object.keys(A.members).forEach(X=>ye(Q, X, A.members[X])),
                        Q
                    };
                    return ue.StructType = re,
                    ue.config = r,
                    ue.allocCString = W,
                    ue.debugFlags || (ue.debugFlags = n.__makeDebugFlags(n.debugFlags)),
                    ue
                }
                ,
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    "use strict";
                    let r = (...d)=>{
                        throw new Error(d.join(" "))
                    }
                      , i = t.SQLite3Error.toss
                      , n = t.capi
                      , s = t.wasm
                      , p = t.util;
                    if (globalThis.WhWasmUtilInstaller(s),
                    delete globalThis.WhWasmUtilInstaller,
                    s.bindingSignatures = [["sqlite3_aggregate_context", "void*", "sqlite3_context*", "int"], ["sqlite3_bind_double", "int", "sqlite3_stmt*", "int", "f64"], ["sqlite3_bind_int", "int", "sqlite3_stmt*", "int", "int"], ["sqlite3_bind_null", void 0, "sqlite3_stmt*", "int"], ["sqlite3_bind_parameter_count", "int", "sqlite3_stmt*"], ["sqlite3_bind_parameter_index", "int", "sqlite3_stmt*", "string"], ["sqlite3_bind_pointer", "int", "sqlite3_stmt*", "int", "*", "string:static", "*"], ["sqlite3_busy_handler", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        signature: "i(pi)",
                        contextKey: (d,f)=>d[0]
                    }), "*"]], ["sqlite3_busy_timeout", "int", "sqlite3*", "int"], ["sqlite3_changes", "int", "sqlite3*"], ["sqlite3_clear_bindings", "int", "sqlite3_stmt*"], ["sqlite3_collation_needed", "int", "sqlite3*", "*", "*"], ["sqlite3_column_blob", "*", "sqlite3_stmt*", "int"], ["sqlite3_column_bytes", "int", "sqlite3_stmt*", "int"], ["sqlite3_column_count", "int", "sqlite3_stmt*"], ["sqlite3_column_double", "f64", "sqlite3_stmt*", "int"], ["sqlite3_column_int", "int", "sqlite3_stmt*", "int"], ["sqlite3_column_name", "string", "sqlite3_stmt*", "int"], ["sqlite3_column_text", "string", "sqlite3_stmt*", "int"], ["sqlite3_column_type", "int", "sqlite3_stmt*", "int"], ["sqlite3_column_value", "sqlite3_value*", "sqlite3_stmt*", "int"], ["sqlite3_commit_hook", "void*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_commit_hook",
                        signature: "i(p)",
                        contextKey: d=>d[0]
                    }), "*"]], ["sqlite3_compileoption_get", "string", "int"], ["sqlite3_compileoption_used", "int", "string"], ["sqlite3_complete", "int", "string:flexible"], ["sqlite3_context_db_handle", "sqlite3*", "sqlite3_context*"], ["sqlite3_data_count", "int", "sqlite3_stmt*"], ["sqlite3_db_filename", "string", "sqlite3*", "string"], ["sqlite3_db_handle", "sqlite3*", "sqlite3_stmt*"], ["sqlite3_db_name", "string", "sqlite3*", "int"], ["sqlite3_db_status", "int", "sqlite3*", "int", "*", "*", "int"], ["sqlite3_errcode", "int", "sqlite3*"], ["sqlite3_errmsg", "string", "sqlite3*"], ["sqlite3_error_offset", "int", "sqlite3*"], ["sqlite3_errstr", "string", "int"], ["sqlite3_exec", "int", ["sqlite3*", "string:flexible", new s.xWrap.FuncPtrAdapter({
                        signature: "i(pipp)",
                        bindScope: "transient",
                        callProxy: d=>{
                            let f;
                            return (m,I,x,S)=>{
                                try {
                                    let R = s.cArgvToJs(I, x);
                                    return f || (f = s.cArgvToJs(I, S)),
                                    d(R, f) | 0
                                } catch (R) {
                                    return R.resultCode || n.SQLITE_ERROR
                                }
                            }
                        }
                    }), "*", "**"]], ["sqlite3_expanded_sql", "string", "sqlite3_stmt*"], ["sqlite3_extended_errcode", "int", "sqlite3*"], ["sqlite3_extended_result_codes", "int", "sqlite3*", "int"], ["sqlite3_file_control", "int", "sqlite3*", "string", "int", "*"], ["sqlite3_finalize", "int", "sqlite3_stmt*"], ["sqlite3_free", void 0, "*"], ["sqlite3_get_autocommit", "int", "sqlite3*"], ["sqlite3_get_auxdata", "*", "sqlite3_context*", "int"], ["sqlite3_initialize", void 0], ["sqlite3_keyword_count", "int"], ["sqlite3_keyword_name", "int", ["int", "**", "*"]], ["sqlite3_keyword_check", "int", ["string", "int"]], ["sqlite3_libversion", "string"], ["sqlite3_libversion_number", "int"], ["sqlite3_limit", "int", ["sqlite3*", "int", "int"]], ["sqlite3_malloc", "*", "int"], ["sqlite3_open", "int", "string", "*"], ["sqlite3_open_v2", "int", "string", "*", "int", "string"], ["sqlite3_progress_handler", void 0, ["sqlite3*", "int", new s.xWrap.FuncPtrAdapter({
                        name: "xProgressHandler",
                        signature: "i(p)",
                        bindScope: "context",
                        contextKey: (d,f)=>d[0]
                    }), "*"]], ["sqlite3_realloc", "*", "*", "int"], ["sqlite3_reset", "int", "sqlite3_stmt*"], ["sqlite3_result_blob", void 0, "sqlite3_context*", "*", "int", "*"], ["sqlite3_result_double", void 0, "sqlite3_context*", "f64"], ["sqlite3_result_error", void 0, "sqlite3_context*", "string", "int"], ["sqlite3_result_error_code", void 0, "sqlite3_context*", "int"], ["sqlite3_result_error_nomem", void 0, "sqlite3_context*"], ["sqlite3_result_error_toobig", void 0, "sqlite3_context*"], ["sqlite3_result_int", void 0, "sqlite3_context*", "int"], ["sqlite3_result_null", void 0, "sqlite3_context*"], ["sqlite3_result_pointer", void 0, "sqlite3_context*", "*", "string:static", "*"], ["sqlite3_result_subtype", void 0, "sqlite3_value*", "int"], ["sqlite3_result_text", void 0, "sqlite3_context*", "string", "int", "*"], ["sqlite3_result_zeroblob", void 0, "sqlite3_context*", "int"], ["sqlite3_rollback_hook", "void*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_rollback_hook",
                        signature: "v(p)",
                        contextKey: d=>d[0]
                    }), "*"]], ["sqlite3_set_authorizer", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_set_authorizer::xAuth",
                        signature: "i(pissss)",
                        contextKey: (d,f)=>d[0],
                        callProxy: d=>(f,m,I,x,S,R)=>{
                            try {
                                return I = I && s.cstrToJs(I),
                                x = x && s.cstrToJs(x),
                                S = S && s.cstrToJs(S),
                                R = R && s.cstrToJs(R),
                                d(f, m, I, x, S, R) || 0
                            } catch (z) {
                                return z.resultCode || n.SQLITE_ERROR
                            }
                        }
                    }), "*"]], ["sqlite3_set_auxdata", void 0, ["sqlite3_context*", "int", "*", new s.xWrap.FuncPtrAdapter({
                        name: "xDestroyAuxData",
                        signature: "v(*)",
                        contextKey: (d,f)=>d[0]
                    })]], ["sqlite3_shutdown", void 0], ["sqlite3_sourceid", "string"], ["sqlite3_sql", "string", "sqlite3_stmt*"], ["sqlite3_status", "int", "int", "*", "*", "int"], ["sqlite3_step", "int", "sqlite3_stmt*"], ["sqlite3_stmt_isexplain", "int", ["sqlite3_stmt*"]], ["sqlite3_stmt_readonly", "int", ["sqlite3_stmt*"]], ["sqlite3_stmt_status", "int", "sqlite3_stmt*", "int", "int"], ["sqlite3_strglob", "int", "string", "string"], ["sqlite3_stricmp", "int", "string", "string"], ["sqlite3_strlike", "int", "string", "string", "int"], ["sqlite3_strnicmp", "int", "string", "string", "int"], ["sqlite3_table_column_metadata", "int", "sqlite3*", "string", "string", "string", "**", "**", "*", "*", "*"], ["sqlite3_total_changes", "int", "sqlite3*"], ["sqlite3_trace_v2", "int", ["sqlite3*", "int", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_trace_v2::callback",
                        signature: "i(ippp)",
                        contextKey: (d,f)=>d[0]
                    }), "*"]], ["sqlite3_txn_state", "int", ["sqlite3*", "string"]], ["sqlite3_uri_boolean", "int", "sqlite3_filename", "string", "int"], ["sqlite3_uri_key", "string", "sqlite3_filename", "int"], ["sqlite3_uri_parameter", "string", "sqlite3_filename", "string"], ["sqlite3_user_data", "void*", "sqlite3_context*"], ["sqlite3_value_blob", "*", "sqlite3_value*"], ["sqlite3_value_bytes", "int", "sqlite3_value*"], ["sqlite3_value_double", "f64", "sqlite3_value*"], ["sqlite3_value_dup", "sqlite3_value*", "sqlite3_value*"], ["sqlite3_value_free", void 0, "sqlite3_value*"], ["sqlite3_value_frombind", "int", "sqlite3_value*"], ["sqlite3_value_int", "int", "sqlite3_value*"], ["sqlite3_value_nochange", "int", "sqlite3_value*"], ["sqlite3_value_numeric_type", "int", "sqlite3_value*"], ["sqlite3_value_pointer", "*", "sqlite3_value*", "string:static"], ["sqlite3_value_subtype", "int", "sqlite3_value*"], ["sqlite3_value_text", "string", "sqlite3_value*"], ["sqlite3_value_type", "int", "sqlite3_value*"], ["sqlite3_vfs_find", "*", "string"], ["sqlite3_vfs_register", "int", "sqlite3_vfs*", "int"], ["sqlite3_vfs_unregister", "int", "sqlite3_vfs*"]],
                    s.exports.sqlite3_activate_see instanceof Function && s.bindingSignatures.push(["sqlite3_key", "int", "sqlite3*", "string", "int"], ["sqlite3_key_v2", "int", "sqlite3*", "string", "*", "int"], ["sqlite3_rekey", "int", "sqlite3*", "string", "int"], ["sqlite3_rekey_v2", "int", "sqlite3*", "string", "*", "int"], ["sqlite3_activate_see", void 0, "string"]),
                    s.bindingSignatures.int64 = [["sqlite3_bind_int64", "int", ["sqlite3_stmt*", "int", "i64"]], ["sqlite3_changes64", "i64", ["sqlite3*"]], ["sqlite3_column_int64", "i64", ["sqlite3_stmt*", "int"]], ["sqlite3_create_module", "int", ["sqlite3*", "string", "sqlite3_module*", "*"]], ["sqlite3_create_module_v2", "int", ["sqlite3*", "string", "sqlite3_module*", "*", "*"]], ["sqlite3_declare_vtab", "int", ["sqlite3*", "string:flexible"]], ["sqlite3_deserialize", "int", "sqlite3*", "string", "*", "i64", "i64", "int"], ["sqlite3_drop_modules", "int", ["sqlite3*", "**"]], ["sqlite3_last_insert_rowid", "i64", ["sqlite3*"]], ["sqlite3_malloc64", "*", "i64"], ["sqlite3_msize", "i64", "*"], ["sqlite3_overload_function", "int", ["sqlite3*", "string", "int"]], ["sqlite3_preupdate_blobwrite", "int", "sqlite3*"], ["sqlite3_preupdate_count", "int", "sqlite3*"], ["sqlite3_preupdate_depth", "int", "sqlite3*"], ["sqlite3_preupdate_hook", "*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_preupdate_hook",
                        signature: "v(ppippjj)",
                        contextKey: d=>d[0],
                        callProxy: d=>(f,m,I,x,S,R,z)=>{
                            d(f, m, I, s.cstrToJs(x), s.cstrToJs(S), R, z);
                        }
                    }), "*"]], ["sqlite3_preupdate_new", "int", ["sqlite3*", "int", "**"]], ["sqlite3_preupdate_old", "int", ["sqlite3*", "int", "**"]], ["sqlite3_realloc64", "*", "*", "i64"], ["sqlite3_result_int64", void 0, "*", "i64"], ["sqlite3_result_zeroblob64", "int", "*", "i64"], ["sqlite3_serialize", "*", "sqlite3*", "string", "*", "int"], ["sqlite3_set_last_insert_rowid", void 0, ["sqlite3*", "i64"]], ["sqlite3_status64", "int", "int", "*", "*", "int"], ["sqlite3_total_changes64", "i64", ["sqlite3*"]], ["sqlite3_update_hook", "*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_update_hook",
                        signature: "v(iippj)",
                        contextKey: d=>d[0],
                        callProxy: d=>(f,m,I,x,S)=>{
                            d(f, m, s.cstrToJs(I), s.cstrToJs(x), S);
                        }
                    }), "*"]], ["sqlite3_uri_int64", "i64", ["sqlite3_filename", "string", "i64"]], ["sqlite3_value_int64", "i64", "sqlite3_value*"], ["sqlite3_vtab_collation", "string", "sqlite3_index_info*", "int"], ["sqlite3_vtab_distinct", "int", "sqlite3_index_info*"], ["sqlite3_vtab_in", "int", "sqlite3_index_info*", "int", "int"], ["sqlite3_vtab_in_first", "int", "sqlite3_value*", "**"], ["sqlite3_vtab_in_next", "int", "sqlite3_value*", "**"], ["sqlite3_vtab_nochange", "int", "sqlite3_context*"], ["sqlite3_vtab_on_conflict", "int", "sqlite3*"], ["sqlite3_vtab_rhs_value", "int", "sqlite3_index_info*", "int", "**"]],
                    s.bigIntEnabled && s.exports.sqlite3changegroup_add) {
                        let d = {
                            signature: "i(ps)",
                            callProxy: f=>(m,I)=>{
                                try {
                                    return f(m, s.cstrToJs(I)) | 0
                                } catch (x) {
                                    return x.resultCode || n.SQLITE_ERROR
                                }
                            }
                        };
                        s.bindingSignatures.int64.push(["sqlite3changegroup_add", "int", ["sqlite3_changegroup*", "int", "void*"]], ["sqlite3changegroup_add_strm", "int", ["sqlite3_changegroup*", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changegroup_delete", void 0, ["sqlite3_changegroup*"]], ["sqlite3changegroup_new", "int", ["**"]], ["sqlite3changegroup_output", "int", ["sqlite3_changegroup*", "int*", "**"]], ["sqlite3changegroup_output_strm", "int", ["sqlite3_changegroup*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppi)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_apply", "int", ["sqlite3*", "int", "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_apply_strm", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_apply_v2", "int", ["sqlite3*", "int", "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*", "**", "int*", "int"]], ["sqlite3changeset_apply_v2_strm", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*", "**", "int*", "int"]], ["sqlite3changeset_concat", "int", ["int", "void*", "int", "void*", "int*", "**"]], ["sqlite3changeset_concat_strm", "int", [new s.xWrap.FuncPtrAdapter({
                            name: "xInputA",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xInputB",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppi)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_conflict", "int", ["sqlite3_changeset_iter*", "int", "**"]], ["sqlite3changeset_finalize", "int", ["sqlite3_changeset_iter*"]], ["sqlite3changeset_fk_conflicts", "int", ["sqlite3_changeset_iter*", "int*"]], ["sqlite3changeset_invert", "int", ["int", "void*", "int*", "**"]], ["sqlite3changeset_invert_strm", "int", [new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppi)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_new", "int", ["sqlite3_changeset_iter*", "int", "**"]], ["sqlite3changeset_next", "int", ["sqlite3_changeset_iter*"]], ["sqlite3changeset_old", "int", ["sqlite3_changeset_iter*", "int", "**"]], ["sqlite3changeset_op", "int", ["sqlite3_changeset_iter*", "**", "int*", "int*", "int*"]], ["sqlite3changeset_pk", "int", ["sqlite3_changeset_iter*", "**", "int*"]], ["sqlite3changeset_start", "int", ["**", "int", "*"]], ["sqlite3changeset_start_strm", "int", ["**", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_start_v2", "int", ["**", "int", "*", "int"]], ["sqlite3changeset_start_v2_strm", "int", ["**", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", "int"]], ["sqlite3session_attach", "int", ["sqlite3_session*", "string"]], ["sqlite3session_changeset", "int", ["sqlite3_session*", "int*", "**"]], ["sqlite3session_changeset_size", "i64", ["sqlite3_session*"]], ["sqlite3session_changeset_strm", "int", ["sqlite3_session*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3session_config", "int", ["int", "void*"]], ["sqlite3session_create", "int", ["sqlite3*", "string", "**"]], ["sqlite3session_diff", "int", ["sqlite3_session*", "string", "string", "**"]], ["sqlite3session_enable", "int", ["sqlite3_session*", "int"]], ["sqlite3session_indirect", "int", ["sqlite3_session*", "int"]], ["sqlite3session_isempty", "int", ["sqlite3_session*"]], ["sqlite3session_memory_used", "i64", ["sqlite3_session*"]], ["sqlite3session_object_config", "int", ["sqlite3_session*", "int", "void*"]], ["sqlite3session_patchset", "int", ["sqlite3_session*", "*", "**"]], ["sqlite3session_patchset_strm", "int", ["sqlite3_session*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3session_table_filter", void 0, ["sqlite3_session*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            ...d,
                            contextKey: (f,m)=>f[0]
                        }), "*"]]);
                    }
                    s.bindingSignatures.wasm = [["sqlite3_wasm_db_reset", "int", "sqlite3*"], ["sqlite3_wasm_db_vfs", "sqlite3_vfs*", "sqlite3*", "string"], ["sqlite3_wasm_vfs_create_file", "int", "sqlite3_vfs*", "string", "*", "int"], ["sqlite3_wasm_posix_create_file", "int", "string", "*", "int"], ["sqlite3_wasm_vfs_unlink", "int", "sqlite3_vfs*", "string"]],
                    t.StructBinder = globalThis.Jaccwabyt({
                        heap: s.heap8u,
                        alloc: s.alloc,
                        dealloc: s.dealloc,
                        bigIntEnabled: s.bigIntEnabled,
                        memberPrefix: "$"
                    }),
                    delete globalThis.Jaccwabyt;
                    {
                        let d = s.xWrap.argAdapter("string");
                        s.xWrap.argAdapter("string:flexible", S=>d(p.flexibleString(S))),
                        s.xWrap.argAdapter("string:static", function(S) {
                            return s.isPtr(S) ? S : (S = "" + S,
                            this[S] || (this[S] = s.allocCString(S)))
                        }
                        .bind(Object.create(null)));
                        let f = s.xWrap.argAdapter("*")
                          , m = function() {};
                        s.xWrap.argAdapter("sqlite3_filename", f)("sqlite3_context*", f)("sqlite3_value*", f)("void*", f)("sqlite3_changegroup*", f)("sqlite3_changeset_iter*", f)("sqlite3_session*", f)("sqlite3_stmt*", S=>f(S instanceof (t?.oo1?.Stmt || m) ? S.pointer : S))("sqlite3*", S=>f(S instanceof (t?.oo1?.DB || m) ? S.pointer : S))("sqlite3_index_info*", S=>f(S instanceof (n.sqlite3_index_info || m) ? S.pointer : S))("sqlite3_module*", S=>f(S instanceof (n.sqlite3_module || m) ? S.pointer : S))("sqlite3_vfs*", S=>typeof S == "string" ? n.sqlite3_vfs_find(S) || t.SQLite3Error.toss(n.SQLITE_NOTFOUND, "Unknown sqlite3_vfs name:", S) : f(S instanceof (n.sqlite3_vfs || m) ? S.pointer : S));
                        let I = s.xWrap.resultAdapter("*");
                        s.xWrap.resultAdapter("sqlite3*", I)("sqlite3_context*", I)("sqlite3_stmt*", I)("sqlite3_value*", I)("sqlite3_vfs*", I)("void*", I),
                        s.exports.sqlite3_step.length === 0 && (s.xWrap.doArgcCheck = !1,
                        t.config.warn("Disabling sqlite3.wasm.xWrap.doArgcCheck due to environmental quirks."));
                        for (let S of s.bindingSignatures)
                            n[S[0]] = s.xWrap.apply(null, S);
                        for (let S of s.bindingSignatures.wasm)
                            s[S[0]] = s.xWrap.apply(null, S);
                        let x = function(S) {
                            return ()=>r(S + "() is unavailable due to lack", "of BigInt support in this build.")
                        };
                        for (let S of s.bindingSignatures.int64)
                            n[S[0]] = s.bigIntEnabled ? s.xWrap.apply(null, S) : x(S[0]);
                        if (delete s.bindingSignatures,
                        s.exports.sqlite3_wasm_db_error) {
                            let S = s.xWrap("sqlite3_wasm_db_error", "int", "sqlite3*", "int", "string");
                            p.sqlite3_wasm_db_error = function(R, z, L) {
                                return z instanceof t.WasmAllocError ? (z = n.SQLITE_NOMEM,
                                L = 0) : z instanceof Error && (L = L || "" + z,
                                z = z.resultCode || n.SQLITE_ERROR),
                                R ? S(R, z, L) : z
                            };
                        } else
                            p.sqlite3_wasm_db_error = function(S, R, z) {
                                return console.warn("sqlite3_wasm_db_error() is not exported.", arguments),
                                R
                            };
                    }
                    {
                        let d = s.xCall("sqlite3_wasm_enum_json");
                        d || r("Maintenance required: increase sqlite3_wasm_enum_json()'s", "static buffer size!"),
                        s.ctype = JSON.parse(s.cstrToJs(d));
                        let f = ["access", "authorizer", "blobFinalizers", "changeset", "config", "dataTypes", "dbConfig", "dbStatus", "encodings", "fcntl", "flock", "ioCap", "limits", "openFlags", "prepareFlags", "resultCodes", "sqlite3Status", "stmtStatus", "syncFlags", "trace", "txnState", "udfFlags", "version"];
                        s.bigIntEnabled && f.push("serialize", "session", "vtab");
                        for (let x of f)
                            for (let S of Object.entries(s.ctype[x]))
                                n[S[0]] = S[1];
                        s.functionEntry(n.SQLITE_WASM_DEALLOC) || r("Internal error: cannot resolve exported function", "entry SQLITE_WASM_DEALLOC (==" + n.SQLITE_WASM_DEALLOC + ").");
                        let m = Object.create(null);
                        for (let x of ["resultCodes"])
                            for (let S of Object.entries(s.ctype[x]))
                                m[S[1]] = S[0];
                        n.sqlite3_js_rc_str = x=>m[x];
                        let I = Object.assign(Object.create(null), {
                            WasmTestStruct: !0,
                            sqlite3_kvvfs_methods: !p.isUIThread(),
                            sqlite3_index_info: !s.bigIntEnabled,
                            sqlite3_index_constraint: !s.bigIntEnabled,
                            sqlite3_index_orderby: !s.bigIntEnabled,
                            sqlite3_index_constraint_usage: !s.bigIntEnabled
                        });
                        for (let x of s.ctype.structs)
                            I[x.name] || (n[x.name] = t.StructBinder(x));
                        if (n.sqlite3_index_info) {
                            for (let x of ["sqlite3_index_constraint", "sqlite3_index_orderby", "sqlite3_index_constraint_usage"])
                                n.sqlite3_index_info[x] = n[x],
                                delete n[x];
                            n.sqlite3_vtab_config = s.xWrap("sqlite3_wasm_vtab_config", "int", ["sqlite3*", "int", "int"]);
                        }
                    }
                    let y = (d,f,m)=>p.sqlite3_wasm_db_error(d, n.SQLITE_MISUSE, f + "() requires " + m + " argument" + (m === 1 ? "" : "s") + ".")
                      , O = d=>p.sqlite3_wasm_db_error(d, n.SQLITE_FORMAT, "SQLITE_UTF8 is the only supported encoding.")
                      , B = d=>s.xWrap.argAdapter("sqlite3*")(d)
                      , G = d=>s.isPtr(d) ? s.cstrToJs(d) : d
                      , J = function(d, f) {
                        d = B(d);
                        let m = this.dbMap.get(d);
                        if (f)
                            !m && f > 0 && this.dbMap.set(d, m = Object.create(null));
                        else
                            return this.dbMap.delete(d),
                            m;
                        return m
                    }
                    .bind(Object.assign(Object.create(null), {
                        dbMap: new Map
                    }));
                    J.addCollation = function(d, f) {
                        let m = J(d, 1);
                        m.collation || (m.collation = new Set),
                        m.collation.add(G(f).toLowerCase());
                    }
                    ,
                    J._addUDF = function(d, f, m, I) {
                        f = G(f).toLowerCase();
                        let x = I.get(f);
                        x || I.set(f, x = new Set),
                        x.add(m < 0 ? -1 : m);
                    }
                    ,
                    J.addFunction = function(d, f, m) {
                        let I = J(d, 1);
                        I.udf || (I.udf = new Map),
                        this._addUDF(d, f, m, I.udf);
                    }
                    ,
                    J.addWindowFunc = function(d, f, m) {
                        let I = J(d, 1);
                        I.wudf || (I.wudf = new Map),
                        this._addUDF(d, f, m, I.wudf);
                    }
                    ,
                    J.cleanup = function(d) {
                        d = B(d);
                        let f = [d];
                        for (let x of ["sqlite3_busy_handler", "sqlite3_commit_hook", "sqlite3_preupdate_hook", "sqlite3_progress_handler", "sqlite3_rollback_hook", "sqlite3_set_authorizer", "sqlite3_trace_v2", "sqlite3_update_hook"]) {
                            let S = s.exports[x];
                            f.length = S.length;
                            try {
                                n[x](...f);
                            } catch (R) {
                                console.warn("close-time call of", x + "(", f, ") threw:", R);
                            }
                        }
                        let m = J(d, 0);
                        if (!m)
                            return;
                        if (m.collation) {
                            for (let x of m.collation)
                                try {
                                    n.sqlite3_create_collation_v2(d, x, n.SQLITE_UTF8, 0, 0, 0);
                                } catch {}
                            delete m.collation;
                        }
                        let I;
                        for (I = 0; I < 2; ++I) {
                            let x = I ? m.wudf : m.udf;
                            if (!x)
                                continue;
                            let S = I ? n.sqlite3_create_window_function : n.sqlite3_create_function_v2;
                            for (let R of x) {
                                let z = R[0]
                                  , L = R[1]
                                  , $ = [d, z, 0, n.SQLITE_UTF8, 0, 0, 0, 0, 0];
                                I && $.push(0);
                                for (let u of L)
                                    try {
                                        $[2] = u,
                                        S.apply(null, $);
                                    } catch {}
                                L.clear();
                            }
                            x.clear();
                        }
                        delete m.udf,
                        delete m.wudf;
                    }
                    ;
                    {
                        let d = s.xWrap("sqlite3_close_v2", "int", "sqlite3*");
                        n.sqlite3_close_v2 = function(f) {
                            if (arguments.length !== 1)
                                return y(f, "sqlite3_close_v2", 1);
                            if (f)
                                try {
                                    J.cleanup(f);
                                } catch {}
                            return d(f)
                        };
                    }
                    if (n.sqlite3session_table_filter) {
                        let d = s.xWrap("sqlite3session_delete", void 0, ["sqlite3_session*"]);
                        n.sqlite3session_delete = function(f) {
                            if (arguments.length !== 1)
                                return y(pDb, "sqlite3session_delete", 1);
                            f && n.sqlite3session_table_filter(f, 0, 0),
                            d(f);
                        };
                    }
                    {
                        let d = (m,I)=>"argv[" + I + "]:" + m[0] + ":" + s.cstrToJs(m[1]).toLowerCase()
                          , f = s.xWrap("sqlite3_create_collation_v2", "int", ["sqlite3*", "string", "int", "*", new s.xWrap.FuncPtrAdapter({
                            name: "xCompare",
                            signature: "i(pipip)",
                            contextKey: d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xDestroy",
                            signature: "v(p)",
                            contextKey: d
                        })]);
                        n.sqlite3_create_collation_v2 = function(m, I, x, S, R, z) {
                            if (arguments.length !== 6)
                                return y(m, "sqlite3_create_collation_v2", 6);
                            if (!(x & 15))
                                x |= n.SQLITE_UTF8;
                            else if (n.SQLITE_UTF8 !== (x & 15))
                                return O(m);
                            try {
                                let L = f(m, I, x, S, R, z);
                                return L === 0 && R instanceof Function && J.addCollation(m, I),
                                L
                            } catch (L) {
                                return p.sqlite3_wasm_db_error(m, L)
                            }
                        }
                        ,
                        n.sqlite3_create_collation = (m,I,x,S,R)=>arguments.length === 5 ? n.sqlite3_create_collation_v2(m, I, x, S, R, 0) : y(m, "sqlite3_create_collation", 5);
                    }
                    {
                        let d = function(x, S) {
                            return x[0] + ":" + (x[2] < 0 ? -1 : x[2]) + ":" + S + ":" + s.cstrToJs(x[1]).toLowerCase()
                        }
                          , f = Object.assign(Object.create(null), {
                            xInverseAndStep: {
                                signature: "v(pip)",
                                contextKey: d,
                                callProxy: x=>(S,R,z)=>{
                                    try {
                                        x(S, ...n.sqlite3_values_to_js(R, z));
                                    } catch (L) {
                                        n.sqlite3_result_error_js(S, L);
                                    }
                                }
                            },
                            xFinalAndValue: {
                                signature: "v(p)",
                                contextKey: d,
                                callProxy: x=>S=>{
                                    try {
                                        n.sqlite3_result_js(S, x(S));
                                    } catch (R) {
                                        n.sqlite3_result_error_js(S, R);
                                    }
                                }
                            },
                            xFunc: {
                                signature: "v(pip)",
                                contextKey: d,
                                callProxy: x=>(S,R,z)=>{
                                    try {
                                        n.sqlite3_result_js(S, x(S, ...n.sqlite3_values_to_js(R, z)));
                                    } catch (L) {
                                        n.sqlite3_result_error_js(S, L);
                                    }
                                }
                            },
                            xDestroy: {
                                signature: "v(p)",
                                contextKey: d,
                                callProxy: x=>S=>{
                                    try {
                                        x(S);
                                    } catch (R) {
                                        console.error("UDF xDestroy method threw:", R);
                                    }
                                }
                            }
                        })
                          , m = s.xWrap("sqlite3_create_function_v2", "int", ["sqlite3*", "string", "int", "int", "*", new s.xWrap.FuncPtrAdapter({
                            name: "xFunc",
                            ...f.xFunc
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xStep",
                            ...f.xInverseAndStep
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xFinal",
                            ...f.xFinalAndValue
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xDestroy",
                            ...f.xDestroy
                        })])
                          , I = s.xWrap("sqlite3_create_window_function", "int", ["sqlite3*", "string", "int", "int", "*", new s.xWrap.FuncPtrAdapter({
                            name: "xStep",
                            ...f.xInverseAndStep
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xFinal",
                            ...f.xFinalAndValue
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xValue",
                            ...f.xFinalAndValue
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xInverse",
                            ...f.xInverseAndStep
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xDestroy",
                            ...f.xDestroy
                        })]);
                        n.sqlite3_create_function_v2 = function x(S, R, z, L, $, u, q, F, D) {
                            if (x.length !== arguments.length)
                                return y(S, "sqlite3_create_function_v2", x.length);
                            if (!(L & 15))
                                L |= n.SQLITE_UTF8;
                            else if (n.SQLITE_UTF8 !== (L & 15))
                                return O(S);
                            try {
                                let P = m(S, R, z, L, $, u, q, F, D);
                                return P === 0 && (u instanceof Function || q instanceof Function || F instanceof Function || D instanceof Function) && J.addFunction(S, R, z),
                                P
                            } catch (P) {
                                return console.error("sqlite3_create_function_v2() setup threw:", P),
                                p.sqlite3_wasm_db_error(S, P, "Creation of UDF threw: " + P)
                            }
                        }
                        ,
                        n.sqlite3_create_function = function x(S, R, z, L, $, u, q, F) {
                            return x.length === arguments.length ? n.sqlite3_create_function_v2(S, R, z, L, $, u, q, F, 0) : y(S, "sqlite3_create_function", x.length)
                        }
                        ,
                        n.sqlite3_create_window_function = function x(S, R, z, L, $, u, q, F, D, P) {
                            if (x.length !== arguments.length)
                                return y(S, "sqlite3_create_window_function", x.length);
                            if (!(L & 15))
                                L |= n.SQLITE_UTF8;
                            else if (n.SQLITE_UTF8 !== (L & 15))
                                return O(S);
                            try {
                                let h = I(S, R, z, L, $, u, q, F, D, P);
                                return h === 0 && (u instanceof Function || q instanceof Function || F instanceof Function || D instanceof Function || P instanceof Function) && J.addWindowFunc(S, R, z),
                                h
                            } catch (h) {
                                return console.error("sqlite3_create_window_function() setup threw:", h),
                                p.sqlite3_wasm_db_error(S, h, "Creation of UDF threw: " + h)
                            }
                        }
                        ,
                        n.sqlite3_create_function_v2.udfSetResult = n.sqlite3_create_function.udfSetResult = n.sqlite3_create_window_function.udfSetResult = n.sqlite3_result_js,
                        n.sqlite3_create_function_v2.udfConvertArgs = n.sqlite3_create_function.udfConvertArgs = n.sqlite3_create_window_function.udfConvertArgs = n.sqlite3_values_to_js,
                        n.sqlite3_create_function_v2.udfSetError = n.sqlite3_create_function.udfSetError = n.sqlite3_create_window_function.udfSetError = n.sqlite3_result_error_js;
                    }
                    {
                        let d = (m,I)=>(typeof m == "string" ? I = -1 : p.isSQLableTypedArray(m) ? (I = m.byteLength,
                        m = p.typedArrayToString(m instanceof ArrayBuffer ? new Uint8Array(m) : m)) : Array.isArray(m) && (m = m.join(""),
                        I = -1),
                        [m, I])
                          , f = {
                            basic: s.xWrap("sqlite3_prepare_v3", "int", ["sqlite3*", "string", "int", "int", "**", "**"]),
                            full: s.xWrap("sqlite3_prepare_v3", "int", ["sqlite3*", "*", "int", "int", "**", "**"])
                        };
                        n.sqlite3_prepare_v3 = function m(I, x, S, R, z, L) {
                            if (m.length !== arguments.length)
                                return y(I, "sqlite3_prepare_v3", m.length);
                            let[$,u] = d(x, S);
                            switch (typeof $) {
                            case "string":
                                return f.basic(I, $, u, R, z, null);
                            case "number":
                                return f.full(I, $, u, R, z, L);
                            default:
                                return p.sqlite3_wasm_db_error(I, n.SQLITE_MISUSE, "Invalid SQL argument type for sqlite3_prepare_v2/v3().")
                            }
                        }
                        ,
                        n.sqlite3_prepare_v2 = function m(I, x, S, R, z) {
                            return m.length === arguments.length ? n.sqlite3_prepare_v3(I, x, S, 0, R, z) : y(I, "sqlite3_prepare_v2", m.length)
                        };
                    }
                    {
                        let d = s.xWrap("sqlite3_bind_text", "int", ["sqlite3_stmt*", "int", "string", "int", "*"])
                          , f = s.xWrap("sqlite3_bind_blob", "int", ["sqlite3_stmt*", "int", "*", "int", "*"]);
                        n.sqlite3_bind_text = function m(I, x, S, R, z) {
                            if (m.length !== arguments.length)
                                return y(n.sqlite3_db_handle(I), "sqlite3_bind_text", m.length);
                            if (s.isPtr(S) || S === null)
                                return d(I, x, S, R, z);
                            S instanceof ArrayBuffer ? S = new Uint8Array(S) : Array.isArray(pMem) && (S = pMem.join(""));
                            let L, $;
                            try {
                                if (p.isSQLableTypedArray(S))
                                    L = s.allocFromTypedArray(S),
                                    $ = S.byteLength;
                                else if (typeof S == "string")
                                    [L,$] = s.allocCString(S);
                                else
                                    return p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), n.SQLITE_MISUSE, "Invalid 3rd argument type for sqlite3_bind_text().");
                                return d(I, x, L, $, n.SQLITE_WASM_DEALLOC)
                            } catch (u) {
                                return s.dealloc(L),
                                p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), u)
                            }
                        }
                        ,
                        n.sqlite3_bind_blob = function m(I, x, S, R, z) {
                            if (m.length !== arguments.length)
                                return y(n.sqlite3_db_handle(I), "sqlite3_bind_blob", m.length);
                            if (s.isPtr(S) || S === null)
                                return f(I, x, S, R, z);
                            S instanceof ArrayBuffer ? S = new Uint8Array(S) : Array.isArray(S) && (S = S.join(""));
                            let L, $;
                            try {
                                if (p.isBindableTypedArray(S))
                                    L = s.allocFromTypedArray(S),
                                    $ = R >= 0 ? R : S.byteLength;
                                else if (typeof S == "string")
                                    [L,$] = s.allocCString(S);
                                else
                                    return p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), n.SQLITE_MISUSE, "Invalid 3rd argument type for sqlite3_bind_blob().");
                                return f(I, x, L, $, n.SQLITE_WASM_DEALLOC)
                            } catch (u) {
                                return s.dealloc(L),
                                p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), u)
                            }
                        };
                    }
                    n.sqlite3_config = function(d, ...f) {
                        if (arguments.length < 2)
                            return n.SQLITE_MISUSE;
                        switch (d) {
                        case n.SQLITE_CONFIG_COVERING_INDEX_SCAN:
                        case n.SQLITE_CONFIG_MEMSTATUS:
                        case n.SQLITE_CONFIG_SMALL_MALLOC:
                        case n.SQLITE_CONFIG_SORTERREF_SIZE:
                        case n.SQLITE_CONFIG_STMTJRNL_SPILL:
                        case n.SQLITE_CONFIG_URI:
                            return s.exports.sqlite3_wasm_config_i(d, f[0]);
                        case n.SQLITE_CONFIG_LOOKASIDE:
                            return s.exports.sqlite3_wasm_config_ii(d, f[0], f[1]);
                        case n.SQLITE_CONFIG_MEMDB_MAXSIZE:
                            return s.exports.sqlite3_wasm_config_j(d, f[0]);
                        case n.SQLITE_CONFIG_GETMALLOC:
                        case n.SQLITE_CONFIG_GETMUTEX:
                        case n.SQLITE_CONFIG_GETPCACHE2:
                        case n.SQLITE_CONFIG_GETPCACHE:
                        case n.SQLITE_CONFIG_HEAP:
                        case n.SQLITE_CONFIG_LOG:
                        case n.SQLITE_CONFIG_MALLOC:
                        case n.SQLITE_CONFIG_MMAP_SIZE:
                        case n.SQLITE_CONFIG_MULTITHREAD:
                        case n.SQLITE_CONFIG_MUTEX:
                        case n.SQLITE_CONFIG_PAGECACHE:
                        case n.SQLITE_CONFIG_PCACHE2:
                        case n.SQLITE_CONFIG_PCACHE:
                        case n.SQLITE_CONFIG_PCACHE_HDRSZ:
                        case n.SQLITE_CONFIG_PMASZ:
                        case n.SQLITE_CONFIG_SERIALIZED:
                        case n.SQLITE_CONFIG_SINGLETHREAD:
                        case n.SQLITE_CONFIG_SQLLOG:
                        case n.SQLITE_CONFIG_WIN32_HEAPSIZE:
                        default:
                            return n.SQLITE_NOTFOUND
                        }
                    }
                    ;
                    {
                        let d = new Set;
                        n.sqlite3_auto_extension = function(f) {
                            if (f instanceof Function)
                                f = s.installFunction("i(ppp)", f);
                            else if (arguments.length !== 1 || !s.isPtr(f))
                                return n.SQLITE_MISUSE;
                            let m = s.exports.sqlite3_auto_extension(f);
                            return f !== arguments[0] && (m === 0 ? d.add(f) : s.uninstallFunction(f)),
                            m
                        }
                        ,
                        n.sqlite3_cancel_auto_extension = function(f) {
                            return !f || arguments.length !== 1 || !s.isPtr(f) ? 0 : s.exports.sqlite3_cancel_auto_extension(f)
                        }
                        ,
                        n.sqlite3_reset_auto_extension = function() {
                            s.exports.sqlite3_reset_auto_extension();
                            for (let f of d)
                                s.uninstallFunction(f);
                            d.clear();
                        };
                    }
                    let Y = n.sqlite3_vfs_find("kvvfs");
                    if (Y)
                        if (p.isUIThread()) {
                            let d = new n.sqlite3_kvvfs_methods(s.exports.sqlite3_wasm_kvvfs_methods());
                            delete n.sqlite3_kvvfs_methods;
                            let f = s.exports.sqlite3_wasm_kvvfsMakeKeyOnPstack
                              , m = s.pstack
                              , I = S=>s.peek(S) === 115 ? sessionStorage : localStorage
                              , x = {
                                xRead: (S,R,z,L)=>{
                                    let $ = m.pointer
                                      , u = s.scopedAllocPush();
                                    try {
                                        let q = f(S, R);
                                        if (!q)
                                            return -3;
                                        let F = s.cstrToJs(q)
                                          , D = I(S).getItem(F);
                                        if (!D)
                                            return -1;
                                        let P = D.length;
                                        if (L <= 0)
                                            return P;
                                        if (L === 1)
                                            return s.poke(z, 0),
                                            P;
                                        let h = s.scopedAllocCString(D);
                                        return L > P + 1 && (L = P + 1),
                                        s.heap8u().copyWithin(z, h, h + L - 1),
                                        s.poke(z + L - 1, 0),
                                        L - 1
                                    } catch (q) {
                                        return console.error("kvstorageRead()", q),
                                        -2
                                    } finally {
                                        m.restore($),
                                        s.scopedAllocPop(u);
                                    }
                                }
                                ,
                                xWrite: (S,R,z)=>{
                                    let L = m.pointer;
                                    try {
                                        let $ = f(S, R);
                                        if (!$)
                                            return 1;
                                        let u = s.cstrToJs($);
                                        return I(S).setItem(u, s.cstrToJs(z)),
                                        0
                                    } catch ($) {
                                        return console.error("kvstorageWrite()", $),
                                        n.SQLITE_IOERR
                                    } finally {
                                        m.restore(L);
                                    }
                                }
                                ,
                                xDelete: (S,R)=>{
                                    let z = m.pointer;
                                    try {
                                        let L = f(S, R);
                                        return L ? (I(S).removeItem(s.cstrToJs(L)),
                                        0) : 1
                                    } catch (L) {
                                        return console.error("kvstorageDelete()", L),
                                        n.SQLITE_IOERR
                                    } finally {
                                        m.restore(z);
                                    }
                                }
                            };
                            for (let S of Object.keys(x))
                                d[d.memberKey(S)] = s.installFunction(d.memberSignature(S), x[S]);
                        } else
                            n.sqlite3_vfs_unregister(Y);
                    s.xWrap.FuncPtrAdapter.warnOnUse = !0;
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    t.version = {
                        libVersion: "3.45.0",
                        libVersionNumber: 3045e3,
                        sourceId: "2024-01-15 17:01:13 1066602b2b1976fe58b5150777cced894af17c803e068f5918390d6915b46e1d",
                        downloadVersion: 345e4
                    };
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    let r = (...h)=>{
                        throw new Error(h.join(" "))
                    }
                      , i = (...h)=>{
                        throw new t.SQLite3Error(...h)
                    }
                      , n = t.capi
                      , s = t.wasm
                      , p = t.util
                      , y = new WeakMap
                      , O = new WeakMap
                      , B = (h,l,_)=>{
                        let c = Object.getOwnPropertyDescriptor(h, l);
                        return c ? c.value : _
                    }
                      , G = function(h, l) {
                        return l && (h instanceof f && (h = h.pointer),
                        i(l, "sqlite3 result code", l + ":", h ? n.sqlite3_errmsg(h) : n.sqlite3_errstr(l))),
                        arguments[0]
                    }
                      , J = s.installFunction("i(ippp)", function(h, l, _, c) {
                        n.SQLITE_TRACE_STMT === h && console.log("SQL TRACE #" + ++this.counter + " via sqlite3@" + l + ":", s.cstrToJs(c));
                    }
                    .bind({
                        counter: 0
                    }))
                      , Y = Object.create(null)
                      , d = function h(...l) {
                        if (!h._name2vfs) {
                            h._name2vfs = Object.create(null);
                            let ae = typeof importScripts == "function" ? ce=>i("The VFS for", ce, "is only available in the main window thread.") : !1;
                            h._name2vfs[":localStorage:"] = {
                                vfs: "kvvfs",
                                filename: ae || (()=>"local")
                            },
                            h._name2vfs[":sessionStorage:"] = {
                                vfs: "kvvfs",
                                filename: ae || (()=>"session")
                            };
                        }
                        let _ = h.normalizeArgs(...l)
                          , c = _.filename
                          , w = _.vfs
                          , j = _.flags;
                        (typeof c != "string" && typeof c != "number" || typeof j != "string" || w && typeof w != "string" && typeof w != "number") && (t.config.error("Invalid DB ctor args", _, arguments),
                        i("Invalid arguments for DB constructor."));
                        let H = typeof c == "number" ? s.cstrToJs(c) : c
                          , se = h._name2vfs[H];
                        se && (w = se.vfs,
                        c = H = se.filename(H));
                        let ee, ie = 0;
                        j.indexOf("c") >= 0 && (ie |= n.SQLITE_OPEN_CREATE | n.SQLITE_OPEN_READWRITE),
                        j.indexOf("w") >= 0 && (ie |= n.SQLITE_OPEN_READWRITE),
                        ie === 0 && (ie |= n.SQLITE_OPEN_READONLY),
                        ie |= n.SQLITE_OPEN_EXRESCODE;
                        let le = s.pstack.pointer;
                        try {
                            let ae = s.pstack.allocPtr()
                              , ce = n.sqlite3_open_v2(c, ae, ie, w || 0);
                            ee = s.peekPtr(ae),
                            G(ee, ce),
                            n.sqlite3_extended_result_codes(ee, 1),
                            j.indexOf("t") >= 0 && n.sqlite3_trace_v2(ee, n.SQLITE_TRACE_STMT, J, ee);
                        } catch (ae) {
                            throw ee && n.sqlite3_close_v2(ee),
                            ae
                        } finally {
                            s.pstack.restore(le);
                        }
                        this.filename = H,
                        y.set(this, ee),
                        O.set(this, Object.create(null));
                        try {
                            let ae = n.sqlite3_js_db_vfs(ee);
                            ae || i("Internal error: cannot get VFS for new db handle.");
                            let ce = Y[ae];
                            ce instanceof Function ? ce(this, t) : ce && G(ee, n.sqlite3_exec(ee, ce, 0, 0, 0));
                        } catch (ae) {
                            throw this.close(),
                            ae
                        }
                    };
                    d.setVfsPostOpenSql = function(h, l) {
                        Y[h] = l;
                    }
                    ,
                    d.normalizeArgs = function(h=":memory:", l="c", _=null) {
                        let c = {};
                        return arguments.length === 1 && arguments[0] && typeof arguments[0] == "object" ? (Object.assign(c, arguments[0]),
                        c.flags === void 0 && (c.flags = "c"),
                        c.vfs === void 0 && (c.vfs = null),
                        c.filename === void 0 && (c.filename = ":memory:")) : (c.filename = h,
                        c.flags = l,
                        c.vfs = _),
                        c
                    }
                    ;
                    let f = function(...h) {
                        d.apply(this, h);
                    };
                    f.dbCtorHelper = d;
                    let m = {
                        null: 1,
                        number: 2,
                        string: 3,
                        boolean: 4,
                        blob: 5
                    };
                    m.undefined == m.null,
                    s.bigIntEnabled && (m.bigint = m.number);
                    let I = function() {
                        m !== arguments[2] && i(n.SQLITE_MISUSE, "Do not call the Stmt constructor directly. Use DB.prepare()."),
                        this.db = arguments[0],
                        y.set(this, arguments[1]),
                        this.parameterCount = n.sqlite3_bind_parameter_count(this.pointer);
                    }
                      , x = function(h) {
                        return h.pointer || i("DB has been closed."),
                        h
                    }
                      , S = function(h, l) {
                        return (l !== (l | 0) || l < 0 || l >= h.columnCount) && i("Column index", l, "is out of range."),
                        h
                    }
                      , R = function(h, l) {
                        let _ = Object.create(null);
                        switch (_.opt = Object.create(null),
                        l.length) {
                        case 1:
                            typeof l[0] == "string" || p.isSQLableTypedArray(l[0]) || Array.isArray(l[0]) ? _.sql = l[0] : l[0] && typeof l[0] == "object" && (_.opt = l[0],
                            _.sql = _.opt.sql);
                            break;
                        case 2:
                            _.sql = l[0],
                            _.opt = l[1];
                            break;
                        default:
                            i("Invalid argument count for exec().");
                        }
                        _.sql = p.flexibleString(_.sql),
                        typeof _.sql != "string" && i("Missing SQL argument or unsupported SQL value type.");
                        let c = _.opt;
                        switch (c.returnValue) {
                        case "resultRows":
                            c.resultRows || (c.resultRows = []),
                            _.returnVal = ()=>c.resultRows;
                            break;
                        case "saveSql":
                            c.saveSql || (c.saveSql = []),
                            _.returnVal = ()=>c.saveSql;
                            break;
                        case void 0:
                        case "this":
                            _.returnVal = ()=>h;
                            break;
                        default:
                            i("Invalid returnValue value:", c.returnValue);
                        }
                        if (!c.callback && !c.returnValue && c.rowMode !== void 0 && (c.resultRows || (c.resultRows = []),
                        _.returnVal = ()=>c.resultRows),
                        c.callback || c.resultRows)
                            switch (c.rowMode === void 0 ? "array" : c.rowMode) {
                            case "object":
                                _.cbArg = w=>w.get(Object.create(null));
                                break;
                            case "array":
                                _.cbArg = w=>w.get([]);
                                break;
                            case "stmt":
                                Array.isArray(c.resultRows) && i("exec(): invalid rowMode for a resultRows array: must", "be one of 'array', 'object',", "a result column number, or column name reference."),
                                _.cbArg = w=>w;
                                break;
                            default:
                                if (p.isInt32(c.rowMode)) {
                                    _.cbArg = w=>w.get(c.rowMode);
                                    break
                                } else if (typeof c.rowMode == "string" && c.rowMode.length > 1 && c.rowMode[0] === "$") {
                                    let w = c.rowMode.substr(1);
                                    _.cbArg = j=>{
                                        let H = j.get(Object.create(null))[w];
                                        return H === void 0 ? i(n.SQLITE_NOTFOUND, "exec(): unknown result column:", w) : H
                                    }
                                    ;
                                    break
                                }
                                i("Invalid rowMode:", c.rowMode);
                            }
                        return _
                    }
                      , z = (h,l,_,...c)=>{
                        let w = h.prepare(l);
                        try {
                            let j = w.bind(_).step() ? w.get(...c) : void 0;
                            return w.reset(),
                            j
                        } finally {
                            w.finalize();
                        }
                    }
                      , L = (h,l,_,c)=>h.exec({
                        sql: l,
                        bind: _,
                        rowMode: c,
                        returnValue: "resultRows"
                    });
                    f.checkRc = (h,l)=>G(h, l),
                    f.prototype = {
                        isOpen: function() {
                            return !!this.pointer
                        },
                        affirmOpen: function() {
                            return x(this)
                        },
                        close: function() {
                            if (this.pointer) {
                                if (this.onclose && this.onclose.before instanceof Function)
                                    try {
                                        this.onclose.before(this);
                                    } catch {}
                                let h = this.pointer;
                                if (Object.keys(O.get(this)).forEach((l,_)=>{
                                    if (_ && _.pointer)
                                        try {
                                            _.finalize();
                                        } catch {}
                                }
                                ),
                                y.delete(this),
                                O.delete(this),
                                n.sqlite3_close_v2(h),
                                this.onclose && this.onclose.after instanceof Function)
                                    try {
                                        this.onclose.after(this);
                                    } catch {}
                                delete this.filename;
                            }
                        },
                        changes: function(h=!1, l=!1) {
                            let _ = x(this).pointer;
                            return h ? l ? n.sqlite3_total_changes64(_) : n.sqlite3_total_changes(_) : l ? n.sqlite3_changes64(_) : n.sqlite3_changes(_)
                        },
                        dbFilename: function(h="main") {
                            return n.sqlite3_db_filename(x(this).pointer, h)
                        },
                        dbName: function(h=0) {
                            return n.sqlite3_db_name(x(this).pointer, h)
                        },
                        dbVfsName: function(h=0) {
                            let l, _ = n.sqlite3_js_db_vfs(x(this).pointer, h);
                            if (_) {
                                let c = new n.sqlite3_vfs(_);
                                try {
                                    l = s.cstrToJs(c.$zName);
                                } finally {
                                    c.dispose();
                                }
                            }
                            return l
                        },
                        prepare: function(h) {
                            x(this);
                            let l = s.pstack.pointer, _, c;
                            try {
                                _ = s.pstack.alloc(8),
                                f.checkRc(this, n.sqlite3_prepare_v2(this.pointer, h, -1, _, null)),
                                c = s.peekPtr(_);
                            } finally {
                                s.pstack.restore(l);
                            }
                            c || i("Cannot prepare empty SQL.");
                            let w = new I(this,c,m);
                            return O.get(this)[c] = w,
                            w
                        },
                        exec: function() {
                            x(this);
                            let h = R(this, arguments);
                            if (!h.sql)
                                return i("exec() requires an SQL string.");
                            let l = h.opt, _ = l.callback, c = Array.isArray(l.resultRows) ? l.resultRows : void 0, w, j = l.bind, H = !!(h.cbArg || l.columnNames || c), se = s.scopedAllocPush(), ee = Array.isArray(l.saveSql) ? l.saveSql : void 0;
                            try {
                                let ie = p.isSQLableTypedArray(h.sql)
                                  , le = ie ? h.sql.byteLength : s.jstrlen(h.sql)
                                  , ae = s.scopedAlloc(2 * s.ptrSizeof + (le + 1))
                                  , ce = ae + s.ptrSizeof
                                  , de = ce + s.ptrSizeof
                                  , we = de + le;
                                for (ie ? s.heap8().set(h.sql, de) : s.jstrcpy(h.sql, s.heap8(), de, le, !1),
                                s.poke(de + le, 0); de && s.peek(de, "i8"); ) {
                                    s.pokePtr([ae, ce], 0),
                                    f.checkRc(this, n.sqlite3_prepare_v3(this.pointer, de, le, 0, ae, ce));
                                    let qe = s.peekPtr(ae);
                                    if (de = s.peekPtr(ce),
                                    le = we - de,
                                    !!qe) {
                                        if (ee && ee.push(n.sqlite3_sql(qe).trim()),
                                        w = new I(this,qe,m),
                                        j && w.parameterCount && (w.bind(j),
                                        j = null),
                                        H && w.columnCount) {
                                            let k = Array.isArray(l.columnNames) ? 0 : 1;
                                            if (H = !1,
                                            h.cbArg || c) {
                                                for (; w.step(); w._lockedByExec = !1) {
                                                    k++ === 0 && w.getColumnNames(l.columnNames),
                                                    w._lockedByExec = !0;
                                                    let C = h.cbArg(w);
                                                    if (c && c.push(C),
                                                    _ && _.call(l, C, w) === !1)
                                                        break
                                                }
                                                w._lockedByExec = !1;
                                            }
                                            k === 0 && w.getColumnNames(l.columnNames);
                                        } else
                                            w.step();
                                        w.reset().finalize(),
                                        w = null;
                                    }
                                }
                            } finally {
                                s.scopedAllocPop(se),
                                w && (delete w._lockedByExec,
                                w.finalize());
                            }
                            return h.returnVal()
                        },
                        createFunction: function(l, _, c) {
                            let w = C=>C instanceof Function;
                            switch (arguments.length) {
                            case 1:
                                c = l,
                                l = c.name,
                                _ = c.xFunc || 0;
                                break;
                            case 2:
                                w(_) || (c = _,
                                _ = c.xFunc || 0);
                                break;
                            case 3:
                                break;
                            default:
                                break
                            }
                            c || (c = {}),
                            typeof l != "string" && i("Invalid arguments: missing function name.");
                            let j = c.xStep || 0, H = c.xFinal || 0, se = c.xValue || 0, ee = c.xInverse || 0, ie;
                            w(_) ? (ie = !1,
                            (w(j) || w(H)) && i("Ambiguous arguments: scalar or aggregate?"),
                            j = H = null) : w(j) ? (w(H) || i("Missing xFinal() callback for aggregate or window UDF."),
                            _ = null) : w(H) ? i("Missing xStep() callback for aggregate or window UDF.") : i("Missing function-type properties."),
                            ie === !1 ? (w(se) || w(ee)) && i("xValue and xInverse are not permitted for non-window UDFs.") : w(se) ? (w(ee) || i("xInverse must be provided if xValue is."),
                            ie = !0) : w(ee) && i("xValue must be provided if xInverse is.");
                            let le = c.pApp;
                            le != null && (typeof le != "number" || !p.isInt32(le)) && i("Invalid value for pApp property. Must be a legal WASM pointer value.");
                            let ae = c.xDestroy || 0;
                            ae && !w(ae) && i("xDestroy property must be a function.");
                            let ce = 0;
                            B(c, "deterministic") && (ce |= n.SQLITE_DETERMINISTIC),
                            B(c, "directOnly") && (ce |= n.SQLITE_DIRECTONLY),
                            B(c, "innocuous") && (ce |= n.SQLITE_INNOCUOUS),
                            l = l.toLowerCase();
                            let de = _ || j, we = B(c, "arity"), qe = typeof we == "number" ? we : de.length ? de.length - 1 : 0, k;
                            return ie ? k = n.sqlite3_create_window_function(this.pointer, l, qe, n.SQLITE_UTF8 | ce, le || 0, j, H, se, ee, ae) : k = n.sqlite3_create_function_v2(this.pointer, l, qe, n.SQLITE_UTF8 | ce, le || 0, _, j, H, ae),
                            f.checkRc(this, k),
                            this
                        },
                        selectValue: function(h, l, _) {
                            return z(this, h, l, 0, _)
                        },
                        selectValues: function(h, l, _) {
                            let c = this.prepare(h)
                              , w = [];
                            try {
                                for (c.bind(l); c.step(); )
                                    w.push(c.get(0, _));
                                c.reset();
                            } finally {
                                c.finalize();
                            }
                            return w
                        },
                        selectArray: function(h, l) {
                            return z(this, h, l, [])
                        },
                        selectObject: function(h, l) {
                            return z(this, h, l, {})
                        },
                        selectArrays: function(h, l) {
                            return L(this, h, l, "array")
                        },
                        selectObjects: function(h, l) {
                            return L(this, h, l, "object")
                        },
                        openStatementCount: function() {
                            return this.pointer ? Object.keys(O.get(this)).length : 0
                        },
                        transaction: function(h) {
                            let l = "BEGIN";
                            arguments.length > 1 && (/[^a-zA-Z]/.test(arguments[0]) && i(n.SQLITE_MISUSE, "Invalid argument for BEGIN qualifier."),
                            l += " " + arguments[0],
                            h = arguments[1]),
                            x(this).exec(l);
                            try {
                                let _ = h(this);
                                return this.exec("COMMIT"),
                                _
                            } catch (_) {
                                throw this.exec("ROLLBACK"),
                                _
                            }
                        },
                        savepoint: function(h) {
                            x(this).exec("SAVEPOINT oo1");
                            try {
                                let l = h(this);
                                return this.exec("RELEASE oo1"),
                                l
                            } catch (l) {
                                throw this.exec("ROLLBACK to SAVEPOINT oo1; RELEASE SAVEPOINT oo1"),
                                l
                            }
                        },
                        checkRc: function(h) {
                            return G(this, h)
                        }
                    };
                    let $ = function(h) {
                        return h.pointer || i("Stmt has been closed."),
                        h
                    }
                      , u = function(h) {
                        let l = m[h == null ? "null" : typeof h];
                        switch (l) {
                        case m.boolean:
                        case m.null:
                        case m.number:
                        case m.string:
                            return l;
                        case m.bigint:
                            if (s.bigIntEnabled)
                                return l;
                        default:
                            return p.isBindableTypedArray(h) ? m.blob : void 0
                        }
                    }
                      , q = function(h) {
                        return u(h) || i("Unsupported bind() argument type:", typeof h)
                    }
                      , F = function(h, l) {
                        let _ = typeof l == "number" ? l : n.sqlite3_bind_parameter_index(h.pointer, l);
                        return _ === 0 || !p.isInt32(_) ? i("Invalid bind() parameter name: " + l) : (_ < 1 || _ > h.parameterCount) && i("Bind index", l, "is out of range."),
                        _
                    }
                      , D = function(h, l) {
                        return h._lockedByExec && i("Operation is illegal when statement is locked:", l),
                        h
                    }
                      , P = function h(l, _, c, w) {
                        D($(l), "bind()"),
                        h._ || (h._tooBigInt = H=>i("BigInt value is too big to store without precision loss:", H),
                        h._ = {
                            string: function(H, se, ee, ie) {
                                let[le,ae] = s.allocCString(ee, !0);
                                return (ie ? n.sqlite3_bind_blob : n.sqlite3_bind_text)(H.pointer, se, le, ae, n.SQLITE_WASM_DEALLOC)
                            }
                        }),
                        q(w),
                        _ = F(l, _);
                        let j = 0;
                        switch (w == null ? m.null : c) {
                        case m.null:
                            j = n.sqlite3_bind_null(l.pointer, _);
                            break;
                        case m.string:
                            j = h._.string(l, _, w, !1);
                            break;
                        case m.number:
                            {
                                let H;
                                p.isInt32(w) ? H = n.sqlite3_bind_int : typeof w == "bigint" ? p.bigIntFits64(w) ? s.bigIntEnabled ? H = n.sqlite3_bind_int64 : p.bigIntFitsDouble(w) ? (w = Number(w),
                                H = n.sqlite3_bind_double) : h._tooBigInt(w) : h._tooBigInt(w) : (w = Number(w),
                                s.bigIntEnabled && Number.isInteger(w) ? H = n.sqlite3_bind_int64 : H = n.sqlite3_bind_double),
                                j = H(l.pointer, _, w);
                                break
                            }
                        case m.boolean:
                            j = n.sqlite3_bind_int(l.pointer, _, w ? 1 : 0);
                            break;
                        case m.blob:
                            {
                                if (typeof w == "string") {
                                    j = h._.string(l, _, w, !0);
                                    break
                                } else
                                    w instanceof ArrayBuffer ? w = new Uint8Array(w) : p.isBindableTypedArray(w) || i("Binding a value as a blob requires", "that it be a string, Uint8Array, Int8Array, or ArrayBuffer.");
                                let H = s.alloc(w.byteLength || 1);
                                s.heap8().set(w.byteLength ? w : [0], H),
                                j = n.sqlite3_bind_blob(l.pointer, _, H, w.byteLength, n.SQLITE_WASM_DEALLOC);
                                break
                            }
                        default:
                            t.config.warn("Unsupported bind() argument type:", w),
                            i("Unsupported bind() argument type: " + typeof w);
                        }
                        return j && f.checkRc(l.db.pointer, j),
                        l._mayGet = !1,
                        l
                    };
                    I.prototype = {
                        finalize: function() {
                            if (this.pointer) {
                                D(this, "finalize()");
                                let h = n.sqlite3_finalize(this.pointer);
                                return delete O.get(this.db)[this.pointer],
                                y.delete(this),
                                delete this._mayGet,
                                delete this.parameterCount,
                                delete this._lockedByExec,
                                delete this.db,
                                h
                            }
                        },
                        clearBindings: function() {
                            return D($(this), "clearBindings()"),
                            n.sqlite3_clear_bindings(this.pointer),
                            this._mayGet = !1,
                            this
                        },
                        reset: function(h) {
                            D(this, "reset()"),
                            h && this.clearBindings();
                            let l = n.sqlite3_reset($(this).pointer);
                            return this._mayGet = !1,
                            G(this.db, l),
                            this
                        },
                        bind: function() {
                            $(this);
                            let h, l;
                            switch (arguments.length) {
                            case 1:
                                h = 1,
                                l = arguments[0];
                                break;
                            case 2:
                                h = arguments[0],
                                l = arguments[1];
                                break;
                            default:
                                i("Invalid bind() arguments.");
                            }
                            return l === void 0 ? this : (this.parameterCount || i("This statement has no bindable parameters."),
                            this._mayGet = !1,
                            l === null ? P(this, h, m.null, l) : Array.isArray(l) ? (arguments.length !== 1 && i("When binding an array, an index argument is not permitted."),
                            l.forEach((_,c)=>P(this, c + 1, q(_), _)),
                            this) : (l instanceof ArrayBuffer && (l = new Uint8Array(l)),
                            typeof l == "object" && !p.isBindableTypedArray(l) ? (arguments.length !== 1 && i("When binding an object, an index argument is not permitted."),
                            Object.keys(l).forEach(_=>P(this, _, q(l[_]), l[_])),
                            this) : P(this, h, q(l), l)))
                        },
                        bindAsBlob: function(h, l) {
                            $(this),
                            arguments.length === 1 && (l = h,
                            h = 1);
                            let _ = q(l);
                            return m.string !== _ && m.blob !== _ && m.null !== _ && i("Invalid value type for bindAsBlob()"),
                            P(this, h, m.blob, l)
                        },
                        step: function() {
                            D(this, "step()");
                            let h = n.sqlite3_step($(this).pointer);
                            switch (h) {
                            case n.SQLITE_DONE:
                                return this._mayGet = !1;
                            case n.SQLITE_ROW:
                                return this._mayGet = !0;
                            default:
                                this._mayGet = !1,
                                t.config.warn("sqlite3_step() rc=", h, n.sqlite3_js_rc_str(h), "SQL =", n.sqlite3_sql(this.pointer)),
                                f.checkRc(this.db.pointer, h);
                            }
                        },
                        stepReset: function() {
                            return this.step(),
                            this.reset()
                        },
                        stepFinalize: function() {
                            try {
                                let h = this.step();
                                return this.reset(),
                                h
                            } finally {
                                try {
                                    this.finalize();
                                } catch {}
                            }
                        },
                        get: function(h, l) {
                            if ($(this)._mayGet || i("Stmt.step() has not (recently) returned true."),
                            Array.isArray(h)) {
                                let _ = 0
                                  , c = this.columnCount;
                                for (; _ < c; )
                                    h[_] = this.get(_++);
                                return h
                            } else if (h && typeof h == "object") {
                                let _ = 0
                                  , c = this.columnCount;
                                for (; _ < c; )
                                    h[n.sqlite3_column_name(this.pointer, _)] = this.get(_++);
                                return h
                            }
                            switch (S(this, h),
                            l === void 0 ? n.sqlite3_column_type(this.pointer, h) : l) {
                            case n.SQLITE_NULL:
                                return null;
                            case n.SQLITE_INTEGER:
                                if (s.bigIntEnabled) {
                                    let _ = n.sqlite3_column_int64(this.pointer, h);
                                    return _ >= Number.MIN_SAFE_INTEGER && _ <= Number.MAX_SAFE_INTEGER ? Number(_).valueOf() : _
                                } else {
                                    let _ = n.sqlite3_column_double(this.pointer, h);
                                    return (_ > Number.MAX_SAFE_INTEGER || _ < Number.MIN_SAFE_INTEGER) && i("Integer is out of range for JS integer range: " + _),
                                    p.isInt32(_) ? _ | 0 : _
                                }
                            case n.SQLITE_FLOAT:
                                return n.sqlite3_column_double(this.pointer, h);
                            case n.SQLITE_TEXT:
                                return n.sqlite3_column_text(this.pointer, h);
                            case n.SQLITE_BLOB:
                                {
                                    let _ = n.sqlite3_column_bytes(this.pointer, h)
                                      , c = n.sqlite3_column_blob(this.pointer, h)
                                      , w = new Uint8Array(_);
                                    return _ && w.set(s.heap8u().slice(c, c + _), 0),
                                    _ && this.db._blobXfer instanceof Array && this.db._blobXfer.push(w.buffer),
                                    w
                                }
                            default:
                                i("Don't know how to translate", "type of result column #" + h + ".");
                            }
                            i("Not reached.");
                        },
                        getInt: function(h) {
                            return this.get(h, n.SQLITE_INTEGER)
                        },
                        getFloat: function(h) {
                            return this.get(h, n.SQLITE_FLOAT)
                        },
                        getString: function(h) {
                            return this.get(h, n.SQLITE_TEXT)
                        },
                        getBlob: function(h) {
                            return this.get(h, n.SQLITE_BLOB)
                        },
                        getJSON: function(h) {
                            let l = this.get(h, n.SQLITE_STRING);
                            return l === null ? l : JSON.parse(l)
                        },
                        getColumnName: function(h) {
                            return n.sqlite3_column_name(S($(this), h).pointer, h)
                        },
                        getColumnNames: function(h=[]) {
                            S($(this), 0);
                            let l = this.columnCount;
                            for (let _ = 0; _ < l; ++_)
                                h.push(n.sqlite3_column_name(this.pointer, _));
                            return h
                        },
                        getParamIndex: function(h) {
                            return $(this).parameterCount ? n.sqlite3_bind_parameter_index(this.pointer, h) : void 0
                        }
                    };
                    {
                        let h = {
                            enumerable: !0,
                            get: function() {
                                return y.get(this)
                            },
                            set: ()=>i("The pointer property is read-only.")
                        };
                        Object.defineProperty(I.prototype, "pointer", h),
                        Object.defineProperty(f.prototype, "pointer", h);
                    }
                    if (Object.defineProperty(I.prototype, "columnCount", {
                        enumerable: !1,
                        get: function() {
                            return n.sqlite3_column_count(this.pointer)
                        },
                        set: ()=>i("The columnCount property is read-only.")
                    }),
                    t.oo1 = {
                        DB: f,
                        Stmt: I
                    },
                    p.isUIThread()) {
                        t.oo1.JsStorageDb = function(l="session") {
                            l !== "session" && l !== "local" && i("JsStorageDb db name must be one of 'session' or 'local'."),
                            d.call(this, {
                                filename: l,
                                flags: "c",
                                vfs: "kvvfs"
                            });
                        }
                        ;
                        let h = t.oo1.JsStorageDb;
                        h.prototype = Object.create(f.prototype),
                        h.clearStorage = n.sqlite3_js_kvvfs_clear,
                        h.prototype.clearStorage = function() {
                            return h.clearStorage(x(this).filename)
                        }
                        ,
                        h.storageSize = n.sqlite3_js_kvvfs_size,
                        h.prototype.storageSize = function() {
                            return h.storageSize(x(this).filename)
                        };
                    }
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    t.initWorker1API = function() {
                        "use strict";
                        let r = (...d)=>{
                            throw new Error(d.join(" "))
                        }
                        ;
                        globalThis.WorkerGlobalScope instanceof Function || r("initWorker1API() must be run from a Worker thread.");
                        let i = this.sqlite3 || r("Missing this.sqlite3 object.")
                          , n = i.oo1.DB
                          , s = function(d) {
                            let f = p.idMap.get(d);
                            return f || (f = "db#" + ++p.idSeq + "@" + d.pointer,
                            p.idMap.set(d, f),
                            f)
                        }
                          , p = {
                            dbList: [],
                            idSeq: 0,
                            idMap: new WeakMap,
                            xfer: [],
                            open: function(d) {
                                let f = new n(d);
                                return this.dbs[s(f)] = f,
                                this.dbList.indexOf(f) < 0 && this.dbList.push(f),
                                f
                            },
                            close: function(d, f) {
                                if (d) {
                                    delete this.dbs[s(d)];
                                    let m = d.filename
                                      , I = i.wasm.sqlite3_wasm_db_vfs(d.pointer, 0);
                                    d.close();
                                    let x = this.dbList.indexOf(d);
                                    x >= 0 && this.dbList.splice(x, 1),
                                    f && m && I && i.wasm.sqlite3_wasm_vfs_unlink(I, m);
                                }
                            },
                            post: function(d, f) {
                                f && f.length ? (globalThis.postMessage(d, Array.from(f)),
                                f.length = 0) : globalThis.postMessage(d);
                            },
                            dbs: Object.create(null),
                            getDb: function(d, f=!0) {
                                return this.dbs[d] || (f ? r("Unknown (or closed) DB ID:", d) : void 0)
                            }
                        }
                          , y = function(d=p.dbList[0]) {
                            return d && d.pointer ? d : r("DB is not opened.")
                        }
                          , O = function(d, f=!0) {
                            let m = p.getDb(d.dbId, !1) || p.dbList[0];
                            return f ? y(m) : m
                        }
                          , B = function() {
                            return p.dbList[0] && s(p.dbList[0])
                        }
                          , G = function(d) {
                            let f = /^file:.+(vfs=(\w+))/.exec(d);
                            return i.capi.sqlite3_vfs_find(f ? f[2] : 0)
                        }
                          , J = d=>d === "" || d[0] === ":"
                          , Y = {
                            open: function(d) {
                                let f = Object.create(null)
                                  , m = d.args || Object.create(null);
                                m.simulateError && r("Throwing because of simulateError flag.");
                                let I = Object.create(null), x, S;
                                if (f.vfs = m.vfs,
                                J(m.filename) ? f.filename = m.filename || "" : (f.filename = m.filename,
                                x = m.byteArray,
                                x && (S = G(m.filename))),
                                S) {
                                    let z;
                                    try {
                                        z = i.wasm.allocFromTypedArray(x);
                                        let L = i.wasm.sqlite3_wasm_vfs_create_file(S, f.filename, z, x.byteLength);
                                        L && i.SQLite3Error.toss(L);
                                    } catch (L) {
                                        throw new i.SQLite3Error(L.name + " creating " + m.filename + ": " + L.message,{
                                            cause: L
                                        })
                                    } finally {
                                        z && i.wasm.dealloc(z);
                                    }
                                }
                                let R = p.open(f);
                                return I.filename = R.filename,
                                I.persistent = !!i.capi.sqlite3_js_db_uses_vfs(R.pointer, "opfs"),
                                I.dbId = s(R),
                                I.vfs = R.dbVfsName(),
                                I
                            },
                            close: function(d) {
                                let f = O(d, !1)
                                  , m = {
                                    filename: f && f.filename
                                };
                                if (f) {
                                    let I = d.args && typeof d.args == "object" ? !!d.args.unlink : !1;
                                    p.close(f, I);
                                }
                                return m
                            },
                            exec: function(d) {
                                let f = typeof d.args == "string" ? {
                                    sql: d.args
                                } : d.args || Object.create(null);
                                f.rowMode === "stmt" ? r("Invalid rowMode for 'exec': stmt mode", "does not work in the Worker API.") : f.sql || r("'exec' requires input SQL.");
                                let m = O(d);
                                (f.callback || Array.isArray(f.resultRows)) && (m._blobXfer = p.xfer);
                                let I = f.callback
                                  , x = 0
                                  , S = !!f.columnNames;
                                typeof I == "string" && (S || (f.columnNames = []),
                                f.callback = function(R, z) {
                                    p.post({
                                        type: I,
                                        columnNames: f.columnNames,
                                        rowNumber: ++x,
                                        row: R
                                    }, p.xfer);
                                }
                                );
                                try {
                                    let R = f.countChanges ? m.changes(!0, f.countChanges === 64) : void 0;
                                    m.exec(f),
                                    R !== void 0 && (f.changeCount = m.changes(!0, f.countChanges === 64) - R),
                                    f.callback instanceof Function && (f.callback = I,
                                    p.post({
                                        type: I,
                                        columnNames: f.columnNames,
                                        rowNumber: null,
                                        row: void 0
                                    }));
                                } finally {
                                    delete m._blobXfer,
                                    f.callback && (f.callback = I);
                                }
                                return f
                            },
                            "config-get": function() {
                                let d = Object.create(null)
                                  , f = i.config;
                                return ["bigIntEnabled"].forEach(function(m) {
                                    Object.getOwnPropertyDescriptor(f, m) && (d[m] = f[m]);
                                }),
                                d.version = i.version,
                                d.vfsList = i.capi.sqlite3_js_vfs_list(),
                                d.opfsEnabled = !!i.opfs,
                                d
                            },
                            export: function(d) {
                                let f = O(d)
                                  , m = {
                                    byteArray: i.capi.sqlite3_js_db_export(f.pointer),
                                    filename: f.filename,
                                    mimetype: "application/x-sqlite3"
                                };
                                return p.xfer.push(m.byteArray.buffer),
                                m
                            },
                            toss: function(d) {
                                r("Testing worker exception");
                            },
                            "opfs-tree": async function(d) {
                                return i.opfs || r("OPFS support is unavailable."),
                                await i.opfs.treeList()
                            }
                        };
                        globalThis.onmessage = async function(d) {
                            d = d.data;
                            let f, m = d.dbId, I = d.type, x = performance.now();
                            try {
                                Y.hasOwnProperty(I) && Y[I]instanceof Function ? f = await Y[I](d) : r("Unknown db worker message type:", d.type);
                            } catch (S) {
                                I = "error",
                                f = {
                                    operation: d.type,
                                    message: S.message,
                                    errorClass: S.name,
                                    input: d
                                },
                                S.stack && (f.stack = typeof S.stack == "string" ? S.stack.split(/\n\s*/) : S.stack);
                            }
                            m || (m = f.dbId || B()),
                            p.post({
                                type: I,
                                dbId: m,
                                messageId: d.messageId,
                                workerReceivedTime: x,
                                workerRespondTime: performance.now(),
                                departureTime: d.departureTime,
                                result: f
                            }, p.xfer);
                        }
                        ,
                        globalThis.postMessage({
                            type: "sqlite3-api",
                            result: "worker1-ready"
                        });
                    }
                    .bind({
                        sqlite3: t
                    });
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    let r = t.wasm
                      , i = t.capi
                      , n = t.util.toss3
                      , s = Object.create(null)
                      , p = Object.create(null)
                      , y = t.StructBinder;
                    t.vfs = s,
                    t.vtab = p;
                    let O = i.sqlite3_index_info;
                    O.prototype.nthConstraint = function(d, f=!1) {
                        if (d < 0 || d >= this.$nConstraint)
                            return !1;
                        let m = this.$aConstraint + O.sqlite3_index_constraint.structInfo.sizeof * d;
                        return f ? m : new O.sqlite3_index_constraint(m)
                    }
                    ,
                    O.prototype.nthConstraintUsage = function(d, f=!1) {
                        if (d < 0 || d >= this.$nConstraint)
                            return !1;
                        let m = this.$aConstraintUsage + O.sqlite3_index_constraint_usage.structInfo.sizeof * d;
                        return f ? m : new O.sqlite3_index_constraint_usage(m)
                    }
                    ,
                    O.prototype.nthOrderBy = function(d, f=!1) {
                        if (d < 0 || d >= this.$nOrderBy)
                            return !1;
                        let m = this.$aOrderBy + O.sqlite3_index_orderby.structInfo.sizeof * d;
                        return f ? m : new O.sqlite3_index_orderby(m)
                    }
                    ;
                    let B = function d(f, m, I, x=d.installMethodArgcCheck) {
                        if (f instanceof y.StructType ? !(I instanceof Function) && !r.isPtr(I) && n("Usage errror: expecting a Function or WASM pointer to one.") : n("Usage error: target object is-not-a StructType."),
                        arguments.length === 1)
                            return (L,$)=>d(f, L, $, x);
                        d.argcProxy || (d.argcProxy = function(L, $, u, q) {
                            return function(...F) {
                                return u.length !== arguments.length && n("Argument mismatch for", L.structInfo.name + "::" + $ + ": Native signature is:", q),
                                u.apply(this, F)
                            }
                        }
                        ,
                        d.removeFuncList = function() {
                            this.ondispose.__removeFuncList && (this.ondispose.__removeFuncList.forEach((L,$)=>{
                                if (typeof L == "number")
                                    try {
                                        r.uninstallFunction(L);
                                    } catch {}
                            }
                            ),
                            delete this.ondispose.__removeFuncList);
                        }
                        );
                        let S = f.memberSignature(m);
                        S.length < 2 && n("Member", m, "does not have a function pointer signature:", S);
                        let R = f.memberKey(m)
                          , z = x && !r.isPtr(I) ? d.argcProxy(f, R, I, S) : I;
                        if (r.isPtr(z))
                            z && !r.functionEntry(z) && n("Pointer", z, "is not a WASM function table entry."),
                            f[R] = z;
                        else {
                            let L = r.installFunction(z, f.memberSignature(m, !0));
                            f[R] = L,
                            (!f.ondispose || !f.ondispose.__removeFuncList) && (f.addOnDispose("ondispose.__removeFuncList handler", d.removeFuncList),
                            f.ondispose.__removeFuncList = []),
                            f.ondispose.__removeFuncList.push(R, L);
                        }
                        return (L,$)=>d(f, L, $, x)
                    };
                    B.installMethodArgcCheck = !1;
                    let G = function(d, f, m=B.installMethodArgcCheck) {
                        let I = new Map;
                        for (let x of Object.keys(f)) {
                            let S = f[x]
                              , R = I.get(S);
                            if (R) {
                                let z = d.memberKey(x);
                                d[z] = d[d.memberKey(R)];
                            } else
                                B(d, x, S, m),
                                I.set(S, x);
                        }
                        return d
                    };
                    y.StructType.prototype.installMethod = function(f, m, I=B.installMethodArgcCheck) {
                        return arguments.length < 3 && f && typeof f == "object" ? G(this, ...arguments) : B(this, ...arguments)
                    }
                    ,
                    y.StructType.prototype.installMethods = function(d, f=B.installMethodArgcCheck) {
                        return G(this, d, f)
                    }
                    ,
                    i.sqlite3_vfs.prototype.registerVfs = function(d=!1) {
                        this instanceof t.capi.sqlite3_vfs || n("Expecting a sqlite3_vfs-type argument.");
                        let f = i.sqlite3_vfs_register(this, d ? 1 : 0);
                        return f && n("sqlite3_vfs_register(", this, ") failed with rc", f),
                        this.pointer !== i.sqlite3_vfs_find(this.$zName) && n("BUG: sqlite3_vfs_find(vfs.$zName) failed for just-installed VFS", this),
                        this
                    }
                    ,
                    s.installVfs = function(d) {
                        let f = 0
                          , m = ["io", "vfs"];
                        for (let I of m) {
                            let x = d[I];
                            x && (++f,
                            G(x.struct, x.methods, !!x.applyArgcCheck),
                            I === "vfs" && (!x.struct.$zName && typeof x.name == "string" && x.struct.addOnDispose(x.struct.$zName = r.allocCString(x.name)),
                            x.struct.registerVfs(!!x.asDefault)));
                        }
                        return f || n("Misuse: installVfs() options object requires at least", "one of:", m),
                        this
                    }
                    ;
                    let J = function(d, f) {
                        return function(m, I=!1) {
                            if (arguments.length === 0 && (m = new f),
                            m instanceof f)
                                return this.set(m.pointer, m),
                                m;
                            r.isPtr(m) || t.SQLite3Error.toss("Invalid argument to", d + "()");
                            let x = this.get(m);
                            return I && this.delete(m),
                            x
                        }
                        .bind(new Map)
                    }
                      , Y = function(d, f) {
                        let m = J(d, f);
                        return Object.assign(Object.create(null), {
                            StructType: f,
                            create: I=>{
                                let x = m();
                                return r.pokePtr(I, x.pointer),
                                x
                            }
                            ,
                            get: I=>m(I),
                            unget: I=>m(I, !0),
                            dispose: I=>{
                                let x = m(I, !0);
                                x && x.dispose();
                            }
                        })
                    };
                    p.xVtab = Y("xVtab", i.sqlite3_vtab),
                    p.xCursor = Y("xCursor", i.sqlite3_vtab_cursor),
                    p.xIndexInfo = d=>new i.sqlite3_index_info(d),
                    p.xError = function d(f, m, I) {
                        if (d.errorReporter instanceof Function)
                            try {
                                d.errorReporter("sqlite3_module::" + f + "(): " + m.message);
                            } catch {}
                        let x;
                        return m instanceof t.WasmAllocError ? x = i.SQLITE_NOMEM : arguments.length > 2 ? x = I : m instanceof t.SQLite3Error && (x = m.resultCode),
                        x || i.SQLITE_ERROR
                    }
                    ,
                    p.xError.errorReporter = console.error.bind(console),
                    p.xRowid = (d,f)=>r.poke(d, f, "i64"),
                    p.setupModule = function(d) {
                        let f = !1
                          , m = this instanceof i.sqlite3_module ? this : d.struct || (f = new i.sqlite3_module);
                        try {
                            let I = d.methods || n("Missing 'methods' object.");
                            for (let x of Object.entries({
                                xConnect: "xCreate",
                                xDisconnect: "xDestroy"
                            })) {
                                let S = x[0]
                                  , R = x[1];
                                I[S] === !0 ? I[S] = I[R] : I[R] === !0 && (I[R] = I[S]);
                            }
                            if (d.catchExceptions) {
                                let x = function(z, L) {
                                    return ["xConnect", "xCreate"].indexOf(z) >= 0 ? function($, u, q, F, D, P) {
                                        try {
                                            return L(...arguments) || 0
                                        } catch (h) {
                                            return h instanceof t.WasmAllocError || (r.dealloc(r.peekPtr(P)),
                                            r.pokePtr(P, r.allocCString(h.message))),
                                            p.xError(z, h)
                                        }
                                    }
                                    : function(...$) {
                                        try {
                                            return L(...$) || 0
                                        } catch (u) {
                                            return p.xError(z, u)
                                        }
                                    }
                                }
                                  , S = ["xCreate", "xConnect", "xBestIndex", "xDisconnect", "xDestroy", "xOpen", "xClose", "xFilter", "xNext", "xEof", "xColumn", "xRowid", "xUpdate", "xBegin", "xSync", "xCommit", "xRollback", "xFindFunction", "xRename", "xSavepoint", "xRelease", "xRollbackTo", "xShadowName"]
                                  , R = Object.create(null);
                                for (let z of S) {
                                    let L = I[z];
                                    if (L instanceof Function)
                                        z === "xConnect" && I.xCreate === L ? R[z] = I.xCreate : z === "xCreate" && I.xConnect === L ? R[z] = I.xConnect : R[z] = x(z, L);
                                    else
                                        continue
                                }
                                G(m, R, !1);
                            } else
                                G(m, I, !!d.applyArgcCheck);
                            if (m.$iVersion === 0) {
                                let x;
                                typeof d.iVersion == "number" ? x = d.iVersion : m.$xShadowName ? x = 3 : m.$xSavePoint || m.$xRelease || m.$xRollbackTo ? x = 2 : x = 1,
                                m.$iVersion = x;
                            }
                        } catch (I) {
                            throw f && f.dispose(),
                            I
                        }
                        return m
                    }
                    ,
                    i.sqlite3_module.prototype.setupModule = function(d) {
                        return p.setupModule.call(this, d)
                    };
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    let r = function i(n) {
                        if (!globalThis.SharedArrayBuffer || !globalThis.Atomics)
                            return Promise.reject(new Error("Cannot install OPFS: Missing SharedArrayBuffer and/or Atomics. The server must emit the COOP/COEP response headers to enable those. See https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep"));
                        if (typeof WorkerGlobalScope > "u")
                            return Promise.reject(new Error("The OPFS sqlite3_vfs cannot run in the main thread because it requires Atomics.wait()."));
                        if (!globalThis.FileSystemHandle || !globalThis.FileSystemDirectoryHandle || !globalThis.FileSystemFileHandle || !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle || !navigator?.storage?.getDirectory)
                            return Promise.reject(new Error("Missing required OPFS APIs."));
                        (!n || typeof n != "object") && (n = Object.create(null));
                        let s = new URL(globalThis.location.href).searchParams;
                        return s.has("opfs-disable") ? Promise.resolve(t) : (n.verbose === void 0 && (n.verbose = s.has("opfs-verbose") ? +s.get("opfs-verbose") || 2 : 1),
                        n.sanityChecks === void 0 && (n.sanityChecks = s.has("opfs-sanity-check")),
                        n.proxyUri === void 0 && (n.proxyUri = i.defaultProxyUri),
                        typeof n.proxyUri == "function" && (n.proxyUri = n.proxyUri()),
                        new Promise(function(y, O) {
                            let B = [t.config.error, t.config.warn, t.config.log]
                              , G = (k,...C)=>{
                                n.verbose > k && B[k]("OPFS syncer:", ...C);
                            }
                              , J = (...k)=>G(2, ...k)
                              , Y = (...k)=>G(1, ...k)
                              , d = (...k)=>G(0, ...k)
                              , f = t.util.toss
                              , m = t.capi
                              , I = t.util
                              , x = t.wasm
                              , S = m.sqlite3_vfs
                              , R = m.sqlite3_file
                              , z = m.sqlite3_io_methods
                              , L = Object.create(null)
                              , $ = ()=>globalThis.FileSystemHandle && globalThis.FileSystemDirectoryHandle && globalThis.FileSystemFileHandle && globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle && navigator?.storage?.getDirectory;
                            L.metrics = {
                                dump: function() {
                                    let k, C = 0, N = 0, U = 0;
                                    for (k in c.opIds) {
                                        let W = w[k];
                                        C += W.count,
                                        N += W.time,
                                        U += W.wait,
                                        W.avgTime = W.count && W.time ? W.time / W.count : 0,
                                        W.avgWait = W.count && W.wait ? W.wait / W.count : 0;
                                    }
                                    t.config.log(globalThis.location.href, "metrics for", globalThis.location.href, ":", w, `
Total of`, C, "op(s) for", N, "ms (incl. " + U + " ms of waiting on the async side)"),
                                    t.config.log("Serialization metrics:", w.s11n),
                                    h.postMessage({
                                        type: "opfs-async-metrics"
                                    });
                                },
                                reset: function() {
                                    let k, C = U=>U.count = U.time = U.wait = 0;
                                    for (k in c.opIds)
                                        C(w[k] = Object.create(null));
                                    let N = w.s11n = Object.create(null);
                                    N = N.serialize = Object.create(null),
                                    N.count = N.time = 0,
                                    N = w.s11n.deserialize = Object.create(null),
                                    N.count = N.time = 0;
                                }
                            };
                            let u = new z, q = new S().addOnDispose(()=>u.dispose()), F, D = k=>(F = !0,
                            q.dispose(),
                            O(k)), P = ()=>(F = !1,
                            y(t)), h = new Worker(n.proxyUri);
                            setTimeout(()=>{
                                F === void 0 && D(new Error("Timeout while waiting for OPFS async proxy worker."));
                            }
                            , 4e3),
                            h._originalOnError = h.onerror,
                            h.onerror = function(k) {
                                d("Error initializing OPFS asyncer:", k),
                                D(new Error("Loading OPFS async Worker failed for unknown reasons."));
                            }
                            ;
                            let l = m.sqlite3_vfs_find(null)
                              , _ = l ? new S(l) : null;
                            u.$iVersion = 1,
                            q.$iVersion = 2,
                            q.$szOsFile = m.sqlite3_file.structInfo.sizeof,
                            q.$mxPathname = 1024,
                            q.$zName = x.allocCString("opfs"),
                            q.$xDlOpen = q.$xDlError = q.$xDlSym = q.$xDlClose = null,
                            q.addOnDispose("$zName", q.$zName, "cleanup default VFS wrapper", ()=>_ ? _.dispose() : null);
                            let c = Object.create(null);
                            c.verbose = n.verbose,
                            c.littleEndian = (()=>{
                                let k = new ArrayBuffer(2);
                                return new DataView(k).setInt16(0, 256, !0),
                                new Int16Array(k)[0] === 256
                            }
                            )(),
                            c.asyncIdleWaitTime = 150,
                            c.asyncS11nExceptions = 1,
                            c.fileBufferSize = 1024 * 64,
                            c.sabS11nOffset = c.fileBufferSize,
                            c.sabS11nSize = q.$mxPathname * 2,
                            c.sabIO = new SharedArrayBuffer(c.fileBufferSize + c.sabS11nSize),
                            c.opIds = Object.create(null);
                            let w = Object.create(null);
                            {
                                let k = 0;
                                c.opIds.whichOp = k++,
                                c.opIds.rc = k++,
                                c.opIds.xAccess = k++,
                                c.opIds.xClose = k++,
                                c.opIds.xDelete = k++,
                                c.opIds.xDeleteNoWait = k++,
                                c.opIds.xFileSize = k++,
                                c.opIds.xLock = k++,
                                c.opIds.xOpen = k++,
                                c.opIds.xRead = k++,
                                c.opIds.xSleep = k++,
                                c.opIds.xSync = k++,
                                c.opIds.xTruncate = k++,
                                c.opIds.xUnlock = k++,
                                c.opIds.xWrite = k++,
                                c.opIds.mkdir = k++,
                                c.opIds["opfs-async-metrics"] = k++,
                                c.opIds["opfs-async-shutdown"] = k++,
                                c.opIds.retry = k++,
                                c.sabOP = new SharedArrayBuffer(k * 4),
                                L.metrics.reset();
                            }
                            c.sq3Codes = Object.create(null),
                            ["SQLITE_ACCESS_EXISTS", "SQLITE_ACCESS_READWRITE", "SQLITE_BUSY", "SQLITE_ERROR", "SQLITE_IOERR", "SQLITE_IOERR_ACCESS", "SQLITE_IOERR_CLOSE", "SQLITE_IOERR_DELETE", "SQLITE_IOERR_FSYNC", "SQLITE_IOERR_LOCK", "SQLITE_IOERR_READ", "SQLITE_IOERR_SHORT_READ", "SQLITE_IOERR_TRUNCATE", "SQLITE_IOERR_UNLOCK", "SQLITE_IOERR_WRITE", "SQLITE_LOCK_EXCLUSIVE", "SQLITE_LOCK_NONE", "SQLITE_LOCK_PENDING", "SQLITE_LOCK_RESERVED", "SQLITE_LOCK_SHARED", "SQLITE_LOCKED", "SQLITE_MISUSE", "SQLITE_NOTFOUND", "SQLITE_OPEN_CREATE", "SQLITE_OPEN_DELETEONCLOSE", "SQLITE_OPEN_MAIN_DB", "SQLITE_OPEN_READONLY"].forEach(k=>{
                                (c.sq3Codes[k] = m[k]) === void 0 && f("Maintenance required: not found:", k);
                            }
                            ),
                            c.opfsFlags = Object.assign(Object.create(null), {
                                OPFS_UNLOCK_ASAP: 1,
                                defaultUnlockAsap: !1
                            });
                            let j = (k,...C)=>{
                                let N = c.opIds[k] || f("Invalid op ID:", k);
                                c.s11n.serialize(...C),
                                Atomics.store(c.sabOPView, c.opIds.rc, -1),
                                Atomics.store(c.sabOPView, c.opIds.whichOp, N),
                                Atomics.notify(c.sabOPView, c.opIds.whichOp);
                                let U = performance.now();
                                Atomics.wait(c.sabOPView, c.opIds.rc, -1);
                                let W = Atomics.load(c.sabOPView, c.opIds.rc);
                                if (w[k].wait += performance.now() - U,
                                W && c.asyncS11nExceptions) {
                                    let Z = c.s11n.deserialize();
                                    Z && d(k + "() async error:", ...Z);
                                }
                                return W
                            }
                            ;
                            L.debug = {
                                asyncShutdown: ()=>{
                                    Y("Shutting down OPFS async listener. The OPFS VFS will no longer work."),
                                    j("opfs-async-shutdown");
                                }
                                ,
                                asyncRestart: ()=>{
                                    Y("Attempting to restart OPFS VFS async listener. Might work, might not."),
                                    h.postMessage({
                                        type: "opfs-async-restart"
                                    });
                                }
                            };
                            let H = ()=>{
                                if (c.s11n)
                                    return c.s11n;
                                let k = new TextDecoder
                                  , C = new TextEncoder("utf-8")
                                  , N = new Uint8Array(c.sabIO,c.sabS11nOffset,c.sabS11nSize)
                                  , U = new DataView(c.sabIO,c.sabS11nOffset,c.sabS11nSize);
                                c.s11n = Object.create(null);
                                let W = Object.create(null);
                                W.number = {
                                    id: 1,
                                    size: 8,
                                    getter: "getFloat64",
                                    setter: "setFloat64"
                                },
                                W.bigint = {
                                    id: 2,
                                    size: 8,
                                    getter: "getBigInt64",
                                    setter: "setBigInt64"
                                },
                                W.boolean = {
                                    id: 3,
                                    size: 4,
                                    getter: "getInt32",
                                    setter: "setInt32"
                                },
                                W.string = {
                                    id: 4
                                };
                                let Z = V=>W[typeof V] || f("Maintenance required: this value type cannot be serialized.", V)
                                  , re = V=>{
                                    switch (V) {
                                    case W.number.id:
                                        return W.number;
                                    case W.bigint.id:
                                        return W.bigint;
                                    case W.boolean.id:
                                        return W.boolean;
                                    case W.string.id:
                                        return W.string;
                                    default:
                                        f("Invalid type ID:", V);
                                    }
                                }
                                ;
                                return c.s11n.deserialize = function(V=!1) {
                                    ++w.s11n.deserialize.count;
                                    let ye = performance.now()
                                      , ue = N[0]
                                      , E = ue ? [] : null;
                                    if (ue) {
                                        let g = [], A = 1, T, M, Q;
                                        for (T = 0; T < ue; ++T,
                                        ++A)
                                            g.push(re(N[A]));
                                        for (T = 0; T < ue; ++T) {
                                            let X = g[T];
                                            X.getter ? (Q = U[X.getter](A, c.littleEndian),
                                            A += X.size) : (M = U.getInt32(A, c.littleEndian),
                                            A += 4,
                                            Q = k.decode(N.slice(A, A + M)),
                                            A += M),
                                            E.push(Q);
                                        }
                                    }
                                    return V && (N[0] = 0),
                                    w.s11n.deserialize.time += performance.now() - ye,
                                    E
                                }
                                ,
                                c.s11n.serialize = function(...V) {
                                    let ye = performance.now();
                                    if (++w.s11n.serialize.count,
                                    V.length) {
                                        let ue = []
                                          , E = 0
                                          , g = 1;
                                        for (N[0] = V.length & 255; E < V.length; ++E,
                                        ++g)
                                            ue.push(Z(V[E])),
                                            N[g] = ue[E].id;
                                        for (E = 0; E < V.length; ++E) {
                                            let A = ue[E];
                                            if (A.setter)
                                                U[A.setter](g, V[E], c.littleEndian),
                                                g += A.size;
                                            else {
                                                let T = C.encode(V[E]);
                                                U.setInt32(g, T.byteLength, c.littleEndian),
                                                g += 4,
                                                N.set(T, g),
                                                g += T.byteLength;
                                            }
                                        }
                                    } else
                                        N[0] = 0;
                                    w.s11n.serialize.time += performance.now() - ye;
                                }
                                ,
                                c.s11n
                            }
                              , se = function k(C=16) {
                                k._chars || (k._chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012346789",
                                k._n = k._chars.length);
                                let N = []
                                  , U = 0;
                                for (; U < C; ++U) {
                                    let W = Math.random() * (k._n * 64) % k._n | 0;
                                    N[U] = k._chars[W];
                                }
                                return N.join("")
                            }
                              , ee = Object.create(null)
                              , ie = Object.create(null);
                            ie.op = void 0,
                            ie.start = void 0;
                            let le = k=>{
                                ie.start = performance.now(),
                                ie.op = k,
                                ++w[k].count;
                            }
                              , ae = ()=>w[ie.op].time += performance.now() - ie.start
                              , ce = {
                                xCheckReservedLock: function(k, C) {
                                    let N = ee[k];
                                    return x.poke(C, N.lockType ? 1 : 0, "i32"),
                                    0
                                },
                                xClose: function(k) {
                                    le("xClose");
                                    let C = 0
                                      , N = ee[k];
                                    return N && (delete ee[k],
                                    C = j("xClose", k),
                                    N.sq3File && N.sq3File.dispose()),
                                    ae(),
                                    C
                                },
                                xDeviceCharacteristics: function(k) {
                                    return m.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN
                                },
                                xFileControl: function(k, C, N) {
                                    return m.SQLITE_NOTFOUND
                                },
                                xFileSize: function(k, C) {
                                    le("xFileSize");
                                    let N = j("xFileSize", k);
                                    if (N == 0)
                                        try {
                                            let U = c.s11n.deserialize()[0];
                                            x.poke(C, U, "i64");
                                        } catch (U) {
                                            d("Unexpected error reading xFileSize() result:", U),
                                            N = c.sq3Codes.SQLITE_IOERR;
                                        }
                                    return ae(),
                                    N
                                },
                                xLock: function(k, C) {
                                    le("xLock");
                                    let N = ee[k]
                                      , U = 0;
                                    return N.lockType ? N.lockType = C : (U = j("xLock", k, C),
                                    U === 0 && (N.lockType = C)),
                                    ae(),
                                    U
                                },
                                xRead: function(k, C, N, U) {
                                    le("xRead");
                                    let W = ee[k], Z;
                                    try {
                                        Z = j("xRead", k, N, Number(U)),
                                        (Z === 0 || m.SQLITE_IOERR_SHORT_READ === Z) && x.heap8u().set(W.sabView.subarray(0, N), C);
                                    } catch (re) {
                                        d("xRead(", arguments, ") failed:", re, W),
                                        Z = m.SQLITE_IOERR_READ;
                                    }
                                    return ae(),
                                    Z
                                },
                                xSync: function(k, C) {
                                    le("xSync"),
                                    ++w.xSync.count;
                                    let N = j("xSync", k, C);
                                    return ae(),
                                    N
                                },
                                xTruncate: function(k, C) {
                                    le("xTruncate");
                                    let N = j("xTruncate", k, Number(C));
                                    return ae(),
                                    N
                                },
                                xUnlock: function(k, C) {
                                    le("xUnlock");
                                    let N = ee[k]
                                      , U = 0;
                                    return m.SQLITE_LOCK_NONE === C && N.lockType && (U = j("xUnlock", k, C)),
                                    U === 0 && (N.lockType = C),
                                    ae(),
                                    U
                                },
                                xWrite: function(k, C, N, U) {
                                    le("xWrite");
                                    let W = ee[k], Z;
                                    try {
                                        W.sabView.set(x.heap8u().subarray(C, C + N)),
                                        Z = j("xWrite", k, N, Number(U));
                                    } catch (re) {
                                        d("xWrite(", arguments, ") failed:", re, W),
                                        Z = m.SQLITE_IOERR_WRITE;
                                    }
                                    return ae(),
                                    Z
                                }
                            }
                              , de = {
                                xAccess: function(k, C, N, U) {
                                    le("xAccess");
                                    let W = j("xAccess", x.cstrToJs(C));
                                    return x.poke(U, W ? 0 : 1, "i32"),
                                    ae(),
                                    0
                                },
                                xCurrentTime: function(k, C) {
                                    return x.poke(C, 24405875e-1 + new Date().getTime() / 864e5, "double"),
                                    0
                                },
                                xCurrentTimeInt64: function(k, C) {
                                    return x.poke(C, 24405875e-1 * 864e5 + new Date().getTime(), "i64"),
                                    0
                                },
                                xDelete: function(k, C, N) {
                                    le("xDelete");
                                    let U = j("xDelete", x.cstrToJs(C), N, !1);
                                    return ae(),
                                    U
                                },
                                xFullPathname: function(k, C, N, U) {
                                    return x.cstrncpy(U, C, N) < N ? 0 : m.SQLITE_CANTOPEN
                                },
                                xGetLastError: function(k, C, N) {
                                    return Y("OPFS xGetLastError() has nothing sensible to return."),
                                    0
                                },
                                xOpen: function(C, N, U, W, Z) {
                                    le("xOpen");
                                    let re = 0;
                                    N === 0 ? N = se() : typeof N == "number" && (m.sqlite3_uri_boolean(N, "opfs-unlock-asap", 0) && (re |= c.opfsFlags.OPFS_UNLOCK_ASAP),
                                    N = x.cstrToJs(N));
                                    let V = Object.create(null);
                                    V.fid = U,
                                    V.filename = N,
                                    V.sab = new SharedArrayBuffer(c.fileBufferSize),
                                    V.flags = W;
                                    let ye = j("xOpen", U, N, W, re);
                                    return ye || (V.readOnly && x.poke(Z, m.SQLITE_OPEN_READONLY, "i32"),
                                    ee[U] = V,
                                    V.sabView = c.sabFileBufView,
                                    V.sq3File = new R(U),
                                    V.sq3File.$pMethods = u.pointer,
                                    V.lockType = m.SQLITE_LOCK_NONE),
                                    ae(),
                                    ye
                                }
                            };
                            _ && (q.$xRandomness = _.$xRandomness,
                            q.$xSleep = _.$xSleep),
                            q.$xRandomness || (de.xRandomness = function(k, C, N) {
                                let U = x.heap8u()
                                  , W = 0;
                                for (; W < C; ++W)
                                    U[N + W] = Math.random() * 255e3 & 255;
                                return W
                            }
                            ),
                            q.$xSleep || (de.xSleep = function(k, C) {
                                return Atomics.wait(c.sabOPView, c.opIds.xSleep, 0, C),
                                0
                            }
                            ),
                            L.getResolvedPath = function(k, C) {
                                let N = new URL(k,"file://irrelevant").pathname;
                                return C ? N.split("/").filter(U=>!!U) : N
                            }
                            ,
                            L.getDirForFilename = async function(C, N=!1) {
                                let U = L.getResolvedPath(C, !0)
                                  , W = U.pop()
                                  , Z = L.rootDirectory;
                                for (let re of U)
                                    re && (Z = await Z.getDirectoryHandle(re, {
                                        create: !!N
                                    }));
                                return [Z, W]
                            }
                            ,
                            L.mkdir = async function(k) {
                                try {
                                    return await L.getDirForFilename(k + "/filepart", !0),
                                    !0
                                } catch {
                                    return !1
                                }
                            }
                            ,
                            L.entryExists = async function(k) {
                                try {
                                    let[C,N] = await L.getDirForFilename(k);
                                    return await C.getFileHandle(N),
                                    !0
                                } catch {
                                    return !1
                                }
                            }
                            ,
                            L.randomFilename = se,
                            L.registerVfs = (k=!1)=>x.exports.sqlite3_vfs_register(q.pointer, k ? 1 : 0),
                            L.treeList = async function() {
                                let k = async function N(U, W) {
                                    W.name = U.name,
                                    W.dirs = [],
                                    W.files = [];
                                    for await(let Z of U.values())
                                        if (Z.kind === "directory") {
                                            let re = Object.create(null);
                                            W.dirs.push(re),
                                            await N(Z, re);
                                        } else
                                            W.files.push(Z.name);
                                }
                                  , C = Object.create(null);
                                return await k(L.rootDirectory, C),
                                C
                            }
                            ,
                            L.rmfr = async function() {
                                let k = L.rootDirectory
                                  , C = {
                                    recurse: !0
                                };
                                for await(let N of k.values())
                                    k.removeEntry(N.name, C);
                            }
                            ,
                            L.unlink = async function(k, C=!1, N=!1) {
                                try {
                                    let[U,W] = await L.getDirForFilename(k, !1);
                                    return await U.removeEntry(W, {
                                        recursive: C
                                    }),
                                    !0
                                } catch (U) {
                                    if (N)
                                        throw new Error("unlink(",arguments[0],") failed: " + U.message,{
                                            cause: U
                                        });
                                    return !1
                                }
                            }
                            ,
                            L.traverse = async function(k) {
                                let C = {
                                    recursive: !0,
                                    directory: L.rootDirectory
                                };
                                typeof k == "function" && (k = {
                                    callback: k
                                }),
                                k = Object.assign(C, k || {}),
                                async function U(W, Z) {
                                    for await(let re of W.values()) {
                                        if (k.callback(re, W, Z) === !1)
                                            return !1;
                                        if (k.recursive && re.kind === "directory" && await U(re, Z + 1) === !1)
                                            break
                                    }
                                }(k.directory, 0);
                            }
                            ;
                            let we = async function(k, C) {
                                let[N,U] = await L.getDirForFilename(k, !0), Z = await (await N.getFileHandle(U, {
                                    create: !0
                                })).createSyncAccessHandle(), re = 0, V, ye = !1, ue = !1;
                                try {
                                    for (Z.truncate(0); (V = await C()) !== void 0; )
                                        V instanceof ArrayBuffer && (V = new Uint8Array(V)),
                                        re === 0 && V.byteLength >= 15 && (I.affirmDbHeader(V),
                                        ye = !0),
                                        Z.write(V, {
                                            at: re
                                        }),
                                        re += V.byteLength;
                                    if ((re < 512 || re % 512 !== 0) && f("Input size", re, "is not correct for an SQLite database."),
                                    !ye) {
                                        let E = new Uint8Array(20);
                                        Z.read(E, {
                                            at: 0
                                        }),
                                        I.affirmDbHeader(E);
                                    }
                                    return Z.write(new Uint8Array([1, 1]), {
                                        at: 18
                                    }),
                                    re
                                } catch (E) {
                                    throw await Z.close(),
                                    Z = void 0,
                                    await N.removeEntry(U).catch(()=>{}
                                    ),
                                    E
                                } finally {
                                    Z && await Z.close();
                                }
                            };
                            if (L.importDb = async function(k, C) {
                                if (C instanceof Function)
                                    return we(k, C);
                                C instanceof ArrayBuffer && (C = new Uint8Array(C)),
                                I.affirmIsDb(C);
                                let N = C.byteLength, [U,W] = await L.getDirForFilename(k, !0), Z, re, V = 0;
                                try {
                                    return Z = await (await U.getFileHandle(W, {
                                        create: !0
                                    })).createSyncAccessHandle(),
                                    Z.truncate(0),
                                    V = Z.write(C, {
                                        at: 0
                                    }),
                                    V != N && f("Expected to write " + N + " bytes but wrote " + V + "."),
                                    Z.write(new Uint8Array([1, 1]), {
                                        at: 18
                                    }),
                                    V
                                } catch (ye) {
                                    throw Z && (await Z.close(),
                                    Z = void 0),
                                    await U.removeEntry(W).catch(()=>{}
                                    ),
                                    ye
                                } finally {
                                    Z && await Z.close();
                                }
                            }
                            ,
                            t.oo1) {
                                let k = function(...C) {
                                    let N = t.oo1.DB.dbCtorHelper.normalizeArgs(...C);
                                    N.vfs = q.$zName,
                                    t.oo1.DB.dbCtorHelper.call(this, N);
                                };
                                k.prototype = Object.create(t.oo1.DB.prototype),
                                t.oo1.OpfsDb = k,
                                k.importDb = L.importDb,
                                t.oo1.DB.dbCtorHelper.setVfsPostOpenSql(q.pointer, function(C, N) {
                                    N.capi.sqlite3_busy_timeout(C, 1e4),
                                    N.capi.sqlite3_exec(C, ["pragma journal_mode=DELETE;", "pragma cache_size=-16384;"], 0, 0, 0);
                                });
                            }
                            let qe = function() {
                                let k = x.scopedAllocPush()
                                  , C = new R;
                                try {
                                    let N = C.pointer, U = m.SQLITE_OPEN_CREATE | m.SQLITE_OPEN_READWRITE | m.SQLITE_OPEN_MAIN_DB, W = x.scopedAlloc(8), Z = "/sanity/check/file" + se(8), re = x.scopedAllocCString(Z), V;
                                    if (c.s11n.serialize("This is \xE4 string."),
                                    V = c.s11n.deserialize(),
                                    J("deserialize() says:", V),
                                    V[0] !== "This is \xE4 string." && f("String d13n error."),
                                    de.xAccess(q.pointer, re, 0, W),
                                    V = x.peek(W, "i32"),
                                    J("xAccess(", Z, ") exists ?=", V),
                                    V = de.xOpen(q.pointer, re, N, U, W),
                                    J("open rc =", V, "state.sabOPView[xOpen] =", c.sabOPView[c.opIds.xOpen]),
                                    V !== 0) {
                                        d("open failed with code", V);
                                        return
                                    }
                                    de.xAccess(q.pointer, re, 0, W),
                                    V = x.peek(W, "i32"),
                                    V || f("xAccess() failed to detect file."),
                                    V = ce.xSync(C.pointer, 0),
                                    V && f("sync failed w/ rc", V),
                                    V = ce.xTruncate(C.pointer, 1024),
                                    V && f("truncate failed w/ rc", V),
                                    x.poke(W, 0, "i64"),
                                    V = ce.xFileSize(C.pointer, W),
                                    V && f("xFileSize failed w/ rc", V),
                                    J("xFileSize says:", x.peek(W, "i64")),
                                    V = ce.xWrite(C.pointer, re, 10, 1),
                                    V && f("xWrite() failed!");
                                    let ye = x.scopedAlloc(16);
                                    V = ce.xRead(C.pointer, ye, 6, 2),
                                    x.poke(ye + 6, 0);
                                    let ue = x.cstrToJs(ye);
                                    J("xRead() got:", ue),
                                    ue !== "sanity" && f("Unexpected xRead() value."),
                                    de.xSleep && (J("xSleep()ing before close()ing..."),
                                    de.xSleep(q.pointer, 2e3),
                                    J("waking up from xSleep()")),
                                    V = ce.xClose(N),
                                    J("xClose rc =", V, "sabOPView =", c.sabOPView),
                                    J("Deleting file:", Z),
                                    de.xDelete(q.pointer, re, 4660),
                                    de.xAccess(q.pointer, re, 0, W),
                                    V = x.peek(W, "i32"),
                                    V && f("Expecting 0 from xAccess(", Z, ") after xDelete()."),
                                    Y("End of OPFS sanity checks.");
                                } finally {
                                    C.dispose(),
                                    x.scopedAllocPop(k);
                                }
                            };
                            h.onmessage = function({data: k}) {
                                switch (k.type) {
                                case "opfs-unavailable":
                                    D(new Error(k.payload.join(" ")));
                                    break;
                                case "opfs-async-loaded":
                                    h.postMessage({
                                        type: "opfs-async-init",
                                        args: c
                                    });
                                    break;
                                case "opfs-async-inited":
                                    {
                                        if (F === !0)
                                            break;
                                        try {
                                            t.vfs.installVfs({
                                                io: {
                                                    struct: u,
                                                    methods: ce
                                                },
                                                vfs: {
                                                    struct: q,
                                                    methods: de
                                                }
                                            }),
                                            c.sabOPView = new Int32Array(c.sabOP),
                                            c.sabFileBufView = new Uint8Array(c.sabIO,0,c.fileBufferSize),
                                            c.sabS11nView = new Uint8Array(c.sabIO,c.sabS11nOffset,c.sabS11nSize),
                                            H(),
                                            n.sanityChecks && (Y("Running sanity checks because of opfs-sanity-check URL arg..."),
                                            qe()),
                                            $() ? navigator.storage.getDirectory().then(C=>{
                                                h.onerror = h._originalOnError,
                                                delete h._originalOnError,
                                                t.opfs = L,
                                                L.rootDirectory = C,
                                                J("End of OPFS sqlite3_vfs setup.", q),
                                                P();
                                            }
                                            ).catch(D) : P();
                                        } catch (C) {
                                            d(C),
                                            D(C);
                                        }
                                        break
                                    }
                                default:
                                    {
                                        let C = "Unexpected message from the OPFS async worker: " + JSON.stringify(k);
                                        d(C),
                                        D(new Error(C));
                                        break
                                    }
                                }
                            };
                        }
                        ))
                    };
                    r.defaultProxyUri = "sqlite3-opfs-async-proxy.js",
                    globalThis.sqlite3ApiBootstrap.initializersAsync.push(async i=>{
                        try {
                            let n = r.defaultProxyUri;
                            return i.scriptInfo.sqlite3Dir && (r.defaultProxyUri = i.scriptInfo.sqlite3Dir + n),
                            r().catch(s=>{
                                // hbi disable: this is faulty warning & poorly written code
                                // i.config.warn("Ignoring inability to install OPFS sqlite3_vfs:", s.message)
                            }
                            )
                        } catch (n) {
                            return i.config.error("installOpfsVfs() exception:", n),
                            Promise.reject(n)
                        }
                    }
                    );
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    var ce, de, we, qe, k, C, N, U, W, Z, re, V, nt, ue;
                    "use strict";
                    let r = t.util.toss
                      , i = t.util.toss3
                      , n = Object.create(null)
                      , s = t.capi
                      , p = t.util
                      , y = t.wasm
                      , O = 4096
                      , B = 512
                      , G = 4
                      , J = 8
                      , Y = B + G
                      , d = B
                      , f = Y
                      , m = O
                      , I = s.SQLITE_OPEN_MAIN_DB | s.SQLITE_OPEN_MAIN_JOURNAL | s.SQLITE_OPEN_SUPER_JOURNAL | s.SQLITE_OPEN_WAL
                      , x = ".opaque"
                      , S = ()=>Math.random().toString(36).slice(2)
                      , R = new TextDecoder
                      , z = new TextEncoder
                      , L = Object.assign(Object.create(null), {
                        name: "opfs-sahpool",
                        directory: void 0,
                        initialCapacity: 6,
                        clearOnInit: !1,
                        verbosity: 2
                    })
                      , $ = [t.config.error, t.config.warn, t.config.log]
                      , u = t.config.log
                      , q = t.config.warn
                      , F = t.config.error
                      , D = new Map
                      , P = E=>D.get(E)
                      , h = (E,g)=>{
                        g ? D.set(E, g) : D.delete(E);
                    }
                      , l = new Map
                      , _ = E=>l.get(E)
                      , c = (E,g)=>{
                        g ? l.set(E, g) : l.delete(E);
                    }
                      , w = {
                        xCheckReservedLock: function(E, g) {
                            let A = _(E);
                            return A.log("xCheckReservedLock"),
                            A.storeErr(),
                            y.poke32(g, 1),
                            0
                        },
                        xClose: function(E) {
                            let g = _(E);
                            g.storeErr();
                            let A = g.getOFileForS3File(E);
                            if (A)
                                try {
                                    g.log(`xClose ${A.path}`),
                                    g.mapS3FileToOFile(E, !1),
                                    A.sah.flush(),
                                    A.flags & s.SQLITE_OPEN_DELETEONCLOSE && g.deletePath(A.path);
                                } catch (T) {
                                    return g.storeErr(T, s.SQLITE_IOERR)
                                }
                            return 0
                        },
                        xDeviceCharacteristics: function(E) {
                            return s.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN
                        },
                        xFileControl: function(E, g, A) {
                            return s.SQLITE_NOTFOUND
                        },
                        xFileSize: function(E, g) {
                            let A = _(E);
                            A.log("xFileSize");
                            let M = A.getOFileForS3File(E).sah.getSize() - m;
                            return y.poke64(g, BigInt(M)),
                            0
                        },
                        xLock: function(E, g) {
                            let A = _(E);
                            A.log(`xLock ${g}`),
                            A.storeErr();
                            let T = A.getOFileForS3File(E);
                            return T.lockType = g,
                            0
                        },
                        xRead: function(E, g, A, T) {
                            let M = _(E);
                            M.storeErr();
                            let Q = M.getOFileForS3File(E);
                            M.log(`xRead ${Q.path} ${A} @ ${T}`);
                            try {
                                let X = Q.sah.read(y.heap8u().subarray(g, g + A), {
                                    at: m + Number(T)
                                });
                                return X < A ? (y.heap8u().fill(0, g + X, g + A),
                                s.SQLITE_IOERR_SHORT_READ) : 0
                            } catch (X) {
                                return M.storeErr(X, s.SQLITE_IOERR)
                            }
                        },
                        xSectorSize: function(E) {
                            return O
                        },
                        xSync: function(E, g) {
                            let A = _(E);
                            A.log(`xSync ${g}`),
                            A.storeErr();
                            let T = A.getOFileForS3File(E);
                            try {
                                return T.sah.flush(),
                                0
                            } catch (M) {
                                return A.storeErr(M, s.SQLITE_IOERR)
                            }
                        },
                        xTruncate: function(E, g) {
                            let A = _(E);
                            A.log(`xTruncate ${g}`),
                            A.storeErr();
                            let T = A.getOFileForS3File(E);
                            try {
                                return T.sah.truncate(m + Number(g)),
                                0
                            } catch (M) {
                                return A.storeErr(M, s.SQLITE_IOERR)
                            }
                        },
                        xUnlock: function(E, g) {
                            let A = _(E);
                            A.log("xUnlock");
                            let T = A.getOFileForS3File(E);
                            return T.lockType = g,
                            0
                        },
                        xWrite: function(E, g, A, T) {
                            let M = _(E);
                            M.storeErr();
                            let Q = M.getOFileForS3File(E);
                            M.log(`xWrite ${Q.path} ${A} ${T}`);
                            try {
                                let X = Q.sah.write(y.heap8u().subarray(g, g + A), {
                                    at: m + Number(T)
                                });
                                return A === X ? 0 : r("Unknown write() failure.")
                            } catch (X) {
                                return M.storeErr(X, s.SQLITE_IOERR)
                            }
                        }
                    }
                      , j = new s.sqlite3_io_methods;
                    j.$iVersion = 1,
                    t.vfs.installVfs({
                        io: {
                            struct: j,
                            methods: w
                        }
                    });
                    let H = {
                        xAccess: function(E, g, A, T) {
                            let M = P(E);
                            M.storeErr();
                            try {
                                let Q = M.getPath(g);
                                y.poke32(T, M.hasFilename(Q) ? 1 : 0);
                            } catch {
                                y.poke32(T, 0);
                            }
                            return 0
                        },
                        xCurrentTime: function(E, g) {
                            return y.poke(g, 24405875e-1 + new Date().getTime() / 864e5, "double"),
                            0
                        },
                        xCurrentTimeInt64: function(E, g) {
                            return y.poke(g, 24405875e-1 * 864e5 + new Date().getTime(), "i64"),
                            0
                        },
                        xDelete: function(E, g, A) {
                            let T = P(E);
                            T.log(`xDelete ${y.cstrToJs(g)}`),
                            T.storeErr();
                            try {
                                return T.deletePath(T.getPath(g)),
                                0
                            } catch (M) {
                                return T.storeErr(M),
                                s.SQLITE_IOERR_DELETE
                            }
                        },
                        xFullPathname: function(E, g, A, T) {
                            return y.cstrncpy(T, g, A) < A ? 0 : s.SQLITE_CANTOPEN
                        },
                        xGetLastError: function(E, g, A) {
                            let T = P(E)
                              , M = T.popErr();
                            if (T.log(`xGetLastError ${g} e =`, M),
                            M) {
                                let Q = y.scopedAllocPush();
                                try {
                                    let[X,ne] = y.scopedAllocCString(M.message, !0);
                                    y.cstrncpy(A, X, g),
                                    ne > g && y.poke8(A + g - 1, 0);
                                } catch {
                                    return s.SQLITE_NOMEM
                                } finally {
                                    y.scopedAllocPop(Q);
                                }
                            }
                            return M ? M.sqlite3Rc || s.SQLITE_IOERR : 0
                        },
                        xOpen: function(g, A, T, M, Q) {
                            let X = P(g);
                            try {
                                X.log(`xOpen ${y.cstrToJs(A)} ${M}`);
                                let ne = A && y.peek8(A) ? X.getPath(A) : S()
                                  , he = X.getSAHForPath(ne);
                                !he && M & s.SQLITE_OPEN_CREATE && (X.getFileCount() < X.getCapacity() ? (he = X.nextAvailableSAH(),
                                X.setAssociatedPath(he, ne, M)) : r("SAH pool is full. Cannot create file", ne)),
                                he || r("file not found:", ne);
                                let ve = {
                                    path: ne,
                                    flags: M,
                                    sah: he
                                };
                                X.mapS3FileToOFile(T, ve),
                                ve.lockType = s.SQLITE_LOCK_NONE;
                                let tt = new s.sqlite3_file(T);
                                return tt.$pMethods = j.pointer,
                                tt.dispose(),
                                y.poke32(Q, M),
                                0
                            } catch (ne) {
                                return X.storeErr(ne),
                                s.SQLITE_CANTOPEN
                            }
                        }
                    }
                      , se = function(E) {
                        t.capi.sqlite3_vfs_find(E) && i("VFS name is already registered:", E);
                        let g = new s.sqlite3_vfs
                          , A = s.sqlite3_vfs_find(null)
                          , T = A ? new s.sqlite3_vfs(A) : null;
                        return g.$iVersion = 2,
                        g.$szOsFile = s.sqlite3_file.structInfo.sizeof,
                        g.$mxPathname = B,
                        g.addOnDispose(g.$zName = y.allocCString(E), ()=>h(g.pointer, 0)),
                        T && (g.$xRandomness = T.$xRandomness,
                        g.$xSleep = T.$xSleep,
                        T.dispose()),
                        !g.$xRandomness && !H.xRandomness && (H.xRandomness = function(M, Q, X) {
                            let ne = y.heap8u()
                              , he = 0;
                            for (; he < Q; ++he)
                                ne[X + he] = Math.random() * 255e3 & 255;
                            return he
                        }
                        ),
                        !g.$xSleep && !H.xSleep && (H.xSleep = (M,Q)=>0),
                        t.vfs.installVfs({
                            vfs: {
                                struct: g,
                                methods: H
                            }
                        }),
                        g
                    };
                    class ee {
                        constructor(g=Object.create(null)) {
                            Ee(this, V);
                            Ht(this, "vfsDir");
                            Ee(this, ce, void 0);
                            Ee(this, de, void 0);
                            Ee(this, we, void 0);
                            Ee(this, qe, new Map);
                            Ee(this, k, new Map);
                            Ee(this, C, new Set);
                            Ee(this, N, new Map);
                            Ee(this, U, new Uint8Array(Y));
                            Ee(this, W, void 0);
                            Ee(this, Z, void 0);
                            Ee(this, re, void 0);
                            Ae(this, re, g.verbosity ?? L.verbosity),
                            this.vfsName = g.name || L.name,
                            Ae(this, Z, se(this.vfsName)),
                            h(K(this, Z).pointer, this),
                            this.vfsDir = g.directory || "." + this.vfsName,
                            Ae(this, W, new DataView(K(this, U).buffer,K(this, U).byteOffset)),
                            this.isReady = this.reset(!!(g.clearOnInit ?? L.clearOnInit)).then(()=>{
                                if (this.$error)
                                    throw this.$error;
                                return this.getCapacity() ? Promise.resolve(void 0) : this.addCapacity(g.initialCapacity || L.initialCapacity)
                            }
                            );
                        }
                        log(...g) {
                            rt(this, V, nt).call(this, 2, ...g);
                        }
                        warn(...g) {
                            rt(this, V, nt).call(this, 1, ...g);
                        }
                        error(...g) {
                            rt(this, V, nt).call(this, 0, ...g);
                        }
                        getVfs() {
                            return K(this, Z)
                        }
                        getCapacity() {
                            return K(this, qe).size
                        }
                        getFileCount() {
                            return K(this, k).size
                        }
                        getFileNames() {
                            let g = []
                              , A = K(this, k).keys();
                            for (let T of A)
                                g.push(T);
                            return g
                        }
                        async addCapacity(g) {
                            for (let A = 0; A < g; ++A) {
                                let T = S()
                                  , Q = await (await K(this, de).getFileHandle(T, {
                                    create: !0
                                })).createSyncAccessHandle();
                                K(this, qe).set(Q, T),
                                this.setAssociatedPath(Q, "", 0);
                            }
                            return this.getCapacity()
                        }
                        async reduceCapacity(g) {
                            let A = 0;
                            for (let T of Array.from(K(this, C))) {
                                if (A === g || this.getFileCount() === this.getCapacity())
                                    break;
                                let M = K(this, qe).get(T);
                                T.close(),
                                await K(this, de).removeEntry(M),
                                K(this, qe).delete(T),
                                K(this, C).delete(T),
                                ++A;
                            }
                            return A
                        }
                        releaseAccessHandles() {
                            for (let g of K(this, qe).keys())
                                g.close();
                            K(this, qe).clear(),
                            K(this, k).clear(),
                            K(this, C).clear();
                        }
                        async acquireAccessHandles(g) {
                            let A = [];
                            for await(let[T,M] of K(this, de))
                                M.kind === "file" && A.push([T, M]);
                            return Promise.all(A.map(async([T,M])=>{
                                try {
                                    let Q = await M.createSyncAccessHandle();
                                    if (K(this, qe).set(Q, T),
                                    g)
                                        Q.truncate(m),
                                        this.setAssociatedPath(Q, "", 0);
                                    else {
                                        let X = this.getAssociatedPath(Q);
                                        X ? K(this, k).set(X, Q) : K(this, C).add(Q);
                                    }
                                } catch (Q) {
                                    throw this.storeErr(Q),
                                    this.releaseAccessHandles(),
                                    Q
                                }
                            }
                            ))
                        }
                        getAssociatedPath(g) {
                            g.read(K(this, U), {
                                at: 0
                            });
                            let A = K(this, W).getUint32(d);
                            if (K(this, U)[0] && (A & s.SQLITE_OPEN_DELETEONCLOSE || !(A & I)))
                                return q(`Removing file with unexpected flags ${A.toString(16)}`, K(this, U)),
                                this.setAssociatedPath(g, "", 0),
                                "";
                            let T = new Uint32Array(J / 4);
                            g.read(T, {
                                at: f
                            });
                            let M = this.computeDigest(K(this, U));
                            if (T.every((Q,X)=>Q === M[X])) {
                                let Q = K(this, U).findIndex(X=>X === 0);
                                return Q === 0 && g.truncate(m),
                                Q ? R.decode(K(this, U).subarray(0, Q)) : ""
                            } else
                                return q("Disassociating file with bad digest."),
                                this.setAssociatedPath(g, "", 0),
                                ""
                        }
                        setAssociatedPath(g, A, T) {
                            let M = z.encodeInto(A, K(this, U));
                            B <= M.written + 1 && r("Path too long:", A),
                            K(this, U).fill(0, M.written, B),
                            K(this, W).setUint32(d, T);
                            let Q = this.computeDigest(K(this, U));
                            g.write(K(this, U), {
                                at: 0
                            }),
                            g.write(Q, {
                                at: f
                            }),
                            g.flush(),
                            A ? (K(this, k).set(A, g),
                            K(this, C).delete(g)) : (g.truncate(m),
                            K(this, C).add(g));
                        }
                        computeDigest(g) {
                            let A = 3735928559
                              , T = 1103547991;
                            for (let M of g)
                                A = 31 * A + M * 307,
                                T = 31 * T + M * 307;
                            return new Uint32Array([A >>> 0, T >>> 0])
                        }
                        async reset(g) {
                            await this.isReady;
                            let A = await navigator.storage.getDirectory(), T, M;
                            for (let Q of this.vfsDir.split("/"))
                                Q && (T = A,
                                A = await A.getDirectoryHandle(Q, {
                                    create: !0
                                }));
                            return Ae(this, ce, A),
                            Ae(this, we, T),
                            Ae(this, de, await K(this, ce).getDirectoryHandle(x, {
                                create: !0
                            })),
                            this.releaseAccessHandles(),
                            this.acquireAccessHandles(g)
                        }
                        getPath(g) {
                            return y.isPtr(g) && (g = y.cstrToJs(g)),
                            (g instanceof URL ? g : new URL(g,"file://localhost/")).pathname
                        }
                        deletePath(g) {
                            let A = K(this, k).get(g);
                            return A && (K(this, k).delete(g),
                            this.setAssociatedPath(A, "", 0)),
                            !!A
                        }
                        storeErr(g, A) {
                            return g && (g.sqlite3Rc = A || s.SQLITE_IOERR,
                            this.error(g)),
                            this.$error = g,
                            A
                        }
                        popErr() {
                            let g = this.$error;
                            return this.$error = void 0,
                            g
                        }
                        nextAvailableSAH() {
                            let[g] = K(this, C).keys();
                            return g
                        }
                        getOFileForS3File(g) {
                            return K(this, N).get(g)
                        }
                        mapS3FileToOFile(g, A) {
                            A ? (K(this, N).set(g, A),
                            c(g, this)) : (K(this, N).delete(g),
                            c(g, !1));
                        }
                        hasFilename(g) {
                            return K(this, k).has(g)
                        }
                        getSAHForPath(g) {
                            return K(this, k).get(g)
                        }
                        async removeVfs() {
                            if (!K(this, Z).pointer || !K(this, de))
                                return !1;
                            s.sqlite3_vfs_unregister(K(this, Z).pointer),
                            K(this, Z).dispose();
                            try {
                                this.releaseAccessHandles(),
                                await K(this, ce).removeEntry(x, {
                                    recursive: !0
                                }),
                                Ae(this, de, void 0),
                                await K(this, we).removeEntry(K(this, ce).name, {
                                    recursive: !0
                                }),
                                Ae(this, ce, Ae(this, we, void 0));
                            } catch (g) {
                                t.config.error(this.vfsName, "removeVfs() failed:", g);
                            }
                            return !0
                        }
                        exportFile(g) {
                            let A = K(this, k).get(g) || r("File not found:", g)
                              , T = A.getSize() - m
                              , M = new Uint8Array(T > 0 ? T : 0);
                            if (T > 0) {
                                let Q = A.read(M, {
                                    at: m
                                });
                                Q != T && r("Expected to read " + T + " bytes but read " + Q + ".");
                            }
                            return M
                        }
                        async importDbChunked(g, A) {
                            let T = K(this, k).get(g) || this.nextAvailableSAH() || r("No available handles to import to.");
                            T.truncate(0);
                            let M = 0, Q, X = !1, ne = !1;
                            try {
                                for (; (Q = await A()) !== void 0; )
                                    Q instanceof ArrayBuffer && (Q = new Uint8Array(Q)),
                                    M === 0 && Q.byteLength >= 15 && (p.affirmDbHeader(Q),
                                    X = !0),
                                    T.write(Q, {
                                        at: m + M
                                    }),
                                    M += Q.byteLength;
                                if ((M < 512 || M % 512 !== 0) && r("Input size", M, "is not correct for an SQLite database."),
                                !X) {
                                    let he = new Uint8Array(20);
                                    T.read(he, {
                                        at: 0
                                    }),
                                    p.affirmDbHeader(he);
                                }
                                T.write(new Uint8Array([1, 1]), {
                                    at: m + 18
                                });
                            } catch (he) {
                                throw this.setAssociatedPath(T, "", 0),
                                he
                            }
                            return this.setAssociatedPath(T, g, s.SQLITE_OPEN_MAIN_DB),
                            M
                        }
                        importDb(g, A) {
                            if (A instanceof ArrayBuffer)
                                A = new Uint8Array(A);
                            else if (A instanceof Function)
                                return this.importDbChunked(g, A);
                            let T = K(this, k).get(g) || this.nextAvailableSAH() || r("No available handles to import to.")
                              , M = A.byteLength;
                            (M < 512 || M % 512 != 0) && r("Byte array size is invalid for an SQLite db.");
                            let Q = "SQLite format 3";
                            for (let ne = 0; ne < Q.length; ++ne)
                                Q.charCodeAt(ne) !== A[ne] && r("Input does not contain an SQLite database header.");
                            let X = T.write(A, {
                                at: m
                            });
                            return X != M ? (this.setAssociatedPath(T, "", 0),
                            r("Expected to write " + M + " bytes but wrote " + X + ".")) : (T.write(new Uint8Array([1, 1]), {
                                at: m + 18
                            }),
                            this.setAssociatedPath(T, g, s.SQLITE_OPEN_MAIN_DB)),
                            X
                        }
                    }
                    ce = new WeakMap,
                    de = new WeakMap,
                    we = new WeakMap,
                    qe = new WeakMap,
                    k = new WeakMap,
                    C = new WeakMap,
                    N = new WeakMap,
                    U = new WeakMap,
                    W = new WeakMap,
                    Z = new WeakMap,
                    re = new WeakMap,
                    V = new WeakSet,
                    nt = function(g, ...A) {
                        K(this, re) > g && $[g](this.vfsName + ":", ...A);
                    }
                    ;
                    class ie {
                        constructor(g) {
                            Ee(this, ue, void 0);
                            Ae(this, ue, g),
                            this.vfsName = g.vfsName;
                        }
                        async addCapacity(g) {
                            return K(this, ue).addCapacity(g)
                        }
                        async reduceCapacity(g) {
                            return K(this, ue).reduceCapacity(g)
                        }
                        getCapacity() {
                            return K(this, ue).getCapacity(K(this, ue))
                        }
                        getFileCount() {
                            return K(this, ue).getFileCount()
                        }
                        getFileNames() {
                            return K(this, ue).getFileNames()
                        }
                        async reserveMinimumCapacity(g) {
                            let A = K(this, ue).getCapacity();
                            return A < g ? K(this, ue).addCapacity(g - A) : A
                        }
                        exportFile(g) {
                            return K(this, ue).exportFile(g)
                        }
                        importDb(g, A) {
                            return K(this, ue).importDb(g, A)
                        }
                        async wipeFiles() {
                            return K(this, ue).reset(!0)
                        }
                        unlink(g) {
                            return K(this, ue).deletePath(g)
                        }
                        async removeVfs() {
                            return K(this, ue).removeVfs()
                        }
                    }
                    ue = new WeakMap;
                    let le = async()=>{
                        let E = await navigator.storage.getDirectory()
                          , g = ".opfs-sahpool-sync-check-" + S()
                          , M = (await (await E.getFileHandle(g, {
                            create: !0
                        })).createSyncAccessHandle()).close();
                        return await M,
                        await E.removeEntry(g),
                        M?.then && r("The local OPFS API is too old for opfs-sahpool:", "it has an async FileSystemSyncAccessHandle.close() method."),
                        !0
                    }
                      , ae = 0;
                    t.installOpfsSAHPoolVfs = async function(E=Object.create(null)) {
                        let g = E.name || L.name;
                        return n[g] ? n[g] : !globalThis.FileSystemHandle || !globalThis.FileSystemDirectoryHandle || !globalThis.FileSystemFileHandle || !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle || !navigator?.storage?.getDirectory ? n[g] = Promise.reject(new Error("Missing required OPFS APIs.")) : n[g] = le().then(async function() {
                            if (E.$testThrowInInit)
                                throw E.$testThrowInInit;
                            let A = new ee(E);
                            return A.isReady.then(async()=>{
                                let T = new ie(A);
                                if (t.oo1) {
                                    let M = t.oo1
                                      , Q = A.getVfs()
                                      , X = function(...ne) {
                                        let he = M.DB.dbCtorHelper.normalizeArgs(...ne);
                                        he.vfs = Q.$zName,
                                        M.DB.dbCtorHelper.call(this, he);
                                    };
                                    X.prototype = Object.create(M.DB.prototype),
                                    T.OpfsSAHPoolDb = X,
                                    M.DB.dbCtorHelper.setVfsPostOpenSql(Q.pointer, function(ne, he) {
                                        he.capi.sqlite3_exec(ne, ["pragma journal_mode=DELETE;", "pragma cache_size=-16384;"], 0, 0, 0);
                                    });
                                }
                                return A.log("VFS initialized."),
                                T
                            }
                            ).catch(async T=>(await A.removeVfs().catch(()=>{}
                            ),
                            T))
                        }).catch(A=>n[g] = Promise.reject(A))
                    };
                }),
                typeof e < "u") {
                    let t = Object.assign(Object.create(null), {
                        exports: typeof b > "u" ? e.asm : b,
                        memory: e.wasmMemory
                    }, globalThis.sqlite3ApiConfig || {});
                    globalThis.sqlite3ApiConfig = t;
                    let r;
                    try {
                        r = globalThis.sqlite3ApiBootstrap();
                    } catch (i) {
                        throw console.error("sqlite3ApiBootstrap() error:", i),
                        i
                    } finally {
                        delete globalThis.sqlite3ApiBootstrap,
                        delete globalThis.sqlite3ApiConfig;
                    }
                    e.sqlite3 = r;
                } else
                    console.warn("This is not running in an Emscripten module context, so", "globalThis.sqlite3ApiBootstrap() is _not_ being called due to lack", "of config info for the WASM environment.", "It must be called manually.");
            }),
            _e.ready
        }
    }
    )();
    typeof exports == "object" && typeof module == "object" ? module.exports = $e : typeof define == "function" && define.amd && define([], ()=>$e);
    (function() {
        let me = $e;
        if (!me)
            throw new Error("Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build.");
        let _e = globalThis.sqlite3InitModuleState = Object.assign(Object.create(null), {
            moduleScript: globalThis?.document?.currentScript,
            isWorker: typeof WorkerGlobalScope < "u",
            location: globalThis.location,
            urlParams: globalThis?.location?.href ? new URL(globalThis.location.href).searchParams : new URLSearchParams
        });
        if (_e.debugModule = _e.urlParams.has("sqlite3.debugModule") ? (...o)=>console.warn("sqlite3.debugModule:", ...o) : ()=>{}
        ,
        _e.urlParams.has("sqlite3.dir"))
            _e.sqlite3Dir = _e.urlParams.get("sqlite3.dir") + "/";
        else if (_e.moduleScript) {
            let o = _e.moduleScript.src.split("/");
            o.pop(),
            _e.sqlite3Dir = o.join("/") + "/";
        }
        if (globalThis.sqlite3InitModule = function o(...Ie) {
            return me(...Ie).then(Te=>{
                let Fe = Te.sqlite3;
                Fe.scriptInfo = _e,
                o.__isUnderTest && (Fe.__isUnderTest = !0);
                let Ke = Fe.asyncPostInit;
                return delete Fe.asyncPostInit,
                Ke()
            }
            ).catch(Te=>{
                throw console.error("Exception loading sqlite3 module:", Te),
                Te
            }
            )
        }
        ,
        globalThis.sqlite3InitModule.ready = me.ready,
        globalThis.sqlite3InitModuleState.moduleScript) {
            let o = globalThis.sqlite3InitModuleState
              , Ie = o.moduleScript.src.split("/");
            Ie.pop(),
            o.scriptDir = Ie.join("/") + "/";
        }
        return _e.debugModule("sqlite3InitModuleState =", _e),
        typeof exports == "object" && typeof module == "object" ? module.exports = $e : typeof exports == "object" && (exports.sqlite3InitModule = $e),
        globalThis.sqlite3InitModule
    }
    )();
}
)();



module.exports = {
	CodeMirror,
	Dumper,
	SQLite,
	sqlite3InitModule,
};
