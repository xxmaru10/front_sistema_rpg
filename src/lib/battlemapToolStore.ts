
export type Tool = "MOVE" | "PEN" | "ERASER" | "ZOOM" | "IMAGE";
export type TheaterTool = "CAMADAS" | "PERSONAGEM" | "OBJETO" | "CENARIO" | "TEXTO";
export type SessionSurfaceTab = "characters" | "log" | "combat" | "bestiary" | "notes" | "vi" | "theater";

class BattlemapToolStore {
  activeTool: Tool = "MOVE";
  penColor: string = "#ff0000";
  showToolbar: boolean = false;
  showLibrary: boolean = false;
  isTheaterMode: boolean = false;
  activeSurfaceTab: SessionSurfaceTab = "characters";
  theaterTool: TheaterTool = "CAMADAS";
  theaterLayersOpen: boolean = false;
  theaterBackgroundEditing: boolean = false;
  listeners: (() => void)[] = [];

  setTool(tool: Tool) {
    this.activeTool = tool;
    this.notify();
  }

  isTheaterActive() {
    return this.isTheaterMode;
  }

  toggleTheaterMode() {
    this.isTheaterMode = !this.isTheaterMode;
    this.notify();
  }

  setTheaterMode(val: boolean) {
    this.isTheaterMode = val;
    this.notify();
  }

  setActiveSurfaceTab(tab: SessionSurfaceTab) {
    this.activeSurfaceTab = tab;
    this.notify();
  }

  setTheaterTool(tool: TheaterTool) {
    this.theaterTool = tool;
    this.notify();
  }

  setTheaterLayersOpen(open: boolean) {
    this.theaterLayersOpen = open;
    this.notify();
  }

  setTheaterBackgroundEditing(editing: boolean) {
    this.theaterBackgroundEditing = editing;
    this.notify();
  }

  setPenColor(color: string) {
    this.penColor = color;
    this.notify();
  }

  setShowToolbar(show: boolean) {
    this.showToolbar = show;
    this.notify();
  }

  toggleToolbar() {
    this.showToolbar = !this.showToolbar;
    this.notify();
  }

  setShowLibrary(show: boolean) {
    this.showLibrary = show;
    this.notify();
  }

  openLibrary() {
    this.showLibrary = true;
    this.notify();
  }

  closeLibrary() {
    this.showLibrary = false;
    this.notify();
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l());
  }
}

export const battlemapToolStore = new BattlemapToolStore();
