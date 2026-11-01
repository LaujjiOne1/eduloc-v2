import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Rechercher...',
  className = '',
  debounceMs = 250,
}) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== value) {
        onChange(localVal);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localVal, debounceMs, onChange, value]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-ink-soft absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm bg-surface text-ink placeholder-ink-faint pl-10 pr-9 py-2.5 rounded-full border border-line hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all backdrop-blur-md"
      />
      {localVal && (
        <button
          type="button"
          onClick={() => {
            setLocalVal('');
            onChange('');
          }}
          className="absolute right-3 p-0.5 text-ink-soft hover:text-ink rounded-md transition-colors"
          title="Effacer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
