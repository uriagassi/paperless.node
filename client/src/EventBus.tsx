const eventBus = {
  on(event:any, callback: (detail: any) => any) {
    document.addEventListener(event, (e) => callback(e.detail));
  },
  dispatch(event:any, data: any) {
    document.dispatchEvent(new CustomEvent(event, { detail: data }));
  },
  remove(event:any, callback: (detail: any) => any) {
    document.removeEventListener(event, callback);
  },
};

export default eventBus;
