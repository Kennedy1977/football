import { APP_VERSION_LABEL } from "../lib/build-meta";

export function BuildFooter() {
  return <div className="build-footer">Copyright &copy;2026 Andrew Kennedy · {APP_VERSION_LABEL}</div>;
}
