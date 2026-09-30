export interface Alert {
  key: string;
  text: string;
  buttonLabel: string;
  url: string;
}

export interface NtfySettings {
  server: string;
  topic: string;
  token?: string;
}
