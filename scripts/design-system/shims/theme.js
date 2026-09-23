const R = window.React;
const read = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
export function useTheme() {
  const [resolved, setResolved] = R.useState(read);
  R.useEffect(() => {
    const mo = new MutationObserver(() => setResolved(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return { theme: resolved, resolvedTheme: resolved, setTheme() {}, mounted: true };
}
