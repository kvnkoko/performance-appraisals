import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ClipboardText, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  MagnifyingGlass,
  Warning,
  CalendarBlank
} from 'phosphor-react';
import { formatDate } from '@/lib/utils';

type FilterType = 'all' | 'pending' | 'completed';

export function MyAppraisalsPage() {
  const { links, employees, templates, loading } = useApp();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const storedEmployeeId = localStorage.getItem('employeeId');
    if (storedEmployeeId) {
      setEmployeeId(storedEmployeeId);
    }
  }, []);

  // Get all appraisal links assigned to this employee (as appraiser)
  const myLinks = links.filter(link => {
    if (!employeeId) return false;
    return link.appraiserId === employeeId;
  });

  // Apply filter
  const filteredLinks = myLinks.filter(link => {
    const targetEmployee = employees.find(e => e.id === link.employeeId);
    const matchesSearch = !searchQuery || 
      targetEmployee?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.reviewPeriodName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    switch (filter) {
      case 'pending':
        const isNotExpired = !link.expiresAt || new Date(link.expiresAt) > new Date();
        return !link.used && isNotExpired;
      case 'completed':
        return link.used;
      default:
        return true;
    }
  });

  // Sort by expiration (urgent first) then by creation date
  const sortedLinks = [...filteredLinks].sort((a, b) => {
    // Pending first
    if (!a.used && b.used) return -1;
    if (a.used && !b.used) return 1;
    
    // Expiring soon first (for pending)
    if (!a.used && !b.used) {
      if (a.expiresAt && b.expiresAt) {
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      }
      if (a.expiresAt && !b.expiresAt) return -1;
      if (!a.expiresAt && b.expiresAt) return 1;
    }
    
    // Newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const pendingCount = myLinks.filter(l => !l.used && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length;
  const completedCount = myLinks.filter(l => l.used).length;

  // Check if link is expiring soon (within 3 days)
  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const expireDate = new Date(expiresAt);
    const now = new Date();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return expireDate.getTime() - now.getTime() < threeDays && expireDate > now;
  };

  // Check if link is expired
  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Appraisals</h1>
        <p className="text-muted-foreground mt-2">
          Reviews assigned to you for completion
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <button
          onClick={() => setFilter('pending')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            filter === 'pending' 
              ? 'border-amber-500 bg-amber-500/10' 
              : 'border-border hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock size={24} weight="duotone" className="text-amber-500" />
            <div className="text-left">
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setFilter('completed')}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            filter === 'completed' 
              ? 'border-green-500 bg-green-500/10' 
              : 'border-border hover:border-green-500/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle size={24} weight="duotone" className="text-green-500" />
            <div className="text-left">
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search by employee name or review period..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-10 text-base"
        />
        <MagnifyingGlass size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Appraisal List */}
      {sortedLinks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            {filter === 'pending' ? (
              <>
                <CheckCircle size={48} weight="duotone" className="text-green-500/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground text-center">
                  You have no pending appraisals to complete.
                </p>
              </>
            ) : filter === 'completed' ? (
              <>
                <ClipboardText size={48} weight="duotone" className="text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed appraisals</h3>
                <p className="text-muted-foreground text-center">
                  You haven't completed any appraisals yet.
                </p>
              </>
            ) : (
              <>
                <ClipboardText size={48} weight="duotone" className="text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No appraisals found</h3>
                <p className="text-muted-foreground text-center">
                  {searchQuery ? 'Try adjusting your search.' : 'No appraisals have been assigned to you.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedLinks.map(link => {
            const targetEmployee = employees.find(e => e.id === link.employeeId);
            const template = templates.find(t => t.id === link.templateId);
            const expired = isExpired(link.expiresAt);
            const expiringSoon = isExpiringSoon(link.expiresAt);
            
            return (
              <Card 
                key={link.id}
                className={`transition-all ${
                  link.used 
                    ? 'opacity-75' 
                    : expired 
                      ? 'border-red-500/50 bg-red-500/5' 
                      : expiringSoon 
                        ? 'border-amber-500/50 bg-amber-500/5' 
                        : 'hover:shadow-lg'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${
                        link.used 
                          ? 'bg-green-500/10' 
                          : expired 
                            ? 'bg-red-500/10' 
                            : 'bg-primary/10'
                      }`}>
                        {link.used ? (
                          <CheckCircle size={24} weight="duotone" className="text-green-500" />
                        ) : expired ? (
                          <Warning size={24} weight="duotone" className="text-red-500" />
                        ) : (
                          <ClipboardText size={24} weight="duotone" className="text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-lg">
                          Review for {targetEmployee?.name || 'Unknown Employee'}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          {link.reviewPeriodName && (
                            <span className="flex items-center gap-1">
                              <CalendarBlank size={14} />
                              {link.reviewPeriodName}
                            </span>
                          )}
                          {template && (
                            <span>• {template.name}</span>
                          )}
                        </div>
                        {link.expiresAt && !link.used && (
                          <div className={`text-xs mt-1 ${
                            expired ? 'text-red-500' : expiringSoon ? 'text-amber-500' : 'text-muted-foreground'
                          }`}>
                            {expired 
                              ? `Expired on ${formatDate(link.expiresAt)}`
                              : expiringSoon
                                ? `Due soon: ${formatDate(link.expiresAt)}`
                                : `Due: ${formatDate(link.expiresAt)}`
                            }
                          </div>
                        )}
                        {link.used && (
                          <div className="text-xs text-green-600 mt-1">
                            Completed
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!link.used && !expired && (
                        <Link to={`/appraisal/${link.token}`}>
                          <Button>
                            Start Review
                            <ArrowRight size={16} className="ml-2" />
                          </Button>
                        </Link>
                      )}
                      {link.used && (
                        <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
                          Submitted
                        </span>
                      )}
                      {expired && !link.used && (
                        <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-sm font-medium">
                          Expired
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
