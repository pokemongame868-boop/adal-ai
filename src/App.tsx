import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { useRouter } from './lib/router';
import { getHealth, type Health } from './lib/api';
import { useChat } from './hooks/useChat';
import { Home } from './views/Home';
import { Assistant } from './views/Assistant';
import { Complaint } from './views/Complaint';
import { Quiz } from './views/Quiz';
import { Resources } from './views/Resources';
import { Feedback } from './views/Feedback';

export default function App() {
  const { route, navigate } = useRouter();
  const chat = useChat();
  const [health, setHealth] = useState<Health | null | 'error'>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [complaintSeed, setComplaintSeed] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth('error'));
  }, []);

  const askAssistant = (prompt?: string) => {
    if (prompt) setPendingPrompt(prompt);
    navigate('assistant');
  };

  const userText = chat.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n');

  const openComplaintFromChat = () => {
    setComplaintSeed(userText);
    navigate('complaint');
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header route={route} navigate={navigate} />
      <main id="main" className="flex-1">
        {route === 'home' && <Home navigate={navigate} ask={askAssistant} />}
        {route === 'assistant' && (
          <Assistant
            chat={chat}
            health={health}
            pendingPrompt={pendingPrompt}
            clearPending={() => setPendingPrompt(null)}
            onDraft={openComplaintFromChat}
          />
        )}
        {route === 'complaint' && (
          <Complaint conversationText={userText} seed={complaintSeed} clearSeed={() => setComplaintSeed(null)} navigate={navigate} />
        )}
        {route === 'quiz' && <Quiz ask={askAssistant} />}
        {route === 'resources' && <Resources />}
        {route === 'feedback' && <Feedback health={health} />}
      </main>
      {route !== 'assistant' && <Footer navigate={navigate} />}
    </div>
  );
}
