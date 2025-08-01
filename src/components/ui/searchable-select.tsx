'use client';

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface MultiSearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedOption, setSelectedOption] = React.useState<SearchableSelectOption | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Update selected option when value changes
  React.useEffect(() => {
    const option = options.find(opt => opt.value === value);
    setSelectedOption(option || null);
    // When value changes externally, update searchTerm to show the label
    if (option) setSearchTerm(option.label);
    else setSearchTerm("");
  }, [value, options]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // If the searchTerm doesn't match a valid option, reset to selected
        if (selectedOption) setSearchTerm(selectedOption.label);
        else setSearchTerm("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, selectedOption]);

  // Open dropdown on focus
  const handleFocus = () => {
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 50);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  // Handle option select
  const handleOptionSelect = (option: SearchableSelectOption) => {
    setSelectedOption(option);
    onValueChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  // Keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1);
  React.useEffect(() => {
    setHighlightedIndex(filteredOptions.findIndex(opt => opt.value === value));
  }, [filteredOptions, value]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      setHighlightedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && isOpen && highlightedIndex >= 0) {
      handleOptionSelect(filteredOptions[highlightedIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      if (selectedOption) setSearchTerm(selectedOption.label);
      else setSearchTerm("");
    }
  };

  // Style: input and dropdown should not overflow, use ellipsis, set max width
  return (
    <div className={cn("relative", className)} style={{ maxWidth: 340 }}>
      <div className="flex items-center w-full">
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full pr-8 truncate", // space for chevron, truncate long text
            disabled && "bg-muted cursor-not-allowed"
          )}
          style={{ maxWidth: 340 }}
        />
        <ChevronDown
          className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        />
      </div>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-md max-h-60 overflow-auto"
          style={{ maxWidth: 340 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, idx) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground truncate",
                  idx === highlightedIndex && "bg-accent text-accent-foreground",
                  option.value === value && "font-semibold"
                )}
                onClick={() => handleOptionSelect(option)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{ maxWidth: 340 }}
              >
                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                  {option.value === value && (
                    <Check className="h-4 w-4" />
                  )}
                </span>
                <span className="truncate block" style={{ maxWidth: 300 }}>{option.label}</span>
              </button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No options found</div>
          )}
        </div>
      )}
    </div>
  );
}

export function MultiSearchableSelect({
  options,
  value = [],
  onValueChange,
  placeholder = "Select options",
  disabled = false,
  className,
}: MultiSearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Filter options based on search term and exclude already selected ones
  const filteredOptions = React.useMemo(() => {
    let filtered = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    // Exclude already selected options
    filtered = filtered.filter(option => !value.includes(option.value));
    return filtered;
  }, [options, searchTerm, value]);

  // Get selected options
  const selectedOptions = React.useMemo(() => {
    return options.filter(option => value.includes(option.value));
  }, [options, value]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Open dropdown on focus
  const handleFocus = () => {
    setIsOpen(true);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  // Handle option select
  const handleOptionSelect = (option: SearchableSelectOption) => {
    const newValue = [...value, option.value];
    onValueChange(newValue);
    setSearchTerm("");
  };

  // Handle option remove
  const handleOptionRemove = (optionValue: string) => {
    const newValue = value.filter(v => v !== optionValue);
    onValueChange(newValue);
  };

  // Keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      setHighlightedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && isOpen && highlightedIndex >= 0) {
      handleOptionSelect(filteredOptions[highlightedIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  return (
    <div className={cn("relative", className)} style={{ maxWidth: 340 }}>
      <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-background">
        {/* Selected options */}
        {selectedOptions.map((option) => (
          <div
            key={option.value}
            className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded-md text-sm"
          >
            <span className="truncate max-w-32">{option.label}</span>
            <button
              type="button"
              onClick={() => handleOptionRemove(option.value)}
              className="ml-1 hover:bg-primary/80 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        
        {/* Input for search */}
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedOptions.length === 0 ? placeholder : "Add more..."}
          disabled={disabled}
          className="flex-1 min-w-0 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-md max-h-60 overflow-auto"
          style={{ maxWidth: 340 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, idx) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground truncate",
                  idx === highlightedIndex && "bg-accent text-accent-foreground"
                )}
                onClick={() => handleOptionSelect(option)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{ maxWidth: 340 }}
              >
                <span className="truncate block" style={{ maxWidth: 300 }}>{option.label}</span>
              </button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {searchTerm ? "No options found" : "All options selected"}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 