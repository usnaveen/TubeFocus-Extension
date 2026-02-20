import { useState, createContext, useContext } from 'react';
import { Panel, Group, Separator as PanelSeparator, type SeparatorProps } from 'react-resizable-panels';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Play, 
  Bookmark, 
  Sparkles, 
  TrendingUp, 
  VideoIcon, 
  MessageSquare, 
  X,
  Calendar,
  Target,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Video, Highlight, Session, ChatMessage, SourceCard } from '@/types';
import './App.css';

// Drag Context
interface DragContextType {
  draggedVideo: Video | null;
  setDraggedVideo: (video: Video | null) => void;
}

const DragContext = createContext<DragContextType>({
  draggedVideo: null,
  setDraggedVideo: () => {},
});

// Mock Data
const MOCK_VIDEOS: Video[] = [
  { video_id: 'dQw4w9WgXcQ', title: 'React Hooks Deep Dive', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', save_mode: 'full_transcript', description: 'Advanced patterns' },
  { video_id: 'abc123', title: 'TypeScript Best Practices', thumbnail_url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg', save_mode: 'full_transcript', description: 'Type safety tips' },
  { video_id: 'def456', title: 'Node.js Performance', thumbnail_url: 'https://i.ytimg.com/vi/def456/hqdefault.jpg', save_mode: 'link_only', description: 'Optimization guide' },
  { video_id: 'ghi789', title: 'CSS Grid Mastery', thumbnail_url: 'https://i.ytimg.com/vi/ghi789/hqdefault.jpg', save_mode: 'full_transcript' },
  { video_id: 'jkl012', title: 'Docker for Developers', thumbnail_url: 'https://i.ytimg.com/vi/jkl012/hqdefault.jpg', save_mode: 'link_only', description: 'Container basics' },
];

const MOCK_HIGHLIGHTS: Highlight[] = [
  { id: '1', video_id: 'dQw4w9WgXcQ', video_title: 'React Hooks Deep Dive', text: 'useEffect cleanup is crucial', note: 'Remember to clean up subscriptions', timestamp: 125 },
  { id: '2', video_id: 'dQw4w9WgXcQ', video_title: 'React Hooks Deep Dive', text: 'Custom hooks for reusability', note: 'Extract logic into custom hooks', timestamp: 340 },
  { id: '3', video_id: 'abc123', video_title: 'TypeScript Best Practices', text: 'Never use any', note: 'Use unknown instead', timestamp: 89 },
  { id: '4', video_id: 'def456', video_title: 'Node.js Performance', text: 'Cluster mode for scaling', note: 'Use all CPU cores', timestamp: 215 },
  { id: '5', video_id: 'ghi789', video_title: 'CSS Grid Mastery', text: 'fr units are flexible', note: 'Prefer fr over percentages', timestamp: 156 },
];

const MOCK_SESSIONS: Session[] = [
  { id: '1', date: '2024-01-15', focus_score: 85, videos_watched: 4, highlights_count: 3 },
  { id: '2', date: '2024-01-14', focus_score: 72, videos_watched: 6, highlights_count: 5 },
  { id: '3', date: '2024-01-13', focus_score: 91, videos_watched: 3, highlights_count: 2 },
  { id: '4', date: '2024-01-12', focus_score: 68, videos_watched: 8, highlights_count: 1 },
  { id: '5', date: '2024-01-11', focus_score: 88, videos_watched: 5, highlights_count: 4 },
  { id: '6', date: '2024-01-10', focus_score: 79, videos_watched: 4, highlights_count: 3 },
  { id: '7', date: '2024-01-09', focus_score: 94, videos_watched: 2, highlights_count: 6 },
];

// Custom Resize Handle Component
function ResizeHandle(props: SeparatorProps) {
  return (
    <PanelSeparator
      {...props}
      className="resize-handle"
    />
  );
}

const WITTY_MESSAGES = [
  "You're learning faster than a neural net on caffeine.",
  "Your focus score is trending up! Keep avoiding the cat videos.",
  "Inductive bias? More like inductive brilliance.",
  "Data ingested. Knowledge expanding. Distractions terminated.",
  "You've saved enough content to write a thesis. Time to review?",
  "Your brain's gradient is descending towards wisdom.",
  "Knowledge retention: MAXIMUM. Procrastination: MINIMUM.",
];

// Stats Panel Component
function StatsPanel() {
  const sessions = MOCK_SESSIONS;
  const avgScore = Math.round(sessions.reduce((a, s) => a + s.focus_score, 0) / sessions.length);
  const totalVideos = sessions.reduce((a, s) => a + s.videos_watched, 0);
  const totalHighlights = sessions.reduce((a, s) => a + s.highlights_count, 0);
  const wittyMsg = WITTY_MESSAGES[Math.floor(Math.random() * WITTY_MESSAGES.length)];

  const chartData = sessions.map(s => ({
    date: s.date.slice(5),
    score: s.focus_score,
  })).reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="box-title flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Session Pulse
      </div>
      <div className="witty-summary">"{wittyMsg}"</div>
      
      <div className="grid grid-cols-3 gap-4 px-4 pb-4">
        <div className="text-center">
          <div className="stat-val">{avgScore}%</div>
          <div className="stat-lbl">Avg Focus</div>
        </div>
        <div className="text-center">
          <div className="stat-val">{totalVideos}</div>
          <div className="stat-lbl">Videos</div>
        </div>
        <div className="text-center">
          <div className="stat-val">{totalHighlights}</div>
          <div className="stat-lbl">Highlights</div>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fdf0d5" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#fdf0d5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(253, 240, 213, 0.1)" />
            <XAxis dataKey="date" stroke="rgba(253, 240, 213, 0.5)" fontSize={10} />
            <YAxis domain={[0, 100]} stroke="rgba(253, 240, 213, 0.5)" fontSize={10} />
            <Tooltip 
              contentStyle={{ 
                background: '#fdf0d5', 
                border: 'none', 
                borderRadius: '8px',
                color: '#8a1c24'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#fdf0d5" 
              fill="url(#scoreGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Saved Videos Panel
function SavedVideosPanel() {
  const { setDraggedVideo } = useContext(DragContext);
  const [videos] = useState<Video[]>(MOCK_VIDEOS);

  const handleDragStart = (e: React.DragEvent, video: Video) => {
    setDraggedVideo(video);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(video));
    (e.target as HTMLElement).classList.add('dragging');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove('dragging');
    setDraggedVideo(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="box-title flex items-center gap-2">
        <Bookmark className="w-4 h-4" />
        Saved Videos
        <Badge variant="secondary" className="ml-auto text-xs">
          {videos.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-2 pb-3">
          {videos.map((video) => (
            <div
              key={video.video_id}
              className="video-item"
              draggable
              onDragStart={(e) => handleDragStart(e, video)}
              onDragEnd={handleDragEnd}
              onClick={() => window.open(`https://youtube.com/watch?v=${video.video_id}`, '_blank')}
            >
              <div className="video-title">{video.title}</div>
              <div className="video-meta">
                <span className="flex items-center gap-1">
                  {video.save_mode === 'link_only' ? (
                    <><Bookmark className="w-3 h-3" /> Link only</>
                  ) : (
                    <><Sparkles className="w-3 h-3" /> Transcript indexed</>
                  )}
                </span>
                {video.description && (
                  <span className="truncate max-w-[150px]">{video.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Recent Sessions Panel
function RecentSessionsPanel() {
  const [sessions] = useState<Session[]>(MOCK_SESSIONS);

  return (
    <div className="flex flex-col h-full">
      <div className="box-title flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Recent Sessions
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-2 pb-3">
          {sessions.map((session) => (
            <div key={session.id} className="session-item">
              <div className="session-date">{session.date}</div>
              <div className="session-stats">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {session.focus_score}% focus
                </span>
                <span className="flex items-center gap-1">
                  <VideoIcon className="w-3 h-3" />
                  {session.videos_watched} videos
                </span>
                <span className="flex items-center gap-1">
                  <Bookmark className="w-3 h-3" />
                  {session.highlights_count} highlights
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Highlights Panel
function HighlightsPanel() {
  const [highlights] = useState<Highlight[]>(MOCK_HIGHLIGHTS);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="box-title flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        Recent Highlights
        <Badge variant="secondary" className="ml-auto text-xs">
          {highlights.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-2 pb-3">
          {highlights.map((highlight) => (
            <div key={highlight.id} className="highlight-item">
              <div className="flex items-center gap-2 mb-1">
                <span className="highlight-timestamp">{formatTime(highlight.timestamp)}</span>
                <span className="text-xs text-[var(--tf-text-secondary)] truncate">
                  {highlight.video_title}
                </span>
              </div>
              <div className="highlight-text">"{highlight.text}"</div>
              {highlight.note && (
                <div className="highlight-note">{highlight.note}</div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Chat Panel Component
function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'bot',
      text: 'Hello! I\'m your Librarian Agent. I can query your entire video history. Drag a saved video here to ask about that specific one.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [contextVideo, setContextVideo] = useState<Video | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeVideoPlayer, setActiveVideoPlayer] = useState<{videoId: string, timestamp?: number} | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const video: Video = JSON.parse(data);
        setContextVideo(video);
        setInputText(`Tell me about "${video.title}" and its key highlights.`);
      }
    } catch (err) {
      console.error('Failed to parse dropped video:', err);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Add loading message
    const loadingId = `loading-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: loadingId, type: 'bot', text: 'Searching knowledge base...', isLoading: true },
    ]);

    // Simulate API response
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== loadingId));
      
      // Generate response based on context
      let responseText = '';
      let sources: SourceCard[] = [];

      if (contextVideo) {
        responseText = `Based on "${contextVideo.title}", here are the key insights from the video along with your saved highlights:`;
        const videoHighlights = MOCK_HIGHLIGHTS.filter(h => h.video_id === contextVideo.video_id);
        sources = [{
          video_id: contextVideo.video_id,
          title: contextVideo.title,
          thumbnail_url: contextVideo.thumbnail_url,
          highlights: videoHighlights,
          summary: 'This video covers advanced concepts with practical examples. You\'ve saved ' + videoHighlights.length + ' highlights from this content.',
        }];
        setActiveVideoPlayer({ videoId: contextVideo.video_id });
      } else {
        responseText = 'I found relevant information across your saved videos. Here are the top matches:';
        sources = MOCK_VIDEOS.slice(0, 2).map(v => ({
          video_id: v.video_id,
          title: v.title,
          thumbnail_url: v.thumbnail_url,
          highlights: MOCK_HIGHLIGHTS.filter(h => h.video_id === v.video_id).slice(0, 2),
        }));
      }

      const botMsg: ChatMessage = {
        id: `response-${Date.now()}`,
        type: 'bot',
        text: responseText,
        sources,
      };

      setMessages((prev) => [...prev, botMsg]);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const jumpToTimestamp = (videoId: string, timestamp: number) => {
    setActiveVideoPlayer({ videoId, timestamp });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="box-title flex items-center gap-2 border-b border-[var(--tf-border)] bg-black/10">
        <MessageSquare className="w-4 h-4" />
        Librarian Agent
        {contextVideo && (
          <Badge className="ml-auto bg-[var(--tf-primary)] text-[var(--tf-dark-red)] text-xs">
            Focused Mode
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div className={`message ${msg.type} ${msg.isLoading ? 'loading' : ''}`}>
                {msg.text}
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="source-cards">
                  {msg.sources.map((source) => (
                    <div key={source.video_id} className="source-card">
                      <div className="source-title">{source.title}</div>
                      
                      {/* YouTube Embed */}
                      <iframe
                        className="source-embed"
                        src={`https://www.youtube.com/embed/${source.video_id}${
                          activeVideoPlayer?.videoId === source.video_id && activeVideoPlayer?.timestamp 
                            ? `?start=${activeVideoPlayer.timestamp}` 
                            : ''
                        }`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      
                      {source.summary && (
                        <div className="text-sm mb-3 text-[#6f1118]/80">{source.summary}</div>
                      )}
                      
                      {source.highlights && source.highlights.length > 0 && (
                        <div className="source-highlights">
                          <div className="source-highlights-title">
                            Your Highlights ({source.highlights.length})
                          </div>
                          {source.highlights.map((highlight) => (
                            <div
                              key={highlight.id}
                              className="source-highlight-item"
                              onClick={() => jumpToTimestamp(source.video_id, highlight.timestamp)}
                            >
                              <span className="source-highlight-time">
                                {formatTime(highlight.timestamp)}
                              </span>
                              <span className="source-highlight-text">
                                {highlight.text}
                                {highlight.note && (
                                  <span className="block text-xs mt-1 opacity-70">
                                    Note: {highlight.note}
                                  </span>
                                )}
                              </span>
                              <Play className="w-4 h-4 ml-auto flex-shrink-0 opacity-50" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {contextVideo && (
        <div className="chat-context-chip">
          <span className="truncate">
            Focused: <strong>{contextVideo.title}</strong>
          </span>
          <button 
            onClick={() => {
              setContextVideo(null);
              setActiveVideoPlayer(null);
            }}
            className="flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      <div 
        className={`chat-input-wrapper ${isDragging ? 'drag-target' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isDragging ? 'Drop video here!' : 'Ask about your saved videos...'}
          className="flex-1 bg-black/20 border-[var(--tf-border)] text-[var(--tf-text-main)] placeholder:text-[var(--tf-text-secondary)]"
        />
        <Button 
          onClick={sendMessage}
          className="bg-[var(--tf-primary)] text-[var(--tf-bg)] hover:bg-[var(--tf-primary)]/90 font-semibold"
        >
          Send
        </Button>
      </div>
    </div>
  );
}

// Main App
function App() {
  const [draggedVideo, setDraggedVideo] = useState<Video | null>(null);

  return (
    <DragContext.Provider value={{ draggedVideo, setDraggedVideo }}>
      <div className="h-screen flex flex-col bg-[var(--tf-bg)] overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--tf-border)] bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--tf-primary)] flex items-center justify-center">
              <Target className="w-5 h-5 text-[var(--tf-bg)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--tf-primary)] tracking-tight">
              TubeFocus
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--tf-text-secondary)] bg-black/20 px-3 py-1.5 rounded-full">
              <GripVertical className="w-3 h-3" />
              <span>Drag handles to resize panels</span>
            </div>
            <Badge variant="outline" className="border-[var(--tf-border)] text-[var(--tf-text-secondary)]">
              <Sparkles className="w-3 h-3 mr-1" />
              RAG Powered
            </Badge>
            <div className="text-sm text-[var(--tf-text-secondary)]">
              {MOCK_SESSIONS.length} sessions • {MOCK_VIDEOS.length} videos
            </div>
          </div>
        </header>

        {/* Main Bento Grid */}
        <main className="flex-1 p-4 overflow-hidden">
          <Group orientation="horizontal" className="h-full gap-4">
            {/* Left Column Group */}
            <Panel defaultSize={35} minSize={20} maxSize={55} className="flex flex-col gap-4">
              <Group orientation="vertical" className="flex-1 gap-4">
                {/* Stats Panel */}
                <Panel defaultSize={50} minSize={25} maxSize={75} className="resizable-panel">
                  <StatsPanel />
                </Panel>
                
                <ResizeHandle />
                
                {/* Saved Videos Panel */}
                <Panel defaultSize={50} minSize={25} maxSize={75} className="resizable-panel">
                  <SavedVideosPanel />
                </Panel>
              </Group>
            </Panel>

            <ResizeHandle />

            {/* Middle Column Group */}
            <Panel defaultSize={25} minSize={15} maxSize={45} className="flex flex-col gap-4">
              <Group orientation="vertical" className="flex-1 gap-4">
                {/* Recent Sessions Panel */}
                <Panel defaultSize={50} minSize={25} maxSize={75} className="resizable-panel">
                  <RecentSessionsPanel />
                </Panel>
                
                <ResizeHandle />
                
                {/* Highlights Panel */}
                <Panel defaultSize={50} minSize={25} maxSize={75} className="resizable-panel">
                  <HighlightsPanel />
                </Panel>
              </Group>
            </Panel>

            <ResizeHandle />

            {/* Right Column - Chat */}
            <Panel defaultSize={40} minSize={25} className="resizable-panel">
              <ChatPanel />
            </Panel>
          </Group>
        </main>
      </div>
    </DragContext.Provider>
  );
}

export default App;
