import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Group } from '@/types/database';

interface GroupSwitcherProps {
  groups: Group[];
  currentGroupId?: string;
  userId: string;
  onGroupSelect?: (groupId: string) => void;
  className?: string;
}

/**
 * Group Switcher Component
 * Allows users to quickly switch between their groups
 * Shows in the navigation header
 */
export function GroupSwitcher({
  groups,
  currentGroupId,
  userId,
  onGroupSelect,
  className,
}: GroupSwitcherProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const currentGroup = groups.find(g => g.id === currentGroupId);

  const handleGroupSelect = (groupId: string) => {
    setOpen(false);
    if (onGroupSelect) {
      onGroupSelect(groupId);
    } else {
      navigate(`/groups/${groupId}`);
    }
  };

  const handleCreateGroup = () => {
    setOpen(false);
    navigate('/groups/create');
  };

  const handleJoinGroup = () => {
    setOpen(false);
    navigate('/groups/join');
  };

  if (groups.length === 0) {
    return (
      <Button variant="outline" size="sm" onClick={handleCreateGroup} className={cn('gap-2', className)}>
        <Plus className="h-4 w-4" />
        Create Group
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            'gap-2 max-w-[200px] justify-between',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {currentGroup ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={currentGroup.photo_url || undefined} alt={currentGroup.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    <Users className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{currentGroup.name}</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Select Group</span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Your Groups
        </DropdownMenuLabel>
        {groups.map((group) => {
          const isPresident = group.president_id === userId;
          const isSelected = group.id === currentGroupId;
          
          return (
            <DropdownMenuItem
              key={group.id}
              onClick={() => handleGroupSelect(group.id)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isSelected && 'bg-primary/5'
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={group.photo_url || undefined} alt={group.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  <Users className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium">{group.name}</p>
                <p className="text-xs text-muted-foreground">
                  {isPresident ? 'President' : 'Member'} • ${group.contribution_amount}
                </p>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateGroup} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Create New Group
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleJoinGroup} className="cursor-pointer">
          <Users className="h-4 w-4 mr-2" />
          Join a Group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
