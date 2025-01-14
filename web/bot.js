const IS_BROWSER = ( typeof window != "undefined" )

const DEFAULT_REDUCE_THINKING_TIME      = 1

class LichessBotGame_{
    poweredBy(){
        this.writeBotChat(["player", "spectator"], `${this.botName} is an easy to make browser bot. No coding done.`)
    }

    constructor(props){
        this.props = props

        this.parentBot = props.parentBot
        
        this.id = props.id        

        this.engine = new UciEngineWeb()
		
        this.ratingDiff = 0

        this.gameStateReader = new NdjsonReader(LICHESS_STREAM_GAME_STATE_URL + "/" + this.id, this.processGameEvent.bind(this), this.parentBot.token, this.processTermination.bind(this))
		
		this.parentBot.props.threads = (getLocal("engineThreads") || {selected:1}).selected
		this.parentBot.props.hash = (getLocal("engineHash") || {selected:16}).selected
		this.parentBot.props.moveOverhead = (getLocal("engineMoveOverhead") || {selected:200}).selected
		
		if(this.parentBot.props.scoreCallback){
			this.parentBot.props.scoreCallback(`Game ${this.id} started .`, "#070")
		}

        setTimeout(_=>{
			let allowThreads = true
			
			if(typeof SINGLE != "undefined"){
				allowThreads = !SINGLE
			}
			
			console.log("allow threads", allowThreads)
			
			if(allowThreads) this.engine
				.setoption("Threads", this.parentBot.props.threads)

			if(allowThreads) this.engine
				.setoption("Hash", this.parentBot.props.hash)

			this.engine
				.setoption("Move Overhead", this.parentBot.props.moveOverhead)
			
			this.gameStateReader.stream()
		}, 5000)
    }

    writeBotChat(rooms, msg){
        return
        for(let room of rooms){
            writeLichessBotChat(this.id, room, msg, this.parentBot.token).then(result => {
                //
            })
        }
    }

    processGameEvent(event){
        if(event.type == "chatLine") return

        console.log("game event", event)

        if(event.type == "gameFull"){
            let gameFull = event
            this.gameFull = gameFull

            this.botWhite = true

            this.botRating = gameFull.white.rating || 1500
            this.oppRating = gameFull.black.rating || 1500

            this.botName = gameFull.white.name
            this.opponentName = gameFull.black.name
			
			let postBody = gameFull
            postBody.id = this.id
			postBody.botName = this.botName
			postBody.opponentName = this.opponentName
			
			fetch('/logscalagame', {
				method: "POST",
				headers: {
				   "Content-Type": "application/json"
				},
				body: JSON.stringify(postBody)
			})

            if(gameFull.black.id == this.parentBot.userId){
                this.botWhite = false

                this.botRating = gameFull.black.rating || 1500
                this.oppRating = gameFull.white.rating || 1500

                this.botName = gameFull.black.name
                this.opponentName = gameFull.white.name
            }

            this.ratingDiff = this.oppRating - this.botRating

            this.variant = gameFull.variant.key
			
			this.engine
				.setoption("UCI_Variant", this.variant.toLowerCase())

            this.initialFen = gameFull.initialFen

            this.state = gameFull.state

            this.writeBotChat(["player", "spectator"], `Good luck against this browser bot!`)                
            
            this.poweredBy()
        }else if(event.type == "gameState"){
            this.state = event
        }

        if(this.gameFull && this.state){
			console.log("setting up board from state", this.state)
			
			this.moves = this.state.moves ? this.state.moves.split(" ") : []
			
			let result = makeUciMovesScala(this.variant, this.initialFen == "startpos" ? undefined : this.initialFen, this.moves)	
			
			console.log("set up result", result)
			
			let [fen, legalMovesUcis, sanMoves] = result
			
            if(fen){
				this.currentFen = fen
				
				this.legalMoveUcis = legalMovesUcis
				
				this.isWhiteTurn = this.currentFen.match(/ w /)
				
				let fenPlies = parseInt(this.currentFen.split(" ")[5])
				if(isNaN(fenPlies)) fenPlies = 0
				this.fenPlies = fenPlies * 2 + (this.isWhiteTurn ? 0 : 1)
				
                if((this.isWhiteTurn && this.botWhite) || ((!this.isWhiteTurn) && (!this.botWhite))){
                    if(this.legalMoveUcis.length){
                        let reduceThinkingTime = this.parentBot.props.reduceThinkingTime || DEFAULT_REDUCE_THINKING_TIME

                        this.timecontrol = {
                            wtime:  this.state.wtime ? Math.floor(this.state.wtime / reduceThinkingTime) : 10000,
                            winc:   this.state.winc  || 0,
                            btime:  this.state.btime ? Math.floor(this.state.btime / reduceThinkingTime) : 10000,
                            binc:   this.state.binc  || 0,
                        }

                        if(this.timecontrol.wtime > HOUR) this.timecontrol.wtime = 10000
                        if(this.timecontrol.btime > HOUR) this.timecontrol.btime = 10000                            
						
						this.parentBot.props.useRandom = (getLocal("useRandom") || {checked:false}).checked
						this.parentBot.props.useBook = (getLocal("useBook") || {checked:false}).checked
						this.parentBot.props.bookDepth = parseInt((getLocal("bookDepth") || {selected:1}).selected)
						this.parentBot.props.bookSpread = parseInt((getLocal("bookSpread") || {selected:1}).selected)
						this.parentBot.props.bookSpeeds = (getLocal("bookSpeeds") || {selectedKeys:[]}).selectedKeys
						this.parentBot.props.bookRatings = (getLocal("bookRatings") || {selectedKeys:[]}).selectedKeys
						this.parentBot.props.usePonder = (getLocal("usePonder") || {checked:false}).checked
						
						if(this.parentBot.props.useRandom){
							let randomUci = this.legalMoveUcis[Math.floor(Math.random() * this.legalMoveUcis.length)]
							
							if(this.parentBot.props.scoreCallback){
								this.parentBot.props.scoreCallback(`Random move ${randomUci} .`, "#770")
							}
							
							this.playBotMove("random", {
								bestmove: randomUci,
								scorenumerical: null
							})
						}else this.findBookMoveThen().then(bookalgeb => {
							if(bookalgeb){
								if(this.parentBot.props.scoreCallback){
									this.parentBot.props.scoreCallback(`Book move ${bookalgeb} .`, "#007")
								}
		
								this.playBotMove("book", {
									bestmove: bookalgeb,
									scorenumerical: null
								})
							}else{
								this.findEngineMoveThen().then(result => {
									this.playBotMove("engine", result)
								})
							}
						})
                    }
                }
            }
        }
    }	
	
	findBookMoveThen(){
		console.log(`find book ${!!this.parentBot.props.useBook} , fenPlies : ${this.fenPlies} , bookDepth : ${this.parentBot.props.bookDepth} , bookSpread : ${this.parentBot.props.bookSpread} , bookSpeeds : ${this.parentBot.props.bookSpeeds} , bookRatings : ${this.parentBot.props.bookRatings}`)
		
		if( (!this.parentBot.props.useBook) || (this.fenPlies > this.parentBot.props.bookDepth) ){
			return RP(null)
		}
		
		return P(resolve =>{
			return requestLichessBook(
				this.currentFen,
				this.variant,
				(this.parentBot.props.bookSpread || LICHESS_BOOK_MAX_MOVES),
				(this.parentBot.props.bookRatings || LICHESS_BOOK_AVG_RATINGS),
				(this.parentBot.props.bookSpeeds || LICHESS_BOOK_TIME_CONTROLS)
			).then(result => {
				let bookalgeb = null
				
				let bmoves = result.moves

				if(bmoves && bmoves.length){
					let grandTotal = 0

					for(let bmove of bmoves){
						bmove.total = bmove.white + bmove.draws + bmove.black
						grandTotal += bmove.total
					}

					let rand = Math.round(Math.random() * grandTotal)

					let currentTotal = 0

					for(let bmove of bmoves){
						currentTotal += bmove.total                                            
						if(currentTotal >= rand){
							bookalgeb = bmove.uci
							break
						}                                            
					}
				}	
				
				resolve(bookalgeb)
			})
		})		
	}
	
	findEngineMoveThen(){
		return P(resolve => {
			let specifier = this.initialFen == "startpos" ? "startpos" : `fen ${this.initialFen}`

			console.log("position", specifier, this.moves)

			this.engine.position(specifier, this.moves)

			this.engine.gothen({
				wtime: this.timecontrol.wtime,
				winc: this.timecontrol.winc,
				btime: this.timecontrol.btime,
				binc: this.timecontrol.binc,
				ponderAfter: this.parentBot.props.usePonder
			}).then(result => {
				let scorenumerical = null
				
				if(result.depthInfos.length){
					let score = result.depthInfos[result.depthInfos.length - 1].score
					
					if(score){
						if(score.unit == "cp"){
							scorenumerical = score.value
						}else{
							scorenumerical = score.value > 0 ? 10000 - score.value : -10000 - score.value
						}	
						
						if(this.parentBot.props.scoreCallback){
							let color = "#000"
							if(scorenumerical > 300) color = "#0a0"
							else if(scorenumerical > 0) color = "#070"
							else if(scorenumerical < 0) color = "#700"
							else if(scorenumerical < -300) color = "#a00"
							this.parentBot.props.scoreCallback(`Score unit : ${score.unit} , Score value : ${score.value}`, color)
						}
					}
				}
				
				resolve({
					bestmove: result.bestmove,
					scorenumerical: scorenumerical
				})
			})
		})
	}

    playBotMove(method, moveObj){
		console.log("play bot move", method, moveObj)
		
        let offeringDraw = false

        if(moveObj.bestmove){
            let msg = `My ${method} move : ${moveObj.bestmove} .`

            let randPercent = Math.round(Math.random() * 100)

            if(!(moveObj.scorenumerical === null)){
                let scorenumerical = moveObj.scorenumerical
                msg += ` Score numerical cp : ${scorenumerical} .`                
                if(this.moves && this.moves.length > 40){
                    if(this.ratingDiff > -200){
                        if(scorenumerical == 0){
                            offeringDraw = true
                        }
                        if(scorenumerical < 200){
                            if(randPercent < 10) offeringDraw = true
                        }
                    }
                }
            }
			
			offeringDraw = false

            if(offeringDraw) msg += " I would agree to a draw ."     
			
			console.log("chat message", msg, "offeringDraw", offeringDraw)

            makeLichessBotMove(this.id, moveObj.bestmove, offeringDraw, this.parentBot.token).then(result => {
                //
            })

            this.writeBotChat(["player", "spectator"], msg)
        }else{
            // try to make move anyway
            makeLichessBotMove(this.id, moveObj.bestmove, offeringDraw, this.parentBot.token).then(result => {
                //
            })
        }
    }

    processTermination(){
        console.log(`Game ${this.id} terminated .`)

        this.writeBotChat(["player", "spectator"], `Good game, Hope you had fun playing this browser bot!`)
        this.poweredBy()
        this.engine.terminate()
    }
}
function LichessBotGame(props){return new LichessBotGame_(props)}

class LichessBot_{
    constructor(props){
		console.log("creating bot", props)
		
        this.props = props

        this.token = props.token

        this.userId = props.userId

        this.acceptVariant = props.acceptVariant

        if(props.acceptVariant){
            if(typeof props.acceptVariant == "string") this.acceptVariant = props.acceptVariant.split(" ")
        }

        this.minInitialClock = props.minInitialClock || 60
    }

    toString(){
        return `bot ${this.token}`
    }

    challengeRefused(msg){
        console.log("Challenge refused .", msg)
    }

    processBotEvent(event){
        console.log(JSON.stringify(event, null, 2))

        if(event.type == "challenge"){
            let challenge = event.challenge

            if(this.acceptVariant){
                if(!this.acceptVariant.includes(challenge.variant.key)){
                    return this.challengeRefused(`Wrong variant . Acceptable variant(s) : ${this.acceptVariant.join(" , ")} .`)            
                }
            }

            if(challenge.timeControl.limit < this.minInitialClock){
                return this.challengeRefused(`Initial clock too low . Minimum initial clock : ${this.minInitialClock} sec(s) .`)            
            }

            acceptLichessChallenge(event.challenge.id, this.token)
        }else if(event.type == "gameStart"){
            LichessBotGame({
                parentBot: this,
                id: event.game.id
            })
        }
    }

    stream(){
		console.log("bot stream")
		
        this.challengeReader = new NdjsonReader(LICHESS_STREAM_EVENTS_URL, this.processBotEvent.bind(this), this.token)

        this.challengeReader.stream()
    }
}
function LichessBot(props){return new LichessBot_(props)}

if(!USER){
	USER = {
		id: "normalbulletbot",
		accessToken : ""
	}
}

if(USER.accessToken){
	const bot = LichessBot({
		userId: USER.id,
		token: USER.accessToken,
		scoreCallback: (score, color) => {
			document.getElementById("score").innerHTML = score
			document.getElementById("score").style.color = color || "#000"
		}
	})
	
	console.log(bot)

	bot.stream()	
}
