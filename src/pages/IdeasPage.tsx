import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';

interface Idea {
  id: string;
  text: string;
  author: string;
  votes: number;
  votedBy: string[];
  createdAt: string;
  category: 'gameplay' | 'graphics' | 'feature' | 'bug' | 'other';
}

const CATEGORIES = [
  { id: 'gameplay', label: 'Gameplay', color: 'text-green-light' },
  { id: 'graphics', label: 'Graphics', color: 'text-blue' },
  { id: 'feature', label: 'Feature', color: 'text-gold' },
  { id: 'bug', label: 'Bug Report', color: 'text-red' },
  { id: 'other', label: 'Other', color: 'text-cream-dim' },
] as const;

const USERNAME_KEY = 'claudeball-username';
const IDEAS_KEY = 'claudeball-ideas-v2';

const SEED_IDEAS: Idea[] = [
  { id: 'seed-1', text: 'Add spring training mode where you can evaluate prospects before the season starts', author: 'BaseballFan99', votes: 12, votedBy: [], createdAt: '2026-01-15T10:00:00Z', category: 'feature' },
  { id: 'seed-2', text: 'International free agency with scouting trips to Japan, Korea, Cuba', author: 'ScoutMaster', votes: 9, votedBy: [], createdAt: '2026-01-18T14:30:00Z', category: 'feature' },
  { id: 'seed-3', text: 'Salary arbitration hearings — argue your case for player contracts', author: 'GMofTheYear', votes: 7, votedBy: [], createdAt: '2026-02-01T09:00:00Z', category: 'gameplay' },
  { id: 'seed-4', text: 'The sunset stadium atmosphere is gorgeous! More weather effects please', author: 'PixelArtLover', votes: 5, votedBy: [], createdAt: '2026-02-10T16:00:00Z', category: 'graphics' },
  { id: 'seed-5', text: 'Rain delay mini-game while waiting for the weather to clear', author: 'FunFirst', votes: 3, votedBy: [], createdAt: '2026-02-15T11:00:00Z', category: 'gameplay' },
];

function loadIdeasFromStorage(): Idea[] {
  try {
    const raw = localStorage.getItem(IDEAS_KEY);
    if (raw) return JSON.parse(raw);
    // First load — seed with starter ideas
    saveIdeasToStorage(SEED_IDEAS);
    return SEED_IDEAS;
  } catch {
    return SEED_IDEAS;
  }
}

function saveIdeasToStorage(ideas: Idea[]) {
  localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
}

export function IdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>(() => loadIdeasFromStorage());
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newIdea, setNewIdea] = useState('');
  const [category, setCategory] = useState<Idea['category']>('feature');
  const [sortBy, setSortBy] = useState<'votes' | 'newest'>('votes');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [username, setUsername] = useState<string>(() => localStorage.getItem(USERNAME_KEY) || '');
  const [pendingUsername, setPendingUsername] = useState('');
  const [showUsernameInput, setShowUsernameInput] = useState(false);

  // Persist ideas to localStorage whenever they change
  useEffect(() => { saveIdeasToStorage(ideas); }, [ideas]);

  const handleSubmit = () => {
    if (!newIdea.trim() || submitting) return;
    if (!username) { setShowUsernameInput(true); return; }
    setSubmitting(true);
    const created: Idea = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: newIdea.trim(),
      author: username,
      votes: 1,
      votedBy: [username],
      createdAt: new Date().toISOString(),
      category,
    };
    setIdeas(prev => [created, ...prev]);
    setNewIdea('');
    setSubmitting(false);
    import('@/stores/achievementStore.ts').then(m => m.useAchievementStore.getState().unlock('idea-submit'));
  };

  const handleSetUsername = () => {
    const name = pendingUsername.trim() || 'Anonymous';
    setUsername(name);
    localStorage.setItem(USERNAME_KEY, name);
    setPendingUsername('');
    setShowUsernameInput(false);
    // Auto-submit the pending idea now that we have a name
    if (newIdea.trim()) {
      const created: Idea = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: newIdea.trim(),
        author: name,
        votes: 1,
        votedBy: [name],
        createdAt: new Date().toISOString(),
        category,
      };
      setIdeas(prev => [created, ...prev]);
      setNewIdea('');
    }
  };

  const handleVote = (id: string) => {
    if (!username) { setShowUsernameInput(true); return; }
    setIdeas(prev => prev.map(idea => {
      if (idea.id !== id) return idea;
      const hasVoted = idea.votedBy.includes(username);
      return hasVoted
        ? { ...idea, votes: idea.votes - 1, votedBy: idea.votedBy.filter(n => n !== username) }
        : { ...idea, votes: idea.votes + 1, votedBy: [...idea.votedBy, username] };
    }));
  };

  const handleDelete = (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
  };

  const sorted = [...ideas]
    .filter(i => filterCat === 'all' || i.category === filterCat)
    .sort((a, b) =>
      sortBy === 'votes'
        ? b.votes - a.votes
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Ideas & Feedback</h1>
          <p className="font-mono text-cream-dim text-xs mt-1">
            Suggest features, report bugs, vote on what matters
          </p>
        </div>
        <div className="flex items-center gap-2">
          {username ? (
            <button
              onClick={() => setShowUsernameInput(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-navy-lighter text-cream-dim text-xs font-mono cursor-pointer hover:text-cream hover:border-gold/40 transition-colors"
            >
              <span className="text-green-light text-[8px]">●</span>
              {username}
            </button>
          ) : (
            <button
              onClick={() => setShowUsernameInput(true)}
              className="flex items-center gap-1 px-2 py-1 rounded border border-gold/40 text-gold/80 text-xs font-mono cursor-pointer hover:text-gold hover:border-gold/70 transition-colors"
            >
              + Set name to submit
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Back</Button>
        </div>
      </div>

      {/* Username input modal */}
      {showUsernameInput && (
        <div className="mb-4 p-3 bg-navy-light border border-gold/30 rounded-lg">
          <p className="text-cream text-sm font-body mb-2">What's your name?</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={pendingUsername}
              onChange={e => setPendingUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetUsername()}
              placeholder="Your name..."
              className="flex-1 bg-navy-lighter border border-navy-lighter rounded px-3 py-1.5 text-cream text-sm font-body placeholder-cream-dim/40 focus:outline-none focus:border-gold/50"
            />
            <Button size="sm" onClick={handleSetUsername}>Set</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowUsernameInput(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Submit new idea */}
      <Panel title="Submit an Idea" className="mb-6">
        <div className="space-y-3">
          <textarea
            value={newIdea}
            onChange={e => setNewIdea(e.target.value)}
            placeholder="What should we add, fix, or change?"
            className="w-full bg-navy-lighter border border-navy-lighter rounded-md px-3 py-2 text-cream text-sm font-body placeholder-cream-dim/40 focus:outline-none focus:border-gold/50 resize-none"
            rows={3}
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as Idea['category'])}
                  className={cn(
                    'px-2 py-1 text-xs rounded font-mono cursor-pointer transition-colors',
                    category === cat.id
                      ? 'bg-gold/20 text-gold border border-gold/40'
                      : 'text-cream-dim hover:text-cream border border-transparent',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={!newIdea.trim() || submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Filters + Sort */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <button
            onClick={() => setFilterCat('all')}
            className={cn(
              'px-2 py-1 text-xs rounded font-mono cursor-pointer',
              filterCat === 'all' ? 'bg-gold/20 text-gold' : 'text-cream-dim hover:text-cream',
            )}
          >
            All ({ideas.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = ideas.filter(i => i.category === cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCat(cat.id)}
                className={cn(
                  'px-2 py-1 text-xs rounded font-mono cursor-pointer',
                  filterCat === cat.id ? 'bg-gold/20 text-gold' : 'text-cream-dim hover:text-cream',
                )}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex gap-1">
          {(['votes', 'newest'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-2 py-1 text-xs rounded font-mono cursor-pointer',
                sortBy === s ? 'bg-navy-lighter text-cream' : 'text-cream-dim hover:text-cream',
              )}
            >
              {s === 'votes' ? 'Top' : 'New'}
            </button>
          ))}
        </div>
      </div>

      {/* Ideas list */}
      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="text-center py-12 text-cream-dim font-mono text-sm">
            No ideas yet — be the first to suggest something!
          </div>
        )}
        {sorted.map(idea => {
          const catInfo = CATEGORIES.find(c => c.id === idea.category);
          const hasVoted = idea.votedBy.includes(username);
          const isAuthor = idea.author === username;
          const timeAgo = getTimeAgo(idea.createdAt);
          return (
            <div
              key={idea.id}
              className="flex gap-3 bg-navy-light border border-navy-lighter rounded-lg p-3 hover:border-navy-lighter/80 transition-colors"
            >
              {/* Vote button */}
              <button
                onClick={() => handleVote(idea.id)}
                className={cn(
                  'flex flex-col items-center justify-center w-12 shrink-0 rounded-md cursor-pointer transition-colors',
                  hasVoted
                    ? 'bg-gold/15 text-gold'
                    : 'bg-navy-lighter text-cream-dim hover:text-gold hover:bg-gold/10',
                )}
              >
                <span className="text-xs">▲</span>
                <span className="text-sm font-bold font-mono">{idea.votes}</span>
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-cream text-sm">{idea.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={cn('text-[10px] font-mono uppercase tracking-wider', catInfo?.color || 'text-cream-dim')}>
                    {catInfo?.label}
                  </span>
                  <span className="text-cream-dim/30">·</span>
                  <span className="text-cream-dim/50 text-[10px] font-mono">{idea.author}</span>
                  <span className="text-cream-dim/30">·</span>
                  <span className="text-cream-dim/50 text-[10px] font-mono">{timeAgo}</span>
                  {isAuthor && (
                    <button
                      onClick={() => handleDelete(idea.id)}
                      className="text-red/50 hover:text-red text-[10px] font-mono cursor-pointer ml-auto"
                    >
                      delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export for sharing */}
      {ideas.length > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              const text = [...ideas]
                .sort((a, b) => b.votes - a.votes)
                .map((i, idx) => `${idx + 1}. [${i.votes} votes] ${i.text} (${i.category}) — ${i.author}`)
                .join('\n');
              navigator.clipboard.writeText(text).catch(() => {});
              setCopied(true); setTimeout(() => setCopied(false), 2000);
            }}
            className="text-cream-dim/50 hover:text-cream text-xs font-mono cursor-pointer underline underline-offset-4"
          >
            {copied ? 'Copied to clipboard!' : 'Copy all ideas to clipboard'}
          </button>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
