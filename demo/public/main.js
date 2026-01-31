document.addEventListener('DOMContentLoaded', function() {
	const input = document.getElementById('urlInput');
	const btn = document.getElementById('goBtn');
	const status = document.getElementById('status');

	function setStatus(msg, err) {
		if (!status) return;
		status.textContent = msg;
		status.className = 'status' + (err ? ' error' : '');
	}

	btn.addEventListener('click', () => {
		const val = input.value.trim();
		if (!val) return setStatus('Please enter a URL', true);
		try {
			let target = val;
			
			if (!target.includes('.')) {
				target = "https://search.brave.com/search?q=" + encodeURIComponent(target)
			} else if (!target.startsWith("http://") && !target.startsWith("https://")) {
				target = "https://" + target
			}
			
			setStatus('Opening site: ' + target);
			window.location.href = scramjet.encodeUrl(target);
			window.frameElement.removeAttribute("srcdoc");

		} catch (e) {
			setStatus('Invalid URL', true);
		}
	});
});
