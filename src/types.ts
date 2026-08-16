export interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly locked?: boolean;
}
