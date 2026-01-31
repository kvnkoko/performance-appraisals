import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash, UsersThree, MagnifyingGlass, User, ArrowClockwise, Crown, UserPlus } from 'phosphor-react';
import { TeamDialog } from '@/components/teams/team-dialog';
import { deleteTeam } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';

export function TeamsPage() {
  const { employees, teams, refresh } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [deleting, setDeleting] = useState(false);
  const wasHiddenRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleTeamEvent = () => {
      if (import.meta.env.DEV) console.log('Team event received, refreshing teams list...');
      refresh();
    };
    
    const handleEmployeeEvent = () => {
      if (import.meta.env.DEV) console.log('Employee event received, refreshing teams list...');
      refresh();
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
      } else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if (import.meta.env.DEV) console.log('Tab visible, refreshing teams list...');
        refresh();
      }
    };
    
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60000);
    
    window.addEventListener('teamCreated', handleTeamEvent);
    window.addEventListener('teamUpdated', handleTeamEvent);
    window.addEventListener('employeeCreated', handleEmployeeEvent);
    window.addEventListener('employeeUpdated', handleEmployeeEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('teamCreated', handleTeamEvent);
      window.removeEventListener('teamUpdated', handleTeamEvent);
      window.removeEventListener('employeeCreated', handleEmployeeEvent);
      window.removeEventListener('employeeUpdated', handleEmployeeEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [refresh]);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ open: true, id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    setDeleting(true);
    try {
      await deleteTeam(deleteConfirm.id);
      await refresh();
      toast({ title: 'Success', description: 'Team deleted successfully', variant: 'success' });
      setDeleteConfirm({ open: false, id: null, name: '' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete team. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDialogSuccess = async () => {
    await refresh();
  };

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (team.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get member count for each team
  const getTeamMemberCount = (teamId: string) => {
    return employees.filter((e) => e.teamId === teamId).length;
  };

  // Get department leaders (leaders + executives + HR who lead this department)
  const getTeamLeaders = (teamId: string) => {
    return employees.filter(
      (e) => e.teamId === teamId && (e.hierarchy === 'leader' || e.hierarchy === 'department-leader' || e.hierarchy === 'executive' || e.hierarchy === 'hr')
    );
  };

  // Get team members (non-leaders)
  const getTeamMembers = (teamId: string) => {
    return employees.filter((e) => e.teamId === teamId && e.hierarchy === 'member');
  };

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12 min-w-0 max-w-full">
      {/* Header – award-worthy hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-foreground">Teams</h1>
          <p className="page-subtitle">Organize employees into teams. Edit a team to assign Executives, Leaders, or HR as department heads.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            type="button" 
            onClick={refresh}
            variant="outline"
            size="lg"
            title="Refresh teams list"
          >
            <ArrowClockwise size={20} weight="duotone" className="mr-2" />
            Refresh
          </Button>
          <Button 
            type="button" 
            onClick={() => { setEditingTeam(null); setDialogOpen(true); }}
            size="lg"
          >
            <Plus size={20} weight="duotone" className="mr-2" />
            Create Team
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-10 text-base"
        />
        <MagnifyingGlass size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UsersThree className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No teams found' : 'No teams yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create teams to organize your employees for reviews'}
            </p>
            {!searchQuery && (
              <Button onClick={() => { setEditingTeam(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 min-w-0">
          {filteredTeams.map((team) => {
            const memberCount = getTeamMemberCount(team.id);
            const leaders = getTeamLeaders(team.id);
            const members = getTeamMembers(team.id);
            
            return (
              <Card 
                key={team.id} 
                className="hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <UsersThree size={24} weight="duotone" className="text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {team.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {team.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {team.description}
                    </p>
                  )}
                  
                  {/* Department leaders (Executives + Leaders who lead this team) */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <UserPlus size={12} weight="duotone" />
                      Leaders & department heads
                    </span>
                    {leaders.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {leaders.slice(0, 5).map((leader) => (
                          <span
                            key={leader.id}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                              leader.hierarchy === 'executive'
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                                : leader.hierarchy === 'hr'
                                  ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}
                            title={leader.hierarchy === 'executive' ? 'Executive (department head)' : leader.hierarchy === 'hr' ? 'HR (department head)' : 'Leader'}
                          >
                            {leader.hierarchy === 'executive' ? (
                              <Crown size={12} weight="duotone" className="mr-1" />
                            ) : (
                              <User size={12} weight="duotone" className="mr-1" />
                            )}
                            {leader.name}
                            {leader.hierarchy === 'executive' && (
                              <span className="ml-1 opacity-80">(Exec)</span>
                            )}
                            {leader.hierarchy === 'hr' && (
                              <span className="ml-1 opacity-80">(HR)</span>
                            )}
                          </span>
                        ))}
                        {leaders.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{leaders.length - 5} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No leaders yet. Edit team to add Executives, Leaders, or HR.
                      </p>
                    )}
                  </div>
                  
                  {/* Team Members */}
                  {members.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Members
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {members.map((member) => (
                          <span 
                            key={member.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted"
                          >
                            {member.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Created {formatDate(team.createdAt)}
                  </div>
                  
                  <div className="flex gap-2 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTeam(team.id);
                        setDialogOpen(true);
                      }}
                      title="Edit team details and manage department leaders"
                    >
                      <Pencil size={16} weight="duotone" className="mr-1.5" />
                      Edit & leaders
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(team.id, team.name);
                      }}
                    >
                      <Trash size={16} weight="duotone" className="mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Team"
        description={`Are you sure you want to delete "${deleteConfirm.name}"? Employees in this team will not be deleted, but will need to be reassigned to another team.`}
        confirmText="Delete Team"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />

      <TeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={editingTeam}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
