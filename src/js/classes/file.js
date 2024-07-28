
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

	static openLocal(url) {
		let parts = url.slice(url.lastIndexOf("/") + 1),
			[ name, kind ] = parts.split("."),
			file = new karaqu.File({ name, kind });
		// return promise
		return new Promise((resolve, reject) => {
			// fetch item and transform it to a "fake" file
			fetch(url)
				.then(resp => resp.blob())
				.then(blob => {
					// here the file as a blob
					file.blob = blob;

					switch (kind) {
						case "db":
							resolve(file);
							break;
						case "sql":
							let reader = new FileReader();
							reader.addEventListener("load", () => {
								// this will then display a text file
								file.data = reader.result;
								resolve(file);
							}, false);
							reader.readAsText(blob);
							break;
					}
				})
				.catch(err => reject(err));
		});
	}
}
