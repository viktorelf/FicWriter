export type ConfirmOptions = {
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: "info" | "warning" | "error" | "success";
};

export type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

let confirmHandler: ConfirmFn | null = null;

export function registerConfirm(fn: ConfirmFn) {
  confirmHandler = fn;
}

export async function confirm(message: string, options?: ConfirmOptions) {
  if (confirmHandler) return confirmHandler(message, options);
  return window.confirm(message);
}
