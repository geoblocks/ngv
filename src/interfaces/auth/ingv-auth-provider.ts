export interface IngvAuthProvider {
  status: 'unknown' | 'logged' | 'unlogged';
  initialize: (config: any) => Promise<void>;
  useForm: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}
