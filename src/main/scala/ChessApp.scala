package chess

import scala.scalajs.js.annotation.JSExportTopLevel

object ChessApp {
	@JSExportTopLevel("exportFunc")
	def exportFunc(): Unit = {
		/*val p1 = Piece(White, King)
		val p2 = Piece(Black, King)
		val pos1 = Pos.A1
		val pos2 = Pos.E4
		val pm : PieceMap = Map(pos1 -> p1, pos2 -> p2)		
		val b = Board(pm, History(), variant.Atomic, None)
		val s = Situation(b, White)
		val g = Game(s)
		println(g)*/
		val sg = Game(variant.Atomic)		
		val after = sg(format.Uci.Move("e2e4").get)		
		after match {
			case cats.data.Validated.Valid((newGame, move)) => {
				println(newGame(format.Uci.Move("e7e5").get))
			}
		}
	}
	def main(args: Array[String]): Unit = {
		println("Hello world!")				
		exportFunc()
	}
}
