/**
 * Highlights keyword matches in text by wrapping them with <mark> tags.
 * Returns a React node array suitable for use in JSX.
 */
export function highlightKeyword(text: string, keyword: string): React.ReactNode[] {
  if (!keyword.trim()) {
    return [text];
  }

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.toLowerCase() === keyword.toLowerCase()) {
      return <mark key={i}>{part}</mark>;
    }
    return part;
  });
}
