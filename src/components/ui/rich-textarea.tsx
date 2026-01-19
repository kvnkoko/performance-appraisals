import * as React from 'react';
import { cn } from '@/lib/utils';
import { ListBullets } from 'phosphor-react';

export interface RichTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onValueChange?: (value: string) => void;
}

const RichTextarea = React.forwardRef<HTMLTextAreaElement, RichTextareaProps>(
  ({ className, value = '', onChange, onValueChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) onChange(e);
      if (onValueChange) onValueChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd, value: currentValue } = textarea;
      const lines = currentValue.split('\n');
      const currentLineIndex = currentValue.substring(0, selectionStart).split('\n').length - 1;
      const currentLine = lines[currentLineIndex] || '';

      // Handle Enter key for bullet points - continue bullet on new line
      if (e.key === 'Enter') {
        const bulletPattern = /^[\s]*[•*\-]\s/;
        if (bulletPattern.test(currentLine)) {
          e.preventDefault();
          const indent = currentLine.match(/^[\s]*/)?.[0] || '';
          const newLine = `\n${indent}• `;
          const newValue =
            currentValue.substring(0, selectionStart) +
            newLine +
            currentValue.substring(selectionEnd);
          
          if (onChange) {
            const syntheticEvent = {
              ...e,
              target: { ...textarea, value: newValue },
              currentTarget: { ...textarea, value: newValue },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            onChange(syntheticEvent);
          }
          if (onValueChange) onValueChange(newValue);

          setTimeout(() => {
            const newPosition = selectionStart + newLine.length;
            textarea.setSelectionRange(newPosition, newPosition);
          }, 0);
        }
      }

      // Handle Tab for indentation
      if (e.key === 'Tab' && !e.shiftKey) {
        const bulletPattern = /^[\s]*[•*\-]\s/;
        if (bulletPattern.test(currentLine)) {
          e.preventDefault();
          const indent = currentLine.match(/^[\s]*/)?.[0] || '';
          const newIndent = indent + '  ';
          const bulletChar = currentLine.match(/[•*\-]/)?.[0] || '•';
          const restOfLine = currentLine.replace(/^[\s]*[•*\-]\s*/, '');
          const newLine = newIndent + bulletChar + ' ' + restOfLine;
          lines[currentLineIndex] = newLine;
          const newValue = lines.join('\n');
          
          if (onChange) {
            const syntheticEvent = {
              ...e,
              target: { ...textarea, value: newValue },
              currentTarget: { ...textarea, value: newValue },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            onChange(syntheticEvent);
          }
          if (onValueChange) onValueChange(newValue);
        }
      }

      // Handle Shift+Tab for outdentation
      if (e.key === 'Tab' && e.shiftKey) {
        const bulletPattern = /^[\s]*[•*\-]\s/;
        if (bulletPattern.test(currentLine)) {
          e.preventDefault();
          const indent = currentLine.match(/^[\s]*/)?.[0] || '';
          if (indent.length >= 2) {
            const newIndent = indent.slice(2);
            const bulletChar = currentLine.match(/[•*\-]/)?.[0] || '•';
            const restOfLine = currentLine.replace(/^[\s]*[•*\-]\s*/, '');
            const newLine = newIndent + bulletChar + ' ' + restOfLine;
            lines[currentLineIndex] = newLine;
            const newValue = lines.join('\n');
            
            if (onChange) {
              const syntheticEvent = {
                ...e,
                target: { ...textarea, value: newValue },
                currentTarget: { ...textarea, value: newValue },
              } as React.ChangeEvent<HTMLTextAreaElement>;
              onChange(syntheticEvent);
            }
            if (onValueChange) onValueChange(newValue);
          }
        }
      }
    };

    const toggleBullets = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd, value: currentValue } = textarea;
      
      if (!currentValue) return;
      
      // If no selection, select the current line
      let start = selectionStart;
      let end = selectionEnd;
      
      if (start === end) {
        // No selection - select current line
        const lines = currentValue.split('\n');
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length;
          const lineStart = charCount;
          const lineEnd = charCount + lineLength;
          
          if (selectionStart >= lineStart && selectionStart <= lineEnd) {
            start = lineStart;
            end = lineEnd;
            break;
          }
          charCount += lineLength + 1; // +1 for newline character
        }
      }
      
      // Find which lines are selected
      const textBeforeSelection = currentValue.substring(0, start);
      const textAfterSelection = currentValue.substring(end);
      const selectedText = currentValue.substring(start, end);
      
      const selectedLines = selectedText.split('\n');
      
      // Check if any selected line already has a bullet
      const hasBullets = selectedLines.some(line => /^[\s]*[•*\-]\s/.test(line));
      
      let newSelectedLines: string[];
      
      if (hasBullets) {
        // Remove bullets from all selected lines
        newSelectedLines = selectedLines.map(line => {
          return line.replace(/^([\s]*)[•*\-]\s/, '$1');
        });
      } else {
        // Add bullets to all selected lines
        newSelectedLines = selectedLines.map((line) => {
          // Skip empty lines
          if (line.trim() === '') return line;
          
          // Find existing indentation
          const indent = line.match(/^[\s]*/)?.[0] || '';
          return `${indent}• ${line.trimStart()}`;
        });
      }
      
      const newSelectedText = newSelectedLines.join('\n');
      const newValue = textBeforeSelection + newSelectedText + textAfterSelection;
      
      // Calculate new selection positions
      const newSelectionStart = start;
      const newSelectionEnd = start + newSelectedText.length;
      
      if (onChange) {
        const syntheticEvent = {
          target: { ...textarea, value: newValue },
          currentTarget: { ...textarea, value: newValue },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(syntheticEvent);
      }
      if (onValueChange) onValueChange(newValue);

      // Restore selection
      setTimeout(() => {
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
        textarea.focus();
      }, 0);
    };

    return (
      <div className="relative">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-muted/30 border border-border/30">
          <button
            type="button"
            onClick={toggleBullets}
            className="p-1.5 rounded-md hover:bg-muted transition-colors group"
            title="Toggle bullet points on selected lines"
            onMouseDown={(e) => e.preventDefault()}
          >
            <ListBullets size={16} weight="duotone" className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          <div className="flex-1 text-xs text-muted-foreground">
            <span className="font-medium">Tip:</span> Select multiple lines and click the bullet icon to add/remove bullets • <kbd className="px-1.5 py-0.5 rounded bg-background border border-border/50 text-xs">Tab</kbd> to indent • <kbd className="px-1.5 py-0.5 rounded bg-background border border-border/50 text-xs">Enter</kbd> continues bullets
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={value || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex min-h-[120px] w-full min-w-0 rounded-xl border border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3 text-sm font-medium ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:border-ring/50 transition-all disabled:cursor-not-allowed disabled:opacity-50 resize-y overflow-auto leading-relaxed',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

RichTextarea.displayName = 'RichTextarea';

export { RichTextarea };
