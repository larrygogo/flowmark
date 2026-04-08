import { describe, it, expect, beforeEach } from 'vitest';
import { useSidebarStore } from '../stores/sidebar';

describe('useSidebarStore', () => {
  beforeEach(() => {
    // Reset store state
    useSidebarStore.setState({
      collapsed: false,
      mobileOpen: false,
      expandedProjectId: null,
    });
  });

  it('initial state', () => {
    const state = useSidebarStore.getState();
    expect(state.collapsed).toBe(false);
    expect(state.mobileOpen).toBe(false);
    expect(state.expandedProjectId).toBeNull();
  });

  it('toggle() flips collapsed', () => {
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(true);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('setMobileOpen() sets mobileOpen', () => {
    useSidebarStore.getState().setMobileOpen(true);
    expect(useSidebarStore.getState().mobileOpen).toBe(true);
    useSidebarStore.getState().setMobileOpen(false);
    expect(useSidebarStore.getState().mobileOpen).toBe(false);
  });

  it('setExpandedProject() sets project id', () => {
    useSidebarStore.getState().setExpandedProject('proj-1');
    expect(useSidebarStore.getState().expandedProjectId).toBe('proj-1');
  });

  it('setExpandedProject(null) clears project id', () => {
    useSidebarStore.getState().setExpandedProject('proj-1');
    useSidebarStore.getState().setExpandedProject(null);
    expect(useSidebarStore.getState().expandedProjectId).toBeNull();
  });
});
