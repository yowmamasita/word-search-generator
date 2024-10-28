import { describe, it, expect } from 'vitest';
import {
  splitGraphemes,
  countGraphemes,
  getDirections,
  calculateCharacterDistribution,
  selectCharFromDistribution,
  initializeGrid,
  canPlaceWordAt,
  placeWord,
  findValidWordPosition,
  generatePuzzle,
  type Direction,
  type Position,
  type Grid
} from './wordSearch';

describe('Word Search Generator', () => {
  describe('splitGraphemes', () => {
    it('should split basic string into characters', () => {
      expect(splitGraphemes('hello')).toEqual(['h', 'e', 'l', 'l', 'o']);
    });

    it('should handle empty string', () => {
      expect(splitGraphemes('')).toEqual([]);
    });

    it('should handle single emojis', () => {
      expect(splitGraphemes('🫶🏻')).toEqual(['🫶🏻']);
      expect(splitGraphemes('❤️')).toEqual(['❤️']);
      expect(splitGraphemes('🎀')).toEqual(['🎀']);
    });

    it('should handle emoji combinations', () => {
      expect(splitGraphemes('❤️‍🩹')).toEqual(['❤️‍🩹']);
      expect(splitGraphemes('🫶🏻💌')).toEqual(['🫶🏻', '💌']);
    });

    it('should handle alphanumeric strings', () => {
      expect(splitGraphemes('hello123')).toEqual(['h', 'e', 'l', 'l', 'o', '1', '2', '3']);
      expect(splitGraphemes('c0d3r')).toEqual(['c', '0', 'd', '3', 'r']);
    });

    it('should handle strings with symbols', () => {
      expect(splitGraphemes('hello@world')).toEqual(['h', 'e', 'l', 'l', 'o', '@', 'w', 'o', 'r', 'l', 'd']);
      expect(splitGraphemes('test#123!')).toEqual(['t', 'e', 's', 't', '#', '1', '2', '3', '!']);
    });
  });

  describe('countGraphemes', () => {
    it('should count characters in string', () => {
      expect(countGraphemes('hello')).toBe(5);
    });

    it('should return 0 for empty string', () => {
      expect(countGraphemes('')).toBe(0);
    });

    it('should count single emojis as one grapheme', () => {
      expect(countGraphemes('🫶🏻')).toBe(1);
      expect(countGraphemes('❤️')).toBe(1);
      expect(countGraphemes('🎀')).toBe(1);
    });

    it('should count emoji combinations correctly', () => {
      expect(countGraphemes('❤️‍🩹')).toBe(1);
      expect(countGraphemes('🫶🏻💌')).toBe(2);
    });

    it('should count alphanumeric strings correctly', () => {
      expect(countGraphemes('hello123')).toBe(8);
      expect(countGraphemes('c0d3r')).toBe(5);
    });

    it('should count strings with symbols correctly', () => {
      expect(countGraphemes('hello@world')).toBe(11);
      expect(countGraphemes('test#123!')).toBe(9);
    });
  });

  describe('getDirections', () => {
    it('should return basic directions when backwards is false', () => {
      const directions = getDirections(false);
      expect(directions).toHaveLength(4);
      expect(directions.every(d => !d.isBackward)).toBe(true);
    });

    it('should include backward directions when backwards is true', () => {
      const directions = getDirections(true);
      expect(directions).toHaveLength(8);
      expect(directions.filter(d => d.isBackward)).toHaveLength(4);
    });
  });

  describe('calculateCharacterDistribution', () => {
    it('should calculate distribution for simple words', () => {
      const words = ['hello', 'world'];
      const distribution = calculateCharacterDistribution(words, 0, 10);
      
      // Unique chars in 'hello world': h,e,l,o,w,r,d
      expect(distribution).toHaveLength(7);
      expect(distribution[0].cumulativeFreq).toBeGreaterThan(0);
      expect(distribution[distribution.length - 1].cumulativeFreq).toBeCloseTo(1, 10);
    });

    it('should handle empty word list', () => {
      const distribution = calculateCharacterDistribution([], 0, 10);
      expect(distribution).toHaveLength(0);
    });

    it('should handle words with emojis', () => {
      const words = ['🫶🏻hello', '❤️world'];
      const distribution = calculateCharacterDistribution(words, 0, 10);
      expect(distribution.some(d => d.char === '🫶🏻')).toBe(true);
      expect(distribution.some(d => d.char === '❤️')).toBe(true);
    });

    it('should handle words with symbols and numbers', () => {
      const words = ['hello@123', 'world#456'];
      const distribution = calculateCharacterDistribution(words, 0, 10);
      expect(distribution.some(d => d.char === '@')).toBe(true);
      expect(distribution.some(d => d.char === '#')).toBe(true);
      expect(distribution.some(d => d.char === '1')).toBe(true);
    });
  });

  describe('selectCharFromDistribution', () => {
    it('should select character based on random value', () => {
      const distribution = [
        { char: 'a', cumulativeFreq: 0.5 },
        { char: 'b', cumulativeFreq: 1.0 }
      ];
      
      // Mock random generator that always returns 0.25
      const mockRandom = () => 0.25;
      expect(selectCharFromDistribution(distribution, mockRandom)).toBe('a');
      
      // Mock random generator that always returns 0.75
      const mockRandom2 = () => 0.75;
      expect(selectCharFromDistribution(distribution, mockRandom2)).toBe('b');
    });

    it('should handle emoji distribution', () => {
      const distribution = [
        { char: '🫶🏻', cumulativeFreq: 0.5 },
        { char: '❤️', cumulativeFreq: 1.0 }
      ];
      const mockRandom = () => 0.25;
      expect(selectCharFromDistribution(distribution, mockRandom)).toBe('🫶🏻');
    });
  });

  describe('initializeGrid', () => {
    it('should create empty grid of specified size', () => {
      const size = 3;
      const grid = initializeGrid(size);
      
      expect(grid).toHaveLength(size);
      expect(grid[0]).toHaveLength(size);
      expect(grid.every(row => row.every(cell => cell === ''))).toBe(true);
    });
  });

  describe('canPlaceWordAt', () => {
    it('should validate word placement in empty grid', () => {
      const grid: Grid = [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
      ];
      const pos: Position = { row: 0, col: 0 };
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      
      expect(canPlaceWordAt('hi', grid, pos, direction)).toBe(true);
    });

    it('should validate word placement with existing letters', () => {
      const grid: Grid = [
        ['h', '', ''],
        ['', '', ''],
        ['', '', '']
      ];
      const pos: Position = { row: 0, col: 0 };
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      
      expect(canPlaceWordAt('hi', grid, pos, direction)).toBe(true);
      expect(canPlaceWordAt('bye', grid, pos, direction)).toBe(false);
    });

    it('should handle backwards placement', () => {
      const grid: Grid = [
        ['', '', 'i'],
        ['', '', ''],
        ['', '', '']
      ];
      const pos: Position = { row: 0, col: 2 };
      const direction: Direction = { dRow: 0, dCol: -1, isBackward: true };
      
      expect(canPlaceWordAt('hi', grid, pos, direction)).toBe(true);
    });

    it('should validate emoji word placement', () => {
      const grid: Grid = [
        ['🫶🏻', '', ''],
        ['', '', ''],
        ['', '', '']
      ];
      const pos: Position = { row: 0, col: 0 };
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      
      expect(canPlaceWordAt('🫶🏻❤️', grid, pos, direction)).toBe(true);
      expect(canPlaceWordAt('❤️💌', grid, pos, direction)).toBe(false);
    });
  });

  describe('placeWord', () => {
    it('should place word in grid and return positions', () => {
      const grid: Grid = initializeGrid(3);
      const pos: Position = { row: 0, col: 0 };
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      
      const positions = placeWord('hi', grid, pos, direction);
      
      expect(positions).toHaveLength(2);
      expect(grid[0][0]).toBe('h');
      expect(grid[0][1]).toBe('i');
    });

    it('should place word backwards', () => {
      const grid: Grid = initializeGrid(3);
      const pos: Position = { row: 0, col: 0 };
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: true };
      
      const positions = placeWord('hi', grid, pos, direction);
      
      expect(positions).toHaveLength(2);
      expect(grid[0][0]).toBe('i');
      expect(grid[0][1]).toBe('h');
    });

    it('should place word backwards in all directions', () => {
      const grid: Grid = initializeGrid(3);
      
      // Test horizontal backwards
      const pos1: Position = { row: 0, col: 0 };
      const dir1: Direction = { dRow: 0, dCol: 1, isBackward: true };
      placeWord('hi', grid, pos1, dir1);
      expect(grid[0][0]).toBe('i');
      expect(grid[0][1]).toBe('h');

      // Test vertical backwards
      const grid2: Grid = initializeGrid(3);
      const pos2: Position = { row: 0, col: 0 };
      const dir2: Direction = { dRow: 1, dCol: 0, isBackward: true };
      placeWord('hi', grid2, pos2, dir2);
      expect(grid2[0][0]).toBe('i');
      expect(grid2[1][0]).toBe('h');

      // Test diagonal backwards
      const grid3: Grid = initializeGrid(3);
      const pos3: Position = { row: 0, col: 0 };
      const dir3: Direction = { dRow: 1, dCol: 1, isBackward: true };
      placeWord('hi', grid3, pos3, dir3);
      expect(grid3[0][0]).toBe('i');
      expect(grid3[1][1]).toBe('h');
    });

    it('should place emoji word in grid', () => {
      const grid: Grid = initializeGrid(3);
      const pos: Position = { row: 0, col: 0 };
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      
      const positions = placeWord('🫶🏻❤️', grid, pos, direction);
      
      expect(positions).toHaveLength(2);
      expect(grid[0][0]).toBe('🫶🏻');
      expect(grid[0][1]).toBe('❤️');
    });
  });

  describe('findValidWordPosition', () => {
    it('should find valid position in empty grid', () => {
      const grid = initializeGrid(3);
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      const mockRandom = () => 0; // Always select first position
      
      const position = findValidWordPosition('hi', grid, direction, mockRandom);
      
      expect(position).not.toBeNull();
      expect(position?.row).toBe(0);
      expect(position?.col).toBe(0);
    });

    it('should return null when no valid position exists', () => {
      const grid: Grid = [
        ['x', 'x', 'x'],
        ['x', 'x', 'x'],
        ['x', 'x', 'x']
      ];
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      const mockRandom = () => 0;
      
      const position = findValidWordPosition('hi', grid, direction, mockRandom);
      
      expect(position).toBeNull();
    });

    it('should find valid position for emoji word', () => {
      const grid = initializeGrid(3);
      const direction: Direction = { dRow: 0, dCol: 1, isBackward: false };
      const mockRandom = () => 0;
      
      const position = findValidWordPosition('🫶🏻❤️', grid, direction, mockRandom);
      
      expect(position).not.toBeNull();
      expect(position?.row).toBe(0);
      expect(position?.col).toBe(0);
    });
  });

  describe('generatePuzzle', () => {
    it('should generate valid puzzle with simple words', () => {
      const words = ['hi', 'hello'];
      const mockRandom = () => 0.5;
      
      const result = generatePuzzle(words, 5, false, 0, 10, mockRandom);
      
      expect(result.isValid).toBe(true);
      expect(result.wordPositions).toHaveLength(2);
      expect(result.grid).toHaveLength(5);
    });

    it('should handle empty word list', () => {
      const mockRandom = () => 0.5;
      
      expect(() => {
        generatePuzzle([], 5, false, 0, 10, mockRandom);
      }).toThrow('No valid words provided');
    });

    it('should handle words larger than grid', () => {
      const words = ['toolongforagrid'];
      const mockRandom = () => 0.5;
      
      expect(() => {
        generatePuzzle(words, 5, false, 0, 10, mockRandom);
      }).toThrow('No valid words provided');
    });

    it('should generate valid puzzle with emoji words', () => {
      const words = ['🫶🏻❤️', '💌💓'];
      const mockRandom = () => 0.5;
      
      const result = generatePuzzle(words, 5, false, 0, 10, mockRandom);
      
      expect(result.isValid).toBe(true);
      expect(result.wordPositions).toHaveLength(2);
      expect(result.grid).toHaveLength(5);
    });

    it('should generate valid puzzle with alphanumeric words', () => {
      const words = ['hello123', 'test456'];
      const mockRandom = () => 0.5;
      
      const result = generatePuzzle(words, 8, false, 0, 10, mockRandom);
      
      expect(result.isValid).toBe(true);
      expect(result.wordPositions).toHaveLength(2);
      expect(result.grid).toHaveLength(8);
    });

    it('should generate valid puzzle with symbol-containing words', () => {
      const words = ['test#1', 'code@2'];
      const mockRandom = () => 0.5;
      
      const result = generatePuzzle(words, 6, false, 0, 10, mockRandom);
      
      expect(result.isValid).toBe(true);
      expect(result.wordPositions).toHaveLength(2);
      expect(result.grid).toHaveLength(6);
    });
  });
});
