import React, { useState, useMemo } from 'react';
import { SearchCode, Download, Eye, EyeOff, X, Type } from 'lucide-react';
import { generateWordSearch, WordPosition } from './utils/wordSearch';
import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

const HIGHLIGHT_COLORS = [
  { class: 'bg-red-200', color: '#fecaca' },
  { class: 'bg-blue-200', color: '#bfdbfe' },
  { class: 'bg-green-200', color: '#bbf7d0' },
  { class: 'bg-purple-200', color: '#e9d5ff' },
  { class: 'bg-pink-200', color: '#fbcfe8' },
  { class: 'bg-orange-200', color: '#fed7aa' },
  { class: 'bg-teal-200', color: '#99f6e4' },
  { class: 'bg-indigo-200', color: '#c7d2fe' },
  { class: 'bg-yellow-200', color: '#fef08a' },
  { class: 'bg-rose-200', color: '#fecdd3' },
];

function App() {
  // @ts-ignore
  const segmenter = typeof Intl !== 'undefined' && new Intl.Segmenter(undefined, { granularity: "grapheme" });
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

  const isEmoji = (str: string): boolean => {
    if (!segmenter) return false;
    return [...segmenter.segment(str)].length !== str.length;
  };

  const charToImageUrl = async (char: string, size: number): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'black';
    const fontSize = Math.floor(size * 0.75);
    ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, size/2, size/2);
    
    return canvas.toDataURL('image/png');
  };

  const minGridSize = useMemo(() => {
    if (!segmenter) return 10;
    const currentWords = wordInput
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    const longestWordLength = Math.max(
      ...currentWords.map((word) => [...segmenter.segment(word)].length),
      ...words.map((word) => [...segmenter.segment(word)].length),
      10
    );
    return longestWordLength;
  }, [wordInput, words, segmenter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newWords = wordInput
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    if (newWords.length > 0) {
      setWords(newWords);
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

  const generatePDF = async () => {
    if (!puzzle) return;

    try {
      const pdfDoc = await PDFDocument.create();
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const page = pdfDoc.addPage([595.276, 841.890]);
      
      const margins = 30;
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const availableWidth = pageWidth - 2 * margins;
      const availableHeight = pageHeight - 2 * margins;

      const titleText = 'Word Search Puzzle';
      const titleSize = 24;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleSize);
      page.drawText(titleText, {
        x: (pageWidth - titleWidth) / 2,
        y: pageHeight - margins - titleSize,
        size: titleSize,
        font: helveticaBold,
      });

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

      const startY = pageHeight - margins - titleSize - subtitleSize - 15;

      const cellSize = Math.min(
        (availableWidth * 0.9) / puzzle.grid.length,
        (availableHeight * 0.6) / puzzle.grid.length
      );
      const gridWidth = cellSize * puzzle.grid.length;
      const gridStartX = (pageWidth - gridWidth) / 2;

      for (let i = 0; i < puzzle.grid.length; i++) {
        for (let j = 0; j < puzzle.grid[i].length; j++) {
          const cell = puzzle.grid[i][j];
          const x = gridStartX + j * cellSize;
          const y = startY - i * cellSize;

          page.drawRectangle({
            x,
            y: y - cellSize,
            width: cellSize,
            height: cellSize,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0,
          });

          if (isEmoji(cell)) {
            try {
              const canvasSize = Math.ceil(cellSize * 2);
              const imageUrl = await charToImageUrl(cell, canvasSize);
              const imageBytes = await fetch(imageUrl).then(res => res.arrayBuffer());
              const image = await pdfDoc.embedPng(imageBytes);
              
              const scaleFactor = 0.8;
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

      const wordSize = 16;
      const wordSpacing = wordSize * 1.5;
      const maxColumns = 5;

      const getLongestWordWidth = async () => {
        let maxWidth = 0;
        for (const word of puzzle.words) {
          if (isEmoji(word)) {
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

      const drawWordsOnPage = async (startIndex: number, currentPage: PDFPage, isFirstPage: boolean) => {
        const pageStartY = isFirstPage ? startY - gridWidth - 40 : pageHeight - margins;
        const pageAvailableHeight = isFirstPage ? pageStartY - margins : pageHeight - (2 * margins);
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
            const segments = [...segmenter.segment(word)];
            for (const segment of segments) {
              const char = segment.segment;
              if (isEmoji(char)) {
                try {
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

  const isHighlighted = (row: number, col: number) => {
    if (!showAnswers || !puzzle) return null;
    
    for (let i = 0; i < puzzle.wordPositions.length; i++) {
      const wp = puzzle.wordPositions[i];
      if (wp.positions.some(pos => pos.row === row && pos.col === col)) {
        return HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length];
      }
    }
    return null;
  };

  const transformCase = (text: string) => {
    if (isEmoji(text)) return text;
    return isUpperCase ? text.toUpperCase() : text.toLowerCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 font-segoe">
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-6 mb-4">
          <div className="flex flex-col items-center mb-6">
            <div className="flex items-center mb-2">
              <SearchCode className="w-10 h-10 text-indigo-600 mr-3" />
              <h1 className="text-4xl font-bold text-gray-800 font-segoe">Word Search Puzzle Generator</h1>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 font-segoe">wordsearch.sarmiento.cc</h2>
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            <div className="mb-4">
              <label htmlFor="words" className="block text-sm font-medium text-gray-700 mb-2">
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

            <div className="mb-4">
              <label htmlFor="gridSize" className="block text-sm font-medium text-gray-700 mb-2">Grid Size</label>
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
                  {Math.max(gridSize, minGridSize)}x{Math.max(gridSize, minGridSize)}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowBackwards}
                  onChange={(e) => setAllowBackwards(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Allow backwards words</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!wordInput.trim()}
              className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Puzzle
            </button>
          </form>

          {words.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-700 font-segoe">Words to Find:</h2>
              <div className="flex flex-wrap gap-2">
                {words.map((word, index) => (
                  <div
                    key={index}
                    className={`px-3 py-1 rounded-full text-gray-700 font-emoji ${showAnswers ? HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length].class : 'bg-gray-100'}`}
                    style={showAnswers ? { backgroundColor: HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length].color } : undefined}
                  >
                    {transformCase(word)}
                  </div>
                ))}
              </div>
            </div>
          )}

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

        {puzzle && (
          <div className="bg-white rounded-xl shadow-xl p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 font-segoe">Preview</h2>
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
                  {showAnswers ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  {showAnswers ? 'Hide Answers' : 'Show Answers'}
                </button>
              </div>
            </div>
            <div className="grid gap-px bg-gray-200">
              {puzzle.grid.map((row, i) => (
                <div key={i} className="flex gap-px">
                  {row.map((cell, j) => {
                    const highlight = isHighlighted(i, j);
                    return (
                      <div
                        key={j}
                        className={`w-8 h-8 flex items-center justify-center text-lg bg-white ${highlight?.class || ''} transition-colors font-emoji`}
                        style={highlight ? { backgroundColor: highlight.color } : undefined}
                      >
                        {transformCase(cell)}
                      </div>
                    );
                  })}
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
