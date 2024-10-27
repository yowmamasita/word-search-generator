export const generateWordSearch = (words: string[], gridSize: number = 50) => {
  const GRID_SIZE = gridSize;
  const grid: string[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
  const processedWords = words
    .map(word => word.replace(/\s+/g, '').toUpperCase())
    .filter(word => word.length > 0 && word.length <= GRID_SIZE)
    .sort((a, b) => b.length - a.length);

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

  const directions = [
    [0, 1],   // right
    [1, 0],   // down
    [1, 1],   // diagonal right down
    [-1, 1],  // diagonal right up
  ];

  const canPlaceWord = (word: string, row: number, col: number, dRow: number, dCol: number) => {
    if (row + dRow * (word.length - 1) >= GRID_SIZE || row + dRow * (word.length - 1) < 0) return false;
    if (col + dCol * (word.length - 1) >= GRID_SIZE || col + dCol * (word.length - 1) < 0) return false;

    for (let i = 0; i < word.length; i++) {
      const currentCell = grid[row + dRow * i][col + dCol * i];
      if (currentCell !== '' && currentCell !== word[i]) return false;
    }
    return true;
  };

  const placeWord = (word: string, row: number, col: number, dRow: number, dCol: number) => {
    for (let i = 0; i < word.length; i++) {
      grid[row + dRow * i][col + dCol * i] = word[i];
    }
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
    words: processedWords
  };
};