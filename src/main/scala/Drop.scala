package chess

import format.Uci
import scala.concurrent.duration._

case class Drop(
    piece: Piece,
    pos: Pos,
    before: Board,
    after: Board,
    lag: FiniteDuration = 0.millis) {

  def situationBefore = before situationOf piece.color
  def situationAfter = finalizeAfter situationOf !piece.color

  def withHistory(h: History) = copy(after = after withHistory h)

  def finalizeAfter: Board = after.variant.finalizeBoard(
    after updateHistory {
      _.copy(
        positionHashes = after.variant updatePositionHashes(this, after.history.positionHashes),
        lastMove = Some(Uci.Drop(piece.role, pos))
      )
    }, toUci, none)

  def afterWithLastMove = after.copy(
    history = after.history.withLastMove(Uci.Drop(piece.role, pos)))

  def color = piece.color

  def withAfter(newBoard: Board) = copy(after = newBoard)

  def withLag(l: FiniteDuration) = copy(lag = l)

  def toUci = Uci.Drop(piece.role, pos)

  override def toString = toUci.uci
}