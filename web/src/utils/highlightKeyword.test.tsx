import { describe, expect, it } from 'vitest';
import { highlightKeyword } from './highlightKeyword';

describe('highlightKeyword', () => {
  it('returns original text when keyword is empty', () => {
    const result = highlightKeyword('Hello world', '');
    expect(result).toEqual(['Hello world']);
  });

  it('returns original text when keyword has only whitespace', () => {
    const result = highlightKeyword('Hello world', '   ');
    expect(result).toEqual(['Hello world']);
  });

  it('wraps matched keyword in mark tags', () => {
    const result = highlightKeyword('Hello world', 'world');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Hello ');
    // Check that the marked element has the correct structure
    const marked = result[1] as { type: string; props: { children: string } };
    expect(marked.type).toBe('mark');
    expect(marked.props.children).toBe('world');
    expect(result[2]).toBe('');
  });

  it('is case-insensitive', () => {
    const result = highlightKeyword('Hello WORLD', 'world');
    const marked = result[1] as { type: string; props: { children: string } };
    expect(marked.type).toBe('mark');
    expect(marked.props.children).toBe('WORLD');
  });

  it('highlights multiple matches', () => {
    const result = highlightKeyword('Hello world world', 'world');
    const marked1 = result[1] as { type: string; props: { children: string } };
    const marked2 = result[3] as { type: string; props: { children: string } };
    expect(marked1.type).toBe('mark');
    expect(marked1.props.children).toBe('world');
    expect(marked2.type).toBe('mark');
    expect(marked2.props.children).toBe('world');
  });

  it('handles special regex characters in text', () => {
    const result = highlightKeyword('Hello (world)', 'world');
    expect(result).toHaveLength(3);
    const marked = result[1] as { type: string; props: { children: string } };
    expect(marked.type).toBe('mark');
    expect(marked.props.children).toBe('world');
  });
});
