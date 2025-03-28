import { Button } from '@/components/ui/button';

type ChatSuggestionRowProps = {
  suggestions: string[];
  sendMessage: (message: string) => void;
};

export const ChatSuggestionsRow = ({ suggestions, sendMessage }: ChatSuggestionRowProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion, index) => (
        <Button variant="suggest" key={index} onClick={() => sendMessage(suggestion)}>
          {suggestion}
        </Button>
      ))}
    </div>
  );
};
