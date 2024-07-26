
class File {
	constructor(fsFile, el) {
		// save reference to original FS file
		this._file = fsFile || new karaqu.File({ kind: "txt" });

		switch (this.kind) {
			case "sql":
				break;
			case "db":
				break;
		}
	}

	toBlob(opt={}) {

	}

	static openLocal() {
		return 123;
	}
}
