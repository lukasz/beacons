import { useState, useCallback, useRef, useEffect } from 'react';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '';
const GIPHY_SEARCH = 'https://api.giphy.com/v1/gifs/search';
const GIPHY_TRENDING = 'https://api.giphy.com/v1/gifs/trending';

interface GiphyImage {
  id: string;
  title: string;
  images: {
    fixed_width: { url: string; width: string; height: string };
    original: { url: string; width: string; height: string };
  };
}

interface Props {
  onSelect: (url: string, width: number, height: number) => void;
  onClose: () => void;
}

export default function GiphyPicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GiphyImage[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchGifs = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const url = q?.trim()
        ? `${GIPHY_SEARCH}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=g`
        : `${GIPHY_TRENDING}?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  // Focus input on mount + load trending
  useEffect(() => {
    inputRef.current?.focus();
    fetchGifs();
  }, [fetchGifs]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchGifs(val), 400);
    },
    [fetchGifs],
  );

  const handleSelect = useCallback(
    (gif: GiphyImage) => {
      const img = gif.images.fixed_width;
      onSelect(img.url, parseInt(img.width, 10), parseInt(img.height, 10));
    },
    [onSelect],
  );

  return (
    <div className="giphy-picker-backdrop" onClick={onClose}>
      <div className="giphy-picker" onClick={(e) => e.stopPropagation()}>
        <div className="giphy-picker-header">
          <input
            ref={inputRef}
            className="giphy-search-input"
            type="text"
            placeholder="Search GIFs…"
            value={query}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <button className="giphy-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="giphy-results">
          {loading && results.length === 0 && (
            <div className="giphy-loading">Loading…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="giphy-empty">No GIFs found</div>
          )}
          {results.map((gif) => (
            <button
              key={gif.id}
              className="giphy-result-item"
              onClick={() => handleSelect(gif)}
              title={gif.title}
            >
              <img
                src={gif.images.fixed_width.url}
                alt={gif.title}
                loading="lazy"
                width={parseInt(gif.images.fixed_width.width, 10)}
                height={parseInt(gif.images.fixed_width.height, 10)}
              />
            </button>
          ))}
        </div>
        <div className="giphy-attribution">
          Powered by GIPHY
        </div>
      </div>
    </div>
  );
}
