export type WordPosition = {
  word: string;
  positions: { row: number; col: number }[];
};

export type Position = {
  row: number;
  col: number;
};

export type Direction = {
  dRow: number;
  dCol: number;
  isBackward: boolean;
};

export type Grid = string[][];

export type RandomGenerator = () => number;

// @ts-ignore
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

export const splitGraphemes = (text: string): string[] => {
  if (segmenter) {
    // @ts-ignore
    return Array.from(segmenter.segment(text), (s: { segment: string }) => s.segment);
  } else {
    return Array.from(text);
  }
};

export const countGraphemes = (text: string): number => {
  return splitGraphemes(text).length;
};

export const getDirections = (allowBackwards: boolean): Direction[] => {
  const baseDirections: Direction[] = [
    { dRow: 0, dCol: 1, isBackward: false }, // Right
    { dRow: 1, dCol: 0, isBackward: false }, // Down
    { dRow: 1, dCol: 1, isBackward: false }, // Diagonal right down
    { dRow: -1, dCol: 1, isBackward: false }, // Diagonal right up
  ];

  if (allowBackwards) {
    return [
      ...baseDirections,
      { dRow: 0, dCol: 1, isBackward: true }, // Right but backwards
      { dRow: 1, dCol: 0, isBackward: true }, // Down but backwards
      { dRow: 1, dCol: 1, isBackward: true }, // Diagonal right down but backwards
      { dRow: -1, dCol: 1, isBackward: true }, // Diagonal right up but backwards
    ];
  }

  return baseDirections;
};

export const calculateCharacterDistribution = (words: string[], attemptNumber: number, maxAttempts: number) => {
  // Calculate initial character frequencies
  const charFrequency: { [char: string]: number } = {};
  let totalCharCount = 0;

  words.forEach(word => {
    splitGraphemes(word).forEach(char => {
      charFrequency[char] = (charFrequency[char] || 0) + 1;
      totalCharCount++;
    });
  });

  const chars = Object.keys(charFrequency);
  const sortedChars = chars.sort((a, b) => charFrequency[b] - charFrequency[a]);
  
  // Calculate interpolation factor (0 to 1)
  const interpolationFactor = attemptNumber / (maxAttempts - 1);
  
  // Create distribution with interpolated frequencies
  const distribution: { char: string; cumulativeFreq: number }[] = [];
  let cumulative = 0;
  
  sortedChars.forEach((char, index) => {
    const originalFreq = charFrequency[char] / totalCharCount;
    const reversedFreq = charFrequency[sortedChars[sortedChars.length - 1 - index]] / totalCharCount;
    const interpolatedFreq = originalFreq * (1 - interpolationFactor) + reversedFreq * interpolationFactor;
    
    cumulative += interpolatedFreq;
    distribution.push({ char, cumulativeFreq: cumulative });
  });

  return distribution;
};

export const selectCharFromDistribution = (
  distribution: { char: string; cumulativeFreq: number }[],
  random: RandomGenerator
): string => {
  const randomValue = random();
  for (const { char, cumulativeFreq } of distribution) {
    if (randomValue <= cumulativeFreq) {
      return char;
    }
  }
  return distribution[distribution.length - 1].char;
};

export const initializeGrid = (size: number): Grid => {
  return Array.from({ length: size }, () => Array(size).fill(""));
};

export const findValidWordPosition = (
  word: string,
  grid: Grid,
  direction: Direction,
  random: RandomGenerator
): Position | null => {
  const gridSize = grid.length;
  const chars = splitGraphemes(word);
  const wordLength = chars.length;
  const { dRow, dCol } = direction;

  // Calculate valid position ranges based on word length and direction
  const rowMin = Math.max(0, dRow < 0 ? (wordLength - 1) : 0);
  const rowMax = Math.min(gridSize - 1, dRow > 0 ? (gridSize - wordLength) : (gridSize - 1));
  const colMin = Math.max(0, dCol < 0 ? (wordLength - 1) : 0);
  const colMax = Math.min(gridSize - 1, dCol > 0 ? (gridSize - wordLength) : (gridSize - 1));

  if (rowMax < rowMin || colMax < colMin) {
    return null;
  }

  // Generate all possible positions
  const positions: Position[] = [];
  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      if (canPlaceWordAt(word, grid, { row, col }, direction)) {
        positions.push({ row, col });
      }
    }
  }

  // Randomly select from valid positions
  if (positions.length === 0) return null;
  const index = Math.floor(random() * positions.length);
  return positions[index];
};

export const canPlaceWordAt = (
  word: string,
  grid: Grid,
  pos: Position,
  direction: Direction
): boolean => {
  const chars = splitGraphemes(word);
  const { row, col } = pos;
  const { dRow, dCol, isBackward } = direction;
  
  const wordChars = isBackward ? [...chars].reverse() : chars;
  
  for (let i = 0; i < wordChars.length; i++) {
    const currentRow = row + dRow * i;
    const currentCol = col + dCol * i;
    
    // Check bounds
    if (
      currentRow < 0 || 
      currentRow >= grid.length || 
      currentCol < 0 || 
      currentCol >= grid.length
    ) {
      return false;
    }
    
    const existingChar = grid[currentRow][currentCol];
    if (existingChar !== "" && existingChar !== wordChars[i]) {
      return false;
    }
  }
  
  return true;
};

export const placeWord = (
  word: string,
  grid: Grid,
  pos: Position,
  direction: Direction
): Position[] => {
  const chars = splitGraphemes(word);
  const { row, col } = pos;
  const { dRow, dCol, isBackward } = direction;
  const positions: Position[] = [];
  
  // If placing backwards, reverse the word first
  const wordChars = isBackward ? [...chars].reverse() : chars;
  
  for (let i = 0; i < wordChars.length; i++) {
    const currentRow = row + dRow * i;
    const currentCol = col + dCol * i;
    grid[currentRow][currentCol] = wordChars[i];
    positions.push({ row: currentRow, col: currentCol });
  }
  
  return positions;
};

export const generatePuzzle = (
  words: string[],
  gridSize: number,
  allowBackwards: boolean,
  attemptNumber: number,
  maxAttempts: number,
  random: RandomGenerator = Math.random
): { grid: Grid; wordPositions: WordPosition[]; isValid: boolean } => {
  // Process and validate words
  const processedWords = words
    .map(word => word.replace(/\s+/g, ""))
    .filter(word => {
      const chars = splitGraphemes(word);
      return chars.length > 0 && chars.length <= gridSize;
    })
    .sort((a, b) => countGraphemes(b) - countGraphemes(a));

  if (processedWords.length === 0) {
    throw new Error("No valid words provided");
  }

  const grid = initializeGrid(gridSize);
  const wordPositions: WordPosition[] = [];
  const baseDirections = getDirections(false); // Get base directions
  const charDistribution = calculateCharacterDistribution(processedWords, attemptNumber, maxAttempts);

  // Place each word
  for (const word of processedWords) {
    let placed = false;
    
    // Try all possible directions (both forward and backward if allowed)
    const allDirections = baseDirections.map(dir => ({ ...dir }));
    if (allowBackwards) {
      // Add backward versions of all directions
      allDirections.push(...baseDirections.map(dir => ({ ...dir, isBackward: true })));
    }
    
    // Shuffle directions
    const shuffledDirections = [...allDirections].sort(() => random() - 0.5);
    
    // Try each direction until we successfully place the word
    for (const direction of shuffledDirections) {
      const position = findValidWordPosition(word, grid, direction, random);
      if (position) {
        const positions = placeWord(word, grid, position, direction);
        wordPositions.push({ word, positions });
        placed = true;
        break;
      }
    }
    
    if (!placed) {
      return { grid, wordPositions, isValid: false };
    }
  }

  // Fill remaining spaces
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (grid[row][col] === "") {
        grid[row][col] = selectCharFromDistribution(charDistribution, random);
      }
    }
  }

  return { grid, wordPositions, isValid: true };
};

export const generateWordSearch = (
  words: string[],
  gridSize: number = 50,
  allowBackwards: boolean = false
) => {
  const MAX_PUZZLE_ATTEMPTS = 10;
  let puzzleAttempt = 0;
  let result: { grid: Grid; wordPositions: WordPosition[]; isValid: boolean } | null = null;

  while (puzzleAttempt < MAX_PUZZLE_ATTEMPTS) {
    try {
      result = generatePuzzle(
        words,
        gridSize,
        allowBackwards,
        puzzleAttempt,
        MAX_PUZZLE_ATTEMPTS
      );
      
      if (result.isValid) {
        return {
          grid: result.grid,
          words: words,
          wordPositions: result.wordPositions,
        };
      }
    } catch (error) {
      console.warn(`Attempt ${puzzleAttempt + 1} failed:`, error);
    }
    puzzleAttempt++;
  }

  throw new Error("Could not generate a valid puzzle after multiple attempts");
};
