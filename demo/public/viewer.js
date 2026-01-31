document.addEventListener('DOMContentLoaded', function() {
	if (window.lucide) lucide.createIcons();

	// Initialize Sail
	const connection = new BareMux.BareMuxConnection("/sail/baremux/worker.js");
	connection.setTransport("/sail/libcurl/index.mjs", [{ websocket: "wss://wisp.rhw.one/" }]);
	
	const { ScramjetController } = $scramjetLoadController();
	const scramjet = new ScramjetController({
		files: {
			all: "/sail/scram/scramjet.all.js",
			wasm: "/sail/scram/scramjet.wasm.wasm",
			sync: "/sail/scram/scramjet.sync.js"
		},
		prefix: "/sail/go/"
	});
	scramjet.init();

	var frame = document.getElementById('frame');
	var bar = document.getElementById('stat');
	var input = document.getElementById('bar');
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

		if (!target.includes('.')) {
			target = "https://search.brave.com/search?q=" + encodeURIComponent(target)
		} else if (!target.startsWith("http://") && !target.startsWith("https://")) {
			target = "https://" + target
		}

		frame.src = scramjet.encodeUrl(target);
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
			
			if (!target.includes('.')) {
				target = "https://search.brave.com/search?q=" + encodeURIComponent(target)
			} else if (!target.startsWith("http://") && !target.startsWith("https://")) {
				target = "https://" + target
			}
			
			window.open(scramjet.encodeUrl(target), '_blank');
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
		input.value = '';
		history = [''];
		pos = 0;
		updateNav();
		updateTabTitle('Home');
	}

// Settings Modal functionality
const modal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings');
const closeBtn = document.querySelector('.close-button');
const sidebarItems = document.querySelectorAll('.sidebar-item');
const settingsCategories = document.querySelectorAll('.settings-category');

// Open modal
settingsBtn.addEventListener('click', function() {
	modal.style.display = 'block';
	document.body.classList.add('modal-open');
	
	// Set initial state for animation
	gsap.set('.modal-content', {
		opacity: 0,
		scale: 0.7,
		y: 50
	});
	
	gsap.set('.sidebar-item', {
		opacity: 0,
		x: -30
	});
	
	gsap.set('.setting-item', {
		opacity: 0,
		y: 20
	});
	
	// Animate modal content with pop effect
	gsap.to('.modal-content', {
		opacity: 1,
		scale: 1,
		y: 0,
		duration: 0.4,
		delay: 0.1,
		ease: "back.out(1.7)"
	});
	
	// Animate sidebar items with stagger
	gsap.to('.sidebar-item', {
		opacity: 1,
		x: 0,
		duration: 0.3,
		delay: 0.3,
		stagger: 0.05,
		ease: "power2.out"
	});
	
	// Animate setting items with stagger
	gsap.to('.setting-item', {
		opacity: 1,
		y: 0,
		duration: 0.3,
		delay: 0.5,
		stagger: 0.08,
		ease: "power2.out"
	});
	
	if (window.lucide) lucide.createIcons();
});

// Close modal
closeBtn.addEventListener('click', function() {
	closeModal();
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
	if (event.target === modal) {
		closeModal();
	}
});

function closeModal() {
	// Animate out
	gsap.to('.setting-item', {
		opacity: 0,
		y: 20,
		duration: 0.2,
		stagger: 0.05,
		ease: "power2.in"
	});
	
	gsap.to('.sidebar-item', {
		opacity: 0,
		x: -30,
		duration: 0.2,
		delay: 0.1,
		stagger: 0.03,
		ease: "power2.in"
	});
	
	gsap.to('.modal-content', {
		opacity: 0,
		scale: 0.7,
		y: 50,
		duration: 0.3,
		delay: 0.2,
		ease: "back.in(1.7)",
		onComplete: () => {
			modal.style.display = 'none';
			document.body.classList.remove('modal-open');
		}
	});
}

// Sidebar navigation
sidebarItems.forEach(item => {
	item.addEventListener('click', function() {
		const category = this.getAttribute('data-category');
		
		// Update active states
		sidebarItems.forEach(i => i.classList.remove('active'));
		this.classList.add('active');
		
		// Animate out current category
		const currentCategory = document.querySelector('.settings-category.active');
		if (currentCategory) {
			gsap.to(currentCategory.querySelectorAll('.setting-item'), {
				opacity: 0,
				y: 20,
				duration: 0.2,
				stagger: 0.05,
				ease: "power2.in",
				onComplete: () => {
					currentCategory.classList.remove('active');
					
					// Show new category
					const newCategory = document.getElementById(`${category}-settings`);
					if (newCategory) {
						newCategory.classList.add('active');
						
						// Animate in new category
						gsap.set(newCategory.querySelectorAll('.setting-item'), {
							opacity: 0,
							y: 20
						});
						
						gsap.to(newCategory.querySelectorAll('.setting-item'), {
							opacity: 1,
							y: 0,
							duration: 0.3,
							stagger: 0.08,
							ease: "power2.out"
						});
					}
				}
			});
		}
	});
});

// Settings functionality
document.getElementById('prevent-closing').addEventListener('change', function() {
	if (this.checked) {
		window.addEventListener('beforeunload', preventClose);
	} else {
		window.removeEventListener('beforeunload', preventClose);
	}
});

function preventClose(e) {
	e.preventDefault();
	e.returnValue = '';
}

document.getElementById('clear-data').addEventListener('click', function() {
	if (confirm('Are you sure you want to clear all data?')) {
		localStorage.clear();
		sessionStorage.clear();
		alert('All data cleared!');
	}
});

document.getElementById('debug-mode').addEventListener('change', function() {
	if (this.checked) {
		console.log('Debug mode enabled');
		// Enable debug logging here
	} else {
		console.log('Debug mode disabled');
		// Disable debug logging here
	}
});

document.getElementById('cloak-title').addEventListener('input', function() {
	if (this.value.trim()) {
		document.title = this.value.trim();
	} else {
		document.title = 'new proccy';
	}
});

// Cloaking functionality
document.getElementById('decoy').addEventListener('change', function() {
	const decoy = this.value;
	if (decoy === 'none') {
		document.title = 'new proccy';
		// Reset favicon
		const favicon = document.querySelector('link[rel="icon"]') || document.createElement('link');
		favicon.rel = 'icon';
		favicon.href = '';
		document.head.appendChild(favicon);
	} else {
		// Set decoy title and favicon
		switch(decoy) {
			case 'google':
				document.title = 'Google';
				setFavicon('https://www.google.com/favicon.ico');
				break;
			case 'schoology':
				document.title = 'Schoology';
				setFavicon('https://asset.schoology.com/sites/all/themes/schoology_theme/favicon.ico');
				break;
			case 'classroom':
				document.title = 'Google Classroom';
				setFavicon('https://ssl.gstatic.com/classroom/favicon.png');
				break;
		}
	}
});

document.getElementById('cloak-link').addEventListener('change', function() {
	const cloak = this.value;
	if (cloak === 'none') {
		history.replaceState(null, '', window.location.pathname);
	} else {
		history.replaceState(null, '', cloak);
	}
});

function setFavicon(url) {
	let favicon = document.querySelector('link[rel="icon"]');
	if (!favicon) {
		favicon = document.createElement('link');
		favicon.rel = 'icon';
		document.head.appendChild(favicon);
	}
	favicon.href = url;
}

});
