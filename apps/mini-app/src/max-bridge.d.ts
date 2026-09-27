declare global {
  interface Window {
    WebApp?: {
      initData: string;
      platform?: string;
      colorScheme?: "light" | "dark";
      initDataUnsafe?: {
        start_param?: string;
        user?: {
          id: number;
          first_name: string;
          last_name?: string;
          username?: string;
          photo_url?: string;
        };
      };
      shareMaxContent?: (params: {
        mid?: string;
        chatType?: string;
        text?: string;
        link?: string;
      }) => void;
      openLink?: (url: string) => void;
      openMaxLink?: (url: string) => void;
      ready?: () => void;
      close?: () => void;
      onEvent?: (event: string, cb: () => void) => void;
      offEvent?: (event: string, cb: () => void) => void;
      BackButton?: {
        show: () => void;
        hide: () => void;
        onClick: (cb: () => void) => void;
        offClick?: (cb: () => void) => void;
      };
    };
  }
}

export {};
