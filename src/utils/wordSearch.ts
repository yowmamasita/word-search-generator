export type WordPosition = {
  word: string;
  positions: { row: number; col: number }[];
};

// @ts-ignore - TypeScript doesn't recognize Intl.Segmenter in some environments
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const splitGraphemes = (text: string): string[] => {
  // @ts-ignore - TypeScript doesn't recognize Intl.Segmenter in some environments
  return Array.from(segmenter.segment(text), (s: { segment: string }) => s.segment);
};

const countGraphemes = (text: string): number => {
  return splitGraphemes(text).length;
};

export const generateWordSearch = (
  words: string[],
  gridSize: number = 50,
  allowBackwards: boolean = false
) => {
  const GRID_SIZE = gridSize;
  const MAX_PUZZLE_ATTEMPTS = 10;

  // Process words first to preserve original emoji sequences
  const processedWords = words
    .map(word => word.replace(/\s+/g, ''))
    .filter(word => {
      const chars = splitGraphemes(word);
      console.log(chars);
      return chars.length > 0 && chars.length <= GRID_SIZE;
    })
    .sort((a, b) => {
      const aLength = countGraphemes(a);
      const bLength = countGraphemes(b);
      return bLength - aLength;
    });

  const forwardDirections = [
    [0, 1], // right
    [1, 0], // down
    [1, 1], // diagonal right down
    [-1, 1], // diagonal right up
  ];

  const backwardDirections = [
    [0, -1], // left
    [-1, 0], // up
    [-1, -1], // diagonal left up
    [1, -1], // diagonal left down
  ];

  const directions = allowBackwards
    ? [...forwardDirections, ...backwardDirections]
    : forwardDirections;

  const findWordOccurrences = (word: string, searchGrid: string[][]): number => {
    let count = 0;
    const chars = splitGraphemes(word);

    // Check each cell as a potential starting point
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // Check each direction
        for (const [dRow, dCol] of directions) {
          const endRow = row + dRow * (chars.length - 1);
          const endCol = col + dCol * (chars.length - 1);
          if (
            endRow >= GRID_SIZE ||
            endRow < 0 ||
            endCol >= GRID_SIZE ||
            endCol < 0
          ) {
            continue;
          }

          let matches = true;
          for (let i = 0; i < chars.length; i++) {
            const currentChar = searchGrid[row + dRow * i][col + dCol * i];
            if (currentChar !== chars[i]) {
              matches = false;
              break;
            }
          }
          if (matches) count++;
        }
      }
    }
    return count;
  };

  const generatePuzzle = () => {
    // Get all unique characters from the words
    const uniqueChars = new Set<string>();
    processedWords.forEach(word => {
      const chars = splitGraphemes(word);
      chars.forEach(char => uniqueChars.add(char));
    });

    // Convert to array for random selection
    const fillChars = Array.from(uniqueChars);

    // Initialize grid with random characters from words
    const grid: string[][] = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill('').map(() => fillChars[Math.floor(Math.random() * fillChars.length)])
    );

    const wordPositions: WordPosition[] = [];

    const canPlaceWord = (
      word: string,
      row: number,
      col: number,
      dRow: number,
      dCol: number
    ) => {
      const chars = splitGraphemes(word);
      const endRow = row + dRow * (chars.length - 1);
      const endCol = col + dCol * (chars.length - 1);
      if (endRow >= GRID_SIZE || endRow < 0) return false;
      if (endCol >= GRID_SIZE || endCol < 0) return false;

      // Temporarily place the word
      const tempGrid = grid.map(row => [...row]);
      for (let i = 0; i < chars.length; i++) {
        grid[row + dRow * i][col + dCol * i] = chars[i];
      }

      // Check if this placement creates multiple occurrences of any word
      const isValid = processedWords.every(w => {
        const occurrences = findWordOccurrences(w, grid);
        return occurrences <= 1;
      });

      // Restore the grid
      for (let i = 0; i < GRID_SIZE; i++) {
        grid[i] = [...tempGrid[i]];
      }

      return isValid;
    };

    const placeWord = (
      word: string,
      row: number,
      col: number,
      dRow: number,
      dCol: number
    ) => {
      const chars = splitGraphemes(word);
      const positions: { row: number; col: number }[] = [];
      for (let i = 0; i < chars.length; i++) {
        const currentRow = row + dRow * i;
        const currentCol = col + dCol * i;
        grid[currentRow][currentCol] = chars[i];
        positions.push({ row: currentRow, col: currentCol });
      }
      wordPositions.push({ word, positions });
    };

    // Place words
    let allWordsPlaced = true;
    processedWords.forEach(word => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 1000) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        const direction = directions[Math.floor(Math.random() * directions.length)];

        if (canPlaceWord(word, row, col, direction[0], direction[1])) {
          placeWord(word, row, col, direction[0], direction[1]);
          placed = true;
        }
        attempts++;
      }
      if (!placed) {
        allWordsPlaced = false;
        console.warn(`Could not place word: ${word}`);
      }
    });

    // Validate final grid to ensure no accidental word formations
    const isValid = processedWords.every(word => {
      const occurrences = findWordOccurrences(word, grid);
      return occurrences === 1;
    });

    return {
      grid,
      wordPositions,
      isValid: isValid && allWordsPlaced
    };
  };

  // Try generating valid puzzle multiple times
  let puzzleAttempt = 0;
  let result;
  
  do {
    result = generatePuzzle();
    puzzleAttempt++;
  } while (!result.isValid && puzzleAttempt < MAX_PUZZLE_ATTEMPTS);

  if (!result.isValid) {
    throw new Error("Could not generate a valid puzzle after multiple attempts");
  }

  return {
    grid: result.grid,
    words: processedWords,
    wordPositions: result.wordPositions,
  };
};
