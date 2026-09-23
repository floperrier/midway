const R = window.React;
export function Link({ to, ...rest }) {
  return R.createElement("a", { href: to, ...rest });
}
