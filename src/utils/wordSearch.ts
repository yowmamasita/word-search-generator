export type WordPosition = {
  word: string;
  positions: { row: number; col: number }[];
};

export const generateWordSearch = (words: string[], gridSize: number = 50, allowBackwards: boolean = false) => {
  const GRID_SIZE = gridSize;
  const grid: string[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
  const processedWords = words
    .map(word => word.replace(/\s+/g, '').toUpperCase())
    .filter(word => word.length > 0 && word.length <= GRID_SIZE)
    .sort((a, b) => b.length - a.length);

  const wordPositions: WordPosition[] = [];

  // Get frequency map of all letters in words
  const letterFreq = new Map<string, number>();
  processedWords.forEach(word => {
    [...word].forEach(letter => {
      letterFreq.set(letter, (letterFreq.get(letter) || 0) + 1);
    });
  });

  // Get top 10 most frequent letters
  const fillLetters = [...letterFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([letter]) => letter);

  const forwardDirections = [
    [0, 1],   // right
    [1, 0],   // down
    [1, 1],   // diagonal right down
    [-1, 1],  // diagonal right up
  ];

  const backwardDirections = [
    [0, -1],  // left
    [-1, 0],  // up
    [-1, -1], // diagonal left up
    [1, -1],  // diagonal left down
  ];

  const directions = allowBackwards 
    ? [...forwardDirections, ...backwardDirections]
    : forwardDirections;

  const findWordOccurrences = (word: string): number => {
    let count = 0;
    
    // Check each cell as a potential starting point
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // Check each direction
        for (const [dRow, dCol] of directions) {
          if (row + dRow * (word.length - 1) >= GRID_SIZE || 
              row + dRow * (word.length - 1) < 0 ||
              col + dCol * (word.length - 1) >= GRID_SIZE || 
              col + dCol * (word.length - 1) < 0) {
            continue;
          }

          let matches = true;
          for (let i = 0; i < word.length; i++) {
            if (grid[row + dRow * i][col + dCol * i] !== word[i]) {
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

  const canPlaceWord = (word: string, row: number, col: number, dRow: number, dCol: number) => {
    if (row + dRow * (word.length - 1) >= GRID_SIZE || row + dRow * (word.length - 1) < 0) return false;
    if (col + dCol * (word.length - 1) >= GRID_SIZE || col + dCol * (word.length - 1) < 0) return false;

    // Check if placement is possible
    for (let i = 0; i < word.length; i++) {
      const currentCell = grid[row + dRow * i][col + dCol * i];
      if (currentCell !== '' && currentCell !== word[i]) return false;
    }

    // Temporarily place the word
    const tempGrid = grid.map(row => [...row]);
    for (let i = 0; i < word.length; i++) {
      grid[row + dRow * i][col + dCol * i] = word[i];
    }

    // Check if this placement creates multiple occurrences of any word
    const isValid = processedWords.every(w => {
      const occurrences = findWordOccurrences(w);
      return occurrences <= 1;
    });

    // Restore the grid
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        grid[i][j] = tempGrid[i][j];
      }
    }

    return isValid;
  };

  const placeWord = (word: string, row: number, col: number, dRow: number, dCol: number) => {
    const positions: { row: number; col: number }[] = [];
    for (let i = 0; i < word.length; i++) {
      const currentRow = row + dRow * i;
      const currentCol = col + dCol * i;
      grid[currentRow][currentCol] = word[i];
      positions.push({ row: currentRow, col: currentCol });
    }
    wordPositions.push({ word, positions });
  };

  // Place words
  processedWords.forEach(word => {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      const direction = directions[Math.floor(Math.random() * directions.length)];

      if (canPlaceWord(word, row, col, direction[0], direction[1])) {
        placeWord(word, row, col, direction[0], direction[1]);
        placed = true;
      }
      attempts++;
    }
  });

  // Fill empty spaces
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (grid[i][j] === '') {
        grid[i][j] = fillLetters[Math.floor(Math.random() * fillLetters.length)];
      }
    }
  }

  return {
    grid,
    words: processedWords,
    wordPositions
  };
};
