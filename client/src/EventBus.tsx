const eventBus = {
  on<T>(event: string, callback: (e: CustomEvent<T>) => void) {
    document.addEventListener(event, callback as EventListener);
  },
  dispatch<T>(event: string, data: T) {
    document.dispatchEvent(new CustomEvent(event, { detail: data }));
  },
  remove(event: string, callback: (e: CustomEvent) => void) {
    document.removeEventListener(event, callback as EventListener);
  },
};

export default eventBus;
