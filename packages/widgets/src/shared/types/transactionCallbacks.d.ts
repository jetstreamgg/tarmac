type StartCallback = (hash?: string) => void;
type SuccessCallback = (hash: string | undefined) => void;
type ErrorCallback = (error: Error, hash: string | undefined) => void;

export interface TransactionCallbacks {
  onStart: StartCallback;
  onSuccess: SuccessCallback;
  onError: ErrorCallback;
}
