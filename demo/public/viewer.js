document.addEventListener('DOMContentLoaded', function() {
	if (window.lucide) lucide.createIcons();

	var frame = document.getElementById('frame');
	var bar = document.getElementById('stat');
	var input = document.getElementById('url');
	var back = document.getElementById('back');
	var next = document.getElementById('next');
	var redo = document.getElementById('redo');
	var open = document.getElementById('open');

	var history = [''];
	var pos = 0;

	function navigate(val, save) {

		frame.removeAttribute("srcdoc")
		if (!val) {
			frame.src = 'about:blank';
			input.value = '';
			if (save && history[pos] !== '') {
				history.splice(pos + 1);
				history.push('');
				pos = history.length - 1;
			}
			updateNav();
			return;
		}

		var target = val.indexOf('://') !== -1 ? val : 'https://' + val;
		var encoded = btoa(target);

		frame.src = '/proxy?url=' + encoded;
		input.value = target;

		if (save) {
			if (pos >= 0 && history[pos] === target) return;
			history.splice(pos + 1);
			history.push(target);
			pos = history.length - 1;
		}

		updateNav();
	}

	function updateNav() {
		back.disabled = pos <= 0;
		next.disabled = pos >= history.length - 1;
	}

	window.set = function(url) {
		navigate(url, true);
	};

	input.addEventListener('keydown', function(e) {
		if (e.key === 'Enter') navigate(input.value, true);
	});

	back.addEventListener('click', function() {
		if (pos > 0) {
			pos--;
			navigate(history[pos], false);
		}
	});

	next.addEventListener('click', function() {
		if (pos < history.length - 1) {
			pos++;
			navigate(history[pos], false);
		}
	});

	redo.addEventListener('click', function() {
		if (frame.src && frame.src !== 'about:blank') {
			frame.src = frame.src;
		}
	});

	open.addEventListener('click', function() {
		if (input.value) {
			var target = input.value.indexOf('://') !== -1 ? input.value : 'https://' + input.value;
			window.open('/proxy?url=' + btoa(target), '_blank');
		}
	});

	frame.addEventListener('load', function() {
		try {
			var win = frame.contentWindow;
			if (win && win.document && win.document.title) {
				bar.textContent = win.document.title;
			} else {
				bar.textContent = '';
			}
		} catch (e) {
			bar.textContent = '';
		}
	});

	var start = new URLSearchParams(location.search).get('url');
	if (start) {
		try {
			navigate(atob(start), true);
		} catch (e) {
			showWelcome();
		}
	} else {
		showWelcome();
	}

	function showWelcome() {
		var welcomeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head>
    <body style="background:#fff; font-family:sans-serif; height:100vh; margin:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
      <h1 style="color:#111; margin-bottom:10px; font-weight: 800; font-size: 2.5rem; letter-spacing: -1px;">this is a really cool proccy u should use</h1>
      <p style="color:#666; margin-bottom: 30px;">Enter a URL in the bar above to get started.</p>
      <div style="display: flex; gap: 12px;">
        <button onclick="parent.set('https://google.com')" style="background:#000; color:#fff; font-weight:bold; border:none; padding:12px 24px; border-radius:12px; cursor:pointer; font-family:inherit;">try google</button>
        <button onclick="parent.set('https://github.com')" style="background:#f1f1f1; color:#000; font-weight:bold; border:none; padding:12px 24px; border-radius:12px; cursor:pointer; font-family:inherit;">try github</button>
      </div>
    </body></html>`;
		frame.srcdoc = welcomeHtml;
		input.value = '';
		history = [''];
		pos = 0;
		updateNav();
	}
});
