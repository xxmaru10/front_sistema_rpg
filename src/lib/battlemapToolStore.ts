
export type Tool = "MOVE" | "PEN" | "ERASER" | "ZOOM" | "IMAGE";
export type BattlemapShapeKind = "FREEHAND" | "RECT" | "CIRCLE" | "DIAMOND" | "TRIANGLE";

class BattlemapToolStore {
  activeTool: Tool = "MOVE";
  penColor: string = "#ff0000";
  showToolbar: boolean = false;
  showLibrary: boolean = false;
  isTheaterMode: boolean = false;
  showLayersPanel: boolean = false;
  activeShape: BattlemapShapeKind = "FREEHAND";
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

  setActiveShape(kind: BattlemapShapeKind) {
    this.activeShape = kind;
    this.notify();
  }

  setShowLayersPanel(show: boolean) {
    this.showLayersPanel = show;
    this.notify();
  }

  toggleLayersPanel() {
    this.showLayersPanel = !this.showLayersPanel;
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
