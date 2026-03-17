import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

export function NotFound() {
  return (
    <Card
      title="Page not found"
      subtitle="The link you opened doesn’t exist in this UI."
      actions={
        <Link to="/">
          <Button variant="ghost">Go home</Button>
        </Link>
      }
    >
      <div className="text-sm text-slate-300">
        If you expected a screen here, tell me what flow you want and I’ll add it.
      </div>
    </Card>
  );
}

