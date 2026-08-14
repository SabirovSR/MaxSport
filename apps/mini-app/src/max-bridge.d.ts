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
      shareMaxContent?: (params: { mid: string; chatType?: string }) => void;
      openLink?: (url: string) => void;
      ready?: () => void;
      close?: () => void;
      BackButton?: {
        show: () => void;
        hide: () => void;
        onClick: (cb: () => void) => void;
      };
    };
  }
}

export {};
