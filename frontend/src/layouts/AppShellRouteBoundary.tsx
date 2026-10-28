import { Component, type ReactNode } from "react";

type AppShellRouteBoundaryProps = {
  children: ReactNode;
  routeKey: string;
};

type AppShellRouteBoundaryState = {
  hasError: boolean;
  routeKey: string;
};

export class AppShellRouteBoundary extends Component<
  AppShellRouteBoundaryProps,
  AppShellRouteBoundaryState
> {
  state: AppShellRouteBoundaryState = {
    hasError: false,
    routeKey: this.props.routeKey,
  };

  static getDerivedStateFromProps(
    props: AppShellRouteBoundaryProps,
    state: AppShellRouteBoundaryState,
  ) {
    if (props.routeKey !== state.routeKey) {
      return {
        hasError: false,
        routeKey: props.routeKey,
      };
    }

    return null;
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-page-loading app-page-loading--error" role="alert">
          Не удалось открыть раздел. Обновите страницу и попробуйте снова.
        </div>
      );
    }

    return this.props.children;
  }
}

export function AppShellPageFallback() {
  return (
    <div
      className="app-page-loading app-page-loading--section"
      role="status"
      aria-live="polite"
    >
      Загрузка раздела...
    </div>
  );
}
