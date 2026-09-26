'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Icon } from './Icon';
import ThemeToggle from './ThemeToggle';

export interface ChatThread {
  id: string;
  title: string;
  courseId?: string;
  materialId?: string;
  resourceReady?: boolean;
  worldTitle?: string;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'grid' as const },
  { label: 'Flashcards', href: '/flashcards', icon: 'bookOpen' as const },
  { label: 'Quizzes', href: '/quizzes', icon: 'target' as const },
  { label: 'Analytics', href: '/analytics', icon: 'search' as const },
];

interface SidebarProps {
  threads?: ChatThread[];
  activeThreadId?: string;
  onNewChat?: () => void;
  onSelectThread?: (id: string) => void;
  onDeleteThread?: (thread: ChatThread) => void;
  onDeleteWorld?: (thread: ChatThread) => void;
  canCreateWorld?: boolean;
  isCreatingWorld?: boolean;
  isCheckingWorld?: boolean;
  onCreateWorld?: () => void;
}

export default function Sidebar({
  threads = [],
  activeThreadId,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  onDeleteWorld,
  canCreateWorld = false,
  isCreatingWorld = false,
  isCheckingWorld = false,
  onCreateWorld,
}: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const savedOpen = localStorage.getItem('questify_sidebar_collapsed') !== 'true';
    setOpen(savedOpen);
    document.documentElement.dataset.sidebarCollapsed = String(!savedOpen);
  }, []);

  const setSidebarOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    document.documentElement.dataset.sidebarCollapsed = String(!nextOpen);
    localStorage.setItem('questify_sidebar_collapsed', String(!nextOpen));
  };

  return (
    <SidebarProvider open={open} onOpenChange={setSidebarOpen} className="questify-sidebar-provider">
      <ShadcnSidebar collapsible="icon" className="questify-shadcn-sidebar">
        <SidebarHeader className="border-b border-sidebar-border p-2">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-sidebar-foreground no-underline">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-serif text-lg font-semibold text-sidebar-primary-foreground">Q</span>
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <strong className="block truncate text-sm font-semibold tracking-tight">Questify</strong>
                <small className="block truncate text-[10px] text-sidebar-foreground/65">Study workspace</small>
              </span>
            </Link>
            <button type="button" className="grid size-7 shrink-0 place-items-center rounded-md border-0 bg-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar" title="Collapse sidebar (Ctrl+B)">
              <Icon name="chevronLeft" size={16} />
            </button>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 px-2 py-3">
          <SidebarGroup className="p-0">
            <SidebarMenu>
              <SidebarMenuItem>
                {onNewChat ? (
                  <SidebarMenuButton onClick={onNewChat} tooltip="New chat" variant="outline" className="mb-1.5 h-10 border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground data-[active=true]:bg-sidebar-primary">
                    <Icon name="plus" size={17} />
                    <span>New chat</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild tooltip="New chat" variant="outline" className="mb-1.5 h-10 border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground">
                    <Link href="/dashboard"><Icon name="plus" size={17} /><span>New chat</span></Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onCreateWorld} disabled={!canCreateWorld || isCreatingWorld || isCheckingWorld} tooltip={isCheckingWorld ? 'Checking workspace resources' : canCreateWorld ? 'Create learning world' : 'Upload a resource first'} className="h-9 border border-dashed border-sidebar-border text-sidebar-foreground hover:border-sidebar-primary hover:bg-sidebar-accent">
                  <Icon name="sparkles" size={16} />
                  <span>{isCheckingWorld ? 'Checking workspace…' : isCreatingWorld ? 'Creating world…' : 'Create world'}</span>
                  <small className="ml-auto text-[10px] text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">{isCheckingWorld ? 'Wait' : canCreateWorld ? 'Ready' : 'Upload'}</small>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-4 p-0">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/55">Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                      <Link href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
                        <Icon name={item.icon} size={17} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {onSelectThread && (
            <SidebarGroup className="mt-4 min-h-0 flex-1 p-0">
              <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/55">Recent chats</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {threads.length ? threads.map((thread) => (
                    <SidebarMenuItem key={thread.id} className="relative">
                      <SidebarMenuButton className="pr-8" onClick={() => onSelectThread(thread.id)} isActive={activeThreadId === thread.id} tooltip={thread.title}>
                        <Icon name="message" size={16} />
                        <span>{thread.title}</span>
                      </SidebarMenuButton>
                      {onDeleteThread && <button type="button" className="absolute right-1 top-1 z-10 grid size-6 place-items-center rounded text-sidebar-foreground/45 hover:bg-red-500/15 hover:text-red-500 focus:bg-red-500/15 focus:text-red-500 group-data-[collapsible=icon]:hidden" onClick={(event) => { event.stopPropagation(); onDeleteThread(thread); }} aria-label={`Delete conversation ${thread.title}`} title="Delete conversation"><Icon name="trash" size={13} /></button>}
                      {thread.worldTitle && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem className="relative">
                            <SidebarMenuSubButton asChild className="pr-8">
                              <Link href={`/roadmap?course=${thread.courseId || ''}&material=${thread.materialId || ''}`} title={thread.worldTitle}>
                                <Icon name="library" size={14} />
                                <span>{thread.worldTitle}</span>
                              </Link>
                            </SidebarMenuSubButton>
                            {onDeleteWorld && <button type="button" className="absolute right-1 top-0 z-10 grid size-6 place-items-center rounded text-sidebar-foreground/45 hover:bg-red-500/15 hover:text-red-500 focus:bg-red-500/15 focus:text-red-500 group-data-[collapsible=icon]:hidden" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDeleteWorld(thread); }} aria-label={`Delete world ${thread.worldTitle}`} title="Delete world"><Icon name="trash" size={12} /></button>}
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  )) : <p className="px-2 py-2 text-xs leading-5 text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">Your chats will appear here.</p>}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          <ThemeToggle />
          <SidebarMenu className="mt-1">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Learner profile" isActive={pathname === '/profile'}>
                <Link href="/profile">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground"><Icon name="user" size={13} /></span>
                  <span className="group-data-[collapsible=icon]:hidden"><strong className="block text-xs font-medium">My profile</strong><small className="block text-[10px] text-sidebar-foreground/55">Progress & security</small></span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </ShadcnSidebar>
      <SidebarTrigger className="questify-mobile-sidebar-trigger fixed bottom-4 left-4 z-40 border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md md:hidden" />
    </SidebarProvider>
  );
}
