const { update } = require('./octokit.js')

const path = require('path')
const express = require('express')
const oauth = require('./oauth.js')
const app = express()
const port = process.env.PORT || 3000
const fetch = require('node-fetch')

const LICHESS_BASE_URL        = "https://lichess.org"
const LICHESS_BOT_UPGRAGE_URL = LICHESS_BASE_URL + "/api/bot/account/upgrade"

app.use(require('body-parser').json())

app.post('/logscalagame', (req, res) => {                
    let body = req.body

    update("TheYoBots", "logscalagame", `${body.botName} ${body.opponentName} ${body.id}`, JSON.stringify(body, null, 2), result => {
      if(result.error) {}
      else {}
    })        
})

app.get('/upgrade', (req, res) => {
	let user
	
	if(req.headers.cookie){
		let m = req.headers.cookie.match(/oauthUser=([0-9]+)/)
		
		if(m){
			let cookie = m[1]
			
			user = oauth.cookieToUser[cookie]
		}
	}
	
	if(!user){
		res.send(`Log in with your bot account to be able to upgrade.`)
		return
	}
	
	fetch(LICHESS_BOT_UPGRAGE_URL, {
		method: "POST",
		body: "",
		headers: {
			Authorization: `Bearer ${user.accessToken}`,
			Accept: "application/json"
		}
	}).then(response => response.text().then(content => res.send(`Upgrade status : <b>${content}</b> .`)))
})

function genLink(href, display){
	return `<a href="${href}" rel="noopener noreferrer" target="_blank">${display}</a>`
}

altLinks = [
	["https://github.com/ShailChoksi/lichess-bot", "lichess-bot (python)"],
	["https://github.com/dolegi/lichess-bot", "lichess-bot (golang)"]
	["https://github.com/tailuge/bot-o-tron", "bot-o-tron (js)"],
	["https://github.com/ornicar/scalachess", "scalachess"]
]

app.get('/', (req, res) => {
	let user
	
	if(req.headers.cookie){
		let m = req.headers.cookie.match(/oauthUser=([0-9]+)/)
		
		if(m){
			let cookie = m[1]
			
			user = oauth.cookieToUser[cookie]
		}
	}
	
	const SINGLE = req.query.single == "true"
	
	console.log("SINGLE", SINGLE)
	
	res.send(`
<script>
let USER = ${user ? JSON.stringify(user, null, 2) : "null"}
document.title = "ScalaChess ${user ? user.id : ""}"
const SINGLE = document.location.href.match(/single=true/)
</script>
<script src="https://unpkg.com/@easychessanimations/uci@1.0.29/lib/uci.js"></script>	
${SINGLE ? "" : "<script src='stockfishwasm/stockfish.js'></script>"}
<script src="utils.js"></script>
<script src="outopt.js"></script>
<script src="bot.js"></script>
${user ? "Logged in as <b>" + user.username + "</b> . <a href='/upgrade' rel='noopener noreferrer' target='_blank'>Request upgrade to bot</a> . <a href='/logout'>Log out</a> ." : "Make sure you are logged into lichess with your bot account, then <a href='/oauth/bot'>login your bot using oauth</a> ." } 
<a href="${SINGLE ? "/?single=false" : "/?single=true"}">Use ${SINGLE ? "multi" : "single"} threaded Stockfish</a> .
<hr>
For detailed understanding see <a href="https://github.com/TheYoBots/scalachess" rel="noopener noreferrer" target="_blank">the source code</a> . ${genLink("https://github.com/TheYoBots/scalachess/issues", "Open an issue on GitHub")} . ${genLink("https://github.com/TheYoBots/scalachess/fork", "Fork the repository to contribute")} . ${genLink("https://github.com/TheYoBots/scalachess/stargazers", "Give the repository a star")} .
	<hr>
	<div id="botSettings"></div>
<hr>
<div id="logs"></div>
<script src="https://unpkg.com/@easychessanimations/foo@1.0.39/lib/fooweb.js"></script>
<script src="smartdom.js"></script>
<script>
	let oldConsole = console
	
	let items = []
	
	let app = div().h(400).ovfs()
	
	function newLog(...args){
		let argStrs = args.map(arg => {
			let argStr = arg.toString()
			
			if(typeof arg == "object"){
				argStr = ""
				try{
					//argStr = JSON.stringify(arg)
				}catch(err){}
			}

			return argStr
		})

		let argsStr = argStrs.join(" ")

		oldConsole.log(argsStr)
		
		items.unshift(argsStr)

		while(items.length > 250) items.pop()

		app.x().a(items.map(item=>
			div()
				.pad(3).mar(3).bc("#eee").ffms()
				.html(item)
		))
	}
	
	console = {
		log: newLog,
		warn: newLog,
		error: newLog,
		info: newLog
	}
	
	document.getElementById("logs").appendChild(app.e)	
	
	let botSettings1 = div().fl().a(
		Labeled("Make random moves", CheckBox({id: "useRandom"})),		
		Labeled("Ponder", CheckBox({id: "usePonder"})).marl(10),
		Labeled("Engine threads", Combo({id: "engineThreads", options: [...Array(8).keys()].map(key => ({value:(key+1), display: (key+1)}))})).marl(10),
		Labeled("Engine hash", Combo({id: "engineHash", options: [...Array(5).keys()].map(key => ({value:Math.pow(2, key+4), display: Math.pow(2, key+4)}))})).marl(10),
		Labeled("Move overhead", Combo({id: "engineMoveOverhead", options: [...Array(49).keys()].map(key => ({value:(key+2)*100, display: (key+2)*100}))})).marl(10),
		div().fwb().sa("id", "score").marl(10).fs(18).ffms()
	)
	
	let botSettings2 = div().fl().a(
		Labeled("Use book", CheckBox({id: "useBook"})),
		Labeled("Book depth", Combo({id: "bookDepth", options: [...Array(100).keys()].map(key => ({value:(key+1), display: (key+1)}))})).marl(10),
		Labeled("Book spread", Combo({id: "bookSpread", options: [...Array(20).keys()].map(key => ({value:(key+1), display: (key+1)}))})).marl(10),
		Labeled("Book speeds", MultipleSelect({id: "bookSpeeds", options:["bullet", "blitz", "rapid", "classical"].map(speed => [speed, speed])})).marl(10),
		Labeled("Book ratings", MultipleSelect({id: "bookRatings", options:["1600", "1800", "2000", "2200", "2500"].map(speed => [speed, speed])})).marl(10),
	)
	
	let botSettings = div().a(botSettings1, hr(), botSettings2)
	
	document.getElementById("botSettings").appendChild(botSettings.e)	
	
	console.log("Scalachess browser bots logs will be shown here, when reporting an error, always submit a copy of these logs")
	
	console.log("&nbsp;")
	
	console.log("Welcome to Scalachess browser bots!")
</script>
<hr>
	Alternative bots : ${altLinks.map(altLink => genLink(altLink[0], altLink[1])).join(" | ")} .
`)
})

app.get('/logout', (req, res) => {
	res.clearCookie("oauthUser")
	res.redirect("/")
})

app.use('/', express.static(__dirname))
 
const firestore = null // provide firestore instance for persistance
 
const maxAge = 31 * 24 * 60 * 60 * 1000 // cookie max age in ms, optional, default is 1 year
 
oauth.initOauth(app, firestore, maxAge)

oauth.addLichessStrategy(app, {
    tag: "lichess-bot",
    clientID: process.env.LICHESS_BOT_CLIENT_ID,
    authURL: "/oauth/bot",
    scope: "challenge:read challenge:write bot:play",
    failureRedirect: "/?lichessbotlogin=failed",
    okRedirect: "/?lichessbotlogin=ok"
})

app.listen(port, _ => {
    console.log(`Scalachess listening on port ${port} !`)
})
