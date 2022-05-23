const eventBus = {
  on(event:any, callback: (e : CustomEvent) => any) {
    document.addEventListener(event, callback);
  },
  dispatch(event:any, data: any) {
    document.dispatchEvent(new CustomEvent(event, { detail: data }));
  },
  remove(event:any, callback: (e : CustomEvent) => any) {
    document.removeEventListener(event, callback);
  },
};

export default eventBus;
