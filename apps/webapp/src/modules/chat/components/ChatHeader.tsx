import { Button } from '@/components/ui/button';
import { QueryParams } from '@/lib/constants';
import { ChevronLeft } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Close } from '@/modules/icons';
import { useFloatingChat } from '../hooks/useFloatingChat';

export const ChatHeader = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { supportsFloatingChat } = useFloatingChat();
  const handleBack = () => {
    searchParams.set(QueryParams.Chat, 'false');
    if (!supportsFloatingChat) {
      searchParams.set(QueryParams.Details, 'true');
    }
    setSearchParams(searchParams);
  };

  return (
    <>
      <div className="border-b-brandMiddle/55 block w-full border-b p-4 px-5 md:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="h-6 p-0" onClick={handleBack}>
            <ChevronLeft className="text-textSecondary" />
          </Button>
          {/* <img src="/images/chatbot_logo.svg" alt={`${CHATBOT_NAME} avatar`} width={32} height={32} />
          <Heading variant="extraSmall" className="leading-5 tracking-normal">
            {CHATBOT_NAME}
          </Heading> */}
        </div>
      </div>
      <div id="chat-header-close" className="relative hidden md:block">
        <Button variant="ghost" className="absolute top-4 right-4 h-10 w-10 p-0" onClick={handleBack}>
          <Close boxSize={18} />
        </Button>
      </div>
    </>
  );
};
