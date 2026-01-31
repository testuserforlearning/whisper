document.addEventListener('DOMContentLoaded', function() {
	if (window.lucide) lucide.createIcons();

	var frame = document.getElementById('iframe');
	var bar = document.getElementById('stat');
	var input = document.getElementById('url');
	var back = document.getElementById('back');
	var next = document.getElementById('next');
	var redo = document.getElementById('redo');
	var open = document.getElementById('open');
	var tabsContainer = document.getElementById('tabs');
	var newTabBtn = document.getElementById('new-tab');

	var tabs = [{
		id: 0,
		title: 'Home',
		url: '',
		history: [''],
		pos: 0
	}];
	var activeTabId = 0;
	var tabIdCounter = 1;

	function updateTabsUI() {
		tabsContainer.innerHTML = '';
		
		tabs.forEach(tab => {
			var tabElement = document.createElement('div');
			tabElement.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
			tabElement.setAttribute('data-tab-id', tab.id);
			
			var titleElement = document.createElement('span');
			titleElement.className = 'tab-title';
			titleElement.textContent = tab.title;
			
			var closeElement = document.createElement('button');
			closeElement.className = 'tab-close';
			closeElement.setAttribute('data-tab-id', tab.id);
			closeElement.innerHTML = '<i data-lucide="x"></i>';
			
			tabElement.appendChild(titleElement);
			tabElement.appendChild(closeElement);
			
			tabElement.addEventListener('click', function(e) {
				if (!e.target.classList.contains('tab-close')) {
					switchToTab(tab.id);
				}
			});
			
			closeElement.addEventListener('click', function(e) {
				e.stopPropagation();
				closeTab(tab.id);
			});
			
			tabsContainer.appendChild(tabElement);
		});
		
		lucide.createIcons();
	}

	lucide.createIcons();

	function switchToTab(tabId) {
		var currentTab = tabs.find(t => t.id === activeTabId);
		var newTab = tabs.find(t => t.id === tabId);
		
		if (currentTab) {
			currentTab.url = input.value;
			currentTab.history = history;
			currentTab.pos = pos;
		}
		
		if (newTab) {
			activeTabId = tabId;
			history = newTab.history;
			pos = newTab.pos;
			input.value = newTab.url;
			
			if (newTab.url) {
				navigate(newTab.url, false);
			} else {
				showWelcome();
			}
			updateTabsUI();
		}
	}

	function closeTab(tabId) {
		if (tabs.length <= 1) return;
		
		var tabIndex = tabs.findIndex(t => t.id === tabId);
		var tabToClose = tabs[tabIndex];
		
		if (tabToClose.id === activeTabId) {
			var newActiveTab = tabs[Math.max(0, tabIndex - 1)];
			switchToTab(newActiveTab.id);
		}
		
		tabs = tabs.filter(t => t.id !== tabId);
		updateTabsUI();
		lucide.createIcons();
	}

	function createNewTab() {
		var newTab = {
			id: tabIdCounter++,
			title: 'Home',
			url: '',
			history: [''],
			pos: 0
		};
		
		tabs.push(newTab);
		switchToTab(newTab.id);
	}

	function updateTabTitle(title) {
		var currentTab = tabs.find(t => t.id === activeTabId);
		if (currentTab) {
			currentTab.title = title || 'New Tab';
			updateTabsUI();
		}
	}

	var history = [''];
	var pos = 0;

	function navigate(val, save) {
		frame.removeAttribute("srcdoc");
		if (!val) {
			frame.src = 'about:blank';
			input.value = '';
			updateTabTitle('New Tab');
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

	newTabBtn.addEventListener('click', createNewTab);

	if (frame) {
		frame.addEventListener('load', function() {
			try {
				var win = frame.contentWindow;
				if (win && win.document && win.document.title) {
					updateTabTitle(win.document.title);
				}
			} catch (e) {}
		});
	}

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
		var welcomeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" />
		<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500&display=swap" rel="stylesheet">
		<style>
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
			}
			
			body {
				background: #1c1c1d;
				font-family: 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				height: 100vh;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				color: #bdc3c7;
				overflow: hidden;
				position: relative;
			}
			
			.wave-top {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 200px;
				background: url('/landing/waves-top.svg') no-repeat top center;
				background-size: cover;
				opacity: 0.3;
				z-index: 1;
			}
			
			.wave-bottom {
				position: absolute;
				bottom: 0;
				left: 0;
				width: 100%;
				height: 225px;
				background: url('/landing/waves-bottom.svg') no-repeat bottom center;
				background-size: cover;
				opacity: 0.3;
				z-index: 1;
			}
			
			.content {
				position: relative;
				z-index: 2;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
			}
			
			.clock-container {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
			}
			
			.time {
				font-size: 8rem;
				font-weight: 300;
				letter-spacing: -2px;
				color: #ffffff;
				line-height: 1;
				font-family: 'Rubik', sans-serif;
			}
			
			.colon {
				font-size: 6rem;
				font-weight: 300;
				color: #666666;
				animation: blink 2s infinite;
				line-height: 1;
				font-family: 'Rubik', sans-serif;
			}
			
			.period {
				font-size: 1.5rem;
				font-weight: 400;
				color: #666666;
				margin-left: 8px;
				align-self: flex-end;
				margin-bottom: 20px;
				font-family: 'Rubik', sans-serif;
			}
			
			@keyframes blink {
				0%, 50% { opacity: 1; }
				51%, 100% { opacity: 0.3; }
			}
		</style></head>
		<body>
			<div class="wave-top"></div>
			<div class="content">
				<div class="clock-container">
					<span class="time" id="hours">11</span>
					<span class="colon">:</span>
					<span class="time" id="minutes">57</span>
					<span class="period" id="period">PM</span>
				</div>
			</div>
			<div class="wave-bottom"></div>
			
			<script>
				function updateClock() {
					const now = new Date();
					let hours = now.getHours();
					const minutes = now.getMinutes();
					const period = hours >= 12 ? 'PM' : 'AM';
					
					hours = hours % 12 || 12;
					
					document.getElementById('hours').textContent = String(hours).padStart(2, '0');
					document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
					document.getElementById('period').textContent = period;
				}
				
				updateClock();
				setInterval(updateClock, 1000);
			</script>
		</body></html>`;
		frame.srcdoc = welcomeHtml;
		input.value = '';
		history = [''];
		pos = 0;
		updateNav();
		updateTabTitle('Home');
	}
});
