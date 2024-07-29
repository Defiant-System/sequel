
let Timer = {
	start() {
		this.started = performance.now();
	},
	finish() {
		let elapsed = performance.now() - this.started;
		return Math.round(elapsed);
	}
};
