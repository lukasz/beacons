import { describe, it, expect } from 'vitest';
import { ordinal, RANK_MEDALS } from './ranks';

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [10, '10th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [101, '101st'],
    [111, '111th'],
    [112, '112th'],
  ])('ordinal(%i) === %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe('RANK_MEDALS', () => {
  it('has gold/silver/bronze at indexes 1-3 and an empty string at 0', () => {
    expect(RANK_MEDALS[0]).toBe('');
    expect(RANK_MEDALS[1]).toBe('\u{1F947}');
    expect(RANK_MEDALS[2]).toBe('\u{1F948}');
    expect(RANK_MEDALS[3]).toBe('\u{1F949}');
  });
});
