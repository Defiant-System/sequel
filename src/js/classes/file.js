
class File {
	constructor(fsFile) {
		// save reference to original FS file
		this._file = fsFile || new karaqu.File({ kind: "db" });
		//console.log(fsFile);
		
		let db = new sqlite3.oo1.DB();
		switch (this._file.kind) {
			case "sql":
				this.database = new SQLite(this._file.base, this._file.path, sqlite3.capi, db);
				this.database.execute(this._file.data);
				this.database.gatherTables();
				this.database.query = "";
				break;
			case "db":
				if (this._file.data) {
					sqlite3.capi.sqlite3_deserialize(
						db.pointer,
						"main",
						sqlite3.wasm.allocFromTypedArray(this._file.data),
						this._file.data.length,
						this._file.data.length,
						sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
					);
				}
				this.database = new SQLite(this._file.base, this._file.path, sqlite3.capi, db);
				this.database.gatherTables();
				break;
		}
	}

	get file() {
		return this._file;
	}

	toBlob(opt={}) {
		let kind = opt.kind || this.kind,
			type = karaqu.File.getMime(kind),
			data;
		// console.log( type );
		switch (opt.kind) {
			case "sql":
				data = Dumper.toSql(APP.activeFile.database);
				break;
			case "db":
				data = this.database.capi.sqlite3_js_db_export(this.database.db.pointer);
				break;
		}
		return new Blob([data], { type });
	}

	static openLocal(url) {
		let parts = url.slice(url.lastIndexOf("/") + 1),
			[ name, kind ] = parts.split("."),
			fsFile = new karaqu.File({ name, kind }),
			opt = {};

		if (kind === "db") opt.responseType = "arrayBuffer";

		// return promise
		return new Promise((resolve, reject) => {
			// fetch item and transform it to a "fake" file
			fetch(url, opt)
				.then(async resp => {

					switch (kind) {
						case "db":
							let buf = await resp.arrayBuffer();
							fsFile.data = new Uint8Array(buf);
							resolve(new File(fsFile));
							break;
						case "sql":
							// here the file as a blob
							fsFile.blob = await resp.blob();

							let reader = new FileReader();
							reader.addEventListener("load", () => {
								// this will then display a text file
								fsFile.data = reader.result;
								resolve(new File(fsFile));
							}, false);
							reader.readAsText(fsFile.blob);
							break;
					}
				})
				.catch(err => reject(err));
		});
	}
}
