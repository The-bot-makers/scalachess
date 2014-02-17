package chess

import format.Visual.addNewLines
import Pos._

class GameTest extends ChessTest {

  "capture a piece" should {
    "add it to the dead pieces" in {
      val game = makeGame.playMoves(
        E2 -> E4,
        D7 -> D5,
        E4 -> D5)
      game must beSuccess.like {
        case g => g.deads must containTheSameElementsAs(List(Black.pawn))
      }
    }
  }
  "recapture a piece" should {
    "add both to the dead pieces" in {
      val game = Game("""
bq
R""").playMoves(
        A1 -> A2,
        B2 -> A2)
      game must beSuccess.like {
        case g => g.deads must containTheSameElementsAs(List(Black.bishop, White.rook))
      }
    }
  }
  "prevent castle by capturing a rook" should {
    val game = Game("""
 b
R   K""", Black)
    "can castle queenside" in {
      game.board.history canCastle White on QueenSide must_== true
    }
    "can still castle queenside" in {
      game.playMoves(B2 -> A3) must beSuccess.like {
        case g => g.board.history canCastle White on QueenSide must_== true
      }
    }
    "can not castle queenside anymore" in {
      game.playMoves(B2 -> A1) must beSuccess.like {
        case g => g.board.history canCastle White on QueenSide must_== false
      }
    }
  }
}
