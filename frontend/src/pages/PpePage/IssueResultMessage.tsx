import type { IssueResult } from "../../shared/api/ppe";
import { Message } from "../../modules/ppe-ui/ppe-ui";
export function IssueResultMessage({ result }: { result: IssueResult[] }) {
  return (
    <Message>
      Сохранено выдач: {result.length}.
      {result.map((issue) =>
        issue.warnings.map((warning) => (
          <p className="ppe-warning" key={`${issue.id}:${warning.code}`}>
            {issue.article} — {warning.message}
          </p>
        )),
      )}
    </Message>
  );
}
