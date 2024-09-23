import React, { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import * as tf from "@tensorflow/tfjs";

const ChessGame = () => {
  const [chess] = useState(new Chess()); // Create a new chess game instance
  const [currentPosition, setCurrentPosition] = useState(chess.fen());
  const [gameOver, setGameOver] = useState(false);
  const [model, setModel] = useState(null);

  // Load the TensorFlow model when the component mounts
  useEffect(() => {
    const loadModel = async () => {
      const loadedModel = await tf.loadLayersModel("/model.json"); // Adjust path as needed
      setModel(loadedModel);
    };
    loadModel();
  }, []);

  // Helper function to encode the chess board into an 8x8x12 tensor
  const encodeBoardForModel = (chessInstance) => {
    const boardTensor = []; // This will hold the 8x8x12 structure

    // Define a mapping for pieces
    const pieceMap = {
      p: 0, // Black pawn
      n: 1, // Black knight
      b: 2, // Black bishop
      r: 3, // Black rook
      q: 4, // Black queen
      k: 5, // Black king
      P: 6, // White pawn
      N: 7, // White knight
      B: 8, // White bishop
      R: 9, // White rook
      Q: 10, // White queen
      K: 11, // White king
    };

    // Get the board as an 8x8 array
    const board = chessInstance.board();

    // Loop through the 8x8 array representing the board
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = board[row][col];
        const squareTensor = Array(12).fill(0); // Create a 12-channel tensor for this square

        if (square) {
          // Get the piece on the square (color + type) and map it to our pieceMap
          const pieceCode = square.color === "w" ? square.type.toUpperCase() : square.type;
          squareTensor[pieceMap[pieceCode]] = 1; // Set the appropriate index to 1 for the piece
        }

        boardTensor.push(squareTensor); // Add the square's tensor to the boardTensor
      }
    }

    // Convert the boardTensor to a TensorFlow tensor and reshape it to the expected 8x8x12 input shape
    return tf.tensor(boardTensor).reshape([1, 8, 8, 12]); // Batch size of 1, 8x8 board, 12 channels
  };

  // Function to convert an algebraic square (e.g., "e2") to a square index (0-63)
  const squareToIndex = (square) => {
    const files = "abcdefgh"; // Files (columns) are 'a' to 'h'
    const rank = parseInt(square[1], 10) - 1; // Ranks (rows) are '1' to '8', so subtract 1 for zero-indexing
    const file = files.indexOf(square[0]); // Convert file letter ('a' to 'h') to an index (0-7)
    return rank * 8 + file; // Combine rank and file to get a unique index between 0 and 63
  };

  // Function to encode a move as an index (from square * 64 + to square)
  const encodeMove = (move) => {
    const fromIndex = squareToIndex(move.from); // Convert 'from' square to index
    const toIndex = squareToIndex(move.to); // Convert 'to' square to index
    return fromIndex * 64 + toIndex; // Encode move as a 0-4095 index
  };

  // Function to get the best legal move based on the model's prediction
  const getBestLegalMove = (predictedMoveProbs, chessInstance) => {
    // Get the list of legal moves with verbose info (so we can access 'from' and 'to')
    const legalMoves = chessInstance.moves({ verbose: true });

    // Map each legal move to its probability
    const legalMovesProbs = legalMoves.map((legalMove) => {
      const moveIndex = encodeMove(legalMove); // Encode the move into an index
      return { move: legalMove, prob: predictedMoveProbs[moveIndex] || 0 }; // Get the move's probability, default to 0 if undefined
    });

    // Select the legal move with the highest probability
    const bestMove = legalMovesProbs.reduce((best, current) =>
      current.prob > best.prob ? current : best
    ).move;

    return bestMove; // Return the best legal move
  };

  // Function to make AI move (Black's move)
  const makeAIMove = async () => {
    if (!model) return;

    // Encode the board state for the model
    const boardTensor = encodeBoardForModel(chess);
    
    // Make a prediction based on the current board state
    const prediction = model.predict(boardTensor);
    const predictedMoveProbs = prediction.dataSync(); // Get probabilities for all moves

    // Get the best legal move for the AI (Black)
    const aiMove = getBestLegalMove(predictedMoveProbs, chess);

    // Ensure the move is legal and update the board
    if (aiMove) {
      chess.move(aiMove); // Execute Black's move
      setCurrentPosition(chess.fen()); // Update the board's position

      if (chess.game_over) {
        setGameOver(true);
      }
    } else {
      console.error("No valid AI move found");
    }
  };

  // Handle user's piece drop (White's move)
  const onDrop = (sourceSquare, targetSquare) => {
    const move = chess.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q", // Automatically promote to queen if necessary
    });

    if (move === null) return false; // Invalid move

    setCurrentPosition(chess.fen());

    // After White moves, let the AI (Black) make its move
    if (!chess.game_over) {
      makeAIMove(); // Trigger AI's move after White
    } else {
      setGameOver(true);
    }

    return true;
  };

  return (
    <div style={{height:'1000px', width:'1000px', display: "flex", justifyContent: "center", marginTop: "20px" }}>
      {gameOver && <h2>Game Over!</h2>}
      <Chessboard
        justifyContent={"center"}
        position={currentPosition}
        onPieceDrop={onDrop}
        arePiecesDraggable={!gameOver}
      />
    </div>
  );
};

export default ChessGame;
