export function useBeforeUnloadGuard(enabled: boolean) {
  const shouldWarn = enabled;

  window.onbeforeunload = shouldWarn
    ? (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
        return "";
      }
    : null;
}
