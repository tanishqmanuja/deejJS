import { defer, distinctUntilChanged, Observable, pluck, tap } from 'rxjs';

export const selectDistinctState =
  <T, I extends keyof T>(key: I) =>
  (source$: Observable<T>) =>
    source$.pipe(pluck(key), distinctUntilChanged());

export const debuggerTap =
  <T>(name: string, silent?: boolean) =>
  (source$: Observable<T>) =>
    defer(() =>
      silent
        ? source$
        : source$.pipe(
            tap({
              next: (val) =>
                console.log(`${name} pipe nexted with value:${val}`),
              error: (err) =>
                console.log(`${name} pipe errored with error:${err}`),
              complete: () => console.log(`${name} pipe completed`),
            }),
          ),
    );
