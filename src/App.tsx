// App.tsx
import React, { useState, useMemo } from 'react';
import { FileText, Download, Eye, EyeOff, X } from 'lucide-react';
import { generateWordSearch, WordPosition } from './utils/wordSearch';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function App() {
  const [wordInput, setWordInput] = useState('');
  const [gridSize, setGridSize] = useState(20);
  const [words, setWords] = useState<string[]>([]);
  const [puzzle, setPuzzle] = useState<{
    grid: string[][];
    words: string[];
    wordPositions: WordPosition[];
  } | null>(null);
  const [allowBackwards, setAllowBackwards] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to convert any character to image data URL
  const charToImageUrl = async (char: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'black';
    ctx.font = '24px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 16, 16);
    
    return canvas.toDataURL('image/png');
  };

  // Calculate minimum grid size based on the longest word
  const minGridSize = useMemo(() => {
    const currentWords = wordInput
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    const longestWordLength = Math.max(
      ...currentWords.map((word) => Array.from(word).length),
      ...words.map((word) => Array.from(word).length),
      10 // Default minimum
    );
    return longestWordLength;
  }, [wordInput, words]);

  // Handle form submission to generate the puzzle
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newWords = wordInput
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    if (newWords.length > 0) {
      setWords(newWords);
      // Ensure grid size is at least as large as the longest word
      const effectiveGridSize = Math.max(gridSize, minGridSize);
      setGridSize(effectiveGridSize);
      try {
        setPuzzle(generateWordSearch(newWords, effectiveGridSize, allowBackwards));
        setError(null);
      } catch (err) {
        setError("Failed to generate puzzle. Try decreasing the grid size or increasing the number of words.");
      }
    }
  };

  // Function to generate the PDF
  const generatePDF = async () => {
    if (!puzzle) return;

    try {
      const pdfDoc = await PDFDocument.create();
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const page = pdfDoc.addPage([595.276, 841.890]); // A4 size in points
      
      const margins = 50;
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const availableWidth = pageWidth - 2 * margins;
      const availableHeight = pageHeight - 2 * margins;

      // Add title as text
      const titleText = 'Word Search Puzzle';
      const titleSize = 36;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleSize);
      page.drawText(titleText, {
        x: (pageWidth - titleWidth) / 2,
        y: pageHeight - margins - titleSize,
        size: titleSize,
        font: helveticaBold,
      });

      // Calculate grid dimensions
      const cellSize = Math.min(
        availableWidth / puzzle.grid.length,
        (availableHeight - 150) / puzzle.grid.length // Increased spacing for title
      );
      const gridWidth = cellSize * puzzle.grid.length;
      const startX = (pageWidth - gridWidth) / 2;
      const startY = pageHeight - margins - titleSize - 40; // Adjusted starting position

      // Draw grid and letters
      for (let i = 0; i < puzzle.grid.length; i++) {
        for (let j = 0; j < puzzle.grid[i].length; j++) {
          const cell = puzzle.grid[i][j];
          const x = startX + j * cellSize;
          const y = startY - i * cellSize;

          // Draw cell border
          page.drawRectangle({
            x,
            y: y - cellSize,
            width: cellSize,
            height: cellSize,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
          });

          // Convert character to image and embed it
          try {
            const imageUrl = await charToImageUrl(cell);
            const imageBytes = await fetch(imageUrl).then(res => res.arrayBuffer());
            const image = await pdfDoc.embedPng(imageBytes);
            const imageDims = image.scale(0.5);
            
            page.drawImage(image, {
              x: x + (cellSize - imageDims.width) / 2,
              y: y - cellSize + (cellSize - imageDims.height) / 2,
              width: imageDims.width,
              height: imageDims.height,
            });
          } catch (err) {
            console.error('Failed to embed character:', err);
          }
        }
      }

      // Add "Words to Find" header as text
      const headerText = 'Words to Find:';
      const headerSize = 28;
      page.drawText(headerText, {
        x: margins,
        y: startY - gridWidth - 40,
        size: headerSize,
        font: helveticaBold,
      });

      // Calculate word size based on number of words
      const wordSize = Math.max(16, Math.min(24, Math.floor(400 / puzzle.words.length)));
      const wordsStartY = startY - gridWidth - 40 - headerSize;
      const wordsPerColumn = Math.floor((wordsStartY - margins) / (wordSize * 1.5));
      const columns = Math.ceil(puzzle.words.length / wordsPerColumn);
      const columnWidth = availableWidth / columns;

      // Draw words list with all characters as images
      for (let i = 0; i < puzzle.words.length; i++) {
        const word = puzzle.words[i];
        const column = Math.floor(i / wordsPerColumn);
        const row = i % wordsPerColumn;
        const x = margins + column * columnWidth;
        const y = wordsStartY - row * (wordSize * 1.5); // Adjusted spacing based on word size

        // Draw bullet point
        const bulletImageUrl = await charToImageUrl('•');
        const bulletImageBytes = await fetch(bulletImageUrl).then(res => res.arrayBuffer());
        const bulletImage = await pdfDoc.embedPng(bulletImageBytes);
        const bulletDims = bulletImage.scale(wordSize / 32); // Scale bullet point relative to word size
        page.drawImage(bulletImage, {
          x,
          y: y - bulletDims.height / 2,
          width: bulletDims.width,
          height: bulletDims.height,
        });

        // Draw each character in the word
        const chars = Array.from(word);
        let currentX = x + bulletDims.width + 5;
        
        for (const char of chars) {
          try {
            const imageUrl = await charToImageUrl(char);
            const imageBytes = await fetch(imageUrl).then(res => res.arrayBuffer());
            const image = await pdfDoc.embedPng(imageBytes);
            const imageDims = image.scale(wordSize / 32); // Scale word characters relative to word size
            
            page.drawImage(image, {
              x: currentX,
              y: y - imageDims.height / 2,
              width: imageDims.width,
              height: imageDims.height,
            });
            currentX += imageDims.width + 2;
          } catch (err) {
            console.error('Failed to embed character in word list:', err);
            currentX += wordSize / 3;
          }
        }
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'word-search-puzzle.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('Failed to generate PDF. Please try again.');
    }
  };

  // Function to check if a cell should be highlighted (for answers)
  const isHighlighted = (row: number, col: number) => {
    if (!showAnswers || !puzzle) return false;
    return puzzle.wordPositions.some((wp) =>
      wp.positions.some((pos) => pos.row === row && pos.col === col)
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8 font-segoe">
      {/* Error Popup */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main container */}
      <div className="max-w-4xl mx-auto">
        {/* Form and options */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
          <div className="flex items-center mb-6">
            <FileText className="w-8 h-8 text-indigo-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800 font-segoe">
              Word Search Generator
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            {/* Words input */}
            <div className="mb-4">
              <label
                htmlFor="words"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Enter words or emojis (separated by commas or new lines)
              </label>
              <textarea
                id="words"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder="Example:&#10;🌞,🌙,⭐&#10;HELLO&#10;WORLD,🌈,🦋"
                className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-emoji"
              />
            </div>

            {/* Grid size slider */}
            <div className="mb-4">
              <label
                htmlFor="gridSize"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Grid Size
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="gridSize"
                  min={minGridSize}
                  max="100"
                  value={Math.max(gridSize, minGridSize)}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-600 min-w-[3rem]">
                  {Math.max(gridSize, minGridSize)}x
                  {Math.max(gridSize, minGridSize)}
                </span>
              </div>
            </div>

            {/* Allow backwards words */}
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowBackwards}
                  onChange={(e) => setAllowBackwards(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Allow backwards words
                </span>
              </label>
            </div>

            {/* Generate puzzle button */}
            <button
              type="submit"
              disabled={!wordInput.trim()}
              className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Puzzle
            </button>
          </form>

          {/* Words to find */}
          {words.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-700 font-segoe">
                Words to Find:
              </h2>
              <div className="flex flex-wrap gap-2">
                {words.map((word, index) => (
                  <div
                    key={index}
                    className="bg-gray-100 px-3 py-1 rounded-full text-gray-700 font-emoji"
                  >
                    {word}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download PDF button */}
          {puzzle && (
            <button
              onClick={generatePDF}
              className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download PDF
            </button>
          )}
        </div>

        {/* Puzzle preview */}
        {puzzle && (
          <div className="bg-white rounded-xl shadow-xl p-8 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 font-segoe">
                Preview
              </h2>
              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
              >
                {showAnswers ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                {showAnswers ? 'Hide Answers' : 'Show Answers'}
              </button>
            </div>
            <div className="grid gap-px bg-gray-200">
              {puzzle.grid.map((row, i) => (
                <div key={i} className="flex gap-px">
                  {row.map((cell, j) => (
                    <span
                      key={j}
                      className={`w-8 h-8 flex items-center justify-center text-lg bg-white transition-colors font-emoji ${
                        isHighlighted(i, j) ? 'bg-yellow-200' : ''
                      }`}
                    >
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
