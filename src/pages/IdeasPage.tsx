import { useState, useEffect, useCallback } from 'react';
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
// Legacy localStorage key — used only for migration on first load
const LEGACY_STORAGE_KEY = 'claudeball-ideas';

function getUsername(): string {
  let name = localStorage.getItem(USERNAME_KEY);
  if (!name) {
    name = prompt('Enter your name (so we know who suggested it):') || 'Anonymous';
    localStorage.setItem(USERNAME_KEY, name);
  }
  return name;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function IdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newIdea, setNewIdea] = useState('');
  const [category, setCategory] = useState<Idea['category']>('feature');
  const [sortBy, setSortBy] = useState<'votes' | 'newest'>('votes');
  const [filterCat, setFilterCat] = useState<string>('all');

  // Load ideas from API
  const loadIdeas = useCallback(async () => {
    try {
      const data = await apiFetch<Idea[]>('/api/ideas');
      setIdeas(data);
      setApiError(null);
    } catch (err) {
      console.error('Failed to load ideas from API:', err);
      // Graceful fallback: try to read from legacy localStorage
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        const local: Idea[] = raw ? JSON.parse(raw) : [];
        setIdeas(local);
      } catch {
        setIdeas([]);
      }
      setApiError('Could not reach server — showing cached ideas. Changes will sync when reconnected.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  const handleSubmit = async () => {
    if (!newIdea.trim() || submitting) return;
    const author = getUsername();
    setSubmitting(true);
    try {
      const created = await apiFetch<Idea>('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newIdea.trim(), author, category }),
      });
      setIdeas(prev => [created, ...prev]);
      setNewIdea('');
      setApiError(null);
    } catch (err) {
      console.error('Failed to submit idea:', err);
      setApiError('Failed to submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (id: string) => {
    const author = getUsername();
    // Optimistic update
    setIdeas(prev => prev.map(idea => {
      if (idea.id !== id) return idea;
      const hasVoted = idea.votedBy.includes(author);
      return hasVoted
        ? { ...idea, votes: idea.votes - 1, votedBy: idea.votedBy.filter(n => n !== author) }
        : { ...idea, votes: idea.votes + 1, votedBy: [...idea.votedBy, author] };
    }));
    try {
      const updated = await apiFetch<Idea>(`/api/ideas/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author }),
      });
      // Reconcile with server truth
      setIdeas(prev => prev.map(i => i.id === id ? updated : i));
      setApiError(null);
    } catch (err) {
      console.error('Vote failed:', err);
      // Revert optimistic update
      await loadIdeas();
      setApiError('Vote failed — please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    const author = getUsername();
    // Optimistic remove
    setIdeas(prev => prev.filter(i => i.id !== id));
    try {
      await apiFetch(`/api/ideas/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author }),
      });
      setApiError(null);
    } catch (err) {
      console.error('Delete failed:', err);
      // Revert
      await loadIdeas();
      setApiError('Delete failed — please try again.');
    }
  };

  const sorted = [...ideas]
    .filter(i => filterCat === 'all' || i.category === filterCat)
    .sort((a, b) =>
      sortBy === 'votes'
        ? b.votes - a.votes
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const username = localStorage.getItem(USERNAME_KEY) || '';

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Ideas & Feedback</h1>
          <p className="font-mono text-cream-dim text-xs mt-1">
            Suggest features, report bugs, vote on what matters
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Back</Button>
      </div>

      {/* API error banner */}
      {apiError && (
        <div className="mb-4 px-3 py-2 bg-red/10 border border-red/30 rounded-md text-red text-xs font-mono">
          {apiError}
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
        {loading && (
          <div className="text-center py-12 text-cream-dim font-mono text-sm animate-pulse">
            Loading ideas…
          </div>
        )}
        {!loading && sorted.length === 0 && (
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
              navigator.clipboard.writeText(text);
              alert('Ideas copied to clipboard!');
            }}
            className="text-cream-dim/50 hover:text-cream text-xs font-mono cursor-pointer underline underline-offset-4"
          >
            Copy all ideas to clipboard
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
