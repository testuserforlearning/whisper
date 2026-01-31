const connection = new BareMux.BareMuxConnection("/sail/baremux/worker.js") // you could always use epoxy, but libcurl is better imo
connection.setTransport("/sail/libcurl/index.mjs", [{ websocket: "wss://wisp.rhw.one/" }]) // use some other wisp here

const frame = document.getElementById("frame")
const bar = document.getElementById("bar")

const { ScramjetController } = $scramjetLoadController()
const scramjet = new ScramjetController({
    files: {
        all: "/sail/scram/scramjet.all.js",
        wasm: "/sail/scram/scramjet.wasm.wasm",
        sync: "/sail/scram/scramjet.sync.js"
    },
    prefix: "/sail/go/" 
})
scramjet.init()

function nav() {
    let url = bar.value.trim()
    if (!url) return;

    if (!url.includes(".")) {
        url = "https://search.brave.com/search?q=" + encodeURIComponent(url)
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url
    }

    frame.src = scramjet.encodeUrl(url)
}

bar.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        nav()
    }
})