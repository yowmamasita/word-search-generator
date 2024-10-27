import React, { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { generateWordSearch } from './utils/wordSearch';
import { jsPDF } from 'jspdf';

function App() {
  const [wordInput, setWordInput] = useState('');
  const [gridSize, setGridSize] = useState(50);
  const [words, setWords] = useState<string[]>([]);
  const [puzzle, setPuzzle] = useState<{ grid: string[][], words: string[] } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newWords = wordInput
      .split(/[\n,]+/)
      .map(word => word.trim())
      .filter(word => word.length > 0);
    
    if (newWords.length > 0) {
      setWords(newWords);
      setPuzzle(generateWordSearch(newWords, gridSize));
      setWordInput('');
    }
  };

  const generatePDF = () => {
    if (!puzzle) return;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margins = 20;
    const availableWidth = pageWidth - (2 * margins);
    const availableHeight = pageHeight - (2 * margins);

    // Add title to first page
    pdf.setFontSize(20);
    pdf.text('Word Search Puzzle', pageWidth / 2, margins, { align: 'center' });

    // Calculate grid dimensions
    const cellSize = Math.min(
      availableWidth / puzzle.grid.length,
      (availableHeight - 30) / puzzle.grid.length // Reserve space for title
    );
    const gridWidth = cellSize * puzzle.grid.length;
    const gridHeight = cellSize * puzzle.grid.length;
    const startX = (pageWidth - gridWidth) / 2; // Center grid horizontally
    const startY = margins + 15;

    // Add the grid with calculated cell size
    const fontSize = Math.max(6, Math.min(10, cellSize * 0.8));
    pdf.setFontSize(fontSize);
    
    puzzle.grid.forEach((row, i) => {
      row.forEach((cell, j) => {
        const x = startX + (j * cellSize);
        const y = startY + (i * cellSize);
        pdf.text(cell, x + (cellSize / 2), y + (cellSize / 2), {
          align: 'center',
          baseline: 'middle'
        });
      });
    });

    // Draw grid lines
    pdf.setLineWidth(0.1);
    // Vertical lines
    for (let i = 0; i <= puzzle.grid.length; i++) {
      pdf.line(
        startX + (i * cellSize),
        startY,
        startX + (i * cellSize),
        startY + gridHeight
      );
    }
    // Horizontal lines
    for (let i = 0; i <= puzzle.grid.length; i++) {
      pdf.line(
        startX,
        startY + (i * cellSize),
        startX + gridWidth,
        startY + (i * cellSize)
      );
    }

    // Start word list on new page
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.text('Words to Find:', margins, margins);

    // Calculate word list layout
    const wordsPerPage = Math.floor((pageHeight - 40) / 7); // 7mm per word, accounting for margins
    const wordsPerColumn = Math.floor((pageHeight - 40) / 7);
    const columnWidth = 60; // Fixed column width in mm
    const maxColumnsPerPage = Math.floor(availableWidth / columnWidth);

    // Add words in columns with pagination
    let currentPage = 1;
    let currentColumn = 0;
    let currentRow = 0;

    pdf.setFontSize(12);
    puzzle.words.forEach((word, index) => {
      // Check if we need a new page
      if (currentColumn >= maxColumnsPerPage) {
        currentColumn = 0;
        currentPage++;
        pdf.addPage();
        pdf.setFontSize(16);
        pdf.text('Words to Find (continued):', margins, margins);
        pdf.setFontSize(12);
      }

      // Calculate position
      const x = margins + (currentColumn * columnWidth);
      const y = margins + 10 + (currentRow * 7);

      // Add bullet point and word
      pdf.text('•', x, y);
      pdf.text(word, x + 5, y);

      // Update position
      currentRow++;
      if (currentRow >= wordsPerPage) {
        currentRow = 0;
        currentColumn++;
      }
    });

    pdf.save('word-search-puzzle.pdf');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
          <div className="flex items-center mb-6">
            <FileText className="w-8 h-8 text-indigo-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">Word Search Generator</h1>
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            <div className="mb-4">
              <label htmlFor="words" className="block text-sm font-medium text-gray-700 mb-2">
                Enter words (separated by commas or new lines)
              </label>
              <textarea
                id="words"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder="Example:&#10;HELLO&#10;WORLD, PUZZLE&#10;SEARCH"
                className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="gridSize" className="block text-sm font-medium text-gray-700 mb-2">
                Grid Size
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="gridSize"
                  min="15"
                  max="100"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-600 min-w-[3rem]">
                  {gridSize}x{gridSize}
                </span>
              </div>
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
              <h2 className="text-lg font-semibold mb-3 text-gray-700">Words to Find:</h2>
              <div className="flex flex-wrap gap-2">
                {words.map((word, index) => (
                  <div
                    key={index}
                    className="bg-gray-100 px-3 py-1 rounded-full text-gray-700"
                  >
                    {word}
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
          <div className="bg-white rounded-xl shadow-xl p-8 overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Preview</h2>
            <div className="font-mono text-xs whitespace-pre">
              {puzzle.grid.map((row, i) => (
                <div key={i} className="flex">
                  {row.map((cell, j) => (
                    <span key={j} className="w-6 h-6 flex items-center justify-center">
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