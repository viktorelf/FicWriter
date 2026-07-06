import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { registerConfirm, type ConfirmOptions } from "./confirmService";

type ConfirmState = {
  open: boolean;
  message: string;
  options?: ConfirmOptions;
};

type ConfirmContextValue = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [state, setState] = useState<ConfirmState>({
    open: false,
    message: "",
  });

  const confirmFn = useCallback((message: string, options?: ConfirmOptions) => {
    setState({ open: true, message, options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    registerConfirm(confirmFn);
    return () => registerConfirm(async (message) => window.confirm(message));
  }, [confirmFn]);

  const onClose = useCallback((value: boolean) => {
    setState((current) => ({ ...current, open: false }));
    const resolver = resolverRef.current;
    resolverRef.current = null;
    if (resolver) resolver(value);
  }, []);

  const ctxValue = useMemo(() => confirmFn, [confirmFn]);

  return (
    <ConfirmContext.Provider value={ctxValue}>
      {children}
      {state.open ? (
        <div className="modal-backdrop">
          <div className={`modal-sheet ${state.options?.kind ? `is-${state.options.kind}` : ""}`}>
            {state.options?.title ? <div className="modal-title">{state.options.title}</div> : null}
            <div className="modal-message">{state.message}</div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => onClose(false)}>
                {state.options?.cancelLabel ?? "Отмена"}
              </button>
              <button className="primary-btn" onClick={() => onClose(true)}>
                {state.options?.okLabel ?? "Ок"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
