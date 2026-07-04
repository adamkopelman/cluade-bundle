export interface BundleConfig {
  version: string;
  realClaudePath: string;
  bundles: Record<string, {
    path: string;
    url: string;
  }>;
}

export interface BundleManifest {
  name: string;
  description: string;
  include_plugins?: string[];
  mcp?: string;
  memory?: string;
  requires_secrets?: string[];
}

export interface SecretStore {
  [key: string]: string;
}

export interface ResolvedBundle {
  name: string;
  manifest: BundleManifest;
  bundlePath: string;
  pluginDirs: string[];
  mcpPath?: string;
  memoryPath?: string;
  secrets: SecretStore;
}
