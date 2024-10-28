// App.tsx
import React, { useState, useMemo } from 'react';
import { SearchCode, Download, Eye, EyeOff, X, Type } from 'lucide-react';
import { generateWordSearch, WordPosition } from './utils/wordSearch';
import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

// Define an array of background colors for highlighting
const HIGHLIGHT_COLORS = [
  'bg-red-200',
  'bg-blue-200',
  'bg-green-200',
  'bg-purple-200',
  'bg-pink-200',
  'bg-orange-200',
  'bg-teal-200',
  'bg-indigo-200',
  'bg-yellow-200',
  'bg-rose-200',
];

function App() {
  // @ts-ignore
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  // @ts-ignore
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;
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
  const [isUpperCase, setIsUpperCase] = useState(false);

  // Function to check if a character is an emoji
  const isEmoji = (str: string): boolean => {
    // @ts-ignore
    return [...segmenter.segment(str)].length !== str.length;
  };

  // Function to convert any character to image data URL
  const charToImageUrl = async (char: string, size: number): Promise<string> => {
    const canvas = document.createElement('canvas');
    // Make canvas size dynamic based on the input size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'black';
    // Scale font size relative to canvas size
    const fontSize = Math.floor(size * 0.75);
    ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, size/2, size/2);
    
    return canvas.toDataURL('image/png');
  };

  // Calculate minimum grid size based on the longest word
  const minGridSize = useMemo(() => {
    const currentWords = wordInput
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    const longestWordLength = Math.max(
      // @ts-ignore
      ...currentWords.map((word) => [...segmenter.segment(word)].length),
      // @ts-ignore
      ...words.map((word) => [...segmenter.segment(word)].length),
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
        setError("Failed to generate puzzle. Try changing the grid size or the number of words.");
      }
    }
  };

  // Function to generate the PDF
  const generatePDF = async () => {
    if (!puzzle) return;

    try {
      const pdfDoc = await PDFDocument.create();
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const page = pdfDoc.addPage([595.276, 841.890]); // A4 size in points
      
      const margins = 30;
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const availableWidth = pageWidth - 2 * margins;
      const availableHeight = pageHeight - 2 * margins;

      // Add title
      const titleText = 'Word Search Puzzle';
      const titleSize = 24;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleSize);
      page.drawText(titleText, {
        x: (pageWidth - titleWidth) / 2,
        y: pageHeight - margins - titleSize,
        size: titleSize,
        font: helveticaBold,
      });

      // Add subtitle (website URL)
      const subtitleText = 'wordsearch.sarmiento.cc';
      const subtitleSize = 10;
      const subtitleWidth = helvetica.widthOfTextAtSize(subtitleText, subtitleSize);
      page.drawText(subtitleText, {
        x: (pageWidth - subtitleWidth) / 2,
        y: pageHeight - margins - titleSize - subtitleSize - 2,
        size: subtitleSize,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Adjust starting Y position
      const startY = pageHeight - margins - titleSize - subtitleSize - 15;

      // Calculate grid dimensions - make grid slightly smaller
      const cellSize = Math.min(
        (availableWidth * 0.9) / puzzle.grid.length,
        (availableHeight * 0.6) / puzzle.grid.length // Reduce grid height to 60% of available height
      );
      const gridWidth = cellSize * puzzle.grid.length;
      const gridStartX = (pageWidth - gridWidth) / 2;

      // Draw grid and letters
      for (let i = 0; i < puzzle.grid.length; i++) {
        for (let j = 0; j < puzzle.grid[i].length; j++) {
          const cell = puzzle.grid[i][j];
          const x = gridStartX + j * cellSize;
          const y = startY - i * cellSize;

          // Draw cell border with increased width
          page.drawRectangle({
            x,
            y: y - cellSize,
            width: cellSize,
            height: cellSize,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0,
          });

          // Handle cell content
          if (isEmoji(cell)) {
            // Convert emoji to image with dynamic size
            try {
              // Use a larger canvas size for better quality, then scale down
              const canvasSize = Math.ceil(cellSize * 2);
              const imageUrl = await charToImageUrl(cell, canvasSize);
              const imageBytes = await fetch(imageUrl).then(res => res.arrayBuffer());
              const image = await pdfDoc.embedPng(imageBytes);
              
              // Scale the image to fit within the cell while maintaining aspect ratio
              const scaleFactor = 0.8; // Leave some padding
              const finalSize = cellSize * scaleFactor;
              
              page.drawImage(image, {
                x: x + (cellSize - finalSize) / 2,
                y: y - cellSize + (cellSize - finalSize) / 2,
                width: finalSize,
                height: finalSize,
              });
            } catch (err) {
              console.error('Failed to embed emoji:', err);
            }
          } else {
            // Draw regular text character
            const fontSize = cellSize * 0.75;
            page.drawText(cell, {
              x: x + cellSize * 0.25,
              y: y - cellSize + cellSize * 0.25,
              size: fontSize,
              font: helvetica,
            });
          }
        }
      }

      // Calculate word list position and layout
      const wordSize = 16;
      const wordSpacing = wordSize * 1.5;
      const maxColumns = 5;

      // Calculate the width needed for the longest word
      const getLongestWordWidth = async () => {
        let maxWidth = 0;
        for (const word of puzzle.words) {
          if (isEmoji(word)) {
            // @ts-ignore
            maxWidth = Math.max(maxWidth, [...segmenter.segment(word)].length * wordSize * 1.2);
          } else {
            maxWidth = Math.max(maxWidth, helvetica.widthOfTextAtSize(word, wordSize));
          }
        }
        return maxWidth + wordSize;
      };

      const longestWordWidth = await getLongestWordWidth();
      const columnWidth = Math.max(longestWordWidth + 20, availableWidth / maxColumns);
      const numColumns = Math.min(maxColumns, Math.floor(availableWidth / columnWidth));

      // Function to draw words on a page
      const drawWordsOnPage = async (startIndex: number, currentPage: PDFPage, isFirstPage: boolean) => {
        const pageStartY = isFirstPage ? 
          startY - gridWidth - 40 : // First page (after grid)
          pageHeight - margins; // Subsequent pages

        const pageAvailableHeight = isFirstPage ?
          pageStartY - margins : // First page
          pageHeight - (2 * margins); // Full height for subsequent pages

        const wordsPerColumn = Math.floor(pageAvailableHeight / wordSpacing);
        const maxWordsPerPage = wordsPerColumn * numColumns;
        let wordsDrawn = 0;

        for (let i = 0; i < maxWordsPerPage && (startIndex + i) < puzzle.words.length; i++) {
          const word = puzzle.words[startIndex + i];
          const column = Math.floor(i / wordsPerColumn);
          const row = i % wordsPerColumn;
          const x = margins + column * columnWidth;
          const y = pageStartY - row * wordSpacing;

          let currentX = x + wordSize;

          if (isEmoji(word)) {
            // @ts-ignore
            const segments = [...segmenter.segment(word)];
            for (const segment of segments) {
              const char = segment.segment;
              if (isEmoji(char)) {
                try {
                  // Use consistent size for word list emojis
                  const charUrl = await charToImageUrl(char, wordSize * 2);
                  const charBytes = await fetch(charUrl).then(res => res.arrayBuffer());
                  const charImage = await pdfDoc.embedPng(charBytes);
                  const finalSize = wordSize * 1.2;
                  
                  currentPage.drawImage(charImage, {
                    x: currentX,
                    y: y - wordSize - (finalSize / 4),
                    width: finalSize,
                    height: finalSize,
                  });
                  currentX += finalSize * 1.2;
                } catch (err) {
                  console.error('Failed to embed emoji in word list:', err);
                }
              } else {
                currentPage.drawText(char, {
                  x: currentX,
                  y: y - wordSize,
                  size: wordSize,
                  font: helvetica,
                });
                currentX += helvetica.widthOfTextAtSize(char, wordSize) + 2;
              }
            }
          } else {
            currentPage.drawText(word, {
              x: currentX,
              y: y - wordSize,
              size: wordSize,
              font: helvetica,
            });
          }
          wordsDrawn++;
        }
        return wordsDrawn;
      };

      // Draw words across multiple pages if needed
      let currentWordIndex = 0;
      let currentPage = page;
      let isFirstPage = true;

      while (currentWordIndex < puzzle.words.length) {
        const wordsDrawn = await drawWordsOnPage(currentWordIndex, currentPage, isFirstPage);
        currentWordIndex += wordsDrawn;
        
        if (currentWordIndex < puzzle.words.length) {
          currentPage = pdfDoc.addPage([595.276, 841.890]);
          isFirstPage = false;
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
    if (!showAnswers || !puzzle) return '';
    
    // Find which word position this cell belongs to
    for (let i = 0; i < puzzle.wordPositions.length; i++) {
      const wp = puzzle.wordPositions[i];
      if (wp.positions.some(pos => pos.row === row && pos.col === col)) {
        // Return the color for this word (cycling through colors if more words than colors)
        return HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length];
      }
    }
    return '';
  };

  // Function to handle case transformation
  const transformCase = (text: string) => {
    if (isEmoji(text)) return text;
    return isUpperCase ? text.toUpperCase() : text.toLowerCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 font-segoe">
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
        <div className="bg-white rounded-xl shadow-xl p-6 mb-4">
            <div className="flex flex-col items-center mb-6">
            <div className="flex items-center mb-2">
              <SearchCode className="w-10 h-10 text-indigo-600 mr-3" />
              <h1 className="text-4xl font-bold text-gray-800 font-segoe">
              Word Search Puzzle Generator
              </h1>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 font-segoe">
              wordsearch.sarmiento.cc
            </h2>
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
                    className={`px-3 py-1 rounded-full text-gray-700 font-emoji ${showAnswers ? HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length] : 'bg-gray-100'}`}
                  >
                    {transformCase(word)}
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
          <div className="bg-white rounded-xl shadow-xl p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 font-segoe">
                Preview
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsUpperCase(!isUpperCase)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  <Type className="w-5 h-5" />
                  {isUpperCase ? 'UPPERCASE' : 'lowercase'}
                </button>
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
            </div>
            <div className="grid gap-px bg-gray-200">
              {puzzle.grid.map((row, i) => (
                <div key={i} className="flex gap-px">
                  {row.map((cell, j) => (
                    <span
                      key={j}
                      className={`w-8 h-8 flex items-center justify-center text-lg bg-white transition-colors font-emoji ${
                        isHighlighted(i, j)
                      }`}
                    >
                      {transformCase(cell)}
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
